import React, { useState } from 'react';
import { Settings, RotateCcw, Server, AlertTriangle, CheckCircle2, Shield, FileCheck, Radio } from 'lucide-react';
import { api } from '../api.js';
import { Panel, Badge, Button, SectionHeader } from '../ui/primitives.js';
import { useToasts } from '../ui/Toast.js';

interface SettingsTabProps {
  onResetComplete: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ onResetComplete }) => {
  const { pushToast } = useToasts();
  const [isResetting, setIsResetting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await api.resetDemoData();
      setShowConfirm(false);
      onResetComplete();
      pushToast('success', 'Demo data reset', 'Incidents and audit logs restored to the seeded baseline.');
    } catch (err: any) {
      pushToast('error', 'Reset failed', err?.message || 'Unknown error');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Panel className="p-5">
        <SectionHeader
          icon={<Settings className="w-4 h-4 text-amber" />}
          title="System configuration & governance"
          description="Runtime settings, MCP integration parameters, and mandatory prototype disclosures."
        />
      </Panel>

      {/* Disclosures */}
      <Panel tone="amber" className="p-5 space-y-3">
        <h3 className="text-sm font-semibold text-amber flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Mandatory prototype disclosures &amp; limitations
        </h3>
        <ul className="space-y-2.5">
          {[
            {
              title: 'Demonstration prototype only.',
              body: 'EchoGuard MCP is an experimental architecture prototype illustrating safety-governed AI orchestration. It is NOT certified under UL 1484, EN 50194, or NFPA 54 standards.',
            },
            {
              title: 'No real emergency dispatch.',
              body: 'The system never places automated calls to public emergency services (911 / 112 / PSAPs) or utility providers. Notification drafts require explicit, verified human transmission outside this prototype.',
            },
            {
              title: 'Physical actuator isolation.',
              body: 'All physical actuation requests — gas solenoid valves, ventilation fans, door deadbolts — are simulated only, to prevent spark-induced ignition or entrapment.',
            },
            {
              title: 'No medical diagnosis.',
              body: 'Symptoms such as eye burning or lightheadedness are triaged as severity indicators only; no clinical diagnostic claim is made.',
            },
            {
              title: 'Jurisdiction-aware guidance.',
              body: 'Emergency numbers vary by country. Guidance references 911 for the US/Canada and 112 for India, the EU, and many other countries — verify your local number.',
            },
          ].map((item) => (
            <li key={item.title} className="flex gap-2.5 text-xs leading-relaxed">
              <span className="text-amber mt-0.5 shrink-0">•</span>
              <span className="text-ink-dim">
                <strong className="font-semibold text-ink">{item.title}</strong> {item.body}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      {/* MCP runtime */}
      <Panel className="p-5 space-y-4">
        <SectionHeader
          icon={<Server className="w-4 h-4 text-muted" />}
          title="MCP runtime environment"
          description="Connection parameters reported by the local server."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {[
            { label: 'Server identifier', value: 'echoguard-mcp', mono: true },
            { label: 'Transport protocol', value: 'stdio (standard I/O)', mono: true },
            { label: 'Execution mode', value: 'Deterministic local / demo', mono: false },
            { label: 'Schema validation', value: 'Zod — strict runtime checks', mono: false },
          ].map((cell) => (
            <div key={cell.label} className="panel-subtle p-3.5">
              <span className="label-cap block mb-1">{cell.label}</span>
              <span className={`text-ink-dim ${cell.mono ? 'font-mono' : 'font-medium'}`}>{cell.value}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Badge tone="neutral" icon={<Radio className="w-3 h-3" />}>
            Simulation environment
          </Badge>
          <Badge tone="safe" icon={<Shield className="w-3 h-3" />}>
            Hard-coded safety gate
          </Badge>
          <Badge tone="neutral" icon={<FileCheck className="w-3 h-3" />}>
            Audit logging enabled
          </Badge>
        </div>
      </Panel>

      {/* Reset */}
      <Panel className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-muted" />
            Reset demonstration data
          </h3>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            Clears simulated incidents and audit logs, then restores the seeded demonstration scenarios.
          </p>
        </div>
        <Button
          variant="danger"
          onClick={() => setShowConfirm(true)}
          icon={<RotateCcw className="w-3.5 h-3.5" />}
          className="shrink-0"
        >
          Reset demo data
        </Button>
      </Panel>

      {/* Inline confirmation (no modal) */}
      {showConfirm && (
        <Panel tone="danger" className="p-5 space-y-3 fade-in">
          <div className="flex items-center gap-2.5 text-danger">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <h3 className="text-sm font-semibold text-ink">Reset demo incidents?</h3>
          </div>
          <p className="text-xs text-ink-dim leading-relaxed">
            This restores demo storage to its seeded state: current incidents and the audit trail will be replaced with
            the default demonstration scenarios.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowConfirm(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={isResetting} loadingText="Resetting…" onClick={handleReset}>
              Yes, reset now
            </Button>
          </div>
        </Panel>
      )}
    </div>
  );
};
