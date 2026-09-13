/**
 * Offline & Local Fallback Emergency Store.
 * 
 * Provides seamless resilience when running in local environments or during network drops.
 * Matches backend schemas and PRD specifications identically.
 * Automatically broadcasts live events to any active CrisisWebSocketClient instances.
 */
import { broadcastCrisisEvent } from './websocket';

const STORAGE_KEY = 'crisis_connect_mock_requests_v1';
const INCIDENTS_KEY = 'crisis_connect_mock_incidents_v1';

const INITIAL_REQUESTS = [
  {
    id: 'demo-req-01-kem-blood',
    category: 'blood',
    urgency: 'high',
    lat: 19.0178,
    lng: 72.8478,
    requester_device_id: 'demo-device-mum-01',
    requester_name: 'KEM Hospital Blood Bank Liaison',
    requester_phone: '022-2410-7000',
    details: 'CRITICAL: 4 units O-Negative plasma required for emergency surgery patient, road flooded near Parel.',
    service_details: {
      blood_group: 'O-',
      units: 4,
      hospital: 'KEM Hospital, Parel',
      urgency_level: 'immediate',
    },
    status: 'requested',
    admin_status: 'approved',
    zone_confirmed: true,
    created_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    is_critical: true,
  },
  {
    id: 'demo-req-02-sion-o2',
    category: 'oxygen',
    urgency: 'high',
    lat: 19.0390,
    lng: 72.8619,
    requester_device_id: 'demo-device-mum-02',
    requester_name: 'Ramesh Kulkarni',
    requester_phone: '9820511043',
    details: 'Sion West: Elderly patient on continuous oxygen, power transformer submerged. Need backup D-type cylinder.',
    service_details: {
      oxygen_type: 'cylinder_d_type',
      flow_rate: '5 L/min',
      patient_name: 'Anasuya Kulkarni',
    },
    status: 'requested',
    admin_status: 'pending',
    zone_confirmed: true,
    created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    is_critical: true,
  },
  {
    id: 'demo-req-03-kurla-rescue',
    category: 'rescue',
    urgency: 'high',
    lat: 19.0688,
    lng: 72.8785,
    requester_device_id: 'demo-device-mum-03',
    requester_name: 'Sunita Patil',
    requester_phone: '9867044188',
    details: 'Kurla West, Bail Bazar: Ground floor tenement submerged up to chest level. 5 family members trapped on loft.',
    status: 'requested',
    admin_status: 'approved',
    zone_confirmed: true,
    created_at: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    is_critical: true,
    incident_id: 'demo-inc-kurla-01',
  },
  {
    id: 'demo-req-04-dharavi-food',
    category: 'food',
    urgency: 'normal',
    lat: 19.0434,
    lng: 72.8567,
    requester_device_id: 'demo-device-mum-04',
    requester_name: 'Dharavi Relief Center Unit 5',
    requester_phone: '9819022112',
    details: 'Safe drinking water cans and dry biscuits packets needed for 40 displaced residents sheltering at municipal school.',
    service_details: {
      persons_count: 40,
      food_items: ['Water 20L cans', 'High-calorie biscuits', 'ORS packets'],
      water_liters: 200,
    },
    status: 'requested',
    admin_status: 'approved',
    zone_confirmed: false,
    created_at: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
    is_critical: false,
  },
  {
    id: 'demo-req-05-bandra-insulin',
    category: 'medicine',
    urgency: 'normal',
    lat: 19.0596,
    lng: 72.8295,
    requester_device_id: 'demo-device-mum-05',
    requester_name: 'Anil Fernandes',
    requester_phone: '9821077165',
    details: 'Bandra West, Hill Road: Type 1 insulin pens and sterile saline kit needed for elderly resident.',
    service_details: {
      medicine_names: 'Lantus Insulin Glargine Pen, Normal Saline',
      dosage: '10 units daily',
      has_prescription_image: true,
    },
    status: 'requested',
    admin_status: 'pending',
    zone_confirmed: false,
    created_at: new Date(Date.now() - 70 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 70 * 60 * 1000).toISOString(),
    is_critical: false,
  },
];

const INITIAL_INCIDENTS = [
  {
    id: 'demo-inc-kurla-01',
    category: 'rescue',
    center_lat: 19.0688,
    center_lng: 72.8785,
    status: 'sos_triggered',
    priority: 1,
    request_count: 1,
    coordinating_orgs: ['Indian Red Cross Emergency Response Mumbai'],
    created_at: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
  },
];

function loadStoredRequests() {
  if (typeof window === 'undefined') return [...INITIAL_REQUESTS];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_REQUESTS));
      return [...INITIAL_REQUESTS];
    }
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[mockEmergencyStore] load error, using initial:', err);
    return [...INITIAL_REQUESTS];
  }
}

function saveStoredRequests(reqs) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(reqs));
  } catch (err) {
    console.warn('[mockEmergencyStore] save error:', err);
  }
}

function loadStoredIncidents() {
  if (typeof window === 'undefined') return [...INITIAL_INCIDENTS];
  try {
    const raw = sessionStorage.getItem(INCIDENTS_KEY);
    if (!raw) {
      sessionStorage.setItem(INCIDENTS_KEY, JSON.stringify(INITIAL_INCIDENTS));
      return [...INITIAL_INCIDENTS];
    }
    return JSON.parse(raw);
  } catch {
    return [...INITIAL_INCIDENTS];
  }
}

function saveStoredIncidents(incs) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(INCIDENTS_KEY, JSON.stringify(incs));
  } catch {}
}

export const mockEmergencyStore = {
  getRequests(adminStatus = null, excludeExpired = false) {
    const list = loadStoredRequests();
    return list.filter((r) => {
      // By default NEVER return cancelled emergencies in active queries
      if (adminStatus !== 'cancelled' && (r.status === 'cancelled' || r.admin_status === 'cancelled')) {
        return false;
      }
      if (adminStatus && adminStatus !== 'cancelled' && r.admin_status !== adminStatus) {
        return false;
      }
      if (adminStatus === 'cancelled' && r.status !== 'cancelled' && r.admin_status !== 'cancelled') {
        return false;
      }
      if (excludeExpired && r.status === 'expired') {
        return false;
      }
      return true;
    });
  },

  getRequest(id) {
    const list = loadStoredRequests();
    return list.find((r) => r.id === id) || null;
  },

  createRequest(payload) {
    const list = loadStoredRequests();
    const id = `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const newReq = {
      id,
      category: payload.category || 'rescue',
      urgency: payload.urgency || (payload.category === 'rescue' || payload.category === 'blood' ? 'high' : 'normal'),
      lat: payload.lat || 19.0760,
      lng: payload.lng || 72.8777,
      requester_device_id: payload.requester_device_id || `device-${Date.now()}`,
      requester_name: payload.requester_name || 'Citizen Requester',
      requester_phone: payload.requester_phone || '+91 98200 00000',
      details: payload.details || 'Immediate relief assistance required.',
      service_details: payload.service_details || {},
      status: 'requested',
      admin_status: payload.admin_status || 'pending',
      zone_confirmed: Boolean(payload.zone_confirmed),
      created_at: now,
      updated_at: now,
      is_critical: Boolean(payload.is_critical || payload.urgency === 'high'),
      ...(payload.__sos ? { __sos: true } : {}),
    };

    list.unshift(newReq);
    saveStoredRequests(list);

    // Broadcast new request to Admin dashboard and Map
    broadcastCrisisEvent('admin', {
      event: 'new_request',
      data: newReq,
    });

    return newReq;
  },

  createSos(payload) {
    const newReq = this.createRequest({
      ...payload,
      urgency: 'high',
      is_critical: true,
      __sos: true,
    });

    const incs = loadStoredIncidents();
    const incidentId = `inc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    const newInc = {
      id: incidentId,
      category: payload.category || 'rescue',
      center_lat: payload.lat || 19.0760,
      center_lng: payload.lng || 72.8777,
      status: 'sos_triggered',
      priority: 1,
      request_count: 1,
      coordinating_orgs: ['Indian Red Cross Emergency Response Mumbai'],
      created_at: now,
      updated_at: now,
    };

    incs.unshift(newInc);
    saveStoredIncidents(incs);

    newReq.incident_id = incidentId;
    this.patchRequest(newReq.id, { incident_id: incidentId });

    return {
      request: newReq,
      incident: newInc,
    };
  },

  cancelRequest(id, reason = 'Accidental trigger by user') {
    const list = loadStoredRequests();
    const targetIdx = list.findIndex((r) => r.id === id);
    const now = new Date().toISOString();

    if (targetIdx !== -1) {
      list[targetIdx] = {
        ...list[targetIdx],
        status: 'cancelled',
        admin_status: 'cancelled',
        cancel_reason: reason,
        updated_at: now,
        cancelled_at: now,
      };
      saveStoredRequests(list);
    }

    // Broadcast cancellation event to Admin queue and GIS Map
    const cancelData = {
      id,
      request_id: id,
      status: 'cancelled',
      admin_status: 'cancelled',
      reason,
      cancelled_at: now,
    };

    broadcastCrisisEvent('admin', {
      event: 'request_cancelled',
      data: cancelData,
    });
    broadcastCrisisEvent('incident', {
      event: 'request_cancelled',
      data: cancelData,
    });

    return {
      status: 'cancelled',
      id,
      reason,
      message: 'Emergency request cancelled and withdrawn from all active triage queues and live GIS maps.',
    };
  },

  patchRequest(id, updates) {
    const list = loadStoredRequests();
    const targetIdx = list.findIndex((r) => r.id === id);
    if (targetIdx === -1) return { id, ...updates };

    list[targetIdx] = {
      ...list[targetIdx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    saveStoredRequests(list);

    broadcastCrisisEvent('admin', {
      event: 'status_update',
      data: list[targetIdx],
    });

    return list[targetIdx];
  },

  expireRequest(id) {
    return this.patchRequest(id, { status: 'expired' });
  },

  getIncident(id) {
    const incs = loadStoredIncidents();
    return incs.find((i) => i.id === id) || INITIAL_INCIDENTS[0];
  },

  getIncidents() {
    return loadStoredIncidents();
  },

  getConfirmedZones() {
    return [
      {
        id: 'zone-kurla-mumbai',
        category: 'flood',
        center_lat: 19.0688,
        center_lng: 72.8785,
        radius_m: 500,
        report_count: 8,
        status: 'confirmed',
        created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      },
    ];
  },

  getSachetAlerts() {
    return [
      {
        id: 'sachet-alert-mum-01',
        headline: 'Heavy Rainfall & Waterlogging Alert - Mumbai Suburban',
        severity: 'Severe',
        urgency: 'Immediate',
        area_description: 'Kurla, Sion, Bandra low-lying belts',
        instruction: 'Avoid waterlogged arterial subways. Emergency boats deployed at Kurla Bail Bazar.',
        sent_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      },
    ];
  },

  reseed() {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_REQUESTS));
      sessionStorage.setItem(INCIDENTS_KEY, JSON.stringify(INITIAL_INCIDENTS));
      broadcastCrisisEvent('admin', { event: 'reseed', data: INITIAL_REQUESTS });
    }
    return { ok: true, requests: INITIAL_REQUESTS.length };
  },
};
