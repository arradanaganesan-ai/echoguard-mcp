import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import cors from 'cors';
import { storage } from '../src/server/storage.js';
import { runEmergencySimulation } from '../src/shared/orchestrator.js';
import { DEMO_SCENARIOS } from '../src/shared/scenarios.js';
import { HARD_CODED_SAFETY_RULES, evaluateActionSafety } from '../src/shared/safety-policy.js';
import { CreateIncidentSchema, SimulateActionSchema } from '../src/shared/schemas.js';
import { formatBriefingAsMarkdown, formatBriefingAsJson, syncIncidentBriefing } from '../src/shared/agents/briefing-agent.js';
import { BlockedActionRecord, IncidentAction } from '../src/shared/types.js';
import http from 'http';

describe('Express REST API End-to-End Suite', () => {
  let serverInstance: http.Server;
  let testPort: number;
  let baseUrl: string;

  beforeAll(async () => {
    storage.resetDemoData();

    const app = express();
    app.use(cors());
    app.use(express.json());

    function getParam(param: string | string[] | undefined): string {
      if (Array.isArray(param)) return param[0] || '';
      return param || '';
    }

    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', service: 'EchoGuard Emergency Intelligence Layer' });
    });

    app.get('/api/stats', (req, res) => {
      res.json(storage.getStats(true));
    });

    app.get('/api/scenarios', (req, res) => {
      res.json(DEMO_SCENARIOS);
    });

    app.get('/api/safety-rules', (req, res) => {
      res.json(HARD_CODED_SAFETY_RULES);
    });

    app.get('/api/incidents', (req, res) => {
      res.json(storage.getAllIncidents());
    });

    app.get('/api/incidents/:id', (req, res) => {
      const id = getParam(req.params.id);
      const inc = storage.getIncidentById(id);
      if (!inc) return res.status(404).json({ error: 'Incident not found' });
      res.json(inc);
    });

    app.post('/api/incidents', (req, res) => {
      const parsed = CreateIncidentSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'Validation failed' });
      const inc = runEmergencySimulation(parsed.data);
      storage.saveIncident(inc);
      res.status(201).json(inc);
    });

    app.post('/api/incidents/:id/simulate-action', (req, res) => {
      const id = getParam(req.params.id);
      const incident = storage.getIncidentById(id);
      if (!incident) return res.status(404).json({ error: 'Not found' });

      const parsed = SimulateActionSchema.safeParse({ ...req.body, incidentId: id });
      if (!parsed.success) return res.status(400).json({ error: 'Validation failed' });

      const { actionType, target, parameters } = parsed.data;
      const hazard = incident.intake?.reportedHazard || 'benign_or_unknown';
      const check = evaluateActionSafety(hazard, actionType, target, parameters);
      const now = new Date().toISOString();

      let blockedRecord: BlockedActionRecord | undefined;
      if (!check.allowed && check.violatedRule) {
        blockedRecord = {
          actionId: `act-${Date.now()}`,
          actionType,
          target,
          blockedReason: check.reason || 'Blocked',
          violatedRuleId: check.violatedRule.id,
          timestamp: now,
          preventedHarm: check.preventedHarm || 'Prevented harm',
        };
      }

      const existingIndex = incident.actions.findIndex(
        (a) => a.type === actionType && (a.target === target || a.label.includes(target))
      );

      let newAction: IncidentAction;
      if (existingIndex !== -1) {
        incident.actions[existingIndex].status = blockedRecord ? 'BLOCKED' : 'SIMULATED';
        incident.actions[existingIndex].blockedRecord = blockedRecord;
        incident.actions[existingIndex].executedAt = blockedRecord ? undefined : now;
        newAction = incident.actions[existingIndex];
      } else {
        newAction = {
          id: `act-${Date.now()}`,
          type: actionType,
          target,
          label: `Simulated: ${actionType}`,
          description: `Simulated`,
          status: blockedRecord ? 'BLOCKED' : 'SIMULATED',
          isSimulated: true,
          requiresHumanApproval: false,
          blockedRecord,
          createdAt: now,
        };
        incident.actions.push(newAction);
      }

      syncIncidentBriefing(incident);
      storage.saveIncident(incident);
      res.json({ action: newAction, incident });
    });

    app.get('/api/incidents/:id/briefing/markdown', (req, res) => {
      const id = getParam(req.params.id);
      const inc = storage.getIncidentById(id);
      if (!inc || !inc.briefing) return res.status(404).send('Not found');
      res.send(formatBriefingAsMarkdown(inc.briefing));
    });

    // Start on dynamic ephemeral port
    await new Promise<void>((resolve) => {
      serverInstance = app.listen(0, () => {
        const addr = serverInstance.address();
        if (typeof addr === 'object' && addr) {
          testPort = addr.port;
          baseUrl = `http://localhost:${testPort}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      serverInstance.close(() => resolve());
    });
  });

  it('GET /api/health should return ok status', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
  });

  it('GET /api/scenarios should return preconfigured scenarios A to E', async () => {
    const res = await fetch(`${baseUrl}/api/scenarios`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.length).toBeGreaterThanOrEqual(5);
  });

  it('GET /api/safety-rules should return hard-coded safety rules', async () => {
    const res = await fetch(`${baseUrl}/api/safety-rules`);
    expect(res.status).toBe(200);
    const rules = await res.json();
    expect(rules.length).toBeGreaterThanOrEqual(4);
    expect(rules.some((r: any) => r.id === 'RULE-SPARK-BLOCK')).toBe(true);
  });

  it('POST /api/incidents should create and return new emergency incident', async () => {
    const payload = {
      report: 'I smell gas and my eyes are burning in the kitchen',
      locationHint: 'Kitchen',
    };
    const res = await fetch(`${baseUrl}/api/incidents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created.id).toBeDefined();
    expect(created.risk.riskLevel).toBe('CRITICAL');
    expect(created.safetyGuidance.evacuationMandatory).toBe(true);
  });

  it('POST /api/incidents/:id/simulate-action should BLOCK spark actions on gas leak', async () => {
    const list = storage.getAllIncidents();
    const gasInc = list.find((i) => i.intake?.reportedHazard === 'suspected_gas_leak') || list[0];

    const actionPayload = {
      actionType: 'turn_on_exhaust_fan',
      target: 'Basement Vent Hood',
    };

    const res = await fetch(`${baseUrl}/api/incidents/${gasInc.id}/simulate-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(actionPayload),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.action.status).toBe('BLOCKED');
    expect(data.action.blockedRecord.violatedRuleId).toBe('RULE-SPARK-BLOCK');
  });

  it('GET /api/incidents/:id/briefing/markdown should return markdown string', async () => {
    const list = storage.getAllIncidents();
    const inc = list[0];
    const res = await fetch(`${baseUrl}/api/incidents/${inc.id}/briefing/markdown`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('# ECHOGUARD EMERGENCY INCIDENT BRIEFING');
  });
});
