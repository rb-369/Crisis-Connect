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
  Users,
  FileCheck,
  Loader2,
  ShieldCheck,
  Stethoscope,
  RotateCw,
  Info
} from 'lucide-react';
import VoiceNoteRecorder from './VoiceNoteRecorder';
import { BLOOD_GROUPS, getBloodGroupTheme } from '../../utils/bloodCompatibility';
import { getDeviceId } from '../../utils/device';
import { api } from '../../services/api';
import { performPrescriptionOCR, generateDemoPrescriptionImage } from '../../services/ocrService';

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

  // OCR Verification States
  const [isScanningOcr, setIsScanningOcr] = useState(false);
  const [ocrProgress, setOcrProgress] = useState({ status: '', progress: 0, message: '' });
  const [ocrData, setOcrData] = useState(null);
  const [ocrError, setOcrError] = useState(null);

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
          subtitle: 'Zero login required. Hospital location & blood type needed for direct donor dispatch.',
          icon: HeartHandshake,
          iconColor: '#DC2626',
          headerBg: 'bg-red-50 border-red-100',
        };
      case 'oxygen':
        return {
          title: 'Medical Oxygen Cylinder Request',
          subtitle: 'Attach prescription / hospital order slip for instant OCR verification.',
          icon: Wind,
          iconColor: '#0891B2',
          headerBg: 'bg-cyan-50 border-cyan-100',
        };
      case 'medicine':
        return {
          title: 'Prescription Medicine & First Aid',
          subtitle: 'Upload doctor Rx for free in-browser OCR auto-fill & verified trust badge.',
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

  // Process Prescription with Tesseract OCR
  const processPrescriptionWithOcr = async (imgDataUrl) => {
    setIsScanningOcr(true);
    setOcrError(null);
    setOcrProgress({ status: 'starting', progress: 5, message: 'Loading Tesseract.js engine...' });

    try {
      const result = await performPrescriptionOCR(
        imgDataUrl,
        (progressInfo) => setOcrProgress(progressInfo),
        category
      );

      if (result.success) {
        setOcrData(result);

        // Auto-fill Medicine Form Fields
        if (category === 'medicine') {
          if (result.medicineString) {
            setMedicineNames((prev) => prev ? `${prev}, ${result.medicineString}` : result.medicineString);
          }
          if (result.dosage && !dosage) {
            setDosage(result.dosage);
          }
          if (result.patientName && !patientName) {
            setPatientName(result.patientName);
          }
        }

        // Auto-fill Oxygen Form Fields
        if (category === 'oxygen') {
          if (result.oxygenSpecs?.cylinderType) {
            setOxygenType(result.oxygenSpecs.cylinderType);
          }
          if (result.oxygenSpecs?.lpm) {
            setFlowRate(result.oxygenSpecs.lpm);
          }
          if (result.patientName && !patientName) {
            setPatientName(result.patientName);
          }
        }
      } else {
        setOcrError('OCR analysis completed without clear medical matches. You can still submit for manual NGO review.');
      }
    } catch (err) {
      console.error('OCR processing error:', err);
      setOcrError('Could not process image automatically. You can still submit this request for manual verification.');
    } finally {
      setIsScanningOcr(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result;
        setPrescriptionImage(dataUrl);
        // Automatically trigger OCR scanning on upload
        processPrescriptionWithOcr(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLoadDemoPrescription = (type) => {
    const demoImg = generateDemoPrescriptionImage(type);
    setPrescriptionImage(demoImg);
    processPrescriptionWithOcr(demoImg);
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

    // Validation: For Blood, bloodGroup and hospitalName are strictly mandatory
    if (category === 'blood') {
      if (!bloodGroup) {
        setValidationError('Please select the required Blood Group (Mandatory for compatible donor matching).');
        return;
      }
      if (!hospitalName.trim()) {
        setValidationError('Please specify the Hospital or Blood Bank name (Mandatory for dispatching donors).');
        return;
      }
    }

    setIsSubmitting(true);
    const deviceId = getDeviceId();

    // Construct specific service details dictionary
    let service_details = {};
    let autoDetails = generalDetails || '';

    // OCR Metadata object attached to request
    const ocrMetadata = ocrData ? {
      is_verified: ocrData.isValid,
      badge: ocrData.badge,
      badge_label: ocrData.badgeLabel,
      confidence: ocrData.confidence,
      doctor_info: ocrData.doctorInfo,
      detected_medicines: ocrData.medicines,
      detected_oxygen: ocrData.oxygenSpecs,
      prescription_date: ocrData.date,
    } : {
      is_verified: false,
      badge: prescriptionImage ? 'unverified_image_attached' : 'no_rx_uploaded',
      badge_label: prescriptionImage ? 'Prescription Attached (Pending NGO Check)' : 'Unverified Rx — Pending NGO Review',
      confidence: 0,
      doctor_info: null,
    };

    if (category === 'blood') {
      service_details = {
        blood_group: bloodGroup,
        units: Number(bloodUnits),
        hospital_name: hospitalName.trim(),
        patient_name: patientName,
        patient_condition: patientCondition,
        verification_type: 'hospital_dispatch',
      };
      if (!autoDetails) {
        autoDetails = `Urgent need for ${bloodUnits} unit(s) of ${bloodGroup} blood at ${hospitalName.trim()}.`;
      }
    } else if (category === 'oxygen') {
      service_details = {
        oxygen_type: oxygenType,
        flow_rate: flowRate,
        patient_name: patientName,
        ocr_verification: ocrMetadata,
      };
      if (!autoDetails) {
        autoDetails = `Need ${oxygenType} (${flowRate}) for patient ${patientName || 'in distress'}.${ocrData?.doctorInfo ? ` [Prescribed by ${ocrData.doctorInfo.name}]` : ''}`;
      }
    } else if (category === 'medicine') {
      service_details = {
        medicine_names: medicineNames || 'Critical Prescription Medications',
        dosage: dosage,
        has_prescription_image: Boolean(prescriptionImage),
        ocr_verification: ocrMetadata,
      };
      if (!autoDetails) {
        autoDetails = `Medicines required: ${medicineNames || 'Essential supplies'} (${dosage || 'standard dosage'}).${ocrData?.doctorInfo ? ` [Prescribed by ${ocrData.doctorInfo.name}]` : ''}`;
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-[#0F172A]">
                      Doctor Requisition / Rx Slip
                    </label>
                    <span className="text-[10px] text-[#0891B2] font-semibold">Tesseract OCR</span>
                  </div>
                  <label className="flex items-center justify-center space-x-2 py-2 px-3 border border-dashed border-[#CBD5E1] rounded-xl bg-[#F8FAFC] hover:bg-white text-xs text-[#475569] font-semibold cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-[#0891B2]" />
                    <span>{prescriptionImage ? 'O2 Prescription Attached' : 'Upload Doctor Prescription Slip'}</span>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Demo Oxygen Test Button */}
              <div className="flex items-center justify-between bg-cyan-50/60 p-2 rounded-xl border border-cyan-100">
                <span className="text-[11px] text-cyan-900 font-medium flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
                  Need a sample oxygen prescription to test?
                </span>
                <button
                  type="button"
                  onClick={() => handleLoadDemoPrescription('oxygen')}
                  disabled={isScanningOcr}
                  className="text-[11px] px-2.5 py-1 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg transition shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  {isScanningOcr ? <Loader2 className="w-3 h-3 animate-spin" /> : '⚡ Test with Demo O2 Rx'}
                </button>
              </div>

              {/* OCR Scanning Progress Box */}
              {isScanningOcr && (
                <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-xl space-y-1.5 animate-pulse">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <Loader2 className="w-4 h-4 text-cyan-700 animate-spin" />
                      <span className="text-xs font-bold text-cyan-900">{ocrProgress.message || 'Scanning Rx with Tesseract OCR...'}</span>
                    </div>
                    <span className="text-xs font-black text-cyan-800">{ocrProgress.progress}%</span>
                  </div>
                  <div className="w-full bg-cyan-200 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-cyan-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${ocrProgress.progress}%` }}></div>
                  </div>
                </div>
              )}

              {/* OCR Result Card */}
              {ocrData && !isScanningOcr && (
                <div className={`p-3 rounded-xl border space-y-2 ${ocrData.isValid ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      <ShieldCheck className={`w-4 h-4 ${ocrData.isValid ? 'text-emerald-600' : 'text-amber-600'}`} />
                      <span className={`text-xs font-bold ${ocrData.isValid ? 'text-emerald-900' : 'text-amber-900'}`}>{ocrData.badgeLabel}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ocrData.isValid ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-200 text-amber-800'}`}>
                      {ocrData.confidence}% Confidence
                    </span>
                  </div>
                  {ocrData.doctorInfo && (
                    <p className="text-[11px] text-emerald-800">
                      🩺 <strong>{ocrData.doctorInfo.name}</strong> ({ocrData.doctorInfo.clinicOrHospital})
                    </p>
                  )}
                  {ocrData.oxygenSpecs && (
                    <div className="text-[11px] text-emerald-800 bg-emerald-100/60 p-1.5 rounded-lg">
                      Auto-detected: <strong>{ocrData.oxygenSpecs.cylinderType}</strong> at <strong>{ocrData.oxygenSpecs.lpm}</strong>
                    </div>
                  )}
                </div>
              )}
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
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-[#0F172A]">
                      Doctor Prescription Photo
                    </label>
                    <span className="text-[10px] text-[#2563EB] font-semibold">Tesseract OCR</span>
                  </div>
                  <label className="flex items-center justify-center space-x-2 py-2 px-3 border border-dashed border-[#CBD5E1] rounded-xl bg-[#F8FAFC] hover:bg-white text-xs text-[#475569] font-semibold cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>{prescriptionImage ? 'Prescription Attached' : 'Upload Doctor Rx / Photo'}</span>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Demo Prescription Test Button */}
              <div className="flex items-center justify-between bg-blue-50/70 p-2 rounded-xl border border-blue-100">
                <span className="text-[11px] text-blue-900 font-medium flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  Have no Rx image? Test free in-browser OCR:
                </span>
                <button
                  type="button"
                  onClick={() => handleLoadDemoPrescription('medicine')}
                  disabled={isScanningOcr}
                  className="text-[11px] px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  {isScanningOcr ? <Loader2 className="w-3 h-3 animate-spin" /> : '⚡ Test with Demo Rx'}
                </button>
              </div>

              {/* OCR Scanning Progress Box */}
              {isScanningOcr && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1.5 animate-pulse">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <Loader2 className="w-4 h-4 text-blue-700 animate-spin" />
                      <span className="text-xs font-bold text-blue-900">{ocrProgress.message || 'Scanning Rx with Tesseract OCR...'}</span>
                    </div>
                    <span className="text-xs font-black text-blue-800">{ocrProgress.progress}%</span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${ocrProgress.progress}%` }}></div>
                  </div>
                </div>
              )}

              {/* OCR Result Card */}
              {ocrData && !isScanningOcr && (
                <div className={`p-3 rounded-xl border space-y-2 ${ocrData.isValid ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      <ShieldCheck className={`w-4 h-4 ${ocrData.isValid ? 'text-emerald-600' : 'text-amber-600'}`} />
                      <span className={`text-xs font-bold ${ocrData.isValid ? 'text-emerald-900' : 'text-amber-900'}`}>{ocrData.badgeLabel}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ocrData.isValid ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-200 text-amber-800'}`}>
                      {ocrData.confidence}% Match
                    </span>
                  </div>
                  {ocrData.doctorInfo && (
                    <p className="text-[11px] text-emerald-800">
                      🩺 <strong>{ocrData.doctorInfo.name}</strong> ({ocrData.doctorInfo.clinicOrHospital}) {ocrData.doctorInfo.regNumber && <span className="text-[10px] text-emerald-600 font-mono">[{ocrData.doctorInfo.regNumber}]</span>}
                    </p>
                  )}
                  {ocrData.medicines && ocrData.medicines.length > 0 && (
                    <div className="text-[11px] text-emerald-800 bg-emerald-100/60 p-2 rounded-lg space-y-1">
                      <p className="font-bold text-[10px] uppercase tracking-wider text-emerald-900">Auto-extracted Medicines:</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {ocrData.medicines.map((m, idx) => (
                          <li key={idx} className="font-medium">{m}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
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
              Auto-attached GPS Location: {Number(coords?.lat || 19.076).toFixed(4)}, {Number(coords?.lng || 72.8777).toFixed(4)} (Mumbai)
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
