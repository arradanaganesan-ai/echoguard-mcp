import React from 'react';
import { ShieldAlert, Lock, ZapOff, Ban, AlertOctagon, PhoneCall, Stethoscope, FileWarning } from 'lucide-react';
import { SafetyRule, IncidentRecord } from '../../shared/types.js';
import { Panel, Badge, SectionHeader, EmptyState } from '../ui/primitives.js';

interface SafetyControlsTabProps {
  rules: ReadonlyArray<SafetyRule>;
  activeIncident: IncidentRecord | null;
}

const categoryMeta: Record<SafetyRule['category'], { icon: React.FC<{ className?: string }>; label: string }> = {
  evacuation: { icon: AlertOctagon, label: 'Evacuation' },
  spark_prevention: { icon: ZapOff, label: 'Spark prevention' },
  actuator_isolation: { icon: Ban, label: 'Actuator isolation' },
  communication: { icon: PhoneCall, label: 'Communication' },
  medical: { icon: Stethoscope, label: 'Medical' },
};

const severityTone = (s: SafetyRule['severity']): 'danger' | 'amber' | 'neutral' =>
  s === 'MANDATORY' ? 'danger' : s === 'BLOCKING' ? 'amber' : 'neutral';

export const SafetyControlsTab: React.FC<SafetyControlsTabProps> = ({ rules, activeIncident }) => {
  const blockedActions = activeIncident?.actions.filter((a) => a.status === 'BLOCKED') || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <Panel className="p-5">
        <SectionHeader
          icon={<ShieldAlert className="w-4 h-4 text-amber" />}
          title="Hard-coded emergency safety rules"
          description="Immutable constraints that no LLM prompt, agent reasoning, or external automation call can bypass."
          actions={<Badge tone="amber">Zero-trust enforcement</Badge>}
        />
      </Panel>

      {/* Live enforcement for the active incident */}
      <Panel className="p-5 space-y-4">
        <SectionHeader
          icon={<Lock className="w-4 h-4 text-safe" />}
          title="Live enforcement — active incident"
          description={
            activeIncident
              ? `Rule-engine outcomes recorded against ${activeIncident.id}.`
              : 'No incident is currently selected.'
          }
        />
        {!activeIncident ? (
          <EmptyState
            icon={<ShieldAlert className="w-7 h-7" />}
            title="No active incident"
            description="Run a simulation in the response workspace to see real rule-engine interventions here."
          />
        ) : blockedActions.length === 0 ? (
          <div className="panel-safe p-4 text-sm text-ink-dim flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-safe shrink-0" />
            No hazardous candidate actions have been attempted for this incident — the gate has nothing blocked to report.
          </div>
        ) : (
          <div className="space-y-2.5">
            {blockedActions.map((act) => (
              <div key={act.id} className="panel-danger p-4 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink">
                    {act.label} <span className="text-muted font-normal">({act.target || act.type})</span>
                  </span>
                  <Badge tone="danger" className="font-mono">
                    {act.blockedRecord?.violatedRuleId}
                  </Badge>
                </div>
                <p className="text-xs text-ink-dim leading-relaxed">{act.blockedRecord?.blockedReason}</p>
                <p className="text-[11px] text-danger/90 flex items-center gap-1.5">
                  <ZapOff className="w-3.5 h-3.5 shrink-0" />
                  Prevented harm: {act.blockedRecord?.preventedHarm}
                </p>
                <p className="text-[10px] text-faint font-mono">
                  {act.blockedRecord ? new Date(act.blockedRecord.timestamp).toLocaleString() : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Rules grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rules.map((rule) => {
          const meta = categoryMeta[rule.category] || { icon: Lock, label: rule.category };
          const Icon = meta.icon;
          return (
            <Panel key={rule.id} className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-surface border border-line flex items-center justify-center shrink-0">
                    <Icon className="w-4.5 h-4.5 text-amber" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-mono text-[11px] font-semibold text-amber block">{rule.id}</span>
                    <h3 className="text-sm font-semibold text-ink leading-tight">{rule.name}</h3>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge tone={severityTone(rule.severity)}>{rule.severity.toLowerCase()}</Badge>
                  <Badge tone="neutral">{meta.label}</Badge>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="label-cap block mb-1">Enforcement policy</span>
                  <p className="text-ink-dim leading-relaxed panel-subtle p-3">{rule.description}</p>
                </div>
                <div>
                  <span className="label-cap block mb-1">Engineering &amp; physical rationale</span>
                  <p className="text-muted leading-relaxed panel-amber p-3">{rule.rationale}</p>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>

      {/* Architectural guarantee */}
      <Panel className="p-5 space-y-2.5">
        <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
          <FileWarning className="w-4 h-4 text-safe" />
          Architectural guarantee
        </h3>
        <p className="text-sm text-muted leading-relaxed">
          EchoGuard separates <span className="text-ink-dim font-medium">generative agent reasoning</span> from{' '}
          <span className="text-ink-dim font-medium">deterministic life-safety governance</span>. Even if an LLM is
          hallucinated, jailbroken, or prompted to “turn on the basement exhaust fan to disperse the gas”, the safety
          policy agent independently intercepts the tool call, matches spark and actuator signatures against
          hard-coded rules, blocks execution, and produces an auditable violation record with the prevented-harm
          rationale.
        </p>
      </Panel>
    </div>
  );
};
