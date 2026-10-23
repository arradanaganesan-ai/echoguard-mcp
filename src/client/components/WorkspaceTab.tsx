import React, { useState } from 'react';
import {
  Play,
  AlertOctagon,
  ShieldAlert,
  Ban,
  Sparkles,
  ZapOff,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Clock,
  GitBranch,
  FileText,
  Gauge,
} from 'lucide-react';
import { IncidentRecord, SimulateActionFeedback } from '../../shared/types.js';
import { DemoScenario } from '../../shared/scenarios.js';
import { Panel, Badge, Button, SectionHeader, EmptyState, Tooltip } from '../ui/primitives.js';
import { useToasts } from '../ui/Toast.js';
import {
  RiskPanel,
  SafetyGuidancePanel,
  ActionDecisionTable,
  NotificationPreviewPanel,
  TimelineViz,
} from './shared-visuals.js';
import { FacilityViewer } from './FacilityViewer.js';
import { RouteId } from '../shell/Sidebar.js';

interface WorkspaceTabProps {
  scenarios: DemoScenario[];
  activeIncident: IncidentRecord | null;
  isRunningSimulation: boolean;
  onRunSimulation: (payload: {
    report: string;
    scenarioId?: string;
    locationHint?: string;
    occupantsHint?: string;
  }) => Promise<void>;
  onSimulateAction: (actionType: string, target: string) => Promise<SimulateActionFeedback>;
  onApproveNotification: (notifId: string) => Promise<void>;
  onNavigateToRoute: (route: RouteId) => void;
}

const CANDIDATE_ACTIONS: Array<{ actionType: string; target: string; label: string; tone: 'danger' | 'amber' | 'safe'; icon: React.ReactNode; hint: string }> = [
  {
    actionType: 'turn_on_exhaust_fan',
    target: 'Kitchen Vent Fan',
    label: 'Turn on exhaust fan',
    tone: 'danger',
    icon: <Ban className="w-3.5 h-3.5" />,
    hint: 'Spark risk: motor arcing can ignite a gas-air mixture. Expect a safety block during gas leaks.',
  },
  {
    actionType: 'solenoid_valve_actuate',
    target: 'Main Gas Solenoid Valve',
    label: 'Trigger solenoid valve',
    tone: 'amber',
    icon: <ZapOff className="w-3.5 h-3.5" />,
    hint: 'Physical actuator: isolated by policy for all hazards. Expect a safety block.',
  },
  {
    actionType: 'display_screen_warning',
    target: 'Resident Mobile App',
    label: 'Display mobile warning',
    tone: 'safe',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    hint: 'Informational display only — no spark, no actuation. Simulated safely.',
  },
];

export const WorkspaceTab: React.FC<WorkspaceTabProps> = ({
  scenarios,
  activeIncident,
  isRunningSimulation,
  onRunSimulation,
  onSimulateAction,
  onApproveNotification,
  onNavigateToRoute,
}) => {
  const { pushToast } = useToasts();
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(scenarios[0]?.id || 'scenario-a');
  const [reportText, setReportText] = useState<string>(
    scenarios[0]?.rawReport || 'I smell gas and my eyes are burning in the kitchen.'
  );
  const [locationHint, setLocationHint] = useState<string>(scenarios[0]?.locationHint || 'Kitchen');
  const [occupantsHint, setOccupantsHint] = useState<string>(scenarios[0]?.occupantsHint || '2 adults and 1 dog');
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{
    actionType: string;
    target: string;
    result: SimulateActionFeedback;
  } | null>(null);

  // Synchronize inputs when active incident changes externally; action
  // feedback is incident-scoped so results never leak across incidents.
  React.useEffect(() => {
    if (activeIncident) {
      if (activeIncident.scenarioId) setSelectedScenarioId(activeIncident.scenarioId);
      if (activeIncident.rawReport) setReportText(activeIncident.rawReport);
      if (activeIncident.intake?.locationLabel) setLocationHint(activeIncident.intake.locationLabel);
    }
    setActionFeedback(null);
  }, [activeIncident?.id]);

  const handleScenarioSelect = (sc: DemoScenario) => {
    setSelectedScenarioId(sc.id);
    setReportText(sc.rawReport);
    setLocationHint(sc.locationHint || '');
    setOccupantsHint(sc.occupantsHint || '');
  };

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportText.trim() || isRunningSimulation) return;
    await onRunSimulation({
      report: reportText,
      scenarioId: selectedScenarioId,
      locationHint,
      occupantsHint,
    });
    pushToast('success', 'Simulation complete', 'Five-agent pipeline finished. Incident record and briefing refreshed.');
  };

  const handleTestCandidateAction = async (actionType: string, target: string) => {
    // Anti double-submit guard: only one request in flight at a time.
    if (actionBusy !== null) return;
    setActionBusy(actionType);
    try {
      const result = await onSimulateAction(actionType, target);
      setActionFeedback({ actionType, target, result });
      if (result.ok && result.action?.status === 'BLOCKED') {
        pushToast(
          'blocked',
          'Action blocked by safety policy',
          `${result.action.blockedRecord?.violatedRuleId}: no hardware was contacted.`
        );
      } else if (result.ok) {
        pushToast('success', 'Action simulated', `${actionType} on ${target} — simulated only, nothing physical occurred.`);
      } else {
        pushToast('error', 'Action request failed', result.error);
      }
    } catch (err: any) {
      const msg = err?.message || 'Unexpected client error while simulating action';
      setActionFeedback({ actionType, target, result: { ok: false, error: msg } });
      pushToast('error', 'Action request failed', msg);
    } finally {
      setActionBusy(null);
    }
  };

  const handleApproveNotification = async (notifId: string) => {
    setApprovingId(notifId);
    try {
      await onApproveNotification(notifId);
      pushToast('success', 'Authorization recorded (simulated)', 'The draft remains undispatched — this prototype never sends notifications.');
    } catch (err: any) {
      pushToast('error', 'Authorization failed', err?.message || 'Unknown error');
    } finally {
      setApprovingId(null);
    }
  };

  const allActions = activeIncident?.actions || [];
  const blockedActions = allActions.filter((a) => a.status === 'BLOCKED');
  const simulatedActions = allActions.filter((a) => a.status === 'SIMULATED' || a.status === 'COMPLETED');
  const summary = activeIncident?.briefing?.actionsSummary ?? {
    total: allActions.length,
    proposed: allActions.filter((a) => a.status === 'PROPOSED').length,
    simulated: simulatedActions.length,
    blocked: blockedActions.length,
    pendingApproval: allActions.filter((a) => a.status === 'PENDING_HUMAN_APPROVAL').length,
  };
  const isEvacMandatory = !!activeIncident?.safetyGuidance?.evacuationMandatory;

  return (
    <div className="space-y-6">
      {/* 1. Scenario strip + intake form */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Panel className="xl:col-span-2 p-5">
          <SectionHeader
            icon={<Sparkles className="w-4 h-4 text-amber" />}
            title="Emergency report intake"
            description="Pick a deterministic preset or type a custom report. The five-agent pipeline and safety gate run on submit."
          />
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {scenarios.map((sc) => {
              const isSelected = selectedScenarioId === sc.id;
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => handleScenarioSelect(sc)}
                  aria-pressed={isSelected}
                  className={`p-2.5 rounded-lg text-left border transition-colors duration-150 cursor-pointer ${
                    isSelected
                      ? 'bg-[#242b37] border-[rgba(243,182,74,0.5)] shadow-[inset_0_0_0_1px_rgba(243,182,74,0.15)]'
                      : 'bg-surface/50 border-line hover:border-line-strong'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-semibold truncate ${isSelected ? 'text-ink' : 'text-ink-dim'}`}>
                      {sc.name.split(':')[0]}
                    </span>
                    <Badge
                      tone={sc.badgeColor === 'red' ? 'danger' : sc.badgeColor === 'purple' ? 'neutral' : sc.badgeColor === 'amber' ? 'amber' : 'safe'}
                      className="shrink-0"
                    >
                      {sc.badge}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted mt-1 line-clamp-1">{sc.description}</p>
                </button>
              );
            })}
          </div>

          <form onSubmit={handleRun} className="mt-4 space-y-3.5">
            <div>
              <label htmlFor="rawReport" className="label-cap block mb-1.5">
                Incoming report (audio transcript or text)
              </label>
              <textarea
                id="rawReport"
                rows={2}
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder="e.g. 'I smell gas and my eyes are burning in the kitchen…'"
                className="w-full bg-[#14171d] border border-line focus:border-amber rounded-lg p-3 text-sm text-ink placeholder:text-faint outline-none transition-colors leading-relaxed resize-y"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="locationHint" className="label-cap block mb-1.5">
                  Location cue
                </label>
                <input
                  id="locationHint"
                  type="text"
                  value={locationHint}
                  onChange={(e) => setLocationHint(e.target.value)}
                  placeholder="e.g. Kitchen, basement, furnace room"
                  className="w-full bg-[#14171d] border border-line focus:border-amber rounded-lg px-3 py-2 text-sm text-ink placeholder:text-faint outline-none transition-colors"
                />
              </div>
              <div>
                <label htmlFor="occupantsHint" className="label-cap block mb-1.5">
                  Occupant / animal census
                </label>
                <input
                  id="occupantsHint"
                  type="text"
                  value={occupantsHint}
                  onChange={(e) => setOccupantsHint(e.target.value)}
                  placeholder="e.g. 2 adults, 1 infant, pets"
                  className="w-full bg-[#14171d] border border-line focus:border-amber rounded-lg px-3 py-2 text-sm text-ink placeholder:text-faint outline-none transition-colors"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <span className="text-xs text-muted">Deterministic pipeline · simulated assessment · no live calls</span>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={isRunningSimulation}
                loadingText="Orchestrating 5 agents…"
                icon={<Play className="w-4 h-4" />}
                disabled={!reportText.trim()}
              >
                Run simulation
              </Button>
            </div>
          </form>
        </Panel>

        {/* 3D facility schematic */}
        <FacilityViewer activeIncident={activeIncident} />
      </div>

      {!activeIncident && (
        <EmptyState
          icon={<Gauge className="w-8 h-8" />}
          title="No active incident"
          description="Run a simulation above to populate the workspace with risk assessment, safety guidance, action decisions, and responder briefings."
        />
      )}

      {activeIncident && (
        <>
          {/* 2. Mandatory evacuation banner */}
          {isEvacMandatory && (
            <Panel tone="danger" className="p-5 relative overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-danger text-[#1a0d0d] shrink-0">
                    <AlertOctagon className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="danger">RULE-GAS-EVAC enforced</Badge>
                      <span className="font-mono text-[11px] text-muted">{activeIncident.id}</span>
                    </div>
                    <h2 className="text-lg font-bold text-ink mt-1.5 leading-snug">
                      Mandatory life-safety evacuation in effect
                    </h2>
                    <p className="text-xs text-ink-dim mt-1.5 max-w-2xl leading-relaxed">
                      {activeIncident.safetyGuidance?.safeDistanceRecommendation}. Do <strong>not</strong> operate
                      light switches, fans, or appliances. If it is safe and it does not delay your exit, leave doors
                      unlatched behind you; call emergency services <strong>only from a safe exterior location</strong>{' '}
                      (911 in the US/Canada; 112 in India, the EU, and many other countries).
                    </p>
                  </div>
                </div>
                <Button variant="danger" size="md" onClick={() => onNavigateToRoute('briefings')} className="shrink-0">
                  View briefing →
                </Button>
              </div>
            </Panel>
          )}

          {/* 3. Risk + safety guidance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RiskPanel incident={activeIncident} />
            <SafetyGuidancePanel incident={activeIncident} />
          </div>

          {/* 4. Safety gate: blocked actions + summary + interactive tests */}
          <Panel className="p-5 space-y-4">
            <SectionHeader
              icon={<ShieldAlert className="w-4 h-4 text-amber" />}
              title="Safety policy gate"
              description="An independent, hard-coded rule engine screens every candidate action before anything is allowed to proceed."
              actions={
                <Button size="sm" variant="ghost" onClick={() => onNavigateToRoute('mesh')}>
                  Inspect agent mesh →
                </Button>
              }
            />

            {/* Blocked actions */}
            {blockedActions.length > 0 ? (
              <div className="space-y-2.5">
                <span className="label-cap text-danger flex items-center gap-1.5">
                  <Ban className="w-3.5 h-3.5" />
                  {blockedActions.length} hazardous action{blockedActions.length > 1 ? 's' : ''} blocked
                </span>
                {blockedActions.map((act) => (
                  <div key={act.id} className="panel-danger p-3.5 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-ink">
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
                  </div>
                ))}
              </div>
            ) : (
              <div className="panel-safe p-3.5 text-xs text-ink-dim flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-safe shrink-0" />
                All proposed candidate actions passed the safety constraints so far.
              </div>
            )}

            {/* Summary tally */}
            <div className="border-t border-line pt-4">
              <span className="label-cap block mb-2.5">Action summary (screened by the safety policy)</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { label: 'Total screened', value: summary.total, tone: 'text-ink' },
                  { label: 'Simulated (safe)', value: summary.simulated, tone: 'text-safe' },
                  { label: 'Blocked', value: summary.blocked, tone: 'text-danger' },
                  { label: 'Pending approval', value: summary.pendingApproval, tone: 'text-amber' },
                ].map((cell) => (
                  <div key={cell.label} className="panel-subtle p-3 text-center">
                    <span className="text-[10px] text-muted block">{cell.label}</span>
                    <span className={`text-xl font-bold ${cell.tone}`}>{cell.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive candidate-action screening */}
            <div className="border-t border-line pt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="label-cap">Interactive safety test — attempt candidate actions</span>
                <span className="text-[11px] text-muted">Each request is screened; nothing physical is contacted.</span>
              </div>

              {/* Immediate feedback (loading → simulated / blocked / error) */}
              {actionFeedback && (
                <div
                  role="status"
                  aria-live="polite"
                  className={`fade-in p-3.5 rounded-xl border space-y-1.5 text-xs ${
                    actionFeedback.result.ok
                      ? actionFeedback.result.action?.status === 'BLOCKED'
                        ? 'bg-[rgba(240,100,100,0.06)] border-[rgba(240,100,100,0.4)]'
                        : 'bg-[rgba(114,199,154,0.06)] border-[rgba(114,199,154,0.4)]'
                      : 'bg-[rgba(240,100,100,0.06)] border-[rgba(240,100,100,0.4)]'
                  }`}
                >
                  {actionFeedback.result.ok ? (
                    actionFeedback.result.action?.status === 'BLOCKED' ? (
                      <>
                        <div className="flex items-center gap-2 font-semibold text-danger">
                          <Ban className="w-4 h-4" />
                          Action BLOCKED by safety policy —{' '}
                          <span className="font-mono">{actionFeedback.result.action.blockedRecord?.violatedRuleId}</span>
                        </div>
                        <p className="text-ink-dim leading-relaxed">
                          {actionFeedback.result.action.blockedRecord?.blockedReason}
                        </p>
                        <p className="text-danger/90 flex items-center gap-1.5">
                          <ZapOff className="w-3.5 h-3.5 shrink-0" />
                          Prevented harm: {actionFeedback.result.action.blockedRecord?.preventedHarm}
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 font-semibold text-safe">
                          <CheckCircle2 className="w-4 h-4" />
                          Action {actionFeedback.result.action?.status || 'COMPLETED'} —{' '}
                          {actionFeedback.result.action?.type} → {actionFeedback.result.action?.target}
                        </div>
                        <p className="text-ink-dim leading-relaxed">
                          Simulated only: no real device, notification, push message, call, or physical actuator was
                          contacted. The action tally, audit timeline, briefing, and safety-policy section have been
                          refreshed.
                        </p>
                        <p className="text-[11px] text-muted flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          Recorded at{' '}
                          {new Date(
                            actionFeedback.result.action?.executedAt ||
                              actionFeedback.result.action?.createdAt ||
                              Date.now()
                          ).toLocaleTimeString()}
                        </p>
                      </>
                    )
                  ) : (
                    <>
                      <div className="flex items-center gap-2 font-semibold text-danger">
                        <AlertTriangle className="w-4 h-4" />
                        Action request failed — {actionFeedback.target}
                      </div>
                      <p className="text-ink-dim leading-relaxed">{actionFeedback.result.error}</p>
                      <p className="text-[11px] text-muted">
                        Nothing was simulated. Verify the backend is running, then try again.
                      </p>
                    </>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {CANDIDATE_ACTIONS.map((act) => (
                  <Tooltip key={act.actionType} label={act.hint}>
                    <Button
                      size="sm"
                      variant={act.tone === 'safe' ? 'safe' : act.tone === 'amber' ? 'secondary' : 'danger'}
                      loading={actionBusy === act.actionType}
                      loadingText="Simulating…"
                      disabled={actionBusy !== null}
                      icon={act.icon}
                      onClick={() => handleTestCandidateAction(act.actionType, act.target)}
                    >
                      {act.label}
                    </Button>
                  </Tooltip>
                ))}
              </div>
            </div>
          </Panel>

          {/* 5. Action decision table */}
          <ActionDecisionTable incident={activeIncident} />

          {/* 6. Notification previews */}
          <NotificationPreviewPanel
            incident={activeIncident}
            onApprove={handleApproveNotification}
            approvingId={approvingId}
            onOpenBriefing={() => onNavigateToRoute('briefings')}
          />

          {/* 7. Recent timeline + deep links */}
          <Panel className="p-5">
            <SectionHeader
              icon={<GitBranch className="w-4 h-4 text-muted" />}
              title={`Audit timeline — latest ${Math.min(6, activeIncident.timeline.length)} of ${activeIncident.timeline.length} events`}
              description="Every decision, block, and authorization is recorded with an audit hash."
              actions={
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="ghost" onClick={() => onNavigateToRoute('timeline')}>
                    Full timeline →
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onNavigateToRoute('briefings')} icon={<FileText className="w-3.5 h-3.5" />}>
                    Briefing
                  </Button>
                </div>
              }
            />
            <div className="mt-4">
              <TimelineViz events={[...activeIncident.timeline].slice(-6).reverse()} compact emptyHint="Run a simulation to populate the timeline." />
            </div>
          </Panel>
        </>
      )}
    </div>
  );
};
