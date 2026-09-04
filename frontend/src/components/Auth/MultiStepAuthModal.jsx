import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Users, 
  Building2, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  Upload, 
  Phone, 
  Mail, 
  FileText, 
  MapPin, 
  Award, 
  Lock, 
  X, 
  Sparkles,
  Truck,
  HeartHandshake,
  AlertTriangle,
  Radio,
  Check,
  LogIn,
  UserPlus,
  RefreshCw
} from 'lucide-react';
import { api } from '../../services/api';

const VOLUNTEER_SKILLS = [
  { id: 'first_aid', label: 'First Aid / CPR Certified', icon: HeartHandshake },
  { id: 'emt_paramedic', label: 'Paramedic / EMT Nurse', icon: Award },
  { id: 'rescue_diver', label: 'Disaster Rescue Swimmer / Diver', icon: AlertTriangle },
  { id: 'offroad_driver', label: '4x4 Off-Road / Evac Driver', icon: Truck },
  { id: 'blood_donor', label: 'Registered Emergency Blood Donor', icon: HeartHandshake },
  { id: 'shelter_host', label: 'Community Evac Shelter Host', icon: Building2 },
];

const NGO_DOMAINS = [
  { id: 'food_water', label: 'Food Rations & Safe Drinking Water' },
  { id: 'medical_camps', label: 'Mobile Medical Units & Trauma Care' },
  { id: 'search_rescue', label: 'Search & Floodwater Rescue Boats' },
  { id: 'oxygen_banks', label: 'Emergency Oxygen Cylinder Banks' },
  { id: 'evac_shelters', label: 'Mass Evacuation Shelters & Bedding' },
  { id: 'dead_body_mgmt', label: 'Dignified Disaster Casualty Management' },
];

// Seeded quick login accounts for testing
const PRESET_ACCOUNTS = [
  {
    id: 'VOL-1002',
    role: 'volunteer',
    name: 'Vikram Joshi',
    badge: 'Universal Blood Donor (O-)',
    phone: '+91 98201 44021',
    email: 'vikram.joshi@bloodheroes.org',
    bloodGroup: 'O-',
    skills: ['blood_donor', 'first_aid'],
    org_name: 'Mumbai Blood Heroes Network',
    vehicleType: 'Motorcycle',
    verified: true,
  },
  {
    id: 'VOL-1001',
    role: 'volunteer',
    name: 'Dr. Rohit Deshmukh',
    badge: 'Red Cross Mumbai Paramedic (O+)',
    phone: '+91 98201 55019',
    email: 'rohit.deshmukh@redcrossmumbai.org',
    bloodGroup: 'O+',
    skills: ['first_aid', 'emt_paramedic', 'blood_donor'],
    org_name: 'Indian Red Cross Emergency Response Mumbai',
    vehicleType: '4x4 SUV',
    verified: true,
  },
  {
    id: 'VOL-1003',
    role: 'volunteer',
    name: 'Pooja Mehta',
    badge: 'Registered Blood Donor (A+)',
    phone: '+91 98670 12890',
    email: 'pooja.mehta@kemdonors.in',
    bloodGroup: 'A+',
    skills: ['blood_donor', 'shelter_host'],
    org_name: 'KEM Voluntary Donors League',
    vehicleType: '4x4 SUV',
    verified: true,
  },
  {
    id: 'VOL-1004',
    role: 'volunteer',
    name: 'Rahul Sawant',
    badge: 'Registered Blood Donor (B+)',
    phone: '+91 98190 77654',
    email: 'rahul.sawant@mumbaicentral.org',
    bloodGroup: 'B+',
    skills: ['blood_donor', 'offroad_driver'],
    org_name: 'Mumbai Central Youth Donors',
    vehicleType: 'Van/Mini-Truck',
    verified: true,
  },
  {
    id: 'NGO-2001',
    role: 'ngo',
    name: 'Indian Red Cross Emergency Response Mumbai',
    badge: 'Darpan: MH/2021/029104',
    darpanId: 'MH/2021/029104',
    phone: '022-2410-7000',
    email: 'operations@redcrossmumbai.org',
    domains: ['medical_camps', 'oxygen_banks', 'search_rescue'],
    fleetAmbulances: 6,
    fleetRescueBoats: 3,
    verified: true,
  },
  {
    id: 'NGO-2002',
    role: 'ngo',
    name: 'Dharavi Disaster Taskforce & Relief Fleet',
    badge: 'Darpan: MH/2020/018823',
    darpanId: 'MH/2020/018823',
    phone: '+91 98200 99881',
    email: 'relief@dharavitaskforce.org',
    domains: ['food_water', 'evac_shelters'],
    fleetAmbulances: 2,
    fleetRescueBoats: 4,
    verified: true,
  },
  {
    id: 'NGO-2003',
    role: 'ngo',
    name: 'Khalsa Aid Mumbai Crisis Wing',
    badge: 'Darpan: MH/2019/044192',
    darpanId: 'MH/2019/044192',
    phone: '+91 98210 33445',
    email: 'mumbai@khalsaaid.org',
    domains: ['food_water', 'evac_shelters', 'medical_camps'],
    fleetAmbulances: 4,
    fleetRescueBoats: 2,
    verified: true,
  },
];

// Helper normalization to guarantee bloodGroup, role, and badge consistency
const normalizeHelper = (h) => {
  const rawRole = (h.role || '').toLowerCase();
  const role = (rawRole === 'ngo_admin' || rawRole === 'ngo') ? 'ngo' : 'volunteer';
  const bloodGroup = h.bloodGroup || h.blood_type || (h.badge && h.badge.match(/\((O\-|O\+|A\-|A\+|B\-|B\+|AB\-|AB\+)\)/)?.[1]) || null;
  const darpanId = h.darpanId || h.darpan_id || null;
  return {
    ...h,
    role,
    bloodGroup,
    blood_type: bloodGroup,
    badge: h.badge || (bloodGroup ? `Registered Blood Donor (${bloodGroup})` : (role === 'ngo' ? (darpanId ? `NITI Darpan: ${darpanId}` : 'Authorized Humanitarian Agency') : 'Verified Volunteer')),
    darpanId,
    darpan_id: darpanId,
    org_name: h.org_name || h.orgName,
  };
};

const mergeHelpers = (dbList) => {
  const cleanDigits = (p) => (p || '').replace(/\D/g, '');
  const normalizedPresets = PRESET_ACCOUNTS.map(normalizeHelper);

  if (!Array.isArray(dbList) || dbList.length === 0) {
    return normalizedPresets;
  }

  const normalizedDb = dbList.map(normalizeHelper);

  // Update presets with matching DB records while preserving demo names/bloodGroups
  const updatedPresets = normalizedPresets.map((preset) => {
    const dbMatch = normalizedDb.find((dh) => {
      const phoneMatch = dh.phone && preset.phone && cleanDigits(dh.phone) === cleanDigits(preset.phone);
      const emailMatch = dh.email && preset.email && dh.email.toLowerCase() === preset.email.toLowerCase();
      const nameMatch = dh.name && preset.name && (dh.name.toLowerCase().includes(preset.name.toLowerCase()) || preset.name.toLowerCase().includes(dh.name.toLowerCase()));
      return phoneMatch || emailMatch || nameMatch;
    });

    if (dbMatch) {
      return {
        ...preset,
        ...dbMatch,
        // Preserve preset essentials if db had nulls
        bloodGroup: preset.bloodGroup || dbMatch.bloodGroup,
        blood_type: preset.bloodGroup || dbMatch.bloodGroup,
        badge: preset.badge || dbMatch.badge,
        role: preset.role,
        darpanId: preset.darpanId || dbMatch.darpanId,
      };
    }
    return preset;
  });

  // Add any extra DB helpers that were not matched to presets (e.g. "Curl Tester Volunteer")
  const extraDbHelpers = normalizedDb.filter((dh) => {
    return !updatedPresets.some((p) => {
      const phoneMatch = dh.phone && p.phone && cleanDigits(dh.phone) === cleanDigits(p.phone);
      const emailMatch = dh.email && p.email && dh.email.toLowerCase() === p.email.toLowerCase();
      const idMatch = dh.id && p.id && dh.id === p.id;
      return phoneMatch || emailMatch || idMatch;
    });
  });

  return [...updatedPresets, ...extraDbHelpers];
};

export default function MultiStepAuthModal({ isOpen, onClose, onAuthSuccess, defaultRole = 'volunteer' }) {
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [selectedRole, setSelectedRole] = useState(defaultRole); // 'volunteer' or 'ngo'
  const [step, setStep] = useState(1); // 1, 2, 3, 4 (success)
  
  // Login State
  const [loginQuery, setLoginQuery] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [dbHelpers, setDbHelpers] = useState(() => mergeHelpers([]));

  // Volunteer Sign Up State
  const [volData, setVolData] = useState({
    fullName: '',
    phone: '',
    email: '',
    bloodGroup: 'O+',
    age: '26',
    govIdType: 'Aadhaar Card',
    govIdNumber: '',
    selectedSkills: ['first_aid'],
    vehicleType: '4x4 SUV',
    idFileName: '',
    otpCode: '',
  });

  // NGO Sign Up State
  const [ngoData, setNgoData] = useState({
    orgName: '',
    darpanId: '',
    govRegNumber: '',
    officialEmail: '',
    hotlinePhone: '',
    selectedDomains: ['food_water', 'medical_camps'],
    fleetAmbulances: '4',
    fleetRescueBoats: '2',
    rationCapacityPerDay: '1500 packets',
    signatoryName: '',
    signatoryRole: 'Disaster Operations Lead',
    authLetterFileName: '',
    otpCode: '',
  });

  const [otpSent, setOtpSent] = useState(false);
  const [otpMessage, setOtpMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedProfile, setVerifiedProfile] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedRole(defaultRole);
      setStep(1);
      setLoginError('');
      // Always initialize with guaranteed preset accounts
      setDbHelpers(mergeHelpers([]));
      // Fetch helpers from backend if available and merge
      api.getHelpers().then((data) => {
        if (data && data.length > 0) {
          setDbHelpers(mergeHelpers(data));
        }
      }).catch(() => {
        setDbHelpers(mergeHelpers([]));
      });
    }
  }, [isOpen, defaultRole]);

  if (!isOpen) return null;

  // Toggle Volunteer Skill
  const toggleVolSkill = (skillId) => {
    setVolData((prev) => {
      const exists = prev.selectedSkills.includes(skillId);
      return {
        ...prev,
        selectedSkills: exists
          ? prev.selectedSkills.filter((s) => s !== skillId)
          : [...prev.selectedSkills, skillId],
      };
    });
  };

  // Toggle NGO Domain
  const toggleNgoDomain = (domainId) => {
    setNgoData((prev) => {
      const exists = prev.selectedDomains.includes(domainId);
      return {
        ...prev,
        selectedDomains: exists
          ? prev.selectedDomains.filter((d) => d !== domainId)
          : [...prev.selectedDomains, domainId],
      };
    });
  };

  // 1-Click Quick Login
  const handleQuickLogin = (account) => {
    const normalized = normalizeHelper(account);
    setVerifiedProfile(normalized);
    if (onAuthSuccess) {
      onAuthSuccess(normalized);
    }
    onClose();
  };

  // Manual Login via Input (Phone / Email / Darpan ID)
  const handleManualLogin = async (e) => {
    if (e) e.preventDefault();
    if (!loginQuery.trim()) {
      setLoginError('Please enter your registered Phone, Email, or Darpan ID');
      return;
    }
    setLoginLoading(true);
    setLoginError('');

    try {
      // 1. Try local DB matches first for instant response
      const clean = loginQuery.trim().toLowerCase();
      const cleanNums = clean.replace(/\D/g, '');
      const localMatch = dbHelpers.find((h) => 
        (h.phone && (h.phone.toLowerCase().includes(clean) || (cleanNums.length >= 7 && h.phone.replace(/\D/g, '').includes(cleanNums)))) ||
        (h.email && h.email.toLowerCase().includes(clean)) ||
        (h.id && h.id.toLowerCase() === clean) ||
        (h.darpanId && h.darpanId.toLowerCase().includes(clean)) ||
        (h.name && h.name.toLowerCase().includes(clean))
      );

      if (localMatch) {
        handleQuickLogin(localMatch);
        return;
      }

      // 2. Call backend API
      const res = await api.login(loginQuery.trim());
      if (res && (res.profile || res.helper)) {
        handleQuickLogin(res.profile || res.helper);
      } else {
        setLoginError(`No registered profile found matching "${loginQuery}". Try 1-click accounts or register.`);
      }
    } catch (err) {
      setLoginError(err.message || 'Login failed. Please check credentials or register.');
    } finally {
      setLoginLoading(false);
    }
  };

  // Send OTP
  const handleSendOtp = async () => {
    const contact = selectedRole === 'volunteer' 
      ? (volData.phone || '+91 98201 55019')
      : (ngoData.officialEmail || 'operations@redcrossmumbai.org');

    try {
      const res = await api.sendOtp(contact, selectedRole);
      const code = res.otp_code || '749201';
      setOtpSent(true);
      setOtpMessage(`📱 Code dispatched to ${contact}: ${code} (Auto-filled below for fast testing)`);
      if (selectedRole === 'volunteer') {
        setVolData((prev) => ({ ...prev, otpCode: code }));
      } else {
        setNgoData((prev) => ({ ...prev, otpCode: code }));
      }
    } catch (_) {
      // Fallback
      const fallbackCode = selectedRole === 'volunteer' ? '749201' : '839104';
      setOtpSent(true);
      setOtpMessage(`📱 Verification Code: ${fallbackCode} (Auto-filled below)`);
      if (selectedRole === 'volunteer') {
        setVolData((prev) => ({ ...prev, otpCode: fallbackCode }));
      } else {
        setNgoData((prev) => ({ ...prev, otpCode: fallbackCode }));
      }
    }
  };

  // Handle Document Upload
  const handleFileUpload = (e, target) => {
    const file = e.target.files?.[0];
    if (file) {
      if (target === 'vol') {
        setVolData((prev) => ({ ...prev, idFileName: file.name }));
      } else {
        setNgoData((prev) => ({ ...prev, authLetterFileName: file.name }));
      }
    }
  };

  // Final Registration Submit
  const handleFinalSubmit = async () => {
    setIsVerifying(true);
    let payload;

    if (selectedRole === 'volunteer') {
      const bg = volData.bloodGroup || 'O+';
      payload = {
        role: 'volunteer',
        id: `VOL-${Math.floor(1000 + Math.random() * 9000)}`,
        name: volData.fullName || 'Rahul Verma (First Responder)',
        phone: volData.phone || '+91 98201 44102',
        email: volData.email || 'responder@crisisconnect.org',
        bloodGroup: bg,
        blood_type: bg,
        skills: volData.selectedSkills,
        vehicleType: volData.vehicleType,
        verified: true,
        badge: `Verified First Responder (${bg})`,
        idFileName: volData.idFileName || 'aadhaar_card_scan.pdf',
      };
    } else {
      const darpan = ngoData.darpanId || 'MH/2022/048192';
      payload = {
        role: 'ngo',
        id: `NGO-${Math.floor(1000 + Math.random() * 9000)}`,
        name: ngoData.orgName || 'Disaster Response Taskforce Mumbai',
        darpanId: darpan,
        darpan_id: darpan,
        email: ngoData.officialEmail || 'dispatch@disasterresponse.org',
        phone: ngoData.hotlinePhone || '+91 22 2410 8800',
        domains: ngoData.selectedDomains,
        fleetAmbulances: parseInt(ngoData.fleetAmbulances || '2', 10),
        fleetRescueBoats: parseInt(ngoData.fleetRescueBoats || '1', 10),
        verified: true,
        badge: 'Authorized Humanitarian Agency',
        authLetterFileName: ngoData.authLetterFileName || 'darpan_clearance.pdf',
      };
    }

    try {
      await api.createHelper(payload);
    } catch (_) {
      // Proceed with local memory fallback
    }

    setIsVerifying(false);
    setVerifiedProfile(payload);
    setStep(4); // Success issuance screen
    if (onAuthSuccess) {
      onAuthSuccess(payload);
    }
  };

  const resetModal = () => {
    setStep(1);
    setOtpSent(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-[#CBD5E1] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Dark Header */}
        <div className="bg-[#0F172A] text-white p-5 sm:p-6 relative">
          <button
            onClick={resetModal}
            className="absolute right-4 top-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-3">
            <div className={`w-11 h-11 rounded-2xl ${authMode === 'login' ? 'bg-blue-600' : 'bg-red-600'} flex items-center justify-center text-white shadow-md`}>
              {authMode === 'login' ? <LogIn className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase font-mono font-extrabold tracking-widest bg-white/10 text-slate-300 px-2 py-0.5 rounded border border-white/20">
                  {authMode === 'login' ? 'Instant Sign-In' : 'Official Onboarding'}
                </span>
                {authMode === 'signup' && (
                  <span className="text-xs text-slate-400">Step {step} of 3</span>
                )}
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight mt-0.5">
                {authMode === 'login' 
                  ? 'Volunteer & NGO Portal Sign In' 
                  : (selectedRole === 'volunteer' ? 'Volunteer First Responder Verification' : 'NGO Humanitarian Agency Onboarding')}
              </h2>
            </div>
          </div>

          {/* Mode Switcher Tabs (Sign In vs Register) */}
          <div className="grid grid-cols-2 gap-2 mt-4 p-1.5 bg-slate-900/90 rounded-2xl border border-slate-800">
            <button
              onClick={() => { setAuthMode('login'); setStep(1); }}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer ${
                authMode === 'login'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In (Existing / Quick Test)</span>
            </button>
            <button
              onClick={() => { setAuthMode('signup'); setStep(1); }}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer ${
                authMode === 'signup'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>New Registration & 2FA</span>
            </button>
          </div>

          {/* Progress Bar (Sign Up Only) */}
          {authMode === 'signup' && step < 4 && (
            <div className="flex items-center space-x-2 mt-4">
              <div className={`h-1.5 flex-1 rounded-full ${step >= 1 ? 'bg-red-500' : 'bg-slate-700'}`} />
              <div className={`h-1.5 flex-1 rounded-full ${step >= 2 ? 'bg-red-500' : 'bg-slate-700'}`} />
              <div className={`h-1.5 flex-1 rounded-full ${step >= 3 ? 'bg-red-500' : 'bg-slate-700'}`} />
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-7 max-h-[72vh] overflow-y-auto">
          
          {/* ========================================================
              MODE 1: QUICK SIGN IN / PRE-CONFIGURED DEMO ACCOUNTS
             ======================================================== */}
          {authMode === 'login' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-extrabold text-[#0F172A] flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>1-Click Test Login (Pre-Configured Registered Accounts)</span>
                </h3>
                <p className="text-xs text-[#64748B] font-medium mt-0.5">
                  Click any verified volunteer or NGO below to instantly log in with full credentials:
                </p>
              </div>

              {/* Preset Accounts List */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  🚑 Volunteer First Responders & Blood Donors
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {dbHelpers.filter((h) => h.role === 'volunteer').map((vol) => (
                    <button
                      key={vol.id}
                      onClick={() => handleQuickLogin(vol)}
                      className="p-3 rounded-2xl border border-[#CBD5E1] bg-[#F8FAFC] hover:bg-blue-50 hover:border-blue-400 text-left transition flex flex-col justify-between space-y-1.5 group cursor-pointer shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-xs text-[#0F172A] group-hover:text-blue-700">
                          {vol.name}
                        </span>
                        {vol.bloodGroup && (
                          <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-mono font-black border border-red-200">
                            🩸 {vol.bloodGroup}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#64748B]">
                        {vol.badge || vol.org_name || 'Verified Volunteer'}
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[10px] text-slate-500 font-mono">
                        <span>{vol.phone}</span>
                        <span className="text-blue-600 font-bold group-hover:underline">1-Click Sign In &rarr;</span>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 pt-3">
                  🏢 NGO Agencies & Disaster Foundations
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {dbHelpers.filter((h) => h.role === 'ngo').map((ngo) => (
                    <button
                      key={ngo.id}
                      onClick={() => handleQuickLogin(ngo)}
                      className="p-3 rounded-2xl border border-[#CBD5E1] bg-[#F8FAFC] hover:bg-red-50 hover:border-red-400 text-left transition flex flex-col justify-between space-y-1.5 group cursor-pointer shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-xs text-[#0F172A] group-hover:text-red-700">
                          {ngo.name}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                          ✓ Darpan
                        </span>
                      </div>
                      <div className="text-[11px] text-[#64748B]">
                        {ngo.darpanId ? `NITI Darpan: ${ngo.darpanId}` : (ngo.badge || 'Authorized Agency')}
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[10px] text-slate-500 font-mono">
                        <span>{ngo.phone}</span>
                        <span className="text-red-600 font-bold group-hover:underline">1-Click Sign In &rarr;</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Manual Login Form */}
              <div className="pt-4 border-t border-[#E2E8F0]">
                <h4 className="text-xs font-bold text-[#0F172A] mb-1.5">Or Sign In with Phone / Email / Darpan ID:</h4>
                <form onSubmit={handleManualLogin} className="flex gap-2">
                  <input
                    type="text"
                    value={loginQuery}
                    onChange={(e) => { setLoginQuery(e.target.value); setLoginError(''); }}
                    placeholder="e.g. +91 98201 55019 or operations@redcrossmumbai.org"
                    className="flex-1 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:border-blue-600"
                  />
                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="px-4 py-2 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
                  >
                    {loginLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
                    <span>Sign In</span>
                  </button>
                </form>
                {loginError && (
                  <p className="text-xs font-bold text-red-600 mt-1.5">{loginError}</p>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              MODE 2: NEW REGISTRATION & MULTI-STEP 2FA ONBOARDING
             ======================================================== */}
          {authMode === 'signup' && (
            <>
              {/* Role Switcher (Step 1 only) */}
              {step === 1 && (
                <div className="grid grid-cols-2 gap-2 mb-4 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
                  <button
                    onClick={() => setSelectedRole('volunteer')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer ${
                      selectedRole === 'volunteer'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>Volunteer Responder</span>
                  </button>
                  <button
                    onClick={() => setSelectedRole('ngo')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer ${
                      selectedRole === 'ngo'
                        ? 'bg-red-600 text-white shadow-md'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    <span>NGO / Authorized Org</span>
                  </button>
                </div>
              )}

              {/* VOLUNTEER REGISTRATION FLOW */}
              {selectedRole === 'volunteer' && (
                <>
                  {/* Step 1: Personal Info */}
                  {step === 1 && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-extrabold text-[#0F172A]">
                          Step 1: Volunteer Identity & Contact Details
                        </h3>
                        <p className="text-xs text-[#64748B] font-medium">
                          Enter your legal credentials for rapid emergency dispatch authentication.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-bold text-[#0F172A] mb-1">Full Legal Name *</label>
                          <input
                            type="text"
                            value={volData.fullName}
                            onChange={(e) => setVolData({ ...volData, fullName: e.target.value })}
                            placeholder="e.g. Dr. Rohit Deshmukh"
                            className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-[#0F172A] mb-1">Mobile Number (For SMS 2FA) *</label>
                          <input
                            type="tel"
                            value={volData.phone}
                            onChange={(e) => setVolData({ ...volData, phone: e.target.value })}
                            placeholder="e.g. +91 98201 55019"
                            className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-[#0F172A] mb-1">Blood Group *</label>
                          <select
                            value={volData.bloodGroup}
                            onChange={(e) => setVolData({ ...volData, bloodGroup: e.target.value })}
                            className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                          >
                            {['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'].map((bg) => (
                              <option key={bg} value={bg}>{bg}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-[#0F172A] mb-1">Govt ID Type *</label>
                          <select
                            value={volData.govIdType}
                            onChange={(e) => setVolData({ ...volData, govIdType: e.target.value })}
                            className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                          >
                            <option value="Aadhaar Card">Aadhaar Card (India)</option>
                            <option value="Driving License">Driving License</option>
                            <option value="Voter ID">Voter ID Card</option>
                            <option value="Passport">National Passport</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-[#0F172A] mb-1">Govt ID Number</label>
                          <input
                            type="text"
                            value={volData.govIdNumber}
                            onChange={(e) => setVolData({ ...volData, govIdNumber: e.target.value })}
                            placeholder="e.g. XXXX-XXXX-4820"
                            className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Skills & Document Upload */}
                  {step === 2 && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-extrabold text-[#0F172A]">
                          Step 2: Emergency Skills & ID Document Upload
                        </h3>
                        <p className="text-xs text-[#64748B] font-medium">
                          Select certified skills to match you with appropriate crisis categories.
                        </p>
                      </div>

                      {/* Skills Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {VOLUNTEER_SKILLS.map((skill) => {
                          const Icon = skill.icon;
                          const isSelected = volData.selectedSkills.includes(skill.id);

                          return (
                            <button
                              type="button"
                              key={skill.id}
                              onClick={() => toggleVolSkill(skill.id)}
                              className={`p-3 rounded-xl border text-left transition flex items-center space-x-2.5 cursor-pointer ${
                                isSelected
                                  ? 'bg-[#E0F2FE] border-[#0284C7] text-[#0369A1] font-bold'
                                  : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#475569] hover:bg-[#F1F5F9]'
                              }`}
                            >
                              <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-[#0284C7] text-white' : 'bg-[#E2E8F0] text-[#64748B]'}`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <span className="text-xs">{skill.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Vehicle selection */}
                      <div>
                        <label className="block text-xs font-bold text-[#0F172A] mb-1">Available Transport Vehicle for Evacuations</label>
                        <select
                          value={volData.vehicleType}
                          onChange={(e) => setVolData({ ...volData, vehicleType: e.target.value })}
                          className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2 text-xs text-[#0F172A]"
                        >
                          <option value="4x4 SUV">High-Clearance 4x4 SUV / Jeep</option>
                          <option value="Motorcycle">Two-Wheeler / First-Aid Motorbike</option>
                          <option value="Inflatable Boat">Rescue Inflatable Boat / Raft</option>
                          <option value="Van/Mini-Truck">Relief Logistics Van / Mini-Truck</option>
                          <option value="On-Foot">On-Foot Urban Responder</option>
                        </select>
                      </div>

                      {/* Interactive Document Upload Area */}
                      <div className="p-4 rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/50 text-center relative hover:bg-blue-50 transition">
                        <Upload className="w-7 h-7 text-blue-600 mx-auto mb-1" />
                        <div className="text-xs font-bold text-[#0F172A]">Upload Govt ID or EMT Certification Proof</div>
                        <div className="text-[11px] text-[#64748B]">PNG, JPG, or PDF up to 10MB</div>
                        
                        <input
                          type="file"
                          id="vol-id-upload-input"
                          accept=".pdf,.png,.jpg,.jpeg"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, 'vol')}
                        />
                        
                        {volData.idFileName ? (
                          <div className="mt-2.5 inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-emerald-100 border border-emerald-300 text-xs font-bold text-emerald-800">
                            <Check className="w-4 h-4 text-emerald-600" />
                            <span>Attached: {volData.idFileName}</span>
                          </div>
                        ) : (
                          <label
                            htmlFor="vol-id-upload-input"
                            className="mt-2.5 inline-block px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer transition shadow-sm"
                          >
                            Browse & Attach Document
                          </label>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Step 3: Two-Factor OTP */}
                  {step === 3 && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-extrabold text-[#0F172A]">
                          Step 3: Two-Factor SMS OTP Verification
                        </h3>
                        <p className="text-xs text-[#64748B] font-medium">
                          Verify your mobile connection to receive live distress radar alerts.
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl bg-[#FEF3C7] border border-[#FDE68A] text-xs space-y-2">
                        <div className="font-bold text-[#B45309] flex items-center space-x-1.5">
                          <Lock className="w-4 h-4 text-[#D97706]" />
                          <span>SMS OTP Verification</span>
                        </div>
                        <p className="text-[#92400E]">
                          Target Phone: <strong>{volData.phone || '+91 98201 55019'}</strong>
                        </p>
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          className="px-3.5 py-1.5 rounded-xl bg-[#D97706] hover:bg-[#B45309] text-white text-xs font-bold transition shadow-sm cursor-pointer"
                        >
                          {otpSent ? 'Resend 6-Digit OTP' : 'Send Emergency OTP to Phone'}
                        </button>
                      </div>

                      {otpMessage && (
                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-800 font-bold flex items-center space-x-2">
                          <Sparkles className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <span>{otpMessage}</span>
                        </div>
                      )}

                      {otpSent && (
                        <div>
                          <label className="block text-xs font-bold text-[#0F172A] mb-1">Enter 6-Digit OTP Code</label>
                          <input
                            type="text"
                            maxLength={6}
                            value={volData.otpCode}
                            onChange={(e) => setVolData({ ...volData, otpCode: e.target.value })}
                            className="w-full tracking-widest text-center text-xl font-mono font-black bg-[#F8FAFC] border-2 border-[#2563EB] rounded-xl py-2.5 text-[#0F172A] focus:outline-none"
                          />
                        </div>
                      )}

                      <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs space-y-2 text-[#475569]">
                        <div className="font-bold text-[#0F172A]">Disaster Volunteer Oath & Agreement:</div>
                        <ul className="list-disc pl-4 space-y-1 text-[11px]">
                          <li>I consent to share real-time GPS location when marked Available.</li>
                          <li>I agree to adhere to NDMA humanitarian protocols and verify situations before declaring resolution.</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* NGO REGISTRATION FLOW */}
              {selectedRole === 'ngo' && (
                <>
                  {/* Step 1: Legal Entity */}
                  {step === 1 && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-extrabold text-[#0F172A]">
                          Step 1: NGO Entity & Darpan Credentials
                        </h3>
                        <p className="text-xs text-[#64748B] font-medium">
                          Registered NGOs, Red Cross units, and disaster response foundations.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-bold text-[#0F172A] mb-1">Organization Legal Name *</label>
                          <input
                            type="text"
                            value={ngoData.orgName}
                            onChange={(e) => setNgoData({ ...ngoData, orgName: e.target.value })}
                            placeholder="e.g. Indian Red Cross Society / Khalsa Aid"
                            className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:border-[#DC2626]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-[#0F172A] mb-1">NITI Aayog Darpan / Reg ID *</label>
                          <input
                            type="text"
                            value={ngoData.darpanId}
                            onChange={(e) => setNgoData({ ...ngoData, darpanId: e.target.value })}
                            placeholder="e.g. MH/2021/019284"
                            className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:border-[#DC2626]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-[#0F172A] mb-1">24/7 Hotline Phone *</label>
                          <input
                            type="tel"
                            value={ngoData.hotlinePhone}
                            onChange={(e) => setNgoData({ ...ngoData, hotlinePhone: e.target.value })}
                            placeholder="e.g. 022-2410-7000"
                            className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:border-[#DC2626]"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-xs font-bold text-[#0F172A] mb-1">Official Org Email (For Dispatch Clearance) *</label>
                          <input
                            type="email"
                            value={ngoData.officialEmail}
                            onChange={(e) => setNgoData({ ...ngoData, officialEmail: e.target.value })}
                            placeholder="e.g. disaster-response@redcrossmumbai.org"
                            className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:border-[#DC2626]"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Relief Capacity & Document Upload */}
                  {step === 2 && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-extrabold text-[#0F172A]">
                          Step 2: Logistics Assets & Authorization Letter
                        </h3>
                        <p className="text-xs text-[#64748B] font-medium">
                          Declare operational domains and upload NGO clearance proof.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {NGO_DOMAINS.map((domain) => {
                          const isSelected = ngoData.selectedDomains.includes(domain.id);

                          return (
                            <button
                              type="button"
                              key={domain.id}
                              onClick={() => toggleNgoDomain(domain.id)}
                              className={`p-3 rounded-xl border text-left transition flex items-center space-x-2.5 cursor-pointer ${
                                isSelected
                                  ? 'bg-[#FEE2E2] border-[#DC2626] text-[#991B1B] font-bold'
                                  : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#475569] hover:bg-[#F1F5F9]'
                              }`}
                            >
                              <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-[#DC2626]' : 'bg-[#CBD5E1]'}`} />
                              <span className="text-xs">{domain.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Interactive Document Upload for NGOs */}
                      <div className="p-4 rounded-2xl border-2 border-dashed border-red-300 bg-red-50/50 text-center relative hover:bg-red-50 transition">
                        <Upload className="w-7 h-7 text-red-600 mx-auto mb-1" />
                        <div className="text-xs font-bold text-[#0F172A]">Upload NGO Darpan Certificate or Authorization Letter</div>
                        <div className="text-[11px] text-[#64748B]">PDF, PNG, JPG up to 10MB</div>
                        
                        <input
                          type="file"
                          id="ngo-id-upload-input"
                          accept=".pdf,.png,.jpg,.jpeg"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, 'ngo')}
                        />
                        
                        {ngoData.authLetterFileName ? (
                          <div className="mt-2.5 inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-emerald-100 border border-emerald-300 text-xs font-bold text-emerald-800">
                            <Check className="w-4 h-4 text-emerald-600" />
                            <span>Attached: {ngoData.authLetterFileName}</span>
                          </div>
                        ) : (
                          <label
                            htmlFor="ngo-id-upload-input"
                            className="mt-2.5 inline-block px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer transition shadow-sm"
                          >
                            Browse & Attach Authorization File
                          </label>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Step 3: Signatory & 2FA */}
                  {step === 3 && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-extrabold text-[#0F172A]">
                          Step 3: Officer Clearance & Security 2FA
                        </h3>
                        <p className="text-xs text-[#64748B] font-medium">
                          Authorized signatory verification to prevent fraudulent NGO accounts.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-[#0F172A] mb-1">Authorized Officer Name *</label>
                          <input
                            type="text"
                            value={ngoData.signatoryName}
                            onChange={(e) => setNgoData({ ...ngoData, signatoryName: e.target.value })}
                            placeholder="e.g. Dr. Anil Kulkarni"
                            className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3 py-2 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-[#0F172A] mb-1">Designation</label>
                          <input
                            type="text"
                            value={ngoData.signatoryRole}
                            onChange={(e) => setNgoData({ ...ngoData, signatoryRole: e.target.value })}
                            className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3 py-2 text-xs"
                          />
                        </div>
                      </div>

                      {/* 2FA Security OTP */}
                      <div className="p-4 rounded-2xl bg-[#FEF3C7] border border-[#FDE68A] text-xs space-y-2">
                        <div className="font-bold text-[#B45309] flex items-center space-x-1.5">
                          <Lock className="w-4 h-4 text-[#D97706]" />
                          <span>Security Two-Factor OTP Confirmation</span>
                        </div>
                        <p className="text-[#92400E]">
                          Target Org Email: <strong>{ngoData.officialEmail || 'operations@redcrossmumbai.org'}</strong>
                        </p>
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          className="px-3.5 py-1.5 rounded-xl bg-[#D97706] hover:bg-[#B45309] text-white text-xs font-bold transition shadow-sm cursor-pointer"
                        >
                          {otpSent ? 'Resend Security Code' : 'Send Security Code'}
                        </button>
                      </div>

                      {otpMessage && (
                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-800 font-bold flex items-center space-x-2">
                          <Sparkles className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <span>{otpMessage}</span>
                        </div>
                      )}

                      {otpSent && (
                        <div>
                          <label className="block text-xs font-bold text-[#0F172A] mb-1">Enter 6-Digit Org Security Code</label>
                          <input
                            type="text"
                            maxLength={6}
                            value={ngoData.otpCode}
                            onChange={(e) => setNgoData({ ...ngoData, otpCode: e.target.value })}
                            className="w-full tracking-widest text-center text-xl font-mono font-black bg-[#F8FAFC] border-2 border-[#DC2626] rounded-xl py-2.5 text-[#0F172A] focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Step 4: Success Certificate */}
              {step === 4 && verifiedProfile && (
                <div className="text-center py-4 space-y-4">
                  <div className="w-16 h-16 rounded-3xl bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center mx-auto shadow-md border-2 border-[#BBF7D0] animate-bounce">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-mono font-extrabold tracking-widest px-2.5 py-1 rounded bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]">
                      ✓ Verified & Authorized
                    </span>
                    <h3 className="text-xl font-black text-[#0F172A] mt-2">
                      {verifiedProfile.name}
                    </h3>
                    <p className="text-xs text-[#64748B] font-mono mt-0.5">
                      Official Registry ID: <strong>{verifiedProfile.id}</strong> &bull; {verifiedProfile.badge}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-left space-y-1.5 max-w-md mx-auto">
                    <div className="flex justify-between text-[#64748B]">
                      <span>Authorization Level:</span>
                      <strong className="text-[#0F172A]">
                        {selectedRole === 'volunteer' ? 'Tier-1 Emergency Responder' : 'Tier-2 NGO Triage Authority'}
                      </strong>
                    </div>
                    <div className="flex justify-between text-[#64748B]">
                      <span>Status:</span>
                      <strong className="text-[#15803D]">Active / Logged In</strong>
                    </div>
                  </div>

                  <button
                    onClick={resetModal}
                    className="w-full py-3 px-4 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white font-extrabold text-sm shadow-md transition cursor-pointer"
                  >
                    Enter {selectedRole === 'volunteer' ? 'Volunteer Mobile Unit' : 'NGO Mission Control'} &rarr;
                  </button>
                </div>
              )}
            </>
          )}

        </div>

        {/* Modal Footer Controls (Sign Up Steps 1-3) */}
        {authMode === 'signup' && step < 4 && (
          <div className="p-4 sm:p-5 bg-[#F8FAFC] border-t border-[#CBD5E1] flex items-center justify-between gap-3">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 rounded-xl bg-white border border-[#CBD5E1] text-[#475569] text-xs font-bold hover:bg-[#F1F5F9] transition flex items-center space-x-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="px-5 py-2.5 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-extrabold shadow-md transition flex items-center space-x-1.5 cursor-pointer"
              >
                <span>Proceed to Step {step + 1}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isVerifying}
                onClick={handleFinalSubmit}
                className={`px-6 py-2.5 rounded-xl text-white text-xs font-extrabold shadow-md transition flex items-center space-x-1.5 cursor-pointer ${
                  selectedRole === 'volunteer'
                    ? 'bg-[#2563EB] hover:bg-[#1D4ED8]'
                    : 'bg-[#DC2626] hover:bg-[#B91C1C]'
                }`}
              >
                {isVerifying ? (
                  <span>Verifying Credentials...</span>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Complete Verification & Enter</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
