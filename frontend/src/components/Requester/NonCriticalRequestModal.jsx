import React, { useState } from 'react';
import { 
  X, 
  Send, 
  HeartHandshake, 
  Wind, 
  Pill, 
  Utensils, 
  Home, 
  Truck, 
  AlertCircle, 
  Upload, 
  CheckCircle2, 
  Sparkles,
  MapPin,
  Building2,
  Clock,
  Users
} from 'lucide-react';
import VoiceNoteRecorder from './VoiceNoteRecorder';
import { BLOOD_GROUPS, getBloodGroupTheme } from '../../utils/bloodCompatibility';
import { getDeviceId } from '../../utils/device';
import { api } from '../../services/api';

const OXYGEN_TYPES = [
  '10L Jumbo Medical Cylinder',
  'Portable Oxygen Cylinder (B-Type)',
  'Oxygen Concentrator (5-10 LPM)',
  'BiPAP / CPAP Compatible Supply',
];

const FOOD_PRESETS = [
  '20L Drinking Water Cans',
  'Ready-to-Eat Meal Packets',
  'Infant Formula & Baby Food',
  'Dry Biscuits & ORS Electrolytes',
];

const MOBILITY_TYPES = [
  'Ambulatory (Can Walk with Support)',
  'Wheelchair Transport Required',
  'Bedridden / Stretcher Ambulance Needed',
];

const MUMBAI_HOSPITALS = [
  'KEM Hospital, Parel',
  'BYL Nair Hospital, Mumbai Central',
  'Sion LTMG Hospital',
  'Lilavati Hospital, Bandra',
  'Nanavati Max Hospital, Vile Parle',
  'Cooper Hospital, Juhu',
];

export default function NonCriticalRequestModal({ category, coords, onClose, onRequestCreated }) {
  const [bloodGroup, setBloodGroup] = useState('');
  const [bloodUnits, setBloodUnits] = useState(2);
  const [hospitalName, setHospitalName] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientCondition, setPatientCondition] = useState('');

  const [oxygenType, setOxygenType] = useState(OXYGEN_TYPES[0]);
  const [flowRate, setFlowRate] = useState('5 LPM (Standard)');

  const [medicineNames, setMedicineNames] = useState('');
  const [dosage, setDosage] = useState('');
  const [prescriptionImage, setPrescriptionImage] = useState(null);

  const [personsCount, setPersonsCount] = useState(4);
  const [foodItemTypes, setFoodItemTypes] = useState(['20L Drinking Water Cans', 'Ready-to-Eat Meal Packets']);
  const [waterLiters, setWaterLiters] = useState(50);

  const [shelterDuration, setShelterDuration] = useState('1-2 Days');
  const [specialConsiderations, setSpecialConsiderations] = useState('');

  const [mobilityType, setMobilityType] = useState(MOBILITY_TYPES[0]);
  const [destination, setDestination] = useState('');

  // Universal optional fields
  const [generalDetails, setGeneralDetails] = useState('');
  const [requesterName, setRequesterName] = useState('');
  const [requesterPhone, setRequesterPhone] = useState('');
  const [voiceNoteData, setVoiceNoteData] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState(null);

  // Determine icon & header colors
  const getCategoryMeta = () => {
    switch (category) {
      case 'blood':
        return {
          title: 'Blood Aid / Plasma Request',
          subtitle: 'Mandatory blood type required for matching compatible donors in your radius.',
          icon: HeartHandshake,
          iconColor: '#DC2626',
          headerBg: 'bg-red-50 border-red-100',
        };
      case 'oxygen':
        return {
          title: 'Medical Oxygen Cylinder Request',
          subtitle: 'Specify cylinder or concentrator requirements for fast dispatch.',
          icon: Wind,
          iconColor: '#0891B2',
          headerBg: 'bg-cyan-50 border-cyan-100',
        };
      case 'medicine':
        return {
          title: 'Prescription Medicine & First Aid',
          subtitle: 'List critical medications (insulin, inhalers, cardiac meds) or attach Rx.',
          icon: Pill,
          iconColor: '#2563EB',
          headerBg: 'bg-blue-50 border-blue-100',
        };
      case 'food':
        return {
          title: 'Food & Clean Drinking Water',
          subtitle: 'Specify number of people needing clean water and emergency rations.',
          icon: Utensils,
          iconColor: '#D97706',
          headerBg: 'bg-amber-50 border-amber-100',
        };
      case 'shelter':
        return {
          title: 'Emergency Dry Shelter',
          subtitle: 'For displaced families needing temporary dry accommodations.',
          icon: Home,
          iconColor: '#7C3AED',
          headerBg: 'bg-purple-50 border-purple-100',
        };
      case 'transport':
        return {
          title: 'Evacuation & Medical Transit',
          subtitle: 'High-clearance vehicle, wheelchair transit, or clinic transfer.',
          icon: Truck,
          iconColor: '#0D9488',
          headerBg: 'bg-teal-50 border-teal-100',
        };
      default:
        return {
          title: 'Relief & Assistance Request',
          subtitle: 'Provide details for immediate matching with volunteers.',
          icon: Sparkles,
          iconColor: '#2563EB',
          headerBg: 'bg-slate-50 border-slate-100',
        };
    }
  };

  const meta = getCategoryMeta();
  const Icon = meta.icon;

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPrescriptionImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleFoodItem = (item) => {
    if (foodItemTypes.includes(item)) {
      setFoodItemTypes(foodItemTypes.filter((i) => i !== item));
    } else {
      setFoodItemTypes([...foodItemTypes, item]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError(null);

    // Validation: For Blood, bloodGroup is strictly mandatory
    if (category === 'blood' && !bloodGroup) {
      setValidationError('Please select the required Blood Group (Mandatory for compatible donor matching).');
      return;
    }

    setIsSubmitting(true);
    const deviceId = getDeviceId();

    // Construct specific service details dictionary
    let service_details = {};
    let autoDetails = generalDetails || '';

    if (category === 'blood') {
      service_details = {
        blood_group: bloodGroup,
        units: Number(bloodUnits),
        hospital_name: hospitalName || 'Mumbai General Area',
        patient_name: patientName,
        patient_condition: patientCondition,
      };
      if (!autoDetails) {
        autoDetails = `Urgent need for ${bloodUnits} unit(s) of ${bloodGroup} blood at ${hospitalName || 'local clinic'}.`;
      }
    } else if (category === 'oxygen') {
      service_details = {
        oxygen_type: oxygenType,
        flow_rate: flowRate,
        patient_name: patientName,
      };
      if (!autoDetails) {
        autoDetails = `Need ${oxygenType} (${flowRate}) for patient ${patientName || 'in distress'}.`;
      }
    } else if (category === 'medicine') {
      service_details = {
        medicine_names: medicineNames || 'Critical Prescription Medications',
        dosage: dosage,
        has_prescription_image: Boolean(prescriptionImage),
      };
      if (!autoDetails) {
        autoDetails = `Medicines required: ${medicineNames || 'Essential supplies'} (${dosage || 'standard dosage'}).`;
      }
    } else if (category === 'food') {
      service_details = {
        persons_count: Number(personsCount),
        food_items: foodItemTypes,
        water_liters: Number(waterLiters),
      };
      if (!autoDetails) {
        autoDetails = `Food & water for ${personsCount} people (${foodItemTypes.join(', ')}).`;
      }
    } else if (category === 'shelter') {
      service_details = {
        persons_count: Number(personsCount),
        duration: shelterDuration,
        special_considerations: specialConsiderations,
      };
      if (!autoDetails) {
        autoDetails = `Emergency shelter for ${personsCount} persons for ${shelterDuration}.`;
      }
    } else if (category === 'transport') {
      service_details = {
        mobility_type: mobilityType,
        destination: destination || 'Nearest Hospital / Dry Zone',
      };
      if (!autoDetails) {
        autoDetails = `Transit assistance required: ${mobilityType} to ${destination || 'safe location'}.`;
      }
    }

    const payload = {
      category: category,
      urgency: category === 'blood' || category === 'oxygen' ? 'high' : 'normal',
      lat: coords?.lat || 19.0760,
      lng: coords?.lng || 72.8777,
      requester_device_id: deviceId,
      requester_name: requesterName || null,
      requester_phone: requesterPhone || null,
      details: autoDetails,
      photo_url: prescriptionImage || null,
      voice_note_url: voiceNoteData ? voiceNoteData.audioUrl : null,
      service_details: service_details,
      admin_status: 'approved', // Auto-accepted & verified for non-critical requests
    };

    try {
      const created = await api.createRequest(payload);
      setIsSubmitting(false);
      onRequestCreated(created);
    } catch (err) {
      console.error('Failed to create non-critical request:', err);
      setValidationError(err.message || 'Failed to submit request. Please check backend connection.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-[#CBD5E1] w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
        
        {/* Modal Header */}
        <div className={`p-4 sm:p-5 border-b flex items-start justify-between ${meta.headerBg}`}>
          <div className="flex items-center space-x-3">
            <div 
              style={{ color: meta.iconColor }} 
              className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center flex-shrink-0"
            >
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-black text-[#0F172A]">
                  {meta.title}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-white text-[10px] font-extrabold uppercase tracking-wider text-[#475569] shadow-xs">
                  Non-Critical Relief
                </span>
              </div>
              <p className="text-xs text-[#475569] font-medium mt-0.5">
                {meta.subtitle}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#64748B] hover:text-[#0F172A] hover:bg-black/5 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* Validation Alert */}
          {validationError && (
            <div className="p-3.5 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] text-xs font-semibold flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* =========================================================================
              CATEGORY-SPECIFIC FIELDS
             ========================================================================= */}

          {/* 1. BLOOD REQUEST FIELDS */}
          {category === 'blood' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-black text-[#0F172A] flex items-center space-x-1">
                    <span>Select Required Blood Group</span>
                    <span className="text-red-600 font-bold">* (Mandatory)</span>
                  </label>
                  <span className="text-[11px] text-[#64748B] font-medium">
                    Strict Donor Compatibility
                  </span>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {BLOOD_GROUPS.map((group) => {
                    const isSelected = bloodGroup === group;
                    const theme = getBloodGroupTheme(group);
                    return (
                      <button
                        type="button"
                        key={group}
                        onClick={() => {
                          setBloodGroup(group);
                          setValidationError(null);
                        }}
                        style={{
                          backgroundColor: isSelected ? theme.bg : '#F8FAFC',
                          borderColor: isSelected ? theme.text : '#CBD5E1',
                          color: isSelected ? theme.text : '#0F172A',
                        }}
                        className={`p-2.5 rounded-xl border-2 font-black text-sm text-center transition-all cursor-pointer ${
                          isSelected ? 'shadow-md scale-105 ring-2 ring-red-500/20' : 'hover:border-slate-400'
                        }`}
                      >
                        {group}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    Units of Blood / Plasma Required
                  </label>
                  <div className="flex space-x-2">
                    {[1, 2, 3, 4, 6].map((u) => (
                      <button
                        type="button"
                        key={u}
                        onClick={() => setBloodUnits(u)}
                        className={`flex-1 py-1.5 rounded-xl border text-xs font-black transition ${
                          bloodUnits === u 
                            ? 'bg-[#DC2626] border-[#DC2626] text-white shadow-sm' 
                            : 'bg-white border-[#CBD5E1] text-[#475569] hover:bg-[#F1F5F9]'
                        }`}
                      >
                        {u} {u === 1 ? 'Unit' : 'Units'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    Hospital / Blood Bank
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. KEM Hospital Parel, BYL Nair"
                    value={hospitalName}
                    onChange={(e) => setHospitalName(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3 py-2 text-xs font-semibold text-[#0F172A] focus:border-[#DC2626] focus:outline-none"
                  />
                </div>
              </div>

              {/* Quick Hospital Presets */}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                <span className="text-[10px] text-[#64748B] font-bold self-center mr-1">Mumbai Hubs:</span>
                {MUMBAI_HOSPITALS.slice(0, 3).map((hosp) => (
                  <button
                    type="button"
                    key={hosp}
                    onClick={() => setHospitalName(hosp)}
                    className="text-[10px] px-2 py-0.5 rounded-lg bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0] font-medium"
                  >
                    {hosp.split(',')[0]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2. OXYGEN REQUEST FIELDS */}
          {category === 'oxygen' && (
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  Oxygen Supply Type
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {OXYGEN_TYPES.map((type) => (
                    <button
                      type="button"
                      key={type}
                      onClick={() => setOxygenType(type)}
                      className={`p-2.5 rounded-xl border text-left text-xs font-bold transition flex items-center justify-between ${
                        oxygenType === type
                          ? 'bg-[#CFFAFE] border-[#0891B2] text-[#0E7490] shadow-xs'
                          : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#475569] hover:bg-white'
                      }`}
                    >
                      <span>{type}</span>
                      {oxygenType === type && <CheckCircle2 className="w-4 h-4 text-[#0891B2]" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  Required Flow Rate
                </label>
                <input
                  type="text"
                  placeholder="e.g. 5 LPM, 10 LPM, High Flow"
                  value={flowRate}
                  onChange={(e) => setFlowRate(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3 py-2 text-xs font-semibold text-[#0F172A] focus:border-[#0891B2] focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* 3. MEDICINES REQUEST FIELDS */}
          {category === 'medicine' && (
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  Medicine Name(s) & Details
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lantus Insulin Pen, Ventolin Inhaler, Dialysis saline"
                  value={medicineNames}
                  onChange={(e) => setMedicineNames(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3 py-2 text-xs font-semibold text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    Dosage / Quantity
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2 Pens, 1 Box, 500ml bottle"
                    value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3 py-2 text-xs font-semibold text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    Prescription Photo (Optional)
                  </label>
                  <label className="flex items-center justify-center space-x-2 py-2 px-3 border border-dashed border-[#CBD5E1] rounded-xl bg-[#F8FAFC] hover:bg-white text-xs text-[#475569] font-semibold cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>{prescriptionImage ? 'Prescription Attached' : 'Upload Doctor Rx / Photo'}</span>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* 4. FOOD & WATER FIELDS */}
          {category === 'food' && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    Number of People Needing Food
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={personsCount}
                    onChange={(e) => setPersonsCount(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3 py-2 text-xs font-semibold text-[#0F172A] focus:border-[#D97706] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    Clean Drinking Water (Liters)
                  </label>
                  <input
                    type="number"
                    step="10"
                    value={waterLiters}
                    onChange={(e) => setWaterLiters(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3 py-2 text-xs font-semibold text-[#0F172A] focus:border-[#D97706] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                  Items Required
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {FOOD_PRESETS.map((item) => {
                    const isChecked = foodItemTypes.includes(item);
                    return (
                      <button
                        type="button"
                        key={item}
                        onClick={() => toggleFoodItem(item)}
                        className={`p-2 rounded-xl border text-xs font-bold text-left transition flex items-center justify-between ${
                          isChecked
                            ? 'bg-[#FEF3C7] border-[#D97706] text-[#92400E]'
                            : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#475569]'
                        }`}
                      >
                        <span>{item}</span>
                        {isChecked && <CheckCircle2 className="w-4 h-4 text-[#D97706]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 5. SHELTER FIELDS */}
          {category === 'shelter' && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    Number of Displaced Persons
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={personsCount}
                    onChange={(e) => setPersonsCount(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3 py-2 text-xs font-semibold text-[#0F172A] focus:border-[#7C3AED] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    Expected Duration
                  </label>
                  <select
                    value={shelterDuration}
                    onChange={(e) => setShelterDuration(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3 py-2 text-xs font-semibold text-[#0F172A] focus:border-[#7C3AED] focus:outline-none"
                  >
                    <option>1 Night</option>
                    <option>1-2 Days</option>
                    <option>3-5 Days</option>
                    <option>Until Flood Recedes</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  Special Accommodations (Infants / Elderly / Pets)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1 senior citizen in wheelchair, 1 newborn baby"
                  value={specialConsiderations}
                  onChange={(e) => setSpecialConsiderations(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3 py-2 text-xs font-semibold text-[#0F172A] focus:border-[#7C3AED] focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* 6. TRANSPORT FIELDS */}
          {category === 'transport' && (
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  Patient Mobility Status
                </label>
                <div className="space-y-2">
                  {MOBILITY_TYPES.map((mob) => (
                    <button
                      type="button"
                      key={mob}
                      onClick={() => setMobilityType(mob)}
                      className={`w-full p-2.5 rounded-xl border text-left text-xs font-bold transition flex items-center justify-between ${
                        mobilityType === mob
                          ? 'bg-[#CCFBF1] border-[#0D9488] text-[#0F766E]'
                          : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#475569]'
                      }`}
                    >
                      <span>{mob}</span>
                      {mobilityType === mob && <CheckCircle2 className="w-4 h-4 text-[#0D9488]" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  Destination Landmark / Hospital
                </label>
                <input
                  type="text"
                  placeholder="e.g. KEM Hospital Emergency Ward or High Ground Dadar"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3 py-2 text-xs font-semibold text-[#0F172A] focus:border-[#0D9488] focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* =========================================================================
              UNIVERSAL MULTI-MODAL CONTROLS (VOICE NOTE, TEXT, CONTACT INFO)
             ========================================================================= */}
          
          <hr className="border-[#E2E8F0]" />

          {/* Multi-modal Voice Note Recorder (Optional) */}
          <div>
            <VoiceNoteRecorder 
              onAudioRecorded={(data) => setVoiceNoteData(data)} 
            />
          </div>

          {/* Optional Text Details */}
          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1">
              Additional Details or Landmark (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Ground floor behind Hanuman temple, water at knee level, blue gate..."
              value={generalDetails}
              onChange={(e) => setGeneralDetails(e.target.value)}
              className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl p-2.5 text-xs font-medium text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
            />
          </div>

          {/* Soft Requester Contact Details (Optional) */}
          <div className="p-3.5 rounded-2xl bg-[#F1F5F9] border border-[#CBD5E1] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#0F172A]">
                Contact Info (Optional — for volunteer communication)
              </span>
              <span className="text-[10px] text-[#64748B] font-semibold">
                No login required
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                placeholder="Contact Name (e.g. Rajesh)"
                value={requesterName}
                onChange={(e) => setRequesterName(e.target.value)}
                className="w-full bg-white border border-[#CBD5E1] rounded-xl px-3 py-2 text-xs font-semibold text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
              />
              <input
                type="tel"
                placeholder="Phone Number (e.g. 98200 12345)"
                value={requesterPhone}
                onChange={(e) => setRequesterPhone(e.target.value)}
                className="w-full bg-white border border-[#CBD5E1] rounded-xl px-3 py-2 text-xs font-semibold text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
              />
            </div>
          </div>

          {/* Location Pin Indicator */}
          <div className="text-[11px] text-[#64748B] flex items-center space-x-1.5 font-mono">
            <MapPin className="w-3.5 h-3.5 text-[#DC2626]" />
            <span>
              Auto-attached GPS Location: {coords?.lat ? coords.lat.toFixed(4) : '19.0760'}, {coords?.lng ? coords.lng.toFixed(4) : '72.8777'} (Mumbai)
            </span>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#CBD5E1] text-xs font-bold text-[#475569] hover:bg-[#F1F5F9] transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] text-white text-xs font-black uppercase tracking-wider flex items-center space-x-2 shadow-lg hover:shadow-blue-500/25 transition cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Broadcasting Request...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Broadcast Request to Volunteers &rarr;</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
