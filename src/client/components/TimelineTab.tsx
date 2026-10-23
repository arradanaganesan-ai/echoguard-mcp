import React, { useMemo, useState } from 'react';
import { GitBranch, Filter, Clock, ShieldAlert, Cpu, Sparkles, UserCheck, Server, Gauge } from 'lucide-react';
import { IncidentRecord, IncidentTimelineEvent } from '../../shared/types.js';
import { Panel, Badge, SectionHeader, EmptyState } from '../ui/primitives.js';
import { TimelineViz } from './shared-visuals.js';
import { RouteId } from '../shell/Sidebar.js';

interface TimelineTabProps {
  activeIncident: IncidentRecord | null;
  incidents: IncidentRecord[];
  onSelectIncident: (id: string) => void;
  onNavigateToRoute: (route: RouteId) => void;
}

type AgentFilter = IncidentTimelineEvent['agent'] | 'all';

const AGENT_META: Record<AgentFilter, { label: string; icon: React.FC<{ className?: string }> }> = {
  all: { label: 'All agents', icon: GitBranch },
  intake: { label: 'Intake', icon: Sparkles },
  risk: { label: 'Risk', icon: Gauge },
  coordination: { label: 'Coordination', icon: Cpu },
  safety: { label: 'Safety', icon: ShieldAlert },
  briefing: { label: 'Briefing', icon: Clock },
  mcp: { label: 'MCP', icon: Server },
  human: { label: 'Human', icon: UserCheck },
};

const AGENT_ORDER: AgentFilter[] = ['all', 'intake', 'risk', 'coordination', 'safety', 'briefing', 'mcp', 'human'];

export const TimelineTab: React.FC<TimelineTabProps> = ({
  activeIncident,
  incidents,
  onSelectIncident,
  onNavigateToRoute,
}) => {
  const [agentFilter, setAgentFilter] = useState<AgentFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | IncidentTimelineEvent['severity']>('all');

  const allEvents = activeIncident?.timeline || [];

  const filteredEvents = useMemo(
    () =>
      allEvents.filter((ev) => {
        const matchesAgent = agentFilter === 'all' || ev.agent === agentFilter;
        const matchesSeverity = severityFilter === 'all' || ev.severity === severityFilter;
        return matchesAgent && matchesSeverity;
      }),
    [allEvents, agentFilter, severityFilter]
  );

  // Per-agent counts for the filter chips (real event data only)
  const agentCounts = useMemo(() => {
    const counts: Partial<Record<AgentFilter, number>> = {};
    for (const ev of allEvents) {
      counts[ev.agent] = (counts[ev.agent] || 0) + 1;
    }
    return counts;
  }, [allEvents]);

  const severityCounts = useMemo(() => {
    const counts: Partial<Record<IncidentTimelineEvent['severity'], number>> = {};
    for (const ev of allEvents) {
      counts[ev.severity] = (counts[ev.severity] || 0) + 1;
    }
    return counts;
  }, [allEvents]);

  if (!activeIncident) {
    return (
      <EmptyState
        icon={<GitBranch className="w-8 h-8" />}
        title="No incident selected"
        description="The intelligence timeline shows the chronological multi-agent decision trace for the active incident. Run a simulation to populate it."
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <Panel className="p-5">
        <SectionHeader
          icon={<GitBranch className="w-4 h-4 text-amber" />}
          title="Intelligence timeline"
          description={`Chronological decision trace for ${activeIncident.id} — every intake, assessment, block, and authorization, in order.`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral" icon={<Clock className="w-3 h-3" />}>
                {allEvents.length} events
              </Badge>
              {incidents.length > 1 && (
                <div className="relative">
                  <label htmlFor="timeline-incident" className="sr-only">
                    Select incident for timeline
                  </label>
                  <select
                    id="timeline-incident"
                    value={activeIncident.id}
                    onChange={(e) => onSelectIncident(e.target.value)}
                    className="appearance-none pl-2.5 pr-7 py-1.5 rounded-lg bg-surface border border-line-strong text-[11px] text-ink-dim hover:border-[#3d4653] transition-colors cursor-pointer max-w-[14rem] truncate outline-none focus:border-amber"
                  >
                    {incidents.map((inc) => (
                      <option key={inc.id} value={inc.id}>
                        {inc.id} · {inc.risk?.riskLevel || 'TRIAGED'}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          }
        />
      </Panel>

      {/* Filters */}
      <Panel className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="label-cap flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5" />
              Agent
            </span>
            {AGENT_ORDER.map((agent) => {
              const meta = AGENT_META[agent];
              const count = agent === 'all' ? allEvents.length : agentCounts[agent] || 0;
              if (agent !== 'all' && count === 0) return null;
              return (
                <button
                  key={agent}
                  type="button"
                  onClick={() => setAgentFilter(agent)}
                  aria-pressed={agentFilter === agent}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border inline-flex items-center gap-1.5 ${
                    agentFilter === agent
                      ? 'bg-[#242b37] text-ink border-line-strong'
                      : 'bg-transparent text-muted hover:text-ink border-transparent hover:border-line'
                  }`}
                >
                  {meta.label}
                  <span className="text-[10px] text-faint font-mono">{count}</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="label-cap mr-1">Severity</span>
            {(['all', 'critical', 'warning', 'info', 'success'] as const).map((sev) => {
              const count = sev === 'all' ? allEvents.length : severityCounts[sev] || 0;
              if (sev !== 'all' && count === 0) return null;
              return (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setSeverityFilter(sev)}
                  aria-pressed={severityFilter === sev}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                    severityFilter === sev
                      ? 'bg-[#242b37] text-ink border-line-strong'
                      : 'bg-transparent text-muted hover:text-ink border-transparent hover:border-line'
                  }`}
                >
                  {sev}
                </button>
              );
            })}
          </div>
        </div>
        {filteredEvents.length !== allEvents.length && (
          <p className="text-[11px] text-muted border-t border-line pt-2.5">
            Showing {filteredEvents.length} of {allEvents.length} events (filters active).
          </p>
        )}
      </Panel>

      {/* Timeline visualization */}
      <Panel className="p-5">
        {filteredEvents.length === 0 ? (
          <EmptyState
            icon={<Clock className="w-7 h-7" />}
            title="No matching events"
            description="No timeline events match the current agent/severity filters. Clear them to see the full trace."
          />
        ) : (
          <TimelineViz events={filteredEvents} emptyHint="Run a simulation to populate the timeline." />
        )}
      </Panel>
    </div>
  );
};
