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
      lat: coords.lat,
      lng: coords.lng,
      requester_device_id: deviceId,
      details: '🚨 MASTER EMERGENCY SOS TRIGGERED: Immediate rescue & multi-service emergency assistance required.',
    };

    try {
      let created;
      try {
        const sosRes = await api.createSos(payload);
        created = { __sos: true, ...(sosRes.request || {}), incident: sosRes.incident };
      } catch {
        created = await api.createRequest({ ...payload, urgency: 'high', is_critical: true });
      }
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
    setSubmittingType('RESCUE_1TAP');
    setSelectedCategory('rescue');
    setErrorMessage(null);

    const deviceId = getDeviceId();
    const payload = {
      category: 'rescue',
      lat: coords.lat,
      lng: coords.lng,
      requester_device_id: deviceId,
      details: 'Critical 1-Tap Rescue Request (Direct GPS Dispatch)',
    };

    try {
      let created;
      try {
        const sosRes = await api.createSos(payload);
        created = { __sos: true, ...(sosRes.request || {}), incident: sosRes.incident };
      } catch {
        created = await api.createRequest({ ...payload, urgency: 'high', is_critical: true });
      }
      setIsSubmitting(false);
      onRequestCreated(created);
    } catch (err) {
      console.error('Rescue SOS failed:', err);
      setErrorMessage(err.message || 'Failed to dispatch 1-Tap SOS.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-2 sm:py-5">
      
      {/* =========================================================================
          1. THE MOST IMPORTANT MASTER EMERGENCY SOS BUTTON (CENTRAL & PROMINENT)
         ========================================================================= */}
      <div className="mb-5 sm:mb-6">
        <button
          disabled={isSubmitting}
          onClick={handleMasterEmergencySOS}
          className="w-full relative overflow-hidden group rounded-2xl sm:rounded-3xl p-5 sm:p-8 bg-gradient-to-br from-[#DC2626] via-[#B91C1C] to-[#7F1D1D] text-white glow-danger card-tactile border-2 sm:border-4 border-white/25 text-left cursor-pointer transition-all duration-200"
        >
          {/* Animated Background Radar Waves */}
          <div className="absolute -right-12 -bottom-12 w-72 h-72 rounded-full bg-white/10 blur-2xl group-hover:scale-150 transition duration-700 pointer-events-none" />
          <div className="absolute right-6 top-1/2 -translate-y-1/2 hidden md:flex items-center justify-center pointer-events-none">
            <div className="w-24 lg:w-28 h-24 lg:h-28 rounded-full bg-white/10 border-2 border-white/30 flex items-center justify-center beacon-radar-pulse">
              <ShieldAlert className="w-12 lg:w-14 h-12 lg:h-14 text-white drop-shadow-md" />
            </div>
          </div>

          <div className="relative z-10 max-w-xl">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-white text-[#DC2626] font-black text-[11px] sm:text-xs uppercase tracking-widest flex items-center space-x-1.5 shadow-md">
                <span className="w-2 h-2 rounded-full bg-[#DC2626] animate-ping" />
                <span>Life-Critical Priority</span>
              </span>
              <span className="text-[11px] sm:text-xs font-mono text-red-100 font-extrabold bg-black/25 px-2.5 py-0.5 rounded-full border border-white/20 inline-flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-300" />
                <span>Zero Login &bull; 1-Tap Trigger</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-none text-white drop-shadow-md mt-1">
              EMERGENCY SOS
            </h1>

            <p className="text-xs sm:text-sm text-red-100 font-semibold mt-2 leading-relaxed max-w-md">
              Instant life-saving rescue broadcast. Sends your live GPS coordinates directly to nearby volunteer responders and Darpan-verified NGO dispatch units.
            </p>

            <div className="mt-4 sm:mt-5 flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3">
              <div className="w-full sm:w-auto inline-flex items-center justify-center space-x-2.5 bg-white text-[#B91C1C] px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl font-black text-xs uppercase tracking-wider group-hover:bg-red-50 group-hover:shadow-lg transition shadow-md">
                <Radio className="w-4 h-4 text-[#DC2626] animate-pulse" />
                <span>Broadcast Distress Beacon Now &rarr;</span>
              </div>
              <span className="text-[11px] text-red-200 font-medium text-center sm:text-left">
                Accidental? Cancel instantly on the next screen
              </span>
            </div>
          </div>
        </button>
      </div>

      {/* GPS Location Signal Bar */}
      <div className="mb-5 sm:mb-6 p-3.5 sm:p-4 rounded-2xl bg-white border border-[#CBD5E1] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-bold shadow-xs flex-shrink-0 ${
            gpsStatus === 'acquired' ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FEF3C7] text-[#B45309]'
          }`}>
            <LocateFixed className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="font-extrabold text-xs sm:text-sm text-[#0F172A] flex items-center space-x-1.5 truncate">
              <span className="truncate">{gpsStatus === 'acquired' ? 'Exact GPS Locked' : gpsStatus === 'detecting' ? 'Acquiring GPS...' : 'Mumbai Pin Active'}</span>
              {gpsStatus === 'acquired' && (
                <span className="w-2 h-2 rounded-full bg-[#15803D] inline-block animate-ping-slow flex-shrink-0" />
              )}
            </div>
            <div className="text-[11px] font-mono text-[#64748B] truncate">
              {Number(coords?.lat || 19.076).toFixed(4)}, {Number(coords?.lng || 72.8777).toFixed(4)} &bull; &plusmn;5m
            </div>
          </div>
        </div>

        {/* Quick Demo Preset Hotspots & Manual toggle */}
        <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
          <button
            onClick={() => {
              setCoords({ lat: 19.0178, lng: 72.8478 });
              setGpsStatus('manual');
            }}
            title="Calibrate to KEM Hospital Parel"
            className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] border border-[#CBD5E1] transition cursor-pointer"
          >
            🏥 KEM
          </button>
          <button
            onClick={() => {
              setCoords({ lat: 19.0688, lng: 72.8785 });
              setGpsStatus('manual');
            }}
            title="Calibrate to Kurla Bail Bazar"
            className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] border border-[#CBD5E1] transition cursor-pointer"
          >
            🌊 Kurla
          </button>
          <button
            onClick={() => setShowManualCoords(!showManualCoords)}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white transition flex items-center justify-center space-x-1 cursor-pointer"
          >
            <MapPin className="w-3 h-3 text-red-400" />
            <span>{showManualCoords ? 'Done' : 'Calibrate'}</span>
          </button>
        </div>
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
              className={`group relative text-left p-4 sm:p-5 rounded-2xl border-2 transition-all duration-150 shadow-sm hover:shadow-md card-tactile flex flex-col justify-between min-h-[140px] cursor-pointer ${
                isSelected ? 'ring-4 ring-[#DC2626]' : ''
              }`}
            >
              {/* Top Row: Icon and Badges */}
              <div className="flex items-start justify-between gap-2">
                <div 
                  style={{ backgroundColor: 'white', color: cat.iconColor }}
                  className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm border border-black/10 flex-shrink-0 group-hover:scale-105 transition"
                >
                  <Icon className="w-5 h-5" />
                </div>

                {cat.isLifeCritical ? (
                  <span className="px-2.5 py-1 rounded-full bg-[#DC2626] text-white text-[10px] font-black uppercase tracking-wider flex items-center space-x-1 shadow-sm beacon-radar-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    <span>Critical 1-Tap</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-white/90 text-[#334155] text-[10px] font-extrabold uppercase tracking-wider border border-black/5 shadow-2xs">
                    {cat.id === 'blood' ? '🩸 Matching Engine' : 'Direct Dispatch'}
                  </span>
                )}
              </div>

              {/* Bottom: Label & Description */}
              <div className="mt-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm sm:text-base font-extrabold text-[#0F172A] group-hover:text-[#B91C1C] transition flex items-center gap-1">
                    <span>{cat.label}</span>
                  </h3>
                  <ChevronRight className="w-4 h-4 text-[#475569] group-hover:translate-x-1.5 transition" />
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
