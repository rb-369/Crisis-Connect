import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { 
  Users, 
  CheckCircle, 
  Send, 
  Truck, 
  Check, 
  RefreshCw, 
  MessageSquare, 
  MapPin, 
  Radio, 
  LocateFixed, 
  Clock, 
  Navigation,
  Phone
} from 'lucide-react';
import { api } from '../../services/api';
import { CrisisWebSocketClient } from '../../services/websocket';

// Volunteer Map Icons
function createVolMapPinIcon(category, urgency) {
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
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: ${color};
      border: 2.5px solid #FFFFFF;
      border-radius: 50%;
      box-shadow: 0 4px 10px rgba(15, 23, 42, 0.35);
      ${isHigh ? 'animation: urgent-radar 1.5s infinite;' : ''}
    ">
      <div style="width: 8px; height: 8px; background: #FFFFFF; border-radius: 50%;"></div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'volunteer-view-pin',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

function createVolunteerLocationPin() {
  const html = `
    <div style="
      position: relative;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #4338CA;
      border: 3px solid #FFFFFF;
      border-radius: 50%;
      box-shadow: 0 4px 14px rgba(67, 56, 202, 0.5);
    ">
      <div style="width: 10px; height: 10px; background: #FFFFFF; border-radius: 50%;"></div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'vol-self-pin',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
}

export default function VolunteerMock() {
  const [requests, setRequests] = useState([]);
  const [activeMatch, setActiveMatch] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('map'); // 'map' or 'list'

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await api.getRequests();
      setRequests(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();

    // Subscribe to volunteer & admin channels for instant live updates
    const wsClient = new CrisisWebSocketClient(
      'volunteers',
      'all',
      (payload) => {
        if (payload.event === 'new_request' && payload.data) {
          setRequests((prev) => {
            if (prev.some((r) => r.id === payload.data.id)) return prev;
            return [payload.data, ...prev];
          });
        } else if (payload.event === 'status_update' || payload.event === 'matched') {
          setRequests((prev) =>
            prev.map((r) => (r.id === payload.data.id ? { ...r, ...payload.data } : r))
          );
        }
      }
    );

    return () => wsClient.close();
  }, []);

  // Listen for match chat
  useEffect(() => {
    if (!activeMatch) return;

    api.getMessages(activeMatch.id).then(setChatMessages).catch(console.error);

    const wsClient = new CrisisWebSocketClient(
      'match',
      activeMatch.id,
      (payload) => {
        if (payload.event === 'new_message' && payload.data) {
          setChatMessages((prev) => {
            if (prev.some((m) => m.id === payload.data.id)) return prev;
            return [...prev, payload.data];
          });
        }
      }
    );

    return () => wsClient.close();
  }, [activeMatch?.id]);

  const handleAccept = async (reqId) => {
    try {
      const res = await api.simulateAccept(reqId);
      const matchedReq = res.request;
      setActiveMatch({
        id: res.match.id,
        requestId: reqId,
        helperName: res.match.helper_name,
        category: matchedReq.category,
        lat: matchedReq.lat,
        lng: matchedReq.lng,
        helperLat: res.match.helper_lat || (matchedReq.lat + 0.003),
        helperLng: res.match.helper_lng || (matchedReq.lng + 0.003),
        details: matchedReq.details,
      });
      fetchRequests();
    } catch (err) {
      console.error('Accept error:', err);
    }
  };

  const handleUpdateStatus = async (status) => {
    if (!activeMatch) return;
    try {
      await api.patchRequest(activeMatch.requestId, { status });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendVolunteerMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeMatch) return;
    const body = chatInput.trim();
    setChatInput('');
    try {
      const sent = await api.sendMessage(activeMatch.id, 'volunteer-mock-id', body);
      setChatMessages((prev) => [...prev, sent]);
    } catch (err) {
      console.error(err);
    }
  };

  const defaultCenter = requests.length > 0
    ? [requests[0].lat, requests[0].lng]
    : [19.0760, 72.8777]; // Mumbai, India

  return (
    <div className="max-w-6xl mx-auto py-2 sm:py-6">
      {/* Top Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#EDE9FE] border border-[#DDD6FE] mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-start space-x-3.5">
          <div className="p-2.5 rounded-xl bg-[#4338CA] text-white flex-shrink-0 shadow-sm">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-[#4338CA] text-sm sm:text-base flex items-center space-x-2">
              <span>Volunteer Mobile Responder Unit (Dev B Mock)</span>
              <span className="px-2 py-0.5 rounded-md bg-[#4338CA] text-white text-[10px] uppercase font-mono">Live Map Sync</span>
            </h3>
            <p className="text-xs text-[#6D28D9] mt-0.5 font-medium">
              Real-time responder workspace: view incoming caller pins on the map, tap to accept & dispatch, and chat directly.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* View toggle */}
          <div className="flex rounded-xl bg-white border border-[#DDD6FE] p-1 text-xs font-bold">
            <button
              onClick={() => setViewMode('map')}
              className={`px-3 py-1 rounded-lg transition ${
                viewMode === 'map' ? 'bg-[#4338CA] text-white' : 'text-[#475569]'
              }`}
            >
              Interactive Map
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded-lg transition ${
                viewMode === 'list' ? 'bg-[#4338CA] text-white' : 'text-[#475569]'
              }`}
            >
              List View
            </button>
          </div>

          <button
            onClick={fetchRequests}
            className="p-2 rounded-xl bg-white hover:bg-[#F8FAFC] border border-[#DDD6FE] text-[#4338CA] transition shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left 7 Cols: Map or List View of Active Distress Signals */}
        <div className="lg:col-span-7 space-y-4">
          {viewMode === 'map' ? (
            <div className="bg-white border border-[#CBD5E1] rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-[#0F172A] flex items-center space-x-2">
                  <Navigation className="w-4 h-4 text-[#4338CA]" />
                  <span>Responder Live Radar Map</span>
                </h4>
                <span className="text-xs font-mono text-[#64748B]">
                  {requests.filter(r => r.status === 'requested').length} unassigned pins
                </span>
              </div>

              {/* Map */}
              <div className="w-full h-[450px] rounded-xl overflow-hidden border border-[#E2E8F0] relative">
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

                  {/* Requests Pins */}
                  {requests.map((r) => (
                    <Marker
                      key={r.id}
                      position={[r.lat, r.lng]}
                      icon={createVolMapPinIcon(r.category, r.urgency)}
                    >
                      <Popup>
                        <div className="p-1 text-xs space-y-2 min-w-[200px]">
                          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-1">
                            <span className="font-black uppercase text-[#991B1B]">{r.category}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                              r.urgency === 'high' ? 'bg-[#DC2626] text-white' : 'bg-[#F1F5F9] text-[#475569]'
                            }`}>
                              {r.urgency}
                            </span>
                          </div>
                          <p className="text-[#0F172A] font-bold">{r.details || '1-Tap Emergency SOS'}</p>
                          <div className="text-[#64748B] text-[11px]">
                            Status: <strong className="text-[#0F172A] capitalize">{r.status}</strong>
                          </div>
                          {r.status === 'requested' && (
                            <button
                              onClick={() => handleAccept(r.id)}
                              className="w-full py-1.5 rounded-lg bg-[#4338CA] hover:bg-[#3730A3] text-white font-extrabold text-xs shadow-sm flex items-center justify-center space-x-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Accept Request (1-Tap)</span>
                            </button>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  ))}

                  {/* Active Match Volunteer Marker & Polyline */}
                  {activeMatch && (
                    <>
                      <Marker
                        position={[activeMatch.helperLat, activeMatch.helperLng]}
                        icon={createVolunteerLocationPin()}
                      >
                        <Popup>
                          <div className="p-1 text-xs font-bold text-[#4338CA]">
                            Your Deployed Vehicle Unit
                          </div>
                        </Popup>
                      </Marker>

                      <Polyline
                        positions={[
                          [activeMatch.helperLat, activeMatch.helperLng],
                          [activeMatch.lat, activeMatch.lng],
                        ]}
                        pathOptions={{
                          color: '#4338CA',
                          weight: 4,
                          dashArray: '8, 8',
                        }}
                      />
                    </>
                  )}
                </MapContainer>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-[#E2E8F0] p-5 rounded-2xl shadow-sm space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Available Distress Signals (Feed View)
              </h4>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {requests.map((r) => (
                  <div
                    key={r.id}
                    className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold uppercase text-[#0F172A]">{r.category}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          r.urgency === 'high' ? 'bg-[#DC2626] text-white' : 'bg-[#E2E8F0] text-[#475569]'
                        }`}>
                          {r.urgency}
                        </span>
                        <span className="text-[#64748B] font-mono">[{r.status}]</span>
                      </div>
                      <p className="text-[#475569] mt-1 font-medium line-clamp-1">
                        {r.details || '1-Tap Emergency SOS'}
                      </p>
                    </div>

                    <button
                      onClick={() => handleAccept(r.id)}
                      disabled={r.status === 'matched' || r.status === 'resolved'}
                      className="px-3.5 py-2 rounded-xl bg-[#4338CA] hover:bg-[#3730A3] text-white font-bold transition disabled:opacity-30 flex-shrink-0 shadow-sm"
                    >
                      {r.status === 'matched' ? 'Matched' : 'Accept & Match'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right 5 Cols: Volunteer Active Dispatch & Live Chat */}
        <div className="lg:col-span-5 bg-white border border-[#E2E8F0] p-5 rounded-2xl shadow-sm flex flex-col justify-between h-[540px]">
          <div>
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3 mb-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#0F172A] flex items-center space-x-1.5">
                <Truck className="w-4 h-4 text-[#4338CA]" />
                <span>Active Mission Controls</span>
              </h4>
              {activeMatch ? (
                <span className="text-xs text-[#15803D] font-bold flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
                  <span>Matched: {activeMatch.requestId.substring(0, 8)}...</span>
                </span>
              ) : (
                <span className="text-xs text-[#94A3B8]">No active dispatch</span>
              )}
            </div>

            {activeMatch && (
              <div className="mb-4 space-y-2.5">
                <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-black uppercase text-[#4338CA]">{activeMatch.category} AID</span>
                    <span className="text-[11px] font-mono text-[#64748B]">ETA: ~6 mins</span>
                  </div>
                  <p className="text-[#0F172A] font-medium leading-snug">{activeMatch.details || '1-Tap Emergency SOS'}</p>
                </div>

                <label className="text-xs text-[#64748B] font-bold block">
                  Update Mission Lifecycle:
                </label>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <button
                    onClick={() => handleUpdateStatus('en_route')}
                    className="py-2 px-2.5 rounded-xl bg-[#E0F2FE] hover:bg-[#BAE6FD] text-[#0284C7] border border-[#BAE6FD] font-bold"
                  >
                    En Route 🚗
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('in_progress')}
                    className="py-2 px-2.5 rounded-xl bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#B45309] border border-[#FDE68A] font-bold"
                  >
                    On Site 📍
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('resolved')}
                    className="py-2 px-2.5 rounded-xl bg-[#DCFCE7] hover:bg-[#BBF7D0] text-[#15803D] border border-[#BBF7D0] font-bold"
                  >
                    Resolved ✅
                  </button>
                </div>
              </div>
            )}

            {/* In-app Chat with Citizen */}
            <div className="h-44 bg-[#F8FAFC] rounded-xl p-3 border border-[#E2E8F0] overflow-y-auto space-y-2">
              {!activeMatch ? (
                <div className="h-full flex items-center justify-center text-[#94A3B8] text-xs font-medium text-center p-4">
                  Accept a distress request from the map to initiate live volunteer dispatch & chat
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-[#94A3B8] text-xs font-medium">
                  No messages yet. Send a note to the citizen.
                </div>
              ) : (
                chatMessages.map((m) => {
                  const isVol = m.sender_id === 'volunteer-mock-id';
                  return (
                    <div key={m.id} className={`flex flex-col ${isVol ? 'items-end' : 'items-start'}`}>
                      <div className={`p-2.5 rounded-xl text-xs max-w-[85%] ${
                        isVol ? 'bg-[#4338CA] text-white' : 'bg-white text-[#0F172A] border border-[#CBD5E1] shadow-sm'
                      }`}>
                        {m.body}
                      </div>
                      <span className="text-[10px] text-[#64748B] mt-0.5">
                        {isVol ? 'You (Volunteer)' : 'Requester'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Send Input */}
          {activeMatch && (
            <form onSubmit={handleSendVolunteerMessage} className="mt-3 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Message citizen directly..."
                className="flex-1 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2 text-xs text-[#0F172A] focus:outline-none focus:border-[#4338CA]"
              />
              <button
                type="submit"
                className="p-2.5 rounded-xl bg-[#4338CA] hover:bg-[#3730A3] text-white shadow-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}
