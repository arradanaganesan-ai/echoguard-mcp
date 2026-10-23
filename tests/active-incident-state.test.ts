import { describe, it, expect, beforeEach } from 'vitest';
import { resolveActiveIncident } from '../src/client/App.js';
import { runEmergencySimulation } from '../src/shared/orchestrator.js';
import { storage } from '../src/server/storage.js';
import { IncidentRecord } from '../src/shared/types.js';

describe('Regression Test: Active Incident State Resolution', () => {
  let smokeFireIncident: IncidentRecord;
  let gasLeakIncident: IncidentRecord;

  beforeEach(() => {
    storage.resetDemoData();

    // 1. Create an older Smoke Fire incident
    smokeFireIncident = runEmergencySimulation({
      report: 'Thick smoke is coming out of the furnace utility closet and alarm is beeping',
      scenarioId: 'scenario-b',
      locationHint: 'Furnace Utility Closet',
    });
    storage.saveIncident(smokeFireIncident);

    // 2. Create a subsequent Gas Leak incident
    gasLeakIncident = runEmergencySimulation({
      report: 'I smell gas and my eyes are burning in the kitchen',
      scenarioId: 'scenario-a',
      locationHint: 'Kitchen',
    });
    storage.saveIncident(gasLeakIncident);
  });

  it('demonstrates bug prevention: new gas-leak incident remains selected when older smoke fire incident was active', () => {
    // State before simulation: Smoke Fire is the currently active incident
    const currentActive: IncidentRecord = smokeFireIncident;
    expect(currentActive.intake?.reportedHazard).toBe('smoke_fire');

    const allIncidents = storage.getAllIncidents();
    expect(allIncidents.some((i) => i.id === smokeFireIncident.id)).toBe(true);
    expect(allIncidents.some((i) => i.id === gasLeakIncident.id)).toBe(true);

    // Old Bug Behavior Simulation:
    // In the old code, loadData closed over activeIncident (smokeFireIncident)
    // and executed: fetchedIncidents.find(i => i.id === activeIncident.id)
    const buggyRevertedIncident = allIncidents.find((i) => i.id === currentActive.id);
    expect(buggyRevertedIncident?.intake?.reportedHazard).toBe('smoke_fire'); // Bug: would overwrite new incident

    // Fixed Behavior:
    // resolveActiveIncident takes the newly created incident ID as preferredIncidentId
    const resolvedActive = resolveActiveIncident(
      allIncidents,
      currentActive,
      gasLeakIncident.id
    );

    // Assertions:
    expect(resolvedActive).toBeDefined();
    expect(resolvedActive?.id).toBe(gasLeakIncident.id);
    expect(resolvedActive?.intake?.reportedHazard).toBe('suspected_gas_leak');
    expect(resolvedActive?.risk?.riskLevel).toBe('CRITICAL');
    expect(resolvedActive?.id).not.toBe(smokeFireIncident.id);
  });

  it('preserves current active incident across subsequent background refreshes when no preferred ID is passed', () => {
    // Once Gas Leak is active:
    const currentActive: IncidentRecord = gasLeakIncident;
    const allIncidents = storage.getAllIncidents();

    // Background refresh runs without preferredIncidentId
    const refreshed = resolveActiveIncident(allIncidents, currentActive);

    expect(refreshed).toBeDefined();
    expect(refreshed?.id).toBe(gasLeakIncident.id);
    expect(refreshed?.intake?.reportedHazard).toBe('suspected_gas_leak');
  });

  it('defaults to the first incident on initial load when currentActive is null and no preferred ID is provided', () => {
    const allIncidents = storage.getAllIncidents();
    const resolved = resolveActiveIncident(allIncidents, null);

    expect(resolved).toBeDefined();
    expect(resolved?.id).toBe(allIncidents[0].id);
  });
});
