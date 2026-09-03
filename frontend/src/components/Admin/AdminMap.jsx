import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import { Shield, RefreshCw, AlertTriangle, Radio, Users } from 'lucide-react';
import { api } from '../../services/api';
import { CrisisWebSocketClient } from '../../services/websocket';
import DuplicateBadge from '../Requester/DuplicateBadge';

// Helper to create category-colored SVG pin icons
function createCategoryIcon(category, urgency) {
  const isHigh = urgency === 'high';
  const colorMap = {
    blood: '#e11d48',
    food: '#d97706',
    medicine: '#059669',
    oxygen: '#0284c7',
    shelter: '#6366f1',
    transport: '#0284c7',
    rescue: '#dc2626',
  };
  const color = colorMap[category] || '#ef4444';

  const svgHtml = `
    <div style="
      position: relative;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: ${color};
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      ${isHigh ? 'animation: ping-slow 1.5s infinite;' : ''}
    ">
      <div style="width: 10px; height: 10px; background: white; border-radius: 50%;"></div>
    </div>
  `;

  return L.divIcon({
    html: svgHtml,
    className: 'custom-crisis-pin',
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

    // Subscribe to WebSocket for real-time map updates
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

  // Map center default (centered on active items or default SF coords)
  const defaultCenter = requests.length > 0
    ? [requests[0].lat, requests[0].lng]
    : [37.7749, -122.4194];

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center space-x-2">
            <Radio className="w-5 h-5 text-red-500 animate-pulse" />
            <span>Crisis GIS & Hazard Zone Overlay</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time geospatial map plotting active aid requests and confirmed crisis hazard clusters.
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <span className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
            <span>Active Pins: <strong>{requests.length}</strong></span>
          </span>
          <span className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-amber-400">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block animate-pulse" />
            <span>Hazard Zones: <strong>{confirmedZones.length}</strong></span>
          </span>
          <button
            onClick={loadMapData}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Interactive Map Container */}
      <div className="w-full h-[600px] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl relative">
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

          {/* Confirmed Zones (Hazard Circles) */}
          {confirmedZones.map((zone) => (
            <React.Fragment key={zone.id}>
              <Circle
                center={[zone.center_lat, zone.center_lng]}
                radius={400} // 400 meters radius
                pathOptions={{
                  color: '#f59e0b',
                  fillColor: '#ef4444',
                  fillOpacity: 0.25,
                  weight: 2,
                  dashArray: '6, 6',
                }}
              >
                <Popup>
                  <div className="text-xs space-y-1">
                    <div className="font-bold text-red-400 uppercase tracking-wider">
                      Confirmed Crisis Hazard Zone
                    </div>
                    <div className="text-slate-200">
                      <strong>Category:</strong> {zone.category}
                    </div>
                    <div className="text-slate-400 text-[11px]">
                      {zone.ml_status || 'Multi-report cluster confirmed'}
                    </div>
                  </div>
                </Popup>
              </Circle>
            </React.Fragment>
          ))}

          {/* Active Request Markers */}
          {requests.map((req) => (
            <Marker
              key={req.id}
              position={[req.lat, req.lng]}
              icon={createCategoryIcon(req.category, req.urgency)}
            >
              <Popup>
                <div className="text-xs space-y-1.5 min-w-[200px]">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-700 pb-1">
                    <span className="font-extrabold uppercase text-red-400">
                      {req.category}
                    </span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      req.urgency === 'high' ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-300'
                    }`}>
                      {req.urgency}
                    </span>
                  </div>

                  <p className="text-slate-200 font-medium leading-snug">
                    {req.details || '1-Tap Rapid Request'}
                  </p>

                  <div className="text-[11px] text-slate-400 space-y-0.5">
                    <div>Status: <strong className="text-white capitalize">{req.status}</strong></div>
                    <div>Admin: <strong className="text-white capitalize">{req.admin_status}</strong></div>
                    {req.requester_name && <div>Contact: {req.requester_name}</div>}
                  </div>

                  {req.linked_count > 0 && (
                    <div className="pt-1">
                      <DuplicateBadge linkedCount={req.linked_count} />
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Map Legend */}
      <div className="mt-4 p-3 rounded-xl glass-panel text-xs flex flex-wrap items-center justify-between gap-3 text-slate-400">
        <div className="flex items-center space-x-4">
          <span className="font-bold text-slate-200">Pins Legend:</span>
          <span className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full bg-cyan-500 inline-block" />
            <span>Oxygen</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full bg-red-600 inline-block" />
            <span>Rescue</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
            <span>Medicine</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
            <span>Food / Water</span>
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-4 h-4 rounded border-2 border-dashed border-amber-500 bg-red-500/30 inline-block" />
          <span>Shaded Circle: Confirmed Crisis Zone</span>
        </div>
      </div>
    </div>
  );
}
