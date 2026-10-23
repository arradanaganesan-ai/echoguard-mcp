import { describe, it, expect } from 'vitest';
import { runIntakeAgent } from '../src/shared/agents/intake-agent.js';
import { runRiskAgent } from '../src/shared/agents/risk-agent.js';
import { runCoordinationAgent } from '../src/shared/agents/coordination-agent.js';
import { runSafetyAgent } from '../src/shared/agents/safety-agent.js';
import { runBriefingAgent, formatBriefingAsMarkdown } from '../src/shared/agents/briefing-agent.js';
import { runEmergencySimulation } from '../src/shared/orchestrator.js';
import { DEMO_SCENARIOS } from '../src/shared/scenarios.js';

describe('Deterministic Specialist Agents Suite', () => {
  describe('Incident Intake Agent', () => {
    it('should accurately parse gas leak odor and burning eyes symptoms', () => {
      const report = 'I smell gas and my eyes are burning in the kitchen.';
      const intake = runIntakeAgent(report, 'INC-TEST-1', 'Kitchen');

      expect(intake.reportedHazard).toBe('suspected_gas_leak');
      expect(intake.symptoms.length).toBeGreaterThan(0);
      expect(intake.symptoms.some((s) => s.toLowerCase().includes('ocular') || s.toLowerCase().includes('burning'))).toBe(true);
      expect(intake.locationLabel).toBe('Kitchen');
      expect(intake.hasSensorConfirmation).toBe(false);
      expect(intake.missingInformation.length).toBeGreaterThan(0);
    });

    it('should flag missing sensor reading instead of hallucinating facts', () => {
      const intake = runIntakeAgent('I smell something weird near the front door.');
      expect(intake.missingInformation.some((m) => m.toLowerCase().includes('sensor') || m.toLowerCase().includes('ppm'))).toBe(true);
    });

    it('should detect sensor alarm confirmation when physical detector is mentioned', () => {
      const intake = runIntakeAgent('Smoke detector beeping and smoke in hallway');
      expect(intake.reportedHazard).toBe('smoke_fire');
      expect(intake.hasSensorConfirmation).toBe(true);
    });
  });

  describe('Risk Assessment Agent', () => {
    it('should assign CRITICAL risk score to gas leak with acute symptoms', () => {
      const intake = runIntakeAgent('I smell gas and my eyes are burning');
      const risk = runRiskAgent(intake);

      expect(risk.riskLevel).toBe('CRITICAL');
      expect(risk.score).toBeGreaterThanOrEqual(90);
      expect(risk.isSimulatedAssessment).toBe(true);
      expect(risk.disclaimer).toContain('SIMULATION NOTICE');
    });

    it('should assign LOW risk to non-emergency benign household report', () => {
      const intake = runIntakeAgent('Cleaned table with vinegar, smells like salad');
      const risk = runRiskAgent(intake);

      expect(risk.riskLevel).toBe('LOW');
      expect(risk.score).toBeLessThanOrEqual(25);
    });
  });

  describe('Multi-Agent Emergency Simulation & Orchestration', () => {
    it('should execute end-to-end Scenario A with mandatory evacuation', () => {
      const sc = DEMO_SCENARIOS[0];
      const incident = runEmergencySimulation({
        report: sc.rawReport,
        scenarioId: sc.id,
        locationHint: sc.locationHint,
      });

      expect(incident.id).toBeDefined();
      expect(incident.intake?.reportedHazard).toBe('suspected_gas_leak');
      expect(incident.risk?.riskLevel).toBe('CRITICAL');
      expect(incident.safetyGuidance?.evacuationMandatory).toBe(true);
      expect(incident.briefing?.auditHash).toBeDefined();
      expect(incident.timeline.length).toBeGreaterThanOrEqual(5);
    });

    it('should execute Scenario D and demonstrably block dangerous candidate actions', () => {
      const sc = DEMO_SCENARIOS[3]; // Dangerous automation
      const incident = runEmergencySimulation({
        report: sc.rawReport,
        scenarioId: sc.id,
        extraDangerousActions: sc.candidateDangerousActions,
      });

      const blockedActions = incident.actions.filter((a) => a.status === 'BLOCKED');
      expect(blockedActions.length).toBeGreaterThanOrEqual(2);
      for (const blocked of blockedActions) {
        expect(blocked.blockedRecord).toBeDefined();
        expect(blocked.blockedRecord?.violatedRuleId).toMatch(/RULE-SPARK-BLOCK|RULE-ACTUATOR-BLOCK/);
      }

      // Check briefing records blocked count
      expect(incident.briefing?.actionsSummary.blocked).toBe(blockedActions.length);
    });

    it('should format briefing cleanly into Markdown with audit hash', () => {
      const incident = runEmergencySimulation({
        report: 'I smell gas and my eyes are burning in kitchen',
      });
      expect(incident.briefing).toBeDefined();

      const md = formatBriefingAsMarkdown(incident.briefing!);
      expect(md).toContain('# ECHOGUARD EMERGENCY INCIDENT BRIEFING');
      expect(md).toContain('Audit Verification:');
      expect(md).toContain('MANDATORY EVACUATION');
    });
  });
});
