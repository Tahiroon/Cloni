import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CATALOG_ITEMS, GRID_SIZE } from '../data/catalog';
import {
  buildObstacleBoxes,
  buildWaitSeatSlots,
  clampToSolarZone,
  findGridPath,
  findNearestWalkableTile,
  hasContinuousLineOfSight,
  isInSolarZone,
  isTileInOutdoorGarden,
  isTileWalkable,
  isValidWallMount,
  isWorldWalkable,
  ObstacleBox,
  overlapsActiveWorldTree,
  resolveTileStep,
  resolveWorldStep,
  snapToNearestValidWallSlot,
  SOLAR_ZONE,
} from '../engine/isometricMath';
import { glbRegistry, startPreloadGlbs } from '../engine3d/glbRegistry';
import {
  animateHumanoid3D,
  createHumanoid3D,
  disposeHumanoid3D,
  HumanoidAppearance,
  HumanoidRig,
} from '../engine3d/humanoid3d';
import {
  buildClinicWorld3D,
  ClinicDoorHandle,
  ClinicWorldHandle,
  createCatalogMesh3D,
  disposeObject3D,
  DoorActorInput,
  SmartLightMeta,
  updateDoors3D,
  WaterCoolerRigMeta,
  WORLD_TREES,
  WorldTreeDef,
} from '../engine3d/models3d';
import { createTextureBundle, TextureBundle } from '../engine3d/textures3d';
import {
  CatalogItem,
  ClinicRoom,
  FloatingFeedback,
  Language,
  LightingMode,
  PatientEntity,
  PlacedItem,
  StaffMember,
} from '../types/clinic';

export interface PlacementDraft {
  catalogItem: CatalogItem;
  movingInstanceId?: string;
  rotation: 0 | 1 | 2 | 3;
  hoverX: number;
  hoverY: number;
}

interface ClinicCanvasProps {
  rooms: ClinicRoom[];
  placedItems: PlacedItem[];
  patients: PatientEntity[];
  staff: StaffMember[];
  floatingFeedbacks: FloatingFeedback[];
  focusedPatientId: string | null;
  placementDraft: PlacementDraft | null;
  editMode: boolean;
  isBlurred: boolean;
  language: Language;
  orbitStep?: number;
  lightingMode?: LightingMode;
  removedTreeIds?: string[];
  selectedTreeId?: string | null;
  onTapPatient: (patient: PatientEntity) => void;
  onTapLockedRoom: (room: ClinicRoom) => void;
  onTapPlacedItem: (item: PlacedItem) => void;
  onLongPressPlacedItem?: (item: PlacedItem) => void;
  onTapReceptionDesk?: () => void;
  onInspectItem?: (item: PlacedItem) => void;
  onTapWorldTree?: (tree: WorldTreeDef) => void;
  onUpdatePlacementHover: (gx: number, gy: number, rotation?: 0 | 1 | 2 | 3) => void;
  onConfirmPlacement: (gx: number, gy: number, rotation?: 0 | 1 | 2 | 3) => void;
  onCancelPlacement: () => void;
  onRotatePlacement: () => void;
  onSellMovingDraft?: (instanceId: string) => void;
}

function probeSoftwareWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return false;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (!dbg) return false;
    const rendererStr = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '');
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererStr);
  } catch {
    return false;
  }
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

function angleDiffAbs(a: number, b: number): number {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff);
}

function computeDoorPushTarget(
  x: number,
  z: number,
  vx: number,
  vz: number,
  isMoving: boolean,
  doors: ClinicDoorHandle[],
  unlockedRooms: Set<string>
): number {
  if (!isMoving) return 0;
  const speed = Math.hypot(vx, vz);
  if (speed < 0.08) return 0;

  let best = 0;
  for (let i = 0; i < doors.length; i++) {
    const door = doors[i];
    if (!door.manualPush) continue;
    if (door.requiredRoomId && !unlockedRooms.has(door.requiredRoomId)) continue;

    const dx = x - door.centerX;
    const dz = z - door.centerZ;
    const perpDist = door.kind === 'swing_z' ? Math.abs(dx) : Math.abs(dz);
    const alongDist = door.kind === 'swing_z' ? Math.abs(dz) : Math.abs(dx);
    if (alongDist > 0.52 || perpDist > 0.65) continue;

    const approachDot =
      door.kind === 'swing_z'
        ? -Math.sign(dx || 1) * (vx / speed)
        : -Math.sign(dz || 1) * (vz / speed);
    if (approachDot > 0.25 && perpDist >= 0.12) {
      const reach = 1 - Math.abs(perpDist - 0.36) / 0.34;
      if (reach > best) best = reach;
    }
  }
  return THREE.MathUtils.clamp(best, 0, 1);
}

const MIN_ZOOM = 0.9;
const MAX_ZOOM = 1.95;
const PAN_MIN_X = -1.5;
const PAN_MAX_X = 23.0;
const PAN_MIN_Z = 2.5;
const PAN_MAX_Z = 21.5;

export const ClinicCanvas: React.FC<ClinicCanvasProps> = ({
  rooms,
  placedItems,
  patients,
  staff,
  floatingFeedbacks,
  focusedPatientId,
  placementDraft,
  editMode,
  isBlurred,
  language,
  orbitStep = 0,
  lightingMode = 'day',
  removedTreeIds = [],
  selectedTreeId = null,
  onTapPatient,
  onTapLockedRoom,
  onTapPlacedItem,
  onLongPressPlacedItem,
  onTapReceptionDesk,
  onInspectItem,
  onTapWorldTree,
  onUpdatePlacementHover,
  onConfirmPlacement,
  onCancelPlacement,
  onRotatePlacement,
  onSellMovingDraft,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoomUi, setZoomUi] = useState(1.0);
  const [localOrbit, setLocalOrbit] = useState(0);
  const zoomUiRef = useRef(1.0);
  zoomUiRef.current = zoomUi;

  const catalogMap = useMemo(() => {
    const map = new Map<string, CatalogItem>();
    CATALOG_ITEMS.forEach((c) => map.set(c.id, c));
    return map;
  }, []);

  const isPlacementValid = (gx: number, gy: number, draft: PlacementDraft): boolean => {
    if (draft.catalogItem.isWallDecor) {
      if (!isValidWallMount(gx, gy, draft.rotation, rooms)) return false;

      // Wall items only conflict with other wall items sharing the same wall tile & orientation
      for (const existing of placedItems) {
        if (existing.instanceId === draft.movingInstanceId) continue;
        const cat = catalogMap.get(existing.catalogId);
        if (!cat?.isWallDecor) continue;
        if (existing.gridX === gx && existing.gridY === gy && existing.rotation === draft.rotation) {
          return false;
        }
      }
      return true;
    }

    const effW = draft.rotation % 2 === 0 ? draft.catalogItem.width : draft.catalogItem.depth;
    const effD = draft.rotation % 2 === 0 ? draft.catalogItem.depth : draft.catalogItem.width;

    if (draft.catalogItem.isSolarPanel || draft.catalogItem.id === 'solar_panel') {
      if (!isInSolarZone(gx, gy, effW, effD)) return false;
      for (const existing of placedItems) {
        if (existing.instanceId === draft.movingInstanceId) continue;
        const cat = catalogMap.get(existing.catalogId);
        if (!cat || cat.isWallDecor) continue;
        const ew = existing.rotation % 2 === 0 ? cat.width : cat.depth;
        const ed = existing.rotation % 2 === 0 ? cat.depth : cat.width;
        if (
          gx < existing.gridX + ew &&
          gx + effW > existing.gridX &&
          gy < existing.gridY + ed &&
          gy + effD > existing.gridY
        ) {
          return false;
        }
      }
      return true;
    }

    const isStreetOrGardenLamp =
      draft.catalogItem.sprite === 'street_lamp_post' ||
      draft.catalogItem.sprite === 'garden_lamp' ||
      draft.catalogItem.sprite === 'garden_spot_lamp';

    for (let dx = 0; dx < effW; dx++) {
      for (let dy = 0; dy < effD; dy++) {
        const tx = gx + dx;
        const ty = gy + dy;

        const room = rooms.find(
          (r) => tx >= r.minX && tx <= r.maxX && ty >= r.minY && ty <= r.maxY
        );

        if (room) {
          if (!room.unlocked) return false;
          if (draft.catalogItem.indoorAllowed === false) return false;
        } else {
          if (draft.catalogItem.outdoorAllowed === false) return false;
          if (!isTileInOutdoorGarden(tx, ty, isStreetOrGardenLamp)) return false;
        }

        for (const existing of placedItems) {
          if (existing.instanceId === draft.movingInstanceId) continue;
          const cat = catalogMap.get(existing.catalogId);
          if (!cat || cat.isWallDecor) continue;
          const ew = existing.rotation % 2 === 0 ? cat.width : cat.depth;
          const ed = existing.rotation % 2 === 0 ? cat.depth : cat.width;
          if (
            tx >= existing.gridX &&
            tx < existing.gridX + ew &&
            ty >= existing.gridY &&
            ty < existing.gridY + ed
          ) {
            return false;
          }
        }
      }
    }

    if (overlapsActiveWorldTree(gx, gy, effW, effD, removedTreeIds)) {
      return false;
    }

    return true;
  };

  const latestRef = useRef({
    rooms,
    placedItems,
    patients,
    staff,
    floatingFeedbacks,
    focusedPatientId,
    placementDraft,
    editMode,
    language,
    zoomUi,
    lightingMode,
    removedTreeIds,
    selectedTreeId,
    catalogMap,
    isPlacementValid,
    onTapPatient,
    onTapLockedRoom,
    onTapPlacedItem,
    onLongPressPlacedItem,
    onTapReceptionDesk,
    onTapWorldTree,
    onUpdatePlacementHover,
    onConfirmPlacement,
  });
  latestRef.current = {
    rooms,
    placedItems,
    patients,
    staff,
    floatingFeedbacks,
    focusedPatientId,
    placementDraft,
    editMode,
    language,
    zoomUi,
    lightingMode,
    removedTreeIds,
    selectedTreeId,
    catalogMap,
    isPlacementValid,
    onTapPatient,
    onTapLockedRoom,
    onTapPlacedItem,
    onLongPressPlacedItem,
    onTapReceptionDesk,
    onTapWorldTree,
    onUpdatePlacementHover,
    onConfirmPlacement,
  };

  const camStateRef = useRef({
    targetX: 13.2,
    targetZ: 12.8,
    curX: 13.2,
    curZ: 12.8,
    targetZoom: 1.0,
    curZoom: 1.0,
    targetYaw: Math.PI / 4, // 45deg architectural angle
    curYaw: Math.PI / 4,
  });

  const sceneHooksRef = useRef<{
    rebuildWorld: (rooms: ClinicRoom[], removedTreeIds?: string[]) => void;
    syncItems: (items: PlacedItem[], movingId?: string) => void;
    syncDraft: (draft: PlacementDraft | null) => void;
    screenToGrid: (clientX: number, clientY: number) => { gx: number; gy: number; rawX: number; rawZ: number };
    hitTestPatient: (clientX: number, clientY: number) => PatientEntity | null;
    hitTestPlacedItem: (clientX: number, clientY: number) => PlacedItem | null;
    hitTestPlacedItemDetail: (clientX: number, clientY: number) => { item: PlacedItem; distSq: number } | null;
    hitTestWorldTreeDetail: (clientX: number, clientY: number) => { tree: WorldTreeDef; distSq: number } | null;
    hitTestLockedRoomDetail: (clientX: number, clientY: number) => { room: ClinicRoom; distSq: number } | null;
    getRayGroundDistSq: (rawX: number, rawZ: number) => number;
    hitTestDraftGhost: (clientX: number, clientY: number) => boolean;
    getPanVectors: () => { right: THREE.Vector3; forward: THREE.Vector3; scale: number };
  } | null>(null);

  useEffect(() => {
    if (focusedPatientId) {
      const p = patients.find((pt) => pt.id === focusedPatientId);
      if (p) {
        camStateRef.current.targetX = p.gridX + 0.5;
        camStateRef.current.targetZ = p.gridY + 0.5;
        camStateRef.current.targetZoom = 1.85;
      }
    } else {
      camStateRef.current.targetZoom = zoomUi;
    }
  }, [focusedPatientId, patients, zoomUi]);

  // Frame newly initiated placement drafts smoothly when placed in the rear solar zone or far perimeter
  const draftIdentityKey = placementDraft
    ? `${placementDraft.catalogItem.id}_${placementDraft.movingInstanceId || 'new'}`
    : '';
  useEffect(() => {
    if (!placementDraft) return;
    const effW =
      placementDraft.rotation % 2 === 0
        ? placementDraft.catalogItem.width
        : placementDraft.catalogItem.depth;
    const effD =
      placementDraft.rotation % 2 === 0
        ? placementDraft.catalogItem.depth
        : placementDraft.catalogItem.width;
    const cx = placementDraft.hoverX + effW / 2;
    const cz = placementDraft.hoverY + effD / 2;
    const isSolar =
      placementDraft.catalogItem.isSolarPanel || placementDraft.catalogItem.id === 'solar_panel';
    const dist = Math.hypot(cx - camStateRef.current.targetX, cz - camStateRef.current.targetZ);
    if (isSolar || dist > 8.5) {
      camStateRef.current.targetX = Math.max(PAN_MIN_X, Math.min(PAN_MAX_X, cx));
      camStateRef.current.targetZ = Math.max(PAN_MIN_Z, Math.min(PAN_MAX_Z, cz));
    }
  }, [draftIdentityKey]);

  useEffect(() => {
    camStateRef.current.targetYaw = Math.PI / 4 + (orbitStep + localOrbit) * (Math.PI / 2);
  }, [orbitStep, localOrbit]);

  // Mount Three.js Perspective 3D Engine ONCE
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = probeSoftwareWebGL();
    const isMobileGpu =
      /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && window.innerWidth < 1024);
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl && !isMobileGpu,
      powerPreference: 'high-performance',
    });
    const gl = renderer.getContext();

    const dpr = isSoftwareGl
      ? 1
      : isMobileGpu
        ? Math.min(window.devicePixelRatio || 1, 1.25)
        : Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(dpr);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.85;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    const handleContextLost = (e: Event) => e.preventDefault();
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost, false);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xd2e0ec, 55, 95);
    scene.environmentIntensity = 0.42;

    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmrem.dispose();

    // Calibrated Architectural Daylight Rig (crisp shadows, zero neon saturation)
    const hemi = new THREE.HemisphereLight(0xc6dcf0, 0x4b5c34, 0.52);
    scene.add(hemi);

    const sunLight = new THREE.DirectionalLight(0xfff1dc, 1.42);
    sunLight.position.set(25, 32, 18);
    sunLight.target.position.set(14, 0, 11);
    scene.add(sunLight.target);
    if (!isSoftwareGl) {
      const shadowRes = isMobileGpu ? 1024 : 1536;
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(shadowRes, shadowRes);
      sunLight.shadow.camera.near = 6;
      sunLight.shadow.camera.far = 95;
      sunLight.shadow.camera.left = -26;
      sunLight.shadow.camera.right = 26;
      sunLight.shadow.camera.top = 26;
      sunLight.shadow.camera.bottom = -26;
      sunLight.shadow.bias = -0.0005;
      sunLight.shadow.normalBias = 0.02;
    }
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0xb8d4f2, 0.24);
    fillLight.position.set(-16, 14, -12);
    scene.add(fillLight);

    // Low-FOV Architectural Perspective Camera (authentic 3D depth without distortion)
    const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 220);

    const textures: TextureBundle = createTextureBundle(renderer.capabilities.getMaxAnisotropy());
    const worldLayer = new THREE.Group();
    const itemsLayer = new THREE.Group();
    const draftLayer = new THREE.Group();
    const actorsLayer = new THREE.Group();
    const lightsLayer = new THREE.Group();
    scene.add(worldLayer, itemsLayer, draftLayer, actorsLayer, lightsLayer);

    // Pre-allocated PointLight Pool (capped tightly on mobile GPUs: wall-wash & lamp halos illuminate standby lights at 0 shader cost)
    const SMART_LIGHT_POOL_SIZE = isSoftwareGl ? 5 : isMobileGpu ? 7 : 9;
    const smartLightPool: THREE.PointLight[] = [];
    for (let i = 0; i < SMART_LIGHT_POOL_SIZE; i++) {
      const pl = new THREE.PointLight(0xffdfb0, 0, 14, 1.0);
      pl.castShadow = false;
      pl.position.set(14, 2.2, 14);
      lightsLayer.add(pl);
      smartLightPool.push(pl);
    }

    let worldHandle: ClinicWorldHandle | null = null;
    const itemMeshes = new Map<string, { sig: string; mesh: THREE.Group }>();
    const coolerReturnUntil = new Map<string, number>();
    const patientRigs = new Map<
      string,
      {
        rig: HumanoidRig;
        visX: number;
        visZ: number;
        vx: number;
        vz: number;
        walkPhase: number;
        walkBlend: number;
        sitBlend: number;
        doorPush: number;
        facingRad: number;
      }
    >();
    const staffRigs = new Map<
      string,
      {
        rig: HumanoidRig;
        gx: number;
        gy: number;
        visX: number;
        visZ: number;
        vx: number;
        vz: number;
        path: Array<{ x: number; y: number }>;
        pauseTimer: number;
        stuckTimer: number;
        walkPhase: number;
        walkBlend: number;
        sitBlend: number;
        doorPush: number;
        facingRad: number;
        ignoreItemId?: string;
      }
    >();

    const walkerFootprints = new Map<string, { w: number; d: number }>();
    CATALOG_ITEMS.forEach((c) => walkerFootprints.set(c.id, { w: c.width, d: c.depth }));

    let cachedObstacleSig = '';
    let walkerObstacles: ObstacleBox[] = [];
    const getWalkerObstacles = (
      curRooms: ClinicRoom[],
      curItems: PlacedItem[],
      curRemovedTrees: string[] = []
    ): { obstacles: ObstacleBox[]; changed: boolean } => {
      const sig =
        curRooms.map((r) => `${r.id}:${r.unlocked ? 1 : 0}`).join('|') +
        '#' +
        curItems.map((it) => `${it.instanceId}:${it.gridX},${it.gridY},${it.rotation}`).join('|') +
        '#' +
        curRemovedTrees.join(',');
      if (sig !== cachedObstacleSig) {
        cachedObstacleSig = sig;
        walkerObstacles = buildObstacleBoxes(curRooms, curItems, walkerFootprints, curRemovedTrees);
        return { obstacles: walkerObstacles, changed: true };
      }
      return { obstacles: walkerObstacles, changed: false };
    };

    interface AmbientWalker {
      id: string;
      kind: 'promenade' | 'visitor';
      appearance: Omit<HumanoidAppearance, 'contactShadowTex'>;
      rig: HumanoidRig;
      gx: number;
      gy: number;
      path: Array<{ x: number; y: number }>;
      pauseTimer: number;
      stuckTimer: number;
      speed: number;
      visX: number;
      visZ: number;
      vx: number;
      vz: number;
      walkPhase: number;
      walkBlend: number;
      sitBlend: number;
      doorPush: number;
      facingRad: number;
      subOffX: number;
      subOffZ: number;
      seatedMode?: boolean;
      seatKey?: string;
      seatApproachX?: number;
      seatApproachY?: number;
      seatFacingRad?: number;
      seatOffX?: number;
      seatOffZ?: number;
      seatHeight?: number;
      ignoreItemId?: string;
    }

    const walkerSpecs: Array<{
      id: string;
      kind: 'promenade' | 'visitor';
      gx: number;
      gy: number;
      speed: number;
      appearance: Omit<HumanoidAppearance, 'contactShadowTex'>;
    }> = [
      {
        id: 'walk_prom_1',
        kind: 'promenade',
        gx: 28,
        gy: 4,
        speed: 1.12,
        appearance: {
          skinTone: '#5d3520',
          hairColor: '#17100c',
          shirtColor: '#f3f0e8',
          pantsColor: '#f3f0e8',
          isFemale: false,
          outfitStyle: 'jalabiya',
          hasTurban: true,
          variantSeed: 1,
        },
      },
      {
        id: 'walk_prom_2',
        kind: 'promenade',
        gx: 32,
        gy: 19,
        speed: 1.05,
        appearance: {
          skinTone: '#7f4d31',
          hairColor: '#17100c',
          shirtColor: '#114247',
          pantsColor: '#dfd7cc',
          isFemale: true,
          outfitStyle: 'abaya_open',
          hasHijab: true,
          variantSeed: 2,
        },
      },
      {
        id: 'walk_vis_1',
        kind: 'visitor',
        gx: 28,
        gy: 17,
        speed: 1.06,
        appearance: {
          skinTone: '#945e3d',
          hairColor: '#17100c',
          shirtColor: '#0369a1',
          pantsColor: '#1e293b',
          isFemale: false,
          outfitStyle: 'casual',
          shirtStyle: 'tshirt',
          variantSeed: 4,
        },
      },
      {
        id: 'walk_vis_2',
        kind: 'visitor',
        gx: 25,
        gy: 11,
        speed: 1.02,
        appearance: {
          skinTone: '#bc865f',
          hairColor: '#17100c',
          shirtColor: '#8b4958',
          pantsColor: '#8b4958',
          isFemale: true,
          outfitStyle: 'dress',
          hasHijab: true,
          variantSeed: 3,
        },
      },
    ];

    const walkerRigs: AmbientWalker[] = walkerSpecs.map((spec) => {
      const rig = createHumanoid3D({
        ...spec.appearance,
        contactShadowTex: textures.contactShadow,
      });
      rig.hitMesh.visible = false;
      actorsLayer.add(rig.root);
      return {
        ...spec,
        rig,
        path: [],
        pauseTimer: 0.2 + Math.random() * 1.4,
        stuckTimer: 0,
        visX: spec.gx + 0.5,
        visZ: spec.gy + 0.5,
        vx: 0,
        vz: 0,
        walkPhase: Math.random() * Math.PI * 2,
        walkBlend: 0,
        sitBlend: 0,
        doorPush: 0,
        facingRad: Math.random() * Math.PI * 2 - Math.PI,
        subOffX: (Math.random() - 0.5) * 0.35,
        subOffZ: (Math.random() - 0.5) * 0.35,
      };
    });

    let draftMeshSig = '';
    let draftGhost: THREE.Group | null = null;
    const draftPadMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    });
    const draftPadMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.04, 1), draftPadMat);
    draftPadMesh.visible = false;
    draftLayer.add(draftPadMesh);

    let nightBlend = latestRef.current.lightingMode === 'night' ? 1 : 0;
    const _dayTop = new THREE.Color(0x4b7cb3);
    const _nightTop = new THREE.Color(0x0c1b3a);
    const _dayHor = new THREE.Color(0xd2e0ec);
    const _nightHor = new THREE.Color(0x1a325c);
    const _dayFog = new THREE.Color(0xd2e0ec);
    const _nightFog = new THREE.Color(0x132648);
    const _daySun = new THREE.Color(0xfff1dc);
    const _moonSun = new THREE.Color(0xa8c8ff);
    const _dayHemiSky = new THREE.Color(0xc6dcf0);
    const _nightHemiSky = new THREE.Color(0x3b63a8);
    const _dayHemiGround = new THREE.Color(0x4b5c34);
    const _nightHemiGround = new THREE.Color(0x1e2c3d);
    const _dayFill = new THREE.Color(0xb8d4f2);
    const _nightFill = new THREE.Color(0x385a94);
    const _lightWorldPos = new THREE.Vector3();
    const _tmpLightColor = new THREE.Color();

    interface LightTarget {
      x: number;
      y: number;
      z: number;
      color: number;
      intensity: number;
      distance: number;
      decay: number;
    }

    const updateAtmosphereAndLights = (timeSec: number, dt: number) => {
      const targetNight = latestRef.current.lightingMode === 'night' ? 1 : 0;
      nightBlend = THREE.MathUtils.damp(nightBlend, targetNight, 4.2, dt);

      sunLight.color.copy(_daySun).lerp(_moonSun, nightBlend);
      sunLight.intensity = THREE.MathUtils.lerp(1.42, 0.62, nightBlend);
      sunLight.position.set(
        THREE.MathUtils.lerp(25, -22, nightBlend),
        THREE.MathUtils.lerp(32, 26, nightBlend),
        THREE.MathUtils.lerp(18, -18, nightBlend)
      );

      hemi.color.copy(_dayHemiSky).lerp(_nightHemiSky, nightBlend);
      hemi.groundColor.copy(_dayHemiGround).lerp(_nightHemiGround, nightBlend);
      hemi.intensity = THREE.MathUtils.lerp(0.52, 0.46, nightBlend);

      fillLight.color.copy(_dayFill).lerp(_nightFill, nightBlend);
      fillLight.intensity = 0.24;

      scene.environmentIntensity = THREE.MathUtils.lerp(0.42, 0.22, nightBlend);
      renderer.toneMappingExposure = THREE.MathUtils.lerp(0.85, 1.04, nightBlend);

      const fog = scene.fog as THREE.Fog;
      fog.color.copy(_dayFog).lerp(_nightFog, nightBlend);
      fog.near = THREE.MathUtils.lerp(55, 58, nightBlend);
      fog.far = THREE.MathUtils.lerp(95, 108, nightBlend);

      if (worldHandle) {
        worldHandle.skyUniforms.uTopColor.value.copy(_dayTop).lerp(_nightTop, nightBlend);
        worldHandle.skyUniforms.uHorizonColor.value.copy(_dayHor).lerp(_nightHor, nightBlend);
        worldHandle.skyUniforms.uNightFactor.value = nightBlend;
        worldHandle.skyUniforms.uTime.value = timeSec;

        worldHandle.villaWinMat.emissiveIntensity = 0.05 + nightBlend * 1.65;
        worldHandle.interiorCoveMat.emissiveIntensity = 0.08 + nightBlend * 1.15;
        worldHandle.entranceSconceMat.emissiveIntensity = 0.06 + nightBlend * 1.55;
        worldHandle.facadeSignMat.emissiveIntensity = 0.1 + nightBlend * 1.45;
        worldHandle.pillarLanternMat.emissiveIntensity = 0.06 + nightBlend * 0.85;
      }

      const roomTargets: LightTarget[] = [];
      const lampTargets: Array<{ score: number; target: LightTarget }> = [];
      const curRooms = latestRef.current.rooms;
      const curPatients = latestRef.current.patients;
      const curStaff = latestRef.current.staff;
      const camCx = camStateRef.current.curX;
      const camCz = camStateRef.current.curZ;

      if (nightBlend > 0.005) {
        // 1. Smart side-wall sconce illumination:
        //    - Occupied rooms illuminate warmly right from their side wall sconces (1 PointLight + additive wall/floor wash)
        //    - Empty unlocked rooms glow softly via 0-shader-cost wall-wash & floor-spill halos (saves mobile GPU!)
        //    - Locked rooms stay off
        for (const room of curRooms) {
          const roomMat = worldHandle?.roomLightMats.get(room.id);
          const washMat = worldHandle?.roomWashMats.get(room.id);
          const poolMat = worldHandle?.roomPoolMats.get(room.id);
          if (!room.unlocked) {
            if (roomMat) roomMat.emissiveIntensity = 0;
            if (washMat) washMat.opacity = 0;
            if (poolMat) poolMat.opacity = 0;
            continue;
          }

          const occupiedByPatient = curPatients.some(
            (pt) =>
              pt.state !== 'treated_leaving' &&
              pt.gridX + 0.5 >= room.minX - 0.3 &&
              pt.gridX + 0.5 <= room.maxX + 1.3 &&
              pt.gridY + 0.5 >= room.minY - 0.3 &&
              pt.gridY + 0.5 <= room.maxY + 1.3
          );
          const occupiedByStaff = curStaff.some((st) => {
            if (!st.hired) return false;
            const rigEntry = staffRigs.get(st.id);
            const sx = rigEntry ? rigEntry.gx + 0.5 : st.gridX + 0.5;
            const sz = rigEntry ? rigEntry.gy + 0.5 : st.gridY + 0.5;
            return (
              sx >= room.minX - 0.3 &&
              sx <= room.maxX + 1.3 &&
              sz >= room.minY - 0.3 &&
              sz <= room.maxY + 1.3
            );
          });
          const isOccupied = occupiedByPatient || occupiedByStaff;

          if (roomMat) {
            roomMat.emissiveIntensity = (isOccupied ? 2.05 : 0.72) * nightBlend;
          }
          if (washMat) {
            washMat.color.setHex(isOccupied ? 0xffd79e : 0xbddcff);
            washMat.opacity = (isOccupied ? 0.48 : 0.3) * nightBlend;
          }
          if (poolMat) {
            poolMat.color.setHex(isOccupied ? 0xffd79e : 0xbddcff);
            poolMat.opacity = (isOccupied ? 0.34 : 0.22) * nightBlend;
          }

          if (isOccupied) {
            const anchor = worldHandle?.roomSconceAnchors.get(room.id);
            roomTargets.push({
              x: anchor ? anchor.x : room.minX + 1.2,
              y: anchor ? anchor.y : 2.1,
              z: anchor ? anchor.z : (room.minY + room.maxY + 1) / 2,
              color: 0xfff2d8,
              intensity: 14.5 * nightBlend,
              distance: 16.5,
              decay: 0.95,
            });
          }
        }

        // 2. Architectural entrance canopy sconce illuminating the courtyard steps & facade
        roomTargets.push({
          x: 22.45,
          y: 2.85,
          z: 15.0,
          color: 0xffd796,
          intensity: 4.8 * nightBlend,
          distance: 10.0,
          decay: 1.05,
        });
      } else if (worldHandle) {
        for (const roomMat of worldHandle.roomLightMats.values()) {
          roomMat.emissiveIntensity = 0.04;
        }
        for (const washMat of worldHandle.roomWashMats.values()) {
          washMat.opacity = 0;
        }
        for (const poolMat of worldHandle.roomPoolMats.values()) {
          poolMat.opacity = 0;
        }
      }

      // 3. Player-purchased indoor & outdoor smart lamps (100% get emissive + baked additive floor/wall halos; closest get PBR PointLights)
      for (const entry of itemMeshes.values()) {
        const meta = entry.mesh.userData.smartLight as SmartLightMeta | undefined;
        if (!meta) continue;

        const matGlow =
          meta.kind === 'street_lamp'
            ? 0.08 + nightBlend * 2.2
            : meta.kind === 'garden_lamp'
              ? 0.08 + nightBlend * 1.95
              : meta.kind === 'indoor_lamp' || meta.kind === 'wall_lamp'
                ? 0.06 + nightBlend * 1.85
                : 0.1 + nightBlend * 1.65;
        for (const mat of meta.emissiveMats) {
          mat.emissiveIntensity = matGlow;
        }

        if (meta.haloMats && meta.haloMaxOpacities) {
          for (let hi = 0; hi < meta.haloMats.length; hi++) {
            meta.haloMats[hi].opacity =
              nightBlend > 0.005 ? (meta.haloMaxOpacities[hi] ?? 0.35) * nightBlend : 0;
          }
        }

        if (nightBlend > 0.005) {
          _lightWorldPos
            .set(meta.localPos[0], meta.localPos[1], meta.localPos[2])
            .applyQuaternion(entry.mesh.quaternion)
            .add(entry.mesh.position);

          const distSq =
            (_lightWorldPos.x - camCx) * (_lightWorldPos.x - camCx) +
            (_lightWorldPos.z - camCz) * (_lightWorldPos.z - camCz);

          if (meta.kind === 'street_lamp') {
            lampTargets.push({
              score: distSq * 0.8,
              target: {
                x: _lightWorldPos.x,
                y: _lightWorldPos.y,
                z: _lightWorldPos.z,
                color: 0xffd591,
                intensity: 16.0 * nightBlend,
                distance: 19.0,
                decay: 1.0,
              },
            });
          } else if (meta.kind === 'garden_lamp') {
            lampTargets.push({
              score: distSq + 10,
              target: {
                x: _lightWorldPos.x,
                y: _lightWorldPos.y,
                z: _lightWorldPos.z,
                color: 0xffcc78,
                intensity: 11.0 * nightBlend,
                distance: 13.5,
                decay: 1.02,
              },
            });
          } else if (meta.kind === 'indoor_lamp') {
            lampTargets.push({
              score: distSq + 16,
              target: {
                x: _lightWorldPos.x,
                y: _lightWorldPos.y,
                z: _lightWorldPos.z,
                color: 0xffe8bf,
                intensity: 8.5 * nightBlend,
                distance: 11.5,
                decay: 1.02,
              },
            });
          } else if (meta.kind === 'wall_lamp') {
            lampTargets.push({
              score: distSq + 18,
              target: {
                x: _lightWorldPos.x,
                y: _lightWorldPos.y,
                z: _lightWorldPos.z,
                color: 0xffd79e,
                intensity: 7.2 * nightBlend,
                distance: 10.5,
                decay: 1.04,
              },
            });
          } else if (meta.kind === 'ir_lamp') {
            lampTargets.push({
              score: distSq + 24,
              target: {
                x: _lightWorldPos.x,
                y: _lightWorldPos.y,
                z: _lightWorldPos.z,
                color: 0xff6b5a,
                intensity: 5.2 * nightBlend,
                distance: 7.5,
                decay: 1.08,
              },
            });
          } else {
            lampTargets.push({
              score: distSq + 36,
              target: {
                x: _lightWorldPos.x,
                y: _lightWorldPos.y,
                z: _lightWorldPos.z,
                color: 0x38bdf8,
                intensity: 5.5 * nightBlend,
                distance: 9.0,
                decay: 1.08,
              },
            });
          }
        }
      }

      // Reserve slots fairly so store lamps NEVER get starved by room sconces
      const reservedLampSlots = Math.min(
        lampTargets.length,
        Math.max(2, Math.floor(SMART_LIGHT_POOL_SIZE * 0.45))
      );
      const maxRoomSlotsNow = Math.max(0, SMART_LIGHT_POOL_SIZE - reservedLampSlots);
      const targets: LightTarget[] = [];

      for (let i = 0; i < roomTargets.length && targets.length < maxRoomSlotsNow; i++) {
        targets.push(roomTargets[i]);
      }
      if (lampTargets.length > 0) {
        lampTargets.sort((a, b) => a.score - b.score);
        for (let i = 0; i < lampTargets.length && targets.length < SMART_LIGHT_POOL_SIZE; i++) {
          targets.push(lampTargets[i].target);
        }
      }
      for (let i = maxRoomSlotsNow; i < roomTargets.length && targets.length < SMART_LIGHT_POOL_SIZE; i++) {
        targets.push(roomTargets[i]);
      }

      for (let i = 0; i < smartLightPool.length; i++) {
        const pl = smartLightPool[i];
        const t = targets[i];
        if (t) {
          pl.position.set(t.x, t.y, t.z);
          _tmpLightColor.setHex(t.color);
          pl.color.copy(_tmpLightColor);
          pl.intensity = THREE.MathUtils.damp(pl.intensity, t.intensity, 7.5, dt);
          pl.distance = t.distance;
          pl.decay = t.decay;
        } else {
          pl.intensity = THREE.MathUtils.damp(pl.intensity, 0, 8.5, dt);
        }
      }
    };

    const rebuildWorld = (nextRooms: ClinicRoom[], nextRemovedTreeIds: string[] = []) => {
      if (worldHandle) worldHandle.dispose();
      while (worldLayer.children.length > 0) {
        worldLayer.remove(worldLayer.children[0]);
      }
      worldHandle = buildClinicWorld3D(nextRooms, textures, nextRemovedTreeIds);
      worldLayer.add(worldHandle.group);
      updateAtmosphereAndLights(performance.now() * 0.001, 0.05);
    };

    const computeItemWorldPos = (
      cat: CatalogItem,
      gx: number,
      gy: number,
      rot: 0 | 1 | 2 | 3,
      baseY: number
    ): [number, number, number] => {
      const effW = rot % 2 === 0 ? cat.width : cat.depth;
      const effD = rot % 2 === 0 ? cat.depth : cat.width;
      let wx = gx + effW / 2;
      let wy = baseY;
      let wz = gy + effD / 2;
      if (cat.isWallDecor) {
        const onOuterWest = rot === 0 && gx === 2;
        const onOuterNorth = rot === 1 && gy === 2;
        if (onOuterWest) wx += 0.05;
        if (onOuterNorth) wz += 0.05;
        if ((onOuterWest || onOuterNorth) && cat.sprite !== 'wall_sconce_lamp') {
          wy += 0.48;
        }
      }
      return [wx, wy, wz];
    };

    let hasPlacedDisplayKiosk = false;
    let hasDraftDisplayKiosk = false;

    const syncItems = (nextItems: PlacedItem[], movingId?: string) => {
      const keepIds = new Set<string>();
      const catMap = latestRef.current.catalogMap;
      let foundKiosk = false;

      for (const item of nextItems) {
        if (movingId && item.instanceId === movingId) continue;
        const cat = catMap.get(item.catalogId);
        if (!cat) continue;
        if (cat.sprite === 'reception_display_stand') foundKiosk = true;
        keepIds.add(item.instanceId);

        const sig = `${item.catalogId}_${item.gridX}_${item.gridY}_${item.rotation}`;
        const existing = itemMeshes.get(item.instanceId);
        if (existing && existing.sig === sig) continue;

        if (existing) {
          itemsLayer.remove(existing.mesh);
          disposeObject3D(existing.mesh);
        }

        const mesh = createCatalogMesh3D(
          cat.sprite,
          textures,
          cat.width,
          cat.depth,
          item.rotation,
          false
        );
        mesh.userData.instanceId = item.instanceId;
        const [wx, wy, wz] = computeItemWorldPos(cat, item.gridX, item.gridY, item.rotation, 0.08);
        mesh.position.set(wx, wy, wz);
        itemsLayer.add(mesh);
        itemMeshes.set(item.instanceId, { sig, mesh });
      }

      for (const [id, entry] of itemMeshes.entries()) {
        if (!keepIds.has(id)) {
          itemsLayer.remove(entry.mesh);
          disposeObject3D(entry.mesh);
          itemMeshes.delete(id);
        }
      }
      hasPlacedDisplayKiosk = foundKiosk;
    };

    const syncDraft = (draft: PlacementDraft | null) => {
      hasDraftDisplayKiosk = Boolean(draft && draft.catalogItem.sprite === 'reception_display_stand');
      if (!draft) {
        draftPadMesh.visible = false;
        if (draftGhost) {
          draftLayer.remove(draftGhost);
          disposeObject3D(draftGhost);
          draftGhost = null;
          draftMeshSig = '';
        }
        return;
      }

      const effW = draft.rotation % 2 === 0 ? draft.catalogItem.width : draft.catalogItem.depth;
      const effD = draft.rotation % 2 === 0 ? draft.catalogItem.depth : draft.catalogItem.width;
      const valid = latestRef.current.isPlacementValid(draft.hoverX, draft.hoverY, draft);

      draftPadMesh.visible = true;
      draftPadMesh.scale.set(effW - 0.06, 1, effD - 0.06);
      draftPadMesh.position.set(draft.hoverX + effW / 2, 0.1, draft.hoverY + effD / 2);
      draftPadMat.color.setHex(valid ? 0x10b981 : 0xef4444);

      const sig = `${draft.catalogItem.id}_${draft.rotation}`;
      if (sig !== draftMeshSig) {
        if (draftGhost) {
          draftLayer.remove(draftGhost);
          disposeObject3D(draftGhost);
        }
        draftGhost = createCatalogMesh3D(
          draft.catalogItem.sprite,
          textures,
          draft.catalogItem.width,
          draft.catalogItem.depth,
          draft.rotation,
          true
        );
        draftLayer.add(draftGhost);
        draftMeshSig = sig;
      }
      if (draftGhost) {
        const [wx, wy, wz] = computeItemWorldPos(
          draft.catalogItem,
          draft.hoverX,
          draft.hoverY,
          draft.rotation,
          draft.catalogItem.isWallDecor ? 0.1 : 0.2
        );
        draftGhost.position.set(wx, wy, wz);
      }
    };

    startPreloadGlbs();
    rebuildWorld(latestRef.current.rooms, latestRef.current.removedTreeIds);
    syncItems(latestRef.current.placedItems, latestRef.current.placementDraft?.movingInstanceId);
    syncDraft(latestRef.current.placementDraft);

    const unsubGlb = glbRegistry.onReady(() => {
      if (disposed) return;
      rebuildWorld(latestRef.current.rooms, latestRef.current.removedTreeIds);
      for (const entry of itemMeshes.values()) {
        itemsLayer.remove(entry.mesh);
        disposeObject3D(entry.mesh);
      }
      itemMeshes.clear();
      syncItems(latestRef.current.placedItems, latestRef.current.placementDraft?.movingInstanceId);
      if (latestRef.current.placementDraft) {
        draftMeshSig = '';
        syncDraft(latestRef.current.placementDraft);
      }
      for (const [id, entry] of patientRigs.entries()) {
        if (!entry.rig.isSkinnedGlb) {
          actorsLayer.remove(entry.rig.root);
          disposeHumanoid3D(entry.rig);
          patientRigs.delete(id);
        }
      }
      for (const [id, entry] of staffRigs.entries()) {
        if (!entry.rig.isSkinnedGlb) {
          actorsLayer.remove(entry.rig.root);
          disposeHumanoid3D(entry.rig);
          staffRigs.delete(id);
        }
      }
      for (const w of walkerRigs) {
        if (!w.rig.isSkinnedGlb) {
          actorsLayer.remove(w.rig.root);
          disposeHumanoid3D(w.rig);
          const nextRig = createHumanoid3D({
            ...w.appearance,
            contactShadowTex: textures.contactShadow,
          });
          nextRig.hitMesh.visible = false;
          actorsLayer.add(nextRig.root);
          w.rig = nextRig;
        }
      }
    });

    // Pre-allocated scratch vectors
    const _raycaster = new THREE.Raycaster();
    const _ndc = new THREE.Vector2();
    const _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.07);
    const _hitPoint = new THREE.Vector3();
    const _projVec = new THREE.Vector3();
    const _camFwd = new THREE.Vector3();
    const _camRight = new THREE.Vector3();
    const _upVec = new THREE.Vector3(0, 1, 0);

    const updateCameraTransform = () => {
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      const aspect = w / h;
      if (Math.abs(camera.aspect - aspect) > 0.001) {
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
      }
      const cs = camStateRef.current;
      // Tighter architectural framing so the student stays close to the enlarged clinic
      const baseDist = aspect < 0.8 ? 47 : 34;
      const dist = baseDist / cs.curZoom;
      const pitch = 0.6;
      const horiz = Math.cos(pitch) * dist;
      const vert = Math.sin(pitch) * dist;
      camera.position.set(
        cs.curX + Math.sin(cs.curYaw) * horiz,
        vert,
        cs.curZ + Math.cos(cs.curYaw) * horiz
      );
      camera.lookAt(cs.curX, 0.45, cs.curZ);
    };

    const screenToGrid = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      _raycaster.setFromCamera(_ndc, camera);
      const hit = _raycaster.ray.intersectPlane(_groundPlane, _hitPoint);
      if (!hit) return { gx: 0, gy: 0, rawX: 0, rawZ: 0 };
      return {
        gx: Math.floor(hit.x),
        gy: Math.floor(hit.z),
        rawX: hit.x,
        rawZ: hit.z,
      };
    };

    const hitTestPatient = (clientX: number, clientY: number): PatientEntity | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      _raycaster.setFromCamera(_ndc, camera);

      const hitTargets: THREE.Object3D[] = [];
      const targetToId = new Map<THREE.Object3D, string>();
      for (const [id, entry] of patientRigs.entries()) {
        hitTargets.push(entry.rig.hitMesh);
        targetToId.set(entry.rig.hitMesh, id);
      }
      const hits = _raycaster.intersectObjects(hitTargets, false);
      if (hits.length > 0) {
        const hitId = targetToId.get(hits[0].object);
        if (hitId) {
          return latestRef.current.patients.find((p) => p.id === hitId) || null;
        }
      }
      return null;
    };

    const hitTestPlacedItemDetail = (
      clientX: number,
      clientY: number
    ): { item: PlacedItem; distSq: number } | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      _raycaster.setFromCamera(_ndc, camera);
      const hits = _raycaster.intersectObjects(itemsLayer.children, true);
      for (const hit of hits) {
        let obj: THREE.Object3D | null = hit.object;
        while (obj && obj !== itemsLayer) {
          const instId = obj.userData?.instanceId as string | undefined;
          if (instId) {
            const item = latestRef.current.placedItems.find((it) => it.instanceId === instId);
            if (item) return { item, distSq: hit.distance * hit.distance };
            break;
          }
          obj = obj.parent;
        }
      }
      return null;
    };

    const hitTestPlacedItem = (clientX: number, clientY: number): PlacedItem | null => {
      return hitTestPlacedItemDetail(clientX, clientY)?.item || null;
    };

    const hitTestDraftGhost = (clientX: number, clientY: number): boolean => {
      if (!draftGhost) return false;
      const rect = renderer.domElement.getBoundingClientRect();
      _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      _raycaster.setFromCamera(_ndc, camera);
      return _raycaster.intersectObject(draftGhost, true).length > 0;
    };

    const _treeSphere = new THREE.Sphere();
    const _treeCenter = new THREE.Vector3();
    const _treeHitVec = new THREE.Vector3();
    const hitTestWorldTreeDetail = (
      clientX: number,
      clientY: number
    ): { tree: WorldTreeDef; distSq: number } | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      _raycaster.setFromCamera(_ndc, camera);
      const removedSet = new Set(latestRef.current.removedTreeIds);

      if (worldHandle?.worldTreeHitMeshes) {
        const hits = _raycaster.intersectObjects(worldHandle.worldTreeHitMeshes.children, true);
        for (const hit of hits) {
          let obj: THREE.Object3D | null = hit.object;
          while (obj && obj !== worldHandle.worldTreeHitMeshes) {
            const treeId = obj.userData?.worldTreeId as string | undefined;
            if (treeId && !removedSet.has(treeId)) {
              const tree = WORLD_TREES.find((t) => t.id === treeId);
              if (tree) {
                return { tree, distSq: hit.distance * hit.distance };
              }
            }
            obj = obj.parent;
          }
        }
      }

      let closestTree: WorldTreeDef | null = null;
      let closestDistSq = Infinity;

      const checkSphere = (tree: WorldTreeDef, cy: number, radius: number) => {
        _treeCenter.set(tree.x, cy, tree.z);
        _treeSphere.set(_treeCenter, radius);
        if (_raycaster.ray.intersectSphere(_treeSphere, _treeHitVec)) {
          const dSq = camera.position.distanceToSquared(_treeHitVec);
          if (dSq < closestDistSq) {
            closestDistSq = dSq;
            closestTree = tree;
          }
        }
      };

      for (const tree of WORLD_TREES) {
        if (removedSet.has(tree.id)) continue;
        const s = tree.scale * 1.12;
        if (tree.species === 'cypress') {
          checkSphere(tree, 0.85 * s, 0.65 * s);
          checkSphere(tree, 1.85 * s, 1.05 * s);
          checkSphere(tree, 2.85 * s, 0.85 * s);
        } else if (tree.species === 'acacia') {
          checkSphere(tree, 0.8 * s, 0.68 * s);
          checkSphere(tree, 2.15 * s, 1.68 * s);
        } else {
          checkSphere(tree, 0.85 * s, 0.72 * s);
          checkSphere(tree, 2.05 * s, 1.54 * s);
          checkSphere(tree, 2.55 * s, 1.18 * s);
        }
      }
      return closestTree ? { tree: closestTree, distSq: closestDistSq } : null;
    };

    const hitTestLockedRoomDetail = (
      clientX: number,
      clientY: number
    ): { room: ClinicRoom; distSq: number } | null => {
      if (!worldHandle || worldHandle.lockedRoomCovers.length === 0) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      _raycaster.setFromCamera(_ndc, camera);
      const hits = _raycaster.intersectObjects(worldHandle.lockedRoomCovers, false);
      for (const hit of hits) {
        const roomId = hit.object.userData?.roomId as string | undefined;
        if (!roomId) continue;
        const room = latestRef.current.rooms.find((r) => r.id === roomId && !r.unlocked);
        if (room) {
          return { room, distSq: hit.distance * hit.distance };
        }
      }
      return null;
    };

    const _groundPtVec = new THREE.Vector3();
    const getRayGroundDistSq = (rawX: number, rawZ: number): number => {
      _groundPtVec.set(rawX, 0.1, rawZ);
      return camera.position.distanceToSquared(_groundPtVec);
    };

    const getPanVectors = () => {
      camera.getWorldDirection(_camFwd);
      _camFwd.y = 0;
      _camFwd.normalize();
      _camRight.crossVectors(_camFwd, _upVec).normalize();
      const h = Math.max(1, container.clientHeight);
      const dist = camera.position.distanceTo(
        _hitPoint.set(camStateRef.current.curX, 0.35, camStateRef.current.curZ)
      );
      const visibleH = 2 * Math.tan((camera.fov * Math.PI) / 360) * dist;
      return { right: _camRight.clone(), forward: _camFwd.clone(), scale: visibleH / h };
    };

    sceneHooksRef.current = {
      rebuildWorld,
      syncItems,
      syncDraft,
      screenToGrid,
      hitTestPatient,
      hitTestPlacedItem,
      hitTestPlacedItemDetail,
      hitTestWorldTreeDetail,
      hitTestLockedRoomDetail,
      getRayGroundDistSq,
      hitTestDraftGhost,
      getPanVectors,
    };

    if (!isSoftwareGl) {
      updateCameraTransform();
      renderer.compile(scene, camera);
    }

    const onResize = () => {
      if (!container) return;
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      renderer.setSize(w, h);
      updateCameraTransform();
    };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);

    const afterDraw = (next: () => void) => {
      if (!isSoftwareGl || !('fenceSync' in gl)) {
        setTimeout(next, 80);
        return;
      }
      const gl2 = gl as WebGL2RenderingContext;
      const sync = gl2.fenceSync(gl2.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl2.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl2.deleteSync(sync);
          return;
        }
        if (!sync) {
          setTimeout(next, 80);
          return;
        }
        const status = gl2.clientWaitSync(sync, 0, 0);
        if (status === gl2.ALREADY_SIGNALED || status === gl2.CONDITION_SATISFIED) {
          gl2.deleteSync(sync);
          setTimeout(next, 80);
        } else {
          setTimeout(poll, 16);
        }
      };
      poll();
    };

    let disposed = false;
    let rafId = 0;
    let lastMs = performance.now();
    const doorActorsScratch: DoorActorInput[] = [];

    const syncAndAnimateActors = (timeSec: number, dt: number) => {
      const {
        patients: curPatients,
        staff: curStaff,
        placedItems: curItems,
        catalogMap: cMap,
        focusedPatientId: focId,
      } = latestRef.current;

      const curRooms = latestRef.current.rooms;
      const { obstacles, changed: layoutChanged } = getWalkerObstacles(
        curRooms,
        curItems,
        latestRef.current.removedTreeIds || []
      );
      const unlockedSet = new Set(curRooms.filter((r) => r.unlocked).map((r) => r.id));
      const worldDoors = worldHandle ? worldHandle.doors : [];

      if (layoutChanged) {
        const allBenchSlots = buildWaitSeatSlots(curItems, curRooms).filter(
          (s) => s.catalogId === 'park_bench'
        );
        const benchByKey = new Map(allBenchSlots.map((s) => [s.seatKey, s]));

        // Immediately reroute therapists around placed/moved/sold furniture
        for (const sr of staffRigs.values()) {
          if (!isTileWalkable(sr.gx, sr.gy, 0.21, obstacles)) {
            const safe = findNearestWalkableTile(sr.gx, sr.gy, 0.22, obstacles);
            sr.gx = safe.x;
            sr.gy = safe.y;
          }
          if (sr.path.length > 0) {
            const dest = sr.path[sr.path.length - 1];
            sr.path = findGridPath(
              sr.gx,
              sr.gy,
              dest.x,
              dest.y,
              curRooms,
              curItems,
              walkerFootprints,
              obstacles
            );
            sr.stuckTimer = 0;
          }
        }

        // Immediately revalidate park bench seating & paths for outdoor walkers
        for (const w of walkerRigs) {
          if (w.seatedMode && w.seatKey) {
            const slot = benchByKey.get(w.seatKey);
            const stillValid =
              slot &&
              isTileWalkable(slot.approachTileX, slot.approachTileY, 0.21, obstacles);
            if (!stillValid) {
              const safe = findNearestWalkableTile(w.gx, w.gy, 0.22, obstacles);
              w.gx = safe.x;
              w.gy = safe.y;
              w.seatedMode = false;
              w.seatKey = undefined;
              w.seatApproachX = undefined;
              w.seatApproachY = undefined;
              w.ignoreItemId = undefined;
              w.path = [];
              w.pauseTimer = 0.15;
              continue;
            }
            if (w.path.length > 0 && slot) {
              const safe = findNearestWalkableTile(w.gx, w.gy, 0.21, obstacles);
              w.gx = safe.x;
              w.gy = safe.y;
              const toFront = findGridPath(
                w.gx,
                w.gy,
                slot.approachTileX,
                slot.approachTileY,
                curRooms,
                curItems,
                walkerFootprints,
                obstacles
              );
              w.path = [...toFront, { x: slot.seatTileX, y: slot.seatTileY }];
            }
          } else if (w.path.length > 0) {
            const safe = findNearestWalkableTile(w.gx, w.gy, 0.21, obstacles);
            w.gx = safe.x;
            w.gy = safe.y;
            const dest = w.path[w.path.length - 1];
            w.path = findGridPath(
              w.gx,
              w.gy,
              dest.x,
              dest.y,
              curRooms,
              curItems,
              walkerFootprints,
              obstacles
            );
            w.stuckTimer = 0;
          }
        }
      }

      // Reset interactive water cooler parts each frame before active drinkers update them
      for (const [itemId, entryItem] of itemMeshes.entries()) {
        const wc = entryItem.mesh.userData.waterCooler as WaterCoolerRigMeta | undefined;
        if (!wc) continue;
        wc.alcoveCup.visible = false;
        wc.stream.visible = false;
        wc.bubble.visible = false;
        const keepReturn = coolerReturnUntil.get(itemId);
        wc.returnedCup.visible = keepReturn !== undefined && timeSec < keepReturn;
      }

      const activePatientIds = new Set<string>();
      for (const p of curPatients) {
        activePatientIds.add(p.id);
        let entry = patientRigs.get(p.id);
        if (!entry) {
          const rig = createHumanoid3D({
            skinTone: p.skinTone,
            hairColor: p.hairColor,
            shirtColor: p.shirtColor,
            pantsColor: p.pantsColor,
            hasHijab: p.hasHijab,
            hasTurban: p.hasTurban,
            outfitStyle: p.outfitStyle,
            shirtStyle: p.shirtStyle,
            heightScale: p.heightScale,
            hasBeard: p.hasBeard,
            isFemale: p.clinicalCase.gender === 'female',
            variantSeed: p.id.charCodeAt(p.id.length - 1),
            mobilityAid: p.clinicalCase.mobilityAid || 'none',
            isStaff: false,
            contactShadowTex: textures.contactShadow,
          });
          actorsLayer.add(rig.root);
          entry = {
            rig,
            visX: p.gridX + 0.5,
            visZ: p.gridY + 0.5,
            vx: 0,
            vz: 0,
            walkPhase: 0,
            walkBlend: 0,
            sitBlend: 0,
            doorPush: 0,
            facingRad: -Math.PI / 2,
          };
          patientRigs.set(p.id, entry);
        }

        const isAtStation =
          p.state === 'ready_for_exam' || p.state === 'in_exam' || p.state === 'in_treatment';
        const station = p.assignedStationId
          ? curItems.find((it) => it.instanceId === p.assignedStationId)
          : null;
        const stationCat = station ? cMap.get(station.catalogId) : null;
        const spr = stationCat?.sprite;

        const isLyingStation = Boolean(
          isAtStation &&
            station &&
            (spr === 'treatment_bed' ||
              spr === 'traction_table' ||
              spr === 'magnetotherapy' ||
              spr === 'exercise_mat' ||
              spr === 'tilt_table')
        );
        const lyingHeight = spr === 'exercise_mat' ? 0.11 : spr === 'tilt_table' ? 0.44 : 0.5;
        const tiltPitch = spr === 'tilt_table' ? -Math.PI / 2 + 0.52 : -Math.PI / 2;
        const isBikeStation = Boolean(isAtStation && station && spr === 'exercise_bike');
        const isActiveGaitStation = Boolean(
          isAtStation && station && (spr === 'treadmill' || spr === 'parallel_bars')
        );

        const isSeatedWait = p.state === 'waiting_checkin' && p.isSeatedWait !== false;
        let targetX = p.gridX + 0.5 + (isSeatedWait ? p.seatOffsetX || 0 : 0);
        let targetZ = p.gridY + 0.5 + (isSeatedWait ? p.seatOffsetZ || 0 : 0);
        let stationFacing: number | null = null;

        if (isAtStation && station && stationCat) {
          const effW = station.rotation % 2 === 0 ? stationCat.width : stationCat.depth;
          const effD = station.rotation % 2 === 0 ? stationCat.depth : stationCat.width;
          const cx = station.gridX + effW / 2;
          const cz = station.gridY + effD / 2;
          const ry = (-station.rotation * Math.PI) / 2;
          const rotLocal = (lx: number, lz: number) => ({
            x: cx + Math.cos(ry) * lx + Math.sin(ry) * lz,
            z: cz - Math.sin(ry) * lx + Math.cos(ry) * lz,
          });

          if (isLyingStation) {
            if (spr === 'tilt_table') {
              const pt = rotLocal(0.06, 0);
              targetX = pt.x;
              targetZ = pt.z;
            } else {
              targetX = cx;
              targetZ = cz;
            }
            stationFacing = Math.PI / 2 - (station.rotation * Math.PI) / 2;
          } else if (isBikeStation) {
            const pt = rotLocal(-0.22, 0);
            targetX = pt.x;
            targetZ = pt.z;
            stationFacing = Math.PI / 2 - (station.rotation * Math.PI) / 2;
          } else if (spr === 'treadmill') {
            const pt = rotLocal(-0.14, 0);
            targetX = pt.x;
            targetZ = pt.z;
            stationFacing = Math.PI / 2 - (station.rotation * Math.PI) / 2;
          } else if (spr === 'parallel_bars') {
            targetX = cx;
            targetZ = cz;
            stationFacing = Math.PI / 2 - (station.rotation * Math.PI) / 2;
          } else if (spr === 'balance_trainer') {
            const pt = rotLocal(-0.04, 0);
            targetX = pt.x;
            targetZ = pt.z;
            stationFacing = Math.PI / 2 - (station.rotation * Math.PI) / 2;
          } else {
            // Stand comfortably in front of equipment, picking first wall-free side if placed against a wall
            const frontZ = spr === 'wall_bars' ? 0.28 : 0.56;
            const localSpots: Array<[number, number, number]> = [
              [0, frontZ, Math.PI],
              [0.56, 0, -Math.PI / 2],
              [-0.56, 0, Math.PI / 2],
              [0, -frontZ, 0],
            ];
            let chosen = { x: cx, z: cz, ang: Math.PI };
            let foundClear = false;
            for (const [lx, lz, baseAng] of localSpots) {
              const pt = rotLocal(lx, lz);
              if (isWorldWalkable(pt.x, pt.z, 0.17, obstacles, station.instanceId)) {
                chosen = { x: pt.x, z: pt.z, ang: baseAng - (station.rotation * Math.PI) / 2 };
                foundClear = true;
                break;
              }
            }
            if (!foundClear) {
              const pt = rotLocal(0, frontZ);
              chosen = { x: pt.x, z: pt.z, ang: Math.PI - (station.rotation * Math.PI) / 2 };
            }
            targetX = chosen.x;
            targetZ = chosen.z;
            stationFacing = chosen.ang;
          }
        }

        const prevVisX = entry.visX;
        const prevVisZ = entry.visZ;
        const dampRate = p.path.length > 0 ? 15.0 : 12.0;
        let nextVisX = THREE.MathUtils.damp(entry.visX, targetX, dampRate, dt);
        let nextVisZ = THREE.MathUtils.damp(entry.visZ, targetZ, dampRate, dt);

        // Enforce world-space wall & furniture non-clipping on the interpolated visual position while walking
        const seatItemId = p.waitingSeatKey
          ? p.waitingSeatKey.slice(0, p.waitingSeatKey.lastIndexOf('_'))
          : undefined;
        const nearChairFinal =
          p.state === 'walking_to_wait' &&
          p.path.length <= 1 &&
          Math.hypot(targetX - prevVisX, targetZ - prevVisZ) < 1.35;
        const visualIgnoreId =
          isAtStation
            ? p.assignedStationId || undefined
            : isSeatedWait || nearChairFinal
              ? seatItemId
              : p.state === 'treated_leaving'
                ? p.leavingItemId
                : p.state === 'walking_to_station' &&
                    p.path.length <= 1 &&
                    Math.hypot(targetX - prevVisX, targetZ - prevVisZ) < 1.55
                  ? p.assignedStationId || undefined
                  : undefined;

        if (!isAtStation && !isSeatedWait) {
          const clamped = resolveWorldStep(
            prevVisX,
            prevVisZ,
            nextVisX,
            nextVisZ,
            0.19,
            obstacles,
            visualIgnoreId
          );
          nextVisX = clamped.x;
          nextVisZ = clamped.z;

          // Recover cleanly if a lagged visual coordinate hits a corner while logical path turned cleanly around it
          if (clamped.blocked && Math.hypot(nextVisX - prevVisX, nextVisZ - prevVisZ) < dt * 0.28) {
            const rawDistRem = Math.hypot(targetX - prevVisX, targetZ - prevVisZ);
            if (p.path.length > 0) {
              const wpX = p.path[0].x + 0.5;
              const wpZ = p.path[0].y + 0.5;
              const viaWp = resolveWorldStep(
                prevVisX,
                prevVisZ,
                THREE.MathUtils.damp(prevVisX, wpX, 14, dt),
                THREE.MathUtils.damp(prevVisZ, wpZ, 14, dt),
                0.19,
                obstacles,
                visualIgnoreId
              );
              if (Math.hypot(viaWp.x - prevVisX, viaWp.z - prevVisZ) > Math.hypot(nextVisX - prevVisX, nextVisZ - prevVisZ)) {
                nextVisX = viaWp.x;
                nextVisZ = viaWp.z;
              }
            }
            if (
              Math.hypot(nextVisX - prevVisX, nextVisZ - prevVisZ) < dt * 0.25 &&
              rawDistRem > 0.45 &&
              isWorldWalkable(targetX, targetZ, 0.19, obstacles, visualIgnoreId)
            ) {
              const catchUp = Math.min(1, dt * 8.0);
              nextVisX = THREE.MathUtils.lerp(prevVisX, targetX, catchUp);
              nextVisZ = THREE.MathUtils.lerp(prevVisZ, targetZ, catchUp);
            }
          }
        }
        entry.visX = nextVisX;
        entry.visZ = nextVisZ;

        const mdx = entry.visX - prevVisX;
        const mdz = entry.visZ - prevVisZ;
        const invDt = dt > 0.0001 ? 1 / dt : 60;
        entry.vx = mdx * invDt;
        entry.vz = mdz * invDt;
        const stepDist = Math.hypot(mdx, mdz);
        const realSpeed = stepDist * invDt;
        const distRem = Math.hypot(targetX - entry.visX, targetZ - entry.visZ);
        const logicalMoving = !isLyingStation && (p.path.length > 0 || distRem > 0.05);
        // Never animate walk stride while standing completely still!
        const isMoving = !isLyingStation && (realSpeed > 0.12 || (logicalMoving && stepDist > 0.0018));

        const targetSeatFacing = isBikeStation
          ? stationFacing ?? entry.facingRad
          : p.seatFacingRad !== undefined
            ? p.seatFacingRad
            : entry.facingRad;

        const readySeatPos = (isSeatedWait && distRem < 0.14) || Boolean(isBikeStation && distRem < 0.22);
        const facingReady = angleDiffAbs(entry.facingRad, targetSeatFacing) < 0.65;
        const shouldSit = readySeatPos && (facingReady || entry.sitBlend > 0.3);
        const pose = isLyingStation ? 'lying' : shouldSit ? 'seated' : 'standing';
        const effectiveSeatHeight = isBikeStation ? 0.66 : (p.seatHeight ?? 0.375);

        entry.walkBlend = THREE.MathUtils.damp(entry.walkBlend, isMoving ? 1 : 0, 12.0, dt);
        entry.sitBlend = THREE.MathUtils.damp(entry.sitBlend, shouldSit ? 1 : 0, 8.0, dt);

        const pushTarget = computeDoorPushTarget(
          entry.visX,
          entry.visZ,
          entry.vx,
          entry.vz,
          isMoving && !isSeatedWait,
          worldDoors,
          unlockedSet
        );
        entry.doorPush = THREE.MathUtils.damp(entry.doorPush, pushTarget, pushTarget > entry.doorPush ? 14 : 8, dt);

        if (stepDist > 0.0005 && (isMoving || entry.walkBlend > 0.04)) {
          entry.walkPhase += stepDist * 5.6;
          if (stepDist > 0.0008 && isMoving && !(isSeatedWait && distRem < 0.18)) {
            const targetAngle = Math.atan2(mdx, mdz);
            entry.facingRad = lerpAngle(entry.facingRad, targetAngle, Math.min(1, dt * 9.0));
          }
        }

        let drinkStage: 'none' | 'filling' | 'sipping' | 'returning' = 'none';
        if (!isMoving || (isSeatedWait && distRem < 0.22)) {
          if (p.state === 'checkin_at_desk') {
            const desk = curItems.find((it) => it.catalogId === 'reception_desk');
            const lookAngle = desk
              ? Math.atan2(desk.gridX + 1.0 - entry.visX, desk.gridY + 0.5 - entry.visZ)
              : Math.PI;
            entry.facingRad = lerpAngle(entry.facingRad, lookAngle, Math.min(1, dt * 8));
          } else if (p.state === 'drinking_water') {
            const cooler = p.waterCoolerId
              ? curItems.find((it) => it.instanceId === p.waterCoolerId)
              : null;
            const coolerAngle = cooler
              ? Math.atan2(cooler.gridX + 0.5 - entry.visX, cooler.gridY + 0.5 - entry.visZ)
              : p.headingRad ?? Math.PI;
            entry.facingRad = lerpAngle(entry.facingRad, coolerAngle, Math.min(1, dt * 10));

            const wt = p.waitTimer;
            const coolerEntry = p.waterCoolerId ? itemMeshes.get(p.waterCoolerId) : undefined;
            const wc = coolerEntry?.mesh.userData.waterCooler as WaterCoolerRigMeta | undefined;

            if (wt < 1450) {
              drinkStage = 'filling';
              if (wc) {
                const fillFrac = THREE.MathUtils.clamp(wt / 1380, 0.05, 1);
                wc.alcoveCup.visible = true;
                wc.alcoveWater.scale.y = fillFrac;
                wc.alcoveWater.position.y = 0.008 + fillFrac * 0.028;
                wc.stream.visible = wt < 1380;
                wc.stream.scale.x = 0.85 + 0.18 * Math.sin(timeSec * 30);
                wc.stream.scale.z = wc.stream.scale.x;
                wc.bubble.visible = wt < 1380;
                wc.bubble.position.y = 0.98 + ((timeSec * 0.36) % 0.26);
              }
            } else if (wt < 2950) {
              drinkStage = 'sipping';
            } else {
              drinkStage = wt < 3280 ? 'returning' : 'none';
              if (wt >= 3280 && p.waterCoolerId && wc) {
                coolerReturnUntil.set(p.waterCoolerId, timeSec + 8.5);
                wc.returnedCup.visible = true;
              }
            }
          } else if (isSeatedWait) {
            const table = curItems.find((it) => it.catalogId === 'coffee_table');
            const fallbackAngle = table
              ? Math.atan2(table.gridX + 0.5 - entry.visX, table.gridY + 0.5 - entry.visZ)
              : 0;
            const seatAngle = p.seatFacingRad !== undefined ? p.seatFacingRad : fallbackAngle;
            entry.facingRad = lerpAngle(entry.facingRad, seatAngle, Math.min(1, dt * 11));
          } else if (p.state === 'waiting_checkin' && p.isSeatedWait === false) {
            const lookAngle =
              p.headingRad !== undefined
                ? p.headingRad
                : Math.sin(timeSec * 0.7 + p.id.charCodeAt(p.id.length - 1)) * 0.45 + Math.PI;
            entry.facingRad = lerpAngle(entry.facingRad, lookAngle, Math.min(1, dt * 4.5));
          } else if (isAtStation && stationFacing !== null) {
            entry.facingRad = lerpAngle(entry.facingRad, stationFacing, Math.min(1, dt * 10));
          }
        }

        entry.rig.root.position.set(entry.visX, 0.02, entry.visZ);

        animateHumanoid3D(entry.rig, {
          pose,
          walkPhase: entry.walkPhase,
          isMoving,
          walkBlend: entry.walkBlend,
          sitBlend: entry.sitBlend,
          doorPush: entry.doorPush,
          seatHeight: effectiveSeatHeight,
          lyingHeight,
          tiltPitch,
          facingRad: entry.facingRad,
          timeSec,
          isSelected: focId === p.id,
          inTreatment: p.state === 'in_treatment',
          activeGait: p.state === 'in_treatment' && isActiveGaitStation,
          isDrinking: p.state === 'drinking_water',
          drinkStage,
        });
      }

      for (const [id, entry] of patientRigs.entries()) {
        if (!activePatientIds.has(id)) {
          actorsLayer.remove(entry.rig.root);
          disposeHumanoid3D(entry.rig);
          patientRigs.delete(id);
        }
      }

      // Sync Staff (60fps local therapist patrol — zero React re-render/IndexedDB overhead!)
      const activeStaffIds = new Set<string>();
      for (const s of curStaff) {
        if (!s.hired) continue;
        activeStaffIds.add(s.id);
        let entry = staffRigs.get(s.id);
        if (!entry) {
          const rig = createHumanoid3D({
            skinTone: s.skinTone,
            hairColor: s.hairColor,
            shirtColor: s.scrubColor,
            pantsColor: '#1e3a5f',
            hasHijab: true,
            isFemale: true,
            outfitStyle: s.role === 'receptionist' ? 'abaya' : 'casual',
            isStaff: true,
            role: s.role,
            contactShadowTex: textures.contactShadow,
          });
          actorsLayer.add(rig.root);
          entry = {
            rig,
            gx: s.gridX,
            gy: s.gridY,
            visX: s.gridX + 0.5,
            visZ: s.gridY + 0.5,
            vx: 0,
            vz: 0,
            path: [],
            pauseTimer: 0.6 + Math.random() * 1.2,
            stuckTimer: 0,
            walkPhase: 0,
            walkBlend: 0,
            sitBlend: s.role === 'receptionist' ? 1 : 0,
            doorPush: 0,
            facingRad: Math.PI / 2,
          };
          staffRigs.set(s.id, entry);
        }

        let targetX = entry.gx + 0.5;
        let targetZ = entry.gy + 0.5;
        let recSeatFacing = 0;
        let isMoving = false;

        if (s.role === 'receptionist') {
          const deskItem = curItems.find((it) => it.catalogId === 'reception_desk');
          if (deskItem) {
            if (deskItem.rotation === 0) {
              targetX = deskItem.gridX + 0.9;
              targetZ = deskItem.gridY + 0.08;
              recSeatFacing = 0;
            } else if (deskItem.rotation === 2) {
              targetX = deskItem.gridX + 1.1;
              targetZ = deskItem.gridY + 0.92;
              recSeatFacing = Math.PI;
            } else if (deskItem.rotation === 1) {
              targetX = deskItem.gridX + 0.92;
              targetZ = deskItem.gridY + 0.9;
              recSeatFacing = -Math.PI / 2;
            } else {
              targetX = deskItem.gridX + 0.08;
              targetZ = deskItem.gridY + 1.1;
              recSeatFacing = Math.PI / 2;
            }
          }
          entry.gx = targetX - 0.5;
          entry.gy = targetZ - 0.5;
        } else {
          // Therapist autonomous smooth patrol across unlocked rooms & near active patients
          if (entry.path.length > 0) {
            if (
              entry.path.length >= 2 &&
              hasContinuousLineOfSight(
                entry.gx,
                entry.gy,
                entry.path[1].x,
                entry.path[1].y,
                0.24,
                obstacles
              )
            ) {
              entry.path.shift();
            }

            const nextNode = entry.path[0];
            const dx = nextNode.x - entry.gx;
            const dy = nextNode.y - entry.gy;
            const dist = Math.hypot(dx, dy);
            const step = 1.48 * dt;

            const isNearStaffDoor =
              Math.hypot(entry.gx - 11.5, entry.gy - 14) < 0.8 ||
              Math.hypot(entry.gx - 6, entry.gy - 9.5) < 0.8 ||
              Math.hypot(entry.gx - 16, entry.gy - 9.5) < 0.8 ||
              Math.hypot(entry.gx - 11.5, entry.gy - 5) < 0.8;

            let avoidX = 0;
            let avoidY = 0;
            if (!isNearStaffDoor) {
              for (const pt of curPatients) {
                if (pt.state === 'in_treatment' || pt.state === 'ready_for_exam') continue;
                const ox = entry.gx - pt.gridX;
                const oy = entry.gy - pt.gridY;
                const od = Math.hypot(ox, oy);
                if (od > 0.01 && od < 0.72) {
                  const push = (0.72 - od) * 0.28;
                  avoidX += (ox / od) * push;
                  avoidY += (oy / od) * push;
                }
              }
            }

            if (entry.path.length > 1 && dist <= 0.24) {
              entry.path.shift();
            } else if (dist <= Math.max(0.08, step)) {
              const res = resolveTileStep(entry.gx, entry.gy, nextNode.x, nextNode.y, 0.22, obstacles);
              entry.gx = res.x;
              entry.gy = res.y;
              entry.path.shift();
              entry.stuckTimer = 0;
            } else {
              const steerX = dx / dist + avoidX;
              const steerY = dy / dist + avoidY;
              const steerLen = Math.hypot(steerX, steerY) || 1;
              const candX = entry.gx + (steerX / steerLen) * step;
              const candY = entry.gy + (steerY / steerLen) * step;
              const res = resolveTileStep(entry.gx, entry.gy, candX, candY, 0.22, obstacles);
              const movedDist = Math.hypot(res.x - entry.gx, res.y - entry.gy);
              entry.gx = res.x;
              entry.gy = res.y;
              if (res.blocked && movedDist < step * 0.24) {
                entry.stuckTimer += dt;
                if (entry.stuckTimer > 0.2) {
                  const dest = entry.path[entry.path.length - 1];
                  const rerouted = dest
                    ? findGridPath(
                        entry.gx,
                        entry.gy,
                        dest.x,
                        dest.y,
                        curRooms,
                        curItems,
                        walkerFootprints,
                        obstacles
                      )
                    : [];
                  entry.path = rerouted;
                  if (rerouted.length === 0) entry.pauseTimer = 0.2;
                  entry.stuckTimer = 0;
                }
              } else {
                entry.stuckTimer = 0;
              }
            }
          } else {
            entry.pauseTimer -= dt;
            if (entry.pauseTimer <= 0) {
              const activePt =
                curPatients.find((pt) => pt.state === 'in_treatment') ||
                curPatients.find((pt) => pt.state === 'ready_for_exam');

              let pickedPath: Array<{ x: number; y: number }> = [];
              if (activePt && Math.random() < 0.65) {
                const adjOffsets = [
                  [1, 0],
                  [-1, 0],
                  [0, 1],
                  [0, -1],
                  [1, 1],
                  [-1, 1],
                ];
                for (const [ox, oy] of adjOffsets) {
                  const cx = Math.round(activePt.gridX) + ox;
                  const cy = Math.round(activePt.gridY) + oy;
                  if (isTileWalkable(cx, cy, 0.24, obstacles) && Math.hypot(cx - entry.gx, cy - entry.gy) > 1.0) {
                    const pTest = findGridPath(
                      entry.gx,
                      entry.gy,
                      cx,
                      cy,
                      curRooms,
                      curItems,
                      walkerFootprints,
                      obstacles
                    );
                    if (pTest.length > 0) {
                      pickedPath = pTest;
                      break;
                    }
                  }
                }
              }

              if (pickedPath.length === 0) {
                const unlockedRooms = curRooms.filter((r) => r.unlocked);
                for (let tries = 0; tries < 10; tries++) {
                  const rm = unlockedRooms[Math.floor(Math.random() * unlockedRooms.length)];
                  if (!rm) break;
                  const rx = Math.floor(rm.minX + 1 + Math.random() * Math.max(1, rm.maxX - rm.minX - 1));
                  const ry = Math.floor(rm.minY + 1 + Math.random() * Math.max(1, rm.maxY - rm.minY - 1));
                  if (isTileWalkable(rx, ry, 0.24, obstacles) && Math.hypot(rx - entry.gx, ry - entry.gy) > 1.0) {
                    const pTest = findGridPath(
                      entry.gx,
                      entry.gy,
                      rx,
                      ry,
                      curRooms,
                      curItems,
                      walkerFootprints,
                      obstacles
                    );
                    if (pTest.length > 0) {
                      pickedPath = pTest;
                      break;
                    }
                  }
                }
              }

              if (pickedPath.length > 0) {
                entry.path = pickedPath;
                entry.pauseTimer = 1.6 + Math.random() * 2.0;
              } else {
                entry.pauseTimer = 0.45;
              }
            }
          }

          targetX = entry.gx + 0.5;
          targetZ = entry.gy + 0.5;
        }

        const prevVisX = entry.visX;
        const prevVisZ = entry.visZ;
        if (s.role === 'receptionist') {
          entry.visX = THREE.MathUtils.damp(entry.visX, targetX, 13.5, dt);
          entry.visZ = THREE.MathUtils.damp(entry.visZ, targetZ, 13.5, dt);
        } else {
          // Therapist already integrates gx/gy continuously every frame via resolveTileStep (zero lag-corner snag!)
          entry.visX = targetX;
          entry.visZ = targetZ;
        }

        const mdx = entry.visX - prevVisX;
        const mdz = entry.visZ - prevVisZ;
        const invDt = dt > 0.0001 ? 1 / dt : 60;
        entry.vx = mdx * invDt;
        entry.vz = mdz * invDt;
        const stepDist = Math.hypot(mdx, mdz);
        const realSpeed = stepDist * invDt;
        const distRem = Math.hypot(targetX - entry.visX, targetZ - entry.visZ);
        const logicalMoving = s.role !== 'receptionist' && (entry.path.length > 0 || distRem > 0.05);
        isMoving = s.role !== 'receptionist' && (realSpeed > 0.12 || (logicalMoving && stepDist > 0.0018));

        entry.walkBlend = THREE.MathUtils.damp(entry.walkBlend, isMoving ? 1 : 0, 12.0, dt);
        const shouldStaffSit = s.role === 'receptionist' && distRem < 0.25;
        entry.sitBlend = THREE.MathUtils.damp(entry.sitBlend, shouldStaffSit ? 1 : 0, 7.5, dt);

        const staffPushTarget =
          s.role === 'receptionist'
            ? 0
            : computeDoorPushTarget(
                entry.visX,
                entry.visZ,
                entry.vx,
                entry.vz,
                isMoving,
                worldDoors,
                unlockedSet
              );
        entry.doorPush = THREE.MathUtils.damp(
          entry.doorPush,
          staffPushTarget,
          staffPushTarget > entry.doorPush ? 14 : 8,
          dt
        );

        if (stepDist > 0.0005 && (isMoving || entry.walkBlend > 0.04)) {
          entry.walkPhase += stepDist * 5.6;
          if (stepDist > 0.0008 && isMoving) {
            const targetAngle = Math.atan2(mdx, mdz);
            entry.facingRad = lerpAngle(entry.facingRad, targetAngle, Math.min(1, dt * 8.8));
          }
        }

        if (!isMoving) {
          if (s.role === 'receptionist') {
            entry.facingRad = lerpAngle(entry.facingRad, recSeatFacing, Math.min(1, dt * 8));
          } else {
            const watchPatient =
              curPatients.find((pt) => pt.state === 'in_treatment') ||
              curPatients.find((pt) => pt.state === 'ready_for_exam') ||
              curPatients.find((pt) => pt.state === 'waiting_checkin');
            if (watchPatient) {
              const wRig = patientRigs.get(watchPatient.id);
              const px = wRig ? wRig.visX : watchPatient.gridX + 0.5;
              const pz = wRig ? wRig.visZ : watchPatient.gridY + 0.5;
              const lookAng = Math.atan2(px - entry.visX, pz - entry.visZ);
              entry.facingRad = lerpAngle(entry.facingRad, lookAng, Math.min(1, dt * 6));
            }
          }
        }

        entry.rig.root.position.set(entry.visX, 0.02, entry.visZ);
        animateHumanoid3D(entry.rig, {
          pose: shouldStaffSit ? 'seated' : 'standing',
          walkPhase: entry.walkPhase,
          isMoving,
          walkBlend: entry.walkBlend,
          sitBlend: entry.sitBlend,
          doorPush: entry.doorPush,
          seatHeight: 0.42,
          facingRad: entry.facingRad,
          timeSec,
          isSelected: false,
        });
      }

      for (const [id, entry] of staffRigs.entries()) {
        if (!activeStaffIds.has(id)) {
          actorsLayer.remove(entry.rig.root);
          disposeHumanoid3D(entry.rig);
          staffRigs.delete(id);
        }
      }

      // Sync Natural Outdoor Garden-Lane & Courtyard Walkers (fewer crowd, zero indoor clutter)
      for (let wi = 0; wi < walkerRigs.length; wi++) {
        const w = walkerRigs[wi];
        if (w.path.length > 0) {
          const isFinal = w.path.length === 1;
          const activeWalkerIgnore = isFinal && w.seatedMode ? w.ignoreItemId : undefined;
          // Look-ahead smoothing: skip intermediate tile center when next-next waypoint has clear line of sight (never skip bench front approach)
          if (
            w.path.length >= 2 &&
            !(w.seatedMode && w.path.length === 2) &&
            hasContinuousLineOfSight(
              w.gx,
              w.gy,
              w.path[1].x,
              w.path[1].y,
              0.25,
              obstacles,
              undefined
            )
          ) {
            w.path.shift();
          }

          const nextNode = w.path[0];
          const isFinalNow = w.path.length === 1;
          const useLane = !(isFinalNow && w.seatedMode);
          const goalX = nextNode.x + (useLane ? w.subOffX * (isFinalNow ? 0.4 : 0.7) : 0);
          const goalY = nextNode.y + (useLane ? w.subOffZ * (isFinalNow ? 0.4 : 0.7) : 0);

          const dx = goalX - w.gx;
          const dy = goalY - w.gy;
          const dist = Math.hypot(dx, dy);

          // Personal-space repulsion vs other walkers, patients & staff (kept subtle near gates/benches)
          let avoidX = 0;
          let avoidY = 0;
          if (!(isFinalNow && w.seatedMode)) {
            for (let oj = 0; oj < walkerRigs.length; oj++) {
              if (wi === oj) continue;
              const other = walkerRigs[oj];
              const ox = w.gx - other.gx;
              const oy = w.gy - other.gy;
              const od = Math.hypot(ox, oy);
              if (od > 0.01 && od < 0.78) {
                const push = (0.78 - od) * 0.34;
                avoidX += (ox / od) * push;
                avoidY += (oy / od) * push;
              }
            }
            for (const pt of curPatients) {
              if (pt.state === 'in_treatment' || pt.state === 'ready_for_exam') continue;
              const ox = w.gx - pt.gridX;
              const oy = w.gy - pt.gridY;
              const od = Math.hypot(ox, oy);
              if (od > 0.01 && od < 0.72) {
                const push = (0.72 - od) * 0.34;
                avoidX += (ox / od) * push;
                avoidY += (oy / od) * push;
              }
            }
            for (const sr of staffRigs.values()) {
              const ox = w.gx - sr.gx;
              const oy = w.gy - sr.gy;
              const od = Math.hypot(ox, oy);
              if (od > 0.01 && od < 0.7) {
                const push = (0.7 - od) * 0.3;
                avoidX += (ox / od) * push;
                avoidY += (oy / od) * push;
              }
            }
          }

          const step = w.speed * dt;
          if (!isFinalNow && dist <= 0.3) {
            w.path.shift();
          } else if (dist <= Math.max(0.08, step)) {
            const res = resolveTileStep(w.gx, w.gy, goalX, goalY, 0.22, obstacles, activeWalkerIgnore);
            w.gx = res.x;
            w.gy = res.y;
            w.path.shift();
            w.stuckTimer = 0;
          } else {
            const steerX = dx / dist + avoidX;
            const steerY = dy / dist + avoidY;
            const steerLen = Math.hypot(steerX, steerY) || 1;
            const candX = w.gx + (steerX / steerLen) * step;
            const candY = w.gy + (steerY / steerLen) * step;
            const res = resolveTileStep(w.gx, w.gy, candX, candY, 0.22, obstacles, activeWalkerIgnore);
            const movedDist = Math.hypot(res.x - w.gx, res.y - w.gy);
            w.gx = res.x;
            w.gy = res.y;
            if (res.blocked && movedDist < step * 0.24) {
              w.stuckTimer += dt;
              if (w.stuckTimer > 0.22) {
                const dest = w.path[w.path.length - 1];
                const rerouted = dest
                  ? findGridPath(
                      w.gx,
                      w.gy,
                      dest.x,
                      dest.y,
                      curRooms,
                      curItems,
                      walkerFootprints,
                      obstacles,
                      w.seatedMode ? w.ignoreItemId : undefined
                    )
                  : [];
                w.path = rerouted;
                if (rerouted.length === 0) {
                  w.seatedMode = false;
                  w.seatKey = undefined;
                  w.ignoreItemId = undefined;
                  w.pauseTimer = 0.2;
                }
                w.stuckTimer = 0;
              }
            } else {
              w.stuckTimer = 0;
            }
          }
        } else {
          w.pauseTimer -= dt;
          if (w.pauseTimer <= 0) {
            const prevApproachX = w.seatApproachX;
            const prevApproachY = w.seatApproachY;
            const wasSeated = Boolean(w.seatedMode);

            w.seatedMode = false;
            w.seatKey = undefined;
            w.seatApproachX = undefined;
            w.seatApproachY = undefined;
            w.seatOffX = undefined;
            w.seatOffZ = undefined;
            w.seatFacingRad = undefined;
            w.seatHeight = undefined;
            w.ignoreItemId = undefined;
            w.stuckTimer = 0;
            w.subOffX = (Math.random() - 0.5) * 0.32;
            w.subOffZ = (Math.random() - 0.5) * 0.32;

            // Step cleanly off any previous bench before walking across the courtyard
            let startWalkX = w.gx;
            let startWalkY = w.gy;
            const prefix: Array<{ x: number; y: number }> = [];
            if (wasSeated || !isTileWalkable(startWalkX, startWalkY, 0.21, obstacles)) {
              const stepOut =
                prevApproachX !== undefined &&
                prevApproachY !== undefined &&
                isTileWalkable(prevApproachX, prevApproachY, 0.21, obstacles)
                  ? { x: prevApproachX, y: prevApproachY }
                  : findNearestWalkableTile(startWalkX, startWalkY, 0.22, obstacles);
              if (Math.hypot(stepOut.x - startWalkX, stepOut.y - startWalkY) > 0.08) {
                prefix.push(stepOut);
                startWalkX = stepOut.x;
                startWalkY = stepOut.y;
              }
            }

            let assignedPath = false;

            if (w.kind === 'visitor' && Math.random() < 0.32) {
              const benchSlots = buildWaitSeatSlots(curItems, curRooms).filter(
                (s) =>
                  s.catalogId === 'park_bench' &&
                  isTileWalkable(s.approachTileX, s.approachTileY, 0.21, obstacles)
              );
              const isSeatOccupied = (key: string) =>
                curPatients.some((pt) => pt.waitingSeatKey === key) ||
                walkerRigs.some((ow, oidx) => oidx !== wi && ow.seatedMode && ow.seatKey === key);

              const freeBenches = benchSlots.filter((s) => !isSeatOccupied(s.seatKey));
              if (freeBenches.length > 0) {
                const chosen = freeBenches[Math.floor(Math.random() * freeBenches.length)];
                const toFront = findGridPath(
                  startWalkX,
                  startWalkY,
                  chosen.approachTileX,
                  chosen.approachTileY,
                  curRooms,
                  curItems,
                  walkerFootprints,
                  obstacles
                );
                if (
                  toFront.length > 0 ||
                  Math.hypot(chosen.approachTileX - startWalkX, chosen.approachTileY - startWalkY) < 0.8
                ) {
                  w.ignoreItemId = chosen.itemId;
                  w.seatedMode = true;
                  w.seatKey = chosen.seatKey;
                  w.seatApproachX = chosen.approachTileX;
                  w.seatApproachY = chosen.approachTileY;
                  w.seatHeight = chosen.seatHeight;
                  w.seatOffX = 0;
                  w.seatOffZ = 0;
                  w.seatFacingRad = chosen.facingRad;
                  w.pauseTimer = 3.2 + Math.random() * 2.2;
                  w.path = [...prefix, ...toFront, { x: chosen.seatTileX, y: chosen.seatTileY }];
                  assignedPath = true;
                }
              }
            }

            if (!assignedPath) {
              for (let attempt = 0; attempt < 12; attempt++) {
                let destX = w.gx;
                let destY = w.gy;
                if (w.kind === 'promenade') {
                  if (Math.random() < 0.72) {
                    destX = 27.4 + Math.random() * 7.8;
                    destY = 2.0 + Math.random() * 21.0;
                  } else {
                    destX = 4.0 + Math.random() * 26.0;
                    destY = 23.0 + Math.random() * 2.2;
                  }
                } else {
                  if (Math.random() < 0.6) {
                    destX = 22.3 + Math.random() * 3.8;
                    destY = 4.2 + Math.random() * 15.2;
                    if (destX >= 23.6 && destX <= 26.2 && destY >= 6.6 && destY <= 9.4) destX = 22.6;
                  } else {
                    destX = 27.5 + Math.random() * 6.8;
                    destY = 2.5 + Math.random() * 20.0;
                  }
                }
                const goalTileX = Math.round(destX);
                const goalTileY = Math.round(destY);
                if (!isTileWalkable(goalTileX, goalTileY, 0.25, obstacles)) continue;
                if (Math.hypot(goalTileX - startWalkX, goalTileY - startWalkY) <= 1.2) continue;

                const candPath = findGridPath(
                  startWalkX,
                  startWalkY,
                  goalTileX,
                  goalTileY,
                  curRooms,
                  curItems,
                  walkerFootprints,
                  obstacles
                );
                if (candPath.length > 0) {
                  w.path = [...prefix, ...candPath];
                  if (Math.random() < 0.45) {
                    w.subOffX = destX - goalTileX;
                    w.subOffZ = destY - goalTileY;
                  }
                  w.pauseTimer =
                    w.kind === 'promenade'
                      ? 0.8 + Math.random() * 1.6
                      : 1.0 + Math.random() * 1.8;
                  assignedPath = true;
                  break;
                }
              }
              if (!assignedPath) {
                if (prefix.length > 0) w.path = prefix;
                w.pauseTimer = 0.25;
              }
            }
          }
        }

        const atSeatTarget = w.path.length === 0 && Boolean(w.seatedMode);
        const targetX = w.gx + 0.5;
        const targetZ = w.gy + 0.5;
        const prevVisX = w.visX;
        const prevVisZ = w.visZ;
        // w.gx/w.gy already integrates smoothly at 60fps via resolveTileStep — mirror directly with zero corner-lag
        w.visX = targetX;
        w.visZ = targetZ;

        const mdx = w.visX - prevVisX;
        const mdz = w.visZ - prevVisZ;
        const invDt = dt > 0.0001 ? 1 / dt : 60;
        w.vx = mdx * invDt;
        w.vz = mdz * invDt;
        const stepDist = Math.hypot(mdx, mdz);
        const realSpeed = stepDist * invDt;
        const distRem = Math.hypot(targetX - w.visX, targetZ - w.visZ);
        const logicalMoving = w.path.length > 0 || distRem > 0.06;
        const isMoving = realSpeed > 0.12 || (logicalMoving && stepDist > 0.0018);

        const readyWalkerSeat = atSeatTarget && distRem < 0.14;
        const walkerFacingOk =
          w.seatFacingRad === undefined || angleDiffAbs(w.facingRad, w.seatFacingRad) < 0.65;
        const shouldSit = readyWalkerSeat && (walkerFacingOk || w.sitBlend > 0.3);
        w.walkBlend = THREE.MathUtils.damp(w.walkBlend, isMoving ? 1 : 0, 12.0, dt);
        w.sitBlend = THREE.MathUtils.damp(w.sitBlend, shouldSit ? 1 : 0, 8.0, dt);

        const wPushTarget = computeDoorPushTarget(
          w.visX,
          w.visZ,
          w.vx,
          w.vz,
          isMoving && !w.seatedMode,
          worldDoors,
          unlockedSet
        );
        w.doorPush = THREE.MathUtils.damp(w.doorPush, wPushTarget, wPushTarget > w.doorPush ? 14 : 8, dt);

        if (stepDist > 0.0005 && (isMoving || w.walkBlend > 0.04)) {
          w.walkPhase += stepDist * 5.6;
          if (stepDist > 0.0008 && isMoving && !(w.seatedMode && distRem < 0.2)) {
            w.facingRad = lerpAngle(w.facingRad, Math.atan2(mdx, mdz), Math.min(1, dt * 8.2));
          }
        }
        if ((!isMoving || (atSeatTarget && distRem < 0.24)) && w.seatedMode && w.seatFacingRad !== undefined) {
          w.facingRad = lerpAngle(w.facingRad, w.seatFacingRad, Math.min(1, dt * 11));
        }

        w.rig.root.position.set(w.visX, 0.02, w.visZ);
        animateHumanoid3D(w.rig, {
          pose: shouldSit ? 'seated' : 'standing',
          walkPhase: w.walkPhase,
          isMoving,
          walkBlend: w.walkBlend,
          sitBlend: w.sitBlend,
          doorPush: w.doorPush,
          seatHeight: w.seatHeight ?? 0.396,
          facingRad: w.facingRad,
          timeSec,
          isSelected: false,
        });
      }
    };

    const drawOverlayBadges = (timeMs: number) => {
      const overlay = overlayCanvasRef.current;
      if (!overlay) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w < 1 || h < 1) return;

      const odpr = Math.min(window.devicePixelRatio || 1, 1.5);
      if (overlay.width !== Math.floor(w * odpr) || overlay.height !== Math.floor(h * odpr)) {
        overlay.width = Math.floor(w * odpr);
        overlay.height = Math.floor(h * odpr);
      }

      const ctx = overlay.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(odpr, 0, 0, odpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const {
        rooms: curRooms,
        patients: curPatients,
        placedItems: curItems,
        placementDraft: curDraft,
        editMode: isEdit,
        floatingFeedbacks: fbs,
        focusedPatientId: focId,
        language: lang,
        isPlacementValid: checkValid,
      } = latestRef.current;

      const projectToScreen = (wx: number, wy: number, wz: number) => {
        _projVec.set(wx, wy, wz).project(camera);
        return {
          x: (_projVec.x * 0.5 + 0.5) * w,
          y: (-_projVec.y * 0.5 + 0.5) * h,
        };
      };

      // 0. Placement or Edit-Mode Floor Grid Guide (Clean grid + footprint outlines, zero pencils!)
      if ((curDraft || isEdit) && !focId) {
        ctx.save();
        ctx.lineWidth = 1;
        ctx.strokeStyle = curDraft ? 'rgba(14, 165, 233, 0.28)' : 'rgba(56, 189, 248, 0.16)';
        const isSolarDraft = Boolean(
          curDraft && (curDraft.catalogItem.isSolarPanel || curDraft.catalogItem.id === 'solar_panel')
        );
        const allowIn = curDraft ? curDraft.catalogItem.indoorAllowed !== false : true;
        const allowOut = curDraft ? curDraft.catalogItem.outdoorAllowed !== false && !isSolarDraft : true;
        const showSolarGrid = isSolarDraft || (!curDraft && isEdit);

        if (allowIn) {
          for (const room of curRooms) {
            if (!room.unlocked) continue;
            for (let gx = room.minX; gx <= room.maxX + 1; gx++) {
              const p1 = projectToScreen(gx, 0.09, room.minY);
              const p2 = projectToScreen(gx, 0.09, room.maxY + 1);
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();
            }
            for (let gz = room.minY; gz <= room.maxY + 1; gz++) {
              const p1 = projectToScreen(room.minX, 0.09, gz);
              const p2 = projectToScreen(room.maxX + 1, 0.09, gz);
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();
            }
          }
        }
        if (allowOut) {
          const allowSidewalkGrid =
            curDraft &&
            (curDraft.catalogItem.sprite === 'street_lamp_post' ||
              curDraft.catalogItem.sprite === 'garden_lamp' ||
              curDraft.catalogItem.sprite === 'garden_spot_lamp');
          const maxOutX = allowSidewalkGrid ? 30 : 28;
          ctx.strokeStyle = curDraft ? 'rgba(16, 185, 129, 0.32)' : 'rgba(16, 185, 129, 0.18)';

          const drawGridRect = (x0: number, x1: number, z0: number, z1: number) => {
            for (let gx = x0; gx <= x1; gx++) {
              const p1 = projectToScreen(gx, 0.09, z0);
              const p2 = projectToScreen(gx, 0.09, z1);
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();
            }
            for (let gz = z0; gz <= z1; gz++) {
              const p1 = projectToScreen(x0, 0.09, gz);
              const p2 = projectToScreen(x1, 0.09, gz);
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();
            }
          };

          // Courtyard & Promenade
          drawGridRect(22, maxOutX, 2, 22);
          // South Garden Lawn
          drawGridRect(0, 28, 22, 27);
          // West Perimeter Lawn (flanking the pushed-back Rear West Solar Zone x:-6..-2, z:6..19; keep conduit z:12..14 clear)
          drawGridRect(-1, 2, 0, 12);
          drawGridRect(-1, 2, 14, 27);
          // North Rear Perimeter Lawn (including former North-East solar lawn, clear of Villa)
          drawGridRect(0, 27, 0, 2);
          drawGridRect(0, 4, -2, 0);
          drawGridRect(11, 27, -2, 0);
          drawGridRect(11, 22, -4, -2);
        }
        if (showSolarGrid) {
          ctx.strokeStyle = isSolarDraft
            ? 'rgba(16, 185, 129, 0.38)'
            : 'rgba(16, 185, 129, 0.22)';
          for (let gx = SOLAR_ZONE.minX; gx <= SOLAR_ZONE.maxX + 1; gx++) {
            const p1 = projectToScreen(gx, 0.09, SOLAR_ZONE.minY);
            const p2 = projectToScreen(gx, 0.09, SOLAR_ZONE.maxY + 1);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
          for (let gz = SOLAR_ZONE.minY; gz <= SOLAR_ZONE.maxY + 1; gz++) {
            const p1 = projectToScreen(SOLAR_ZONE.minX, 0.09, gz);
            const p2 = projectToScreen(SOLAR_ZONE.maxX + 1, 0.09, gz);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }

        if (curDraft) {
          // Crisp highlighted footprint outline under active placement tile (or wall-mount line for wall decor)
          const effW = curDraft.rotation % 2 === 0 ? curDraft.catalogItem.width : curDraft.catalogItem.depth;
          const effD = curDraft.rotation % 2 === 0 ? curDraft.catalogItem.depth : curDraft.catalogItem.width;
          const valid = checkValid(curDraft.hoverX, curDraft.hoverY, curDraft);
          ctx.strokeStyle = valid ? '#10b981' : '#ef4444';
          ctx.lineWidth = 2.6;

          const c1 = projectToScreen(curDraft.hoverX, 0.12, curDraft.hoverY);
          const c2 = projectToScreen(curDraft.hoverX + effW, 0.12, curDraft.hoverY);
          const c3 = projectToScreen(curDraft.hoverX + effW, 0.12, curDraft.hoverY + effD);
          const c4 = projectToScreen(curDraft.hoverX, 0.12, curDraft.hoverY + effD);
          ctx.beginPath();
          ctx.moveTo(c1.x, c1.y);
          ctx.lineTo(c2.x, c2.y);
          ctx.lineTo(c3.x, c3.y);
          ctx.lineTo(c4.x, c4.y);
          ctx.closePath();
          ctx.stroke();

          if (curDraft.catalogItem.isWallDecor) {
            const xA =
              curDraft.rotation === 2 ? curDraft.hoverX + 1 : curDraft.hoverX;
            const zA =
              curDraft.rotation === 3 ? curDraft.hoverY + 1 : curDraft.hoverY;
            const xB =
              curDraft.rotation === 1 || curDraft.rotation === 3 ? curDraft.hoverX + 1 : xA;
            const zB =
              curDraft.rotation === 0 || curDraft.rotation === 2 ? curDraft.hoverY + 1 : zA;
            const w1 = projectToScreen(xA, 0.16, zA);
            const w2 = projectToScreen(xB, 0.16, zB);
            const w3 = projectToScreen(xB, 1.75, zB);
            const w4 = projectToScreen(xA, 1.75, zA);
            ctx.fillStyle = valid ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.18)';
            ctx.lineWidth = 3.2;
            ctx.beginPath();
            ctx.moveTo(w1.x, w1.y);
            ctx.lineTo(w2.x, w2.y);
            ctx.lineTo(w3.x, w3.y);
            ctx.lineTo(w4.x, w4.y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      // 1. Locked Wing Badges
      for (const room of curRooms) {
        if (room.unlocked) continue;
        const cx = (room.minX + room.maxX + 1) / 2;
        const cz = (room.minY + room.maxY + 1) / 2;
        const sp = projectToScreen(cx, 1.85, cz);

        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(sp.x - 52, sp.y - 20, 104, 40, 12);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fbbf24';
        ctx.font = '800 13px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`🔒 ${room.unlockCost}`, sp.x, sp.y - 4);

        ctx.fillStyle = '#e2e8f0';
        ctx.font = '700 10px "Cairo", sans-serif';
        ctx.fillText(lang === 'ar' ? 'اضغط للفتح' : 'Tap to Open', sp.x, sp.y + 11);
        ctx.restore();
      }

      // 2. Patient Floating Status Cards (?, Rx, Active Therapy Progress Ring, ✓)
      if (!focId) {
        const pulse = Math.sin(timeMs * 0.0055) * 3;
        for (const p of curPatients) {
          const entry = patientRigs.get(p.id);
          const wx = entry ? entry.rig.root.position.x : p.gridX + 0.5;
          const wz = entry ? entry.rig.root.position.z : p.gridY + 0.5;
          const sp = projectToScreen(wx, 1.62, wz);

          if (p.state === 'in_treatment') {
            const pct = Math.max(0, Math.min(1, p.treatmentProgress || 0));
            ctx.save();
            ctx.translate(sp.x, sp.y);
            ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
            ctx.beginPath();
            ctx.arc(0, 0, 17, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(0, 0, 13, 0, Math.PI * 2);
            ctx.stroke();

            ctx.strokeStyle = '#38bdf8';
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(0, 0, 13, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.font = '800 9px "Plus Jakarta Sans", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${Math.round(pct * 100)}%`, 0, 0.5);
            ctx.restore();
            continue;
          }

          const badgeType =
            p.state === 'waiting_checkin'
              ? 'checkin'
              : p.state === 'ready_for_exam'
                ? 'ready'
                : p.state === 'treated_leaving'
                  ? 'treated'
                  : null;
          if (!badgeType) continue;

          ctx.save();
          ctx.translate(sp.x, sp.y + pulse);
          if (badgeType === 'checkin') {
            const vas = p.clinicalCase.vasPain;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(-27, -15, 54, 24, 10);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#d97706';
            ctx.font = '900 11px "Plus Jakarta Sans", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`? VAS ${vas}`, 0, -3);
          } else {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
            ctx.strokeStyle = badgeType === 'ready' ? '#0284c7' : '#10b981';
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.roundRect(-16, -15, 32, 24, 9);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = ctx.strokeStyle;
            ctx.font = '900 12px "Plus Jakarta Sans", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(badgeType === 'ready' ? 'Rx' : '✓', 0, -3);
          }
          ctx.restore();
        }
      }

      // 3. Sleek Edit-Mode Floor Base Outlines (zero floating pencil clutter!)
      if (isEdit && !curDraft) {
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
        ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
        ctx.lineWidth = 1.6;
        for (const item of curItems) {
          const cat = latestRef.current.catalogMap.get(item.catalogId);
          if (!cat) continue;
          const effW = item.rotation % 2 === 0 ? cat.width : cat.depth;
          const effD = item.rotation % 2 === 0 ? cat.depth : cat.width;
          const c1 = projectToScreen(item.gridX + 0.06, 0.1, item.gridY + 0.06);
          const c2 = projectToScreen(item.gridX + effW - 0.06, 0.1, item.gridY + 0.06);
          const c3 = projectToScreen(item.gridX + effW - 0.06, 0.1, item.gridY + effD - 0.06);
          const c4 = projectToScreen(item.gridX + 0.06, 0.1, item.gridY + effD - 0.06);
          ctx.beginPath();
          ctx.moveTo(c1.x, c1.y);
          ctx.lineTo(c2.x, c2.y);
          ctx.lineTo(c3.x, c3.y);
          ctx.lineTo(c4.x, c4.y);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      }

      // 3b. Selected Outer Tree Highlight Ring (for removal confirmation)
      const selTreeId = latestRef.current.selectedTreeId;
      if (selTreeId) {
        const tree = WORLD_TREES.find((t) => t.id === selTreeId);
        if (tree) {
          ctx.save();
          const segs = 24;
          const r =
            tree.species === 'cypress'
              ? 0.92 * tree.scale
              : tree.species === 'acacia'
                ? 1.55 * tree.scale
                : 1.28 * tree.scale;
          ctx.strokeStyle = '#f59e0b';
          ctx.fillStyle = 'rgba(245, 158, 11, 0.16)';
          ctx.lineWidth = 2.6;
          ctx.beginPath();
          for (let i = 0; i <= segs; i++) {
            const ang = (i / segs) * Math.PI * 2;
            const pt = projectToScreen(tree.x + Math.cos(ang) * r, 0.12, tree.z + Math.sin(ang) * r);
            if (i === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }

      // 4. Floating Coins/Stars Feedbacks
      const now = Date.now();
      for (const fb of fbs) {
        const age = (now - fb.createdAt) / 1600;
        if (age < 0 || age > 1) continue;
        const sp = projectToScreen(fb.gridX + 0.5, 1.88 + age * 0.95, fb.gridY + 0.5);
        ctx.save();
        ctx.globalAlpha = 1 - age;
        ctx.font = '900 14px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#0f172a';
        ctx.fillText(fb.text, sp.x + 1, sp.y + 1);
        ctx.fillStyle = fb.color;
        ctx.fillText(fb.text, sp.x, sp.y);
        ctx.restore();
      }
    };

    let lastShowItemMicro = true;
    const tick = () => {
      if (disposed) return;
      const nowMs = performance.now();
      const dt = Math.min(0.08, Math.max(0.001, (nowMs - lastMs) / 1000));
      lastMs = nowMs;

      const cs = camStateRef.current;
      cs.curX = THREE.MathUtils.damp(cs.curX, cs.targetX, 9, dt);
      cs.curZ = THREE.MathUtils.damp(cs.curZ, cs.targetZ, 9, dt);
      cs.curZoom = THREE.MathUtils.damp(cs.curZoom, cs.targetZoom, 9, dt);
      cs.curYaw = THREE.MathUtils.damp(cs.curYaw, cs.targetYaw, 8, dt);
      updateCameraTransform();

      // Living world subtle animations & zoom-out LOD culling
      const tSec = nowMs * 0.001;
      if (worldHandle) {
        worldHandle.waterMesh.position.y = 0.16 + Math.sin(tSec * 3.2) * 0.009;
        worldHandle.setZoomLod(cs.curZoom);
      }

      const showItemMicro = cs.curZoom >= 0.98;
      if (showItemMicro !== lastShowItemMicro) {
        lastShowItemMicro = showItemMicro;
        itemsLayer.traverse((obj) => {
          if (obj.userData.lodMicro) {
            obj.visible = showItemMicro;
          }
        });
      }

      if (hasPlacedDisplayKiosk || hasDraftDisplayKiosk) {
        textures.updateReceptionScreen(tSec);
      }

      syncAndAnimateActors(tSec, dt);
      updateAtmosphereAndLights(tSec, dt);

      // Velocity- & proximity-driven clinic doors (manual push interior doors + automatic entrance doors)
      if (worldHandle) {
        doorActorsScratch.length = 0;
        for (const entry of patientRigs.values()) {
          doorActorsScratch.push({
            x: entry.visX,
            z: entry.visZ,
            vx: entry.vx,
            vz: entry.vz,
            isMoving: entry.walkBlend > 0.15 && entry.sitBlend < 0.4,
          });
        }
        for (const entry of staffRigs.values()) {
          doorActorsScratch.push({
            x: entry.visX,
            z: entry.visZ,
            vx: entry.vx,
            vz: entry.vz,
            isMoving: entry.walkBlend > 0.15 && entry.sitBlend < 0.4,
          });
        }
        for (const w of walkerRigs) {
          doorActorsScratch.push({
            x: w.visX,
            z: w.visZ,
            vx: w.vx,
            vz: w.vz,
            isMoving: w.walkBlend > 0.15 && w.sitBlend < 0.4,
          });
        }
        const unlockedSet = new Set(
          latestRef.current.rooms.filter((r) => r.unlocked).map((r) => r.id)
        );
        updateDoors3D(worldHandle.doors, doorActorsScratch, unlockedSet, dt);
      }

      renderer.render(scene, camera);
      drawOverlayBadges(nowMs);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        rafId = requestAnimationFrame(tick);
      }
    };

    updateCameraTransform();
    tick();

    return () => {
      disposed = true;
      unsubGlb();
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      sceneHooksRef.current = null;

      if (worldHandle) worldHandle.dispose();
      for (const entry of itemMeshes.values()) disposeObject3D(entry.mesh);
      itemMeshes.clear();
      if (draftGhost) disposeObject3D(draftGhost);
      draftPadMesh.geometry.dispose();
      draftPadMat.dispose();
      for (const entry of patientRigs.values()) disposeHumanoid3D(entry.rig);
      patientRigs.clear();
      for (const entry of staffRigs.values()) disposeHumanoid3D(entry.rig);
      staffRigs.clear();
      for (const w of walkerRigs) disposeHumanoid3D(w.rig);
      walkerRigs.length = 0;

      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      envTarget.dispose();
      textures.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const removedTreeKey = (removedTreeIds || []).join(',');
  useEffect(() => {
    sceneHooksRef.current?.rebuildWorld(rooms, removedTreeIds);
  }, [rooms, removedTreeKey]);

  useEffect(() => {
    sceneHooksRef.current?.syncItems(placedItems, placementDraft?.movingInstanceId);
  }, [placedItems, placementDraft?.movingInstanceId]);

  useEffect(() => {
    sceneHooksRef.current?.syncDraft(placementDraft);
  }, [placementDraft]);

  const dragRef = useRef({
    active: false,
    moved: false,
    draggingDraft: false,
    startX: 0,
    startY: 0,
    camStartX: 0,
    camStartZ: 0,
  });
  const longPressTimerRef = useRef<number | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ dist: number; startZoom: number } | null>(null);

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const findHitItemAt = (gx: number, gy: number): PlacedItem | undefined =>
    placedItems.find((item) => {
      const cat = catalogMap.get(item.catalogId);
      if (!cat) return false;
      const ew = item.rotation % 2 === 0 ? cat.width : cat.depth;
      const ed = item.rotation % 2 === 0 ? cat.depth : cat.width;
      return gx >= item.gridX && gx < item.gridX + ew && gy >= item.gridY && gy < item.gridY + ed;
    });

  const resolveDraftTarget = (
    rawX: number,
    rawZ: number,
    gx: number,
    gy: number,
    draft: PlacementDraft
  ): { gx: number; gy: number; rotation: 0 | 1 | 2 | 3 } => {
    if (draft.catalogItem.isWallDecor) {
      const snapped = snapToNearestValidWallSlot(rawX, rawZ, draft.rotation, rooms);
      if (snapped) return snapped;
    }
    if (draft.catalogItem.isSolarPanel || draft.catalogItem.id === 'solar_panel') {
      const effW = draft.rotation % 2 === 0 ? draft.catalogItem.width : draft.catalogItem.depth;
      const effD = draft.rotation % 2 === 0 ? draft.catalogItem.depth : draft.catalogItem.width;
      const clamped = clampToSolarZone(gx, gy, effW, effD);
      return { gx: clamped.gx, gy: clamped.gy, rotation: draft.rotation };
    }
    return { gx, gy, rotation: draft.rotation };
  };

  const handleTap = (clientX: number, clientY: number) => {
    const hooks = sceneHooksRef.current;
    if (!hooks) return;
    const { gx, gy, rawX, rawZ } = hooks.screenToGrid(clientX, clientY);

    if (placementDraft) {
      const resolved = resolveDraftTarget(rawX, rawZ, gx, gy, placementDraft);
      const nextDraft = {
        ...placementDraft,
        hoverX: resolved.gx,
        hoverY: resolved.gy,
        rotation: resolved.rotation,
      };
      onUpdatePlacementHover(resolved.gx, resolved.gy, resolved.rotation);
      if (isPlacementValid(resolved.gx, resolved.gy, nextDraft)) {
        onConfirmPlacement(resolved.gx, resolved.gy, resolved.rotation);
      }
      return;
    }

    const directPatient = hooks.hitTestPatient(clientX, clientY);
    if (directPatient) {
      onTapPatient(directPatient);
      return;
    }

    const treeHit = hooks.hitTestWorldTreeDetail(clientX, clientY);
    const itemHit = hooks.hitTestPlacedItemDetail(clientX, clientY);
    const lockedRoomHit = hooks.hitTestLockedRoomDetail(clientX, clientY);
    const groundDistSq = hooks.getRayGroundDistSq(rawX, rawZ);

    const tappedRoom =
      lockedRoomHit?.room ||
      rooms.find((r) => gx >= r.minX && gx <= r.maxX && gy >= r.minY && gy <= r.maxY);

    // Prioritize an outdoor wild tree whenever its 3D trunk/canopy is hit closer to the camera
    // than any placed item or locked wing behind it.
    if (treeHit) {
      const lockedDistSq = lockedRoomHit
        ? lockedRoomHit.distSq
        : tappedRoom && !tappedRoom.unlocked
          ? groundDistSq
          : Infinity;
      const itemDistSq = itemHit ? itemHit.distSq : Infinity;
      if (treeHit.distSq <= itemDistSq + 0.35 && treeHit.distSq <= lockedDistSq + 0.35) {
        onTapWorldTree?.(treeHit.tree);
        return;
      }
    }

    if (tappedRoom && !tappedRoom.unlocked) {
      onTapLockedRoom(tappedRoom);
      return;
    }

    // Fallback ground proximity check for patients only after tree & locked room checks
    let nearPatient: PatientEntity | null = null;
    let bestDist = 1.05;
    for (const p of patients) {
      const d = Math.hypot(p.gridX + 0.5 - rawX, p.gridY + 0.5 - rawZ);
      if (d < bestDist) {
        bestDist = d;
        nearPatient = p;
      }
    }
    if (nearPatient) {
      onTapPatient(nearPatient);
      return;
    }

    const hitItem = itemHit?.item || findHitItemAt(gx, gy);

    if (editMode) {
      if (hitItem) {
        onTapPlacedItem(hitItem);
        return;
      }
      if (treeHit) {
        onTapWorldTree?.(treeHit.tree);
      }
      return;
    }

    // Smart context action: tapping reception desk checks in waiting patient or opens staff hire
    if (hitItem && hitItem.catalogId === 'reception_desk') {
      onTapReceptionDesk?.();
    } else if (hitItem) {
      onInspectItem?.(hitItem);
    } else if (treeHit) {
      onTapWorldTree?.(treeHit.tree);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (focusedPatientId) return;
    clearLongPress();
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      pinchRef.current = { dist: Math.max(10, dist), startZoom: zoomUiRef.current };
      dragRef.current.active = false;
      dragRef.current.draggingDraft = false;
      dragRef.current.moved = true;
      return;
    }

    const hooks = sceneHooksRef.current;
    let grabbingDraft = false;
    if (placementDraft && hooks) {
      const { gx, gy } = hooks.screenToGrid(e.clientX, e.clientY);
      const effW = placementDraft.rotation % 2 === 0 ? placementDraft.catalogItem.width : placementDraft.catalogItem.depth;
      const effD = placementDraft.rotation % 2 === 0 ? placementDraft.catalogItem.depth : placementDraft.catalogItem.width;
      if (
        hooks.hitTestDraftGhost(e.clientX, e.clientY) ||
        (gx >= placementDraft.hoverX - 0.5 &&
          gx <= placementDraft.hoverX + effW + 0.5 &&
          gy >= placementDraft.hoverY - 0.5 &&
          gy <= placementDraft.hoverY + effD + 0.5)
      ) {
        grabbingDraft = true;
      }
    } else if (!placementDraft && hooks && onLongPressPlacedItem) {
      const { gx, gy } = hooks.screenToGrid(e.clientX, e.clientY);
      const hitItem = hooks.hitTestPlacedItem(e.clientX, e.clientY) || findHitItemAt(gx, gy);
      if (hitItem) {
        longPressTimerRef.current = window.setTimeout(() => {
          dragRef.current.active = false;
          dragRef.current.moved = true;
          latestRef.current.onLongPressPlacedItem?.(hitItem);
        }, 320);
      }
    }

    dragRef.current = {
      active: true,
      moved: false,
      draggingDraft: grabbingDraft,
      startX: e.clientX,
      startY: e.clientY,
      camStartX: camStateRef.current.targetX,
      camStartZ: camStateRef.current.targetZ,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (pointersRef.current.size === 2 && pinchRef.current) {
      clearLongPress();
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const ratio = dist / pinchRef.current.dist;
      const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinchRef.current.startZoom * ratio));
      setZoomUi(nextZoom);
      camStateRef.current.targetZoom = nextZoom;
      return;
    }

    const hooks = sceneHooksRef.current;
    if (placementDraft && !dragRef.current.active && hooks) {
      const { gx, gy, rawX, rawZ } = hooks.screenToGrid(e.clientX, e.clientY);
      const resolved = resolveDraftTarget(rawX, rawZ, gx, gy, placementDraft);
      if (
        resolved.gx !== placementDraft.hoverX ||
        resolved.gy !== placementDraft.hoverY ||
        resolved.rotation !== placementDraft.rotation
      ) {
        onUpdatePlacementHover(resolved.gx, resolved.gy, resolved.rotation);
      }
    }

    if (!dragRef.current.active || !hooks) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.hypot(dx, dy) > 11) {
      clearLongPress();
      dragRef.current.moved = true;
    }

    if (dragRef.current.draggingDraft && placementDraft) {
      const { gx, gy, rawX, rawZ } = hooks.screenToGrid(e.clientX, e.clientY);
      const resolved = resolveDraftTarget(rawX, rawZ, gx, gy, placementDraft);
      if (
        resolved.gx !== placementDraft.hoverX ||
        resolved.gy !== placementDraft.hoverY ||
        resolved.rotation !== placementDraft.rotation
      ) {
        onUpdatePlacementHover(resolved.gx, resolved.gy, resolved.rotation);
      }
      return;
    }

    if (dragRef.current.moved) {
      const { right, forward, scale } = hooks.getPanVectors();
      const moveX = -dx * scale * right.x + dy * scale * 1.65 * forward.x;
      const moveZ = -dx * scale * right.z + dy * scale * 1.65 * forward.z;
      camStateRef.current.targetX = Math.max(PAN_MIN_X, Math.min(PAN_MAX_X, dragRef.current.camStartX + moveX));
      camStateRef.current.targetZ = Math.max(PAN_MIN_Z, Math.min(PAN_MAX_Z, dragRef.current.camStartZ + moveZ));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    clearLongPress();
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) {
      pinchRef.current = null;
    }
    if (!dragRef.current.active) return;
    const wasTap = !dragRef.current.moved;
    const wasDraggingDraft = dragRef.current.draggingDraft;
    dragRef.current.active = false;
    dragRef.current.draggingDraft = false;
    if (wasTap) {
      handleTap(e.clientX, e.clientY);
    } else if (wasDraggingDraft && placementDraft && isPlacementValid(placementDraft.hoverX, placementDraft.hoverY, placementDraft)) {
      // Effortless drag-and-drop: releasing over a valid tile keeps it positioned cleanly
      onUpdatePlacementHover(placementDraft.hoverX, placementDraft.hoverY, placementDraft.rotation);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (focusedPatientId) return;
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomUi - e.deltaY * 0.0008));
    setZoomUi(nextZoom);
    camStateRef.current.targetZoom = nextZoom;
  };

  const draftValid = placementDraft
    ? isPlacementValid(placementDraft.hoverX, placementDraft.hoverY, placementDraft)
    : false;

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={(e) => {
          clearLongPress();
          pointersRef.current.delete(e.pointerId);
          pinchRef.current = null;
          dragRef.current.active = false;
          dragRef.current.draggingDraft = false;
        }}
        onWheel={handleWheel}
        className={`relative w-full h-full touch-none transition-transform duration-300 ${
          isBlurred ? 'scale-[1.03]' : ''
        }`}
      >
        <div ref={mountRef} className="w-full h-full" />
        <canvas
          ref={overlayCanvasRef}
          className="pointer-events-none absolute inset-0 w-full h-full"
        />
        {isBlurred && (
          <div className="pointer-events-none absolute inset-0 bg-slate-950/50 transition-opacity duration-300" />
        )}
      </div>

      {/* Minimal 2-Button Corner Camera Controls (safely above Store button) */}
      {!focusedPatientId && (
        <div className="absolute left-3.5 bottom-20 z-20 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setLocalOrbit((o) => o + 1)}
            aria-label="Rotate clinic view"
            title={language === 'ar' ? 'تدوير الكاميرا 90°' : 'Rotate View 90°'}
            className="w-11 h-11 rounded-2xl bg-slate-900/80 hover:bg-slate-900 text-sky-300 font-bold text-lg border border-white/15 shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          >
            ↻
          </button>
          <button
            type="button"
            onClick={() => {
              setZoomUi(1.0);
              setLocalOrbit(0);
              camStateRef.current.targetX = 13.2;
              camStateRef.current.targetZ = 12.8;
              camStateRef.current.targetZoom = 1.0;
            }}
            aria-label="Center clinic"
            title={language === 'ar' ? 'توسيط العيادة' : 'Center View'}
            className="w-11 h-11 rounded-2xl bg-slate-900/80 hover:bg-slate-900 text-white font-bold text-sm border border-white/15 shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          >
            ⌖
          </button>
        </div>
      )}

      {/* Effortless Placement & Rearranging Control Bar */}
      {placementDraft && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 sm:gap-2 bg-slate-900/95 backdrop-blur-md text-white px-3 py-2 rounded-2xl border border-white/20 shadow-2xl max-w-[94vw]">
          <div className="text-xs font-extrabold truncate max-w-[110px] sm:max-w-[140px]">
            {language === 'ar' ? placementDraft.catalogItem.nameAr : placementDraft.catalogItem.nameEn}
          </div>
          <button
            type="button"
            onClick={onRotatePlacement}
            className="px-2.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-xs font-bold whitespace-nowrap active:scale-95"
          >
            {language === 'ar' ? 'تدوير ↻' : 'Rotate ↻'}
          </button>
          {placementDraft.movingInstanceId && onSellMovingDraft && (
            <button
              type="button"
              onClick={() => onSellMovingDraft(placementDraft.movingInstanceId!)}
              className="px-2.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-bold whitespace-nowrap active:scale-95"
            >
              {language === 'ar' ? 'بيع' : 'Sell'}
            </button>
          )}
          <button
            type="button"
            disabled={!draftValid}
            onClick={() => onConfirmPlacement(placementDraft.hoverX, placementDraft.hoverY)}
            className={`px-3 py-2 rounded-xl text-xs font-black whitespace-nowrap active:scale-95 ${
              draftValid
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                : 'bg-slate-700 text-slate-400 cursor-not-allowed'
            }`}
          >
            {language === 'ar' ? 'تثبيت ✓' : 'Place ✓'}
          </button>
          <button
            type="button"
            onClick={onCancelPlacement}
            aria-label="Cancel placement"
            className="px-2.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold whitespace-nowrap active:scale-95"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
