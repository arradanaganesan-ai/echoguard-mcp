import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw, Box, ShieldAlert, Route as RouteIcon, MapPin } from 'lucide-react';
import { IncidentRecord } from '../../shared/types.js';
import { Button, Badge } from '../ui/primitives.js';

/* ---------------------------------------------------------------
   React wrapper for the Three.js facility schematic.
   - Lazily constructed (heavy import is code-split by the host).
   - Static SVG fallback when WebGL is unavailable.
   - Reduced-motion respected.
   - Every marker is labeled illustrative / simulated in-scene;
     this wrapper repeats that framing in visible UI copy.
   --------------------------------------------------------------- */

interface FacilityViewerProps {
  activeIncident: IncidentRecord | null;
}

export const hazardCaption = (incident: IncidentRecord | null): string => {
  const hazard = incident?.intake?.reportedHazard;
  if (!hazard) return 'No hazard reported';
  return hazard.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const StaticFallback: React.FC<{ incident: IncidentRecord | null }> = ({ incident }) => (
  <div className="absolute inset-0 flex items-center justify-center p-6">
    <svg viewBox="0 0 480 300" className="w-full h-full max-h-full" role="img" aria-label="Static facility schematic fallback">
      {/* Ground */}
      <rect x="20" y="40" width="440" height="240" rx="8" fill="#171a20" stroke="#262c36" />
      {/* Building massing */}
      <rect x="150" y="100" width="180" height="110" rx="4" fill="#242b37" stroke="#3d4653" />
      <rect x="90" y="130" width="60" height="70" rx="4" fill="#2b3341" stroke="#3d4653" />
      {/* Perimeter */}
      <rect x="60" y="65" width="360" height="195" rx="6" fill="none" stroke="#3d4653" strokeDasharray="5 5" />
      {/* Hazard zone */}
      {incident && (
        <g>
          <circle cx="285" cy="150" r="38" fill="rgba(240,100,100,0.14)" stroke="#f06464" strokeDasharray="4 4" />
          <circle cx="285" cy="150" r="4" fill="#f06464" />
        </g>
      )}
      {/* Assembly point */}
      <circle cx="400" cy="245" r="12" fill="rgba(114,199,154,0.25)" stroke="#72c79a" />
      <text x="400" y="249" textAnchor="middle" fill="#72c79a" fontSize="9" fontFamily="monospace">ASM</text>
      {/* Labels */}
      <text x="240" y="92" textAnchor="middle" fill="#969eaa" fontSize="10" fontFamily="monospace">
        Facility schematic — not a real floor plan
      </text>
      <text x="60" y="58" fill="#969eaa" fontSize="9" fontFamily="monospace">Perimeter — illustrative only</text>
      {incident && (
        <text x="285" y="205" textAnchor="middle" fill="#f3b64a" fontSize="9" fontFamily="monospace">
          Hazard envelope — illustrative
        </text>
      )}
    </svg>
  </div>
);

export const FacilityViewer: React.FC<FacilityViewerProps> = ({ activeIncident }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{ update: (i: any) => void; resetView: () => void; dispose: () => void } | null>(null);
  const [webglOk, setWebglOk] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Always hold the latest scene input so the async scene construction
  // never captures stale (null) incident data, and pre-scene updates
  // (race: incident loads before three.js chunk finishes) are not lost.
  const latestInputRef = useRef({
    hazardLabel: hazardCaption(activeIncident),
    riskLevel: activeIncident?.risk?.riskLevel ?? null,
    riskScore: activeIncident?.risk?.score ?? null,
    locationLabel: activeIncident?.intake?.locationLabel || '',
    evacuationMandatory: !!activeIncident?.safetyGuidance?.evacuationMandatory,
    blockedActionCount: activeIncident?.actions.filter((a) => a.status === 'BLOCKED').length ?? 0,
  });

  // Build the scene once (heavy three.js import is dynamic → separate chunk).
  useEffect(() => {
    let cancelled = false;
    const mount = mountRef.current;
    const labelLayer = labelRef.current;
    if (!mount || !labelLayer) return;

    // Synchronous WebGL probe before paying for the three.js chunk.
    import('../three/facilityScene.js')
      .then(({ createFacilityScene, isWebGLAvailable }) => {
        if (cancelled) return;
        if (!isWebGLAvailable()) {
          setWebglOk(false);
          return;
        }
        setWebglOk(true);
        const prefersReducedMotion =
          typeof window !== 'undefined' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        sceneRef.current = createFacilityScene(mount, labelLayer, {
          ...latestInputRef.current,
          prefersReducedMotion,
        });
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[EchoGuard] Failed to load 3D facility scene:', err);
          setLoadError('3D module failed to load — showing static schematic.');
          setWebglOk(false);
        }
      });

    return () => {
      cancelled = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
    // Intentionally mount-once; incident changes flow through update() below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push incident changes into the live scene without rebuilding it.
  // Safe before the scene exists: latestInputRef carries the data forward.
  useEffect(() => {
    latestInputRef.current = {
      hazardLabel: hazardCaption(activeIncident),
      riskLevel: activeIncident?.risk?.riskLevel ?? null,
      riskScore: activeIncident?.risk?.score ?? null,
      locationLabel: activeIncident?.intake?.locationLabel || '',
      evacuationMandatory: !!activeIncident?.safetyGuidance?.evacuationMandatory,
      blockedActionCount: activeIncident?.actions.filter((a) => a.status === 'BLOCKED').length ?? 0,
    };
    sceneRef.current?.update(latestInputRef.current);
  }, [activeIncident]);

  const blockedCount = activeIncident?.actions.filter((a) => a.status === 'BLOCKED').length ?? 0;

  return (
    <div className="panel overflow-hidden">
      {/* Viewer header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-line">
        <div className="flex items-center gap-2 min-w-0">
          <Box className="w-4 h-4 text-amber shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-ink leading-tight">Facility schematic</h3>
            <p className="text-[11px] text-muted leading-tight truncate">
              Illustrative layout — not derived from verified floor plans or sensor data
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="secondary"
          icon={<RotateCcw className="w-3.5 h-3.5" />}
          onClick={() => sceneRef.current?.resetView()}
          disabled={webglOk !== true}
          title="Reset camera to the default inspection angle"
        >
          Reset view
        </Button>
      </div>

      {/* Canvas region */}
      <div className="relative h-[340px] sm:h-[380px] bg-[#15181e]">
        {webglOk === null && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted">
            Preparing 3D schematic…
          </div>
        )}
        {webglOk === false && <StaticFallback incident={activeIncident} />}
        {loadError && (
          <div className="absolute top-2 left-2 right-2 text-[11px] text-amber bg-[rgba(243,182,74,0.08)] border border-[rgba(243,182,74,0.3)] rounded-lg px-2.5 py-1.5">
            {loadError}
          </div>
        )}
        {/* Three.js mounts here; label layer receives CSS2D labels */}
        <div ref={mountRef} className="absolute inset-0" />
        <div ref={labelRef} className="absolute inset-0 pointer-events-none overflow-hidden" />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5 border-t border-line text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-danger" />
          Hazard envelope — illustrative, sized by simulated risk score
        </span>
        {activeIncident?.safetyGuidance?.evacuationMandatory && (
          <span className="inline-flex items-center gap-1.5">
            <RouteIcon className="w-3.5 h-3.5 text-safe" />
            Evacuation overlay — illustrative route to assembly point
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-muted" />
          Reported location label:{' '}
          <Badge tone="neutral">{activeIncident?.intake?.locationLabel || '—'}</Badge>
        </span>
        {blockedCount > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <Badge tone="amber">{blockedCount} action(s) blocked by safety gate</Badge>
          </span>
        )}
      </div>
    </div>
  );
};

export default FacilityViewer;
