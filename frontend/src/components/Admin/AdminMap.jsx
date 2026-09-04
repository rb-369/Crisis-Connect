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
  Info,
  Trash2,
  CheckCircle2,
  AlertOctagon,
  Flame
} from 'lucide-react';
import { api } from '../../services/api';
import { CrisisWebSocketClient } from '../../services/websocket';
import DuplicateBadge from '../Requester/DuplicateBadge';
import { 
  createMapLibrePin, 
  getPinType, 
  calculatePolygonCentroid 
} from '../../utils/mapPins';

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
  const markersRef = useRef({}); // map of id -> { marker, element, type, destroy }

  const [requests, setRequests] = useState([]);
  const [sachetGeoJson, setSachetGeoJson] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all'); // all, extreme, blood, urgent, unassigned, completed
  const [userGeoWarning, setUserGeoWarning] = useState(null);
  const [incomingAlert, setIncomingAlert] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Manual pin dismissal & confirmation dialog states
  const [pinToRemove, setPinToRemove] = useState(null);
  const [dismissedPinIds, setDismissedPinIds] = useState(new Set());

  // 1. Fetch live data
  const loadData = async () => {
    setLoading(true);
    try {
      const [reqs, alerts] = await Promise.all([
        api.getRequests(),
        api.getSachetAlerts(),
      ]);
      setRequests(reqs || []);
      setSachetGeoJson(alerts);

      // Check User Geolocation against Mumbai Sachet Hazard Polygons
      if (navigator.geolocation && alerts && alerts.features) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const userPt = [pos.coords.longitude, pos.coords.latitude];
            for (const feat of alerts.features) {
              if (feat.geometry && feat.geometry.coordinates) {
                if (isPointInPolygon(userPt, feat.geometry.coordinates[0])) {
                  setUserGeoWarning(feat.properties);
                  break;
                }
              }
            }
          },
          (err) => console.log('Geolocation skipped:', err.message),
          { timeout: 5000 }
        );
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

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: [
              'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors | NDMA Sachet Architecture',
          },
        },
        layers: [
          {
            id: 'osm-tiles-layer',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
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

    // Dynamic Fill Layer based on Severity (Extreme = #DC2626, Severe = #EA580C, Moderate = #EAB308)
    map.current.addLayer({
      id: 'alerts-fill',
      type: 'fill',
      source: 'sachet-alerts-source',
      paint: {
        'fill-color': [
          'match',
          ['get', 'severity'],
          'Extreme', '#DC2626',
          'Severe', '#EA580C',
          'Moderate', '#EAB308',
          /* fallback */ '#3B82F6'
        ],
        'fill-opacity': 0.28,
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
              ⚠️ ${props.severity} Severity Alert
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

  // Handler when completed 2-min timer expires
  const handleExpirePin = (pinId) => {
    setDismissedPinIds((prev) => new Set([...prev, pinId]));
    if (markersRef.current[pinId]) {
      if (typeof markersRef.current[pinId].destroy === 'function') {
        markersRef.current[pinId].destroy();
      } else {
        markersRef.current[pinId].marker?.remove();
      }
      delete markersRef.current[pinId];
    }
    if (selectedItem?.id === pinId) {
      setSelectedItem(null);
    }
  };

  // 5. Update MapLibre Custom Pins for Hazards, Critical SOS, Normal Emergency, Assigned Volunteer & Completed
  useEffect(() => {
    if (!map.current) return;

    const currentIds = new Set();

    // A. Render Hazard Pins from Sachet GeoJSON polygons (placed at polygon centroid)
    if (sachetGeoJson && sachetGeoJson.features) {
      sachetGeoJson.features.forEach((feat, index) => {
        const hazardId = feat.id || `sachet-hazard-${index}`;
        if (dismissedPinIds.has(hazardId)) return;
        currentIds.add(hazardId);

        if (!markersRef.current[hazardId]) {
          const centroid = calculatePolygonCentroid(feat.geometry?.coordinates);
          if (centroid) {
            const hazardItem = {
              id: hazardId,
              isHazard: true,
              isSachetAlert: true,
              lat: centroid[1],
              lng: centroid[0],
              severity: feat.properties?.severity || 'Severe',
              headline: feat.properties?.headline || 'Active Hazard Zone',
              description: feat.properties?.description || 'NDMA Sachet Warning Area',
              district: feat.properties?.district || 'Mumbai',
            };

            const pinObj = createMapLibrePin({
              item: hazardItem,
              type: 'hazard',
              onSelect: (item) => {
                setSelectedItem(item);
                map.current.flyTo({ center: [centroid[0], centroid[1]], zoom: 14, duration: 800 });
              },
            });

            pinObj.marker.addTo(map.current);
            markersRef.current[hazardId] = pinObj;
          }
        }
      });
    }

    // B. Filter requests based on active toolbar filter
    const visibleRequests = requests.filter((r) => {
      if (activeFilter === 'urgent') return r.urgency === 'high';
      if (activeFilter === 'blood') return r.category === 'blood';
      if (activeFilter === 'unassigned') return r.status === 'requested';
      if (activeFilter === 'completed') return r.status === 'completed' || r.status === 'resolved';
      return true;
    });

    // C. Render Request Pins (Critical SOS, Normal Emergency, Assigned, Completed)
    visibleRequests.forEach((req) => {
      if (dismissedPinIds.has(req.id)) return;

      const reqLat = parseFloat(req.lat);
      const reqLng = parseFloat(req.lng);
      if (isNaN(reqLat) || isNaN(reqLng)) return;

      const pinType = getPinType(req);
      currentIds.add(req.id);

      // If existing marker has a different type (status changed), recreate it
      if (markersRef.current[req.id]) {
        if (markersRef.current[req.id].type !== pinType) {
          if (typeof markersRef.current[req.id].destroy === 'function') {
            markersRef.current[req.id].destroy();
          } else {
            markersRef.current[req.id].marker?.remove();
          }
          delete markersRef.current[req.id];
        }
      }

      // Create new custom pin
      if (!markersRef.current[req.id]) {
        const pinObj = createMapLibrePin({
          item: req,
          type: pinType,
          onSelect: (item) => {
            setSelectedItem(item);
            map.current.flyTo({ center: [reqLng, reqLat], zoom: 14.5, duration: 800 });
          },
          onExpire: (id) => handleExpirePin(id),
        });

        pinObj.marker.addTo(map.current);
        markersRef.current[req.id] = pinObj;
      }

      // If matched, also render dedicated Assigned Volunteer Unit pin
      const isMatched = req.status === 'matched' || req.status === 'en_route' || req.status === 'in_progress';
      const volId = `vol-${req.id}`;
      if (isMatched && !dismissedPinIds.has(volId)) {
        currentIds.add(volId);
        const helperLng = parseFloat(req.match_info?.helper_lng || (reqLng + 0.003));
        const helperLat = parseFloat(req.match_info?.helper_lat || (reqLat + 0.003));

        if (!markersRef.current[volId]) {
          const volItem = {
            id: volId,
            requestId: req.id,
            status: 'matched',
            lat: helperLat,
            lng: helperLng,
            category: 'volunteer',
            details: `Volunteer Unit En Route for ${req.category?.toUpperCase()} Emergency`,
            requester_name: req.match_info?.helper_name || 'Volunteer Unit',
          };

          const volPinObj = createMapLibrePin({
            item: volItem,
            type: 'assigned_volunteer',
            onSelect: () => {
              setSelectedItem(req);
              map.current.flyTo({ center: [helperLng, helperLat], zoom: 15, duration: 800 });
            },
          });

          volPinObj.marker.addTo(map.current);
          markersRef.current[volId] = volPinObj;
        }
      }
    });

    // D. Remove obsolete markers
    Object.keys(markersRef.current).forEach((id) => {
      if (!currentIds.has(id)) {
        if (typeof markersRef.current[id].destroy === 'function') {
          markersRef.current[id].destroy();
        } else {
          markersRef.current[id].marker?.remove();
        }
        delete markersRef.current[id];
      }
    });
  }, [requests, sachetGeoJson, activeFilter, dismissedPinIds]);

  // Admin Manual Pin Dismissal Flow
  const promptRemovePin = (item) => {
    setPinToRemove(item);
  };

  const handleConfirmRemovePin = () => {
    if (!pinToRemove) return;
    const targetId = pinToRemove.id;

    // Add target ID and paired volunteer ID to dismissed set
    setDismissedPinIds((prev) => new Set([...prev, targetId, `vol-${targetId}`]));

    // Animate pin fade out
    if (markersRef.current[targetId]) {
      if (markersRef.current[targetId].element) {
        markersRef.current[targetId].element.classList.add('pin-fade-out-anim');
      }
      setTimeout(() => {
        if (markersRef.current[targetId]) {
          if (typeof markersRef.current[targetId].destroy === 'function') {
            markersRef.current[targetId].destroy();
          } else {
            markersRef.current[targetId].marker?.remove();
          }
          delete markersRef.current[targetId];
        }
      }, 500);
    }

    const volId = `vol-${targetId}`;
    if (markersRef.current[volId]) {
      if (markersRef.current[volId].element) {
        markersRef.current[volId].element.classList.add('pin-fade-out-anim');
      }
      setTimeout(() => {
        if (markersRef.current[volId]) {
          if (typeof markersRef.current[volId].destroy === 'function') {
            markersRef.current[volId].destroy();
          } else {
            markersRef.current[volId].marker?.remove();
          }
          delete markersRef.current[volId];
        }
      }, 500);
    }

    if (selectedItem?.id === targetId) {
      setSelectedItem(null);
    }
    setPinToRemove(null);
  };

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

  // Handle Mark Resolved / Completed
  const handleMarkCompleted = async (requestId) => {
    setActionLoading(true);
    try {
      const updated = await api.patchRequest(requestId, { 
        status: 'completed',
        admin_status: 'resolved',
      });
      const completedEntry = {
        ...updated,
        status: 'completed',
        completed_at: new Date().toISOString(),
      };
      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, ...completedEntry } : r))
      );
      if (selectedItem?.id === requestId) {
        setSelectedItem((prev) => ({ ...prev, ...completedEntry }));
      }
    } catch (err) {
      console.error('Complete error, falling back locally:', err);
      const completedEntry = {
        status: 'completed',
        completed_at: new Date().toISOString(),
      };
      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, ...completedEntry } : r))
      );
      if (selectedItem?.id === requestId) {
        setSelectedItem((prev) => ({ ...prev, ...completedEntry }));
      }
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
            <Radio className="w-6 h-6 animate-pulse text-yellow-300" />
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-red-200">
                ⚡ New Live Incoming Emergency Signal
              </div>
              <div className="font-extrabold text-sm">
                {incomingAlert.details || '1-Tap Rapid SOS Received. Click to fly to pin on MapLibre.'}
              </div>
            </div>
          </div>
          <span className="text-xs font-mono font-bold bg-black/30 px-3 py-1.5 rounded-xl">
            Fly to Pin &rarr;
          </span>
        </div>
      )}

      {/* User Geolocation Hazard Alert (NDMA Sachet Point-in-Polygon feature) */}
      {userGeoWarning && (
        <div className="mb-4 p-4 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-[#DC2626] animate-pulse flex-shrink-0" />
            <div>
              <h4 className="text-xs font-black uppercase text-[#991B1B]">
                ⚠️ NDMA Sachet Geo-Alert: You are inside an active warning polygon!
              </h4>
              <p className="text-xs text-[#7F1D1D] font-medium">
                {userGeoWarning.headline} ({userGeoWarning.severity} Severity &bull; {userGeoWarning.district})
              </p>
            </div>
          </div>
          <button
            onClick={() => setUserGeoWarning(null)}
            className="text-xs font-bold text-[#991B1B] hover:text-[#7F1D1D]"
          >
            ✕
          </button>
        </div>
      )}

      {/* Admin Map Header & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-black text-[#0F172A] flex items-center space-x-2">
            <ShieldAlert className="w-6 h-6 text-[#DC2626]" />
            <span>GIS Mission Control & Dynamic Hazard Map</span>
          </h2>
          <p className="text-xs text-[#64748B] font-medium">
            Multi-Layer MapLibre GL JS engine with 5 distinct dynamic pin types & 2-minute auto-archiving.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all', label: 'All Markers' },
            { id: 'urgent', label: '⚡ Critical SOS' },
            { id: 'unassigned', label: '🚨 Unassigned' },
            { id: 'blood', label: '🩸 Blood' },
            { id: 'completed', label: '✓ Completed (2m)' },
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
            title="Refresh Map Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Layout: MapLibre Map (Left 7 Cols) + Synced Live Feed & Inspector (Right 5 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left: MapLibre GL JS Vector Map */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-[#CBD5E1] p-2 shadow-md relative flex flex-col justify-between">
          <div
            ref={mapContainer}
            className="w-full h-[620px] rounded-xl overflow-hidden relative"
            style={{ width: '100%', height: '620px' }}
          />

          {/* 5-Pin Dynamic Map Legend */}
          <div className="absolute bottom-5 left-5 right-5 p-3.5 rounded-xl bg-white/95 backdrop-blur-md border border-[#CBD5E1] shadow-xl z-10">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2 mb-2.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#0F172A] flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>Live Map Pin Classification</span>
              </span>
              <span className="text-[10px] text-[#64748B] font-mono">
                5 Distinct Pin Layers
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] font-semibold">
              {/* 1. Hazard Pin */}
              <div className="flex items-center space-x-2 p-1.5 rounded-lg bg-[#FEF3C7]/60 border border-[#FDE68A]">
                <span className="w-3.5 h-3.5 rounded-full bg-[#EA580C] flex items-center justify-center text-white text-[8px] font-bold shadow-sm animate-pulse">
                  ⚠️
                </span>
                <div>
                  <div className="font-extrabold text-[#9A3412] leading-tight">Hazard</div>
                  <div className="text-[9px] text-[#B45309]">Sachet / Alert</div>
                </div>
              </div>

              {/* 2. Critical SOS */}
              <div className="flex items-center space-x-2 p-1.5 rounded-lg bg-[#FEE2E2]/60 border border-[#FECACA]">
                <span className="w-3.5 h-3.5 rounded-full bg-[#DC2626] ring-2 ring-red-400 flex items-center justify-center text-white text-[8px] font-bold shadow-sm animate-ping">
                  ⚡
                </span>
                <div>
                  <div className="font-extrabold text-[#991B1B] leading-tight">Critical SOS</div>
                  <div className="text-[9px] text-[#DC2626]">Glowing Red</div>
                </div>
              </div>

              {/* 3. Normal Emergency */}
              <div className="flex items-center space-x-2 p-1.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                <span className="w-3.5 h-3.5 rounded-full bg-[#E11D48] flex items-center justify-center text-white text-[8px] font-bold shadow-sm">
                  🚨
                </span>
                <div>
                  <div className="font-extrabold text-[#0F172A] leading-tight">Emergency</div>
                  <div className="text-[9px] text-[#64748B]">Solid Red</div>
                </div>
              </div>

              {/* 4. Assigned Volunteer */}
              <div className="flex items-center space-x-2 p-1.5 rounded-lg bg-[#EFF6FF]/60 border border-[#BFDBFE]">
                <span className="w-3.5 h-3.5 rounded-full bg-[#2563EB] ring-2 ring-blue-400 flex items-center justify-center text-white text-[8px] font-bold shadow-sm">
                  🚗
                </span>
                <div>
                  <div className="font-extrabold text-[#1E40AF] leading-tight">Assigned</div>
                  <div className="text-[9px] text-[#2563EB]">Vibrant Blue</div>
                </div>
              </div>

              {/* 5. Completed */}
              <div className="flex items-center space-x-2 p-1.5 rounded-lg bg-[#DCFCE7]/60 border border-[#BBF7D0]">
                <span className="w-3.5 h-3.5 rounded-full bg-[#16A34A] flex items-center justify-center text-white text-[8px] font-bold shadow-sm">
                  ✓
                </span>
                <div>
                  <div className="font-extrabold text-[#15803D] leading-tight">Completed</div>
                  <div className="text-[9px] text-[#16A34A]">Green (2m auto)</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Synced Two-Way Feed & Inspector Drawer */}
        <div className="lg:col-span-5 bg-white border border-[#CBD5E1] rounded-2xl p-5 shadow-md flex flex-col justify-between h-[636px]">
          <div>
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3 mb-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#0F172A] flex items-center space-x-2">
                <Layers className="w-4 h-4 text-[#2563EB]" />
                <span>Live Feed & Pin Inspector</span>
              </h3>
              <span className="text-xs font-mono text-[#64748B]">
                Active ({requests.length})
              </span>
            </div>

            {/* Selected Item Detail Card */}
            {selectedItem ? (
              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] mb-4 space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-black uppercase text-white ${
                    selectedItem.isHazard || selectedItem.isSachetAlert 
                      ? 'bg-[#EA580C]'
                      : selectedItem.status === 'completed'
                      ? 'bg-[#16A34A]'
                      : selectedItem.status === 'matched'
                      ? 'bg-[#2563EB]'
                      : selectedItem.urgency === 'high'
                      ? 'bg-[#DC2626]'
                      : 'bg-[#0F172A]'
                  }`}>
                    {selectedItem.isHazard || selectedItem.isSachetAlert 
                      ? '⚠️ Hazard Alert'
                      : selectedItem.status === 'completed'
                      ? '✓ Completed'
                      : selectedItem.status === 'matched'
                      ? '🚗 Dispatched'
                      : selectedItem.urgency === 'high'
                      ? '⚡ Critical SOS'
                      : `${selectedItem.category || 'Emergency'}`}
                  </span>

                  <div className="flex items-center space-x-2">
                    {/* Admin Remove Pin Button */}
                    <button
                      onClick={() => promptRemovePin(selectedItem)}
                      className="p-1.5 rounded-lg bg-[#FEE2E2] hover:bg-[#FECACA] text-[#B91C1C] transition font-bold text-xs flex items-center space-x-1"
                      title="Remove pin from map"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="text-[10px]">Remove Pin</span>
                    </button>

                    <button
                      onClick={() => setSelectedItem(null)}
                      className="text-xs text-[#64748B] hover:text-[#0F172A] font-bold p-1"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <h4 className="text-sm font-extrabold text-[#0F172A] leading-snug">
                  {selectedItem.headline || selectedItem.details || 'Emergency Distress Signal'}
                </h4>

                <p className="text-xs text-[#475569] font-medium leading-relaxed">
                  {selectedItem.description || (selectedItem.requester_name ? `Contact: ${selectedItem.requester_name} (${selectedItem.requester_phone || 'No phone'})` : '1-Tap Rapid SOS Received.')}
                </p>

                {selectedItem.lat && (
                  <div className="text-[11px] font-mono text-[#64748B] pt-1 border-t border-[#E2E8F0] flex items-center justify-between">
                    <span>Coordinates: ({Number(selectedItem.lat || 0).toFixed(4)}, {Number(selectedItem.lng || 0).toFixed(4)})</span>
                    {selectedItem.status === 'completed' && (
                      <span className="text-[#16A34A] font-bold text-[10px]">2-min auto-dismiss active</span>
                    )}
                  </div>
                )}

                {/* 1-Tap Map Actions */}
                {!selectedItem.isSachetAlert && selectedItem.id && (
                  <div className="pt-2 space-y-2">
                    {selectedItem.status === 'requested' && (
                      <button
                        disabled={actionLoading}
                        onClick={() => handleMapAccept(selectedItem.id)}
                        className="w-full py-2 px-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-extrabold text-xs shadow-md transition flex items-center justify-center space-x-1.5"
                      >
                        <Truck className="w-4 h-4" />
                        <span>Dispatch Volunteer Unit (Turns Pin Blue)</span>
                      </button>
                    )}

                    {selectedItem.status !== 'completed' && (
                      <button
                        disabled={actionLoading}
                        onClick={() => handleMarkCompleted(selectedItem.id)}
                        className="w-full py-2 px-3 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white font-extrabold text-xs shadow-md transition flex items-center justify-center space-x-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Mark Resolved (Turns Pin Green for 2m)</span>
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

            {/* Scrollable Live List */}
            <div className="space-y-2.5 overflow-y-auto max-h-[360px] pr-1">
              {requests.map((req) => {
                if (dismissedPinIds.has(req.id)) return null;

                const isSelected = selectedItem?.id === req.id;
                const pinType = getPinType(req);
                const isHigh = pinType === 'critical_sos';
                const isCompleted = pinType === 'completed';
                const isAssigned = pinType === 'assigned_volunteer';

                return (
                  <div
                    key={req.id}
                    onClick={() => flyToRequest(req)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#E0F2FE] border-[#0284C7] ring-2 ring-[#0284C7]/20 shadow-sm'
                        : isHigh
                        ? 'bg-gradient-to-r from-[#FEF2F2] to-white border-[#FECACA] hover:border-[#DC2626]'
                        : isCompleted
                        ? 'bg-gradient-to-r from-[#F0FDF4] to-white border-[#BBF7D0]'
                        : isAssigned
                        ? 'bg-gradient-to-r from-[#EFF6FF] to-white border-[#BFDBFE]'
                        : 'bg-white border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-black uppercase text-[#0F172A]">
                          {req.category}
                        </span>

                        {isHigh && (
                          <span className="text-[10px] font-black uppercase px-1.5 py-0.2 rounded bg-[#DC2626] text-white animate-pulse">
                            ⚡ Glowing SOS
                          </span>
                        )}

                        {isAssigned && (
                          <span className="text-[10px] font-black uppercase px-1.5 py-0.2 rounded bg-[#2563EB] text-white">
                            🚗 Blue Dispatched
                          </span>
                        )}

                        {isCompleted && (
                          <span className="text-[10px] font-black uppercase px-1.5 py-0.2 rounded bg-[#16A34A] text-white">
                            ✓ Green (2m auto)
                          </span>
                        )}

                        {!isHigh && !isAssigned && !isCompleted && (
                          <span className="text-[10px] font-mono text-[#64748B] capitalize">
                            [{req.status}]
                          </span>
                        )}
                      </div>

                      <span className="text-[10px] text-[#94A3B8]">
                        {req.created_at ? new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                      </span>
                    </div>

                    <p className="text-xs font-bold text-[#0F172A] line-clamp-1">
                      {req.details || '1-Tap Emergency SOS Received'}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-[#64748B] mt-1.5 font-medium">
                      <span>{req.requester_name || 'Citizen'}</span>
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            promptRemovePin(req);
                          }}
                          className="text-[#991B1B] hover:text-[#DC2626] text-[10px] font-bold flex items-center space-x-0.5"
                          title="Dismiss pin"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Dismiss</span>
                        </button>

                        <span className="text-[#2563EB] font-bold flex items-center space-x-1">
                          <MapPin className="w-3 h-3" />
                          <span>Fly &rarr;</span>
                        </span>
                      </div>
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

      {/* Confirmation Alert Dialog for Admin Manual Pin Removal */}
      {pinToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#CBD5E1] space-y-4">
            <div className="flex items-center space-x-3 text-[#DC2626]">
              <div className="p-3 rounded-xl bg-[#FEE2E2]">
                <AlertOctagon className="w-6 h-6 text-[#DC2626]" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#0F172A]">
                  Confirm Pin Removal
                </h3>
                <p className="text-xs text-[#64748B]">
                  Admin Map Action
                </p>
              </div>
            </div>

            <p className="text-xs text-[#475569] leading-relaxed">
              Are you sure you want to remove the pin for{' '}
              <strong className="text-[#0F172A]">
                {pinToRemove.headline || pinToRemove.details || pinToRemove.category || 'this incident'}
              </strong>{' '}
              from the active GIS Map?
            </p>

            <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs space-y-1 text-[#64748B]">
              <div><strong>Pin ID:</strong> {pinToRemove.id}</div>
              <div><strong>Status/Type:</strong> {pinToRemove.status || (pinToRemove.isHazard ? 'Hazard' : 'Emergency')}</div>
              {pinToRemove.lat && (
                <div><strong>Coordinates:</strong> {Number(pinToRemove.lat).toFixed(4)}, {Number(pinToRemove.lng).toFixed(4)}</div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setPinToRemove(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#475569] hover:bg-[#F1F5F9] transition border border-[#CBD5E1]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRemovePin}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#DC2626] hover:bg-[#B91C1C] text-white transition shadow-md flex items-center space-x-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Remove Pin</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
