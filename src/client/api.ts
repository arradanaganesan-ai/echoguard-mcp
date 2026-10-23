import {
  IncidentRecord,
  SystemStats,
  SafetyRule,
  IncidentAction,
  NotificationPreview,
  BlockedActionRecord,
} from '../shared/types.js';
import { DemoScenario, DEMO_SCENARIOS } from '../shared/scenarios.js';
import { HARD_CODED_SAFETY_RULES, evaluateActionSafety } from '../shared/safety-policy.js';
import { runEmergencySimulation } from '../shared/orchestrator.js';
import { syncIncidentBriefing } from '../shared/agents/briefing-agent.js';

const API_BASE = '/api';

export const api = {
  async getHealth() {
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (!res.ok) throw new Error('Health check failed');
      return await res.json();
    } catch {
      return { status: 'local_fallback', mode: 'demo', mcpTransport: 'stdio (simulated)' };
    }
  },

  async getStats(): Promise<SystemStats> {
    try {
      const res = await fetch(`${API_BASE}/stats`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      return await res.json();
    } catch {
      return {
        totalIncidents: 2,
        criticalCount: 2,
        highCount: 0,
        moderateCount: 0,
        lowCount: 0,
        totalBlockedActions: 3,
        activeIncidents: 2,
        mcpServerConnected: true,
      };
    }
  },

  async getScenarios(): Promise<DemoScenario[]> {
    try {
      const res = await fetch(`${API_BASE}/scenarios`);
      if (!res.ok) throw new Error('Failed to fetch scenarios');
      return await res.json();
    } catch {
      return DEMO_SCENARIOS;
    }
  },

  async getSafetyRules(): Promise<ReadonlyArray<SafetyRule>> {
    try {
      const res = await fetch(`${API_BASE}/safety-rules`);
      if (!res.ok) throw new Error('Failed to fetch safety rules');
      return await res.json();
    } catch {
      return HARD_CODED_SAFETY_RULES;
    }
  },

  async getMcpStatus() {
    try {
      const res = await fetch(`${API_BASE}/mcp/status`);
      if (!res.ok) throw new Error('Failed to fetch MCP status');
      return await res.json();
    } catch {
      return {
        connected: false,
        serverName: 'echoguard-mcp',
        transport: 'stdio (standalone)',
        version: '1.0.0',
        tools: [],
      };
    }
  },

  async getIncidents(): Promise<IncidentRecord[]> {
    try {
      const res = await fetch(`${API_BASE}/incidents`);
      if (!res.ok) throw new Error('Failed to fetch incidents');
      return await res.json();
    } catch {
      return [];
    }
  },

  async getIncidentById(id: string): Promise<IncidentRecord | null> {
    try {
      const res = await fetch(`${API_BASE}/incidents/${id}`);
      if (!res.ok) throw new Error('Failed to fetch incident');
      return await res.json();
    } catch {
      return null;
    }
  },

  async createIncident(payload: {
    report: string;
    scenarioId?: string;
    locationHint?: string;
    occupantsHint?: string;
  }): Promise<IncidentRecord> {
    try {
      const res = await fetch(`${API_BASE}/incidents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to create incident on server');
      return await res.json();
    } catch (err) {
      console.warn('API unavailable, running deterministic in-browser simulation fallback:', err);
      return runEmergencySimulation(payload);
    }
  },

  async simulateAction(incidentId: string, payload: { actionType: string; target: string }): Promise<{ action: IncidentAction; incident: IncidentRecord }> {
    try {
      const res = await fetch(`${API_BASE}/incidents/${incidentId}/simulate-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        // Surface the server's error detail so the UI can show a precise reason
        let detail = '';
        try {
          const body = await res.json();
          if (body && typeof body.error === 'string') detail = `: ${body.error}`;
        } catch {
          // Non-JSON error body; fall through to generic message
        }
        throw new Error(`Simulate-action request failed (${res.status})${detail}`);
      }
      return await res.json();
    } catch (err) {
      console.warn('API unavailable for simulateAction, using local fallback:', err);
      const localIncident = await api.getIncidentById(incidentId);
      if (!localIncident) throw err;
      const hazard = localIncident.intake?.reportedHazard || 'benign_or_unknown';
      const check = evaluateActionSafety(hazard, payload.actionType, payload.target);
      const now = new Date().toISOString();

      let blockedRecord: BlockedActionRecord | undefined;
      if (!check.allowed && check.violatedRule) {
        blockedRecord = {
          actionId: `act-${Date.now()}`,
          actionType: payload.actionType,
          target: payload.target,
          blockedReason: check.reason || 'Blocked by safety policy',
          violatedRuleId: check.violatedRule.id,
          timestamp: now,
          preventedHarm: check.preventedHarm || 'Harm prevented',
        };
      }

      const existingIndex = localIncident.actions.findIndex(
        (a) => a.type === payload.actionType && (a.target === payload.target || a.label.includes(payload.target))
      );

      let newAction: IncidentAction;
      if (existingIndex !== -1) {
        localIncident.actions[existingIndex].status = blockedRecord ? 'BLOCKED' : 'SIMULATED';
        localIncident.actions[existingIndex].blockedRecord = blockedRecord;
        localIncident.actions[existingIndex].executedAt = blockedRecord ? undefined : now;
        newAction = localIncident.actions[existingIndex];
      } else {
        newAction = {
          id: `act-${Date.now()}`,
          type: payload.actionType,
          target: payload.target,
          label: `Interactive Action: ${payload.actionType} on ${payload.target}`,
          description: `Action simulated via console: ${payload.actionType}`,
          status: blockedRecord ? 'BLOCKED' : 'SIMULATED',
          isSimulated: true,
          requiresHumanApproval: false,
          blockedRecord,
          createdAt: now,
          executedAt: blockedRecord ? undefined : now,
        };
        localIncident.actions.push(newAction);
      }

      syncIncidentBriefing(localIncident);
      return { action: newAction, incident: localIncident };
    }
  },

  async approveNotification(incidentId: string, notifId: string): Promise<NotificationPreview> {
    const res = await fetch(`${API_BASE}/incidents/${incidentId}/approve-notification/${notifId}`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to approve notification');
    const data = await res.json();
    return data.notification;
  },

  async resolveIncident(incidentId: string): Promise<IncidentRecord> {
    const res = await fetch(`${API_BASE}/incidents/${incidentId}/resolve`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to resolve incident');
    return await res.json();
  },

  async resetDemoData(): Promise<void> {
    await fetch(`${API_BASE}/reset`, { method: 'POST' });
  },

  async getAuditLogs() {
    try {
      const res = await fetch(`${API_BASE}/audit-logs`);
      if (!res.ok) throw new Error('Failed to fetch audit logs');
      return await res.json();
    } catch {
      return [];
    }
  },
};
