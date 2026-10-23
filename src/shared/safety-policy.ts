import { HazardType, SafetyRule, BlockedActionRecord, SafetyGuidance } from './types.js';

export const HARD_CODED_SAFETY_RULES: ReadonlyArray<SafetyRule> = [
  {
    id: 'RULE-GAS-EVAC',
    name: 'Mandatory Evacuation Priority',
    category: 'evacuation',
    severity: 'MANDATORY',
    description:
      'For any suspected natural gas or propane leak, all occupants must evacuate immediately. Do not delay evacuation for triage, sensor readings, or personal property retrieval.',
    rationale:
      'Natural gas accumulation poses catastrophic explosion and asphyxiation risks within seconds.',
  },
  {
    id: 'RULE-SPARK-BLOCK',
    name: 'Spark & Electrical Prohibition',
    category: 'spark_prevention',
    severity: 'BLOCKING',
    description:
      'Strictly prohibit turning ON or OFF electrical switches, lighting, exhaust fans, HVAC units, appliances, smart plugs, or circuit breakers in the affected area.',
    rationale:
      'Any contact spark from switches, motors, relays, or relays in appliances can ignite an explosive gas-air mixture.',
  },
  {
    id: 'RULE-ACTUATOR-BLOCK',
    name: 'Physical Actuator Isolation Barrier',
    category: 'actuator_isolation',
    severity: 'BLOCKING',
    description:
      'Never execute direct physical actuation commands on motorized gas shutoff valves, smart door deadbolts, or ventilation flaps. All actuation requests must remain strictly simulated.',
    rationale:
      'Faulty automated valves, uncertified actuators, or sparks from actuator motors can cause ignition or false-safe lockdown trapping occupants.',
  },
  {
    id: 'RULE-NO-AUTODIAL',
    name: 'Controlled Communication & Human Verification',
    category: 'communication',
    severity: 'BLOCKING',
    description:
      'Automated dispatch to national emergency numbers (e.g. 911 in the US/Canada, 112 in India and the EU), public safety answering points (PSAPs), or external third parties requires explicit human approval. Never broadcast unverified emergency reports.',
    rationale:
      'Prevents automated swatting, phantom alarms, and dispatches based on hallucinated AI data.',
  },
  {
    id: 'RULE-NO-DIAGNOSIS',
    name: 'Medical Diagnosis Prohibition',
    category: 'medical',
    severity: 'ADVISORY',
    description:
      'Do not attempt medical symptom diagnosis (e.g. chemical burns vs conjunctivitis). Recommend immediate evacuation into fresh air and professional medical consultation.',
    rationale:
      'Symptom self-treatment delays life-saving evacuation.',
  },
];

export interface PolicyCheckResult {
  allowed: boolean;
  violatedRule?: SafetyRule;
  reason?: string;
  preventedHarm?: string;
}

/**
 * Hard-coded safety policy verification.
 * Independent of any LLM reasoning or prompt directives.
 */
export function evaluateActionSafety(
  hazard: HazardType,
  actionType: string,
  target: string,
  parameters: Record<string, any> = {}
): PolicyCheckResult {
  const normType = actionType.toLowerCase().trim();
  const normTarget = target.toLowerCase().trim();
  const allText = `${normType} ${normTarget} ${JSON.stringify(parameters).toLowerCase()}`;

  // 1. Gas Leak Spark Prevention Check
  if (hazard === 'suspected_gas_leak') {
    const sparkKeywords = [
      'switch',
      'fan',
      'exhaust',
      'light',
      'turn_on',
      'turn_off',
      'breaker',
      'outlet',
      'plug',
      'hvac',
      'ventilation_motor',
      'relay',
      'appliance',
      'stove',
      'spark',
    ];

    const hasSparkRisk = sparkKeywords.some(
      (kw) => normType.includes(kw) || normTarget.includes(kw) || allText.includes(kw)
    );

    if (hasSparkRisk) {
      const rule = HARD_CODED_SAFETY_RULES.find((r) => r.id === 'RULE-SPARK-BLOCK')!;
      return {
        allowed: false,
        violatedRule: rule,
        reason: `CRITICAL SAFETY BLOCK: Operating '${actionType}' on '${target}' is forbidden during a suspected gas leak. Flipping switches, starting exhaust fans, or cycling appliances produces internal electrical arcs that can ignite flammable gas mixtures.`,
        preventedHarm: 'Catastrophic vapor cloud explosion / domestic structure detonation.',
      };
    }
  }

  // 2. Physical Actuator Barrier Check (for ALL hazards)
  const physicalActuatorKeywords = [
    'solenoid',
    'smart_lock',
    'lock_door',
    'unlock_door',
    'gas_valve_actuate',
    'motor_flap',
    'physical_actuate',
    'open_valve',
    'close_valve_motor',
    'trigger_relay',
  ];

  const hasActuatorRisk = physicalActuatorKeywords.some(
    (kw) => normType.includes(kw) || normTarget.includes(kw) || allText.includes(kw)
  );

  if (hasActuatorRisk) {
    const rule = HARD_CODED_SAFETY_RULES.find((r) => r.id === 'RULE-ACTUATOR-BLOCK')!;
    return {
      allowed: false,
      violatedRule: rule,
      reason: `SAFETY POLICY BLOCK: Direct physical actuation of '${target}' (${actionType}) is blocked. Prototype operates in safety isolation mode; physical valve/door manipulation is restricted to trained human first responders.`,
      preventedHarm: 'Hardware failure, entrapment of residents, or motor-induced ignition.',
    };
  }

  // 3. Automated External Dispatch Check (any national emergency number, e.g. 911 or 112)
  if (
    normType.includes('autodial_911') ||
    normType.includes('autodial_112') ||
    normType.includes('dispatch_emergency_live') ||
    normTarget.includes('public_dispatch')
  ) {
    const rule = HARD_CODED_SAFETY_RULES.find((r) => r.id === 'RULE-NO-AUTODIAL')!;
    return {
      allowed: false,
      violatedRule: rule,
      reason: `SAFETY POLICY BLOCK: Automated unverified transmission to emergency dispatch is disallowed without verified human approval.`,
      preventedHarm: 'Emergency service phantom dispatch & resource diversion.',
    };
  }

  return { allowed: true };
}

/**
 * Returns deterministic safety guidance for specific hazards.
 */
export function getSafetyGuidance(hazard: HazardType, symptoms: string[] = []): SafetyGuidance {
  switch (hazard) {
    case 'suspected_gas_leak':
      return {
        evacuationMandatory: true,
        immediateActions: [
          'LEAVE THE BUILDING IMMEDIATELY on foot. Do not linger to gather belongings.',
          'Only if it is safe and it does not delay your exit, leave doors unlatched behind you to assist natural ventilation — never go back inside or slow your evacuation to do this.',
          'Move to a designated assembly location at least 300 feet (100 meters) upwind.',
          'Call your local national emergency number (911 in the US/Canada; 112 in India, the EU, and many other countries) or the Gas Utility Emergency Dispatch ONLY AFTER reaching a safe location outside.',
        ],
        strictProhibitions: [
          'DO NOT turn any light switches, lamps, or circuit breakers ON or OFF.',
          'DO NOT turn on exhaust fans or range hoods (fan switches create ignition sparks).',
          'DO NOT use home phones, garage door openers, or cellphones inside the leak area.',
          'DO NOT strike matches, use lighters, or introduce open flames.',
          'DO NOT attempt to manually locate the leak or operate appliances.',
        ],
        safeDistanceRecommendation: 'Minimum 300 feet (100 meters) upwind of the structure.',
        responderGuidance: [
          'Notify arriving firefighters/utility techs of suspected leak location.',
          'Advise if known occupants or pets remain inside.',
          'Keep spectators and traffic clear of the structure perimeter.',
        ],
      };

    case 'smoke_fire':
      return {
        evacuationMandatory: true,
        immediateActions: [
          'EVACUATE IMMEDIATELY via nearest clear exit.',
          'Feel closed doors with back of hand before opening; do not open hot doors.',
          'Stay low under smoke where air is cleaner.',
          'Close doors behind you to slow fire spread.',
          'Call your local national emergency number (911 in the US/Canada; 112 in India, the EU, and many other countries) from a safe outdoor location.',
        ],
        strictProhibitions: [
          'DO NOT use elevators.',
          'DO NOT re-enter the building for pets or possessions.',
          'DO NOT delay evacuation to fight spreading fires without proper training.',
        ],
        safeDistanceRecommendation: 'Outside across the street, minimum 150 feet away.',
        responderGuidance: [
          'Advise first responders of exact floor and room of smoke origin.',
          'Report any trapped occupants immediately.',
        ],
      };

    case 'medical_distress':
      return {
        evacuationMandatory: false,
        immediateActions: [
          'Ensure scene is safe before assisting.',
          'Call Emergency Medical Services immediately using your local national emergency number (911 in the US/Canada; 112 in India, the EU, and many other countries).',
          'Provide clear, fresh airflow if breathing distress is present.',
          'Keep patient calm, still, and warm.',
        ],
        strictProhibitions: [
          'DO NOT administer food, liquids, or unprescribed medication.',
          'DO NOT move a patient with suspected spinal or head trauma unless immediate danger exists.',
        ],
        safeDistanceRecommendation: 'Remain on scene in safe, well-ventilated area.',
        responderGuidance: [
          'Have someone meet the ambulance at the entrance with clear access path.',
          'Have patient medications and allergy records ready if available.',
        ],
      };

    default:
      return {
        evacuationMandatory: false,
        immediateActions: [
          'Maintain situational awareness and monitor for worsening symptoms or odors.',
          'Ensure adequate fresh air ventilation if no explosive gas is present.',
        ],
        strictProhibitions: [
          'DO NOT ignore unusual chemical odors or persistent physical symptoms.',
        ],
        safeDistanceRecommendation: 'Remain in normal living area; prepare to exit if conditions change.',
        responderGuidance: ['Monitor situation; contact non-emergency support if needed.'],
      };
  }
}
