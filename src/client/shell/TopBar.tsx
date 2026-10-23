import React from 'react';
import { RefreshCw, Radio, ShieldCheck, Activity, ChevronDown } from 'lucide-react';
import { IncidentRecord } from '../../shared/types.js';
import { RouteId } from './Sidebar.js';
import { Badge, StatusDot, Tooltip } from '../ui/primitives.js';

/* ---------------------------------------------------------------
   Compact top bar: page identity, environment + connectivity
   indicators (driven by real /api/health data), incident selector
   and refresh. No fabricated metrics — every indicator maps to a
   real API response or a hard-coded product fact.
   --------------------------------------------------------------- */

export interface HealthInfo {
  /** 'live' = API responded; 'fallback' = client-side deterministic fallback. */
  connectivity: 'live' | 'fallback' | 'unknown';
  mode?: string;
  mcpTransport?: string;
  service?: string;
}

export interface McpStatusInfo {
  connected: boolean;
  serverName?: string;
  transport?: string;
  version?: string;
  toolCount?: number;
}

interface TopBarProps {
  route: RouteId;
  incidents: IncidentRecord[];
  activeIncident: IncidentRecord | null;
  onSelectIncident: (id: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  health: HealthInfo;
  mcpStatus: McpStatusInfo | null;
}

const routeMeta: Record<RouteId, { title: string; subtitle: string }> = {
  overview: { title: 'Overview', subtitle: 'System posture, incident counts, and quick actions' },
  incidents: { title: 'Incidents', subtitle: 'Audited records with search, filtering, and details' },
  workspace: { title: 'Response Workspace', subtitle: 'Run simulations and screen candidate actions' },
  safety: { title: 'Safety Controls', subtitle: 'Hard-coded rules that no agent can override' },
  timeline: { title: 'Intelligence Timeline', subtitle: 'Chronological multi-agent decision trace' },
  briefings: { title: 'Briefings & Audit', subtitle: 'Responder-ready briefings and notification drafts' },
  mesh: { title: 'Agent Mesh', subtitle: 'Detailed orchestration pipeline inspection' },
  mcp: { title: 'MCP Tools', subtitle: 'Model Context Protocol server surface' },
  settings: { title: 'Settings', subtitle: 'Runtime configuration and mandatory disclosures' },
};

export const TopBar: React.FC<TopBarProps> = ({
  route,
  incidents,
  activeIncident,
  onSelectIncident,
  onRefresh,
  isRefreshing,
  health,
  mcpStatus,
}) => {
  const meta = routeMeta[route];
  const isLive = health.connectivity === 'live';

  return (
    <header className="sticky top-0 z-40 bg-bg/92 backdrop-blur-md border-b border-line">
      <div className="px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {/* Page identity */}
        <div className="min-w-0">
          <h1 className="text-[15px] font-semibold text-ink leading-tight truncate">{meta.title}</h1>
          <p className="text-xs text-muted leading-tight mt-0.5 truncate hidden sm:block">{meta.subtitle}</p>
        </div>

        {/* Controls & indicators */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Environment indicator */}
          <Tooltip label="This prototype never dispatches real calls, messages, or actuation. All actions are simulated.">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#232935] border border-line-strong text-[11px] font-semibold text-amber cursor-default">
              <Radio className="w-3.5 h-3.5" />
              Simulation
            </span>
          </Tooltip>

          {/* Live application connectivity (real /api/health result) */}
          <Tooltip
            label={
              isLive
                ? 'Backend API responded to /api/health — live application connectivity.'
                : 'Backend API unreachable — client is using the built-in deterministic fallback dataset.'
            }
          >
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#232935] border border-line-strong text-[11px] text-ink-dim cursor-default">
              <StatusDot tone={isLive ? 'safe' : 'amber'} pulse={isLive} />
              {isLive ? 'API live' : 'Local fallback'}
            </span>
          </Tooltip>

          {/* MCP transport status */}
          {mcpStatus && (
            <Tooltip
              label={`MCP server: ${mcpStatus.serverName || 'echoguard-mcp'} · transport ${mcpStatus.transport || 'stdio'}${
                mcpStatus.toolCount ? ` · ${mcpStatus.toolCount} tools` : ''
              }`}
            >
              <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#232935] border border-line-strong text-[11px] text-ink-dim cursor-default">
                <ShieldCheck className="w-3.5 h-3.5 text-safe" />
                MCP {mcpStatus.connected ? 'connected' : 'offline'}
              </span>
            </Tooltip>
          )}

          {/* Incident selector */}
          {incidents.length > 0 && (
            <div className="relative">
              <label htmlFor="incident-selector" className="sr-only">
                Select active incident
              </label>
              <select
                id="incident-selector"
                value={activeIncident?.id ?? ''}
                onChange={(e) => onSelectIncident(e.target.value)}
                className="appearance-none pl-2.5 pr-7 py-1.5 rounded-lg bg-[#232935] border border-line-strong text-[11px] text-ink-dim hover:border-[#3d4653] transition-colors cursor-pointer max-w-[13rem] truncate focus:border-amber outline-none"
              >
                {incidents.map((inc) => (
                  <option key={inc.id} value={inc.id}>
                    {inc.id} · {inc.risk?.riskLevel || 'TRIAGED'}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          {/* Refresh */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Refresh system data"
            title="Refresh system data"
            className="p-2 rounded-lg bg-[#232935] hover:bg-[#2b323f] text-muted hover:text-ink border border-line-strong transition-colors cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
};

export { routeMeta };
