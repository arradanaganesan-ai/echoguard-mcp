import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { storage } from '../server/storage.js';
import { runEmergencySimulation } from '../shared/orchestrator.js';
import { HARD_CODED_SAFETY_RULES, evaluateActionSafety, getSafetyGuidance } from '../shared/safety-policy.js';
import { formatBriefingAsMarkdown, syncIncidentBriefing } from '../shared/agents/briefing-agent.js';
import { HazardType } from '../shared/types.js';

// Initialize server instance
const server = new McpServer({
  name: 'echoguard-mcp',
  version: '1.0.0',
});

// Initialize persistent storage
storage.init();

// --- 1. TOOL: create_incident ---
server.tool(
  'create_incident',
  'Ingest an emergency incident report, run deterministic multi-agent triage, enforce safety policies, and return incident record.',
  {
    report: z.string().describe('Raw textual report of the emergency (e.g. "I smell gas and my eyes are burning")'),
    locationHint: z.string().optional().describe('Optional structural location hint (e.g. "Kitchen")'),
    occupantsHint: z.string().optional().describe('Optional count or details of occupants/pets'),
    scenarioId: z.string().optional().describe('Optional preset scenario identifier'),
  },
  async ({ report, locationHint, occupantsHint, scenarioId }) => {
    try {
      const incident = runEmergencySimulation({
        report,
        locationHint,
        occupantsHint,
        scenarioId,
      });

      storage.saveIncident(incident);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                incidentId: incident.id,
                riskLevel: incident.risk?.riskLevel,
                reportedHazard: incident.intake?.reportedHazard,
                symptoms: incident.intake?.symptoms,
                evacuationMandatory: incident.safetyGuidance?.evacuationMandatory,
                immediateActions: incident.safetyGuidance?.immediateActions,
                strictProhibitions: incident.safetyGuidance?.strictProhibitions,
                blockedActionsCount: incident.actions.filter((a) => a.status === 'BLOCKED').length,
                timelineEventsCount: incident.timeline.length,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Failed to create incident: ${err.message}` }],
      };
    }
  }
);

// --- 2. TOOL: assess_incident ---
server.tool(
  'assess_incident',
  'Retrieve deterministic risk classification, factor breakdown, and uncertainties for an incident.',
  {
    incidentId: z.string().describe('ID of the incident to assess'),
  },
  async ({ incidentId }) => {
    const incident = storage.getIncidentById(incidentId);
    if (!incident) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Incident with ID '${incidentId}' not found.` }],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              incidentId: incident.id,
              risk: incident.risk,
              missingInformation: incident.intake?.missingInformation,
              provenance: incident.intake?.evidence,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// --- 3. TOOL: get_safety_guidance ---
server.tool(
  'get_safety_guidance',
  'Fetch hard-coded emergency safety instructions, spark prohibitions, and assembly rules for a hazard.',
  {
    hazard: z
      .enum(['suspected_gas_leak', 'smoke_fire', 'medical_distress', 'electrical_hazard', 'benign_or_unknown'])
      .describe('Hazard classification type'),
    symptoms: z.array(z.string()).optional().describe('List of reported physical symptoms'),
  },
  async ({ hazard, symptoms = [] }) => {
    const guidance = getSafetyGuidance(hazard as HazardType, symptoms);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              hazard,
              guidance,
              safetyRuleEnforced: 'RULE-GAS-EVAC & RULE-SPARK-BLOCK',
              notice: 'Hard-coded life safety rules cannot be overridden by AI reasoning.',
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// --- 4. TOOL: prepare_notification ---
server.tool(
  'prepare_notification',
  'Draft a structured emergency notification preview for contacts or emergency services without dispatching real calls.',
  {
    incidentId: z.string().describe('Incident identifier'),
    recipientType: z
      .enum(['emergency_services', 'gas_utility', 'emergency_contact', 'building_management'])
      .describe('Type of recipient'),
    recipientName: z.string().describe('Display name of agency or contact'),
  },
  async ({ incidentId, recipientType, recipientName }) => {
    const incident = storage.getIncidentById(incidentId);
    if (!incident) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Incident '${incidentId}' not found.` }],
      };
    }

    const preview = {
      id: `notif-${Date.now()}`,
      recipientType,
      recipientName,
      priority: incident.risk?.riskLevel === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
      draftSubject: `[${incident.risk?.riskLevel || 'EMERGENCY'}] Alert: ${incident.intake?.reportedHazard} at ${
        incident.intake?.locationLabel || 'Premises'
      }`,
      draftBody: `EMERGENCY ALERT DRAFT:\nIncident ID: ${incident.id}\nHazard: ${incident.intake?.reportedHazard}\nSummary: ${incident.rawReport}\nStatus: Evacuation guidance issued. Safe perimeter advised.`,
      disclaimer: 'SIMULATION PREVIEW: No external communications dispatched. Human authorization required.',
      requiresApproval: true,
      approved: false,
    };

    incident.notifications.push(preview as any);
    storage.saveIncident(incident);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(preview, null, 2),
        },
      ],
    };
  }
);

// --- 5. TOOL: generate_incident_briefing ---
server.tool(
  'generate_incident_briefing',
  'Generate complete responder-ready incident briefing with audit hash and action totals.',
  {
    incidentId: z.string().describe('Incident identifier'),
    format: z.enum(['markdown', 'json']).default('markdown').describe('Output format preference'),
  },
  async ({ incidentId, format }) => {
    const incident = storage.getIncidentById(incidentId);
    if (!incident || !incident.briefing) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Briefing for incident '${incidentId}' not found.` }],
      };
    }

    syncIncidentBriefing(incident);
    storage.saveIncident(incident);

    const output =
      format === 'markdown'
        ? formatBriefingAsMarkdown(incident.briefing)
        : JSON.stringify(incident.briefing, null, 2);

    return {
      content: [
        {
          type: 'text',
          text: output,
        },
      ],
    };
  }
);

// --- 6. TOOL: get_incident_timeline ---
server.tool(
  'get_incident_timeline',
  'Retrieve chronological multi-agent audit timeline of decisions, checks, and interventions.',
  {
    incidentId: z.string().describe('Incident identifier'),
  },
  async ({ incidentId }) => {
    const incident = storage.getIncidentById(incidentId);
    if (!incident) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Incident '${incidentId}' not found.` }],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              incidentId: incident.id,
              timelineCount: incident.timeline.length,
              events: incident.timeline,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// --- 7. TOOL: simulate_action ---
server.tool(
  'simulate_action',
  'Test a candidate action against safety policy. Dangerous actions (sparks, actuators) are strictly blocked with full audit reasoning.',
  {
    incidentId: z.string().describe('Incident identifier'),
    actionType: z.string().describe('Action verb (e.g. "turn_on_exhaust_fan", "flip_light_switch", "solenoid_valve_actuate")'),
    target: z.string().describe('Target device or electrical component'),
  },
  async ({ incidentId, actionType, target }) => {
    const incident = storage.getIncidentById(incidentId);
    if (!incident) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Incident '${incidentId}' not found.` }],
      };
    }

    const hazard = incident.intake?.reportedHazard || 'benign_or_unknown';
    const check = evaluateActionSafety(hazard, actionType, target);
    const now = new Date().toISOString();

    const existingIndex = incident.actions.findIndex(
      (a) => a.type === actionType && (a.target === target || a.label.includes(target))
    );

    if (!check.allowed && check.violatedRule) {
      const blockedRecord = {
        actionId: `act-${Date.now()}`,
        actionType,
        target,
        blockedReason: check.reason || 'Blocked by safety policy',
        violatedRuleId: check.violatedRule.id,
        timestamp: now,
        preventedHarm: check.preventedHarm || 'Disaster avoided',
      };

      if (existingIndex !== -1) {
        incident.actions[existingIndex].status = 'BLOCKED';
        incident.actions[existingIndex].blockedRecord = blockedRecord;
      } else {
        incident.actions.push({
          id: blockedRecord.actionId,
          type: actionType,
          target,
          label: `Simulated: ${actionType} on ${target}`,
          description: `Action evaluated via MCP simulate_action`,
          status: 'BLOCKED',
          isSimulated: true,
          requiresHumanApproval: false,
          blockedRecord,
          createdAt: now,
        });
      }

      syncIncidentBriefing(incident);
      storage.saveIncident(incident);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                status: 'BLOCKED',
                allowed: false,
                violatedRuleId: check.violatedRule.id,
                reason: check.reason,
                preventedHarm: check.preventedHarm,
                disclaimer: 'Hard-coded safety policy interceded to prevent ignition or actuator risk.',
              },
              null,
              2
            ),
          },
        ],
      };
    }

    // Allowed action
    const allowedAction = {
      id: `act-${Date.now()}`,
      type: actionType,
      target,
      label: `Simulated: ${actionType} on ${target}`,
      description: `Action evaluated via MCP simulate_action`,
      status: 'SIMULATED' as const,
      isSimulated: true,
      requiresHumanApproval: false,
      createdAt: now,
      executedAt: now,
    };

    if (existingIndex !== -1) {
      incident.actions[existingIndex].status = 'SIMULATED';
      incident.actions[existingIndex].blockedRecord = undefined;
      incident.actions[existingIndex].executedAt = now;
    } else {
      incident.actions.push(allowedAction);
    }

    syncIncidentBriefing(incident);
    storage.saveIncident(incident);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              status: 'PERMITTED_SIMULATION',
              allowed: true,
              action: allowedAction,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// --- MCP RESOURCES ---
server.resource(
  'safety-policies',
  'echoguard://safety-policies',
  async () => {
    return {
      contents: [
        {
          uri: 'echoguard://safety-policies',
          mimeType: 'application/json',
          text: JSON.stringify(HARD_CODED_SAFETY_RULES, null, 2),
        },
      ],
    };
  }
);

server.resource(
  'recent-incidents',
  'echoguard://incidents/recent',
  async () => {
    const list = storage.getAllIncidents().slice(0, 10);
    return {
      contents: [
        {
          uri: 'echoguard://incidents/recent',
          mimeType: 'application/json',
          text: JSON.stringify(list, null, 2),
        },
      ],
    };
  }
);

server.resource(
  'audit-log',
  'echoguard://audit-log',
  async () => {
    const logs = storage.getAuditLogs(50);
    return {
      contents: [
        {
          uri: 'echoguard://audit-log',
          mimeType: 'application/json',
          text: JSON.stringify(logs, null, 2),
        },
      ],
    };
  }
);

// --- MCP PROMPTS ---
server.prompt(
  'emergency-triage',
  {
    incidentSummary: z.string().describe('Summary of the incident or reported odor/hazard'),
  },
  async ({ incidentSummary }) => {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `You are an AI assistant interacting with a user during an emergency: "${incidentSummary}".
Strict Safety Rules:
1. If gas is suspected, immediately instruct the user to EVACUATE the structure on foot.
2. NEVER instruct or suggest turning electrical switches, lamps, fans, or appliances ON or OFF (sparks can ignite gas).
3. Instruct them to reach a safe distance (300 feet upwind) before calling emergency services (911 in the US/Canada; 112 in India, the EU, and many other countries) or the gas utility.
4. Do NOT attempt to diagnose symptoms; recommend fresh air and medical evaluation.`,
          },
        },
      ],
    };
  }
);

server.prompt(
  'safety-audit',
  {
    proposedActions: z.string().describe('JSON or list of proposed actions to review'),
  },
  async ({ proposedActions }) => {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Perform a strict safety policy audit on the following candidate emergency actions:
${proposedActions}

Verify that NO electrical devices, exhaust fans, or physical actuators are triggered in a flammable atmosphere. Any spark or motor initiation must be flagged as CRITICAL VIOLATION.`,
          },
        },
      ],
    };
  }
);

// Start MCP Server on stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[EchoGuard MCP Server] Running on stdio transport.');
}

main().catch((err) => {
  console.error('[EchoGuard MCP Server Fatal Error]', err);
  process.exit(1);
});
