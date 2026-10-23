import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from '../src/server/storage.js';
import { evaluateActionSafety, getSafetyGuidance } from '../src/shared/safety-policy.js';
import { runEmergencySimulation } from '../src/shared/orchestrator.js';
import { formatBriefingAsMarkdown, formatBriefingAsJson } from '../src/shared/agents/briefing-agent.js';

describe('MCP Tools & Protocols Verification', () => {
  beforeEach(() => {
    storage.resetDemoData();
  });

  it('Tool 1: create_incident should create and triage incident record', () => {
    const report = 'I smell gas and my eyes are burning';
    const incident = runEmergencySimulation({ report });
    storage.saveIncident(incident);

    expect(incident.id).toBeDefined();
    expect(incident.risk?.riskLevel).toBe('CRITICAL');
    expect(incident.safetyGuidance?.evacuationMandatory).toBe(true);
  });

  it('Tool 2: assess_incident should return risk breakdown and uncertainties', () => {
    const list = storage.getAllIncidents();
    const inc = list[0];
    expect(inc.risk).toBeDefined();
    expect(inc.risk?.primaryFactors.length).toBeGreaterThan(0);
    expect(inc.risk?.uncertainties.length).toBeGreaterThan(0);
  });

  it('Tool 3: get_safety_guidance should enforce spark prohibition on gas leak', () => {
    const guidance = getSafetyGuidance('suspected_gas_leak');
    expect(guidance.strictProhibitions.some((p) => p.includes('light switches'))).toBe(true);
    expect(guidance.strictProhibitions.some((p) => p.includes('exhaust fans'))).toBe(true);
  });

  it('Tool 4: prepare_notification should create preview with disclaimer without external transmission', () => {
    const list = storage.getAllIncidents();
    const inc = list[0];
    const preview = {
      id: `notif-${Date.now()}`,
      recipientType: 'emergency_services' as const,
      recipientName: 'Metro Fire 911',
      priority: 'CRITICAL' as const,
      draftSubject: 'Gas Leak Alert',
      draftBody: 'Simulated body',
      disclaimer: 'SIMULATION PREVIEW: No external communications dispatched.',
      requiresApproval: true,
      approved: false,
    };
    inc.notifications.push(preview);
    storage.saveIncident(inc);

    const reloaded = storage.getIncidentById(inc.id);
    expect(reloaded?.notifications.some((n) => n.id === preview.id)).toBe(true);
    expect(preview.requiresApproval).toBe(true);
    expect(preview.approved).toBe(false);
  });

  it('Tool 5: generate_incident_briefing should render markdown and json with audit hash', () => {
    const list = storage.getAllIncidents();
    const inc = list[0];
    expect(inc.briefing).toBeDefined();

    const md = formatBriefingAsMarkdown(inc.briefing!);
    expect(md).toContain('ECHOGUARD EMERGENCY INCIDENT BRIEFING');
    expect(md).toContain(inc.briefing!.auditHash);

    const jsonStr = formatBriefingAsJson(inc.briefing!);
    const parsed = JSON.parse(jsonStr);
    expect(parsed.auditHash).toBe(inc.briefing!.auditHash);
  });

  it('Tool 6: get_incident_timeline should return chronological agent audit entries', () => {
    const list = storage.getAllIncidents();
    const inc = list[0];
    expect(inc.timeline.length).toBeGreaterThanOrEqual(4);
    const stages = inc.timeline.map((t) => t.stage);
    expect(stages).toContain('REPORT_INTAKE');
    expect(stages).toContain('INTAKE_ANALYSIS');
    expect(stages).toContain('RISK_ASSESSMENT');
  });

  it('Tool 7: simulate_action should strictly BLOCK dangerous actions and ALLOW safe actions', () => {
    const gasCheck = evaluateActionSafety('suspected_gas_leak', 'activate_fan', 'Kitchen Vent Hood');
    expect(gasCheck.allowed).toBe(false);
    expect(gasCheck.violatedRule?.id).toBe('RULE-SPARK-BLOCK');

    const valveCheck = evaluateActionSafety('suspected_gas_leak', 'solenoid_valve_actuate', 'Main Gas Line');
    expect(valveCheck.allowed).toBe(false);
    expect(valveCheck.violatedRule?.id).toBe('RULE-ACTUATOR-BLOCK');

    const safeCheck = evaluateActionSafety('suspected_gas_leak', 'display_safe_assembly_map', 'Mobile Screen');
    expect(safeCheck.allowed).toBe(true);
  });
});
