import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import { RefreshCw, Radio, Users, ShieldAlert, Sparkles } from 'lucide-react';
import { api } from '../../services/api';
import { CrisisWebSocketClient } from '../../services/websocket';
import DuplicateBadge from '../Requester/DuplicateBadge';

// Helper to create category-colored SVG pin icons matching design system
function createCrisisPinIcon(category, urgency) {
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
    className: 'crisis-map-pin',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

// Matched Volunteer Marker (Solid Indigo #4338CA with white center)
function createVolunteerPinIcon() {
  const html = `
    <div style="
      position: relative;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #4338CA;
      border: 2.5px solid #FFFFFF;
      border-radius: 50%;
      box-shadow: 0 4px 10px rgba(67, 56, 202, 0.4);
    ">
      <div style="width: 10px; height: 10px; background: #FFFFFF; border-radius: 50%;"></div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'volunteer-map-pin',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

export default function AdminMap() {
  const [requests, setRequests] = useState([]);
  const [confirmedZones, setConfirmedZones] = useState([]);
  const [loading, setLoading] = useState(true);

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

    const wsClient = new CrisisWebSocketClient(
      'admin',
      'all',
      (payload) => {
        if (payload.event === 'new_request') {
          setRequests((prev) => [payload.data, ...prev]);
        } else if (payload.event === 'zone_confirmed') {
          setConfirmedZones((prev) => [...prev, payload.data]);
        } else if (payload.event === 'status_update') {
          setRequests((prev) =>
            prev.map((r) => (r.id === payload.data.id ? { ...r, ...payload.data } : r))
          );
        }
      }
    );

    return () => {
      wsClient.close();
    };
  }, []);

  const defaultCenter = requests.length > 0
    ? [requests[0].lat, requests[0].lng]
    : [37.7749, -122.4194];

  return (
    <div className="py-2 sm:py-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight flex items-center space-x-2">
            <Radio className="w-5 h-5 text-[#DC2626] animate-pulse" />
            <span>GIS Live Map & Disaster Zone Overlays</span>
          </h1>
          <p className="text-xs text-[#64748B] font-medium mt-0.5">
            Geospatial tracking of live distress signals, deployed volunteers, and confirmed disaster perimeters.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <span className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#CBD5E1] text-[#0F172A] font-bold shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626] inline-block" />
            <span>Active Pins: <strong>{requests.length}</strong></span>
          </span>
          <span className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#CBD5E1] text-[#B45309] font-bold shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D97706] inline-block animate-pulse" />
            <span>Perimeters: <strong>{confirmedZones.length}</strong></span>
          </span>
          <button
            onClick={loadMapData}
            className="p-2 rounded-xl bg-white hover:bg-[#F1F5F9] border border-[#CBD5E1] text-[#475569] hover:text-[#0F172A] transition shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Map Container */}
      <div className="w-full h-[600px] rounded-2xl overflow-hidden border border-[#CBD5E1] shadow-md relative bg-white">
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

          {/* Confirmed Active Disaster Zone (#DC2626 with rgba(220, 38, 38, 0.28) fill) */}
          {confirmedZones.map((zone) => (
            <React.Fragment key={zone.id}>
              <Circle
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
                    <div className="text-[#64748B] text-[11px] font-medium">
                      Status: {zone.ml_status || 'Multi-source cluster confirmed'}
                    </div>
                  </div>
                </Popup>
              </Circle>
            </React.Fragment>
          ))}

          {/* Active Request Markers */}
          {requests.map((req) => {
            const isMatched = req.status === 'matched' || req.status === 'en_route' || req.status === 'in_progress';

            return (
              <React.Fragment key={req.id}>
                {/* Caller Request Marker */}
                <Marker
                  position={[req.lat, req.lng]}
                  icon={createCrisisPinIcon(req.category, req.urgency)}
                >
                  <Popup>
                    <div className="p-1 text-xs space-y-2 min-w-[210px]">
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
                        {req.details || '1-Tap Rapid SOS Request'}
                      </p>

                      <div className="text-[11px] text-[#64748B] space-y-0.5 font-medium">
                        <div>Dispatch Status: <strong className="text-[#0F172A] capitalize">{req.status}</strong></div>
                        <div>Admin Status: <strong className="text-[#0F172A] capitalize">{req.admin_status}</strong></div>
                        {req.requester_name && <div>Requester: <strong>{req.requester_name}</strong></div>}
                      </div>

                      {req.linked_count > 0 && (
                        <div className="pt-1">
                          <DuplicateBadge linkedCount={req.linked_count} />
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>

                {/* If Matched, also render Matched Volunteer Pin (#4338CA Solid Indigo with white center) */}
                {isMatched && (
                  <Marker
                    position={[req.lat + 0.002, req.lng + 0.002]} // slight offset for deployed volunteer
                    icon={createVolunteerPinIcon()}
                  >
                    <Popup>
                      <div className="p-1 text-xs space-y-1">
                        <div className="font-extrabold text-[#4338CA] uppercase tracking-wider flex items-center space-x-1">
                          <Users className="w-3.5 h-3.5" />
                          <span>Matched Volunteer Unit</span>
                        </div>
                        <div className="text-[#0F172A] font-bold">
                          {req.match_info?.helper_name || 'Dr. Sarah Lin (Red Cross)'}
                        </div>
                        <div className="text-[#64748B] text-[11px]">
                          Status: Active / En Route
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                )}
              </React.Fragment>
            );
          })}
        </MapContainer>
      </div>

      {/* GIS Map Legend Bar */}
      <div className="mt-4 p-4 rounded-2xl bg-white border border-[#CBD5E1] text-xs flex flex-wrap items-center justify-between gap-4 text-[#475569] shadow-sm">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-bold">
          <span className="text-[#0F172A]">Layer Legend:</span>
          <span className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full bg-[#991B1B] inline-block border border-white shadow-sm" />
            <span>Rescue / Trapped</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full bg-[#0891B2] inline-block border border-white shadow-sm" />
            <span>Oxygen</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full bg-[#2563EB] inline-block border border-white shadow-sm" />
            <span>Medicine</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full bg-[#D97706] inline-block border border-white shadow-sm" />
            <span>Food / Water</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full bg-[#4338CA] inline-block border border-white shadow-sm" />
            <span className="text-[#4338CA]">Volunteer Unit</span>
          </span>
        </div>
        <div className="flex items-center space-x-2 font-bold text-[#DC2626]">
          <span className="w-4 h-4 rounded-full border-2 border-[#DC2626] bg-[#DC2626]/28 inline-block" />
          <span>Confirmed Hazard Perimeter</span>
        </div>
      </div>
    </div>
  );
}
