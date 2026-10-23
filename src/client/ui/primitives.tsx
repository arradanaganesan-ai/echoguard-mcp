import React from 'react';

/* ---------------------------------------------------------------
   UI primitives — shared building blocks for the EchoGuard shell.
   All are presentational; data & behavior stay in feature tabs.
   --------------------------------------------------------------- */

type PanelTone = 'default' | 'danger' | 'amber' | 'safe';

interface PanelProps {
  tone?: PanelTone;
  className?: string;
  children: React.ReactNode;
  as?: 'div' | 'section' | 'article';
  ariaLabel?: string;
}

/**
 * Elevated surface container. `tone` applies a restrained semantic
 * border/background without gradients or glow.
 */
export const Panel: React.FC<PanelProps> = ({
  tone = 'default',
  className = '',
  children,
  as = 'div',
  ariaLabel,
}) => {
  const toneClass =
    tone === 'danger' ? 'panel-danger' : tone === 'amber' ? 'panel-amber' : tone === 'safe' ? 'panel-safe' : 'panel';
  const Tag = as;
  return (
    <Tag className={`${toneClass} ${className}`} aria-label={ariaLabel}>
      {children}
    </Tag>
  );
};

/* --------------------------------------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'safe';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and blocks the button (anti double-submit). */
  loading?: boolean;
  loadingText?: string;
  icon?: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-amber text-[#161104] hover:bg-[#f7c465] active:bg-[#dfa93c] border border-[#d9a240] font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.4)]',
  secondary:
    'bg-surface text-ink hover:bg-[#28303c] active:bg-[#2c3542] border border-line-strong font-medium',
  danger:
    'bg-[rgba(240,100,100,0.12)] text-[#f28686] hover:bg-[rgba(240,100,100,0.2)] border border-[rgba(240,100,100,0.4)] font-semibold',
  safe: 'bg-[rgba(114,199,154,0.12)] text-safe hover:bg-[rgba(114,199,154,0.2)] border border-[rgba(114,199,154,0.38)] font-semibold',
  ghost: 'bg-transparent text-muted hover:text-ink hover:bg-surface border border-transparent font-medium',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1.5 text-xs gap-1.5 rounded-lg',
  md: 'px-3.5 py-2 text-sm gap-2 rounded-lg',
  lg: 'px-5 py-2.5 text-sm gap-2 rounded-xl',
};

/**
 * Accessible action button with loading/disabled states.
 * Always renders `loadingText` (or children) so width stays stable.
 */
export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  loading = false,
  loadingText,
  icon,
  children,
  className = '',
  disabled,
  ...rest
}) => (
  <button
    type="button"
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    className={`inline-flex items-center justify-center transition-colors duration-150 cursor-pointer select-none disabled:opacity-55 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    {...rest}
  >
    {loading ? (
      <span
        aria-hidden="true"
        className="inline-block w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0"
      />
    ) : (
      icon
    )}
    <span>{loading && loadingText ? loadingText : children}</span>
  </button>
);

/* --------------------------------------------------------------- */

type BadgeTone = 'neutral' | 'amber' | 'danger' | 'safe' | 'info';

interface BadgeProps {
  tone?: BadgeTone;
  className?: string;
  title?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const badgeToneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-surface text-muted border-line-strong',
  amber: 'bg-[rgba(243,182,74,0.1)] text-amber border-[rgba(243,182,74,0.35)]',
  danger: 'bg-[rgba(240,100,100,0.1)] text-[#f28686] border-[rgba(240,100,100,0.35)]',
  safe: 'bg-[rgba(114,199,154,0.1)] text-safe border-[rgba(114,199,154,0.35)]',
  info: 'bg-[rgba(150,158,170,0.1)] text-ink-dim border-line-strong',
};

/** Compact status chip. Sentence case by default — no shouty uppercase. */
export const Badge: React.FC<BadgeProps> = ({ tone = 'neutral', className = '', title, icon, children }) => (
  <span
    title={title}
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold whitespace-nowrap ${badgeToneClasses[tone]} ${className}`}
  >
    {icon}
    {children}
  </span>
);

/* --------------------------------------------------------------- */

interface StatusDotProps {
  tone: 'safe' | 'amber' | 'danger' | 'neutral';
  pulse?: boolean;
  label?: string;
}

/** Tiny status indicator with optional label. */
export const StatusDot: React.FC<StatusDotProps> = ({ tone, pulse = false, label }) => {
  const color =
    tone === 'safe'
      ? 'bg-safe'
      : tone === 'amber'
      ? 'bg-amber'
      : tone === 'danger'
      ? 'bg-danger'
      : 'bg-muted';
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span className={`relative inline-flex w-2 h-2 rounded-full ${color}`}>
        {pulse && (
          <span className={`absolute inset-0 rounded-full ${color} animate-ping opacity-60`} aria-hidden="true" />
        )}
      </span>
      {label && <span>{label}</span>}
    </span>
  );
};

/* --------------------------------------------------------------- */

interface SectionHeaderProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

/** Consistent heading block for panels and full-page sections. */
export const SectionHeader: React.FC<SectionHeaderProps> = ({ icon, title, description, actions }) => (
  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
    <div className="min-w-0">
      <h2 className="text-base font-semibold text-ink flex items-center gap-2">
        {icon}
        {title}
      </h2>
      {description && <p className="text-sm text-muted mt-0.5 leading-relaxed">{description}</p>}
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

/* --------------------------------------------------------------- */

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

/** Calm, informative empty state — never a dead end. */
export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => (
  <div className="panel p-10 text-center space-y-3">
    {icon && <div className="text-faint flex justify-center">{icon}</div>}
    <h3 className="text-sm font-semibold text-ink-dim">{title}</h3>
    {description && <p className="text-sm text-muted max-w-md mx-auto leading-relaxed">{description}</p>}
    {action && <div className="pt-1">{action}</div>}
  </div>
);

/* --------------------------------------------------------------- */

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

/**
 * Slide-over details drawer. Closes on Escape and backdrop click;
 * focus lands on the close control when opened.
 */
export const Drawer: React.FC<DrawerProps> = ({ open, onClose, title, subtitle, children }) => {
  const closeRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#0b0d11]/70 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Drawer surface */}
      <div className="relative w-full sm:max-w-xl h-full bg-panel border-l border-line shadow-raised drawer-in overflow-y-auto">
        <div className="sticky top-0 z-10 bg-panel/95 backdrop-blur-sm border-b border-line px-5 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink truncate">{title}</h2>
            {subtitle && <p className="text-xs text-muted mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-surface border border-transparent hover:border-line transition-colors cursor-pointer shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">{children}</div>
      </div>
    </div>
  );
};

/* --------------------------------------------------------------- */

interface TooltipProps {
  label: string;
  children: React.ReactNode;
}

/**
 * Lightweight tooltip that also works for keyboard users (focus).
 * Uses CSS positioning — no external dependency.
 */
export const Tooltip: React.FC<TooltipProps> = ({ label, children }) => (
  <span className="relative group inline-flex">
    {children}
    <span
      role="tooltip"
      className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 z-30
                 whitespace-nowrap px-2 py-1 rounded-md bg-[#0c0e12] border border-line-strong
                 text-[11px] text-ink-dim shadow-raised opacity-0 group-hover:opacity-100
                 group-focus-within:opacity-100 transition-opacity duration-150"
    >
      {label}
    </span>
  </span>
);
