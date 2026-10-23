import { describe, it, expect, beforeEach } from 'vitest';
import { runEmergencySimulation } from '../src/shared/orchestrator.js';
import { evaluateActionSafety } from '../src/shared/safety-policy.js';
import { syncIncidentBriefing, formatBriefingAsMarkdown, formatBriefingAsJson } from '../src/shared/agents/briefing-agent.js';
import { storage } from '../src/server/storage.js';
import { BlockedActionRecord, IncidentAction, IncidentRecord } from '../src/shared/types.js';

describe('Safety Policy Action Lifecycle & Briefing Tally Regression Suite', () => {
  beforeEach(() => {
    storage.resetDemoData();
  });

  // Helper simulating the exact server/mcp simulateAction workflow
  function simulateCandidateAction(
    incident: IncidentRecord,
    actionType: string,
    target: string,
    parameters: Record<string, any> = {}
  ): { action: IncidentAction; incident: IncidentRecord } {
    const hazard = incident.intake?.reportedHazard || 'benign_or_unknown';
    const check = evaluateActionSafety(hazard, actionType, target, parameters);
    const now = new Date().toISOString();

    let blockedRecord: BlockedActionRecord | undefined;
    if (!check.allowed && check.violatedRule) {
      blockedRecord = {
        actionId: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        actionType,
        target,
        blockedReason: check.reason || 'Blocked by safety policy',
        violatedRuleId: check.violatedRule.id,
        timestamp: now,
        preventedHarm: check.preventedHarm || 'Harm prevented',
      };
    }

    // Check if an action of this type and target already exists to prevent accidental double-counting
    const existingIndex = incident.actions.findIndex(
      (a) => a.type === actionType && (a.target === target || a.label.includes(target))
    );

    let finalAction: IncidentAction;
    if (existingIndex !== -1) {
      incident.actions[existingIndex].status = blockedRecord ? 'BLOCKED' : 'SIMULATED';
      incident.actions[existingIndex].blockedRecord = blockedRecord;
      incident.actions[existingIndex].executedAt = blockedRecord ? undefined : now;
      finalAction = incident.actions[existingIndex];
    } else {
      finalAction = {
        id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: actionType,
        target,
        label: `Interactive Action: ${actionType} on ${target}`,
        description: `Action simulated via console: ${actionType}`,
        status: blockedRecord ? 'BLOCKED' : 'SIMULATED',
        isSimulated: true,
        requiresHumanApproval: false,
        blockedRecord,
        createdAt: now,
        executedAt: blockedRecord ? undefined : now,
      };
      incident.actions.push(finalAction);

      incident.timeline.push({
        id: `tl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: now,
        agent: blockedRecord ? 'safety' : 'coordination',
        stage: 'ACTION_EVALUATION',
        title: blockedRecord ? `SAFETY VIOLATION BLOCKED: ${target}` : `Simulated Action Approved: ${target}`,
        details: blockedRecord ? blockedRecord.blockedReason : `Action '${actionType}' permitted under current safety constraints.`,
        severity: blockedRecord ? 'critical' : 'info',
      });
    }

    syncIncidentBriefing(incident);
    storage.saveIncident(incident);

    return { action: finalAction, incident };
  }

  it('1. Trace candidate actions: initial gas leak triage creates exactly 2 safe evacuation actions', () => {
    const incident = runEmergencySimulation({
      report: 'I smell gas and my eyes are burning in the kitchen',
      locationHint: 'Kitchen',
    });

    expect(incident.actions.length).toBe(2);
    expect(incident.actions[0].type).toBe('issue_evacuation_broadcast');
    expect(incident.actions[1].type).toBe('establish_safety_perimeter');
    expect(incident.actions.every((a) => a.status === 'SIMULATED')).toBe(true);

    // Initial briefing tally
    expect(incident.briefing?.actionsSummary.total).toBe(2);
    expect(incident.briefing?.actionsSummary.simulated).toBe(2);
    expect(incident.briefing?.actionsSummary.blocked).toBe(0);
    expect(incident.briefing?.blockedActionsList.length).toBe(0);
  });

  it('2. Exhaust fan spark action is strictly BLOCKED under RULE-SPARK-BLOCK and briefing updates to 1 blocked', () => {
    const incident = runEmergencySimulation({
      report: 'I smell gas and my eyes are burning in the kitchen',
      locationHint: 'Kitchen',
    });

    const { action, incident: updated } = simulateCandidateAction(
      incident,
      'turn_on_exhaust_fan',
      'Kitchen Vent Fan'
    );

    // Decision verification
    expect(action.status).toBe('BLOCKED');
    expect(action.blockedRecord?.violatedRuleId).toBe('RULE-SPARK-BLOCK');
    expect(action.blockedRecord?.blockedReason).toContain('CRITICAL SAFETY BLOCK');
    expect(action.blockedRecord?.preventedHarm).toContain('explosion');

    // Briefing tally synchronization verification
    expect(updated.briefing?.actionsSummary.total).toBe(3);
    expect(updated.briefing?.actionsSummary.simulated).toBe(2);
    expect(updated.briefing?.actionsSummary.blocked).toBe(1);
    expect(updated.briefing?.blockedActionsList.length).toBe(1);
    expect(updated.briefing?.blockedActionsList[0].violatedRuleId).toBe('RULE-SPARK-BLOCK');
    expect(updated.briefing?.summary).toContain('3 action(s), with 1 hazardous action(s) BLOCKED');
  });

  it('3. Solenoid valve actuator action is strictly BLOCKED under RULE-ACTUATOR-BLOCK and briefing updates to 2 blocked', () => {
    const incident = runEmergencySimulation({
      report: 'I smell gas and my eyes are burning in the kitchen',
      locationHint: 'Kitchen',
    });

    // Run fan first
    simulateCandidateAction(incident, 'turn_on_exhaust_fan', 'Kitchen Vent Fan');

    // Run solenoid valve actuator
    const { action, incident: updated } = simulateCandidateAction(
      incident,
      'solenoid_valve_actuate',
      'Main Gas Solenoid Valve'
    );

    // Decision verification
    expect(action.status).toBe('BLOCKED');
    expect(action.blockedRecord?.violatedRuleId).toBe('RULE-ACTUATOR-BLOCK');
    expect(action.blockedRecord?.blockedReason).toContain('SAFETY POLICY BLOCK');
    expect(action.blockedRecord?.preventedHarm).toContain('Hardware failure');

    // Briefing tally synchronization verification
    expect(updated.briefing?.actionsSummary.total).toBe(4);
    expect(updated.briefing?.actionsSummary.simulated).toBe(2);
    expect(updated.briefing?.actionsSummary.blocked).toBe(2);
    expect(updated.briefing?.blockedActionsList.length).toBe(2);
    const ruleIds = updated.briefing?.blockedActionsList.map((b) => b.violatedRuleId);
    expect(ruleIds).toContain('RULE-SPARK-BLOCK');
    expect(ruleIds).toContain('RULE-ACTUATOR-BLOCK');
    expect(updated.briefing?.summary).toContain('4 action(s), with 2 hazardous action(s) BLOCKED');
  });

  it('4. Safe mobile-warning action is ALLOWED under status SIMULATED and briefing updates to 3 simulated safe', () => {
    const incident = runEmergencySimulation({
      report: 'I smell gas and my eyes are burning in the kitchen',
      locationHint: 'Kitchen',
    });

    // Run fan and valve
    simulateCandidateAction(incident, 'turn_on_exhaust_fan', 'Kitchen Vent Fan');
    simulateCandidateAction(incident, 'solenoid_valve_actuate', 'Main Gas Solenoid Valve');

    // Run safe mobile warning
    const { action, incident: updated } = simulateCandidateAction(
      incident,
      'display_screen_warning',
      'Resident Mobile App'
    );

    // Decision verification
    expect(action.status).toBe('SIMULATED');
    expect(action.blockedRecord).toBeUndefined();
    expect(action.executedAt).toBeDefined();

    // Briefing tally synchronization verification (Total: 5, Simulated: 3, Blocked: 2)
    expect(updated.briefing?.actionsSummary.total).toBe(5);
    expect(updated.briefing?.actionsSummary.simulated).toBe(3);
    expect(updated.briefing?.actionsSummary.blocked).toBe(2);
    expect(updated.briefing?.summary).toContain('5 action(s), with 2 hazardous action(s) BLOCKED');

    // Verify Markdown export reflects the exact 5 screened actions and 2 blocked actions
    const md = formatBriefingAsMarkdown(updated.briefing!);
    expect(md).toContain('- **Total Actions Screened:** 5');
    expect(md).toContain('- **Simulated Safe Actions:** 3');
    expect(md).toContain('- **Hazardous Actions Blocked:** 2');
    expect(md).toContain('RULE-SPARK-BLOCK');
    expect(md).toContain('RULE-ACTUATOR-BLOCK');

    // Verify JSON export has identical tallies
    const jsonStr = formatBriefingAsJson(updated.briefing!);
    const parsed = JSON.parse(jsonStr);
    expect(parsed.actionsSummary.total).toBe(5);
    expect(parsed.actionsSummary.simulated).toBe(3);
    expect(parsed.actionsSummary.blocked).toBe(2);
  });

  it('5. Repeated requests do not accidentally double-count actions (idempotent tally)', () => {
    const incident = runEmergencySimulation({
      report: 'I smell gas in the basement',
      locationHint: 'Basement',
    });

    expect(incident.briefing?.actionsSummary.total).toBe(2);
    expect(incident.briefing?.actionsSummary.blocked).toBe(0);

    // First call: exhaust fan
    simulateCandidateAction(incident, 'turn_on_exhaust_fan', 'Basement Vent Hood');
    expect(incident.briefing?.actionsSummary.total).toBe(3);
    expect(incident.briefing?.actionsSummary.blocked).toBe(1);

    // Second call: duplicate request for same exhaust fan
    simulateCandidateAction(incident, 'turn_on_exhaust_fan', 'Basement Vent Hood');
    // Must remain 3 total and 1 blocked, NOT increment to 4 and 2!
    expect(incident.briefing?.actionsSummary.total).toBe(3);
    expect(incident.briefing?.actionsSummary.blocked).toBe(1);

    // Third call: repeated request again
    simulateCandidateAction(incident, 'turn_on_exhaust_fan', 'Basement Vent Hood');
    expect(incident.briefing?.actionsSummary.total).toBe(3);
    expect(incident.briefing?.actionsSummary.blocked).toBe(1);

    // Safe action repeated request
    simulateCandidateAction(incident, 'display_screen_warning', 'Resident Mobile App');
    expect(incident.briefing?.actionsSummary.total).toBe(4);
    expect(incident.briefing?.actionsSummary.simulated).toBe(3);

    simulateCandidateAction(incident, 'display_screen_warning', 'Resident Mobile App');
    expect(incident.briefing?.actionsSummary.total).toBe(4);
    expect(incident.briefing?.actionsSummary.simulated).toBe(3);
  });

  it('6. Multiple incidents do not contaminate each other\'s tallies', () => {
    // Incident 1: Gas leak where 3 test actions are simulated
    const inc1 = runEmergencySimulation({
      report: 'Gas smell in kitchen',
      locationHint: 'Kitchen',
    });
    simulateCandidateAction(inc1, 'turn_on_exhaust_fan', 'Kitchen Vent Fan');
    simulateCandidateAction(inc1, 'solenoid_valve_actuate', 'Main Gas Solenoid Valve');
    simulateCandidateAction(inc1, 'display_screen_warning', 'Resident Mobile App');

    expect(inc1.briefing?.actionsSummary.total).toBe(5);
    expect(inc1.briefing?.actionsSummary.blocked).toBe(2);
    expect(inc1.briefing?.actionsSummary.simulated).toBe(3);

    // Incident 2: Separate smoke fire incident
    const inc2 = runEmergencySimulation({
      report: 'Smoke detector beeping in bedroom with smoke',
      locationHint: 'Bedroom',
    });

    // Incident 2 must start with its own isolated actions and 0 blocked
    expect(inc2.actions.length).toBe(2);
    expect(inc2.briefing?.actionsSummary.total).toBe(2);
    expect(inc2.briefing?.actionsSummary.blocked).toBe(0);
    expect(inc2.briefing?.actionsSummary.simulated).toBe(2);

    // Simulate only safe action on Incident 2
    simulateCandidateAction(inc2, 'display_screen_warning', 'Occupant Phone');
    expect(inc2.briefing?.actionsSummary.total).toBe(3);
    expect(inc2.briefing?.actionsSummary.blocked).toBe(0);
    expect(inc2.briefing?.actionsSummary.simulated).toBe(3);

    // Reload Incident 1 and verify it was NOT affected by Incident 2
    const reloadedInc1 = storage.getIncidentById(inc1.id)!;
    expect(reloadedInc1.briefing?.actionsSummary.total).toBe(5);
    expect(reloadedInc1.briefing?.actionsSummary.blocked).toBe(2);
    expect(reloadedInc1.briefing?.actionsSummary.simulated).toBe(3);
  });
});
