import {
  HazardType,
  IncidentAction,
  NotificationPreview,
  RiskAssessment,
  IntakeAnalysis,
} from '../types.js';

export interface CoordinationPlan {
  actions: IncidentAction[];
  notifications: NotificationPreview[];
}

export function runCoordinationAgent(
  intake: IntakeAnalysis,
  risk: RiskAssessment,
  requestedDangerousActions: Array<{ type: string; target: string; label: string; description: string }> = []
): CoordinationPlan {
  const actions: IncidentAction[] = [];
  const now = new Date().toISOString();

  // 1. Mandatory Evacuation Order Action
  if (risk.riskLevel === 'CRITICAL' || risk.riskLevel === 'HIGH') {
    actions.push({
      id: `act-${Date.now()}-1`,
      type: 'issue_evacuation_broadcast',
      label: 'Immediate Occupant Evacuation Directive',
      description: 'Issue urgent visual and audible directive to immediately vacate the structure on foot.',
      status: 'SIMULATED',
      isSimulated: true,
      requiresHumanApproval: false,
      createdAt: now,
      executedAt: now,
    });

    actions.push({
      id: `act-${Date.now()}-2`,
      type: 'establish_safety_perimeter',
      label: 'Designate 300ft Upwind Assembly Zone',
      description: 'Mark safe staging radius upwind away from the affected gas migration pathway.',
      status: 'SIMULATED',
      isSimulated: true,
      requiresHumanApproval: false,
      createdAt: now,
      executedAt: now,
    });
  }

  // 2. Add any user-requested or scenario-driven candidate actions (e.g. unsafe automation requests)
  for (let i = 0; i < requestedDangerousActions.length; i++) {
    const item = requestedDangerousActions[i];
    actions.push({
      id: `act-req-${Date.now()}-${i + 1}`,
      type: item.type,
      label: item.label,
      description: item.description,
      status: 'PROPOSED',
      isSimulated: true,
      requiresHumanApproval: false,
      createdAt: now,
    });
  }

  // 3. Draft Notification Previews
  const notifications: NotificationPreview[] = [];

  if (intake.reportedHazard === 'suspected_gas_leak') {
    notifications.push({
      id: `notif-${Date.now()}-1`,
      recipientType: 'emergency_services',
      recipientName: 'Metro Fire & 911 Communications',
      priority: 'CRITICAL',
      draftSubject: `[PRIORITY-1] Suspected Gas Leak — Immediate Evacuation Underway`,
      draftBody: `EMERGENCY ALERT PREVIEW:\nLocation: ${intake.locationLabel}\nReport: ${intake.rawReport}\nSymptoms Noted: ${
        intake.symptoms.length > 0 ? intake.symptoms.join(', ') : 'None specified'
      }\nStatus: Occupants instructed to evacuate to 300ft perimeter. Spark/switch prohibitions active.`,
      disclaimer: 'SIMULATED DISPATCH PREVIEW: EchoGuard does not place automatic calls to emergency numbers (911/112) without human verification.',
      requiresApproval: true,
      approved: false,
    });

    notifications.push({
      id: `notif-${Date.now()}-2`,
      recipientType: 'gas_utility',
      recipientName: 'Regional Natural Gas Emergency Response Desk',
      priority: 'HIGH',
      draftSubject: `Gas Leak Report Notification — ${intake.locationLabel}`,
      draftBody: `Utility Incident Notification Preview:\nReported odor of mercaptan / gas. Occupants evacuating. Request emergency utility crew for exterior line shutoff and atmospheric LEL survey.`,
      disclaimer: 'SIMULATION PREVIEW: No external API request transmitted.',
      requiresApproval: true,
      approved: false,
    });

    notifications.push({
      id: `notif-${Date.now()}-3`,
      recipientType: 'emergency_contact',
      recipientName: 'Primary Emergency Contact (Family Circle)',
      priority: 'HIGH',
      draftSubject: 'Urgent Safety Update: Household Evacuation in Progress',
      draftBody: `Automated EchoGuard Notice:\nA suspected gas leak was reported at the residence. Everyone has been instructed to exit immediately and gather upwind outside. Please call their mobile phone to verify safety.`,
      disclaimer: 'Draft notification preview. Requires occupant confirmation.',
      requiresApproval: true,
      approved: false,
    });
  } else if (intake.reportedHazard === 'smoke_fire') {
    notifications.push({
      id: `notif-${Date.now()}-1`,
      recipientType: 'emergency_services',
      recipientName: 'Fire Department Emergency Dispatch',
      priority: 'CRITICAL',
      draftSubject: `[CODE RED] Structure Fire / Smoke Incident — ${intake.locationLabel}`,
      draftBody: `Active smoke/fire alert. Occupants evacuating. Origin report: "${intake.rawReport}".`,
      disclaimer: 'Simulation preview. No live transmission.',
      requiresApproval: true,
      approved: false,
    });
  }

  return {
    actions,
    notifications,
  };
}
