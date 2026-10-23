import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from '../src/server/storage.js';
import { runEmergencySimulation } from '../src/shared/orchestrator.js';

describe('Storage & Audit Service', () => {
  beforeEach(() => {
    storage.resetDemoData();
  });

  it('should initialize and return seeded demo incidents', () => {
    const list = storage.getAllIncidents();
    expect(list.length).toBeGreaterThanOrEqual(2);
  });

  it('should save and retrieve an incident by ID', () => {
    const newInc = runEmergencySimulation({
      report: 'Smoke smell in garage',
      locationHint: 'Garage',
    });

    storage.saveIncident(newInc);
    const retrieved = storage.getIncidentById(newInc.id);

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(newInc.id);
    expect(retrieved?.intake?.locationLabel).toBe('Garage');
  });

  it('should update incident status and record audit log', () => {
    const list = storage.getAllIncidents();
    const target = list[0];

    const updated = storage.updateIncident(target.id, { status: 'RESOLVED' });
    expect(updated?.status).toBe('RESOLVED');

    const logs = storage.getAuditLogs(10);
    expect(logs.some((l) => l.incidentId === target.id)).toBe(true);
  });

  it('should compute aggregate system stats with risk distribution', () => {
    const stats = storage.getStats(true);
    expect(stats.totalIncidents).toBeGreaterThanOrEqual(2);
    expect(stats.totalBlockedActions).toBeGreaterThanOrEqual(1);
    expect(stats.mcpServerConnected).toBe(true);
  });
});
