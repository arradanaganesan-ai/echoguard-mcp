import { HazardType, IntakeAnalysis, EvidenceItem } from '../types.js';

export function runIntakeAgent(
  rawReport: string,
  incidentId: string = `INC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
  locationHint?: string,
  occupantsHint?: string
): IntakeAnalysis {
  const text = rawReport.toLowerCase();

  // 1. Detect Hazard Type
  let reportedHazard: HazardType = 'benign_or_unknown';
  if (
    text.includes('gas') ||
    text.includes('rotten egg') ||
    text.includes('sulfur') ||
    text.includes('methane') ||
    text.includes('propane') ||
    text.includes('hissing pipe')
  ) {
    reportedHazard = 'suspected_gas_leak';
  } else if (
    text.includes('smoke') ||
    text.includes('fire') ||
    text.includes('flame') ||
    text.includes('burning smell') ||
    text.includes('charred')
  ) {
    reportedHazard = 'smoke_fire';
  } else if (
    text.includes('chest pain') ||
    text.includes('unconscious') ||
    text.includes('fainted') ||
    text.includes('severe bleeding') ||
    text.includes('stroke')
  ) {
    reportedHazard = 'medical_distress';
  } else if (
    text.includes('sparking wire') ||
    text.includes('electrocution') ||
    text.includes('smoking outlet') ||
    text.includes('live wire')
  ) {
    reportedHazard = 'electrical_hazard';
  }

  // 2. Extract Symptoms
  const detectedSymptoms: string[] = [];
  const symptomMatchers: Array<{ key: string; label: string }> = [
    { key: 'burning eyes', label: 'Ocular irritation / burning eyes' },
    { key: 'eyes are burning', label: 'Ocular irritation / burning eyes' },
    { key: 'eye irritation', label: 'Eye irritation' },
    { key: 'headache', label: 'Cephalea / Headache' },
    { key: 'dizzy', label: 'Dizziness / Lightheadedness' },
    { key: 'dizziness', label: 'Dizziness / Lightheadedness' },
    { key: 'nausea', label: 'Nausea' },
    { key: 'vomiting', label: 'Vomiting' },
    { key: 'cough', label: 'Respiratory coughing' },
    { key: 'shortness of breath', label: 'Dyspnea / Shortness of breath' },
    { key: 'trouble breathing', label: 'Dyspnea / Difficulty breathing' },
    { key: 'choking', label: 'Choking sensation' },
  ];

  for (const matcher of symptomMatchers) {
    if (text.includes(matcher.key) && !detectedSymptoms.includes(matcher.label)) {
      detectedSymptoms.push(matcher.label);
    }
  }

  // 3. Location Label
  let locationLabel = locationHint || 'Unspecified living area';
  const locationMatchers = ['kitchen', 'basement', 'garage', 'living room', 'bedroom', 'utility closet', 'hallway', 'furnace room'];
  for (const loc of locationMatchers) {
    if (text.includes(loc)) {
      locationLabel = loc.charAt(0).toUpperCase() + loc.slice(1);
      break;
    }
  }

  // 4. Evidence Items Extraction
  const evidence: EvidenceItem[] = [
    {
      id: `ev-${Date.now()}-1`,
      source: 'user_reported',
      description: `Occupant direct observation: "${rawReport.trim()}"`,
      confidence: 0.85,
      timestamp: new Date().toISOString(),
      verified: false,
    },
  ];

  // Distinguish user reported vs verified sensor reading
  const hasSensorMention = text.includes('ppm') || text.includes('detector beeping') || text.includes('sensor reading') || text.includes('smart meter');
  let hasSensorConfirmation = false;
  if (hasSensorMention) {
    hasSensorConfirmation = true;
    evidence.push({
      id: `ev-${Date.now()}-2`,
      source: 'sensor_verified',
      description: 'Physical or IoT alarm sound / telemetry noted in report',
      confidence: 0.95,
      timestamp: new Date().toISOString(),
      verified: true,
    });
  }

  // 5. Missing Information Identification
  const missingInformation: string[] = [];
  if (!hasSensorConfirmation) {
    missingInformation.push('Calibrated atmospheric combustible gas sensor (PPM / LEL) reading');
  }
  if (!locationHint && locationLabel === 'Unspecified living area') {
    missingInformation.push('Exact room or structural origin of leak');
  }
  if (!occupantsHint && !text.includes('people') && !text.includes('kids') && !text.includes('alone')) {
    missingInformation.push('Exact census of remaining occupants and domestic pets');
  }
  missingInformation.push('Status of exterior main natural gas shutoff valve access');

  return {
    incidentId,
    rawReport,
    timestamp: new Date().toISOString(),
    reportedHazard,
    symptoms: detectedSymptoms,
    locationLabel,
    evidence,
    missingInformation,
    occupantsEstimated: occupantsHint || 'Unknown (Pending verification)',
    hasSensorConfirmation,
  };
}
