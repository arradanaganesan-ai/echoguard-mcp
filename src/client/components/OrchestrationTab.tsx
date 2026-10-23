import React from 'react';
import { Cpu, ShieldAlert, ArrowDown, CheckCircle2, Ban, Clock, Sparkles, Info, Gauge } from 'lucide-react';
import { IncidentRecord } from '../../shared/types.js';
import { Panel, Badge, EmptyState, SectionHeader } from '../ui/primitives.js';
import { RouteId } from '../shell/Sidebar.js';

interface OrchestrationTabProps {
  activeIncident: IncidentRecord | null;
  onNavigateToRoute: (route: RouteId) => void;
}

export const OrchestrationTab: React.FC<OrchestrationTabProps> = ({ activeIncident, onNavigateToRoute }) => {
  if (!activeIncident) {
    return (
      <EmptyState
        icon={<Cpu className="w-8 h-8" />}
        title="No active incident selected"
        description="Run an emergency scenario in the response workspace to inspect the full multi-agent orchestration trace."
        action={
          <button
            type="button"
            onClick={() => onNavigateToRoute('workspace')}
            className="text-xs text-amber hover:underline cursor-pointer font-medium"
          >
            Open response workspace →
          </button>
        }
      />
    );
  }

  const agents = [
    {
      id: 'intake',
      name: 'Incident Intake Agent',
      role: 'Sensor/audio parsing & provenance tagging',
      status: 'COMPLETED',
      input: activeIncident.rawReport,
      outputSummary: `Detected ${activeIncident.intake?.reportedHazard} in ${
        activeIncident.intake?.locationLabel
      }. Identified ${activeIncident.intake?.symptoms.length} symptoms and marked ${
        activeIncident.intake?.missingInformation.length
      } unknown facts.`,
      provenance: activeIncident.intake?.evidence || [],
      missingData: activeIncident.intake?.missingInformation || [],
      icon: Sparkles,
      tone: 'neutral' as const,
    },
    {
      id: 'risk',
      name: 'Risk Assessment Agent',
      role: 'Deterministic threat scoring & posture',
      status: 'COMPLETED',
      input: `Hazard: ${activeIncident.intake?.reportedHazard}, Symptoms: ${
        activeIncident.intake?.symptoms.join(', ') || 'none'
      }`,
      outputSummary: `Assigned ${activeIncident.risk?.riskLevel} with simulated score ${
        activeIncident.risk?.score
      }/100. Recommended posture: ${activeIncident.risk?.recommendedPosture}`,
      uncertainties: activeIncident.risk?.uncertainties || [],
      icon: ShieldAlert,
      tone: 'amber' as const,
    },
    {
      id: 'coordination',
      name: 'Coordination Agent',
      role: 'Workflow planning & notification drafting',
      status: 'COMPLETED',
      input: `Risk level: ${activeIncident.risk?.riskLevel}, actions proposed: ${activeIncident.actions.length}`,
      outputSummary: `Prepared ${activeIncident.notifications.length} notification drafts (emergency services / utility / contacts) with human-verification requirement. Formulated life-safety action candidates.`,
      icon: Cpu,
      tone: 'neutral' as const,
    },
    {
      id: 'safety',
      name: 'Safety Policy Agent (rule engine)',
      role: 'Hard-coded constraints & actuator isolation',
      status: 'ENFORCED',
      input: 'Evaluating candidate actions against RULE-GAS-EVAC, RULE-SPARK-BLOCK, RULE-ACTUATOR-BLOCK',
      outputSummary: `Screened ${activeIncident.actions.length} action(s): ${
        activeIncident.actions.filter((a) => a.status === 'BLOCKED').length
      } BLOCKED, ${
        activeIncident.actions.filter((a) => a.status === 'SIMULATED' || a.status === 'COMPLETED').length
      } permitted simulation. Spark and actuator barrier confirmed.`,
      blockedActions: activeIncident.actions.filter((a) => a.status === 'BLOCKED'),
      icon: Ban,
      tone: 'danger' as const,
    },
    {
      id: 'briefing',
      name: 'Incident Briefing Agent',
      role: 'Responder summary & audit synthesis',
      status: 'COMPLETED',
      input: 'Consolidated multi-agent outputs, audit timeline, and blocked-actions tally',
      outputSummary: `Generated responder-ready briefing (${
        activeIncident.briefing?.actionsSummary.total || activeIncident.actions.length
      } screened: ${activeIncident.briefing?.actionsSummary.simulated || 0} safe, ${
        activeIncident.briefing?.actionsSummary.blocked || 0
      } blocked). Audit verification hash: ${activeIncident.briefing?.auditHash}.`,
      icon: CheckCircle2,
      tone: 'safe' as const,
    },
  ];

  return (
    <div className="space-y-6">
      <Panel className="p-5">
        <SectionHeader
          icon={<Cpu className="w-4 h-4 text-amber" />}
          title="Agent orchestration mesh"
          description={`Real data flow and dependencies across the five specialist agents for incident ${activeIncident.id}.`}
          actions={<Badge tone="safe">5 agents synchronized</Badge>}
        />
      </Panel>

      <div className="space-y-4">
        {agents.map((agent, index) => {
          const Icon = agent.icon;
          return (
            <React.Fragment key={agent.id}>
              <Panel className="p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-surface border border-line flex items-center justify-center shrink-0">
                    <Icon className={`w-5 h-5 ${agent.tone === 'danger' ? 'text-danger' : agent.tone === 'amber' ? 'text-amber' : agent.tone === 'safe' ? 'text-safe' : 'text-muted'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] text-faint uppercase">Step {String(index + 1).padStart(2, '0')}</span>
                      <h3 className="text-sm font-semibold text-ink">{agent.name}</h3>
                      <Badge tone={agent.status === 'ENFORCED' ? 'amber' : 'neutral'}>{agent.status.toLowerCase()}</Badge>
                    </div>
                    <p className="text-xs text-muted mt-0.5">{agent.role}</p>
                  </div>
                </div>

                {/* Input vs output */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 pt-4 border-t border-line text-xs">
                  <div className="panel-subtle p-3 space-y-1">
                    <span className="label-cap block">Input received</span>
                    <p className="text-ink-dim font-mono text-[11px] leading-relaxed break-words">{agent.input}</p>
                  </div>
                  <div className="panel-subtle p-3 space-y-1">
                    <span className="label-cap block">Output produced</span>
                    <p className="text-ink-dim leading-relaxed">{agent.outputSummary}</p>
                  </div>
                </div>

                {/* Unverified data honesty note */}
                {agent.missingData && agent.missingData.length > 0 && (
                  <div className="panel-amber p-3 mt-3 text-xs space-y-1.5">
                    <span className="font-semibold text-amber flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5" />
                      Marked unverified / unknown (honest intake)
                    </span>
                    <ul className="space-y-0.5">
                      {agent.missingData.map((m, i) => (
                        <li key={i} className="text-ink-dim leading-relaxed">
                          • {m}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Risk uncertainties */}
                {agent.uncertainties && agent.uncertainties.length > 0 && (
                  <div className="panel-amber p-3 mt-3 text-xs space-y-1.5">
                    <span className="font-semibold text-amber flex items-center gap-1.5">
                      <Gauge className="w-3.5 h-3.5" />
                      Assessment uncertainties
                    </span>
                    <ul className="space-y-0.5">
                      {agent.uncertainties.map((u, i) => (
                        <li key={i} className="text-ink-dim leading-relaxed">
                          • {u}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Blocked-action interventions */}
                {agent.blockedActions && agent.blockedActions.length > 0 && (
                  <div className="panel-danger p-3 mt-3 text-xs space-y-2">
                    <span className="font-semibold text-danger flex items-center gap-1.5">
                      <Ban className="w-3.5 h-3.5" />
                      Hard-coded safety-rule interventions
                    </span>
                    {agent.blockedActions.map((b) => (
                      <div key={b.id} className="panel-subtle p-2.5 space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-ink-dim">
                            {b.type} on {b.target || b.label}
                          </span>
                          <Badge tone="danger" className="font-mono">
                            {b.blockedRecord?.violatedRuleId}
                          </Badge>
                        </div>
                        <p className="text-muted leading-relaxed">{b.blockedRecord?.blockedReason}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Provenance evidence list */}
                {agent.provenance && agent.provenance.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-line space-y-1.5">
                    <span className="label-cap flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Evidence captured
                    </span>
                    <ul className="space-y-1">
                      {agent.provenance.map((ev) => (
                        <li key={ev.id} className="text-[11px] text-muted leading-relaxed flex flex-wrap items-center gap-1.5">
                          <Badge tone={ev.source === 'sensor_verified' ? 'safe' : ev.source === 'user_reported' ? 'neutral' : 'amber'}>
                            {ev.source.replace(/_/g, ' ')}
                          </Badge>
                          {ev.description}
                          {!ev.verified && <span className="text-amber">(unverified)</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Panel>

              {index < agents.length - 1 && (
                <div className="flex justify-center text-muted" aria-hidden="true">
                  <ArrowDown className="w-4 h-4" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
