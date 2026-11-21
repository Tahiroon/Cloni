import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {
  CATALOG_ITEMS,
  normalizePlayerProfile,
  PLAYER_DEFAULT_SKIN,
  resolvePlayerOutfitMeta,
} from '../data/catalog';
import {
  buildObstacleBoxes,
  clampToSolarZone,
  CLINIC_FLOOR_ELEV,
  findGridPath,
  findNearestWalkableTile,
  getCabinetApproachPoints,
  getReceptionDeskPose,
  getSurfaceElevation,
  getTreatmentBedPose,
  getValidWallRotationsForTile,
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
} from '../engine/isometricMath';
import { glbRegistry, startPreloadGlbs } from '../engine3d/glbRegistry';
import {
  animateHumanoid3D,
  createHumanoid3D,
  disposeHumanoid3D,
  HumanoidRig,
} from '../engine3d/humanoid3d';
import {
  buildClinicWorld3D,
  ClinicDoorHandle,
  ClinicWorldHandle,
  createCatalogMesh3D,
  disposeObject3D,
  DoorActorInput,
  FountainRigMeta,
  ReceptionDeskRigMeta,
  SmartLightMeta,
  updateDoors3D,
  updateFoliageWindTime,
  WaterCoolerRigMeta,
  WORLD_TREES,
  WorldTreeDef,
} from '../engine3d/models3d';
import {
  createFppClinicianHands3D,
  createFppRoomBackdrop3D,
} from '../engine3d/fppViewRig';
import { createTextureBundle, TextureBundle } from '../engine3d/textures3d';
import {
  CatalogItem,
  ClinicRoom,
  FloatingFeedback,
  Language,
  LightingMode,
  PatientEntity,
  PlacedItem,
  PlayerCharacterConfig,
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
  playerProfile?: PlayerCharacterConfig;
  showPlayerCharacter?: boolean;
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
  firstPersonPatientId?: string | null;
  fppRecenterNonce?: number;
  fppMoveInputRef?: React.MutableRefObject<{ x: number; y: number }>;
  speakingPatientId?: string | null;
  selectedBedPatientId?: string | null;
  onTapPatient: (patient: PatientEntity) => void;
  onTapLockedRoom: (room: ClinicRoom) => void;
  onTapPlacedItem: (item: PlacedItem) => void;
  onLongPressPlacedItem?: (item: PlacedItem) => void;
  onStartDragPlacedItem?: (item: PlacedItem) => void;
  onSwitchEditingItem?: (nextItem: PlacedItem, commitCurrent?: boolean) => void;
  onTapReceptionDesk?: () => void;
  onInspectItem?: (item: PlacedItem) => void;
  onTapWorldTree?: (tree: WorldTreeDef) => void;
  onUpdatePlacementHover: (gx: number, gy: number, rotation?: 0 | 1 | 2 | 3) => void;
  onConfirmPlacement: (gx: number, gy: number, rotation?: 0 | 1 | 2 | 3) => void;
  onCancelPlacement: () => void;
  onRotatePlacement: () => void;
  onSellMovingDraft?: (instanceId: string) => void;
  onReceptionCheckinDone?: (patientId: string) => void;
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

function shortestAngleDelta(a: number, b: number): number {
  let diff = (((b - a) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  return diff;
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
    if (alongDist > 0.6 || perpDist > 0.82) continue;

    const approachDot =
      door.kind === 'swing_z'
        ? -Math.sign(dx || 1) * (vx / speed)
        : -Math.sign(dz || 1) * (vz / speed);
    if (approachDot > 0.18 && perpDist >= 0.1) {
      const reach = 1 - Math.abs(perpDist - 0.44) / 0.42;
      if (reach > best) best = reach;
    }
  }
  return THREE.MathUtils.clamp(best, 0, 1);
}

const MIN_ZOOM = 1.06;
const MAX_ZOOM = 2.4;
const DEFAULT_ZOOM = 1.12;
const PAN_MIN_X = 1.5;
const PAN_MAX_X = 21.5;
const PAN_MIN_Z = 4.0;
const PAN_MAX_Z = 19.5;
const snapFine = (v: number): number => Math.round(v * 20) / 20;

export const ClinicCanvas: React.FC<ClinicCanvasProps> = ({
  rooms,
  placedItems,
  patients,
  staff,
  playerProfile,
  showPlayerCharacter = true,
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
  firstPersonPatientId = null,
  fppRecenterNonce = 0,
  fppMoveInputRef,
  speakingPatientId = null,
  selectedBedPatientId = null,
  onTapPatient,
  onTapLockedRoom,
  onTapPlacedItem,
  onLongPressPlacedItem,
  onStartDragPlacedItem,
  onSwitchEditingItem,
  onTapReceptionDesk,
  onInspectItem,
  onTapWorldTree,
  onUpdatePlacementHover,
  onConfirmPlacement,
  onCancelPlacement,
  onRotatePlacement,
  onSellMovingDraft,
  onReceptionCheckinDone,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const pointerSurfaceRef = useRef<HTMLDivElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [glbsReady, setGlbsReady] = useState<boolean>(() => glbRegistry.ready);
  const preFocusZoomRef = useRef<number | null>(null);
  const hoveredEditItemIdRef = useRef<string | null>(null);
  const draggingDraftActiveRef = useRef(false);
  const liveDragDraftRef = useRef<PlacementDraft | null>(null);
  const fppKeysRef = useRef({ w: false, a: false, s: false, d: false });
  const fppLastPointerRef = useRef({ x: 0, y: 0 });
  const fppCamRef = useRef({
    activeId: null as string | null,
    blend: 0,
    patientX: 4.5,
    patientZ: 16.5,
    patientFacing: 0,
    anchorX: 4.5,
    anchorZ: 17.5,
    roomMinX: 2.35,
    roomMaxX: 21.65,
    roomMinZ: 2.35,
    roomMaxZ: 21.65,
    posX: 4.5,
    posY: 1.38,
    posZ: 17.5,
    baseY: 1.38,
    baseYaw: 0,
    yawOffset: 0,
    targetYawOffset: 0,
    yaw: 0,
    pitch: -0.09,
    targetPitch: -0.09,
    walkBob: 0,
  });

  const catalogMap = useMemo(() => {
    const map = new Map<string, CatalogItem>();
    CATALOG_ITEMS.forEach((c) => map.set(c.id, c));
    return map;
  }, []);

  const isPlacementValid = (gx: number, gy: number, draft: PlacementDraft): boolean => {
    if (draft.catalogItem.isWallDecor) {
      if (!isValidWallMount(gx, gy, draft.rotation, rooms)) return false;

      // Wall items only conflict with other wall items overlapping along the same wall face
      for (const existing of placedItems) {
        if (existing.instanceId === draft.movingInstanceId) continue;
        const cat = catalogMap.get(existing.catalogId);
        if (!cat?.isWallDecor) continue;
        if (
          existing.rotation === draft.rotation &&
          Math.abs(existing.gridX - gx) < 0.94 &&
          Math.abs(existing.gridY - gy) < 0.94
        ) {
          return false;
        }
      }
      return true;
    }

    const effW = draft.rotation % 2 === 0 ? draft.catalogItem.width : draft.catalogItem.depth;
    const effD = draft.rotation % 2 === 0 ? draft.catalogItem.depth : draft.catalogItem.width;
    const overlapTol = 0.03;

    if (draft.catalogItem.isSolarPanel || draft.catalogItem.id === 'solar_panel') {
      if (!isInSolarZone(gx, gy, effW, effD)) return false;
      for (const existing of placedItems) {
        if (existing.instanceId === draft.movingInstanceId) continue;
        const cat = catalogMap.get(existing.catalogId);
        if (!cat || cat.isWallDecor) continue;
        const ew = existing.rotation % 2 === 0 ? cat.width : cat.depth;
        const ed = existing.rotation % 2 === 0 ? cat.depth : cat.width;
        if (
          gx + overlapTol < existing.gridX + ew &&
          gx + effW - overlapTol > existing.gridX &&
          gy + overlapTol < existing.gridY + ed &&
          gy + effD - overlapTol > existing.gridY
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

    const eps = 0.015;
    const overlapsClinicInterior =
      gx + effW > 2.02 && gx < 21.98 && gy + effD > 2.02 && gy < 21.98;

    if (overlapsClinicInterior) {
      if (draft.catalogItem.indoorAllowed === false) return false;
      // Must sit cleanly inside one unlocked room so partition walls and locked rooms remain respected
      const fitsUnlockedRoom = rooms.some(
        (r) =>
          r.unlocked &&
          gx >= r.minX - eps &&
          gx + effW <= r.maxX + 1 + eps &&
          gy >= r.minY - eps &&
          gy + effD <= r.maxY + 1 + eps
      );
      if (!fitsUnlockedRoom) return false;
    } else {
      if (draft.catalogItem.outdoorAllowed === false) return false;
      const minSx = gx + 0.04;
      const maxSx = gx + effW - 0.04;
      const minSy = gy + 0.04;
      const maxSy = gy + effD - 0.04;
      const xSteps = Math.max(1, Math.ceil((maxSx - minSx) / 0.45));
      const ySteps = Math.max(1, Math.ceil((maxSy - minSy) / 0.45));
      for (let ix = 0; ix <= xSteps; ix++) {
        const sx = minSx + ((maxSx - minSx) * ix) / xSteps;
        for (let iy = 0; iy <= ySteps; iy++) {
          const sy = minSy + ((maxSy - minSy) * iy) / ySteps;
          if (!isTileInOutdoorGarden(Math.floor(sx), Math.floor(sy), isStreetOrGardenLamp)) {
            return false;
          }
        }
      }
    }

    const isFloorMat = (id: string) => id === 'floor_rug' || id === 'stone_pathway';
    const draftIsMat = isFloorMat(draft.catalogItem.id);

    for (const existing of placedItems) {
      if (existing.instanceId === draft.movingInstanceId) continue;
      const cat = catalogMap.get(existing.catalogId);
      if (!cat || cat.isWallDecor) continue;
      // Flat floor mats (rugs / stone pathways) sit cleanly underneath solid furniture & equipment
      if (draftIsMat !== isFloorMat(existing.catalogId)) continue;
      const ew = existing.rotation % 2 === 0 ? cat.width : cat.depth;
      const ed = existing.rotation % 2 === 0 ? cat.depth : cat.width;
      if (
        gx + overlapTol < existing.gridX + ew &&
        gx + effW - overlapTol > existing.gridX &&
        gy + overlapTol < existing.gridY + ed &&
        gy + effD - overlapTol > existing.gridY
      ) {
        return false;
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
    playerProfile,
    showPlayerCharacter,
    floatingFeedbacks,
    focusedPatientId,
    placementDraft,
    editMode,
    language,
    lightingMode,
    removedTreeIds,
    selectedTreeId,
    firstPersonPatientId,
    fppMoveInputRef,
    speakingPatientId,
    selectedBedPatientId,
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
    onReceptionCheckinDone,
  });
  latestRef.current = {
    rooms,
    placedItems,
    patients,
    staff,
    playerProfile,
    showPlayerCharacter,
    floatingFeedbacks,
    focusedPatientId,
    placementDraft,
    editMode,
    language,
    lightingMode,
    removedTreeIds,
    selectedTreeId,
    firstPersonPatientId,
    fppMoveInputRef,
    speakingPatientId,
    selectedBedPatientId,
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
    onReceptionCheckinDone,
  };

  const camStateRef = useRef({
    targetX: 13.2,
    targetZ: 12.8,
    curX: 13.2,
    curZ: 12.8,
    panVelX: 0,
    panVelZ: 0,
    targetZoom: DEFAULT_ZOOM,
    curZoom: DEFAULT_ZOOM,
    targetYaw: Math.PI / 4, // 45deg architectural angle
    curYaw: Math.PI / 4,
  });

  const sceneHooksRef = useRef<{
    rebuildWorld: (rooms: ClinicRoom[], removedTreeIds?: string[]) => void;
    syncItems: (items: PlacedItem[], movingId?: string) => void;
    syncDraft: (draft: PlacementDraft | null) => void;
    screenToGrid: (clientX: number, clientY: number) => { gx: number; gy: number; rawX: number; rawZ: number };
    screenToWallSlot: (
      clientX: number,
      clientY: number,
      preferredRot: 0 | 1 | 2 | 3
    ) => { gx: number; gy: number; rotation: 0 | 1 | 2 | 3 } | null;
    hitTestPatient: (clientX: number, clientY: number) => PatientEntity | null;
    hitTestPlacedItem: (clientX: number, clientY: number) => PlacedItem | null;
    hitTestPlacedItemDetail: (clientX: number, clientY: number) => { item: PlacedItem; distSq: number } | null;
    hitTestWorldTreeDetail: (clientX: number, clientY: number) => { tree: WorldTreeDef; distSq: number } | null;
    hitTestLockedRoomDetail: (clientX: number, clientY: number) => { room: ClinicRoom; distSq: number } | null;
    getRayGroundDistSq: (rawX: number, rawZ: number) => number;
    hitTestDraftGhost: (clientX: number, clientY: number) => boolean;
    getPanVectors: () => { right: THREE.Vector3; forward: THREE.Vector3; scale: number };
    updateFppHandsAppearance: (profile?: PlayerCharacterConfig) => void;
  } | null>(null);

  useEffect(() => {
    if (focusedPatientId) {
      if (preFocusZoomRef.current === null) {
        preFocusZoomRef.current = camStateRef.current.targetZoom;
      }
      camStateRef.current.panVelX = 0;
      camStateRef.current.panVelZ = 0;
      camStateRef.current.targetZoom = 1.85;
      const p = latestRef.current.patients.find((pt) => pt.id === focusedPatientId);
      if (p) {
        camStateRef.current.targetX = p.gridX + 0.5;
        camStateRef.current.targetZ = p.gridY + 0.5;
      }
    } else if (preFocusZoomRef.current !== null) {
      camStateRef.current.targetZoom = preFocusZoomRef.current;
      preFocusZoomRef.current = null;
    }
  }, [focusedPatientId]);

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
    camStateRef.current.targetYaw = Math.PI / 4 + orbitStep * (Math.PI / 2);
  }, [orbitStep]);

  useEffect(() => {
    if (!firstPersonPatientId || !fppRecenterNonce) return;
    const fpp = fppCamRef.current;
    fpp.targetYawOffset = 0;
    fpp.targetPitch = -0.09;
  }, [fppRecenterNonce, firstPersonPatientId]);

  useEffect(() => {
    fppKeysRef.current = { w: false, a: false, s: false, d: false };
    if (!firstPersonPatientId) return;
    const updateKey = (e: KeyboardEvent, down: boolean) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const k = e.key.toLowerCase();
      if (k === 'w' || e.key === 'ArrowUp') fppKeysRef.current.w = down;
      else if (k === 's' || e.key === 'ArrowDown') fppKeysRef.current.s = down;
      else if (k === 'a' || e.key === 'ArrowLeft') fppKeysRef.current.a = down;
      else if (k === 'd' || e.key === 'ArrowRight') fppKeysRef.current.d = down;
    };
    const onKeyDown = (e: KeyboardEvent) => updateKey(e, true);
    const onKeyUp = (e: KeyboardEvent) => updateKey(e, false);
    const onBlur = () => {
      fppKeysRef.current = { w: false, a: false, s: false, d: false };
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [firstPersonPatientId]);

  // Mount Three.js Perspective 3D Engine ONCE
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = probeSoftwareWebGL();
    const isMobileGpu =
      /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && window.innerWidth < 1024);
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    const gl = renderer.getContext();

    let containerW = Math.max(1, container.clientWidth);
    let containerH = Math.max(1, container.clientHeight);
    const initW = containerW;
    const initH = containerH;
    const maxTexSize = renderer.capabilities.maxTextureSize || 2048;
    const maxRbSize = Number(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)) || maxTexSize;
    const maxSurfaceSize = Math.max(512, Math.min(maxTexSize, maxRbSize));

    const getTargetDpr = (w: number, h: number) => {
      if (isSoftwareGl) return 1;
      const rawDpr = window.devicePixelRatio || 1;
      const baseDpr = isMobileGpu ? Math.min(rawDpr, 1.5) : Math.min(rawDpr, 2.0);
      return Math.min(baseDpr, maxSurfaceSize / Math.max(1, w, h));
    };
    const dpr = getTargetDpr(initW, initH);
    renderer.setPixelRatio(dpr);
    renderer.setSize(initW, initH);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.94;
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
    scene.environmentIntensity = 0.54;

    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmrem.dispose();

    // Calibrated Architectural Daylight Rig (crisp high-res shadows, soft sky rim & natural contrast)
    const hemi = new THREE.HemisphereLight(0xc6dcf0, 0x4b5c34, 0.56);
    scene.add(hemi);

    const sunLight = new THREE.DirectionalLight(0xfff1dc, 1.48);
    sunLight.position.set(25, 32, 18);
    sunLight.target.position.set(13, 0, 12);
    scene.add(sunLight.target);
    if (!isSoftwareGl) {
      const shadowRes = Math.min(2048, maxTexSize);
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(shadowRes, shadowRes);
      sunLight.shadow.radius = 2.4;
      sunLight.shadow.camera.near = 6;
      sunLight.shadow.camera.far = 90;
      sunLight.shadow.camera.left = -18;
      sunLight.shadow.camera.right = 18;
      sunLight.shadow.camera.top = 18;
      sunLight.shadow.camera.bottom = -18;
      sunLight.shadow.bias = -0.00025;
      sunLight.shadow.normalBias = 0.012;
    }
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0xb8d4f2, 0.26);
    fillLight.position.set(-16, 14, -12);
    scene.add(fillLight);

    const rimLight = !isSoftwareGl ? new THREE.DirectionalLight(0xc8e4ff, 0.34) : null;
    if (rimLight) {
      rimLight.position.set(-18, 16, 24);
      scene.add(rimLight);
    }

    // Low-FOV Architectural Perspective Camera (authentic 3D depth without distortion)
    const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 220);

    // Restrained crisp HDR Bloom + MSAA + ACES OutputPass on desktop hardware GPUs
    let composer: EffectComposer | null = null;
    let composerRt: THREE.WebGLRenderTarget | null = null;
    let bloomPass: UnrealBloomPass | null = null;
    if (!isSoftwareGl && !isMobileGpu) {
      let safeSamples = 0;
      if (renderer.capabilities.isWebGL2) {
        const gl2 = gl as WebGL2RenderingContext;
        let maxFloatSamples = 0;
        try {
          const supported = gl2.getInternalformatParameter(
            gl2.RENDERBUFFER,
            gl2.RGBA16F,
            gl2.SAMPLES
          ) as Int32Array | number[] | null;
          if (supported && supported.length > 0) {
            for (let i = 0; i < supported.length; i++) {
              const s = Number(supported[i]);
              if (Number.isFinite(s) && s > maxFloatSamples) {
                maxFloatSamples = s;
              }
            }
          }
        } catch {
          maxFloatSamples = 0;
        }
        safeSamples = Math.min(4, maxFloatSamples, renderer.capabilities.maxSamples || 0);
      }
      const rtW = Math.min(maxSurfaceSize, Math.max(1, Math.round(initW * dpr)));
      const rtH = Math.min(maxSurfaceSize, Math.max(1, Math.round(initH * dpr)));
      composerRt = new THREE.WebGLRenderTarget(rtW, rtH, {
        type: THREE.HalfFloatType,
        samples: safeSamples,
      });
      composer = new EffectComposer(renderer, composerRt);
      composer.setSize(initW, initH);
      composer.addPass(new RenderPass(scene, camera));
      bloomPass = new UnrealBloomPass(new THREE.Vector2(initW, initH), 0.07, 0.22, 0.95);
      composer.addPass(bloomPass);
      composer.addPass(new OutputPass());
    }

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const textures: TextureBundle = createTextureBundle(maxAniso);
    const pbrCharMaps = {
      contactShadowTex: textures.contactShadow,
      skinMicroMap: textures.skinMicroMap,
      skinRoughMap: textures.skinRoughMap,
      fabricWeaveBump: textures.fabricWeaveBump,
      leatherBump: textures.leatherBump,
      brushedMetalBump: textures.brushedMetalBump,
    };
    const worldLayer = new THREE.Group();
    const itemsLayer = new THREE.Group();
    const draftLayer = new THREE.Group();
    const actorsLayer = new THREE.Group();
    const lightsLayer = new THREE.Group();
    scene.add(camera);
    scene.add(worldLayer, itemsLayer, draftLayer, actorsLayer, lightsLayer);

    const fppBackdrop = createFppRoomBackdrop3D(textures, maxAniso);
    scene.add(fppBackdrop.group);
    const fppHands = createFppClinicianHands3D(textures, latestRef.current.playerProfile);
    camera.add(fppHands.group);
    fppBackdrop.group.visible = true;
    fppHands.group.visible = true;
    renderer.compile(scene, camera);
    fppBackdrop.group.visible = false;
    fppHands.group.visible = false;

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
        leadX: number;
        leadZ: number;
        lastLogicalX: number;
        lastLogicalZ: number;
        groundY: number;
        stairClimb: number;
        vx: number;
        vz: number;
        walkPhase: number;
        walkBlend: number;
        sitBlend: number;
        lieBlend: number;
        doorPush: number;
        facingRad: number;
        turnLean: number;
        actorSeed: number;
        bedStationId?: string;
        bedPhase?: 'to_edge' | 'sit_edge' | 'reclining' | 'lying';
        bedTimer?: number;
        bedArriveTimer?: number;
        bedEdgeSign?: 1 | -1;
        bedStartX?: number;
        bedStartZ?: number;
        lastSeatItemId?: string;
        lastSeatX?: number;
        lastSeatZ?: number;
        lastSeatHeight?: number;
        lastBedStationId?: string;
        lastBedHeight?: number;
        lastBedLyingHeight?: number;
        lastBedZOffset?: number;
        lastBedTiltPitch?: number;
        lastBedEdgeX?: number;
        lastBedEdgeZ?: number;
        lastBedEdgeFacing?: number;
      }
    >();
    const staffRigs = new Map<
      string,
      {
        rig: HumanoidRig;
        appearanceKey?: string;
        gx: number;
        gy: number;
        visX: number;
        visZ: number;
        groundY: number;
        stairClimb: number;
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
        turnLean: number;
        ignoreItemId?: string;
        actorSeed: number;
        recMode?:
          | 'desk'
          | 'leaving_seat'
          | 'to_cabinet'
          | 'at_cabinet'
          | 'to_cooler'
          | 'drinking'
          | 'to_desk'
          | 'placing_file';
        recPurpose?: 'cooler' | 'cabinet';
        recStateTimer?: number;
        recDrinkTimer?: number;
        recCabinetTimer?: number;
        recPlaceTimer?: number;
        recCoolerId?: string;
        recCoolerFacing?: number;
        recCabinetId?: string;
        recCabinetFacing?: number;
        recTargetPatientId?: string;
        recHoldingFile?: boolean;
        recDeskFileTimer?: number;
        recHandledPatients?: Set<string>;
        recDeskApproachX?: number;
        recDeskApproachY?: number;
        recActivityTimer?: number;
        recSeatedActivity?: 'typing' | 'writing' | 'glance' | 'rest';
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

    let draftMeshSig = '';
    let draftGhost: THREE.Group | null = null;
    const draftPadMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
    });
    const draftPadMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.025, 1), draftPadMat);
    draftPadMesh.visible = false;
    draftLayer.add(draftPadMesh);

    let nightBlend = latestRef.current.lightingMode === 'night' ? 1 : 0;
    let lastNightBlend = -1;
    let atmoDirty = true;
    let wasNightActive = nightBlend > 0.005;
    const _dayTop = new THREE.Color(0x4b7cb3);
    const _nightTop = new THREE.Color(0x0c1b3a);
    const _dayHor = new THREE.Color(0xd2e0ec);
    const _nightHor = new THREE.Color(0x1a325c);
    const _duskHor = new THREE.Color(0xe8a882);
    const _dayFog = new THREE.Color(0xd2e0ec);
    const _nightFog = new THREE.Color(0x132648);
    const _duskFog = new THREE.Color(0xdcc2b4);
    const _daySun = new THREE.Color(0xfff1dc);
    const _moonSun = new THREE.Color(0xa8c8ff);
    const _duskSun = new THREE.Color(0xffb478);
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

    const _roomTargetPool: LightTarget[] = Array.from({ length: 16 }, () => ({
      x: 0, y: 0, z: 0, color: 0, intensity: 0, distance: 0, decay: 1,
    }));
    const _lampTargetPool: Array<{ score: number; target: LightTarget }> = Array.from(
      { length: 48 },
      () => ({
        score: 0,
        target: { x: 0, y: 0, z: 0, color: 0, intensity: 0, distance: 0, decay: 1 },
      })
    );
    const _roomTargetsScratch: LightTarget[] = [];
    const _lampTargetsScratch: Array<{ score: number; target: LightTarget }> = [];
    const _selectedTargetsScratch: LightTarget[] = [];

    const pushRoomTarget = (
      x: number,
      y: number,
      z: number,
      color: number,
      intensity: number,
      distance: number,
      decay: number
    ) => {
      const idx = _roomTargetsScratch.length;
      if (idx >= _roomTargetPool.length) {
        _roomTargetPool.push({ x, y, z, color, intensity, distance, decay });
      } else {
        const slot = _roomTargetPool[idx];
        slot.x = x;
        slot.y = y;
        slot.z = z;
        slot.color = color;
        slot.intensity = intensity;
        slot.distance = distance;
        slot.decay = decay;
      }
      _roomTargetsScratch.push(_roomTargetPool[idx]);
    };

    const pushLampTarget = (
      score: number,
      x: number,
      y: number,
      z: number,
      color: number,
      intensity: number,
      distance: number,
      decay: number
    ) => {
      const idx = _lampTargetsScratch.length;
      if (idx >= _lampTargetPool.length) {
        _lampTargetPool.push({
          score,
          target: { x, y, z, color, intensity, distance, decay },
        });
      } else {
        const slot = _lampTargetPool[idx];
        slot.score = score;
        slot.target.x = x;
        slot.target.y = y;
        slot.target.z = z;
        slot.target.color = color;
        slot.target.intensity = intensity;
        slot.target.distance = distance;
        slot.target.decay = decay;
      }
      _lampTargetsScratch.push(_lampTargetPool[idx]);
    };

    const updateAtmosphereAndLights = (timeSec: number, dt: number) => {
      const targetNight = latestRef.current.lightingMode === 'night' ? 1 : 0;
      nightBlend = THREE.MathUtils.damp(nightBlend, targetNight, 4.2, dt);

      if (worldHandle) {
        worldHandle.skyUniforms.uTime.value = timeSec;
      }

      const blendChanged = Math.abs(nightBlend - lastNightBlend) > 1e-4;
      if (atmoDirty || blendChanged) {
        lastNightBlend = nightBlend;
        const duskFactor = Math.sin(nightBlend * Math.PI);

        sunLight.color.copy(_daySun).lerp(_moonSun, nightBlend).lerp(_duskSun, duskFactor * 0.42);
        sunLight.intensity = THREE.MathUtils.lerp(1.48, 0.64, nightBlend);
        sunLight.position.set(
          THREE.MathUtils.lerp(25, -22, nightBlend),
          THREE.MathUtils.lerp(32, 26, nightBlend),
          THREE.MathUtils.lerp(18, -18, nightBlend)
        );

        hemi.color.copy(_dayHemiSky).lerp(_nightHemiSky, nightBlend);
        hemi.groundColor.copy(_dayHemiGround).lerp(_nightHemiGround, nightBlend);
        hemi.intensity = THREE.MathUtils.lerp(0.56, 0.48, nightBlend);

        fillLight.color.copy(_dayFill).lerp(_nightFill, nightBlend);
        fillLight.intensity = 0.26;
        if (rimLight) {
          rimLight.intensity = THREE.MathUtils.lerp(0.34, 0.18, nightBlend);
        }

        scene.environmentIntensity = THREE.MathUtils.lerp(0.54, 0.26, nightBlend);
        renderer.toneMappingExposure = THREE.MathUtils.lerp(0.94, 1.08, nightBlend);
        if (bloomPass) {
          bloomPass.strength =
            nightBlend <= 0.015 ? 0 : THREE.MathUtils.lerp(0.0, 0.17, (nightBlend - 0.015) / 0.985);
        }

        const fog = scene.fog as THREE.Fog;
        fog.color.copy(_dayFog).lerp(_nightFog, nightBlend).lerp(_duskFog, duskFactor * 0.35);
        fog.near = THREE.MathUtils.lerp(55, 58, nightBlend);
        fog.far = THREE.MathUtils.lerp(95, 108, nightBlend);

        if (worldHandle) {
          worldHandle.skyUniforms.uTopColor.value.copy(_dayTop).lerp(_nightTop, nightBlend);
          worldHandle.skyUniforms.uHorizonColor.value
            .copy(_dayHor)
            .lerp(_nightHor, nightBlend)
            .lerp(_duskHor, duskFactor * 0.42);
          worldHandle.skyUniforms.uNightFactor.value = nightBlend;

          worldHandle.villaWinMat.emissiveIntensity = 0.05 + nightBlend * 1.65;
          worldHandle.interiorCoveMat.emissiveIntensity = 0.08 + nightBlend * 1.15;
          worldHandle.entranceSconceMat.emissiveIntensity = 0.06 + nightBlend * 1.55;
          worldHandle.facadeSignMat.emissiveIntensity = 0.1 + nightBlend * 1.45;
          worldHandle.pillarLanternMat.emissiveIntensity = 0.06 + nightBlend * 0.85;
        }
      }

      if (nightBlend <= 0.005) {
        if (wasNightActive || atmoDirty) {
          if (worldHandle) {
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
          for (const entry of itemMeshes.values()) {
            const meta = entry.mesh.userData.smartLight as SmartLightMeta | undefined;
            if (!meta) continue;
            const dayGlow =
              meta.kind === 'street_lamp' || meta.kind === 'garden_lamp'
                ? 0.08
                : meta.kind === 'indoor_lamp' || meta.kind === 'wall_lamp'
                  ? 0.06
                  : 0.1;
            for (const mat of meta.emissiveMats) {
              mat.emissiveIntensity = dayGlow;
            }
            if (meta.haloMats) {
              for (let hi = 0; hi < meta.haloMats.length; hi++) {
                meta.haloMats[hi].opacity = 0;
              }
            }
          }
          let anyLightLit = false;
          for (let i = 0; i < smartLightPool.length; i++) {
            const pl = smartLightPool[i];
            if (pl.intensity > 0.002) {
              pl.intensity = THREE.MathUtils.damp(pl.intensity, 0, 8.5, dt);
              anyLightLit = true;
            } else {
              pl.intensity = 0;
            }
          }
          wasNightActive = anyLightLit;
        }
        atmoDirty = false;
        return;
      }

      wasNightActive = true;
      atmoDirty = false;

      _roomTargetsScratch.length = 0;
      _lampTargetsScratch.length = 0;
      const curRooms = latestRef.current.rooms;
      const curPatients = latestRef.current.patients;
      const curStaff = latestRef.current.staff;
      const camCx = camStateRef.current.curX;
      const camCz = camStateRef.current.curZ;

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
        const occupiedByStaff =
          curStaff.some((st) => {
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
          }) ||
          (() => {
            const pRig = staffRigs.get('player_main');
            if (!pRig) return false;
            const sx = pRig.gx + 0.5;
            const sz = pRig.gy + 0.5;
            return (
              sx >= room.minX - 0.3 &&
              sx <= room.maxX + 1.3 &&
              sz >= room.minY - 0.3 &&
              sz <= room.maxY + 1.3
            );
          })();
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
          pushRoomTarget(
            anchor ? anchor.x : room.minX + 1.2,
            anchor ? anchor.y : 2.1,
            anchor ? anchor.z : (room.minY + room.maxY + 1) / 2,
            0xfff2d8,
            14.5 * nightBlend,
            16.5,
            0.95
          );
        }
      }

      // 2. Architectural entrance canopy sconce illuminating the courtyard steps & facade
      pushRoomTarget(
        22.45,
        2.85 + CLINIC_FLOOR_ELEV,
        15.0,
        0xffd796,
        4.8 * nightBlend,
        10.0,
        1.05
      );

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
            meta.haloMats[hi].opacity = (meta.haloMaxOpacities[hi] ?? 0.35) * nightBlend;
          }
        }

        _lightWorldPos
          .set(meta.localPos[0], meta.localPos[1], meta.localPos[2])
          .applyQuaternion(entry.mesh.quaternion)
          .add(entry.mesh.position);

        const distSq =
          (_lightWorldPos.x - camCx) * (_lightWorldPos.x - camCx) +
          (_lightWorldPos.z - camCz) * (_lightWorldPos.z - camCz);

        if (meta.kind === 'street_lamp') {
          pushLampTarget(
            distSq * 0.8,
            _lightWorldPos.x,
            _lightWorldPos.y,
            _lightWorldPos.z,
            0xffd591,
            16.0 * nightBlend,
            19.0,
            1.0
          );
        } else if (meta.kind === 'garden_lamp') {
          pushLampTarget(
            distSq + 10,
            _lightWorldPos.x,
            _lightWorldPos.y,
            _lightWorldPos.z,
            0xffcc78,
            11.0 * nightBlend,
            13.5,
            1.02
          );
        } else if (meta.kind === 'indoor_lamp') {
          pushLampTarget(
            distSq + 16,
            _lightWorldPos.x,
            _lightWorldPos.y,
            _lightWorldPos.z,
            0xffe8bf,
            8.5 * nightBlend,
            11.5,
            1.02
          );
        } else if (meta.kind === 'wall_lamp') {
          pushLampTarget(
            distSq + 18,
            _lightWorldPos.x,
            _lightWorldPos.y,
            _lightWorldPos.z,
            0xffd79e,
            7.2 * nightBlend,
            10.5,
            1.04
          );
        } else if (meta.kind === 'ir_lamp') {
          pushLampTarget(
            distSq + 24,
            _lightWorldPos.x,
            _lightWorldPos.y,
            _lightWorldPos.z,
            0xff6b5a,
            5.2 * nightBlend,
            7.5,
            1.08
          );
        } else {
          pushLampTarget(
            distSq + 36,
            _lightWorldPos.x,
            _lightWorldPos.y,
            _lightWorldPos.z,
            0x38bdf8,
            5.5 * nightBlend,
            9.0,
            1.08
          );
        }
      }

      // Reserve slots fairly so store lamps NEVER get starved by room sconces
      const reservedLampSlots = Math.min(
        _lampTargetsScratch.length,
        Math.max(2, Math.floor(SMART_LIGHT_POOL_SIZE * 0.45))
      );
      const maxRoomSlotsNow = Math.max(0, SMART_LIGHT_POOL_SIZE - reservedLampSlots);
      _selectedTargetsScratch.length = 0;

      for (let i = 0; i < _roomTargetsScratch.length && _selectedTargetsScratch.length < maxRoomSlotsNow; i++) {
        _selectedTargetsScratch.push(_roomTargetsScratch[i]);
      }
      if (_lampTargetsScratch.length > 0) {
        _lampTargetsScratch.sort((a, b) => a.score - b.score);
        for (let i = 0; i < _lampTargetsScratch.length && _selectedTargetsScratch.length < SMART_LIGHT_POOL_SIZE; i++) {
          _selectedTargetsScratch.push(_lampTargetsScratch[i].target);
        }
      }
      for (let i = maxRoomSlotsNow; i < _roomTargetsScratch.length && _selectedTargetsScratch.length < SMART_LIGHT_POOL_SIZE; i++) {
        _selectedTargetsScratch.push(_roomTargetsScratch[i]);
      }

      for (let i = 0; i < smartLightPool.length; i++) {
        const pl = smartLightPool[i];
        const t = _selectedTargetsScratch[i];
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
      if (!glbRegistry.ready) return;
      if (worldHandle) worldHandle.dispose();
      while (worldLayer.children.length > 0) {
        worldLayer.remove(worldLayer.children[0]);
      }
      worldHandle = buildClinicWorld3D(nextRooms, textures, nextRemovedTreeIds);
      worldLayer.add(worldHandle.group);
      atmoDirty = true;
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
        const onOuterWest = rot === 0 && Math.abs(gx - 2) < 0.05;
        const onOuterNorth = rot === 1 && Math.abs(gy - 2) < 0.05;
        if (onOuterWest) wx += 0.05;
        if (onOuterNorth) wz += 0.05;
        if (onOuterWest || onOuterNorth) {
          wy += cat.sprite === 'wall_sconce_lamp' ? 0.28 : 0.48;
        }
      }
      return [wx, wy, wz];
    };

    let hasPlacedDisplayKiosk = false;
    let hasDraftDisplayKiosk = false;
    const animatedFountains: FountainRigMeta[] = [];

    const isInsideClinicTile = (gx: number, gy: number) =>
      gx >= 1.98 && gx < 22 && gy >= 1.98 && gy < 22;

    const syncItems = (nextItems: PlacedItem[], movingId?: string) => {
      if (!glbRegistry.ready) return;
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
        const baseY = isInsideClinicTile(item.gridX, item.gridY) ? 0.08 + CLINIC_FLOOR_ELEV : 0.08;
        const [wx, wy, wz] = computeItemWorldPos(cat, item.gridX, item.gridY, item.rotation, baseY);
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
      animatedFountains.length = 0;
      for (const entry of itemMeshes.values()) {
        const f = entry.mesh.userData.fountain as FountainRigMeta | undefined;
        if (f) animatedFountains.push(f);
      }
      hasPlacedDisplayKiosk = foundKiosk;
      atmoDirty = true;
    };

    const syncDraft = (draft: PlacementDraft | null) => {
      if (!glbRegistry.ready) return;
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
      const indoorElev = isInsideClinicTile(draft.hoverX, draft.hoverY) ? CLINIC_FLOOR_ELEV : 0;

      if (draft.catalogItem.isWallDecor) {
        draftPadMesh.visible = false;
      } else {
        draftPadMesh.visible = true;
        draftPadMesh.scale.set(effW - 0.08, 1, effD - 0.08);
        draftPadMesh.position.set(
          draft.hoverX + effW / 2,
          0.092 + indoorElev,
          draft.hoverY + effD / 2
        );
        draftPadMat.color.setHex(valid ? 0x10b981 : 0xef4444);
      }

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
          (draft.catalogItem.isWallDecor ? 0.08 : 0.11) + indoorElev
        );
        draftGhost.position.set(wx, wy, wz);
      }
    };

    let sceneAssetsInitialized = false;
    const initSceneAssets = () => {
      if (disposed || sceneAssetsInitialized || !glbRegistry.ready) return;
      sceneAssetsInitialized = true;
      rebuildWorld(latestRef.current.rooms, latestRef.current.removedTreeIds);
      syncItems(latestRef.current.placedItems, latestRef.current.placementDraft?.movingInstanceId);
      syncDraft(latestRef.current.placementDraft);
      updateCameraTransform();
      if (!isSoftwareGl) {
        renderer.compile(scene, camera);
      }
      setGlbsReady(true);
    };

    startPreloadGlbs(maxAniso);
    const unsubGlb = glbRegistry.onReady(() => {
      initSceneAssets();
    });
    if (glbRegistry.ready) {
      initSceneAssets();
    }

    // Pre-allocated scratch vectors & quaternions
    const _raycaster = new THREE.Raycaster();
    const _ndc = new THREE.Vector2();
    const _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.07);
    const _indoorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(0.07 + CLINIC_FLOOR_ELEV));
    const _hitPoint = new THREE.Vector3();
    const _indoorHit = new THREE.Vector3();
    const _projVec = new THREE.Vector3();
    const _camFwd = new THREE.Vector3();
    const _camRight = new THREE.Vector3();
    const _upVec = new THREE.Vector3(0, 1, 0);
    const _fppIsoPos = new THREE.Vector3();
    const _fppIsoQuat = new THREE.Quaternion();
    const _fppCamPos = new THREE.Vector3();
    const _fppCamQuat = new THREE.Quaternion();
    const _fppEuler = new THREE.Euler(0, 0, 0, 'YXZ');
    const _fppLookMat = new THREE.Matrix4();
    const _fppTargetVec = new THREE.Vector3();

    const updateCameraTransform = () => {
      const w = containerW;
      const h = containerH;
      const aspect = w / h;
      let projDirty = false;
      if (Math.abs(camera.aspect - aspect) > 0.001) {
        camera.aspect = aspect;
        projDirty = true;
      }
      const cs = camStateRef.current;
      // Tighter architectural framing so zoom-out stays cleanly around the clinic grounds
      const baseDist = aspect < 0.8 ? 41 : 30;
      const dist = baseDist / cs.curZoom;
      const pitch = 0.6;
      const horiz = Math.cos(pitch) * dist;
      const vert = Math.sin(pitch) * dist;
      _fppIsoPos.set(
        cs.curX + Math.sin(cs.curYaw) * horiz,
        vert,
        cs.curZ + Math.cos(cs.curYaw) * horiz
      );

      const fpp = fppCamRef.current;
      const b = fpp.blend;
      if (b <= 0.001) {
        camera.position.copy(_fppIsoPos);
        camera.lookAt(cs.curX, 0.45, cs.curZ);
        if (Math.abs(camera.fov - 30) > 0.02 || Math.abs(camera.near - 0.5) > 0.002) {
          camera.fov = 30;
          camera.near = 0.5;
          projDirty = true;
        }
      } else {
        // Silky single-phase quintic dive straight into real clinic bedside FPP
        const s = b * b * b * (b * (b * 6 - 15) + 10);
        _fppTargetVec.set(cs.curX, 0.45, cs.curZ);
        _fppLookMat.lookAt(_fppIsoPos, _fppTargetVec, _upVec);
        _fppIsoQuat.setFromRotationMatrix(_fppLookMat);

        _fppCamPos.set(fpp.posX, fpp.posY, fpp.posZ);
        _fppEuler.set(fpp.pitch, fpp.yaw, 0, 'YXZ');
        _fppCamQuat.setFromEuler(_fppEuler);

        camera.position.copy(_fppIsoPos).lerp(_fppCamPos, s);
        camera.position.y += Math.sin(Math.PI * s) * 0.42;
        camera.quaternion.copy(_fppIsoQuat).slerp(_fppCamQuat, s);

        const nextFov = THREE.MathUtils.lerp(30, 52, s);
        const nextNear = THREE.MathUtils.lerp(0.5, 0.08, s);
        if (Math.abs(camera.fov - nextFov) > 0.02 || Math.abs(camera.near - nextNear) > 0.002) {
          camera.fov = nextFov;
          camera.near = nextNear;
          projDirty = true;
        }
      }
      if (projDirty) {
        camera.updateProjectionMatrix();
      }
    };

    const screenToGrid = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      _raycaster.setFromCamera(_ndc, camera);
      const indoorHit = _raycaster.ray.intersectPlane(_indoorPlane, _indoorHit);
      if (
        indoorHit &&
        indoorHit.x >= 2 &&
        indoorHit.x < 22 &&
        indoorHit.z >= 2 &&
        indoorHit.z < 22
      ) {
        return {
          gx: Math.floor(indoorHit.x),
          gy: Math.floor(indoorHit.z),
          rawX: indoorHit.x,
          rawZ: indoorHit.z,
        };
      }
      const hit = _raycaster.ray.intersectPlane(_groundPlane, _hitPoint);
      if (!hit) return { gx: 0, gy: 0, rawX: 0, rawZ: 0 };
      return {
        gx: Math.floor(hit.x),
        gy: Math.floor(hit.z),
        rawX: hit.x,
        rawZ: hit.z,
      };
    };

    const _wallPlaneNOuter = new THREE.Plane(new THREE.Vector3(0, 0, 1), -2.15);
    const _wallPlaneWOuter = new THREE.Plane(new THREE.Vector3(1, 0, 0), -2.15);
    const _wallPlaneMidEW = new THREE.Plane(new THREE.Vector3(0, 0, 1), -10.1);
    const _wallPlaneMidNS = new THREE.Plane(new THREE.Vector3(1, 0, 0), -12.1);
    const _wallHit = new THREE.Vector3();

    const screenToWallSlot = (
      clientX: number,
      clientY: number,
      preferredRot: 0 | 1 | 2 | 3
    ): { gx: number; gy: number; rotation: 0 | 1 | 2 | 3 } | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      _raycaster.setFromCamera(_ndc, camera);
      const curRooms = latestRef.current.rooms;

      const checkPlane = (
        plane: THREE.Plane,
        rot: 0 | 1,
        maxH: number,
        isAlongZ: boolean
      ): { gx: number; gy: number; rotation: 0 | 1 | 2 | 3; score: number } | null => {
        const hit = _raycaster.ray.intersectPlane(plane, _wallHit);
        if (!hit) return null;
        if (hit.y < CLINIC_FLOOR_ELEV - 0.12 || hit.y > maxH + CLINIC_FLOOR_ELEV + 0.45) return null;
        if (hit.x < 1.7 || hit.x >= 22.3 || hit.z < 1.7 || hit.z >= 22.3) return null;
        let gx: number;
        let gy: number;
        if (isAlongZ) {
          gx = Math.abs(hit.x - 2.15) < 0.6 ? 2 : 12;
          const fineGy = snapFine(Math.max(2, Math.min(21, hit.z - 0.5)));
          const fallbackGy = Math.max(2, Math.min(21, Math.floor(hit.z)));
          if (isValidWallMount(gx, fineGy, rot, curRooms)) {
            gy = fineGy;
          } else if (getValidWallRotationsForTile(gx, fallbackGy, curRooms).includes(rot)) {
            gy = fallbackGy;
          } else {
            return null;
          }
        } else {
          gy = Math.abs(hit.z - 2.15) < 0.6 ? 2 : 10;
          const fineGx = snapFine(Math.max(2, Math.min(21, hit.x - 0.5)));
          const fallbackGx = Math.max(2, Math.min(21, Math.floor(hit.x)));
          if (isValidWallMount(fineGx, gy, rot, curRooms)) {
            gx = fineGx;
          } else if (getValidWallRotationsForTile(fallbackGx, gy, curRooms).includes(rot)) {
            gx = fallbackGx;
          } else {
            return null;
          }
        }
        const score = camera.position.distanceToSquared(hit) - (rot === preferredRot ? 0.05 : 0);
        return { gx, gy, rotation: rot, score };
      };

      const candidates = [
        checkPlane(_wallPlaneNOuter, 1, 3.85, false),
        checkPlane(_wallPlaneWOuter, 0, 3.85, true),
        checkPlane(_wallPlaneMidEW, 1, 2.5, false),
        checkPlane(_wallPlaneMidNS, 0, 2.5, true),
      ];
      let best: { gx: number; gy: number; rotation: 0 | 1 | 2 | 3; score: number } | null = null;
      for (const cand of candidates) {
        if (cand && (!best || cand.score < best.score)) {
          best = cand;
        }
      }
      return best ? { gx: best.gx, gy: best.gy, rotation: best.rotation } : null;
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
      const h = containerH;
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
      screenToWallSlot,
      hitTestPatient,
      hitTestPlacedItem,
      hitTestPlacedItemDetail,
      hitTestWorldTreeDetail,
      hitTestLockedRoomDetail,
      getRayGroundDistSq,
      hitTestDraftGhost,
      getPanVectors,
      updateFppHandsAppearance: fppHands.updateAppearance,
    };

    let lastComposerDpr = dpr;
    const onResize = () => {
      if (!container) return;
      containerW = Math.max(1, container.clientWidth);
      containerH = Math.max(1, container.clientHeight);
      const w = containerW;
      const h = containerH;
      const curDpr = getTargetDpr(w, h);
      renderer.setPixelRatio(curDpr);
      renderer.setSize(w, h);
      if (composer) {
        composer.setSize(w, h);
        if (Math.abs(curDpr - lastComposerDpr) > 0.001) {
          lastComposerDpr = curDpr;
          composer.setPixelRatio(curDpr);
        }
      }
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
    const doorActorsPool: DoorActorInput[] = [];
    const doorActorsScratch: DoorActorInput[] = [];
    const activePatientIds = new Set<string>();
    const activeStaffIds = new Set<string>();
    const playerStaffSpec: StaffMember = {
      id: 'player_main',
      role: 'therapist',
      nameAr: 'طالب ثيراسون',
      nameEn: 'Therason Student',
      hired: true,
      hireCost: 0,
      gridX: 7,
      gridY: 14,
      targetX: 7,
      targetY: 14,
      path: [],
      skinTone: PLAYER_DEFAULT_SKIN,
      hairColor: '#18100c',
      scrubColor: '#0284c7',
      facing: 1,
      walkPhase: 0,
      state: 'idle',
    };

    let cachedUnlockedRoomsSig = '';
    const cachedUnlockedRoomsSet = new Set<string>();
    const getUnlockedRoomsSet = (curRooms: ClinicRoom[]) => {
      let sig = '';
      for (let i = 0; i < curRooms.length; i++) {
        if (curRooms[i].unlocked) sig += curRooms[i].id + ',';
      }
      if (sig !== cachedUnlockedRoomsSig) {
        cachedUnlockedRoomsSig = sig;
        cachedUnlockedRoomsSet.clear();
        for (let i = 0; i < curRooms.length; i++) {
          if (curRooms[i].unlocked) cachedUnlockedRoomsSet.add(curRooms[i].id);
        }
      }
      return cachedUnlockedRoomsSet;
    };

    const syncAndAnimateActors = (timeSec: number, dt: number, pureFppId: string | null = null) => {
      if (!glbRegistry.ready) return;
      const {
        patients: curPatients,
        staff: curStaff,
        placedItems: curItems,
        catalogMap: cMap,
        focusedPatientId: focId,
        firstPersonPatientId: curFppId,
        speakingPatientId: curSpeakId,
        selectedBedPatientId: curSelBedId,
      } = latestRef.current;
      const fppBlendNow = fppCamRef.current.blend;
      const fppSmoothNow =
        fppBlendNow * fppBlendNow * fppBlendNow * (fppBlendNow * (fppBlendNow * 6 - 15) + 10);

      const curRooms = latestRef.current.rooms;
      let obstacles = walkerObstacles;
      const unlockedSet = getUnlockedRoomsSet(curRooms);
      const worldDoors = worldHandle ? worldHandle.doors : [];

      if (!pureFppId) {
        const obsRes = getWalkerObstacles(
          curRooms,
          curItems,
          latestRef.current.removedTreeIds || []
        );
        obstacles = obsRes.obstacles;
        const layoutChanged = obsRes.changed;

        if (layoutChanged) {
          // Immediately reroute walking staff around placed/moved/sold furniture
          for (const sr of staffRigs.values()) {
            if (sr.recMode === 'desk') continue;
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
        }

        // Reset interactive water cooler parts & reception desk placed file each frame before active actors update them
        let showDeskPlacedFile = false;
        for (const sr of staffRigs.values()) {
          if (
            sr.recMode !== undefined &&
            ((sr.recDeskFileTimer ?? 0) > 0 || (sr.recMode === 'placing_file' && !sr.recHoldingFile))
          ) {
            showDeskPlacedFile = true;
            break;
          }
        }
        for (const [itemId, entryItem] of itemMeshes.entries()) {
          const rd = entryItem.mesh.userData.receptionDesk as ReceptionDeskRigMeta | undefined;
          if (rd) {
            rd.deskFile.visible = showDeskPlacedFile;
          }
          const wc = entryItem.mesh.userData.waterCooler as WaterCoolerRigMeta | undefined;
          if (!wc) continue;
          wc.alcoveCup.visible = false;
          wc.stream.visible = false;
          wc.bubble.visible = false;
          const keepReturn = coolerReturnUntil.get(itemId);
          wc.returnedCup.visible = keepReturn !== undefined && timeSec < keepReturn;
        }
      }

      activePatientIds.clear();
      for (const p of curPatients) {
        if (pureFppId && p.id !== pureFppId) continue;
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
            ...pbrCharMaps,
          });
          actorsLayer.add(rig.root);
          entry = {
            rig,
            visX: p.gridX + 0.5,
            visZ: p.gridY + 0.5,
            leadX: p.gridX,
            leadZ: p.gridY,
            lastLogicalX: p.gridX,
            lastLogicalZ: p.gridY,
            groundY: getSurfaceElevation(p.gridX + 0.5, p.gridY + 0.5).actorY,
            stairClimb: 0,
            vx: 0,
            vz: 0,
            walkPhase: 0,
            walkBlend: 0,
            sitBlend: 0,
            lieBlend: 0,
            doorPush: 0,
            facingRad: -Math.PI / 2,
            turnLean: 0,
            actorSeed:
              p.id.split('').reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 7) & 0xffff,
          };
          patientRigs.set(p.id, entry);
        } else if (p.gridX !== entry.lastLogicalX || p.gridY !== entry.lastLogicalZ) {
          entry.leadX = p.gridX;
          entry.leadZ = p.gridY;
          entry.lastLogicalX = p.gridX;
          entry.lastLogicalZ = p.gridY;
        }

        entry.rig.root.visible = true;

        const isAtStation =
          (p.state === 'ready_for_exam' || p.state === 'in_exam' || p.state === 'in_treatment') &&
          p.path.length === 0;
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
        const hScale = p.heightScale || 1;
        const bedMattressTop =
          spr === 'exercise_mat'
            ? 0.066
            : spr === 'traction_table'
              ? 0.46
              : spr === 'magnetotherapy'
                ? 0.45
                : spr === 'tilt_table'
                  ? 0.6
                  : 0.52;
        const lyingHeight =
          spr === 'tilt_table' ? 0.82 : bedMattressTop + 0.145;
        const bedBodyZOffset =
          spr === 'tilt_table' ? 0.53 * hScale : undefined;
        const tiltPitch = spr === 'tilt_table' ? -Math.PI / 2 + 0.52 : -Math.PI / 2;
        const isBikeStation = Boolean(isAtStation && station && spr === 'exercise_bike');
        const isActiveGaitStation = Boolean(
          isAtStation && station && (spr === 'treadmill' || spr === 'parallel_bars')
        );

        const isSeatedWait = p.state === 'waiting_checkin' && p.isSeatedWait !== false;
        const seatItemId = p.waitingSeatKey
          ? p.waitingSeatKey.slice(0, p.waitingSeatKey.lastIndexOf('_'))
          : undefined;
        const anchorSeatX =
          (isSeatedWait || (p.state === 'walking_to_wait' && p.isSeatedWait !== false)) &&
          p.targetX !== undefined
            ? p.targetX
            : p.gridX;
        const anchorSeatY =
          (isSeatedWait || (p.state === 'walking_to_wait' && p.isSeatedWait !== false)) &&
          p.targetY !== undefined
            ? p.targetY
            : p.gridY;
        const seatWorldX = anchorSeatX + 0.5 + (p.seatOffsetX || 0);
        const seatWorldZ = anchorSeatY + 0.5 + (p.seatOffsetZ || 0);
        let targetX = seatWorldX;
        let targetZ = seatWorldZ;
        let stationFacing: number | null = null;
        let bedDesiredFacing: number | null = null;
        let bedForcedFacing: number | null = null;
        let bedTargetLie = 0;
        let bedTargetSit = false;
        let bedSeatH = bedMattressTop;
        let bedAllowsWalk = true;
        let bedDirectPos = false;
        let bedDirectX = seatWorldX;
        let bedDirectZ = seatWorldZ;

        if (isSeatedWait && seatItemId) {
          entry.lastSeatItemId = seatItemId;
          entry.lastSeatX = seatWorldX;
          entry.lastSeatZ = seatWorldZ;
          entry.lastSeatHeight = p.seatHeight ?? 0.375;
        } else if (
          entry.lastSeatItemId &&
          entry.sitBlend < 0.06 &&
          (entry.lastSeatX === undefined ||
            Math.hypot(entry.lastSeatX - entry.visX, (entry.lastSeatZ ?? entry.visZ) - entry.visZ) > 0.95)
        ) {
          entry.lastSeatItemId = undefined;
        }

        // Chair turn-around-before-sitting: rotate to face outward at the approach tile BEFORE backing onto the cushion
        const headingToChair =
          (p.state === 'walking_to_wait' || p.state === 'waiting_checkin') &&
          p.isSeatedWait !== false &&
          p.seatApproachX !== undefined &&
          p.seatApproachY !== undefined &&
          p.seatFacingRad !== undefined;
        const appWorldX = p.seatApproachX !== undefined ? p.seatApproachX + 0.5 : seatWorldX;
        const appWorldZ = p.seatApproachY !== undefined ? p.seatApproachY + 0.5 : seatWorldZ;
        const distToApp = Math.hypot(appWorldX - entry.visX, appWorldZ - entry.visZ);
        const inPreSitTurnZone =
          Boolean(headingToChair) &&
          !isSeatedWait &&
          entry.sitBlend < 0.18 &&
          p.path.length <= 1 &&
          distToApp < 0.78 &&
          angleDiffAbs(entry.facingRad, p.seatFacingRad!) >= 0.35;
        if (inPreSitTurnZone) {
          targetX = appWorldX;
          targetZ = appWorldZ;
        } else if (!isAtStation && !isSeatedWait && p.path.length > 0) {
          const wp = p.path[0];
          const ldx = wp.x - entry.leadX;
          const ldz = wp.y - entry.leadZ;
          const ld = Math.hypot(ldx, ldz);
          if (ld > 0.01) {
            const pHasAid =
              Boolean(p.clinicalCase.mobilityAid) && p.clinicalCase.mobilityAid !== 'none';
            const pSpeed = (pHasAid ? 0.98 : 1.24) * dt;
            const adv = Math.min(ld, pSpeed);
            entry.leadX += (ldx / ld) * adv;
            entry.leadZ += (ldz / ld) * adv;
          }
          targetX = entry.leadX + 0.5;
          targetZ = entry.leadZ + 0.5;
        }

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

          if (isLyingStation && spr) {
            const bedPose = getTreatmentBedPose(
              station,
              spr,
              stationCat.width,
              stationCat.depth,
              obstacles,
              entry.visX,
              entry.visZ
            );
            stationFacing = bedPose.stationFacing;
            const bedCenterPt = { x: bedPose.bedCenterX, z: bedPose.bedCenterZ };

            if (entry.bedStationId !== station.instanceId) {
              entry.bedStationId = station.instanceId;
              entry.bedPhase = 'to_edge';
              entry.bedTimer = 0;
              entry.bedArriveTimer = 0;
              entry.bedEdgeSign = bedPose.edgeSign;
            } else if (entry.bedPhase === 'to_edge') {
              entry.bedEdgeSign = bedPose.edgeSign;
            }

            const edgeSign = entry.bedEdgeSign ?? bedPose.edgeSign;
            const edgeOffsetZ =
              spr === 'exercise_mat' ? 0.22 : spr === 'treatment_bed' ? 0.24 : 0.27;
            const edgePt = rotLocal(0, edgeSign * edgeOffsetZ);
            const edgeFacing =
              edgeSign === 1
                ? (-station.rotation * Math.PI) / 2
                : Math.PI - (station.rotation * Math.PI) / 2;

            entry.lastBedStationId = station.instanceId;
            entry.lastBedHeight = bedSeatH;
            entry.lastBedLyingHeight = lyingHeight;
            entry.lastBedZOffset = bedBodyZOffset;
            entry.lastBedTiltPitch = tiltPitch;
            entry.lastBedEdgeX = edgePt.x;
            entry.lastBedEdgeZ = edgePt.z;
            entry.lastBedEdgeFacing = edgeFacing;

            entry.bedArriveTimer = (entry.bedArriveTimer ?? 0) + dt;
            if (entry.bedPhase === 'to_edge') {
              targetX = edgePt.x;
              targetZ = edgePt.z;
              const dEdge = Math.hypot(edgePt.x - entry.visX, edgePt.z - entry.visZ);
              if (dEdge < 0.95) {
                bedDesiredFacing = edgeFacing;
              }
              const edgeAngleReady = angleDiffAbs(entry.facingRad, edgeFacing) < 0.52;
              if ((dEdge <= 0.22 && edgeAngleReady) || entry.bedArriveTimer >= 1.15) {
                entry.bedPhase = 'sit_edge';
                entry.bedTimer = 0;
              }
            } else if (entry.bedPhase === 'sit_edge') {
              bedAllowsWalk = false;
              targetX = edgePt.x;
              targetZ = edgePt.z;
              bedDesiredFacing = edgeFacing;
              bedTargetSit = true;
              bedTargetLie = 0;
              // Stay comfortably seated on the hospital bed while awaiting/undergoing clinical exam;
              // smoothly recline ONLY after clinical assessment finishes and treatment begins.
              if (p.state === 'in_treatment') {
                entry.bedTimer = (entry.bedTimer ?? 0) + dt;
                if ((entry.bedTimer >= 0.35 && entry.sitBlend >= 0.88) || entry.bedTimer >= 0.9) {
                  entry.bedPhase = 'reclining';
                  entry.bedTimer = 0;
                  entry.bedStartX = entry.visX;
                  entry.bedStartZ = entry.visZ;
                }
              } else {
                entry.bedTimer = 0;
              }
            } else if (entry.bedPhase === 'reclining') {
              bedAllowsWalk = false;
              entry.bedTimer = (entry.bedTimer ?? 0) + dt;
              const u = THREE.MathUtils.clamp(entry.bedTimer / 1.5, 0, 1);
              const s = u * u * (3 - 2 * u);
              const moveFrac = Math.min(1, u / 0.72);
              const moveS = moveFrac * moveFrac * (3 - 2 * moveFrac);
              bedDirectPos = true;
              bedDirectX = THREE.MathUtils.lerp(entry.bedStartX ?? edgePt.x, bedCenterPt.x, moveS);
              bedDirectZ = THREE.MathUtils.lerp(entry.bedStartZ ?? edgePt.z, bedCenterPt.z, moveS);
              targetX = bedDirectX;
              targetZ = bedDirectZ;
              bedForcedFacing =
                edgeFacing + shortestAngleDelta(edgeFacing, stationFacing) * moveS;
              bedTargetSit = true;
              bedTargetLie = s;
              if (u >= 1) {
                entry.bedPhase = 'lying';
              }
            } else {
              bedAllowsWalk = false;
              bedDirectPos = true;
              bedDirectX = bedCenterPt.x;
              bedDirectZ = bedCenterPt.z;
              targetX = bedCenterPt.x;
              targetZ = bedCenterPt.z;
              bedForcedFacing = stationFacing;
              bedTargetSit = true;
              bedTargetLie = 1;
            }
          } else if (isBikeStation) {
            const pt = rotLocal(-0.18, 0);
            targetX = pt.x;
            targetZ = pt.z;
            stationFacing = Math.PI / 2 - (station.rotation * Math.PI) / 2;
          } else if (spr === 'treadmill') {
            const pt = rotLocal(-0.125, 0);
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

        if (!isLyingStation && entry.bedStationId) {
          entry.bedStationId = undefined;
          entry.bedPhase = undefined;
          entry.bedTimer = 0;
          entry.bedArriveTimer = 0;
        }
        if (!isLyingStation && entry.lastBedStationId && entry.lieBlend < 0.04 && entry.sitBlend < 0.06) {
          entry.lastBedStationId = undefined;
        }

        // Smooth rise from bed (sit up onto bed edge -> stand -> walk away) and clean chair stand-up
        const risingFromBed =
          !isLyingStation &&
          (entry.lieBlend > 0.04 || (Boolean(entry.lastBedStationId) && entry.sitBlend > 0.08));
        const risingFromChair = !isSeatedWait && !isLyingStation && !risingFromBed && entry.sitBlend > 0.08;
        const holdForBedRise = risingFromBed && (entry.lieBlend > 0.18 || entry.sitBlend > 0.36);
        const holdForChairStand = risingFromChair && entry.sitBlend > 0.36;

        if (risingFromBed && entry.lieBlend > 0.18 && entry.lastBedEdgeX !== undefined && entry.lastBedEdgeZ !== undefined) {
          targetX = entry.lastBedEdgeX;
          targetZ = entry.lastBedEdgeZ;
        } else if (holdForBedRise || holdForChairStand) {
          targetX = entry.visX;
          targetZ = entry.visZ;
        }

        const prevVisX = entry.visX;
        const prevVisZ = entry.visZ;
        const dampRate =
          holdForBedRise || holdForChairStand
            ? 8.5
            : isSeatedWait
              ? 12.5
              : isLyingStation && entry.bedPhase === 'to_edge'
                ? 12.0
                : p.path.length > 0
                  ? 14.0
                  : 9.5;
        let nextVisX = bedDirectPos ? bedDirectX : THREE.MathUtils.damp(entry.visX, targetX, dampRate, dt);
        let nextVisZ = bedDirectPos ? bedDirectZ : THREE.MathUtils.damp(entry.visZ, targetZ, dampRate, dt);
        // Prevent brisk rocket catch-up and sideways sliding on sharp turns
        if (!bedDirectPos && !isAtStation && !isSeatedWait && !risingFromBed && !risingFromChair && p.path.length > 0) {
          const rawStepDx = nextVisX - prevVisX;
          const rawStepDz = nextVisZ - prevVisZ;
          const rawStepD = Math.hypot(rawStepDx, rawStepDz);
          let turnScale = 1.0;
          if (rawStepD > 0.002) {
            const desiredMoveAng = Math.atan2(rawStepDx, rawStepDz);
            const tDiff = angleDiffAbs(entry.facingRad, desiredMoveAng);
            if (tDiff > 0.35) {
              turnScale = THREE.MathUtils.clamp(Math.cos(tDiff * 0.75), 0.35, 1.0);
            }
          }
          const maxStepD = Math.max(0.01, dt * 1.55 * turnScale);
          if (rawStepD > maxStepD && rawStepD < 2.5) {
            const scaleStep = maxStepD / rawStepD;
            nextVisX = prevVisX + rawStepDx * scaleStep;
            nextVisZ = prevVisZ + rawStepDz * scaleStep;
          }
        }

        // Enforce world-space wall & furniture non-clipping on the interpolated visual position while walking
        const nearChairFinal =
          p.state === 'walking_to_wait' &&
          p.path.length <= 1 &&
          Math.hypot(targetX - prevVisX, targetZ - prevVisZ) < 1.35;
        const visualIgnoreId =
          isAtStation
            ? p.assignedStationId || undefined
            : isSeatedWait || nearChairFinal
              ? seatItemId
              : risingFromBed
                ? entry.lastBedStationId || p.leavingItemId
                : risingFromChair
                  ? entry.lastSeatItemId || p.leavingItemId
                  : p.state === 'treated_leaving'
                    ? p.leavingItemId || entry.lastBedStationId
                    : p.state === 'walking_to_station' &&
                        p.path.length <= 1 &&
                        Math.hypot(targetX - prevVisX, targetZ - prevVisZ) < 1.55
                      ? p.assignedStationId || undefined
                      : p.leavingItemId;

        if (!isAtStation && !isSeatedWait && !risingFromBed && !risingFromChair) {
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

        const effSeatTargetFacing = isBikeStation
          ? stationFacing ?? entry.facingRad
          : p.seatFacingRad !== undefined
            ? p.seatFacingRad
            : entry.facingRad;

        const distToSeat = Math.hypot(seatWorldX - entry.visX, seatWorldZ - entry.visZ);
        const readySeatPos =
          (isSeatedWait && distToSeat < 0.34) || Boolean(isBikeStation && distRem < 0.24);
        const facingReady = angleDiffAbs(entry.facingRad, effSeatTargetFacing) < 0.55;
        const shouldSit = isLyingStation
          ? bedTargetSit
          : risingFromBed
            ? entry.lieBlend > 0.18
            : readySeatPos && (facingReady || entry.sitBlend > 0.28);

        const allowWalkMotion =
          (!isLyingStation || bedAllowsWalk) &&
          !holdForBedRise &&
          !holdForChairStand &&
          !inPreSitTurnZone &&
          !(isSeatedWait && readySeatPos);
        const logicalMoving = allowWalkMotion && (p.path.length > 0 || distRem > 0.05);
        // Never animate walk stride while standing still, turning in front of a chair, sitting down, or reclining!
        const isMoving =
          allowWalkMotion &&
          (realSpeed > 0.12 || (logicalMoving && stepDist > 0.0018));

        const pose =
          (isLyingStation && (entry.bedPhase === 'reclining' || entry.bedPhase === 'lying')) ||
          (risingFromBed && entry.lieBlend > 0.12)
            ? 'lying'
            : shouldSit
              ? 'seated'
              : 'standing';
        const effectiveSeatHeight = isLyingStation
          ? bedSeatH
          : isBikeStation
            ? 0.51
            : risingFromBed && entry.lastBedHeight !== undefined
              ? entry.lastBedHeight
              : risingFromChair && entry.lastSeatHeight !== undefined
                ? entry.lastSeatHeight
                : (p.seatHeight ?? 0.375);

        const effectiveLyingHeight =
          risingFromBed && entry.lastBedLyingHeight !== undefined
            ? entry.lastBedLyingHeight
            : lyingHeight;
        const effectiveBedZOffset =
          risingFromBed && entry.lastBedZOffset !== undefined
            ? entry.lastBedZOffset
            : bedBodyZOffset;
        const effectiveTiltPitch =
          risingFromBed && entry.lastBedTiltPitch !== undefined
            ? entry.lastBedTiltPitch
            : tiltPitch;

        entry.walkBlend = THREE.MathUtils.damp(entry.walkBlend, isMoving ? 1 : 0, 12.0, dt);
        entry.sitBlend = THREE.MathUtils.damp(
          entry.sitBlend,
          shouldSit ? 1 : 0,
          isLyingStation || risingFromBed ? 10.0 : 8.5,
          dt
        );
        if (isLyingStation) {
          entry.lieBlend = bedTargetLie;
        } else {
          entry.lieBlend = THREE.MathUtils.damp(entry.lieBlend, 0, 7.5, dt);
        }

        const pushTarget = computeDoorPushTarget(
          entry.visX,
          entry.visZ,
          entry.vx,
          entry.vz,
          isMoving && !isSeatedWait && !isLyingStation && !risingFromBed,
          worldDoors,
          unlockedSet
        );
        entry.doorPush = THREE.MathUtils.damp(
          entry.doorPush,
          pushTarget,
          pushTarget > entry.doorPush ? 14 : 8,
          dt
        );

        const surfPt = getSurfaceElevation(entry.visX, entry.visZ);
        entry.groundY = THREE.MathUtils.damp(
          entry.groundY,
          surfPt.actorY,
          surfPt.onStairs ? 22.0 : 18.0,
          dt
        );
        const inStairApproachPt =
          surfPt.onStairs ||
          (entry.visX >= 22.35 &&
            entry.visX <= 23.68 &&
            entry.visZ >= 13.75 &&
            entry.visZ <= 16.25);
        const rawStairClimbPt =
          inStairApproachPt && isMoving ? THREE.MathUtils.clamp(-entry.vx / 1.05, -1, 1) : 0;
        entry.stairClimb = THREE.MathUtils.damp(entry.stairClimb, rawStairClimbPt, 11.0, dt);

        const prevFacingPt = entry.facingRad;
        const nearChairTurnZone =
          Boolean(headingToChair) && Math.hypot(seatWorldX - entry.visX, seatWorldZ - entry.visZ) < 1.05;
        if (stepDist > 0.0005 && (isMoving || entry.walkBlend > 0.04)) {
          const hScalePt = Math.max(0.82, p.heightScale || 1);
          entry.walkPhase += (stepDist * (surfPt.onStairs ? 8.5 : 7.2)) / hScalePt;
          if (
            stepDist > 0.0008 &&
            isMoving &&
            !nearChairTurnZone &&
            !(isLyingStation && bedDesiredFacing !== null)
          ) {
            const targetAngle = Math.atan2(mdx, mdz);
            entry.facingRad = lerpAngle(entry.facingRad, targetAngle, Math.min(1, dt * 12.5));
          }
        }

        let drinkStage: 'none' | 'filling' | 'sipping' | 'returning' = 'none';
        if (bedForcedFacing !== null) {
          entry.facingRad = bedForcedFacing;
        } else if (bedDesiredFacing !== null) {
          entry.facingRad = lerpAngle(entry.facingRad, bedDesiredFacing, Math.min(1, dt * 12));
        } else if (risingFromBed && entry.lastBedEdgeFacing !== undefined) {
          entry.facingRad = lerpAngle(entry.facingRad, entry.lastBedEdgeFacing, Math.min(1, dt * 7.5));
        } else if (!isMoving || nearChairTurnZone || inPreSitTurnZone) {
          if (p.state === 'checkin_at_desk') {
            const recStaff = curStaff.find((st) => st.role === 'receptionist' && st.hired);
            const recRig = recStaff ? staffRigs.get(recStaff.id) : undefined;
            const desk = curItems.find((it) => it.catalogId === 'reception_desk');
            let targetLookX = desk ? desk.gridX + 1.0 : entry.visX;
            let targetLookZ = desk ? desk.gridY + 0.5 : entry.visZ - 1;
            if (desk) {
              const dp = getReceptionDeskPose(desk);
              targetLookX = dp.seatWorldX;
              targetLookZ = dp.seatWorldZ;
            }
            if (recRig && Math.hypot(recRig.visX - entry.visX, recRig.visZ - entry.visZ) < 4.5) {
              targetLookX = recRig.visX;
              targetLookZ = recRig.visZ;
            }
            const lookAngle = Math.atan2(targetLookX - entry.visX, targetLookZ - entry.visZ);
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
                const fillFrac = THREE.MathUtils.clamp(wt / 1220, 0.05, 1);
                wc.alcoveCup.visible = wt < 1250;
                wc.alcoveWater.scale.y = fillFrac;
                wc.alcoveWater.position.y = 0.008 + fillFrac * 0.028;
                wc.stream.visible = wt < 1220;
                wc.stream.scale.x = 0.85 + 0.18 * Math.sin(timeSec * 30);
                wc.stream.scale.z = wc.stream.scale.x;
                wc.bubble.visible = wt < 1220;
                wc.bubble.position.y = 0.98 + ((timeSec * 0.36) % 0.26);
              }
            } else if (wt < 3450) {
              drinkStage = 'sipping';
            } else {
              drinkStage = wt < 3850 ? 'returning' : 'none';
              if (wt >= 3720 && p.waterCoolerId && wc) {
                coolerReturnUntil.set(p.waterCoolerId, timeSec + 8.5);
                wc.returnedCup.visible = true;
              }
            }
          } else if (headingToChair && (isSeatedWait || nearChairTurnZone || inPreSitTurnZone)) {
            const table = curItems.find((it) => it.catalogId === 'coffee_table');
            const fallbackAngle = table
              ? Math.atan2(table.gridX + 0.5 - entry.visX, table.gridY + 0.5 - entry.visZ)
              : 0;
            const seatAngle = p.seatFacingRad !== undefined ? p.seatFacingRad : fallbackAngle;
            entry.facingRad = lerpAngle(entry.facingRad, seatAngle, Math.min(1, dt * 14));
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

        const rawTurnPt = isMoving
          ? THREE.MathUtils.clamp(
              (shortestAngleDelta(prevFacingPt, entry.facingRad) / Math.max(0.008, dt)) * 0.022,
              -0.09,
              0.09
            )
          : 0;
        entry.turnLean = THREE.MathUtils.damp(entry.turnLean, rawTurnPt, 9.0, dt);

        if (focId === p.id) {
          camStateRef.current.targetX = entry.visX;
          camStateRef.current.targetZ = entry.visZ;
        }

        entry.rig.root.position.set(entry.visX, entry.groundY, entry.visZ);

        const isFppTarget = curFppId === p.id;
        animateHumanoid3D(entry.rig, {
          pose,
          walkPhase: entry.walkPhase,
          isMoving,
          walkBlend: entry.walkBlend,
          sitBlend: entry.sitBlend,
          lieBlend: entry.lieBlend,
          doorPush: entry.doorPush,
          seatHeight: effectiveSeatHeight,
          lyingHeight: effectiveLyingHeight,
          bedBodyZOffset: effectiveBedZOffset,
          tiltPitch: effectiveTiltPitch,
          facingRad: entry.facingRad,
          turnLean: entry.turnLean,
          timeSec,
          isSelected: fppSmoothNow < 0.35 && (focId === p.id || curSelBedId === p.id),
          inTreatment: p.state === 'in_treatment',
          activeGait: p.state === 'in_treatment' && isActiveGaitStation,
          isDrinking: p.state === 'drinking_water',
          drinkStage,
          drinkElapsedMs: p.state === 'drinking_water' ? p.waitTimer : undefined,
          actorSeed: entry.actorSeed,
          stairClimb: entry.stairClimb,
          lookTargetWorld: isFppTarget
            ? { x: camera.position.x, y: camera.position.y, z: camera.position.z }
            : null,
          isSpeaking: isFppTarget && curSpeakId === p.id,
        });
      }

      if (pureFppId) return;

      for (const [id, entry] of patientRigs.entries()) {
        if (!activePatientIds.has(id)) {
          actorsLayer.remove(entry.rig.root);
          disposeHumanoid3D(entry.rig);
          patientRigs.delete(id);
        }
      }

      // Sync Staff (60fps local therapist patrol & receptionist workflow — zero React re-render/IndexedDB overhead!)
      activeStaffIds.clear();
      const trimLongestLOS = (
        gx: number,
        gy: number,
        path: Array<{ x: number; y: number }>,
        radius: number
      ) => {
        if (path.length < 2) return;
        for (let probe = path.length - 1; probe >= 1; probe--) {
          if (hasContinuousLineOfSight(gx, gy, path[probe].x, path[probe].y, radius, obstacles)) {
            path.splice(0, probe);
            break;
          }
        }
      };

      const activeProfile = normalizePlayerProfile(latestRef.current.playerProfile);
      const includePlayer = latestRef.current.showPlayerCharacter !== false;
      const activeOutfitMeta = resolvePlayerOutfitMeta(activeProfile.outfitId);
      playerStaffSpec.scrubColor = activeOutfitMeta.shirtColor;

      const processStaffMember = (s: StaffMember) => {
        if (!s.hired) return;
        activeStaffIds.add(s.id);
        const isPlayerActor = s.id === 'player_main';
        const outfitMeta = isPlayerActor ? activeOutfitMeta : null;
        const isFemalePlayer = activeProfile.gender === 'female';
        const effectivePlayerTarha = isFemalePlayer
          ? outfitMeta?.forceTarha
            ? true
            : activeProfile.hasTarha
          : false;
        const playerHasNiqab = Boolean(isFemalePlayer && outfitMeta?.hasNiqab);
        const appearanceKey = isPlayerActor
          ? `${activeProfile.gender}|${activeProfile.outfitId}|${effectivePlayerTarha ? 1 : 0}`
          : `${s.id}|${s.skinTone}|${s.scrubColor}`;

        const buildActorRig = () => {
          if (isPlayerActor && outfitMeta) {
            return createHumanoid3D({
              skinTone: PLAYER_DEFAULT_SKIN,
              hairColor: '#18100c',
              shirtColor: outfitMeta.shirtColor,
              pantsColor: outfitMeta.pantsColor,
              hasHijab: effectivePlayerTarha,
              hasNiqab: playerHasNiqab,
              isFemale: isFemalePlayer,
              outfitStyle: outfitMeta.outfitStyle,
              medicalWear: outfitMeta.medicalWear,
              hasStethoscope: outfitMeta.hasStethoscope,
              shirtStyle: outfitMeta.medicalWear === 'none' && !isFemalePlayer ? 'shirt' : undefined,
              isStaff: false,
              isPlayer: true,
              role: 'therapist',
              ...pbrCharMaps,
            });
          }
          return createHumanoid3D({
            skinTone: s.skinTone,
            hairColor: s.hairColor,
            shirtColor: s.scrubColor,
            pantsColor: '#1e3a5f',
            hasHijab: true,
            isFemale: true,
            outfitStyle: s.role === 'receptionist' ? 'abaya' : 'casual',
            isStaff: true,
            role: s.role,
            ...pbrCharMaps,
          });
        };

        let entry = staffRigs.get(s.id);
        if (entry && entry.appearanceKey !== appearanceKey) {
          actorsLayer.remove(entry.rig.root);
          disposeHumanoid3D(entry.rig);
          const nextRig = buildActorRig();
          nextRig.root.position.set(entry.visX, entry.groundY, entry.visZ);
          actorsLayer.add(nextRig.root);
          entry.rig = nextRig;
          entry.appearanceKey = appearanceKey;
        }
        if (!entry) {
          const initialDesk =
            s.role === 'receptionist'
              ? curItems.find((it) => it.catalogId === 'reception_desk')
              : undefined;
          const initPose = initialDesk ? getReceptionDeskPose(initialDesk) : null;
          const initGx = initPose ? initPose.seatTileX : s.gridX;
          const initGy = initPose ? initPose.seatTileY : s.gridY;
          const rig = buildActorRig();
          actorsLayer.add(rig.root);
          entry = {
            rig,
            appearanceKey,
            gx: initGx,
            gy: initGy,
            visX: initGx + 0.5,
            visZ: initGy + 0.5,
            groundY: getSurfaceElevation(initGx + 0.5, initGy + 0.5).actorY,
            stairClimb: 0,
            vx: 0,
            vz: 0,
            path: [],
            pauseTimer: 0.6 + Math.random() * 1.2,
            stuckTimer: 0,
            walkPhase: 0,
            walkBlend: 0,
            sitBlend: s.role === 'receptionist' ? 1 : 0,
            doorPush: 0,
            facingRad: initPose ? initPose.seatFacingRad : Math.PI / 2,
            turnLean: 0,
            actorSeed:
              (s.id.split('').reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 13) & 0xffff) + 101,
            recMode: s.role === 'receptionist' ? 'desk' : undefined,
            recStateTimer: s.role === 'receptionist' ? 12 + Math.random() * 10 : undefined,
            recDrinkTimer: 0,
            recCabinetTimer: 0,
            recHoldingFile: false,
            recDeskFileTimer: 0,
            recHandledPatients: new Set<string>(),
            recActivityTimer: s.role === 'receptionist' ? 3.5 + Math.random() * 3.5 : undefined,
            recSeatedActivity: s.role === 'receptionist' ? 'typing' : undefined,
          };
          staffRigs.set(s.id, entry);
        }

        let targetX = entry.gx + 0.5;
        let targetZ = entry.gy + 0.5;
        let recSeatFacing = 0;
        let recSeatHeight = 0.38;
        let recDrinkStage: 'none' | 'filling' | 'sipping' | 'returning' = 'none';
        let recDrinkElapsedMs: number | undefined;
        let isMoving = false;

        if (s.role === 'receptionist') {
          const deskItem = curItems.find((it) => it.catalogId === 'reception_desk');
          const deskPose = deskItem ? getReceptionDeskPose(deskItem) : null;
          const seatX = deskPose ? deskPose.seatWorldX : s.gridX + 0.5;
          const seatZ = deskPose ? deskPose.seatWorldZ : s.gridY + 0.5;
          recSeatFacing = deskPose ? deskPose.seatFacingRad : 0;
          recSeatHeight = deskPose ? deskPose.seatHeight : 0.38;

          const findDeskApproach = (destX?: number, destY?: number) => {
            if (deskPose) {
              let bestCand: { x: number; y: number } | null = null;
              let bestDist = Infinity;
              for (const cand of deskPose.approachCandidates) {
                if (!isTileWalkable(cand.x, cand.y, 0.21, obstacles)) continue;
                if (destX === undefined || destY === undefined) return cand;
                const d = Math.hypot(cand.x - destX, cand.y - destY);
                if (d < bestDist) {
                  bestDist = d;
                  bestCand = cand;
                }
              }
              if (bestCand) return bestCand;
            }
            return findNearestWalkableTile(seatX - 0.5, seatZ - 0.5, 0.21, obstacles, deskItem?.instanceId);
          };

          const findPlaceApproach = () => {
            if (deskPose) {
              for (const cand of deskPose.placeCandidates) {
                if (isTileWalkable(cand.x, cand.y, 0.21, obstacles)) {
                  return cand;
                }
              }
            }
            return findDeskApproach(entry.gx, entry.gy);
          };

          if (!entry.recHandledPatients) {
            entry.recHandledPatients = new Set<string>();
          } else if (entry.recHandledPatients.size > 16) {
            const activeIds = new Set(curPatients.map((pt) => pt.id));
            for (const oldId of entry.recHandledPatients) {
              if (!activeIds.has(oldId)) entry.recHandledPatients.delete(oldId);
            }
          }

          const checkinPatient = curPatients.find((pt) => pt.state === 'checkin_at_desk');
          const incomingPatient = curPatients.find(
            (pt) =>
              !entry!.recHandledPatients!.has(pt.id) &&
              (pt.state === 'checkin_at_desk' ||
                (pt.state === 'arriving' &&
                  Math.hypot(pt.gridX + 0.5 - seatX, pt.gridY + 0.5 - seatZ) < 2.8))
          );

          const mode = entry.recMode || 'desk';

          if (mode === 'desk') {
            entry.gx = seatX - 0.5;
            entry.gy = seatZ - 0.5;
            targetX = seatX;
            targetZ = seatZ;

            if (entry.recDeskFileTimer && entry.recDeskFileTimer > 0) {
              entry.recDeskFileTimer = Math.max(0, entry.recDeskFileTimer - dt);
              entry.recSeatedActivity = 'writing';
            } else if (checkinPatient) {
              entry.recSeatedActivity = 'glance';
            } else {
              entry.recActivityTimer = (entry.recActivityTimer ?? 4.0) - dt;
              if (entry.recActivityTimer <= 0) {
                const r = Math.random();
                entry.recSeatedActivity =
                  r < 0.44 ? 'typing' : r < 0.7 ? 'writing' : r < 0.86 ? 'glance' : 'rest';
                entry.recActivityTimer = 3.8 + Math.random() * 4.4;
              }
            }

            // Priority 1: When a patient arrives/checks in, get up cleanly and fetch their clinical file from the nearest file cabinet
            if (incomingPatient && deskItem) {
              entry.recHandledPatients.add(incomingPatient.id);
              entry.recTargetPatientId = incomingPatient.id;
              let bestCab: {
                id: string;
                approachX: number;
                approachY: number;
                facing: number;
                path: Array<{ x: number; y: number }>;
                len: number;
              } | null = null;

              for (const cab of curItems) {
                if (cab.catalogId !== 'file_cabinet') continue;
                const rm = curRooms.find(
                  (r) =>
                    cab.gridX >= r.minX - 0.05 &&
                    cab.gridX < r.maxX + 1 &&
                    cab.gridY >= r.minY - 0.05 &&
                    cab.gridY < r.maxY + 1
                );
                if (rm && !rm.unlocked) continue;

                const approach = findDeskApproach(cab.gridX, cab.gridY);
                const spots = getCabinetApproachPoints(cab);
                for (const sp of spots) {
                  if (!isTileWalkable(sp.x, sp.y, 0.21, obstacles)) continue;
                  const pTest = findGridPath(
                    approach.x,
                    approach.y,
                    sp.x,
                    sp.y,
                    curRooms,
                    curItems,
                    walkerFootprints,
                    obstacles
                  );
                  if (pTest.length > 0 || Math.hypot(sp.x - approach.x, sp.y - approach.y) < 0.45) {
                    const estLen =
                      Math.hypot(approach.x - entry.gx, approach.y - entry.gy) +
                      pTest.reduce(
                        (sum, n, idx) =>
                          sum +
                          Math.hypot(
                            n.x - (idx === 0 ? approach.x : pTest[idx - 1].x),
                            n.y - (idx === 0 ? approach.y : pTest[idx - 1].y)
                          ),
                        0
                      );
                    if (!bestCab || estLen < bestCab.len) {
                      bestCab = {
                        id: cab.instanceId,
                        approachX: approach.x,
                        approachY: approach.y,
                        facing: sp.facingRad,
                        path: pTest,
                        len: estLen,
                      };
                    }
                  }
                }
              }

              if (bestCab) {
                entry.recMode = 'leaving_seat';
                entry.recPurpose = 'cabinet';
                entry.recHoldingFile = false;
                entry.recDeskFileTimer = 0;
                entry.recDeskApproachX = bestCab.approachX;
                entry.recDeskApproachY = bestCab.approachY;
                entry.recCabinetId = bestCab.id;
                entry.recCabinetFacing = bestCab.facing;
                entry.path = bestCab.path;
                entry.stuckTimer = 0;
              } else {
                entry.recDeskFileTimer = 3.2;
                latestRef.current.onReceptionCheckinDone?.(incomingPatient.id);
                entry.recTargetPatientId = undefined;
              }
            } else {
              // Priority 2: Occasional natural hydration break at the water cooler when lobby is calm
              entry.recStateTimer = (entry.recStateTimer ?? 18.0) - dt;
              if (
                entry.recStateTimer <= 0 &&
                !checkinPatient &&
                !curPatients.some((pt) => pt.state === 'arriving') &&
                deskItem
              ) {
                const busyCoolers = new Set(
                  curPatients
                    .filter(
                      (pt) =>
                        (pt.state === 'walking_to_water' || pt.state === 'drinking_water') &&
                        pt.waterCoolerId
                    )
                    .map((pt) => pt.waterCoolerId!)
                );

                let chosenCooler: {
                  id: string;
                  approachX: number;
                  approachY: number;
                  facing: number;
                  path: Array<{ x: number; y: number }>;
                  len: number;
                } | null = null;

                for (const item of curItems) {
                  if (item.catalogId !== 'water_cooler' || busyCoolers.has(item.instanceId)) continue;
                  const rm = curRooms.find(
                    (r) =>
                      item.gridX >= r.minX - 0.05 &&
                      item.gridX < r.maxX + 1 &&
                      item.gridY >= r.minY - 0.05 &&
                      item.gridY < r.maxY + 1
                  );
                  if (rm && !rm.unlocked) continue;

                  const approach = findDeskApproach(item.gridX, item.gridY);
                  const pref =
                    item.rotation === 0
                      ? { dx: 0, dy: 0.68 }
                      : item.rotation === 1
                        ? { dx: -0.68, dy: 0 }
                        : item.rotation === 2
                          ? { dx: 0, dy: -0.68 }
                          : { dx: 0.68, dy: 0 };

                  const cands = [
                    pref,
                    { dx: 0, dy: 0.68 },
                    { dx: 0.68, dy: 0 },
                    { dx: -0.68, dy: 0 },
                    { dx: 0, dy: -0.68 },
                  ];
                  for (const c of cands) {
                    const tx = item.gridX + c.dx;
                    const ty = item.gridY + c.dy;
                    if (!isTileWalkable(tx, ty, 0.21, obstacles)) continue;
                    const pTest = findGridPath(
                      approach.x,
                      approach.y,
                      tx,
                      ty,
                      curRooms,
                      curItems,
                      walkerFootprints,
                      obstacles
                    );
                    if (pTest.length > 0) {
                      const estLen =
                        Math.hypot(approach.x - entry.gx, approach.y - entry.gy) +
                        pTest.reduce(
                          (sum, n, idx) =>
                            sum +
                            Math.hypot(
                              n.x - (idx === 0 ? approach.x : pTest[idx - 1].x),
                              n.y - (idx === 0 ? approach.y : pTest[idx - 1].y)
                            ),
                          0
                        );
                      if (!chosenCooler || estLen < chosenCooler.len) {
                        chosenCooler = {
                          id: item.instanceId,
                          approachX: approach.x,
                          approachY: approach.y,
                          facing: Math.atan2(item.gridX - tx, item.gridY - ty),
                          path: pTest,
                          len: estLen,
                        };
                      }
                    }
                  }
                }

                if (chosenCooler) {
                  entry.recMode = 'leaving_seat';
                  entry.recPurpose = 'cooler';
                  entry.recHoldingFile = false;
                  entry.recDeskApproachX = chosenCooler.approachX;
                  entry.recDeskApproachY = chosenCooler.approachY;
                  entry.recCoolerId = chosenCooler.id;
                  entry.recCoolerFacing = chosenCooler.facing;
                  entry.path = chosenCooler.path;
                  entry.stuckTimer = 0;
                } else {
                  entry.recStateTimer = 9 + Math.random() * 6;
                }
              }
            }
          } else if (mode === 'leaving_seat') {
            if (entry.sitBlend < 0.22) {
              const goalNode = entry.path[entry.path.length - 1];
              const app =
                entry.recDeskApproachX !== undefined &&
                entry.recDeskApproachY !== undefined &&
                isTileWalkable(entry.recDeskApproachX, entry.recDeskApproachY, 0.21, obstacles)
                  ? { x: entry.recDeskApproachX, y: entry.recDeskApproachY }
                  : findDeskApproach(goalNode?.x, goalNode?.y);
              entry.recDeskApproachX = app.x;
              entry.recDeskApproachY = app.y;
              const dx = app.x - entry.gx;
              const dy = app.y - entry.gy;
              const dist = Math.hypot(dx, dy);
              const step = 1.38 * dt;
              const nextMode = entry.recPurpose === 'cabinet' ? 'to_cabinet' : 'to_cooler';
              const clearDirect =
                entry.path.length > 0 &&
                isTileWalkable(entry.gx, entry.gy, 0.21, obstacles) &&
                hasContinuousLineOfSight(entry.gx, entry.gy, entry.path[0].x, entry.path[0].y, 0.21, obstacles);
              if (dist <= Math.max(0.08, step) || clearDirect) {
                if (!clearDirect) {
                  entry.gx = app.x;
                  entry.gy = app.y;
                }
                entry.recMode = nextMode;
              } else {
                const res = resolveTileStep(
                  entry.gx,
                  entry.gy,
                  entry.gx + (dx / dist) * step,
                  entry.gy + (dy / dist) * step,
                  0.2,
                  obstacles,
                  deskItem?.instanceId
                );
                entry.gx = res.x;
                entry.gy = res.y;
                if (res.blocked) {
                  entry.recMode = nextMode;
                }
              }
            }
            targetX = entry.gx + 0.5;
            targetZ = entry.gy + 0.5;
          } else if (mode === 'to_cabinet') {
            const cabStillExists =
              entry.recCabinetId && curItems.find((it) => it.instanceId === entry!.recCabinetId);
            if (!cabStillExists) {
              const app = findDeskApproach(entry.gx, entry.gy);
              entry.recDeskApproachX = app.x;
              entry.recDeskApproachY = app.y;
              entry.path = findGridPath(
                entry.gx,
                entry.gy,
                app.x,
                app.y,
                curRooms,
                curItems,
                walkerFootprints,
                obstacles
              );
              entry.recMode = 'to_desk';
              entry.recCabinetId = undefined;
            } else if (entry.path.length > 0) {
              trimLongestLOS(entry.gx, entry.gy, entry.path, 0.21);
              const nextNode = entry.path[0];
              const dx = nextNode.x - entry.gx;
              const dy = nextNode.y - entry.gy;
              const dist = Math.hypot(dx, dy);
              const turnDiff = dist > 0.01 ? angleDiffAbs(entry.facingRad, Math.atan2(dx, dy)) : 0;
              const turnScale = turnDiff > 0.35 ? THREE.MathUtils.clamp(Math.cos(turnDiff * 0.75), 0.35, 1.0) : 1.0;
              const step = 1.26 * turnScale * dt;

              let avoidX = 0;
              let avoidY = 0;
              for (const pt of curPatients) {
                if (pt.state === 'in_treatment' || pt.state === 'ready_for_exam') continue;
                const ox = entry.gx - pt.gridX;
                const oy = entry.gy - pt.gridY;
                const od = Math.hypot(ox, oy);
                if (od > 0.01 && od < 0.62) {
                  const push = (0.62 - od) * 0.22;
                  avoidX += (ox / od) * push;
                  avoidY += (oy / od) * push;
                }
              }

              if (entry.path.length > 1 && dist <= 0.22) {
                entry.path.shift();
              } else if (dist <= Math.max(0.08, step)) {
                const res = resolveTileStep(entry.gx, entry.gy, nextNode.x, nextNode.y, 0.2, obstacles);
                entry.gx = res.x;
                entry.gy = res.y;
                entry.path.shift();
                entry.stuckTimer = 0;
              } else {
                const steerX = dx / dist + avoidX;
                const steerY = dy / dist + avoidY;
                const steerLen = Math.hypot(steerX, steerY) || 1;
                const res = resolveTileStep(
                  entry.gx,
                  entry.gy,
                  entry.gx + (steerX / steerLen) * step,
                  entry.gy + (steerY / steerLen) * step,
                  0.2,
                  obstacles
                );
                const movedDist = Math.hypot(res.x - entry.gx, res.y - entry.gy);
                entry.gx = res.x;
                entry.gy = res.y;
                if (res.blocked && movedDist < step * 0.24) {
                  entry.stuckTimer += dt;
                  if (entry.stuckTimer > 0.2) {
                    const dest = entry.path[entry.path.length - 1];
                    entry.path = dest
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
                    entry.stuckTimer = 0;
                    if (entry.path.length === 0) {
                      const app = findDeskApproach(entry.gx, entry.gy);
                      entry.recMode = 'to_desk';
                      entry.recCabinetId = undefined;
                      entry.path = findGridPath(
                        entry.gx,
                        entry.gy,
                        app.x,
                        app.y,
                        curRooms,
                        curItems,
                        walkerFootprints,
                        obstacles
                      );
                    }
                  }
                } else {
                  entry.stuckTimer = 0;
                }
              }
            } else {
              entry.recMode = 'at_cabinet';
              entry.recCabinetTimer = 0;
            }
            targetX = entry.gx + 0.5;
            targetZ = entry.gy + 0.5;
          } else if (mode === 'at_cabinet') {
            entry.recCabinetTimer = (entry.recCabinetTimer ?? 0) + dt;
            entry.recHoldingFile = entry.recCabinetTimer >= 0.55;
            if (entry.recCabinetTimer >= 1.45) {
              const placeApp = findPlaceApproach();
              entry.recDeskApproachX = placeApp.x;
              entry.recDeskApproachY = placeApp.y;
              entry.recHoldingFile = true;
              entry.path = findGridPath(
                entry.gx,
                entry.gy,
                placeApp.x,
                placeApp.y,
                curRooms,
                curItems,
                walkerFootprints,
                obstacles
              );
              entry.recMode = 'to_desk';
              entry.recCabinetId = undefined;
            }
            targetX = entry.gx + 0.5;
            targetZ = entry.gy + 0.5;
          } else if (mode === 'to_cooler') {
            const coolerStillFree =
              entry.recCoolerId &&
              curItems.some((it) => it.instanceId === entry.recCoolerId) &&
              !curPatients.some(
                (pt) => pt.state === 'drinking_water' && pt.waterCoolerId === entry.recCoolerId
              );

            if (!coolerStillFree) {
              const app = findDeskApproach(entry.gx, entry.gy);
              entry.recDeskApproachX = app.x;
              entry.recDeskApproachY = app.y;
              entry.path = findGridPath(
                entry.gx,
                entry.gy,
                app.x,
                app.y,
                curRooms,
                curItems,
                walkerFootprints,
                obstacles
              );
              entry.recMode = 'to_desk';
              entry.recCoolerId = undefined;
            } else if (entry.path.length > 0) {
              trimLongestLOS(entry.gx, entry.gy, entry.path, 0.21);
              const nextNode = entry.path[0];
              const dx = nextNode.x - entry.gx;
              const dy = nextNode.y - entry.gy;
              const dist = Math.hypot(dx, dy);
              const turnDiff = dist > 0.01 ? angleDiffAbs(entry.facingRad, Math.atan2(dx, dy)) : 0;
              const turnScale = turnDiff > 0.35 ? THREE.MathUtils.clamp(Math.cos(turnDiff * 0.75), 0.35, 1.0) : 1.0;
              const step = 1.24 * turnScale * dt;

              let avoidX = 0;
              let avoidY = 0;
              for (const pt of curPatients) {
                if (pt.state === 'in_treatment' || pt.state === 'ready_for_exam') continue;
                const ox = entry.gx - pt.gridX;
                const oy = entry.gy - pt.gridY;
                const od = Math.hypot(ox, oy);
                if (od > 0.01 && od < 0.62) {
                  const push = (0.62 - od) * 0.22;
                  avoidX += (ox / od) * push;
                  avoidY += (oy / od) * push;
                }
              }

              if (entry.path.length > 1 && dist <= 0.22) {
                entry.path.shift();
              } else if (dist <= Math.max(0.08, step)) {
                const res = resolveTileStep(entry.gx, entry.gy, nextNode.x, nextNode.y, 0.2, obstacles);
                entry.gx = res.x;
                entry.gy = res.y;
                entry.path.shift();
                entry.stuckTimer = 0;
              } else {
                const steerX = dx / dist + avoidX;
                const steerY = dy / dist + avoidY;
                const steerLen = Math.hypot(steerX, steerY) || 1;
                const res = resolveTileStep(
                  entry.gx,
                  entry.gy,
                  entry.gx + (steerX / steerLen) * step,
                  entry.gy + (steerY / steerLen) * step,
                  0.2,
                  obstacles
                );
                const movedDist = Math.hypot(res.x - entry.gx, res.y - entry.gy);
                entry.gx = res.x;
                entry.gy = res.y;
                if (res.blocked && movedDist < step * 0.24) {
                  entry.stuckTimer += dt;
                  if (entry.stuckTimer > 0.2) {
                    const dest = entry.path[entry.path.length - 1];
                    entry.path = dest
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
                    entry.stuckTimer = 0;
                    if (entry.path.length === 0) {
                      const app = findDeskApproach(entry.gx, entry.gy);
                      entry.recMode = 'to_desk';
                      entry.recCoolerId = undefined;
                      entry.path = findGridPath(
                        entry.gx,
                        entry.gy,
                        app.x,
                        app.y,
                        curRooms,
                        curItems,
                        walkerFootprints,
                        obstacles
                      );
                    }
                  }
                } else {
                  entry.stuckTimer = 0;
                }
              }
            } else {
              entry.recMode = 'drinking';
              entry.recDrinkTimer = 0;
            }
            targetX = entry.gx + 0.5;
            targetZ = entry.gy + 0.5;
          } else if (mode === 'drinking') {
            entry.recDrinkTimer = (entry.recDrinkTimer ?? 0) + dt;
            const wtMs = entry.recDrinkTimer * 1000;
            recDrinkElapsedMs = wtMs;
            const coolerEntry = entry.recCoolerId ? itemMeshes.get(entry.recCoolerId) : undefined;
            const wc = coolerEntry?.mesh.userData.waterCooler as WaterCoolerRigMeta | undefined;

            if (wtMs < 1450) {
              recDrinkStage = 'filling';
              if (wc) {
                const fillFrac = THREE.MathUtils.clamp(wtMs / 1220, 0.05, 1);
                wc.alcoveCup.visible = wtMs < 1250;
                wc.alcoveWater.scale.y = fillFrac;
                wc.alcoveWater.position.y = 0.008 + fillFrac * 0.028;
                wc.stream.visible = wtMs < 1220;
                wc.stream.scale.x = 0.85 + 0.18 * Math.sin(timeSec * 30);
                wc.stream.scale.z = wc.stream.scale.x;
                wc.bubble.visible = wtMs < 1220;
                wc.bubble.position.y = 0.98 + ((timeSec * 0.36) % 0.26);
              }
            } else if (wtMs < 3450) {
              recDrinkStage = 'sipping';
            } else if (wtMs < 3850) {
              recDrinkStage = 'returning';
              if (wtMs >= 3720 && entry.recCoolerId && wc) {
                coolerReturnUntil.set(entry.recCoolerId, timeSec + 8.5);
                wc.returnedCup.visible = true;
              }
            } else {
              const app = findDeskApproach(entry.gx, entry.gy);
              entry.recDeskApproachX = app.x;
              entry.recDeskApproachY = app.y;
              entry.path = findGridPath(
                entry.gx,
                entry.gy,
                app.x,
                app.y,
                curRooms,
                curItems,
                walkerFootprints,
                obstacles
              );
              entry.recMode = 'to_desk';
              entry.recCoolerId = undefined;
            }
            targetX = entry.gx + 0.5;
            targetZ = entry.gy + 0.5;
          } else if (mode === 'placing_file') {
            if (!deskItem || !deskPose) {
              entry.recHoldingFile = false;
              entry.recMode = 'desk';
              if (entry.recTargetPatientId) {
                latestRef.current.onReceptionCheckinDone?.(entry.recTargetPatientId);
                entry.recTargetPatientId = undefined;
              }
            } else {
              entry.recPlaceTimer = (entry.recPlaceTimer ?? 0) + dt;
              if (entry.recPlaceTimer >= 0.52 && entry.recHoldingFile) {
                entry.recHoldingFile = false;
                entry.recDeskFileTimer = 6.2;
                if (entry.recTargetPatientId) {
                  latestRef.current.onReceptionCheckinDone?.(entry.recTargetPatientId);
                  entry.recTargetPatientId = undefined;
                }
              }
              if (entry.recPlaceTimer >= 0.9) {
                const app = findDeskApproach(entry.gx, entry.gy);
                entry.recDeskApproachX = app.x;
                entry.recDeskApproachY = app.y;
                entry.path = findGridPath(
                  entry.gx,
                  entry.gy,
                  app.x,
                  app.y,
                  curRooms,
                  curItems,
                  walkerFootprints,
                  obstacles
                );
                entry.recMode = 'to_desk';
              }
            }
            targetX = entry.gx + 0.5;
            targetZ = entry.gy + 0.5;
          } else {
            // recMode === 'to_desk': walk to file placement spot if carrying file, else return smoothly to chair
            const carryingForPlace = Boolean(entry.recHoldingFile && deskItem && deskPose);
            const latestApp = carryingForPlace
              ? findPlaceApproach()
              : findDeskApproach(entry.gx, entry.gy);
            if (
              entry.recDeskApproachX === undefined ||
              entry.recDeskApproachY === undefined ||
              Math.hypot(latestApp.x - entry.recDeskApproachX, latestApp.y - entry.recDeskApproachY) > 0.35
            ) {
              entry.recDeskApproachX = latestApp.x;
              entry.recDeskApproachY = latestApp.y;
              entry.path = findGridPath(
                entry.gx,
                entry.gy,
                latestApp.x,
                latestApp.y,
                curRooms,
                curItems,
                walkerFootprints,
                obstacles
              );
            }

            if (entry.path.length > 0) {
              trimLongestLOS(entry.gx, entry.gy, entry.path, 0.21);
              const nextNode = entry.path[0];
              const dx = nextNode.x - entry.gx;
              const dy = nextNode.y - entry.gy;
              const dist = Math.hypot(dx, dy);
              const turnDiff = dist > 0.01 ? angleDiffAbs(entry.facingRad, Math.atan2(dx, dy)) : 0;
              const turnScale = turnDiff > 0.35 ? THREE.MathUtils.clamp(Math.cos(turnDiff * 0.75), 0.35, 1.0) : 1.0;
              const step = 1.26 * turnScale * dt;
              if (entry.path.length > 1 && dist <= 0.22) {
                entry.path.shift();
              } else if (dist <= Math.max(0.08, step)) {
                const res = resolveTileStep(entry.gx, entry.gy, nextNode.x, nextNode.y, 0.2, obstacles);
                entry.gx = res.x;
                entry.gy = res.y;
                entry.path.shift();
                entry.stuckTimer = 0;
              } else {
                const res = resolveTileStep(
                  entry.gx,
                  entry.gy,
                  entry.gx + (dx / dist) * step,
                  entry.gy + (dy / dist) * step,
                  0.2,
                  obstacles
                );
                const movedDist = Math.hypot(res.x - entry.gx, res.y - entry.gy);
                entry.gx = res.x;
                entry.gy = res.y;
                if (res.blocked && movedDist < step * 0.24) {
                  entry.stuckTimer += dt;
                  if (entry.stuckTimer > 0.2) {
                    const dest = entry.path[entry.path.length - 1];
                    entry.path = dest
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
                    entry.stuckTimer = 0;
                  }
                } else {
                  entry.stuckTimer = 0;
                }
              }
              targetX = entry.gx + 0.5;
              targetZ = entry.gy + 0.5;
            } else if (carryingForPlace) {
              // Arrived right beside the reception desk carrying the chart -> place it cleanly on the table
              entry.recMode = 'placing_file';
              entry.recPlaceTimer = 0;
              targetX = entry.gx + 0.5;
              targetZ = entry.gy + 0.5;
            } else {
              const goalGx = seatX - 0.5;
              const goalGy = seatZ - 0.5;
              const dx = goalGx - entry.gx;
              const dy = goalGy - entry.gy;
              const dist = Math.hypot(dx, dy);
              const step = 1.18 * dt;
              const hasDeskFile = (entry.recDeskFileTimer ?? 0) > 0;
              if (dist <= Math.max(0.1, step)) {
                entry.gx = goalGx;
                entry.gy = goalGy;
                entry.recMode = 'desk';
                entry.recHoldingFile = false;
                entry.recStateTimer = 18 + Math.random() * 14;
                entry.recSeatedActivity = hasDeskFile ? 'writing' : 'typing';
                entry.recActivityTimer = 4 + Math.random() * 4;
              } else {
                const res = resolveTileStep(
                  entry.gx,
                  entry.gy,
                  entry.gx + (dx / dist) * step,
                  entry.gy + (dy / dist) * step,
                  0.18,
                  obstacles,
                  deskItem?.instanceId
                );
                const moved = Math.hypot(res.x - entry.gx, res.y - entry.gy);
                entry.gx = res.x;
                entry.gy = res.y;
                if (res.blocked && moved < step * 0.15) {
                  entry.gx = goalGx;
                  entry.gy = goalGy;
                  entry.recMode = 'desk';
                  entry.recHoldingFile = false;
                  entry.recStateTimer = 18 + Math.random() * 14;
                }
              }
              targetX = entry.gx + 0.5;
              targetZ = entry.gy + 0.5;
            }
          }
        } else {
          // Therapist autonomous smooth patrol across unlocked rooms & near active patients
          if (entry.path.length > 0) {
            trimLongestLOS(entry.gx, entry.gy, entry.path, 0.24);

            const nextNode = entry.path[0];
            const dx = nextNode.x - entry.gx;
            const dy = nextNode.y - entry.gy;
            const dist = Math.hypot(dx, dy);
            const turnDiff = dist > 0.01 ? angleDiffAbs(entry.facingRad, Math.atan2(dx, dy)) : 0;
            const turnScale = turnDiff > 0.35 ? THREE.MathUtils.clamp(Math.cos(turnDiff * 0.75), 0.35, 1.0) : 1.0;
            const step = 1.20 * turnScale * dt;

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
                if (od > 0.01 && od < 0.68) {
                  const push = (0.68 - od) * 0.24;
                  avoidX += (ox / od) * push;
                  avoidY += (oy / od) * push;
                }
              }
            }

            if (entry.path.length > 1 && dist <= 0.22) {
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
                  const wasLastNode = entry.path.length <= 1;
                  const rerouted =
                    dest && !wasLastNode
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
                  if (rerouted.length === 0 || (wasLastNode && rerouted.length <= 1)) {
                    entry.path = [];
                    entry.pauseTimer = 0.15;
                    if (!isTileWalkable(entry.gx, entry.gy, 0.22, obstacles)) {
                      const safe = findNearestWalkableTile(entry.gx, entry.gy, 0.24, obstacles);
                      entry.gx = safe.x;
                      entry.gy = safe.y;
                    }
                  } else {
                    entry.path = rerouted;
                  }
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
        const recActiveMode = entry.recMode || 'desk';
        if (s.role === 'receptionist') {
          const isSeatTransition =
            recActiveMode === 'desk' ||
            recActiveMode === 'leaving_seat' ||
            (recActiveMode === 'to_desk' && entry.path.length === 0);
          if (isSeatTransition) {
            entry.visX = THREE.MathUtils.damp(entry.visX, targetX, 15.0, dt);
            entry.visZ = THREE.MathUtils.damp(entry.visZ, targetZ, 15.0, dt);
          } else {
            // Walking path already moves cleanly via resolveTileStep (zero corner lag snag!)
            entry.visX = targetX;
            entry.visZ = targetZ;
          }
        } else {
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
        const recWalking =
          s.role === 'receptionist' &&
          recActiveMode !== 'desk' &&
          recActiveMode !== 'drinking' &&
          recActiveMode !== 'at_cabinet' &&
          recActiveMode !== 'placing_file' &&
          !(recActiveMode === 'leaving_seat' && entry.sitBlend >= 0.22);
        const logicalMoving =
          s.role === 'receptionist'
            ? recWalking && (entry.path.length > 0 || distRem > 0.04)
            : entry.path.length > 0 || distRem > 0.05;
        isMoving =
          s.role === 'receptionist'
            ? recWalking && (realSpeed > 0.1 || (logicalMoving && stepDist > 0.0016))
            : realSpeed > 0.12 || (logicalMoving && stepDist > 0.0018);

        entry.walkBlend = THREE.MathUtils.damp(entry.walkBlend, isMoving ? 1 : 0, 12.0, dt);
        const shouldStaffSit =
          s.role === 'receptionist' && recActiveMode === 'desk' && distRem < 0.25;
        entry.sitBlend = THREE.MathUtils.damp(entry.sitBlend, shouldStaffSit ? 1 : 0, 7.8, dt);

        const staffPushTarget = computeDoorPushTarget(
          entry.visX,
          entry.visZ,
          entry.vx,
          entry.vz,
          isMoving && !shouldStaffSit,
          worldDoors,
          unlockedSet
        );
        entry.doorPush = THREE.MathUtils.damp(
          entry.doorPush,
          staffPushTarget,
          staffPushTarget > entry.doorPush ? 14 : 8,
          dt
        );

        const surfSt = getSurfaceElevation(entry.visX, entry.visZ);
        entry.groundY = THREE.MathUtils.damp(
          entry.groundY,
          surfSt.actorY,
          surfSt.onStairs ? 22.0 : 18.0,
          dt
        );
        const rawStairClimbSt =
          surfSt.onStairs && isMoving ? THREE.MathUtils.clamp(-entry.vx / 1.05, -1, 1) : 0;
        entry.stairClimb = THREE.MathUtils.damp(entry.stairClimb, rawStairClimbSt, 11.0, dt);

        const prevFacingSt = entry.facingRad;
        if (stepDist > 0.0005 && (isMoving || entry.walkBlend > 0.04)) {
          entry.walkPhase += stepDist * (surfSt.onStairs ? 8.5 : 7.2);
          if (stepDist > 0.0008 && isMoving) {
            const targetAngle = Math.atan2(mdx, mdz);
            entry.facingRad = lerpAngle(entry.facingRad, targetAngle, Math.min(1, dt * 12.5));
          }
        }

        if (!isMoving) {
          if (s.role === 'receptionist') {
            if (recActiveMode === 'drinking' && entry.recCoolerFacing !== undefined) {
              entry.facingRad = lerpAngle(entry.facingRad, entry.recCoolerFacing, Math.min(1, dt * 10));
            } else if (recActiveMode === 'at_cabinet' && entry.recCabinetFacing !== undefined) {
              entry.facingRad = lerpAngle(entry.facingRad, entry.recCabinetFacing, Math.min(1, dt * 10));
            } else if (recActiveMode === 'placing_file') {
              const deskObj = curItems.find((it) => it.catalogId === 'reception_desk');
              if (deskObj) {
                const dp = getReceptionDeskPose(deskObj);
                const placeLook = Math.atan2(
                  dp.deskFileWorldX - entry.visX,
                  dp.deskFileWorldZ - entry.visZ
                );
                entry.facingRad = lerpAngle(entry.facingRad, placeLook, Math.min(1, dt * 14));
              }
            } else if (recActiveMode === 'desk') {
              const checkinPt = curPatients.find((pt) => pt.state === 'checkin_at_desk');
              let desiredFacing = recSeatFacing;
              if (checkinPt) {
                const ptRig = patientRigs.get(checkinPt.id);
                const px = ptRig ? ptRig.visX : checkinPt.gridX + 0.5;
                const pz = ptRig ? ptRig.visZ : checkinPt.gridY + 0.5;
                const rawAng = Math.atan2(px - entry.visX, pz - entry.visZ);
                let delta = rawAng - recSeatFacing;
                while (delta > Math.PI) delta -= Math.PI * 2;
                while (delta < -Math.PI) delta += Math.PI * 2;
                desiredFacing = recSeatFacing + THREE.MathUtils.clamp(delta, -0.55, 0.55);
              }
              entry.facingRad = lerpAngle(entry.facingRad, desiredFacing, Math.min(1, dt * 8));
            }
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

        const rawTurnSt = isMoving
          ? THREE.MathUtils.clamp(
              (shortestAngleDelta(prevFacingSt, entry.facingRad) / Math.max(0.008, dt)) * 0.022,
              -0.09,
              0.09
            )
          : 0;
        entry.turnLean = THREE.MathUtils.damp(entry.turnLean, rawTurnSt, 9.0, dt);

        entry.rig.root.position.set(entry.visX, entry.groundY, entry.visZ);
        entry.rig.root.visible = !(isPlayerActor && fppSmoothNow > 0.45);
        animateHumanoid3D(entry.rig, {
          pose: shouldStaffSit ? 'seated' : 'standing',
          walkPhase: entry.walkPhase,
          isMoving,
          walkBlend: entry.walkBlend,
          sitBlend: entry.sitBlend,
          doorPush: entry.doorPush,
          seatHeight: recSeatHeight,
          facingRad: entry.facingRad,
          turnLean: entry.turnLean,
          timeSec,
          isSelected: false,
          isDrinking: recActiveMode === 'drinking',
          drinkStage: recActiveMode === 'drinking' ? recDrinkStage : 'none',
          drinkElapsedMs: recActiveMode === 'drinking' ? recDrinkElapsedMs : undefined,
          holdingFile: s.role === 'receptionist' && Boolean(entry.recHoldingFile),
          pickingFile: s.role === 'receptionist' && recActiveMode === 'at_cabinet',
          pickElapsedMs:
            s.role === 'receptionist' && recActiveMode === 'at_cabinet'
              ? (entry.recCabinetTimer ?? 0) * 1000
              : undefined,
          placingFile: s.role === 'receptionist' && recActiveMode === 'placing_file',
          placeElapsedMs:
            s.role === 'receptionist' && recActiveMode === 'placing_file'
              ? (entry.recPlaceTimer ?? 0) * 1000
              : undefined,
          actorSeed: entry.actorSeed,
          seatedActivity:
            s.role === 'receptionist' && shouldStaffSit
              ? entry.recSeatedActivity || 'typing'
              : 'idle',
          stairClimb: entry.stairClimb,
        });
      };

      if (includePlayer) {
        processStaffMember(playerStaffSpec);
      }
      for (let si = 0; si < curStaff.length; si++) {
        processStaffMember(curStaff[si]);
      }

      for (const [id, entry] of staffRigs.entries()) {
        if (!activeStaffIds.has(id)) {
          actorsLayer.remove(entry.rig.root);
          disposeHumanoid3D(entry.rig);
          staffRigs.delete(id);
        }
      }
    };

    let cachedOverlayCanvas: HTMLCanvasElement | null = null;
    let cachedOverlayCtx: CanvasRenderingContext2D | null = null;
    let overlayWasNonEmpty = true;
    const _sp0 = { x: 0, y: 0 };
    const _sp1 = { x: 0, y: 0 };
    const _sp2 = { x: 0, y: 0 };
    const _sp3 = { x: 0, y: 0 };

    const drawOverlayBadges = () => {
      const overlay = overlayCanvasRef.current;
      if (!overlay) return;

      const {
        rooms: curRooms,
        placedItems: curItems,
        placementDraft: curDraft,
        editMode: isEdit,
        floatingFeedbacks: fbs,
        focusedPatientId: focId,
        language: lang,
        selectedTreeId: selTreeId,
        isPlacementValid: checkValid,
      } = latestRef.current;

      let hasLockedRooms = false;
      for (let i = 0; i < curRooms.length; i++) {
        if (!curRooms[i].unlocked) {
          hasLockedRooms = true;
          break;
        }
      }
      const isEmptyOverlay =
        !sceneAssetsInitialized ||
        (!curDraft && !isEdit && !selTreeId && fbs.length === 0 && !hasLockedRooms);

      if (isEmptyOverlay && !overlayWasNonEmpty) {
        return;
      }

      const w = Math.max(1, overlay.clientWidth || containerW);
      const h = Math.max(1, overlay.clientHeight || containerH);

      const odpr = getTargetDpr(w, h);
      const targetOvW = Math.max(1, Math.round(w * odpr));
      const targetOvH = Math.max(1, Math.round(h * odpr));
      if (overlay.width !== targetOvW || overlay.height !== targetOvH) {
        overlay.width = targetOvW;
        overlay.height = targetOvH;
      }

      if (overlay !== cachedOverlayCanvas) {
        cachedOverlayCanvas = overlay;
        cachedOverlayCtx = overlay.getContext('2d');
      }
      const ctx = cachedOverlayCtx;
      if (!ctx) return;
      ctx.setTransform(targetOvW / w, 0, 0, targetOvH / h, 0, 0);
      ctx.clearRect(0, 0, w, h);

      if (fppCamRef.current.blend > 0.08) {
        if (overlayWasNonEmpty) {
          const wClr = Math.max(1, overlay.clientWidth || containerW);
          const hClr = Math.max(1, overlay.clientHeight || containerH);
          if (overlay !== cachedOverlayCanvas) {
            cachedOverlayCanvas = overlay;
            cachedOverlayCtx = overlay.getContext('2d');
          }
          if (cachedOverlayCtx) {
            cachedOverlayCtx.setTransform(1, 0, 0, 1, 0, 0);
            cachedOverlayCtx.clearRect(0, 0, overlay.width || wClr, overlay.height || hClr);
          }
          overlayWasNonEmpty = false;
        }
        return;
      }

      if (isEmptyOverlay) {
        overlayWasNonEmpty = false;
        return;
      }
      overlayWasNonEmpty = true;

      const projectToScreen = (
        wx: number,
        wy: number,
        wz: number,
        out: { x: number; y: number } = _sp0
      ) => {
        _projVec.set(wx, wy, wz).project(camera);
        out.x = (_projVec.x * 0.5 + 0.5) * w;
        out.y = (-_projVec.y * 0.5 + 0.5) * h;
        return out;
      };

      const drawWallBracket = (
        gx: number,
        gy: number,
        rot: 0 | 1 | 2 | 3,
        strokeColor: string,
        fillColor: string | null,
        lineWidth = 2.0
      ) => {
        const onOuter = (rot === 0 && gx === 2) || (rot === 1 && gy === 2);
        const yLow = (onOuter ? 1.18 : 0.78) + CLINIC_FLOOR_ELEV;
        const yHigh = (onOuter ? 2.18 : 1.72) + CLINIC_FLOOR_ELEV;
        if (rot === 0) {
          const wx = gx === 2 ? 2.155 : 12.105;
          projectToScreen(wx, yLow, gy + 0.08, _sp0);
          projectToScreen(wx, yLow, gy + 0.92, _sp1);
          projectToScreen(wx, yHigh, gy + 0.92, _sp2);
          projectToScreen(wx, yHigh, gy + 0.08, _sp3);
        } else {
          const wz = gy === 2 ? 2.155 : 10.105;
          projectToScreen(gx + 0.08, yLow, wz, _sp0);
          projectToScreen(gx + 0.92, yLow, wz, _sp1);
          projectToScreen(gx + 0.92, yHigh, wz, _sp2);
          projectToScreen(gx + 0.08, yHigh, wz, _sp3);
        }
        if (fillColor) {
          ctx.fillStyle = fillColor;
          ctx.beginPath();
          ctx.moveTo(_sp0.x, _sp0.y);
          ctx.lineTo(_sp1.x, _sp1.y);
          ctx.lineTo(_sp2.x, _sp2.y);
          ctx.lineTo(_sp3.x, _sp3.y);
          ctx.closePath();
          ctx.fill();
        }
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(_sp0.x, _sp0.y);
        ctx.lineTo(_sp1.x, _sp1.y);
        ctx.lineTo(_sp2.x, _sp2.y);
        ctx.lineTo(_sp3.x, _sp3.y);
        ctx.closePath();
        ctx.stroke();
      };

      const drawFloorCornerBrackets = (
        x0: number,
        z0: number,
        wTile: number,
        dTile: number,
        strokeColor: string,
        fillColor: string | null,
        lineWidth = 2.4
      ) => {
        const pad = 0.04;
        const ax = x0 + pad;
        const bx = x0 + wTile - pad;
        const az = z0 + pad;
        const bz = z0 + dTile - pad;
        const arm = Math.min(0.28, wTile * 0.28, dTile * 0.28);
        const floorSurfY = getSurfaceElevation(x0 + 0.5, z0 + 0.5).floorY;
        const fillY = floorSurfY + 0.015;
        const lineY = floorSurfY + 0.025;

        if (fillColor) {
          projectToScreen(ax, fillY, az, _sp0);
          projectToScreen(bx, fillY, az, _sp1);
          projectToScreen(bx, fillY, bz, _sp2);
          projectToScreen(ax, fillY, bz, _sp3);
          ctx.fillStyle = fillColor;
          ctx.beginPath();
          ctx.moveTo(_sp0.x, _sp0.y);
          ctx.lineTo(_sp1.x, _sp1.y);
          ctx.lineTo(_sp2.x, _sp2.y);
          ctx.lineTo(_sp3.x, _sp3.y);
          ctx.closePath();
          ctx.fill();
        }

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const drawCorner = (cx: number, cz: number, sx: number, sz: number) => {
          projectToScreen(cx + sx * arm, lineY, cz, _sp0);
          projectToScreen(cx, lineY, cz, _sp1);
          projectToScreen(cx, lineY, cz + sz * arm, _sp2);
          ctx.beginPath();
          ctx.moveTo(_sp0.x, _sp0.y);
          ctx.lineTo(_sp1.x, _sp1.y);
          ctx.lineTo(_sp2.x, _sp2.y);
          ctx.stroke();
        };
        drawCorner(ax, az, 1, 1);
        drawCorner(bx, az, -1, 1);
        drawCorner(bx, bz, -1, -1);
        drawCorner(ax, bz, 1, -1);
      };

      // 0. Clean Architectural Placement Outline (zero full-clinic wireframe clutter!)
      if (curDraft && !focId) {
        ctx.save();
        const effW = curDraft.rotation % 2 === 0 ? curDraft.catalogItem.width : curDraft.catalogItem.depth;
        const effD = curDraft.rotation % 2 === 0 ? curDraft.catalogItem.depth : curDraft.catalogItem.width;
        const valid = checkValid(curDraft.hoverX, curDraft.hoverY, curDraft);
        const accent = valid ? '#10b981' : '#ef4444';
        const tint = valid ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.10)';

        if (curDraft.catalogItem.isWallDecor) {
          drawWallBracket(curDraft.hoverX, curDraft.hoverY, curDraft.rotation, accent, tint, 2.2);
        } else {
          // Subtle micro-dots ONLY at immediate +-1 surrounding corners while actively dragging for clean alignment
          if (draggingDraftActiveRef.current) {
            const dotY =
              getSurfaceElevation(curDraft.hoverX + 0.5, curDraft.hoverY + 0.5).floorY + 0.015;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.34)';
            for (
              let gx = Math.floor(curDraft.hoverX) - 1;
              gx <= Math.ceil(curDraft.hoverX + effW) + 1;
              gx++
            ) {
              for (
                let gz = Math.floor(curDraft.hoverY) - 1;
                gz <= Math.ceil(curDraft.hoverY + effD) + 1;
                gz++
              ) {
                const pt = projectToScreen(gx, dotY, gz);
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, 1.5, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }
          drawFloorCornerBrackets(curDraft.hoverX, curDraft.hoverY, effW, effD, accent, tint, 2.6);
        }
        ctx.restore();
      }

      // 1. Fixed Compact Locked Wing Badges (small, crisp, constant screen-space dimensions)
      for (const room of curRooms) {
        if (room.unlocked) continue;
        const cx = (room.minX + room.maxX + 1) / 2;
        const cz = (room.minY + room.maxY + 1) / 2;
        const sp = projectToScreen(cx, 1.85 + CLINIC_FLOOR_ELEV, cz);

        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.roundRect(sp.x - 36, sp.y - 14, 72, 28, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fbbf24';
        ctx.font = '800 10px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`🔒 ${room.unlockCost}`, sp.x, sp.y - 4.5);

        ctx.fillStyle = '#e2e8f0';
        ctx.font = '700 8.5px "Cairo", sans-serif';
        ctx.fillText(lang === 'ar' ? 'اضغط للفتح' : 'Tap to Open', sp.x, sp.y + 6.5);
        ctx.restore();
      }

      // 3. Minimal Edit-Mode Highlights (hovered item stands out crisply; wall items highlight on wall face)
      if (isEdit && !curDraft && !focId) {
        ctx.save();
        const hoveredId = hoveredEditItemIdRef.current;
        for (const item of curItems) {
          const cat = latestRef.current.catalogMap.get(item.catalogId);
          if (!cat) continue;
          const isHovered = hoveredId === item.instanceId;
          if (cat.isWallDecor) {
            drawWallBracket(
              item.gridX,
              item.gridY,
              item.rotation,
              isHovered ? 'rgba(56, 189, 248, 0.92)' : 'rgba(148, 163, 184, 0.42)',
              isHovered ? 'rgba(56, 189, 248, 0.10)' : null,
              isHovered ? 2.1 : 1.1
            );
          } else {
            const effW = item.rotation % 2 === 0 ? cat.width : cat.depth;
            const effD = item.rotation % 2 === 0 ? cat.depth : cat.width;
            drawFloorCornerBrackets(
              item.gridX,
              item.gridY,
              effW,
              effD,
              isHovered ? 'rgba(56, 189, 248, 0.92)' : 'rgba(148, 163, 184, 0.36)',
              isHovered ? 'rgba(56, 189, 248, 0.09)' : null,
              isHovered ? 2.4 : 1.2
            );
          }
        }
        ctx.restore();
      }

      // 3b. Selected Outer Tree Highlight Ring (for removal confirmation)
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
        const fbSurf = getSurfaceElevation(fb.gridX + 0.5, fb.gridY + 0.5);
        const sp = projectToScreen(
          fb.gridX + 0.5,
          fbSurf.actorY + 1.86 + age * 0.95,
          fb.gridY + 0.5
        );
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

    const pushDoorActor = (x: number, z: number, vx: number, vz: number, isMoving: boolean) => {
      const idx = doorActorsScratch.length;
      if (idx >= doorActorsPool.length) {
        doorActorsPool.push({ x, z, vx, vz, isMoving });
      } else {
        const slot = doorActorsPool[idx];
        slot.x = x;
        slot.z = z;
        slot.vx = vx;
        slot.vz = vz;
        slot.isMoving = isMoving;
      }
      doorActorsScratch.push(doorActorsPool[idx]);
    };

    let lastShowItemMicro = true;
    let wasPureFpp = false;
    let lastIsolatedStationId: string | null = null;
    const tick = () => {
      if (disposed) return;
      const nowMs = performance.now();
      const dt = Math.min(0.08, Math.max(0.001, (nowMs - lastMs) / 1000));
      lastMs = nowMs;

      const cs = camStateRef.current;
      const fpp = fppCamRef.current;
      const curFppId = latestRef.current.firstPersonPatientId ?? null;
      const isPureFpp = Boolean(curFppId);
      const tSec = nowMs * 0.001;

      if (curFppId && curFppId !== fpp.activeId) {
        fpp.activeId = curFppId;
        const pRig = patientRigs.get(curFppId);
        const pObj = latestRef.current.patients.find((pt) => pt.id === curFppId);
        const px = pRig ? pRig.visX : pObj ? pObj.gridX + 0.5 : 4.5;
        const pz = pRig ? pRig.visZ : pObj ? pObj.gridY + 0.5 : 16.5;
        const facing = pRig ? pRig.facingRad : 0;
        const surfPt = getSurfaceElevation(px, pz);
        const pfX = Math.sin(facing);
        const pfZ = Math.cos(facing);

        // Universal enclosed FPP bay: anchor cleanly in front of the bed without clipping outer clinic walls
        const anchorX = px + pfX * 1.14;
        const anchorZ = pz + pfZ * 1.14;

        fpp.patientX = px;
        fpp.patientZ = pz;
        fpp.patientFacing = facing;
        fpp.anchorX = anchorX;
        fpp.anchorZ = anchorZ;
        fpp.roomMinX = -999;
        fpp.roomMaxX = 999;
        fpp.roomMinZ = -999;
        fpp.roomMaxZ = 999;
        fpp.baseY = surfPt.floorY + 1.24;
        fpp.posX = anchorX;
        fpp.posZ = anchorZ;
        fpp.posY = fpp.baseY;
        fpp.baseYaw = Math.atan2(-(px - anchorX), -(pz - anchorZ));
        fpp.yawOffset = 0;
        fpp.targetYawOffset = 0;
        fpp.yaw = fpp.baseYaw;
        fpp.pitch = -0.09;
        fpp.targetPitch = -0.09;
        fpp.walkBob = 0;
        fpp.blend = 1;

        fppBackdrop.group.position.set(px, surfPt.floorY, pz);
        fppBackdrop.group.rotation.set(0, facing, 0);

        cs.targetX = px;
        cs.targetZ = pz;
        cs.panVelX = 0;
        cs.panVelZ = 0;
      } else if (!curFppId && fpp.activeId) {
        fpp.activeId = null;
        fpp.blend = 0;
      } else {
        fpp.blend = isPureFpp ? 1 : 0;
      }

      if (isPureFpp) {
        // Silky clamped FPP look inside the enclosed bay
        fpp.yawOffset = THREE.MathUtils.damp(fpp.yawOffset, fpp.targetYawOffset, 18, dt);
        fpp.pitch = THREE.MathUtils.damp(fpp.pitch, fpp.targetPitch, 18, dt);
        fpp.yaw = fpp.baseYaw + fpp.yawOffset;

        const joy = latestRef.current.fppMoveInputRef?.current ?? { x: 0, y: 0 };
        const keys = fppKeysRef.current;
        let inRight = THREE.MathUtils.clamp(joy.x + (keys.d ? 1 : 0) - (keys.a ? 1 : 0), -1, 1);
        let inFwd = THREE.MathUtils.clamp(joy.y + (keys.w ? 1 : 0) - (keys.s ? 1 : 0), -1, 1);
        const mag = Math.hypot(inRight, inFwd);
        if (mag > 1) {
          inRight /= mag;
          inFwd /= mag;
        }
        if (mag > 0.04) {
          const fwdX = -Math.sin(fpp.yaw);
          const fwdZ = -Math.cos(fpp.yaw);
          const rightX = Math.cos(fpp.yaw);
          const rightZ = -Math.sin(fpp.yaw);
          const moveSpeed = 1.24;
          const rawX = fpp.posX + (fwdX * inFwd + rightX * inRight) * moveSpeed * dt;
          const rawZ = fpp.posZ + (fwdZ * inFwd + rightZ * inRight) * moveSpeed * dt;

          // Keep clinician cleanly inside the universal 4-walled examination bay (and clear of the bed/patient)
          const pfX = Math.sin(fpp.patientFacing);
          const pfZ = Math.cos(fpp.patientFacing);
          const prX = Math.cos(fpp.patientFacing);
          const prZ = -Math.sin(fpp.patientFacing);
          const relX = rawX - fpp.patientX;
          const relZ = rawZ - fpp.patientZ;
          let fwdDist = THREE.MathUtils.clamp(relX * pfX + relZ * pfZ, 0.66, 2.25);
          let sideDist = THREE.MathUtils.clamp(relX * prX + relZ * prZ, -1.65, 1.65);
          const rDist = Math.hypot(fwdDist, sideDist);
          if (rDist < 0.78 && rDist > 0.001) {
            const sc = 0.78 / rDist;
            fwdDist = Math.max(0.66, fwdDist * sc);
            sideDist *= sc;
          }

          const candX = fpp.patientX + pfX * fwdDist + prX * sideDist;
          const candZ = fpp.patientZ + pfZ * fwdDist + prZ * sideDist;
          const moved = Math.hypot(candX - fpp.posX, candZ - fpp.posZ);
          fpp.posX = candX;
          fpp.posZ = candZ;
          if (moved > 0.0008) {
            fpp.walkBob += moved * 7.5;
          }
          const bobOffset = moved > 0.0005 ? Math.sin(fpp.walkBob) * 0.013 : 0;
          fpp.posY = THREE.MathUtils.damp(fpp.posY, fpp.baseY + bobOffset, 14, dt);
        } else {
          fpp.posY = THREE.MathUtils.damp(fpp.posY, fpp.baseY, 12, dt);
        }

        updateCameraTransform();

        // Pure FPP Isolation: hide outside clinic, staff, and non-session patients
        const fppPatient = latestRef.current.patients.find((pt) => pt.id === curFppId);
        const fppStationId = fppPatient?.assignedStationId ?? null;

        if (!wasPureFpp || lastIsolatedStationId !== fppStationId) {
          lastIsolatedStationId = fppStationId;
          worldLayer.visible = false;
          draftLayer.visible = false;
          lightsLayer.visible = false;
          itemsLayer.visible = Boolean(fppStationId);
          for (const [id, entry] of itemMeshes.entries()) {
            entry.mesh.visible = id === fppStationId;
          }
          for (const [id, entry] of patientRigs.entries()) {
            entry.rig.root.visible = id === curFppId;
          }
          for (const entry of staffRigs.values()) {
            entry.rig.root.visible = false;
          }
          const fog = scene.fog as THREE.Fog;
          fog.near = 25;
          fog.far = 65;
          renderer.toneMappingExposure = 0.96;
          drawOverlayBadges();
        }

        fppBackdrop.group.visible = true;
        fppBackdrop.setLightFactor(1, latestRef.current.lightingMode === 'night');
        fppHands.updateMotion(
          1,
          fpp.walkBob,
          tSec,
          Boolean(latestRef.current.speakingPatientId),
          camera.aspect
        );

        syncAndAnimateActors(tSec, dt, curFppId);
        renderer.render(scene, camera);
      } else {
        if (wasPureFpp) {
          lastIsolatedStationId = null;
          worldLayer.visible = true;
          itemsLayer.visible = true;
          for (const entry of itemMeshes.values()) {
            entry.mesh.visible = true;
          }
          draftLayer.visible = true;
          lightsLayer.visible = true;
          fppBackdrop.group.visible = false;
          fppBackdrop.setLightFactor(0, false);
          fppHands.updateMotion(0, 0, tSec, false, camera.aspect);
          cs.curX = cs.targetX;
          cs.curZ = cs.targetZ;
          atmoDirty = true;
        }

        if (!latestRef.current.focusedPatientId && (Math.abs(cs.panVelX) > 0.005 || Math.abs(cs.panVelZ) > 0.005)) {
          cs.targetX = Math.max(PAN_MIN_X, Math.min(PAN_MAX_X, cs.targetX + cs.panVelX * dt));
          cs.targetZ = Math.max(PAN_MIN_Z, Math.min(PAN_MAX_Z, cs.targetZ + cs.panVelZ * dt));
          cs.panVelX = THREE.MathUtils.damp(cs.panVelX, 0, 6.5, dt);
          cs.panVelZ = THREE.MathUtils.damp(cs.panVelZ, 0, 6.5, dt);
        } else {
          cs.panVelX = 0;
          cs.panVelZ = 0;
        }
        cs.curX = THREE.MathUtils.damp(cs.curX, cs.targetX, 9.5, dt);
        cs.curZ = THREE.MathUtils.damp(cs.curZ, cs.targetZ, 9.5, dt);
        cs.curZoom = THREE.MathUtils.damp(cs.curZoom, cs.targetZoom, 10, dt);
        cs.curYaw = THREE.MathUtils.damp(cs.curYaw, cs.targetYaw, 8, dt);
        updateCameraTransform();

        worldLayer.visible = true;
        itemsLayer.visible = true;
        draftLayer.visible = true;
        lightsLayer.visible = true;
        fppBackdrop.group.visible = false;
        fppBackdrop.setLightFactor(0, false);
        fppHands.updateMotion(0, 0, tSec, false, camera.aspect);

        const effectiveLodZoom = cs.curZoom;
        if (worldHandle) {
          textures.waterNormal.offset.x = (tSec * 0.045) % 1;
          textures.waterNormal.offset.y = (tSec * 0.032) % 1;
          worldHandle.setZoomLod(effectiveLodZoom);
        }
        if (animatedFountains.length > 0 && effectiveLodZoom >= 0.85) {
          for (let fi = 0; fi < animatedFountains.length; fi++) {
            const f = animatedFountains[fi];
            const shimmer = 0.92 + 0.1 * Math.sin(tSec * 8.5 + fi);
            for (let ai = 0; ai < f.arcs.length; ai++) {
              const s = shimmer + 0.06 * Math.sin(tSec * 12 + ai * 1.4);
              f.arcs[ai].scale.set(s, 1, s);
            }
            for (let ri = 0; ri < f.ripples.length; ri++) {
              const phase = (tSec * 0.56 + ri * 0.5 + fi * 0.17) % 1;
              const ringScale = 0.72 + phase * 1.9;
              const rMesh = f.ripples[ri];
              rMesh.scale.set(ringScale, ringScale, 1);
              (rMesh.material as THREE.MeshBasicMaterial).opacity = 0.36 * (1 - phase);
            }
          }
        }
        updateFoliageWindTime(textures, tSec);

        const showItemMicro = effectiveLodZoom >= 0.98;
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

        syncAndAnimateActors(tSec, dt, null);
        updateAtmosphereAndLights(tSec, dt);

        // Velocity- & proximity-driven clinic doors (manual push interior doors + automatic entrance doors)
        if (worldHandle) {
          doorActorsScratch.length = 0;
          for (const entry of patientRigs.values()) {
            pushDoorActor(entry.visX, entry.visZ, entry.vx, entry.vz, entry.walkBlend > 0.15 && entry.sitBlend < 0.4);
          }
          for (const entry of staffRigs.values()) {
            pushDoorActor(entry.visX, entry.visZ, entry.vx, entry.vz, entry.walkBlend > 0.15 && entry.sitBlend < 0.4);
          }
          const unlockedSet = getUnlockedRoomsSet(latestRef.current.rooms);
          updateDoors3D(worldHandle.doors, doorActorsScratch, unlockedSet, dt);
        }

        if (composer && nightBlend > 0.015) {
          composer.render();
        } else {
          renderer.render(scene, camera);
        }
        drawOverlayBadges();
      }

      wasPureFpp = isPureFpp;

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

      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      if (composer) composer.dispose();
      if (composerRt) composerRt.dispose();
      fppBackdrop.dispose();
      fppHands.dispose();
      camera.remove(fppHands.group);
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
    sceneHooksRef.current?.updateFppHandsAppearance?.(playerProfile);
  }, [playerProfile]);

  useEffect(() => {
    sceneHooksRef.current?.syncItems(placedItems, placementDraft?.movingInstanceId);
  }, [placedItems, placementDraft?.movingInstanceId]);

  useEffect(() => {
    sceneHooksRef.current?.syncDraft(placementDraft);
  }, [placementDraft]);

  useEffect(() => {
    if (!placementDraft && !editMode) {
      hoveredEditItemIdRef.current = null;
      if (pointerSurfaceRef.current) {
        pointerSurfaceRef.current.style.cursor = 'default';
      }
    }
  }, [placementDraft, editMode]);

  useEffect(() => {
    if (!placementDraft || focusedPatientId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        onRotatePlacement();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancelPlacement();
      } else if (e.key === 'Enter') {
        if (isPlacementValid(placementDraft.hoverX, placementDraft.hoverY, placementDraft)) {
          e.preventDefault();
          onConfirmPlacement(placementDraft.hoverX, placementDraft.hoverY, placementDraft.rotation);
        }
      } else if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        placementDraft.movingInstanceId &&
        onSellMovingDraft
      ) {
        e.preventDefault();
        onSellMovingDraft(placementDraft.movingInstanceId);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    placementDraft,
    focusedPatientId,
    onRotatePlacement,
    onCancelPlacement,
    onConfirmPlacement,
    onSellMovingDraft,
  ]);

  const dragRef = useRef<{
    active: boolean;
    moved: boolean;
    draggingDraft: boolean;
    pendingDragItem: PlacedItem | null;
    startX: number;
    startY: number;
    camStartX: number;
    camStartZ: number;
    hasGrabOffset: boolean;
    grabOffX: number;
    grabOffZ: number;
  }>({
    active: false,
    moved: false,
    draggingDraft: false,
    pendingDragItem: null,
    startX: 0,
    startY: 0,
    camStartX: 0,
    camStartZ: 0,
    hasGrabOffset: false,
    grabOffX: 0,
    grabOffZ: 0,
  });
  const longPressTimerRef = useRef<number | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ dist: number; startZoom: number } | null>(null);
  const panVelocityRef = useRef({ lastX: 0, lastY: 0, lastT: 0, vx: 0, vz: 0 });
  const hoverRafRef = useRef<number | null>(null);
  const pendingHoverRef = useRef<{ x: number; y: number } | null>(null);

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (hoverRafRef.current !== null) {
        cancelAnimationFrame(hoverRafRef.current);
        hoverRafRef.current = null;
      }
    };
  }, []);

  const findHitItemAt = (gx: number, gy: number): PlacedItem | undefined =>
    placedItems.find((item) => {
      const cat = catalogMap.get(item.catalogId);
      if (!cat) return false;
      const ew = item.rotation % 2 === 0 ? cat.width : cat.depth;
      const ed = item.rotation % 2 === 0 ? cat.depth : cat.width;
      return gx >= item.gridX && gx < item.gridX + ew && gy >= item.gridY && gy < item.gridY + ed;
    });

  const resolveDraftTarget = (
    clientX: number,
    clientY: number,
    rawX: number,
    rawZ: number,
    _gx: number,
    _gy: number,
    draft: PlacementDraft,
    useGrabOffset = false,
    grabOffX = 0,
    grabOffZ = 0
  ): { gx: number; gy: number; rotation: 0 | 1 | 2 | 3 } => {
    if (draft.catalogItem.isWallDecor) {
      const wallSlot = sceneHooksRef.current?.screenToWallSlot(clientX, clientY, draft.rotation);
      if (wallSlot) return wallSlot;
      if (!useGrabOffset) {
        const snapped = snapToNearestValidWallSlot(rawX, rawZ, draft.rotation, rooms);
        if (snapped) {
          const dSq = (snapped.gx + 0.5 - rawX) ** 2 + (snapped.gy + 0.5 - rawZ) ** 2;
          if (dSq <= 6.76) return snapped;
        }
      }
      return { gx: draft.hoverX, gy: draft.hoverY, rotation: draft.rotation };
    }
    const effW = draft.rotation % 2 === 0 ? draft.catalogItem.width : draft.catalogItem.depth;
    const effD = draft.rotation % 2 === 0 ? draft.catalogItem.depth : draft.catalogItem.width;
    const targetGx = useGrabOffset ? snapFine(rawX - grabOffX) : snapFine(rawX - effW / 2);
    const targetGy = useGrabOffset ? snapFine(rawZ - grabOffZ) : snapFine(rawZ - effD / 2);
    if (draft.catalogItem.isSolarPanel || draft.catalogItem.id === 'solar_panel') {
      const clamped = clampToSolarZone(targetGx, targetGy, effW, effD);
      return { gx: snapFine(clamped.gx), gy: snapFine(clamped.gy), rotation: draft.rotation };
    }
    return { gx: targetGx, gy: targetGy, rotation: draft.rotation };
  };

  const handleTap = (clientX: number, clientY: number) => {
    const hooks = sceneHooksRef.current;
    if (!hooks) return;
    const { gx, gy, rawX, rawZ } = hooks.screenToGrid(clientX, clientY);

    if (placementDraft) {
      const resolved = resolveDraftTarget(clientX, clientY, rawX, rawZ, gx, gy, placementDraft);
      const isSameSlot =
        resolved.gx === placementDraft.hoverX &&
        resolved.gy === placementDraft.hoverY &&
        resolved.rotation === placementDraft.rotation;

      const nextDraft = {
        ...placementDraft,
        hoverX: resolved.gx,
        hoverY: resolved.gy,
        rotation: resolved.rotation,
      };
      const nextValid = isPlacementValid(resolved.gx, resolved.gy, nextDraft);

      // 1-tap switching between placed items while rearranging ONLY when actually tapping another item's tile (not an open valid target tile!)
      const tappedOnActiveGhost = hooks.hitTestDraftGhost(clientX, clientY);
      if (editMode && !tappedOnActiveGhost && onSwitchEditingItem) {
        const footprintHit = findHitItemAt(rawX, rawZ);
        const visualHit = hooks.hitTestPlacedItem(clientX, clientY);
        const otherHit = footprintHit || (!nextValid ? visualHit : undefined);
        if (otherHit && otherHit.instanceId !== placementDraft.movingInstanceId) {
          const curValid = isPlacementValid(
            placementDraft.hoverX,
            placementDraft.hoverY,
            placementDraft
          );
          onSwitchEditingItem(otherHit, curValid);
          return;
        }
      }

      if (tappedOnActiveGhost || isSameSlot) {
        if (nextValid) {
          onConfirmPlacement(resolved.gx, resolved.gy, resolved.rotation);
        }
      } else {
        // Move preview cleanly to tapped exact coordinates without forcing tile snaps
        onUpdatePlacementHover(resolved.gx, resolved.gy, resolved.rotation);
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

    const hitItem = itemHit?.item || findHitItemAt(rawX, rawZ);

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

    if (hitItem && hitItem.catalogId === 'reception_desk') {
      onTapReceptionDesk?.();
    } else if (hitItem) {
      onInspectItem?.(hitItem);
    } else if (treeHit) {
      onTapWorldTree?.(treeHit.tree);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (firstPersonPatientId) {
      clearLongPress();
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointersRef.current.size === 1) {
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Ignore synthetic pointer events
        }
        fppLastPointerRef.current = { x: e.clientX, y: e.clientY };
        dragRef.current = {
          active: true,
          moved: false,
          draggingDraft: false,
          pendingDragItem: null,
          startX: e.clientX,
          startY: e.clientY,
          camStartX: fppCamRef.current.targetYawOffset,
          camStartZ: fppCamRef.current.targetPitch,
          hasGrabOffset: false,
          grabOffX: 0,
          grabOffZ: 0,
        };
      } else {
        dragRef.current.active = false;
      }
      return;
    }
    if (focusedPatientId) return;
    clearLongPress();
    if (hoverRafRef.current !== null) {
      cancelAnimationFrame(hoverRafRef.current);
      hoverRafRef.current = null;
    }
    pendingHoverRef.current = null;
    camStateRef.current.panVelX = 0;
    camStateRef.current.panVelZ = 0;
    panVelocityRef.current = {
      lastX: e.clientX,
      lastY: e.clientY,
      lastT: performance.now(),
      vx: 0,
      vz: 0,
    };
    liveDragDraftRef.current = null;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      pinchRef.current = { dist: Math.max(10, dist), startZoom: camStateRef.current.targetZoom };
      dragRef.current.active = false;
      dragRef.current.draggingDraft = false;
      dragRef.current.pendingDragItem = null;
      dragRef.current.moved = true;
      dragRef.current.hasGrabOffset = false;
      draggingDraftActiveRef.current = false;
      return;
    }

    const hooks = sceneHooksRef.current;
    let grabbingDraft = false;
    let pendingDragItem: PlacedItem | null = null;
    let hasGrabOffset = false;
    let grabOffX = 0;
    let grabOffZ = 0;

    if (placementDraft && hooks) {
      const { rawX, rawZ } = hooks.screenToGrid(e.clientX, e.clientY);
      const effW = placementDraft.rotation % 2 === 0 ? placementDraft.catalogItem.width : placementDraft.catalogItem.depth;
      const effD = placementDraft.rotation % 2 === 0 ? placementDraft.catalogItem.depth : placementDraft.catalogItem.width;
      const wallSlotHit = placementDraft.catalogItem.isWallDecor
        ? hooks.screenToWallSlot(e.clientX, e.clientY, placementDraft.rotation)
        : null;
      if (
        hooks.hitTestDraftGhost(e.clientX, e.clientY) ||
        (wallSlotHit &&
          Math.abs(wallSlotHit.gx - placementDraft.hoverX) < 0.65 &&
          Math.abs(wallSlotHit.gy - placementDraft.hoverY) < 0.65 &&
          wallSlotHit.rotation === placementDraft.rotation) ||
        (!placementDraft.catalogItem.isWallDecor &&
          rawX >= placementDraft.hoverX - 0.35 &&
          rawX <= placementDraft.hoverX + effW + 0.35 &&
          rawZ >= placementDraft.hoverY - 0.35 &&
          rawZ <= placementDraft.hoverY + effD + 0.35)
      ) {
        grabbingDraft = true;
        draggingDraftActiveRef.current = true;
        hasGrabOffset = true;
        grabOffX = rawX - placementDraft.hoverX;
        grabOffZ = rawZ - placementDraft.hoverY;
        if (pointerSurfaceRef.current) {
          pointerSurfaceRef.current.style.cursor = 'grabbing';
        }
      }
    } else if (!placementDraft && hooks) {
      const { rawX, rawZ } = hooks.screenToGrid(e.clientX, e.clientY);
      const hitItem = hooks.hitTestPlacedItem(e.clientX, e.clientY) || findHitItemAt(rawX, rawZ);
      if (hitItem && editMode) {
        pendingDragItem = hitItem;
        hasGrabOffset = true;
        grabOffX = rawX - hitItem.gridX;
        grabOffZ = rawZ - hitItem.gridY;
      }
    }

    dragRef.current = {
      active: true,
      moved: false,
      draggingDraft: grabbingDraft,
      pendingDragItem,
      startX: e.clientX,
      startY: e.clientY,
      camStartX: camStateRef.current.targetX,
      camStartZ: camStateRef.current.targetZ,
      hasGrabOffset,
      grabOffX,
      grabOffZ,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (firstPersonPatientId) {
      if (!dragRef.current.active) return;
      const ddx = e.clientX - fppLastPointerRef.current.x;
      const ddy = e.clientY - fppLastPointerRef.current.y;
      fppLastPointerRef.current = { x: e.clientX, y: e.clientY };
      if (Math.hypot(e.clientX - dragRef.current.startX, e.clientY - dragRef.current.startY) > 4) {
        dragRef.current.moved = true;
      }
      fppCamRef.current.targetYawOffset = THREE.MathUtils.clamp(
        fppCamRef.current.targetYawOffset - ddx * 0.0040,
        -0.85,
        0.85
      );
      fppCamRef.current.targetPitch = THREE.MathUtils.clamp(
        fppCamRef.current.targetPitch - ddy * 0.0032,
        -0.30,
        0.22
      );
      return;
    }

    if (pointersRef.current.size === 2 && pinchRef.current) {
      clearLongPress();
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const ratio = dist / pinchRef.current.dist;
      camStateRef.current.targetZoom = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, pinchRef.current.startZoom * ratio)
      );
      return;
    }

    const hooks = sceneHooksRef.current;

    // Hover feedback ONLY when in editMode or placing draft — throttled to 1 raycast per rAF
    if (!dragRef.current.active && hooks) {
      if (editMode || placementDraft) {
        pendingHoverRef.current = { x: e.clientX, y: e.clientY };
        if (hoverRafRef.current === null) {
          hoverRafRef.current = requestAnimationFrame(() => {
            hoverRafRef.current = null;
            const pos = pendingHoverRef.current;
            const curHooks = sceneHooksRef.current;
            if (!pos || !curHooks || dragRef.current.active) return;
            if (editMode && !placementDraft) {
              const { rawX, rawZ } = curHooks.screenToGrid(pos.x, pos.y);
              const hoverHit = curHooks.hitTestPlacedItem(pos.x, pos.y) || findHitItemAt(rawX, rawZ);
              hoveredEditItemIdRef.current = hoverHit ? hoverHit.instanceId : null;
              if (pointerSurfaceRef.current) {
                pointerSurfaceRef.current.style.cursor = hoverHit ? 'grab' : 'default';
              }
            } else if (placementDraft && pointerSurfaceRef.current) {
              const hoverGhost = curHooks.hitTestDraftGhost(pos.x, pos.y);
              pointerSurfaceRef.current.style.cursor = hoverGhost ? 'grab' : 'pointer';
            }
          });
        }
      }
      return;
    }

    if (!dragRef.current.active || !hooks) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const moveDist = Math.hypot(dx, dy);

    // 1-gesture direct drag-to-move for any item in editMode
    if (
      editMode &&
      !dragRef.current.draggingDraft &&
      dragRef.current.pendingDragItem &&
      moveDist > 7
    ) {
      const item = dragRef.current.pendingDragItem;
      dragRef.current.pendingDragItem = null;
      const cat = catalogMap.get(item.catalogId);
      if (cat) {
        liveDragDraftRef.current = {
          catalogItem: cat,
          movingInstanceId: item.instanceId,
          rotation: item.rotation,
          hoverX: item.gridX,
          hoverY: item.gridY,
        };
        dragRef.current.draggingDraft = true;
        dragRef.current.moved = true;
        draggingDraftActiveRef.current = true;
        hoveredEditItemIdRef.current = null;
        if (pointerSurfaceRef.current) {
          pointerSurfaceRef.current.style.cursor = 'grabbing';
        }
        onStartDragPlacedItem?.(item);
      }
    }

    if (moveDist > 10) {
      clearLongPress();
      dragRef.current.moved = true;
    }

    const activeDraft = liveDragDraftRef.current || placementDraft;
    if (dragRef.current.draggingDraft && activeDraft) {
      const { gx, gy, rawX, rawZ } = hooks.screenToGrid(e.clientX, e.clientY);
      const resolved = resolveDraftTarget(
        e.clientX,
        e.clientY,
        rawX,
        rawZ,
        gx,
        gy,
        activeDraft,
        dragRef.current.hasGrabOffset,
        dragRef.current.grabOffX,
        dragRef.current.grabOffZ
      );
      if (
        resolved.gx !== activeDraft.hoverX ||
        resolved.gy !== activeDraft.hoverY ||
        resolved.rotation !== activeDraft.rotation
      ) {
        liveDragDraftRef.current = {
          ...activeDraft,
          hoverX: resolved.gx,
          hoverY: resolved.gy,
          rotation: resolved.rotation,
        };
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

      const now = performance.now();
      const dtPan = (now - panVelocityRef.current.lastT) / 1000;
      if (dtPan > 0.002) {
        const sDx = e.clientX - panVelocityRef.current.lastX;
        const sDy = e.clientY - panVelocityRef.current.lastY;
        const stepX = -sDx * scale * right.x + sDy * scale * 1.65 * forward.x;
        const stepZ = -sDx * scale * right.z + sDy * scale * 1.65 * forward.z;
        const instVx = Math.max(-18, Math.min(18, stepX / dtPan));
        const instVz = Math.max(-18, Math.min(18, stepZ / dtPan));
        panVelocityRef.current.vx = panVelocityRef.current.vx * 0.45 + instVx * 0.55;
        panVelocityRef.current.vz = panVelocityRef.current.vz * 0.45 + instVz * 0.55;
        panVelocityRef.current.lastX = e.clientX;
        panVelocityRef.current.lastY = e.clientY;
        panVelocityRef.current.lastT = now;
      }
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
    dragRef.current.pendingDragItem = null;
    dragRef.current.hasGrabOffset = false;
    draggingDraftActiveRef.current = false;

    if (pointerSurfaceRef.current) {
      pointerSurfaceRef.current.style.cursor = 'default';
    }

    const activeDraft = liveDragDraftRef.current || placementDraft;
    liveDragDraftRef.current = null;

    if (firstPersonPatientId) {
      dragRef.current.active = false;
      dragRef.current.draggingDraft = false;
      dragRef.current.pendingDragItem = null;
      return;
    }

    if (wasTap) {
      handleTap(e.clientX, e.clientY);
    } else if (wasDraggingDraft && activeDraft) {
      const valid = isPlacementValid(activeDraft.hoverX, activeDraft.hoverY, activeDraft);
      if (valid && activeDraft.movingInstanceId) {
        // 1-gesture drag-and-drop auto-commits existing item cleanly in the exact target slot
        onConfirmPlacement(activeDraft.hoverX, activeDraft.hoverY, activeDraft.rotation);
      } else {
        onUpdatePlacementHover(activeDraft.hoverX, activeDraft.hoverY, activeDraft.rotation);
      }
    } else if (performance.now() - panVelocityRef.current.lastT < 90) {
      camStateRef.current.panVelX = panVelocityRef.current.vx * 0.68;
      camStateRef.current.panVelZ = panVelocityRef.current.vz * 0.68;
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (focusedPatientId || firstPersonPatientId) return;
    const cs = camStateRef.current;
    const curZoom = cs.targetZoom;
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, curZoom - e.deltaY * 0.0008));
    if (Math.abs(nextZoom - curZoom) > 1e-4) {
      const hooks = sceneHooksRef.current;
      if (hooks && nextZoom > curZoom) {
        const { rawX, rawZ } = hooks.screenToGrid(e.clientX, e.clientY);
        const pull = (1 - curZoom / nextZoom) * 0.72;
        cs.targetX = Math.max(PAN_MIN_X, Math.min(PAN_MAX_X, cs.targetX + (rawX - cs.targetX) * pull));
        cs.targetZ = Math.max(PAN_MIN_Z, Math.min(PAN_MAX_Z, cs.targetZ + (rawZ - cs.targetZ) * pull));
      }
      cs.targetZoom = nextZoom;
    }
  };

  const draftValid = placementDraft
    ? isPlacementValid(placementDraft.hoverX, placementDraft.hoverY, placementDraft)
    : false;
  const sellRefund = placementDraft
    ? Math.round(placementDraft.catalogItem.priceCoins * 0.7)
    : 0;

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      <div
        ref={pointerSurfaceRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={(e) => {
          clearLongPress();
          pointersRef.current.delete(e.pointerId);
          pinchRef.current = null;
          dragRef.current.active = false;
          dragRef.current.draggingDraft = false;
          dragRef.current.pendingDragItem = null;
          draggingDraftActiveRef.current = false;
          liveDragDraftRef.current = null;
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
        {!glbsReady && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[#0e2239]/85">
            <div className="flex items-center gap-3 rounded-2xl bg-slate-900/95 px-5 py-3 text-white border border-white/15 shadow-2xl">
              <span className="h-3 w-3 rounded-full bg-sky-400 animate-ping" />
              <span className="text-xs sm:text-sm font-bold tracking-wide">
                {language === 'ar' ? 'جاري تجهيز مجسمات العيادة ثلاثية الأبعاد...' : 'Preparing 3D clinic models...'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Minimal Corner Center-Camera Control (safely above Store button) */}
      {!focusedPatientId && !firstPersonPatientId && (
        <div className="absolute left-3.5 bottom-20 z-20 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              camStateRef.current.panVelX = 0;
              camStateRef.current.panVelZ = 0;
              camStateRef.current.targetX = 13.2;
              camStateRef.current.targetZ = 12.8;
              camStateRef.current.targetZoom = DEFAULT_ZOOM;
            }}
            aria-label="Center clinic"
            title={language === 'ar' ? 'توسيط العيادة' : 'Center View'}
            className="w-11 h-11 rounded-2xl bg-slate-900/80 hover:bg-slate-900 text-white font-bold text-sm border border-white/15 shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          >
            ⌖
          </button>
        </div>
      )}

      {/* Subtle Edit-Mode Guide when no item is grabbed */}
      {editMode && !placementDraft && !focusedPatientId && (
        <div className="pointer-events-none absolute bottom-20 left-1/2 -translate-x-1/2 z-20 bg-slate-900/94 text-slate-100 text-xs font-semibold px-3.5 py-2 rounded-xl border border-white/15 shadow-lg whitespace-nowrap">
          {language === 'ar'
            ? 'اسحب أي عنصر لنقله مباشرة أو اضغط عليه للتعديل'
            : 'Drag any item to move or tap to edit'}
        </div>
      )}

      {/* Smart Floating Placement & Rearranging Action Dock */}
      {placementDraft && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 sm:gap-2 bg-slate-900/96 text-white px-3 py-2 rounded-2xl border border-white/20 shadow-2xl max-w-[95vw]">
          <div className="flex flex-col leading-tight min-w-0 max-w-[125px] sm:max-w-[165px]">
            <span className="text-xs font-extrabold truncate">
              {language === 'ar' ? placementDraft.catalogItem.nameAr : placementDraft.catalogItem.nameEn}
            </span>
            <span
              className={`text-[10px] font-semibold truncate ${
                draftValid ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {!draftValid
                ? language === 'ar'
                  ? 'موقع غير متاح'
                  : 'Blocked slot'
                : placementDraft.catalogItem.isWallDecor
                  ? language === 'ar'
                    ? 'على الجدار · اسحب أو ثبّت'
                    : 'Wall mount · drag or confirm'
                  : language === 'ar'
                    ? 'جاهز · اسحب أو ثبّت'
                    : 'Ready · drag or confirm'}
            </span>
          </div>
          <button
            type="button"
            onClick={onRotatePlacement}
            title={language === 'ar' ? 'تدوير (R)' : 'Rotate (R)'}
            className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-xs font-bold whitespace-nowrap active:scale-95 transition-transform"
          >
            {language === 'ar' ? 'تدوير ↻' : 'Rotate ↻'}
          </button>
          {placementDraft.movingInstanceId && onSellMovingDraft && (
            <button
              type="button"
              onClick={() => onSellMovingDraft(placementDraft.movingInstanceId!)}
              title={language === 'ar' ? 'بيع واسترداد' : 'Sell & refund'}
              className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-bold whitespace-nowrap active:scale-95 transition-transform"
            >
              {language === 'ar' ? `بيع +${sellRefund}` : `Sell +${sellRefund}`}
            </button>
          )}
          <button
            type="button"
            disabled={!draftValid}
            onClick={() =>
              onConfirmPlacement(
                placementDraft.hoverX,
                placementDraft.hoverY,
                placementDraft.rotation
              )
            }
            className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap active:scale-95 transition-transform ${
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
            title={language === 'ar' ? 'إلغاء (Esc)' : 'Cancel (Esc)'}
            className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold whitespace-nowrap active:scale-95 transition-transform"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
