import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  MapPin, 
  LocateFixed, 
  CheckCircle2, 
  AlertTriangle, 
  Send, 
  Flame,
  Droplets,
  Building,
  ZapOff
} from 'lucide-react';
import { getDeviceId } from '../../utils/device';
import { api } from '../../services/api';

const HAZARD_CATEGORIES = [
  { id: 'flood', label: 'Rising Floodwaters', icon: Droplets, color: '#0284C7', bg: '#E0F2FE', border: '#BAE6FD', desc: 'Road submerged or fast water surge' },
  { id: 'fire', label: 'Fire / Gas Hazard', icon: Flame, color: '#DC2626', bg: '#FEE2E2', border: '#FECACA', desc: 'Active structural fire or gas leak' },
  { id: 'collapse', label: 'Building Collapse', icon: Building, color: '#D97706', bg: '#FEF3C7', border: '#FDE68A', desc: 'Structural rubble or trapped occupants' },
  { id: 'power', label: 'Grid / Line Down', icon: ZapOff, color: '#7C3AED', bg: '#EDE9FE', border: '#DDD6FE', desc: 'High voltage wire down or substation blackout' },
  { id: 'rescue', label: 'Crowd Trapped', icon: AlertTriangle, color: '#991B1B', bg: '#FFE4E6', border: '#FECDD3', desc: 'Multiple people isolated without safe exit' },
];

export default function ZoneReportScreen({ onReportSubmitted }) {
  const [selectedCategory, setSelectedCategory] = useState(HAZARD_CATEGORIES[0].id);
  const [coords, setCoords] = useState({ lat: 19.0728, lng: 72.8785 }); // Kurla, Mumbai
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
    <div className="max-w-2xl mx-auto py-2 sm:py-6 px-2">
      {/* Title */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-[#FEF3C7] border border-[#FDE68A] text-[#B45309] text-xs font-bold mb-2">
          <Radio className="w-3.5 h-3.5 animate-pulse text-[#D97706]" />
          <span>Crowdsourced Hazard Detection (No Login Required)</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight">
          Report A Disaster Hazard Area
        </h1>
        <p className="text-xs sm:text-sm text-[#475569] mt-1.5 max-w-md mx-auto font-medium">
          Help map danger perimeters. When 3 or more citizens report the same hazard cluster, a confirmed crisis zone is automatically declared.
        </p>
      </div>

      {/* Success Notification */}
      {successResult && (
        <div className="mb-6 p-5 rounded-2xl bg-[#DCFCE7] border border-[#BBF7D0] flex items-start space-x-3.5 text-xs shadow-sm">
          <CheckCircle2 className="w-6 h-6 flex-shrink-0 text-[#16A34A]" />
          <div>
            <h4 className="font-extrabold text-[#15803D] text-sm">Zone Report Recorded!</h4>
            <p className="mt-0.5 text-[#166534] font-medium">
              Your sighting was filed to the central registry.
            </p>
            {successResult.confirmed_zone && (
              <div className="mt-2.5 p-3 rounded-xl bg-[#FEE2E2] border border-[#FECACA] text-[#991B1B] font-bold">
                🚨 Threshold Reached: A new confirmed crisis perimeter was officially declared for this coordinate!
              </div>
            )}
          </div>
        </div>
      )}

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white border border-[#E2E8F0] p-6 sm:p-7 rounded-2xl shadow-sm space-y-6">
        {/* Category Picker */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-3">
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
                  style={{
                    backgroundColor: isSelected ? cat.bg : '#F8FAFC',
                    borderColor: isSelected ? cat.color : '#E2E8F0',
                  }}
                  className={`p-4 rounded-xl border-2 text-left transition flex items-start space-x-3.5 shadow-sm ${
                    isSelected ? 'ring-2 ring-offset-1' : 'hover:border-[#CBD5E1]'
                  }`}
                >
                  <div 
                    style={{ backgroundColor: isSelected ? cat.color : '#FFFFFF', color: isSelected ? 'white' : cat.color }}
                    className="p-2.5 rounded-xl shadow-sm flex-shrink-0 border border-black/5"
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-extrabold text-[#0F172A]">{cat.label}</div>
                    <div className="text-xs text-[#64748B] font-medium mt-0.5">{cat.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Location Coordinates */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
              Hazard Coordinates / Pin
            </label>
            <span className="text-xs text-[#64748B] font-mono">
              GPS: {gpsStatus}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="block text-xs font-semibold text-[#64748B] mb-1">Latitude</span>
                <input
                  type="number"
                  step="0.0001"
                  value={coords.lat}
                  onChange={(e) => setCoords({ ...coords, lat: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-white border border-[#CBD5E1] rounded-xl px-3 py-2 text-xs text-[#0F172A] font-mono focus:border-[#2563EB] focus:outline-none"
                />
              </div>
              <div>
                <span className="block text-xs font-semibold text-[#64748B] mb-1">Longitude</span>
                <input
                  type="number"
                  step="0.0001"
                  value={coords.lng}
                  onChange={(e) => setCoords({ ...coords, lng: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-white border border-[#CBD5E1] rounded-xl px-3 py-2 text-xs text-[#0F172A] font-mono focus:border-[#2563EB] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 text-xs text-[#64748B]">
              <span className="flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-[#DC2626]" />
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
                className="text-[#2563EB] font-bold hover:underline flex items-center space-x-1"
              >
                <LocateFixed className="w-3.5 h-3.5" />
                <span>Recalibrate GPS</span>
              </button>
            </div>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3.5 px-4 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white font-extrabold text-sm shadow-md transition flex items-center justify-center space-x-2"
        >
          <Send className="w-4 h-4 text-red-400" />
          <span>{submitting ? 'Submitting Hazard Report...' : 'Broadcast Public Hazard Pin'}</span>
        </button>
      </form>
    </div>
  );
}
