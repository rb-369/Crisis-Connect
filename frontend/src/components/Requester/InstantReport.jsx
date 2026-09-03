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
  ShieldAlert,
  Radio,
  Sparkles,
  Zap
} from 'lucide-react';
import { getDeviceId } from '../../utils/device';
import { api } from '../../services/api';
import NonCriticalRequestModal from './NonCriticalRequestModal';

const CATEGORIES = [
  {
    id: 'blood',
    label: 'Blood Aid / Plasma',
    icon: HeartHandshake,
    iconColor: '#DC2626',
    bgColor: '#FFE4E6',
    borderColor: '#FECDD3',
    defaultUrgency: 'high',
    desc: 'Urgent matching blood bags / plasma. Mandatory blood group matching.',
    isNonCritical: true,
  },
  {
    id: 'oxygen',
    label: 'Oxygen Cylinder',
    icon: Wind,
    iconColor: '#0891B2',
    bgColor: '#CFFAFE',
    borderColor: '#A5F3FC',
    defaultUrgency: 'high',
    desc: 'Medical emergency: cylinder (10L Jumbo/Portable) or concentrator supply',
    isNonCritical: true,
  },
  {
    id: 'medicine',
    label: 'Medicines & First Aid',
    icon: Pill,
    iconColor: '#2563EB',
    bgColor: '#DBEAFE',
    borderColor: '#BFDBFE',
    defaultUrgency: 'normal',
    desc: 'Critical insulin, inhalers, cardiac meds, or doctor prescription delivery',
    isNonCritical: true,
  },
  {
    id: 'food',
    label: 'Food & Drinking Water',
    icon: Utensils,
    iconColor: '#D97706',
    bgColor: '#FEF3C7',
    borderColor: '#FDE68A',
    defaultUrgency: 'normal',
    desc: 'Clean 20L water cans, infant formula, ready-to-eat ration packets',
    isNonCritical: true,
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
    isNonCritical: true,
  },
  {
    id: 'transport',
    label: 'Evac Transport',
    icon: Truck,
    iconColor: '#0D9488',
    bgColor: '#CCFBF1',
    borderColor: '#99F6E4',
    defaultUrgency: 'normal',
    desc: 'Ambulance transfer, wheelchair transit, high-clearance flood vehicle',
    isNonCritical: true,
  },
  {
    id: 'rescue',
    label: 'Rescue / Trapped',
    icon: LifeBuoy,
    iconColor: '#991B1B',
    bgColor: '#FEE2E2',
    borderColor: '#FECACA',
    defaultUrgency: 'high',
    desc: 'Life-critical hazard: trapped in floodwaters or collapsed structure',
    isLifeCritical: true,
  },
];

export default function InstantReport({ onRequestCreated }) {
  const [coords, setCoords] = useState({ lat: 19.0760, lng: 72.8777 }); // Mumbai, India
  const [gpsStatus, setGpsStatus] = useState('detecting'); // detecting, acquired, denied, manual
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingType, setSubmittingType] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showManualCoords, setShowManualCoords] = useState(false);

  // Non-Critical Interactive Modal State
  const [activeModalCategory, setActiveModalCategory] = useState(null);

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

  // MASTER EMERGENCY SOS BUTTON HANDLER (Highest Priority)
  const handleMasterEmergencySOS = async () => {
    setIsSubmitting(true);
    setSubmittingType('MASTER_SOS');
    setSelectedCategory('rescue');
    setErrorMessage(null);

    const deviceId = getDeviceId();
    const payload = {
      category: 'rescue',
      urgency: 'high',
      lat: coords.lat,
      lng: coords.lng,
      requester_device_id: deviceId,
      details: '🚨 MASTER EMERGENCY SOS TRIGGERED: Immediate rescue & multi-service emergency assistance required.',
      is_critical: true,
    };

    try {
      const created = await api.createRequest(payload);
      setIsSubmitting(false);
      onRequestCreated(created);
    } catch (err) {
      console.error('Master SOS creation failed:', err);
      setErrorMessage(err.message || 'Failed to dispatch Master SOS. Check backend connection.');
      setIsSubmitting(false);
    }
  };

  // Specific Category Click Handler
  const handleCategoryClick = (categoryObj) => {
    // If it's a non-critical relief request, open fast detail modal (Blood, Oxygen, Meds, etc.)
    if (categoryObj.id !== 'rescue') {
      setActiveModalCategory(categoryObj.id);
      return;
    }

    // Otherwise if it's life-critical Rescue, dispatch 1-tap SOS immediately
    handleCriticalRescueSubmit();
  };

  const handleCriticalRescueSubmit = async () => {
    setIsSubmitting(true);
    setSubmittingType('rescue');
    setSelectedCategory('rescue');
    setErrorMessage(null);

    const deviceId = getDeviceId();
    const payload = {
      category: 'rescue',
      urgency: 'high',
      lat: coords.lat,
      lng: coords.lng,
      requester_device_id: deviceId,
      details: '🚨 CRITICAL RESCUE DISPATCH: Trapped persons reported needing immediate water rescue.',
      is_critical: true,
    };

    try {
      const created = await api.createRequest(payload);
      setIsSubmitting(false);
      onRequestCreated(created);
    } catch (err) {
      console.error('Instant SOS creation failed:', err);
      setErrorMessage(err.message || 'Failed to dispatch SOS. Check backend connection.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-2 sm:py-5">
      
      {/* =========================================================================
          1. THE MOST IMPORTANT MASTER EMERGENCY SOS BUTTON (CENTRAL & PROMINENT)
         ========================================================================= */}
      <div className="mb-6">
        <button
          disabled={isSubmitting}
          onClick={handleMasterEmergencySOS}
          className="w-full relative overflow-hidden group rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-[#DC2626] via-[#B91C1C] to-[#991B1B] text-white shadow-2xl hover:shadow-red-600/40 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 border-4 border-white/20 text-left cursor-pointer"
        >
          {/* Animated Background Radar Waves */}
          <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-white/10 blur-2xl group-hover:scale-150 transition duration-500" />
          <div className="absolute right-8 top-1/2 -translate-y-1/2 hidden md:flex items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-white/10 border-2 border-white/30 flex items-center justify-center animate-ping-slow">
              <ShieldAlert className="w-12 h-12 text-white" />
            </div>
          </div>

          <div className="relative z-10 max-w-xl">
            <div className="flex items-center space-x-2.5 mb-2">
              <span className="px-3 py-1 rounded-full bg-white text-[#DC2626] font-black text-xs uppercase tracking-widest flex items-center space-x-1.5 shadow-md">
                <span className="w-2 h-2 rounded-full bg-[#DC2626] animate-ping" />
                <span>Life-Critical Priority</span>
              </span>
              <span className="text-xs font-mono text-red-100/90 font-bold hidden sm:inline">
                Zero Login &bull; 1-Tap Trigger
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-none text-white drop-shadow-sm">
              EMERGENCY SOS
            </h1>

            <p className="text-xs sm:text-sm text-red-100 font-semibold mt-2 leading-relaxed max-w-md">
              Tap for immediate rescue. Broadcasts your live GPS coordinates directly to all nearby emergency response teams and NGOs.
            </p>

            <div className="mt-4 inline-flex items-center space-x-2 bg-black/25 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20 text-xs font-black uppercase tracking-wider text-white group-hover:bg-white group-hover:text-[#DC2626] transition">
              <Radio className="w-4 h-4 animate-pulse" />
              <span>Broadcast Master Distress Beacon Now &rarr;</span>
            </div>
          </div>
        </button>
      </div>

      {/* GPS Location Signal Bar */}
      <div className="mb-6 p-4 rounded-2xl bg-white border border-[#CBD5E1] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
            gpsStatus === 'acquired' ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FEF3C7] text-[#B45309]'
          }`}>
            <LocateFixed className="w-5 h-5" />
          </div>
          <div>
            <div className="font-extrabold text-xs sm:text-sm text-[#0F172A] flex items-center space-x-1.5">
              <span>{gpsStatus === 'acquired' ? 'Exact GPS Location Locked' : gpsStatus === 'detecting' ? 'Acquiring GPS Signal...' : 'GPS Offline (Using Mumbai Coordinate Pin)'}</span>
              {gpsStatus === 'acquired' && (
                <span className="w-2 h-2 rounded-full bg-[#15803D] inline-block animate-ping-slow" />
              )}
            </div>
            <div className="text-xs font-mono text-[#64748B]">
              Coordinates: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)} (Mumbai)
            </div>
          </div>
        </div>

        {/* Fallback pin-drop toggle */}
        <button
          onClick={() => setShowManualCoords(!showManualCoords)}
          className="w-full sm:w-auto text-xs font-semibold px-3.5 py-2 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#475569] border border-[#CBD5E1] transition flex items-center justify-center space-x-1.5"
        >
          <MapPin className="w-4 h-4 text-[#DC2626]" />
          <span>{showManualCoords ? 'Hide Manual Calibration' : 'Adjust Coordinates Pin'}</span>
        </button>
      </div>

      {/* Manual Pin Adjuster (Fallback) */}
      {showManualCoords && (
        <div className="mb-6 p-5 rounded-2xl bg-white border border-[#CBD5E1] shadow-sm text-xs space-y-3">
          <div className="font-bold text-sm text-[#0F172A]">
            Manual Location Calibration (Mumbai Presets)
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
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => {
                setCoords({ lat: 19.0178, lng: 72.8478 });
                setGpsStatus('manual');
              }}
              className="px-3 py-1.5 rounded-lg bg-[#F1F5F9] text-[#0F172A] font-bold hover:bg-[#E2E8F0]"
            >
              Dadar TT Circle
            </button>
            <button
              onClick={() => {
                setCoords({ lat: 19.0688, lng: 72.8785 });
                setGpsStatus('manual');
              }}
              className="px-3 py-1.5 rounded-lg bg-[#F1F5F9] text-[#0F172A] font-bold hover:bg-[#E2E8F0]"
            >
              Kurla West
            </button>
            <button
              onClick={() => {
                setCoords({ lat: 19.0596, lng: 72.8295 });
                setGpsStatus('manual');
              }}
              className="px-3 py-1.5 rounded-lg bg-[#F1F5F9] text-[#0F172A] font-bold hover:bg-[#E2E8F0]"
            >
              Bandra West
            </button>
            <button
              onClick={() => {
                setCoords({ lat: 19.1136, lng: 72.8697 });
                setGpsStatus('manual');
              }}
              className="px-3 py-1.5 rounded-lg bg-[#F1F5F9] text-[#0F172A] font-bold hover:bg-[#E2E8F0]"
            >
              Andheri Subway
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

      {/* Specific Needs Header */}
      <div className="flex items-center justify-between mb-3.5">
        <div>
          <h2 className="text-sm sm:text-base font-extrabold text-[#0F172A] tracking-tight flex items-center space-x-2">
            <span>Or Select Specific Assistance Type</span>
          </h2>
          <p className="text-xs text-[#64748B] font-medium">
            1-tap dispatch for specific emergency resources. No account needed.
          </p>
        </div>
        <span className="text-[11px] font-mono text-[#64748B] font-bold">
          7 Core Categories
        </span>
      </div>

      {/* High-Affordance 7 Category Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isSelected = selectedCategory === cat.id;

          return (
            <button
              key={cat.id}
              disabled={isSubmitting}
              onClick={() => handleCategoryClick(cat)}
              style={{
                backgroundColor: cat.bgColor,
                borderColor: cat.borderColor,
              }}
              className={`group relative text-left p-4 sm:p-5 rounded-2xl border-2 transition-all duration-150 shadow-sm hover:shadow-md hover:scale-[1.01] active:scale-[0.99] flex flex-col justify-between min-h-[135px] cursor-pointer ${
                isSelected ? 'ring-4 ring-[#DC2626]' : ''
              }`}
            >
              {/* Top Row: Icon and Badges */}
              <div className="flex items-start justify-between gap-2">
                <div 
                  style={{ backgroundColor: 'white', color: cat.iconColor }}
                  className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm border border-black/5 flex-shrink-0"
                >
                  <Icon className="w-5 h-5" />
                </div>

                {cat.isLifeCritical ? (
                  <span className="px-2 py-0.5 rounded-full bg-[#DC2626] text-white text-[10px] font-extrabold uppercase tracking-wider flex items-center space-x-1 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    <span>Critical 1-Tap</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-white/80 text-[#475569] text-[10px] font-bold uppercase tracking-wider border border-black/5 shadow-2xs">
                    {cat.id === 'blood' ? '🩸 Mandatory Blood Type' : 'Non-Critical'}
                  </span>
                )}
              </div>

              {/* Bottom: Label & Description */}
              <div className="mt-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm sm:text-base font-extrabold text-[#0F172A] group-hover:text-[#991B1B] transition">
                    {cat.label}
                  </h3>
                  <ChevronRight className="w-4 h-4 text-[#475569] group-hover:translate-x-1 transition" />
                </div>
                <p className="text-[11px] text-[#475569] mt-0.5 leading-snug font-medium line-clamp-2">
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
          <span>Dispatching emergency distress beacon to volunteer radar...</span>
        </div>
      )}

      {/* Non-Critical Interactive Fast Form Modal */}
      {activeModalCategory && (
        <NonCriticalRequestModal
          category={activeModalCategory}
          coords={coords}
          onClose={() => setActiveModalCategory(null)}
          onRequestCreated={(created) => {
            setActiveModalCategory(null);
            onRequestCreated(created);
          }}
        />
      )}
    </div>
  );
}
