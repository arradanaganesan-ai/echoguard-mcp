import {
  HazardType,
  IncidentAction,
  SafetyGuidance,
  BlockedActionRecord,
} from '../types.js';
import {
  evaluateActionSafety,
  getSafetyGuidance,
  HARD_CODED_SAFETY_RULES,
} from '../safety-policy.js';

export interface SafetyAgentResult {
  guidance: SafetyGuidance;
  filteredActions: IncidentAction[];
  blockedRecords: BlockedActionRecord[];
  rulesApplied: string[];
}

export function runSafetyAgent(
  hazard: HazardType,
  symptoms: string[],
  candidateActions: IncidentAction[]
): SafetyAgentResult {
  const guidance = getSafetyGuidance(hazard, symptoms);
  const filteredActions: IncidentAction[] = [];
  const blockedRecords: BlockedActionRecord[] = [];
  const rulesAppliedSet = new Set<string>();

  rulesAppliedSet.add('RULE-GAS-EVAC');

  for (const action of candidateActions) {
    const target = action.target || action.label;
    const safetyCheck = evaluateActionSafety(hazard, action.type, target);

    if (!safetyCheck.allowed && safetyCheck.violatedRule) {
      rulesAppliedSet.add(safetyCheck.violatedRule.id);

      const blockedRecord: BlockedActionRecord = {
        actionId: action.id,
        actionType: action.type,
        target,
        blockedReason: safetyCheck.reason || 'Blocked by hard-coded safety policy.',
        violatedRuleId: safetyCheck.violatedRule.id,
        timestamp: new Date().toISOString(),
        preventedHarm: safetyCheck.preventedHarm || 'Mitigated catastrophic safety risk.',
      };

      blockedRecords.push(blockedRecord);

      // Mutate status to BLOCKED with audit details
      filteredActions.push({
        ...action,
        status: 'BLOCKED',
        blockedRecord,
      });
    } else {
      filteredActions.push(action);
    }
  }

  return {
    guidance,
    filteredActions,
    blockedRecords,
    rulesApplied: Array.from(rulesAppliedSet),
  };
}
