import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { PLAYER_DEFAULT_SKIN, resolvePlayerOutfitMeta } from '../data/catalog';
import { PlayerGender, PlayerOutfitId, SpriteKind } from '../types/clinic';
import { glbRegistry, startPreloadGlbs } from './glbRegistry';
import { animateHumanoid3D, createHumanoid3D, disposeHumanoid3D } from './humanoid3d';
import { createCatalogMesh3D, disposeObject3D } from './models3d';
import { createTextureBundle } from './textures3d';

export interface CatalogThumbSpec {
  sprite: SpriteKind;
  width: number;
  depth: number;
}

interface PlayerThumbSpec {
  gender: PlayerGender;
  outfitId: PlayerOutfitId;
  hasTarha: boolean;
}

interface PersistedThumbRecord {
  v: number;
  url: string;
  glb: boolean;
}

const THUMB_DB_NAME = 'therason_thumb_cache_v1';
const THUMB_DB_VERSION = 1;
const THUMB_STORE = 'thumbs';
const THUMB_SCHEMA_VERSION = 1;

const thumbCache = new Map<string, string>();
const glbRenderedKeys = new Set<string>();
const subscribers = new Set<() => void>();
const pendingQueue = new Map<string, CatalogThumbSpec>();
let flushScheduled = false;

const pendingPlayerQueue = new Map<string, PlayerThumbSpec>();
let flushPlayerScheduled = false;

let thumbDbPromise: Promise<IDBDatabase | null> | null = null;
let hydratePromise: Promise<number> | null = null;

function openThumbDb(): Promise<IDBDatabase | null> {
  if (thumbDbPromise) return thumbDbPromise;
  thumbDbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    try {
      const req = indexedDB.open(THUMB_DB_NAME, THUMB_DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(THUMB_STORE)) {
          db.createObjectStore(THUMB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return thumbDbPromise;
}

/**
 * Hydrates previously generated 3D WebP thumbnails from browser IndexedDB into memory
 * so repeat sessions open the Store & Character Customizer with zero WebGL re-rendering.
 */
export function hydrateThumbCacheFromIdb(): Promise<number> {
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    const db = await openThumbDb();
    if (!db) return 0;

    return new Promise<number>((resolve) => {
      try {
        const tx = db.transaction(THUMB_STORE, 'readonly');
        const store = tx.objectStore(THUMB_STORE);
        const req = store.openCursor();
        let restored = 0;

        req.onsuccess = () => {
          const cursor = req.result;
          if (!cursor) {
            if (restored > 0) notifySubscribers();
            resolve(restored);
            return;
          }
          const key = String(cursor.key);
          const val = cursor.value as Partial<PersistedThumbRecord> | undefined;
          if (val && val.v === THUMB_SCHEMA_VERSION && typeof val.url === 'string' && val.url.length > 0) {
            if (!thumbCache.has(key)) {
              thumbCache.set(key, val.url);
              restored += 1;
            }
            if (val.glb) {
              glbRenderedKeys.add(key);
            }
          }
          cursor.continue();
        };
        req.onerror = () => resolve(restored);
      } catch {
        resolve(0);
      }
    });
  })();
  return hydratePromise;
}

async function persistThumbEntriesToIdb(
  entries: Array<{ key: string; url: string; glb: boolean }>
): Promise<void> {
  if (entries.length === 0) return;
  const db = await openThumbDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(THUMB_STORE, 'readwrite');
      const store = tx.objectStore(THUMB_STORE);
      for (const entry of entries) {
        const record: PersistedThumbRecord = {
          v: THUMB_SCHEMA_VERSION,
          url: entry.url,
          glb: entry.glb,
        };
        store.put(record, entry.key);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch {
    // Non-fatal quota / private-browsing fallback
  }
}

if (typeof window !== 'undefined') {
  void hydrateThumbCacheFromIdb();
}

function notifySubscribers() {
  subscribers.forEach((cb) => cb());
}

function getCatalogThumbKey(sprite: SpriteKind, width: number, depth: number): string {
  return `${sprite}_${width}x${depth}`;
}

export function getMissingCatalogThumbSpecs(specs: CatalogThumbSpec[]): CatalogThumbSpec[] {
  const glbIsReady = glbRegistry.coreReady;
  const deduped = new Map<string, CatalogThumbSpec>();
  for (const s of specs) {
    const key = getCatalogThumbKey(s.sprite, s.width, s.depth);
    if (!thumbCache.has(key) || (glbIsReady && !glbRenderedKeys.has(key))) {
      deduped.set(key, s);
    }
  }
  return Array.from(deduped.values());
}

interface SharedThumbSession {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  envTarget: THREE.WebGLRenderTarget;
  textures: ReturnType<typeof createTextureBundle>;
  hemi: THREE.HemisphereLight;
  keyLight: THREE.DirectionalLight;
  fillLight: THREE.DirectionalLight;
  rimLight: THREE.DirectionalLight;
  width: number;
  height: number;
}

let sharedSession: SharedThumbSession | null = null;
let sharedDisposeTimer: ReturnType<typeof setTimeout> | null = null;

function disposeSharedThumbSession() {
  if (sharedDisposeTimer) {
    clearTimeout(sharedDisposeTimer);
    sharedDisposeTimer = null;
  }
  const s = sharedSession;
  if (!s) return;
  sharedSession = null;
  s.envTarget.dispose();
  s.textures.dispose();
  const gl = s.renderer.getContext();
  s.renderer.dispose();
  gl.getExtension('WEBGL_lose_context')?.loseContext();
}

function scheduleSharedThumbCleanup() {
  if (sharedDisposeTimer) clearTimeout(sharedDisposeTimer);
  sharedDisposeTimer = setTimeout(() => {
    disposeSharedThumbSession();
  }, 8000);
}

function acquireSharedThumbSession(width: number, height: number): SharedThumbSession | null {
  if (sharedDisposeTimer) {
    clearTimeout(sharedDisposeTimer);
    sharedDisposeTimer = null;
  }
  if (!sharedSession) {
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true,
        powerPreference: 'low-power',
      });
    } catch {
      return null;
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmrem.dispose();

    const hemi = new THREE.HemisphereLight(0xf1f5f9, 0x64748b, 1.05);
    const keyLight = new THREE.DirectionalLight(0xfff4e0, 1.6);
    const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.84);
    const rimLight = new THREE.DirectionalLight(0xbae6fd, 0.58);
    scene.add(hemi, keyLight, fillLight, rimLight);

    const camera = new THREE.PerspectiveCamera(28, width / height, 0.1, 40);
    const textures = createTextureBundle(renderer.capabilities.getMaxAnisotropy(), {
      catalogOnly: true,
    });

    sharedSession = {
      renderer,
      scene,
      camera,
      envTarget,
      textures,
      hemi,
      keyLight,
      fillLight,
      rimLight,
      width,
      height,
    };
  } else if (sharedSession.width !== width || sharedSession.height !== height) {
    sharedSession.renderer.setSize(width, height);
    sharedSession.camera.aspect = width / height;
    sharedSession.width = width;
    sharedSession.height = height;
  }
  return sharedSession;
}

/**
 * Generates crisp 160x160 3D product thumbnails on-demand using a shared transient
 * offscreen WebGLRenderer, persists them in IndexedDB, and disposes after idle timeout.
 */
export function renderThumbBatch(specs: CatalogThumbSpec[]): void {
  const glbIsReady = glbRegistry.coreReady;
  const missing = getMissingCatalogThumbSpecs(specs);
  if (missing.length === 0) return;

  const size = 160;
  const sess = acquireSharedThumbSession(size, size);
  if (!sess) return;

  const { renderer, scene, camera, textures, hemi, keyLight, fillLight, rimLight } = sess;
  renderer.toneMappingExposure = 1.05;
  scene.environmentIntensity = 0.62;

  hemi.color.setHex(0xf1f5f9);
  hemi.intensity = 1.05;
  keyLight.color.setHex(0xfff4e0);
  keyLight.intensity = 1.6;
  keyLight.position.set(4, 7, 5);
  fillLight.visible = false;
  rimLight.intensity = 0.58;
  rimLight.position.set(-4, 3, -4);

  camera.fov = 28;
  camera.near = 0.1;
  camera.far = 40;
  camera.aspect = 1;

  const box = new THREE.Box3();
  const center = new THREE.Vector3();
  const dims = new THREE.Vector3();
  const persisted: Array<{ key: string; url: string; glb: boolean }> = [];

  for (const item of missing) {
    const key = getCatalogThumbKey(item.sprite, item.width, item.depth);
    const mesh = createCatalogMesh3D(
      item.sprite,
      textures,
      item.width,
      item.depth,
      0,
      true
    );
    scene.add(mesh);
    mesh.updateMatrixWorld(true);

    box.setFromObject(mesh);
    if (!box.isEmpty()) {
      box.getCenter(center);
      box.getSize(dims);
      const radius = Math.max(0.45, dims.length() * 0.52);
      const dist = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov * 0.5));
      camera.position.set(
        center.x + dist * 0.62,
        center.y + dist * 0.52,
        center.z + dist * 0.68
      );
      camera.lookAt(center);
      camera.updateProjectionMatrix();

      renderer.clear();
      renderer.render(scene, camera);
      try {
        const url = renderer.domElement.toDataURL('image/webp', 0.92);
        thumbCache.set(key, url);
        if (glbIsReady) {
          glbRenderedKeys.add(key);
        }
        persisted.push({ key, url, glb: glbIsReady });
      } catch {
        // Ignore security/readback failures
      }
    }

    scene.remove(mesh);
    disposeObject3D(mesh);
  }

  scheduleSharedThumbCleanup();
  notifySubscribers();
  if (persisted.length > 0) {
    void persistThumbEntriesToIdb(persisted);
  }
}

/**
 * Renders missing catalog thumbnails in small, frame-friendly chunks so opening
 * the Store Sheet never causes main-thread frame hitches.
 */
export function renderMissingCatalogThumbsChunked(
  specs: CatalogThumbSpec[],
  chunkSize = 6,
  delayBetweenMs = 24
): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let rafId = 0;

  void (async () => {
    await hydrateThumbCacheFromIdb();
    if (cancelled) return;
    const missing = getMissingCatalogThumbSpecs(specs);
    if (missing.length === 0) return;

    let idx = 0;
    const step = () => {
      if (cancelled || idx >= missing.length) return;
      renderThumbBatch(missing.slice(idx, idx + chunkSize));
      idx += chunkSize;
      if (idx < missing.length && !cancelled) {
        timer = setTimeout(() => {
          rafId = requestAnimationFrame(step);
        }, delayBetweenMs);
      }
    };
    rafId = requestAnimationFrame(step);
  })();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    if (rafId) cancelAnimationFrame(rafId);
  };
}

function scheduleThumbRender(spec: CatalogThumbSpec) {
  const key = getCatalogThumbKey(spec.sprite, spec.width, spec.depth);
  pendingQueue.set(key, spec);
  if (flushScheduled) return;
  flushScheduled = true;
  queueMicrotask(() => {
    flushScheduled = false;
    if (pendingQueue.size === 0) return;
    const batch = Array.from(pendingQueue.values());
    pendingQueue.clear();
    renderThumbBatch(batch);
  });
}

export function useCatalogThumb(
  sprite: SpriteKind,
  width: number,
  depth: number
): string | null {
  const key = getCatalogThumbKey(sprite, width, depth);
  const [url, setUrl] = useState<string | null>(() => thumbCache.get(key) || null);

  useEffect(() => {
    let mounted = true;
    startPreloadGlbs();
    const update = () => {
      if (!mounted) return;
      const next = thumbCache.get(key) || null;
      setUrl(next);
    };
    subscribers.add(update);

    let unsubGlb = () => {};
    void hydrateThumbCacheFromIdb().then(() => {
      if (!mounted) return;
      update();
      unsubGlb = glbRegistry.onCoreReady(() => {
        if (!glbRenderedKeys.has(key)) {
          scheduleThumbRender({ sprite, width, depth });
        }
      });
    });

    update();
    return () => {
      mounted = false;
      subscribers.delete(update);
      unsubGlb();
    };
  }, [key, sprite, width, depth]);

  return url;
}

function getPlayerOutfitThumbKey(
  gender: PlayerGender,
  outfitId: PlayerOutfitId,
  hasTarha: boolean
): string {
  const outfit = resolvePlayerOutfitMeta(outfitId);
  const effectiveTarha = gender === 'female' ? (outfit.forceTarha ? true : hasTarha) : false;
  return `pchar_${gender}_${outfit.id}_${effectiveTarha ? 1 : 0}`;
}

function renderPlayerOutfitBatch(specs: PlayerThumbSpec[]): void {
  if (!glbRegistry.ready) return;

  const deduped = new Map<string, PlayerThumbSpec>();
  for (const s of specs) {
    const key = getPlayerOutfitThumbKey(s.gender, s.outfitId, s.hasTarha);
    if (!thumbCache.has(key)) {
      deduped.set(key, s);
    }
  }
  const missing = Array.from(deduped.values());
  if (missing.length === 0) return;

  const width = 360;
  const height = 460;
  const sess = acquireSharedThumbSession(width, height);
  if (!sess) return;

  const { renderer, scene, camera, textures, hemi, keyLight, fillLight, rimLight } = sess;
  renderer.toneMappingExposure = 1.15;
  scene.environmentIntensity = 0.76;

  hemi.color.setHex(0xf8fafc);
  hemi.intensity = 1.32;
  keyLight.color.setHex(0xfff5e6);
  keyLight.intensity = 1.85;
  keyLight.position.set(2.6, 5.4, 4.8);
  fillLight.visible = true;
  fillLight.intensity = 0.84;
  fillLight.position.set(-2.4, 2.4, 3.8);
  rimLight.intensity = 0.78;
  rimLight.position.set(-3.2, 3.6, -3.4);

  camera.fov = 25;
  camera.near = 0.1;
  camera.far = 20;
  camera.aspect = width / height;
  camera.position.set(0.28, 0.82, 3.12);
  camera.lookAt(0, 0.68, 0);
  camera.updateProjectionMatrix();

  const pbrMaps = {
    skinMicroMap: textures.skinMicroMap,
    skinRoughMap: textures.skinRoughMap,
    fabricWeaveBump: textures.fabricWeaveBump,
    leatherBump: textures.leatherBump,
    brushedMetalBump: textures.brushedMetalBump,
  };
  const persisted: Array<{ key: string; url: string; glb: boolean }> = [];

  for (const spec of missing) {
    const key = getPlayerOutfitThumbKey(spec.gender, spec.outfitId, spec.hasTarha);
    const outfit = resolvePlayerOutfitMeta(spec.outfitId);
    const isFemale = spec.gender === 'female';
    const effectiveTarha = isFemale ? (outfit.forceTarha ? true : spec.hasTarha) : false;
    const hasNiqab = Boolean(isFemale && outfit.hasNiqab);

    const rig = createHumanoid3D({
      skinTone: PLAYER_DEFAULT_SKIN,
      hairColor: '#18100c',
      shirtColor: outfit.shirtColor,
      pantsColor: outfit.pantsColor,
      hasHijab: effectiveTarha,
      hasNiqab,
      isFemale,
      outfitStyle: outfit.outfitStyle,
      medicalWear: outfit.medicalWear,
      hasStethoscope: outfit.hasStethoscope,
      shirtStyle: outfit.medicalWear === 'none' && !isFemale ? 'shirt' : undefined,
      isStaff: false,
      isPlayer: true,
      role: 'therapist',
      ...pbrMaps,
    });

    animateHumanoid3D(rig, {
      pose: 'standing',
      walkPhase: 0,
      isMoving: false,
      walkBlend: 0,
      sitBlend: 0,
      doorPush: 0,
      facingRad: 0.22,
      timeSec: 0,
      isSelected: false,
      actorSeed: 7,
    });

    scene.add(rig.root);
    rig.root.updateMatrixWorld(true);

    renderer.clear();
    renderer.render(scene, camera);
    try {
      const url = renderer.domElement.toDataURL('image/webp', 0.92);
      thumbCache.set(key, url);
      persisted.push({ key, url, glb: true });
    } catch {
      // Ignore readback failures
    }

    scene.remove(rig.root);
    disposeHumanoid3D(rig);
  }

  scheduleSharedThumbCleanup();
  notifySubscribers();
  if (persisted.length > 0) {
    void persistThumbEntriesToIdb(persisted);
  }
}

function schedulePlayerThumbRender(spec: PlayerThumbSpec) {
  const key = getPlayerOutfitThumbKey(spec.gender, spec.outfitId, spec.hasTarha);
  if (thumbCache.has(key)) return;
  pendingPlayerQueue.set(key, spec);
  if (flushPlayerScheduled) return;
  flushPlayerScheduled = true;
  queueMicrotask(() => {
    flushPlayerScheduled = false;
    if (pendingPlayerQueue.size === 0) return;
    const batch = Array.from(pendingPlayerQueue.values());
    pendingPlayerQueue.clear();
    renderPlayerOutfitBatch(batch);
  });
}

export function usePlayerOutfitThumb(
  gender: PlayerGender,
  outfitId: PlayerOutfitId,
  hasTarha: boolean
): string | null {
  const key = getPlayerOutfitThumbKey(gender, outfitId, hasTarha);
  const [url, setUrl] = useState<string | null>(() => thumbCache.get(key) || null);

  useEffect(() => {
    let mounted = true;
    startPreloadGlbs();
    const update = () => {
      if (!mounted) return;
      setUrl(thumbCache.get(key) || null);
    };
    subscribers.add(update);

    let unsubGlb = () => {};
    void hydrateThumbCacheFromIdb().then(() => {
      if (!mounted) return;
      update();
      unsubGlb = glbRegistry.onReady(() => {
        if (!thumbCache.has(key)) {
          schedulePlayerThumbRender({ gender, outfitId, hasTarha });
        }
      });
    });

    update();
    return () => {
      mounted = false;
      subscribers.delete(update);
      unsubGlb();
    };
  }, [key, gender, outfitId, hasTarha]);

  return url;
}
