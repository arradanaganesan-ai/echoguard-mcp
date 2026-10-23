import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { storage } from './storage.js';
import { runEmergencySimulation } from '../shared/orchestrator.js';
import { DEMO_SCENARIOS } from '../shared/scenarios.js';
import { HARD_CODED_SAFETY_RULES, evaluateActionSafety, getSafetyGuidance } from '../shared/safety-policy.js';
import { CreateIncidentSchema, SimulateActionSchema } from '../shared/schemas.js';
import { formatBriefingAsMarkdown, formatBriefingAsJson, syncIncidentBriefing } from '../shared/agents/briefing-agent.js';
import { BlockedActionRecord, IncidentAction } from '../shared/types.js';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
}

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (!req.path.startsWith('/api/stats')) {
      console.log(`[HTTP] ${req.method} ${req.path} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Storage initialization
storage.init();

// Static file serving for production build
const distPath = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// --- API ENDPOINTS ---

// Health & System Info
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'EchoGuard Emergency Intelligence Layer',
    version: '1.0.0',
    mode: process.env.DEMO_MODE === 'false' ? 'production' : 'demo',
    mcpTransport: 'stdio',
    timestamp: new Date().toISOString(),
  });
});

// System Stats
app.get('/api/stats', (req: Request, res: Response) => {
  const stats = storage.getStats(true);
  res.json(stats);
});

// Demo Scenarios Catalog
app.get('/api/scenarios', (req: Request, res: Response) => {
  res.json(DEMO_SCENARIOS);
});

// Safety Rules Catalog
app.get('/api/safety-rules', (req: Request, res: Response) => {
  res.json(HARD_CODED_SAFETY_RULES);
});

// MCP Tools Catalog & Status
app.get('/api/mcp/status', (req: Request, res: Response) => {
  res.json({
    connected: true,
    serverName: 'echoguard-mcp',
    transport: 'stdio',
    version: '1.0.0',
    tools: [
      {
        name: 'create_incident',
        description: 'Ingest raw incident report, execute deterministic agent pipeline, and enforce safety policies.',
        inputSchema: { type: 'object', properties: { report: { type: 'string' } }, required: ['report'] },
      },
      {
        name: 'assess_incident',
        description: 'Retrieve deterministic risk classification, factor breakdown, and uncertainties for an incident.',
        inputSchema: { type: 'object', properties: { incidentId: { type: 'string' } }, required: ['incidentId'] },
      },
      {
        name: 'get_safety_guidance',
        description: 'Fetch hard-coded emergency safety instructions, spark prohibitions, and assembly rules.',
        inputSchema: { type: 'object', properties: { hazard: { type: 'string' } }, required: ['hazard'] },
      },
      {
        name: 'prepare_notification',
        description: 'Draft safe emergency notification preview with disclaimer and human verification check.',
        inputSchema: {
          type: 'object',
          properties: {
            incidentId: { type: 'string' },
            recipientType: { type: 'string' },
            recipientName: { type: 'string' },
          },
          required: ['incidentId', 'recipientType', 'recipientName'],
        },
      },
      {
        name: 'generate_incident_briefing',
        description: 'Generate complete responder-ready incident briefing with audit hash and action totals.',
        inputSchema: { type: 'object', properties: { incidentId: { type: 'string' } }, required: ['incidentId'] },
      },
      {
        name: 'get_incident_timeline',
        description: 'Retrieve chronological multi-agent audit timeline of decisions, checks, and interventions.',
        inputSchema: { type: 'object', properties: { incidentId: { type: 'string' } }, required: ['incidentId'] },
      },
      {
        name: 'simulate_action',
        description: 'Test an action against safety policy. Dangerous actions (sparks, actuators) are blocked.',
        inputSchema: {
          type: 'object',
          properties: {
            incidentId: { type: 'string' },
            actionType: { type: 'string' },
            target: { type: 'string' },
          },
          required: ['incidentId', 'actionType', 'target'],
        },
      },
    ],
    resources: [
      'echoguard://safety-policies',
      'echoguard://incidents/recent',
      'echoguard://audit-log',
    ],
    prompts: ['emergency-triage', 'safety-audit'],
  });
});

// Incidents List
app.get('/api/incidents', (req: Request, res: Response) => {
  const incidents = storage.getAllIncidents();
  res.json(incidents);
});

// Incident Detail
app.get('/api/incidents/:id', (req: Request, res: Response) => {
  const id = getParam(req.params.id);
  const incident = storage.getIncidentById(id);
  if (!incident) {
    res.status(404).json({ error: 'Incident not found' });
    return;
  }
  res.json(incident);
});

// Create & Simulate Incident
app.post('/api/incidents', (req: Request, res: Response) => {
  const parsed = CreateIncidentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid incident request', details: parsed.error.issues });
    return;
  }

  const { report, scenarioId, locationHint, occupantsHint } = parsed.data;
  const incident = runEmergencySimulation({
    report,
    scenarioId,
    locationHint,
    occupantsHint,
  });

  storage.saveIncident(incident);
  res.status(201).json(incident);
});

// Test / Simulate Additional Action Against Safety Policy
app.post('/api/incidents/:id/simulate-action', (req: Request, res: Response) => {
  const id = getParam(req.params.id);
  const incident = storage.getIncidentById(id);
  if (!incident) {
    res.status(404).json({ error: 'Incident not found' });
    return;
  }

  const parsed = SimulateActionSchema.safeParse({ ...req.body, incidentId: id });
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid action payload', details: parsed.error.issues });
    return;
  }

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
      blockedReason: check.reason || 'Blocked by safety policy',
      violatedRuleId: check.violatedRule.id,
      timestamp: now,
      preventedHarm: check.preventedHarm || 'Harm prevented',
    };
  }

  // Prevent duplicate double-counting for repeated requests on same action and target
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
      label: `Interactive Action: ${actionType} on ${target}`,
      description: `Action simulated via console: ${actionType}`,
      status: blockedRecord ? 'BLOCKED' : 'SIMULATED',
      isSimulated: true,
      requiresHumanApproval: false,
      blockedRecord,
      createdAt: now,
      executedAt: blockedRecord ? undefined : now,
    };
    incident.actions.push(newAction);

    incident.timeline.push({
      id: `tl-user-act-${Date.now()}`,
      timestamp: now,
      agent: blockedRecord ? 'safety' : 'coordination',
      stage: 'ACTION_EVALUATION',
      title: blockedRecord ? `SAFETY VIOLATION BLOCKED: ${target}` : `Simulated Action Approved: ${target}`,
      details: blockedRecord ? blockedRecord.blockedReason : `Action '${actionType}' permitted under current safety constraints.`,
      severity: blockedRecord ? 'critical' : 'info',
    });
  }

  // Re-synthesize briefing with updated action tallies and audit records
  syncIncidentBriefing(incident);

  storage.saveIncident(incident);
  res.json({ action: newAction, incident });
});

// Approve Notification Preview
app.post('/api/incidents/:id/approve-notification/:notifId', (req: Request, res: Response) => {
  const id = getParam(req.params.id);
  const notifId = getParam(req.params.notifId);
  const incident = storage.getIncidentById(id);
  if (!incident) {
    res.status(404).json({ error: 'Incident not found' });
    return;
  }

  const notif = incident.notifications.find((n) => n.id === notifId);
  if (!notif) {
    res.status(404).json({ error: 'Notification draft not found' });
    return;
  }

  notif.approved = true;

  incident.timeline.push({
    id: `tl-appr-${Date.now()}`,
    timestamp: new Date().toISOString(),
    agent: 'human',
    stage: 'HUMAN_AUTHORIZATION',
    title: `Notification Approved: ${notif.recipientName}`,
    details: `Human operator verified and approved transmission of priority draft (${notif.priority}).`,
    severity: 'success',
  });

  // Re-synthesize briefing with updated notification approval state
  syncIncidentBriefing(incident);

  storage.saveIncident(incident);
  res.json({ success: true, notification: notif });
});

// Resolve Incident
app.post('/api/incidents/:id/resolve', (req: Request, res: Response) => {
  const id = getParam(req.params.id);
  const incident = storage.getIncidentById(id);
  if (!incident) {
    res.status(404).json({ error: 'Incident not found' });
    return;
  }

  incident.status = 'RESOLVED';
  incident.timeline.push({
    id: `tl-res-${Date.now()}`,
    timestamp: new Date().toISOString(),
    agent: 'human',
    stage: 'INCIDENT_CLOSURE',
    title: 'Incident Resolved & Closed',
    details: 'On-scene all-clear verified by operator. Triage workflow closed.',
    severity: 'success',
  });

  storage.saveIncident(incident);
  res.json(incident);
});

// Download Briefing as Markdown
app.get('/api/incidents/:id/briefing/markdown', (req: Request, res: Response) => {
  const id = getParam(req.params.id);
  const incident = storage.getIncidentById(id);
  if (!incident || !incident.briefing) {
    res.status(404).send('Briefing not found');
    return;
  }

  const md = formatBriefingAsMarkdown(incident.briefing);
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${incident.id}-briefing.md"`);
  res.send(md);
});

// Download Briefing as JSON
app.get('/api/incidents/:id/briefing/json', (req: Request, res: Response) => {
  const id = getParam(req.params.id);
  const incident = storage.getIncidentById(id);
  if (!incident || !incident.briefing) {
    res.status(404).json({ error: 'Briefing not found' });
    return;
  }

  const jsonStr = formatBriefingAsJson(incident.briefing);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${incident.id}-briefing.json"`);
  res.send(jsonStr);
});

// Audit Logs
app.get('/api/audit-logs', (req: Request, res: Response) => {
  const logs = storage.getAuditLogs(100);
  res.json(logs);
});

// Reset Demo Store
app.post('/api/reset', (req: Request, res: Response) => {
  storage.resetDemoData();
  res.json({ message: 'Demo data reset successfully', stats: storage.getStats(true) });
});

// SPA Fallback to index.html for frontend routing
if (fs.existsSync(distPath)) {
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
}

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[API Error]', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

export const server = app.listen(PORT, () => {
  console.log(`[EchoGuard API] Server listening on http://localhost:${PORT}`);
});

export default app;
