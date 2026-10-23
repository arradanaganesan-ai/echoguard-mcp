import React, { useCallback, useEffect, useState } from 'react';
import {
  FileText,
  Copy,
  Download,
  Check,
  Send,
  AlertTriangle,
  ShieldCheck,
  UserCheck,
  FileClock,
  RefreshCw,
  Hash,
} from 'lucide-react';
import { IncidentRecord } from '../../shared/types.js';
import { formatBriefingAsMarkdown } from '../../shared/agents/briefing-agent.js';
import { api } from '../api.js';
import { Panel, Badge, Button, SectionHeader, EmptyState } from '../ui/primitives.js';
import { useToasts } from '../ui/Toast.js';
import { ActionDecisionTable, NotificationPreviewPanel } from './shared-visuals.js';
import { RouteId } from '../shell/Sidebar.js';

interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  incidentId?: string;
}

interface BriefingsTabProps {
  activeIncident: IncidentRecord | null;
  incidents: IncidentRecord[];
  onSelectIncident: (id: string) => void;
  onRefresh: () => void;
  onNavigateToRoute: (route: RouteId) => void;
}

export const BriefingsTab: React.FC<BriefingsTabProps> = ({
  activeIncident,
  incidents,
  onSelectIncident,
  onRefresh,
  onNavigateToRoute,
}) => {
  const { pushToast } = useToasts();
  const [copied, setCopied] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const loadAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    try {
      const logs = await api.getAuditLogs();
      setAuditLogs(Array.isArray(logs) ? logs : []);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  const briefing = activeIncident?.briefing;

  const handleCopy = async () => {
    if (!briefing) return;
    try {
      await navigator.clipboard.writeText(formatBriefingAsMarkdown(briefing));
      setCopied(true);
      pushToast('success', 'Briefing copied', 'Markdown is on your clipboard.');
      setTimeout(() => setCopied(false), 2000);
    } catch (err: any) {
      pushToast('error', 'Copy failed', err?.message || 'Clipboard was not available.');
    }
  };

  const handleDownloadMd = () => {
    if (!briefing || !activeIncident) return;
    const blob = new Blob([formatBriefingAsMarkdown(briefing)], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeIncident.id}-responder-briefing.md`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast('success', 'Briefing downloaded', `${activeIncident.id}-responder-briefing.md`);
  };

  const handleDownloadJson = () => {
    if (!briefing || !activeIncident) return;
    const blob = new Blob([JSON.stringify(briefing, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeIncident.id}-briefing.json`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast('success', 'Briefing downloaded', `${activeIncident.id}-briefing.json`);
  };

  const handleApprove = async (notifId: string) => {
    if (!activeIncident) return;
    setApprovingId(notifId);
    try {
      await api.approveNotification(activeIncident.id, notifId);
      onRefresh();
      loadAuditLogs();
      pushToast('success', 'Authorization recorded (simulated)', 'The draft remains undispatched.');
    } catch (err: any) {
      pushToast('error', 'Authorization failed', err?.message || 'Unknown error');
    } finally {
      setApprovingId(null);
    }
  };

  if (!activeIncident || !briefing) {
    return (
      <EmptyState
        icon={<FileText className="w-8 h-8" />}
        title={activeIncident ? 'No briefing generated yet' : 'No incident selected'}
        description={
          activeIncident
            ? 'The briefing agent synthesizes a responder-ready briefing after a simulation runs. Run one from the response workspace.'
            : 'Select or run an incident to view its responder briefing and audit trail.'
        }
        action={
          <Button variant="primary" onClick={() => onNavigateToRoute('workspace')}>
            Open response workspace
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <Panel className="p-5">
        <SectionHeader
          icon={<FileText className="w-4 h-4 text-amber" />}
          title="Responder-ready incident briefing"
          description={`Incident ${activeIncident.id} · generated ${new Date(briefing.generatedAt).toLocaleString()}`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" loading={false} onClick={handleCopy} icon={copied ? <Check className="w-3.5 h-3.5 text-safe" /> : <Copy className="w-3.5 h-3.5" />}>
                {copied ? 'Copied' : 'Copy markdown'}
              </Button>
              <Button size="sm" variant="secondary" onClick={handleDownloadMd} icon={<Download className="w-3.5 h-3.5" />}>
                .md
              </Button>
              <Button size="sm" variant="secondary" onClick={handleDownloadJson} icon={<Download className="w-3.5 h-3.5" />}>
                .json
              </Button>
            </div>
          }
        />
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1.5 font-mono">
            <Hash className="w-3.5 h-3.5 text-faint" />
            Briefing: <span className="text-ink-dim">{briefing.briefingId}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 font-mono" title="Deterministic audit hash over the briefing record">
            <ShieldCheck className="w-3.5 h-3.5 text-faint" />
            Audit hash: <span className="text-ink-dim">{briefing.auditHash}</span>
          </span>
          {incidents.length > 1 && (
            <div className="relative">
              <label htmlFor="briefing-incident" className="sr-only">
                Select incident for briefing
              </label>
              <select
                id="briefing-incident"
                value={activeIncident.id}
                onChange={(e) => onSelectIncident(e.target.value)}
                className="appearance-none pl-2.5 pr-7 py-1 rounded-lg bg-surface border border-line-strong text-[11px] text-ink-dim hover:border-[#3d4653] transition-colors cursor-pointer max-w-[14rem] truncate outline-none focus:border-amber"
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
      </Panel>

      {/* Briefing body + notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Executive summary */}
          <Panel className="p-5 space-y-4">
            <SectionHeader icon={<FileText className="w-4 h-4 text-muted" />} title="Executive summary" />
            <p className="text-sm text-ink-dim leading-relaxed panel-subtle p-4">{briefing.summary}</p>

            {/* Known vs unverified */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="panel-subtle p-4 space-y-2">
                <span className="label-cap flex items-center gap-1.5 text-safe">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Known facts
                </span>
                <ul className="space-y-1.5">
                  {briefing.knownFacts.map((fact, idx) => (
                    <li key={idx} className="text-xs text-ink-dim leading-relaxed flex gap-2">
                      <Check className="w-3.5 h-3.5 text-safe shrink-0 mt-0.5" />
                      {fact}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="panel-subtle p-4 space-y-2">
                <span className="label-cap flex items-center gap-1.5 text-amber">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Unverified information &amp; uncertainties
                </span>
                <ul className="space-y-1.5">
                  {briefing.unverifiedInformation.map((item, idx) => (
                    <li key={idx} className="text-xs text-muted leading-relaxed flex gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Safety instructions */}
            <div className="space-y-2">
              <span className="label-cap block">Safety instructions issued to occupants</span>
              <div className="space-y-1.5">
                {briefing.safetyInstructionsIssued.map((inst, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-lg text-xs leading-relaxed border ${
                      inst.startsWith('PROHIBITION')
                        ? 'bg-[rgba(240,100,100,0.06)] text-ink-dim border-[rgba(240,100,100,0.3)] font-medium'
                        : 'bg-surface/60 text-ink-dim border-line'
                    }`}
                  >
                    {inst}
                  </div>
                ))}
              </div>
            </div>

            {/* Tally */}
            <div className="space-y-2 border-t border-line pt-4">
              <span className="label-cap block">Action tally &amp; safety governance</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                {[
                  { l: 'Total screened', v: briefing.actionsSummary.total, c: 'text-ink' },
                  { l: 'Simulated', v: briefing.actionsSummary.simulated, c: 'text-safe' },
                  { l: 'Blocked', v: briefing.actionsSummary.blocked, c: 'text-danger' },
                  { l: 'Human review', v: briefing.actionsSummary.pendingApproval, c: 'text-amber' },
                ].map((cell) => (
                  <div key={cell.l} className="panel-subtle p-2.5">
                    <span className={`text-lg font-bold ${cell.c}`}>{cell.v}</span>
                    <span className="block text-[10px] text-muted">{cell.l}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Outstanding uncertainties */}
            {briefing.outstandingUncertainties.length > 0 && (
              <div className="space-y-1.5 border-t border-line pt-4">
                <span className="label-cap flex items-center gap-1.5 text-amber">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Outstanding uncertainties for responders
                </span>
                <ul className="space-y-1">
                  {briefing.outstandingUncertainties.map((u, i) => (
                    <li key={i} className="text-xs text-muted leading-relaxed flex gap-2">
                      <span className="text-faint">?</span>
                      {u}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>

          {/* Blocked actions from the briefing */}
          {briefing.blockedActionsList.length > 0 && (
            <Panel className="p-5 space-y-3">
              <SectionHeader
                icon={<Send className="w-4 h-4 text-danger" />}
                title="Blocked actions recorded in this briefing"
                description="Each entry names the violated rule and the harm the gate prevented."
              />
              <div className="space-y-2">
                {briefing.blockedActionsList.map((b, i) => (
                  <div key={i} className="panel-danger p-3.5 space-y-1 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-ink">
                        {b.actionType} → {b.target}
                      </span>
                      <Badge tone="danger" className="font-mono">
                        {b.violatedRuleId}
                      </Badge>
                    </div>
                    <p className="text-ink-dim leading-relaxed">{b.blockedReason}</p>
                    <p className="text-danger/90 leading-relaxed">Prevented harm: {b.preventedHarm}</p>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* Action decision table */}
          <ActionDecisionTable incident={activeIncident} />
        </div>

        {/* Right column: notifications + audit stream */}
        <div className="space-y-6">
          <NotificationPreviewPanel
            incident={activeIncident}
            onApprove={handleApprove}
            approvingId={approvingId}
            onOpenBriefing={() => onNavigateToRoute('timeline')}
          />

          {/* Audit log stream (real /api/audit-logs data) */}
          <Panel className="p-5 space-y-3">
            <SectionHeader
              icon={<FileClock className="w-4 h-4 text-muted" />}
              title="Audit stream"
              description="Tamper-evident server audit log (latest 50 entries)."
              actions={
                <Button
                  size="sm"
                  variant="ghost"
                  loading={auditLoading}
                  loadingText="Loading…"
                  onClick={loadAuditLogs}
                  icon={<RefreshCw className="w-3.5 h-3.5" />}
                >
                  Reload
                </Button>
              }
            />
            {auditLogs.length === 0 ? (
              <p className="text-xs text-muted">No audit entries available. Is the backend running?</p>
            ) : (
              <ul className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                {auditLogs.slice(0, 50).map((log) => (
                  <li key={log.id} className="panel-subtle p-2.5 space-y-0.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-[10px] font-semibold text-amber">{log.action}</span>
                      <span className="text-[10px] text-faint font-mono">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-[11px] text-muted leading-relaxed">{log.details}</p>
                    {log.incidentId && (
                      <button
                        type="button"
                        onClick={() => onSelectIncident(log.incidentId!)}
                        className="text-[10px] font-mono text-ink-dim hover:text-amber transition-colors cursor-pointer"
                      >
                        {log.incidentId} →
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Quick links */}
          <Panel className="p-4">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" onClick={() => onNavigateToRoute('timeline')}>
                Full timeline →
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onNavigateToRoute('safety')}>
                Safety controls →
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onNavigateToRoute('incidents')}>
                All incidents →
              </Button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
};
