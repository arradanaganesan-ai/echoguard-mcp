import { describe, it, expect } from 'vitest';
import {
  evaluateActionSafety,
  getSafetyGuidance,
  HARD_CODED_SAFETY_RULES,
} from '../src/shared/safety-policy.js';

describe('Safety Policy Agent & Hard-Coded Rules', () => {
  it('should expose non-empty immutable safety rules', () => {
    expect(HARD_CODED_SAFETY_RULES.length).toBeGreaterThanOrEqual(4);
    const ruleIds = HARD_CODED_SAFETY_RULES.map((r) => r.id);
    expect(ruleIds).toContain('RULE-GAS-EVAC');
    expect(ruleIds).toContain('RULE-SPARK-BLOCK');
    expect(ruleIds).toContain('RULE-ACTUATOR-BLOCK');
    expect(ruleIds).toContain('RULE-NO-AUTODIAL');
  });

  describe('Gas Leak Spark Prevention (RULE-SPARK-BLOCK)', () => {
    it('should strictly BLOCK turning on exhaust fan during gas leak', () => {
      const res = evaluateActionSafety(
        'suspected_gas_leak',
        'turn_on_exhaust_fan',
        'Kitchen Range Hood'
      );
      expect(res.allowed).toBe(false);
      expect(res.violatedRule?.id).toBe('RULE-SPARK-BLOCK');
      expect(res.reason).toContain('CRITICAL SAFETY BLOCK');
      expect(res.preventedHarm).toContain('explosion');
    });

    it('should strictly BLOCK operating light switches during gas leak', () => {
      const res = evaluateActionSafety(
        'suspected_gas_leak',
        'switch_lights_on',
        'Basement Floodlight Circuit'
      );
      expect(res.allowed).toBe(false);
      expect(res.violatedRule?.id).toBe('RULE-SPARK-BLOCK');
    });

    it('should strictly BLOCK flipping electrical circuit breakers', () => {
      const res = evaluateActionSafety(
        'suspected_gas_leak',
        'toggle_breaker',
        'Main Electrical Panel'
      );
      expect(res.allowed).toBe(false);
      expect(res.violatedRule?.id).toBe('RULE-SPARK-BLOCK');
    });

    it('should allow benign actions such as audible buzzer outside or verbal evacuation instruction', () => {
      const res = evaluateActionSafety(
        'suspected_gas_leak',
        'display_screen_warning',
        'Mobile Phone Interface'
      );
      expect(res.allowed).toBe(true);
    });
  });

  describe('Physical Actuator Barrier (RULE-ACTUATOR-BLOCK)', () => {
    it('should BLOCK motorized gas solenoid valve actuation', () => {
      const res = evaluateActionSafety(
        'suspected_gas_leak',
        'solenoid_valve_actuate',
        'Main Gas Line'
      );
      expect(res.allowed).toBe(false);
      expect(res.violatedRule?.id).toBe('RULE-ACTUATOR-BLOCK');
    });

    it('should BLOCK automated smart lock actuation during emergency', () => {
      const res = evaluateActionSafety(
        'smoke_fire',
        'lock_door_remotely',
        'Front Entrance Deadbolt'
      );
      expect(res.allowed).toBe(false);
      expect(res.violatedRule?.id).toBe('RULE-ACTUATOR-BLOCK');
    });
  });

  describe('Deterministic Safety Guidance', () => {
    it('should issue mandatory evacuation and distance recommendations for gas leaks', () => {
      const guidance = getSafetyGuidance('suspected_gas_leak', ['burning eyes']);
      expect(guidance.evacuationMandatory).toBe(true);
      expect(guidance.safeDistanceRecommendation).toContain('300 feet');
      expect(guidance.strictProhibitions.some((p) => p.includes('light switches'))).toBe(true);
      expect(guidance.strictProhibitions.some((p) => p.includes('exhaust fans'))).toBe(true);
    });

    it('should issue evacuation guidance for active structure fire / smoke', () => {
      const guidance = getSafetyGuidance('smoke_fire');
      expect(guidance.evacuationMandatory).toBe(true);
      expect(guidance.strictProhibitions.some((p) => p.includes('elevators'))).toBe(true);
    });

    it('should not mandate evacuation for benign cleaning odor', () => {
      const guidance = getSafetyGuidance('benign_or_unknown');
      expect(guidance.evacuationMandatory).toBe(false);
    });
  });
});
