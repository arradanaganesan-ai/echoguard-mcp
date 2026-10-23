import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Sidebar, MenuButton, RouteId } from './shell/Sidebar.js';
import { TopBar, HealthInfo, McpStatusInfo } from './shell/TopBar.js';
import { ToastProvider } from './ui/Toast.js';
import { Button } from './ui/primitives.js';
import { OverviewTab } from './components/OverviewTab.js';
import { IncidentsTab } from './components/IncidentsTab.js';
import { WorkspaceTab } from './components/WorkspaceTab.js';
import { SafetyControlsTab } from './components/SafetyControlsTab.js';
import { TimelineTab } from './components/TimelineTab.js';
import { BriefingsTab } from './components/BriefingsTab.js';
import { OrchestrationTab } from './components/OrchestrationTab.js';
import { McpToolsTab } from './components/McpToolsTab.js';
import { SettingsTab } from './components/SettingsTab.js';
import { api } from './api.js';
import { IncidentRecord, SystemStats, SafetyRule, SimulateActionFeedback } from '../shared/types.js';
import { DemoScenario, DEMO_SCENARIOS } from '../shared/scenarios.js';
import { HARD_CODED_SAFETY_RULES } from '../shared/safety-policy.js';

/**
 * Resolves the active incident after an inventory fetch or simulation run,
 * prioritizing preferredIncidentId to avoid stale-closure overwrites.
 */
export function resolveActiveIncident(
  fetchedIncidents: IncidentRecord[],
  currentActive: IncidentRecord | null,
  preferredIncidentId?: string
): IncidentRecord | null {
  const targetId = preferredIncidentId ?? currentActive?.id;
  if (targetId) {
    const matched = fetchedIncidents.find((i) => i.id === targetId);
    if (matched) return matched;
  }
  if (!currentActive && fetchedIncidents.length > 0) {
    return fetchedIncidents[0];
  }
  return currentActive;
}

/**
 * Immutably replaces a single incident inside the incidents list by id.
 * Other incidents are left untouched to preserve incident isolation.
 */
export function updateIncidentInList(
  incidents: IncidentRecord[],
  updated: IncidentRecord
): IncidentRecord[] {
  const idx = incidents.findIndex((i) => i.id === updated.id);
  if (idx === -1) return incidents;
  const next = [...incidents];
  next[idx] = updated;
  return next;
}

/**
 * Resolves the selected incident after an action result returns.
 * If the operator switched incidents while the request was in flight,
 * the new selection is preserved (no hijack); otherwise the acted-on
 * incident is refreshed with the server's updated copy.
 */
export function resolveSelectionAfterAction(
  currentActive: IncidentRecord | null,
  actedIncidentId: string,
  updatedIncident: IncidentRecord
): IncidentRecord | null {
  if (!currentActive || currentActive.id === actedIncidentId) {
    return updatedIncident;
  }
  return currentActive;
}

const AppInner: React.FC = () => {
  const [route, setRoute] = useState<RouteId>('workspace');
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [activeIncident, setActiveIncident] = useState<IncidentRecord | null>(null);
  const [scenarios, setScenarios] = useState<DemoScenario[]>(DEMO_SCENARIOS);
  const [safetyRules, setSafetyRules] = useState<ReadonlyArray<SafetyRule>>(HARD_CODED_SAFETY_RULES);
  const [isRunningSimulation, setIsRunningSimulation] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthInfo>({ connectivity: 'unknown' });
  const [mcpStatus, setMcpStatus] = useState<McpStatusInfo | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Load initial or refreshed system data safely
  const loadData = useCallback(async (preferredIncidentId?: string) => {
    setIsRefreshing(true);
    try {
      const [fetchedStats, fetchedIncidents, fetchedScenarios, fetchedRules, fetchedHealth, fetchedMcp] =
        await Promise.all([
          api.getStats(),
          api.getIncidents(),
          api.getScenarios(),
          api.getSafetyRules(),
          api.getHealth(),
          api.getMcpStatus(),
        ]);

      setStats(fetchedStats);
      setIncidents(fetchedIncidents);
      if (fetchedScenarios.length > 0) setScenarios(fetchedScenarios);
      if (fetchedRules.length > 0) setSafetyRules(fetchedRules);

      // Connectivity truth: api.getHealth returns its fallback payload on failure
      const live = (fetchedHealth as any)?.status === 'ok';
      setHealth({
        connectivity: live ? 'live' : 'fallback',
        mode: (fetchedHealth as any)?.mode,
        mcpTransport: (fetchedHealth as any)?.mcpTransport,
        service: (fetchedHealth as any)?.service,
      });
      if (fetchedMcp) {
        setMcpStatus({
          connected: !!(fetchedMcp as any).connected,
          serverName: (fetchedMcp as any).serverName,
          transport: (fetchedMcp as any).transport,
          version: (fetchedMcp as any).version,
          toolCount: Array.isArray((fetchedMcp as any).tools) ? (fetchedMcp as any).tools.length : undefined,
        });
      }

      // Robust state update: prioritize preferredIncidentId without closing over stale activeIncident
      setActiveIncident((currentActive) =>
        resolveActiveIncident(fetchedIncidents, currentActive, preferredIncidentId)
      );
    } catch (err: any) {
      const msg = err?.message || 'Failed to load system data';
      console.error('[EchoGuard Diagnostics] System data load error:', msg);
      setError(`System data load error: ${msg}`);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  // Handle Simulation Run
  const handleRunSimulation = async (payload: {
    report: string;
    scenarioId?: string;
    locationHint?: string;
    occupantsHint?: string;
  }) => {
    setIsRunningSimulation(true);
    setError(null);
    try {
      const newIncident = await api.createIncident(payload);
      // Immediately set the active incident to the new incident
      setActiveIncident(newIncident);
      // Refresh background lists and stats, ensuring the new incident is preserved as active
      await loadData(newIncident.id);
    } catch (err: any) {
      const msg = err?.message || 'Failed to execute emergency simulation';
      console.error('[EchoGuard Diagnostics] Emergency simulation failed:', msg);
      setError(`Emergency simulation failed: ${msg}`);
    } finally {
      setIsRunningSimulation(false);
    }
  };

  // Handle Interactive Candidate Action Simulation
  const handleSimulateAction = async (
    actionType: string,
    target: string
  ): Promise<SimulateActionFeedback> => {
    const targetIncidentId = activeIncident?.id;
    if (!targetIncidentId) {
      return { ok: false, error: 'No active incident selected. Run a simulation first.' };
    }
    setError(null);
    try {
      const res = await api.simulateAction(targetIncidentId, { actionType, target });

      // Update the incidents list entry for the acted-on incident only (isolation-safe),
      // and refresh the selection only if the operator has not switched incidents
      // while this request was in flight (no selection hijack).
      setIncidents((prev) => updateIncidentInList(prev, res.incident));
      setActiveIncident((current) =>
        resolveSelectionAfterAction(current, targetIncidentId, res.incident)
      );

      // Background refresh of stats/lists WITHOUT forcing selection back to the
      // acted-on incident (resolveActiveIncident preserves the current selection).
      await loadData();

      return { ok: true, action: res.action, incidentId: targetIncidentId };
    } catch (err: any) {
      const msg = err?.message || 'Failed to simulate candidate action';
      console.error('[EchoGuard Diagnostics] Action simulation failed:', msg);
      setError(`Action simulation failed: ${msg}`);
      return { ok: false, incidentId: targetIncidentId, error: msg };
    }
  };

  const handleApproveNotification = async (notifId: string) => {
    if (!activeIncident) return;
    await api.approveNotification(activeIncident.id, notifId);
    await loadData();
  };

  const handleSelectScenario = (sc: DemoScenario) => {
    setRoute('workspace');
    handleRunSimulation({
      report: sc.rawReport,
      scenarioId: sc.id,
      locationHint: sc.locationHint,
      occupantsHint: sc.occupantsHint,
    });
  };

  const handleSelectIncident = (id: string) => {
    const found = incidents.find((i) => i.id === id);
    if (found) {
      setActiveIncident(found);
    }
  };

  const navigate = (next: RouteId) => {
    setRoute(next);
    setMobileNavOpen(false);
    // Scroll main content to top on route change for a stable reading position
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  return (
    <div className="min-h-screen bg-bg flex">
      {/* Sidebar navigation */}
      <Sidebar
        activeRoute={route}
        onNavigate={navigate}
        incidentCount={stats ? stats.totalIncidents : null}
        blockedActionCount={stats ? stats.totalBlockedActions : null}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          route={route}
          incidents={incidents}
          activeIncident={activeIncident}
          onSelectIncident={handleSelectIncident}
          onRefresh={() => loadData()}
          isRefreshing={isRefreshing}
          health={health}
          mcpStatus={mcpStatus}
        />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl w-full mx-auto">
          {/* Mobile menu trigger row */}
          <div className="lg:hidden mb-4">
            <MenuButton onClick={() => setMobileNavOpen(true)} />
          </div>

          {/* Persistent error banner (role=alert) — toasts add context but this stays visible */}
          {error && (
            <div
              role="alert"
              className="mb-6 p-4 rounded-xl bg-[rgba(240,100,100,0.08)] border border-[rgba(240,100,100,0.4)] text-ink-dim text-sm flex items-center justify-between gap-3 shadow-panel fade-in"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <AlertTriangle className="w-4 h-4 text-danger shrink-0" />
                <span className="leading-relaxed">{error}</span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setError(null)} icon={<X className="w-3.5 h-3.5" />}>
                Dismiss
              </Button>
            </div>
          )}

          {route === 'overview' && (
            <OverviewTab
              stats={stats}
              recentIncidents={incidents}
              scenarios={scenarios}
              onSelectScenario={handleSelectScenario}
              onSelectIncident={handleSelectIncident}
              onNavigateToWorkspace={() => navigate('workspace')}
              onNavigateToRoute={navigate}
              activeIncident={activeIncident}
            />
          )}

          {route === 'incidents' && (
            <IncidentsTab
              incidents={incidents}
              activeIncidentId={activeIncident?.id || null}
              onSelectIncident={handleSelectIncident}
              onNavigateToRoute={navigate}
            />
          )}

          {route === 'workspace' && (
            <WorkspaceTab
              scenarios={scenarios}
              activeIncident={activeIncident}
              isRunningSimulation={isRunningSimulation}
              onRunSimulation={handleRunSimulation}
              onSimulateAction={handleSimulateAction}
              onApproveNotification={handleApproveNotification}
              onNavigateToRoute={navigate}
            />
          )}

          {route === 'safety' && <SafetyControlsTab rules={safetyRules} activeIncident={activeIncident} />}

          {route === 'timeline' && (
            <TimelineTab
              activeIncident={activeIncident}
              incidents={incidents}
              onSelectIncident={handleSelectIncident}
              onNavigateToRoute={navigate}
            />
          )}

          {route === 'briefings' && (
            <BriefingsTab
              activeIncident={activeIncident}
              incidents={incidents}
              onSelectIncident={handleSelectIncident}
              onRefresh={() => loadData()}
              onNavigateToRoute={navigate}
            />
          )}

          {route === 'mesh' && <OrchestrationTab activeIncident={activeIncident} onNavigateToRoute={navigate} />}

          {route === 'mcp' && <McpToolsTab activeIncident={activeIncident} />}

          {route === 'settings' && <SettingsTab onResetComplete={() => loadData()} />}
        </main>

        {/* Footer */}
        <footer className="border-t border-line bg-panel/60 py-4">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted">
            <span>EchoGuard MCP prototype — safety-governed emergency intelligence</span>
            <span className="text-faint">Official MCP SDK · deterministic safety gate · simulated actions only</span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export const App: React.FC = () => (
  <ToastProvider>
    <AppInner />
  </ToastProvider>
);

export default App;
