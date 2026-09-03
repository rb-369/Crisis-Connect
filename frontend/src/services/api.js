// Dynamically determine backend host based on the current browser URL
// This ensures connections work seamlessly when accessed from localhost, LAN IP (friend's laptop), or deployed domains!
function getApiBase() {
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL;
  }
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const hostname = window.location.hostname || 'localhost';
    // If running on a non-standard port or tunnel that bundles backend, or default port 8000
    return `${protocol}//${hostname}:8000`;
  }
  return 'http://localhost:8000';
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
