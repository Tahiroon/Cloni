import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { SpriteKind } from '../types/clinic';
import { glbRegistry, startPreloadGlbs } from './glbRegistry';
import { createCatalogMesh3D, disposeObject3D } from './models3d';
import { createTextureBundle } from './textures3d';

const thumbCache = new Map<string, string>();
const glbRenderedKeys = new Set<string>();
const subscribers = new Set<() => void>();
const pendingQueue = new Map<string, { sprite: SpriteKind; width: number; depth: number }>();
let flushScheduled = false;

function notifySubscribers() {
  subscribers.forEach((cb) => cb());
}

/**
 * Generates crisp 160x160 3D product thumbnails on-demand using a transient
 * offscreen WebGLRenderer, then immediately releases the temporary GPU context.
 */
export function renderThumbBatch(
  specs: Array<{ sprite: SpriteKind; width: number; depth: number }>
): void {
  const glbIsReady = glbRegistry.ready;
  const deduped = new Map<string, { sprite: SpriteKind; width: number; depth: number }>();
  for (const s of specs) {
    const key = `${s.sprite}_${s.width}x${s.depth}`;
    if (!thumbCache.has(key) || (glbIsReady && !glbRenderedKeys.has(key))) {
      deduped.set(key, s);
    }
  }
  const missing = Array.from(deduped.values());
  if (missing.length === 0) return;

  let renderer: THREE.WebGLRenderer | null = null;
  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: 'low-power',
    });
  } catch {
    return;
  }

  const size = 160;
  renderer.setSize(size, size);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnv = new RoomEnvironment();
  const envTarget = pmrem.fromScene(roomEnv, 0.04);
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 0.62;
  roomEnv.dispose();
  pmrem.dispose();

  const hemi = new THREE.HemisphereLight(0xf1f5f9, 0x64748b, 1.05);
  const keyLight = new THREE.DirectionalLight(0xfff4e0, 1.6);
  keyLight.position.set(4, 7, 5);
  const rimLight = new THREE.DirectionalLight(0xbae6fd, 0.58);
  rimLight.position.set(-4, 3, -4);
  scene.add(hemi, keyLight, rimLight);

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 40);
  const textures = createTextureBundle(renderer.capabilities.getMaxAnisotropy());
  const box = new THREE.Box3();
  const center = new THREE.Vector3();
  const dims = new THREE.Vector3();

  for (const item of missing) {
    const key = `${item.sprite}_${item.width}x${item.depth}`;
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
      } catch {
        // Ignore security/readback failures
      }
    }

    scene.remove(mesh);
    disposeObject3D(mesh);
  }

  envTarget.dispose();
  textures.dispose();
  const gl = renderer.getContext();
  renderer.dispose();
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  notifySubscribers();
}

function scheduleThumbRender(spec: { sprite: SpriteKind; width: number; depth: number }) {
  const key = `${spec.sprite}_${spec.width}x${spec.depth}`;
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
  const key = `${sprite}_${width}x${depth}`;
  const [url, setUrl] = useState<string | null>(() => thumbCache.get(key) || null);

  useEffect(() => {
    startPreloadGlbs();
    const update = () => {
      const next = thumbCache.get(key) || null;
      setUrl(next);
    };
    subscribers.add(update);
    const unsubGlb = glbRegistry.onReady(() => {
      if (!glbRenderedKeys.has(key)) {
        scheduleThumbRender({ sprite, width, depth });
      }
    });
    update();
    return () => {
      subscribers.delete(update);
      unsubGlb();
    };
  }, [key, sprite, width, depth]);

  return url;
}
