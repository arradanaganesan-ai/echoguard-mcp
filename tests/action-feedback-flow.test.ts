import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { storage } from '../src/server/storage.js';
import { runEmergencySimulation } from '../src/shared/orchestrator.js';
import { evaluateActionSafety } from '../src/shared/safety-policy.js';
import { syncIncidentBriefing } from '../src/shared/agents/briefing-agent.js';
import { SimulateActionSchema } from '../src/shared/schemas.js';
import { api } from '../src/client/api.js';
import {
  updateIncidentInList,
  resolveSelectionAfterAction,
  resolveActiveIncident,
} from '../src/client/App.js';
import { IncidentRecord, IncidentAction, BlockedActionRecord } from '../src/shared/types.js';

/**
 * Regression Suite: Frontend Action Feedback & State Synchronization
 *
 * Covers the verified bug: a successful interactive action (e.g. "Display
 * Mobile Warning") must become visible immediately in frontend state —
 * action summary, audit timeline, briefing, and safety policy section —
 * without a browser refresh, with loading/error feedback, deduplicated
 * submissions, and no state leaking across incidents.
 *
 * The real client (`src/client/api.ts`) is exercised against an in-process
 * API server that mirrors the production `POST /api/incidents/:id/simulate-action`
 * contract (same pattern as api.test.ts).
 */
describe('Frontend Action Feedback & State Synchronization (Regression)', () => {
  let serverInstance: http.Server;
  let baseUrl: string;
  let gasIncident: IncidentRecord;
  let otherIncident: IncidentRecord;

  const realFetch = globalThis.fetch;
  let failSimulateRequests = false;

  // Route relative /api calls (as the browser would) to the in-process server,
  // with an optional kill-switch to exercise the client's error feedback path.
  const testFetch = ((input: any, init?: any) => {
    const url =
      typeof input === 'string' && input.startsWith('/') ? `${baseUrl}${input}` : input;

    if (failSimulateRequests && typeof url === 'string') {
      if (url.includes('/simulate-action')) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: 'Simulated backend failure' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
      if (/^http:\/\/localhost:\d+\/api\/incidents\/[^/]+$/.test(url)) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: 'Incident fetch failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
    }
    return realFetch(url, init);
  }) as typeof fetch;

  beforeAll(async () => {
    storage.resetDemoData();

    const app = express();
    app.use(cors());
    app.use(express.json());

    // Mirrors the production endpoint contract in src/server/index.ts
    app.post('/api/incidents/:id/simulate-action', (req, res) => {
      const id = String(req.params.id);
      const incident = storage.getIncidentById(id);
      if (!incident) return res.status(404).json({ error: 'Incident not found' });

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
          blockedReason: check.reason || 'Blocked by safety policy',
          violatedRuleId: check.violatedRule.id,
          timestamp: now,
          preventedHarm: check.preventedHarm || 'Harm prevented',
        };
      }

      // Deduplication for repeated requests on the same action + target
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
          title: blockedRecord
            ? `SAFETY VIOLATION BLOCKED: ${target}`
            : `Simulated Action Approved: ${target}`,
          details: blockedRecord
            ? blockedRecord.blockedReason
            : `Action '${actionType}' permitted under current safety constraints.`,
          severity: blockedRecord ? 'critical' : 'info',
        });
      }

      syncIncidentBriefing(incident);
      storage.saveIncident(incident);
      res.json({ action: newAction, incident });
    });

    app.get('/api/incidents/:id', (req, res) => {
      const incident = storage.getIncidentById(String(req.params.id));
      if (!incident) return res.status(404).json({ error: 'Incident not found' });
      res.json(incident);
    });

    app.get('/api/incidents', (_req, res) => {
      res.json(storage.getAllIncidents());
    });

    await new Promise<void>((resolve) => {
      serverInstance = app.listen(0, () => {
        const addr = serverInstance.address();
        if (typeof addr === 'object' && addr) {
          baseUrl = `http://localhost:${addr.port}`;
        }
        resolve();
      });
    });

    globalThis.fetch = testFetch;
  });

  afterAll(async () => {
    globalThis.fetch = realFetch;
    await new Promise<void>((resolve) => {
      serverInstance.close(() => resolve());
    });
  });

  beforeEach(() => {
    failSimulateRequests = false;
    storage.resetDemoData();
    gasIncident = runEmergencySimulation({
      report: 'I smell gas and my eyes are burning in the kitchen',
      scenarioId: 'scenario-a',
      locationHint: 'Kitchen',
      occupantsHint: '2 adults',
    });
    storage.saveIncident(gasIncident);
    otherIncident = runEmergencySimulation({
      report: 'Thick smoke is coming out of the furnace utility closet',
      scenarioId: 'scenario-b',
      locationHint: 'Furnace Utility Closet',
    });
    storage.saveIncident(otherIncident);
  });

  /**
   * Mirrors the fixed App.handleSimulateAction composition:
   * api result -> updateIncidentInList -> resolveSelectionAfterAction -> background loadData.
   */
  async function runActionThroughClientFlow(
    actedIncidentId: string,
    currentActive: IncidentRecord | null,
    actionType: string,
    target: string
  ) {
    const result = await api.simulateAction(actedIncidentId, { actionType, target });

    const incidentsBefore = storage.getAllIncidents();
    const updatedList = updateIncidentInList(incidentsBefore, result.incident);
    const newSelection = resolveSelectionAfterAction(currentActive, actedIncidentId, result.incident);
    // Background refresh (loadData with no preferred id):
    const refreshed = storage.getAllIncidents();
    const resolved = resolveActiveIncident(refreshed, newSelection);

    return { result, updatedList, newSelection, resolved };
  }

  it('safe action: response drives immediate visible state update (action, timeline, briefing) without refresh', async () => {
    // Capture pre-action briefing tallies (storage returns live objects)
    const preTotal = gasIncident.briefing?.actionsSummary.total ?? 0;
    const preSimulated = gasIncident.briefing?.actionsSummary.simulated ?? 0;
    const preTimeline = gasIncident.timeline.length;

    const { result, resolved } = await runActionThroughClientFlow(
      gasIncident.id,
      gasIncident,
      'display_screen_warning',
      'Resident Mobile App'
    );

    // Feedback payload for the UI
    expect(result.action.status).toBe('SIMULATED');
    expect(result.action.isSimulated).toBe(true);
    expect(result.action.blockedRecord).toBeUndefined();

    // Resolved active incident (what the dashboard renders) is updated from state alone
    expect(resolved?.id).toBe(gasIncident.id);
    expect(resolved?.actions.some((a) => a.type === 'display_screen_warning' && a.status === 'SIMULATED')).toBe(true);

    // Audit timeline shows the new event immediately
    expect(resolved?.timeline.length).toBe(preTimeline + 1);
    const lastEvent = resolved?.timeline[resolved.timeline.length - 1];
    expect(lastEvent?.title).toBe('Simulated Action Approved: Resident Mobile App');

    // Briefing detail is re-synthesized with updated tallies (no refresh required)
    expect(resolved?.briefing?.actionsSummary.total).toBe(preTotal + 1);
    expect(resolved?.briefing?.actionsSummary.simulated).toBe(preSimulated + 1);
    expect(resolved?.briefing?.actionsSummary.blocked).toBe(
      gasIncident.actions.filter((a) => a.status === 'BLOCKED').length
    );
  });

  it('repeated clicks do not create duplicate actions (dedup preserved end-to-end)', async () => {
    const first = await api.simulateAction(gasIncident.id, {
      actionType: 'display_screen_warning',
      target: 'Resident Mobile App',
    });
    const second = await api.simulateAction(gasIncident.id, {
      actionType: 'display_screen_warning',
      target: 'Resident Mobile App',
    });

    expect(second.action.id).toBe(first.action.id);
    expect(second.incident.actions.length).toBe(first.incident.actions.length);
    expect(second.incident.briefing?.actionsSummary.total).toBe(first.incident.briefing?.actionsSummary.total);
    // No duplicate timeline audit entries for the repeated submission
    expect(second.incident.timeline.length).toBe(first.incident.timeline.length);
  });

  it('exhaust fan remains BLOCKED with policy rule, reason, and prevented harm in feedback', async () => {
    const { result } = await runActionThroughClientFlow(
      gasIncident.id,
      gasIncident,
      'turn_on_exhaust_fan',
      'Kitchen Vent Fan'
    );

    expect(result.action.status).toBe('BLOCKED');
    expect(result.action.blockedRecord?.violatedRuleId).toBe('RULE-SPARK-BLOCK');
    expect(result.action.blockedRecord?.blockedReason).toBeTruthy();
    expect(result.action.blockedRecord?.preventedHarm).toBeTruthy();
  });

  it('gas solenoid valve remains BLOCKED under the actuator isolation rule', async () => {
    const { result } = await runActionThroughClientFlow(
      gasIncident.id,
      gasIncident,
      'solenoid_valve_actuate',
      'Main Gas Solenoid Valve'
    );

    expect(result.action.status).toBe('BLOCKED');
    expect(result.action.blockedRecord?.violatedRuleId).toBe('RULE-ACTUATOR-BLOCK');
    expect(result.action.blockedRecord?.blockedReason).toBeTruthy();
  });

  it('action result updates the correct list entry without touching other incidents (isolation)', async () => {
    const incidentsBefore = storage.getAllIncidents();
    const otherBefore = incidentsBefore.find((i) => i.id === otherIncident.id)!;
    const otherSnapshot = JSON.parse(JSON.stringify(otherBefore));

    const { result, updatedList } = await runActionThroughClientFlow(
      gasIncident.id,
      gasIncident,
      'display_screen_warning',
      'Resident Mobile App'
    );

    const updatedEntry = updatedList.find((i) => i.id === gasIncident.id)!;
    const untouchedEntry = updatedList.find((i) => i.id === otherIncident.id)!;

    expect(updatedEntry.actions.length).toBe(result.incident.actions.length);
    expect(untouchedEntry).toEqual(otherSnapshot);
    expect(updatedList.length).toBe(incidentsBefore.length);
  });

  it('switching incidents mid-flight does not hijack the selection back to the acted-on incident', async () => {
    // Operator had incident A selected, clicks an action, then switches to B
    // while the request is still in flight. When the response returns, the
    // selection must stay on B — while A's data still gets refreshed.
    const incidentA = gasIncident;
    const incidentB = otherIncident;

    const result = await api.simulateAction(incidentA.id, {
      actionType: 'display_screen_warning',
      target: 'Resident Mobile App',
    });
    const currentActiveDuringFlight = incidentB; // operator switched

    const incidentsAfter = storage.getAllIncidents();
    const updatedList = updateIncidentInList(incidentsAfter, result.incident);
    const newSelection = resolveSelectionAfterAction(
      currentActiveDuringFlight,
      incidentA.id,
      result.incident
    );
    const resolved = resolveActiveIncident(updatedList, newSelection);

    // Selection NOT hijacked
    expect(newSelection?.id).toBe(incidentB.id);
    expect(resolved?.id).toBe(incidentB.id);

    // But the acted-on incident was still refreshed inside the list
    const refreshedA = updatedList.find((i) => i.id === incidentA.id)!;
    expect(
      refreshedA.actions.some((a) => a.type === 'display_screen_warning' && a.status === 'SIMULATED')
    ).toBe(true);

    // Feedback for the acted-on incident does not apply to the new selection
    expect(resolved?.actions.some((a) => a.type === 'display_screen_warning')).toBe(false);
  });

  it('selection is refreshed with the returned incident when the acted-on incident is still selected', async () => {
    const { newSelection, resolved } = await runActionThroughClientFlow(
      gasIncident.id,
      gasIncident,
      'display_screen_warning',
      'Resident Mobile App'
    );

    expect(newSelection?.id).toBe(gasIncident.id);
    expect(
      newSelection?.actions.some((a) => a.type === 'display_screen_warning' && a.status === 'SIMULATED')
    ).toBe(true);
    expect(resolved?.id).toBe(gasIncident.id);
  });

  it('failed requests surface a clear error for UI error feedback', async () => {
    failSimulateRequests = true;

    // POST fails; the client's offline fallback (GET incident) also fails,
    // so the error must propagate with a precise, displayable message.
    await expect(
      api.simulateAction(gasIncident.id, {
        actionType: 'display_screen_warning',
        target: 'Resident Mobile App',
      })
    ).rejects.toThrow(/Simulate-action request failed \(500\)/);
  });

  it('updateIncidentInList is immutable and returns the same array when the incident is absent', () => {
    const incidents = storage.getAllIncidents();
    const updated = { ...gasIncident, updatedAt: new Date().toISOString() };

    const next = updateIncidentInList(incidents, updated);
    expect(next).not.toBe(incidents);
    expect(next.find((i) => i.id === gasIncident.id)?.updatedAt).toBe(updated.updatedAt);
    // Original array not mutated
    expect(incidents.find((i) => i.id === gasIncident.id)?.updatedAt).toBe(gasIncident.updatedAt);

    // Unknown incident id -> no-op, same reference
    const ghost = { ...gasIncident, id: 'INC-DOES-NOT-EXIST' } as IncidentRecord;
    expect(updateIncidentInList(incidents, ghost)).toBe(incidents);
  });
});
