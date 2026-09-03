const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

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

  // Crisis Zones
  submitZoneReport: (data) => fetchJson('/zone-reports', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getConfirmedZones: () => fetchJson('/confirmed-zones'),

  // Simulation & Integration Helper (Dev A test suite)
  simulateAccept: (requestId) => fetchJson(`/requests/${requestId}/accept`, {
    method: 'POST',
  }),

  reseed: () => fetchJson('/seed', { method: 'POST' }),
};
