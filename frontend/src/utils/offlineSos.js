/**
 * Offline SOS queue (docs/AGENT-FLOW.md section 2B).
 *
 * The critical path must not depend on the network being up at the moment
 * of trigger. If navigator.onLine is false (or the POST itself fails), the
 * SOS payload is queued here with its true trigger time preserved
 * (`client_created_at`), and flushed automatically the next time the
 * browser comes back online (or on load, in case connectivity returned
 * while the tab was closed/backgrounded).
 *
 * Sent with `via_offline_sync: true` so the backend/responders can tell a
 * late-synced report apart from one that arrived live -- see
 * backend/app/routers/sos.py and INTEGRATION-CONTRACT.md field table.
 */
import { api } from '../services/api';

const KEY = 'crisis_connect_offline_sos_queue';

function readQueue() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function writeQueue(queue) {
  try {
    localStorage.setItem(KEY, JSON.stringify(queue));
  } catch (_) {/* storage unavailable (private mode / quota) -- nothing more we can do client-side */}
}

/**
 * Queue one SOS payload for later sync. Preserves an already-present
 * `client_created_at` (e.g. a retry) instead of overwriting it, so the
 * true trigger time survives repeated queue attempts.
 * Returns the exact stored item (useful for correlating it against a
 * later flushQueue() result once connectivity returns).
 */
export function queueSos(payload) {
  const queue = readQueue();
  const item = {
    ...payload,
    client_created_at: payload.client_created_at || new Date().toISOString(),
  };
  queue.push(item);
  writeQueue(queue);
  return item;
}

export function queueLength() {
  return readQueue().length;
}

export function peekQueue() {
  return readQueue();
}

// Guards against overlapping flush attempts -- watchForReconnect can fire
// from both the immediate on-load check and a near-simultaneous 'online'
// event (e.g. the browser flips online right as the app starts), and two
// concurrent flushes would each try to POST the same queued items.
let flushing = false;

/**
 * Attempt to send every queued SOS, in original (FIFO) order. Leaves
 * failures in the queue for the next attempt; removes successes.
 * Returns { sent, remaining, results }, where `results` is one entry per
 * item that was actually attempted this call:
 *   { item, response }  on success (response is the {request, incident} body)
 *   { item, error }     on failure (still queued)
 */
export async function flushQueue() {
  if (flushing) return { sent: 0, remaining: queueLength(), results: [] };
  const queue = readQueue();
  if (!queue.length) return { sent: 0, remaining: 0, results: [] };

  flushing = true;
  const stillQueued = [];
  const results = [];
  let sent = 0;
  try {
    for (const item of queue) {
      try {
        const response = await api.createSos({ ...item, via_offline_sync: true });
        sent++;
        results.push({ item, response });
      } catch (err) {
        stillQueued.push(item);
        results.push({ item, error: err });
      }
    }
    writeQueue(stillQueued);
  } finally {
    flushing = false;
  }
  return { sent, remaining: stillQueued.length, results };
}

/**
 * Call once at app startup: flushes on load (in case we came back online
 * while the tab was closed) and again on every 'online' event.
 * `onFlushed(result)` fires only when at least one item was actually sent
 * (result is flushQueue()'s return value, so callers can correlate their
 * own pending item against `result.results`).
 * Returns an unsubscribe function.
 */
export function watchForReconnect(onFlushed) {
  const attempt = async () => {
    if (!navigator.onLine) return;
    const result = await flushQueue();
    if (result.sent > 0 && onFlushed) onFlushed(result);
  };
  attempt();
  window.addEventListener('online', attempt);
  return () => window.removeEventListener('online', attempt);
}
