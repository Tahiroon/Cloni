import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

export interface GlbRegistry {
  ready: boolean;
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
  onReady: (cb: () => void) => () => void;
}

const MODEL_PATHS: Record<string, string> = {
  // Rigged Characters
  char_doctor: '/models/chars/woman_doctor.glb',
  char_woman: '/models/chars/woman_casual.glb',
  char_woman_formal: '/models/chars/woman_doctor.glb',
  char_woman_suit: '/models/chars/woman_suit.glb',
  char_man1: '/models/chars/man_casual1.glb',
  char_man2: '/models/chars/man_casual2.glb',
  char_suit: '/models/chars/man_suit.glb',

  // Furniture & Clinic Props
  furn_bed: '/models/furn/bed.glb',
  furn_bed_single: '/models/furn/bed_single.glb',
  furn_desk: '/models/furn/desk.glb',
  furn_chair_desk: '/models/furn/chair_desk.glb',
  furn_monitor: '/models/furn/monitor.glb',
  furn_bench: '/models/furn/bench_cushion.glb',
  furn_couch: '/models/furn/couch.glb',
  furn_coffee_table: '/models/furn/coffee_table.glb',
  furn_bookshelf: '/models/furn/bookshelf.glb',
  furn_drawer: '/models/furn/drawer_cabinet.glb',
  furn_nightstand: '/models/furn/nightstand.glb',
  furn_chair_modern: '/models/furn/chair_modern.glb',
  furn_chair_1: '/models/furn/chair_1.glb',
  furn_stool: '/models/furn/stool.glb',
  furn_sink: '/models/furn/sink.glb',
  furn_plant1: '/models/furn/plant_1.glb',
  furn_plant2: '/models/furn/plant_2.glb',
  furn_plant_ficus: '/models/furn/plant_ficus.glb',
  furn_wheelchair: '/models/med/wheelchair.glb',
  furn_desk_corner: '/models/kenney_furn/desk_corner.glb',
  furn_lounge_chair: '/models/kenney_furn/lounge_chair.glb',
  furn_lamp_wall: '/models/kenney_furn/lamp_wall.glb',
  furn_med_cabinet: '/models/kenney_furn/med_cabinet.glb',
  fence_wood: '/models/kenney_furn/fence_wood.glb',
  furn_door_double: '/models/furn/door_double.glb',
  furn_door_single: '/models/furn/door_single.glb',
  furn_window: '/models/furn/window_large.glb',
  furn_trashcan: '/models/furn/trashcan.glb',
  furn_lamp_floor: '/models/furn/lamp_floor.glb',
  furn_lamp_desk: '/models/furn/lamp_desk.glb',
  furn_carpet: '/models/furn/carpet.glb',
  furn_curtain: '/models/furn/curtain.glb',

  // Nature & Street
  tree_1: '/models/nature/tree_1.glb',
  tree_2: '/models/nature/tree_2.glb',
  tree_3: '/models/nature/tree_3.glb',
  birch_1: '/models/nature/birch_1.glb',
  bush_1: '/models/nature/bush_1.glb',
  bush_2: '/models/nature/bush_2.glb',
  grass_clump: '/models/nature/grass_clump.glb',
  streetlight: '/models/nature/streetlight.glb',
  traffic_light: '/models/nature/traffic_light.glb',
  sign_noparking: '/models/nature/sign_noparking.glb',
};

const loadedTemplates = new Map<string, THREE.Object3D>();
const listeners = new Set<() => void>();
let loadingStarted = false;
let allLoaded = false;

let maxGlbAnisotropy = 8;

function refineGlbAssets(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const m = child as THREE.Mesh;
      m.castShadow = true;
      m.receiveShadow = true;
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
          std.envMapIntensity = 0.56;
          if (std.roughness > 0.94) {
            std.roughness = 0.85;
          } else if (std.metalness < 0.1 && std.roughness < 0.24) {
            std.roughness = 0.38;
          }
          // Slightly soften overly bright pure-white albedo on imported models
          if (std.color && std.color.r > 0.92 && std.color.g > 0.92 && std.color.b > 0.92) {
            std.color.multiplyScalar(0.86);
          }
        }
      }
    }
  });
}

export function startPreloadGlbs(maxAnisotropy = 8) {
  maxGlbAnisotropy = Math.min(16, Math.max(1, maxAnisotropy));
  if (loadingStarted) return;
  loadingStarted = true;
  const loader = new GLTFLoader();
  const entries = Object.entries(MODEL_PATHS);
  let remaining = entries.length;

  const doneOne = () => {
    remaining -= 1;
    if (remaining <= 0) {
      allLoaded = true;
      listeners.forEach((cb) => cb());
    }
  };

  for (const [key, url] of entries) {
    loader.load(
      url,
      (gltf) => {
        refineGlbAssets(gltf.scene);
        loadedTemplates.set(key, gltf.scene);
        doneOne();
      },
      undefined,
      () => {
        doneOne();
      }
    );
  }
}

export const glbRegistry: GlbRegistry = {
  get ready() {
    return allLoaded;
  },
  getModel(key: string) {
    return loadedTemplates.get(key) || null;
  },
  cloneNormalized(key, opts) {
    const template = loadedTemplates.get(key);
    if (!template) return null;

    const clone = template.clone(true);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.userData.sharedGlbGeom = true;
        child.userData.sharedGlbMat = true;
      }
    });

    const rotHolder = new THREE.Group();
    if (opts.rotY) {
      rotHolder.rotation.y = opts.rotY;
    }
    rotHolder.add(clone);
    rotHolder.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(rotHolder);
    const size = new THREE.Vector3();
    box.getSize(size);

    if (size.y < 1e-5 && size.x < 1e-5) return null;

    const wrapper = new THREE.Group();
    if (opts.stretchToBox) {
      rotHolder.scale.set(
        size.x > 1e-5 ? opts.stretchToBox.w / size.x : 1,
        size.y > 1e-5 ? opts.stretchToBox.h / size.y : 1,
        size.z > 1e-5 ? opts.stretchToBox.d / size.z : 1
      );
    } else {
      let scale = 1;
      if (opts.targetHeight && size.y > 1e-5) {
        scale = opts.targetHeight / size.y;
      }
      if (opts.maxFootprint) {
        const sx = size.x > 1e-5 ? opts.maxFootprint.w / size.x : 99;
        const sz = size.z > 1e-5 ? opts.maxFootprint.d / size.z : 99;
        const fitScale = Math.min(sx, sz);
        scale = opts.targetHeight ? Math.min(scale, fitScale) : fitScale;
      }
      rotHolder.scale.multiplyScalar(scale);
    }
    rotHolder.updateMatrixWorld(true);

    const scaledBox = new THREE.Box3().setFromObject(rotHolder);
    const scaledCenter = new THREE.Vector3();
    scaledBox.getCenter(scaledCenter);

    rotHolder.position.x -= scaledCenter.x;
    rotHolder.position.z -= scaledCenter.z;
    rotHolder.position.y -= scaledBox.min.y;

    wrapper.add(rotHolder);
    return wrapper;
  },
  cloneSkinned(key, targetHeight) {
    const template = loadedTemplates.get(key);
    if (!template) return null;

    const clone = SkeletonUtils.clone(template);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.userData.sharedGlbGeom = true;
        child.userData.sharedGlbMat = true;
      }
    });
    clone.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);
    if (size.y < 1e-5) return null;

    const scale = targetHeight / size.y;
    const wrapper = new THREE.Group();
    clone.scale.multiplyScalar(scale);
    clone.updateMatrixWorld(true);

    const scaledBox = new THREE.Box3().setFromObject(clone);
    const scaledCenter = new THREE.Vector3();
    scaledBox.getCenter(scaledCenter);
    clone.position.x -= scaledCenter.x;
    clone.position.z -= scaledCenter.z;
    clone.position.y -= scaledBox.min.y;

    wrapper.add(clone);
    return wrapper;
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
};
