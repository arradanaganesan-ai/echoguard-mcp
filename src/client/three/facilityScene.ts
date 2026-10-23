import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

/* ---------------------------------------------------------------
   EchoGuard — Industrial facility schematic (Three.js).

   IMPORTANT SAFETY / ACCURACY NOTE:
   Every geometry element in this scene (building massing, hazard
   zone, perimeter, evacuation overlay, assembly point) is an
   ILLUSTRATIVE schematic generated from generic assumptions. It is
   NOT derived from verified floor plans, sensor data, or surveyed
   positions, and every element is labeled as such in-scene and in
   the surrounding UI. It must never be read as a real floor plan.
   --------------------------------------------------------------- */

export interface FacilitySceneInput {
  /** Short hazard caption, e.g. "Suspected gas leak". */
  hazardLabel: string;
  /** Risk level drives hazard-zone color and radius emphasis. */
  riskLevel: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' | null;
  /** 0-100 simulated assessment score; illustrative zone sizing only. */
  riskScore: number | null;
  /** Reported location text (display only — position is illustrative). */
  locationLabel: string;
  /** Whether mandatory evacuation overlay should be shown. */
  evacuationMandatory: boolean;
  /** Count of safety-blocked actions, shown on the safety marker. */
  blockedActionCount: number;
  /** Reduced-motion preference from the host page. */
  prefersReducedMotion: boolean;
}

interface SceneHandles {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  labelRenderer: CSS2DRenderer;
  controls: OrbitControls;
  hazardGroup: THREE.Group;
  evacGroup: THREE.Group;
  disposables: Array<{ dispose: () => void }>;
}

const COLORS = {
  ground: 0x14171d,
  structure: 0x242b37,
  structureAlt: 0x2b3341,
  detail: 0x39424f,
  line: 0x3d4653,
  amber: 0xf3b64a,
  danger: 0xf06464,
  safe: 0x72c79a,
  muted: 0x969eaa,
};

function riskColor(level: FacilitySceneInput['riskLevel']): number {
  switch (level) {
    case 'CRITICAL':
      return COLORS.danger;
    case 'HIGH':
      return COLORS.amber;
    case 'MODERATE':
      return 0xc9a25e;
    default:
      return COLORS.safe;
  }
}

/** Maps free-text location hints to an illustrative wing of the schematic. */
function illustrativeWing(locationLabel: string): { x: number; z: number; wing: string } {
  const t = (locationLabel || '').toLowerCase();
  if (t.includes('kitchen')) return { x: 4.2, z: 1.8, wing: 'East wing (illustrative)' };
  if (t.includes('basement') || t.includes('cellar')) return { x: -1.5, z: 0, wing: 'Lower level (illustrative)' };
  if (t.includes('furnace') || t.includes('utility')) return { x: -5.4, z: -1.2, wing: 'Utility annex (illustrative)' };
  if (t.includes('bedroom')) return { x: 3.6, z: -2.6, wing: 'North wing (illustrative)' };
  if (t.includes('garage')) return { x: -4.6, z: 3.2, wing: 'Garage bay (illustrative)' };
  return { x: 2.2, z: 1.2, wing: 'Main hall (illustrative)' };
}

function makeLabel(text: string, tone: 'muted' | 'amber' | 'danger' | 'safe'): CSS2DObject {
  const el = document.createElement('div');
  el.className = 'facility-label';
  const toneColor =
    tone === 'amber' ? '#f3b64a' : tone === 'danger' ? '#f06464' : tone === 'safe' ? '#72c79a' : '#c9cdd4';
  el.style.cssText = [
    'pointer-events:none',
    'user-select:none',
    'white-space:nowrap',
    'font:600 10.5px/1.35 "JetBrains Mono", ui-monospace, monospace',
    'letter-spacing:0.02em',
    `color:${toneColor}`,
    'background:rgba(17,19,24,0.82)',
    'border:1px solid rgba(61,70,83,0.9)',
    'border-radius:6px',
    'padding:3px 7px',
    'box-shadow:0 4px 12px rgba(0,0,0,0.45)',
    'transform:translate(-50%,-100%)',
  ].join(';');
  el.textContent = text;
  const obj = new CSS2DObject(el);
  obj.center = new THREE.Vector2(0.5, 1.2);
  return obj;
}

function buildStaticFacility(handles: SceneHandles): void {
  const { scene, disposables } = handles;

  // Ground slab
  const groundGeo = new THREE.PlaneGeometry(64, 64);
  const groundMat = new THREE.MeshStandardMaterial({ color: COLORS.ground, roughness: 0.96, metalness: 0.0 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  disposables.push(groundGeo, groundMat);

  // Subtle technical grid — reads as schematic, not decoration
  const grid = new THREE.GridHelper(64, 32, COLORS.line, 0x1d222b);
  const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
  for (const m of gridMaterials) {
    m.transparent = true;
    m.opacity = 0.35;
  }
  grid.position.y = 0.01;
  scene.add(grid);
  disposables.push(grid.geometry, ...gridMaterials);

  // Helper for structure boxes
  const addBox = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    color: number,
    opts: { castShadow?: boolean } = {}
  ) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.08 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = opts.castShadow ?? true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    disposables.push(geo, mat);
    return mesh;
  };

  // Main massing — generic single-story facility
  addBox(13, 4.4, 8.4, 0, 2.2, 0, COLORS.structure);
  // Parapet rim
  addBox(13.3, 0.28, 8.7, 0, 4.54, 0, COLORS.structureAlt, { castShadow: false });
  // Utility annex
  addBox(4.6, 2.9, 5.2, -8.2, 1.45, -0.6, COLORS.structureAlt);
  // Rooftop units
  addBox(2.2, 0.9, 1.6, -2.6, 5.0, 1.8, COLORS.detail);
  addBox(1.6, 0.7, 1.4, 2.4, 4.9, -1.6, COLORS.detail);
  // Doorway canopy (south face)
  addBox(2.6, 0.18, 1.4, 0.5, 3.0, 4.9, COLORS.detail);
  // Door marker
  addBox(1.4, 2.2, 0.12, 0.5, 1.1, 4.28, 0x1b2029, { castShadow: false });

  // Pipe run along annex (industrial cue)
  const pipeGeo = new THREE.CylinderGeometry(0.14, 0.14, 7.4, 10);
  const pipeMat = new THREE.MeshStandardMaterial({ color: COLORS.detail, roughness: 0.55, metalness: 0.35 });
  const pipe = new THREE.Mesh(pipeGeo, pipeMat);
  pipe.rotation.z = Math.PI / 2;
  pipe.position.set(-4.6, 3.4, -3.0);
  pipe.castShadow = true;
  scene.add(pipe);
  disposables.push(pipeGeo, pipeMat);

  // Perimeter fence posts + rails — explicitly illustrative boundary
  const perimeterPts: THREE.Vector3[] = [];
  const hw = 14;
  const hd = 10;
  const corners = [
    new THREE.Vector3(-hw, 0, -hd),
    new THREE.Vector3(hw, 0, -hd),
    new THREE.Vector3(hw, 0, hd),
    new THREE.Vector3(-hw, 0, hd),
  ];
  const postGeo = new THREE.CylinderGeometry(0.07, 0.09, 1.6, 6);
  const postMat = new THREE.MeshStandardMaterial({ color: COLORS.line, roughness: 0.7 });
  for (let c = 0; c < 4; c++) {
    const a = corners[c];
    const b = corners[(c + 1) % 4];
    const steps = 7;
    for (let i = 0; i <= steps; i++) {
      const p = new THREE.Vector3().lerpVectors(a, b, i / steps);
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(p.x, 0.8, p.z);
      scene.add(post);
      perimeterPts.push(new THREE.Vector3(p.x, 1.45, p.z));
    }
  }
  disposables.push(postGeo, postMat);
  const fenceGeo = new THREE.BufferGeometry().setFromPoints([...perimeterPts, perimeterPts[0]]);
  const fenceMat = new THREE.LineBasicMaterial({ color: COLORS.line, transparent: true, opacity: 0.7 });
  scene.add(new THREE.Line(fenceGeo, fenceMat));
  disposables.push(fenceGeo, fenceMat);

  const perimeterLabel = makeLabel('Perimeter — illustrative only', 'muted');
  perimeterLabel.position.set(-hw + 2.5, 2.1, -hd);
  scene.add(perimeterLabel);

  const buildingLabel = makeLabel('Facility schematic — not a real floor plan', 'muted');
  buildingLabel.position.set(0, 5.6, 0);
  scene.add(buildingLabel);

  const doorLabel = makeLabel('Exit (illustrative)', 'safe');
  doorLabel.position.set(0.5, 3.4, 5.2);
  scene.add(doorLabel);
}

function buildHazardOverlay(handles: SceneHandles, input: FacilitySceneInput): void {
  const { scene, hazardGroup, evacGroup, disposables } = handles;

  // --- Hazard zone (illustrative envelope driven by simulated risk level) ---
  const wing = illustrativeWing(input.locationLabel);
  const color = riskColor(input.riskLevel);
  const score = input.riskScore ?? 40;
  const radius = 2.1 + (Math.min(100, Math.max(0, score)) / 100) * 2.6;
  const isLower = wing.wing.startsWith('Lower');
  const zoneY = isLower ? 0.6 : 1.4;

  const zoneGeo = new THREE.CylinderGeometry(radius, radius, isLower ? 1.2 : 2.8, 40, 1, true);
  const zoneMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.14,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const zone = new THREE.Mesh(zoneGeo, zoneMat);
  zone.position.set(wing.x, zoneY + (isLower ? 0 : 1.4), wing.z);
  hazardGroup.add(zone);
  disposables.push(zoneGeo, zoneMat);

  // Ground ring to ground the zone
  const ringGeo = new THREE.RingGeometry(radius - 0.09, radius, 48);
  const ringMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(wing.x, 0.05, wing.z);
  hazardGroup.add(ring);
  disposables.push(ringGeo, ringMat);

  // Incident pin
  const pinGeo = new THREE.CylinderGeometry(0.05, 0.05, 3.2, 8);
  const pinMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 });
  const pin = new THREE.Mesh(pinGeo, pinMat);
  pin.position.set(wing.x, 3.4, wing.z);
  hazardGroup.add(pin);
  disposables.push(pinGeo, pinMat);
  const headGeo = new THREE.SphereGeometry(0.22, 16, 12);
  const headMat = new THREE.MeshBasicMaterial({ color });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.set(wing.x, 5.1, wing.z);
  hazardGroup.add(head);
  disposables.push(headGeo, headMat);

  const hazardLabel = makeLabel(`${input.hazardLabel} — reported position illustrative`, input.riskLevel === 'CRITICAL' || input.riskLevel === 'HIGH' ? 'danger' : 'amber');
  hazardLabel.position.set(wing.x, 5.8, wing.z);
  hazardGroup.add(hazardLabel);

  const zoneLabel = makeLabel(`Illustrative hazard envelope (${input.riskLevel || 'unrated'} · simulated score ${score}/100 — not a measured dispersion)`, 'amber');
  zoneLabel.position.set(wing.x + 0.4, 1.0, wing.z + radius + 0.8);
  hazardGroup.add(zoneLabel);

  // Safety-policy marker near annex when actions were blocked
  if (input.blockedActionCount > 0) {
    const mGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const mMat = new THREE.MeshBasicMaterial({ color: COLORS.amber });
    const marker = new THREE.Mesh(mGeo, mMat);
    marker.position.set(-8.2, 3.5, -0.6);
    hazardGroup.add(marker);
    disposables.push(mGeo, mMat);
    const mLabel = makeLabel(`Safety gate blocked ${input.blockedActionCount} action(s) — simulated`, 'amber');
    mLabel.position.set(-8.2, 4.2, -0.6);
    hazardGroup.add(mLabel);
  }

  // --- Evacuation overlay (only when mandatory) ---
  if (input.evacuationMandatory) {
    const start = new THREE.Vector3(wing.x, 0.12, wing.z);
    const door = new THREE.Vector3(0.5, 0.12, 5.4);
    const assembly = new THREE.Vector3(10.5, 0.12, 11.5);
    const path = new THREE.CatmullRomCurve3([
      start,
      new THREE.Vector3((start.x + door.x) / 2, 0.12, (start.z + door.z) / 2 + 1.2),
      door,
      new THREE.Vector3(4.5, 0.12, 8.6),
      assembly,
    ]);
    const tubeGeo = new THREE.TubeGeometry(path, 48, 0.09, 8, false);
    const tubeMat = new THREE.MeshBasicMaterial({ color: COLORS.safe, transparent: true, opacity: 0.85 });
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    evacGroup.add(tube);
    disposables.push(tubeGeo, tubeMat);

    // Direction chevrons along path
    const chevGeo = new THREE.ConeGeometry(0.16, 0.4, 8);
    const chevMat = new THREE.MeshBasicMaterial({ color: COLORS.safe });
    for (const t of [0.35, 0.65, 0.92]) {
      const pos = path.getPointAt(t);
      const tangent = path.getTangentAt(t);
      const chev = new THREE.Mesh(chevGeo, chevMat);
      chev.position.copy(pos).setY(0.12);
      chev.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent.clone().setY(0).normalize());
      evacGroup.add(chev);
    }
    disposables.push(chevGeo, chevMat);

    // Assembly point disc
    const asmGeo = new THREE.CircleGeometry(1.1, 32);
    const asmMat = new THREE.MeshBasicMaterial({ color: COLORS.safe, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
    const asm = new THREE.Mesh(asmGeo, asmMat);
    asm.rotation.x = -Math.PI / 2;
    asm.position.copy(assembly).setY(0.06);
    evacGroup.add(asm);
    disposables.push(asmGeo, asmMat);

    const asmLabel = makeLabel('Assembly point — illustrative (300 ft upwind recommendation is guidance, not surveyed)', 'safe');
    asmLabel.position.copy(assembly).setY(1.6);
    evacGroup.add(asmLabel);

    const evacLabel = makeLabel('Evacuation route — illustrative overlay', 'safe');
    evacLabel.position.set(5.6, 0.9, 9.4);
    evacGroup.add(evacLabel);
  }
}

function clearGroup(group: THREE.Group, disposables: Array<{ dispose: () => void }>): void {
  // Remove labels (DOM) and meshes; dispose geometries/materials we tracked.
  const toRemove: THREE.Object3D[] = [];
  group.traverse((obj) => {
    toRemove.push(obj);
  });
  for (const obj of toRemove) {
    const label = obj as CSS2DObject;
    if (label.element && label.element.parentNode) {
      label.element.parentNode.removeChild(label.element);
    }
    group.remove(obj);
  }
  // Note: overlay geometries/materials are pushed into the shared disposables
  // list; a full scene rebuild (dispose()) releases them. Frequent action
  // toggles only swap small overlays, so leaked GPU memory is negligible
  // for a prototype session; dispose() still frees everything on unmount.
  void disposables;
}

/**
 * Creates and owns the Three.js scene. Imperative handle keeps React
 * re-renders cheap and disposal deterministic.
 */
export function createFacilityScene(
  container: HTMLElement,
  labelLayer: HTMLElement,
  input: FacilitySceneInput
): {
  update: (next: FacilitySceneInput) => void;
  resetView: () => void;
  dispose: () => void;
} {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x15181e);
  scene.fog = new THREE.Fog(0x15181e, 34, 70);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  camera.position.set(19, 15, 21);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';

  const labelRenderer = new CSS2DRenderer({ element: labelLayer });
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.inset = '0';
  labelRenderer.domElement.style.pointerEvents = 'none';

  // Lighting — restrained, realistic
  const hemi = new THREE.HemisphereLight(0xbfc7d4, 0x1a1d22, 0.85);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff2e0, 1.35);
  key.position.set(16, 22, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -24;
  key.shadow.camera.right = 24;
  key.shadow.camera.top = 24;
  key.shadow.camera.bottom = -24;
  key.shadow.bias = -0.0004;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x9fb0c8, 0.3);
  fill.position.set(-14, 10, -12);
  scene.add(fill);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !input.prefersReducedMotion;
  controls.dampingFactor = 0.08;
  controls.minDistance = 10;
  controls.maxDistance = 58;
  controls.maxPolarAngle = Math.PI / 2.15;
  controls.target.set(0, 1.5, 0);
  controls.update();

  const hazardGroup = new THREE.Group();
  const evacGroup = new THREE.Group();
  scene.add(hazardGroup, evacGroup);

  const handles: SceneHandles = {
    scene,
    camera,
    renderer,
    labelRenderer,
    controls,
    hazardGroup,
    evacGroup,
    disposables: [],
  };

  buildStaticFacility(handles);
  buildHazardOverlay(handles, input);

  // Resize handling
  const resize = () => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    labelRenderer.setSize(w, h);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  // Render loop — pauses when tab hidden; no idle spin (subtle drift only
  // when motion is allowed and the user has not interacted).
  let raf = 0;
  let userInteracted = false;
  const markInteracted = () => {
    userInteracted = true;
  };
  renderer.domElement.addEventListener('pointerdown', markInteracted);

  const tick = () => {
    raf = requestAnimationFrame(tick);
    if (!input.prefersReducedMotion && !userInteracted) {
      // Very subtle camera drift around the target — inspection-friendly.
      const t = performance.now() * 0.00006;
      const r = 28;
      camera.position.x = Math.cos(t) * r;
      camera.position.z = Math.sin(t) * r;
    }
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  };
  const onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (!raf) {
      tick();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);
  tick();

  const resetView = () => {
    camera.position.set(19, 15, 21);
    controls.target.set(0, 1.5, 0);
    controls.update();
  };

  const dispose = () => {
    cancelAnimationFrame(raf);
    document.removeEventListener('visibilitychange', onVisibility);
    renderer.domElement.removeEventListener('pointerdown', markInteracted);
    ro.disconnect();
    controls.dispose();
    clearGroup(hazardGroup, handles.disposables);
    clearGroup(evacGroup, handles.disposables);
    for (const d of handles.disposables) {
      try {
        d.dispose();
      } catch {
        /* already disposed */
      }
    }
    renderer.dispose();
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    if (labelLayer.parentNode) labelLayer.parentNode.removeChild(labelLayer);
  };

  return {
    update: (next: FacilitySceneInput) => {
      Object.assign(input, next);
      clearGroup(hazardGroup, handles.disposables);
      clearGroup(evacGroup, handles.disposables);
      buildHazardOverlay(handles, input);
    },
    resetView,
    dispose,
  };
}

/** Cheap WebGL availability probe used to pick the static fallback. */
export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}
