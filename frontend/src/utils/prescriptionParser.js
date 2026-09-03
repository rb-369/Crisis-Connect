/**
 * CrisisConnect — Prescription & Medical Order OCR Parser
 * Parses raw text extracted by Tesseract.js to detect doctor credentials,
 * prescribed medicines, dosages, oxygen cylinder specifications, and trust badges.
 */

// Common critical and emergency medicines
const KNOWN_DRUGS = [
  'insulin', 'lantus', 'humalog', 'novorapid', 'mixtard',
  'ventolin', 'salbutamol', 'asthalin', 'budecort', 'foracort', 'duolin',
  'paracetamol', 'dolo', 'dolo 650', 'calpol', 'crocin',
  'azithromycin', 'amoxicillin', 'augmentin', 'cefixime', 'ciprofloxacin',
  'pantoprazole', 'pan 40', 'omeprazole', 'rabeprazole',
  'ondansetron', 'emset', 'domperidone', 'vomistop',
  'cetirizine', 'allegra', 'fexofenadine', 'montelukast',
  'telmisartan', 'amlodipine', 'atenolol', 'losartan', 'metoprolol',
  'atorvastatin', 'rosuvastatin', 'aspirin', 'ecospirin', 'clopidogrel',
  'metformin', 'glycomet', 'glimepiride', 'januvia',
  'dexamethasone', 'prednisolone', 'hydrocortisone', 'betnesol',
  'combiflam', 'ibuprofen', 'tramadol', 'ultracet',
  'ors', 'electral', 'normal saline', 'ringer lactate', 'rl', 'dns'
];

/**
 * Parses raw OCR text into a structured medical verification object
 * @param {string} rawText 
 * @param {'medicine'|'oxygen'|'general'} category 
 * @returns {object}
 */
export function parsePrescriptionText(rawText, category = 'medicine') {
  if (!rawText || typeof rawText !== 'string') {
    return {
      isValid: false,
      confidence: 0,
      badge: 'unverified_document',
      badgeLabel: 'Unverified Document',
      doctorInfo: null,
      medicines: [],
      dosage: '',
      oxygenSpecs: null,
      patientName: null,
      date: null,
      rawText: ''
    };
  }

  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const textLower = rawText.toLowerCase();

  let confidenceScore = 0;
  let doctorName = null;
  let clinicOrHospital = null;
  let regNumber = null;
  let hasRxSymbol = /\b(rx|℞)\b/i.test(rawText);

  // 1. Doctor & Clinic Extraction
  for (const line of lines) {
    const drMatch = line.match(/\b(dr|dr\.)\s+([a-zA-Z\.\s]{3,30})/i);
    if (drMatch && !doctorName) {
      doctorName = `Dr. ${drMatch[2].trim()}`;
      confidenceScore += 25;
    }

    const hospMatch = line.match(/([a-zA-Z0-9\s]+(?:hospital|clinic|nursing home|medical center|dispensary))/i);
    if (hospMatch && !clinicOrHospital) {
      clinicOrHospital = hospMatch[1].trim();
      confidenceScore += 15;
    }

    const regMatch = line.match(/\b(reg(istration)?\s*(?:no|num|\.)?[:\s]*([a-zA-Z0-9\/-]+))/i);
    if (regMatch && !regNumber) {
      regNumber = regMatch[3] ? regMatch[3].trim() : regMatch[1].trim();
      confidenceScore += 15;
    }
  }

  if (hasRxSymbol) {
    confidenceScore += 20;
  }

  // 2. Patient Name Extraction
  let patientName = null;
  for (const line of lines) {
    const ptMatch = line.match(/\b(?:patient(?:\s*name)?|name|pt\.?)\s*[:\-]\s*([a-zA-Z\s]{2,30})/i);
    if (ptMatch && !patientName) {
      patientName = ptMatch[1].trim();
      confidenceScore += 10;
      break;
    }
  }

  // 3. Date Detection
  let prescriptionDate = null;
  const dateMatch = rawText.match(/\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/);
  if (dateMatch) {
    prescriptionDate = dateMatch[1];
    confidenceScore += 5;
  }

  // 4. Medicine Detection
  const detectedMedicines = [];
  const detectedDosages = [];

  for (const drug of KNOWN_DRUGS) {
    const regex = new RegExp(`\\b${drug}\\b`, 'i');
    if (regex.test(textLower)) {
      const matchingLine = lines.find(l => regex.test(l.toLowerCase()));
      if (matchingLine && !detectedMedicines.includes(matchingLine)) {
        detectedMedicines.push(matchingLine);
      } else if (!detectedMedicines.includes(drug)) {
        detectedMedicines.push(drug.charAt(0).toUpperCase() + drug.slice(1));
      }
    }
  }

  for (const line of lines) {
    const medPrefixMatch = line.match(/\b(tab|tablet|cap|capsule|syp|syrup|inj|injection|inhaler|drops|neb)\.?\s+([a-zA-Z0-9\-\+\s]{3,35})/i);
    if (medPrefixMatch) {
      const fullMed = line.trim();
      if (!detectedMedicines.some(m => m.toLowerCase().includes(medPrefixMatch[2].toLowerCase().trim()))) {
        detectedMedicines.push(fullMed);
      }
    }

    const dosageMatch = line.match(/\b(\d+\s*mg|\d+\s*ml|\d+-\d+-\d+|\b(od|bd|tds|qid|sos|hs)\b|once daily|twice daily)/i);
    if (dosageMatch) {
      detectedDosages.push(dosageMatch[0]);
    }
  }

  if (detectedMedicines.length > 0) {
    confidenceScore += Math.min(30, detectedMedicines.length * 15);
  }

  // 5. Oxygen Cylinder & LPM Extraction
  let oxygenSpecs = null;
  let detectedLpm = null;
  let cylinderType = null;

  const lpmMatch = rawText.match(/\b(\d+(?:\.\d+)?)\s*(lpm|l\/min|litres?(\s*per\s*min(ute)?)?)/i);
  if (lpmMatch) {
    detectedLpm = `${lpmMatch[1]} LPM`;
    confidenceScore += 25;
  }

  if (/concentrator/i.test(textLower)) {
    cylinderType = 'Oxygen Concentrator (5-10 LPM)';
    confidenceScore += 20;
  } else if (/b-type|portable/i.test(textLower)) {
    cylinderType = 'Portable Oxygen Cylinder (B-Type)';
    confidenceScore += 20;
  } else if (/jumbo|10l|d-type/i.test(textLower)) {
    cylinderType = '10L Jumbo Medical Cylinder';
    confidenceScore += 20;
  } else if (/bipap|cpap/i.test(textLower)) {
    cylinderType = 'BiPAP / CPAP Compatible Supply';
    confidenceScore += 20;
  } else if (/oxygen|o2/i.test(textLower)) {
    cylinderType = 'Medical Oxygen Cylinder';
    confidenceScore += 15;
  }

  if (detectedLpm || cylinderType) {
    oxygenSpecs = {
      lpm: detectedLpm || '5 LPM (Standard)',
      cylinderType: cylinderType || '10L Jumbo Medical Cylinder'
    };
  }

  const normalizedConfidence = Math.min(100, confidenceScore);
  const isValid = normalizedConfidence >= 40;

  let badge = 'unverified_document';
  let badgeLabel = 'Unverified Rx — Pending NGO Review';

  if (normalizedConfidence >= 65) {
    badge = 'verified_doctor_rx';
    badgeLabel = 'Verified Doctor Prescription';
  } else if (normalizedConfidence >= 40) {
    badge = 'hospital_order_detected';
    badgeLabel = 'Hospital Requisition Detected';
  }

  return {
    isValid,
    confidence: normalizedConfidence,
    badge,
    badgeLabel,
    doctorInfo: doctorName ? {
      name: doctorName,
      clinicOrHospital: clinicOrHospital || 'Authorized Clinic / Hospital',
      regNumber: regNumber || null
    } : (clinicOrHospital ? { name: 'Hospital Staff', clinicOrHospital, regNumber: null } : null),
    medicines: detectedMedicines.slice(0, 6),
    medicineString: detectedMedicines.slice(0, 5).join(', '),
    dosage: detectedDosages.slice(0, 3).join(', '),
    oxygenSpecs,
    patientName,
    date: prescriptionDate,
    rawText: rawText.slice(0, 500)
  };
}
