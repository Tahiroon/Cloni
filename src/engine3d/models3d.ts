import * as THREE from 'three';
import {
  CLINIC_FLOOR_ELEV,
  RECEPTION_CHAIR_LOCAL_X,
  RECEPTION_CHAIR_LOCAL_Z,
  SOLAR_ZONE,
  WORLD_TREES,
  WorldTreeDef,
  WorldTreeSpecies,
} from '../engine/isometricMath';
import { ClinicRoom, SpriteKind } from '../types/clinic';
import { glbRegistry } from './glbRegistry';
import { TextureBundle } from './textures3d';

export { WORLD_TREES };
export type { WorldTreeDef };

function setShadow(obj: THREE.Object3D, cast = true, receive = true) {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      if (child.userData.noCastShadow) {
        child.castShadow = false;
        child.receiveShadow = false;
        return;
      }
      if (child.userData.receiveOnly) {
        child.castShadow = false;
        child.receiveShadow = receive;
        return;
      }
      child.castShadow = cast;
      child.receiveShadow = receive;
    }
  });
}

function makeMat(params: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial(params);
}

export interface ClinicDoorHandle {
  id: string;
  kind: 'sliding_z' | 'swing_z' | 'swing_x';
  centerX: number;
  centerZ: number;
  triggerRadius: number;
  requiredRoomId?: string;
  alwaysOpen?: boolean;
  manualPush?: boolean;
  openAmount: number;
  swingSign?: number;
  holdTimer?: number;
  leftLeaf: THREE.Object3D;
  rightLeaf?: THREE.Object3D;
  baseOffset?: number;
}

export interface DoorActorInput {
  x: number;
  z: number;
  vx: number;
  vz: number;
  isMoving: boolean;
}

export interface SmartLightMeta {
  kind: 'garden_lamp' | 'street_lamp' | 'indoor_lamp' | 'wall_lamp' | 'sign_lamp' | 'ir_lamp';
  localPos: [number, number, number];
  emissiveMats: THREE.MeshStandardMaterial[];
  haloMats?: THREE.MeshBasicMaterial[];
  haloMaxOpacities?: number[];
}

export interface WaterCoolerRigMeta {
  alcoveCup: THREE.Group;
  alcoveWater: THREE.Mesh;
  stream: THREE.Mesh;
  returnedCup: THREE.Group;
  bubble: THREE.Mesh;
}

export interface ReceptionDeskRigMeta {
  deskFile: THREE.Group;
}

export interface FountainRigMeta {
  arcs: THREE.Mesh[];
  ripples: THREE.Mesh[];
  waterMat: THREE.MeshPhysicalMaterial;
}

export interface MagnetoRigMeta {
  solenoidRing: THREE.Group;
  coilMat: THREE.MeshStandardMaterial;
  currentX: number;
}

export interface TiltTableRigMeta {
  tiltGroup: THREE.Group;
  strapsGroup: THREE.Group;
  ramMesh: THREE.Mesh;
  currentTiltAlpha: number;
}

export interface ClinicWorldHandle {
  group: THREE.Group;
  doors: ClinicDoorHandle[];
  skyUniforms: {
    uTopColor: { value: THREE.Color };
    uHorizonColor: { value: THREE.Color };
    uNightFactor: { value: number };
    uTime: { value: number };
  };
  roomLightMats: Map<string, THREE.MeshStandardMaterial>;
  roomWashMats: Map<string, THREE.MeshBasicMaterial>;
  roomPoolMats: Map<string, THREE.MeshBasicMaterial>;
  roomSconceAnchors: Map<string, { x: number; y: number; z: number }>;
  interiorCoveMat: THREE.MeshStandardMaterial;
  entranceSconceMat: THREE.MeshStandardMaterial;
  facadeSignMat: THREE.MeshStandardMaterial;
  villaWinMat: THREE.MeshStandardMaterial;
  pillarLanternMat: THREE.MeshStandardMaterial;
  worldTreeHitMeshes: THREE.Group;
  lockedRoomCovers: THREE.Mesh[];
  setZoomLod: (zoom: number) => void;
  dispose: () => void;
}

export function updateDoors3D(
  doors: ClinicDoorHandle[],
  actors: DoorActorInput[],
  unlockedRooms: Set<string>,
  dt: number
) {
  for (const door of doors) {
    let target = 0;
    let isOpeningNow = false;

    if (door.alwaysOpen) {
      target = 1;
      isOpeningNow = true;
    } else {
      const canOpen = !door.requiredRoomId || unlockedRooms.has(door.requiredRoomId);
      if (canOpen) {
        if (door.manualPush) {
          // Interior hinged doors start yielding smoothly as a person reaches to push (~0.80m),
          // swing smoothly clear as they cross the threshold, then settle closed via hydraulic closer
          let pushed = false;
          let pushTarget = 0;
          let pushDir = door.swingSign ?? 1;

          for (const actor of actors) {
            const dx = actor.x - door.centerX;
            const dz = actor.z - door.centerZ;
            const perpDist = door.kind === 'swing_z' ? Math.abs(dx) : Math.abs(dz);
            const alongDist = door.kind === 'swing_z' ? Math.abs(dz) : Math.abs(dx);
            if (alongDist > 0.62 || perpDist > 0.82) continue;

            const speed = Math.hypot(actor.vx, actor.vz);
            const approachDot =
              door.kind === 'swing_z'
                ? -Math.sign(dx || 1) * (actor.vx / (speed || 1))
                : -Math.sign(dz || 1) * (actor.vz / (speed || 1));
            const headingIntoDoor = actor.isMoving && speed > 0.08 && approachDot > 0.15;

            if (headingIntoDoor && perpDist <= 0.82) {
              pushed = true;
              const proximity = THREE.MathUtils.clamp((0.82 - perpDist) / 0.38, 0.35, 1.0);
              pushTarget = Math.max(pushTarget, proximity);
              if (door.openAmount < 0.18) {
                if (door.kind === 'swing_z') {
                  const travelX = Math.abs(actor.vx) > 0.05 ? Math.sign(actor.vx) : -Math.sign(dx || -1);
                  pushDir = travelX >= 0 ? -1 : 1;
                } else {
                  const travelZ = Math.abs(actor.vz) > 0.05 ? Math.sign(actor.vz) : -Math.sign(dz || -1);
                  pushDir = travelZ >= 0 ? -1 : 1;
                }
                door.swingSign = pushDir;
              }
            } else if (perpDist <= 0.44 && (actor.isMoving || door.openAmount > 0.16)) {
              pushed = true;
              pushTarget = 1.0;
            }
          }

          if (pushed) {
            target = Math.max(door.openAmount, pushTarget);
            isOpeningNow = true;
            door.holdTimer = Math.max(door.holdTimer ?? 0, 0.38);
          } else if ((door.holdTimer ?? 0) > 0) {
            door.holdTimer = Math.max(0, (door.holdTimer ?? 0) - dt);
            target = Math.max(door.openAmount * 0.96, 0.86);
          } else {
            target = 0;
          }
        } else {
          // Automatic exterior sliding entrance doors
          for (const actor of actors) {
            if (Math.hypot(actor.x - door.centerX, actor.z - door.centerZ) <= door.triggerRadius) {
              target = 1;
              isOpeningNow = true;
              break;
            }
          }
        }
      }
    }

    // Smooth inertia curve: calm hydraulic open/close without robotic snap
    const dampRate = door.manualPush
      ? isOpeningNow
        ? 8.2
        : target > 0.05
          ? 3.8
          : 2.6
      : isOpeningNow
        ? 6.4
        : 3.8;
    door.openAmount = THREE.MathUtils.damp(door.openAmount, target, dampRate, dt);
    if (!isOpeningNow && target === 0 && door.openAmount < 0.004) {
      door.openAmount = 0;
    }

    // Soft S-curve easing for hinged leaf feel
    const easedSwing =
      door.openAmount <= 0
        ? 0
        : door.openAmount * door.openAmount * (3 - 2 * door.openAmount) * 0.25 +
          door.openAmount * 0.75;

    if (door.kind === 'sliding_z') {
      const base = door.baseOffset ?? 0.47;
      const slide = door.openAmount * 0.82;
      door.leftLeaf.position.z = -base - slide;
      if (door.rightLeaf) {
        door.rightLeaf.position.z = base + slide;
      }
    } else if (door.kind === 'swing_z') {
      const sign = door.swingSign ?? 1;
      const ang = easedSwing * 1.46 * sign;
      door.leftLeaf.rotation.y = -ang;
      if (door.rightLeaf) {
        door.rightLeaf.rotation.y = ang;
      }
    } else if (door.kind === 'swing_x') {
      const sign = door.swingSign ?? 1;
      const ang = easedSwing * 1.46 * sign;
      door.leftLeaf.rotation.y = ang;
      if (door.rightLeaf) {
        door.rightLeaf.rotation.y = -ang;
      }
    }
  }
}

/**
 * Builds the realistic architectural clinic, sky dome, distant horizon,
 * paved avenue, fountain courtyard, rear solar utility zone, and natural multi-species trees.
 */
function applyFoliageWindShader(
  mat: THREE.Material,
  timeUniform: { value: number },
  amp: number,
  opts?: { heightBase?: number; heightScale?: number; localGrassHeight?: number; tag?: string }
) {
  const heightBase = opts?.heightBase ?? 0.85;
  const heightScale = opts?.heightScale ?? 0.42;
  const localGrassH = opts?.localGrassHeight ?? 0;
  const cacheTag = opts?.tag ?? (localGrassH > 0 ? 'grass' : 'tree');

  mat.customProgramCacheKey = () => `foliage-wind-v1-${cacheTag}`;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = timeUniform;
    shader.uniforms.uWindAmp = { value: amp };
    shader.uniforms.uWindBase = { value: heightBase };
    shader.uniforms.uWindHScale = { value: heightScale };
    shader.uniforms.uLocalGrassH = { value: localGrassH };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uWindTime;
        uniform float uWindAmp;
        uniform float uWindBase;
        uniform float uWindHScale;
        uniform float uLocalGrassH;`
      )
      .replace(
        '#include <project_vertex>',
        `vec4 windWorldPos = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          windWorldPos = instanceMatrix * windWorldPos;
        #endif
        windWorldPos = modelMatrix * windWorldPos;
        float windH = uLocalGrassH > 0.0
          ? clamp(transformed.y / uLocalGrassH, 0.0, 1.0)
          : clamp((windWorldPos.y - uWindBase) * uWindHScale, 0.0, 1.25);
        float gustPhase = uWindTime * 1.25 + windWorldPos.x * 0.31 + windWorldPos.z * 0.23;
        float leafFlutter = sin(uWindTime * 2.85 + windWorldPos.x * 1.85 + windWorldPos.z * 1.65) * 0.34;
        float sway = (sin(gustPhase) + 0.42 * sin(gustPhase * 1.67 + 1.1) + leafFlutter) * uWindAmp * windH;
        windWorldPos.x += sway;
        windWorldPos.z += sway * 0.56;
        vec4 mvPosition = viewMatrix * windWorldPos;
        gl_Position = projectionMatrix * mvPosition;`
      );
  };
}

export function buildClinicWorld3D(
  rooms: ClinicRoom[],
  textures: TextureBundle,
  removedTreeIds: string[] = []
): ClinicWorldHandle {
  const root = new THREE.Group();
  const distantDetailsGroup = new THREE.Group();
  const microDetailsGroup = new THREE.Group();
  root.add(distantDetailsGroup, microDetailsGroup);
  const disposables: Array<{ dispose: () => void }> = [];
  const trackGeom = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.push(m);
    return m;
  };

  // 0. Atmospheric Day/Night Sky Dome with procedural twinkling stars at night
  const skyUniforms = {
    uTopColor: { value: new THREE.Color(0x4b7cb3) },
    uHorizonColor: { value: new THREE.Color(0xd2e0ec) },
    uNightFactor: { value: 0 },
    uTime: { value: 0 },
  };
  const skyMat = trackMat(
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: `
        varying vec3 vWorldPos;
        varying vec3 vLocalDir;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          vLocalDir = normalize(position);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uHorizonColor;
        uniform float uNightFactor;
        uniform float uTime;
        varying vec3 vWorldPos;
        varying vec3 vLocalDir;

        float starHash(vec3 p) {
          p = fract(p * vec3(443.897, 441.423, 437.195));
          p += dot(p, p.yzx + 19.19);
          return fract((p.x + p.y) * p.z);
        }

        float skyHash2(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        float skyNoise2(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(skyHash2(i), skyHash2(i + vec2(1.0, 0.0)), f.x),
            mix(skyHash2(i + vec2(0.0, 1.0)), skyHash2(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }

        float skyFbm(vec2 p) {
          float v = 0.0;
          float a = 0.52;
          for (int i = 0; i < 3; i++) {
            v += a * skyNoise2(p);
            p = p * 2.08 + vec2(13.4, 7.1);
            a *= 0.48;
          }
          return v;
        }

        void main() {
          float h = clamp((vWorldPos.y + 4.0) / 55.0, 0.0, 1.0);
          vec3 col = mix(uHorizonColor, uTopColor, pow(h, 0.65));

          // Soft atmospheric horizon warm haze + daytime high-altitude cloud wisps
          float dayMask = 1.0 - smoothstep(0.0, 0.55, uNightFactor);
          if (dayMask > 0.01 && vLocalDir.y > 0.02) {
            vec2 cloudUv = vLocalDir.xz / (vLocalDir.y + 0.18) * 1.15 + vec2(uTime * 0.0045, uTime * 0.0018);
            float cNoise = skyFbm(cloudUv);
            float cloudBand = smoothstep(0.52, 0.80, cNoise) * smoothstep(0.04, 0.28, vLocalDir.y) * (1.0 - smoothstep(0.55, 0.92, vLocalDir.y));
            vec3 cloudCol = mix(vec3(0.95, 0.96, 0.98), vec3(1.0, 0.98, 0.94), 0.35);
            col = mix(col, cloudCol, cloudBand * 0.38 * dayMask);
          }

          if (uNightFactor > 0.02 && vLocalDir.y > 0.04) {
            vec3 grid = floor(vLocalDir * 135.0);
            float rnd = starHash(grid);
            if (rnd > 0.986) {
              vec3 cellCenter = normalize(grid + 0.5);
              float d = length(vLocalDir - cellCenter) * 135.0;
              float twinkle = 0.65 + 0.35 * sin(uTime * (1.8 + rnd * 4.0) + rnd * 40.0);
              float starMask = smoothstep(0.32, 0.04, d) * smoothstep(0.04, 0.25, vLocalDir.y);
              col += vec3(0.88, 0.93, 1.0) * starMask * twinkle * uNightFactor * 1.15;
            }
          }
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
  );
  const skyDome = new THREE.Mesh(trackGeom(new THREE.SphereGeometry(140, 18, 12)), skyMat);
  skyDome.position.set(14, 0, 12);
  root.add(skyDome);

  // Calibrated Natural Daylight PBR Materials
  const grassMat = trackMat(makeMat({ map: textures.grass, roughness: 0.96, metalness: 0.0 }));
  grassMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec2 vGrassWorldXZ;'
      )
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvGrassWorldXZ = (modelMatrix * vec4(transformed, 1.0)).xz;'
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec2 vGrassWorldXZ;
        float gHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float gNoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(gHash(i), gHash(i + vec2(1.0, 0.0)), f.x),
                     mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), f.x), f.y);
        }`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float nMacro = gNoise(vGrassWorldXZ * 0.14);
        float nMid = gNoise(vGrassWorldXZ * 0.55 + vec2(11.3, 4.7));
        float nFine = gNoise(vGrassWorldXZ * 1.65 + vec2(23.1, 9.4));
        float mixFactor = nMacro * 0.62 + nMid * 0.38;
        float nPatch = gNoise(vGrassWorldXZ * 0.44 + vec2(5.2, 17.8)) * 0.6 + nFine * 0.4;
        float bareEarth = smoothstep(0.68, 0.85, nPatch);
        vec3 lushTone = vec3(0.76, 0.96, 0.68);
        vec3 dryStraw = vec3(1.08, 1.02, 0.76);
        vec3 deepShade = vec3(0.66, 0.80, 0.60);
        vec3 soilColor = vec3(0.45, 0.38, 0.26);
        vec3 tint = mix(deepShade, lushTone, smoothstep(0.2, 0.58, mixFactor));
        tint = mix(tint, dryStraw, smoothstep(0.58, 0.92, mixFactor) * 0.64);
        diffuseColor.rgb *= tint;
        diffuseColor.rgb = mix(diffuseColor.rgb, soilColor * (0.86 + 0.28 * nFine), bareEarth * 0.78);`
      );
  };
  const asphaltMat = trackMat(
    makeMat({
      map: textures.asphalt,
      bumpMap: textures.asphaltBump,
      bumpScale: 0.026,
      roughness: 0.95,
      metalness: 0.0,
    })
  );
  const sidewalkMat = trackMat(makeMat({ map: textures.sidewalk, roughness: 0.88, metalness: 0.01 }));
  const paverMat = trackMat(
    makeMat({
      map: textures.courtyardPaver,
      bumpMap: textures.paverBump,
      bumpScale: 0.018,
      roughness: 0.74,
      metalness: 0.02,
    })
  );
  const curbMat = trackMat(makeMat({ color: 0xb6afa3, roughness: 0.78 }));
  const stuccoWhiteMat = trackMat(
    makeMat({
      map: textures.plasterAlbedo,
      bumpMap: textures.stuccoBump,
      roughnessMap: textures.plasterRough,
      bumpScale: 0.022,
      roughness: 0.94,
      metalness: 0.0,
      envMapIntensity: 0.46,
    })
  );
  const darkMullionMat = trackMat(
    makeMat({
      color: 0x26303e,
      bumpMap: textures.brushedMetalBump,
      bumpScale: 0.003,
      roughness: 0.34,
      metalness: 0.74,
      envMapIntensity: 0.7,
    })
  );
  const aluminumTrimMat = trackMat(
    makeMat({
      color: 0xbac3cf,
      bumpMap: textures.brushedMetalBump,
      bumpScale: 0.004,
      roughness: 0.34,
      metalness: 0.72,
      envMapIntensity: 0.75,
    })
  );
  const wainscotBlueMat = trackMat(
    makeMat({
      map: textures.wainscotAlbedo,
      bumpMap: textures.wainscotBump,
      bumpScale: 0.018,
      roughness: 0.56,
      metalness: 0.05,
    })
  );
  const epdmGasketMat = trackMat(
    makeMat({ color: 0x18202c, roughness: 0.88, metalness: 0.05 })
  );
  const woodSlatMat = trackMat(
    makeMat({
      map: textures.wood,
      bumpMap: textures.woodBump,
      bumpScale: 0.012,
      roughness: 0.62,
      metalness: 0.02,
    })
  );
  const glassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x9ec5e0,
      roughness: 0.08,
      metalness: 0.08,
      transparent: true,
      opacity: 0.34,
      reflectivity: 0.92,
      ior: 1.5,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.05,
    })
  );
  const etchedGlassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xe2eef7,
      roughness: 0.32,
      metalness: 0.02,
      transparent: true,
      opacity: 0.54,
      clearcoat: 0.35,
    })
  );
  const warmLedMat = trackMat(
    makeMat({
      color: 0xfef3c7,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.35,
      roughness: 0.28,
    })
  );
  const entranceSconceMat = trackMat(
    makeMat({
      color: 0xfef3c7,
      emissive: 0xfbbf24,
      emissiveIntensity: 0.25,
      roughness: 0.28,
    })
  );
  const pillarLanternMat = trackMat(
    makeMat({
      color: 0xe2e8f0,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.12,
      roughness: 0.32,
    })
  );
  const villaWinMat = trackMat(
    makeMat({ color: 0xfef3c7, emissive: 0xf59e0b, emissiveIntensity: 0.2, roughness: 0.25 })
  );
  const contactAoMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: textures.contactShadow,
      transparent: true,
      depthWrite: false,
    })
  );
  const aoPlaneGeom = trackGeom(new THREE.PlaneGeometry(1, 1));

  // 1. Focused Clinic Yard Terrain (compact surrounding lawn blending smoothly into horizon fog)
  const lawnGeom = trackGeom(new THREE.PlaneGeometry(96, 96, 36, 36));
  lawnGeom.rotateX(-Math.PI / 2);
  const posAttr = lawnGeom.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < posAttr.count; i++) {
    const wx = posAttr.getX(i) + 14;
    const wz = posAttr.getZ(i) + 12;
    const inClinicPad = wx >= -8.5 && wx <= 39.5 && wz >= -2.5 && wz <= 28.0;
    const inHousePad = wx >= 2.5 && wx <= 12.5 && wz >= -10.5 && wz <= -0.5;
    if (!inClinicPad && !inHousePad) {
      const distClinic = Math.max(0, Math.hypot(Math.max(0, Math.abs(wx - 15) - 16), Math.max(0, Math.abs(wz - 11.5) - 15.5)));
      const blend = Math.min(1, distClinic / 5.5);
      const undulate =
        (Math.sin(wx * 0.16 + wz * 0.11) * 0.16 + Math.cos(wx * 0.09 - wz * 0.18) * 0.12) * blend;
      posAttr.setY(i, undulate);
    }
  }
  lawnGeom.computeVertexNormals();
  const outerLawn = new THREE.Mesh(lawnGeom, grassMat);
  outerLawn.position.set(14, -0.03, 12);
  outerLawn.receiveShadow = true;
  root.add(outerLawn);

  // Uneven 3D Instanced Grass Tufts kept around the immediate clinic yard perimeter (single draw call)
  const tuftGeom = trackGeom(new THREE.ConeGeometry(0.055, 0.24, 3));
  tuftGeom.translate(0, 0.12, 0);
  const tuftMat = trackMat(makeMat({ color: 0xffffff, roughness: 0.9, metalness: 0.0 }));
  applyFoliageWindShader(tuftMat, skyUniforms.uTime, 0.024, { localGrassHeight: 0.24, tag: 'grass' });
  const tuftPositions: Array<[number, number, number, number, number]> = [];
  for (let i = 0; i < 240; i++) {
    const gx = (Math.sin(i * 73.1 + 0.4) * 0.5 + 0.5) * 46 - 8;
    const gz = (Math.cos(i * 41.7 + 1.9) * 0.5 + 0.5) * 36 - 7;
    if (gx >= 1.6 && gx <= 38.2 && gz >= 1.6 && gz <= 22.6) continue; // keep clinic/courtyard/street clean
    if (gx >= -1.2 && gx <= 27.6 && gz >= 22.0 && gz <= 26.8) continue; // keep South garden placement tiles clean
    if (gx >= -1.5 && gx <= 2.0 && gz >= 0 && gz <= 26.8) continue; // keep West garden perimeter clean
    if (gx >= 0 && gx <= 26.8 && gz >= -2.2 && gz <= 2.0) continue; // keep North rear lawn clean
    if (gx >= 10.6 && gx <= 21.8 && gz >= -4.4 && gz <= -1.8) continue; // keep North-East garden lawn clean
    if (gx >= SOLAR_ZONE.minX - 0.5 && gx <= SOLAR_ZONE.maxX + 1.5 && gz >= SOLAR_ZONE.minY - 0.5 && gz <= SOLAR_ZONE.maxY + 1.5) continue; // keep rear west solar pad clean
    if (gx >= 3.8 && gx <= 11.2 && gz >= -8.2 && gz <= -1.6) continue; // keep house plinth clean
    const scY = 0.65 + (i % 5) * 0.22;
    const scW = 0.8 + (i % 4) * 0.18;
    tuftPositions.push([gx, gz, scW, scY, i * 1.37]);
  }
  const tuftInst = new THREE.InstancedMesh(tuftGeom, tuftMat, tuftPositions.length);
  const _tMat4 = new THREE.Matrix4();
  const _tQuat = new THREE.Quaternion();
  const _tPos = new THREE.Vector3();
  const _tScale = new THREE.Vector3();
  const _tEuler = new THREE.Euler();
  const _tCol = new THREE.Color();
  const tuftColors = [0x4c7c32, 0x5d8d3b, 0x3b6727, 0x739444, 0x899a4a];
  tuftPositions.forEach(([gx, gz, sw, sy, rot], idx) => {
    _tPos.set(gx, -0.03, gz);
    _tEuler.set(((idx % 3) - 1) * 0.14, rot, ((idx % 5) - 2) * 0.09);
    _tQuat.setFromEuler(_tEuler);
    _tScale.set(sw, sy, sw);
    _tMat4.compose(_tPos, _tQuat, _tScale);
    tuftInst.setMatrixAt(idx, _tMat4);
    _tCol.setHex(tuftColors[idx % tuftColors.length]);
    tuftInst.setColorAt(idx, _tCol);
  });
  tuftInst.instanceMatrix.needsUpdate = true;
  if (tuftInst.instanceColor) tuftInst.instanceColor.needsUpdate = true;
  tuftInst.computeBoundingSphere();
  tuftInst.receiveShadow = true;
  microDetailsGroup.add(tuftInst);

  const campusWallMat = trackMat(makeMat({ color: 0xdad1c4, bumpMap: textures.stuccoBump, bumpScale: 0.015, roughness: 0.88 }));
  const shingleMat = trackMat(makeMat({ map: textures.roofShingle, roughness: 0.84 }));
  const shutterMat = trackMat(makeMat({ color: 0x3b5249, roughness: 0.72 }));

  // Single Cozy 2-Story Doctor's Residence Cottage (compact proportions behind the taller clinic)
  const buildDoctorVilla = (hx: number, hz: number, rotY = 0) => {
    const hg = new THREE.Group();
    hg.position.set(hx, 0, hz);
    hg.rotation.y = rotY;

    const w = 4.25;
    const d = 3.15;
    const h = 3.35;

    const basePlinth = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(w + 0.28, 0.28, d + 0.28)), paverMat);
    basePlinth.position.y = 0.14;
    basePlinth.castShadow = true;
    basePlinth.receiveShadow = true;
    hg.add(basePlinth);

    const body = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(w, h, d)), campusWallMat);
    body.position.y = 0.28 + h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    hg.add(body);

    // Mid-floor architectural stone belt cornice + corner pilasters
    const midBelt = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(w + 0.14, 0.13, d + 0.14)), stuccoWhiteMat);
    midBelt.position.y = 0.28 + 1.66;
    hg.add(midBelt);
    const eaveBelt = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(w + 0.18, 0.13, d + 0.18)), stuccoWhiteMat);
    eaveBelt.position.y = 0.28 + h - 0.03;
    hg.add(eaveBelt);

    for (const cx of [-w / 2 + 0.08, w / 2 - 0.08]) {
      for (const cz of [-d / 2 + 0.08, d / 2 - 0.08]) {
        const pil = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.18, h, 0.18)), stuccoWhiteMat);
        pil.position.set(cx, 0.28 + h / 2, cz);
        hg.add(pil);
      }
    }

    // Steep pitched clay-shingle roof + full gables
    const roofPeak = 1.22;
    const halfD = d / 2 + 0.34;
    const slopeLen = Math.hypot(halfD, roofPeak);
    const slopeAng = Math.atan2(roofPeak, halfD);
    for (const side of [-1, 1]) {
      const slope = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(w + 0.56, 0.11, slopeLen)), shingleMat);
      slope.position.set(0, 0.28 + h + roofPeak / 2 - 0.03, side * (halfD / 2));
      slope.rotation.x = side * slopeAng;
      slope.castShadow = true;
      slope.receiveShadow = true;
      hg.add(slope);
    }
    const ridgeCap = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(w + 0.62, 0.11, 0.16)), darkMullionMat);
    ridgeCap.position.set(0, 0.28 + h + roofPeak - 0.02, 0);
    hg.add(ridgeCap);

    const gableShape = new THREE.Shape();
    gableShape.moveTo(-d / 2, 0);
    gableShape.lineTo(d / 2, 0);
    gableShape.lineTo(0, roofPeak - 0.05);
    gableShape.closePath();
    const gableGeom = trackGeom(new THREE.ExtrudeGeometry(gableShape, { depth: w - 0.06, bevelEnabled: false }));
    const gableMesh = new THREE.Mesh(gableGeom, campusWallMat);
    gableMesh.rotation.y = Math.PI / 2;
    gableMesh.position.set(-(w - 0.06) / 2, 0.28 + h - 0.02, 0);
    gableMesh.castShadow = true;
    hg.add(gableMesh);

    // Brick chimney
    const chimneyMat = trackMat(makeMat({ color: 0x8d4838, roughness: 0.88 }));
    const chimney = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.4, 1.05, 0.4)), chimneyMat);
    chimney.position.set(1.32, 0.28 + h + 0.78, -0.56);
    chimney.castShadow = true;
    const chimneyCap = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.48, 0.08, 0.48)), curbMat);
    chimneyCap.position.set(1.32, 0.28 + h + 1.34, -0.56);
    hg.add(chimney, chimneyCap);

    // Covered portico porch & front door
    const porchRoof = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(1.62, 0.08, 0.92)), shingleMat);
    porchRoof.position.set(0, 2.02, d / 2 + 0.42);
    porchRoof.rotation.x = 0.2;
    porchRoof.castShadow = true;
    hg.add(porchRoof);
    for (const px of [-0.68, 0.68]) {
      const col = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.11, 1.72, 0.11)), stuccoWhiteMat);
      col.position.set(px, 1.14, d / 2 + 0.72);
      col.castShadow = true;
      hg.add(col);
    }
    const porchFloor = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(1.68, 0.25, 0.92)), paverMat);
    porchFloor.position.set(0, 0.125, d / 2 + 0.42);
    const frontDoor = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.74, 1.5, 0.08)), woodSlatMat);
    frontDoor.position.set(0, 1.03, d / 2 + 0.03);
    hg.add(porchFloor, frontDoor);

    const winGlowMat = villaWinMat;
    const addVillaWin = (wx: number, wy: number, wz: number, rotYWin = 0) => {
      const wg = new THREE.Group();
      wg.position.set(wx, wy, wz);
      wg.rotation.y = rotYWin;
      const frame = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.72, 0.82, 0.08)), darkMullionMat);
      const pane = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.58, 0.68, 0.1)), winGlowMat);
      const sill = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.82, 0.06, 0.14)), paverMat);
      sill.position.y = -0.43;
      const mullV = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.04, 0.7, 0.11)), stuccoWhiteMat);
      const mullH = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.6, 0.04, 0.11)), stuccoWhiteMat);
      for (const sx of [-0.45, 0.45]) {
        const shut = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.18, 0.78, 0.05)), shutterMat);
        shut.position.set(sx, 0, 0.02);
        wg.add(shut);
      }
      wg.add(frame, pane, sill, mullV, mullH);
      hg.add(wg);
    };
    // Ground-floor windows
    addVillaWin(-1.36, 1.15, d / 2 + 0.02);
    addVillaWin(1.36, 1.15, d / 2 + 0.02);
    addVillaWin(-w / 2 - 0.02, 1.15, -0.52, -Math.PI / 2);
    addVillaWin(-w / 2 - 0.02, 1.15, 0.64, -Math.PI / 2);
    addVillaWin(w / 2 + 0.02, 1.15, -0.52, Math.PI / 2);
    addVillaWin(w / 2 + 0.02, 1.15, 0.64, Math.PI / 2);
    // Second-floor windows
    addVillaWin(-1.36, 2.74, d / 2 + 0.02);
    addVillaWin(0, 2.74, d / 2 + 0.02);
    addVillaWin(1.36, 2.74, d / 2 + 0.02);
    addVillaWin(-w / 2 - 0.02, 2.74, -0.52, -Math.PI / 2);
    addVillaWin(-w / 2 - 0.02, 2.74, 0.64, -Math.PI / 2);
    addVillaWin(w / 2 + 0.02, 2.74, -0.52, Math.PI / 2);
    addVillaWin(w / 2 + 0.02, 2.74, 0.64, Math.PI / 2);

    root.add(hg);
  };
  buildDoctorVilla(7.2, -4.6, 0.04);

  // 2. Natural Garden Flagstone Promenade & Compact Sandy-Gravel Front Approach (focused around the clinic)
  const promenade = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(2.58, 0.08, 40)), sidewalkMat);
  promenade.position.set(28.4, 0.015, 12);
  promenade.receiveShadow = true;
  root.add(promenade);

  // Subtle weathered stone garden edging along courtyard perimeter
  const promCurb = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.22, 0.11, 38)), curbMat);
  promCurb.position.set(27.05, 0.03, 12);
  promCurb.receiveShadow = true;
  root.add(promCurb);

  // Main Imperfect Natural Garden Lane (packed sandy earth, trimmed closely to clinic perimeter)
  const gardenLane = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(8.2, 0.04, 42)), asphaltMat);
  gardenLane.position.set(33.75, -0.02, 12);
  gardenLane.receiveShadow = true;
  root.add(gardenLane);

  // Soft grassy soil verge flanking eastern side of garden lane (x = 37.85 .. 39.8)
  const vergeSoilMat = trackMat(makeMat({ color: 0x5c723e, roughness: 0.96 }));
  const eastVerge = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(2.0, 0.045, 42)), vergeSoilMat);
  eastVerge.position.set(38.85, -0.01, 12);
  eastVerge.receiveShadow = true;
  root.add(eastVerge);

  // Instanced Rustic Stone Border Cobbles along walkway edge (irregular organic placement, 1 draw call)
  const cobbleGeom = trackGeom(new THREE.BoxGeometry(0.26, 0.09, 0.42));
  const cobbleMat = trackMat(makeMat({ color: 0xffffff, roughness: 0.9 }));
  const cobbleCoords: Array<[number, number, number, number, number]> = [];
  for (let z = -6; z <= 30; z += 0.56) {
    if (z >= 13.6 && z <= 16.4) continue; // natural entrance path gap
    if (Math.abs(Math.round(z * 1.7)) % 9 === 0) continue; // occasional missing/sunken cobble for realism
    const jx = Math.sin(z * 3.1) * 0.055;
    const jRot = Math.cos(z * 2.4) * 0.14;
    const scZ = 0.85 + (Math.abs(Math.sin(z * 5.2)) * 0.35);
    cobbleCoords.push([29.68 + jx, 0.018, z, jRot, scZ]);
  }
  const cobbleInst = new THREE.InstancedMesh(cobbleGeom, cobbleMat, cobbleCoords.length);
  cobbleInst.receiveShadow = true;
  cobbleInst.castShadow = false;
  const cobbleTones = [0xb3a895, 0x9f9482, 0xc2b7a3, 0x8d8573];
  cobbleCoords.forEach(([cx, cy, cz, rot, scZ], idx) => {
    _tPos.set(cx, cy, cz);
    _tEuler.set(0, rot, (idx % 3 - 1) * 0.04);
    _tQuat.setFromEuler(_tEuler);
    _tScale.set(0.9 + (idx % 3) * 0.12, 0.9 + (idx % 2) * 0.15, scZ);
    _tMat4.compose(_tPos, _tQuat, _tScale);
    cobbleInst.setMatrixAt(idx, _tMat4);
    _tCol.setHex(cobbleTones[idx % cobbleTones.length]);
    cobbleInst.setColorAt(idx, _tCol);
  });
  cobbleInst.instanceMatrix.needsUpdate = true;
  if (cobbleInst.instanceColor) cobbleInst.instanceColor.needsUpdate = true;
  cobbleInst.computeBoundingSphere();
  microDetailsGroup.add(cobbleInst);

  // Instanced Natural Flagstone Stepping Path leading across garden lane into clinic entrance (z ~ 15)
  const stepStoneGeom = trackGeom(new THREE.CylinderGeometry(0.42, 0.46, 0.05, 7));
  const stepStoneCoords: Array<[number, number, number, number]> = [
    [30.15, 14.55, 0.2, 0.92],
    [30.25, 15.48, 0.8, 0.88],
    [31.05, 14.95, 1.3, 1.04],
    [31.9, 14.52, 0.5, 0.85],
    [32.05, 15.45, 2.1, 0.95],
    [32.95, 15.02, 0.9, 1.0],
    [33.85, 14.65, 1.7, 0.9],
    [34.7, 15.28, 0.4, 0.94],
    [35.6, 14.88, 1.2, 0.88],
    [36.55, 15.15, 2.3, 0.92],
  ];
  const stepInst = new THREE.InstancedMesh(stepStoneGeom, cobbleMat, stepStoneCoords.length);
  stepInst.receiveShadow = true;
  stepStoneCoords.forEach(([sx, sz, rot, sc], idx) => {
    _tPos.set(sx, 0.008, sz);
    _tEuler.set(0, rot, 0);
    _tQuat.setFromEuler(_tEuler);
    _tScale.set(sc * 1.1, 1, sc * 0.85);
    _tMat4.compose(_tPos, _tQuat, _tScale);
    stepInst.setMatrixAt(idx, _tMat4);
    _tCol.setHex(idx % 2 === 0 ? 0xc2b9a7 : 0xaea492);
    stepInst.setColorAt(idx, _tCol);
  });
  stepInst.instanceMatrix.needsUpdate = true;
  if (stepInst.instanceColor) stepInst.instanceColor.needsUpdate = true;
  stepInst.computeBoundingSphere();
  microDetailsGroup.add(stepInst);

  // Instanced Garden Lane Border Grass Tufts & Pebbles along organic margins (1 draw call)
  const laneTuftCoords: Array<[number, number, number]> = [];
  for (let i = 0; i < 40; i++) {
    const gz = -5 + i * 0.88 + (Math.sin(i * 4.3) * 0.25);
    if (gz >= 13.6 && gz <= 16.4) continue;
    const sideX = i % 2 === 0 ? 29.88 + Math.abs(Math.sin(i * 2.1)) * 0.28 : 37.55 - Math.abs(Math.cos(i * 3.1)) * 0.35;
    laneTuftCoords.push([sideX, gz, 0.75 + (i % 4) * 0.22]);
  }
  const laneTuftInst = new THREE.InstancedMesh(tuftGeom, tuftMat, laneTuftCoords.length);
  laneTuftInst.receiveShadow = true;
  laneTuftCoords.forEach(([gx, gz, sy], idx) => {
    _tPos.set(gx, -0.01, gz);
    _tEuler.set(0, idx * 1.1, (idx % 3 - 1) * 0.1);
    _tQuat.setFromEuler(_tEuler);
    _tScale.set(0.95, sy, 0.95);
    _tMat4.compose(_tPos, _tQuat, _tScale);
    laneTuftInst.setMatrixAt(idx, _tMat4);
    _tCol.setHex(tuftColors[idx % tuftColors.length]);
    laneTuftInst.setColorAt(idx, _tCol);
  });
  laneTuftInst.instanceMatrix.needsUpdate = true;
  if (laneTuftInst.instanceColor) laneTuftInst.instanceColor.needsUpdate = true;
  laneTuftInst.computeBoundingSphere();
  microDetailsGroup.add(laneTuftInst);

  // Natural Low Wooden Garden Bollards along walkway corners
  for (const bz of [5.4, 13.2, 16.8, 22.8]) {
    const bollard = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.065, 0.075, 0.56, 8)), woodSlatMat);
    bollard.position.set(29.75, 0.28, bz);
    microDetailsGroup.add(bollard);
  }

  // Courtyard travertine stone walkway + wide architectural entrance staircase from open gate (x=27) up to glass doors (x=22)
  // Walkway spans x: 23.52 .. 27.15 (width 3.63m, top = 0.065)
  const walkway = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(3.63, 0.08, 2.75)), paverMat);
  walkway.position.set(25.335, 0.025, 15.0);
  walkway.receiveShadow = true;
  root.add(walkway);

  // Architectural staircase materials: bullnose travertine, recessed riser reveal, brushed bronze anti-slip nosing, recessed step LED
  const stairBodyMat = trackMat(makeMat({ color: 0xcdc4b6, roughness: 0.78, metalness: 0.02 }));
  const riserRevealMat = trackMat(makeMat({ color: 0x47515e, roughness: 0.85, metalness: 0.06 }));
  const nosingMat = trackMat(
    makeMat({
      color: 0x2d3748,
      bumpMap: textures.brushedMetalBump,
      bumpScale: 0.004,
      roughness: 0.36,
      metalness: 0.65,
    })
  );

  const stairsGroup = new THREE.Group();
  const clearTreadW = 2.08; // z: 13.96 .. 16.04 between cheek walls

  // Top entrance landing (x: 21.96 .. 22.56, top flush with indoor threshold = 0.345)
  const landingBase = new THREE.Mesh(
    trackGeom(new THREE.BoxGeometry(0.62, 0.35, clearTreadW + 0.24)),
    stairBodyMat
  );
  landingBase.position.set(22.26, 0.16, 15.0);
  landingBase.castShadow = true;
  landingBase.receiveShadow = true;
  const landingTop = new THREE.Mesh(
    trackGeom(new THREE.BoxGeometry(0.62, 0.036, clearTreadW + 0.02)),
    paverMat
  );
  landingTop.position.set(22.26, 0.327, 15.0); // top = 0.345
  landingTop.receiveShadow = true;
  const landingNosing = new THREE.Mesh(
    trackGeom(new THREE.BoxGeometry(0.038, 0.012, clearTreadW)),
    nosingMat
  );
  landingNosing.position.set(22.55, 0.342, 15.0);
  const landingLed = new THREE.Mesh(
    trackGeom(new THREE.BoxGeometry(0.018, 0.012, clearTreadW - 0.14)),
    entranceSconceMat
  );
  landingLed.position.set(22.552, 0.322, 15.0);
  stairsGroup.add(landingBase, landingTop, landingNosing, landingLed);

  // 3 descending architectural steps (top = 0.275, 0.205, 0.135 -> courtyard walkway = 0.065)
  const stepSpecs: Array<{ xMin: number; xMax: number; topY: number }> = [
    { xMin: 22.56, xMax: 22.88, topY: 0.275 },
    { xMin: 22.88, xMax: 23.20, topY: 0.205 },
    { xMin: 23.20, xMax: 23.52, topY: 0.135 },
  ];
  for (const st of stepSpecs) {
    const tLen = st.xMax - st.xMin;
    const cx = (st.xMin + st.xMax) / 2;
    const riserH = Math.max(0.05, st.topY - 0.036 + 0.01);
    // Solid recessed stone riser block (inset slightly along +X so bullnose tread overhangs cleanly)
    const riser = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(tLen - 0.018, riserH, clearTreadW)),
      riserRevealMat
    );
    riser.position.set(cx - 0.009, (st.topY - 0.036) - riserH / 2, 15.0);
    riser.castShadow = true;
    riser.receiveShadow = true;

    // Overhanging honed travertine tread slab
    const tread = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(tLen + 0.028, 0.036, clearTreadW + 0.02)),
      paverMat
    );
    tread.position.set(cx + 0.008, st.topY - 0.018, 15.0);
    tread.castShadow = true;
    tread.receiveShadow = true;

    // Anti-slip brushed bronze safety nosing strip
    const nosing = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(0.036, 0.011, clearTreadW)),
      nosingMat
    );
    nosing.position.set(st.xMax + 0.002, st.topY - 0.002, 15.0);

    // Subtle warm recessed under-nosing LED accent strip
    const stepLed = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(0.016, 0.012, clearTreadW - 0.14)),
      entranceSconceMat
    );
    stepLed.position.set(st.xMax - 0.005, st.topY - 0.022, 15.0);

    stairsGroup.add(riser, tread, nosing, stepLed);
  }

  // Flanking stepped architectural limestone cheek walls + brushed stainless handrails (z = 13.89 & z = 16.11)
  for (const zSide of [13.89, 16.11]) {
    // Lower base stringer wall supporting handrail posts
    const cheekUpper = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(0.68, 0.44, 0.12)),
      stuccoWhiteMat
    );
    cheekUpper.position.set(22.34, 0.21, zSide);
    cheekUpper.castShadow = true;
    cheekUpper.receiveShadow = true;

    const cheekMid = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(0.66, 0.30, 0.12)),
      stuccoWhiteMat
    );
    cheekMid.position.set(22.92, 0.14, zSide);
    cheekMid.castShadow = true;
    cheekMid.receiveShadow = true;

    const cheekLow = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(0.38, 0.19, 0.12)),
      stuccoWhiteMat
    );
    cheekLow.position.set(23.38, 0.085, zSide);
    cheekLow.castShadow = true;
    cheekLow.receiveShadow = true;

    // Coping caps on cheek walls
    const capUpper = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.70, 0.04, 0.145)), paverMat);
    capUpper.position.set(22.34, 0.445, zSide);
    const capMid = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.66, 0.04, 0.145)), paverMat);
    capMid.position.set(22.92, 0.305, zSide);
    const capLow = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.40, 0.04, 0.145)), paverMat);
    capLow.position.set(23.38, 0.195, zSide);

    // Brushed stainless-steel handrail stanchion posts + sloped continuous top bar
    const postTop = new THREE.Mesh(
      trackGeom(new THREE.CylinderGeometry(0.022, 0.024, 0.56, 8)),
      aluminumTrimMat
    );
    postTop.position.set(22.24, 0.72, zSide);

    const postMid = new THREE.Mesh(
      trackGeom(new THREE.CylinderGeometry(0.022, 0.024, 0.54, 8)),
      aluminumTrimMat
    );
    postMid.position.set(22.88, 0.57, zSide);

    const postBot = new THREE.Mesh(
      trackGeom(new THREE.CylinderGeometry(0.022, 0.024, 0.53, 8)),
      aluminumTrimMat
    );
    postBot.position.set(23.48, 0.46, zSide);

    // Flat landing rail + angled stair slope rail connecting cleanly
    const flatRail = new THREE.Mesh(
      trackGeom(new THREE.CylinderGeometry(0.024, 0.024, 0.36, 8)),
      aluminumTrimMat
    );
    flatRail.rotation.z = Math.PI / 2;
    flatRail.position.set(22.39, 1.00, zSide);

    const dxR = 23.50 - 22.54;
    const dyR = 0.72 - 1.00;
    const slopeLenR = Math.hypot(dxR, dyR);
    const slopeRail = new THREE.Mesh(
      trackGeom(new THREE.CylinderGeometry(0.024, 0.024, slopeLenR, 8)),
      aluminumTrimMat
    );
    slopeRail.rotation.z = Math.PI / 2 + Math.atan2(dyR, dxR);
    slopeRail.position.set((22.54 + 23.50) / 2, (1.00 + 0.72) / 2, zSide);

    stairsGroup.add(
      cheekUpper,
      cheekMid,
      cheekLow,
      capUpper,
      capMid,
      capLow,
      postTop,
      postMid,
      postBot,
      flatRail,
      slopeRail
    );
  }
  root.add(stairsGroup);

  // Courtyard Garden Terrace Plaza & Pergola Lounge (x: 22..26.8, z: 2..21)
  const courtyardTerrace = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(4.2, 0.04, 5.2)), paverMat);
  courtyardTerrace.position.set(24.5, 0.01, 5.1);
  courtyardTerrace.receiveShadow = true;
  root.add(courtyardTerrace);

  // Architectural Timber Pergola Canopy over courtyard garden bench
  for (const px of [23.1, 25.0]) {
    for (const pz of [3.55, 5.45]) {
      const post = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.11, 2.25, 0.11)), darkMullionMat);
      post.position.set(px, 1.12, pz);
      post.castShadow = true;
      root.add(post);
    }
  }
  for (let rz = 3.55; rz <= 5.5; rz += 0.38) {
    const beam = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(2.2, 0.07, 0.09)), woodSlatMat);
    beam.position.set(24.05, 2.28, rz);
    beam.castShadow = true;
    root.add(beam);
  }

  // 3. Compound Perimeter Architectural Fence (stucco + timber rail slats) around x=27, z=2..22
  const addFenceSegment = (x: number, z: number, lenX: number, lenZ: number) => {
    const base = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(lenX, 0.42, lenZ)),
      stuccoWhiteMat
    );
    base.position.set(x, 0.21, z);
    base.castShadow = true;
    base.receiveShadow = true;
    root.add(base);

    const rail = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(lenX * 0.98, 0.14, lenZ * 0.98)),
      woodSlatMat
    );
    rail.position.set(x, 0.49, z);
    rail.castShadow = true;
    root.add(rail);
  };

  addFenceSegment(27.0, 7.85, 0.22, 11.7);
  addFenceSegment(27.0, 19.15, 0.22, 5.7);
  addFenceSegment(24.5, 2.0, 5.0, 0.22);
  addFenceSegment(24.5, 22.0, 5.0, 0.22);

  for (const pz of [13.75, 16.25]) {
    const pillar = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.42, 1.12, 0.42)), stuccoWhiteMat);
    pillar.position.set(27.0, 0.56, pz);
    pillar.castShadow = true;
    root.add(pillar);
    const cap = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.48, 0.06, 0.48)), darkMullionMat);
    cap.position.set(27.0, 1.15, pz);
    const lantern = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.24, 0.18, 0.24)), pillarLanternMat);
    lantern.position.set(27.0, 1.27, pz);
    root.add(cap, lantern);
  }

  const doors: ClinicDoorHandle[] = [];

  // Exterior Compound Gate (Permanently Open! x=27.0, z=15.0)
  const gateLeftPivot = new THREE.Group();
  gateLeftPivot.position.set(27.0, 0.04, 13.95);
  const gateRightPivot = new THREE.Group();
  gateRightPivot.position.set(27.0, 0.04, 16.05);
  for (const [piv, dir] of [
    [gateLeftPivot, 1],
    [gateRightPivot, -1],
  ] as Array<[THREE.Group, number]>) {
    const frame = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.08, 0.74, 0.96)), darkMullionMat);
    frame.position.set(0, 0.4, dir * 0.48);
    frame.castShadow = true;
    const panel = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.05, 0.52, 0.84)), woodSlatMat);
    panel.position.set(0, 0.4, dir * 0.48);
    piv.add(frame, panel);
    root.add(piv);
  }
  gateLeftPivot.rotation.y = -1.42;
  gateRightPivot.rotation.y = 1.42;
  doors.push({
    id: 'courtyard_gate',
    kind: 'swing_z',
    centerX: 27.0,
    centerZ: 15.0,
    triggerRadius: 2.2,
    alwaysOpen: true,
    openAmount: 1,
    leftLeaf: gateLeftPivot,
    rightLeaf: gateRightPivot,
  });

  // Dedicated Rear West Solar Energy Zone Utility Pad directly behind the clinic's solid West wall (far from the Doctor's Villa)
  {
    const solarW = SOLAR_ZONE.maxX - SOLAR_ZONE.minX + 1;
    const solarD = SOLAR_ZONE.maxY - SOLAR_ZONE.minY + 1;
    const solarCx = SOLAR_ZONE.minX + solarW / 2;
    const solarCz = SOLAR_ZONE.minY + solarD / 2;
    const solarPad = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(solarW + 0.16, 0.05, solarD + 0.16)),
      paverMat
    );
    solarPad.position.set(solarCx, 0.005, solarCz);
    solarPad.receiveShadow = true;
    const solarTrim = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(solarW + 0.28, 0.035, solarD + 0.28)),
      curbMat
    );
    solarTrim.position.set(solarCx, -0.005, solarCz);
    solarTrim.receiveShadow = true;
    // Conduit cable bridge running East from the Rear West solar pad straight into the clinic's West wall (x=2.0)
    const padEastEdge = SOLAR_ZONE.maxX + 1.0;
    const conduitLen = Math.max(1.0, 1.9 - padEastEdge);
    const conduit = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(conduitLen, 0.07, 0.22)),
      darkMullionMat
    );
    conduit.position.set(padEastEdge + conduitLen / 2, 0.035, solarCz);
    conduit.receiveShadow = true;
    // Solar inverter / junction box mounted on the exterior West clinic rear wall
    const inverterBox = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(0.16, 0.54, 0.42)),
      aluminumTrimMat
    );
    inverterBox.position.set(1.82, 1.25, solarCz);
    inverterBox.castShadow = true;
    const inverterLed = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(0.03, 0.08, 0.08)),
      trackMat(makeMat({ color: 0x34d399, emissive: 0x10b981, emissiveIntensity: 0.9, roughness: 0.3 }))
    );
    inverterLed.position.set(1.73, 1.38, solarCz);
    root.add(solarTrim, solarPad, conduit, inverterBox, inverterLed);
  }

  // Courtyard architectural shrubs (keeps South, North & West garden tiles clear for player decor!)
  const bushCoords: Array<[number, number, string]> = [
    [22.48, 3.2, 'bush_1'],
    [22.48, 12.4, 'bush_2'],
    [26.45, 3.8, 'bush_1'],
    [26.45, 20.6, 'bush_2'],
  ];
  for (const [bx, bz, key] of bushCoords) {
    const bush = glbRegistry.cloneNormalized(key, { targetHeight: 0.62, rotY: bx + bz });
    if (bush) {
      bush.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) o.castShadow = false;
      });
      bush.position.set(bx, 0.02, bz);
      root.add(bush);
    }
  }
  for (const [gx, gz] of [
    [-2.4, 4.2],
    [-2.6, 20.8],
    [3.8, 28.0],
    [14.2, 28.2],
    [24.2, 28.0],
  ]) {
    const grassClump = glbRegistry.cloneNormalized('grass_clump', { targetHeight: 0.34, rotY: gx * 2 });
    if (grassClump) {
      grassClump.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) o.castShadow = false;
      });
      grassClump.position.set(gx, 0.0, gz);
      microDetailsGroup.add(grassClump);
    }
  }

  // 4. Elevated Architectural Clinic Foundation Podium & Realistic Medical Floors (x: 2..22, z: 2..22)
  const plinth = new THREE.Mesh(
    trackGeom(new THREE.BoxGeometry(20.66, 0.24, 20.66)),
    trackMat(makeMat({ color: 0x8e99a6, roughness: 0.84 }))
  );
  plinth.position.set(12.0, 0.08, 12.0); // extends from y=-0.04 up to y=0.20
  plinth.receiveShadow = true;
  root.add(plinth);

  const plinthCoping = new THREE.Mesh(
    trackGeom(new THREE.BoxGeometry(20.44, 0.14, 20.44)),
    trackMat(makeMat({ color: 0xb6c0cc, roughness: 0.72 }))
  );
  plinthCoping.position.set(12.0, 0.23, 12.0); // extends up to y=0.30 seamlessly under clinic slab
  plinthCoping.receiveShadow = true;
  root.add(plinthCoping);

  const clinicBuildingGroup = new THREE.Group();
  clinicBuildingGroup.position.y = CLINIC_FLOOR_ELEV;
  root.add(clinicBuildingGroup);

  const slab = new THREE.Mesh(
    trackGeom(new THREE.BoxGeometry(20.28, 0.08, 20.28)),
    trackMat(makeMat({ color: 0xc8d0da, roughness: 0.72 }))
  );
  slab.position.set(12.0, -0.005, 12.0); // top at y=0.035, cleanly beneath tiled floorMesh (0.035..0.085)
  slab.receiveShadow = true;
  clinicBuildingGroup.add(slab);

  const applyMedicalFloorShader = (
    mat: THREE.MeshStandardMaterial,
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number
  ) => {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uRoomBounds = { value: new THREE.Vector4(minX, maxX, minZ, maxZ) };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vFloorWorldXZ;')
        .replace(
          '#include <worldpos_vertex>',
          '#include <worldpos_vertex>\nvFloorWorldXZ = (modelMatrix * vec4(transformed, 1.0)).xz;'
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec2 vFloorWorldXZ;
          uniform vec4 uRoomBounds;
          float mfHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float mfNoise(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(mfHash(i), mfHash(i + vec2(1.0, 0.0)), f.x),
                       mix(mfHash(i + vec2(0.0, 1.0)), mfHash(i + vec2(1.0, 1.0)), f.x), f.y);
          }`
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          float mBroad = mfNoise(vFloorWorldXZ * 0.24);
          float mSubtle = mfNoise(vFloorWorldXZ * 0.72 + vec2(7.1, 3.4));
          diffuseColor.rgb *= (0.975 + 0.042 * (mBroad * 0.65 + mSubtle * 0.35));
          float dWall = min(
            min(vFloorWorldXZ.x - uRoomBounds.x, uRoomBounds.y - vFloorWorldXZ.x),
            min(vFloorWorldXZ.y - uRoomBounds.z, uRoomBounds.w - vFloorWorldXZ.y)
          );
          float wallAo = smoothstep(0.0, 0.36, dWall);
          diffuseColor.rgb *= mix(0.89, 1.0, wallAo);`
        );
    };
  };

  const cloneTileTex = (src: THREE.CanvasTexture, rx: number, ry: number) => {
    const t = src.clone();
    t.needsUpdate = true;
    t.repeat.set(rx, ry);
    disposables.push(t);
    return t;
  };

  const lockedRoomCovers: THREE.Mesh[] = [];
  for (const room of rooms) {
    const w = room.maxX - room.minX + 1;
    const d = room.maxY - room.minY + 1;
    const cx = room.minX + w / 2;
    const cz = room.minY + d / 2;
    const repX = w * 0.5;
    const repY = d * 0.5;

    const roughTex = cloneTileTex(textures.tileBlueRough, repX, repY);
    const normalTex = cloneTileTex(textures.tileNormal, repX, repY);

    let mat: THREE.MeshStandardMaterial;
    if (!room.unlocked) {
      const lockedTex = cloneTileTex(textures.tileBlue, repX, repY);
      mat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0x7f8e9e,
          map: lockedTex,
          roughnessMap: roughTex,
          normalMap: normalTex,
          normalScale: new THREE.Vector2(0.75, 0.75),
          roughness: 0.88,
          metalness: 0.02,
          envMapIntensity: 0.38,
        })
      );
      applyMedicalFloorShader(mat, room.minX, room.maxX + 1, room.minY, room.maxY + 1);
    } else if (room.floorTheme === 'gym_royal') {
      const gymTex = cloneTileTex(textures.gymRoyal, repX, repY);
      mat = trackMat(
        new THREE.MeshStandardMaterial({
          map: gymTex,
          roughnessMap: roughTex,
          normalMap: normalTex,
          normalScale: new THREE.Vector2(0.95, 0.95),
          roughness: 0.80,
          metalness: 0.02,
          envMapIntensity: 0.54,
        })
      );
      applyMedicalFloorShader(mat, room.minX, room.maxX + 1, room.minY, room.maxY + 1);
    } else if (room.floorTheme === 'tile_mint') {
      const mintTex = cloneTileTex(textures.tileMint, repX, repY);
      mat = trackMat(
        new THREE.MeshStandardMaterial({
          map: mintTex,
          roughnessMap: roughTex,
          normalMap: normalTex,
          normalScale: new THREE.Vector2(0.95, 0.95),
          roughness: 0.80,
          metalness: 0.02,
          envMapIntensity: 0.54,
        })
      );
      applyMedicalFloorShader(mat, room.minX, room.maxX + 1, room.minY, room.maxY + 1);
    } else {
      const blueTex = cloneTileTex(textures.tileBlue, repX, repY);
      mat = trackMat(
        new THREE.MeshStandardMaterial({
          map: blueTex,
          roughnessMap: roughTex,
          normalMap: normalTex,
          normalScale: new THREE.Vector2(0.98, 0.98),
          roughness: 0.78,
          metalness: 0.02,
          envMapIntensity: 0.54,
        })
      );
      applyMedicalFloorShader(mat, room.minX, room.maxX + 1, room.minY, room.maxY + 1);
    }

    const floorMesh = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(w, 0.05, d)), mat);
    floorMesh.position.set(cx, 0.06, cz);
    floorMesh.receiveShadow = true;
    clinicBuildingGroup.add(floorMesh);

    if (!room.unlocked) {
      const cover = new THREE.Mesh(
        trackGeom(new THREE.BoxGeometry(w - 0.14, 0.08, d - 0.14)),
        trackMat(
          new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            transparent: true,
            opacity: 0.62,
            roughness: 0.3,
          })
        )
      );
      cover.position.set(cx, 1.74, cz);
      cover.userData.roomId = room.id;
      lockedRoomCovers.push(cover);
      clinicBuildingGroup.add(cover);
    }
  }

  // Smart Architectural Room Side Wall Sconces (mounted cleanly on walls + baked zero-shader wall-wash & floor-spill halos)
  const roomLightMats = new Map<string, THREE.MeshStandardMaterial>();
  const roomWashMats = new Map<string, THREE.MeshBasicMaterial>();
  const roomPoolMats = new Map<string, THREE.MeshBasicMaterial>();
  const roomSconceAnchors = new Map<string, { x: number; y: number; z: number }>();
  const sconceUnitPlane = trackGeom(new THREE.PlaneGeometry(1, 1));

  for (const room of rooms) {
    const rMat = trackMat(
      makeMat({
        color: 0xf8fafc,
        emissive: 0xffedd5,
        emissiveIntensity: 0.08,
        roughness: 0.25,
      })
    );
    roomLightMats.set(room.id, rMat);

    const wMat = trackMat(
      new THREE.MeshBasicMaterial({
        map: textures.sconceWash,
        color: 0xffd79e,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    roomWashMats.set(room.id, wMat);

    const pMat = trackMat(
      new THREE.MeshBasicMaterial({
        map: textures.sconcePool,
        color: 0xffd79e,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    roomPoolMats.set(room.id, pMat);

    const cx = (room.minX + room.maxX + 1) / 2;
    const cz = (room.minY + room.maxY + 1) / 2;

    // 1) North / Horizontal Partition Wall Sconce
    const wallBar = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(2.6, 0.08, 0.11)), rMat);
    const barHousing = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(2.74, 0.11, 0.14)), darkMullionMat);
    const northWash = new THREE.Mesh(sconceUnitPlane, wMat);
    const northFloorPool = new THREE.Mesh(sconceUnitPlane, pMat);
    northFloorPool.rotation.x = -Math.PI / 2;

    if (room.minY === 2) {
      wallBar.position.set(cx, 2.74, 2.18);
      barHousing.position.set(cx, 2.8, 2.17);
      northWash.position.set(cx, 1.62, 2.165);
      northWash.scale.set(3.8, 2.25, 1);
      northFloorPool.position.set(cx, 0.092, 3.25);
      northFloorPool.scale.set(4.4, 2.5, 1);
    } else {
      wallBar.position.set(cx, 1.74, room.minY + 0.135);
      barHousing.position.set(cx, 1.8, room.minY + 0.125);
      northWash.position.set(cx, 0.94, room.minY + 0.115);
      northWash.scale.set(3.4, 1.56, 1);
      northFloorPool.position.set(cx, 0.092, room.minY + 1.15);
      northFloorPool.scale.set(4.1, 2.35, 1);
    }
    clinicBuildingGroup.add(barHousing, wallBar, northWash, northFloorPool);

    // 2) West / Vertical Divider Wall Sconce
    const sideWash = new THREE.Mesh(sconceUnitPlane, wMat);
    sideWash.rotation.y = Math.PI / 2;
    const sideFloorPool = new THREE.Mesh(sconceUnitPlane, pMat);
    sideFloorPool.rotation.x = -Math.PI / 2;

    if (room.minX === 2) {
      const sideBar = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.11, 0.08, 2.6)), rMat);
      sideBar.position.set(2.18, 2.74, cz);
      const sideHousing = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.14, 0.11, 2.74)), darkMullionMat);
      sideHousing.position.set(2.17, 2.8, cz);
      sideWash.position.set(2.165, 1.62, cz);
      sideWash.scale.set(3.8, 2.25, 1);
      sideFloorPool.position.set(3.25, 0.092, cz);
      sideFloorPool.scale.set(2.5, 4.4, 1);
      clinicBuildingGroup.add(sideHousing, sideBar, sideWash, sideFloorPool);
    } else {
      const divBar = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.11, 0.08, 2.4)), rMat);
      divBar.position.set(12.135, 1.74, cz);
      const divHousing = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.14, 0.11, 2.54)), darkMullionMat);
      divHousing.position.set(12.125, 1.8, cz);
      sideWash.position.set(12.115, 0.94, cz);
      sideWash.scale.set(3.2, 1.54, 1);
      sideFloorPool.position.set(13.15, 0.092, cz);
      sideFloorPool.scale.set(2.35, 4.1, 1);
      clinicBuildingGroup.add(divHousing, divBar, sideWash, sideFloorPool);
    }

    // 3) Smart primary wall-sconce anchor (places dynamic PointLight directly at the side wall sconce in world space)
    if (room.minX === 2) {
      roomSconceAnchors.set(room.id, { x: 2.95, y: 2.25 + CLINIC_FLOOR_ELEV, z: cz });
    } else if (room.minY === 2) {
      roomSconceAnchors.set(room.id, { x: cx, y: 2.25 + CLINIC_FLOOR_ELEV, z: 2.95 });
    } else {
      roomSconceAnchors.set(room.id, { x: 12.95, y: 1.82 + CLINIC_FLOOR_ELEV, z: cz });
    }
  }

  // 5. Deeper Architectural Clinic Building (3.50m thick outer walls, 2.95m facade, 1.88m interior partitions with dado/skirting/pilasters)
  const addWallSpan = (
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    height: number,
    thickness = 0.24,
    hasWindow = false
  ) => {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) return;
    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;
    const isAlongX = Math.abs(dx) >= Math.abs(dz);
    const sx = isAlongX ? len : thickness;
    const sz = isAlongX ? thickness : len;
    const trimAddX = isAlongX ? 0 : 0.045;
    const trimAddZ = isAlongX ? 0.045 : 0;

    if (hasWindow && height >= 0.85) {
      const kneeH = height < 1.2 ? 0.44 : 0.58;
      const knee = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(sx, kneeH, sz)), stuccoWhiteMat);
      knee.position.set(cx, 0.07 + kneeH / 2, cz);
      knee.castShadow = true;
      knee.receiveShadow = true;
      clinicBuildingGroup.add(knee);

      // Floor baseboard skirting + protruding window sill reveal + EPDM gasket + transom
      const skirt = new THREE.Mesh(
        trackGeom(new THREE.BoxGeometry(sx + trimAddX * 0.72, 0.105, sz + trimAddZ * 0.72)),
        darkMullionMat
      );
      skirt.position.set(cx, 0.12, cz);
      clinicBuildingGroup.add(skirt);

      const sillReveal = new THREE.Mesh(
        trackGeom(new THREE.BoxGeometry(sx + trimAddX * 0.9, 0.025, sz + trimAddZ * 0.9)),
        epdmGasketMat
      );
      sillReveal.position.set(cx, 0.07 + kneeH - 0.005, cz);
      clinicBuildingGroup.add(sillReveal);

      const sill = new THREE.Mesh(
        trackGeom(new THREE.BoxGeometry(sx + trimAddX * 1.48, 0.068, sz + trimAddZ * 1.48)),
        aluminumTrimMat
      );
      sill.position.set(cx, 0.07 + kneeH + 0.022, cz);
      clinicBuildingGroup.add(sill);

      const glassH = height - kneeH - 0.12;
      const gsX = isAlongX ? len - 0.16 : 0.045;
      const gsZ = isAlongX ? 0.045 : len - 0.16;
      const pane = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(gsX, glassH, gsZ)), glassMat);
      pane.position.set(cx, 0.07 + kneeH + 0.04 + glassH / 2, cz);
      clinicBuildingGroup.add(pane);

      // Horizontal architectural transom bar on tall curtain glass bays
      if (height >= 2.0) {
        const transom = new THREE.Mesh(
          trackGeom(new THREE.BoxGeometry(isAlongX ? len - 0.08 : thickness * 0.88, 0.06, isAlongX ? thickness * 0.88 : len - 0.08)),
          darkMullionMat
        );
        transom.position.set(cx, 0.07 + height - 0.62, cz);
        clinicBuildingGroup.add(transom);
      }

      // Vertical architectural window mullions dividing curtain glass into realistic bays
      const mullCount = Math.floor(len / 2.2);
      if (mullCount >= 1) {
        const mullW = isAlongX ? 0.085 : thickness * 0.92;
        const mullD = isAlongX ? thickness * 0.92 : 0.085;
        const mullGeom = trackGeom(new THREE.BoxGeometry(mullW, glassH + 0.04, mullD));
        for (let mi = 1; mi <= mullCount; mi++) {
          const t = mi / (mullCount + 1);
          const m = new THREE.Mesh(mullGeom, darkMullionMat);
          m.position.set(x1 + dx * t, 0.07 + kneeH + 0.03 + glassH / 2, z1 + dz * t);
          clinicBuildingGroup.add(m);
        }
      }

      const topFrame = new THREE.Mesh(
        trackGeom(new THREE.BoxGeometry(sx + trimAddX * 0.92, 0.11, sz + trimAddZ * 0.92)),
        darkMullionMat
      );
      topFrame.position.set(cx, 0.07 + height - 0.05, cz);
      topFrame.castShadow = true;
      clinicBuildingGroup.add(topFrame);
      return;
    }

    const baseH = Math.min(height * 0.28, 0.44);
    // Recessed dark floor baseboard / skirting trim + shadow-gap reveal
    const skirt = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(sx + trimAddX * 0.78, 0.11, sz + trimAddZ * 0.78)),
      darkMullionMat
    );
    skirt.position.set(cx, 0.125, cz);
    clinicBuildingGroup.add(skirt);

    const wain = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(sx, baseH, sz)), wainscotBlueMat);
    wain.position.set(cx, 0.07 + baseH / 2, cz);
    wain.castShadow = true;
    wain.receiveShadow = true;
    clinicBuildingGroup.add(wain);

    // Shadow-gap trim + protruding architectural dado / chair-rail molding between wainscot & plaster
    const dadoShadow = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(sx + trimAddX * 0.55, 0.022, sz + trimAddZ * 0.55)),
      epdmGasketMat
    );
    dadoShadow.position.set(cx, 0.07 + baseH - 0.015, cz);
    const dado = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(sx + trimAddX, 0.055, sz + trimAddZ)),
      aluminumTrimMat
    );
    dado.position.set(cx, 0.07 + baseH + 0.008, cz);
    clinicBuildingGroup.add(dadoShadow, dado);

    const upperH = Math.max(0.06, height - baseH);
    const upper = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(sx, upperH, sz)), stuccoWhiteMat);
    upper.position.set(cx, 0.07 + baseH + upperH / 2, cz);
    upper.castShadow = true;
    upper.receiveShadow = true;
    clinicBuildingGroup.add(upper);

    const capReveal = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(sx + trimAddX * 0.65, 0.02, sz + trimAddZ * 0.65)),
      epdmGasketMat
    );
    capReveal.position.set(cx, 0.07 + height - 0.005, cz);
    const cap = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(sx + trimAddX * 1.25, 0.075, sz + trimAddZ * 1.25)),
      aluminumTrimMat
    );
    cap.position.set(cx, 0.07 + height + 0.037, cz);
    clinicBuildingGroup.add(capReveal, cap);
  };

  // Back perimeter walls (deep 0.30m thickness, tall 3.50m, x: 2..22, z: 2..22)
  addWallSpan(2, 2, 22, 2, 3.5, 0.3);
  addWallSpan(2, 2, 2, 22, 3.5, 0.3);

  // Architectural corner & junction pilasters adding crisp 3D structural depth
  const addPilaster = (px: number, pz: number, w: number, h: number) => {
    const col = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(w, h, w)), stuccoWhiteMat);
    col.position.set(px, 0.07 + h / 2, pz);
    col.castShadow = true;
    col.receiveShadow = true;
    const base = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(w + 0.05, 0.44, w + 0.05)), wainscotBlueMat);
    base.position.set(px, 0.29, pz);
    const cap = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(w + 0.07, 0.08, w + 0.07)), darkMullionMat);
    cap.position.set(px, 0.07 + h + 0.04, pz);
    clinicBuildingGroup.add(col, base, cap);
  };
  addPilaster(2, 2, 0.38, 3.52);
  addPilaster(22, 2, 0.34, 2.98);
  addPilaster(2, 22, 0.34, 1.15);
  addPilaster(22, 22, 0.34, 2.98);

  // Recessed warm LED cove strip along top of back walls (clean architectural cornice)
  const ledStripBack = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(19.2, 0.05, 0.08)), warmLedMat);
  ledStripBack.position.set(12.0, 3.38, 2.2);
  const ledStripLeft = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.08, 0.05, 19.2)), warmLedMat);
  ledStripLeft.position.set(2.2, 3.38, 12.0);
  clinicBuildingGroup.add(ledStripBack, ledStripLeft);

  // Cutaway front-left wall (z=22, glazed knee wall H=1.12 so interior stays clearly visible)
  addWallSpan(2, 22, 7.2, 22, 1.12, 0.24, true);
  addWallSpan(7.2, 22, 12.4, 22, 1.12, 0.24);
  addWallSpan(12.4, 22, 22, 22, 1.12, 0.24, true);

  // Tall Front Storefront Curtain Wall (x = 22, H=2.95m, entrance opening z = 14..16)
  addWallSpan(22, 2, 22, 14, 2.95, 0.24, true);
  addWallSpan(22, 16, 22, 22, 2.95, 0.24, true);

  // Architectural timber louver accent columns flanking main clinic entrance (x=22, z=13.1..16.9)
  for (let lz = 13.15; lz <= 13.65; lz += 0.18) {
    const slat = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.16, 3.12, 0.06)), woodSlatMat);
    slat.position.set(22.16, 1.63, lz);
    clinicBuildingGroup.add(slat);
  }
  for (let lz = 16.35; lz <= 16.85; lz += 0.18) {
    const slat = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.16, 3.12, 0.06)), woodSlatMat);
    slat.position.set(22.16, 1.63, lz);
    clinicBuildingGroup.add(slat);
  }

  // Interior Partition Walls (H = 1.88m, thickness = 0.20m — deeper architectural partitions!)
  addWallSpan(2, 10, 6, 10, 1.88, 0.2);
  addWallSpan(7, 10, 16, 10, 1.88, 0.2);
  addWallSpan(17, 10, 22, 10, 1.88, 0.2);

  addWallSpan(12, 2, 12, 5, 1.88, 0.2);
  addWallSpan(12, 6, 12, 14, 1.88, 0.2);
  addWallSpan(12, 15, 12, 22, 1.88, 0.2);

  // Interior wall T-junction pilasters
  addPilaster(12, 10, 0.26, 1.9);
  addPilaster(2, 10, 0.34, 1.9);
  addPilaster(12, 2, 0.34, 1.9);
  addPilaster(22, 10, 0.28, 1.9);
  addPilaster(12, 22, 0.28, 1.15);

  // Mounted Reception Brand Logo + Framed License Certificate + Anatomy Chart (clean matte glare-free plaque)
  const wallLogoFrame = new THREE.Mesh(
    trackGeom(new THREE.BoxGeometry(0.036, 0.75, 2.52)),
    darkMullionMat
  );
  wallLogoFrame.position.set(12.126, 1.43, 18.6);
  clinicBuildingGroup.add(wallLogoFrame);

  const wallLogo = new THREE.Mesh(
    trackGeom(new THREE.PlaneGeometry(2.44, 0.68)),
    trackMat(
      makeMat({
        map: textures.therasonWall,
        roughness: 0.92,
        metalness: 0.0,
      })
    )
  );
  wallLogo.rotation.y = Math.PI / 2;
  wallLogo.position.set(12.148, 1.43, 18.6);
  clinicBuildingGroup.add(wallLogo);

  const wallCert = new THREE.Mesh(
    trackGeom(new THREE.BoxGeometry(0.04, 0.48, 0.62)),
    trackMat(makeMat({ map: textures.certificateFrame, roughness: 0.38 }))
  );
  wallCert.position.set(12.125, 1.38, 12.0);
  clinicBuildingGroup.add(wallCert);

  // Direct Architectural Wall Lettering ("Powered by طـــاهـر محمد") flush on the plaster wall (no frame/board)
  const wallPoweredText = new THREE.Mesh(
    trackGeom(new THREE.PlaneGeometry(5.6, 1.02)),
    trackMat(
      makeMat({
        map: textures.poweredByWall,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
        roughness: 0.72,
        metalness: 0.05,
      })
    )
  );
  wallPoweredText.rotation.y = Math.PI / 2;
  wallPoweredText.position.set(2.156, 2.08, 15.8);
  clinicBuildingGroup.add(wallPoweredText);

  // Normal Single-Leaf Interior Doors (standard ~0.92m single door opening, matching raised 1.88m partitions)
  const addAnimatedSingleDoor = (
    id: string,
    cx: number,
    cz: number,
    axis: 'z' | 'x',
    requiredRoomId?: string
  ) => {
    for (const side of [-1, 1]) {
      const jamb = new THREE.Mesh(
        trackGeom(
          new THREE.BoxGeometry(axis === 'z' ? 0.24 : 0.08, 1.88, axis === 'z' ? 0.08 : 0.24)
        ),
        darkMullionMat
      );
      jamb.position.set(
        axis === 'z' ? cx : cx + side * 0.48,
        1.01,
        axis === 'z' ? cz + side * 0.48 : cz
      );
      clinicBuildingGroup.add(jamb);
    }

    const piv = new THREE.Group();
    piv.position.set(axis === 'z' ? cx : cx - 0.45, 0.08, axis === 'z' ? cz - 0.45 : cz);
    const len = 0.88;
    const body = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(axis === 'z' ? 0.055 : len, 1.78, axis === 'z' ? len : 0.055)),
      woodSlatMat
    );
    body.position.set(axis === 'z' ? 0 : len / 2, 0.89, axis === 'z' ? len / 2 : 0);
    body.castShadow = true;

    // Brushed stainless steel kickplate along bottom edge
    const kickPlate = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(axis === 'z' ? 0.062 : len - 0.04, 0.2, axis === 'z' ? len - 0.04 : 0.062)),
      aluminumTrimMat
    );
    kickPlate.position.set(axis === 'z' ? 0 : len / 2, 0.11, axis === 'z' ? len / 2 : 0);

    // EPDM gasket frame + safety vision glass panel
    const visionBezel = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(axis === 'z' ? 0.068 : 0.31, 0.6, axis === 'z' ? 0.31 : 0.068)),
      epdmGasketMat
    );
    visionBezel.position.set(axis === 'z' ? 0 : len * 0.58, 1.24, axis === 'z' ? len * 0.58 : 0);
    const visionGlass = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(axis === 'z' ? 0.072 : 0.25, 0.54, axis === 'z' ? 0.25 : 0.072)),
      glassMat
    );
    visionGlass.position.set(axis === 'z' ? 0 : len * 0.58, 1.24, axis === 'z' ? len * 0.58 : 0);

    // Brushed lever lockset & escutcheon plate
    const lockPlate = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(axis === 'z' ? 0.076 : 0.05, 0.14, axis === 'z' ? 0.05 : 0.076)),
      aluminumTrimMat
    );
    lockPlate.position.set(axis === 'z' ? 0 : len * 0.84, 0.9, axis === 'z' ? len * 0.84 : 0);
    const handle = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(axis === 'z' ? 0.115 : 0.14, 0.026, axis === 'z' ? 0.14 : 0.115)),
      aluminumTrimMat
    );
    handle.position.set(axis === 'z' ? 0 : len * 0.81, 0.92, axis === 'z' ? len * 0.81 : 0);

    // Overhead hydraulic door closer arm & body
    const closerBody = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(axis === 'z' ? 0.08 : 0.22, 0.055, axis === 'z' ? 0.22 : 0.08)),
      darkMullionMat
    );
    closerBody.position.set(axis === 'z' ? 0 : len * 0.28, 1.71, axis === 'z' ? len * 0.28 : 0);

    piv.add(body, kickPlate, visionBezel, visionGlass, lockPlate, handle, closerBody);
    clinicBuildingGroup.add(piv);

    // Brushed stainless medical floor transition strip separating room tiles cleanly under the door leaf
    const doorThreshold = new THREE.Mesh(
      trackGeom(
        new THREE.BoxGeometry(axis === 'z' ? 0.18 : 0.94, 0.006, axis === 'z' ? 0.94 : 0.18)
      ),
      aluminumTrimMat
    );
    doorThreshold.position.set(cx, 0.086, cz);
    doorThreshold.receiveShadow = true;
    clinicBuildingGroup.add(doorThreshold);

    doors.push({
      id,
      kind: axis === 'z' ? 'swing_z' : 'swing_x',
      centerX: cx,
      centerZ: cz,
      triggerRadius: 0.9,
      requiredRoomId,
      manualPush: true,
      openAmount: 0,
      swingSign: 1,
      holdTimer: 0,
      leftLeaf: piv,
    });
  };

  addAnimatedSingleDoor('door_reception_bay', 12.0, 14.5, 'z');
  addAnimatedSingleDoor('door_bay_west', 6.5, 10.0, 'x', 'room_gym');
  addAnimatedSingleDoor('door_rec_east', 16.5, 10.0, 'x', 'room_specialty_2');
  addAnimatedSingleDoor('door_west_east', 12.0, 5.5, 'z', 'room_specialty_2');

  // 6. Grand Main Entrance Portico Canopy & Automatic Sliding Glass Double Doors (x = 22, z = 14..16)
  const entranceGroup = new THREE.Group();
  entranceGroup.position.set(22.0, 0, 15.0);
  // Brushed stainless steel sliding threshold track
  const thresholdStrip = new THREE.Mesh(
    trackGeom(new THREE.BoxGeometry(0.14, 0.018, 2.04)),
    aluminumTrimMat
  );
  thresholdStrip.position.set(0, 0.085, 0);
  entranceGroup.add(thresholdStrip);

  for (const dz of [-1.06, 1.06]) {
    const col = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.36, 3.12, 0.32)), stuccoWhiteMat);
    col.position.set(0, 1.56, dz);
    col.castShadow = true;
    const colBase = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(0.4, CLINIC_FLOOR_ELEV + 0.06, 0.36)),
      stuccoWhiteMat
    );
    colBase.position.set(0, -(CLINIC_FLOOR_ELEV + 0.06) / 2 + 0.03, dz);
    colBase.castShadow = true;
    const sconce = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.14, 0.32, 0.14)), entranceSconceMat);
    sconce.position.set(0.22, 1.88, dz);
    entranceGroup.add(col, colBase, sconce);
  }
  const makeSlidingPanel = (zOffset: number) => {
    const panelGroup = new THREE.Group();
    panelGroup.position.set(0, 0.08, zOffset);
    const frame = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.07, 2.44, 0.94)), darkMullionMat);
    frame.position.y = 1.22;
    const pane = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.035, 2.16, 0.8)), glassMat);
    pane.position.y = 1.26;
    const safetyStripe = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(0.04, 0.16, 0.8)),
      etchedGlassMat
    );
    safetyStripe.position.y = 1.12;
    const kick = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.08, 0.18, 0.92)), aluminumTrimMat);
    kick.position.y = 0.09;
    const pullBar = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.11, 0.54, 0.035)), aluminumTrimMat);
    pullBar.position.set(0, 1.12, zOffset < 0 ? 0.34 : -0.34);
    panelGroup.add(frame, pane, safetyStripe, kick, pullBar);
    entranceGroup.add(panelGroup);
    return panelGroup;
  };
  const mainLeftSlide = makeSlidingPanel(-0.47);
  const mainRightSlide = makeSlidingPanel(0.47);
  doors.push({
    id: 'main_entrance',
    kind: 'sliding_z',
    centerX: 22.0,
    centerZ: 15.0,
    triggerRadius: 1.85,
    openAmount: 0,
    leftLeaf: mainLeftSlide,
    rightLeaf: mainRightSlide,
    baseOffset: 0.47,
  });

  // Overhead automatic door header bar + motion sensor + green active status LED
  const doorHeaderBar = new THREE.Mesh(
    trackGeom(new THREE.BoxGeometry(0.22, 0.18, 2.1)),
    darkMullionMat
  );
  doorHeaderBar.position.set(0, 2.62, 0);
  const sensorBox = new THREE.Mesh(
    trackGeom(new THREE.BoxGeometry(0.09, 0.07, 0.28)),
    epdmGasketMat
  );
  sensorBox.position.set(0.14, 2.62, 0);
  const sensorLed = new THREE.Mesh(
    trackGeom(new THREE.BoxGeometry(0.02, 0.025, 0.05)),
    trackMat(makeMat({ color: 0x34d399, emissive: 0x10b981, emissiveIntensity: 1.1, roughness: 0.3 }))
  );
  sensorLed.position.set(0.185, 2.62, 0);
  entranceGroup.add(doorHeaderBar, sensorBox, sensorLed);

  const canopy = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(1.36, 0.16, 2.78)), darkMullionMat);
  canopy.position.set(0.46, 3.04, 0);
  canopy.castShadow = true;
  const canopyGlow = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(1.16, 0.045, 2.52)), entranceSconceMat);
  canopyGlow.position.set(0.46, 2.94, 0);
  const canopyBlue = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(1.4, 0.08, 2.86)), wainscotBlueMat);
  canopyBlue.position.set(0.46, 3.14, 0);

  // Prominent Glowing Blue "Therason Clinic" Facade Signboard
  const facadeSignMat = trackMat(
    makeMat({
      map: textures.therasonFacadeSign,
      emissiveMap: textures.therasonFacadeSign,
      emissive: 0x3b82f6,
      emissiveIntensity: 0.38,
      roughness: 0.25,
    })
  );
  const facadeBox = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.16, 1.02, 3.35)), darkMullionMat);
  facadeBox.position.set(0.32, 3.74, 0);
  facadeBox.castShadow = true;
  const facadeFace = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.03, 0.94, 3.24)), facadeSignMat);
  facadeFace.position.set(0.41, 3.74, 0);

  entranceGroup.add(canopy, canopyGlow, canopyBlue, facadeBox, facadeFace);
  clinicBuildingGroup.add(entranceGroup);

  // 7. Wild Untamed Perimeter Trees (oak, wild_fig, acacia, cypress, birch)
  // Visually & structurally distinct from Store ornamental planter trees: raw earth root mounds, wild boughs, zero planters/blossoms.
  const barkMat = trackMat(
    makeMat({
      map: textures.bark,
      bumpMap: textures.barkBump,
      bumpScale: 0.032,
      roughness: 0.94,
      metalness: 0.0,
    })
  );
  const birchBarkMat = trackMat(
    makeMat({
      map: textures.birchBark,
      bumpMap: textures.barkBump,
      bumpScale: 0.015,
      roughness: 0.86,
      metalness: 0.0,
    })
  );
  const leafCardMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.leafFoliage,
      alphaTest: 0.4,
      side: THREE.DoubleSide,
      roughness: 0.82,
      metalness: 0.0,
    })
  );
  applyFoliageWindShader(leafCardMat, skyUniforms.uTime, 0.036, { heightBase: 0.9, heightScale: 0.42, tag: 'leaf' });

  const cypressCardMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.cypressFoliage,
      alphaTest: 0.38,
      side: THREE.DoubleSide,
      roughness: 0.84,
      metalness: 0.0,
    })
  );
  applyFoliageWindShader(cypressCardMat, skyUniforms.uTime, 0.032, { heightBase: 0.9, heightScale: 0.40, tag: 'cypress' });

  const innerShadeMat = trackMat(makeMat({ color: 0x1e4016, roughness: 0.94 }));
  applyFoliageWindShader(innerShadeMat, skyUniforms.uTime, 0.014, { heightBase: 1.05, heightScale: 0.38, tag: 'shade' });

  const innerCypressMat = trackMat(makeMat({ color: 0x16321d, roughness: 0.94 }));
  applyFoliageWindShader(innerCypressMat, skyUniforms.uTime, 0.012, { heightBase: 1.05, heightScale: 0.36, tag: 'cshade' });
  const soilMoundMat = trackMat(makeMat({ color: 0x5c4731, roughness: 0.96, metalness: 0.0 }));

  const leafCardGeom = trackGeom(new THREE.PlaneGeometry(1.16, 1.16));
  const crownCoreGeom = trackGeom(new THREE.DodecahedronGeometry(0.45, 1));
  const trunkRootFlareGeom = trackGeom(new THREE.CylinderGeometry(0.035, 0.095, 0.46, 6));
  const soilMoundGeom = trackGeom(new THREE.CylinderGeometry(0.44, 0.62, 0.055, 10));

  interface SpeciesTemplatePart {
    mesh: THREE.Mesh;
    kind: 'bark' | 'birchBark' | 'shade' | 'cypressShade' | 'leafCard' | 'cypressCard';
  }

  const makeCurvedLimbGeom = (
    pts: Array<[number, number, number]>,
    rStart: number,
    rEnd: number,
    radialSegs = 7
  ) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    const avgRadius = Math.max(1e-4, (rStart + rEnd) * 0.5);
    const tubeG = trackGeom(new THREE.TubeGeometry(curve, 8, avgRadius, radialSegs, false));
    // Taper radius organically from base to tip along spline V coordinate
    const pos = tubeG.attributes.position as THREE.BufferAttribute;
    const uv = tubeG.attributes.uv as THREE.BufferAttribute;
    const tmpC = new THREE.Vector3();
    const tmpP = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      const t = THREE.MathUtils.clamp(uv.getX(i), 0, 1);
      curve.getPointAt(t, tmpC);
      tmpP.fromBufferAttribute(pos, i).sub(tmpC);
      const targetScale = THREE.MathUtils.lerp(rStart, rEnd, t) / avgRadius;
      tmpP.multiplyScalar(targetScale).add(tmpC);
      pos.setXYZ(i, tmpP.x, tmpP.y, tmpP.z);
    }
    pos.needsUpdate = true;
    tubeG.computeVertexNormals();
    return tubeG;
  };

  const buildSpeciesTemplate = (species: WorldTreeSpecies): THREE.Group => {
    const t = new THREE.Group();
    const isBirch = species === 'birch';
    const bMat = isBirch ? birchBarkMat : barkMat;
    const bKind: SpeciesTemplatePart['kind'] = isBirch ? 'birchBark' : 'bark';

    const addPart = (
      geom: THREE.BufferGeometry,
      mat: THREE.Material,
      kind: SpeciesTemplatePart['kind'],
      px = 0,
      py = 0,
      pz = 0,
      rx = 0,
      ry = 0,
      rz = 0,
      sx = 1,
      sy = 1,
      sz = 1
    ) => {
      const m = new THREE.Mesh(geom, mat);
      m.position.set(px, py, pz);
      m.rotation.set(rx, ry, rz);
      m.scale.set(sx, sy, sz);
      m.userData.speciesKind = kind;
      t.add(m);
      return m;
    };

    if (species === 'cypress') {
      // Tall Mediterranean Columnar Cypress (deep evergreen tiered spire + slender furrowed trunk)
      addPart(
        makeCurvedLimbGeom([[0, 0, 0], [0.02, 1.4, 0], [0, 3.0, 0.02]], 0.14, 0.04, 8),
        bMat,
        bKind
      );
      for (let ri = 0; ri < 4; ri++) {
        const ra = (ri / 4) * Math.PI * 2 + 0.3;
        addPart(
          trunkRootFlareGeom,
          bMat,
          bKind,
          Math.cos(ra) * 0.11,
          0.14,
          Math.sin(ra) * 0.11,
          Math.sin(ra) * 0.5,
          0,
          -Math.cos(ra) * 0.5
        );
      }
      const tiers = 5;
      for (let k = 0; k < tiers; k++) {
        const frac = k / (tiers - 1);
        const ty = 1.05 + frac * 1.95;
        const rad = Math.sin((1 - frac * 0.82) * Math.PI * 0.65) * 0.82;
        addPart(crownCoreGeom, innerCypressMat, 'cypressShade', 0, ty, 0, 0, k * 0.8, 0, rad * 0.9, 1.15, rad * 0.9);
        const cardsInTier = k === tiers - 1 ? 3 : 4;
        for (let c = 0; c < cardsInTier; c++) {
          const ca = (c / cardsInTier) * Math.PI * 2 + k * 0.65;
          addPart(
            leafCardGeom,
            cypressCardMat,
            'cypressCard',
            Math.cos(ca) * rad * 0.42,
            ty,
            Math.sin(ca) * rad * 0.42,
            0.14,
            ca + Math.PI / 2,
            0.08,
            rad * 1.25,
            1.15,
            1
          );
        }
      }
      t.updateMatrixWorld(true);
      return t;
    }

    if (species === 'acacia') {
      // African/Sudanese Flat-Topped Umbrella Acacia (sculptural sweeping wide boughs + layered flat canopy)
      addPart(
        makeCurvedLimbGeom([[0, 0, 0], [-0.06, 0.65, 0.04], [0.02, 1.38, -0.02]], 0.18, 0.11, 8),
        bMat,
        bKind
      );
      for (let ri = 0; ri < 4; ri++) {
        const ra = (ri / 4) * Math.PI * 2 + 0.5;
        addPart(
          trunkRootFlareGeom,
          bMat,
          bKind,
          Math.cos(ra) * 0.15,
          0.14,
          Math.sin(ra) * 0.15,
          Math.sin(ra) * 0.6,
          0,
          -Math.cos(ra) * 0.6
        );
      }
      for (let b = 0; b < 5; b++) {
        const ang = (b / 5) * Math.PI * 2 + 0.25;
        const reach = 1.05 + (b % 2) * 0.18;
        const bx = Math.cos(ang) * reach;
        const bz = Math.sin(ang) * reach;
        const topY = 2.08 + (b % 2) * 0.14;
        addPart(
          makeCurvedLimbGeom(
            [
              [0.01, 1.28, -0.01],
              [bx * 0.52, 1.72, bz * 0.52],
              [bx * 0.92, topY - 0.06, bz * 0.92],
            ],
            0.075,
            0.032,
            6
          ),
          bMat,
          bKind
        );
        addPart(crownCoreGeom, innerShadeMat, 'shade', bx * 0.85, topY + 0.04, bz * 0.85, 0, ang, 0, 0.95, 0.42, 0.95);
        for (let ci = 0; ci < 3; ci++) {
          addPart(
            leafCardGeom,
            leafCardMat,
            'leafCard',
            bx * 0.92 + Math.cos(ang + ci) * 0.16,
            topY + 0.1 + ci * 0.05,
            bz * 0.92 + Math.sin(ang + ci) * 0.16,
            Math.PI / 2 - 0.18,
            ang + ci * 1.1,
            0.12,
            1.15,
            1.15,
            1
          );
        }
      }
      addPart(crownCoreGeom, innerShadeMat, 'shade', 0, 2.28, 0, 0, 0, 0, 1.28, 0.44, 1.28);
      for (let ti = 0; ti < 4; ti++) {
        const ta = (ti / 4) * Math.PI * 2;
        addPart(
          leafCardGeom,
          leafCardMat,
          'leafCard',
          Math.cos(ta) * 0.35,
          2.36 + (ti % 2) * 0.06,
          Math.sin(ta) * 0.35,
          Math.PI / 2 - 0.12,
          ta,
          0,
          1.22,
          1.22,
          1
        );
      }
      t.updateMatrixWorld(true);
      return t;
    }

    if (species === 'birch') {
      // Multi-stem Ornamental Silver Birch (2 graceful white curved stems + airy dappled crown)
      for (const [ox, oz, leanX, leanZ, hTop] of [
        [-0.08, -0.04, -0.14, -0.06, 2.35],
        [0.09, 0.05, 0.16, 0.08, 2.1],
      ]) {
        addPart(
          makeCurvedLimbGeom(
            [
              [ox * 0.6, 0, oz * 0.6],
              [ox + leanX * 0.45, 1.1, oz + leanZ * 0.45],
              [ox + leanX, hTop, oz + leanZ],
            ],
            0.1,
            0.032,
            7
          ),
          bMat,
          bKind
        );
      }
      const birchBoughs = [
        { ang: 0.4, h: 1.5, rx: 0.56 },
        { ang: 2.0, h: 1.7, rx: 0.52 },
        { ang: 3.6, h: 1.55, rx: 0.58 },
        { ang: 5.2, h: 1.78, rx: 0.5 },
      ];
      for (const bb of birchBoughs) {
        const bx = Math.cos(bb.ang) * bb.rx;
        const bz = Math.sin(bb.ang) * bb.rx;
        addPart(
          makeCurvedLimbGeom([[0, bb.h - 0.15, 0], [bx * 0.6, bb.h + 0.2, bz * 0.6], [bx, bb.h + 0.52, bz]], 0.045, 0.018, 5),
          bMat,
          bKind
        );
        addPart(crownCoreGeom, innerShadeMat, 'shade', bx * 0.85, bb.h + 0.52, bz * 0.85, 0, bb.ang, 0, 0.68, 0.58, 0.68);
        for (let ci = 0; ci < 3; ci++) {
          addPart(
            leafCardGeom,
            leafCardMat,
            'leafCard',
            bx * 0.92,
            bb.h + 0.56,
            bz * 0.92,
            ci === 2 ? Math.PI / 2 - 0.25 : 0.25,
            bb.ang + (ci * Math.PI) / 3,
            0.22,
            0.96,
            0.96,
            1
          );
        }
      }
      addPart(crownCoreGeom, innerShadeMat, 'shade', 0, 2.52, 0, 0, 0, 0, 0.82, 0.72, 0.82);
      for (let ti = 0; ti < 4; ti++) {
        const ta = (ti / 4) * Math.PI * 2;
        addPart(
          leafCardGeom,
          leafCardMat,
          'leafCard',
          Math.cos(ta) * 0.22,
          2.6 + (ti % 2) * 0.14,
          Math.sin(ta) * 0.22,
          0.45 + (ti % 2) * 0.3,
          ta,
          0.18,
          1.0,
          1.0,
          1
        );
      }
      t.updateMatrixWorld(true);
      return t;
    }

    // Oak & Wild Fig: Organic curved trunk + gnarled root buttresses + sweeping boughs + natural forest canopy
    const isWildFig = species === 'wild_fig';
    const cardMat = leafCardMat;
    const cardKind: SpeciesTemplatePart['kind'] = 'leafCard';

    addPart(
      makeCurvedLimbGeom(
        [
          [0, 0, 0],
          [isWildFig ? 0.09 : -0.04, 0.72, isWildFig ? -0.05 : 0.03],
          [0.01, 1.44, -0.01],
        ],
        isWildFig ? 0.24 : 0.2,
        isWildFig ? 0.12 : 0.105,
        9
      ),
      bMat,
      bKind
    );
    const rootCount = isWildFig ? 5 : 4;
    for (let ri = 0; ri < rootCount; ri++) {
      const ra = (ri / rootCount) * Math.PI * 2 + 0.4;
      addPart(
        trunkRootFlareGeom,
        bMat,
        bKind,
        Math.cos(ra) * (isWildFig ? 0.19 : 0.15),
        0.14,
        Math.sin(ra) * (isWildFig ? 0.19 : 0.15),
        Math.sin(ra) * 0.62,
        0,
        -Math.cos(ra) * 0.62
      );
    }

    const boughs = [
      { ang: 0.35, h: 1.32, r: isWildFig ? 0.82 : 0.72 },
      { ang: 1.95, h: 1.42, r: isWildFig ? 0.76 : 0.68 },
      { ang: 3.5, h: 1.28, r: isWildFig ? 0.84 : 0.74 },
      { ang: 5.05, h: 1.46, r: isWildFig ? 0.74 : 0.66 },
    ];
    for (const bg of boughs) {
      const bx = Math.cos(bg.ang) * bg.r;
      const bz = Math.sin(bg.ang) * bg.r;
      addPart(
        makeCurvedLimbGeom(
          [
            [0.01, bg.h, -0.01],
            [bx * 0.55, bg.h + 0.34, bz * 0.55],
            [bx, bg.h + 0.64, bz],
          ],
          0.085,
          0.038,
          6
        ),
        bMat,
        bKind
      );
      for (const subOff of [-0.46, 0.46]) {
        const sa = bg.ang + subOff;
        const tx = bx + Math.cos(sa) * 0.28;
        const tz = bz + Math.sin(sa) * 0.28;
        addPart(
          makeCurvedLimbGeom([[bx * 0.78, bg.h + 0.48, bz * 0.78], [tx, bg.h + 0.78, tz]], 0.036, 0.016, 5),
          bMat,
          bKind
        );
        for (let ci = 0; ci < 3; ci++) {
          addPart(
            leafCardGeom,
            cardMat,
            cardKind,
            tx,
            bg.h + 0.82,
            tz,
            ci === 2 ? Math.PI / 2 - 0.28 : 0.26,
            sa + (ci * Math.PI) / 3,
            ci === 1 ? 0.34 : -0.2,
            0.94 + (ci % 2) * 0.16,
            0.94 + (ci % 2) * 0.16,
            1
          );
        }
      }
      addPart(crownCoreGeom, innerShadeMat, 'shade', bx * 0.86, bg.h + 0.7, bz * 0.86, 0, bg.ang, 0, 0.88, 0.68, 0.88);
    }

    addPart(crownCoreGeom, innerShadeMat, 'shade', 0, 2.48, 0, 0, 0, 0, 1.06, 0.74, 1.06);
    for (let ti = 0; ti < 5; ti++) {
      const ta = (ti / 5) * Math.PI * 2;
      addPart(
        leafCardGeom,
        cardMat,
        cardKind,
        Math.cos(ta) * 0.24,
        2.56 + (ti % 2) * 0.16,
        Math.sin(ta) * 0.24,
        0.52 + (ti % 2) * 0.34,
        ta,
        0.2,
        1.08,
        1.08,
        1
      );
    }

    t.updateMatrixWorld(true);
    return t;
  };

  const speciesTemplates: Record<WorldTreeSpecies, THREE.Group> = {
    oak: buildSpeciesTemplate('oak'),
    wild_fig: buildSpeciesTemplate('wild_fig'),
    acacia: buildSpeciesTemplate('acacia'),
    cypress: buildSpeciesTemplate('cypress'),
    birch: buildSpeciesTemplate('birch'),
  };

  const removedSet = new Set(removedTreeIds);
  const activeTrees = WORLD_TREES.filter((t) => !removedSet.has(t.id));

  // Merge active outdoor trees into grouped InstancedMeshes + invisible raycast proxies for reliable click/tap removal
  const worldTreeHitMeshes = new THREE.Group();
  root.add(worldTreeHitMeshes);
  const treeHitMat = trackMat(
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false,
    })
  );
  const hitTrunkGeom = trackGeom(new THREE.CylinderGeometry(0.46, 0.58, 2.35, 8));
  const hitCanopyGeom = trackGeom(new THREE.SphereGeometry(1, 10, 8));

  const _treeRootMat4 = new THREE.Matrix4();
  const _childWorldMat4 = new THREE.Matrix4();
  const barkByGeom = new Map<THREE.BufferGeometry, THREE.Matrix4[]>();
  const birchBarkByGeom = new Map<THREE.BufferGeometry, THREE.Matrix4[]>();
  const shadeList: THREE.Matrix4[] = [];
  const cypressShadeList: THREE.Matrix4[] = [];
  const leafList: Array<{ mat4: THREE.Matrix4; tint: number }> = [];
  const cypressCardList: Array<{ mat4: THREE.Matrix4; tint: number }> = [];

  const leafTints = [0xffffff, 0xe4f3db, 0xf2efd8, 0xd1e8c2, 0xdbedda, 0xe8f0cc];
  const cypressTints = [0xffffff, 0xdeeee0, 0xd4e6d8];

  if (activeTrees.length > 0) {
    const treeAoInst = new THREE.InstancedMesh(aoPlaneGeom, contactAoMat, activeTrees.length);
    treeAoInst.castShadow = false;
    const soilMoundInst = new THREE.InstancedMesh(soilMoundGeom, soilMoundMat, activeTrees.length);
    soilMoundInst.castShadow = false;
    soilMoundInst.receiveShadow = true;

    activeTrees.forEach((tree, idx) => {
      const { x: tx, z: tz, scale: sc, rotY, species } = tree;
      _tPos.set(tx, 0.014, tz);
      _tEuler.set(-Math.PI / 2, 0, 0);
      _tQuat.setFromEuler(_tEuler);
      const aoR = species === 'cypress' ? 1.55 * sc : species === 'acacia' ? 2.65 * sc : 2.3 * sc;
      _tScale.set(aoR, aoR, 1);
      _tMat4.compose(_tPos, _tQuat, _tScale);
      treeAoInst.setMatrixAt(idx, _tMat4);

      _tPos.set(tx, 0.01, tz);
      _tEuler.set(0, rotY, 0);
      _tQuat.setFromEuler(_tEuler);
      const soilScale = species === 'cypress' ? 0.85 * sc : 1.05 * sc;
      _tScale.set(soilScale, sc, soilScale);
      _tMat4.compose(_tPos, _tQuat, _tScale);
      soilMoundInst.setMatrixAt(idx, _tMat4);

      _tPos.set(tx, 0, tz);
      _tEuler.set(0, rotY, 0);
      _tQuat.setFromEuler(_tEuler);
      _tScale.setScalar(sc * 1.12);
      _treeRootMat4.compose(_tPos, _tQuat, _tScale);

      const tpl = speciesTemplates[species] || speciesTemplates.oak;
      tpl.children.forEach((child) => {
        const m = child as THREE.Mesh;
        if (!m.isMesh) return;
        _childWorldMat4.multiplyMatrices(_treeRootMat4, m.matrix);
        const sKind = m.userData.speciesKind as SpeciesTemplatePart['kind'];
        if (sKind === 'bark') {
          const arr = barkByGeom.get(m.geometry);
          if (arr) arr.push(_childWorldMat4.clone());
          else barkByGeom.set(m.geometry, [_childWorldMat4.clone()]);
        } else if (sKind === 'birchBark') {
          const arr = birchBarkByGeom.get(m.geometry);
          if (arr) arr.push(_childWorldMat4.clone());
          else birchBarkByGeom.set(m.geometry, [_childWorldMat4.clone()]);
        } else if (sKind === 'shade') {
          shadeList.push(_childWorldMat4.clone());
        } else if (sKind === 'cypressShade') {
          cypressShadeList.push(_childWorldMat4.clone());
        } else if (sKind === 'leafCard') {
          leafList.push({ mat4: _childWorldMat4.clone(), tint: leafTints[idx % leafTints.length] });
        } else if (sKind === 'cypressCard') {
          cypressCardList.push({ mat4: _childWorldMat4.clone(), tint: cypressTints[idx % cypressTints.length] });
        }
      });

      // Invisible 3D raycast proxy group so clicking/tapping ANY wild tree from trunk base to outer crown works 100%
      const s = sc * 1.12;
      const hitGrp = new THREE.Group();
      hitGrp.userData.worldTreeId = tree.id;

      const trunkProxy = new THREE.Mesh(hitTrunkGeom, treeHitMat);
      trunkProxy.position.set(tx, 1.15 * s, tz);
      trunkProxy.scale.set(s, s, s);
      trunkProxy.userData.worldTreeId = tree.id;
      trunkProxy.userData.noCastShadow = true;
      hitGrp.add(trunkProxy);

      if (species === 'cypress') {
        const lowCanopy = new THREE.Mesh(hitCanopyGeom, treeHitMat);
        lowCanopy.position.set(tx, 1.85 * s, tz);
        lowCanopy.scale.set(1.0 * s, 1.15 * s, 1.0 * s);
        lowCanopy.userData.worldTreeId = tree.id;
        lowCanopy.userData.noCastShadow = true;
        const topCanopy = new THREE.Mesh(hitCanopyGeom, treeHitMat);
        topCanopy.position.set(tx, 2.85 * s, tz);
        topCanopy.scale.set(0.85 * s, 0.95 * s, 0.85 * s);
        topCanopy.userData.worldTreeId = tree.id;
        topCanopy.userData.noCastShadow = true;
        hitGrp.add(lowCanopy, topCanopy);
      } else if (species === 'acacia') {
        const canopyProxy = new THREE.Mesh(hitCanopyGeom, treeHitMat);
        canopyProxy.position.set(tx, 2.2 * s, tz);
        canopyProxy.scale.set(1.75 * s, 0.82 * s, 1.75 * s);
        canopyProxy.userData.worldTreeId = tree.id;
        canopyProxy.userData.noCastShadow = true;
        hitGrp.add(canopyProxy);
      } else {
        const canopyProxy = new THREE.Mesh(hitCanopyGeom, treeHitMat);
        canopyProxy.position.set(tx, 2.18 * s, tz);
        canopyProxy.scale.set(1.52 * s, 1.25 * s, 1.52 * s);
        canopyProxy.userData.worldTreeId = tree.id;
        canopyProxy.userData.noCastShadow = true;
        hitGrp.add(canopyProxy);
      }
      worldTreeHitMeshes.add(hitGrp);
    });
    treeAoInst.instanceMatrix.needsUpdate = true;
    treeAoInst.computeBoundingSphere();
    soilMoundInst.instanceMatrix.needsUpdate = true;
    soilMoundInst.computeBoundingSphere();
    microDetailsGroup.add(treeAoInst);
    root.add(soilMoundInst);
  }

  for (const [geom, mats] of barkByGeom.entries()) {
    const inst = new THREE.InstancedMesh(geom, barkMat, mats.length);
    mats.forEach((mat4, i) => inst.setMatrixAt(i, mat4));
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    inst.castShadow = true;
    inst.receiveShadow = true;
    root.add(inst);
  }
  for (const [geom, mats] of birchBarkByGeom.entries()) {
    const inst = new THREE.InstancedMesh(geom, birchBarkMat, mats.length);
    mats.forEach((mat4, i) => inst.setMatrixAt(i, mat4));
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    inst.castShadow = true;
    inst.receiveShadow = true;
    root.add(inst);
  }
  if (shadeList.length > 0) {
    const shadeInst = new THREE.InstancedMesh(crownCoreGeom, innerShadeMat, shadeList.length);
    shadeList.forEach((mat4, i) => shadeInst.setMatrixAt(i, mat4));
    shadeInst.instanceMatrix.needsUpdate = true;
    shadeInst.computeBoundingSphere();
    shadeInst.castShadow = true;
    shadeInst.receiveShadow = true;
    root.add(shadeInst);
  }
  if (cypressShadeList.length > 0) {
    const cShadeInst = new THREE.InstancedMesh(crownCoreGeom, innerCypressMat, cypressShadeList.length);
    cypressShadeList.forEach((mat4, i) => cShadeInst.setMatrixAt(i, mat4));
    cShadeInst.instanceMatrix.needsUpdate = true;
    cShadeInst.computeBoundingSphere();
    cShadeInst.castShadow = true;
    cShadeInst.receiveShadow = true;
    root.add(cShadeInst);
  }

  const spawnFoliageInst = (
    items: Array<{ mat4: THREE.Matrix4; tint: number }>,
    mat: THREE.MeshStandardMaterial
  ) => {
    if (items.length === 0) return;
    const inst = new THREE.InstancedMesh(leafCardGeom, mat, items.length);
    items.forEach(({ mat4, tint }, i) => {
      inst.setMatrixAt(i, mat4);
      _tCol.setHex(tint);
      inst.setColorAt(i, _tCol);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.computeBoundingSphere();
    inst.castShadow = false;
    inst.receiveShadow = true;
    root.add(inst);
  };
  spawnFoliageInst(leafList, leafCardMat);
  spawnFoliageInst(cypressCardList, cypressCardMat);

  let lastShowMicro = true;
  let lastShowDistant = true;
  const setZoomLod = (zoom: number) => {
    const showMicro = zoom >= 0.98;
    if (showMicro !== lastShowMicro) {
      lastShowMicro = showMicro;
      microDetailsGroup.visible = showMicro;
    }
    const showDistant = zoom >= 0.96;
    if (showDistant !== lastShowDistant) {
      lastShowDistant = showDistant;
      distantDetailsGroup.visible = showDistant;
    }
  };

  return {
    group: root,
    doors,
    skyUniforms,
    roomLightMats,
    roomWashMats,
    roomPoolMats,
    roomSconceAnchors,
    interiorCoveMat: warmLedMat,
    entranceSconceMat,
    facadeSignMat,
    villaWinMat,
    pillarLanternMat,
    worldTreeHitMeshes,
    lockedRoomCovers,
    setZoomLod,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}

interface SharedCatalogMats {
  whiteBody: THREE.MeshStandardMaterial;
  silverMetal: THREE.MeshStandardMaterial;
  darkSlate: THREE.MeshStandardMaterial;
  blueUpholstery: THREE.MeshStandardMaterial;
  cyanAccent: THREE.MeshStandardMaterial;
  woodMat: THREE.MeshStandardMaterial;
  leafGreen: THREE.MeshStandardMaterial;
  ceramicPot: THREE.MeshStandardMaterial;
  blackRubber: THREE.MeshStandardMaterial;
  warmTimber: THREE.MeshStandardMaterial;
  redAccent: THREE.MeshStandardMaterial;
  emeraldAccent: THREE.MeshStandardMaterial;
  amberAccent: THREE.MeshStandardMaterial;
  frostGlassMat: THREE.MeshPhysicalMaterial;
  aoPlaneMat: THREE.MeshBasicMaterial;
  barkMat: THREE.MeshStandardMaterial;
  travertineMat: THREE.MeshStandardMaterial;
  soilMat: THREE.MeshStandardMaterial;
  blossomCardMat: THREE.MeshStandardMaterial;
  roseCardMat: THREE.MeshStandardMaterial;
  palmCardMat: THREE.MeshStandardMaterial;
  oliveCardMat: THREE.MeshStandardMaterial;
  cypressCardMat: THREE.MeshStandardMaterial;
  solarCellMat: THREE.MeshPhysicalMaterial;
  receptionScreenMat: THREE.MeshStandardMaterial;
  windTime: { value: number };
}

const sharedCatalogPoolByTextures = new WeakMap<TextureBundle, SharedCatalogMats>();

export function updateFoliageWindTime(textures: TextureBundle, timeSec: number) {
  const pool = sharedCatalogPoolByTextures.get(textures);
  if (pool) {
    pool.windTime.value = timeSec;
  }
}

function getSharedCatalogMats(textures: TextureBundle): SharedCatalogMats {
  const cached = sharedCatalogPoolByTextures.get(textures);
  if (cached) return cached;
  const windTime = { value: 0 };

  const pool: SharedCatalogMats = {
    whiteBody: new THREE.MeshStandardMaterial({
      color: 0xdadfe6,
      bumpMap: textures.brushedMetalBump,
      bumpScale: 0.0014,
      roughness: 0.40,
      metalness: 0.04,
      envMapIntensity: 0.64,
    }),
    silverMetal: makeMat({
      color: 0xbac2cc,
      bumpMap: textures.brushedMetalBump,
      bumpScale: 0.004,
      roughness: 0.28,
      metalness: 0.78,
      envMapIntensity: 0.85,
    }),
    darkSlate: makeMat({
      color: 0x243042,
      bumpMap: textures.brushedMetalBump,
      bumpScale: 0.003,
      roughness: 0.46,
      metalness: 0.28,
    }),
    blueUpholstery: new THREE.MeshStandardMaterial({
      color: 0x225d8a,
      bumpMap: textures.leatherBump,
      bumpScale: 0.0075,
      roughness: 0.46,
      metalness: 0.03,
    }),
    cyanAccent: new THREE.MeshStandardMaterial({
      color: 0x2e7fa8,
      bumpMap: textures.fabricWeaveBump,
      bumpScale: 0.006,
      roughness: 0.48,
      metalness: 0.06,
    }),
    woodMat: makeMat({
      map: textures.wood,
      bumpMap: textures.woodBump,
      bumpScale: 0.012,
      roughness: 0.62,
      metalness: 0.02,
    }),
    leafGreen: makeMat({ color: 0x3b6e2d, roughness: 0.84 }),
    ceramicPot: new THREE.MeshStandardMaterial({
      color: 0xc5bdb0,
      roughness: 0.38,
    }),
    blackRubber: makeMat({ color: 0x141a24, roughness: 0.82, metalness: 0.06 }),
    warmTimber: makeMat({
      color: 0x9c6b3f,
      bumpMap: textures.woodBump,
      bumpScale: 0.01,
      roughness: 0.58,
      metalness: 0.03,
    }),
    redAccent: makeMat({ color: 0xdc2626, roughness: 0.34, metalness: 0.12 }),
    emeraldAccent: makeMat({ color: 0x10b981, roughness: 0.34, metalness: 0.12 }),
    amberAccent: makeMat({ color: 0xf59e0b, roughness: 0.32, metalness: 0.16 }),
    frostGlassMat: new THREE.MeshPhysicalMaterial({
      color: 0xdbeafe,
      transparent: true,
      opacity: 0.54,
      roughness: 0.16,
      metalness: 0.04,
      ior: 1.5,
      clearcoat: 0.85,
      clearcoatRoughness: 0.08,
    }),
    aoPlaneMat: new THREE.MeshBasicMaterial({
      map: textures.contactShadow,
      transparent: true,
      depthWrite: false,
    }),
    barkMat: makeMat({
      map: textures.bark,
      bumpMap: textures.barkBump,
      bumpScale: 0.028,
      roughness: 0.94,
      metalness: 0.0,
    }),
    travertineMat: makeMat({
      color: 0xd6cdbf,
      bumpMap: textures.paverBump,
      bumpScale: 0.015,
      roughness: 0.72,
      metalness: 0.02,
    }),
    soilMat: makeMat({ color: 0x453121, roughness: 0.96, metalness: 0.0 }),
    blossomCardMat: new THREE.MeshStandardMaterial({
      map: textures.blossomFoliage,
      alphaTest: 0.42,
      side: THREE.DoubleSide,
      roughness: 0.82,
      metalness: 0.0,
    }),
    roseCardMat: new THREE.MeshStandardMaterial({
      map: textures.roseFoliage,
      alphaTest: 0.42,
      side: THREE.DoubleSide,
      roughness: 0.8,
      metalness: 0.0,
    }),
    palmCardMat: new THREE.MeshStandardMaterial({
      map: textures.palmFrond,
      alphaTest: 0.38,
      side: THREE.DoubleSide,
      roughness: 0.76,
      metalness: 0.0,
    }),
    oliveCardMat: new THREE.MeshStandardMaterial({
      map: textures.oliveFoliage,
      alphaTest: 0.4,
      side: THREE.DoubleSide,
      roughness: 0.8,
      metalness: 0.0,
    }),
    cypressCardMat: new THREE.MeshStandardMaterial({
      map: textures.cypressFoliage,
      alphaTest: 0.42,
      side: THREE.DoubleSide,
      roughness: 0.84,
      metalness: 0.0,
    }),
    solarCellMat: new THREE.MeshPhysicalMaterial({
      map: textures.solarCell,
      roughness: 0.14,
      metalness: 0.22,
      clearcoat: 0.92,
      clearcoatRoughness: 0.1,
    }),
    receptionScreenMat: new THREE.MeshStandardMaterial({
      map: textures.receptionScreen,
      emissiveMap: textures.receptionScreen,
      emissive: 0xffffff,
      emissiveIntensity: 0.72,
      roughness: 0.28,
      metalness: 0.04,
    }),
    windTime,
  };

  // Gentle breeze sway on outdoor catalog trees & flowering shrubs (zero CPU cost)
  applyFoliageWindShader(pool.blossomCardMat, windTime, 0.022, { heightBase: 0.35, heightScale: 0.55, tag: 'cat-blossom' });
  applyFoliageWindShader(pool.roseCardMat, windTime, 0.020, { heightBase: 0.25, heightScale: 0.55, tag: 'cat-rose' });
  applyFoliageWindShader(pool.palmCardMat, windTime, 0.032, { heightBase: 0.9, heightScale: 0.42, tag: 'cat-palm' });
  applyFoliageWindShader(pool.oliveCardMat, windTime, 0.026, { heightBase: 0.9, heightScale: 0.42, tag: 'cat-olive' });
  applyFoliageWindShader(pool.cypressCardMat, windTime, 0.022, { heightBase: 0.45, heightScale: 0.48, tag: 'cat-cyp' });

  sharedCatalogPoolByTextures.set(textures, pool);
  const origDispose = textures.dispose;
  textures.dispose = () => {
    Object.values(pool).forEach((entry) => {
      if (entry && typeof (entry as THREE.Material).dispose === 'function') {
        (entry as THREE.Material).dispose();
      }
    });
    origDispose();
  };

  return pool;
}

/**
 * Builds crisp multi-part PBR furniture, medical equipment, and decor items
 * anchored cleanly with soft contact AO decals.
 */
export function createCatalogMesh3D(
  sprite: SpriteKind,
  textures: TextureBundle,
  width: number,
  depth: number,
  rotation: 0 | 1 | 2 | 3,
  isGhost = false
): THREE.Group {
  const outer = new THREE.Group();
  const inner = new THREE.Group();
  outer.add(inner);

  const shared = getSharedCatalogMats(textures);
  const {
    whiteBody,
    silverMetal,
    darkSlate,
    blueUpholstery,
    cyanAccent,
    woodMat,
    leafGreen,
    ceramicPot,
    aoPlaneMat,
  } = shared;

  const isWallMountedSprite =
    sprite === 'wall_sconce_lamp' ||
    sprite === 'anatomy_poster' ||
    sprite === 'ac_nesma' ||
    sprite === 'ac_lg' ||
    sprite === 'wall_clock';

  if (!isGhost && sprite !== 'floor_rug' && sprite !== 'stone_pathway' && !isWallMountedSprite) {
    const ao = new THREE.Mesh(
      new THREE.PlaneGeometry(width * 0.96, depth * 0.96),
      aoPlaneMat
    );
    ao.rotation.x = -Math.PI / 2;
    ao.position.y = 0.018;
    ao.userData.noCastShadow = true;
    ao.userData.sharedGlbMat = true;
    ao.userData.lodMicro = true;
    inner.add(ao);
  }

  const haloMats: THREE.MeshBasicMaterial[] = [];
  const haloMaxOpacities: number[] = [];

  const addFloorHalo = (
    radius: number,
    colorHex: number,
    maxOp: number,
    x = 0,
    y = 0.026,
    z = 0
  ) => {
    if (isGhost) return;
    const mat = new THREE.MeshBasicMaterial({
      map: textures.sconcePool,
      color: colorHex,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.userData.noCastShadow = true;
    inner.add(m);
    haloMats.push(mat);
    haloMaxOpacities.push(maxOp);
  };

  const addBulbAura = (
    radius: number,
    colorHex: number,
    maxOp: number,
    x = 0,
    y = 1,
    z = 0
  ) => {
    if (isGhost) return;
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 8), mat);
    m.position.set(x, y, z);
    m.userData.noCastShadow = true;
    inner.add(m);
    haloMats.push(mat);
    haloMaxOpacities.push(maxOp);
  };

  const addWallWash = (
    w: number,
    h: number,
    colorHex: number,
    maxOp: number,
    x = 0,
    y = 1,
    z = 0,
    rotY = 0
  ) => {
    if (isGhost) return;
    const mat = new THREE.MeshBasicMaterial({
      map: textures.sconceWash,
      color: colorHex,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    m.userData.noCastShadow = true;
    inner.add(m);
    haloMats.push(mat);
    haloMaxOpacities.push(maxOp);
  };

  const sharedMatSet = new Set<THREE.Material>([
    whiteBody,
    silverMetal,
    darkSlate,
    blueUpholstery,
    cyanAccent,
    woodMat,
    leafGreen,
    ceramicPot,
    shared.blackRubber,
    shared.warmTimber,
    shared.redAccent,
    shared.emeraldAccent,
    shared.amberAccent,
    shared.frostGlassMat,
    aoPlaneMat,
    shared.barkMat,
    shared.travertineMat,
    shared.soilMat,
    shared.blossomCardMat,
    shared.roseCardMat,
    shared.palmCardMat,
    shared.oliveCardMat,
    shared.cypressCardMat,
    shared.solarCellMat,
    shared.receptionScreenMat,
  ]);

  const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (sharedMatSet.has(mat)) m.userData.sharedGlbMat = true;
    inner.add(m);
    return m;
  };
  const bevelBox = (
    w: number,
    h: number,
    d: number,
    radius: number,
    bevel: number,
    mat: THREE.Material,
    x = 0,
    y = 0,
    z = 0
  ) => {
    const b = Math.max(0, Math.min(bevel, h * 0.4, w * 0.25, d * 0.25));
    const iw = Math.max(0.002, w - b * 2);
    const id = Math.max(0.002, d - b * 2);
    const ih = Math.max(0.002, h - b * 2);
    const r = Math.max(0.0015, Math.min(radius, iw * 0.46, id * 0.46));
    const hw = iw * 0.5;
    const hd = id * 0.5;
    const s = new THREE.Shape();
    s.moveTo(-hw + r, -hd);
    s.lineTo(hw - r, -hd);
    s.quadraticCurveTo(hw, -hd, hw, -hd + r);
    s.lineTo(hw, hd - r);
    s.quadraticCurveTo(hw, hd, hw - r, hd);
    s.lineTo(-hw + r, hd);
    s.quadraticCurveTo(-hw, hd, -hw, hd - r);
    s.lineTo(-hw, -hd + r);
    s.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
    const geom = new THREE.ExtrudeGeometry(s, {
      depth: ih,
      bevelEnabled: b > 0.0005,
      bevelSize: b,
      bevelThickness: b,
      bevelSegments: 2,
      curveSegments: 5,
    });
    geom.rotateX(-Math.PI / 2);
    geom.center();
    geom.computeVertexNormals();
    const m = new THREE.Mesh(geom, mat);
    m.position.set(x, y, z);
    if (sharedMatSet.has(mat)) m.userData.sharedGlbMat = true;
    inner.add(m);
    return m;
  };
  const cyl = (rt: number, rb: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 10), mat);
    m.position.set(x, y, z);
    if (sharedMatSet.has(mat)) m.userData.sharedGlbMat = true;
    inner.add(m);
    return m;
  };
  const smoothCyl = (
    rt: number,
    rb: number,
    h: number,
    mat: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
    radialSegs = 14
  ) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, radialSegs), mat);
    m.position.set(x, y, z);
    if (sharedMatSet.has(mat)) m.userData.sharedGlbMat = true;
    inner.add(m);
    return m;
  };
  const sphereCap = (r: number, mat: THREE.Material, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
    m.position.set(x, y, z);
    if (sharedMatSet.has(mat)) m.userData.sharedGlbMat = true;
    inner.add(m);
    return m;
  };
  const tube = (
    pts: Array<[number, number, number]>,
    radius: number,
    mat: THREE.Material,
    segs = 12
  ) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, radius, 7, false), mat);
    if (sharedMatSet.has(mat)) m.userData.sharedGlbMat = true;
    inner.add(m);
    return m;
  };

  const {
    blackRubber,
    warmTimber,
    redAccent,
    emeraldAccent,
    amberAccent,
    frostGlassMat,
    barkMat,
    travertineMat,
    soilMat,
    blossomCardMat,
    roseCardMat,
    palmCardMat,
    oliveCardMat,
    cypressCardMat,
    solarCellMat,
    receptionScreenMat,
  } = shared;

  switch (sprite) {
    case 'treatment_bed': {
      // Authentic hospital & physiotherapy electric hi-lo examination/treatment bed
      // Head end at -X (-0.86), foot end at +X (+0.86), sitting/lying deck top strictly at y = 0.52
      const medicalSteel = new THREE.MeshStandardMaterial({
        color: 0xe6ecf2,
        bumpMap: textures.brushedMetalBump,
        bumpScale: 0.0025,
        roughness: 0.28,
        metalness: 0.24,
      });
      const plinthVinyl = new THREE.MeshStandardMaterial({
        color: 0x166982,
        bumpMap: textures.leatherBump,
        bumpScale: 0.0085,
        roughness: 0.42,
        metalness: 0.03,
      });
      const plinthBorder = new THREE.MeshStandardMaterial({
        color: 0x0f4c5c,
        bumpMap: textures.leatherBump,
        bumpScale: 0.006,
        roughness: 0.5,
        metalness: 0.05,
      });
      const plinthSeam = makeMat({ color: 0x0c3d4a, roughness: 0.58, metalness: 0.06 });
      const pillowMat = new THREE.MeshStandardMaterial({
        color: 0xeaf4f8,
        bumpMap: textures.fabricWeaveBump,
        bumpScale: 0.008,
        roughness: 0.62,
        metalness: 0.01,
      });
      const paperMat = new THREE.MeshStandardMaterial({
        color: 0xfbfdff,
        bumpMap: textures.fabricWeaveBump,
        bumpScale: 0.003,
        roughness: 0.76,
        metalness: 0.0,
      });
      const panelSlate = new THREE.MeshStandardMaterial({
        color: 0x2b3b4e,
        bumpMap: textures.brushedMetalBump,
        bumpScale: 0.003,
        roughness: 0.38,
        metalness: 0.22,
      });
      const chromeMat = new THREE.MeshStandardMaterial({
        color: 0xd4dde8,
        bumpMap: textures.brushedMetalBump,
        bumpScale: 0.002,
        roughness: 0.16,
        metalness: 0.88,
        envMapIntensity: 0.96,
      });

      // 1. Lower powder-coated steel H-base + 4 heavy-duty locking hospital casters
      for (const bz of [-0.26, 0.26]) {
        bevelBox(1.44, 0.046, 0.078, 0.016, 0.005, medicalSteel, 0, 0.122, bz);
      }
      for (const cxPos of [-0.66, 0.66]) {
        bevelBox(0.088, 0.052, 0.58, 0.018, 0.005, medicalSteel, cxPos, 0.125, 0);
        for (const czPos of [-0.29, 0.29]) {
          // Swivel fork housing + collar
          smoothCyl(0.022, 0.026, 0.036, chromeMat, cxPos, 0.088, czPos, 20);
          smoothCyl(0.028, 0.028, 0.012, panelSlate, cxPos, 0.104, czPos, 20);
          // Smooth rubber hospital caster wheel + brushed metallic hub cap
          const wheel = smoothCyl(0.048, 0.048, 0.034, blackRubber, cxPos, 0.048, czPos, 24);
          wheel.rotation.x = Math.PI / 2;
          const hub = smoothCyl(0.024, 0.024, 0.038, chromeMat, cxPos, 0.048, czPos, 20);
          hub.rotation.x = Math.PI / 2;
          hub.userData.noCastShadow = true;
          // Brake pedal tab (emerald/red lock toggle)
          const brake = bevelBox(
            0.036,
            0.012,
            0.018,
            0.004,
            0.002,
            cxPos > 0 ? emeraldAccent : redAccent,
            cxPos + (cxPos > 0 ? 0.045 : -0.045),
            0.088,
            czPos
          );
          brake.rotation.z = cxPos > 0 ? -0.25 : 0.25;
          brake.userData.noCastShadow = true;
        }
      }

      // 2. Twin telescoping electric hydraulic lift columns + X-scissor braces + side foot-control bar
      for (const colX of [-0.26, 0.28]) {
        bevelBox(0.18, 0.24, 0.22, 0.02, 0.006, panelSlate, colX, 0.245, 0);
        bevelBox(0.14, 0.14, 0.18, 0.016, 0.005, chromeMat, colX, 0.30, 0);
        // Column hydraulic seal ring
        bevelBox(0.19, 0.014, 0.23, 0.022, 0.003, medicalSteel, colX, 0.352, 0);
      }
      const scissorA = bevelBox(0.76, 0.036, 0.04, 0.012, 0.004, chromeMat, 0, 0.25, 0.14);
      scissorA.rotation.z = 0.34;
      const scissorB = bevelBox(0.76, 0.036, 0.04, 0.012, 0.004, chromeMat, 0, 0.25, -0.14);
      scissorB.rotation.z = -0.34;
      for (const pz of [-0.162, 0.162]) {
        const bolt = smoothCyl(0.014, 0.014, 0.014, panelSlate, 0, 0.25, pz, 16);
        bolt.rotation.x = Math.PI / 2;
      }

      // Side height-control foot pedal bars along front & rear base rails
      for (const pz of [-0.335, 0.335]) {
        bevelBox(0.44, 0.016, 0.032, 0.008, 0.003, chromeMat, 0, 0.116, pz).userData.noCastShadow = true;
        bevelBox(0.075, 0.014, 0.046, 0.008, 0.003, cyanAccent, -0.12, 0.122, pz).userData.noCastShadow = true;
        bevelBox(0.075, 0.014, 0.046, 0.008, 0.003, panelSlate, 0.12, 0.122, pz).userData.noCastShadow = true;
      }

      // 3. Upper perimeter chassis deck + 4 soft corner bumper rollers
      bevelBox(1.68, 0.044, 0.76, 0.036, 0.006, medicalSteel, 0, 0.394, 0);
      bevelBox(1.56, 0.022, 0.70, 0.03, 0.004, panelSlate, 0, 0.368, 0);
      for (const [rx, rz] of [
        [-0.85, -0.39],
        [-0.85, 0.39],
        [0.85, -0.39],
        [0.85, 0.39],
      ]) {
        const bumper = smoothCyl(0.042, 0.042, 0.026, panelSlate, rx, 0.396, rz, 24);
        bumper.userData.noCastShadow = true;
        const cap = smoothCyl(0.014, 0.014, 0.03, chromeMat, rx, 0.396, rz, 16);
        cap.userData.noCastShadow = true;
      }

      // 4. Molded hospital headboard (-X) & footboard (+X) with curved grab rails + chart pocket
      bevelBox(0.044, 0.39, 0.78, 0.014, 0.007, whiteBody, -0.86, 0.565, 0);
      bevelBox(0.048, 0.056, 0.80, 0.016, 0.008, cyanAccent, -0.86, 0.768, 0);
      bevelBox(0.026, 0.09, 0.28, 0.01, 0.004, panelSlate, -0.84, 0.69, 0).userData.receiveOnly = true;
      for (const gz of [-0.34, 0.34]) {
        smoothCyl(0.016, 0.016, 0.42, chromeMat, -0.86, 0.55, gz, 20);
      }

      bevelBox(0.044, 0.31, 0.78, 0.014, 0.007, whiteBody, 0.86, 0.525, 0);
      bevelBox(0.048, 0.052, 0.80, 0.016, 0.008, cyanAccent, 0.86, 0.692, 0);
      for (const gz of [-0.34, 0.34]) {
        smoothCyl(0.016, 0.016, 0.34, chromeMat, 0.86, 0.51, gz, 20);
      }
      // Footboard external clipboard / chart pocket + stainless top clip
      bevelBox(0.02, 0.17, 0.23, 0.006, 0.003, panelSlate, 0.892, 0.54, 0).userData.receiveOnly = true;
      bevelBox(0.008, 0.145, 0.19, 0.002, 0.001, paperMat, 0.903, 0.545, 0).userData.receiveOnly = true;
      bevelBox(0.01, 0.018, 0.08, 0.003, 0.002, chromeMat, 0.906, 0.614, 0).userData.receiveOnly = true;

      // 5. Telescoping split hospital safety rails (retracted smoothly below mattress top for easy transfer/sitting)
      for (const sz of [-0.408, 0.408]) {
        // Upper torso folded rail + pivot arms + teal release handle
        bevelBox(0.62, 0.024, 0.024, 0.008, 0.004, whiteBody, -0.34, 0.445, sz);
        const lowRailU = smoothCyl(0.01, 0.01, 0.62, chromeMat, -0.34, 0.355, sz, 16);
        lowRailU.rotation.z = Math.PI / 2;
        for (const px of [-0.56, -0.12]) {
          smoothCyl(0.012, 0.012, 0.12, chromeMat, px, 0.40, sz, 16).userData.noCastShadow = true;
        }
        bevelBox(0.09, 0.026, 0.028, 0.006, 0.004, cyanAccent, -0.34, 0.46, sz).userData.noCastShadow = true;

        // Lower leg folded rail segment
        bevelBox(0.56, 0.022, 0.024, 0.008, 0.004, whiteBody, 0.38, 0.44, sz);
        const lowRailL = smoothCyl(0.009, 0.009, 0.56, chromeMat, 0.38, 0.355, sz, 16);
        lowRailL.rotation.z = Math.PI / 2;
        for (const px of [0.18, 0.58]) {
          smoothCyl(0.012, 0.012, 0.11, chromeMat, px, 0.398, sz, 16).userData.noCastShadow = true;
        }
      }

      // 6. Antimicrobial medical vinyl multi-section mattress (main flat deck top strictly at y = 0.52)
      bevelBox(1.62, 0.024, 0.74, 0.036, 0.004, plinthBorder, -0.01, 0.428, 0);
      // Main torso & leg deck: center y=0.475, h=0.09 -> top = 0.520!
      bevelBox(1.06, 0.09, 0.72, 0.04, 0.014, plinthVinyl, 0.25, 0.475, 0);
      // Articulated knee-break seam crease + tailored piping seams & perimeter welt
      const kneeCrease = box(0.014, 0.088, 0.722, plinthSeam, 0.32, 0.475, 0);
      kneeCrease.userData.receiveOnly = true;
      const lumbarSeam = box(0.01, 0.091, 0.718, plinthSeam, -0.06, 0.475, 0);
      lumbarSeam.userData.receiveOnly = true;
      // Gently angled head/backrest cushion (+6.5° incline toward headboard) + stainless hinges & actuator
      const backrestDeck = bevelBox(0.54, 0.088, 0.72, 0.04, 0.014, plinthVinyl, -0.53, 0.492, 0);
      backrestDeck.rotation.z = -0.105;
      for (const hz of [-0.2, 0.2]) {
        const hinge = smoothCyl(0.014, 0.014, 0.046, chromeMat, -0.27, 0.432, hz, 16);
        hinge.rotation.x = Math.PI / 2;
        hinge.userData.noCastShadow = true;
      }
      const backActuator = smoothCyl(0.015, 0.018, 0.28, chromeMat, -0.32, 0.405, 0, 16);
      backActuator.rotation.z = 1.24;
      backActuator.userData.noCastShadow = true;
      bevelBox(0.11, 0.042, 0.064, 0.008, 0.003, panelSlate, -0.2, 0.39, 0).userData.noCastShadow = true;

      // Recessed breathing face-hole plug accent at upper head end
      const faceRing = smoothCyl(0.072, 0.072, 0.012, plinthBorder, -0.66, 0.538, 0, 24);
      faceRing.rotation.z = -0.105;
      faceRing.userData.receiveOnly = true;

      // Rounded plush side bolsters + smooth hemispherical caps along mattress edges
      for (const mz of [-0.358, 0.358]) {
        const edgeBolster = smoothCyl(0.024, 0.024, 1.54, plinthVinyl, 0, 0.502, mz, 20);
        edgeBolster.rotation.z = Math.PI / 2;
        edgeBolster.userData.receiveOnly = true;
        sphereCap(0.024, plinthVinyl, -0.77, 0.502, mz).userData.receiveOnly = true;
        sphereCap(0.024, plinthVinyl, 0.77, 0.502, mz).userData.receiveOnly = true;
      }

      // Contoured clinical headrest pillow at -X head end (receives patient head shadow)
      const pillow = bevelBox(0.24, 0.046, 0.44, 0.06, 0.016, pillowMat, -0.66, 0.556, 0);
      pillow.rotation.z = -0.09;
      pillow.userData.receiveOnly = true;

      // Neatly folded soft clinical therapy towel at foot corner (clear of seated & lying zones)
      const towelFoldA = bevelBox(0.22, 0.024, 0.28, 0.02, 0.008, pillowMat, 0.65, 0.532, -0.17);
      towelFoldA.userData.receiveOnly = true;
      const towelFoldB = bevelBox(0.19, 0.016, 0.24, 0.018, 0.006, plinthVinyl, 0.65, 0.55, -0.17);
      towelFoldB.userData.receiveOnly = true;

      // Corded handheld hi-lo electric pendant clipped neatly to the upper side frame
      bevelBox(0.036, 0.076, 0.022, 0.006, 0.003, panelSlate, -0.22, 0.435, 0.398).userData.noCastShadow = true;
      bevelBox(0.016, 0.018, 0.008, 0.003, 0.001, cyanAccent, -0.22, 0.445, 0.41).userData.noCastShadow = true;
      tube([[-0.22, 0.398, 0.398], [-0.18, 0.355, 0.382], [-0.12, 0.375, 0.35]], 0.0055, blackRubber, 8).userData.noCastShadow = true;

      // Sanitary paper roll bar under head + draped white exam paper sheet over center deck (top strictly y = 0.522)
      const paperRoll = smoothCyl(0.036, 0.036, 0.56, paperMat, -0.78, 0.455, 0, 24);
      paperRoll.rotation.x = Math.PI / 2;
      paperRoll.userData.receiveOnly = true;
      const rollCore = smoothCyl(0.014, 0.014, 0.58, chromeMat, -0.78, 0.455, 0, 16);
      rollCore.rotation.x = Math.PI / 2;
      rollCore.userData.noCastShadow = true;

      const sheetMain = bevelBox(0.76, 0.005, 0.56, 0.012, 0.0015, paperMat, 0.10, 0.522, 0);
      sheetMain.userData.receiveOnly = true;
      for (const sz of [-0.285, 0.285]) {
        const drape = bevelBox(0.74, 0.004, 0.028, 0.004, 0.001, paperMat, 0.10, 0.514, sz);
        drape.rotation.x = sz > 0 ? 1.15 : -1.15;
        drape.userData.receiveOnly = true;
      }
      break;
    }

    case 'reception_desk': {
      const deskFile = new THREE.Group();
      deskFile.position.set(RECEPTION_CHAIR_LOCAL_X - 0.3, 0.728, 0.08);
      deskFile.rotation.y = 0.18;
      const dfCover = new THREE.Mesh(
        new THREE.BoxGeometry(0.21, 0.014, 0.27),
        makeMat({ color: 0x0284c7, roughness: 0.48 })
      );
      dfCover.userData.noCastShadow = true;
      const dfSheets = new THREE.Mesh(
        new THREE.BoxGeometry(0.185, 0.009, 0.245),
        whiteBody
      );
      dfSheets.position.set(0.006, 0.008, 0.008);
      dfSheets.userData.noCastShadow = true;
      const dfTab = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.016, 0.028),
        makeMat({ color: 0xf59e0b, roughness: 0.45 })
      );
      dfTab.position.set(0.065, 0.002, -0.14);
      dfTab.userData.noCastShadow = true;
      deskFile.add(dfCover, dfSheets, dfTab);
      deskFile.visible = false;

      const glbDesk = glbRegistry.cloneNormalized('furn_desk', {
        stretchToBox: { w: 1.66, h: 0.72, d: 0.54 },
        rotY: Math.PI,
      });
      if (glbDesk) {
        glbDesk.position.set(0, 0, 0.21);
        inner.add(glbDesk);
        const ledApron = box(
          1.45,
          0.036,
          0.036,
          makeMat({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 0.85 }),
          0,
          0.075,
          0.47
        );
        ledApron.userData.noCastShadow = true;
        const mon = glbRegistry.cloneNormalized('furn_monitor', {
          targetHeight: 0.29,
          rotY: Math.PI,
        });
        if (mon) {
          mon.position.set(RECEPTION_CHAIR_LOCAL_X, 0.715, 0.14);
          inner.add(mon);
        }
        const lamp = glbRegistry.cloneNormalized('furn_lamp_desk', {
          targetHeight: 0.26,
          rotY: -0.6,
        });
        if (lamp) {
          lamp.position.set(0.56, 0.715, 0.22);
          inner.add(lamp);
        }
        inner.add(deskFile);

        const chair = glbRegistry.cloneNormalized('furn_chair_desk', {
          targetHeight: 0.8,
          rotY: 0,
        });
        if (chair) {
          chair.position.set(RECEPTION_CHAIR_LOCAL_X, 0, RECEPTION_CHAIR_LOCAL_Z);
          inner.add(chair);
        }
      }
      outer.userData.receptionDesk = { deskFile } satisfies ReceptionDeskRigMeta;
      break;
    }

    case 'waiting_chairs': {
      // Authentic 3-seat tandem hospital/clinic waiting bench (generous 0.62m per-seat spacing for 3 comfortable seated patients)
      // Main heavy-duty brushed steel horizontal beam
      box(1.88, 0.055, 0.08, darkSlate, 0, 0.25, -0.04);
      // Twin die-cast aluminum inverted-T leg frames with dark floor glides
      for (const lx of [-0.76, 0.76]) {
        cyl(0.028, 0.032, 0.24, silverMetal, lx, 0.13, -0.04);
        box(0.06, 0.038, 0.48, silverMetal, lx, 0.035, 0.01);
        for (const fz of [-0.21, 0.23]) {
          const pad = cyl(0.026, 0.028, 0.02, blackRubber, lx, 0.01, fz);
          pad.userData.noCastShadow = true;
        }
      }

      // 3 well-spaced individual ergonomic clinic seats (-0.62, 0, +0.62)
      const seatShellMat = makeMat({ color: 0x264b6e, roughness: 0.48, metalness: 0.08 });
      const cushionMat = makeMat({ color: 0x1e6091, roughness: 0.56, metalness: 0.04 });
      for (const sx of [-0.62, 0, 0.62]) {
        // Under-seat steel mounting bracket + contoured shell base
        box(0.4, 0.028, 0.34, silverMetal, sx, 0.29, 0.03);
        box(0.49, 0.045, 0.43, seatShellMat, sx, 0.325, 0.04);
        // Contoured slim PU/vinyl seat pad (top at y = 0.375)
        box(0.46, 0.038, 0.39, cushionMat, sx, 0.356, 0.05);
        // Rounded front waterfall lip
        const lip = cyl(0.02, 0.02, 0.46, cushionMat, sx, 0.352, 0.24);
        lip.rotation.z = Math.PI / 2;
        lip.userData.noCastShadow = true;

        // Curved steel spine connecting seat to backrest (leaves realistic lumbar gap)
        box(0.048, 0.24, 0.03, silverMetal, sx, 0.42, -0.18);
        // Ergonomic curved clinic backrest shell + top rim
        const backShell = box(0.48, 0.35, 0.045, seatShellMat, sx, 0.62, -0.2);
        backShell.rotation.x = -0.12;
        const backPad = box(0.43, 0.3, 0.032, cushionMat, sx, 0.62, -0.182);
        backPad.rotation.x = -0.12;
        backPad.userData.noCastShadow = true;
      }

      // 4 slim chrome divider/end armrests with dark molded arm pads
      for (const ax of [-0.91, -0.31, 0.31, 0.91]) {
        box(0.026, 0.22, 0.04, silverMetal, ax, 0.36, -0.05);
        box(0.044, 0.028, 0.36, darkSlate, ax, 0.475, 0.02);
      }
      break;
    }

    case 'luxury_chair': {
      // Plush tufted luxury executive lounge chair ("كرسي جلوس") facing +Z at rot=0
      const brassMat = makeMat({ color: 0xd4a94f, roughness: 0.26, metalness: 0.85 });
      const walnutMat = makeMat({ color: 0x4e3222, roughness: 0.48, metalness: 0.05 });
      const velvetMat = new THREE.MeshStandardMaterial({
        color: 0x1d405f,
        roughness: 0.62,
        metalness: 0.04,
      });
      const velvetDarkMat = new THREE.MeshStandardMaterial({
        color: 0x152f47,
        roughness: 0.66,
        metalness: 0.04,
      });
      const camelPillowMat = new THREE.MeshStandardMaterial({
        color: 0xc2854c,
        roughness: 0.56,
        metalness: 0.02,
      });

      // Tapered walnut legs with brushed brass ferrules
      for (const lx of [-0.28, 0.28]) {
        for (const lz of [-0.26, 0.26]) {
          const leg = cyl(0.028, 0.017, 0.2, walnutMat, lx, 0.13, lz);
          leg.rotation.z = lx > 0 ? -0.1 : 0.1;
          leg.rotation.x = lz > 0 ? 0.08 : -0.08;
          const ferrule = cyl(0.018, 0.015, 0.055, brassMat, lx * 1.03, 0.032, lz * 1.03);
          ferrule.rotation.z = leg.rotation.z;
          ferrule.rotation.x = leg.rotation.x;
          ferrule.userData.noCastShadow = true;
        }
      }

      // Rich walnut perimeter plinth apron + brass piping accent
      box(0.68, 0.07, 0.64, walnutMat, 0, 0.24, 0);
      const trim = box(0.7, 0.018, 0.66, brassMat, 0, 0.275, 0);
      trim.userData.noCastShadow = true;

      // Deep sculpted club-chair seat deck + plush thick beveled cushion
      box(0.66, 0.1, 0.6, velvetDarkMat, 0, 0.31, 0);
      box(0.54, 0.13, 0.54, velvetMat, 0, 0.38, 0.04);
      const frontRoll = cyl(0.06, 0.06, 0.53, velvetMat, 0, 0.375, 0.28);
      frontRoll.rotation.z = Math.PI / 2;
      frontRoll.userData.noCastShadow = true;

      // High wraparound wing/club backrest with vertical channel-tufted pleats
      const backOuter = box(0.68, 0.52, 0.14, velvetDarkMat, 0, 0.61, -0.24);
      backOuter.rotation.x = -0.12;
      for (let pi = -2; pi <= 2; pi++) {
        const pleat = cyl(0.055, 0.055, 0.44, velvetMat, pi * 0.105, 0.62, -0.175);
        pleat.rotation.x = -0.12;
        pleat.userData.noCastShadow = true;
      }

      // Plush rolled-top upholstered armrests
      for (const ax of [-0.31, 0.31]) {
        box(0.11, 0.28, 0.58, velvetDarkMat, ax, 0.47, -0.02);
        const armRoll = cyl(0.062, 0.062, 0.56, velvetMat, ax, 0.61, -0.01);
        armRoll.rotation.x = Math.PI / 2;
      }

      // Warm camel-tan tufted lumbar throw pillow
      const lumbar = box(0.38, 0.19, 0.09, camelPillowMat, 0, 0.5, -0.08);
      lumbar.rotation.x = -0.18;
      inner.scale.setScalar(0.89);
      break;
    }

    case 'ac_nesma': {
      // Evaporative Water Air Cooler ("مكيف نسمة"): large rectangular wall duct opening with honeycomb pad & louvers
      // Mounted flush at local x = -0.40 (extends inward to x = -0.20, centered at y = 1.44, width 0.88, height 0.60)
      const frameMat = makeMat({ color: 0xe6e8ec, roughness: 0.42, metalness: 0.15 });
      const ductInnerMat = makeMat({ color: 0x0f172a, roughness: 0.88, metalness: 0.05 });
      const padMat = makeMat({ map: textures.nesmaPad, roughness: 0.85, metalness: 0.02 });
      const louverMat = makeMat({ color: 0xf1f5f9, roughness: 0.32, metalness: 0.2 });
      const badgeMat = makeMat({
        map: textures.nesmaBadge,
        emissiveMap: textures.nesmaBadge,
        emissive: 0x0ea5e9,
        emissiveIntensity: 0.25,
        roughness: 0.3,
      });

      const cy = 1.32;
      // Outer recessed duct housing flange sitting flush against the wall (x = -0.40 .. -0.22)
      box(0.18, 0.62, 0.9, frameMat, -0.31, cy, 0);
      // Wide bezel frame around the big rectangular air opening
      box(0.05, 0.055, 0.94, silverMetal, -0.21, cy + 0.295, 0);
      box(0.05, 0.055, 0.94, silverMetal, -0.21, cy - 0.295, 0);
      box(0.05, 0.58, 0.055, silverMetal, -0.21, cy, -0.445);
      box(0.05, 0.58, 0.16, silverMetal, -0.21, cy, 0.39);

      // Deep dark recessed air cavity + wet celdek evaporative cooling pad visible inside
      const cavity = box(0.04, 0.52, 0.72, ductInnerMat, -0.24, cy, -0.06);
      cavity.userData.noCastShadow = true;
      const wetPad = box(0.02, 0.5, 0.7, padMat, -0.218, cy, -0.06);
      wetPad.userData.noCastShadow = true;

      // Multi-blade horizontal & vertical outlet louvers across the wide opening
      for (let hi = -2; hi <= 2; hi++) {
        const blade = box(0.032, 0.014, 0.7, louverMat, -0.192, cy + hi * 0.088, -0.06);
        blade.rotation.z = -0.32;
        blade.userData.noCastShadow = true;
      }
      for (let vi = -2; vi <= 2; vi++) {
        const vBlade = box(0.02, 0.48, 0.012, silverMetal, -0.205, cy, -0.06 + vi * 0.13);
        vBlade.userData.noCastShadow = true;
      }

      // Right-side NESMA nameplate & rotary speed/water-pump control dials + cool LED
      const badge = box(0.02, 0.14, 0.13, badgeMat, -0.185, cy + 0.16, 0.39);
      badge.userData.noCastShadow = true;
      for (const dy of [-0.02, -0.13]) {
        const knob = cyl(0.024, 0.026, 0.025, darkSlate, -0.18, cy + dy, 0.39);
        knob.rotation.z = Math.PI / 2;
        knob.userData.noCastShadow = true;
      }
      const coolLed = cyl(0.011, 0.011, 0.02, cyanAccent, -0.18, cy - 0.22, 0.39);
      coolLed.rotation.z = Math.PI / 2;
      coolLed.userData.noCastShadow = true;
      break;
    }

    case 'ac_lg': {
      // Modern LG Dual Inverter Gas Split AC ("مكيف LG") flush-mounted high at local x = -0.40, y = 1.62
      const glossyWhite = new THREE.MeshStandardMaterial({
        color: 0xf4f7fb,
        roughness: 0.20,
        metalness: 0.04,
      });
      const fasciaMat = makeMat({
        map: textures.lgAcFront,
        emissiveMap: textures.lgAcFront,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.32,
        roughness: 0.18,
        metalness: 0.15,
      });

      const cy = 1.46;
      // Sculpted aerodynamic side profile extruded along Z (unit width 0.96m)
      const acShape = new THREE.Shape();
      acShape.moveTo(0, -0.135);
      acShape.lineTo(0.16, -0.135);
      acShape.quadraticCurveTo(0.225, -0.115, 0.23, 0.02);
      acShape.quadraticCurveTo(0.22, 0.135, 0.14, 0.145);
      acShape.lineTo(0, 0.145);
      acShape.closePath();

      const bodyGeom = new THREE.ExtrudeGeometry(acShape, {
        depth: 0.94,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.012,
        bevelThickness: 0.012,
      });
      bodyGeom.translate(0, 0, -0.47);
      const bodyMesh = new THREE.Mesh(bodyGeom, glossyWhite);
      bodyMesh.position.set(-0.4, cy, 0);
      inner.add(bodyMesh);

      // Wall mounting cleat plate
      box(0.02, 0.22, 0.86, darkSlate, -0.39, cy, 0);

      // Sleek dark mirrored LG Dual Inverter + 22°C front display panel
      const frontDisplay = box(0.022, 0.15, 0.88, fasciaMat, -0.172, cy + 0.025, 0);
      frontDisplay.userData.noCastShadow = true;

      // Top air-intake grill ribs
      for (let ti = -3; ti <= 3; ti++) {
        const rib = box(0.11, 0.01, 0.84, silverMetal, -0.29, cy + 0.154, 0);
        rib.position.x = -0.34 + (ti + 3) * 0.018;
        rib.userData.noCastShadow = true;
      }

      // Recessed dark bottom air-outlet throat + motorized angled discharge swing vane
      const throat = box(0.06, 0.036, 0.82, darkSlate, -0.22, cy - 0.128, 0);
      throat.userData.noCastShadow = true;
      const vane = box(0.045, 0.012, 0.82, glossyWhite, -0.185, cy - 0.125, 0);
      vane.rotation.z = -0.48;
      vane.userData.noCastShadow = true;

      // Neat side refrigerant line conduit stub descending smoothly into wall
      const conduit = box(0.04, 0.28, 0.055, whiteBody, -0.38, cy - 0.22, -0.41);
      conduit.userData.noCastShadow = true;
      break;
    }

    case 'lounge_chair': {
      // Contoured clinical patient lounge armchair guaranteed facing +Z at rot=0
      for (const lx of [-0.25, 0.25]) {
        for (const lz of [-0.23, 0.23]) {
          const leg = cyl(0.026, 0.018, 0.24, warmTimber, lx, 0.12, lz);
          leg.rotation.z = lx > 0 ? -0.08 : 0.08;
        }
      }
      box(0.62, 0.07, 0.58, warmTimber, 0, 0.26, -0.01);
      // Tufted seat cushion
      box(0.54, 0.12, 0.52, blueUpholstery, 0, 0.35, 0.03);
      // Reclined padded backrest at -Z
      const back = box(0.56, 0.46, 0.13, blueUpholstery, 0, 0.59, -0.22);
      back.rotation.x = -0.14;
      // Soft lumbar accent pillow
      box(0.38, 0.16, 0.08, cyanAccent, 0, 0.48, -0.11);
      // Bilateral upholstered armrests
      for (const ax of [-0.3, 0.3]) {
        box(0.09, 0.22, 0.54, blueUpholstery, ax, 0.46, -0.01);
        box(0.07, 0.03, 0.48, warmTimber, ax, 0.58, -0.01);
      }
      inner.scale.setScalar(0.92);
      break;
    }

    case 'coffee_table': {
      const glbTable = glbRegistry.cloneNormalized('furn_coffee_table', {
        maxFootprint: { w: 0.72, d: 0.62 },
        targetHeight: 0.35,
      });
      if (glbTable) {
        inner.add(glbTable);
      }
      break;
    }

    case 'water_cooler': {
      // Realistic clinical standing hot/cold water dispenser with visible stacked cup dispenser,
      // stainless drip tray, illuminated indicator LEDs, 5-gal ribbed jug + interactive fill/return cups
      const bodyWhiteMat = makeMat({ color: 0xf1f5f9, roughness: 0.34, metalness: 0.06 });
      const sidePanelMat = makeMat({ color: 0xe2e8f0, roughness: 0.44, metalness: 0.1 });
      const recessMat = makeMat({ color: 0x1e293b, roughness: 0.52, metalness: 0.22 });
      const coldTapMat = makeMat({ color: 0x0284c7, roughness: 0.28 });
      const hotTapMat = makeMat({ color: 0xdc2626, roughness: 0.28 });
      const cupMat = makeMat({ color: 0xf8fafc, roughness: 0.48 });
      const cupRimMat = makeMat({ color: 0x0284c7, roughness: 0.35 });
      const capBlueMat = makeMat({ color: 0x0369a1, roughness: 0.36 });
      const clearTubeMat = new THREE.MeshPhysicalMaterial({
        color: 0xe0f2fe,
        roughness: 0.14,
        metalness: 0.04,
        transparent: true,
        opacity: 0.36,
      });
      const jugGlassMat = new THREE.MeshPhysicalMaterial({
        color: 0xbfe7fb,
        roughness: 0.08,
        metalness: 0.04,
        transparent: true,
        opacity: 0.48,
        clearcoat: 0.9,
      });
      const innerWaterMat = makeMat({
        color: 0x38bdf8,
        roughness: 0.15,
        transparent: true,
        opacity: 0.72,
      });

      // Leveling feet + recessed dark plinth base
      for (const fx of [-0.15, 0.15]) {
        for (const fz of [-0.15, 0.15]) {
          cyl(0.032, 0.036, 0.03, blackRubber, fx, 0.015, fz);
        }
      }
      box(0.42, 0.04, 0.4, darkSlate, 0, 0.04, 0);

      // Lower mini-fridge / cup storage cabinet with contoured door & stainless latch
      box(0.42, 0.38, 0.38, bodyWhiteMat, 0, 0.24, -0.01);
      box(0.36, 0.32, 0.028, sidePanelMat, 0, 0.24, 0.185);
      box(0.018, 0.11, 0.022, silverMetal, 0.13, 0.26, 0.204);

      // Upper dispenser torso + sculpted dark slate dispensing alcove + stainless drip tray grille
      box(0.42, 0.44, 0.28, bodyWhiteMat, 0, 0.65, -0.05);
      box(0.42, 0.44, 0.1, sidePanelMat, -0.17, 0.65, 0.12);
      box(0.08, 0.44, 0.1, sidePanelMat, 0.17, 0.65, 0.12);
      box(0.42, 0.12, 0.11, bodyWhiteMat, 0, 0.81, 0.13);
      box(0.28, 0.28, 0.1, recessMat, 0, 0.62, 0.125);
      // Brushed stainless steel drip tray + slotted grate
      box(0.3, 0.028, 0.15, silverMetal, 0, 0.46, 0.145);
      for (let gx = -0.1; gx <= 0.1; gx += 0.04) {
        box(0.016, 0.008, 0.11, darkSlate, gx, 0.476, 0.15);
      }

      // Cold (left) & Hot (right) paddle levers + chrome spouts
      box(0.036, 0.052, 0.036, coldTapMat, -0.065, 0.7, 0.155);
      box(0.036, 0.052, 0.036, hotTapMat, 0.065, 0.7, 0.155);
      cyl(0.012, 0.009, 0.03, silverMetal, -0.065, 0.66, 0.155);
      cyl(0.012, 0.009, 0.03, silverMetal, 0.065, 0.66, 0.155);

      // Micro LED status indicators (cooling cyan, power emerald, heating amber)
      const ledCold = box(0.024, 0.014, 0.012, makeMat({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 0.75 }), -0.07, 0.81, 0.19);
      const ledPow = box(0.024, 0.014, 0.012, makeMat({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 0.7 }), 0, 0.81, 0.19);
      const ledHot = box(0.024, 0.014, 0.012, makeMat({ color: 0xf97316, emissive: 0xea580c, emissiveIntensity: 0.65 }), 0.07, 0.81, 0.19);
      for (const l of [ledCold, ledPow, ledHot]) l.userData.noCastShadow = true;

      // Right Side: Chrome mounting clips + Clear cylindrical cup dispenser with visible stack of white cups
      box(0.05, 0.02, 0.06, silverMetal, 0.215, 0.75, 0.02);
      box(0.05, 0.02, 0.06, silverMetal, 0.215, 0.52, 0.02);
      cyl(0.044, 0.044, 0.3, clearTubeMat, 0.245, 0.64, 0.02);
      cyl(0.047, 0.047, 0.025, darkSlate, 0.245, 0.795, 0.02);
      cyl(0.047, 0.04, 0.035, silverMetal, 0.245, 0.485, 0.02);
      for (let ci = 0; ci < 5; ci++) {
        cyl(0.031, 0.024, 0.04, cupMat, 0.245, 0.54 + ci * 0.046, 0.02);
      }

      // Left Side: Stainless & dark-slate Used Cup Return Holder / Basket + Coaster Pad
      box(0.04, 0.02, 0.08, silverMetal, -0.215, 0.5, 0.04);
      cyl(0.046, 0.042, 0.09, darkSlate, -0.245, 0.46, 0.04);
      const returnRim = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.006, 6, 14), silverMetal);
      returnRim.rotation.x = Math.PI / 2;
      returnRim.position.set(-0.245, 0.505, 0.04);
      inner.add(returnRim);

      // Spill-free bottle collar & realistic inverted 5-Gallon Jug with ribs & internal water + bubble
      cyl(0.16, 0.175, 0.048, bodyWhiteMat, 0, 0.89, -0.02);
      cyl(0.065, 0.132, 0.085, capBlueMat, 0, 0.94, -0.02);
      cyl(0.146, 0.146, 0.25, innerWaterMat, 0, 1.09, -0.02);
      cyl(0.166, 0.166, 0.38, jugGlassMat, 0, 1.14, -0.02);
      for (const ry of [1.04, 1.14, 1.24]) {
        const rib = new THREE.Mesh(
          new THREE.TorusGeometry(0.168, 0.008, 6, 18),
          jugGlassMat
        );
        rib.rotation.x = Math.PI / 2;
        rib.position.set(0, ry, -0.02);
        inner.add(rib);
      }
      cyl(0.085, 0.156, 0.07, jugGlassMat, 0, 1.36, -0.02);
      cyl(0.052, 0.052, 0.04, capBlueMat, 0, 1.405, -0.02);

      // Animated rising air bubble inside the 5-gallon jug when dispensing
      const bubble = new THREE.Mesh(
        new THREE.SphereGeometry(0.016, 8, 6),
        makeMat({ color: 0xe0f2fe, roughness: 0.1, transparent: true, opacity: 0.85 })
      );
      bubble.position.set(0.02, 1.0, -0.02);
      bubble.visible = false;
      bubble.userData.noCastShadow = true;
      inner.add(bubble);

      // Interactive Alcove Cup (sits on drip tray under cold spout while filling)
      const alcoveCup = new THREE.Group();
      alcoveCup.position.set(-0.065, 0.48, 0.155);
      const aCupMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.022, 0.078, 12), cupMat);
      aCupMesh.position.y = 0.039;
      const aCupRim = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.004, 6, 14), cupRimMat);
      aCupRim.rotation.x = Math.PI / 2;
      aCupRim.position.y = 0.078;
      const alcoveWater = new THREE.Mesh(
        new THREE.CylinderGeometry(0.028, 0.021, 0.062, 12),
        makeMat({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.22, roughness: 0.18 })
      );
      alcoveWater.position.y = 0.036;
      alcoveWater.userData.noCastShadow = true;
      alcoveCup.add(aCupMesh, aCupRim, alcoveWater);
      alcoveCup.visible = false;
      inner.add(alcoveCup);

      // Thin animated water stream pouring from cold tap into alcove cup
      const stream = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0045, 0.0055, 0.14, 8),
        makeMat({
          color: 0x7dd3fc,
          emissive: 0x38bdf8,
          emissiveIntensity: 0.5,
          transparent: true,
          opacity: 0.84,
        })
      );
      stream.position.set(-0.065, 0.585, 0.155);
      stream.visible = false;
      stream.userData.noCastShadow = true;
      inner.add(stream);

      // Returned Cup sitting neatly in the left-side return tray after drinking
      const returnedCup = new THREE.Group();
      returnedCup.position.set(-0.245, 0.525, 0.04);
      const rCupMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.032, 0.074, 12), cupMat);
      const rCupRim = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.004, 6, 14), cupRimMat);
      rCupRim.rotation.x = Math.PI / 2;
      rCupRim.position.y = -0.036;
      returnedCup.add(rCupMesh, rCupRim);
      returnedCup.visible = false;
      inner.add(returnedCup);

      outer.userData.waterCooler = {
        alcoveCup,
        alcoveWater,
        stream,
        returnedCup,
        bubble,
      } as WaterCoolerRigMeta;
      inner.scale.setScalar(0.81);
      break;
    }

    case 'med_cabinet': {
      const glbMedCab = glbRegistry.cloneNormalized('furn_med_cabinet', {
        maxFootprint: { w: 0.74, d: 0.5 },
        targetHeight: 1.42,
      });
      if (glbMedCab) {
        inner.add(glbMedCab);
      }
      break;
    }

    case 'file_cabinet': {
      const glbShelf = glbRegistry.cloneNormalized('furn_bookshelf', {
        maxFootprint: { w: 0.84, d: 0.56 },
        targetHeight: 1.24,
      });
      const binderPalette = [
        0x0284c7, // clinical cyan
        0x0d9488, // medical teal
        0x2563eb, // royal blue
        0xd97706, // manila amber
        0x475569, // archival slate
        0xdc2626, // urgent triage red
        0x059669, // emerald chart
      ];
      const binderMats = binderPalette.map((col) => makeMat({ color: col, roughness: 0.45 }));
      const manilaMat = makeMat({ color: 0xe7d2a8, roughness: 0.62 });
      const labelMat = makeMat({ color: 0xf8fafc, roughness: 0.3 });

      const populateShelfRow = (yBase: number, rowIdx: number, maxW = 0.54, depth = 0.165) => {
        // Vertical ring binders on left/center + leaning folder + horizontal patient chart stack on right
        let cursorX = -maxW * 0.5 + 0.032;
        const binderCount = rowIdx % 2 === 0 ? 7 : 6;
        for (let bi = 0; bi < binderCount; bi++) {
          const bw = 0.038 + ((bi + rowIdx) % 3) * 0.008;
          const bh = 0.125 + ((bi * 3 + rowIdx) % 4) * 0.007;
          if (cursorX + bw * 0.5 > maxW * 0.26) break;
          const mat = binderMats[(bi + rowIdx * 2) % binderMats.length];
          const b = box(bw, bh, depth, mat, cursorX, yBase + bh * 0.5, 0.004);
          // Spine label sticker visible from front & back
          const labelF = box(bw * 0.65, 0.026, 0.005, labelMat, cursorX, yBase + bh * 0.68, depth * 0.5 + 0.005);
          labelF.userData.noCastShadow = true;
          const labelB = box(bw * 0.65, 0.026, 0.005, labelMat, cursorX, yBase + bh * 0.68, -depth * 0.5 - 0.001);
          labelB.userData.noCastShadow = true;
          // White paper block tucked inside binder top edge
          const pages = box(bw * 0.72, 0.008, depth * 0.86, labelMat, cursorX, yBase + bh + 0.001, 0.004);
          pages.userData.noCastShadow = true;
          b.castShadow = false;
          cursorX += bw + 0.008;
        }

        // Right-hand horizontal stack of flat patient chart folders with stepped index tabs
        const stackCount = 3 + (rowIdx % 2);
        const stackX = maxW * 0.34;
        for (let si = 0; si < stackCount; si++) {
          const fy = yBase + 0.011 + si * 0.022;
          const fMat = si % 2 === 0 ? manilaMat : binderMats[(rowIdx + si) % binderMats.length];
          const folder = box(0.15, 0.018, depth * 0.92, fMat, stackX, fy, 0.004);
          folder.rotation.y = (si % 2 === 0 ? 1 : -1) * 0.06;
          folder.castShadow = false;
          const sheet = box(0.14, 0.006, depth * 0.86, labelMat, stackX, fy + 0.008, 0.004);
          sheet.rotation.y = folder.rotation.y;
          sheet.userData.noCastShadow = true;
        }
      };

      if (glbShelf) {
        inner.add(glbShelf);
        // Bookshelf normalized to 1.24m has shelf surfaces cleanly at these Y heights
        const glbShelfYs = [0.186, 0.361, 0.536, 0.712, 0.887, 1.062];
        glbShelfYs.forEach((sy, idx) => populateShelfRow(sy, idx, 0.52, 0.165));
        // Top archive tray with extra active patient charts
        box(0.24, 0.04, 0.17, darkSlate, 0.14, 1.255, 0);
        box(0.2, 0.022, 0.14, binderMats[0], 0.14, 1.275, 0);
        box(0.19, 0.012, 0.13, labelMat, 0.14, 1.288, 0).userData.noCastShadow = true;
      }
      break;
    }

    case 'wheelchair_bay': {
      const glbChair = glbRegistry.cloneNormalized('furn_wheelchair', {
        maxFootprint: { w: 0.66, d: 0.66 },
        targetHeight: 0.75,
      });
      if (glbChair) {
        inner.add(glbChair);
      }
      break;
    }

    case 'doctor_stool': {
      // 5-star chrome base with dual casters, gas-lift post, round blue cushioned seat + lumbar arch
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2;
        const arm = box(0.035, 0.026, 0.23, silverMetal, Math.sin(ang) * 0.12, 0.075, Math.cos(ang) * 0.12);
        arm.rotation.y = ang;
        cyl(0.024, 0.024, 0.03, blackRubber, Math.sin(ang) * 0.21, 0.028, Math.cos(ang) * 0.21);
      }
      cyl(0.028, 0.034, 0.38, silverMetal, 0, 0.26, 0);
      cyl(0.19, 0.19, 0.08, blueUpholstery, 0, 0.48, 0);
      cyl(0.2, 0.2, 0.02, darkSlate, 0, 0.44, 0);
      box(0.04, 0.26, 0.04, silverMetal, 0, 0.58, -0.19);
      box(0.28, 0.14, 0.06, blueUpholstery, 0, 0.72, -0.19);
      inner.scale.setScalar(0.82);
      break;
    }

    case 'corner_desk': {
      const glbCorner = glbRegistry.cloneNormalized('furn_desk_corner', {
        maxFootprint: { w: 1.72, d: 0.84 },
        targetHeight: 0.64,
      });
      if (glbCorner) {
        inner.add(glbCorner);
        const mon = glbRegistry.cloneNormalized('furn_monitor', {
          targetHeight: 0.29,
          rotY: Math.PI,
        });
        if (mon) {
          mon.position.set(0.22, 0.625, -0.15);
          inner.add(mon);
        }
      }
      break;
    }

    // ================ CLINICAL EQUIPMENT (REALISTIC MULTI-PART MODELS) ================

    case 'tens_unit': {
      // Clinical 4-Channel TENS / IFC Combo Cart with twin chrome rails, coiled lead cables & adhesive pads
      for (const lx of [-0.19, 0.19]) {
        for (const lz of [-0.18, 0.18]) {
          cyl(0.036, 0.036, 0.055, blackRubber, lx, 0.028, lz);
          box(0.032, 0.035, 0.045, silverMetal, lx, 0.055, lz);
        }
      }
      box(0.46, 0.05, 0.44, silverMetal, 0, 0.08, 0);
      // Twin brushed-chrome side uprights + mid wire electrode basket + rear push handle
      cyl(0.02, 0.02, 0.78, silverMetal, -0.18, 0.47, -0.09);
      cyl(0.02, 0.02, 0.78, silverMetal, 0.18, 0.47, -0.09);
      box(0.36, 0.04, 0.28, silverMetal, 0, 0.4, 0.02);
      box(0.32, 0.06, 0.22, blueUpholstery, 0, 0.45, 0.02);
      cyl(0.014, 0.014, 0.38, darkSlate, 0, 0.85, -0.22).rotation.z = Math.PI / 2;
      // Top medical TENS/IFC generator console deck + sloped housing + glowing multi-channel waveform LCD
      box(0.45, 0.055, 0.42, whiteBody, 0, 0.84, 0);
      const body = box(0.39, 0.17, 0.31, whiteBody, 0, 0.94, 0);
      body.rotation.x = 0.24;
      const scrMat = makeMat({
        map: textures.ecgScreen,
        emissive: 0x0ea5e9,
        emissiveIntensity: 0.48,
        roughness: 0.2,
      });
      const lcd = box(0.29, 0.12, 0.02, scrMat, 0, 1.0, 0.08);
      lcd.rotation.x = -0.58;
      lcd.userData.noCastShadow = true;
      // 4 Channel intensity encoders + red/black output banana jacks
      for (let ki = 0; ki < 4; ki++) {
        const kx = -0.11 + ki * 0.074;
        cyl(0.023, 0.025, 0.032, cyanAccent, kx, 0.92, 0.14);
        cyl(0.011, 0.011, 0.025, ki % 2 === 0 ? redAccent : blackRubber, kx, 0.87, 0.185).rotation.x = Math.PI / 2;
      }
      // Side cable tree + realistic curved dual-channel lead cables + 4 hydrogel electrode pads
      box(0.05, 0.025, 0.18, silverMetal, 0.23, 0.84, 0);
      tube([[0.12, 0.87, 0.18], [0.24, 0.78, 0.12], [0.25, 0.58, 0.04], [0.22, 0.72, -0.04]], 0.009, blackRubber);
      tube([[-0.11, 0.87, 0.18], [-0.23, 0.78, 0.1], [-0.24, 0.62, 0.02], [-0.21, 0.74, -0.05]], 0.009, redAccent);
      box(0.02, 0.09, 0.075, whiteBody, -0.23, 0.75, 0.06);
      box(0.02, 0.09, 0.075, cyanAccent, -0.23, 0.75, -0.05);
      inner.scale.setScalar(0.8);
      break;
    }

    case 'ultrasound_unit': {
      // Sculpted Diagnostic/Therapeutic Ultrasound Workstation with Dual Transducer Wands & Aquasonic Gel Bottle
      for (const lx of [-0.21, 0.21]) {
        for (const lz of [-0.2, 0.2]) {
          cyl(0.038, 0.038, 0.06, blackRubber, lx, 0.03, lz);
        }
      }
      box(0.5, 0.055, 0.48, darkSlate, 0, 0.085, 0);
      box(0.4, 0.68, 0.36, whiteBody, 0, 0.44, -0.01);
      // Lower supply drawers + brushed aluminum pull handles + ventilation grille
      box(0.34, 0.18, 0.03, cyanAccent, 0, 0.31, 0.175);
      box(0.34, 0.14, 0.03, makeMat({ color: 0xe2e8f0, roughness: 0.42 }), 0, 0.51, 0.175);
      box(0.13, 0.02, 0.025, silverMetal, 0, 0.33, 0.195);
      box(0.13, 0.02, 0.025, silverMetal, 0, 0.53, 0.195);
      box(0.45, 0.055, 0.42, silverMetal, 0, 0.8, 0);
      // Angled 1/3 MHz Ultrasound Console Head + crisp waveform screen + start/intensity dial
      const head = box(0.41, 0.27, 0.16, darkSlate, 0, 0.96, -0.04);
      head.rotation.x = -0.34;
      const scrMat = makeMat({
        map: textures.ecgScreen,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.48,
        roughness: 0.2,
      });
      const scr = box(0.33, 0.18, 0.02, scrMat, 0, 0.98, 0.035);
      scr.rotation.x = -0.34;
      scr.userData.noCastShadow = true;
      cyl(0.026, 0.028, 0.03, silverMetal, 0.13, 0.85, 0.14);
      cyl(0.018, 0.018, 0.024, emeraldAccent, -0.12, 0.85, 0.14);
      // Right gel warmer holster + iconic translucent-blue Aquasonic gel bottle
      box(0.09, 0.08, 0.1, silverMetal, 0.24, 0.78, 0.04);
      cyl(0.042, 0.042, 0.18, makeMat({ color: 0x0284c7, roughness: 0.26 }), 0.24, 0.89, 0.04);
      cyl(0.008, 0.025, 0.055, whiteBody, 0.24, 1.0, 0.04);
      // Left probe cradle + curved ergonomic 5cm² stainless transducer wand + coiled probe cable
      box(0.08, 0.06, 0.09, darkSlate, -0.23, 0.81, 0.04);
      const handle = cyl(0.018, 0.022, 0.19, whiteBody, -0.23, 0.92, 0.04);
      handle.rotation.z = 0.22;
      const headDisc = cyl(0.044, 0.036, 0.036, silverMetal, -0.26, 1.01, 0.05);
      headDisc.rotation.z = Math.PI / 2 - 0.35;
      tube([[-0.22, 0.83, 0.04], [-0.27, 0.65, 0.06], [-0.25, 0.52, -0.02], [-0.18, 0.72, -0.04]], 0.011, darkSlate);
      inner.scale.setScalar(0.8);
      break;
    }

    case 'laser_hilt': {
      // High-Intensity Class IV Laser Therapy (HILT) Tower with optical fiber cable, handpiece & laser goggles
      for (const lx of [-0.21, 0.21]) {
        for (const lz of [-0.21, 0.21]) {
          cyl(0.04, 0.04, 0.06, blackRubber, lx, 0.03, lz);
        }
      }
      box(0.5, 0.06, 0.5, darkSlate, 0, 0.085, 0);
      box(0.42, 0.72, 0.38, whiteBody, 0, 0.47, 0);
      box(0.44, 0.055, 0.4, amberAccent, 0, 0.79, 0);
      box(0.08, 0.62, 0.4, cyanAccent, 0, 0.45, 0.01);
      // Side cooling louvers
      for (let vy = 0.22; vy <= 0.44; vy += 0.065) {
        box(0.44, 0.018, 0.24, darkSlate, 0, vy, -0.02);
      }
      // Wide touchscreen clinical protocol interface
      const panel = box(0.42, 0.32, 0.12, darkSlate, 0, 0.98, 0.02);
      panel.rotation.x = -0.45;
      const scrMat = makeMat({
        map: textures.ecgScreen,
        emissive: 0xef4444,
        emissiveIntensity: 0.4,
        roughness: 0.2,
      });
      const scr = box(0.35, 0.22, 0.02, scrMat, 0, 1.0, 0.075);
      scr.rotation.x = -0.45;
      scr.userData.noCastShadow = true;
      // Red E-stop mushroom switch + key lock + flexible armored optical fiber conduit
      cyl(0.028, 0.028, 0.028, redAccent, 0.14, 0.85, 0.14);
      cyl(0.015, 0.015, 0.035, silverMetal, 0.06, 0.85, 0.15);
      cyl(0.014, 0.016, 0.54, silverMetal, -0.17, 1.08, -0.06);
      tube([[-0.17, 1.33, -0.06], [-0.08, 1.44, -0.01], [0.04, 1.35, 0.05], [0.09, 1.24, 0.06]], 0.013, blackRubber);
      const laserWand = cyl(0.022, 0.016, 0.22, silverMetal, 0.09, 1.18, 0.06);
      laserWand.rotation.z = 0.48;
      // Glowing red aiming beam lens tip + pair of green Class-IV laser safety eyewear
      const tipGlow = cyl(0.012, 0.012, 0.02, makeMat({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 0.9 }), 0.14, 1.09, 0.06);
      tipGlow.userData.noCastShadow = true;
      box(0.14, 0.045, 0.06, emeraldAccent, -0.16, 0.84, 0.13);
      inner.scale.setScalar(0.79);
      break;
    }

    case 'swd_unit': {
      // Shortwave Diathermy (27.12 MHz SWD) Mobile Generator + Twin Articulated Coaxial Arm & Drum Electrode
      for (const lx of [-0.21, 0.21]) {
        for (const lz of [-0.2, 0.2]) {
          cyl(0.038, 0.038, 0.06, blackRubber, lx, 0.03, lz);
        }
      }
      box(0.5, 0.06, 0.48, silverMetal, 0, 0.085, 0);
      box(0.42, 0.72, 0.4, whiteBody, 0, 0.47, 0);
      box(0.34, 0.24, 0.025, makeMat({ color: 0xcbd5e1, roughness: 0.46 }), 0, 0.36, 0.2);
      const fascia = box(0.4, 0.22, 0.34, darkSlate, 0, 0.88, 0.02);
      fascia.rotation.x = 0.28;
      const meter = box(
        0.26,
        0.1,
        0.02,
        makeMat({ map: textures.ecgScreen, emissive: 0x38bdf8, emissiveIntensity: 0.45 }),
        0,
        0.95,
        0.1
      );
      meter.rotation.x = -0.5;
      meter.userData.noCastShadow = true;
      cyl(0.028, 0.03, 0.032, cyanAccent, -0.11, 0.9, 0.14);
      cyl(0.028, 0.03, 0.032, cyanAccent, 0.11, 0.9, 0.14);
      // Articulated spring-balanced boom + heavy coaxial RF cables + large circular SWD drum cap
      cyl(0.022, 0.026, 0.56, silverMetal, -0.14, 1.18, -0.1);
      cyl(0.038, 0.038, 0.05, darkSlate, -0.14, 1.44, -0.09);
      const boom = box(0.46, 0.035, 0.035, silverMetal, 0.04, 1.44, -0.02);
      boom.rotation.z = 0.15;
      cyl(0.02, 0.02, 0.18, darkSlate, 0.24, 1.38, 0.04);
      tube([[-0.08, 0.84, -0.14], [-0.18, 1.12, -0.16], [0.02, 1.42, -0.08], [0.22, 1.32, 0.02]], 0.013, blackRubber);
      cyl(0.17, 0.17, 0.075, whiteBody, 0.24, 1.26, 0.04);
      cyl(0.15, 0.15, 0.022, blueUpholstery, 0.24, 1.22, 0.04);
      inner.scale.setScalar(0.81);
      break;
    }

    case 'shockwave_eswt': {
      // Radial Shockwave Therapy (ESWT) Compressor Cart + Ballistic Pistol Applicator & Titanium Tips Rack
      for (const lx of [-0.21, 0.21]) {
        for (const lz of [-0.2, 0.2]) {
          cyl(0.038, 0.038, 0.06, blackRubber, lx, 0.03, lz);
        }
      }
      box(0.5, 0.06, 0.48, silverMetal, 0, 0.085, 0);
      box(0.42, 0.7, 0.4, whiteBody, 0, 0.46, 0);
      for (let vy = 0.18; vy <= 0.38; vy += 0.06) {
        box(0.32, 0.02, 0.03, darkSlate, 0, vy, 0.2);
      }
      // Integrated water-trap pressure gauge on rear/side
      cyl(0.038, 0.038, 0.025, silverMetal, -0.14, 0.56, 0.205).rotation.x = Math.PI / 2;
      const scrFrame = box(0.4, 0.26, 0.12, darkSlate, 0, 0.96, 0.02);
      scrFrame.rotation.x = -0.4;
      const scr = box(
        0.34,
        0.19,
        0.02,
        makeMat({ map: textures.ecgScreen, emissive: 0x0ea5e9, emissiveIntensity: 0.48 }),
        0,
        0.97,
        0.07
      );
      scr.rotation.x = -0.4;
      scr.userData.noCastShadow = true;
      // Silver transmitter head tray (6mm, 15mm, 20mm D-Actor tips)
      box(0.28, 0.03, 0.14, silverMetal, -0.02, 0.82, -0.11);
      for (const tx of [-0.08, 0, 0.08]) {
        cyl(0.02, 0.018, 0.05, silverMetal, tx, 0.85, -0.11);
      }
      // Ballistic pistol handpiece holstered + continuous braided pneumatic hose connecting chassis -> grip
      box(0.08, 0.1, 0.09, darkSlate, 0.24, 0.78, 0.05);
      const barrel = cyl(0.028, 0.022, 0.28, silverMetal, 0.26, 0.9, 0.08);
      barrel.rotation.x = 0.8;
      cyl(0.032, 0.032, 0.04, blueUpholstery, 0.26, 0.99, 0.17).rotation.x = 0.8;
      const grip = box(0.04, 0.15, 0.06, darkSlate, 0.26, 0.8, 0.04);
      grip.rotation.x = -0.25;
      tube([[0.18, 0.52, 0.08], [0.29, 0.44, 0.06], [0.3, 0.6, 0.02], [0.26, 0.74, 0.03]], 0.015, blackRubber);
      inner.scale.setScalar(0.81);
      break;
    }

    case 'traction_table': {
      // Split-Section Spinal Decompression Plinth + Motorized Head/Lumbar Traction Tower (top strictly y = 0.520)
      const trSteel = new THREE.MeshStandardMaterial({
        color: 0xe6ecf2,
        bumpMap: textures.brushedMetalBump,
        bumpScale: 0.0025,
        roughness: 0.28,
        metalness: 0.24,
      });
      const trSlate = new THREE.MeshStandardMaterial({
        color: 0x263547,
        bumpMap: textures.brushedMetalBump,
        bumpScale: 0.003,
        roughness: 0.38,
        metalness: 0.24,
      });
      const trChrome = new THREE.MeshStandardMaterial({
        color: 0xd4dde8,
        bumpMap: textures.brushedMetalBump,
        bumpScale: 0.002,
        roughness: 0.16,
        metalness: 0.88,
        envMapIntensity: 0.96,
      });
      const trVinyl = new THREE.MeshStandardMaterial({
        color: 0x165e7a,
        bumpMap: textures.leatherBump,
        bumpScale: 0.0085,
        roughness: 0.40,
        metalness: 0.03,
      });
      const trBorder = new THREE.MeshStandardMaterial({
        color: 0x0e4459,
        bumpMap: textures.leatherBump,
        bumpScale: 0.006,
        roughness: 0.52,
        metalness: 0.05,
      });
      const trPillow = new THREE.MeshStandardMaterial({
        color: 0xeaf4f8,
        bumpMap: textures.fabricWeaveBump,
        bumpScale: 0.007,
        roughness: 0.62,
      });

      // 1. Heavy steel H-frame base + 4 locking clinical casters
      for (const bz of [-0.25, 0.25]) {
        bevelBox(1.44, 0.044, 0.074, 0.016, 0.005, trSteel, -0.04, 0.115, bz);
      }
      for (const cxPos of [-0.66, 0.60]) {
        bevelBox(0.084, 0.05, 0.56, 0.018, 0.005, trSteel, cxPos, 0.118, 0);
        for (const czPos of [-0.28, 0.28]) {
          smoothCyl(0.02, 0.024, 0.034, trChrome, cxPos, 0.084, czPos, 18);
          const wheel = smoothCyl(0.044, 0.044, 0.032, blackRubber, cxPos, 0.044, czPos, 22);
          wheel.rotation.x = Math.PI / 2;
          const hub = smoothCyl(0.022, 0.022, 0.035, trChrome, cxPos, 0.044, czPos, 18);
          hub.rotation.x = Math.PI / 2;
          hub.userData.noCastShadow = true;
          const brake = bevelBox(
            0.032,
            0.012,
            0.016,
            0.004,
            0.002,
            cxPos > 0 ? emeraldAccent : redAccent,
            cxPos + (cxPos > 0 ? 0.04 : -0.04),
            0.084,
            czPos
          );
          brake.rotation.z = cxPos > 0 ? -0.25 : 0.25;
          brake.userData.noCastShadow = true;
        }
      }

      // 2. X-scissor elevation arms + central hydraulic actuator piston
      for (const sz of [-0.15, 0.15]) {
        const s1 = bevelBox(0.74, 0.038, 0.038, 0.012, 0.004, trSlate, -0.04, 0.248, sz);
        s1.rotation.z = 0.34;
        const s2 = bevelBox(0.74, 0.038, 0.038, 0.012, 0.004, trChrome, -0.04, 0.248, sz);
        s2.rotation.z = -0.34;
      }
      const trActuator = smoothCyl(0.026, 0.03, 0.22, trSlate, -0.14, 0.23, 0, 18);
      trActuator.rotation.z = -0.65;
      const trPiston = smoothCyl(0.016, 0.016, 0.24, trChrome, 0.02, 0.29, 0, 16);
      trPiston.rotation.z = -0.65;

      // 3. Upper perimeter steel carriage & stainless friction-free rolling decompression rails
      bevelBox(1.56, 0.044, 0.72, 0.032, 0.006, trSteel, -0.03, 0.394, 0);
      bevelBox(1.46, 0.022, 0.66, 0.026, 0.004, trSlate, -0.03, 0.368, 0);
      for (const rz of [-0.24, 0.24]) {
        const glideRail = smoothCyl(0.013, 0.013, 0.76, trChrome, 0.18, 0.422, rz, 18);
        glideRail.rotation.z = Math.PI / 2;
        glideRail.userData.noCastShadow = true;
      }

      // 4. Rolling Split-Section Antimicrobial Vinyl Plinth (top strictly y = 0.520)
      bevelBox(1.36, 0.022, 0.70, 0.03, 0.004, trBorder, -0.08, 0.428, 0);
      // Thoracic/head deck (-X): x = -0.43, w = 0.64 -> ends at -0.11; top = 0.475 + 0.045 = 0.520
      bevelBox(0.64, 0.09, 0.68, 0.038, 0.014, trVinyl, -0.43, 0.475, 0);
      // Moving lumbar decompression deck (+X): x = +0.23, w = 0.62 -> starts at -0.08 (3cm crisp split gap!)
      bevelBox(0.62, 0.09, 0.68, 0.038, 0.014, trVinyl, 0.23, 0.475, 0);
      // Rounded plush bolsters along edges (receiveOnly so zero shadow artifact on legs)
      for (const mz of [-0.336, 0.336]) {
        const bThor = smoothCyl(0.022, 0.022, 0.60, trVinyl, -0.43, 0.502, mz, 18);
        bThor.rotation.z = Math.PI / 2;
        bThor.userData.receiveOnly = true;
        const bLumb = smoothCyl(0.022, 0.022, 0.58, trVinyl, 0.23, 0.502, mz, 18);
        bLumb.rotation.z = Math.PI / 2;
        bLumb.userData.receiveOnly = true;
      }
      // Subtle belt anchor cleats recessed cleanly below seat line
      for (const cz of [-0.36, 0.36]) {
        bevelBox(0.18, 0.024, 0.024, 0.006, 0.003, trChrome, -0.08, 0.42, cz).userData.noCastShadow = true;
        bevelBox(0.08, 0.022, 0.028, 0.005, 0.003, cyanAccent, 0.22, 0.42, cz).userData.noCastShadow = true;
      }

      // Contoured cervical pillow at -X (-0.61) & half-moon orthopedic knee bolster at +X (+0.44, clear of x=0 seat!)
      const tPillow = bevelBox(0.22, 0.044, 0.42, 0.05, 0.014, trPillow, -0.61, 0.544, 0);
      tPillow.userData.receiveOnly = true;
      const bolster = smoothCyl(0.06, 0.06, 0.48, cyanAccent, 0.44, 0.548, 0, 24);
      bolster.rotation.x = Math.PI / 2;
      bolster.userData.receiveOnly = true;

      // 5. Motorized Foot Traction Console Tower (+0.74) with Digital Screen, Winch, Cables & Spreader Bar
      bevelBox(0.22, 0.78, 0.44, 0.024, 0.007, whiteBody, 0.74, 0.78, 0);
      bevelBox(0.06, 0.74, 0.38, 0.016, 0.005, trSlate, 0.83, 0.78, 0);
      bevelBox(0.24, 0.046, 0.46, 0.02, 0.006, cyanAccent, 0.74, 1.18, 0);

      const consoleHead = bevelBox(0.14, 0.24, 0.36, 0.018, 0.005, trSlate, 0.65, 1.04, 0);
      consoleHead.rotation.z = 0.22;
      const fScreen = box(
        0.02,
        0.18,
        0.29,
        makeMat({ map: textures.ecgScreen, emissive: 0x38bdf8, emissiveIntensity: 0.48 }),
        0.59,
        1.05,
        0
      );
      fScreen.rotation.z = 0.22;
      fScreen.userData.noCastShadow = true;
      // Rotary tension knob + E-stop button on tower front
      smoothCyl(0.022, 0.024, 0.024, trChrome, 0.62, 0.88, -0.09, 16).rotation.z = Math.PI / 2;
      smoothCyl(0.02, 0.02, 0.022, redAccent, 0.62, 0.88, 0.09, 16).rotation.z = Math.PI / 2;

      // Motorized winch spool + twin braided steel cables + sculpted spreader bar
      const winchDrum = smoothCyl(0.048, 0.048, 0.14, trChrome, 0.61, 0.72, 0, 20);
      winchDrum.rotation.z = Math.PI / 2;
      bevelBox(0.04, 0.04, 0.34, 0.012, 0.004, trSlate, 0.49, 0.63, 0);
      for (const cz of [-0.08, 0.08]) {
        tube([[0.61, 0.72, cz * 0.4], [0.55, 0.67, cz * 0.8], [0.49, 0.63, cz]], 0.006, blackRubber, 6);
      }

      // Tethered patient safety release switch clipped neatly to tower side
      tube([[0.70, 0.68, 0.22], [0.64, 0.50, 0.34], [0.56, 0.56, 0.34]], 0.007, blackRubber, 8);
      bevelBox(0.075, 0.036, 0.036, 0.008, 0.004, trSlate, 0.55, 0.56, 0.34);
      smoothCyl(0.012, 0.012, 0.018, redAccent, 0.55, 0.582, 0.34, 14).userData.noCastShadow = true;
      break;
    }

    case 'cpm_device': {
      // Continuous Passive Motion (CPM) Knee Sled with actuator screw, thigh/calf troughs & tethered pendant
      box(0.86, 0.06, 0.42, whiteBody, 0, 0.04, 0);
      for (const rz of [-0.14, 0.14]) {
        const rail = cyl(0.016, 0.016, 0.78, silverMetal, 0, 0.11, rz);
        rail.rotation.z = Math.PI / 2;
      }
      cyl(0.012, 0.012, 0.72, darkSlate, 0, 0.11, 0).rotation.z = Math.PI / 2;
      box(0.22, 0.24, 0.36, darkSlate, 0.32, 0.18, 0);
      const angleScr = box(
        0.13,
        0.08,
        0.02,
        makeMat({ map: textures.ecgScreen, emissive: 0x38bdf8, emissiveIntensity: 0.44 }),
        0.32,
        0.24,
        0.185
      );
      angleScr.userData.noCastShadow = true;
      for (const lz of [-0.15, 0.15]) {
        const thighFrame = box(0.36, 0.03, 0.03, silverMetal, -0.18, 0.28, lz);
        thighFrame.rotation.z = 0.52;
        const calfFrame = box(0.38, 0.03, 0.03, silverMetal, 0.1, 0.28, lz);
        calfFrame.rotation.z = -0.46;
      }
      const thighPad = box(0.34, 0.05, 0.26, blueUpholstery, -0.18, 0.31, 0);
      thighPad.rotation.z = 0.52;
      const calfPad = box(0.36, 0.05, 0.26, blueUpholstery, 0.1, 0.31, 0);
      calfPad.rotation.z = -0.46;
      const bootPlate = box(0.05, 0.22, 0.22, whiteBody, 0.24, 0.26, 0);
      bootPlate.rotation.z = -0.2;
      box(0.03, 0.05, 0.24, cyanAccent, 0.22, 0.28, 0);
      tube([[0.22, 0.14, 0.18], [0.1, 0.08, 0.26], [-0.04, 0.1, 0.25]], 0.008, blackRubber, 8);
      box(0.09, 0.03, 0.14, darkSlate, -0.05, 0.1, 0.25);
      inner.scale.setScalar(0.86);
      break;
    }

    case 'treadmill': {
      // Clinical Gait Rehabilitation Treadmill with cushioned deck, safety tether & full-length medical handrails
      box(1.74, 0.13, 0.82, darkSlate, 0, 0.07, 0);
      box(1.42, 0.04, 0.58, blackRubber, -0.08, 0.15, 0);
      // Textured belt center alignment line & side step strips
      box(1.36, 0.042, 0.02, cyanAccent, -0.08, 0.152, 0);
      box(1.56, 0.055, 0.07, silverMetal, -0.02, 0.155, 0.36);
      box(1.56, 0.055, 0.07, silverMetal, -0.02, 0.155, -0.36);
      box(0.36, 0.17, 0.68, whiteBody, 0.64, 0.18, 0);
      for (const sz of [-0.36, 0.36]) {
        const frontPost = cyl(0.028, 0.032, 0.98, silverMetal, 0.68, 0.58, sz);
        frontPost.rotation.z = 0.12;
        cyl(0.024, 0.026, 0.72, silverMetal, -0.18, 0.5, sz);
        const topRail = cyl(0.024, 0.024, 1.02, darkSlate, 0.24, 0.86, sz);
        topRail.rotation.z = Math.PI / 2;
      }
      const con = box(0.24, 0.22, 0.76, darkSlate, 0.62, 1.08, 0);
      con.rotation.z = 0.35;
      const scr = box(
        0.18,
        0.03,
        0.48,
        makeMat({ map: textures.ecgScreen, emissive: 0x38bdf8, emissiveIntensity: 0.42 }),
        0.6,
        1.17,
        0
      );
      scr.rotation.z = 0.35;
      scr.userData.noCastShadow = true;
      box(0.05, 0.05, 0.05, redAccent, 0.54, 1.06, 0);
      tube([[0.54, 1.05, 0], [0.46, 0.92, 0.06], [0.38, 0.85, 0.02]], 0.006, redAccent, 8);
      inner.scale.set(0.9, 0.82, 0.9);
      break;
    }

    case 'exercise_bike': {
      // Clinical Semi-Recumbent Rehab Ergometer with step-through chassis, crank pedals & ergonomic backrest
      box(0.86, 0.06, 0.48, silverMetal, 0, 0.035, 0);
      box(0.68, 0.14, 0.18, darkSlate, 0, 0.11, 0);
      const wheel = cyl(0.23, 0.23, 0.16, whiteBody, 0.18, 0.31, 0);
      wheel.rotation.x = Math.PI / 2;
      const hub = cyl(0.12, 0.12, 0.18, cyanAccent, 0.18, 0.31, 0);
      hub.rotation.x = Math.PI / 2;
      for (const pz of [-0.14, 0.14]) {
        box(0.03, 0.15, 0.025, silverMetal, 0.12, pz > 0 ? 0.28 : 0.35, pz * 0.78);
        box(0.11, 0.03, 0.09, blackRubber, 0.12, pz > 0 ? 0.2 : 0.42, pz);
        box(0.06, 0.025, 0.09, cyanAccent, 0.12, pz > 0 ? 0.23 : 0.45, pz);
      }
      cyl(0.032, 0.038, 0.52, silverMetal, -0.22, 0.34, 0);
      box(0.24, 0.08, 0.24, blueUpholstery, -0.22, 0.62, 0);
      box(0.04, 0.28, 0.05, silverMetal, -0.34, 0.7, 0);
      box(0.07, 0.24, 0.28, blueUpholstery, -0.36, 0.82, 0);
      const stem = box(0.08, 0.68, 0.09, whiteBody, 0.24, 0.54, 0);
      stem.rotation.z = 0.22;
      box(0.12, 0.06, 0.46, blackRubber, 0.16, 0.86, 0);
      const bikeScr = box(
        0.16,
        0.12,
        0.24,
        makeMat({ map: textures.ecgScreen, emissive: 0x38bdf8, emissiveIntensity: 0.4 }),
        0.18,
        0.92,
        0
      );
      bikeScr.userData.noCastShadow = true;
      inner.scale.setScalar(0.82);
      break;
    }

    case 'wall_bars': {
      // Swedish Beechwood Stall Bars with protruding top chin-up canopy & draped TheraBands
      box(0.08, 1.82, 0.11, warmTimber, -0.35, 0.91, -0.28);
      box(0.08, 1.82, 0.11, warmTimber, 0.35, 0.91, -0.28);
      box(0.07, 0.08, 0.28, warmTimber, -0.35, 1.78, -0.16);
      box(0.07, 0.08, 0.28, warmTimber, 0.35, 1.78, -0.16);
      cyl(0.026, 0.026, 0.72, warmTimber, 0, 1.78, -0.04).rotation.z = Math.PI / 2;
      for (let ry = 0.2; ry <= 1.68; ry += 0.16) {
        const rung = cyl(0.022, 0.022, 0.7, warmTimber, 0, ry, -0.28);
        rung.rotation.z = Math.PI / 2;
      }
      box(0.09, 0.46, 0.02, redAccent, -0.18, 1.24, -0.25);
      box(0.09, 0.54, 0.02, emeraldAccent, 0.16, 1.2, -0.25);
      box(0.09, 0.42, 0.02, cyanAccent, 0, 0.92, -0.25);
      inner.scale.set(0.94, 0.9, 0.94);
      break;
    }

    case 'ball_rack': {
      // Chrome vertical Swiss-ball storage frame with 2 Bobath balls + BOSU / wobble dome
      for (const lx of [-0.32, 0.32]) {
        box(0.045, 1.05, 0.48, silverMetal, lx, 0.52, 0);
      }
      box(0.68, 0.04, 0.48, silverMetal, 0, 0.04, 0);
      const ringLow = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.018, 6, 18), silverMetal);
      ringLow.rotation.x = Math.PI / 2;
      ringLow.position.set(0, 0.26, 0);
      const ringHigh = ringLow.clone();
      ringHigh.position.set(0, 0.76, 0);
      const ballBlue = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 16, 12),
        makeMat({ color: 0x0284c7, roughness: 0.32 })
      );
      ballBlue.position.set(0, 0.4, 0);
      const ballViolet = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 16, 12),
        makeMat({ color: 0x7c3aed, roughness: 0.32 })
      );
      ballViolet.position.set(0, 0.9, 0);
      cyl(0.16, 0.16, 0.04, cyanAccent, 0, 0.08, 0.04);
      inner.add(ringLow, ringHigh, ballBlue, ballViolet);
      inner.scale.setScalar(0.84);
      break;
    }

    case 'exercise_mat': {
      // 3-panel stitched therapeutic floor mat + foam roller + half-round bolster
      for (const mx of [-0.52, 0, 0.52]) {
        box(0.5, 0.065, 0.74, blueUpholstery, mx, 0.033, 0);
      }
      box(1.56, 0.072, 0.06, cyanAccent, 0, 0.036, 0.34);
      box(1.56, 0.072, 0.06, cyanAccent, 0, 0.036, -0.34);
      const roller = cyl(0.075, 0.075, 0.54, cyanAccent, -0.62, 0.14, 0);
      roller.rotation.x = Math.PI / 2;
      break;
    }

    case 'parallel_bars': {
      // Hardwood gait training deck with chamfered ramps, stainless stanchions & center balance line
      box(1.52, 0.05, 0.78, woodMat, 0, 0.025, 0);
      box(1.48, 0.052, 0.03, cyanAccent, 0, 0.028, 0);
      const rampL = box(0.24, 0.04, 0.78, woodMat, -0.84, 0.015, 0);
      rampL.rotation.z = 0.14;
      const rampR = box(0.24, 0.04, 0.78, woodMat, 0.84, 0.015, 0);
      rampR.rotation.z = -0.14;
      for (const lx of [-0.68, 0.68]) {
        for (const lz of [-0.31, 0.31]) {
          cyl(0.045, 0.055, 0.06, darkSlate, lx, 0.06, lz);
          cyl(0.026, 0.028, 0.8, silverMetal, lx, 0.44, lz);
          cyl(0.036, 0.036, 0.06, darkSlate, lx, 0.58, lz);
        }
      }
      for (const lz of [-0.31, 0.31]) {
        const rail = cyl(0.03, 0.03, 1.7, warmTimber, 0, 0.84, lz);
        rail.rotation.z = Math.PI / 2;
      }
      inner.scale.set(0.94, 0.82, 0.86);
      break;
    }

    case 'balance_trainer': {
      // Computerized Posturography Platform with glowing force-plate ring, stainless U-rail & live monitor
      box(0.84, 0.06, 0.84, whiteBody, 0, 0.03, 0);
      cyl(0.32, 0.34, 0.065, darkSlate, 0, 0.08, -0.04);
      const ledRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.27, 0.016, 8, 24),
        makeMat({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 0.75 })
      );
      ledRing.rotation.x = Math.PI / 2;
      ledRing.position.set(0, 0.115, -0.04);
      ledRing.userData.noCastShadow = true;
      inner.add(ledRing);
      box(0.09, 0.015, 0.22, cyanAccent, -0.1, 0.12, -0.04);
      box(0.09, 0.015, 0.22, cyanAccent, 0.1, 0.12, -0.04);
      for (const sz of [-0.36, 0.36]) {
        cyl(0.024, 0.026, 0.92, silverMetal, -0.32, 0.48, sz);
        cyl(0.024, 0.026, 0.92, silverMetal, 0.32, 0.48, sz);
        cyl(0.022, 0.022, 0.66, blackRubber, 0, 0.94, sz).rotation.z = Math.PI / 2;
      }
      cyl(0.03, 0.035, 1.12, silverMetal, 0.34, 0.58, 0);
      const monBox = box(0.14, 0.24, 0.34, darkSlate, 0.3, 1.16, 0);
      monBox.rotation.z = 0.25;
      const monScr = box(
        0.02,
        0.18,
        0.28,
        makeMat({ map: textures.ecgScreen, emissive: 0x10b981, emissiveIntensity: 0.45 }),
        0.23,
        1.16,
        0
      );
      monScr.rotation.z = 0.25;
      monScr.userData.noCastShadow = true;
      inner.scale.set(0.92, 0.81, 0.92);
      break;
    }

    case 'emg_biofeedback': {
      // Surface EMG Biofeedback diagnostic cart on 5-star chrome base with pre-amp pod & tri-color cable bundle
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2;
        const arm = box(0.035, 0.03, 0.24, silverMetal, Math.sin(ang) * 0.13, 0.07, Math.cos(ang) * 0.13);
        arm.rotation.y = ang;
        cyl(0.026, 0.026, 0.03, blackRubber, Math.sin(ang) * 0.23, 0.025, Math.cos(ang) * 0.23);
      }
      cyl(0.035, 0.04, 0.98, silverMetal, 0, 0.56, -0.06);
      box(0.46, 0.045, 0.38, whiteBody, 0, 0.72, 0);
      box(0.24, 0.08, 0.18, darkSlate, -0.06, 0.78, 0.02);
      cyl(0.015, 0.015, 0.03, redAccent, 0.11, 0.77, 0.08);
      cyl(0.015, 0.015, 0.03, emeraldAccent, 0.15, 0.77, 0.08);
      cyl(0.015, 0.015, 0.03, amberAccent, 0.19, 0.77, 0.08);
      // Draped tri-color EMG sensor cables hanging cleanly from pre-amp
      tube([[0.11, 0.77, 0.09], [0.22, 0.66, 0.13], [0.24, 0.46, 0.06], [0.18, 0.62, -0.04]], 0.008, redAccent);
      tube([[0.15, 0.77, 0.09], [0.25, 0.67, 0.11], [0.26, 0.48, 0.03], [0.2, 0.64, -0.05]], 0.008, emeraldAccent);
      box(0.52, 0.34, 0.05, darkSlate, 0, 1.12, -0.04);
      const emgScr = box(
        0.46,
        0.27,
        0.02,
        makeMat({ map: textures.ecgScreen, emissive: 0x22c55e, emissiveIntensity: 0.48 }),
        0,
        1.12,
        -0.01
      );
      emgScr.userData.noCastShadow = true;
      inner.scale.setScalar(0.82);
      break;
    }

    case 'hydro_sink': {
      // Authentic Stainless-Steel Hydrocollator Heated Moist Hot-Pack Tank on locking casters
      for (const lx of [-0.24, 0.24]) {
        for (const lz of [-0.18, 0.18]) {
          cyl(0.036, 0.036, 0.06, blackRubber, lx, 0.03, lz);
        }
      }
      box(0.6, 0.05, 0.48, silverMetal, 0, 0.08, 0);
      box(0.56, 0.64, 0.44, silverMetal, 0, 0.42, 0);
      const lid = box(0.58, 0.04, 0.46, silverMetal, 0, 0.8, -0.03);
      lid.rotation.x = -0.18;
      box(0.24, 0.035, 0.045, darkSlate, 0, 0.85, 0.14);
      cyl(0.045, 0.045, 0.03, whiteBody, -0.12, 0.62, 0.22).rotation.x = Math.PI / 2;
      box(0.05, 0.03, 0.025, redAccent, 0.12, 0.62, 0.225);
      cyl(0.018, 0.018, 0.07, amberAccent, 0, 0.22, 0.24).rotation.x = Math.PI / 2;
      box(0.06, 0.26, 0.28, silverMetal, 0.31, 0.56, 0);
      box(0.05, 0.2, 0.22, blueUpholstery, 0.32, 0.58, 0);
      inner.scale.setScalar(0.81);
      break;
    }

    case 'cryo_unit': {
      // Dynamic Cold Compression Cryo Therapy Tower with frosted-ice reservoir, knee cuff wrap & curved insulated coolant hose
      for (const lx of [-0.2, 0.2]) {
        for (const lz of [-0.2, 0.2]) {
          cyl(0.038, 0.038, 0.06, blackRubber, lx, 0.03, lz);
        }
      }
      box(0.46, 0.46, 0.44, darkSlate, 0, 0.29, 0);
      const cScr = box(
        0.24,
        0.13,
        0.02,
        makeMat({ map: textures.ecgScreen, emissive: 0x38bdf8, emissiveIntensity: 0.45 }),
        0,
        0.4,
        0.225
      );
      cScr.userData.noCastShadow = true;
      const iceTankMat = new THREE.MeshPhysicalMaterial({
        color: 0x7dd3fc,
        roughness: 0.22,
        transparent: true,
        opacity: 0.78,
      });
      cyl(0.18, 0.16, 0.36, iceTankMat, 0, 0.7, 0);
      cyl(0.19, 0.19, 0.06, cyanAccent, 0, 0.9, 0);
      box(0.22, 0.035, 0.04, whiteBody, 0, 0.96, 0);
      box(0.08, 0.24, 0.22, blueUpholstery, 0.26, 0.62, 0);
      tube([[0.18, 0.42, 0.1], [0.29, 0.34, 0.08], [0.3, 0.5, 0], [0.26, 0.58, -0.02]], 0.015, silverMetal);
      inner.scale.setScalar(0.8);
      break;
    }

    case 'paraffin_bath': {
      // Paraffin Wax Thermal Bath Unit on stainless mobile trolley with glowing golden amber wax & thermal mitts
      for (const lx of [-0.22, 0.22]) {
        for (const lz of [-0.18, 0.18]) {
          cyl(0.035, 0.035, 0.055, blackRubber, lx, 0.028, lz);
        }
      }
      box(0.52, 0.045, 0.44, silverMetal, 0, 0.08, 0);
      for (const lx of [-0.21, 0.21]) {
        for (const lz of [-0.16, 0.16]) {
          cyl(0.018, 0.018, 0.48, silverMetal, lx, 0.33, lz);
        }
      }
      box(0.48, 0.035, 0.4, whiteBody, 0, 0.3, 0);
      box(0.16, 0.06, 0.22, blueUpholstery, -0.1, 0.35, 0);
      box(0.16, 0.06, 0.22, whiteBody, 0.1, 0.35, 0);
      box(0.5, 0.04, 0.42, silverMetal, 0, 0.58, 0);
      box(0.46, 0.24, 0.36, whiteBody, 0, 0.72, 0);
      box(0.48, 0.035, 0.38, darkSlate, 0, 0.85, 0);
      const waxMat = makeMat({
        color: 0xfbbf24,
        emissive: 0xd97706,
        emissiveIntensity: 0.36,
        roughness: 0.16,
      });
      const waxSurface = box(0.36, 0.022, 0.26, waxMat, 0, 0.879, 0);
      waxSurface.userData.noCastShadow = true;
      const heatLed = box(0.04, 0.025, 0.016, amberAccent, -0.14, 0.72, 0.19);
      heatLed.userData.noCastShadow = true;
      inner.scale.setScalar(0.81);
      break;
    }

    // ================ NEW ESSENTIAL PT EQUIPMENT & MANUAL PT TOOL STATIONS ================

    case 'infrared_lamp': {
      // Clinical Infrared Lamp on 5-star caster rolling base, gooseneck arm, spun reflector & glowing ruby IR emitter
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2;
        const arm = box(0.036, 0.03, 0.24, silverMetal, Math.sin(ang) * 0.13, 0.068, Math.cos(ang) * 0.13);
        arm.rotation.y = ang;
        cyl(0.026, 0.026, 0.03, blackRubber, Math.sin(ang) * 0.23, 0.024, Math.cos(ang) * 0.23);
      }
      cyl(0.026, 0.032, 0.88, silverMetal, -0.06, 0.5, 0);
      // Inline digital timer & dimmer box on column
      box(0.11, 0.18, 0.09, whiteBody, -0.06, 0.78, 0.04);
      cyl(0.018, 0.018, 0.022, redAccent, -0.06, 0.8, 0.095).rotation.x = Math.PI / 2;
      // Articulated chrome boom curving cleanly toward front reflector
      tube([[-0.06, 0.92, 0], [-0.04, 1.32, 0], [0.1, 1.4, 0], [0.18, 1.24, 0]], 0.016, silverMetal, 12);
      // Spun-metal vented IR reflector dome angled slightly downward
      const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.175, 0.24, 16), silverMetal);
      hood.position.set(0.2, 1.15, 0);
      hood.rotation.z = 0.42;
      inner.add(hood);
      const irBulbMat = makeMat({
        color: 0xff3b30,
        emissive: 0xdc2626,
        emissiveIntensity: 0.75,
        roughness: 0.2,
      });
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 10), irBulbMat);
      bulb.position.set(0.22, 1.07, 0);
      bulb.userData.noCastShadow = true;
      const guardRing = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.011, 6, 18), darkSlate);
      guardRing.rotation.x = Math.PI / 2;
      guardRing.rotation.y = -0.42;
      guardRing.position.set(0.24, 1.04, 0);
      inner.add(bulb, guardRing);
      addFloorHalo(1.45, 0xff4d3d, 0.34, 0.22, 0.028, 0);
      addBulbAura(0.18, 0xff3b30, 0.46, 0.23, 1.04, 0);
      inner.scale.setScalar(0.82);
      outer.userData.smartLight = {
        kind: 'ir_lamp',
        localPos: [0.18, 0.87, 0],
        emissiveMats: [irBulbMat],
        haloMats,
        haloMaxOpacities,
      } as SmartLightMeta;
      break;
    }

    case 'magnetotherapy': {
      // Clinical PEMF Magnetotherapy Couch (top strictly y = 0.520) + Animated Sliding Solenoid Drum + Foot-Rear Console
      const magShell = new THREE.MeshStandardMaterial({
        color: 0xf4f7fa,
        bumpMap: textures.brushedMetalBump,
        bumpScale: 0.002,
        roughness: 0.24,
        metalness: 0.08,
      });
      const magSlate = new THREE.MeshStandardMaterial({
        color: 0x243244,
        bumpMap: textures.brushedMetalBump,
        bumpScale: 0.003,
        roughness: 0.38,
        metalness: 0.22,
      });
      const magChrome = new THREE.MeshStandardMaterial({
        color: 0xd4dde8,
        bumpMap: textures.brushedMetalBump,
        bumpScale: 0.002,
        roughness: 0.14,
        metalness: 0.9,
        envMapIntensity: 0.98,
      });
      const magVinyl = new THREE.MeshStandardMaterial({
        color: 0x155b78,
        bumpMap: textures.leatherBump,
        bumpScale: 0.0085,
        roughness: 0.40,
        metalness: 0.03,
      });
      const magBorder = new THREE.MeshStandardMaterial({
        color: 0x0e4157,
        bumpMap: textures.leatherBump,
        bumpScale: 0.006,
        roughness: 0.52,
        metalness: 0.05,
      });
      const magPillow = new THREE.MeshStandardMaterial({
        color: 0xeef6fa,
        bumpMap: textures.fabricWeaveBump,
        bumpScale: 0.007,
        roughness: 0.62,
      });
      const pemfCoilMat = makeMat({
        color: 0x38bdf8,
        emissive: 0x0ea5e9,
        emissiveIntensity: 0.65,
        roughness: 0.2,
      });

      // 1. Twin cantilevered aerodynamic pedestals + dark skid feet
      bevelBox(1.48, 0.044, 0.68, 0.028, 0.005, magSlate, -0.05, 0.024, 0);
      bevelBox(1.42, 0.024, 0.62, 0.024, 0.004, magChrome, -0.05, 0.054, 0);
      for (const px of [-0.46, 0.36]) {
        bevelBox(0.28, 0.31, 0.44, 0.04, 0.008, magShell, px, 0.22, 0);
        bevelBox(0.22, 0.24, 0.46, 0.02, 0.004, magSlate, px, 0.22, 0).userData.noCastShadow = true;
      }

      // 2. Ergonomic couch chassis deck & twin heavy polished chrome solenoid slide rails
      bevelBox(1.52, 0.054, 0.70, 0.036, 0.006, magShell, -0.05, 0.398, 0);
      bevelBox(1.44, 0.022, 0.64, 0.03, 0.004, magBorder, -0.05, 0.428, 0);
      for (const sz of [-0.365, 0.365]) {
        const rail = smoothCyl(0.017, 0.017, 1.50, magChrome, -0.05, 0.402, sz, 20);
        rail.rotation.z = Math.PI / 2;
        for (const bx of [-0.79, 0.69]) {
          bevelBox(0.04, 0.044, 0.044, 0.01, 0.004, magSlate, bx, 0.402, sz).userData.noCastShadow = true;
        }
      }

      // 3. Stitched medical vinyl mattress (top strictly y = 0.520) + headrest pillow (-0.60)
      bevelBox(1.44, 0.09, 0.66, 0.04, 0.014, magVinyl, -0.05, 0.475, 0);
      for (const sx of [-0.38, -0.05, 0.28]) {
        box(0.01, 0.091, 0.658, magBorder, sx, 0.475, 0).userData.receiveOnly = true;
      }
      for (const mz of [-0.326, 0.326]) {
        const bolster = smoothCyl(0.022, 0.022, 1.36, magVinyl, -0.05, 0.502, mz, 18);
        bolster.rotation.z = Math.PI / 2;
        bolster.userData.receiveOnly = true;
      }
      const mPill = bevelBox(0.24, 0.046, 0.42, 0.05, 0.014, magPillow, -0.60, 0.544, 0);
      mPill.userData.receiveOnly = true;

      // 4. Sliding Cylindrical PEMF Solenoid Aperture Drum (animated along chrome slide rails via MagnetoRigMeta)
      const solenoidGroup = new THREE.Group();
      solenoidGroup.position.set(0.22, 0, 0);
      inner.add(solenoidGroup);

      // Twin machined rail carriage shoes clamping the chrome tracks
      for (const cz of [-0.365, 0.365]) {
        const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.078, 0.058), magSlate);
        shoe.position.set(0, 0.415, cz);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.064), magChrome);
        cap.position.set(0, 0.415, cz);
        solenoidGroup.add(shoe, cap);
      }

      // Molded composite outer PEMF tunnel + aluminum rim bezels + 3 glowing copper-cyan flux rings inside
      const ringCenterY = 0.64;
      const outerSolenoid = new THREE.Mesh(
        new THREE.TorusGeometry(0.39, 0.072, 12, 24),
        magShell
      );
      outerSolenoid.rotation.y = Math.PI / 2;
      outerSolenoid.position.set(0, ringCenterY, 0);

      for (const rx of [-0.062, 0.062]) {
        const bezelRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.39, 0.018, 8, 22),
          magChrome
        );
        bezelRing.rotation.y = Math.PI / 2;
        bezelRing.position.set(rx, ringCenterY, 0);
        solenoidGroup.add(bezelRing);
      }

      const trimSolenoid = new THREE.Mesh(
        new THREE.TorusGeometry(0.42, 0.022, 8, 22),
        cyanAccent
      );
      trimSolenoid.rotation.y = Math.PI / 2;
      trimSolenoid.position.set(0, ringCenterY, 0);
      trimSolenoid.userData.sharedGlbMat = true;

      const innerLiner = new THREE.Mesh(
        new THREE.TorusGeometry(0.345, 0.042, 10, 24),
        magSlate
      );
      innerLiner.rotation.y = Math.PI / 2;
      innerLiner.position.set(0, ringCenterY, 0);

      solenoidGroup.add(outerSolenoid, trimSolenoid, innerLiner);

      for (const cx of [-0.036, 0, 0.036]) {
        const innerCoil = new THREE.Mesh(
          new THREE.TorusGeometry(0.322, 0.011, 8, 20),
          pemfCoilMat
        );
        innerCoil.rotation.y = Math.PI / 2;
        innerCoil.position.set(cx, ringCenterY, 0);
        innerCoil.userData.noCastShadow = true;
        solenoidGroup.add(innerCoil);
      }

      // Top grip arch & field telemetry LED bar on crown of drum
      const crownBadge = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.032, 0.24), magSlate);
      crownBadge.position.set(0, ringCenterY + 0.455, 0);
      const crownLed = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.012, 0.16), pemfCoilMat);
      crownLed.position.set(0, ringCenterY + 0.472, 0);
      crownLed.userData.noCastShadow = true;
      solenoidGroup.add(crownBadge, crownLed);

      // 5. Foot-Rear PEMF Gauss Generator Pedestal (+X, -Z corner -> NEVER blocks either bedside camera view!)
      const pedX = 0.84;
      const pedZ = -0.22;
      bevelBox(0.22, 0.84, 0.24, 0.026, 0.007, magShell, pedX, 0.43, pedZ);
      bevelBox(0.24, 0.04, 0.26, 0.024, 0.005, magSlate, pedX, 0.025, pedZ);
      bevelBox(0.18, 0.036, 0.20, 0.02, 0.005, cyanAccent, pedX, 0.86, pedZ);
      const pScrHead = bevelBox(0.14, 0.18, 0.20, 0.016, 0.005, magSlate, pedX - 0.03, 0.90, pedZ);
      pScrHead.rotation.z = 0.25;
      const pScr = box(
        0.018,
        0.13,
        0.155,
        makeMat({ map: textures.ecgScreen, emissive: 0x38bdf8, emissiveIntensity: 0.48 }),
        pedX - 0.095,
        0.915,
        pedZ
      );
      pScr.rotation.z = 0.25;
      pScr.userData.noCastShadow = true;
      smoothCyl(0.018, 0.02, 0.02, magChrome, pedX - 0.105, 0.72, pedZ + 0.04, 16).rotation.z = Math.PI / 2;
      tube(
        [[pedX - 0.08, 0.48, pedZ], [0.72, 0.34, pedZ], [0.58, 0.36, -0.14]],
        0.014,
        blackRubber,
        8
      );

      outer.userData.magnetoRig = {
        solenoidRing: solenoidGroup,
        coilMat: pemfCoilMat,
        currentX: 0.22,
      } as MagnetoRigMeta;
      break;
    }

    case 'tilt_table': {
      // Neurorehabilitation Electric Standing Tilt Table (top strictly y = 0.520 when flat horizontal for seating)
      const ttSteel = new THREE.MeshStandardMaterial({
        color: 0xe6ecf2,
        bumpMap: textures.brushedMetalBump,
        bumpScale: 0.0025,
        roughness: 0.28,
        metalness: 0.24,
      });
      const ttSlate = new THREE.MeshStandardMaterial({
        color: 0x263445,
        bumpMap: textures.brushedMetalBump,
        bumpScale: 0.003,
        roughness: 0.38,
        metalness: 0.24,
      });
      const ttChrome = new THREE.MeshStandardMaterial({
        color: 0xd4dde8,
        bumpMap: textures.brushedMetalBump,
        bumpScale: 0.002,
        roughness: 0.16,
        metalness: 0.88,
        envMapIntensity: 0.96,
      });
      const ttVinyl = new THREE.MeshStandardMaterial({
        color: 0x166982,
        bumpMap: textures.leatherBump,
        bumpScale: 0.0085,
        roughness: 0.40,
        metalness: 0.03,
      });
      const ttBorder = new THREE.MeshStandardMaterial({
        color: 0x0f4c5c,
        bumpMap: textures.leatherBump,
        bumpScale: 0.006,
        roughness: 0.52,
        metalness: 0.05,
      });
      const ttPillow = new THREE.MeshStandardMaterial({
        color: 0xeaf4f8,
        bumpMap: textures.fabricWeaveBump,
        bumpScale: 0.007,
        roughness: 0.62,
      });

      // 1. Heavy steel H-base + 4 locking medical casters
      for (const bz of [-0.26, 0.26]) {
        bevelBox(1.46, 0.046, 0.076, 0.016, 0.005, ttSteel, 0, 0.112, bz);
      }
      for (const cxPos of [-0.64, 0.64]) {
        bevelBox(0.086, 0.05, 0.58, 0.018, 0.005, ttSteel, cxPos, 0.115, 0);
        for (const czPos of [-0.29, 0.29]) {
          smoothCyl(0.02, 0.024, 0.034, ttChrome, cxPos, 0.082, czPos, 18);
          const wheel = smoothCyl(0.044, 0.044, 0.032, blackRubber, cxPos, 0.044, czPos, 22);
          wheel.rotation.x = Math.PI / 2;
          const hub = smoothCyl(0.022, 0.022, 0.035, ttChrome, cxPos, 0.044, czPos, 18);
          hub.rotation.x = Math.PI / 2;
          hub.userData.noCastShadow = true;
          const brake = bevelBox(
            0.032,
            0.012,
            0.016,
            0.004,
            0.002,
            cxPos > 0 ? emeraldAccent : redAccent,
            cxPos + (cxPos > 0 ? 0.04 : -0.04),
            0.082,
            czPos
          );
          brake.rotation.z = cxPos > 0 ? -0.25 : 0.25;
          brake.userData.noCastShadow = true;
        }
      }

      // 2. Central heavy electric pedestal column + articulated hydraulic tilt ram
      bevelBox(0.32, 0.30, 0.34, 0.024, 0.007, ttSlate, -0.06, 0.26, 0);
      bevelBox(0.24, 0.12, 0.28, 0.018, 0.005, ttChrome, -0.06, 0.34, 0);
      const ram = smoothCyl(0.032, 0.036, 0.44, ttChrome, 0.16, 0.42, 0, 20);
      ram.rotation.z = -0.28;

      // 3. Articulated Tilting Plinth Group
      // Default rest pose: tilted (~28 deg) so shop thumbnail / unoccupied silhouette is unmistakably a tilt table;
      // smoothly lowers flat horizontal (y = 0.45, rotZ = 0 => mattress top strictly 0.520) whenever a patient sits/exams!
      const tiltGroup = new THREE.Group();
      tiltGroup.position.set(0, 0.67, 0);
      tiltGroup.rotation.z = -0.5;
      inner.add(tiltGroup);

      const tDeck = bevelBox(1.58, 0.044, 0.68, 0.03, 0.006, ttSteel, 0, -0.022, 0);
      const tDeckRim = bevelBox(1.52, 0.02, 0.64, 0.026, 0.004, ttBorder, 0, -0.004, 0);
      // Upholstered mattress pad: y = +0.035, h = 0.07 -> top = +0.070 => world 0.45 + 0.070 = 0.520 when flat!
      const tPad = bevelBox(1.52, 0.07, 0.66, 0.036, 0.012, ttVinyl, -0.01, 0.035, 0);
      const tSeamA = box(0.01, 0.072, 0.658, ttBorder, -0.32, 0.035, 0);
      tSeamA.userData.receiveOnly = true;
      const tSeamB = box(0.01, 0.072, 0.658, ttBorder, 0.26, 0.035, 0);
      tSeamB.userData.receiveOnly = true;

      const tPill = bevelBox(0.23, 0.044, 0.42, 0.05, 0.014, ttPillow, -0.61, 0.092, 0);
      tPill.userData.receiveOnly = true;

      // Perpendicular steel & textured rubber anti-slip footboard at +X
      const footBoard = bevelBox(0.055, 0.28, 0.62, 0.016, 0.005, ttSlate, 0.77, 0.145, 0);
      const footGrip = bevelBox(0.018, 0.24, 0.56, 0.01, 0.003, blackRubber, 0.742, 0.145, 0);
      footGrip.userData.receiveOnly = true;
      const footTrim = bevelBox(0.06, 0.032, 0.64, 0.012, 0.004, cyanAccent, 0.77, 0.292, 0);

      // Bilateral split hand-grip handles flanking upper torso & leg zones (leaves central x=-0.22..+0.22 open for ergonomic sitting!)
      tiltGroup.add(tDeck, tDeckRim, tPad, tSeamA, tSeamB, tPill, footBoard, footGrip, footTrim);
      for (const gz of [-0.355, 0.355]) {
        for (const [gx, len] of [
          [-0.44, 0.34],
          [0.42, 0.36],
        ] as Array<[number, number]>) {
          const handle = smoothCyl(0.014, 0.014, len, ttChrome, gx, 0.082, gz, 16);
          handle.rotation.z = Math.PI / 2;
          const postA = smoothCyl(0.011, 0.011, 0.09, ttSlate, gx - len * 0.42, 0.035, gz, 12);
          const postB = smoothCyl(0.011, 0.011, 0.09, ttSlate, gx + len * 0.42, 0.035, gz, 12);
          tiltGroup.add(handle, postA, postB);
        }
        // Lateral mechanical tilt-angle inclinometer dial plate
        const dial = smoothCyl(0.034, 0.034, 0.016, whiteBody, -0.05, -0.018, gz * 0.96, 20);
        dial.rotation.x = Math.PI / 2;
        dial.userData.sharedGlbMat = true;
        dial.userData.noCastShadow = true;
        const dialBezel = smoothCyl(0.038, 0.038, 0.012, ttChrome, -0.05, -0.018, gz * 0.95, 20);
        dialBezel.rotation.x = Math.PI / 2;
        dialBezel.userData.noCastShadow = true;
        tiltGroup.add(dial, dialBezel);
      }

      // Thoracic, pelvic & knee Velcro restraint straps (visible when standing-tilted during therapy, hidden when flat/seated)
      const strapsGroup = new THREE.Group();
      for (const [sx, w] of [
        [-0.25, 0.13],
        [0.04, 0.12],
        [0.36, 0.12],
      ] as Array<[number, number]>) {
        const band = bevelBox(w, 0.105, 0.69, 0.014, 0.005, cyanAccent, sx, 0.042, 0);
        const buckle = bevelBox(0.06, 0.04, 0.08, 0.008, 0.003, ttSlate, sx, 0.105, 0.14);
        strapsGroup.add(band, buckle);
      }
      tiltGroup.add(strapsGroup);

      outer.userData.tiltTableRig = {
        tiltGroup,
        strapsGroup,
        ramMesh: ram,
        currentTiltAlpha: 1,
      } as TiltTableRigMeta;
      break;
    }

    case 'multi_gym_pulley': {
      // Clinical Cable Column Pulley Machine (1x1) with iron weight stack, yellow pin, pulley sheaves & D-handles
      box(0.58, 0.05, 0.66, darkSlate, 0, 0.025, 0);
      box(0.32, 0.03, 0.42, blackRubber, 0, 0.05, 0.14);
      // Twin upright steel frame rails + top boom
      box(0.055, 1.78, 0.07, silverMetal, -0.22, 0.92, -0.18);
      box(0.055, 1.78, 0.07, silverMetal, 0.22, 0.92, -0.18);
      box(0.52, 0.07, 0.42, darkSlate, 0, 1.82, -0.04);
      // 8 Iron resistance weight stack plates + chrome center rod + yellow pin
      cyl(0.014, 0.014, 1.5, silverMetal, 0, 0.92, -0.18);
      for (let wi = 0; wi < 8; wi++) {
        box(0.32, 0.055, 0.16, darkSlate, 0, 0.14 + wi * 0.072, -0.18);
      }
      box(0.05, 0.025, 0.04, amberAccent, 0.02, 0.43, -0.09);
      // Adjustable front chrome pulley carriage + top pulley wheel
      cyl(0.055, 0.055, 0.025, blackRubber, 0, 1.76, 0.11).rotation.z = Math.PI / 2;
      box(0.12, 0.14, 0.12, cyanAccent, 0, 1.06, -0.12);
      // Curved steel cables + twin chrome stirrup D-handles
      tube([[0, 1.76, 0.11], [-0.08, 1.48, 0.14], [-0.14, 1.24, 0.17], [-0.15, 1.08, 0.18]], 0.006, blackRubber, 8);
      tube([[0, 1.76, 0.11], [0.08, 1.48, 0.14], [0.14, 1.24, 0.17], [0.15, 1.08, 0.18]], 0.006, blackRubber, 8);
      box(0.09, 0.02, 0.025, silverMetal, -0.15, 1.04, 0.18);
      box(0.09, 0.02, 0.025, silverMetal, 0.15, 1.04, 0.18);
      inner.scale.set(0.9, 0.86, 0.9);
      break;
    }

    case 'hand_rehab_table': {
      // Occupational / Hand Therapy Desk (1x1) with Pegboard, TheraPutty Jars, Jamar Grip Dynamometer & Web
      box(0.76, 0.05, 0.56, darkSlate, 0, 0.03, -0.04);
      for (const lx of [-0.32, 0.32]) {
        cyl(0.025, 0.025, 0.68, silverMetal, lx, 0.37, -0.16);
      }
      box(0.84, 0.045, 0.62, woodMat, 0, 0.72, 0);
      // Left: Wooden 9-Hole Dexterity Pegboard + colored upright pegs
      box(0.24, 0.035, 0.24, warmTimber, -0.22, 0.76, 0.05);
      const pegColors = [0xdc2626, 0x0284c7, 0x10b981, 0xf59e0b];
      for (let pi = 0; pi < 4; pi++) {
        cyl(
          0.011,
          0.011,
          0.065,
          makeMat({ color: pegColors[pi], roughness: 0.35 }),
          -0.27 + (pi % 2) * 0.09,
          0.8,
          (pi < 2 ? -0.02 : 0.08) + 0.03
        );
      }
      // Center-Back: Emerald & Blue TheraPutty Resistance Containers
      cyl(0.055, 0.055, 0.06, whiteBody, 0.03, 0.775, -0.14);
      cyl(0.048, 0.048, 0.02, emeraldAccent, 0.03, 0.805, -0.14);
      cyl(0.055, 0.055, 0.06, whiteBody, 0.17, 0.775, -0.14);
      cyl(0.048, 0.048, 0.02, cyanAccent, 0.17, 0.805, -0.14);
      // Right-Front: Jamar Hydraulic Hand Grip Dynamometer + circular gauge dial + yellow wrist web ring
      box(0.05, 0.035, 0.18, silverMetal, 0.22, 0.76, 0.1);
      cyl(0.045, 0.045, 0.025, redAccent, 0.22, 0.79, 0.02);
      const webRing = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.015, 6, 16), amberAccent);
      webRing.rotation.x = Math.PI / 2;
      webRing.position.set(0.02, 0.76, 0.12);
      inner.add(webRing);
      inner.scale.setScalar(0.84);
      break;
    }

    case 'pt_toolkit_cart': {
      // 3-Tier Stainless Clinical PT Manual & Assessment Cart (Goniometer, Reflex Hammer, IASTM Blades, Massage Gun, KT Tape)
      for (const lx of [-0.22, 0.22]) {
        for (const lz of [-0.18, 0.18]) {
          cyl(0.032, 0.032, 0.05, blackRubber, lx, 0.025, lz);
          cyl(0.016, 0.016, 0.84, silverMetal, lx, 0.45, lz);
        }
      }
      // Three brushed stainless trays (bottom, middle, top) + chrome push handle
      for (const ty of [0.1, 0.46, 0.8]) {
        box(0.52, 0.035, 0.42, silverMetal, 0, ty, 0);
        box(0.46, 0.015, 0.36, whiteBody, 0, ty + 0.022, 0);
      }
      cyl(0.016, 0.016, 0.4, silverMetal, 0.24, 0.9, 0).rotation.x = Math.PI / 2;
      // Top Tray: Goniometer (clear cyan ring + rulers), Taylor Reflex Hammer, 2 IASTM Blades, Percussion Massage Gun
      const gonioRing = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.008, 6, 16), cyanAccent);
      gonioRing.rotation.x = Math.PI / 2;
      gonioRing.position.set(-0.14, 0.835, 0.08);
      inner.add(gonioRing);
      box(0.14, 0.008, 0.022, cyanAccent, -0.07, 0.835, 0.08);
      // Taylor Reflex Hammer
      cyl(0.008, 0.008, 0.16, silverMetal, -0.1, 0.835, -0.08).rotation.z = Math.PI / 2;
      box(0.04, 0.018, 0.06, redAccent, -0.02, 0.84, -0.08);
      // Polished stainless IASTM / Graston myofascial tools
      box(0.12, 0.012, 0.045, silverMetal, 0.08, 0.835, 0.1);
      box(0.1, 0.012, 0.035, silverMetal, 0.1, 0.835, 0.03);
      // Percussion Massage Gun docked on right rear corner
      cyl(0.032, 0.035, 0.05, darkSlate, 0.14, 0.85, -0.08);
      cyl(0.022, 0.02, 0.16, darkSlate, 0.14, 0.93, -0.08);
      const gunBarrel = cyl(0.03, 0.026, 0.15, cyanAccent, 0.11, 1.01, -0.08);
      gunBarrel.rotation.z = Math.PI / 2;
      // Mid Tray: Kinesio Tape (KT) cobalt & coral rolls + massage lotion pump bottle
      cyl(0.042, 0.042, 0.055, blueUpholstery, -0.12, 0.5, 0.06);
      cyl(0.042, 0.042, 0.055, redAccent, -0.01, 0.5, 0.06);
      cyl(0.035, 0.035, 0.14, whiteBody, 0.14, 0.54, -0.06);
      // Bottom Tray: Foam Myofascial Roller + Folded Clinical Towel
      const fRoller = cyl(0.055, 0.055, 0.34, cyanAccent, -0.06, 0.18, 0);
      fRoller.rotation.x = Math.PI / 2;
      box(0.16, 0.06, 0.24, blueUpholstery, 0.12, 0.16, 0);
      inner.scale.setScalar(0.81);
      break;
    }

    // ================ BUILD & ARCHITECTURAL DIVIDERS ================

    case 'partition_wall': {
      box(0.12, 1.15, 0.86, whiteBody, 0, 0.575, 0);
      const pGlass = box(0.06, 0.78, 0.72, frostGlassMat, 0, 0.65, 0);
      pGlass.userData.noCastShadow = true;
      break;
    }

    case 'privacy_screen': {
      // 3-panel folding chrome medical privacy curtain screen on swivel feet with woven curtain fabric
      const screenClothMat = new THREE.MeshStandardMaterial({
        color: 0x3882a6,
        bumpMap: textures.fabricWeaveBump,
        bumpScale: 0.01,
        roughness: 0.86,
      });
      for (const lz of [-0.36, 0, 0.36]) {
        box(0.16, 0.032, 0.055, silverMetal, 0, 0.034, lz);
        for (const cx of [-0.06, 0.06]) {
          cyl(0.018, 0.018, 0.022, blackRubber, cx, 0.012, lz);
        }
      }
      const panels = [
        { x: -0.04, z: -0.27, rotY: 0.22 },
        { x: 0.04, z: 0, rotY: -0.22 },
        { x: -0.04, z: 0.27, rotY: 0.22 },
      ];
      for (const p of panels) {
        const g = new THREE.Group();
        g.position.set(p.x, 0, p.z);
        g.rotation.y = p.rotY;
        const fr = new THREE.Mesh(new THREE.BoxGeometry(0.034, 1.48, 0.28), silverMetal);
        fr.position.y = 0.82;
        fr.userData.sharedGlbMat = true;
        const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.042, 1.24, 0.24), screenClothMat);
        cloth.position.y = 0.86;
        g.add(fr, cloth);
        inner.add(g);
      }
      inner.scale.set(1, 0.9, 1);
      break;
    }

    case 'wood_slat_divider': {
      // Modern architectural oak vertical louver screen
      box(0.16, 0.08, 0.86, darkSlate, 0, 0.04, 0);
      box(0.16, 0.06, 0.86, darkSlate, 0, 1.62, 0);
      for (let i = 0; i < 6; i++) {
        box(0.11, 1.54, 0.065, warmTimber, 0, 0.85, -0.35 + i * 0.14);
      }
      inner.scale.set(1, 0.91, 1);
      break;
    }

    case 'sanitizing_kiosk': {
      // Touchless clinical hand hygiene pedestal with backlit LCD & blue gel tank
      cyl(0.19, 0.22, 0.05, darkSlate, 0, 0.025, 0);
      box(0.18, 1.08, 0.14, whiteBody, 0, 0.58, -0.02);
      box(0.22, 0.34, 0.18, cyanAccent, 0, 1.12, 0.01);
      // Blue gel window + chrome automatic dispenser spout + drip tray
      box(0.08, 0.18, 0.04, makeMat({ color: 0x38bdf8, roughness: 0.2 }), 0, 1.14, 0.1);
      box(0.06, 0.04, 0.08, silverMetal, 0, 1.0, 0.12);
      box(0.18, 0.03, 0.14, silverMetal, 0, 0.82, 0.11);
      inner.scale.setScalar(0.8);
      break;
    }

    case 'arch_pergola': {
      // Romantic cedar courtyard arbor (1x2) with limestone plinths, climbing botanical roses & twin lanterns
      const roseCardG = new THREE.PlaneGeometry(0.56, 0.56);
      const pergolaGlowMat = makeMat({
        color: 0xfef3c7,
        emissive: 0xfbbf24,
        emissiveIntensity: 0.14,
        roughness: 0.22,
      });
      for (const pz of [-0.78, 0.78]) {
        box(0.36, 0.14, 0.36, travertineMat, 0, 0.07, pz);
        box(0.3, 0.06, 0.3, darkSlate, 0, 0.17, pz);
        box(0.14, 2.18, 0.14, woodMat, 0, 1.28, pz);
        // Sculpted cedar knee-brace
        const brace = box(0.08, 0.38, 0.08, woodMat, 0, 2.08, pz + (pz < 0 ? 0.16 : -0.16));
        brace.rotation.x = pz < 0 ? 0.75 : -0.75;
        // Lush botanical rose & foliage climbing clusters
        for (let k = 0; k < 5; k++) {
          const cy = 0.56 + k * 0.38;
          for (let ci = 0; ci < 2; ci++) {
            const card = new THREE.Mesh(roseCardG, roseCardMat);
            card.position.set(
              (ci === 0 ? 0.05 : -0.05),
              cy,
              pz + (pz < 0 ? 0.05 : -0.05)
            );
            card.rotation.set(0.18, k * 1.1 + ci * 1.4, (k % 2 === 0 ? 0.2 : -0.2));
            card.scale.setScalar(0.85 + (k % 2) * 0.18);
            card.userData.sharedGlbMat = true;
            inner.add(card);
          }
        }
      }
      // Overhead sculpted main crossbeams & scalloped pergola rafters
      box(0.24, 0.13, 2.04, woodMat, 0, 2.4, 0);
      for (const rx of [-0.28, -0.14, 0, 0.14, 0.28]) {
        box(0.07, 0.1, 2.1, warmTimber, rx, 2.5, 0);
      }
      // Twin hanging warm brass lanterns
      for (const lz of [-0.42, 0.42]) {
        cyl(0.012, 0.012, 0.22, darkSlate, 0, 2.26, lz);
        cyl(0.075, 0.045, 0.04, darkSlate, 0, 2.15, lz);
        const bulb = cyl(0.058, 0.068, 0.14, pergolaGlowMat, 0, 2.06, lz);
        bulb.userData.noCastShadow = true;
        addBulbAura(0.19, 0xffe4a8, 0.32, 0, 2.06, lz);
      }
      addFloorHalo(2.4, 0xffd584, 0.38, 0, 0.026, 0);
      outer.userData.smartLight = {
        kind: 'garden_lamp',
        localPos: [0, 2.1, 0],
        emissiveMats: [pergolaGlowMat],
        haloMats,
        haloMaxOpacities,
      } as SmartLightMeta;
      break;
    }

    // ================ DECOR & GUARANTEED-ILLUMINATING SMART LIGHTS ================

    case 'potted_plant': {
      // Glazed terracotta saucer base
      cyl(0.22, 0.19, 0.035, ceramicPot, 0, 0.018, 0);
      const glbPlant =
        glbRegistry.cloneNormalized('furn_plant_ficus', {
          maxFootprint: { w: 0.6, d: 0.6 },
          targetHeight: 0.84,
        }) ||
        glbRegistry.cloneNormalized('furn_plant1', {
          maxFootprint: { w: 0.56, d: 0.56 },
          targetHeight: 0.78,
        });
      if (glbPlant) {
        glbPlant.position.y = 0.02;
        inner.add(glbPlant);
      }
      break;
    }

    case 'park_bench': {
      // Sculpted cast-iron & warm teakwood courtyard bench (slatted contoured profile + scroll armrests)
      const brassTrim = makeMat({ color: 0xc59b49, roughness: 0.3, metalness: 0.82 });
      for (const lz of [-0.72, 0.72]) {
        // Flared cast-iron front & rear legs
        box(0.055, 0.36, 0.055, darkSlate, 0.19, 0.18, lz);
        box(0.055, 0.4, 0.055, darkSlate, -0.17, 0.2, lz);
        box(0.42, 0.048, 0.055, darkSlate, 0.01, 0.34, lz);
        // Sculpted curved armrest
        tube(
          [
            [-0.2, 0.72, lz],
            [-0.08, 0.54, lz],
            [0.14, 0.54, lz],
            [0.21, 0.48, lz],
            [0.19, 0.35, lz],
          ],
          0.024,
          darkSlate,
          10
        );
        // Backrest upright support bar
        const backPost = box(0.045, 0.46, 0.045, darkSlate, -0.22, 0.55, lz);
        backPost.rotation.z = 0.22;
      }
      // Center steel under-seat stiffener
      box(0.36, 0.04, 0.04, darkSlate, 0.02, 0.33, 0);
      // 4 Individual beveled teakwood seat slats + front bullnose slat
      for (let s = 0; s < 4; s++) {
        box(0.095, 0.036, 1.56, woodMat, -0.12 + s * 0.11, 0.378 - (s === 0 ? 0.01 : 0), 0);
      }
      // 3 Individual reclined teakwood backrest slats + decorative brass rivets
      for (let b = 0; b < 3; b++) {
        const slat = box(0.036, 0.105, 1.56, woodMat, -0.18 - b * 0.03, 0.5 + b * 0.125, 0);
        slat.rotation.z = 0.22;
      }
      for (const lz of [-0.72, 0.72]) {
        cyl(0.022, 0.022, 0.06, brassTrim, 0.15, 0.54, lz);
      }
      break;
    }

    case 'garden_lamp': {
      // Modern architectural dark-slate louvered bollard with glowing frosted diffuser core
      box(0.24, 0.06, 0.24, travertineMat, 0, 0.03, 0);
      cyl(0.082, 0.096, 0.58, darkSlate, 0, 0.35, 0);
      const lampGlowMat = makeMat({
        color: 0xfde68a,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.12,
        roughness: 0.22,
      });
      const lampCore = cyl(0.068, 0.068, 0.22, lampGlowMat, 0, 0.75, 0);
      lampCore.userData.noCastShadow = true;
      // 3 Architectural anti-glare horizontal louver rings
      for (let li = 0; li < 3; li++) {
        const ring = cyl(0.092, 0.092, 0.018, darkSlate, 0, 0.67 + li * 0.065, 0);
        ring.userData.sharedGlbMat = true;
      }
      cyl(0.095, 0.115, 0.055, darkSlate, 0, 0.89, 0);
      addFloorHalo(2.45, 0xffcc78, 0.48, 0, 0.026, 0);
      addBulbAura(0.24, 0xffd584, 0.36, 0, 0.76, 0);
      inner.scale.setScalar(0.85);
      outer.userData.smartLight = {
        kind: 'garden_lamp',
        localPos: [0, 0.78, 0],
        emissiveMats: [lampGlowMat],
        haloMats,
        haloMaxOpacities,
      } as SmartLightMeta;
      break;
    }

    case 'garden_spot_lamp': {
      // Classic fluted cast-iron twin-lantern garden post with brass collars & glowing glass globes
      const brassMat = makeMat({ color: 0xc59b49, roughness: 0.3, metalness: 0.82 });
      cyl(0.18, 0.22, 0.14, travertineMat, 0, 0.07, 0);
      cyl(0.08, 0.12, 0.28, darkSlate, 0, 0.28, 0);
      cyl(0.044, 0.062, 1.48, darkSlate, 0, 1.12, 0);
      cyl(0.07, 0.07, 0.06, brassMat, 0, 1.84, 0);
      // Curved ornate cross-arms
      tube(
        [
          [-0.27, 1.94, 0],
          [-0.14, 1.82, 0],
          [0, 1.84, 0],
          [0.14, 1.82, 0],
          [0.27, 1.94, 0],
        ],
        0.024,
        darkSlate,
        12
      );
      const twinGlowMat = makeMat({
        color: 0xfef08a,
        emissive: 0xfbbf24,
        emissiveIntensity: 0.14,
        roughness: 0.2,
      });
      for (const gx of [-0.27, 0.27]) {
        cyl(0.056, 0.036, 0.06, brassMat, gx, 1.96, 0);
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 12), twinGlowMat);
        orb.position.set(gx, 2.08, 0);
        orb.userData.noCastShadow = true;
        inner.add(orb);
        // Decorative cap finial
        cyl(0.012, 0.09, 0.065, darkSlate, gx, 2.22, 0);
        addBulbAura(0.24, 0xffe29a, 0.36, gx, 2.08, 0);
      }
      addFloorHalo(3.25, 0xffd282, 0.56, 0, 0.026, 0);
      outer.userData.smartLight = {
        kind: 'garden_lamp',
        localPos: [0, 2.1, 0],
        emissiveMats: [twinGlowMat],
        haloMats,
        haloMaxOpacities,
      } as SmartLightMeta;
      break;
    }

    case 'clinic_floor_lamp': {
      const glbLamp = glbRegistry.cloneNormalized('furn_lamp_floor', {
        maxFootprint: { w: 0.54, d: 0.54 },
        targetHeight: 1.44,
      });
      const bulbMat = makeMat({
        color: 0xfef3c7,
        emissive: 0xfbbf24,
        emissiveIntensity: 0.1,
        roughness: 0.25,
      });
      if (glbLamp) {
        inner.add(glbLamp);
        const bulb = cyl(0.08, 0.105, 0.14, bulbMat, 0, 1.26, 0);
        bulb.userData.noCastShadow = true;
      }
      addFloorHalo(2.35, 0xffe4b3, 0.45, 0, 0.026, 0);
      addBulbAura(0.25, 0xffe8bf, 0.32, 0, 1.28, 0);
      outer.userData.smartLight = {
        kind: 'indoor_lamp',
        localPos: [0, 1.33, 0],
        emissiveMats: [bulbMat],
        haloMats,
        haloMaxOpacities,
      } as SmartLightMeta;
      break;
    }

    case 'wall_sconce_lamp': {
      const glbWallLamp = glbRegistry.cloneNormalized('furn_lamp_wall', {
        maxFootprint: { w: 0.42, d: 0.42 },
        targetHeight: 0.42,
        rotY: Math.PI / 2,
      });
      const sconceMat = makeMat({
        color: 0xfef3c7,
        emissive: 0xfbbf24,
        emissiveIntensity: 0.12,
        roughness: 0.24,
      });
      // Backplane anchored flush at local x = -0.40 (interior partition face; ClinicCanvas shifts +0.05 on thick outer walls)
      if (glbWallLamp) {
        glbWallLamp.position.set(-0.34, 1.38, 0);
        inner.add(glbWallLamp);
      }
      const glassShade = cyl(0.065, 0.085, 0.18, sconceMat, -0.28, 1.5, 0);
      glassShade.userData.noCastShadow = true;
      addWallWash(1.25, 1.45, 0xffd79e, 0.5, -0.372, 0.88, 0, Math.PI / 2);
      addFloorHalo(1.95, 0xffd79e, 0.36, -0.08, 0.026, 0);
      addBulbAura(0.18, 0xffe5b4, 0.34, -0.28, 1.5, 0);
      outer.userData.smartLight = {
        kind: 'wall_lamp',
        localPos: [-0.2, 1.5, 0],
        emissiveMats: [sconceMat],
        haloMats,
        haloMaxOpacities,
      } as SmartLightMeta;
      break;
    }

    case 'table_lamp': {
      // Round walnut side table topped with a glowing warm desk/bedside shade lamp
      for (let i = 0; i < 3; i++) {
        const ang = (i / 3) * Math.PI * 2 + 0.4;
        cyl(0.024, 0.018, 0.46, warmTimber, Math.sin(ang) * 0.16, 0.23, Math.cos(ang) * 0.16);
      }
      cyl(0.24, 0.24, 0.045, warmTimber, 0, 0.47, 0);
      const glbDeskLamp = glbRegistry.cloneNormalized('furn_lamp_desk', {
        maxFootprint: { w: 0.34, d: 0.34 },
        targetHeight: 0.42,
      });
      const tableGlowMat = makeMat({
        color: 0xfef3c7,
        emissive: 0xfbbf24,
        emissiveIntensity: 0.12,
        roughness: 0.28,
      });
      if (glbDeskLamp) {
        glbDeskLamp.position.set(0, 0.49, 0);
        inner.add(glbDeskLamp);
        const core = cyl(0.07, 0.09, 0.12, tableGlowMat, 0, 0.78, 0);
        core.userData.noCastShadow = true;
      }
      addFloorHalo(2.15, 0xffe2ad, 0.4, 0, 0.026, 0);
      addBulbAura(0.21, 0xffe9be, 0.34, 0, 0.78, 0);
      inner.scale.setScalar(0.84);
      outer.userData.smartLight = {
        kind: 'indoor_lamp',
        localPos: [0, 0.71, 0],
        emissiveMats: [tableGlowMat],
        haloMats,
        haloMaxOpacities,
      } as SmartLightMeta;
      break;
    }

    case 'street_lamp_post': {
      // Sleek architectural tapered steel streetlamp with curved gooseneck arm & bright optic diffuser
      cyl(0.16, 0.2, 0.14, travertineMat, -0.08, 0.07, 0);
      cyl(0.065, 0.095, 0.42, darkSlate, -0.08, 0.34, 0);
      cyl(0.038, 0.062, 2.1, darkSlate, -0.08, 1.56, 0);
      tube(
        [
          [-0.08, 2.58, 0],
          [-0.04, 2.86, 0],
          [0.14, 2.96, 0],
          [0.3, 2.92, 0],
        ],
        0.032,
        darkSlate,
        12
      );
      const headGlowMat = makeMat({
        color: 0xfef08a,
        emissive: 0xffc864,
        emissiveIntensity: 0.14,
        roughness: 0.2,
      });
      box(0.3, 0.06, 0.18, darkSlate, 0.28, 2.91, 0);
      const bulb = box(0.24, 0.04, 0.14, headGlowMat, 0.28, 2.87, 0);
      bulb.userData.noCastShadow = true;
      addFloorHalo(3.85, 0xffd488, 0.58, 0.25, 0.026, 0);
      addBulbAura(0.32, 0xffdf9a, 0.4, 0.28, 2.86, 0);
      outer.userData.smartLight = {
        kind: 'street_lamp',
        localPos: [0.3, 2.82, 0],
        emissiveMats: [headGlowMat],
        haloMats,
        haloMaxOpacities,
      } as SmartLightMeta;
      break;
    }

    case 'flower_bed': {
      // Sculpted beveled limestone & cedar courtyard planter with trailing greens, rose cards, and multi-height blooms
      box(0.88, 0.06, 0.88, travertineMat, 0, 0.03, 0);
      box(0.82, 0.12, 0.82, travertineMat, 0, 0.08, 0);
      box(0.74, 0.08, 0.74, woodMat, 0, 0.15, 0);
      box(0.66, 0.17, 0.66, soilMat, 0, 0.12, 0);

      const roseCardG = new THREE.PlaneGeometry(0.48, 0.44);
      for (let ci = 0; ci < 5; ci++) {
        const card = new THREE.Mesh(roseCardG, roseCardMat);
        const ang = (ci / 5) * Math.PI * 2 + 0.4;
        const rad = ci === 4 ? 0.02 : 0.12;
        card.position.set(Math.cos(ang) * rad, 0.31 + (ci === 4 ? 0.08 : 0), Math.sin(ang) * rad);
        card.rotation.set(0.2, ang, 0);
        card.userData.sharedGlbMat = true;
        inner.add(card);
      }

      const petalColors = [0xe11d48, 0xf59e0b, 0xc026d3, 0xfff1f2, 0xf97316, 0xfb7185];
      const stemG = new THREE.CylinderGeometry(0.008, 0.011, 0.22, 5);
      const leafG = new THREE.ConeGeometry(0.048, 0.17, 4);
      const petalG = new THREE.SphereGeometry(0.032, 6, 4);
      const centerMat = makeMat({ color: 0xfbbf24, roughness: 0.45 });
      for (let i = 0; i < 9; i++) {
        const ang = (i / 8) * Math.PI * 2 + 0.2;
        const rad = i === 8 ? 0.02 : i % 2 === 0 ? 0.22 : 0.12;
        const fx = i === 8 ? 0 : Math.cos(ang) * rad;
        const fz = i === 8 ? 0 : Math.sin(ang) * rad;
        const hOff = i === 8 ? 0.09 : i % 2 === 0 ? 0 : 0.055;
        for (let li = 0; li < 3; li++) {
          const la = (li / 3) * Math.PI * 2 + i;
          const lf = new THREE.Mesh(leafG, leafGreen);
          lf.position.set(fx + Math.cos(la) * 0.05, 0.22, fz + Math.sin(la) * 0.05);
          lf.rotation.z = -Math.cos(la) * 0.92;
          lf.rotation.x = Math.sin(la) * 0.92;
          lf.scale.set(0.95, 1, 0.35);
          lf.userData.sharedGlbMat = true;
          inner.add(lf);
        }
        const st = new THREE.Mesh(stemG, leafGreen);
        st.position.set(fx, 0.28 + hOff * 0.5, fz);
        st.userData.sharedGlbMat = true;
        inner.add(st);
        const pMat = makeMat({ color: petalColors[i % petalColors.length], roughness: 0.5 });
        for (let pi = 0; pi < 5; pi++) {
          const pa = (pi / 5) * Math.PI * 2;
          const pet = new THREE.Mesh(petalG, pMat);
          pet.scale.set(1.3, 0.45, 0.9);
          pet.position.set(fx + Math.cos(pa) * 0.032, 0.38 + hOff, fz + Math.sin(pa) * 0.032);
          pet.rotation.y = -pa;
          inner.add(pet);
        }
        const ctr = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.016, 7), centerMat);
        ctr.position.set(fx, 0.392 + hOff, fz);
        inner.add(ctr);
      }
      break;
    }

    case 'outdoor_tree': {
      // High-craft botanical flowering courtyard tree (carved stone pit + curved gnarled spline bark trunk + organic boughs + blossom cards)
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.058, 8, 20), travertineMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.048;
      ring.userData.sharedGlbMat = true;
      inner.add(ring);
      cyl(0.34, 0.36, 0.06, soilMat, 0, 0.03, 0);

      // Curved natural spline main trunk + 4 buttress root flares
      tube(
        [
          [0, 0.02, 0],
          [-0.035, 0.52, 0.025],
          [0.02, 1.04, -0.02],
          [0.01, 1.42, 0.01],
        ],
        0.105,
        barkMat,
        10
      );
      for (let ri = 0; ri < 4; ri++) {
        const ra = (ri / 4) * Math.PI * 2 + 0.35;
        const rf = cyl(0.034, 0.078, 0.4, barkMat, Math.cos(ra) * 0.13, 0.14, Math.sin(ra) * 0.13);
        rf.rotation.z = -Math.cos(ra) * 0.58;
        rf.rotation.x = Math.sin(ra) * 0.58;
      }

      const shadeLeafMat = makeMat({ color: 0x254f1c, roughness: 0.92 });
      const crownCoreG = new THREE.DodecahedronGeometry(0.35, 1);
      const cardG = new THREE.PlaneGeometry(0.96, 0.96);

      // 5 diverging curved botanical boughs + inner shaded canopy + crossed blossom leaf cards
      const boughs = [
        { ang: 0.2, h: 1.88, r: 0.46 },
        { ang: 1.45, h: 1.98, r: 0.42 },
        { ang: 2.7, h: 1.84, r: 0.48 },
        { ang: 3.95, h: 2.02, r: 0.4 },
        { ang: 5.2, h: 1.92, r: 0.45 },
      ];
      for (const bg of boughs) {
        const bx = Math.cos(bg.ang) * bg.r;
        const bz = Math.sin(bg.ang) * bg.r;
        tube(
          [
            [0.01, 1.24, 0],
            [bx * 0.54, bg.h - 0.32, bz * 0.54],
            [bx, bg.h, bz],
          ],
          0.05,
          barkMat,
          7
        );

        const core = new THREE.Mesh(crownCoreG, shadeLeafMat);
        core.position.set(bx * 0.94, bg.h + 0.04, bz * 0.94);
        core.scale.set(0.92, 0.68, 0.92);
        inner.add(core);

        for (let ci = 0; ci < 3; ci++) {
          const card = new THREE.Mesh(cardG, blossomCardMat);
          card.position.set(bx * 1.05, bg.h + 0.12, bz * 1.05);
          card.rotation.set(
            ci === 2 ? Math.PI / 2 - 0.26 : 0.22,
            bg.ang + (ci * Math.PI) / 3,
            ci === 1 ? 0.32 : -0.2
          );
          card.scale.setScalar(0.84 + (ci % 2) * 0.18);
          card.userData.sharedGlbMat = true;
          inner.add(card);
        }
      }

      // Lush domed upper crown canopy
      const topCore = new THREE.Mesh(crownCoreG, shadeLeafMat);
      topCore.position.set(0, 2.32, 0);
      topCore.scale.set(1.14, 0.78, 1.14);
      inner.add(topCore);
      for (let ti = 0; ti < 6; ti++) {
        const ta = (ti / 6) * Math.PI * 2;
        const topCard = new THREE.Mesh(cardG, blossomCardMat);
        topCard.position.set(Math.cos(ta) * 0.22, 2.42 + (ti % 2) * 0.14, Math.sin(ta) * 0.22);
        topCard.rotation.set(0.48 + (ti % 2) * 0.3, ta, 0.18);
        topCard.scale.setScalar(0.98);
        topCard.userData.sharedGlbMat = true;
        inner.add(topCard);
      }
      break;
    }

    case 'royal_palm': {
      // Graceful ornamental courtyard palm in octagonal carved stone curb with collar rings & arching pinnate fronds
      const curbOuter = cyl(0.42, 0.44, 0.05, travertineMat, 0, 0.025, 0);
      curbOuter.geometry.dispose();
      curbOuter.geometry = new THREE.CylinderGeometry(0.42, 0.44, 0.05, 8);
      const curb = cyl(0.38, 0.4, 0.12, travertineMat, 0, 0.065, 0);
      curb.geometry.dispose();
      curb.geometry = new THREE.CylinderGeometry(0.38, 0.4, 0.12, 8);
      cyl(0.32, 0.34, 0.13, soilMat, 0, 0.07, 0);

      // Ringed gently curving palm trunk (9 tapered segments)
      for (let s = 0; s < 9; s++) {
        const t = s / 8;
        const px = Math.sin(t * 1.4) * 0.09;
        const pz = Math.cos(t * 1.2) * 0.04 - 0.04;
        const rBot = 0.118 - t * 0.038;
        const rTop = 0.104 - t * 0.036;
        const seg = cyl(rTop, rBot, 0.22, barkMat, px, 0.18 + s * 0.195, pz);
        seg.rotation.z = -Math.cos(t * 1.4) * 0.07;
      }
      // Crownshaft collar ring + green crownshaft + golden date clusters
      cyl(0.088, 0.094, 0.04, travertineMat, 0.088, 1.85, -0.02);
      cyl(0.078, 0.085, 0.36, leafGreen, 0.088, 2.02, -0.02);
      const dateMat = makeMat({ color: 0xd97706, roughness: 0.45 });
      for (let d = 0; d < 4; d++) {
        const da = (d / 4) * Math.PI * 2;
        const pod = new THREE.Mesh(new THREE.SphereGeometry(0.055, 7, 5), dateMat);
        pod.scale.set(0.8, 1.45, 0.8);
        pod.position.set(0.088 + Math.cos(da) * 0.1, 1.88, -0.02 + Math.sin(da) * 0.1);
        inner.add(pod);
      }

      // 13 Arching pinnate palm fronds built from bent multi-segment planes with palmFrond alpha cutout
      const frondGeom = new THREE.PlaneGeometry(0.7, 1.22, 2, 5);
      frondGeom.translate(0, 0.61, 0);
      const fPos = frondGeom.attributes.position as THREE.BufferAttribute;
      for (let vi = 0; vi < fPos.count; vi++) {
        const fy = Math.max(0, fPos.getY(vi));
        const norm = Math.min(1, fy / 1.22);
        fPos.setY(vi, fy);
        fPos.setZ(vi, -Math.pow(norm, 1.85) * 0.54);
      }
      fPos.needsUpdate = true;
      frondGeom.computeVertexNormals();
      frondGeom.computeBoundingBox();
      frondGeom.computeBoundingSphere();

      for (let fi = 0; fi < 13; fi++) {
        const tier = fi < 7 ? 0 : 1;
        const ang = (fi / (tier === 0 ? 7 : 6)) * Math.PI * 2 + tier * 0.36;
        const fPivot = new THREE.Group();
        fPivot.position.set(0.088, 2.16 + tier * 0.08, -0.02);
        fPivot.rotation.y = ang;
        const fMesh = new THREE.Mesh(frondGeom, palmCardMat);
        fMesh.rotation.x = tier === 0 ? 1.14 : 0.62;
        fMesh.userData.sharedGlbMat = true;
        fPivot.add(fMesh);
        inner.add(fPivot);
      }
      break;
    }

    case 'marble_fountain': {
      // Sculpted two-tier travertine marble garden fountain with translucent turquoise water & night glow
      const bronzeMat = makeMat({ color: 0xb48a48, roughness: 0.32, metalness: 0.78 });
      // Stepped octagonal plinth + carved stone basin rim
      const stepPlinth = cyl(0.51, 0.54, 0.055, travertineMat, 0, 0.028, 0);
      stepPlinth.geometry.dispose();
      stepPlinth.geometry = new THREE.CylinderGeometry(0.51, 0.54, 0.055, 8);
      const basinBase = cyl(0.45, 0.47, 0.2, travertineMat, 0, 0.13, 0);
      basinBase.geometry.dispose();
      basinBase.geometry = new THREE.CylinderGeometry(0.45, 0.47, 0.2, 8);
      const basinRim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.055, 8, 16), travertineMat);
      basinRim.rotation.x = Math.PI / 2;
      basinRim.position.y = 0.235;
      basinRim.userData.sharedGlbMat = true;
      inner.add(basinRim);

      const waterPoolMat = new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.12,
        roughness: 0.06,
        metalness: 0.06,
        transparent: true,
        opacity: 0.84,
        clearcoat: 1.0,
        normalMap: textures.waterNormal,
        normalScale: new THREE.Vector2(0.55, 0.55),
      });
      const poolDisk = cyl(0.39, 0.39, 0.06, waterPoolMat, 0, 0.2, 0);
      poolDisk.userData.noCastShadow = true;

      // Central fluted marble pedestal + lower bowl + carved collar + upper finial spout
      cyl(0.09, 0.13, 0.42, travertineMat, 0, 0.4, 0);
      cyl(0.24, 0.09, 0.11, travertineMat, 0, 0.62, 0);
      const upperBowlRim = new THREE.Mesh(new THREE.TorusGeometry(0.225, 0.026, 6, 16), travertineMat);
      upperBowlRim.rotation.x = Math.PI / 2;
      upperBowlRim.position.y = 0.675;
      upperBowlRim.userData.sharedGlbMat = true;
      inner.add(upperBowlRim);

      const upperWater = cyl(0.2, 0.18, 0.03, waterPoolMat, 0, 0.67, 0);
      upperWater.userData.noCastShadow = true;
      cyl(0.05, 0.075, 0.24, travertineMat, 0, 0.78, 0);
      cyl(0.03, 0.045, 0.12, bronzeMat, 0, 0.94, 0);
      const finialOrb = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 6), bronzeMat);
      finialOrb.position.set(0, 1.01, 0);
      inner.add(finialOrb);

      // 4 Translucent arcing water jets cascading from upper bowl
      const fountainArcs: THREE.Mesh[] = [];
      for (let wi = 0; wi < 4; wi++) {
        const wa = (wi / 4) * Math.PI * 2 + 0.3;
        const arc = tube(
          [
            [Math.cos(wa) * 0.04, 0.98, Math.sin(wa) * 0.04],
            [Math.cos(wa) * 0.15, 0.9, Math.sin(wa) * 0.15],
            [Math.cos(wa) * 0.24, 0.66, Math.sin(wa) * 0.24],
          ],
          0.012,
          waterPoolMat,
          8
        );
        arc.userData.noCastShadow = true;
        fountainArcs.push(arc);
      }

      // 2 Subtle expanding water ripple rings across basin surface
      const fountainRipples: THREE.Mesh[] = [];
      const rippleGeom = new THREE.RingGeometry(0.11, 0.135, 20);
      for (let ri = 0; ri < 2; ri++) {
        const rippleMat = new THREE.MeshBasicMaterial({
          color: 0xe0f2fe,
          transparent: true,
          opacity: 0.32,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const rippleMesh = new THREE.Mesh(rippleGeom, rippleMat);
        rippleMesh.rotation.x = -Math.PI / 2;
        rippleMesh.position.y = 0.233;
        rippleMesh.userData.noCastShadow = true;
        inner.add(rippleMesh);
        fountainRipples.push(rippleMesh);
      }

      addFloorHalo(2.15, 0x38bdf8, 0.44, 0, 0.026, 0);
      addBulbAura(0.26, 0x7dd3fc, 0.32, 0, 0.44, 0);
      outer.userData.smartLight = {
        kind: 'sign_lamp',
        localPos: [0, 0.58, 0],
        emissiveMats: [waterPoolMat],
        haloMats,
        haloMaxOpacities,
      } as SmartLightMeta;
      outer.userData.fountain = {
        arcs: fountainArcs,
        ripples: fountainRipples,
        waterMat: waterPoolMat,
      } as FountainRigMeta;
      break;
    }

    case 'rose_trellis': {
      // Limestone & cedar planter trough with lattice trellis and lush climbing roses
      box(0.84, 0.1, 0.48, travertineMat, 0, 0.05, 0);
      box(0.78, 0.28, 0.42, woodMat, 0, 0.24, 0);
      box(0.7, 0.22, 0.34, soilMat, 0, 0.3, 0);

      // Upright cedar trellis frame + cross slats behind trough
      box(0.06, 1.38, 0.06, warmTimber, -0.36, 0.96, -0.14);
      box(0.06, 1.38, 0.06, warmTimber, 0.36, 0.96, -0.14);
      box(0.8, 0.06, 0.07, warmTimber, 0, 1.66, -0.14);
      for (let h = 0; h < 5; h++) {
        box(0.72, 0.025, 0.02, woodMat, 0, 0.52 + h * 0.24, -0.14);
      }
      for (let v = -2; v <= 2; v++) {
        box(0.025, 1.24, 0.02, woodMat, v * 0.14, 1.02, -0.14);
      }

      // Layered climbing botanical rose & foliage cards across trellis face + planter base
      const roseCardG = new THREE.PlaneGeometry(0.56, 0.56);
      const cardPlacements: Array<[number, number, number, number]> = [
        [-0.16, 0.68, -0.06, 0.15],
        [0.16, 0.84, -0.05, -0.2],
        [-0.04, 1.22, -0.06, 0.25],
        [0.18, 1.38, -0.07, -0.15],
      ];
      for (const [cx, cy, cz, ry] of cardPlacements) {
        const card = new THREE.Mesh(roseCardG, roseCardMat);
        card.position.set(cx, cy, cz);
        card.rotation.set(0.08, ry, 0);
        card.userData.sharedGlbMat = true;
        inner.add(card);
      }
      // Sculpted 3D rose buds along front rim
      const roseMat = makeMat({ color: 0xe11d48, roughness: 0.45 });
      for (const [rx, ry, rz] of [
        [-0.22, 0.46, 0.08],
        [0.02, 0.48, 0.1],
        [0.24, 0.45, 0.07],
        [-0.18, 1.05, -0.02],
        [0.16, 1.36, -0.02],
      ]) {
        const bud = new THREE.Mesh(new THREE.SphereGeometry(0.045, 7, 5), roseMat);
        bud.position.set(rx, ry, rz);
        inner.add(bud);
      }
      break;
    }

    case 'zen_lantern': {
      // Carved basalt pagoda garden lantern on mossy river-stone pad with bamboo & warm lantern glow
      const basaltMat = makeMat({ color: 0x4b5563, roughness: 0.86, metalness: 0.04 });
      const pebbleMat = makeMat({ color: 0x9ca3af, roughness: 0.88 });
      const bambooMat = makeMat({ color: 0x5f8f38, roughness: 0.56 });
      const shojiGlowMat = makeMat({
        color: 0xfef3c7,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.16,
        roughness: 0.3,
      });

      // Rounded stone pad & river pebbles
      cyl(0.42, 0.45, 0.06, pebbleMat, 0, 0.03, 0);
      for (let p = 0; p < 5; p++) {
        const pa = (p / 5) * Math.PI * 2 + 0.5;
        const st = new THREE.Mesh(new THREE.SphereGeometry(0.065, 7, 5), basaltMat);
        st.scale.set(1.2, 0.5, 0.9);
        st.position.set(Math.cos(pa) * 0.28, 0.065, Math.sin(pa) * 0.28);
        inner.add(st);
      }

      // Twin green bamboo culms at rear corner
      for (const [bx, bz, bh] of [
        [-0.24, -0.22, 1.24],
        [-0.16, -0.26, 0.96],
      ]) {
        cyl(0.024, 0.028, bh, bambooMat, bx, 0.06 + bh / 2, bz);
        for (let ni = 1; ni <= 3; ni++) {
          cyl(0.032, 0.032, 0.02, darkSlate, bx, 0.06 + (bh * ni) / 4, bz);
        }
      }

      // Carved basalt lantern: 4-legged pedestal, hexagonal pillar, warm glowing firebox, swept pagoda roof
      for (const [lx, lz] of [
        [-0.11, -0.11],
        [0.11, -0.11],
        [-0.11, 0.11],
        [0.11, 0.11],
      ]) {
        box(0.07, 0.16, 0.07, basaltMat, lx, 0.14, lz);
      }
      cyl(0.16, 0.19, 0.08, basaltMat, 0.02, 0.24, 0.02);
      cyl(0.09, 0.11, 0.34, basaltMat, 0.02, 0.45, 0.02);
      cyl(0.19, 0.14, 0.08, basaltMat, 0.02, 0.64, 0.02);

      // Glowing shoji paper chamber framed by stone corner mullions
      const coreGlow = box(0.16, 0.22, 0.16, shojiGlowMat, 0.02, 0.78, 0.02);
      coreGlow.userData.noCastShadow = true;
      for (const [mx, mz] of [
        [-0.08, -0.08],
        [0.12, -0.08],
        [-0.08, 0.12],
        [0.12, 0.12],
      ]) {
        box(0.035, 0.24, 0.035, basaltMat, mx, 0.78, mz);
      }

      // Swept pagoda cap + lotus finial
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.17, 6), basaltMat);
      roof.position.set(0.02, 0.98, 0.02);
      inner.add(roof);
      const finial = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 6), basaltMat);
      finial.position.set(0.02, 1.09, 0.02);
      inner.add(finial);

      addFloorHalo(2.2, 0xffcc78, 0.44, 0.02, 0.026, 0.02);
      addBulbAura(0.24, 0xffe09a, 0.34, 0.02, 0.78, 0.02);
      outer.userData.smartLight = {
        kind: 'garden_lamp',
        localPos: [0.02, 0.82, 0.02],
        emissiveMats: [shojiGlowMat],
        haloMats,
        haloMaxOpacities,
      } as SmartLightMeta;
      break;
    }

    case 'garden_gazebo': {
      // Luxury 1x2 cedar pergola swing bench with waterproof cushions & warm hanging lanterns
      const cushionMat = makeMat({ color: 0xe7dfd1, roughness: 0.78 });
      const pillowCoralMat = makeMat({ color: 0xd96b52, roughness: 0.76 });
      const swingGlowMat = makeMat({
        color: 0xfef3c7,
        emissive: 0xfbbf24,
        emissiveIntensity: 0.14,
        roughness: 0.22,
      });

      // Limestone corner plinths + A-frame cedar uprights
      for (const pz of [-0.76, 0.76]) {
        box(0.68, 0.09, 0.2, travertineMat, 0, 0.045, pz);
        const legF = box(0.08, 2.08, 0.08, woodMat, 0.16, 1.1, pz);
        legF.rotation.z = 0.12;
        const legB = box(0.08, 2.08, 0.08, woodMat, -0.16, 1.1, pz);
        legB.rotation.z = -0.12;
      }
      // Top ridge beam + slatted pergola canopy roof
      box(0.1, 0.11, 1.88, woodMat, 0, 2.15, 0);
      box(0.86, 0.06, 1.86, warmTimber, 0, 2.22, 0);
      for (let rz = -0.82; rz <= 0.84; rz += 0.27) {
        box(0.98, 0.065, 0.065, woodMat, 0, 2.28, rz);
      }

      // Brushed steel suspension chains holding swing bench
      for (const pz of [-0.58, 0.58]) {
        cyl(0.012, 0.012, 1.62, silverMetal, 0.02, 1.32, pz);
        cyl(0.012, 0.012, 1.62, silverMetal, -0.14, 1.32, pz);
      }
      // Swing wooden frame + tufted ivory cushions + coral bolster pillows
      box(0.54, 0.06, 1.24, woodMat, 0.02, 0.44, 0);
      const backFrame = box(0.06, 0.42, 1.24, woodMat, -0.22, 0.66, 0);
      backFrame.rotation.z = 0.14;
      box(0.48, 0.09, 1.16, cushionMat, 0.04, 0.51, 0);
      const backCushion = box(0.09, 0.36, 1.14, cushionMat, -0.16, 0.69, 0);
      backCushion.rotation.z = 0.14;
      for (const pz of [-0.4, 0.4]) {
        const pill = box(0.14, 0.2, 0.26, pillowCoralMat, -0.06, 0.64, pz);
        pill.rotation.z = 0.28;
      }

      // Twin warm hanging lantern globes beneath pergola rafters
      for (const lz of [-0.38, 0.38]) {
        cyl(0.01, 0.01, 0.18, darkSlate, 0.26, 2.08, lz);
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), swingGlowMat);
        orb.position.set(0.26, 1.98, lz);
        orb.userData.noCastShadow = true;
        inner.add(orb);
        addBulbAura(0.18, 0xffe4a8, 0.32, 0.26, 1.98, lz);
      }
      addFloorHalo(2.45, 0xffd584, 0.4, 0, 0.026, 0);
      outer.userData.smartLight = {
        kind: 'garden_lamp',
        localPos: [0.1, 2.02, 0],
        emissiveMats: [swingGlowMat],
        haloMats,
        haloMaxOpacities,
      } as SmartLightMeta;
      break;
    }

    case 'solar_panel': {
      // Full-scale 2x2 dual-module commercial monocrystalline ground-mounted solar array
      const galvSteel = makeMat({ color: 0x94a3b8, roughness: 0.34, metalness: 0.8 });
      const warningYellow = makeMat({ color: 0xfacc15, roughness: 0.45, metalness: 0.1 });

      // 4 precast concrete footing piers with bolted galvanized base plates
      for (const bx of [-0.58, 0.58]) {
        for (const bz of [-0.54, 0.56]) {
          box(0.26, 0.11, 0.3, travertineMat, bx, 0.055, bz);
          box(0.15, 0.022, 0.15, galvSteel, bx, 0.12, bz);
        }
        // Rear tall stanchion & front short stanchion
        box(0.068, 1.08, 0.068, galvSteel, bx, 0.66, -0.54);
        box(0.068, 0.38, 0.068, galvSteel, bx, 0.31, 0.56);

        // Diagonal compression brace supporting rear overhang
        const diag = box(0.044, 0.92, 0.044, galvSteel, bx, 0.62, -0.1);
        diag.rotation.x = 0.72;

        // Sloped steel rafter beam resting atop stanchions
        const rafter = box(0.056, 0.068, 1.52, galvSteel, bx, 0.86, 0.01);
        rafter.rotation.x = 0.52;
      }

      // Rear horizontal strut & X-bracing for authentic ground-mount racking
      box(1.22, 0.048, 0.048, galvSteel, 0, 0.66, -0.54);
      const xBraceA = box(0.028, 1.38, 0.024, galvSteel, 0, 0.66, -0.55);
      xBraceA.rotation.z = 1.06;
      const xBraceB = box(0.028, 1.38, 0.024, galvSteel, 0, 0.66, -0.55);
      xBraceB.rotation.z = -1.06;

      // Tilted Solar Array Assembly (30deg sun-facing tilt toward +Z south)
      const tiltGroup = new THREE.Group();
      tiltGroup.position.set(0, 0.91, 0.01);
      tiltGroup.rotation.x = 0.52;

      // Twin horizontal extruded aluminum C-channel mounting rails spanning both panels
      for (const rz of [-0.46, 0.46]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.046, 0.052), galvSteel);
        rail.position.set(0, -0.042, rz);
        tiltGroup.add(rail);
      }

      // Two full-height 72-cell half-cut monocrystalline PV modules side by side
      const modW = 0.9;
      const modD = 1.66;
      const frameT = 0.044;
      const railRim = 0.032;

      for (const mx of [-0.47, 0.47]) {
        const modGroup = new THREE.Group();
        modGroup.position.set(mx, 0, 0);

        // Protective white/slate Tedlar backsheet base
        const backsheet = new THREE.Mesh(
          new THREE.BoxGeometry(modW - railRim * 1.4, 0.024, modD - railRim * 1.4),
          darkSlate
        );
        backsheet.position.y = -0.008;
        backsheet.userData.sharedGlbMat = true;

        // 4 brushed anodized aluminum perimeter frame rails
        const railTop = new THREE.Mesh(new THREE.BoxGeometry(modW, frameT, railRim), silverMetal);
        railTop.position.z = -modD * 0.5 + railRim * 0.5;
        railTop.userData.sharedGlbMat = true;
        const railBot = new THREE.Mesh(new THREE.BoxGeometry(modW, frameT, railRim), silverMetal);
        railBot.position.z = modD * 0.5 - railRim * 0.5;
        railBot.userData.sharedGlbMat = true;
        const railLeft = new THREE.Mesh(new THREE.BoxGeometry(railRim, frameT, modD - railRim * 2), silverMetal);
        railLeft.position.x = -modW * 0.5 + railRim * 0.5;
        railLeft.userData.sharedGlbMat = true;
        const railRight = new THREE.Mesh(new THREE.BoxGeometry(railRim, frameT, modD - railRim * 2), silverMetal);
        railRight.position.x = modW * 0.5 - railRim * 0.5;
        railRight.userData.sharedGlbMat = true;

        // Tempered photovoltaic silicon glass top face
        const glassFace = new THREE.Mesh(
          new THREE.PlaneGeometry(modW - railRim * 1.9, modD - railRim * 1.9),
          solarCellMat
        );
        glassFace.rotation.x = -Math.PI / 2;
        glassFace.position.y = 0.015;
        glassFace.userData.sharedGlbMat = true;
        glassFace.userData.noCastShadow = true;

        // Rear IP68 junction box
        const jBox = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.045, 0.14), darkSlate);
        jBox.position.set(0, -0.036, -0.28);
        jBox.userData.sharedGlbMat = true;

        modGroup.add(backsheet, railTop, railBot, railLeft, railRight, glassFace, jBox);
        tiltGroup.add(modGroup);
      }

      // Stainless steel mid-clamps & outer end-clamps holding panels to the C-rails
      for (const rz of [-0.46, 0.46]) {
        for (const cx of [-0.94, 0, 0.94]) {
          const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.056, 0.058), darkSlate);
          clamp.position.set(cx, 0.006, rz);
          clamp.userData.sharedGlbMat = true;
          tiltGroup.add(clamp);
        }
      }

      inner.add(tiltGroup);

      // Post-mounted grid-tie string inverter / DC combiner box with LED & safety stripe
      box(0.32, 0.36, 0.14, silverMetal, 0, 0.72, -0.63);
      box(0.28, 0.05, 0.02, warningYellow, 0, 0.59, -0.695);
      const statusLed = box(
        0.042,
        0.022,
        0.02,
        makeMat({ color: 0x34d399, emissive: 0x10b981, emissiveIntensity: 0.85 }),
        0.09,
        0.84,
        -0.695
      );
      statusLed.userData.noCastShadow = true;

      // Coiled DC home-run cables & vertical armored conduit into grass
      tube(
        [
          [-0.42, 0.96, -0.34],
          [-0.2, 0.82, -0.52],
          [0, 0.74, -0.6],
        ],
        0.015,
        blackRubber,
        8
      );
      tube(
        [
          [0.42, 0.96, -0.34],
          [0.2, 0.82, -0.52],
          [0, 0.74, -0.6],
        ],
        0.015,
        blackRubber,
        8
      );
      cyl(0.018, 0.018, 0.56, darkSlate, 0, 0.28, -0.63);
      break;
    }

    case 'therason_sign': {
      box(0.5, 0.16, 1.84, makeMat({ color: 0xb6afa3, roughness: 0.78 }), 0, 0.08, 0);
      box(0.4, 0.17, 1.74, makeMat({ color: 0x4b3626, roughness: 0.96 }), 0, 0.09, 0);
      const petalColors = [0xd9485f, 0xeab338, 0xb07cc6, 0xebe6dc];
      const leafG = new THREE.ConeGeometry(0.04, 0.14, 4);
      const petalG = new THREE.SphereGeometry(0.024, 6, 4);
      const stemG = new THREE.CylinderGeometry(0.007, 0.009, 0.15, 5);
      for (let i = 0; i < 6; i++) {
        const fz = -0.68 + i * 0.27;
        const st = new THREE.Mesh(stemG, leafGreen);
        st.position.set(0.18, 0.21, fz);
        inner.add(st);
        for (let li = 0; li < 3; li++) {
          const la = (li / 3) * Math.PI * 2 + i;
          const lf = new THREE.Mesh(leafG, leafGreen);
          lf.position.set(0.18 + Math.cos(la) * 0.035, 0.17, fz + Math.sin(la) * 0.035);
          lf.rotation.z = -Math.cos(la) * 0.9;
          lf.rotation.x = Math.sin(la) * 0.9;
          lf.scale.set(0.8, 0.9, 0.3);
          inner.add(lf);
        }
        const pMat = makeMat({ color: petalColors[i % petalColors.length], roughness: 0.55 });
        for (let pi = 0; pi < 5; pi++) {
          const pa = (pi / 5) * Math.PI * 2;
          const pet = new THREE.Mesh(petalG, pMat);
          pet.scale.set(1.2, 0.45, 0.85);
          pet.position.set(0.18 + Math.cos(pa) * 0.025, 0.29, fz + Math.sin(pa) * 0.025);
          pet.rotation.y = -pa;
          inner.add(pet);
        }
      }

      box(0.24, 0.96, 1.4, makeMat({ color: 0x1e40af, roughness: 0.35 }), 0, 0.64, 0);
      const faceMat = makeMat({
        map: textures.therasonMonument,
        emissiveMap: textures.therasonMonument,
        emissive: 0x3b82f6,
        emissiveIntensity: 0.35,
        roughness: 0.25,
      });
      const faceFront = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.86, 1.3), faceMat);
      faceFront.position.set(0.13, 0.64, 0);
      faceFront.userData.noCastShadow = true;
      const faceBack = faceFront.clone();
      faceBack.position.set(-0.13, 0.64, 0);
      faceBack.userData.noCastShadow = true;
      inner.add(faceFront, faceBack);
      addFloorHalo(2.3, 0x38bdf8, 0.36, 0.35, 0.026, 0);
      addFloorHalo(2.3, 0x38bdf8, 0.36, -0.35, 0.026, 0);
      outer.userData.smartLight = {
        kind: 'sign_lamp',
        localPos: [0, 0.85, 0],
        emissiveMats: [faceMat],
        haloMats,
        haloMaxOpacities,
      } as SmartLightMeta;
      break;
    }

    case 'office_desk': {
      for (const lx of [-0.74, 0.74]) {
        for (const lz of [-0.26, 0.26]) {
          box(0.06, 0.68, 0.06, darkSlate, lx, 0.34, lz);
        }
      }
      box(1.66, 0.06, 0.68, woodMat, 0, 0.71, 0);
      for (const mx of [-0.3, 0.3]) {
        box(0.06, 0.12, 0.06, darkSlate, mx, 0.79, -0.14);
        box(0.46, 0.29, 0.04, darkSlate, mx, 0.98, -0.14);
        const scr = box(
          0.42,
          0.24,
          0.02,
          makeMat({ map: textures.ecgScreen, emissive: 0x38bdf8, emissiveIntensity: 0.3 }),
          mx,
          0.98,
          -0.11
        );
        scr.userData.noCastShadow = true;
      }
      cyl(0.04, 0.18, 0.26, darkSlate, 0, 0.13, 0.34);
      box(0.38, 0.08, 0.36, blueUpholstery, 0, 0.38, 0.34);
      box(0.36, 0.42, 0.08, blueUpholstery, 0, 0.62, 0.48);
      inner.scale.setScalar(0.86);
      break;
    }

    case 'supply_shelf': {
      box(1.56, 1.48, 0.48, woodMat, 0, 0.74, 0);
      box(1.44, 1.32, 0.38, makeMat({ color: 0x7c4d26, roughness: 0.8 }), 0, 0.74, 0.06);
      for (const sy of [0.34, 0.74, 1.14]) {
        box(1.5, 0.04, 0.44, woodMat, 0, sy, 0.04);
      }
      const towelColors = [0x0284c7, 0x38bdf8, 0xe2e8f0, 0x0d9488, 0xf59e0b];
      for (let i = 0; i < 5; i++) {
        box(0.22, 0.18, 0.26, makeMat({ color: towelColors[i], roughness: 0.75 }), -0.52 + i * 0.26, 0.46, 0.08);
        box(0.2, 0.22, 0.24, makeMat({ color: towelColors[(i + 2) % 5], roughness: 0.45 }), -0.5 + i * 0.25, 0.88, 0.08);
        cyl(0.06, 0.06, 0.2, makeMat({ color: towelColors[(i + 1) % 5], roughness: 0.35 }), -0.5 + i * 0.25, 1.28, 0.08);
      }
      inner.scale.set(0.94, 0.92, 0.94);
      break;
    }

    case 'skeleton_stand': {
      // High-detail educational anatomical human skeleton on 5-caster chrome medical rolling stand
      const boneMat = makeMat({ color: 0xf2ece0, roughness: 0.48, metalness: 0.04 });
      const boneShadeMat = makeMat({ color: 0xded5c3, roughness: 0.54, metalness: 0.03 });
      const cartilageMat = makeMat({ color: 0xd5e3ea, roughness: 0.36, metalness: 0.04 });
      const discTeachMat = makeMat({
        color: 0xe11d48,
        emissive: 0x9f1239,
        emissiveIntensity: 0.32,
        roughness: 0.35,
      });
      const cavityMat = makeMat({ color: 0x221b15, roughness: 0.88 });
      const toothMat = makeMat({ color: 0xfaf8f2, roughness: 0.28 });

      // 1. Mobile 5-star wheeled base & telescopic steel stand
      cyl(0.038, 0.045, 0.055, silverMetal, 0, 0.068, -0.04);
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2 + 0.3;
        const arm = box(0.026, 0.022, 0.24, silverMetal, Math.sin(ang) * 0.12, 0.058, -0.04 + Math.cos(ang) * 0.12);
        arm.rotation.y = ang;
        const wheel = cyl(0.022, 0.022, 0.018, blackRubber, Math.sin(ang) * 0.22, 0.022, -0.04 + Math.cos(ang) * 0.22);
        wheel.rotation.z = Math.PI / 2;
        wheel.rotation.y = ang;
      }
      // Vertical chrome rod + pelvic mount bracket
      cyl(0.014, 0.016, 0.96, silverMetal, 0, 0.54, -0.055);
      cyl(0.022, 0.022, 0.04, blackRubber, 0, 0.48, -0.055);
      box(0.024, 0.024, 0.06, silverMetal, 0, 0.89, -0.025);

      const addJoint = (r: number, x: number, y: number, z: number, mat = boneMat) => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), mat);
        m.position.set(x, y, z);
        inner.add(m);
        return m;
      };

      // 2. Articulated Lower Limbs (Feet, Tibia+Fibula, Patellae, Angled Femurs)
      for (const side of [-1, 1]) {
        const footX = side * 0.095;
        const kneeX = side * 0.082;
        const hipX = side * 0.105;

        // Articulated foot: calcaneus heel + arched midfoot + metatarsals + 4 phalanges ridge
        box(0.042, 0.032, 0.05, boneShadeMat, footX, 0.145, -0.01);
        const arch = box(0.044, 0.024, 0.088, boneMat, footX, 0.146, 0.042);
        arch.rotation.x = 0.16;
        for (let t = 0; t < 4; t++) {
          box(0.008, 0.014, 0.036, boneShadeMat, footX + (t - 1.5) * 0.011, 0.132, 0.096);
        }
        addJoint(0.021, footX, 0.172, 0.006); // ankle talus

        // Twin Tibia (medial/thicker) + Fibula (lateral/slender)
        tube([[footX - side * 0.006, 0.178, 0.008], [kneeX - side * 0.008, 0.515, 0.02]], 0.015, boneMat, 6);
        tube([[footX + side * 0.014, 0.178, 0.002], [kneeX + side * 0.016, 0.495, 0.006]], 0.007, boneShadeMat, 6);

        // Femoral condyles + tibial plateau + patella kneecap
        addJoint(0.024, kneeX, 0.53, 0.018);
        const patella = addJoint(0.014, kneeX, 0.535, 0.044, boneShadeMat);
        patella.scale.set(1, 1.15, 0.55);

        // Femur shaft angling naturally outward to greater trochanter + femoral neck to acetabulum
        tube(
          [
            [kneeX, 0.54, 0.018],
            [hipX + side * 0.018, 0.72, 0.016],
            [hipX + side * 0.024, 0.855, 0.014],
          ],
          0.018,
          boneMat,
          8
        );
        tube(
          [
            [hipX + side * 0.022, 0.855, 0.014],
            [hipX - side * 0.016, 0.885, 0.014],
          ],
          0.014,
          boneMat,
          4
        );
        addJoint(0.022, hipX - side * 0.018, 0.886, 0.014); // femoral head
      }

      // 3. Sculpted Anatomical Pelvis (Sacrum, Iliac Wings, Pubic Symphysis, Ischial Loops)
      const sacrum = box(0.088, 0.115, 0.036, boneShadeMat, 0, 0.91, -0.028);
      sacrum.rotation.x = 0.22;
      for (const side of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.046, 0.098, 8), boneMat);
        wing.scale.set(0.32, 1.0, 0.92);
        wing.position.set(side * 0.105, 0.945, 0.008);
        wing.rotation.z = side * -0.46;
        wing.rotation.y = side * 0.42;
        inner.add(wing);

        // Iliac crest rim & pubic arch loop
        tube(
          [
            [side * 0.04, 0.94, -0.024],
            [side * 0.132, 0.985, -0.004],
            [side * 0.125, 0.945, 0.048],
            [side * 0.068, 0.87, 0.056],
            [side * 0.012, 0.848, 0.048],
          ],
          0.013,
          boneMat,
          10
        );
        tube(
          [
            [side * 0.016, 0.848, 0.046],
            [side * 0.075, 0.822, 0.014],
            [side * 0.088, 0.875, 0.002],
          ],
          0.011,
          boneShadeMat,
          6
        );
      }
      box(0.024, 0.032, 0.018, cartilageMat, 0, 0.848, 0.048); // pubic symphysis

      // 4. Articulated Vertebral Column (Lumbar -> Thoracic -> Cervical) + Highlighted L4-L5 Teaching Disc
      const numVert = 21;
      for (let vi = 0; vi < numVert; vi++) {
        const t = vi / (numVert - 1); // 0 = L5, 1 = C1
        const vy = 0.96 + t * 0.56;
        // Anatomical S-curve (lumbar lordosis, thoracic kyphosis, cervical lordosis)
        const vz =
          -0.02 +
          Math.sin(t * Math.PI) * -0.028 +
          (t < 0.35 ? Math.sin((t / 0.35) * Math.PI) * 0.026 : 0) +
          (t > 0.78 ? Math.sin(((t - 0.78) / 0.22) * Math.PI) * 0.018 : 0);
        const radius = 0.026 - t * 0.011;
        cyl(radius, radius * 1.04, 0.019, boneMat, 0, vy, vz);
        // Intervertebral cartilage disc (L4-L5 highlighted crimson for clinical teaching clarity)
        if (vi < numVert - 1) {
          const isTeachingDisc = vi === 1;
          cyl(
            radius * 0.98,
            radius * 0.98,
            0.008,
            isTeachingDisc ? discTeachMat : cartilageMat,
            0,
            vy + 0.013,
            vz
          );
        }
        // Posterior spinous process + transverse knobs
        const sp = box(0.009, 0.011, 0.024, boneShadeMat, 0, vy - 0.003, vz - radius - 0.008);
        sp.rotation.x = 0.38;
      }

      // 5. Open Thoracic Ribcage (10 true/false curved rib pairs + 2 floating pairs + Manubrium/Sternum)
      // Sternum (Manubrium, Body, Xiphoid)
      box(0.056, 0.05, 0.016, boneMat, 0, 1.355, 0.068);
      box(0.03, 0.14, 0.014, boneMat, 0, 1.26, 0.082);
      box(0.014, 0.032, 0.01, cartilageMat, 0, 1.175, 0.08);

      const ribPairs = 10;
      for (let ri = 0; ri < ribPairs; ri++) {
        const rt = ri / (ribPairs - 1); // 0 = top rib 1, 1 = rib 10
        const backY = 1.385 - rt * 0.255;
        const frontY = 1.365 - rt * 0.27;
        const spreadX = 0.072 + Math.sin(Math.pow(rt, 0.72) * Math.PI * 0.88) * 0.078;
        const frontZ = 0.055 + Math.sin(rt * Math.PI * 0.78) * 0.038;
        const backZ = -0.042;
        const attachesSternum = ri < 7;

        for (const side of [-1, 1]) {
          const ribMat = ri >= 5 && ri < 8 ? boneMat : boneMat;
          const endX = attachesSternum ? side * 0.016 : side * (0.042 + (ri - 6) * 0.016);
          const endY = attachesSternum ? frontY : frontY - 0.018;
          const endZ = attachesSternum ? frontZ + 0.024 : frontZ - 0.004;
          tube(
            [
              [side * 0.016, backY, backZ],
              [side * (spreadX * 0.72), backY - 0.008, backZ - 0.006],
              [side * spreadX, (backY + frontY) * 0.5, 0.015],
              [side * (spreadX * 0.76), frontY + 0.006, frontZ + 0.012],
              [endX, endY, endZ],
            ],
            0.0068,
            ribMat,
            10
          );
          if (ri >= 7 && ri < 9) {
            // Costal cartilage sweep connecting false ribs upward toward costal margin
            tube(
              [
                [endX, endY, endZ],
                [side * 0.03, endY + 0.04, frontZ + 0.018],
              ],
              0.0055,
              cartilageMat,
              4
            );
          }
        }
      }

      // 6. Shoulder Girdle (S-Curved Clavicles + Dorsal Scapulae) & Articulated Arms + Hands
      for (const side of [-1, 1]) {
        // S-curved Clavicle collarbone
        tube(
          [
            [side * 0.022, 1.375, 0.064],
            [side * 0.085, 1.385, 0.052],
            [side * 0.168, 1.39, 0.018],
          ],
          0.0095,
          boneMat,
          7
        );
        // Dorsal Scapula shoulder blade
        const scap = new THREE.Mesh(new THREE.ConeGeometry(0.056, 0.125, 3), boneShadeMat);
        scap.scale.set(0.92, 1, 0.22);
        scap.position.set(side * 0.095, 1.32, -0.068);
        scap.rotation.z = Math.PI + side * 0.16;
        scap.rotation.y = side * -0.22;
        inner.add(scap);

        const shX = side * 0.175;
        const elbX = side * 0.195;
        const wrX = side * 0.205;
        addJoint(0.022, shX, 1.37, 0.008); // humeral head

        // Humerus
        tube([[shX, 1.37, 0.008], [elbX, 1.12, 0.002]], 0.014, boneMat, 6);
        addJoint(0.018, elbX, 1.115, 0.004, boneShadeMat); // elbow condyle

        // Twin Radius (lateral) & Ulna (medial) forearm bones
        tube([[elbX + side * 0.007, 1.11, 0.004], [wrX + side * 0.008, 0.89, 0.022]], 0.0085, boneMat, 6);
        tube([[elbX - side * 0.007, 1.11, -0.002], [wrX - side * 0.005, 0.89, 0.016]], 0.0085, boneShadeMat, 6);

        // Wrist carpals + splayed articulated fingers
        box(0.024, 0.028, 0.02, boneShadeMat, wrX, 0.875, 0.02);
        for (let fi = 0; fi < 4; fi++) {
          const fz = 0.006 + fi * 0.01;
          tube(
            [
              [wrX, 0.865, fz],
              [wrX + side * 0.004, 0.815, fz + 0.004],
              [wrX - side * 0.006, 0.77, fz + 0.006],
            ],
            0.0038,
            boneMat,
            4
          );
        }
        // Thumb
        tube(
          [
            [wrX, 0.868, 0.03],
            [wrX + side * 0.006, 0.83, 0.052],
          ],
          0.0042,
          boneMat,
          3
        );
      }

      // 7. Anatomically Sculpted Cranium, Orbital Cavities, Nasal Cavity, Teeth & Mandible
      const skullY = 1.61;
      const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.088, 16, 12), boneMat);
      cranium.scale.set(0.88, 1.06, 1.04);
      cranium.position.set(0, skullY + 0.015, 0.014);
      inner.add(cranium);

      // Brow ridge & Zygomatic cheekbones
      box(0.118, 0.02, 0.044, boneMat, 0, skullY + 0.024, 0.072);
      for (const side of [-1, 1]) {
        const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), boneMat);
        cheek.scale.set(0.95, 0.72, 0.9);
        cheek.position.set(side * 0.048, skullY - 0.018, 0.068);
        inner.add(cheek);
        // Dark recessed orbital eye sockets
        const orbit = new THREE.Mesh(new THREE.SphereGeometry(0.021, 8, 6), cavityMat);
        orbit.scale.set(1.05, 0.92, 0.65);
        orbit.position.set(side * 0.03, skullY + 0.002, 0.082);
        inner.add(orbit);
      }

      // Piriform nasal cavity
      const noseHole = new THREE.Mesh(new THREE.ConeGeometry(0.013, 0.028, 3), cavityMat);
      noseHole.position.set(0, skullY - 0.022, 0.094);
      noseHole.rotation.x = 0.1;
      inner.add(noseHole);

      // Maxilla + upper & lower teeth rows + articulated Mandible (jawbone)
      box(0.066, 0.022, 0.038, boneShadeMat, 0, skullY - 0.046, 0.076);
      box(0.056, 0.014, 0.014, toothMat, 0, skullY - 0.06, 0.088);
      box(0.052, 0.012, 0.014, toothMat, 0, skullY - 0.074, 0.085);
      // Mandible body & rami
      tube(
        [
          [-0.054, skullY - 0.03, 0.036],
          [-0.048, skullY - 0.082, 0.056],
          [0, skullY - 0.094, 0.086],
          [0.048, skullY - 0.082, 0.056],
          [0.054, skullY - 0.03, 0.036],
        ],
        0.0115,
        boneMat,
        8
      );
      inner.scale.setScalar(0.83);
      break;
    }

    case 'floor_rug': {
      // High-detail woven acoustic clinical reception rug with tapestry pattern & fringed edges (walkable)
      const rugMat = new THREE.MeshStandardMaterial({
        map: textures.rugPattern,
        bumpMap: textures.fabricWeaveBump,
        bumpScale: 0.012,
        roughness: 0.92,
      });
      const rugPile = box(1.82, 0.022, 0.92, rugMat, 0, 0.014, 0);
      rugPile.userData.noCastShadow = true;
      const fringeMat = makeMat({ color: 0xe2dfd7, roughness: 0.95 });
      for (const fx of [-0.935, 0.935]) {
        const fringe = box(0.05, 0.012, 0.88, fringeMat, fx, 0.011, 0);
        fringe.userData.noCastShadow = true;
      }
      break;
    }

    case 'waste_bin': {
      const glbTrash = glbRegistry.cloneNormalized('furn_trashcan', {
        maxFootprint: { w: 0.3, d: 0.3 },
        targetHeight: 0.38,
      });
      if (glbTrash) {
        inner.add(glbTrash);
      }
      break;
    }

    case 'anatomy_poster': {
      // Backplane flush at local x = -0.40 so it mounts cleanly onto any wall
      box(0.045, 0.8, 0.58, darkSlate, -0.378, 1.1, 0);
      box(0.03, 0.74, 0.52, whiteBody, -0.36, 1.1, 0);
      const art = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 0.68, 0.46),
        makeMat({ map: textures.anatomyPoster, roughness: 0.4 })
      );
      art.position.set(-0.348, 1.1, 0);
      art.userData.noCastShadow = true;
      inner.add(art);
      break;
    }

    case 'stone_pathway': {
      // Walkable 1x1 organic irregular travertine stepping stones + slate river pebbles
      const pebbleMat = makeMat({ color: 0x64748b, roughness: 0.88 });
      const mossMat = makeMat({ color: 0x5c8532, roughness: 0.94 });
      const stones: Array<[number, number, number, number, number]> = [
        [-0.22, -0.2, 0.36, 0.32, 0.24],
        [0.18, -0.16, 0.32, 0.34, -0.18],
        [-0.14, 0.2, 0.38, 0.3, -0.12],
        [0.22, 0.22, 0.3, 0.28, 0.31],
      ];
      for (const [sx, sz, sw, sd, ry] of stones) {
        const st = box(sw, 0.032, sd, travertineMat, sx, 0.016, sz);
        st.rotation.y = ry;
        st.userData.noCastShadow = true;
      }
      for (let pi = 0; pi < 5; pi++) {
        const pa = (pi / 5) * Math.PI * 2 + 0.5;
        const pb = cyl(0.038, 0.042, 0.022, pi % 2 === 0 ? pebbleMat : mossMat, Math.cos(pa) * 0.32, 0.011, Math.sin(pa) * 0.32);
        pb.userData.noCastShadow = true;
      }
      break;
    }

    case 'hedge_planter': {
      // Sculpted 1x2 travertine & cedar hedge planter with multi-tier boxwood foliage & jasmine blossoms
      const hedgeDarkMat = makeMat({ color: 0x264e1e, roughness: 0.9 });
      const jasmineMat = makeMat({ color: 0xfefce8, roughness: 0.4 });
      box(0.76, 0.14, 1.84, travertineMat, 0, 0.07, 0);
      box(0.68, 0.18, 1.74, woodMat, 0, 0.22, 0);
      box(0.58, 0.08, 1.64, soilMat, 0, 0.3, 0);
      // Inner hedge core + sculpted boxwood cypress cards
      box(0.54, 0.62, 1.56, hedgeDarkMat, 0, 0.64, 0);
      const cardG = new THREE.PlaneGeometry(0.68, 0.68);
      for (let hi = -2; hi <= 2; hi++) {
        const hz = hi * 0.34;
        const dome = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 1), hedgeDarkMat);
        dome.scale.set(0.95, 1.05, 1.1);
        dome.position.set(0, 0.9, hz);
        inner.add(dome);
        for (let ci = 0; ci < 3; ci++) {
          const card = new THREE.Mesh(cardG, cypressCardMat);
          card.position.set((ci - 1) * 0.09, 0.72 + (ci === 1 ? 0.18 : 0), hz);
          card.rotation.set(0.18, (ci * Math.PI) / 3 + hi * 0.6, 0.12);
          card.userData.sharedGlbMat = true;
          inner.add(card);
        }
        // White jasmine blossom clusters
        for (const [jx, jy] of [
          [0.24, 0.68],
          [-0.24, 0.82],
          [0.06, 1.02],
        ]) {
          const bl = new THREE.Mesh(new THREE.SphereGeometry(0.026, 6, 4), jasmineMat);
          bl.position.set(jx, jy, hz + (hi % 2 === 0 ? 0.08 : -0.08));
          inner.add(bl);
        }
      }
      break;
    }

    case 'olive_tree': {
      // Mediterranean ornamental olive tree in octagonal stone curb with gnarled multi-stem trunk & silver-sage foliage
      const curb = cyl(0.38, 0.4, 0.14, travertineMat, 0, 0.07, 0);
      curb.geometry.dispose();
      curb.geometry = new THREE.CylinderGeometry(0.38, 0.4, 0.14, 8);
      cyl(0.32, 0.34, 0.15, soilMat, 0, 0.075, 0);

      // Gnarled twisted olive trunk splitting into 3 sculptural boughs
      tube(
        [
          [-0.04, 0.08, 0.02],
          [0.05, 0.48, -0.03],
          [-0.02, 0.92, 0.02],
          [0.01, 1.18, 0],
        ],
        0.085,
        barkMat,
        9
      );
      const oliveShadeMat = makeMat({ color: 0x4b6344, roughness: 0.88 });
      const oliveFruitMat = makeMat({ color: 0x1e293b, roughness: 0.38 });
      const cardG = new THREE.PlaneGeometry(0.84, 0.84);
      const coreG = new THREE.DodecahedronGeometry(0.3, 1);
      const boughs = [
        { ang: 0.3, r: 0.36, h: 1.62 },
        { ang: 2.35, r: 0.38, h: 1.56 },
        { ang: 4.35, r: 0.34, h: 1.68 },
      ];
      for (const bg of boughs) {
        const bx = Math.cos(bg.ang) * bg.r;
        const bz = Math.sin(bg.ang) * bg.r;
        tube([[0, 1.1, 0], [bx * 0.55, 1.36, bz * 0.55], [bx, bg.h, bz]], 0.042, barkMat, 6);
        const core = new THREE.Mesh(coreG, oliveShadeMat);
        core.position.set(bx, bg.h + 0.08, bz);
        core.scale.set(0.95, 0.72, 0.95);
        inner.add(core);
        for (let ci = 0; ci < 3; ci++) {
          const card = new THREE.Mesh(cardG, oliveCardMat);
          card.position.set(bx, bg.h + 0.14, bz);
          card.rotation.set(0.26, bg.ang + (ci * Math.PI) / 3, 0.18);
          card.userData.sharedGlbMat = true;
          inner.add(card);
        }
        // Small dark olive beads
        for (let oi = 0; oi < 2; oi++) {
          const ol = new THREE.Mesh(new THREE.SphereGeometry(0.024, 6, 4), oliveFruitMat);
          ol.scale.set(0.85, 1.35, 0.85);
          ol.position.set(bx + (oi - 0.5) * 0.16, bg.h - 0.04, bz + 0.12);
          inner.add(ol);
        }
      }
      const crown = new THREE.Mesh(coreG, oliveShadeMat);
      crown.position.set(0, 1.98, 0);
      crown.scale.set(1.06, 0.72, 1.06);
      inner.add(crown);
      for (let ti = 0; ti < 4; ti++) {
        const ta = (ti / 4) * Math.PI * 2;
        const topCard = new THREE.Mesh(cardG, oliveCardMat);
        topCard.position.set(Math.cos(ta) * 0.16, 2.06, Math.sin(ta) * 0.16);
        topCard.rotation.set(0.45, ta, 0.15);
        topCard.userData.sharedGlbMat = true;
        inner.add(topCard);
      }
      break;
    }

    case 'garden_umbrella_table': {
      // 2x2 Outdoor Café Patio Umbrella, Slatted Teak Round Table & Bistro Chairs + Warm Evening Under-Glow
      const canvasMat = makeMat({ color: 0xf3ece0, roughness: 0.72, side: THREE.DoubleSide });
      const navySeatMat = makeMat({ color: 0x1e4e6e, roughness: 0.6 });
      const patioRimMat = makeMat({ color: 0xbfb5a5, roughness: 0.76 });
      const lanternMat = makeMat({
        color: 0xfef3c7,
        emissive: 0xfbbf24,
        emissiveIntensity: 0.16,
        roughness: 0.22,
      });

      // Travertine stone patio slab
      box(1.88, 0.045, 1.88, travertineMat, 0, 0.022, 0);
      box(1.74, 0.052, 1.74, patioRimMat, 0, 0.026, 0);

      // Weighted slate umbrella stand + teak round slatted table
      cyl(0.22, 0.25, 0.06, darkSlate, 0, 0.075, 0);
      cyl(0.032, 0.036, 0.68, darkSlate, 0, 0.42, 0);
      for (let li = 0; li < 4; li++) {
        const ang = (li / 4) * Math.PI * 2 + Math.PI / 4;
        cyl(0.024, 0.02, 0.66, woodMat, Math.cos(ang) * 0.28, 0.36, Math.sin(ang) * 0.28);
      }
      cyl(0.48, 0.48, 0.045, woodMat, 0, 0.71, 0);
      // Table props: ceramic mug & medical clipboard
      cyl(0.036, 0.032, 0.075, whiteBody, 0.18, 0.77, 0.12);
      box(0.18, 0.022, 0.24, cyanAccent, -0.18, 0.745, -0.1);

      // 3 Bistro Patio Chairs arranged around table
      for (const ang of [0.35, 2.45, 4.55]) {
        const ch = new THREE.Group();
        ch.position.set(Math.cos(ang) * 0.64, 0, Math.sin(ang) * 0.64);
        ch.rotation.y = -ang + Math.PI / 2;
        const cSeat = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.045, 0.36), navySeatMat);
        cSeat.position.y = 0.42;
        const cBack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.34, 0.04), woodMat);
        cBack.position.set(0, 0.62, -0.16);
        cBack.rotation.x = -0.12;
        ch.add(cSeat, cBack);
        for (const lx of [-0.15, 0.15]) {
          for (const lz of [-0.15, 0.15]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.014, 0.4, 8), darkSlate);
            leg.position.set(lx, 0.2, lz);
            ch.add(leg);
          }
        }
        inner.add(ch);
      }

      // Tall wooden parasol mast + warm glowing under-canopy bulb + 8-rib octagonal canvas canopy
      cyl(0.026, 0.028, 1.56, warmTimber, 0, 1.48, 0);
      const canopyGroup = new THREE.Group();
      canopyGroup.position.set(0, 2.16, 0);
      canopyGroup.rotation.set(0.06, 0, -0.05);
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.12, 0.42, 8), canvasMat);
      canopy.position.y = 0.14;
      const trimRing = new THREE.Mesh(new THREE.TorusGeometry(1.06, 0.016, 6, 8), cyanAccent);
      trimRing.rotation.x = Math.PI / 2;
      trimRing.rotation.z = Math.PI / 8;
      trimRing.position.y = -0.06;
      const topFinial = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.036, 0.08, 8), warmTimber);
      topFinial.position.y = 0.37;
      for (let ri = 0; ri < 8; ri++) {
        const ra = (ri / 8) * Math.PI * 2;
        const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.96, 6), warmTimber);
        rib.position.set(Math.cos(ra) * 0.46, 0.04, Math.sin(ra) * 0.46);
        rib.rotation.z = Math.PI / 2 - 0.24;
        rib.rotation.y = -ra;
        canopyGroup.add(rib);
      }
      const lanternOrb = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 8), lanternMat);
      lanternOrb.position.set(0, -0.08, 0);
      lanternOrb.userData.noCastShadow = true;
      canopyGroup.add(canopy, trimRing, topFinial, lanternOrb);
      inner.add(canopyGroup);

      addFloorHalo(2.5, 0xffd584, 0.44, 0, 0.028, 0);
      addBulbAura(0.22, 0xffe4a8, 0.34, 0, 2.06, 0);
      inner.scale.setScalar(0.88);
      outer.userData.smartLight = {
        kind: 'garden_lamp',
        localPos: [0, 1.8, 0],
        emissiveMats: [lanternMat],
        haloMats,
        haloMaxOpacities,
      } as SmartLightMeta;
      break;
    }

    case 'wall_clock': {
      // Crisp brushed-aluminum clinical wall clock mounted flush on wall at x = -0.38, y = 1.40
      const dialMat = makeMat({ color: 0xf8fafc, roughness: 0.28 });
      const clockY = 1.4;
      const frame = new THREE.Mesh(new THREE.TorusGeometry(0.215, 0.024, 8, 18), silverMetal);
      frame.rotation.y = Math.PI / 2;
      frame.position.set(-0.37, clockY, 0);
      frame.userData.sharedGlbMat = true;
      inner.add(frame);

      const backCase = cyl(0.22, 0.22, 0.045, darkSlate, -0.382, clockY, 0);
      backCase.rotation.z = Math.PI / 2;

      const face = cyl(0.195, 0.195, 0.018, dialMat, -0.362, clockY, 0);
      face.rotation.z = Math.PI / 2;
      face.userData.noCastShadow = true;

      for (let hi = 0; hi < 12; hi++) {
        const ang = (hi / 12) * Math.PI * 2;
        const isMajor = hi % 3 === 0;
        const tick = box(
          0.012,
          isMajor ? 0.036 : 0.02,
          isMajor ? 0.014 : 0.008,
          darkSlate,
          -0.351,
          clockY + Math.cos(ang) * 0.165,
          Math.sin(ang) * 0.165
        );
        tick.rotation.x = ang;
        tick.userData.noCastShadow = true;
      }

      // Hour, minute, and crimson sweep second hands
      const hrHand = box(0.012, 0.095, 0.014, darkSlate, -0.346, clockY + 0.03, 0.024);
      hrHand.rotation.x = 0.65;
      hrHand.userData.noCastShadow = true;
      const minHand = box(0.012, 0.135, 0.01, darkSlate, -0.343, clockY + 0.045, -0.028);
      minHand.rotation.x = -0.42;
      minHand.userData.noCastShadow = true;
      const secHand = box(0.01, 0.145, 0.006, redAccent, -0.34, clockY, 0.055);
      secHand.rotation.x = 1.8;
      secHand.userData.noCastShadow = true;
      cyl(0.015, 0.015, 0.016, silverMetal, -0.342, clockY, 0).rotation.z = Math.PI / 2;
      break;
    }

    case 'reception_display_stand': {
      // Heavy-duty floor-standing digital display kiosk with twin columns, VESA mount, shelf tray & animated scenic screen
      // Floor baseplate + non-slip rubber leveling feet
      for (const fx of [-0.22, 0.22]) {
        for (const fz of [-0.15, 0.15]) {
          const pad = cyl(0.025, 0.028, 0.018, blackRubber, fx, 0.009, fz);
          pad.userData.noCastShadow = true;
        }
      }
      box(0.56, 0.03, 0.42, darkSlate, 0, 0.032, 0);
      box(0.5, 0.018, 0.36, silverMetal, 0, 0.055, 0);

      // Twin brushed-chrome upright stand poles & rear cable management spine
      for (const px of [-0.125, 0.125]) {
        cyl(0.024, 0.026, 1.46, silverMetal, px, 0.78, -0.04);
        cyl(0.036, 0.038, 0.055, darkSlate, px, 0.088, -0.04);
      }
      box(0.3, 0.045, 0.055, darkSlate, 0, 0.42, -0.04);
      box(0.04, 1.18, 0.028, darkSlate, 0, 0.72, -0.07);

      // Mid-height brochure / tablet ledge shelf
      box(0.42, 0.024, 0.2, whiteBody, 0, 0.74, 0.075);
      box(0.36, 0.012, 0.15, cyanAccent, 0, 0.758, 0.078).userData.noCastShadow = true;

      // VESA mounting bracket behind display
      box(0.38, 0.24, 0.038, darkSlate, 0, 1.44, -0.01);

      // Commercial 16:9 widescreen display head (angled slightly back for reception lounge viewing)
      const headGrp = new THREE.Group();
      headGrp.position.set(0, 1.48, 0.032);
      headGrp.rotation.x = -0.08;
      inner.add(headGrp);

      const casing = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.49, 0.04), darkSlate);
      casing.userData.sharedGlbMat = true;
      const trimBezel = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.51, 0.018), silverMetal);
      trimBezel.position.z = -0.01;
      trimBezel.userData.sharedGlbMat = true;

      const screenPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.79, 0.43), receptionScreenMat);
      screenPlane.position.z = 0.022;
      screenPlane.userData.sharedGlbMat = true;
      screenPlane.userData.noCastShadow = true;

      const statusLed = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.01, 0.01), emeraldAccent);
      statusLed.position.set(0, -0.23, 0.022);
      statusLed.userData.sharedGlbMat = true;
      statusLed.userData.noCastShadow = true;

      const topBar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.024, 0.03), silverMetal);
      topBar.position.set(0, 0.26, 0);
      topBar.userData.sharedGlbMat = true;

      headGrp.add(casing, trimBezel, screenPlane, statusLed, topBar);
      inner.scale.setScalar(0.84);
      break;
    }
  }

  if (isGhost) {
    inner.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const clonedMats = mats.map((orig) => {
          const cloned = (orig as THREE.MeshStandardMaterial).clone();
          cloned.transparent = true;
          cloned.opacity = 0.82;
          return cloned;
        });
        mesh.material = clonedMats.length === 1 ? clonedMats[0] : clonedMats;
        mesh.userData.sharedGlbMat = false;
      }
    });
  }

  const effW = rotation % 2 === 0 ? width : depth;
  const effD = rotation % 2 === 0 ? depth : width;
  inner.rotation.y = (-rotation * Math.PI) / 2;
  outer.userData = { ...outer.userData, effW, effD };
  setShadow(outer, !isGhost, true);
  return outer;
}

export function disposeObject3D(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (!mesh.userData.sharedGlbGeom) {
        mesh.geometry?.dispose();
      }
      if (!mesh.userData.sharedGlbMat) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => m?.dispose());
      }
    }
  });
}
