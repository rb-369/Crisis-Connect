import React, { useState } from 'react';
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
  Check
} from 'lucide-react';

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

export default function MultiStepAuthModal({ isOpen, onClose, onAuthSuccess, defaultRole = 'volunteer' }) {
  const [selectedRole, setSelectedRole] = useState(defaultRole); // 'volunteer' or 'ngo'
  const [step, setStep] = useState(1); // 1, 2, 3, 4 (success)

  // Volunteer State
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

  // NGO State
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
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedProfile, setVerifiedProfile] = useState(null);

  if (!isOpen) return null;

  // Handle Volunteer Skill Toggle
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

  // Handle NGO Domain Toggle
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

  const handleSimulateSendOtp = () => {
    setOtpSent(true);
    // Pre-fill a sample 6-digit OTP for seamless testing
    if (selectedRole === 'volunteer') {
      setVolData((prev) => ({ ...prev, otpCode: '749201' }));
    } else {
      setNgoData((prev) => ({ ...prev, otpCode: '839104' }));
    }
  };

  const handleFinalSubmit = () => {
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      let profile;
      if (selectedRole === 'volunteer') {
        profile = {
          role: 'volunteer',
          id: `VOL-${Math.floor(1000 + Math.random() * 9000)}`,
          name: volData.fullName || 'Rahul Verma (EMT First Responder)',
          phone: volData.phone || '+91 98201 44102',
          skills: volData.selectedSkills,
          verified: true,
          badge: 'Verified First Responder',
          verifiedAt: new Date().toISOString(),
        };
      } else {
        profile = {
          role: 'ngo',
          id: `NGO-${Math.floor(1000 + Math.random() * 9000)}`,
          name: ngoData.orgName || 'Red Cross Disaster Relief Mumbai',
          darpanId: ngoData.darpanId || 'MH/2021/029104',
          email: ngoData.officialEmail || 'operations@redcrossmumbai.org',
          phone: ngoData.hotlinePhone || '+91 22 2410 7000',
          domains: ngoData.selectedDomains,
          verified: true,
          badge: 'Authorized Humanitarian Agency',
          verifiedAt: new Date().toISOString(),
        };
      }

      setVerifiedProfile(profile);
      setStep(4); // Success screen
      if (onAuthSuccess) {
        onAuthSuccess(profile);
      }
    }, 900);
  };

  const resetModal = () => {
    setStep(1);
    setOtpSent(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-[#CBD5E1] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Gradient Header */}
        <div className="bg-[#0F172A] text-white p-5 sm:p-6 relative">
          <button
            onClick={resetModal}
            className="absolute right-4 top-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-red-600 flex items-center justify-center text-white shadow-md">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase font-mono font-extrabold tracking-widest bg-red-600/30 text-red-400 px-2 py-0.5 rounded border border-red-500/30">
                  Tier-1 Authorization Portal
                </span>
                <span className="text-xs text-slate-400">Step {step} of 3</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight mt-0.5">
                {selectedRole === 'volunteer' ? 'Volunteer First Responder Verification' : 'NGO / Authorized Agency Onboarding'}
              </h2>
            </div>
          </div>

          {/* Role Switcher (Step 1 only) */}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-2 mt-4 p-1.5 bg-slate-900/80 rounded-2xl border border-slate-800">
              <button
                onClick={() => setSelectedRole('volunteer')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 ${
                  selectedRole === 'volunteer'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Volunteer Responder</span>
              </button>
              <button
                onClick={() => setSelectedRole('ngo')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 ${
                  selectedRole === 'ngo'
                    ? 'bg-red-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>NGO / Authorized Org</span>
              </button>
            </div>
          )}

          {/* Progress Bar Indicator */}
          {step < 4 && (
            <div className="flex items-center space-x-2 mt-4">
              <div className={`h-1.5 flex-1 rounded-full ${step >= 1 ? 'bg-red-500' : 'bg-slate-700'}`} />
              <div className={`h-1.5 flex-1 rounded-full ${step >= 2 ? 'bg-red-500' : 'bg-slate-700'}`} />
              <div className={`h-1.5 flex-1 rounded-full ${step >= 3 ? 'bg-red-500' : 'bg-slate-700'}`} />
            </div>
          )}
        </div>

        {/* Modal Body Container */}
        <div className="p-5 sm:p-7 max-h-[75vh] overflow-y-auto">
          
          {/* ========================================================
              VOLUNTEER TRACK
             ======================================================== */}
          {selectedRole === 'volunteer' && (
            <>
              {/* Step 1: Personal & Identity */}
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-[#0F172A]">
                      Step 1: Responder Identity & Contact Details
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
                        placeholder="e.g. Dr. Rohit Deshmukh / Sarah Lin"
                        className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#0F172A] mb-1">Mobile Number (For Emergency SMS) *</label>
                      <input
                        type="tel"
                        value={volData.phone}
                        onChange={(e) => setVolData({ ...volData, phone: e.target.value })}
                        placeholder="e.g. +91 98201 55019"
                        className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#0F172A] mb-1">Blood Group</label>
                      <select
                        value={volData.bloodGroup}
                        onChange={(e) => setVolData({ ...volData, bloodGroup: e.target.value })}
                        className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                      >
                        {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((bg) => (
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
                      <label className="block text-xs font-bold text-[#0F172A] mb-1">Govt ID Number *</label>
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

              {/* Step 2: Emergency Response Skills & Certifications */}
              {step === 2 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-[#0F172A]">
                      Step 2: Emergency Skills & Field Equipment
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
                          className={`p-3 rounded-xl border text-left transition flex items-center space-x-2.5 ${
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

                  {/* Vehicle / Deployment Fleet */}
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

                  {/* ID Proof Document Upload */}
                  <div className="p-4 rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] text-center">
                    <Upload className="w-6 h-6 text-[#64748B] mx-auto mb-1.5" />
                    <div className="text-xs font-bold text-[#0F172A]">Upload Govt ID or EMT Certification Proof</div>
                    <div className="text-[11px] text-[#64748B]">PNG, JPG, or PDF up to 10MB</div>
                    <input
                      type="file"
                      id="vol-id-upload"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setVolData({ ...volData, idFileName: file.name });
                      }}
                    />
                    <label
                      htmlFor="vol-id-upload"
                      className="mt-2 inline-block px-3 py-1.5 rounded-lg bg-white border border-[#CBD5E1] text-xs font-bold text-[#2563EB] cursor-pointer hover:bg-[#F1F5F9]"
                    >
                      {volData.idFileName ? `Selected: ${volData.idFileName}` : 'Choose Document'}
                    </label>
                  </div>
                </div>
              )}

              {/* Step 3: Two-Factor OTP & Deployment Consent */}
              {step === 3 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-[#0F172A]">
                      Step 3: Two-Factor Phone OTP & Code of Conduct
                    </h3>
                    <p className="text-xs text-[#64748B] font-medium">
                      Verify your mobile connection to receive live distress radar alerts.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#FEF3C7] border border-[#FDE68A] text-xs space-y-2">
                    <div className="font-bold text-[#B45309] flex items-center space-x-1.5">
                      <Lock className="w-4 h-4 text-[#D97706]" />
                      <span>Simulated 6-Digit SMS OTP Verification</span>
                    </div>
                    <p className="text-[#92400E]">
                      SMS verification code for {volData.phone || '+91 98201 55019'}.
                    </p>
                    <button
                      type="button"
                      onClick={handleSimulateSendOtp}
                      className="px-3 py-1.5 rounded-lg bg-[#D97706] hover:bg-[#B45309] text-white text-xs font-bold transition shadow-sm"
                    >
                      {otpSent ? 'Resend 6-Digit OTP' : 'Send Emergency OTP to Phone'}
                    </button>
                  </div>

                  {otpSent && (
                    <div>
                      <label className="block text-xs font-bold text-[#0F172A] mb-1">Enter 6-Digit OTP Code</label>
                      <input
                        type="text"
                        maxLength={6}
                        value={volData.otpCode}
                        onChange={(e) => setVolData({ ...volData, otpCode: e.target.value })}
                        className="w-full tracking-widest text-center text-lg font-mono font-black bg-[#F8FAFC] border-2 border-[#2563EB] rounded-xl py-2.5 text-[#0F172A] focus:outline-none"
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

          {/* ========================================================
              NGO / AUTHORIZED ORGANIZATION TRACK
             ======================================================== */}
          {selectedRole === 'ngo' && (
            <>
              {/* Step 1: Legal Entity & Credentials */}
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-[#0F172A]">
                      Step 1: Organization Legal & Registration Credentials
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
                        placeholder="e.g. Indian Red Cross Society / Khalsa Aid / Goonj Disaster Unit"
                        className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:border-[#DC2626]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#0F172A] mb-1">NITI Aayog NGO Darpan / Reg ID *</label>
                      <input
                        type="text"
                        value={ngoData.darpanId}
                        onChange={(e) => setNgoData({ ...ngoData, darpanId: e.target.value })}
                        placeholder="e.g. MH/2021/019284"
                        className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:border-[#DC2626]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#0F172A] mb-1">24/7 Crisis Hotline Phone *</label>
                      <input
                        type="tel"
                        value={ngoData.hotlinePhone}
                        onChange={(e) => setNgoData({ ...ngoData, hotlinePhone: e.target.value })}
                        placeholder="e.g. 022-2410-7000"
                        className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:border-[#DC2626]"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-[#0F172A] mb-1">Official Domain Email (For Dispatch Clearance) *</label>
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

              {/* Step 2: Disaster Relief Logistics & Fleet */}
              {step === 2 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-[#0F172A]">
                      Step 2: Disaster Logistics Capacity & Assets
                    </h3>
                    <p className="text-xs text-[#64748B] font-medium">
                      Declare operational domains to route matching high-urgency caller pins.
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
                          className={`p-3 rounded-xl border text-left transition flex items-center space-x-2.5 ${
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

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-bold text-[#0F172A] mb-1">Ambulance Units</label>
                      <input
                        type="text"
                        value={ngoData.fleetAmbulances}
                        onChange={(e) => setNgoData({ ...ngoData, fleetAmbulances: e.target.value })}
                        className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#0F172A] mb-1">Rescue Boats / 4x4s</label>
                      <input
                        type="text"
                        value={ngoData.fleetRescueBoats}
                        onChange={(e) => setNgoData({ ...ngoData, fleetRescueBoats: e.target.value })}
                        className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3 py-2 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Authorized Signatory & Security Clearance */}
              {step === 3 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-[#0F172A]">
                      Step 3: Authorized Officer Verification & Clearance
                    </h3>
                    <p className="text-xs text-[#64748B] font-medium">
                      Authorized signatory verification to prevent fraudulent NGO accounts.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#0F172A] mb-1">Officer Name *</label>
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
                      Dispatched to {ngoData.officialEmail || 'official org email'}.
                    </p>
                    <button
                      type="button"
                      onClick={handleSimulateSendOtp}
                      className="px-3 py-1.5 rounded-lg bg-[#D97706] hover:bg-[#B45309] text-white text-xs font-bold transition shadow-sm"
                    >
                      {otpSent ? 'Resend Security Code' : 'Send Security Code'}
                    </button>
                  </div>

                  {otpSent && (
                    <div>
                      <label className="block text-xs font-bold text-[#0F172A] mb-1">Enter 6-Digit Org Security Code</label>
                      <input
                        type="text"
                        maxLength={6}
                        value={ngoData.otpCode}
                        onChange={(e) => setNgoData({ ...ngoData, otpCode: e.target.value })}
                        className="w-full tracking-widest text-center text-lg font-mono font-black bg-[#F8FAFC] border-2 border-[#DC2626] rounded-xl py-2.5 text-[#0F172A] focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ========================================================
              STEP 4: SUCCESS CERTIFICATE / ISSUANCE
             ======================================================== */}
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
                  <strong className="text-[#0F172A]">{selectedRole === 'volunteer' ? 'Tier-1 Emergency Responder' : 'Tier-2 NGO Triage Authority'}</strong>
                </div>
                <div className="flex justify-between text-[#64748B]">
                  <span>Status:</span>
                  <strong className="text-[#15803D]">Active / Ready for Dispatch</strong>
                </div>
              </div>

              <button
                onClick={resetModal}
                className="w-full py-3 px-4 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white font-extrabold text-sm shadow-md transition"
              >
                Enter {selectedRole === 'volunteer' ? 'Volunteer Mobile Unit' : 'NGO Mission Control'} &rarr;
              </button>
            </div>
          )}

        </div>

        {/* Modal Footer Controls (Steps 1-3) */}
        {step < 4 && (
          <div className="p-4 sm:p-5 bg-[#F8FAFC] border-t border-[#CBD5E1] flex items-center justify-between gap-3">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 rounded-xl bg-white border border-[#CBD5E1] text-[#475569] text-xs font-bold hover:bg-[#F1F5F9] transition flex items-center space-x-1"
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
                className="px-5 py-2.5 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-extrabold shadow-md transition flex items-center space-x-1.5"
              >
                <span>Proceed to Step {step + 1}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isVerifying}
                onClick={handleFinalSubmit}
                className={`px-6 py-2.5 rounded-xl text-white text-xs font-extrabold shadow-md transition flex items-center space-x-1.5 ${
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
