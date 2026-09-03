import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  RefreshCw, 
  Radio, 
  Users, 
  ShieldAlert, 
  Sparkles, 
  Check, 
  Flag, 
  X, 
  MessageSquare, 
  Send, 
  Phone, 
  MapPin, 
  Truck, 
  AlertTriangle,
  LocateFixed,
  Eye,
  Filter
} from 'lucide-react';
import { api } from '../../services/api';
import { CrisisWebSocketClient } from '../../services/websocket';
import DuplicateBadge from '../Requester/DuplicateBadge';

// Helper to center or fly map
function MapCenterController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom || 15, { duration: 1.2 });
    }
  }, [center, zoom, map]);
  return null;
}

// Category-colored SVG pin icons matching design system
function createCrisisPinIcon(category, urgency, isSelected = false) {
  const isHigh = urgency === 'high';
  const colorMap = {
    rescue: '#991B1B',
    blood: '#DC2626',
    oxygen: '#0891B2',
    medicine: '#2563EB',
    food: '#D97706',
    shelter: '#7C3AED',
    transport: '#0D9488',
  };
  const color = colorMap[category] || '#DC2626';

  const html = `
    <div style="
      position: relative;
      width: ${isSelected ? '38px' : '32px'};
      height: ${isSelected ? '38px' : '32px'};
      display: flex;
      align-items: center;
      justify-content: center;
      background: ${color};
      border: ${isSelected ? '3.5px solid #0F172A' : '2.5px solid #FFFFFF'};
      border-radius: 50%;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.4);
      transition: all 0.2s ease;
      ${isHigh ? 'animation: urgent-radar 1.5s infinite;' : ''}
    ">
      <div style="width: ${isSelected ? '10px' : '8px'}; height: ${isSelected ? '10px' : '8px'}; background: #FFFFFF; border-radius: 50%;"></div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'crisis-map-pin',
    iconSize: [isSelected ? 38 : 32, isSelected ? 38 : 32],
    iconAnchor: [isSelected ? 19 : 16, isSelected ? 19 : 16],
    popupAnchor: [0, -18],
  });
}

// Volunteer Marker (Solid Indigo #4338CA with white center pin)
function createVolunteerPinIcon() {
  const html = `
    <div style="
      position: relative;
      width: 34px;
      height: 34px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #4338CA;
      border: 2.5px solid #FFFFFF;
      border-radius: 50%;
      box-shadow: 0 4px 12px rgba(67, 56, 202, 0.45);
    ">
      <div style="width: 10px; height: 10px; background: #FFFFFF; border-radius: 50%;"></div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'volunteer-map-pin',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

export default function AdminMap() {
  const [requests, setRequests] = useState([]);
  const [confirmedZones, setConfirmedZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReq, setSelectedReq] = useState(null);
  const [mapTarget, setMapTarget] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all'); // all, urgent, unassigned, matched
  const [incomingAlert, setIncomingAlert] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadMapData = async () => {
    setLoading(true);
    try {
      const [reqs, zones] = await Promise.all([
        api.getRequests(),
        api.getConfirmedZones(),
      ]);
      setRequests(reqs);
      setConfirmedZones(zones);
    } catch (err) {
      console.error('Failed to load map data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMapData();

    // Subscribe to WebSocket for real-time live updates
    const wsClient = new CrisisWebSocketClient(
      'admin',
      'all',
      (payload) => {
        if (payload.event === 'new_request' && payload.data) {
          const newReq = payload.data;
          setRequests((prev) => {
            if (prev.some((r) => r.id === newReq.id)) return prev;
            return [newReq, ...prev];
          });
          // Display live incoming toast
          setIncomingAlert(newReq);
          setTimeout(() => setIncomingAlert(null), 6000);
        } else if (payload.event === 'zone_confirmed' && payload.data) {
          setConfirmedZones((prev) => [...prev, payload.data]);
        } else if (payload.event === 'status_update' || payload.event === 'matched') {
          setRequests((prev) =>
            prev.map((r) => (r.id === payload.data.id ? { ...r, ...payload.data } : r))
          );
          if (selectedReq && selectedReq.id === payload.data.id) {
            setSelectedReq((prev) => ({ ...prev, ...payload.data }));
          }
        }
      }
    );

    return () => {
      wsClient.close();
    };
  }, [selectedReq?.id]);

  // Handle Accept directly from the Map
  const handleMapAccept = async (requestId) => {
    setActionLoading(true);
    try {
      const res = await api.simulateAccept(requestId);
      const updated = res.request;
      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, ...updated } : r))
      );
      setSelectedReq(updated);
      setMapTarget([updated.lat, updated.lng]);
    } catch (err) {
      console.error('Map accept error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Triage action directly from Map
  const handleMapTriage = async (requestId, adminStatus) => {
    setActionLoading(true);
    try {
      const updated = await api.patchRequest(requestId, { admin_status: adminStatus });
      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, admin_status: updated.admin_status } : r))
      );
      if (selectedReq?.id === requestId) {
        setSelectedReq((prev) => ({ ...prev, admin_status: updated.admin_status }));
      }
    } catch (err) {
      console.error('Map triage error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Filter requests
  const filteredRequests = requests.filter((r) => {
    if (activeFilter === 'urgent') return r.urgency === 'high';
    if (activeFilter === 'unassigned') return r.status === 'requested';
    if (activeFilter === 'matched') return r.status === 'matched' || r.status === 'en_route' || r.status === 'in_progress';
    return true;
  });

  const defaultCenter = requests.length > 0
    ? [requests[0].lat, requests[0].lng]
    : [37.7749, -122.4194];

  return (
    <div className="py-2 sm:py-6">
      {/* Real-time Incoming Emergency Toast */}
      {incomingAlert && (
        <div 
          onClick={() => {
            setSelectedReq(incomingAlert);
            setMapTarget([incomingAlert.lat, incomingAlert.lng]);
          }}
          className="mb-4 p-4 rounded-2xl bg-[#DC2626] text-white shadow-xl flex items-center justify-between cursor-pointer hover:bg-[#B91C1C] transition transform animate-bounce"
        >
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-white text-[#DC2626] flex items-center justify-center font-extrabold shadow-sm">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs uppercase font-black tracking-wider bg-white/20 px-2 py-0.5 rounded">
                  🚨 New Incoming SOS: {incomingAlert.category}
                </span>
                <span className="text-xs font-mono">{incomingAlert.lat?.toFixed(4)}, {incomingAlert.lng?.toFixed(4)}</span>
              </div>
              <p className="text-xs font-medium text-white/90 mt-0.5">
                {incomingAlert.details || '1-Tap Rapid SOS Received. Click to fly to pin.'}
              </p>
            </div>
          </div>
          <span className="text-xs font-bold underline px-3 py-1 bg-white/10 rounded-lg">
            Inspect on Map &rarr;
          </span>
        </div>
      )}

      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight flex items-center space-x-2">
            <Radio className="w-5 h-5 text-[#DC2626] animate-pulse" />
            <span>GIS Live Map & Dispatch Control</span>
          </h1>
          <p className="text-xs text-[#64748B] font-medium mt-0.5">
            Real-time interactive spatial map. Click any pin to inspect details, dispatch responders, or triage.
          </p>
        </div>

        {/* Filter Pills & Live Stats */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Active Pins Count */}
          <span className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#CBD5E1] text-[#0F172A] text-xs font-bold shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626] inline-block animate-ping-slow" />
            <span>Live Pins: <strong>{requests.length}</strong></span>
          </span>

          {/* Filter Pills */}
          {[
            { id: 'all', label: 'All Pins' },
            { id: 'urgent', label: 'Critical Only' },
            { id: 'unassigned', label: 'Unassigned Queue' },
            { id: 'matched', label: 'Active Dispatches' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                activeFilter === f.id
                  ? 'bg-[#0F172A] text-white shadow-sm'
                  : 'bg-white text-[#475569] border border-[#CBD5E1] hover:bg-[#F1F5F9]'
              }`}
            >
              {f.label}
            </button>
          ))}

          <button
            onClick={loadMapData}
            title="Reload Map Data"
            className="p-2 rounded-xl bg-white hover:bg-[#F1F5F9] border border-[#CBD5E1] text-[#475569] hover:text-[#0F172A] transition shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Map + Inspector Drawer Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Left: 2 Columns Interactive Leaflet Map */}
        <div className="lg:col-span-2 w-full h-[620px] rounded-2xl overflow-hidden border border-[#CBD5E1] shadow-md relative bg-white">
          <MapContainer
            center={defaultCenter}
            zoom={14}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {mapTarget && <MapCenterController center={mapTarget} zoom={15} />}

            {/* Confirmed Active Disaster Zones */}
            {confirmedZones.map((zone) => (
              <Circle
                key={zone.id}
                center={[zone.center_lat, zone.center_lng]}
                radius={450}
                pathOptions={{
                  color: '#DC2626',
                  fillColor: '#DC2626',
                  fillOpacity: 0.28,
                  weight: 3,
                }}
              >
                <Popup>
                  <div className="p-1 text-xs space-y-1">
                    <div className="font-extrabold text-[#DC2626] uppercase tracking-wider flex items-center space-x-1">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Confirmed Crisis Zone</span>
                    </div>
                    <div className="text-[#0F172A] font-bold">
                      Hazard: <span className="uppercase text-[#DC2626]">{zone.category}</span>
                    </div>
                    <div className="text-[#64748B] text-[11px]">
                      {zone.ml_status || 'Multi-source cluster confirmed'}
                    </div>
                  </div>
                </Popup>
              </Circle>
            ))}

            {/* Filtered Emergency Request Pins */}
            {filteredRequests.map((req) => {
              const isSelected = selectedReq?.id === req.id;
              const isMatched = req.status === 'matched' || req.status === 'en_route' || req.status === 'in_progress';
              const helperLat = req.match_info?.helper_lat || (req.lat + 0.003);
              const helperLng = req.match_info?.helper_lng || (req.lng + 0.003);

              return (
                <React.Fragment key={req.id}>
                  {/* Caller Distress Pin */}
                  <Marker
                    position={[req.lat, req.lng]}
                    icon={createCrisisPinIcon(req.category, req.urgency, isSelected)}
                    eventHandlers={{
                      click: () => {
                        setSelectedReq(req);
                        setMapTarget([req.lat, req.lng]);
                      },
                    }}
                  >
                    <Popup>
                      <div className="p-1 text-xs space-y-2 min-w-[220px]">
                        <div className="flex items-center justify-between gap-2 border-b border-[#E2E8F0] pb-1.5">
                          <span className="font-black uppercase text-[#991B1B]">
                            {req.category}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            req.urgency === 'high' ? 'bg-[#DC2626] text-white' : 'bg-[#F1F5F9] text-[#475569]'
                          }`}>
                            {req.urgency}
                          </span>
                        </div>

                        <p className="text-[#0F172A] font-bold leading-snug">
                          {req.details || '1-Tap Rapid Emergency SOS'}
                        </p>

                        <div className="text-[11px] text-[#64748B] space-y-0.5 font-medium">
                          <div>Status: <strong className="text-[#0F172A] capitalize">{req.status}</strong></div>
                          <div>Admin: <strong className="text-[#0F172A] capitalize">{req.admin_status}</strong></div>
                          {req.requester_phone && <div>Phone: {req.requester_phone}</div>}
                        </div>

                        {/* Interactive Action inside popup */}
                        <div className="pt-2 flex gap-1.5">
                          {req.status === 'requested' && (
                            <button
                              onClick={() => handleMapAccept(req.id)}
                              className="w-full py-1.5 px-2.5 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white font-bold text-[11px] flex items-center justify-center space-x-1 shadow-sm"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Dispatch Responder</span>
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedReq(req)}
                            className="w-full py-1.5 px-2.5 rounded-lg bg-[#0F172A] text-white font-bold text-[11px] flex items-center justify-center space-x-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect & Triage</span>
                          </button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>

                  {/* If Matched, plot Volunteer Pin + connecting dispatch line */}
                  {isMatched && (
                    <>
                      <Marker
                        position={[helperLat, helperLng]}
                        icon={createVolunteerPinIcon()}
                        eventHandlers={{
                          click: () => {
                            setSelectedReq(req);
                            setMapTarget([helperLat, helperLng]);
                          },
                        }}
                      >
                        <Popup>
                          <div className="p-1 text-xs space-y-1">
                            <div className="font-extrabold text-[#4338CA] uppercase tracking-wider flex items-center space-x-1">
                              <Users className="w-3.5 h-3.5" />
                              <span>Matched Responder Unit</span>
                            </div>
                            <div className="text-[#0F172A] font-bold">
                              {req.match_info?.helper_name || 'Dr. Sarah Lin (Red Cross)'}
                            </div>
                            <div className="text-[#64748B] text-[11px]">
                              Navigating to {req.category} incident
                            </div>
                          </div>
                        </Popup>
                      </Marker>

                      {/* Route Polyline */}
                      <Polyline
                        positions={[
                          [helperLat, helperLng],
                          [req.lat, req.lng],
                        ]}
                        pathOptions={{
                          color: '#4338CA',
                          weight: 3,
                          dashArray: '6, 8',
                          opacity: 0.8,
                        }}
                      />
                    </>
                  )}
                </React.Fragment>
              );
            })}
          </MapContainer>
        </div>

        {/* Right: 1 Column Live Interactive Inspector Drawer */}
        <div className="bg-white border border-[#CBD5E1] rounded-2xl p-5 shadow-md flex flex-col justify-between h-[620px]">
          <div>
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3 mb-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#0F172A] flex items-center space-x-1.5">
                <LocateFixed className="w-4 h-4 text-[#2563EB]" />
                <span>Map Incident Inspector</span>
              </h3>
              <span className="text-[11px] font-mono text-[#64748B]">
                {filteredRequests.length} pins active
              </span>
            </div>

            {selectedReq ? (
              <div className="space-y-4 overflow-y-auto max-h-[400px] pr-1">
                {/* Header Category & Urgency */}
                <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wide bg-[#0F172A] text-white px-2.5 py-1 rounded-lg">
                      {selectedReq.category}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                      selectedReq.urgency === 'high' ? 'bg-[#DC2626] text-white' : 'bg-[#E2E8F0] text-[#475569]'
                    }`}>
                      {selectedReq.urgency === 'high' ? 'High Urgency' : 'Standard'}
                    </span>
                  </div>

                  <h4 className="text-sm font-extrabold text-[#0F172A] leading-snug">
                    {selectedReq.details || '1-Tap Emergency SOS (No extra note attached)'}
                  </h4>

                  <div className="text-xs text-[#64748B] space-y-1 font-medium pt-1 border-t border-[#E2E8F0]">
                    <div><strong>Requester:</strong> {selectedReq.requester_name || 'Anonymous Citizen'}</div>
                    {selectedReq.requester_phone && (
                      <div className="flex items-center space-x-1 text-[#2563EB]">
                        <Phone className="w-3.5 h-3.5" />
                        <span>{selectedReq.requester_phone}</span>
                      </div>
                    )}
                    <div className="font-mono text-[11px]">
                      Coords: {selectedReq.lat?.toFixed(5)}, {selectedReq.lng?.toFixed(5)}
                    </div>
                  </div>

                  <DuplicateBadge linkedCount={selectedReq.linked_count} />
                </div>

                {/* Dispatch Status & Volunteer Info */}
                <div className="p-3.5 rounded-xl border border-[#E2E8F0] text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#64748B]">Dispatch Status:</span>
                    <span className="font-extrabold uppercase text-[#0F172A] px-2 py-0.5 rounded bg-[#F1F5F9] border border-[#CBD5E1]">
                      {selectedReq.status}
                    </span>
                  </div>

                  {selectedReq.match_info && (
                    <div className="p-2.5 rounded-lg bg-[#E0F2FE] border border-[#BAE6FD] text-[#0284C7] space-y-1">
                      <div className="font-extrabold flex items-center space-x-1">
                        <Users className="w-3.5 h-3.5" />
                        <span>{selectedReq.match_info.helper_name}</span>
                      </div>
                      <div className="text-[11px] text-[#075985]">
                        Responder is En Route with GPS route tracking active.
                      </div>
                    </div>
                  )}
                </div>

                {/* Direct Map Interactive Action Controls */}
                <div className="space-y-2 pt-1">
                  <label className="text-[11px] font-black uppercase tracking-wider text-[#64748B] block">
                    Map Operations & Actions:
                  </label>

                  {/* Accept Dispatch Action */}
                  {selectedReq.status === 'requested' && (
                    <button
                      disabled={actionLoading}
                      onClick={() => handleMapAccept(selectedReq.id)}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white font-extrabold text-xs shadow-md transition flex items-center justify-center space-x-2"
                    >
                      <Truck className="w-4 h-4" />
                      <span>{actionLoading ? 'Dispatching...' : 'Accept & Dispatch Volunteer Unit'}</span>
                    </button>
                  )}

                  {/* Admin Triage Actions */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      disabled={actionLoading || selectedReq.admin_status === 'approved'}
                      onClick={() => handleMapTriage(selectedReq.id, 'approved')}
                      className="py-2 px-2 rounded-xl bg-[#DCFCE7] hover:bg-[#BBF7D0] text-[#15803D] border border-[#BBF7D0] font-extrabold text-[11px] flex items-center justify-center space-x-1 disabled:opacity-40"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>

                    <button
                      disabled={actionLoading || selectedReq.admin_status === 'flagged'}
                      onClick={() => handleMapTriage(selectedReq.id, 'flagged')}
                      className="py-2 px-2 rounded-xl bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#B45309] border border-[#FDE68A] font-extrabold text-[11px] flex items-center justify-center space-x-1 disabled:opacity-40"
                    >
                      <Flag className="w-3.5 h-3.5" />
                      <span>Flag</span>
                    </button>

                    <button
                      disabled={actionLoading || selectedReq.admin_status === 'rejected'}
                      onClick={() => handleMapTriage(selectedReq.id, 'rejected')}
                      className="py-2 px-2 rounded-xl bg-[#FEE2E2] hover:bg-[#FECACA] text-[#B91C1C] border border-[#FECACA] font-extrabold text-[11px] flex items-center justify-center space-x-1 disabled:opacity-40"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#64748B]">
                <MapPin className="w-10 h-10 mb-3 text-[#CBD5E1]" />
                <h4 className="font-extrabold text-[#0F172A] text-sm">Select A Pin On The Map</h4>
                <p className="text-xs text-[#64748B] mt-1 font-medium">
                  Click on any emergency marker to view caller notes, dispatch volunteer units, or triage approvals in real time.
                </p>
              </div>
            )}
          </div>

          {/* Bottom Quick Pins Switcher */}
          <div className="border-t border-[#E2E8F0] pt-3 flex items-center justify-between text-xs text-[#64748B]">
            <span className="font-bold">Layer Legend:</span>
            <div className="flex items-center space-x-3">
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626] inline-block" />
                <span>Distress</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#4338CA] inline-block" />
                <span className="text-[#4338CA] font-bold">Responder</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D97706] inline-block" />
                <span>Cluster</span>
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
