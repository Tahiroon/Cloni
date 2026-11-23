import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

export interface GlbProgressInfo {
  loaded: number;
  total: number;
  progress: number;
  coreLoaded: number;
  coreTotal: number;
  coreProgress: number;
  bytesLoaded: number;
  bytesTotal: number;
  cacheHits: number;
  currentAsset?: string;
  coreReady: boolean;
  ready: boolean;
}

export interface GlbRegistry {
  coreReady: boolean;
  ready: boolean;
  progress: number;
  getProgressInfo: () => GlbProgressInfo;
  getModel: (key: string) => THREE.Object3D | null;
  cloneNormalized: (
    key: string,
    opts: {
      targetHeight?: number;
      maxFootprint?: { w: number; d: number };
      stretchToBox?: { w: number; h: number; d: number };
      rotY?: number;
    }
  ) => THREE.Group | null;
  cloneSkinned: (key: string, targetHeight: number) => THREE.Group | null;
  onCoreReady: (cb: () => void) => () => void;
  onReady: (cb: () => void) => () => void;
  onProgress: (cb: (info: GlbProgressInfo) => void) => () => void;
  onAssetLoaded: (cb: (key: string) => void) => () => void;
}

const ASSET_CACHE_NAME = 'therason-clinic-assets-v2';
const LEGACY_ASSET_CACHE_NAME = 'therason-clinic-assets-v1';

// Tier 1 (Priority Core): Small clinic furniture, world nature, textures & primary avatars
const CORE_MODEL_PATHS: Record<string, string> = {
  furn_desk: '/models/furn/desk.glb',
  furn_chair_desk: '/models/furn/chair_desk.glb',
  furn_monitor: '/models/furn/monitor.glb',
  furn_coffee_table: '/models/furn/coffee_table.glb',
  furn_bookshelf: '/models/furn/bookshelf.glb',
  furn_plant1: '/models/furn/plant_1.glb',
  furn_plant_ficus: '/models/furn/plant_ficus.glb',
  furn_wheelchair: '/models/med/wheelchair.glb',
  furn_desk_corner: '/models/kenney_furn/desk_corner.glb',
  furn_lamp_wall: '/models/kenney_furn/lamp_wall.glb',
  furn_med_cabinet: '/models/kenney_furn/med_cabinet.glb',
  furn_trashcan: '/models/furn/trashcan.glb',
  furn_lamp_floor: '/models/furn/lamp_floor.glb',
  furn_lamp_desk: '/models/furn/lamp_desk.glb',
  bush_1: '/models/nature/bush_1.glb',
  bush_2: '/models/nature/bush_2.glb',
  grass_clump: '/models/nature/grass_clump.glb',
  char_woman_suit: '/models/chars/woman_suit.glb',
  char_man2: '/models/chars/man_casual2.glb',
  char_suit: '/models/chars/man_suit.glb',
};

// Tier 2 (Deferred High-Detail): FPP clinician hands & heavy scanned patients streamed right after Tier 1
const EXTENDED_MODEL_PATHS: Record<string, string> = {
  hand_left: '/models/chars/hand_left.glb',
  hand_right: '/models/chars/hand_right.glb',
  char_sudanese_man_1: '/models/chars/patient_sudanese_1.glb',
  char_patient_realistic_1: '/models/chars/patient_scanned_1.glb',
};

const EXTRA_TEXTURE_ASSETS: Array<{ key: string; url: string; contentType: string }> = [
  {
    key: 'med_colormap',
    url: '/models/med/Textures/colormap.png',
    contentType: 'image/png',
  },
];

interface CachedBounds {
  size: THREE.Vector3;
  center: THREE.Vector3;
  minY: number;
}

const loadedTemplates = new Map<string, THREE.Object3D>();
const normalizedBoundsCache = new Map<string, CachedBounds>();
const skinnedBoundsCache = new Map<string, CachedBounds>();
const coreListeners = new Set<() => void>();
const listeners = new Set<() => void>();
const progressListeners = new Set<(info: GlbProgressInfo) => void>();
const assetLoadedListeners = new Set<(key: string) => void>();
const failedModelQueue = new Map<string, string>();
let legacyCachePurged = false;

const CORE_KEYS = new Set<string>([
  ...Object.keys(CORE_MODEL_PATHS),
  ...EXTRA_TEXTURE_ASSETS.map((a) => a.key),
]);
const TOTAL_CORE_ASSETS = CORE_KEYS.size;
const TOTAL_ASSETS =
  Object.keys(CORE_MODEL_PATHS).length +
  Object.keys(EXTENDED_MODEL_PATHS).length +
  EXTRA_TEXTURE_ASSETS.length;

let loadedCount = 0;
let coreLoadedCount = 0;
let cacheHitsCount = 0;
let loadingStarted = false;
let coreLoaded = false;
let allLoaded = false;
let lastCurrentAsset: string | undefined;

const fileProgressRatio = new Map<string, number>();
const fileBytesLoaded = new Map<string, number>();
const fileBytesTotal = new Map<string, number>();

let maxGlbAnisotropy = 8;

const _tmpBox = new THREE.Box3();
const _tmpSize = new THREE.Vector3();
const _tmpCenter = new THREE.Vector3();

function buildProgressSnapshot(): GlbProgressInfo {
  let sumRatio = 0;
  let coreSumRatio = 0;
  let bytesLoaded = 0;
  let bytesTotal = 0;

  for (const [k, r] of fileProgressRatio.entries()) {
    const clamped = Math.min(1, Math.max(0, r));
    sumRatio += clamped;
    if (CORE_KEYS.has(k)) {
      coreSumRatio += clamped;
    }
  }
  for (const b of fileBytesLoaded.values()) {
    bytesLoaded += b;
  }
  for (const t of fileBytesTotal.values()) {
    bytesTotal += t;
  }

  const continuousProgress = allLoaded
    ? 1
    : TOTAL_ASSETS > 0
      ? Math.min(0.995, sumRatio / TOTAL_ASSETS)
      : 1;

  const continuousCoreProgress = coreLoaded
    ? 1
    : TOTAL_CORE_ASSETS > 0
      ? Math.min(0.995, coreSumRatio / TOTAL_CORE_ASSETS)
      : 1;

  return {
    loaded: loadedCount,
    total: TOTAL_ASSETS,
    progress: continuousProgress,
    coreLoaded: coreLoadedCount,
    coreTotal: TOTAL_CORE_ASSETS,
    coreProgress: continuousCoreProgress,
    bytesLoaded,
    bytesTotal: Math.max(bytesLoaded, bytesTotal),
    cacheHits: cacheHitsCount,
    currentAsset: lastCurrentAsset,
    coreReady: coreLoaded,
    ready: allLoaded,
  };
}

let lastProgressEmitMs = 0;
let pendingProgressTimer: ReturnType<typeof setTimeout> | null = null;

function emitProgress(force = false) {
  if (progressListeners.size === 0) return;
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (force || now - lastProgressEmitMs >= 36) {
    lastProgressEmitMs = now;
    if (pendingProgressTimer) {
      clearTimeout(pendingProgressTimer);
      pendingProgressTimer = null;
    }
    const snap = buildProgressSnapshot();
    progressListeners.forEach((cb) => cb(snap));
  } else if (!pendingProgressTimer) {
    pendingProgressTimer = setTimeout(() => {
      pendingProgressTimer = null;
      lastProgressEmitMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const snap = buildProgressSnapshot();
      progressListeners.forEach((cb) => cb(snap));
    }, 40);
  }
}

function computeTemplateBounds(template: THREE.Object3D, rotY = 0): CachedBounds {
  const holder = new THREE.Group();
  if (rotY) holder.rotation.y = rotY;
  holder.add(template);
  holder.updateMatrixWorld(true);
  _tmpBox.setFromObject(holder);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  _tmpBox.getSize(size);
  _tmpBox.getCenter(center);
  const minY = _tmpBox.min.y;
  holder.remove(template);
  return { size, center, minY };
}

function refineGlbAssets(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const m = child as THREE.Mesh;
      m.castShadow = true;
      m.receiveShadow = true;
      if ((m as THREE.SkinnedMesh).isSkinnedMesh) {
        m.frustumCulled = false;
      }
      m.userData.sharedGlbGeom = true;
      m.userData.sharedGlbMat = true;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        if (!mat) continue;
        const std = mat as THREE.MeshStandardMaterial;
        const texSlots: Array<THREE.Texture | null | undefined> = [
          std.map,
          std.emissiveMap,
          std.roughnessMap,
          std.metalnessMap,
          std.normalMap,
          std.bumpMap,
          std.aoMap,
          std.alphaMap,
        ];
        for (const tex of texSlots) {
          if (!tex) continue;
          tex.magFilter = THREE.LinearFilter;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.generateMipmaps = true;
          tex.anisotropy = Math.min(16, Math.max(1, maxGlbAnisotropy));
          tex.needsUpdate = true;
        }
        if ('roughness' in std) {
          std.envMapIntensity = std.map ? 0.44 : 0.56;
          if (std.roughness > 0.94) {
            std.roughness = 0.85;
          } else if (std.metalness < 0.1 && std.roughness < 0.24) {
            std.roughness = 0.38;
          }
          // Slightly soften overly bright pure-white albedo only on untextured low-poly meshes
          if (!std.map && std.color && std.color.r > 0.92 && std.color.g > 0.92 && std.color.b > 0.92) {
            std.color.multiplyScalar(0.86);
          }
        }
      }
    }
  });
}

function isValidGlbBuffer(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 12) return false;
  const view = new Uint8Array(buf, 0, 4);
  // 'glTF'
  return view[0] === 0x67 && view[1] === 0x6c && view[2] === 0x54 && view[3] === 0x46;
}

function isValidBinaryForContentType(buf: ArrayBuffer, contentType: string, url: string): boolean {
  if (buf.byteLength === 0) return false;
  if (contentType.includes('gltf-binary') || url.endsWith('.glb')) {
    return isValidGlbBuffer(buf);
  }
  if (contentType === 'image/png' || url.endsWith('.png')) {
    if (buf.byteLength < 8) return false;
    const v = new Uint8Array(buf, 0, 4);
    return v[0] === 0x89 && v[1] === 0x50 && v[2] === 0x4e && v[3] === 0x47;
  }
  return true;
}

export async function openAssetCache(): Promise<Cache | null> {
  try {
    if (typeof window !== 'undefined' && 'caches' in window && window.caches) {
      if (!legacyCachePurged) {
        legacyCachePurged = true;
        void window.caches.delete(LEGACY_ASSET_CACHE_NAME).catch(() => {});
      }
      return await window.caches.open(ASSET_CACHE_NAME);
    }
  } catch {
    // Cache Storage unavailable (e.g. restricted context)
  }
  return null;
}

export async function getCachedAssetBlobUrl(url: string): Promise<string | null> {
  const cache = await openAssetCache();
  if (!cache) return null;
  try {
    const cached = await cache.match(url);
    if (cached && cached.ok) {
      const ct = (cached.headers.get('Content-Type') || '').toLowerCase();
      if (ct.includes('text/html')) {
        await cache.delete(url).catch(() => {});
        return null;
      }
      const blob = await cached.blob();
      if (blob.size > 0 && typeof URL !== 'undefined') {
        return URL.createObjectURL(blob);
      }
    }
  } catch {
    // Ignore cache read failures
  }
  return null;
}

export async function cacheStaticAssetUrl(url: string, contentType?: string): Promise<void> {
  const cache = await openAssetCache();
  if (!cache) return;
  try {
    const existing = await cache.match(url);
    if (existing && existing.ok) {
      const bufExisting = await existing.clone().arrayBuffer();
      if (isValidBinaryForContentType(bufExisting, contentType || existing.headers.get('Content-Type') || '', url)) {
        return;
      }
      await cache.delete(url).catch(() => {});
    }
    const res = await fetch(url, { cache: 'default' });
    if (!res.ok) return;
    const ct = (contentType || res.headers.get('Content-Type') || 'application/octet-stream').toLowerCase();
    if (ct.includes('text/html')) return;
    const buf = await res.arrayBuffer();
    if (!isValidBinaryForContentType(buf, ct, url)) return;
    await cache.put(
      url,
      new Response(buf, {
        status: 200,
        headers: {
          'Content-Type': contentType || res.headers.get('Content-Type') || 'application/octet-stream',
          'Content-Length': String(buf.byteLength),
        },
      })
    );
  } catch {
    // Ignore offline / quota errors silently
  }
}

async function fetchAndCacheBinary(
  key: string,
  url: string,
  contentType: string,
  cache: Cache | null,
  forceReload = false
): Promise<ArrayBuffer> {
  lastCurrentAsset = key;

  if (cache && !forceReload) {
    try {
      const cached = await cache.match(url);
      if (cached && cached.ok) {
        const buf = await cached.arrayBuffer();
        if (isValidBinaryForContentType(buf, contentType, url)) {
          cacheHitsCount += 1;
          fileBytesLoaded.set(key, buf.byteLength);
          fileBytesTotal.set(key, buf.byteLength);
          fileProgressRatio.set(key, 0.85);
          emitProgress();
          return buf;
        }
        await cache.delete(url).catch(() => {});
      }
    } catch {
      // Fallback to network fetch
    }
  }

  const fetchUrl = forceReload ? `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}` : url;
  const res = await fetch(fetchUrl, { cache: forceReload ? 'reload' : 'default' });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const respCt = (res.headers.get('Content-Type') || '').toLowerCase();
  if (respCt.includes('text/html')) {
    throw new Error(`Unexpected HTML response for ${url}`);
  }

  const contentLength = Number(res.headers.get('content-length') || 0);
  if (contentLength > 0) {
    fileBytesTotal.set(key, contentLength);
  }

  let buffer: ArrayBuffer;
  if (res.body && typeof res.body.getReader === 'function') {
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.byteLength;
        fileBytesLoaded.set(key, received);
        if (contentLength > 0) {
          fileProgressRatio.set(key, Math.min(0.85, (received / contentLength) * 0.85));
        } else {
          fileProgressRatio.set(key, Math.min(0.8, 0.2 + received / 550000));
        }
        emitProgress();
      }
    }
    const merged = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    buffer = merged.buffer;
    fileBytesTotal.set(key, received);
  } else {
    buffer = await res.arrayBuffer();
    fileBytesLoaded.set(key, buffer.byteLength);
    fileBytesTotal.set(key, buffer.byteLength);
    fileProgressRatio.set(key, 0.85);
    emitProgress();
  }

  if (!isValidBinaryForContentType(buffer, contentType, url)) {
    throw new Error(`Corrupt or invalid binary header for ${url}`);
  }

  if (cache && buffer.byteLength > 0) {
    try {
      await cache.put(
        url,
        new Response(buffer.slice(0), {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Content-Length': String(buffer.byteLength),
          },
        })
      );
    } catch {
      // Ignore cache quota failures gracefully
    }
  }

  return buffer;
}

function getBaseResourceDir(url: string): string {
  const idx = url.lastIndexOf('/');
  return idx >= 0 ? url.slice(0, idx + 1) : '/';
}

function prewarmModelBounds(key: string, sceneObj: THREE.Object3D) {
  try {
    if (key.startsWith('char_') || key.startsWith('hand_')) {
      if (!skinnedBoundsCache.has(key)) {
        const probe = SkeletonUtils.clone(sceneObj);
        probe.updateMatrixWorld(true);
        _tmpBox.setFromObject(probe);
        _tmpBox.getSize(_tmpSize);
        _tmpBox.getCenter(_tmpCenter);
        skinnedBoundsCache.set(key, {
          size: _tmpSize.clone(),
          center: _tmpCenter.clone(),
          minY: _tmpBox.min.y,
        });
      }
    } else {
      const cacheKey = `${key}_${(0).toFixed(4)}`;
      if (!normalizedBoundsCache.has(cacheKey)) {
        normalizedBoundsCache.set(cacheKey, computeTemplateBounds(sceneObj, 0));
      }
    }
  } catch {
    // Non-fatal bounds warmup guard
  }
}

function yieldToUiFrame(): Promise<void> {
  if (typeof requestAnimationFrame === 'function') {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }
  return new Promise((resolve) => setTimeout(resolve, 16));
}

export function startPreloadGlbs(maxAnisotropy = 8) {
  maxGlbAnisotropy = Math.min(16, Math.max(1, maxAnisotropy));
  if (loadingStarted) return;
  loadingStarted = true;
  THREE.Cache.enabled = true;

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const coreEntries = Object.entries(CORE_MODEL_PATHS);
  const extendedEntries = Object.entries(EXTENDED_MODEL_PATHS);
  let remaining = TOTAL_ASSETS;
  let remainingCore = TOTAL_CORE_ASSETS;

  const markAssetDone = (key: string) => {
    loadedCount += 1;
    fileProgressRatio.set(key, 1);
    remaining -= 1;

    if (CORE_KEYS.has(key)) {
      coreLoadedCount += 1;
      remainingCore -= 1;
      if (remainingCore <= 0 && !coreLoaded) {
        coreLoaded = true;
        emitProgress(true);
        coreListeners.forEach((cb) => cb());
      }
    }

    if (remaining <= 0) {
      allLoaded = true;
      emitProgress(true);
      listeners.forEach((cb) => cb());
    } else {
      emitProgress();
    }
  };

  const parseBuffer = (buf: ArrayBuffer, url: string) =>
    new Promise<THREE.Object3D>((resolve, reject) => {
      loader.parse(
        buf,
        getBaseResourceDir(url),
        (gltf) => resolve(gltf.scene),
        (err) => reject(err || new Error(`Parse failed for ${url}`))
      );
    });

  const loadSingleModel = async (key: string, url: string, cache: Cache | null, yieldOnHeavy: boolean) => {
    let loaded = false;
    for (let attempt = 0; attempt < 2 && !loaded; attempt++) {
      try {
        const forceReload = attempt > 0;
        if (attempt > 0) {
          await new Promise<void>((r) => setTimeout(r, 260));
        }
        const buf = await fetchAndCacheBinary(key, url, 'model/gltf-binary', cache, forceReload);
        if (yieldOnHeavy && buf.byteLength > 180_000) {
          await yieldToUiFrame();
        }
        const sceneObj = await parseBuffer(buf, url);
        refineGlbAssets(sceneObj);
        loadedTemplates.set(key, sceneObj);
        prewarmModelBounds(key, sceneObj);
        failedModelQueue.delete(key);
        assetLoadedListeners.forEach((cb) => cb(key));
        loaded = true;
      } catch {
        if (cache) {
          await cache.delete(url).catch(() => {});
        }
      }
    }
    if (!loaded) {
      failedModelQueue.set(key, url);
    }
    markAssetDone(key);
  };

  const runTier = async (
    entries: Array<[string, string]>,
    concurrency: number,
    cache: Cache | null,
    yieldOnHeavy: boolean
  ) => {
    let nextIndex = 0;
    const worker = async () => {
      while (nextIndex < entries.length) {
        const idx = nextIndex++;
        const [key, url] = entries[idx];
        await loadSingleModel(key, url, cache, yieldOnHeavy);
      }
    };
    const count = Math.min(concurrency, entries.length);
    await Promise.all(Array.from({ length: count }, () => worker()));
  };

  const recoverFailedModels = async (cache: Cache | null) => {
    for (const delayMs of [1200, 3500]) {
      if (failedModelQueue.size === 0) return;
      await new Promise<void>((r) => setTimeout(r, delayMs));
      const pending = Array.from(failedModelQueue.entries());
      for (const [key, url] of pending) {
        try {
          const buf = await fetchAndCacheBinary(key, url, 'model/gltf-binary', cache, true);
          const sceneObj = await parseBuffer(buf, url);
          refineGlbAssets(sceneObj);
          loadedTemplates.set(key, sceneObj);
          prewarmModelBounds(key, sceneObj);
          failedModelQueue.delete(key);
          assetLoadedListeners.forEach((cb) => cb(key));
        } catch {
          // Will retry on next pass if remaining
        }
      }
    }
  };

  void (async () => {
    await MeshoptDecoder.ready;
    const cache = await openAssetCache();

    // 1. Download & cache external referenced texture(s) into browser CacheStorage first
    await Promise.all(
      EXTRA_TEXTURE_ASSETS.map(async (asset) => {
        try {
          const buf = await fetchAndCacheBinary(asset.key, asset.url, asset.contentType, cache);
          if (typeof Image !== 'undefined' && typeof Blob !== 'undefined') {
            const blobUrl = URL.createObjectURL(new Blob([buf], { type: asset.contentType }));
            await new Promise<void>((resolve) => {
              const img = new Image();
              img.onload = () => {
                URL.revokeObjectURL(blobUrl);
                resolve();
              };
              img.onerror = () => {
                URL.revokeObjectURL(blobUrl);
                resolve();
              };
              img.src = blobUrl;
            });
          }
        } catch {
          // Graceful fallback
        } finally {
          markAssetDone(asset.key);
        }
      })
    );

    // 2. Priority Tier 1 (Essential clinic furniture, world nature & core characters)
    await runTier(coreEntries, 6, cache, true);

    // 3. Yield briefly so initial 3D clinic renders smoothly, then stream Tier 2 assets cleanly
    await yieldToUiFrame();
    await runTier(extendedEntries, 3, cache, true);

    // 4. Automatically recover any failed GLB (e.g. during server reload or transient drop)
    if (failedModelQueue.size > 0) {
      void recoverFailedModels(cache);
    }
  })();
}

export const glbRegistry: GlbRegistry = {
  get coreReady() {
    return coreLoaded;
  },
  get ready() {
    return allLoaded;
  },
  get progress() {
    return TOTAL_ASSETS > 0 ? Math.min(1, loadedCount / TOTAL_ASSETS) : 1;
  },
  getProgressInfo() {
    return buildProgressSnapshot();
  },
  getModel(key: string) {
    return loadedTemplates.get(key) || null;
  },
  cloneNormalized(key, opts) {
    const template = loadedTemplates.get(key);
    if (!template) return null;

    const rotY = opts.rotY || 0;
    const cacheKey = `${key}_${rotY.toFixed(4)}`;
    let bounds = normalizedBoundsCache.get(cacheKey);
    if (!bounds) {
      bounds = computeTemplateBounds(template, rotY);
      normalizedBoundsCache.set(cacheKey, bounds);
    }
    const { size, center, minY } = bounds;
    if (size.y < 1e-5 && size.x < 1e-5) return null;

    const clone = template.clone(true);
    const rotHolder = new THREE.Group();
    if (rotY) {
      rotHolder.rotation.y = rotY;
    }
    rotHolder.add(clone);

    let sx = 1;
    let sy = 1;
    let sz = 1;
    if (opts.stretchToBox) {
      sx = size.x > 1e-5 ? opts.stretchToBox.w / size.x : 1;
      sy = size.y > 1e-5 ? opts.stretchToBox.h / size.y : 1;
      sz = size.z > 1e-5 ? opts.stretchToBox.d / size.z : 1;
    } else {
      let scale = 1;
      if (opts.targetHeight && size.y > 1e-5) {
        scale = opts.targetHeight / size.y;
      }
      if (opts.maxFootprint) {
        const fx = size.x > 1e-5 ? opts.maxFootprint.w / size.x : 99;
        const fz = size.z > 1e-5 ? opts.maxFootprint.d / size.z : 99;
        const fitScale = Math.min(fx, fz);
        scale = opts.targetHeight ? Math.min(scale, fitScale) : fitScale;
      }
      sx = scale;
      sy = scale;
      sz = scale;
    }

    rotHolder.scale.set(sx, sy, sz);
    rotHolder.position.set(-center.x * sx, -minY * sy, -center.z * sz);

    const wrapper = new THREE.Group();
    wrapper.add(rotHolder);
    return wrapper;
  },
  cloneSkinned(key, targetHeight) {
    const template = loadedTemplates.get(key);
    if (!template) return null;

    let bounds = skinnedBoundsCache.get(key);
    if (!bounds) {
      const probe = SkeletonUtils.clone(template);
      probe.updateMatrixWorld(true);
      _tmpBox.setFromObject(probe);
      _tmpBox.getSize(_tmpSize);
      _tmpBox.getCenter(_tmpCenter);
      bounds = {
        size: _tmpSize.clone(),
        center: _tmpCenter.clone(),
        minY: _tmpBox.min.y,
      };
      skinnedBoundsCache.set(key, bounds);
    }
    if (bounds.size.y < 1e-5) return null;

    const clone = SkeletonUtils.clone(template);
    const scale = targetHeight / bounds.size.y;
    clone.scale.multiplyScalar(scale);
    clone.position.set(
      -bounds.center.x * scale,
      -bounds.minY * scale,
      -bounds.center.z * scale
    );

    const wrapper = new THREE.Group();
    wrapper.add(clone);
    return wrapper;
  },
  onCoreReady(cb) {
    if (coreLoaded) {
      cb();
      return () => {};
    }
    coreListeners.add(cb);
    return () => {
      coreListeners.delete(cb);
    };
  },
  onReady(cb) {
    if (allLoaded) {
      cb();
      return () => {};
    }
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
  onProgress(cb) {
    progressListeners.add(cb);
    cb(buildProgressSnapshot());
    return () => {
      progressListeners.delete(cb);
    };
  },
  onAssetLoaded(cb) {
    assetLoadedListeners.add(cb);
    return () => {
      assetLoadedListeners.delete(cb);
    };
  },
};
