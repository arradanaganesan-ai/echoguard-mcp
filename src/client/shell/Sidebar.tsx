import React from 'react';
import {
  LayoutDashboard,
  Layers,
  Gauge,
  ShieldCheck,
  GitBranch,
  FileClock,
  Network,
  Server,
  Settings,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';

/* ---------------------------------------------------------------
   Application shell navigation.
   Primary operational sections + a secondary system group.
   --------------------------------------------------------------- */

export type RouteId =
  | 'overview'
  | 'incidents'
  | 'workspace'
  | 'safety'
  | 'timeline'
  | 'briefings'
  | 'mesh'
  | 'mcp'
  | 'settings';

export interface NavItem {
  id: RouteId;
  label: string;
  icon: React.FC<{ className?: string }>;
  badge?: string | null;
  description: string;
}

interface SidebarProps {
  activeRoute: RouteId;
  onNavigate: (route: RouteId) => void;
  incidentCount: number | null;
  blockedActionCount: number | null;
  /** Mobile drawer state (controlled by shell). */
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const buildNavGroups = (
  incidentCount: number | null,
  blockedActionCount: number | null
): Array<{ title?: string; items: NavItem[] }> => [
  {
    items: [
      {
        id: 'overview',
        label: 'Overview',
        icon: LayoutDashboard,
        description: 'System posture and recent activity',
      },
      {
        id: 'incidents',
        label: 'Incidents',
        icon: Layers,
        badge: incidentCount !== null ? `${incidentCount}` : null,
        description: 'Audited incident records',
      },
      {
        id: 'workspace',
        label: 'Response Workspace',
        icon: Gauge,
        description: 'Run and inspect simulations',
      },
      {
        id: 'safety',
        label: 'Safety Controls',
        icon: ShieldCheck,
        badge: blockedActionCount !== null && blockedActionCount > 0 ? `${blockedActionCount} blocked` : 'Enforced',
        description: 'Hard-coded policy rules',
      },
      {
        id: 'timeline',
        label: 'Intelligence Timeline',
        icon: GitBranch,
        description: 'Multi-agent decision trace',
      },
      {
        id: 'briefings',
        label: 'Briefings & Audit',
        icon: FileClock,
        description: 'Responder briefings and audit trail',
      },
    ],
  },
  {
    title: 'System',
    items: [
      { id: 'mesh', label: 'Agent Mesh', icon: Network, description: 'Orchestration pipeline detail' },
      { id: 'mcp', label: 'MCP Tools', icon: Server, description: 'Protocol tools and integration' },
      { id: 'settings', label: 'Settings', icon: Settings, description: 'Runtime and disclosures' },
    ],
  },
];

const SidebarContent: React.FC<Omit<SidebarProps, 'mobileOpen' | 'onCloseMobile'>> = ({
  activeRoute,
  onNavigate,
  incidentCount,
  blockedActionCount,
}) => {
  const groups = buildNavGroups(incidentCount, blockedActionCount);

  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-line">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-[#232935] border border-line-strong flex items-center justify-center shadow-panel">
            <ShieldCheck className="w-5 h-5 text-amber" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-ink tracking-tight leading-none">
              EchoGuard <span className="text-amber">MCP</span>
            </div>
            <div className="text-[11px] text-muted mt-1 leading-none">Emergency Intelligence</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-5" aria-label="Primary">
        {groups.map((group, gi) => (
          <div key={gi} className="space-y-1">
            {group.title && <p className="label-cap px-2.5 pb-1">{group.title}</p>}
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeRoute === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  title={item.description}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors duration-150 cursor-pointer text-left ${
                    isActive
                      ? 'bg-[#242b37] text-ink border border-line-strong shadow-[inset_2px_0_0_0_var(--color-amber)]'
                      : 'text-muted hover:text-ink hover:bg-surface border border-transparent'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber' : ''}`} />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge && (
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        isActive ? 'bg-[#2f3745] text-ink-dim' : 'bg-surface text-faint'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-amber shrink-0" />}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer note */}
      <div className="px-4 py-3 border-t border-line">
        <p className="text-[11px] text-faint leading-relaxed">
          Deterministic safety gate · Simulated actions only · No live dispatch
        </p>
      </div>
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onCloseMobile, ...rest }) => (
  <>
    {/* Desktop sidebar */}
    <aside className="hidden lg:block w-64 shrink-0 bg-panel border-r border-line sticky top-0 h-screen">
      <SidebarContent {...rest} />
    </aside>

    {/* Mobile drawer */}
    {mobileOpen && (
      <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Navigation">
        <div className="absolute inset-0 bg-[#0b0d11]/70 backdrop-blur-[2px]" onClick={onCloseMobile} aria-hidden="true" />
        <div className="relative w-72 max-w-[85vw] h-full bg-panel border-r border-line shadow-raised drawer-in">
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation"
            className="absolute top-4 right-3 p-1.5 rounded-lg text-muted hover:text-ink hover:bg-surface cursor-pointer z-10"
          >
            <X className="w-4 h-4" />
          </button>
          <SidebarContent {...rest} />
        </div>
      </div>
    )}
  </>
);

/** Mobile menu trigger for the top bar. */
export const MenuButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Open navigation"
    className="lg:hidden p-2 rounded-lg text-muted hover:text-ink hover:bg-surface border border-line cursor-pointer"
  >
    <Menu className="w-4 h-4" />
  </button>
);
