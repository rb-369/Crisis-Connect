import React, { useState, useEffect } from 'react';
import { 
  HeartHandshake, 
  Utensils, 
  Pill, 
  Wind, 
  Home, 
  Truck, 
  LifeBuoy, 
  MapPin, 
  LocateFixed, 
  AlertCircle, 
  CheckCircle2,
  ChevronRight,
  Flame
} from 'lucide-react';
import { getDeviceId } from '../../utils/device';
import { api } from '../../services/api';

const CATEGORIES = [
  { id: 'blood', label: 'Blood Aid', icon: HeartHandshake, color: 'from-rose-600 to-red-700', border: 'border-rose-500/40', defaultUrgency: 'normal', desc: 'Urgent plasma / blood bags' },
  { id: 'food', label: 'Food & Water', icon: Utensils, color: 'from-amber-600 to-orange-700', border: 'border-amber-500/40', defaultUrgency: 'normal', desc: 'Rations, drinking water' },
  { id: 'medicine', label: 'Medicines', icon: Pill, color: 'from-emerald-600 to-teal-700', border: 'border-emerald-500/40', defaultUrgency: 'normal', desc: 'Insulin, prescription, first aid' },
  { id: 'oxygen', label: 'Oxygen Tank', icon: Wind, color: 'from-cyan-600 to-blue-700', border: 'border-cyan-400', defaultUrgency: 'high', desc: 'CRITICAL: Cylinders & concentrators' },
  { id: 'shelter', label: 'Emergency Shelter', icon: Home, color: 'from-indigo-600 to-violet-700', border: 'border-indigo-500/40', defaultUrgency: 'normal', desc: 'Safe shelter, dry bedding' },
  { id: 'transport', label: 'Evac Transport', icon: Truck, color: 'from-sky-600 to-indigo-700', border: 'border-sky-500/40', defaultUrgency: 'normal', desc: 'Ambulance, 4x4, boat transfer' },
  { id: 'rescue', label: 'Active Rescue', icon: LifeBuoy, color: 'from-red-600 to-red-800', border: 'border-red-500', defaultUrgency: 'high', desc: 'CRITICAL: Trapped or life hazard' },
];

export default function InstantReport({ onRequestCreated }) {
  const [coords, setCoords] = useState({ lat: 37.7749, lng: -122.4194 });
  const [gpsStatus, setGpsStatus] = useState('detecting'); // detecting, acquired, denied, manual
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showManualCoords, setShowManualCoords] = useState(false);

  // Auto-capture GPS on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus('denied');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setGpsStatus('acquired');
      },
      (error) => {
        console.warn('Geolocation denied or error:', error.message);
        setGpsStatus('denied');
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  }, []);

  const handleInstantSubmit = async (categoryObj) => {
    setIsSubmitting(true);
    setSelectedCategory(categoryObj.id);
    setErrorMessage(null);

    const deviceId = getDeviceId();
    const isAutoHigh = categoryObj.id === 'oxygen' || categoryObj.id === 'rescue';
    const urgency = isAutoHigh ? 'high' : 'normal';

    const payload = {
      category: categoryObj.id,
      urgency: urgency,
      lat: coords.lat,
      lng: coords.lng,
      requester_device_id: deviceId,
    };

    try {
      const created = await api.createRequest(payload);
      // Callback to parent to transition to Step 2/3 (Enrichment / Live Status)
      onRequestCreated(created);
    } catch (err) {
      console.error('Submission failed:', err);
      setErrorMessage(err.message || 'Failed to send request. Check backend connection.');
      setIsSubmitting(false);
      setSelectedCategory(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-4 px-2 sm:px-4">
      {/* Banner / Step 1 Indicator */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold mb-2">
          <Flame className="w-3.5 h-3.5 animate-bounce" />
          <span>Step 1 of 2: Instant 1-Tap SOS</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
          What emergency aid is needed?
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-lg mx-auto">
          Tap your need below to dispatch responders immediately. No account or forms required.
        </p>
      </div>

      {/* GPS Status & Fallback Pin-Drop Bar */}
      <div className="mb-6 p-3 sm:p-4 rounded-xl glass-panel flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-3 text-xs sm:text-sm">
          <div className={`p-2 rounded-lg ${
            gpsStatus === 'acquired' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
          }`}>
            <LocateFixed className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-slate-200">
              {gpsStatus === 'acquired' && 'GPS Location Locked'}
              {gpsStatus === 'detecting' && 'Acquiring GPS Signal...'}
              {gpsStatus === 'denied' && 'GPS Unavailable (Using Coordinate Pin)'}
              {gpsStatus === 'manual' && 'Manual Pin Active'}
            </div>
            <div className="text-slate-400 font-mono text-[11px]">
              {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </div>
          </div>
        </div>

        {/* Fallback pin toggle */}
        <button
          onClick={() => setShowManualCoords(!showManualCoords)}
          className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
        >
          <MapPin className="w-3.5 h-3.5 inline mr-1 text-red-400" />
          {showManualCoords ? 'Hide Manual Pin' : 'Set Manual Pin / Coordinates'}
        </button>
      </div>

      {/* Manual Pin Coordinates Fallback Dropdown */}
      {showManualCoords && (
        <div className="mb-6 p-4 rounded-xl bg-slate-900/90 border border-slate-700 text-xs space-y-3">
          <p className="text-slate-300 font-medium">
            Fine-tune location if GPS is unavailable:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">Latitude</label>
              <input
                type="number"
                step="0.0001"
                value={coords.lat}
                onChange={(e) => {
                  setCoords({ ...coords, lat: parseFloat(e.target.value) || 0 });
                  setGpsStatus('manual');
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Longitude</label>
              <input
                type="number"
                step="0.0001"
                value={coords.lng}
                onChange={(e) => {
                  setCoords({ ...coords, lng: parseFloat(e.target.value) || 0 });
                  setGpsStatus('manual');
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setCoords({ lat: 37.7749, lng: -122.4194 });
                setGpsStatus('manual');
              }}
              className="px-2.5 py-1 rounded bg-slate-800 text-slate-400 hover:text-white"
            >
              Preset: Downtown Zone
            </button>
            <button
              onClick={() => {
                setCoords({ lat: 37.7812, lng: -122.4180 });
                setGpsStatus('manual');
              }}
              className="px-2.5 py-1 rounded bg-slate-800 text-slate-400 hover:text-white"
            >
              Preset: Flood Cluster
            </button>
          </div>
        </div>
      )}

      {/* Error display */}
      {errorMessage && (
        <div className="mb-6 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 7 Category Cards Grid (1-Tap Immediate Submit) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isHigh = cat.defaultUrgency === 'high';
          const isSelected = selectedCategory === cat.id;

          return (
            <button
              key={cat.id}
              disabled={isSubmitting}
              onClick={() => handleInstantSubmit(cat)}
              className={`group relative text-left p-4 sm:p-5 rounded-2xl transition-all duration-200 border ${
                isSelected
                  ? 'bg-red-950/80 border-red-500 shadow-xl shadow-red-500/30 scale-[0.98]'
                  : isHigh
                  ? `bg-gradient-to-br from-slate-900 to-slate-950 ${cat.border} hover:border-red-400 hover:scale-[1.02] shadow-lg shadow-red-950/20`
                  : `bg-slate-900/80 hover:bg-slate-850 ${cat.border} hover:border-slate-500 hover:scale-[1.01]`
              }`}
            >
              {/* High urgency pill */}
              {isHigh && (
                <div className="absolute top-3 right-3 flex items-center space-x-1 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-[10px] font-bold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                  <span>Auto High Urgency</span>
                </div>
              )}

              <div className="flex items-start space-x-3.5">
                <div className={`p-3 rounded-xl bg-gradient-to-tr ${cat.color} text-white shadow-md group-hover:shadow-lg transition`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-red-400 transition flex items-center justify-between">
                    <span>{cat.label}</span>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition group-hover:translate-x-1" />
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {cat.desc}
                  </p>
                  <div className="mt-3 flex items-center space-x-2 text-[11px] text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                    <span>1-Tap Immediate Dispatch</span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {isSubmitting && (
        <div className="mt-6 text-center text-slate-400 text-xs flex items-center justify-center space-x-2">
          <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
          <span>Broadcasting emergency request to volunteer grid...</span>
        </div>
      )}
    </div>
  );
}
