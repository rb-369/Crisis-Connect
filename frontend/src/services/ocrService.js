import { createWorker } from 'tesseract.js';
import { parsePrescriptionText } from '../utils/prescriptionParser';

/**
 * Perform client-side OCR on an image file or data URL using Tesseract.js
 * @param {string|File|Blob} imageSource - Image file, blob, or data URL
 * @param {function} onProgress - Callback with progress status (0-100) and message
 * @param {'medicine'|'oxygen'} category - Request category
 * @returns {Promise<object>} Structured medical verification object
 */
export async function performPrescriptionOCR(imageSource, onProgress = () => {}, category = 'medicine') {
  try {
    onProgress({ status: 'initializing', progress: 10, message: 'Initializing Tesseract OCR engine...' });

    const worker = await createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          const pct = Math.min(95, Math.round(m.progress * 100));
          onProgress({ status: 'recognizing', progress: pct, message: `Recognizing medical text (${pct}%)...` });
        } else if (m.status) {
          onProgress({ status: m.status, progress: 30, message: `${m.status}...` });
        }
      }
    });

    onProgress({ status: 'analyzing', progress: 50, message: 'Extracting doctor prescription details...' });
    const result = await worker.recognize(imageSource);
    const rawText = result?.data?.text || '';

    await worker.terminate();

    onProgress({ status: 'parsing', progress: 95, message: 'Parsing medications and credentials...' });
    const parsedData = parsePrescriptionText(rawText, category);

    onProgress({ status: 'complete', progress: 100, message: 'OCR analysis complete!' });
    return {
      success: true,
      rawText,
      ...parsedData
    };
  } catch (err) {
    console.error('Tesseract OCR error:', err);
    // Graceful fallback to regex parsing if text is somehow extractable or fallback mock
    return {
      success: false,
      error: err.message || 'OCR processing failed',
      confidence: 0,
      badge: 'unverified_document',
      badgeLabel: 'OCR Processing Error — Verification Pending',
      medicines: [],
      dosage: '',
      oxygenSpecs: null,
      doctorInfo: null,
    };
  }
}

/**
 * Generate a sample canvas prescription for instant demo testing
 * @param {'medicine'|'oxygen'} type 
 * @returns {string} Base64 Data URL of generated prescription image
 */
export function generateDemoPrescriptionImage(type = 'medicine') {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 950;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Border & Header Band
  ctx.strokeStyle = '#2563EB';
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  ctx.fillStyle = '#EFF6FF';
  ctx.fillRect(25, 25, canvas.width - 50, 130);

  // Clinic Header
  ctx.fillStyle = '#1E3A8A';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('LILAVATI HOSPITAL & RESEARCH CENTRE', 50, 65);

  ctx.fillStyle = '#3B82F6';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('EMERGENCY CRITICAL CARE & PULMONOLOGY UNIT', 50, 95);

  ctx.fillStyle = '#475569';
  ctx.font = '14px sans-serif';
  ctx.fillText('A-791, Bandra Reclamation, Bandra West, Mumbai 400050 | Tel: 022-2675-1000', 50, 125);

  // Doctor Details
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('Dr. Rajesh Sharma, MD, DNB (Pulmonology & Critical Care)', 50, 195);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#64748B';
  ctx.fillText('MMC Reg. No: MMC-2012/04/1892 | Senior Consultant', 50, 220);

  // Patient Bar
  ctx.fillStyle = '#F1F5F9';
  ctx.fillRect(40, 245, canvas.width - 80, 50);
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('Patient Name: Amit S. Deshmukh', 55, 276);
  ctx.fillText('Age/Gender: 54 Y / Male', 360, 276);
  ctx.fillText('Date: 04/09/2026', 620, 276);

  // Rx Symbol
  ctx.fillStyle = '#DC2626';
  ctx.font = 'bold 44px serif';
  ctx.fillText('℞', 50, 360);

  // Prescription Content
  ctx.fillStyle = '#0F172A';
  ctx.font = '16px monospace';

  if (type === 'oxygen') {
    ctx.fillText('DIAGNOSIS: Acute Hypoxemic Respiratory Distress (SpO2: 86%)', 95, 355);
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#0369A1';
    ctx.fillText('URGENT MEDICAL OXYGEN REQUIREMENT:', 95, 410);

    ctx.fillStyle = '#0F172A';
    ctx.font = '16px sans-serif';
    ctx.fillText('1. 10L Jumbo Medical Cylinder (B-Type / D-Type Compatible)', 110, 460);
    ctx.fillText('   - Continuous flow rate: 5 LPM to maintain SpO2 > 94%', 110, 490);
    ctx.fillText('   - Humidifier bottle and high-flow nasal cannula required', 110, 520);
    ctx.fillText('2. Inhaler Ventolin (Salbutamol) 100mcg — 2 puffs SOS for bronchospasm', 110, 570);
    ctx.fillText('3. Tab Dexamethasone 6mg OD after food x 5 days', 110, 610);
  } else {
    ctx.fillText('DIAGNOSIS: Type 2 Diabetes with Bronchial Asthma Exacerbation', 95, 355);
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#1D4ED8';
    ctx.fillText('PRESCRIBED MEDICATIONS:', 95, 410);

    ctx.fillStyle = '#0F172A';
    ctx.font = '16px sans-serif';
    ctx.fillText('1. Inj. Lantus Insulin 100 IU/ml Solostar Pen', 110, 460);
    ctx.fillText('   - Dosage: 14 units Subcutaneously once daily at bedtime', 110, 490);
    ctx.fillText('2. Inhaler Ventolin (Salbutamol) 100mcg', 110, 530);
    ctx.fillText('   - Dosage: 2 puffs twice daily (BD) & SOS for breathlessness', 110, 560);
    ctx.fillText('3. Tab Dolo 650 (Paracetamol 650mg)', 110, 600);
    ctx.fillText('   - Dosage: 1 tablet TDS SOS for fever/pain', 110, 630);
    ctx.fillText('4. Tab Pantoprazole 40mg — 1 tab OD empty stomach', 110, 670);
  }

  // Doctor Stamp & Signature box
  ctx.strokeStyle = '#94A3B8';
  ctx.strokeRect(500, 750, 240, 110);
  ctx.fillStyle = '#1E40AF';
  ctx.font = 'italic 20px serif';
  ctx.fillText('Dr. Rajesh Sharma', 525, 790);
  ctx.font = 'bold 11px sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText('MMC Reg No: 2012/04/1892', 525, 820);
  ctx.fillText('Consultant Pulmonologist', 525, 840);

  return canvas.toDataURL('image/png');
}
