import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  MapPin, 
  LocateFixed, 
  CheckCircle2, 
  AlertTriangle, 
  Send, 
  ShieldAlert,
  Flame,
  Droplets,
  Building,
  ZapOff
} from 'lucide-react';
import { getDeviceId } from '../../utils/device';
import { api } from '../../services/api';

const HAZARD_CATEGORIES = [
  { id: 'flood', label: 'Rising Floodwaters', icon: Droplets, desc: 'Road submerged or fast water surge' },
  { id: 'fire', label: 'Fire / Gas Hazard', icon: Flame, desc: 'Active structural fire or gas leak' },
  { id: 'collapse', label: 'Building Collapse', icon: Building, desc: 'Structural rubble or trapped occupants' },
  { id: 'power', label: 'Grid / Line Down', icon: ZapOff, desc: 'High voltage wire down or substation blackout' },
  { id: 'rescue', label: 'Crowd Trapped', icon: AlertTriangle, desc: 'Multiple people isolated without exit' },
];

export default function ZoneReportScreen({ onReportSubmitted }) {
  const [selectedCategory, setSelectedCategory] = useState(HAZARD_CATEGORIES[0].id);
  const [coords, setCoords] = useState({ lat: 37.7780, lng: -122.4150 });
  const [gpsStatus, setGpsStatus] = useState('detecting');
  const [submitting, setSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus('denied');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsStatus('acquired');
      },
      () => setGpsStatus('denied'),
      { timeout: 5000 }
    );
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessResult(null);

    const deviceId = getDeviceId();
    const payload = {
      category: selectedCategory,
      lat: coords.lat,
      lng: coords.lng,
      device_id: deviceId,
    };

    try {
      const res = await api.submitZoneReport(payload);
      setSuccessResult(res);
      if (onReportSubmitted) onReportSubmitted(res);
    } catch (err) {
      console.error('Zone report submission failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      {/* Title */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-2">
          <Radio className="w-3.5 h-3.5 animate-pulse" />
          <span>Crowdsourced Hazard Detection (No Login Required)</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Report A Crisis Zone Hazard
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-md mx-auto">
          Help map danger zones. When 3 or more citizens report the same hazard in an area, a confirmed crisis perimeter is automatically broadcasted to rescue teams.
        </p>
      </div>

      {/* Success Notification */}
      {successResult && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-start space-x-3 text-emerald-300 text-xs">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400 mt-0.5" />
          <div>
            <h4 className="font-bold text-white text-sm">Zone Report Recorded!</h4>
            <p className="mt-0.5">
              Thank you for reporting. Your sighting was filed to the central registry.
            </p>
            {successResult.confirmed_zone && (
              <div className="mt-2 p-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 font-bold">
                🚨 Threshold Reached: A new confirmed crisis perimeter was officially declared for this coordinate!
              </div>
            )}
          </div>
        </div>
      )}

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="glass-panel p-6 rounded-2xl space-y-6">
        {/* Category Picker */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            Select Observed Hazard Type
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {HAZARD_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;

              return (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`p-3.5 rounded-xl border text-left transition flex items-start space-x-3 ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-500 text-white shadow-md'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${isSelected ? 'bg-amber-500 text-black' : 'bg-slate-800 text-slate-400'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-100">{cat.label}</div>
                    <div className="text-[11px] text-slate-500">{cat.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Location Pin Drop */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Hazard Coordinates / Pin
            </label>
            <span className="text-[11px] text-slate-500 font-mono">
              GPS: {gpsStatus}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="block text-[11px] text-slate-500 mb-1">Latitude</span>
                <input
                  type="number"
                  step="0.0001"
                  value={coords.lat}
                  onChange={(e) => setCoords({ ...coords, lat: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                />
              </div>
              <div>
                <span className="block text-[11px] text-slate-500 mb-1">Longitude</span>
                <input
                  type="number"
                  step="0.0001"
                  value={coords.lng}
                  onChange={(e) => setCoords({ ...coords, lng: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
              <span className="flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-red-400" />
                <span>Pin dropped near reported zone</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition((pos) => {
                      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                    });
                  }
                }}
                className="text-amber-400 hover:underline flex items-center space-x-1"
              >
                <LocateFixed className="w-3 h-3" />
                <span>Recalibrate GPS</span>
              </button>
            </div>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-sm shadow-xl shadow-amber-600/20 transition flex items-center justify-center space-x-2"
        >
          <Send className="w-4 h-4" />
          <span>{submitting ? 'Submitting Hazard Report...' : 'Broadcast Public Hazard Pin'}</span>
        </button>
      </form>
    </div>
  );
}
