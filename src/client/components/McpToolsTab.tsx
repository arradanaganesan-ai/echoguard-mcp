import React, { useState } from 'react';
import { Server, Terminal, Play, FileCode, Copy, Check, Cpu, ShieldCheck, Database, HelpCircle } from 'lucide-react';
import { IncidentRecord } from '../../shared/types.js';
import { api } from '../api.js';
import { Panel, Badge, Button, SectionHeader, StatusDot } from '../ui/primitives.js';
import { useToasts } from '../ui/Toast.js';

interface McpToolsTabProps {
  activeIncident: IncidentRecord | null;
}

type SubTab = 'tools' | 'resources' | 'prompts' | 'config';

export const McpToolsTab: React.FC<McpToolsTabProps> = ({ activeIncident }) => {
  const { pushToast } = useToasts();
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('tools');
  const [selectedTool, setSelectedTool] = useState<string>('simulate_action');
  const [toolParams, setToolParams] = useState<Record<string, string>>({
    incidentId: activeIncident?.id || '',
    actionType: 'turn_on_exhaust_fan',
    target: 'Kitchen Range Vent Hood',
  });
  const [toolResult, setToolResult] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);

  const toolsList: Array<{ name: string; description: string; defaultParams: Record<string, string> }> = [
    {
      name: 'create_incident',
      description: 'Ingest raw emergency report, execute deterministic agent pipeline, and enforce safety policies.',
      defaultParams: {
        report: 'I smell gas and my eyes are burning in the kitchen',
        locationHint: 'Kitchen',
      },
    },
    {
      name: 'assess_incident',
      description: 'Retrieve deterministic risk classification, factor breakdown, and uncertainties.',
      defaultParams: { incidentId: activeIncident?.id || 'INC-CURRENT' },
    },
    {
      name: 'get_safety_guidance',
      description: 'Fetch hard-coded emergency safety instructions, spark prohibitions, and assembly rules.',
      defaultParams: { hazard: 'suspected_gas_leak' },
    },
    {
      name: 'prepare_notification',
      description: 'Draft safe emergency notification preview with disclaimer and human verification check.',
      defaultParams: {
        incidentId: activeIncident?.id || 'INC-CURRENT',
        recipientType: 'emergency_services',
        recipientName: 'Local Emergency Services (jurisdiction-aware)',
      },
    },
    {
      name: 'generate_incident_briefing',
      description: 'Generate complete responder-ready incident briefing with audit hash and action totals.',
      defaultParams: { incidentId: activeIncident?.id || 'INC-CURRENT', format: 'markdown' },
    },
    {
      name: 'get_incident_timeline',
      description: 'Retrieve chronological multi-agent audit timeline of decisions, checks, and interventions.',
      defaultParams: { incidentId: activeIncident?.id || 'INC-CURRENT' },
    },
    {
      name: 'simulate_action',
      description: 'Test an action against safety policy. Dangerous actions (sparks, actuators) are strictly blocked.',
      defaultParams: {
        incidentId: activeIncident?.id || 'INC-CURRENT',
        actionType: 'turn_on_exhaust_fan',
        target: 'Kitchen Range Vent Hood',
      },
    },
  ];

  const handleSelectTool = (name: string) => {
    setSelectedTool(name);
    const found = toolsList.find((t) => t.name === name);
    if (found) {
      const nextParams: Record<string, string> = { ...found.defaultParams };
      if ('incidentId' in nextParams) {
        nextParams.incidentId = activeIncident?.id || found.defaultParams.incidentId || '';
      }
      setToolParams(nextParams);
    }
    setToolResult(null);
  };

  const handleExecuteTool = async () => {
    if (isExecuting) return; // anti double-submit
    setIsExecuting(true);
    try {
      const id = toolParams.incidentId || activeIncident?.id || '';
      if (!id && selectedTool !== 'create_incident' && selectedTool !== 'get_safety_guidance') {
        throw new Error('A valid incidentId is required for this tool');
      }

      if (selectedTool === 'simulate_action') {
        const res = await api.simulateAction(id, {
          actionType: toolParams.actionType || 'turn_on_exhaust_fan',
          target: toolParams.target || 'Kitchen Vent',
        });
        setToolResult(JSON.stringify(res, null, 2));
      } else if (selectedTool === 'create_incident') {
        const res = await api.createIncident({
          report: toolParams.report || 'Gas smell detected',
          locationHint: toolParams.locationHint || 'Kitchen',
        });
        setToolResult(JSON.stringify(res, null, 2));
      } else if (selectedTool === 'assess_incident') {
        const res = await api.getIncidentById(id);
        setToolResult(JSON.stringify({ risk: res?.risk, uncertainties: res?.risk?.uncertainties }, null, 2));
      } else if (selectedTool === 'get_safety_guidance') {
        const res = await api.getSafetyRules();
        setToolResult(JSON.stringify({ rulesEnforced: res }, null, 2));
      } else if (selectedTool === 'generate_incident_briefing') {
        const res = await api.getIncidentById(id);
        setToolResult(JSON.stringify(res?.briefing, null, 2));
      } else if (selectedTool === 'get_incident_timeline') {
        const res = await api.getIncidentById(id);
        setToolResult(JSON.stringify(res?.timeline, null, 2));
      } else if (selectedTool === 'prepare_notification') {
        const res = await api.getIncidentById(id);
        setToolResult(JSON.stringify(res?.notifications, null, 2));
      }
    } catch (err: any) {
      setToolResult(JSON.stringify({ error: err.message, status: 'FAILED' }, null, 2));
    } finally {
      setIsExecuting(false);
    }
  };

  const mcpConfigJson = JSON.stringify(
    {
      mcpServers: {
        echoguard: {
          command: 'npx',
          args: ['tsx', 'src/mcp/index.ts'],
          cwd: 'c:\\Users\\arrua\\OneDrive\\ECHOGUARD MCP',
          env: {
            DEMO_MODE: 'true',
            MCP_TRANSPORT: 'stdio',
          },
        },
      },
    },
    null,
    2
  );

  const handleCopyConfig = async () => {
    try {
      await navigator.clipboard.writeText(mcpConfigJson);
      setCopiedConfig(true);
      pushToast('success', 'Configuration copied', 'Paste it into your MCP client config file.');
      setTimeout(() => setCopiedConfig(false), 2000);
    } catch (err: any) {
      pushToast('error', 'Copy failed', err?.message || 'Clipboard was not available.');
    }
  };

  const subTabs: Array<{ id: SubTab; label: string }> = [
    { id: 'tools', label: 'Tools (7)' },
    { id: 'resources', label: 'Resources' },
    { id: 'prompts', label: 'Prompts' },
    { id: 'config', label: 'Client config' },
  ];

  return (
    <div className="space-y-6">
      {/* Server header */}
      <Panel className="p-5">
        <SectionHeader
          icon={<Server className="w-4 h-4 text-amber" />}
          title="Model Context Protocol server"
          description="Official MCP SDK over stdio with Zod runtime validation and a restricted tool surface."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="safe">
                <StatusDot tone="safe" /> Active
              </Badge>
              <div className="flex bg-surface p-0.5 rounded-lg border border-line text-xs">
                {subTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveSubTab(tab.id)}
                    aria-pressed={activeSubTab === tab.id}
                    className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                      activeSubTab === tab.id ? 'bg-[#242b37] text-ink' : 'text-muted hover:text-ink'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          }
        />
      </Panel>

      {/* Tools subtab */}
      {activeSubTab === 'tools' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Panel className="p-4 space-y-2">
            <span className="label-cap block mb-1">Registered tools</span>
            {toolsList.map((tool) => {
              const isSelected = selectedTool === tool.name;
              return (
                <button
                  key={tool.name}
                  type="button"
                  onClick={() => handleSelectTool(tool.name)}
                  aria-pressed={isSelected}
                  className={`w-full p-3 rounded-lg border transition-colors cursor-pointer text-left ${
                    isSelected
                      ? 'bg-[#242b37] border-[rgba(243,182,74,0.5)]'
                      : 'bg-surface/40 border-line hover:border-line-strong'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-mono text-xs font-semibold ${isSelected ? 'text-amber' : 'text-ink-dim'}`}>
                      {tool.name}
                    </span>
                    <span className="text-[10px] text-faint font-mono">v1.0</span>
                  </div>
                  <p className="text-[11px] text-muted mt-1 leading-relaxed">{tool.description}</p>
                </button>
              );
            })}
          </Panel>

          <Panel className="lg:col-span-2 p-5 space-y-4">
            <SectionHeader
              icon={<Terminal className="w-4 h-4 text-muted" />}
              title={`Execution sandbox — ${selectedTool}`}
              description="Runs a standard MCP tool call with runtime parameter validation. All results are local and simulated."
              actions={
                <Button
                  variant="primary"
                  loading={isExecuting}
                  loadingText="Invoking MCP…"
                  onClick={handleExecuteTool}
                  icon={<Play className="w-3.5 h-3.5" />}
                >
                  Execute tool call
                </Button>
              }
            />

            <div className="panel-subtle p-4 space-y-3">
              <span className="label-cap block">Parameters</span>
              {Object.entries(toolParams).map(([key, val]) => (
                <div key={key}>
                  <label htmlFor={`param-${key}`} className="block text-xs font-medium text-ink-dim mb-1 font-mono">
                    {key}
                  </label>
                  <input
                    id={`param-${key}`}
                    type="text"
                    value={val}
                    onChange={(e) => setToolParams({ ...toolParams, [key]: e.target.value })}
                    className="w-full bg-[#14171d] border border-line focus:border-amber rounded-lg px-3 py-2 text-xs text-ink font-mono outline-none transition-colors"
                  />
                </div>
              ))}
            </div>

            {toolResult && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-safe" />
                    Tool output
                  </span>
                  <span className="text-[10px] font-mono text-faint">local execution</span>
                </div>
                <pre className="p-4 rounded-lg bg-[#14171d] border border-line text-[11px] text-ink-dim font-mono overflow-x-auto max-h-72 leading-relaxed">
                  {toolResult}
                </pre>
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* Resources subtab */}
      {activeSubTab === 'resources' && (
        <Panel className="p-5 space-y-4">
          <SectionHeader
            icon={<Database className="w-4 h-4 text-muted" />}
            title="Exposed read-only resources"
            description="Agents and external MCP clients can read immutable safety policies and audit streams."
          />
          <div className="space-y-3">
            {[
              {
                uri: 'echoguard://safety-policies',
                desc: 'Returns the immutable collection of hard-coded safety rules (RULE-GAS-EVAC, RULE-SPARK-BLOCK, etc.).',
              },
              {
                uri: 'echoguard://incidents/recent',
                desc: 'Read-only collection of recent triaged incidents with risk scores and provenance data.',
              },
              {
                uri: 'echoguard://audit-log',
                desc: 'Chronological tamper-evident audit events including safety blocks and human authorization triggers.',
              },
            ].map((r) => (
              <div key={r.uri} className="panel-subtle p-4 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-ink-dim">{r.uri}</span>
                  <Badge tone="safe">application/json</Badge>
                </div>
                <p className="text-xs text-muted leading-relaxed">{r.desc}</p>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Prompts subtab */}
      {activeSubTab === 'prompts' && (
        <Panel className="p-5 space-y-4">
          <SectionHeader
            icon={<HelpCircle className="w-4 h-4 text-muted" />}
            title="Exposed prompts"
            description="Standard prompt templates that give external language models safety-governed instructions."
          />
          <div className="space-y-3">
            <div className="panel-subtle p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-ink-dim">emergency-triage</span>
                <Badge tone="neutral">prompt template</Badge>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Directs the model to prioritize life-safety evacuation, avoid switch/appliance instructions entirely,
                and gather unverified facts without inventing sensor readings.
              </p>
            </div>
            <div className="panel-subtle p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-ink-dim">safety-audit</span>
                <Badge tone="neutral">prompt template</Badge>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Inspects proposed automation actions for spark hazards and physical actuator risks in flammable
                environments.
              </p>
            </div>
          </div>
        </Panel>
      )}

      {/* Config subtab */}
      {activeSubTab === 'config' && (
        <Panel className="p-5 space-y-4">
          <SectionHeader
            icon={<FileCode className="w-4 h-4 text-muted" />}
            title="MCP client integration snippet"
            description="Add this to your Claude Desktop, Cursor, or compatible MCP client configuration."
            actions={
              <Button
                size="sm"
                variant="secondary"
                onClick={handleCopyConfig}
                icon={copiedConfig ? <Check className="w-3.5 h-3.5 text-safe" /> : <Copy className="w-3.5 h-3.5" />}
              >
                {copiedConfig ? 'Copied' : 'Copy config'}
              </Button>
            }
          />
          <pre className="p-4 rounded-lg bg-[#14171d] border border-line text-xs text-ink-dim font-mono overflow-x-auto leading-relaxed">
            {mcpConfigJson}
          </pre>
          <p className="text-[11px] text-muted flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-faint" />
            The server runs locally over stdio; no external network calls are made by the MCP layer.
          </p>
        </Panel>
      )}
    </div>
  );
};
