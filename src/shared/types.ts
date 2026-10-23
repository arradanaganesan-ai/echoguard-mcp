/**
 * EchoGuard MCP — Shared Domain Types
 * Safety-Governed Emergency Intelligence
 */

export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';

export type HazardType =
  | 'suspected_gas_leak'
  | 'smoke_fire'
  | 'medical_distress'
  | 'electrical_hazard'
  | 'benign_or_unknown';

export type EvidenceSource = 'user_reported' | 'sensor_verified' | 'inferred';

export interface EvidenceItem {
  id: string;
  source: EvidenceSource;
  description: string;
  confidence: number; // 0.0 to 1.0
  timestamp: string;
  verified: boolean;
}

export interface IntakeAnalysis {
  incidentId: string;
  rawReport: string;
  timestamp: string;
  reportedHazard: HazardType;
  symptoms: string[];
  locationLabel: string;
  evidence: EvidenceItem[];
  missingInformation: string[];
  occupantsEstimated: string | 'unknown';
  hasSensorConfirmation: boolean;
}

export interface RiskAssessment {
  riskLevel: RiskLevel;
  hazard: HazardType;
  confidence: number;
  score: number; // 0-100
  primaryFactors: string[];
  uncertainties: string[];
  recommendedPosture: string;
  isSimulatedAssessment: true;
  assessedAt: string;
  disclaimer: string;
}

export interface SafetyRule {
  id: string;
  name: string;
  category: 'evacuation' | 'spark_prevention' | 'actuator_isolation' | 'communication' | 'medical';
  description: string;
  severity: 'MANDATORY' | 'BLOCKING' | 'ADVISORY';
  rationale: string;
}

export interface BlockedActionRecord {
  actionId: string;
  actionType: string;
  target: string;
  blockedReason: string;
  violatedRuleId: string;
  timestamp: string;
  preventedHarm: string;
}

export type ActionStatus =
  | 'PROPOSED'
  | 'SIMULATED'
  | 'BLOCKED'
  | 'PENDING_HUMAN_APPROVAL'
  | 'COMPLETED';

export interface IncidentAction {
  id: string;
  type: string;
  target?: string;
  label: string;
  description: string;
  status: ActionStatus;
  isSimulated: boolean;
  requiresHumanApproval: boolean;
  blockedRecord?: BlockedActionRecord;
  createdAt: string;
  executedAt?: string;
}

export interface NotificationPreview {
  id: string;
  recipientType: 'emergency_services' | 'gas_utility' | 'emergency_contact' | 'building_management';
  recipientName: string;
  priority: 'CRITICAL' | 'HIGH' | 'ROUTINE';
  draftSubject: string;
  draftBody: string;
  disclaimer: string;
  requiresApproval: boolean;
  approved: boolean;
}

export interface SafetyGuidance {
  immediateActions: string[];
  strictProhibitions: string[];
  evacuationMandatory: boolean;
  safeDistanceRecommendation: string;
  responderGuidance: string[];
}

export interface IncidentBriefing {
  briefingId: string;
  incidentId: string;
  generatedAt: string;
  summary: string;
  hazard: HazardType;
  riskLevel: RiskLevel;
  symptoms: string[];
  location: string;
  knownFacts: string[];
  unverifiedInformation: string[];
  safetyInstructionsIssued: string[];
  actionsSummary: {
    total: number;
    proposed: number;
    simulated: number;
    blocked: number;
    pendingApproval: number;
  };
  blockedActionsList: BlockedActionRecord[];
  notificationPreviews: NotificationPreview[];
  outstandingUncertainties: string[];
  auditHash: string;
}

export interface IncidentTimelineEvent {
  id: string;
  timestamp: string;
  agent: 'intake' | 'risk' | 'safety' | 'coordination' | 'briefing' | 'mcp' | 'human';
  stage: string;
  title: string;
  details: string;
  severity: 'info' | 'warning' | 'critical' | 'success';
}

export interface IncidentRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: 'ACTIVE' | 'RESOLVED' | 'UNDER_REVIEW';
  rawReport: string;
  scenarioId?: string;
  intake?: IntakeAnalysis;
  risk?: RiskAssessment;
  safetyGuidance?: SafetyGuidance;
  actions: IncidentAction[];
  notifications: NotificationPreview[];
  briefing?: IncidentBriefing;
  timeline: IncidentTimelineEvent[];
}

export interface SystemStats {
  totalIncidents: number;
  criticalCount: number;
  highCount: number;
  moderateCount: number;
  lowCount: number;
  totalBlockedActions: number;
  activeIncidents: number;
  mcpServerConnected: boolean;
}

/**
 * Client-side result of an interactive action simulation request.
 * Returned by the App layer so the Live Console can render immediate,
 * visible feedback (loading -> simulated / blocked / error).
 */
export interface SimulateActionFeedback {
  ok: boolean;
  action?: IncidentAction;
  incidentId?: string;
  error?: string;
}
