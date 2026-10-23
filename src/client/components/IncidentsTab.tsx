import React, { useMemo, useState } from 'react';
import {
  Search,
  Filter,
  Calendar,
  Ban,
  FileText,
  Layers,
  ShieldCheck,
  AlertTriangle,
  Gauge,
} from 'lucide-react';
import { IncidentRecord } from '../../shared/types.js';
import { Panel, Badge, Button, EmptyState, Drawer, SectionHeader } from '../ui/primitives.js';
import { IncidentCard, riskTone, TimelineViz } from './shared-visuals.js';
import { RouteId } from '../shell/Sidebar.js';

interface IncidentsTabProps {
  incidents: IncidentRecord[];
  activeIncidentId: string | null;
  onSelectIncident: (id: string) => void;
  onNavigateToRoute: (route: RouteId) => void;
}

const RISK_FILTERS = ['ALL', 'CRITICAL', 'HIGH', 'MODERATE', 'LOW'] as const;
const STATUS_FILTERS = ['ALL', 'ACTIVE', 'RESOLVED'] as const;

export const IncidentsTab: React.FC<IncidentsTabProps> = ({
  incidents,
  activeIncidentId,
  onSelectIncident,
  onNavigateToRoute,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [detailsId, setDetailsId] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      incidents.filter((inc) => {
        const q = searchTerm.toLowerCase();
        const matchesSearch =
          inc.id.toLowerCase().includes(q) ||
          inc.rawReport.toLowerCase().includes(q) ||
          (inc.intake?.locationLabel || '').toLowerCase().includes(q);
        const matchesRisk = riskFilter === 'ALL' || inc.risk?.riskLevel === riskFilter;
        const matchesStatus = statusFilter === 'ALL' || inc.status === statusFilter;
        return matchesSearch && matchesRisk && matchesStatus;
      }),
    [incidents, searchTerm, riskFilter, statusFilter]
  );

  const detailIncident = detailsId ? incidents.find((i) => i.id === detailsId) || null : null;

  return (
    <div className="space-y-6">
      {/* Search & filter bar */}
      <Panel className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-faint absolute left-3 top-1/2 -translate-y-1/2" />
            <label htmlFor="incident-search" className="sr-only">
              Search incidents
            </label>
            <input
              id="incident-search"
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by report text, incident ID, or location…"
              className="w-full bg-[#14171d] border border-line focus:border-amber rounded-lg pl-9 pr-3 py-2 text-sm text-ink placeholder:text-faint outline-none transition-colors"
            />
          </div>
          <p className="text-xs text-muted shrink-0">
            {filtered.length} of {incidents.length} incidents
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="label-cap flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5" />
              Risk
            </span>
            {RISK_FILTERS.map((risk) => (
              <button
                key={risk}
                type="button"
                onClick={() => setRiskFilter(risk)}
                aria-pressed={riskFilter === risk}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                  riskFilter === risk
                    ? 'bg-[#242b37] text-ink border-line-strong'
                    : 'bg-transparent text-muted hover:text-ink border-transparent hover:border-line'
                }`}
              >
                {risk}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="label-cap mr-1">Status</span>
            {STATUS_FILTERS.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                aria-pressed={statusFilter === status}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                  statusFilter === status
                    ? 'bg-[#242b37] text-ink border-line-strong'
                    : 'bg-transparent text-muted hover:text-ink border-transparent hover:border-line'
                }`}
              >
                {status.toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </Panel>

      {/* Incident list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Layers className="w-8 h-8" />}
          title={incidents.length === 0 ? 'No incidents recorded' : 'No matching incidents'}
          description={
            incidents.length === 0
              ? 'Run a simulation from the response workspace to create the first audited incident.'
              : 'Try adjusting the search text or clearing the risk/status filters.'
          }
          action={
            incidents.length > 0 ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setSearchTerm('');
                  setRiskFilter('ALL');
                  setStatusFilter('ALL');
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button variant="primary" onClick={() => onNavigateToRoute('workspace')}>
                Open response workspace
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((inc) => (
            <IncidentCard
              key={inc.id}
              incident={inc}
              isSelected={inc.id === activeIncidentId}
              onSelect={onSelectIncident}
              onOpenDetails={setDetailsId}
            />
          ))}
        </div>
      )}

      {/* Incident details drawer */}
      <Drawer
        open={!!detailIncident}
        onClose={() => setDetailsId(null)}
        title={detailIncident ? `Incident ${detailIncident.id}` : ''}
        subtitle={detailIncident ? `Created ${new Date(detailIncident.createdAt).toLocaleString()}` : undefined}
      >
        {detailIncident && (
          <div className="space-y-4">
            {/* Status row */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={riskTone(detailIncident.risk?.riskLevel)}>
                {detailIncident.risk?.riskLevel || 'Triaged'} · {detailIncident.risk?.score ?? '—'}/100 (simulated)
              </Badge>
              <Badge tone={detailIncident.status === 'ACTIVE' ? 'amber' : detailIncident.status === 'RESOLVED' ? 'safe' : 'neutral'}>
                {detailIncident.status.toLowerCase()}
              </Badge>
              {detailIncident.actions.filter((a) => a.status === 'BLOCKED').length > 0 && (
                <Badge tone="danger">
                  <Ban className="w-3 h-3" />
                  {detailIncident.actions.filter((a) => a.status === 'BLOCKED').length} blocked
                </Badge>
              )}
            </div>

            {/* Raw report */}
            <section className="panel-subtle p-3.5 space-y-1.5">
              <span className="label-cap flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                Reported statement (human-reported, unverified)
              </span>
              <p className="text-sm text-ink-dim leading-relaxed">“{detailIncident.rawReport}”</p>
              {detailIncident.scenarioId && (
                <p className="text-[11px] text-faint">Preset scenario: {detailIncident.scenarioId}</p>
              )}
            </section>

            {/* Facts grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="panel-subtle p-3">
                <span className="label-cap block mb-1">Location (reported)</span>
                <span className="text-xs text-ink-dim">{detailIncident.intake?.locationLabel || '—'}</span>
              </div>
              <div className="panel-subtle p-3">
                <span className="label-cap block mb-1">Hazard class</span>
                <span className="text-xs text-ink-dim capitalize">
                  {detailIncident.intake?.reportedHazard.replace(/_/g, ' ') || '—'}
                </span>
              </div>
              <div className="panel-subtle p-3">
                <span className="label-cap block mb-1">Occupants (reported)</span>
                <span className="text-xs text-ink-dim">{detailIncident.intake?.occupantsEstimated || '—'}</span>
              </div>
              <div className="panel-subtle p-3">
                <span className="label-cap block mb-1">Sensor evidence</span>
                {detailIncident.intake?.hasSensorConfirmation ? (
                  <Badge tone="safe">Detector alert present</Badge>
                ) : (
                  <Badge tone="amber" title="No calibrated sensor reading was available; none has been invented.">
                    <AlertTriangle className="w-3 h-3" />
                    Unverified
                  </Badge>
                )}
              </div>
            </div>

            {/* Evidence provenance */}
            {detailIncident.intake && detailIncident.intake.evidence.length > 0 && (
              <section className="space-y-1.5">
                <span className="label-cap">Evidence provenance</span>
                <ul className="space-y-1.5">
                  {detailIncident.intake.evidence.map((ev) => (
                    <li key={ev.id} className="panel-subtle p-2.5 text-xs space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={ev.source === 'sensor_verified' ? 'safe' : ev.source === 'user_reported' ? 'neutral' : 'amber'}>
                          {ev.source.replace(/_/g, ' ')}
                        </Badge>
                        <Badge tone={ev.verified ? 'safe' : 'amber'}>{ev.verified ? 'verified' : 'unverified'}</Badge>
                        <span className="text-[10px] text-faint font-mono ml-auto">
                          confidence {(ev.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-ink-dim leading-relaxed">{ev.description}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Safety guidance */}
            {detailIncident.safetyGuidance && (
              <section className="panel-subtle p-3.5 space-y-2">
                <span className="label-cap flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Safety guidance issued
                </span>
                {detailIncident.safetyGuidance.evacuationMandatory && (
                  <Badge tone="danger">
                    <AlertTriangle className="w-3 h-3" />
                    Evacuation mandatory
                  </Badge>
                )}
                <ul className="space-y-1">
                  {detailIncident.safetyGuidance.immediateActions.map((a, i) => (
                    <li key={i} className="text-xs text-ink-dim leading-relaxed flex gap-2">
                      <span className="text-faint font-mono shrink-0">{i + 1}.</span>
                      {a}
                    </li>
                  ))}
                </ul>
                {detailIncident.safetyGuidance.strictProhibitions.length > 0 && (
                  <div className="border-t border-line pt-2 mt-2">
                    <span className="label-cap text-danger block mb-1">Prohibitions</span>
                    <ul className="space-y-1">
                      {detailIncident.safetyGuidance.strictProhibitions.map((p, i) => (
                        <li key={i} className="text-xs text-muted leading-relaxed flex gap-2">
                          <Ban className="w-3 h-3 text-danger shrink-0 mt-0.5" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}

            {/* Actions tally */}
            <section className="space-y-2">
              <span className="label-cap flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5" />
                Action outcomes
              </span>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { l: 'Total', v: detailIncident.actions.length, c: 'text-ink' },
                  { l: 'Simulated', v: detailIncident.actions.filter((a) => a.status === 'SIMULATED').length, c: 'text-safe' },
                  { l: 'Blocked', v: detailIncident.actions.filter((a) => a.status === 'BLOCKED').length, c: 'text-danger' },
                  { l: 'Pending', v: detailIncident.actions.filter((a) => a.status === 'PENDING_HUMAN_APPROVAL').length, c: 'text-amber' },
                ].map((cell) => (
                  <div key={cell.l} className="panel-subtle py-2">
                    <span className={`text-base font-bold ${cell.c}`}>{cell.v}</span>
                    <span className="block text-[10px] text-muted">{cell.l}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Timeline */}
            <section className="space-y-2">
              <span className="label-cap flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Decision timeline
              </span>
              <TimelineViz events={detailIncident.timeline} compact />
            </section>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-line">
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  onSelectIncident(detailIncident.id);
                  onNavigateToRoute('workspace');
                  setDetailsId(null);
                }}
                icon={<Gauge className="w-3.5 h-3.5" />}
              >
                Open in workspace
              </Button>
              <Button variant="secondary" size="md" onClick={() => onNavigateToRoute('briefings')}>
                View briefing
              </Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
