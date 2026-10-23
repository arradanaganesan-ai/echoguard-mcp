import {
  IncidentRecord,
  IncidentTimelineEvent,
  IntakeAnalysis,
  RiskAssessment,
  SafetyGuidance,
  IncidentAction,
  NotificationPreview,
  BlockedActionRecord,
  IncidentBriefing,
} from './types.js';
import { runIntakeAgent } from './agents/intake-agent.js';
import { runRiskAgent } from './agents/risk-agent.js';
import { runCoordinationAgent } from './agents/coordination-agent.js';
import { runSafetyAgent } from './agents/safety-agent.js';
import { runBriefingAgent } from './agents/briefing-agent.js';
import { DEMO_SCENARIOS } from './scenarios.js';

export interface RunSimulationOptions {
  report: string;
  scenarioId?: string;
  locationHint?: string;
  occupantsHint?: string;
  extraDangerousActions?: Array<{
    type: string;
    target: string;
    label: string;
    description: string;
  }>;
}

export function runEmergencySimulation(options: RunSimulationOptions): IncidentRecord {
  const incidentId = `INC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const now = new Date().toISOString();
  const timeline: IncidentTimelineEvent[] = [];

  // Initial event
  timeline.push({
    id: `tl-1`,
    timestamp: now,
    agent: 'human',
    stage: 'REPORT_INTAKE',
    title: 'Emergency Incident Ingested',
    details: `Incoming report: "${options.report.slice(0, 80)}${options.report.length > 80 ? '...' : ''}"`,
    severity: 'info',
  });

  // Step 1: Intake Agent
  const intake: IntakeAnalysis = runIntakeAgent(
    options.report,
    incidentId,
    options.locationHint,
    options.occupantsHint
  );

  timeline.push({
    id: `tl-2`,
    timestamp: new Date().toISOString(),
    agent: 'intake',
    stage: 'INTAKE_ANALYSIS',
    title: 'Intake Parsing & Provenance Tagging Complete',
    details: `Detected hazard: ${intake.reportedHazard}. Identified ${intake.symptoms.length} symptom(s). Marked ${intake.missingInformation.length} fact(s) as UNVERIFIED.`,
    severity: intake.reportedHazard === 'suspected_gas_leak' ? 'warning' : 'info',
  });

  // Step 2: Risk Assessment Agent
  const risk: RiskAssessment = runRiskAgent(intake);

  timeline.push({
    id: `tl-3`,
    timestamp: new Date().toISOString(),
    agent: 'risk',
    stage: 'RISK_ASSESSMENT',
    title: `Risk Assessment: [${risk.riskLevel}] (Score: ${risk.score}/100)`,
    details: `Posture: ${risk.recommendedPosture}. Primary Factor: ${risk.primaryFactors[0] || 'N/A'}.`,
    severity: risk.riskLevel === 'CRITICAL' ? 'critical' : risk.riskLevel === 'HIGH' ? 'warning' : 'info',
  });

  // Check if scenario had candidate dangerous actions
  let candidateDangerous = options.extraDangerousActions || [];
  if (options.scenarioId) {
    const sc = DEMO_SCENARIOS.find((s) => s.id === options.scenarioId);
    if (sc && sc.candidateDangerousActions) {
      candidateDangerous = [...candidateDangerous, ...sc.candidateDangerousActions];
    }
  }

  // Step 3: Coordination Agent
  const coordination = runCoordinationAgent(intake, risk, candidateDangerous);

  timeline.push({
    id: `tl-4`,
    timestamp: new Date().toISOString(),
    agent: 'coordination',
    stage: 'ACTION_PLANNING',
    title: 'Multi-Agent Coordination Plan Formulated',
    details: `Generated ${coordination.actions.length} candidate actions and ${coordination.notifications.length} notification drafts.`,
    severity: 'info',
  });

  // Step 4: Safety Policy Agent
  const safetyResult = runSafetyAgent(intake.reportedHazard, intake.symptoms, coordination.actions);

  if (safetyResult.blockedRecords.length > 0) {
    timeline.push({
      id: `tl-5`,
      timestamp: new Date().toISOString(),
      agent: 'safety',
      stage: 'POLICY_ENFORCEMENT',
      title: `SAFETY POLICY INTERVENTION: ${safetyResult.blockedRecords.length} Action(s) BLOCKED`,
      details: safetyResult.blockedRecords
        .map((b) => `Blocked '${b.target}' via ${b.violatedRuleId}: ${b.preventedHarm}`)
        .join('; '),
      severity: 'critical',
    });
  } else {
    timeline.push({
      id: `tl-5`,
      timestamp: new Date().toISOString(),
      agent: 'safety',
      stage: 'POLICY_ENFORCEMENT',
      title: 'Safety Policy Screen Passed',
      details: 'All proposed actions comply with life-safety constraints.',
      severity: 'success',
    });
  }

  // Step 5: Incident Briefing Agent
  const briefing: IncidentBriefing = runBriefingAgent(
    incidentId,
    intake,
    risk,
    safetyResult.guidance,
    safetyResult.filteredActions,
    coordination.notifications,
    safetyResult.blockedRecords
  );

  timeline.push({
    id: `tl-6`,
    timestamp: new Date().toISOString(),
    agent: 'briefing',
    stage: 'BRIEFING_SYNTHESIS',
    title: 'Responder-Ready Briefing Synthesized',
    details: `Audit hash: ${briefing.auditHash}. Ready for command download / transmission preview.`,
    severity: 'success',
  });

  return {
    id: incidentId,
    createdAt: now,
    updatedAt: new Date().toISOString(),
    status: 'ACTIVE',
    rawReport: options.report,
    scenarioId: options.scenarioId,
    intake,
    risk,
    safetyGuidance: safetyResult.guidance,
    actions: safetyResult.filteredActions,
    notifications: coordination.notifications,
    briefing,
    timeline,
  };
}
