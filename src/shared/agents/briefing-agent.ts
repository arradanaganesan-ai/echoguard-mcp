import {
  IncidentBriefing,
  IntakeAnalysis,
  RiskAssessment,
  SafetyGuidance,
  IncidentAction,
  NotificationPreview,
  BlockedActionRecord,
} from '../types.js';

export function runBriefingAgent(
  incidentId: string,
  intake: IntakeAnalysis,
  risk: RiskAssessment,
  safetyGuidance: SafetyGuidance,
  actions: IncidentAction[],
  notifications: NotificationPreview[],
  blockedRecords: BlockedActionRecord[]
): IncidentBriefing {
  const now = new Date().toISOString();

  const proposedCount = actions.filter((a) => a.status === 'PROPOSED').length;
  const simulatedCount = actions.filter((a) => a.status === 'SIMULATED' || a.status === 'COMPLETED').length;
  const blockedCount = actions.filter((a) => a.status === 'BLOCKED').length;
  const pendingApprovalCount = actions.filter((a) => a.requiresHumanApproval && !a.executedAt).length;

  const knownFacts: string[] = [
    `Reported text: "${intake.rawReport}"`,
    `Reported hazard type: ${intake.reportedHazard}`,
    `Assigned risk level: ${risk.riskLevel} (Risk score: ${risk.score}/100)`,
    `Location identified: ${intake.locationLabel}`,
  ];

  if (intake.symptoms.length > 0) {
    knownFacts.push(`Observed physical symptoms: ${intake.symptoms.join(', ')}`);
  }

  if (intake.hasSensorConfirmation) {
    knownFacts.push('Sensor confirmation: Physical hardware detector alert noted in report.');
  } else {
    knownFacts.push('Sensor confirmation: NONE (Human sensory observation only).');
  }

  const unverifiedInformation: string[] = [
    ...intake.missingInformation,
    'Precise gas concentration (LEL %) uncalibrated',
    'Structural integrity and migration paths outside observed room',
    'Confirmation of external gas meter shutoff valve operability',
  ];

  const safetyInstructionsIssued: string[] = [
    ...safetyGuidance.immediateActions,
    ...safetyGuidance.strictProhibitions.map((p) => `PROHIBITION: ${p}`),
  ];

  // Cryptographic audit-like hash summary
  const auditString = `${incidentId}:${risk.riskLevel}:${blockedCount}:${now}`;
  let hashNum = 0;
  for (let i = 0; i < auditString.length; i++) {
    hashNum = (hashNum << 5) - hashNum + auditString.charCodeAt(i);
    hashNum |= 0;
  }
  const auditHash = `EG-${Math.abs(hashNum).toString(16).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

  const summary = `EchoGuard Incident Briefing [${incidentId}]: ${risk.riskLevel} priority emergency response for ${intake.reportedHazard.replace(/_/g, ' ')}. ${
    safetyGuidance.evacuationMandatory ? 'MANDATORY EVACUATION ISSUED.' : 'PRECAUTIONARY MONITORING.'
  } Safety policy successfully screened ${actions.length} action(s), with ${blockedCount} hazardous action(s) BLOCKED under safety rules.`;

  return {
    briefingId: `BRF-${Date.now().toString(36).toUpperCase()}`,
    incidentId,
    generatedAt: now,
    summary,
    hazard: intake.reportedHazard,
    riskLevel: risk.riskLevel,
    symptoms: intake.symptoms,
    location: intake.locationLabel,
    knownFacts,
    unverifiedInformation,
    safetyInstructionsIssued,
    actionsSummary: {
      total: actions.length,
      proposed: proposedCount,
      simulated: simulatedCount,
      blocked: blockedCount,
      pendingApproval: pendingApprovalCount,
    },
    blockedActionsList: blockedRecords,
    notificationPreviews: notifications,
    outstandingUncertainties: risk.uncertainties,
    auditHash,
  };
}

export function formatBriefingAsMarkdown(b: IncidentBriefing): string {
  return `# ECHOGUARD EMERGENCY INCIDENT BRIEFING
**Incident ID:** ${b.incidentId}  
**Briefing ID:** ${b.briefingId}  
**Generated At:** ${b.generatedAt}  
**Audit Verification:** \`${b.auditHash}\`  
**Classification:** [${b.riskLevel}] ${b.hazard.toUpperCase().replace(/_/g, ' ')}  
**Location:** ${b.location}

---

## 1. Executive Summary
${b.summary}

## 2. Reported Symptoms & Observations
${b.symptoms.length > 0 ? b.symptoms.map((s) => `- ${s}`).join('\n') : '- No acute physical symptoms reported.'}

## 3. Verified Known Facts vs. Unverified Information
### Verified Facts:
${b.knownFacts.map((f) => `- [x] ${f}`).join('\n')}

### Unverified Information & Missing Data:
${b.unverifiedInformation.map((u) => `- [ ] ${u}`).join('\n')}

## 4. Safety Policy Guidance Issued
${b.safetyInstructionsIssued.map((inst) => `- ${inst}`).join('\n')}

## 5. Safety Governance & Action Audit
- **Total Actions Screened:** ${b.actionsSummary.total}
- **Simulated Safe Actions:** ${b.actionsSummary.simulated}
- **Hazardous Actions Blocked:** ${b.actionsSummary.blocked}
- **Pending Human Approval:** ${b.actionsSummary.pendingApproval}

### Actions Blocked by Hard-Coded Safety Policy:
${
  b.blockedActionsList.length > 0
    ? b.blockedActionsList
        .map(
          (blk) =>
            `- **[${blk.violatedRuleId}] BLOCKED:** Target '${blk.target}' (${blk.actionType})\n  - **Reason:** ${blk.blockedReason}\n  - **Harm Prevented:** ${blk.preventedHarm}`
        )
        .join('\n')
    : '_None. All candidate actions conformed to life-safety guidelines._'
}

## 6. Notification Previews (Non-Dispatched)
${b.notificationPreviews
  .map(
    (n) => `### To: ${n.recipientName} (${n.recipientType}) [${n.priority}]
*Subject:* ${n.draftSubject}  
\`\`\`text
${n.draftBody}
\`\`\`
*Status Notice:* ${n.disclaimer}`
  )
  .join('\n\n')}

## 7. Outstanding Uncertainties
${b.outstandingUncertainties.map((unc) => `- ${unc}`).join('\n')}

---
*EchoGuard MCP — Safety-Governed Emergency Coordination Layer. Demonstration prototype.*
`;
}

export function formatBriefingAsJson(b: IncidentBriefing): string {
  return JSON.stringify(b, null, 2);
}

/**
 * Re-synthesizes and synchronizes the incident briefing from the current
 * live actions, audit records, and safety decisions of the incident.
 */
export function syncIncidentBriefing(incident: any): IncidentBriefing {
  if (!incident.intake || !incident.risk || !incident.safetyGuidance) {
    return incident.briefing;
  }

  const blockedRecords: BlockedActionRecord[] = (incident.actions || [])
    .filter((a: any) => a.status === 'BLOCKED' && a.blockedRecord)
    .map((a: any) => a.blockedRecord);

  const updatedBriefing = runBriefingAgent(
    incident.id,
    incident.intake,
    incident.risk,
    incident.safetyGuidance,
    incident.actions || [],
    incident.notifications || [],
    blockedRecords
  );

  incident.briefing = updatedBriefing;
  incident.updatedAt = new Date().toISOString();
  return updatedBriefing;
}
