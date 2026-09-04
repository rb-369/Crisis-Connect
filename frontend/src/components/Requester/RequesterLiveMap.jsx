import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Navigation, Truck, MapPin, HeartHandshake, Sparkles, Clock } from 'lucide-react';
import { fetchShortestRoute } from '../../utils/routeUtils';

export default function RequesterLiveMap({ request, helperInfo }) {
  const mapContainer = useRef(null);
  const mapInstance = useRef(null);
  const requesterMarkerRef = useRef(null);
  const helperMarkerRef = useRef(null);

  const [routeData, setRouteData] = useState({
    distanceKm: '1.4',
    durationMin: 5,
  });

  const reqLat = parseFloat(request?.lat || 19.0178);
  const reqLng = parseFloat(request?.lng || 72.8478);

  // Helper location (from match_info or fallback nearby)
  const helperLat = parseFloat(helperInfo?.lat || request?.match_info?.helper_lat || (reqLat + 0.012));
  const helperLng = parseFloat(helperInfo?.lng || request?.match_info?.helper_lng || (reqLng - 0.009));
  const helperName = helperInfo?.name || request?.match_info?.helper_name || 'Assigned First Responder';
  const helperRole = helperInfo?.role || request?.match_info?.helper_role || 'Volunteer';
  const isBlood = request?.category === 'blood';
  const bloodGroup = request?.service_details?.blood_group;

  useEffect(() => {
    if (!mapContainer.current) return;
    if (mapInstance.current) return;

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
      center: [reqLng, reqLat],
      zoom: 13.5,
    });

    mapInstance.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    const updateRouteAndMarkers = async () => {
      if (!mapInstance.current) return;

      // 1. Add/Update Requester Marker
      if (requesterMarkerRef.current) requesterMarkerRef.current.remove();

      const isCompleted = request?.status === 'completed' || request?.status === 'resolved';
      const isHigh = request?.urgency === 'high' || request?.urgency === 'critical';

      const reqEl = document.createElement('div');
      reqEl.className = 'requester-dest-marker';
      reqEl.style.width = '38px';
      reqEl.style.height = '38px';
      reqEl.style.borderRadius = '50%';
      reqEl.style.backgroundColor = isCompleted ? '#16A34A' : '#DC2626';
      reqEl.style.border = '3.5px solid #FFFFFF';
      reqEl.style.boxShadow = isHigh 
        ? '0 0 16px rgba(220, 38, 38, 0.9)' 
        : isCompleted 
        ? '0 4px 14px rgba(22, 163, 74, 0.6)' 
        : '0 4px 14px rgba(220,38,38,0.6)';
      reqEl.style.display = 'flex';
      reqEl.style.alignItems = 'center';
      reqEl.style.justifyContent = 'center';

      if (isHigh) {
        reqEl.classList.add('pin-critical-sos');
      } else if (isCompleted) {
        reqEl.classList.add('pin-completed');
      } else {
        reqEl.classList.add('pin-urgent-radar');
      }

      const reqDot = document.createElement('div');
      reqDot.style.width = '10px';
      reqDot.style.height = '10px';
      reqDot.style.backgroundColor = '#FFFFFF';
      reqDot.style.borderRadius = '50%';
      reqEl.appendChild(reqDot);

      requesterMarkerRef.current = new maplibregl.Marker({ element: reqEl })
        .setLngLat([reqLng, reqLat])
        .setPopup(
          new maplibregl.Popup({ offset: 25 }).setHTML(`
            <div style="font-family: sans-serif; padding: 4px;">
              <div style="font-weight: 800; font-size: 12px; color: ${isCompleted ? '#15803D' : '#991B1B'};">
                ${isCompleted ? '✓ Emergency Resolved' : '🏥 Your Location / Destination'}
              </div>
              <div style="font-size: 11px; color: #475569; margin-top: 2px;">
                ${request?.service_details?.hospital_name || request?.details || 'Designated Aid Site'}
              </div>
            </div>
          `)
        )
        .addTo(mapInstance.current);

      // 2. Add/Update Helper Marker (if matched)
      if (helperMarkerRef.current) helperMarkerRef.current.remove();

      const helperEl = document.createElement('div');
      helperEl.className = 'helper-live-marker pin-volunteer';
      helperEl.style.width = '38px';
      helperEl.style.height = '38px';
      helperEl.style.borderRadius = '50%';
      helperEl.style.backgroundColor = '#2563EB';
      helperEl.style.border = '3.5px solid #FFFFFF';
      helperEl.style.boxShadow = '0 4px 16px rgba(37,99,235,0.7)';
      helperEl.style.display = 'flex';
      helperEl.style.alignItems = 'center';
      helperEl.style.justifyContent = 'center';

      const helperDot = document.createElement('div');
      helperDot.style.width = '12px';
      helperDot.style.height = '12px';
      helperDot.style.backgroundColor = '#FFFFFF';
      helperDot.style.borderRadius = '50%';
      helperEl.appendChild(helperDot);

      helperMarkerRef.current = new maplibregl.Marker({ element: helperEl })
        .setLngLat([helperLng, helperLat])
        .setPopup(
          new maplibregl.Popup({ offset: 25 }).setHTML(`
            <div style="font-family: sans-serif; padding: 4px;">
              <div style="font-weight: 800; font-size: 12px; color: #1E40AF;">🚗 ${helperName}</div>
              <div style="font-size: 11px; color: #15803D; font-weight: bold; margin-top: 2px;">
                ${isBlood ? '🩸 Donor en route with blood units' : 'En route to your location'}
              </div>
            </div>
          `)
        )
        .addTo(mapInstance.current);

      // 3. Fetch Road Navigation Shortest Route
      const route = await fetchShortestRoute(helperLng, helperLat, reqLng, reqLat);
      setRouteData({
        distanceKm: route.distanceKm,
        durationMin: route.durationMin,
      });

      const lineCoords = route.coordinates.length > 0
        ? route.coordinates
        : [
            [helperLng, helperLat],
            [reqLng, reqLat],
          ];

      const routeGeoJson = {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: lineCoords,
        },
      };

      // Add or update MapLibre line layers
      try {
        if (!mapInstance.current.isStyleLoaded()) return;

        if (mapInstance.current.getSource('live-route-source')) {
          mapInstance.current.getSource('live-route-source').setData(routeGeoJson);
        } else {
          mapInstance.current.addSource('live-route-source', {
            type: 'geojson',
            data: routeGeoJson,
          });
        }

        // Glowing outer casing
        if (!mapInstance.current.getLayer('live-route-casing') && mapInstance.current.getSource('live-route-source')) {
          mapInstance.current.addLayer({
            id: 'live-route-casing',
            type: 'line',
            source: 'live-route-source',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': '#93C5FD',
              'line-width': 8,
              'line-opacity': 0.7,
            },
          });
        }

        // Main primary path
        if (!mapInstance.current.getLayer('live-route-main') && mapInstance.current.getSource('live-route-source')) {
          mapInstance.current.addLayer({
            id: 'live-route-main',
            type: 'line',
            source: 'live-route-source',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': '#2563EB',
              'line-width': 4,
            },
          });
        }

        // 4. Auto-fit bounds to display both points nicely
        const minLng = Math.min(reqLng, helperLng);
        const maxLng = Math.max(reqLng, helperLng);
        const minLat = Math.min(reqLat, helperLat);
        const maxLat = Math.max(reqLat, helperLat);

        if (!isNaN(minLng) && !isNaN(maxLng) && !isNaN(minLat) && !isNaN(maxLat)) {
          mapInstance.current.fitBounds(
            [
              [minLng, minLat],
              [maxLng, maxLat],
            ],
            { padding: 70, maxZoom: 15, duration: 800 }
          );
        }
      } catch (err) {
        console.warn('RequesterLiveMap route rendering warning:', err);
      }
    };

    if (mapInstance.current.loaded()) {
      updateRouteAndMarkers();
    } else {
      mapInstance.current.on('load', updateRouteAndMarkers);
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [reqLat, reqLng, helperLat, helperLng]);

  return (
    <div className="bg-white border border-[#CBD5E1] rounded-2xl p-4 shadow-sm space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <Navigation className="w-4 h-4 text-[#2563EB]" />
          <h4 className="text-xs font-black uppercase tracking-wider text-[#0F172A]">
            Live Dispatch Tracking Map (MapLibre GL JS)
          </h4>
        </div>

        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-bold flex items-center space-x-1.5">
            <Truck className="w-3.5 h-3.5 text-blue-600" />
            <span>Distance: <strong>{routeData.distanceKm} km</strong></span>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold flex items-center space-x-1.5">
            <Clock className="w-3.5 h-3.5 text-emerald-600" />
            <span>ETA: <strong>~{routeData.durationMin} mins</strong></span>
          </span>
        </div>
      </div>

      {/* MapLibre Map Container */}
      <div className="w-full h-[360px] rounded-xl overflow-hidden border border-[#CBD5E1] relative shadow-inner">
        <div
          ref={mapContainer}
          className="w-full h-full"
          style={{ width: '100%', height: '100%' }}
        />

        {/* Floating Bottom Tracker Overlay */}
        <div className="absolute bottom-3 left-3 right-3 p-3 rounded-xl bg-white/95 backdrop-blur-md border border-[#CBD5E1] shadow-lg flex flex-wrap items-center justify-between gap-2 text-xs z-10">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB] text-white flex items-center justify-center font-bold shadow-xs">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <div className="font-extrabold text-[#0F172A] text-xs flex items-center space-x-1.5">
                <span>{helperName}</span>
                {isBlood && bloodGroup && (
                  <span className="px-1.5 py-0.2 rounded bg-red-100 text-red-700 text-[10px] font-mono font-black">
                    🩸 {bloodGroup} Donor Match
                  </span>
                )}
              </div>
              <div className="text-[10px] text-[#64748B] flex items-center space-x-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Shortest Road Navigation Route Active &bull; Live GPS Sync</span>
              </div>
            </div>
          </div>

          <div className="text-right font-mono text-[11px] text-slate-600">
            <span className="text-blue-600 font-bold">{routeData.distanceKm} km</span> &bull; <strong className="text-slate-900">~{routeData.durationMin} min ETA</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
