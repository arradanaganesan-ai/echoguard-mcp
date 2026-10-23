import React from 'react';
import {
  AlertOctagon,
  Ban,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  MapPin,
  ShieldCheck,
  UserCheck,
  TriangleAlert,
  CircleCheck,
  Info,
} from 'lucide-react';
import {
  IncidentRecord,
  IncidentAction,
  NotificationPreview,
  RiskLevel,
  IncidentTimelineEvent,
} from '../../shared/types.js';
import { Badge, Panel, EmptyState, Button, SectionHeader } from '../ui/primitives.js';

/* ---------------------------------------------------------------
   Shared, data-driven visualization components. All content comes
   from real incident records — nothing here fabricates activity.
   --------------------------------------------------------------- */

/* ---------- Risk level helpers ---------- */

export const riskTone = (level?: RiskLevel): 'danger' | 'amber' | 'safe' | 'neutral' => {
  switch (level) {
    case 'CRITICAL':
      return 'danger';
    case 'HIGH':
      return 'amber';
    case 'LOW':
      return 'safe';
    default:
      return 'neutral';
  }
};

export const riskColorText = (level?: RiskLevel): string => {
  switch (level) {
    case 'CRITICAL':
      return 'text-danger';
    case 'HIGH':
      return 'text-amber';
    case 'LOW':
      return 'text-safe';
    default:
      return 'text-ink-dim';
  }
};

/* ---------- Incident summary card ---------- */

interface IncidentCardProps {
  incident: IncidentRecord;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onOpenDetails: (id: string) => void;
}

export const IncidentCard: React.FC<IncidentCardProps> = ({
  incident,
  isSelected,
  onSelect,
  onOpenDetails,
}) => {
  const blocked = incident.actions.filter((a) => a.status === 'BLOCKED').length;
  const simulated = incident.actions.filter((a) => a.status === 'SIMULATED' || a.status === 'COMPLETED').length;

  return (
    <article
      className={`panel p-4 transition-colors duration-150 ${
        isSelected ? 'border-[rgba(243,182,74,0.45)]' : 'hover:border-line-strong'
      }`}
      aria-label={`Incident ${incident.id}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0 space-y-2 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold text-ink-dim">{incident.id}</span>
            <Badge tone={riskTone(incident.risk?.riskLevel)} title="Simulated assessment level — not a measured physical quantity">
              {incident.risk?.riskLevel || 'Triaged'} · {incident.risk?.score ?? '—'}/100
            </Badge>
            <Badge tone={incident.status === 'ACTIVE' ? 'amber' : incident.status === 'RESOLVED' ? 'safe' : 'neutral'}>
              {incident.status === 'ACTIVE' ? 'Active' : incident.status === 'RESOLVED' ? 'Resolved' : 'Under review'}
            </Badge>
          </div>

          <p className="text-sm text-ink-dim leading-relaxed">
            <span className="text-faint text-[11px] font-semibold uppercase tracking-wide mr-1.5">Reported:</span>
            “{incident.rawReport}”
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-faint" />
              {incident.intake?.locationLabel || 'Unknown location'}
            </span>
            <span>
              Hazard:{' '}
              <span className="text-ink-dim capitalize">{incident.intake?.reportedHazard.replace(/_/g, ' ')}</span>
            </span>
            {blocked > 0 && (
              <span className="inline-flex items-center gap-1 text-danger font-medium">
                <Ban className="w-3.5 h-3.5" />
                {blocked} blocked
              </span>
            )}
            {simulated > 0 && (
              <span className="inline-flex items-center gap-1 text-safe font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {simulated} simulated
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-faint">
              <Clock className="w-3.5 h-3.5" />
              {new Date(incident.createdAt).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="ghost" onClick={() => onOpenDetails(incident.id)} icon={<Eye className="w-3.5 h-3.5" />}>
            Details
          </Button>
          <Button size="sm" variant={isSelected ? 'secondary' : 'primary'} onClick={() => onSelect(incident.id)}>
            {isSelected ? 'Selected' : 'Make active'}
          </Button>
        </div>
      </div>
    </article>
  );
};

/* ---------- Risk & uncertainty panel ---------- */

interface RiskPanelProps {
  incident: IncidentRecord;
}

export const RiskPanel: React.FC<RiskPanelProps> = ({ incident }) => {
  const risk = incident.risk;
  const intake = incident.intake;
  if (!risk) {
    return <EmptyState icon={<Info className="w-8 h-8" />} title="No risk assessment yet" description="Run a simulation to generate a deterministic risk assessment." />;
  }

  const score = Math.min(100, Math.max(0, risk.score));

  return (
    <Panel className="p-5 space-y-4" ariaLabel="Risk assessment">
      <SectionHeader
        icon={<TriangleAlert className={`w-4 h-4 ${riskColorText(risk.riskLevel)}`} />}
        title="Risk assessment"
        description="Deterministic simulation output — not a measured physical quantity."
      />

      {/* Score */}
      <div>
        <div className="flex items-end justify-between mb-1.5">
          <span className="label-cap">Simulated score</span>
          <span className={`text-lg font-bold font-mono ${riskColorText(risk.riskLevel)}`}>
            {score}
            <span className="text-xs text-faint font-medium">/100</span>
          </span>
        </div>
        <div
          className="w-full h-1.5 rounded-full bg-[#14171d] border border-line overflow-hidden"
          role="meter"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Simulated risk score"
        >
          <div
            className={`h-full transition-all duration-500 ${
              risk.riskLevel === 'CRITICAL' ? 'bg-danger' : risk.riskLevel === 'HIGH' ? 'bg-amber' : 'bg-safe'
            }`}
            style={{ width: `${score}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <Badge tone={riskTone(risk.riskLevel)}>{risk.riskLevel}</Badge>
          <span className="text-[11px] text-muted">
            Confidence {(risk.confidence * 100).toFixed(0)}% · {new Date(risk.assessedAt).toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Factors & uncertainties side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="panel-subtle p-3 space-y-1.5">
          <span className="label-cap">Primary factors</span>
          <ul className="space-y-1">
            {risk.primaryFactors.length === 0 && <li className="text-xs text-faint">None recorded.</li>}
            {risk.primaryFactors.map((f, i) => (
              <li key={i} className="text-xs text-ink-dim leading-snug flex gap-1.5">
                <span className="text-amber mt-0.5">•</span>
                {f}
              </li>
            ))}
          </ul>
        </div>
        <div className="panel-subtle p-3 space-y-1.5">
          <span className="label-cap">Uncertainties (unverified)</span>
          <ul className="space-y-1">
            {risk.uncertainties.length === 0 && <li className="text-xs text-faint">None recorded.</li>}
            {risk.uncertainties.map((u, i) => (
              <li key={i} className="text-xs text-muted leading-snug flex gap-1.5">
                <EyeOff className="w-3 h-3 text-faint mt-0.5 shrink-0" />
                {u}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Sensor provenance */}
      <div
        className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-xs leading-relaxed ${
          intake?.hasSensorConfirmation
            ? 'bg-[rgba(114,199,154,0.06)] border-[rgba(114,199,154,0.3)] text-ink-dim'
            : 'bg-[rgba(243,182,74,0.06)] border-[rgba(243,182,74,0.3)] text-ink-dim'
        }`}
      >
        {intake?.hasSensorConfirmation ? (
          <ShieldCheck className="w-4 h-4 text-safe shrink-0 mt-0.5" />
        ) : (
          <EyeOff className="w-4 h-4 text-amber shrink-0 mt-0.5" />
        )}
        <div>
          <strong className="font-semibold">
            {intake?.hasSensorConfirmation ? 'Detector hardware alert present.' : 'Sensor data: UNVERIFIED.'}
          </strong>{' '}
          {intake?.hasSensorConfirmation
            ? 'Assessment includes a recorded detector alert from the intake pipeline.'
            : 'This assessment relies on human senses only — no calibrated sensor reading was available, and none has been invented.'}
        </div>
      </div>

      {/* Symptoms */}
      {intake && intake.symptoms.length > 0 && (
        <div>
          <span className="label-cap block mb-1.5">Reported symptoms (human-reported, not diagnosed)</span>
          <div className="flex flex-wrap gap-1.5">
            {intake.symptoms.map((s, i) => (
              <Badge key={i} tone="neutral">
                {s}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Missing information */}
      {intake && intake.missingInformation.length > 0 && (
        <div className="text-[11px] text-muted leading-relaxed border-t border-line pt-3">
          <strong className="text-ink-dim">Marked unknown by intake:</strong>{' '}
          {intake.missingInformation.join(' · ')}
        </div>
      )}

      <p className="text-[11px] text-faint italic border-t border-line pt-3 leading-relaxed">{risk.disclaimer}</p>
    </Panel>
  );
};

/* ---------- Safety guidance panel ---------- */

interface SafetyGuidancePanelProps {
  incident: IncidentRecord;
}

export const SafetyGuidancePanel: React.FC<SafetyGuidancePanelProps> = ({ incident }) => {
  const g = incident.safetyGuidance;
  if (!g) return null;

  return (
    <Panel tone={g.evacuationMandatory ? 'danger' : 'default'} className="p-5 space-y-4">
      <SectionHeader
        icon={<AlertOctagon className={`w-4 h-4 ${g.evacuationMandatory ? 'text-danger' : 'text-muted'}`} />}
        title={g.evacuationMandatory ? 'Mandatory evacuation guidance' : 'Safety guidance'}
        description={`Jurisdiction-aware instructions. Emergency numbers vary by country — e.g. 911 in the US/Canada, 112 in India, the EU, and many other countries.`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <span className="label-cap">Immediate actions</span>
          <ol className="space-y-1.5">
            {g.immediateActions.map((a, i) => (
              <li key={i} className="text-xs text-ink-dim leading-relaxed flex gap-2">
                <span className="font-mono text-faint shrink-0">{i + 1}.</span>
                {a}
              </li>
            ))}
          </ol>
        </div>
        <div className="space-y-2">
          <span className="label-cap text-danger">Strict prohibitions</span>
          <ul className="space-y-1.5">
            {g.strictProhibitions.map((p, i) => (
              <li key={i} className="text-xs text-ink-dim leading-relaxed flex gap-2">
                <Ban className="w-3.5 h-3.5 text-danger shrink-0 mt-0.5" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="panel-subtle px-3 py-2.5 text-xs text-muted leading-relaxed">
        <strong className="text-ink-dim">Safe distance guidance:</strong> {g.safeDistanceRecommendation}
      </div>

      {g.responderGuidance.length > 0 && (
        <div className="border-t border-line pt-3 space-y-1.5">
          <span className="label-cap">For arriving responders</span>
          <ul className="space-y-1">
            {g.responderGuidance.map((r, i) => (
              <li key={i} className="text-xs text-muted leading-relaxed flex gap-2">
                <span className="text-faint">→</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
};

/* ---------- Action decision table ---------- */

const actionStatusTone = (status: IncidentAction['status']): 'danger' | 'safe' | 'amber' | 'neutral' => {
  switch (status) {
    case 'BLOCKED':
      return 'danger';
    case 'SIMULATED':
    case 'COMPLETED':
      return 'safe';
    case 'PENDING_HUMAN_APPROVAL':
      return 'amber';
    default:
      return 'neutral';
  }
};

interface ActionTableProps {
  incident: IncidentRecord;
}

/**
 * Decision table for every candidate action screened by the safety
 * gate: status, rule, reason, and simulated/dispatch distinction.
 */
export const ActionDecisionTable: React.FC<ActionTableProps> = ({ incident }) => {
  if (incident.actions.length === 0) {
    return (
      <EmptyState
        icon={<Ban className="w-8 h-8" />}
        title="No candidate actions recorded"
        description="Actions appear here after the coordination agent proposes them or you test one in the workspace."
      />
    );
  }

  return (
    <div className="panel overflow-hidden">
      <div className="px-5 py-4 border-b border-line">
        <SectionHeader
          icon={<ShieldCheck className="w-4 h-4 text-amber" />}
          title="Action decision table"
          description="Every candidate action screened by the hard-coded safety gate. Nothing in this table has actuated real hardware or dispatched real notifications."
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[640px]">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="px-5 py-2.5 font-semibold text-muted" scope="col">
                Action
              </th>
              <th className="px-3 py-2.5 font-semibold text-muted" scope="col">
                Target
              </th>
              <th className="px-3 py-2.5 font-semibold text-muted" scope="col">
                Status
              </th>
              <th className="px-3 py-2.5 font-semibold text-muted" scope="col">
                Rule / Reason
              </th>
              <th className="px-5 py-2.5 font-semibold text-muted text-right" scope="col">
                Time
              </th>
            </tr>
          </thead>
          <tbody>
            {incident.actions.map((act) => (
              <tr key={act.id} className="border-b border-line/60 last:border-0 hover:bg-surface/40 transition-colors">
                <td className="px-5 py-3 text-ink-dim align-top">
                  <div className="font-medium">{act.label}</div>
                  <div className="text-faint font-mono text-[10px] mt-0.5">{act.type}</div>
                </td>
                <td className="px-3 py-3 text-muted align-top">{act.target || '—'}</td>
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-col items-start gap-1">
                    <Badge tone={actionStatusTone(act.status)}>{act.status.replace(/_/g, ' ').toLowerCase()}</Badge>
                    {act.isSimulated && (
                      <span className="text-[10px] text-faint" title="No real device, message, call, or actuator was contacted">
                        simulated only
                      </span>
                    )}
                    {act.requiresHumanApproval && !act.executedAt && (
                      <span className="text-[10px] text-amber">human approval required</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 align-top">
                  {act.blockedRecord ? (
                    <div className="space-y-1">
                      <span className="font-mono text-[10px] font-semibold text-danger">
                        {act.blockedRecord.violatedRuleId}
                      </span>
                      <p className="text-muted leading-relaxed">{act.blockedRecord.blockedReason}</p>
                      <p className="text-[10px] text-faint leading-relaxed">
                        Prevented harm: {act.blockedRecord.preventedHarm}
                      </p>
                    </div>
                  ) : (
                    <span className="text-muted leading-relaxed">
                      {act.status === 'PENDING_HUMAN_APPROVAL'
                        ? 'Awaiting verified human authorization — not transmitted.'
                        : act.description}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-right text-faint font-mono text-[10px] align-top whitespace-nowrap">
                  {new Date(act.executedAt || act.createdAt).toLocaleTimeString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ---------- Notification preview panel ---------- */

interface NotificationPanelProps {
  incident: IncidentRecord;
  onApprove: (notifId: string) => Promise<void>;
  approvingId: string | null;
  onOpenBriefing: () => void;
}

/**
 * Notification drafts. Every card is visibly marked NOT DISPATCHED;
 * approval is a simulated human-authorization step only.
 */
export const NotificationPreviewPanel: React.FC<NotificationPanelProps> = ({
  incident,
  onApprove,
  approvingId,
  onOpenBriefing,
}) => {
  if (incident.notifications.length === 0) {
    return (
      <EmptyState
        icon={<UserCheck className="w-8 h-8" />}
        title="No notification drafts"
        description="The coordination agent prepares notification drafts for emergency services, utilities, and contacts. None are ever sent automatically."
      />
    );
  }

  return (
    <Panel className="p-5 space-y-4">
      <SectionHeader
        icon={<UserCheck className="w-4 h-4 text-amber" />}
        title="Notification previews"
        description="Drafts require verified human authorization before any transmission. This prototype never sends them."
        actions={
          <Button size="sm" variant="ghost" onClick={onOpenBriefing}>
            Open full briefing →
          </Button>
        }
      />

      <div className="space-y-3">
        {incident.notifications.map((notif: NotificationPreview) => (
          <div key={notif.id} className="panel-subtle p-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-ink">{notif.recipientName}</span>
              <div className="flex items-center gap-1.5">
                <Badge tone={notif.priority === 'CRITICAL' ? 'danger' : notif.priority === 'HIGH' ? 'amber' : 'neutral'}>
                  {notif.priority.toLowerCase()}
                </Badge>
                <Badge tone="neutral" title="This draft has not been transmitted to anyone.">
                  Not dispatched
                </Badge>
              </div>
            </div>

            <p className="text-xs text-muted font-mono">
              <span className="text-faint">Subject:</span> {notif.draftSubject}
            </p>

            <pre className="p-3 rounded-lg bg-[#14171d] border border-line text-[11px] text-ink-dim font-mono whitespace-pre-wrap leading-relaxed max-h-44 overflow-y-auto">
              {notif.draftBody}
            </pre>

            <p className="text-[11px] text-amber/90 italic leading-relaxed">{notif.disclaimer}</p>

            {notif.approved ? (
              <p className="flex items-center gap-1.5 text-xs text-safe font-medium pt-1 border-t border-line">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Human authorization recorded (simulated) — still not transmitted.
              </p>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                loading={approvingId === notif.id}
                loadingText="Recording authorization…"
                icon={<UserCheck className="w-3.5 h-3.5" />}
                onClick={() => onApprove(notif.id)}
              >
                Authorize draft (simulated)
              </Button>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
};

/* ---------- Timeline visualization ---------- */

const agentTone: Record<IncidentTimelineEvent['agent'], { badge: string; dot: string }> = {
  intake: { badge: 'bg-surface text-ink-dim border-line-strong', dot: 'bg-ink-dim' },
  risk: { badge: 'bg-[rgba(243,182,74,0.1)] text-amber border-[rgba(243,182,74,0.35)]', dot: 'bg-amber' },
  safety: { badge: 'bg-[rgba(240,100,100,0.1)] text-danger border-[rgba(240,100,100,0.35)]', dot: 'bg-danger' },
  coordination: { badge: 'bg-surface text-muted border-line-strong', dot: 'bg-muted' },
  briefing: { badge: 'bg-[rgba(114,199,154,0.1)] text-safe border-[rgba(114,199,154,0.35)]', dot: 'bg-safe' },
  mcp: { badge: 'bg-surface text-muted border-line-strong', dot: 'bg-muted' },
  human: { badge: 'bg-[rgba(243,182,74,0.1)] text-amber border-[rgba(243,182,74,0.35)]', dot: 'bg-amber' },
};

const severityAccent: Record<IncidentTimelineEvent['severity'], string> = {
  critical: 'border-danger/60',
  warning: 'border-amber/60',
  success: 'border-safe/60',
  info: 'border-line-strong',
};

interface TimelineProps {
  events: IncidentTimelineEvent[];
  emptyHint?: string;
  compact?: boolean;
}

/** Vertical decision-trace visualization with severity accents. */
export const TimelineViz: React.FC<TimelineProps> = ({ events, emptyHint, compact = false }) => {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={<Clock className="w-8 h-8" />}
        title="No timeline events"
        description={emptyHint || 'Events appear once a simulation has been run.'}
      />
    );
  }

  return (
    <ol className="relative space-y-3 pl-5" aria-label="Incident timeline">
      {/* Rail */}
      <span className="absolute left-[7px] top-2 bottom-2 w-px bg-line" aria-hidden="true" />
      {events.map((ev, idx) => {
        const tone = agentTone[ev.agent] || agentTone.coordination;
        return (
          <li key={ev.id || idx} className={`relative border-l-2 pl-4 pb-1 ${severityAccent[ev.severity] || 'border-line-strong'}`}>
            {/* Node dot */}
            <span
              className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full ${tone.dot} ring-2 ring-bg`}
              aria-hidden="true"
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-semibold ${tone.badge}`}>
                {ev.agent}
              </span>
              <span className="text-sm font-semibold text-ink leading-tight">{ev.title}</span>
              <span className="text-[10px] text-faint font-mono ml-auto">{new Date(ev.timestamp).toLocaleTimeString()}</span>
            </div>
            {!compact && ev.details && <p className="text-xs text-muted mt-1 leading-relaxed">{ev.details}</p>}
            {!compact && ev.stage && <p className="text-[10px] text-faint font-mono mt-0.5">stage: {ev.stage}</p>}
          </li>
        );
      })}
    </ol>
  );
};
