import React from 'react';
import {
  ShieldAlert,
  Flame,
  Ban,
  Activity,
  Cpu,
  ArrowRight,
  CheckCircle2,
  Gauge,
  TriangleAlert,
  Radio,
} from 'lucide-react';
import { SystemStats, IncidentRecord } from '../../shared/types.js';
import { DemoScenario } from '../../shared/scenarios.js';
import { Panel, Badge, Button, SectionHeader, EmptyState, StatusDot } from '../ui/primitives.js';
import { riskTone, riskColorText } from './shared-visuals.js';
import { RouteId } from '../shell/Sidebar.js';

interface OverviewTabProps {
  stats: SystemStats | null;
  recentIncidents: IncidentRecord[];
  scenarios: DemoScenario[];
  onSelectScenario: (scenario: DemoScenario) => void;
  onSelectIncident: (id: string) => void;
  onNavigateToWorkspace: () => void;
  onNavigateToRoute: (route: RouteId) => void;
  activeIncident: IncidentRecord | null;
}

const MetricCard: React.FC<{
  label: string;
  value: string | number;
  caption: string;
  icon: React.ReactNode;
  tone?: 'default' | 'danger' | 'amber' | 'safe';
}> = ({ label, value, caption, icon, tone = 'default' }) => {
  const toneText =
    tone === 'danger' ? 'text-danger' : tone === 'amber' ? 'text-amber' : tone === 'safe' ? 'text-safe' : 'text-ink';
  return (
    <Panel className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="label-cap">{label}</span>
        <span className="text-muted">{icon}</span>
      </div>
      <div className={`text-2xl font-bold ${toneText}`}>{value}</div>
      <p className="text-[11px] text-muted leading-snug">{caption}</p>
    </Panel>
  );
};

export const OverviewTab: React.FC<OverviewTabProps> = ({
  stats,
  recentIncidents,
  scenarios,
  onSelectScenario,
  onSelectIncident,
  onNavigateToWorkspace,
  onNavigateToRoute,
  activeIncident,
}) => {
  return (
    <div className="space-y-6">
      {/* Positioning statement */}
      <Panel className="p-6 relative overflow-hidden">
        <div className="max-w-3xl relative">
          <div className="flex items-center gap-2 mb-3">
            <Badge tone="amber" icon={<ShieldAlert className="w-3 h-3" />}>
              Safety-governed by design
            </Badge>
            <StatusDot tone="safe" label="Deterministic safety gate active" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight leading-snug">
            Emergency coordination that cannot endanger the people it serves
          </h2>
          <p className="mt-2.5 text-sm text-muted leading-relaxed">
            General-purpose AI and unconstrained smart-home automations can trigger fatal ignition sources — exhaust
            fans, switches, appliances — during a suspected gas leak, or invent sensor readings that never existed.
            EchoGuard MCP keeps <span className="text-ink-dim font-medium">generative agent reasoning</span> separate
            from a <span className="text-ink-dim font-medium">hard-coded life-safety gate</span>: every candidate
            action is screened, blocked actions are explained, and responders receive structured, provenance-labeled
            briefings over the Model Context Protocol.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <Button variant="primary" onClick={onNavigateToWorkspace} icon={<ArrowRight className="w-4 h-4" />}>
              Open response workspace
            </Button>
            <Button variant="secondary" onClick={() => onNavigateToRoute('safety')} icon={<ShieldAlert className="w-4 h-4" />}>
              Review safety controls
            </Button>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted px-3 py-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-safe" />
              Evacuation-first protocol
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted px-3 py-2">
              <Ban className="w-3.5 h-3.5 text-danger" />
              Sparks &amp; actuators blocked
            </span>
          </div>
        </div>
      </Panel>

      {/* KPI grid — real system statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total incidents"
          value={stats ? stats.totalIncidents : '—'}
          caption={`${stats ? stats.activeIncidents : 0} currently active · ${stats ? stats.totalIncidents - stats.activeIncidents : 0} resolved`}
          icon={<Activity className="w-4 h-4" />}
        />
        <MetricCard
          label="Critical risk"
          value={stats ? stats.criticalCount : '—'}
          caption="Simulated CRITICAL assessments (not measured)"
          icon={<Flame className="w-4 h-4" />}
          tone={stats && stats.criticalCount > 0 ? 'danger' : 'default'}
        />
        <MetricCard
          label="Actions blocked"
          value={stats ? stats.totalBlockedActions : '—'}
          caption="Hazardous candidates stopped by the safety gate"
          icon={<Ban className="w-4 h-4" />}
          tone={stats && stats.totalBlockedActions > 0 ? 'amber' : 'default'}
        />
        <MetricCard
          label="Agents in mesh"
          value={5}
          caption="Intake · Risk · Coordination · Safety · Briefing"
          icon={<Cpu className="w-4 h-4" />}
          tone="safe"
        />
      </div>

      {/* Active incident snapshot */}
      {activeIncident && (
        <Panel className="p-5">
          <SectionHeader
            icon={<Gauge className="w-4 h-4 text-amber" />}
            title="Active incident"
            description="The workspace, timeline, and briefings follow this selection."
            actions={
              <Button size="sm" variant="secondary" onClick={onNavigateToWorkspace}>
                Open in workspace →
              </Button>
            }
          />
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => onSelectIncident(activeIncident.id)}
              className="panel-subtle p-3 text-left hover:border-line-strong transition-colors cursor-pointer"
            >
              <span className="label-cap block mb-1">Incident</span>
              <span className="font-mono text-xs text-ink-dim">{activeIncident.id}</span>
            </button>
            <div className="panel-subtle p-3">
              <span className="label-cap block mb-1">Simulated risk</span>
              <Badge tone={riskTone(activeIncident.risk?.riskLevel)}>
                {activeIncident.risk?.riskLevel || '—'} · {activeIncident.risk?.score ?? '—'}/100
              </Badge>
            </div>
            <div className="panel-subtle p-3">
              <span className="label-cap block mb-1">Reported location</span>
              <span className="text-xs text-ink-dim">{activeIncident.intake?.locationLabel || '—'}</span>
            </div>
            <div className="panel-subtle p-3">
              <span className="label-cap block mb-1">Evacuation</span>
              {activeIncident.safetyGuidance?.evacuationMandatory ? (
                <Badge tone="danger">
                  <TriangleAlert className="w-3 h-3" /> Mandatory
                </Badge>
              ) : (
                <Badge tone="neutral">Not mandated</Badge>
              )}
            </div>
          </div>
          {activeIncident.safetyGuidance?.evacuationMandatory && (
            <p className="mt-3 text-xs text-ink-dim leading-relaxed bg-[rgba(240,100,100,0.06)] border border-[rgba(240,100,100,0.3)] rounded-lg px-3 py-2.5">
              <strong className="text-danger">Mandatory evacuation in effect.</strong>{' '}
              {activeIncident.safetyGuidance.safeDistanceRecommendation} Do not operate switches, fans, or appliances.
              Call emergency services only from a safe exterior location (911 in the US/Canada; 112 in India, the EU,
              and many other countries).
            </p>
          )}
        </Panel>
      )}

      {/* Scenarios & recent incidents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Panel className="lg:col-span-2 p-5">
          <SectionHeader
            icon={<Radio className="w-4 h-4 text-amber" />}
            title="Demonstration scenarios"
            description="Deterministic presets that exercise the full multi-agent pipeline. Selecting one runs it immediately."
          />
          <div className="mt-4 space-y-2.5">
            {scenarios.map((sc) => (
              <button
                key={sc.id}
                type="button"
                onClick={() => onSelectScenario(sc)}
                className="w-full panel-subtle p-3.5 text-left hover:border-line-strong transition-colors cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-ink-dim group-hover:text-ink transition-colors">
                      {sc.name}
                    </span>
                    <Badge tone={sc.badgeColor === 'red' ? 'danger' : sc.badgeColor === 'amber' ? 'amber' : sc.badgeColor === 'emerald' ? 'safe' : 'neutral'}>
                      {sc.badge}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted mt-1 leading-relaxed line-clamp-2">“{sc.rawReport}”</p>
                  <p className="text-[11px] text-faint mt-1">{sc.description}</p>
                </div>
                <span className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-amber group-hover:gap-2.5 transition-all">
                  Run scenario <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel className="p-5 flex flex-col">
          <SectionHeader
            icon={<Activity className="w-4 h-4 text-muted" />}
            title="Recent incidents"
            description="Persisted, audited triage records."
          />
          <div className="mt-4 space-y-2 flex-1 overflow-y-auto max-h-[420px] pr-1">
            {recentIncidents.length === 0 ? (
              <EmptyState
                icon={<Activity className="w-6 h-6" />}
                title="No incidents yet"
                description="Run a scenario to create the first audited incident record."
              />
            ) : (
              recentIncidents.slice(0, 6).map((inc) => (
                <button
                  key={inc.id}
                  type="button"
                  onClick={() => onSelectIncident(inc.id)}
                  className={`w-full text-left panel-subtle p-3 hover:border-line-strong transition-colors cursor-pointer ${
                    activeIncident?.id === inc.id ? 'border-[rgba(243,182,74,0.45)]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-ink-dim truncate">{inc.id}</span>
                    <Badge tone={riskTone(inc.risk?.riskLevel)}>{inc.risk?.riskLevel || 'Triaged'}</Badge>
                  </div>
                  <p className={`text-xs mt-1 line-clamp-1 ${riskColorText(inc.risk?.riskLevel)}`}>
                    {inc.rawReport.slice(0, 80)}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-faint mt-1.5">
                    <span>{new Date(inc.createdAt).toLocaleTimeString()}</span>
                    <span>
                      {inc.actions.filter((a) => a.status === 'BLOCKED').length} blocked ·{' '}
                      {inc.actions.filter((a) => a.status === 'SIMULATED').length} simulated
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="mt-3 w-full"
            onClick={() => onNavigateToRoute('incidents')}
          >
            View all incidents →
          </Button>
        </Panel>
      </div>
    </div>
  );
};
