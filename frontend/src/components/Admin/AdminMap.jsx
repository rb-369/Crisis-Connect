import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { 
  Radio, 
  RefreshCw, 
  AlertTriangle, 
  ShieldAlert, 
  Users, 
  Check, 
  Flag, 
  X, 
  MapPin, 
  LocateFixed, 
  Truck, 
  Phone, 
  Clock, 
  Eye, 
  Layers, 
  Navigation,
  Sparkles,
  Info
} from 'lucide-react';
import { api } from '../../services/api';
import { CrisisWebSocketClient } from '../../services/websocket';
import DuplicateBadge from '../Requester/DuplicateBadge';

// Ray-casting point-in-polygon algorithm (Zero external dependencies)
function isPointInPolygon(point, polygonCoords) {
  const [x, y] = point; // [lng, lat]
  let inside = false;
  for (let i = 0, j = polygonCoords.length - 1; i < polygonCoords.length; j = i++) {
    const xi = polygonCoords[i][0], yi = polygonCoords[i][1];
    const xj = polygonCoords[j][0], yj = polygonCoords[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export default function AdminMap() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef({}); // map of id -> maplibregl.Marker

  const [requests, setRequests] = useState([]);
  const [sachetGeoJson, setSachetGeoJson] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all'); // all, extreme, blood, urgent, unassigned
  const [userGeoWarning, setUserGeoWarning] = useState(null);
  const [incomingAlert, setIncomingAlert] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // 1. Fetch live data
  const loadData = async () => {
    setLoading(true);
    try {
      const [reqs, alerts] = await Promise.all([
        api.getRequests(),
        api.getSachetAlerts(),
      ]);
      setRequests(reqs);
      setSachetGeoJson(alerts);

      // Check User Geolocation against Mumbai Sachet Hazard Polygons
      if (navigator.geolocation && alerts?.features) {
        navigator.geolocation.getCurrentPosition((pos) => {
          const userPt = [pos.coords.longitude, pos.coords.latitude];
          for (const feat of alerts.features) {
            const polyCoords = feat.geometry.coordinates[0];
            if (isPointInPolygon(userPt, polyCoords)) {
              setUserGeoWarning({
                headline: feat.properties.headline,
                district: feat.properties.district,
                severity: feat.properties.severity,
              });
              break;
            }
          }
        }, () => {});
      }
    } catch (err) {
      console.error('Failed to load MapLibre data:', err);
    } finally {
      setLoading(false);
    }
  };

  // 2. Initialize MapLibre GL JS centered over Mumbai
  useEffect(() => {
    if (map.current) return;

    // Mumbai coordinates: [72.8777, 19.0760] (lng, lat)
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: [
              'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors | NDMA Sachet Architecture'
          }
        },
        layers: [
          {
            id: 'osm-tiles-layer',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19
          }
        ]
      },
      center: [72.8777, 19.0760], // Mumbai Center
      zoom: 12,
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      // Add Sachet GeoJSON Source if already fetched
      if (sachetGeoJson) {
        addSachetLayers(sachetGeoJson);
      }
    });

    loadData();

    // 3. Native WebSocket for real-time live updates
    const wsClient = new CrisisWebSocketClient(
      'admin',
      'all',
      (payload) => {
        if (payload.event === 'new_request' && payload.data) {
          const newReq = payload.data;
          setRequests((prev) => {
            if (prev.some((r) => r.id === newReq.id)) return prev;
            return [newReq, ...prev]; // Newest first!
          });
          setIncomingAlert(newReq);
          setTimeout(() => setIncomingAlert(null), 6000);
        } else if (payload.event === 'status_update' || payload.event === 'matched') {
          setRequests((prev) =>
            prev.map((r) => (r.id === payload.data.id ? { ...r, ...payload.data } : r))
          );
          if (selectedItem?.id === payload.data.id) {
            setSelectedItem((prev) => ({ ...prev, ...payload.data }));
          }
        }
      }
    );

    return () => {
      wsClient.close();
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // 4. Add or update Sachet Hazard Polygons Layer
  const addSachetLayers = (geoJsonData) => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    if (map.current.getSource('sachet-alerts-source')) {
      map.current.getSource('sachet-alerts-source').setData(geoJsonData);
      return;
    }

    map.current.addSource('sachet-alerts-source', {
      type: 'geojson',
      data: geoJsonData,
    });

    // Dynamic Fill Layer based on Severity (Extreme = #d32f2f, Severe = #f57c00, Moderate = #fbc02d)
    map.current.addLayer({
      id: 'alerts-fill',
      type: 'fill',
      source: 'sachet-alerts-source',
      paint: {
        'fill-color': [
          'match',
          ['get', 'severity'],
          'Extreme', '#DC2626', // Red
          'Severe', '#EA580C',  // Orange
          'Moderate', '#EAB308', // Yellow
          /* fallback */ '#3B82F6'
        ],
        'fill-opacity': 0.32,
      },
    });

    // Hazard Polygon Borders
    map.current.addLayer({
      id: 'alerts-borders',
      type: 'line',
      source: 'sachet-alerts-source',
      paint: {
        'line-color': [
          'match',
          ['get', 'severity'],
          'Extreme', '#991B1B',
          'Severe', '#C2410C',
          'Moderate', '#A16207',
          /* fallback */ '#1D4ED8'
        ],
        'line-width': 2.5,
      },
    });

    // Click on Alert Polygon
    map.current.on('click', 'alerts-fill', (e) => {
      const feat = e.features[0];
      const props = feat.properties;
      setSelectedItem({
        isSachetAlert: true,
        ...props,
      });

      new maplibregl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(`
          <div style="font-family: 'Plus Jakarta Sans', sans-serif; padding: 4px; min-width: 200px;">
            <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; background: ${props.severity === 'Extreme' ? '#FEE2E2' : '#FEF3C7'}; color: ${props.severity === 'Extreme' ? '#991B1B' : '#B45309'}; padding: 2px 6px; border-radius: 4px;">
              ${props.severity} Severity Alert
            </span>
            <h4 style="margin: 6px 0 3px 0; font-size: 13px; font-weight: 800; color: #0F172A;">${props.headline}</h4>
            <p style="margin: 0; font-size: 11px; color: #475569; line-height: 1.3;">${props.description}</p>
            <div style="margin-top: 6px; font-size: 10px; color: #64748B;">District: <strong>${props.district}</strong></div>
          </div>
        `)
        .addTo(map.current);
    });

    map.current.on('mouseenter', 'alerts-fill', () => {
      map.current.getCanvas().style.cursor = 'pointer';
    });
    map.current.on('mouseleave', 'alerts-fill', () => {
      map.current.getCanvas().style.cursor = '';
    });
  };

  // Sync Sachet layers when data loads
  useEffect(() => {
    if (sachetGeoJson && map.current && map.current.isStyleLoaded()) {
      addSachetLayers(sachetGeoJson);
    }
  }, [sachetGeoJson]);

  // 5. Update MapLibre DOM Markers for Emergency Requests & Volunteers
  useEffect(() => {
    if (!map.current) return;

    // Filter requests
    const visibleRequests = requests.filter((r) => {
      if (activeFilter === 'urgent') return r.urgency === 'high';
      if (activeFilter === 'blood') return r.category === 'blood';
      if (activeFilter === 'unassigned') return r.status === 'requested';
      return true;
    });

    const currentIds = new Set();

    visibleRequests.forEach((req) => {
      currentIds.add(req.id);
      const isHigh = req.urgency === 'high';
      const isMatched = req.status === 'matched' || req.status === 'en_route' || req.status === 'in_progress';
      const isSelected = selectedItem?.id === req.id;

      const colorMap = {
        rescue: '#991B1B',
        blood: '#DC2626',
        oxygen: '#0891B2',
        medicine: '#2563EB',
        food: '#D97706',
        shelter: '#7C3AED',
        transport: '#0D9488',
      };
      const catColor = colorMap[req.category] || '#DC2626';

      // Ensure coordinates are valid numbers
      const reqLat = parseFloat(req.lat);
      const reqLng = parseFloat(req.lng);
      if (isNaN(reqLat) || isNaN(reqLng)) return;

      // Create or update marker
      if (!markersRef.current[req.id]) {
        // Outer anchor element for MapLibre positioning (MapLibre controls transform: translate)
        const el = document.createElement('div');
        el.className = 'maplibre-marker-anchor';
        el.style.width = '32px';
        el.style.height = '32px';
        el.style.cursor = 'pointer';

        // Inner element for badge color and pulse animation
        const inner = document.createElement('div');
        inner.className = 'custom-maplibre-pin';
        inner.style.width = '32px';
        inner.style.height = '32px';
        inner.style.borderRadius = '50%';
        inner.style.background = catColor;
        inner.style.border = '2.5px solid #FFFFFF';
        inner.style.boxShadow = '0 4px 10px rgba(15,23,42,0.4)';
        inner.style.display = 'flex';
        inner.style.alignItems = 'center';
        inner.style.justifyContent = 'center';
        if (isHigh) {
          inner.style.animation = 'urgent-radar 1.6s infinite';
        }

        const dot = document.createElement('div');
        dot.style.width = '8px';
        dot.style.height = '8px';
        dot.style.background = '#FFFFFF';
        dot.style.borderRadius = '50%';
        inner.appendChild(dot);

        el.appendChild(inner);

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedItem(req);
          map.current.flyTo({ center: [reqLng, reqLat], zoom: 14.5, duration: 800 });
        });

        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([reqLng, reqLat])
          .addTo(map.current);

        markersRef.current[req.id] = marker;
      }

      // If matched, also ensure Volunteer Marker is added
      const volId = `vol-${req.id}`;
      if (isMatched) {
        currentIds.add(volId);
        const helperLng = parseFloat(req.match_info?.helper_lng || (reqLng + 0.003));
        const helperLat = parseFloat(req.match_info?.helper_lat || (reqLat + 0.003));

        if (!markersRef.current[volId]) {
          const volEl = document.createElement('div');
          volEl.className = 'maplibre-vol-anchor';
          volEl.style.width = '32px';
          volEl.style.height = '32px';
          volEl.style.cursor = 'pointer';

          const volInner = document.createElement('div');
          volInner.style.width = '32px';
          volInner.style.height = '32px';
          volInner.style.borderRadius = '50%';
          volInner.style.background = '#4338CA';
          volInner.style.border = '2.5px solid #FFFFFF';
          volInner.style.boxShadow = '0 4px 12px rgba(67,56,202,0.5)';
          volInner.style.display = 'flex';
          volInner.style.alignItems = 'center';
          volInner.style.justifyContent = 'center';

          const innerDot = document.createElement('div');
          innerDot.style.width = '10px';
          innerDot.style.height = '10px';
          innerDot.style.background = '#FFFFFF';
          innerDot.style.borderRadius = '50%';
          volInner.appendChild(innerDot);

          volEl.appendChild(volInner);

          volEl.addEventListener('click', (e) => {
            e.stopPropagation();
            setSelectedItem(req);
            map.current.flyTo({ center: [helperLng, helperLat], zoom: 15, duration: 800 });
          });

          const volMarker = new maplibregl.Marker({ element: volEl, anchor: 'center' })
            .setLngLat([helperLng, helperLat])
            .addTo(map.current);

          markersRef.current[volId] = volMarker;
        }
      }
    });

    // Remove obsolete markers
    Object.keys(markersRef.current).forEach((id) => {
      if (!currentIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });
  }, [requests, activeFilter]);

  // Handle 1-Tap Accept from Map
  const handleMapAccept = async (requestId) => {
    setActionLoading(true);
    try {
      const res = await api.simulateAccept(requestId);
      const updated = res.request;
      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, ...updated } : r))
      );
      setSelectedItem(updated);
    } catch (err) {
      console.error('Map accept error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Triage status update
  const handleMapTriage = async (requestId, adminStatus) => {
    setActionLoading(true);
    try {
      const updated = await api.patchRequest(requestId, { admin_status: adminStatus });
      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, admin_status: updated.admin_status } : r))
      );
      if (selectedItem?.id === requestId) {
        setSelectedItem((prev) => ({ ...prev, admin_status: updated.admin_status }));
      }
    } catch (err) {
      console.error('Triage error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Fly map to specific request from sidebar
  const flyToRequest = (req) => {
    setSelectedItem(req);
    if (map.current) {
      map.current.flyTo({
        center: [req.lng, req.lat],
        zoom: 15,
        duration: 900,
      });
    }
  };

  return (
    <div className="py-2 sm:py-6">
      {/* Real-time Incoming Emergency Toast */}
      {incomingAlert && (
        <div 
          onClick={() => flyToRequest(incomingAlert)}
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
                <span className="text-xs font-mono">{Number(incomingAlert.lat || 0).toFixed(4)}, {Number(incomingAlert.lng || 0).toFixed(4)} (Mumbai)</span>
              </div>
              <p className="text-xs font-medium text-white/90 mt-0.5">
                {incomingAlert.details || '1-Tap Rapid SOS Received. Click to fly to pin on MapLibre.'}
              </p>
            </div>
          </div>
          <span className="text-xs font-bold underline px-3 py-1 bg-white/10 rounded-lg">
            Inspect &rarr;
          </span>
        </div>
      )}

      {/* User Geolocation Hazard Alert (NDMA Sachet Point-in-Polygon feature) */}
      {userGeoWarning && (
        <div className="mb-4 p-4 rounded-2xl bg-[#FEF3C7] border-2 border-[#D97706] text-[#92400E] shadow-md flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-[#D97706] flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <div className="font-extrabold text-sm text-[#B45309]">
              ⚠️ NDMA Sachet Geo-Alert: You are inside an active warning polygon!
            </div>
            <div className="font-medium mt-0.5">
              <strong>{userGeoWarning.headline}</strong> in <strong>{userGeoWarning.district}</strong>.
            </div>
          </div>
        </div>
      )}

      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-[#0F172A] text-white tracking-widest">
              NDMA Sachet Architecture
            </span>
            <span className="text-xs font-mono text-[#0284C7] font-bold">
              MapLibre GL JS &bull; Mumbai Regional Polygons
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight mt-1 flex items-center space-x-2">
            <Radio className="w-5 h-5 text-[#DC2626] animate-pulse" />
            <span>Crisis GIS & Common Alerting Protocol (CAP) Map</span>
          </h1>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-white border border-[#CBD5E1] text-[#0F172A] text-xs font-bold shadow-sm">
            Active SOS Pins: <strong>{requests.length}</strong>
          </span>

          {[
            { id: 'all', label: 'All Layers' },
            { id: 'blood', label: 'Blood Aid' },
            { id: 'urgent', label: 'Critical Only' },
            { id: 'unassigned', label: 'Unassigned Queue' },
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
            onClick={loadData}
            className="p-2 rounded-xl bg-white hover:bg-[#F1F5F9] border border-[#CBD5E1] text-[#475569] transition shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Layout: MapLibre Map (Left 7 Cols) + Synced Live Feed & Inspector (Right 5 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left: MapLibre GL JS Vector Map */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-[#CBD5E1] p-2 shadow-md relative">
          <div
            ref={mapContainer}
            className="w-full h-[620px] rounded-xl overflow-hidden relative"
            style={{ width: '100%', height: '620px' }}
          />

          {/* Map Severity Legend (NDMA Sachet standard) */}
          <div className="absolute bottom-5 left-5 right-5 p-3 rounded-xl bg-white/95 backdrop-blur-md border border-[#CBD5E1] shadow-lg flex flex-wrap items-center justify-between gap-3 text-xs z-10">
            <div className="flex items-center space-x-3 font-bold text-[#0F172A]">
              <span>CAP Severity:</span>
              <span className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded bg-[#DC2626] inline-block border border-black/10" />
                <span className="text-[#991B1B]">Extreme</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded bg-[#EA580C] inline-block border border-black/10" />
                <span className="text-[#C2410C]">Severe</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded bg-[#EAB308] inline-block border border-black/10" />
                <span className="text-[#A16207]">Moderate</span>
              </span>
            </div>

            <div className="flex items-center space-x-3 text-[11px] text-[#475569] font-semibold">
              <span className="flex items-center space-x-1">
                <span className="w-3 h-3 rounded-full bg-[#DC2626] inline-block" />
                <span>Distress SOS</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-3 h-3 rounded-full bg-[#4338CA] inline-block" />
                <span className="text-[#4338CA] font-bold">Volunteer Unit</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right: Synced Two-Way Feed & Inspector Drawer (Sachet Architecture) */}
        <div className="lg:col-span-5 bg-white border border-[#CBD5E1] rounded-2xl p-5 shadow-md flex flex-col justify-between h-[636px]">
          <div>
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3 mb-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#0F172A] flex items-center space-x-2">
                <Layers className="w-4 h-4 text-[#2563EB]" />
                <span>Live Feed & Triage (Synced with Viewport)</span>
              </h3>
              <span className="text-xs font-mono text-[#64748B]">
                Newest Up ({requests.length})
              </span>
            </div>

            {/* Selected Item Detail Card */}
            {selectedItem ? (
              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] mb-4 space-y-2.5 shadow-sm animate-pulse-subtle">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[11px] font-black uppercase bg-[#0F172A] text-white">
                    {selectedItem.category || (selectedItem.isSachetAlert ? 'CAP Alert' : 'Emergency')}
                  </span>
                  <button
                    onClick={() => setSelectedItem(null)}
                    className="text-xs text-[#64748B] hover:text-[#0F172A] font-bold"
                  >
                    Close Inspector ✕
                  </button>
                </div>

                <h4 className="text-sm font-extrabold text-[#0F172A] leading-snug">
                  {selectedItem.headline || selectedItem.details || 'Emergency Distress Signal'}
                </h4>

                <p className="text-xs text-[#475569] font-medium leading-relaxed">
                  {selectedItem.description || (selectedItem.requester_name ? `Contact: ${selectedItem.requester_name} (${selectedItem.requester_phone || 'No phone'})` : '1-Tap Rapid SOS Received.')}
                </p>

                {selectedItem.lat && (
                  <div className="text-[11px] font-mono text-[#64748B] pt-1 border-t border-[#E2E8F0]">
                    Location: Mumbai ({Number(selectedItem.lat || 0).toFixed(4)}, {Number(selectedItem.lng || 0).toFixed(4)})
                  </div>
                )}

                {/* 1-Tap Map Actions */}
                {!selectedItem.isSachetAlert && selectedItem.id && (
                  <div className="pt-2 space-y-2">
                    {selectedItem.status === 'requested' && (
                      <button
                        disabled={actionLoading}
                        onClick={() => handleMapAccept(selectedItem.id)}
                        className="w-full py-2 px-3 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white font-extrabold text-xs shadow-md transition flex items-center justify-center space-x-1.5"
                      >
                        <Truck className="w-4 h-4" />
                        <span>Accept & Dispatch Responder Unit</span>
                      </button>
                    )}

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        disabled={actionLoading}
                        onClick={() => handleMapTriage(selectedItem.id, 'approved')}
                        className="py-1.5 px-2 rounded-lg bg-[#DCFCE7] text-[#15803D] font-bold text-[11px] border border-[#BBF7D0]"
                      >
                        Approve
                      </button>
                      <button
                        disabled={actionLoading}
                        onClick={() => handleMapTriage(selectedItem.id, 'flagged')}
                        className="py-1.5 px-2 rounded-lg bg-[#FEF3C7] text-[#B45309] font-bold text-[11px] border border-[#FDE68A]"
                      >
                        Flag
                      </button>
                      <button
                        disabled={actionLoading}
                        onClick={() => handleMapTriage(selectedItem.id, 'rejected')}
                        className="py-1.5 px-2 rounded-lg bg-[#FEE2E2] text-[#B91C1C] font-bold text-[11px] border border-[#FECACA]"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* Scrollable Live List (Newest Up!) */}
            <div className="space-y-2.5 overflow-y-auto max-h-[380px] pr-1">
              {requests.map((req) => {
                const isSelected = selectedItem?.id === req.id;
                const isHigh = req.urgency === 'high';

                return (
                  <div
                    key={req.id}
                    onClick={() => flyToRequest(req)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#E0F2FE] border-[#0284C7] ring-2 ring-[#0284C7]/20 shadow-sm'
                        : isHigh
                        ? 'bg-gradient-to-r from-[#FEF2F2] to-white border-[#FECACA] hover:border-[#DC2626]'
                        : 'bg-white border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-black uppercase text-[#0F172A]">
                          {req.category}
                        </span>
                        {isHigh && (
                          <span className="text-[10px] font-black uppercase px-1.5 py-0.2 rounded bg-[#DC2626] text-white">
                            High Urgency
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-[#64748B] capitalize">
                          [{req.status}]
                        </span>
                      </div>
                      <span className="text-[10px] text-[#94A3B8]">
                        {req.created_at ? new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                      </span>
                    </div>

                    <p className="text-xs font-bold text-[#0F172A] line-clamp-1">
                      {req.details || '1-Tap Emergency SOS Received'}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-[#64748B] mt-1 font-medium">
                      <span>{req.requester_name || 'Citizen'}</span>
                      <span className="text-[#2563EB] font-bold flex items-center space-x-1">
                        <MapPin className="w-3 h-3" />
                        <span>Fly to Pin &rarr;</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-[#E2E8F0] pt-3 text-xs text-[#64748B] flex items-center justify-between">
            <span className="font-bold text-[#0F172A]">MapLibre Vector Engine</span>
            <span>Click any polygon or pin to inspect</span>
          </div>
        </div>

      </div>
    </div>
  );
}
