import React, { useState, useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
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
  Phone,
  HeartHandshake,
  Pill,
  Wind,
  Home,
  Utensils,
  Sparkles,
  ShieldCheck,
  Award,
  Layers
} from 'lucide-react';
import { api } from '../../services/api';
import { CrisisWebSocketClient } from '../../services/websocket';
import { 
  BLOOD_GROUPS, 
  isDonorCompatible, 
  getBloodGroupTheme, 
  getCompatibleDonorsForRecipient 
} from '../../utils/bloodCompatibility';
import { fetchShortestRoute } from '../../utils/routeUtils';


const DONOR_PROFILES = [
  {
    id: 'donor-o-neg',
    name: 'Vikram Joshi (Universal Blood Donor O-)',
    role: 'blood_donor',
    bloodGroup: 'O-',
    phone: '+91 98201 44021',
    orgName: 'Mumbai Blood Heroes Network',
    lat: 19.0178,
    lng: 72.8478, // Dadar
    label: '🩸 Blood Donor (O- Universal)',
  },
  {
    id: 'donor-a-pos',
    name: 'Pooja Mehta (Registered Blood Donor A+)',
    role: 'blood_donor',
    bloodGroup: 'A+',
    phone: '+91 98670 12890',
    orgName: 'KEM Voluntary Donors League',
    lat: 19.0028,
    lng: 72.8428, // Parel
    label: '🩸 Blood Donor (A+)',
  },
  {
    id: 'donor-b-pos',
    name: 'Rahul Sawant (Registered Blood Donor B+)',
    role: 'blood_donor',
    bloodGroup: 'B+',
    phone: '+91 98190 77654',
    orgName: 'Mumbai Central Youth Donors',
    lat: 18.9712,
    lng: 72.8197, // Mumbai Central
    label: '🩸 Blood Donor (B+)',
  },
  {
    id: 'vol-red-cross',
    name: 'Dr. Rohit Deshmukh (Red Cross Mumbai Response Unit)',
    role: 'volunteer',
    bloodGroup: 'O+',
    phone: '+91 98201 55019',
    orgName: 'Indian Red Cross Emergency Response Mumbai',
    lat: 19.0390,
    lng: 72.8619, // Sion
    label: '🚑 Medical & Oxygen Volunteer',
  },
  {
    id: 'ngo-dharavi-relief',
    name: 'Dharavi Citizen Relief Fleet',
    role: 'ngo_admin',
    bloodGroup: null,
    phone: '+91 98200 99881',
    orgName: 'Dharavi Disaster Taskforce',
    lat: 19.0434,
    lng: 72.8567, // Dharavi
    label: '🍲 Food, Water & Shelter NGO',
  },
];

export default function VolunteerMock({ currentUser, onOpenAuthModal }) {
  const [selectedDonorProfile, setSelectedDonorProfile] = useState(DONOR_PROFILES[0]);
  const [requests, setRequests] = useState([]);
  const [activeMatch, setActiveMatch] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'map'
  const [selectedPinReq, setSelectedPinReq] = useState(null);

  // MapLibre Refs
  const mapContainer = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef({});
  const volunteerMarkerRef = useRef(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await api.getRequests();
      setRequests(data);
    } catch (err) {
      console.error('Failed to load requests in VolunteerMock:', err);
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

  // Initialize MapLibre GL JS Map when Map view is mounted
  useEffect(() => {
    if (viewMode !== 'map' || !mapContainer.current) return;
    if (mapInstance.current) return;

    const center = [selectedDonorProfile.lng || 72.8478, selectedDonorProfile.lat || 19.0178];

    mapInstance.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors | MapLibre GL JS'
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
      center: center,
      zoom: 13,
    });

    mapInstance.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    mapInstance.current.on('load', () => {
      // Add GeoJSON Route Layer between volunteer and matched incident
      if (!mapInstance.current.getSource('route-source')) {
        mapInstance.current.addSource('route-source', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: []
            }
          }
        });

        mapInstance.current.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route-source',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#2563EB',
            'line-width': 4,
            'line-dasharray': [2, 2]
          }
        });
      }
    });

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [viewMode]);

  // Update MapLibre Markers & Volunteer Location on Data Change
  useEffect(() => {
    if (!mapInstance.current || viewMode !== 'map') return;

    // 1. Volunteer Location Pin
    if (volunteerMarkerRef.current) {
      volunteerMarkerRef.current.remove();
    }

    const volEl = document.createElement('div');
    volEl.className = 'vol-location-marker';
    volEl.style.width = '36px';
    volEl.style.height = '36px';
    volEl.style.borderRadius = '50%';
    volEl.style.backgroundColor = '#2563EB';
    volEl.style.border = '3.5px solid #FFFFFF';
    volEl.style.boxShadow = '0 4px 14px rgba(37,99,235,0.6)';
    volEl.style.display = 'flex';
    volEl.style.alignItems = 'center';
    volEl.style.justifyContent = 'center';
    volEl.style.cursor = 'pointer';

    const volDot = document.createElement('div');
    volDot.style.width = '10px';
    volDot.style.height = '10px';
    volDot.style.backgroundColor = '#FFFFFF';
    volDot.style.borderRadius = '50%';
    volEl.appendChild(volDot);

    volunteerMarkerRef.current = new maplibregl.Marker({ element: volEl })
      .setLngLat([selectedDonorProfile.lng, selectedDonorProfile.lat])
      .setPopup(
        new maplibregl.Popup({ offset: 25 }).setHTML(`
          <div style="font-family: sans-serif; padding: 4px;">
            <div style="font-weight: 800; font-size: 12px; color: #1E40AF;">📍 Your Responder Location</div>
            <div style="font-size: 11px; color: #475569; margin-top: 2px;">${selectedDonorProfile.name}</div>
          </div>
        `)
      )
      .addTo(mapInstance.current);

    // 2. Incident Request Pins
    const currentIds = new Set();
    const colorMap = {
      rescue: '#991B1B',
      blood: '#DC2626',
      oxygen: '#0891B2',
      medicine: '#2563EB',
      food: '#D97706',
      shelter: '#7C3AED',
      transport: '#0D9488',
    };

    requests.forEach((req) => {
      currentIds.add(req.id);
      const isBlood = req.category === 'blood';
      const reqBlood = req.service_details?.blood_group;
      const donorBlood = selectedDonorProfile.bloodGroup;
      const isCompatible = isBlood && donorBlood ? isDonorCompatible(donorBlood, reqBlood) : false;
      const color = colorMap[req.category] || '#DC2626';

      if (!markersRef.current[req.id]) {
        const markerEl = document.createElement('div');
        markerEl.className = 'maplibre-incident-pin';
        markerEl.style.width = isCompatible ? '36px' : '30px';
        markerEl.style.height = isCompatible ? '36px' : '30px';
        markerEl.style.borderRadius = '50%';
        markerEl.style.backgroundColor = color;
        markerEl.style.border = isCompatible ? '3.5px solid #FDE047' : '2.5px solid #FFFFFF';
        markerEl.style.boxShadow = '0 4px 12px rgba(15,23,42,0.4)';
        markerEl.style.display = 'flex';
        markerEl.style.alignItems = 'center';
        markerEl.style.justifyContent = 'center';
        markerEl.style.cursor = 'pointer';

        if (req.urgency === 'high' || isCompatible) {
          markerEl.style.animation = 'urgent-radar 1.6s infinite';
        }

        const dot = document.createElement('div');
        dot.style.width = '8px';
        dot.style.height = '8px';
        dot.style.backgroundColor = '#FFFFFF';
        dot.style.borderRadius = '50%';
        markerEl.appendChild(dot);

        markerEl.addEventListener('click', () => {
          setSelectedPinReq(req);
        });

        const popupContent = `
          <div style="font-family: sans-serif; padding: 6px; min-width: 200px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="font-size: 10px; font-weight: 900; text-transform: uppercase; background: #0F172A; color: #FFFFFF; padding: 2px 6px; border-radius: 4px;">
                ${req.category}
              </span>
              ${isCompatible ? `<span style="font-size: 10px; font-weight: 800; background: #DCFCE7; color: #15803D; padding: 2px 5px; border-radius: 4px;">✓ Compatible (${donorBlood} → ${reqBlood})</span>` : ''}
            </div>
            ${reqBlood ? `<div style="font-size: 11px; font-weight: 800; color: #DC2626; margin-bottom: 2px;">🩸 Needed: ${reqBlood} (${req.service_details?.units || 2} Units)</div>` : ''}
            <div style="font-size: 11px; font-weight: 600; color: #0F172A; line-height: 1.3;">${req.details || 'Emergency Assistance Request'}</div>
            <div style="font-size: 10px; color: #64748B; margin-top: 4px;">ID: ${req.id.substring(0, 8)}...</div>
          </div>
        `;

        const popup = new maplibregl.Popup({ offset: 25 }).setHTML(popupContent);

        const marker = new maplibregl.Marker({ element: markerEl })
          .setLngLat([req.lng, req.lat])
          .setPopup(popup)
          .addTo(mapInstance.current);

        markersRef.current[req.id] = marker;
      }
    });

    // Remove obsolete markers
    Object.keys(markersRef.current).forEach((id) => {
      if (!currentIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    // 3. Update Shortest Road Navigation Line if active match
    if (activeMatch && mapInstance.current) {
      fetchShortestRoute(
        selectedDonorProfile.lng,
        selectedDonorProfile.lat,
        activeMatch.lng,
        activeMatch.lat
      ).then((route) => {
        if (!mapInstance.current) return;

        const lineCoords = route.coordinates.length > 0
          ? route.coordinates
          : [
              [selectedDonorProfile.lng, selectedDonorProfile.lat],
              [activeMatch.lng, activeMatch.lat]
            ];

        const routeGeoJson = {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: lineCoords
          }
        };

        if (mapInstance.current.getSource('route-source')) {
          mapInstance.current.getSource('route-source').setData(routeGeoJson);
        } else {
          mapInstance.current.addSource('route-source', {
            type: 'geojson',
            data: routeGeoJson
          });

          // Outer glowing casing
          mapInstance.current.addLayer({
            id: 'route-casing',
            type: 'line',
            source: 'route-source',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': '#93C5FD',
              'line-width': 8,
              'line-opacity': 0.7
            }
          });

          // Inner primary navigation path
          mapInstance.current.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route-source',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': '#2563EB',
              'line-width': 4
            }
          });
        }

        // Fit bounds so both points and path are in full view
        const minLng = Math.min(selectedDonorProfile.lng, activeMatch.lng);
        const maxLng = Math.max(selectedDonorProfile.lng, activeMatch.lng);
        const minLat = Math.min(selectedDonorProfile.lat, activeMatch.lat);
        const maxLat = Math.max(selectedDonorProfile.lat, activeMatch.lat);

        mapInstance.current.fitBounds(
          [[minLng, minLat], [maxLng, maxLat]],
          { padding: 70, maxZoom: 15, duration: 800 }
        );
      });
    }
  }, [requests, selectedDonorProfile, viewMode, activeMatch]);


  const handleAccept = async (req) => {
    try {
      const helperPayload = {
        helper_id: selectedDonorProfile.id,
        helper_name: selectedDonorProfile.name,
        helper_phone: selectedDonorProfile.phone,
        helper_role: selectedDonorProfile.role,
        blood_group: selectedDonorProfile.bloodGroup,
        helper_lat: selectedDonorProfile.lat,
        helper_lng: selectedDonorProfile.lng,
      };

      const res = await api.simulateAccept(req.id, helperPayload);
      const matchedReq = res.request;
      setActiveMatch({
        id: res.match.id,
        requestId: req.id,
        helperName: res.match.helper_name,
        category: matchedReq.category,
        service_details: matchedReq.service_details,
        lat: matchedReq.lat,
        lng: matchedReq.lng,
        helperLat: res.match.helper_lat || selectedDonorProfile.lat,
        helperLng: res.match.helper_lng || selectedDonorProfile.lng,
        details: matchedReq.details,
      });

      // Fly map to match incident if map is open
      if (mapInstance.current) {
        mapInstance.current.flyTo({
          center: [matchedReq.lng, matchedReq.lat],
          zoom: 14.5,
          duration: 900
        });
      }

      fetchRequests();
    } catch (err) {
      console.error('Accept error:', err);
    }
  };

  const handleUpdateStatus = async (status) => {
    if (!activeMatch) return;
    try {
      await api.patchRequest(activeMatch.requestId, { status });
      fetchRequests();
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

  const flyToIncident = (req) => {
    setSelectedPinReq(req);
    if (viewMode !== 'map') {
      setViewMode('map');
    }
    setTimeout(() => {
      if (mapInstance.current) {
        mapInstance.current.flyTo({
          center: [req.lng, req.lat],
          zoom: 15,
          duration: 800
        });
      }
    }, 150);
  };

  return (
    <div className="max-w-6xl mx-auto py-2 sm:py-6">
      {/* Top Banner */}
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-[#1E293B] to-[#0F172A] text-white mb-5 shadow-lg border border-slate-700/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start space-x-3.5">
          <div className="p-3 rounded-2xl bg-[#2563EB] text-white flex-shrink-0 shadow-md">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-black text-white text-base sm:text-lg">
                Volunteer & Blood Donor Response Portal
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-[#22C55E]/20 text-[#4ADE80] text-[10px] font-mono font-bold uppercase tracking-wider border border-[#22C55E]/30">
                MapLibre GL JS Enabled
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 font-medium max-w-xl leading-relaxed">
              Real-time MapLibre vector radar & blood donor compatibility engine. Match with nearby emergency requests in Mumbai with 1-tap dispatch.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* View toggle */}
          <div className="flex rounded-xl bg-slate-800 border border-slate-700 p-1 text-xs font-bold">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'list' ? 'bg-[#2563EB] text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Priority Feed
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center space-x-1 ${
                viewMode === 'map' ? 'bg-[#2563EB] text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>MapLibre Map</span>
            </button>
          </div>

          <button
            onClick={fetchRequests}
            title="Refresh active requests"
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white transition shadow-sm cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* DONOR / VOLUNTEER IDENTITY SWITCHER BAR */}
      <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-white border border-[#CBD5E1] shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <Award className="w-4 h-4 text-[#2563EB]" />
            <span className="text-xs font-black uppercase tracking-wider text-[#0F172A]">
              Test As Active Donor / Responder Profile:
            </span>
          </div>
          <span className="text-[11px] text-[#64748B] font-mono">
            Active: <strong className="text-[#0F172A]">{selectedDonorProfile.name}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {DONOR_PROFILES.map((profile) => {
            const isSelected = selectedDonorProfile.id === profile.id;
            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => {
                  setSelectedDonorProfile(profile);
                  if (mapInstance.current) {
                    mapInstance.current.flyTo({
                      center: [profile.lng, profile.lat],
                      zoom: 13.5,
                      duration: 800
                    });
                  }
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'bg-[#EFF6FF] border-[#2563EB] ring-2 ring-[#2563EB]/20 shadow-xs'
                    : 'bg-[#F8FAFC] border-[#CBD5E1] hover:bg-white text-[#475569]'
                }`}
              >
                <div>
                  <div className="font-extrabold text-xs text-[#0F172A] flex items-center space-x-1.5">
                    <span>{profile.label}</span>
                  </div>
                  <div className="text-[10px] text-[#64748B] mt-0.5 truncate max-w-[200px]">
                    {profile.name.split('(')[0]} &bull; {profile.phone}
                  </div>
                </div>
                {isSelected && <Check className="w-4 h-4 text-[#2563EB] flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* MAIN CONTENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left 7 Cols: MapLibre GL JS Vector Map or Priority Feed */}
        <div className="lg:col-span-7 space-y-4">
          {viewMode === 'map' ? (
            <div className="bg-white border border-[#CBD5E1] rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Navigation className="w-4 h-4 text-[#2563EB]" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-[#0F172A]">
                    MapLibre GL JS Responder Radar
                  </h4>
                </div>
                <span className="text-[11px] font-mono text-[#64748B]">
                  {requests.filter(r => r.status === 'requested').length} active pins in Mumbai
                </span>
              </div>

              {/* MapLibre Map Container */}
              <div className="w-full h-[480px] rounded-xl overflow-hidden border border-[#CBD5E1] relative shadow-inner">
                <div
                  ref={mapContainer}
                  className="w-full h-full"
                  style={{ width: '100%', height: '100%' }}
                />

                {/* Map Legend Overlay */}
                <div className="absolute bottom-3 left-3 right-3 p-2.5 rounded-xl bg-white/95 backdrop-blur-md border border-[#CBD5E1] shadow-md flex flex-wrap items-center justify-between gap-2 text-[11px] z-10">
                  <div className="flex items-center space-x-2.5 font-bold text-[#0F172A]">
                    <span className="flex items-center space-x-1">
                      <span className="w-3 h-3 rounded-full bg-[#2563EB] inline-block border border-white shadow-xs" />
                      <span>Your Location</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <span className="w-3 h-3 rounded-full bg-[#DC2626] inline-block border-2 border-[#FDE047] shadow-xs" />
                      <span className="text-red-700">Compatible Blood</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <span className="w-3 h-3 rounded-full bg-[#0F172A] inline-block border border-white shadow-xs" />
                      <span>Aid Needs</span>
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">MapLibre GL Engine</span>
                </div>
              </div>

              {/* Selected Incident Drawer on Map */}
              {selectedPinReq && (
                <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] flex items-center justify-between gap-3 animate-in fade-in duration-150">
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-[#0F172A] text-white">
                        {selectedPinReq.category}
                      </span>
                      {selectedPinReq.service_details?.blood_group && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-red-600 text-white font-mono">
                          🩸 {selectedPinReq.service_details.blood_group} ({selectedPinReq.service_details?.units || 2} Units)
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-bold text-[#0F172A] line-clamp-1">{selectedPinReq.details || 'Emergency Assistance'}</p>
                  </div>

                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <button
                      onClick={() => handleAccept(selectedPinReq)}
                      disabled={selectedPinReq.status !== 'requested'}
                      className="px-3 py-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-extrabold shadow-sm transition disabled:opacity-40 cursor-pointer"
                    >
                      {selectedPinReq.status === 'requested' ? 'Accept (1-Tap)' : 'Matched'}
                    </button>
                    <button
                      onClick={() => setSelectedPinReq(null)}
                      className="text-xs text-[#64748B] hover:text-[#0F172A] font-bold p-1"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-[#CBD5E1] p-5 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-[#0F172A]">
                  Active Emergency & Relief Feed
                </h4>
                <span className="text-xs text-[#64748B] font-mono">
                  {requests.length} total signals
                </span>
              </div>

              <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
                {requests.map((r) => {
                  const isBlood = r.category === 'blood';
                  const reqBlood = r.service_details?.blood_group;
                  const donorBlood = selectedDonorProfile.bloodGroup;
                  const isCompatible = isBlood && donorBlood ? isDonorCompatible(donorBlood, reqBlood) : false;
                  const isMatched = r.status === 'matched' || r.status === 'on_the_way' || r.status === 'arrived';
                  const isResolved = r.status === 'resolved' || r.status === 'completed';

                  return (
                    <div
                      key={r.id}
                      className={`p-4 rounded-2xl border transition-all text-xs ${
                        isCompatible
                          ? 'bg-[#FFF1F2] border-[#FDA4AF] ring-2 ring-red-400/20 shadow-sm'
                          : 'bg-[#F8FAFC] border-[#CBD5E1]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                            <span className="font-black uppercase text-[#991B1B] bg-red-100 px-2 py-0.5 rounded-md text-[10px]">
                              {r.category}
                            </span>

                            {isBlood && reqBlood && (
                              <span className="px-2 py-0.5 rounded-md bg-red-600 text-white font-mono font-bold text-[10px] flex items-center space-x-1">
                                <HeartHandshake className="w-3 h-3" />
                                <span>Needed: {reqBlood} ({r.service_details?.units || 2} Units)</span>
                              </span>
                            )}

                            {isBlood && donorBlood && (
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold flex items-center space-x-1 ${
                                isCompatible ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#F1F5F9] text-[#64748B]'
                              }`}>
                                <span>{isCompatible ? `✅ Compatible (${donorBlood} → ${reqBlood})` : `⚠️ Incompatible with your ${donorBlood}`}</span>
                              </span>
                            )}

                            <span className="text-[#64748B] font-mono text-[10px]">
                              Status: <strong className="capitalize">{r.status}</strong>
                            </span>
                          </div>

                          <h5 className="font-bold text-[#0F172A] text-sm leading-snug">
                            {r.details || '1-Tap Emergency Assistance Beacon'}
                          </h5>

                          {/* Specifics snippet */}
                          {r.service_details && (
                            <div className="mt-1.5 text-[11px] text-[#475569] space-y-0.5">
                              {r.service_details.hospital_name && (
                                <p><strong>Hospital:</strong> {r.service_details.hospital_name}</p>
                              )}
                              {r.service_details.oxygen_type && (
                                <p><strong>Oxygen:</strong> {r.service_details.oxygen_type} ({r.service_details.flow_rate})</p>
                              )}
                              {r.service_details.medicine_names && (
                                <p><strong>Medication:</strong> {r.service_details.medicine_names}</p>
                              )}
                              {r.service_details.persons_count && (
                                <p><strong>Count:</strong> {r.service_details.persons_count} persons</p>
                              )}
                            </div>
                          )}

                          <div className="flex items-center space-x-3 text-[10px] text-[#64748B] mt-2 font-mono">
                            <span className="flex items-center space-x-1">
                              <MapPin className="w-3 h-3 text-[#DC2626]" />
                              <span>{r.lat.toFixed(4)}, {r.lng.toFixed(4)}</span>
                            </span>
                            <button
                              onClick={() => flyToIncident(r)}
                              className="text-blue-600 font-bold hover:underline cursor-pointer"
                            >
                              View on MapLibre &rarr;
                            </button>
                          </div>
                        </div>

                        {/* Accept Button */}
                        <div className="flex flex-col items-end flex-shrink-0">
                          <button
                            onClick={() => handleAccept(r)}
                            disabled={isMatched || isResolved}
                            className={`px-3.5 py-2 rounded-xl font-black text-xs transition cursor-pointer shadow-sm flex items-center space-x-1.5 ${
                              isResolved
                                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                : isMatched
                                ? 'bg-emerald-100 text-emerald-800 cursor-default'
                                : isCompatible
                                ? 'bg-[#DC2626] hover:bg-[#B91C1C] text-white shadow-red-500/20'
                                : 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-blue-500/20'
                            }`}
                          >
                            {isResolved ? (
                              <span>Resolved</span>
                            ) : isMatched ? (
                              <span>Matched</span>
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>{isCompatible ? 'Donate Blood' : 'Accept Request'}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right 5 Cols: Active Mission Controls & Live Chat */}
        <div className="lg:col-span-5 bg-white border border-[#CBD5E1] p-5 rounded-2xl shadow-sm flex flex-col justify-between min-h-[560px]">
          <div>
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3 mb-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#0F172A] flex items-center space-x-1.5">
                <Truck className="w-4 h-4 text-[#2563EB]" />
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
              <div className="mb-4 space-y-3">
                <div className="p-3.5 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-black uppercase text-[#1E40AF]">{activeMatch.category} AID</span>
                    <span className="text-[11px] font-mono font-bold text-[#2563EB]">ETA: ~5 mins</span>
                  </div>
                  <p className="text-[#0F172A] font-semibold leading-snug">{activeMatch.details || 'Emergency Aid in Progress'}</p>
                  
                  {activeMatch.service_details?.blood_group && (
                    <div className="text-[11px] font-bold text-red-700">
                      🩸 Recipient Blood: {activeMatch.service_details.blood_group} ({activeMatch.service_details.units || 2} Units)
                    </div>
                  )}
                </div>

                <label className="text-xs text-[#475569] font-bold block">
                  Advance Delivery Progression:
                </label>
                <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                  <button
                    onClick={() => handleUpdateStatus('on_the_way')}
                    className="py-2.5 px-2 rounded-xl bg-[#E0F2FE] hover:bg-[#BAE6FD] text-[#0284C7] border border-[#BAE6FD] transition cursor-pointer text-center"
                  >
                    🚗 On Way
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('arrived')}
                    className="py-2.5 px-2 rounded-xl bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#B45309] border border-[#FDE68A] transition cursor-pointer text-center"
                  >
                    🏥 Arrived
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('resolved')}
                    className="py-2.5 px-2 rounded-xl bg-[#DCFCE7] hover:bg-[#BBF7D0] text-[#15803D] border border-[#BBF7D0] transition cursor-pointer text-center"
                  >
                    ✅ Delivered
                  </button>
                </div>
              </div>
            )}

            {/* In-app Chat with Requester */}
            <div className="h-48 bg-[#F8FAFC] rounded-xl p-3 border border-[#CBD5E1] overflow-y-auto space-y-2">
              {!activeMatch ? (
                <div className="h-full flex items-center justify-center text-[#94A3B8] text-xs font-medium text-center p-4">
                  Accept a request from the feed or map to initiate live responder dispatch & direct citizen chat
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
                        isVol ? 'bg-[#2563EB] text-white' : 'bg-white text-[#0F172A] border border-[#CBD5E1] shadow-sm'
                      }`}>
                        {m.body}
                      </div>
                      <span className="text-[10px] text-[#64748B] mt-0.5">
                        {isVol ? 'You (Responder)' : 'Requester'}
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
                placeholder="Message requester directly..."
                className="flex-1 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2 text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
              />
              <button
                type="submit"
                className="p-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-sm cursor-pointer"
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

