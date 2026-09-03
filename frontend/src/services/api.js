// Live Production Render backend for deployed environments (Vercel, custom domains)
const PROD_BACKEND_URL = 'https://crisis-connect-m6da.onrender.com';

function getApiBase() {
  // 1. Explicit environment variable (if set in Vercel or .env)
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '');
  }

  // 2. Automatic environment detection
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname || 'localhost';
    // Local dev or local LAN IP (e.g. 192.168.x.x, 10.x.x.x, 127.0.0.1)
    const isLocal = hostname === 'localhost' || 
                    hostname === '127.0.0.1' || 
                    hostname.startsWith('192.168.') || 
                    hostname.startsWith('10.') || 
                    hostname.endsWith('.local');

    if (isLocal) {
      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
      return `${protocol}//${hostname}:8000`;
    }
  }

  // 3. Fallback for Vercel (crisisconnect369.vercel.app) and any public deployment
  return PROD_BACKEND_URL;
}

const API_BASE = getApiBase();

async function fetchJson(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const err = await response.json();
      errorDetail = err.detail || JSON.stringify(err);
    } catch (_) {}
    throw new Error(`API Error [${response.status}]: ${errorDetail}`);
  }

  return response.json();
}

export const api = {
  // Requests CRUD
  createRequest: (data) => fetchJson('/requests', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getRequests: (adminStatus) => {
    const query = adminStatus ? `?admin_status=${encodeURIComponent(adminStatus)}` : '';
    return fetchJson(`/requests${query}`);
  },

  getRequest: (id) => fetchJson(`/requests/${id}`),

  patchRequest: (id, updates) => fetchJson(`/requests/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  }),

  // Chat Messages
  sendMessage: (matchId, senderId, body) => fetchJson('/messages', {
    method: 'POST',
    body: JSON.stringify({ match_id: matchId, sender_id: senderId, body }),
  }),

  getMessages: (matchId) => fetchJson(`/messages/${matchId}`),

  // Crisis Zones & NDMA Sachet Alerts
  submitZoneReport: (data) => fetchJson('/zone-reports', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getConfirmedZones: () => fetchJson('/confirmed-zones'),

  getSachetAlerts: () => fetchJson('/sachet-alerts'),

  // Simulation & Integration Helper (Dev A test suite)
  simulateAccept: (requestId) => fetchJson(`/requests/${requestId}/accept`, {
    method: 'POST',
  }),

  reseed: () => fetchJson('/seed', { method: 'POST' }),
};
