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
  ChevronRight,
  Flame,
  ShieldCheck
} from 'lucide-react';
import { getDeviceId } from '../../utils/device';
import { api } from '../../services/api';

const CATEGORIES = [
  {
    id: 'rescue',
    label: 'Rescue / Trapped',
    icon: LifeBuoy,
    iconColor: '#991B1B',
    bgColor: '#FEE2E2',
    borderColor: '#FECACA',
    defaultUrgency: 'high',
    desc: 'Life-critical hazard: trapped, floodwaters, collapsed structure',
    isLifeCritical: true,
  },
  {
    id: 'oxygen',
    label: 'Oxygen Tank',
    icon: Wind,
    iconColor: '#0891B2',
    bgColor: '#CFFAFE',
    borderColor: '#A5F3FC',
    defaultUrgency: 'high',
    desc: 'Medical emergency: power failure, patient needs cylinder/concentrator',
    isLifeCritical: true,
  },
  {
    id: 'blood',
    label: 'Blood Aid',
    icon: HeartHandshake,
    iconColor: '#DC2626',
    bgColor: '#FFE4E6',
    borderColor: '#FECDD3',
    defaultUrgency: 'normal',
    desc: 'Urgent plasma / matching blood bags for clinic or transfusion',
  },
  {
    id: 'medicine',
    label: 'Medicines & First Aid',
    icon: Pill,
    iconColor: '#2563EB',
    bgColor: '#DBEAFE',
    borderColor: '#BFDBFE',
    defaultUrgency: 'normal',
    desc: 'Critical insulin, asthma inhaler, bandages, prescription supply',
  },
  {
    id: 'food',
    label: 'Food & Drinking Water',
    icon: Utensils,
    iconColor: '#D97706',
    bgColor: '#FEF3C7',
    borderColor: '#FDE68A',
    defaultUrgency: 'normal',
    desc: 'Emergency clean drinking water, infant formula, or ready rations',
  },
  {
    id: 'shelter',
    label: 'Emergency Shelter',
    icon: Home,
    iconColor: '#7C3AED',
    bgColor: '#EDE9FE',
    borderColor: '#DDD6FE',
    defaultUrgency: 'normal',
    desc: 'Displaced residents needing safe dry roof, warm bedding, evacuation base',
  },
  {
    id: 'transport',
    label: 'Evac Transport',
    icon: Truck,
    iconColor: '#0D9488',
    bgColor: '#CCFBF1',
    borderColor: '#99F6E4',
    defaultUrgency: 'normal',
    desc: 'Ambulance transfer, high-clearance 4x4, rescue boat transit',
  },
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
    const isAutoHigh = categoryObj.defaultUrgency === 'high';
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
      onRequestCreated(created);
    } catch (err) {
      console.error('Submission failed:', err);
      setErrorMessage(err.message || 'Failed to send emergency request. Check server connection.');
      setIsSubmitting(false);
      setSelectedCategory(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-2 sm:py-6">
      {/* Header Banner - Zero Glare, High Contrast for Daylight */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#FEE2E2] border border-[#FECACA] text-[#991B1B] text-xs font-bold mb-2">
          <Flame className="w-3.5 h-3.5 animate-bounce text-[#DC2626]" />
          <span>Step 1: Rapid 1-Tap SOS Dispatch</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight">
          What emergency aid is needed?
        </h1>
        <p className="text-[#475569] text-sm sm:text-base mt-1.5 max-w-xl mx-auto font-medium">
          Tap your urgent need below. Responders receive your exact GPS location immediately without needing an account.
        </p>
      </div>

      {/* GPS Location Bar */}
      <div className="mb-6 p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-3.5 w-full sm:w-auto">
          <div className={`p-2.5 rounded-xl ${
            gpsStatus === 'acquired' ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FEF3C7] text-[#B45309]'
          }`}>
            <LocateFixed className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-sm text-[#0F172A] flex items-center space-x-2">
              <span>{gpsStatus === 'acquired' ? 'Exact GPS Location Acquired' : gpsStatus === 'detecting' ? 'Acquiring GPS Signal...' : 'GPS Offline (Using Coordinate Pin)'}</span>
              {gpsStatus === 'acquired' && (
                <span className="w-2 h-2 rounded-full bg-[#15803D] inline-block animate-ping-slow" />
              )}
            </div>
            <div className="text-xs font-mono text-[#64748B]">
              Lat: {coords.lat.toFixed(5)}, Lng: {coords.lng.toFixed(5)}
            </div>
          </div>
        </div>

        {/* Fallback pin-drop toggle */}
        <button
          onClick={() => setShowManualCoords(!showManualCoords)}
          className="w-full sm:w-auto text-xs font-semibold px-3.5 py-2 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#475569] border border-[#CBD5E1] transition flex items-center justify-center space-x-1.5"
        >
          <MapPin className="w-4 h-4 text-[#DC2626]" />
          <span>{showManualCoords ? 'Hide Manual Coordinates' : 'Adjust Pin / Coordinates'}</span>
        </button>
      </div>

      {/* Manual Pin Adjuster (Fallback) */}
      {showManualCoords && (
        <div className="mb-6 p-5 rounded-2xl bg-white border border-[#CBD5E1] shadow-sm text-xs space-y-3">
          <div className="font-bold text-sm text-[#0F172A]">
            Manual Location Calibration
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[#64748B] font-semibold mb-1">Latitude</label>
              <input
                type="number"
                step="0.0001"
                value={coords.lat}
                onChange={(e) => {
                  setCoords({ ...coords, lat: parseFloat(e.target.value) || 0 });
                  setGpsStatus('manual');
                }}
                className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3 py-2 text-[#0F172A] font-mono focus:border-[#2563EB] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[#64748B] font-semibold mb-1">Longitude</label>
              <input
                type="number"
                step="0.0001"
                value={coords.lng}
                onChange={(e) => {
                  setCoords({ ...coords, lng: parseFloat(e.target.value) || 0 });
                  setGpsStatus('manual');
                }}
                className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3 py-2 text-[#0F172A] font-mono focus:border-[#2563EB] focus:outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => {
                setCoords({ lat: 37.7749, lng: -122.4194 });
                setGpsStatus('manual');
              }}
              className="px-3 py-1 rounded-lg bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#475569] font-medium"
            >
              Preset: Central Zone
            </button>
            <button
              onClick={() => {
                setCoords({ lat: 37.7812, lng: -122.4180 });
                setGpsStatus('manual');
              }}
              className="px-3 py-1 rounded-lg bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#475569] font-medium"
            >
              Preset: Flood Cluster
            </button>
          </div>
        </div>
      )}

      {/* Error alert */}
      {errorMessage && (
        <div className="mb-6 p-4 rounded-2xl bg-[#FEE2E2] border border-[#FECACA] text-[#991B1B] text-xs font-semibold flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* High-Affordance 7 Category Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isSelected = selectedCategory === cat.id;

          return (
            <button
              key={cat.id}
              disabled={isSubmitting}
              onClick={() => handleInstantSubmit(cat)}
              style={{
                backgroundColor: cat.bgColor,
                borderColor: cat.borderColor,
              }}
              className={`group relative text-left p-4 sm:p-5 rounded-2xl border-2 transition-all duration-150 shadow-sm hover:shadow-md hover:scale-[1.01] active:scale-[0.99] flex flex-col justify-between min-h-[140px] ${
                isSelected ? 'ring-4 ring-[#DC2626]' : ''
              }`}
            >
              {/* Top Row: Icon and Life-Critical Badge */}
              <div className="flex items-start justify-between gap-2">
                <div 
                  style={{ backgroundColor: 'white', color: cat.iconColor }}
                  className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm border border-black/5 flex-shrink-0"
                >
                  <Icon className="w-6 h-6" />
                </div>

                {cat.isLifeCritical && (
                  <span className="px-2 py-0.5 rounded-full bg-[#DC2626] text-white text-[10px] font-extrabold uppercase tracking-wider flex items-center space-x-1 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    <span>Immediate Priority</span>
                  </span>
                )}
              </div>

              {/* Bottom: Label & Description */}
              <div className="mt-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base sm:text-lg font-extrabold text-[#0F172A] group-hover:text-[#991B1B] transition">
                    {cat.label}
                  </h3>
                  <ChevronRight className="w-5 h-5 text-[#475569] group-hover:translate-x-1 transition" />
                </div>
                <p className="text-xs text-[#475569] mt-1 leading-snug font-medium line-clamp-2">
                  {cat.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {isSubmitting && (
        <div className="mt-6 p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm text-center flex items-center justify-center space-x-3 text-sm font-bold text-[#0F172A]">
          <div className="w-5 h-5 border-3 border-[#DC2626] border-t-transparent rounded-full animate-spin" />
          <span>Dispatching emergency SOS to volunteer network...</span>
        </div>
      )}
    </div>
  );
}
