import * as THREE from 'three';
import { GRID_SIZE } from '../data/catalog';
import { ClinicRoom, SpriteKind } from '../types/clinic';
import { glbRegistry } from './glbRegistry';
import { TextureBundle } from './textures3d';

function setShadow(obj: THREE.Object3D, cast = true, receive = true) {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      if (child.userData.noCastShadow) {
        child.castShadow = false;
        child.receiveShadow = false;
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
  openAmount: number;
  leftLeaf: THREE.Object3D;
  rightLeaf?: THREE.Object3D;
  baseOffset?: number;
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

export interface ClinicWorldHandle {
  group: THREE.Group;
  waterMesh: THREE.Mesh;
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
  dispose: () => void;
}

export function updateDoors3D(
  doors: ClinicDoorHandle[],
  actorPositions: Array<{ x: number; z: number }>,
  unlockedRooms: Set<string>,
  dt: number
) {
  for (const door of doors) {
    let target = 0;
    if (door.alwaysOpen) {
      target = 1;
    } else {
      const canOpen = !door.requiredRoomId || unlockedRooms.has(door.requiredRoomId);
      if (canOpen) {
        for (const pos of actorPositions) {
          if (Math.hypot(pos.x - door.centerX, pos.z - door.centerZ) <= door.triggerRadius) {
            target = 1;
            break;
          }
        }
      }
    }
    door.openAmount = THREE.MathUtils.damp(door.openAmount, target, 7.5, dt);

    if (door.kind === 'sliding_z') {
      const base = door.baseOffset ?? 0.47;
      const slide = door.openAmount * 0.78;
      door.leftLeaf.position.z = -base - slide;
      if (door.rightLeaf) {
        door.rightLeaf.position.z = base + slide;
      }
    } else if (door.kind === 'swing_z') {
      const ang = door.openAmount * 1.42;
      door.leftLeaf.rotation.y = -ang;
      if (door.rightLeaf) {
        door.rightLeaf.rotation.y = ang;
      }
    } else if (door.kind === 'swing_x') {
      const ang = door.openAmount * 1.42;
      door.leftLeaf.rotation.y = ang;
      if (door.rightLeaf) {
        door.rightLeaf.rotation.y = -ang;
      }
    }
  }
}

// Lightweight exterior & clinic architecture builder (vehicle-free for clean mobile FPS)

/**
 * Builds the realistic architectural clinic, sky dome, distant horizon,
 * paved avenue + cars, fountain courtyard, and natural multi-branch trees.
 */
export function buildClinicWorld3D(
  rooms: ClinicRoom[],
  textures: TextureBundle
): ClinicWorldHandle {
  const root = new THREE.Group();
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

        void main() {
          float h = clamp((vWorldPos.y + 4.0) / 55.0, 0.0, 1.0);
          vec3 col = mix(uHorizonColor, uTopColor, pow(h, 0.65));

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
  const skyDome = new THREE.Mesh(trackGeom(new THREE.SphereGeometry(140, 24, 16)), skyMat);
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
        float mixFactor = nMacro * 0.65 + nMid * 0.35;
        vec3 lushTone = vec3(0.76, 0.96, 0.68);
        vec3 dryStraw = vec3(1.06, 1.02, 0.78);
        vec3 deepShade = vec3(0.68, 0.82, 0.62);
        vec3 tint = mix(deepShade, lushTone, smoothstep(0.2, 0.58, mixFactor));
        tint = mix(tint, dryStraw, smoothstep(0.62, 0.95, mixFactor) * 0.55);
        diffuseColor.rgb *= tint;`
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
      color: 0xd8d2c7,
      bumpMap: textures.stuccoBump,
      bumpScale: 0.015,
      roughness: 0.92,
      metalness: 0.0,
    })
  );
  const darkMullionMat = trackMat(makeMat({ color: 0x2c3646, roughness: 0.36, metalness: 0.68 }));
  const aluminumTrimMat = trackMat(makeMat({ color: 0xb0bac6, roughness: 0.44, metalness: 0.5 }));
  const wainscotBlueMat = trackMat(makeMat({ color: 0x205d88, roughness: 0.64, metalness: 0.04 }));
  const woodSlatMat = trackMat(makeMat({ map: textures.wood, roughness: 0.66, metalness: 0.02 }));
  const curtainMat = trackMat(makeMat({ color: 0x5c96b8, roughness: 0.88, side: THREE.DoubleSide }));
  const glassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x9abed9,
      roughness: 0.14,
      metalness: 0.06,
      transparent: true,
      opacity: 0.4,
      clearcoat: 0.75,
      envMapIntensity: 0.6,
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

  // 1. Natural Botanical Rolling Terrain (Flat building pads + undulating meadow + 3D grass tufts)
  const lawnGeom = trackGeom(new THREE.PlaneGeometry(190, 190, 56, 56));
  lawnGeom.rotateX(-Math.PI / 2);
  const posAttr = lawnGeom.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < posAttr.count; i++) {
    const wx = posAttr.getX(i) + GRID_SIZE / 2;
    const wz = posAttr.getZ(i) + GRID_SIZE / 2;
    const inClinicPad = wx >= -1.0 && wx <= 42.5 && wz >= -0.5 && wz <= 24.5;
    const inHousePad = wx >= 2.5 && wx <= 12.5 && wz >= -10.5 && wz <= -0.5;
    if (!inClinicPad && !inHousePad) {
      const distClinic = Math.max(0, Math.hypot(Math.max(0, Math.abs(wx - 15) - 16), Math.max(0, Math.abs(wz - 10) - 14)));
      const blend = Math.min(1, distClinic / 6.0);
      const undulate =
        (Math.sin(wx * 0.14 + wz * 0.09) * 0.24 + Math.cos(wx * 0.07 - wz * 0.16) * 0.18) * blend;
      posAttr.setY(i, undulate);
    }
  }
  lawnGeom.computeVertexNormals();
  const outerLawn = new THREE.Mesh(lawnGeom, grassMat);
  outerLawn.position.set(GRID_SIZE / 2, -0.03, GRID_SIZE / 2);
  outerLawn.receiveShadow = true;
  root.add(outerLawn);

  // Uneven 3D Instanced Grass Tufts scattered organically across the meadow lawn (single draw call)
  const tuftGeom = trackGeom(new THREE.ConeGeometry(0.055, 0.24, 3));
  tuftGeom.translate(0, 0.12, 0);
  const tuftMat = trackMat(makeMat({ color: 0xffffff, roughness: 0.9, metalness: 0.0 }));
  const tuftPositions: Array<[number, number, number, number, number]> = [];
  for (let i = 0; i < 360; i++) {
    const gx = (Math.sin(i * 73.1 + 0.4) * 0.5 + 0.5) * 44 - 8;
    const gz = (Math.cos(i * 41.7 + 1.9) * 0.5 + 0.5) * 42 - 11;
    if (gx >= 1.6 && gx <= 39.2 && gz >= 1.6 && gz <= 22.6) continue; // keep clinic/courtyard/street clean
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
  root.add(tuftInst);

  const distantHillMat = trackMat(makeMat({ color: 0x4b6e36, roughness: 0.96 }));
  const campusWallMat = trackMat(makeMat({ color: 0xdad1c4, bumpMap: textures.stuccoBump, bumpScale: 0.015, roughness: 0.88 }));
  const shingleMat = trackMat(makeMat({ map: textures.roofShingle, roughness: 0.84 }));
  const shutterMat = trackMat(makeMat({ color: 0x3b5249, roughness: 0.72 }));
  const ridgeCoords: Array<[number, number, number, number]> = [
    [-46, -42, 28, 4.8],
    [14, -58, 36, 5.6],
    [62, -40, 28, 4.4],
    [-46, 46, 30, 4.8],
  ];
  for (const [rx, rz, rw, rh] of ridgeCoords) {
    const hill = new THREE.Mesh(trackGeom(new THREE.SphereGeometry(rw, 24, 14)), distantHillMat);
    hill.scale.set(1.5, rh / rw, 1.0);
    hill.position.set(rx, -0.9, rz);
    root.add(hill);
  }

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

  // 2. Natural Garden Flagstone Promenade & Imperfect Sandy-Gravel Garden Street (zero asphalt!)
  const promenade = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(2.58, 0.08, 98)), sidewalkMat);
  promenade.position.set(28.4, 0.015, 12);
  promenade.receiveShadow = true;
  root.add(promenade);

  // Subtle weathered stone garden edging along courtyard perimeter
  const promCurb = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.22, 0.11, 82)), curbMat);
  promCurb.position.set(27.05, 0.03, 12);
  promCurb.receiveShadow = true;
  root.add(promCurb);

  // Main Imperfect Natural Garden Lane (packed sandy earth, fine gravel & organic footpath ruts)
  const gardenLane = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(8.5, 0.04, 102)), asphaltMat);
  gardenLane.position.set(33.9, -0.02, 12);
  gardenLane.receiveShadow = true;
  root.add(gardenLane);

  // Soft grassy soil verge flanking eastern side of garden lane (x = 38.15 .. 40.6)
  const vergeSoilMat = trackMat(makeMat({ color: 0x5c723e, roughness: 0.96 }));
  const eastVerge = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(2.6, 0.045, 102)), vergeSoilMat);
  eastVerge.position.set(39.4, -0.01, 12);
  eastVerge.receiveShadow = true;
  root.add(eastVerge);

  // Instanced Rustic Stone Border Cobbles along walkway edge (irregular organic placement, 1 draw call)
  const cobbleGeom = trackGeom(new THREE.BoxGeometry(0.26, 0.09, 0.42));
  const cobbleMat = trackMat(makeMat({ color: 0xffffff, roughness: 0.9 }));
  const cobbleCoords: Array<[number, number, number, number, number]> = [];
  for (let z = -28; z <= 50; z += 0.56) {
    if (z >= 13.6 && z <= 16.4) continue; // natural entrance path gap
    if (Math.abs(Math.round(z * 1.7)) % 9 === 0) continue; // occasional missing/sunken cobble for realism
    const jx = Math.sin(z * 3.1) * 0.055;
    const jRot = Math.cos(z * 2.4) * 0.14;
    const scZ = 0.85 + (Math.abs(Math.sin(z * 5.2)) * 0.35);
    cobbleCoords.push([29.68 + jx, 0.018, z, jRot, scZ]);
  }
  const cobbleInst = new THREE.InstancedMesh(cobbleGeom, cobbleMat, cobbleCoords.length);
  cobbleInst.receiveShadow = true;
  cobbleInst.castShadow = true;
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
  root.add(cobbleInst);

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
  root.add(stepInst);

  // Instanced Garden Lane Border Grass Tufts & Pebbles along organic margins (1 draw call)
  const laneTuftCoords: Array<[number, number, number]> = [];
  for (let i = 0; i < 64; i++) {
    const gz = -18 + i * 0.92 + (Math.sin(i * 4.3) * 0.25);
    if (gz >= 13.6 && gz <= 16.4) continue;
    const sideX = i % 2 === 0 ? 29.88 + Math.abs(Math.sin(i * 2.1)) * 0.28 : 37.75 - Math.abs(Math.cos(i * 3.1)) * 0.35;
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
  root.add(laneTuftInst);

  // Natural Low Wooden Garden Bollards along walkway corners + 2 Rustic Timber Garden Benches
  for (const bz of [5.4, 13.2, 16.8, 22.8]) {
    const bollard = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.065, 0.075, 0.56, 8)), woodSlatMat);
    bollard.position.set(29.75, 0.28, bz);
    bollard.castShadow = true;
    root.add(bollard);
  }
  for (const bz of [7.8, 19.8]) {
    const legA = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.44, 0.34, 0.08)), darkMullionMat);
    legA.position.set(38.25, 0.17, bz - 0.62);
    const legB = legA.clone();
    legB.position.set(38.25, 0.17, bz + 0.62);
    const seat = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.46, 0.06, 1.54)), woodSlatMat);
    seat.position.set(38.25, 0.37, bz);
    seat.castShadow = true;
    const back = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.07, 0.34, 1.54)), woodSlatMat);
    back.position.set(38.46, 0.56, bz);
    back.rotation.z = -0.15;
    back.castShadow = true;
    root.add(legA, legB, seat, back);
  }

  // Courtyard travertine stone walkway + wide entrance steps from open gate (x=27) to glass doors (x=22)
  const walkway = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(5.2, 0.08, 2.75)), paverMat);
  walkway.position.set(24.55, 0.025, 15.0);
  walkway.receiveShadow = true;
  root.add(walkway);

  // 3 wide architectural stone steps leading up to the sliding glass clinic entrance
  for (let si = 0; si < 3; si++) {
    const stepMesh = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(0.34, 0.045 + (2 - si) * 0.022, 2.75 - si * 0.06)),
      paverMat
    );
    stepMesh.position.set(22.22 + si * 0.28, 0.05 + (2 - si) * 0.022, 15.0);
    stepMesh.receiveShadow = true;
    root.add(stepMesh);
  }

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

  // Modern Courtyard Reflecting Pool / Fountain (centered at x=25.0, z=8.0 -> tiles 24..25, 7..8)
  const poolBasin = new THREE.Mesh(
    trackGeom(new THREE.BoxGeometry(1.78, 0.22, 1.78)),
    trackMat(makeMat({ color: 0xbdc6d0, roughness: 0.56 }))
  );
  poolBasin.position.set(25.0, 0.1, 8.0);
  poolBasin.castShadow = true;
  poolBasin.receiveShadow = true;
  root.add(poolBasin);
  const waterMesh = new THREE.Mesh(
    trackGeom(new THREE.BoxGeometry(1.5, 0.12, 1.5)),
    trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0x3b8ea5,
        roughness: 0.08,
        metalness: 0.05,
        transmission: 0.45,
        transparent: true,
        opacity: 0.84,
        clearcoat: 1.0,
      })
    )
  );
  waterMesh.position.set(25.0, 0.15, 8.0);
  root.add(waterMesh);
  const fountainSpout = new THREE.Mesh(
    trackGeom(new THREE.CylinderGeometry(0.11, 0.17, 0.36, 12)),
    aluminumTrimMat
  );
  fountainSpout.position.set(25.0, 0.27, 8.0);
  root.add(fountainSpout);

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

  // Unlit Municipal Sidewalk Utility Poles on far eastern roadside (x=38.0) — clinic outdoor lighting comes from player's purchased lamps!
  for (const sz of [3.5, 22.5]) {
    const pole = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.05, 0.07, 3.05, 8)), darkMullionMat);
    pole.position.set(38.1, 1.52, sz);
    pole.castShadow = true;
    const arm = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.55, 0.06, 0.08)), darkMullionMat);
    arm.position.set(37.85, 3.02, sz);
    root.add(pole, arm);
  }

  // Courtyard & roadside shrubs (placed safely off the asphalt road)
  const bushCoords: Array<[number, number, string]> = [
    [22.48, 3.2, 'bush_1'],
    [22.48, 12.4, 'bush_2'],
    [26.45, 3.8, 'bush_1'],
    [26.45, 20.6, 'bush_2'],
    [1.4, 22.6, 'bush_2'],
    [20.8, 22.6, 'bush_1'],
    [38.8, 5.5, 'bush_1'],
    [38.8, 17.5, 'bush_2'],
  ];
  for (const [bx, bz, key] of bushCoords) {
    const bush = glbRegistry.cloneNormalized(key, { targetHeight: 0.62, rotY: bx + bz });
    if (bush) {
      bush.position.set(bx, 0.02, bz);
      root.add(bush);
    }
  }
  for (const [gx, gz] of [
    [0.8, 4.2],
    [0.9, 12.2],
    [4.4, 0.9],
    [14.4, 0.9],
    [23.2, 0.9],
    [11.4, 23.2],
    [38.6, 10.8],
  ]) {
    const grassClump = glbRegistry.cloneNormalized('grass_clump', { targetHeight: 0.34, rotY: gx * 2 });
    if (grassClump) {
      grassClump.position.set(gx, 0.0, gz);
      root.add(grassClump);
    }
  }

  // 4. Expanded Indoor Clinic Foundation Slab & Honed Room Floors (x: 2..22, z: 2..22 -> 20m x 20m!)
  const plinth = new THREE.Mesh(
    trackGeom(new THREE.BoxGeometry(20.65, 0.09, 20.65)),
    trackMat(makeMat({ color: 0x9aa4b0, roughness: 0.85 }))
  );
  plinth.position.set(12.0, -0.02, 12.0);
  plinth.receiveShadow = true;
  root.add(plinth);

  const slab = new THREE.Mesh(
    trackGeom(new THREE.BoxGeometry(20.28, 0.14, 20.28)),
    trackMat(makeMat({ color: 0xc2cbd6, roughness: 0.72 }))
  );
  slab.position.set(12.0, 0.02, 12.0);
  slab.receiveShadow = true;
  root.add(slab);

  for (const room of rooms) {
    const w = room.maxX - room.minX + 1;
    const d = room.maxY - room.minY + 1;
    const cx = room.minX + w / 2;
    const cz = room.minY + d / 2;

    let mat: THREE.MeshStandardMaterial;
    if (!room.unlocked) {
      mat = trackMat(makeMat({ color: 0x475569, roughness: 0.78, metalness: 0.08 }));
    } else if (room.floorTheme === 'gym_royal') {
      const gymTex = textures.gymRoyal.clone();
      gymTex.needsUpdate = true;
      gymTex.repeat.set(w * 0.5, d * 0.5);
      disposables.push(gymTex);
      mat = trackMat(makeMat({ map: gymTex, roughness: 0.58, metalness: 0.05 }));
    } else if (room.floorTheme === 'tile_mint') {
      const mintTex = textures.tileMint.clone();
      mintTex.needsUpdate = true;
      mintTex.repeat.set(w * 0.5, d * 0.5);
      disposables.push(mintTex);
      mat = trackMat(
        makeMat({
          map: mintTex,
          roughnessMap: textures.tileBlueRough,
          bumpMap: textures.tileBump,
          bumpScale: 0.008,
          roughness: 0.8,
          metalness: 0.06,
        })
      );
    } else {
      const blueTex = textures.tileBlue.clone();
      blueTex.needsUpdate = true;
      blueTex.repeat.set(w * 0.5, d * 0.5);
      disposables.push(blueTex);
      mat = trackMat(
        makeMat({
          map: blueTex,
          roughnessMap: textures.tileBlueRough,
          bumpMap: textures.tileBump,
          bumpScale: 0.008,
          roughness: 0.78,
          metalness: 0.08,
        })
      );
    }

    const floorMesh = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(w - 0.02, 0.05, d - 0.02)), mat);
    floorMesh.position.set(cx, 0.06, cz);
    floorMesh.receiveShadow = true;
    root.add(floorMesh);

    if (!room.unlocked) {
      const cover = new THREE.Mesh(
        trackGeom(new THREE.BoxGeometry(w - 0.14, 0.08, d - 0.14)),
        trackMat(
          new THREE.MeshPhysicalMaterial({
            color: 0x1e293b,
            transparent: true,
            opacity: 0.62,
            roughness: 0.3,
          })
        )
      );
      cover.position.set(cx, 1.74, cz);
      root.add(cover);
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
      wallBar.position.set(cx, 2.72, 2.16);
      barHousing.position.set(cx, 2.78, 2.15);
      northWash.position.set(cx, 1.62, 2.14);
      northWash.scale.set(3.8, 2.25, 1);
      northFloorPool.position.set(cx, 0.092, 3.25);
      northFloorPool.scale.set(4.4, 2.5, 1);
    } else {
      wallBar.position.set(cx, 1.62, room.minY + 0.12);
      barHousing.position.set(cx, 1.68, room.minY + 0.11);
      northWash.position.set(cx, 0.88, room.minY + 0.1);
      northWash.scale.set(3.4, 1.48, 1);
      northFloorPool.position.set(cx, 0.092, room.minY + 1.15);
      northFloorPool.scale.set(4.1, 2.35, 1);
    }
    root.add(barHousing, wallBar, northWash, northFloorPool);

    // 2) West / Vertical Divider Wall Sconce
    const sideWash = new THREE.Mesh(sconceUnitPlane, wMat);
    sideWash.rotation.y = Math.PI / 2;
    const sideFloorPool = new THREE.Mesh(sconceUnitPlane, pMat);
    sideFloorPool.rotation.x = -Math.PI / 2;

    if (room.minX === 2) {
      const sideBar = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.11, 0.08, 2.6)), rMat);
      sideBar.position.set(2.16, 2.72, cz);
      const sideHousing = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.14, 0.11, 2.74)), darkMullionMat);
      sideHousing.position.set(2.15, 2.78, cz);
      sideWash.position.set(2.14, 1.62, cz);
      sideWash.scale.set(3.8, 2.25, 1);
      sideFloorPool.position.set(3.25, 0.092, cz);
      sideFloorPool.scale.set(2.5, 4.4, 1);
      root.add(sideHousing, sideBar, sideWash, sideFloorPool);
    } else {
      const divBar = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.11, 0.08, 2.4)), rMat);
      divBar.position.set(12.14, 1.56, cz);
      const divHousing = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.14, 0.11, 2.54)), darkMullionMat);
      divHousing.position.set(12.13, 1.62, cz);
      sideWash.position.set(12.1, 0.86, cz);
      sideWash.scale.set(3.2, 1.44, 1);
      sideFloorPool.position.set(13.15, 0.092, cz);
      sideFloorPool.scale.set(2.35, 4.1, 1);
      root.add(divHousing, divBar, sideWash, sideFloorPool);
    }

    // 3) Smart primary wall-sconce anchor (places dynamic PointLight directly at the side wall sconce)
    if (room.minX === 2) {
      roomSconceAnchors.set(room.id, { x: 2.95, y: 2.25, z: cz });
    } else if (room.minY === 2) {
      roomSconceAnchors.set(room.id, { x: cx, y: 2.25, z: 2.95 });
    } else {
      roomSconceAnchors.set(room.id, { x: 12.95, y: 1.72, z: cz });
    }
  }

  // 5. Taller Architectural Clinic Building (3.45m outer perimeter walls, 2.95m facade, 1.66m interior partitions)
  const addWallSpan = (
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    height: number,
    thickness = 0.2,
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

    if (hasWindow && height >= 0.85) {
      const kneeH = height < 1.2 ? 0.42 : 0.56;
      const knee = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(sx, kneeH, sz)), stuccoWhiteMat);
      knee.position.set(cx, 0.07 + kneeH / 2, cz);
      knee.castShadow = true;
      knee.receiveShadow = true;
      root.add(knee);

      const glassH = height - kneeH - 0.1;
      const gsX = isAlongX ? len - 0.16 : 0.04;
      const gsZ = isAlongX ? 0.04 : len - 0.16;
      const pane = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(gsX, glassH, gsZ)), glassMat);
      pane.position.set(cx, 0.07 + kneeH + glassH / 2, cz);
      root.add(pane);

      const topFrame = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(sx, 0.1, sz)), darkMullionMat);
      topFrame.position.set(cx, 0.07 + height - 0.05, cz);
      root.add(topFrame);
      return;
    }

    const baseH = Math.min(height * 0.28, 0.42);
    const wain = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(sx, baseH, sz)), wainscotBlueMat);
    wain.position.set(cx, 0.07 + baseH / 2, cz);
    wain.castShadow = true;
    wain.receiveShadow = true;
    root.add(wain);

    const upperH = Math.max(0.06, height - baseH);
    const upper = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(sx, upperH, sz)), stuccoWhiteMat);
    upper.position.set(cx, 0.07 + baseH + upperH / 2, cz);
    upper.castShadow = true;
    upper.receiveShadow = true;
    root.add(upper);

    const cap = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(sx + 0.04, 0.07, sz + 0.04)),
      aluminumTrimMat
    );
    cap.position.set(cx, 0.07 + height + 0.035, cz);
    root.add(cap);
  };

  // Back perimeter walls (tall 3.45m, x: 2..22, z: 2..22)
  addWallSpan(2, 2, 22, 2, 3.45, 0.24);
  addWallSpan(2, 2, 2, 22, 3.45, 0.24);

  // Recessed warm LED cove strip along top of back walls (clean architectural cornice)
  const ledStripBack = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(19.2, 0.05, 0.08)), warmLedMat);
  ledStripBack.position.set(12.0, 3.34, 2.18);
  const ledStripLeft = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.08, 0.05, 19.2)), warmLedMat);
  ledStripLeft.position.set(2.18, 3.34, 12.0);
  root.add(ledStripBack, ledStripLeft);

  // Cutaway front-left wall (z=22, glazed knee wall H=1.12 so interior stays clearly visible)
  addWallSpan(2, 22, 7.2, 22, 1.12, 0.2, true);
  addWallSpan(7.2, 22, 12.4, 22, 1.12, 0.2);
  addWallSpan(12.4, 22, 22, 22, 1.12, 0.2, true);

  // Tall Front Storefront Curtain Wall (x = 22, H=2.95m, entrance opening z = 14..16)
  addWallSpan(22, 2, 22, 14, 2.95, 0.2, true);
  addWallSpan(22, 16, 22, 22, 2.95, 0.2, true);

  // Architectural timber louver accent columns flanking main clinic entrance (x=22, z=13.1..16.9)
  for (let lz = 13.15; lz <= 13.65; lz += 0.18) {
    const slat = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.16, 3.12, 0.06)), woodSlatMat);
    slat.position.set(22.16, 1.63, lz);
    slat.castShadow = true;
    root.add(slat);
  }
  for (let lz = 16.35; lz <= 16.85; lz += 0.18) {
    const slat = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.16, 3.12, 0.06)), woodSlatMat);
    slat.position.set(22.16, 1.63, lz);
    slat.castShadow = true;
    root.add(slat);
  }

  // Interior Partition Walls (H = 1.66m — taller & realistic, yet easy to see over into every wing!)
  addWallSpan(2, 10, 6, 10, 1.66, 0.16);
  addWallSpan(7, 10, 16, 10, 1.66, 0.16);
  addWallSpan(17, 10, 22, 10, 1.66, 0.16);

  addWallSpan(12, 2, 12, 5, 1.66, 0.16);
  addWallSpan(12, 6, 12, 14, 1.66, 0.16);
  addWallSpan(12, 15, 12, 22, 1.66, 0.16);

  // Mounted Reception Brand Logo + Framed License Certificate + Anatomy Chart (cleanly positioned on walls)
  const wallLogo = new THREE.Mesh(
    trackGeom(new THREE.BoxGeometry(0.05, 0.68, 2.2)),
    trackMat(makeMat({ map: textures.therasonWall, roughness: 0.35 }))
  );
  wallLogo.position.set(12.11, 1.08, 18.6);
  root.add(wallLogo);

  const wallCert = new THREE.Mesh(
    trackGeom(new THREE.BoxGeometry(0.04, 0.46, 0.6)),
    trackMat(makeMat({ map: textures.certificateFrame, roughness: 0.4 }))
  );
  wallCert.position.set(12.11, 1.1, 12.0);
  root.add(wallCert);

  const wallChart = new THREE.Mesh(
    trackGeom(new THREE.BoxGeometry(0.04, 0.96, 0.7)),
    trackMat(makeMat({ map: textures.anatomyPoster, roughness: 0.42 }))
  );
  wallChart.position.set(2.16, 1.92, 15.8);
  root.add(wallChart);

  // Normal Single-Leaf Interior Doors (standard ~0.92m single door opening, matching raised partitions)
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
          new THREE.BoxGeometry(axis === 'z' ? 0.2 : 0.07, 1.66, axis === 'z' ? 0.07 : 0.2)
        ),
        darkMullionMat
      );
      jamb.position.set(
        axis === 'z' ? cx : cx + side * 0.48,
        0.9,
        axis === 'z' ? cz + side * 0.48 : cz
      );
      root.add(jamb);
    }

    const piv = new THREE.Group();
    piv.position.set(axis === 'z' ? cx : cx - 0.45, 0.08, axis === 'z' ? cz - 0.45 : cz);
    const len = 0.88;
    const body = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(axis === 'z' ? 0.055 : len, 1.58, axis === 'z' ? len : 0.055)),
      woodSlatMat
    );
    body.position.set(axis === 'z' ? 0 : len / 2, 0.79, axis === 'z' ? len / 2 : 0);
    body.castShadow = true;

    const visionGlass = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(axis === 'z' ? 0.065 : 0.28, 0.54, axis === 'z' ? 0.28 : 0.065)),
      glassMat
    );
    visionGlass.position.set(axis === 'z' ? 0 : len * 0.58, 1.12, axis === 'z' ? len * 0.58 : 0);

    const handle = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(axis === 'z' ? 0.1 : 0.14, 0.035, axis === 'z' ? 0.14 : 0.1)),
      aluminumTrimMat
    );
    handle.position.set(axis === 'z' ? 0 : len * 0.82, 0.84, axis === 'z' ? len * 0.82 : 0);

    piv.add(body, visionGlass, handle);
    root.add(piv);

    doors.push({
      id,
      kind: axis === 'z' ? 'swing_z' : 'swing_x',
      centerX: cx,
      centerZ: cz,
      triggerRadius: 2.0,
      requiredRoomId,
      openAmount: 0,
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
  for (const dz of [-1.06, 1.06]) {
    const col = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.36, 3.12, 0.32)), stuccoWhiteMat);
    col.position.set(0, 1.56, dz);
    col.castShadow = true;
    const sconce = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.14, 0.32, 0.14)), entranceSconceMat);
    sconce.position.set(0.22, 1.88, dz);
    entranceGroup.add(col, sconce);
  }
  const makeSlidingPanel = (zOffset: number) => {
    const panelGroup = new THREE.Group();
    panelGroup.position.set(0, 0.08, zOffset);
    const frame = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.07, 2.44, 0.94)), darkMullionMat);
    frame.position.y = 1.22;
    const pane = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.035, 2.16, 0.8)), glassMat);
    pane.position.y = 1.26;
    const kick = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.08, 0.18, 0.92)), aluminumTrimMat);
    kick.position.y = 0.09;
    const pullBar = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.11, 0.54, 0.035)), aluminumTrimMat);
    pullBar.position.set(0, 1.12, zOffset < 0 ? 0.34 : -0.34);
    panelGroup.add(frame, pane, kick, pullBar);
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
    triggerRadius: 2.6,
    openAmount: 0,
    leftLeaf: mainLeftSlide,
    rightLeaf: mainRightSlide,
    baseOffset: 0.47,
  });

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
  root.add(entranceGroup);

  // 7. High-Detail Botanical Oak Tree Template (flared roots + textured bark boughs + layered alpha-cutout leaf cards)
  // Cloned with natural scale/rotation variation across the landscape!
  const barkMat = trackMat(makeMat({ map: textures.bark, roughness: 0.94, metalness: 0.0 }));
  const leafCardMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.leafFoliage,
      alphaTest: 0.42,
      side: THREE.DoubleSide,
      roughness: 0.82,
      metalness: 0.0,
    })
  );
  const innerShadeMat = trackMat(makeMat({ color: 0x264f1c, roughness: 0.92 }));

  const trunkBaseGeom = trackGeom(new THREE.CylinderGeometry(0.11, 0.21, 1.35, 10));
  const rootFlareGeom = trackGeom(new THREE.CylinderGeometry(0.04, 0.09, 0.42, 6));
  const mainBoughGeom = trackGeom(new THREE.CylinderGeometry(0.055, 0.095, 0.92, 8));
  const twigGeom = trackGeom(new THREE.CylinderGeometry(0.024, 0.046, 0.56, 6));
  const leafCardGeom = trackGeom(new THREE.PlaneGeometry(1.12, 1.12));
  const crownCoreGeom = trackGeom(new THREE.DodecahedronGeometry(0.46, 1));

  const buildRealisticTreeTemplate = () => {
    const t = new THREE.Group();
    const trunk = new THREE.Mesh(trunkBaseGeom, barkMat);
    trunk.position.y = 0.67;
    trunk.rotation.z = 0.025;
    t.add(trunk);

    // 4 flared root buttresses anchoring tree naturally into uneven grass
    for (let ri = 0; ri < 4; ri++) {
      const ra = (ri / 4) * Math.PI * 2 + 0.4;
      const rf = new THREE.Mesh(rootFlareGeom, barkMat);
      rf.position.set(Math.cos(ra) * 0.15, 0.14, Math.sin(ra) * 0.15);
      rf.rotation.z = -Math.cos(ra) * 0.58;
      rf.rotation.x = Math.sin(ra) * 0.58;
      t.add(rf);
    }

    // 4 diverging primary boughs + twigs + crossed alpha-tested botanical foliage sprays
    const boughs = [
      { ang: 0.35, tilt: 0.58, h: 1.45, r: 0.34 },
      { ang: 1.95, tilt: 0.52, h: 1.54, r: 0.32 },
      { ang: 3.5, tilt: 0.62, h: 1.42, r: 0.36 },
      { ang: 5.05, tilt: 0.48, h: 1.58, r: 0.3 },
    ];
    for (const bg of boughs) {
      const bx = Math.cos(bg.ang) * bg.r;
      const bz = Math.sin(bg.ang) * bg.r;
      const bough = new THREE.Mesh(mainBoughGeom, barkMat);
      bough.position.set(bx * 0.72, bg.h, bz * 0.72);
      bough.rotation.z = -Math.cos(bg.ang) * bg.tilt;
      bough.rotation.x = Math.sin(bg.ang) * bg.tilt;
      t.add(bough);

      for (const subOff of [-0.45, 0.45]) {
        const sa = bg.ang + subOff;
        const twig = new THREE.Mesh(twigGeom, barkMat);
        twig.position.set(bx * 1.45 + Math.cos(sa) * 0.14, bg.h + 0.44, bz * 1.45 + Math.sin(sa) * 0.14);
        twig.rotation.z = -Math.cos(sa) * 0.72;
        twig.rotation.x = Math.sin(sa) * 0.72;
        t.add(twig);

        const fx = bx * 1.85 + Math.cos(sa) * 0.26;
        const fy = bg.h + 0.66;
        const fz = bz * 1.85 + Math.sin(sa) * 0.26;
        for (let ci = 0; ci < 3; ci++) {
          const card = new THREE.Mesh(leafCardGeom, leafCardMat);
          card.position.set(fx, fy, fz);
          card.rotation.set(
            (ci === 2 ? Math.PI / 2 - 0.3 : 0.25),
            sa + (ci * Math.PI) / 3,
            ci === 1 ? 0.35 : -0.2
          );
          card.scale.setScalar(0.88 + (ci % 2) * 0.18);
          t.add(card);
        }
      }

      const innerCore = new THREE.Mesh(crownCoreGeom, innerShadeMat);
      innerCore.position.set(bx * 1.55, bg.h + 0.52, bz * 1.55);
      innerCore.scale.set(0.88, 0.68, 0.88);
      t.add(innerCore);
    }

    // Upper crown sunlit canopy cards
    const topCore = new THREE.Mesh(crownCoreGeom, innerShadeMat);
    topCore.position.set(0, 2.38, 0);
    topCore.scale.set(1.05, 0.72, 1.05);
    t.add(topCore);
    for (let ti = 0; ti < 5; ti++) {
      const ta = (ti / 5) * Math.PI * 2;
      const topCard = new THREE.Mesh(leafCardGeom, leafCardMat);
      topCard.position.set(Math.cos(ta) * 0.24, 2.48 + (ti % 2) * 0.16, Math.sin(ta) * 0.24);
      topCard.rotation.set(0.55 + (ti % 2) * 0.35, ta, 0.2);
      topCard.scale.setScalar(1.05);
      t.add(topCard);
    }

    setShadow(t, true, true);
    return t;
  };

  const masterTree = buildRealisticTreeTemplate();

  const treeCoords: Array<[number, number, number, number]> = [
    [-0.2, 0.2, 1.24, 0.4],
    [0.2, 9.4, 1.04, 1.8],
    [0.1, 18.4, 1.18, 3.1],
    [0.8, 24.4, 1.26, 0.9],
    [8.4, 24.2, 0.96, 2.5],
    [16.4, 24.2, 1.12, 4.2],
    [13.4, -0.4, 1.08, 1.2],
    [2.6, -4.6, 1.28, 2.1],
    [12.4, -5.0, 1.18, 5.0],
    [24.4, 0.3, 0.94, 3.6],
    [25.2, 24.2, 1.14, 0.6],
    [39.4, 3.4, 1.22, 2.9],
    [39.6, 19.8, 1.16, 4.7],
    [40.2, 11.4, 0.94, 1.5],
  ];

  treeCoords.forEach(([tx, tz, sc, rotY]) => {
    const ao = new THREE.Mesh(aoPlaneGeom, contactAoMat);
    ao.rotation.x = -Math.PI / 2;
    ao.scale.set(2.3 * sc, 2.3 * sc, 1);
    ao.position.set(tx, 0.014, tz);
    ao.castShadow = false;
    root.add(ao);

    const tg = masterTree.clone(true);
    tg.position.set(tx, 0, tz);
    tg.rotation.y = rotY;
    tg.scale.setScalar(sc * 1.12);
    root.add(tg);
  });

  return {
    group: root,
    waterMesh,
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
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
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

  const whiteBody = makeMat({ color: 0xdadfe6, roughness: 0.54, metalness: 0.05 });
  const silverMetal = makeMat({ color: 0xb0b8c2, roughness: 0.34, metalness: 0.68 });
  const darkSlate = makeMat({ color: 0x243042, roughness: 0.54, metalness: 0.2 });
  const blueUpholstery = makeMat({ color: 0x225d8a, roughness: 0.62, metalness: 0.04 });
  const cyanAccent = makeMat({ color: 0x2e7fa8, roughness: 0.44, metalness: 0.08 });
  const woodMat = makeMat({ map: textures.wood, roughness: 0.66, metalness: 0.02 });
  const leafGreen = makeMat({ color: 0x3b6e2d, roughness: 0.86 });
  const ceramicPot = makeMat({ color: 0xc5bdb0, roughness: 0.56 });

  const aoPlaneMat = !isGhost
    ? new THREE.MeshBasicMaterial({
        map: textures.contactShadow,
        transparent: true,
        depthWrite: false,
      })
    : null;

  if (aoPlaneMat && sprite !== 'floor_rug') {
    const ao = new THREE.Mesh(
      new THREE.PlaneGeometry(width * 0.96, depth * 0.96),
      aoPlaneMat
    );
    ao.rotation.x = -Math.PI / 2;
    ao.position.y = 0.018;
    ao.userData.noCastShadow = true;
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

  const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    inner.add(m);
    return m;
  };
  const cyl = (rt: number, rb: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 14), mat);
    m.position.set(x, y, z);
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
    inner.add(m);
    return m;
  };

  const blackRubber = makeMat({ color: 0x111827, roughness: 0.78, metalness: 0.08 });
  const warmTimber = makeMat({ color: 0x9c6b3f, roughness: 0.62, metalness: 0.03 });
  const redAccent = makeMat({ color: 0xdc2626, roughness: 0.36, metalness: 0.1 });
  const emeraldAccent = makeMat({ color: 0x10b981, roughness: 0.36, metalness: 0.1 });
  const amberAccent = makeMat({ color: 0xf59e0b, roughness: 0.35, metalness: 0.15 });
  const frostGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xdbeafe,
    transparent: true,
    opacity: 0.56,
    roughness: 0.16,
    metalness: 0.02,
  });

  switch (sprite) {
    case 'treatment_bed': {
      const glbBed = glbRegistry.cloneNormalized('furn_bed_single', {
        maxFootprint: { w: 1.72, d: 0.86 },
        rotY: Math.PI / 2,
      });
      if (glbBed) {
        inner.add(glbBed);
        box(1.06, 0.02, 0.72, blueUpholstery, 0.16, 0.355, 0);
      } else {
        for (const lx of [-0.72, 0.72]) {
          for (const lz of [-0.32, 0.32]) {
            cyl(0.035, 0.035, 0.44, silverMetal, lx, 0.22, lz);
          }
        }
        box(1.62, 0.06, 0.72, whiteBody, 0, 0.44, 0);
        box(1.56, 0.11, 0.68, blueUpholstery, 0, 0.52, 0);
        const head = box(0.42, 0.1, 0.64, blueUpholstery, -0.56, 0.58, 0);
        head.rotation.z = -0.18;
        box(0.24, 0.08, 0.42, whiteBody, -0.62, 0.66, 0);
      }
      break;
    }

    case 'reception_desk': {
      const glbDesk = glbRegistry.cloneNormalized('furn_desk', {
        maxFootprint: { w: 1.72, d: 0.72 },
        targetHeight: 0.74,
      });
      if (glbDesk) {
        glbDesk.position.set(0, 0, 0.1);
        inner.add(glbDesk);
        const ledApron = box(
          1.45,
          0.04,
          0.04,
          makeMat({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 0.85 }),
          0,
          0.08,
          0.42
        );
        ledApron.userData.noCastShadow = true;
        const mon = glbRegistry.cloneNormalized('furn_monitor', {
          targetHeight: 0.34,
          rotY: Math.PI,
        });
        if (mon) {
          mon.position.set(0.18, 0.73, 0.08);
          inner.add(mon);
        }
        const lamp = glbRegistry.cloneNormalized('furn_lamp_desk', {
          targetHeight: 0.3,
          rotY: -0.6,
        });
        if (lamp) {
          lamp.position.set(-0.56, 0.73, 0.18);
          inner.add(lamp);
        }
        const chair = glbRegistry.cloneNormalized('furn_chair_desk', {
          targetHeight: 0.86,
          rotY: Math.PI,
        });
        if (chair) {
          chair.position.set(-0.1, 0, -0.42);
          inner.add(chair);
        }
      } else {
        box(1.68, 0.72, 0.54, whiteBody, 0, 0.36, 0.1);
        box(1.64, 0.32, 0.56, blueUpholstery, 0, 0.2, 0.12);
        const ledApron = box(
          1.54,
          0.04,
          0.04,
          makeMat({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 0.85 }),
          0,
          0.05,
          0.4
        );
        ledApron.userData.noCastShadow = true;
        box(1.76, 0.07, 0.64, woodMat, 0, 0.75, 0.08);
        box(1.1, 0.22, 0.22, whiteBody, 0, 0.86, 0.26);
        box(0.08, 0.16, 0.08, darkSlate, 0.18, 0.85, 0.04);
        box(0.46, 0.28, 0.04, darkSlate, 0.18, 1.0, 0.04);
        const recScr = box(
          0.42,
          0.23,
          0.02,
          makeMat({ map: textures.ecgScreen, emissive: 0x38bdf8, emissiveIntensity: 0.35 }),
          0.18,
          1.0,
          0.02
        );
        recScr.userData.noCastShadow = true;
        cyl(0.04, 0.18, 0.24, darkSlate, -0.1, 0.12, -0.32);
        box(0.36, 0.08, 0.34, blueUpholstery, -0.1, 0.36, -0.32);
        box(0.34, 0.4, 0.08, blueUpholstery, -0.1, 0.58, -0.45);
      }
      break;
    }

    case 'waiting_chairs': {
      const glbCouch = glbRegistry.cloneNormalized('furn_couch', {
        maxFootprint: { w: 1.78, d: 0.86 },
        targetHeight: 0.78,
      });
      if (glbCouch) {
        inner.add(glbCouch);
      } else {
        box(1.7, 0.06, 0.1, silverMetal, 0, 0.28, 0);
        cyl(0.035, 0.04, 0.28, silverMetal, -0.7, 0.14, 0);
        cyl(0.035, 0.04, 0.28, silverMetal, 0.7, 0.14, 0);
        for (const sx of [-0.56, 0, 0.56]) {
          box(0.46, 0.08, 0.44, blueUpholstery, sx, 0.34, 0.03);
          const back = box(0.46, 0.42, 0.08, blueUpholstery, sx, 0.55, -0.18);
          back.rotation.x = -0.08;
        }
      }
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
      break;
    }

    case 'coffee_table': {
      const glbTable = glbRegistry.cloneNormalized('furn_coffee_table', {
        maxFootprint: { w: 0.78, d: 0.68 },
        targetHeight: 0.42,
      });
      if (glbTable) {
        inner.add(glbTable);
      } else {
        for (const lx of [-0.28, 0.28]) {
          for (const lz of [-0.24, 0.24]) {
            cyl(0.025, 0.025, 0.32, darkSlate, lx, 0.16, lz);
          }
        }
        box(0.72, 0.06, 0.62, woodMat, 0, 0.34, 0);
        box(0.22, 0.02, 0.16, cyanAccent, -0.1, 0.38, 0.05);
        box(0.18, 0.02, 0.14, whiteBody, 0.14, 0.38, -0.06);
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
      break;
    }

    case 'med_cabinet': {
      const glbMedCab = glbRegistry.cloneNormalized('furn_med_cabinet', {
        maxFootprint: { w: 0.8, d: 0.56 },
        targetHeight: 1.56,
      });
      if (glbMedCab) {
        inner.add(glbMedCab);
      } else {
        // Steel legs + lower locker + upper glass clinical instrument display cabinet
        for (const lx of [-0.32, 0.32]) {
          for (const lz of [-0.18, 0.18]) {
            cyl(0.022, 0.02, 0.12, silverMetal, lx, 0.06, lz);
          }
        }
        box(0.74, 0.58, 0.42, whiteBody, 0, 0.41, 0);
        box(0.34, 0.5, 0.03, makeMat({ color: 0xe2e8f0, roughness: 0.45 }), -0.18, 0.41, 0.21);
        box(0.34, 0.5, 0.03, makeMat({ color: 0xe2e8f0, roughness: 0.45 }), 0.18, 0.41, 0.21);
        box(0.02, 0.12, 0.025, silverMetal, -0.05, 0.44, 0.235);
        box(0.02, 0.12, 0.025, silverMetal, 0.05, 0.44, 0.235);
        // Upper cabinet shell + shelves + colored medical bottles + glass doors
        box(0.74, 0.84, 0.38, whiteBody, 0, 1.12, -0.02);
        box(0.66, 0.72, 0.3, darkSlate, 0, 1.12, 0.01);
        for (const sy of [0.96, 1.2]) {
          box(0.66, 0.025, 0.3, silverMetal, 0, sy, 0.01);
        }
        const bottleCols = [0x0284c7, 0x10b981, 0xdc2626, 0xf59e0b, 0x38bdf8];
        for (let i = 0; i < 4; i++) {
          cyl(0.038, 0.038, 0.14, makeMat({ color: bottleCols[i], roughness: 0.3 }), -0.22 + i * 0.14, 1.04, 0.05);
          box(0.11, 0.11, 0.12, makeMat({ color: bottleCols[(i + 1) % 5], roughness: 0.4 }), -0.21 + i * 0.14, 1.27, 0.05);
        }
        // Subtle green medical cross on header + frosted glass doors
        box(0.08, 0.025, 0.02, emeraldAccent, 0, 1.5, 0.18);
        box(0.025, 0.08, 0.02, emeraldAccent, 0, 1.5, 0.18);
        const glassPane = box(0.68, 0.74, 0.02, frostGlassMat, 0, 1.12, 0.175);
        glassPane.userData.noCastShadow = true;
      }
      break;
    }

    case 'file_cabinet': {
      const glbShelf = glbRegistry.cloneNormalized('furn_bookshelf', {
        maxFootprint: { w: 0.84, d: 0.56 },
        targetHeight: 1.24,
      });
      if (glbShelf) {
        inner.add(glbShelf);
      } else {
        box(0.68, 1.18, 0.46, whiteBody, 0, 0.59, 0);
        box(0.62, 1.06, 0.04, silverMetal, 0, 0.59, 0.22);
        const colors = [0x0284c7, 0x0d9488, 0xf59e0b, 0x2563eb, 0xef4444];
        for (let i = 0; i < 5; i++) {
          box(0.09, 0.26, 0.3, makeMat({ color: colors[i], roughness: 0.4 }), -0.22 + i * 0.11, 0.85, 0.06);
          box(0.09, 0.26, 0.3, makeMat({ color: colors[(i + 2) % 5], roughness: 0.4 }), -0.22 + i * 0.11, 0.48, 0.06);
        }
      }
      break;
    }

    case 'wheelchair_bay': {
      const glbChair = glbRegistry.cloneNormalized('furn_wheelchair', {
        maxFootprint: { w: 0.78, d: 0.78 },
        targetHeight: 0.94,
      });
      if (glbChair) {
        inner.add(glbChair);
      } else {
        // Folding clinical transport wheelchair
        box(0.46, 0.05, 0.44, blueUpholstery, 0, 0.46, 0.02);
        box(0.46, 0.42, 0.05, blueUpholstery, 0, 0.7, -0.2);
        for (const sx of [-0.27, 0.27]) {
          // Big rear wheel + chrome push-rim
          const rearWheel = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.032, 8, 20), blackRubber);
          rearWheel.rotation.y = Math.PI / 2;
          rearWheel.position.set(sx, 0.28, -0.06);
          const hubRim = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.012, 6, 18), silverMetal);
          hubRim.rotation.y = Math.PI / 2;
          hubRim.position.set(sx + (sx > 0 ? 0.018 : -0.018), 0.28, -0.06);
          inner.add(rearWheel, hubRim);
          // Front caster wheel + side rail + armrest + push handle
          const frontCaster = cyl(0.08, 0.08, 0.035, blackRubber, sx * 0.86, 0.08, 0.28);
          frontCaster.rotation.z = Math.PI / 2;
          cyl(0.018, 0.018, 0.48, silverMetal, sx * 0.88, 0.68, -0.22);
          box(0.05, 0.04, 0.36, darkSlate, sx * 0.92, 0.64, 0);
          cyl(0.02, 0.02, 0.14, blackRubber, sx * 0.88, 0.92, -0.29).rotation.x = Math.PI / 2;
          box(0.14, 0.025, 0.14, darkSlate, sx * 0.5, 0.14, 0.34);
        }
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
      break;
    }

    case 'corner_desk': {
      const glbCorner = glbRegistry.cloneNormalized('furn_desk_corner', {
        maxFootprint: { w: 1.82, d: 0.9 },
        targetHeight: 0.78,
      });
      if (glbCorner) {
        inner.add(glbCorner);
        const mon = glbRegistry.cloneNormalized('furn_monitor', {
          targetHeight: 0.36,
          rotY: Math.PI,
        });
        if (mon) {
          mon.position.set(0.24, 0.76, -0.16);
          inner.add(mon);
        }
      } else {
        // L-shape oak & steel workstation + EHR display & chair
        box(1.74, 0.06, 0.56, woodMat, 0, 0.72, -0.14);
        box(0.62, 0.06, 0.36, woodMat, -0.56, 0.72, 0.26);
        for (const [lx, lz] of [
          [-0.82, -0.36],
          [0.82, -0.36],
          [0.82, 0.1],
          [-0.82, 0.38],
        ]) {
          box(0.055, 0.7, 0.055, darkSlate, lx, 0.35, lz);
        }
        box(0.06, 0.12, 0.06, darkSlate, 0.22, 0.8, -0.22);
        box(0.5, 0.31, 0.04, darkSlate, 0.22, 0.98, -0.22);
        const monScr = box(
          0.46,
          0.26,
          0.02,
          makeMat({ map: textures.ecgScreen, emissive: 0x38bdf8, emissiveIntensity: 0.32 }),
          0.22,
          0.98,
          -0.195
        );
        monScr.userData.noCastShadow = true;
        box(0.32, 0.02, 0.14, darkSlate, 0.22, 0.76, -0.02);
        cyl(0.035, 0.18, 0.24, darkSlate, 0.22, 0.12, 0.28);
        box(0.38, 0.07, 0.36, blueUpholstery, 0.22, 0.38, 0.28);
        box(0.36, 0.4, 0.07, blueUpholstery, 0.22, 0.6, 0.44);
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
      break;
    }

    case 'traction_table': {
      // Split-Section Spinal Decompression Plinth + Motorized Head Traction Tower, Spreader Bar & Knee Bolster
      box(1.56, 0.07, 0.68, silverMetal, -0.06, 0.045, 0);
      for (const sz of [-0.24, 0.24]) {
        const s1 = box(0.95, 0.07, 0.06, darkSlate, -0.06, 0.26, sz);
        s1.rotation.z = 0.4;
        const s2 = box(0.95, 0.07, 0.06, darkSlate, -0.06, 0.26, sz);
        s2.rotation.z = -0.4;
      }
      box(1.66, 0.06, 0.72, whiteBody, 0, 0.46, 0);
      // Rolling split-section thoracic & lumbar upholstered decks
      box(0.72, 0.1, 0.68, blueUpholstery, -0.44, 0.54, 0);
      box(0.68, 0.1, 0.68, blueUpholstery, 0.34, 0.54, 0);
      // Pelvic stabilization belt & half-moon orthopedic knee bolster
      box(0.16, 0.11, 0.7, darkSlate, -0.04, 0.545, 0);
      const bolster = cyl(0.085, 0.085, 0.56, cyanAccent, -0.58, 0.62, 0);
      bolster.rotation.x = Math.PI / 2;
      // Motorized Traction Console Tower + winch drum + taut traction strap to spreader bar
      box(0.24, 0.8, 0.44, whiteBody, 0.78, 0.82, 0);
      const fScreen = box(
        0.03,
        0.2,
        0.3,
        makeMat({ map: textures.ecgScreen, emissive: 0x38bdf8, emissiveIntensity: 0.45 }),
        0.65,
        1.06,
        0
      );
      fScreen.userData.noCastShadow = true;
      cyl(0.055, 0.055, 0.14, silverMetal, 0.62, 0.78, 0).rotation.z = Math.PI / 2;
      box(0.04, 0.04, 0.36, darkSlate, 0.5, 0.66, 0);
      tube([[0.62, 0.78, 0], [0.56, 0.72, 0], [0.5, 0.66, 0]], 0.008, blackRubber, 6);
      // Patient hand emergency stop pendant hanging on side
      tube([[0.7, 0.65, 0.2], [0.64, 0.5, 0.36], [0.52, 0.56, 0.35]], 0.008, darkSlate, 8);
      box(0.07, 0.04, 0.04, redAccent, 0.5, 0.56, 0.35);
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
      const waxSurface = box(0.36, 0.025, 0.26, waxMat, 0, 0.855, 0);
      waxSurface.userData.noCastShadow = true;
      const heatLed = box(0.04, 0.025, 0.02, amberAccent, -0.14, 0.72, 0.185);
      heatLed.userData.noCastShadow = true;
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
      outer.userData.smartLight = {
        kind: 'ir_lamp',
        localPos: [0.22, 1.06, 0],
        emissiveMats: [irBulbMat],
        haloMats,
        haloMaxOpacities,
      } as SmartLightMeta;
      break;
    }

    case 'magnetotherapy': {
      // Clinical PEMF Magnetotherapy Plinth + Sliding Dual-Track Solenoid Ring Drum & Gauss Console (2x1)
      box(1.62, 0.06, 0.72, darkSlate, 0, 0.04, 0);
      for (const sz of [-0.26, 0.26]) {
        const rail = cyl(0.022, 0.022, 1.56, silverMetal, 0, 0.44, sz);
        rail.rotation.z = Math.PI / 2;
      }
      box(1.56, 0.07, 0.66, whiteBody, 0, 0.42, 0);
      box(1.5, 0.09, 0.62, blueUpholstery, 0, 0.49, 0);
      box(0.26, 0.06, 0.4, whiteBody, -0.58, 0.56, 0);
      // Iconic cylindrical PEMF Solenoid Treatment Ring spanning the bed
      const outerSolenoid = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.085, 10, 26), whiteBody);
      outerSolenoid.rotation.y = Math.PI / 2;
      outerSolenoid.position.set(0.08, 0.66, 0);
      const trimSolenoid = new THREE.Mesh(new THREE.TorusGeometry(0.415, 0.024, 6, 26), cyanAccent);
      trimSolenoid.rotation.y = Math.PI / 2;
      trimSolenoid.position.set(0.15, 0.66, 0);
      const pemfCoilMat = makeMat({
        color: 0x38bdf8,
        emissive: 0x0ea5e9,
        emissiveIntensity: 0.72,
        roughness: 0.2,
      });
      const innerCoil = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.016, 6, 24), pemfCoilMat);
      innerCoil.rotation.y = Math.PI / 2;
      innerCoil.position.set(0.08, 0.66, 0);
      innerCoil.userData.noCastShadow = true;
      inner.add(outerSolenoid, trimSolenoid, innerCoil);
      // Side PEMF Gauss Generator Tower + armored conduit to solenoid ring
      box(0.24, 0.74, 0.22, whiteBody, 0.68, 0.4, -0.34);
      const pScr = box(
        0.16,
        0.11,
        0.02,
        makeMat({ map: textures.ecgScreen, emissive: 0x38bdf8, emissiveIntensity: 0.46 }),
        0.68,
        0.68,
        -0.225
      );
      pScr.userData.noCastShadow = true;
      tube([[0.64, 0.55, -0.32], [0.42, 0.36, -0.34], [0.22, 0.38, -0.3], [0.08, 0.46, -0.28]], 0.014, darkSlate);
      break;
    }

    case 'tilt_table': {
      // Neurorehabilitation Electric Standing Tilt Table (2x1) with Footboard, Grab Rails & Safety Straps
      box(1.48, 0.08, 0.72, silverMetal, 0, 0.05, 0);
      for (const lx of [-0.64, 0.64]) {
        for (const lz of [-0.3, 0.3]) {
          cyl(0.036, 0.036, 0.05, blackRubber, lx, 0.025, lz);
        }
      }
      // Dual heavy electric lift actuator columns
      box(0.28, 0.56, 0.34, darkSlate, -0.08, 0.34, 0);
      const ram = cyl(0.036, 0.04, 0.48, silverMetal, 0.2, 0.42, 0);
      ram.rotation.z = -0.35;
      // Tilted neuro standing plinth group (~30 deg incline, head at -X, footboard at +X for consistent orientation)
      const tiltGroup = new THREE.Group();
      tiltGroup.position.set(0.02, 0.68, 0);
      tiltGroup.rotation.z = -0.52;
      const tDeck = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.06, 0.68), whiteBody);
      const tPad = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.09, 0.64), blueUpholstery);
      tPad.position.y = 0.075;
      const tPill = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.42), whiteBody);
      tPill.position.set(-0.6, 0.14, 0);
      // Perpendicular steel & non-slip rubber Footboard at bottom (+x)
      const footBoard = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.34, 0.64), darkSlate);
      footBoard.position.set(0.78, 0.22, 0);
      // Bilateral grab rails + blue thoracic & knee stabilization Velcro belts
      for (const gz of [-0.34, 0.34]) {
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.78, 8), silverMetal);
        rail.rotation.z = Math.PI / 2;
        rail.position.set(0, 0.16, gz);
        tiltGroup.add(rail);
      }
      const strapChest = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.68), cyanAccent);
      strapChest.position.set(-0.26, 0.09, 0);
      const strapKnee = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.12, 0.68), cyanAccent);
      strapKnee.position.set(0.28, 0.09, 0);
      tiltGroup.add(tDeck, tPad, tPill, footBoard, strapChest, strapKnee);
      inner.add(tiltGroup);
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
      // 3-panel folding chrome medical privacy curtain screen on swivel feet
      for (const lz of [-0.36, 0, 0.36]) {
        box(0.16, 0.04, 0.06, silverMetal, 0, 0.03, lz);
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
        const fr = new THREE.Mesh(new THREE.BoxGeometry(0.035, 1.48, 0.28), silverMetal);
        fr.position.y = 0.82;
        const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.042, 1.24, 0.24), cyanAccent);
        cloth.position.y = 0.86;
        g.add(fr, cloth);
        inner.add(g);
      }
      break;
    }

    case 'wood_slat_divider': {
      // Modern architectural oak vertical louver screen
      box(0.16, 0.08, 0.86, darkSlate, 0, 0.04, 0);
      box(0.16, 0.06, 0.86, darkSlate, 0, 1.62, 0);
      for (let i = 0; i < 6; i++) {
        box(0.11, 1.54, 0.065, warmTimber, 0, 0.85, -0.35 + i * 0.14);
      }
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
      break;
    }

    case 'arch_pergola': {
      // Decorative garden cedar archway spanning 1x2 tiles with climbing jasmine/vines
      for (const pz of [-0.78, 0.78]) {
        box(0.28, 0.16, 0.28, makeMat({ color: 0x94a3b8, roughness: 0.78 }), 0, 0.08, pz);
        box(0.16, 2.28, 0.16, warmTimber, 0, 1.24, pz);
        // Climbing garden greenery & soft pink blossoms along columns
        for (let k = 0; k < 5; k++) {
          const leafC = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), leafGreen);
          leafC.position.set((k % 2 === 0 ? 1 : -1) * 0.08, 0.55 + k * 0.36, pz);
          inner.add(leafC);
        }
      }
      // Overhead crossbeams + pergola rafters
      box(0.22, 0.14, 1.88, warmTimber, 0, 2.38, 0);
      for (const rx of [-0.26, 0, 0.26]) {
        box(0.1, 0.1, 1.94, warmTimber, rx, 2.48, 0);
      }
      break;
    }

    // ================ DECOR & GUARANTEED-ILLUMINATING SMART LIGHTS ================

    case 'potted_plant': {
      const glbPlant =
        glbRegistry.cloneNormalized('furn_plant_ficus', {
          maxFootprint: { w: 0.68, d: 0.68 },
          targetHeight: 0.96,
        }) ||
        glbRegistry.cloneNormalized('furn_plant1', {
          maxFootprint: { w: 0.62, d: 0.62 },
          targetHeight: 0.88,
        });
      if (glbPlant) {
        inner.add(glbPlant);
      } else {
        cyl(0.18, 0.13, 0.28, ceramicPot, 0, 0.14, 0);
        cyl(0.03, 0.04, 0.36, woodMat, 0, 0.38, 0);
        for (let i = 0; i < 7; i++) {
          const ang = (i / 7) * Math.PI * 2;
          const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.28), leafGreen);
          leaf.position.set(Math.cos(ang) * 0.15, 0.54 + (i % 2) * 0.08, Math.sin(ang) * 0.15);
          leaf.rotation.y = -ang + Math.PI / 2;
          leaf.rotation.x = 0.45;
          inner.add(leaf);
        }
      }
      break;
    }

    case 'park_bench': {
      for (const lz of [-0.72, 0.72]) {
        box(0.46, 0.36, 0.07, darkSlate, 0, 0.18, lz);
      }
      box(0.44, 0.06, 1.62, woodMat, 0.04, 0.38, 0);
      const back = box(0.07, 0.36, 1.62, woodMat, -0.18, 0.58, 0);
      back.rotation.z = 0.16;
      break;
    }

    case 'garden_lamp': {
      cyl(0.09, 0.11, 0.72, darkSlate, 0, 0.36, 0);
      const lampGlowMat = makeMat({
        color: 0xfde68a,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.1,
        roughness: 0.25,
      });
      const lampBulb = box(0.16, 0.18, 0.16, lampGlowMat, 0, 0.78, 0);
      lampBulb.userData.noCastShadow = true;
      box(0.2, 0.05, 0.2, darkSlate, 0, 0.9, 0);
      addFloorHalo(2.35, 0xffcc78, 0.46, 0, 0.026, 0);
      addBulbAura(0.24, 0xffd584, 0.34, 0, 0.78, 0);
      outer.userData.smartLight = {
        kind: 'garden_lamp',
        localPos: [0, 0.95, 0],
        emissiveMats: [lampGlowMat],
        haloMats,
        haloMaxOpacities,
      } as SmartLightMeta;
      break;
    }

    case 'garden_spot_lamp': {
      // Twin-globe classic outdoor garden post that casts wide golden floor illumination
      cyl(0.16, 0.2, 0.12, darkSlate, 0, 0.06, 0);
      cyl(0.05, 0.07, 1.72, darkSlate, 0, 0.94, 0);
      box(0.56, 0.06, 0.07, darkSlate, 0, 1.82, 0);
      const twinGlowMat = makeMat({
        color: 0xfef08a,
        emissive: 0xfbbf24,
        emissiveIntensity: 0.12,
        roughness: 0.22,
      });
      for (const gx of [-0.24, 0.24]) {
        cyl(0.05, 0.04, 0.08, darkSlate, gx, 1.88, 0);
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), twinGlowMat);
        orb.position.set(gx, 2.02, 0);
        orb.userData.noCastShadow = true;
        inner.add(orb);
        addBulbAura(0.24, 0xffe29a, 0.34, gx, 2.02, 0);
      }
      addFloorHalo(3.15, 0xffd282, 0.54, 0, 0.026, 0);
      outer.userData.smartLight = {
        kind: 'garden_lamp',
        localPos: [0, 2.05, 0],
        emissiveMats: [twinGlowMat],
        haloMats,
        haloMaxOpacities,
      } as SmartLightMeta;
      break;
    }

    case 'clinic_floor_lamp': {
      const glbLamp = glbRegistry.cloneNormalized('furn_lamp_floor', {
        maxFootprint: { w: 0.6, d: 0.6 },
        targetHeight: 1.62,
      });
      const bulbMat = makeMat({
        color: 0xfef3c7,
        emissive: 0xfbbf24,
        emissiveIntensity: 0.1,
        roughness: 0.25,
      });
      if (glbLamp) {
        inner.add(glbLamp);
        const bulb = cyl(0.09, 0.12, 0.16, bulbMat, 0, 1.42, 0);
        bulb.userData.noCastShadow = true;
      } else {
        cyl(0.18, 0.2, 0.04, darkSlate, 0, 0.02, 0);
        cyl(0.025, 0.03, 1.38, silverMetal, 0, 0.71, 0);
        const shade = cyl(0.16, 0.22, 0.28, bulbMat, 0, 1.46, 0);
        shade.userData.noCastShadow = true;
      }
      addFloorHalo(2.55, 0xffe4b3, 0.45, 0, 0.026, 0);
      addBulbAura(0.28, 0xffe8bf, 0.32, 0, 1.45, 0);
      outer.userData.smartLight = {
        kind: 'indoor_lamp',
        localPos: [0, 1.5, 0],
        emissiveMats: [bulbMat],
        haloMats,
        haloMaxOpacities,
      } as SmartLightMeta;
      break;
    }

    case 'wall_sconce_lamp': {
      const glbWallLamp = glbRegistry.cloneNormalized('furn_lamp_wall', {
        maxFootprint: { w: 0.46, d: 0.46 },
        targetHeight: 0.42,
        rotY: Math.PI / 2,
      });
      const sconceMat = makeMat({
        color: 0xfef3c7,
        emissive: 0xfbbf24,
        emissiveIntensity: 0.12,
        roughness: 0.24,
      });
      if (glbWallLamp) {
        glbWallLamp.position.set(-0.34, 1.42, 0);
        inner.add(glbWallLamp);
      } else {
        box(0.05, 0.24, 0.16, darkSlate, -0.44, 1.54, 0);
        box(0.12, 0.04, 0.06, silverMetal, -0.37, 1.5, 0);
      }
      const glassShade = cyl(0.065, 0.085, 0.18, sconceMat, -0.3, 1.56, 0);
      glassShade.userData.noCastShadow = true;
      addWallWash(1.25, 1.45, 0xffd79e, 0.5, -0.4, 0.9, 0, Math.PI / 2);
      addFloorHalo(1.95, 0xffd79e, 0.36, -0.1, 0.026, 0);
      addBulbAura(0.18, 0xffe5b4, 0.34, -0.3, 1.56, 0);
      outer.userData.smartLight = {
        kind: 'wall_lamp',
        localPos: [-0.22, 1.54, 0],
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
      } else {
        cyl(0.08, 0.1, 0.04, silverMetal, 0, 0.51, 0);
        cyl(0.018, 0.022, 0.22, silverMetal, 0, 0.62, 0);
        const shade = cyl(0.11, 0.16, 0.19, tableGlowMat, 0, 0.78, 0);
        shade.userData.noCastShadow = true;
      }
      addFloorHalo(2.15, 0xffe2ad, 0.4, 0, 0.026, 0);
      addBulbAura(0.21, 0xffe9be, 0.34, 0, 0.78, 0);
      outer.userData.smartLight = {
        kind: 'indoor_lamp',
        localPos: [0, 0.85, 0],
        emissiveMats: [tableGlowMat],
        haloMats,
        haloMaxOpacities,
      } as SmartLightMeta;
      break;
    }

    case 'street_lamp_post': {
      const glbPost = glbRegistry.cloneNormalized('streetlight', {
        maxFootprint: { w: 0.92, d: 0.65 },
        targetHeight: 3.1,
        rotY: Math.PI / 2,
      });
      const headGlowMat = makeMat({
        color: 0xfef08a,
        emissive: 0xffc864,
        emissiveIntensity: 0.12,
        roughness: 0.22,
      });
      if (glbPost) {
        inner.add(glbPost);
        const headGlow = box(0.26, 0.08, 0.16, headGlowMat, 0.2, 2.94, 0);
        headGlow.userData.noCastShadow = true;
      } else {
        cyl(0.05, 0.08, 2.9, darkSlate, -0.08, 1.45, 0);
        box(0.55, 0.07, 0.09, darkSlate, 0.12, 2.92, 0);
        const bulb = box(0.26, 0.07, 0.16, headGlowMat, 0.28, 2.86, 0);
        bulb.userData.noCastShadow = true;
      }
      addFloorHalo(3.85, 0xffd488, 0.58, 0.25, 0.026, 0);
      addBulbAura(0.32, 0xffdf9a, 0.38, 0.24, 2.86, 0);
      outer.userData.smartLight = {
        kind: 'street_lamp',
        localPos: [0.3, 2.8, 0],
        emissiveMats: [headGlowMat],
        haloMats,
        haloMaxOpacities,
      } as SmartLightMeta;
      break;
    }

    case 'flower_bed': {
      box(0.78, 0.14, 0.78, makeMat({ color: 0xc2bcb0, roughness: 0.82 }), 0, 0.07, 0);
      box(0.68, 0.15, 0.68, makeMat({ color: 0x4b3626, roughness: 0.96 }), 0, 0.08, 0);
      const petalColors = [0xd9485f, 0xeab338, 0xb07cc6, 0xebe6dc, 0xd96b43];
      const stemG = new THREE.CylinderGeometry(0.008, 0.011, 0.2, 5);
      const leafG = new THREE.ConeGeometry(0.045, 0.16, 4);
      const petalG = new THREE.SphereGeometry(0.028, 6, 4);
      const centerMat = makeMat({ color: 0xd99b26, roughness: 0.5 });
      for (let i = 0; i < 6; i++) {
        const fx = ((i % 3) - 1) * 0.2;
        const fz = (Math.floor(i / 3) - 0.5) * 0.24;
        for (let li = 0; li < 4; li++) {
          const la = (li / 4) * Math.PI * 2 + i;
          const lf = new THREE.Mesh(leafG, leafGreen);
          lf.position.set(fx + Math.cos(la) * 0.05, 0.19, fz + Math.sin(la) * 0.05);
          lf.rotation.z = -Math.cos(la) * 0.9;
          lf.rotation.x = Math.sin(la) * 0.9;
          lf.scale.set(0.9, 1, 0.35);
          inner.add(lf);
        }
        const st = new THREE.Mesh(stemG, leafGreen);
        st.position.set(fx, 0.25, fz);
        inner.add(st);
        const pMat = makeMat({ color: petalColors[i % petalColors.length], roughness: 0.55 });
        for (let pi = 0; pi < 5; pi++) {
          const pa = (pi / 5) * Math.PI * 2;
          const pet = new THREE.Mesh(petalG, pMat);
          pet.scale.set(1.25, 0.45, 0.85);
          pet.position.set(fx + Math.cos(pa) * 0.03, 0.35, fz + Math.sin(pa) * 0.03);
          pet.rotation.y = -pa;
          inner.add(pet);
        }
        const ctr = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.014, 7), centerMat);
        ctr.position.set(fx, 0.358, fz);
        inner.add(ctr);
      }
      break;
    }

    case 'outdoor_tree': {
      const glbTree =
        glbRegistry.cloneNormalized('birch_1', {
          maxFootprint: { w: 0.96, d: 0.96 },
          targetHeight: 2.85,
        }) ||
        glbRegistry.cloneNormalized('tree_2', {
          maxFootprint: { w: 0.96, d: 0.96 },
          targetHeight: 2.75,
        });
      // Stone garden curb collar
      const treeRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.32, 0.045, 6, 16),
        makeMat({ color: 0xb6afa3, roughness: 0.85 })
      );
      treeRing.rotation.x = Math.PI / 2;
      treeRing.position.y = 0.035;
      inner.add(treeRing);
      if (glbTree) {
        inner.add(glbTree);
      } else {
        cyl(0.09, 0.14, 1.35, warmTimber, 0, 0.67, 0);
        for (const [cx, cy, cz, r] of [
          [0, 1.85, 0, 0.56],
          [-0.28, 1.55, 0.2, 0.4],
          [0.26, 1.62, -0.18, 0.42],
          [0.12, 1.48, 0.26, 0.36],
        ]) {
          const c = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), leafGreen);
          c.position.set(cx, cy, cz);
          inner.add(c);
        }
      }
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
      break;
    }

    case 'skeleton_stand': {
      cyl(0.22, 0.24, 0.05, darkSlate, 0, 0.025, 0);
      cyl(0.02, 0.02, 1.38, silverMetal, 0, 0.7, -0.05);
      const boneMat = makeMat({ color: 0xf1f5f9, roughness: 0.45 });
      cyl(0.04, 0.04, 0.45, boneMat, -0.08, 0.45, 0.02);
      cyl(0.04, 0.04, 0.45, boneMat, 0.08, 0.45, 0.02);
      box(0.22, 0.08, 0.12, boneMat, 0, 0.72, 0.02);
      box(0.24, 0.34, 0.14, boneMat, 0, 0.98, 0.02);
      cyl(0.028, 0.028, 0.36, boneMat, -0.17, 0.95, 0.02);
      cyl(0.028, 0.028, 0.36, boneMat, 0.17, 0.95, 0.02);
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), boneMat);
      skull.position.set(0, 1.28, 0.03);
      inner.add(skull);
      break;
    }

    case 'floor_rug': {
      // Woven acoustic clinical reception rug (walkable floor layer)
      const rugOuter = box(1.82, 0.022, 0.92, makeMat({ color: 0x1e4068, roughness: 0.92 }), 0, 0.014, 0);
      const rugBorder = box(1.68, 0.024, 0.78, makeMat({ color: 0xe2e8f0, roughness: 0.92 }), 0, 0.015, 0);
      const rugCenter = box(1.5, 0.026, 0.62, makeMat({ color: 0x0e7490, roughness: 0.9 }), 0, 0.016, 0);
      const rugMedallion = box(0.64, 0.028, 0.3, makeMat({ color: 0x38bdf8, roughness: 0.88 }), 0, 0.017, 0);
      for (const r of [rugOuter, rugBorder, rugCenter, rugMedallion]) {
        r.userData.noCastShadow = true;
      }
      break;
    }

    case 'waste_bin': {
      const glbTrash = glbRegistry.cloneNormalized('furn_trashcan', {
        maxFootprint: { w: 0.36, d: 0.36 },
        targetHeight: 0.56,
      });
      if (glbTrash) {
        inner.add(glbTrash);
      } else {
        cyl(0.15, 0.13, 0.48, silverMetal, 0, 0.24, 0);
        cyl(0.155, 0.155, 0.05, darkSlate, 0, 0.5, 0);
        box(0.09, 0.025, 0.06, blackRubber, 0, 0.02, 0.15);
        box(0.1, 0.08, 0.02, emeraldAccent, 0, 0.3, 0.145);
      }
      break;
    }

    case 'anatomy_poster': {
      box(0.12, 0.78, 0.56, whiteBody, -0.32, 0.92, 0);
      const art = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.7, 0.48),
        makeMat({ map: textures.anatomyPoster, roughness: 0.4 })
      );
      art.position.set(-0.25, 0.92, 0);
      inner.add(art);
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
          cloned.opacity = 0.65;
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
