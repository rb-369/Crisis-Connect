// Live Production Render backend for deployed environments (Vercel, custom domains)
const PROD_BACKEND_URL = 'https://crisis-connect-m6da.onrender.com';

function getApiBase() {
  // 1. Explicit environment variable (if set in Vercel or .env)
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '');
  }
  if (import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE.replace(/\/$/, '');
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

function qs(params) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!entries.length) return '';
  return '?' + new URLSearchParams(entries).toString();
}

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
    let parsed = null;
    try {
      parsed = await response.json();
      errorDetail = parsed.detail || JSON.stringify(parsed);
    } catch (_) { }
    const error = new Error(`API Error [${response.status}]: ${errorDetail}`);
    error.status = response.status;
    error.body = parsed;
    throw error;
  }

  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  // Requests CRUD
  createRequest: (data) => fetchJson('/requests', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getRequests: (adminStatus = null, excludeExpired = false, sortBy = 'priority') => {
    const params = new URLSearchParams();
    if (adminStatus) params.append('admin_status', adminStatus);
    if (excludeExpired) params.append('exclude_expired', 'true');
    if (sortBy) params.append('sort_by', sortBy);
    const query = params.toString() ? `?${params.toString()}` : '';
    return fetchJson(`/requests${query}`);
  },

  getRequest: (id) => fetchJson(`/requests/${id}`),

  getNearbyRequests: (lat, lng, radiusM) =>
    fetchJson(`/requests/nearby${qs({ lat, lng, radius_m: radiusM })}`),

  patchRequest: (id, updates) => fetchJson(`/requests/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  }),

  sendHeartbeat: (id) => fetchJson(`/requests/${id}/heartbeat`, {
    method: 'POST',
  }),

  expireRequest: (id) => fetchJson(`/requests/${id}/expire`, {
    method: 'POST',
  }),

  enrichRequest: (id, updates) => fetchJson(`/requests/${id}/enrich`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  }),

  // Atomic accept
  acceptRequest: (requestId, helperId) => fetchJson(`/requests/${requestId}/accept`, {
    method: 'POST',
    body: JSON.stringify({ helper_id: helperId }),
  }),

  simulateAccept: (requestId, helperPayload = null) => fetchJson(`/requests/${requestId}/accept`, {
    method: 'POST',
    body: helperPayload ? JSON.stringify(helperPayload) : undefined,
  }),

  // Matches
  getMatch: (id) => fetchJson(`/matches/${id}`),
  getMatchForRequest: (requestId) => fetchJson(`/requests/${requestId}/match`),
  patchMatchStatus: (matchId, status) => fetchJson(`/matches/${matchId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
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

  // PRD Flow E -- stale request handling & reopen
  keepAliveRequest: (id) => fetchJson(`/requests/${id}/keepalive`, { method: 'POST' }),
  resolveRequest: (id) => fetchJson(`/requests/${id}/resolve`, { method: 'POST' }),
  reopenRequest: (id, reason) => fetchJson(`/requests/${id}/reopen`, {
    method: 'POST',
    body: JSON.stringify(reason ? { reason } : {}),
  }),
  compatibleDonors: (requestId) => fetchJson(`/requests/${requestId}/compatible-donors`),

  // Critical SOS / Incidents
  createSos: (data) => fetchJson('/sos', { method: 'POST', body: JSON.stringify(data) }),
  getIncident: (id) => fetchJson(`/incidents/${id}`),
  getIncidents: (status) => fetchJson(`/incidents${qs({ status })}`),
  patchIncident: (id, updates) => fetchJson(`/incidents/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  }),
  getTimeline: (id) => fetchJson(`/incidents/${id}/timeline`),

  // Auth & Helper Management
  sendOtp: (contact, role = 'volunteer') => fetchJson('/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ contact, role }),
  }),

  verifyOtp: (contact, otp_code, role = 'volunteer') => fetchJson('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ contact, otp_code, role }),
  }),

  verifyOtpV2: (contact, otpCode, role) => fetchJson('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ contact, otp_code: otpCode, ...(role ? { role } : {}) }),
  }),

  requestOtp: (phone, name) => fetchJson('/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, role: 'volunteer', ...(name ? { name } : {}) }),
  }),

  login: (identifier, role = null) => fetchJson('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, role }),
  }),

  getHelpers: (role = null) => {
    const query = role ? `?role=${encodeURIComponent(role)}` : '';
    return fetchJson(`/auth/helpers${query}`);
  },

  createHelper: (helperData) => fetchJson('/auth/helpers', {
    method: 'POST',
    body: JSON.stringify(helperData),
  }),

  patchHelper: (id, updates) => fetchJson(`/helpers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  }),

  getMe: (token) => fetchJson('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  }),

  addDeviceToken: (helperId, platform, token) => fetchJson(`/helpers/${helperId}/device-tokens`, {
    method: 'POST',
    body: JSON.stringify({ platform, token }),
  }),

  getHelperMatches: (helperId, status) =>
    fetchJson(`/helpers/${helperId}/matches${qs({ status })}`),

  // Demo Reseed
  reseed: () => fetchJson('/seed', { method: 'POST' }),
  reseedDemo: () => fetchJson('/debug/reseed-demo', { method: 'POST' }),
};
