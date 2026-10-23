import fs from 'fs';
import path from 'path';
import { IncidentRecord, SystemStats } from '../shared/types.js';
import { runEmergencySimulation } from '../shared/orchestrator.js';
import { DEMO_SCENARIOS } from '../shared/scenarios.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const INCIDENTS_FILE = path.join(DATA_DIR, 'incidents.json');
const AUDIT_FILE = path.join(DATA_DIR, 'audit-log.json');

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  incidentId?: string;
}

class StorageService {
  private incidents: Map<string, IncidentRecord> = new Map();
  private auditLogs: AuditLogEntry[] = [];
  private initialized = false;

  constructor() {
    this.ensureDataDir();
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  public init() {
    if (this.initialized) return;

    this.ensureDataDir();

    if (fs.existsSync(INCIDENTS_FILE)) {
      try {
        const raw = fs.readFileSync(INCIDENTS_FILE, 'utf-8');
        const list: IncidentRecord[] = JSON.parse(raw);
        for (const inc of list) {
          this.incidents.set(inc.id, inc);
        }
      } catch (err) {
        console.error('Failed to parse existing incidents.json, initializing fresh store.', err);
      }
    }

    if (fs.existsSync(AUDIT_FILE)) {
      try {
        const raw = fs.readFileSync(AUDIT_FILE, 'utf-8');
        this.auditLogs = JSON.parse(raw);
      } catch (err) {
        console.error('Failed to parse audit log, initializing fresh.', err);
      }
    }

    // Seed default scenario if empty
    if (this.incidents.size === 0) {
      this.seedDefaultIncidents();
    }

    this.initialized = true;
  }

  private seedDefaultIncidents() {
    const scA = DEMO_SCENARIOS[0]; // Gas leak
    const incA = runEmergencySimulation({
      report: scA.rawReport,
      scenarioId: scA.id,
      locationHint: scA.locationHint,
      occupantsHint: scA.occupantsHint,
    });
    this.incidents.set(incA.id, incA);

    const scD = DEMO_SCENARIOS[3]; // Dangerous automation block
    const incD = runEmergencySimulation({
      report: scD.rawReport,
      scenarioId: scD.id,
      locationHint: scD.locationHint,
      occupantsHint: scD.occupantsHint,
      extraDangerousActions: scD.candidateDangerousActions,
    });
    this.incidents.set(incD.id, incD);

    this.logAudit('STORAGE_INITIALIZED', 'Seeded initial demonstration emergency incidents.', incA.id);
    this.persist();
  }

  public getAllIncidents(): IncidentRecord[] {
    this.init();
    return Array.from(this.incidents.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getIncidentById(id: string): IncidentRecord | undefined {
    this.init();
    return this.incidents.get(id);
  }

  public saveIncident(incident: IncidentRecord): IncidentRecord {
    this.init();
    this.incidents.set(incident.id, incident);
    this.logAudit(
      'INCIDENT_SAVED',
      `Incident ${incident.id} saved with status ${incident.status} (Hazard: ${incident.intake?.reportedHazard})`,
      incident.id
    );
    this.persist();
    return incident;
  }

  public updateIncident(id: string, updates: Partial<IncidentRecord>): IncidentRecord | undefined {
    this.init();
    const existing = this.incidents.get(id);
    if (!existing) return undefined;

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.incidents.set(id, updated);
    this.logAudit('INCIDENT_UPDATED', `Incident ${id} updated`, id);
    this.persist();
    return updated;
  }

  public resetDemoData(): void {
    this.incidents.clear();
    this.auditLogs = [];
    this.seedDefaultIncidents();
  }

  public logAudit(action: string, details: string, incidentId?: string): void {
    const entry: AuditLogEntry = {
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      action,
      details,
      incidentId,
    };
    this.auditLogs.unshift(entry);
    if (this.auditLogs.length > 500) {
      this.auditLogs.pop();
    }
  }

  public getAuditLogs(limit: number = 50): AuditLogEntry[] {
    this.init();
    return this.auditLogs.slice(0, limit);
  }

  public getStats(mcpConnected: boolean = true): SystemStats {
    this.init();
    const list = Array.from(this.incidents.values());
    let criticalCount = 0;
    let highCount = 0;
    let moderateCount = 0;
    let lowCount = 0;
    let totalBlockedActions = 0;
    let activeIncidents = 0;

    for (const inc of list) {
      if (inc.status === 'ACTIVE') activeIncidents++;
      if (inc.risk?.riskLevel === 'CRITICAL') criticalCount++;
      else if (inc.risk?.riskLevel === 'HIGH') highCount++;
      else if (inc.risk?.riskLevel === 'MODERATE') moderateCount++;
      else if (inc.risk?.riskLevel === 'LOW') lowCount++;

      const blockedInInc = inc.actions.filter((a) => a.status === 'BLOCKED').length;
      totalBlockedActions += blockedInInc;
    }

    return {
      totalIncidents: list.length,
      criticalCount,
      highCount,
      moderateCount,
      lowCount,
      totalBlockedActions,
      activeIncidents,
      mcpServerConnected: mcpConnected,
    };
  }

  private persist() {
    try {
      this.ensureDataDir();
      const list = Array.from(this.incidents.values());
      const incJson = JSON.stringify(list, null, 2);
      const auditJson = JSON.stringify(this.auditLogs, null, 2);

      fs.writeFileSync(INCIDENTS_FILE, incJson, 'utf-8');
      fs.writeFileSync(AUDIT_FILE, auditJson, 'utf-8');
    } catch (err) {
      // In Windows / OneDrive directories, handle transient sync lock gracefully
      console.warn('Persistence notification:', err);
    }
  }
}

export const storage = new StorageService();
