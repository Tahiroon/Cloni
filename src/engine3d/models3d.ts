import * as THREE from 'three';
import { GRID_SIZE } from '../data/catalog';
import { ClinicRoom, SpriteKind } from '../types/clinic';
import { glbRegistry } from './glbRegistry';
import { TextureBundle } from './textures3d';

function setShadow(obj: THREE.Object3D, cast = true, receive = true) {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
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

export interface ClinicWorldHandle {
  group: THREE.Group;
  waterMesh: THREE.Mesh;
  doors: ClinicDoorHandle[];
  skyUniforms: {
    uTopColor: { value: THREE.Color };
    uHorizonColor: { value: THREE.Color };
  };
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

  // 0. Atmospheric Daylight Sky Dome (grounded realistic horizon)
  const skyUniforms = {
    uTopColor: { value: new THREE.Color(0x4b7cb3) },
    uHorizonColor: { value: new THREE.Color(0xd2e0ec) },
  };
  const skyMat = trackMat(
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uHorizonColor;
        varying vec3 vWorldPos;
        void main() {
          float h = clamp((vWorldPos.y + 4.0) / 55.0, 0.0, 1.0);
          vec3 col = mix(uHorizonColor, uTopColor, pow(h, 0.65));
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
      bumpScale: 0.02,
      roughness: 0.88,
      metalness: 0.02,
    })
  );
  const sidewalkMat = trackMat(makeMat({ map: textures.sidewalk, roughness: 0.8, metalness: 0.02 }));
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
      emissiveIntensity: 0.65,
      roughness: 0.28,
    })
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
    const inClinicPad = wx >= -1.0 && wx <= 33.5 && wz >= -0.5 && wz <= 24.5;
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
    if (gx >= 1.6 && gx <= 31.6 && gz >= 1.6 && gz <= 22.6) continue; // keep clinic/courtyard/promenade clean
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

    const winGlowMat = trackMat(
      makeMat({ color: 0xfef3c7, emissive: 0xf59e0b, emissiveIntensity: 0.32, roughness: 0.25 })
    );
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

  // 2. Clean Sunlit Pedestrian Garden Promenade & Stone Courtyard (Vehicle-free!)
  const promenade = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(4.4, 0.08, 96)), sidewalkMat);
  promenade.position.set(29.2, 0.015, 12);
  promenade.receiveShadow = true;
  root.add(promenade);

  const promCurb = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.22, 0.12, 82)), curbMat);
  promCurb.position.set(27.05, 0.035, 12);
  promCurb.receiveShadow = true;
  root.add(promCurb);

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
    const lantern = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.24, 0.18, 0.24)), warmLedMat);
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

  // Promenade Streetlamp posts (clean botanical walkway lighting, taller 3.0m)
  for (const sz of [4.2, 11.4, 19.8]) {
    const glbLamp = glbRegistry.cloneNormalized('streetlight', {
      targetHeight: 3.05,
      rotY: Math.PI / 2,
    });
    if (glbLamp) {
      glbLamp.position.set(27.55, 0.04, sz);
      root.add(glbLamp);
    } else {
      const pole = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.05, 0.07, 2.85, 8)), darkMullionMat);
      pole.position.set(27.55, 1.42, sz);
      pole.castShadow = true;
      const arm = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.5, 0.06, 0.08)), darkMullionMat);
      arm.position.set(27.75, 2.82, sz);
      const bulb = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.24, 0.05, 0.14)), warmLedMat);
      bulb.position.set(27.9, 2.77, sz);
      root.add(pole, arm, bulb);
    }
  }

  // Courtyard & landscape shrubs (all flowers are placed/bought/edited via flower_bed catalog items)

  const bushCoords: Array<[number, number, string]> = [
    [22.48, 3.2, 'bush_1'],
    [22.48, 12.4, 'bush_2'],
    [26.45, 3.8, 'bush_1'],
    [26.45, 20.6, 'bush_2'],
    [1.4, 22.6, 'bush_2'],
    [20.8, 22.6, 'bush_1'],
    [31.5, 5.5, 'bush_1'],
    [31.5, 16.5, 'bush_2'],
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
    [31.8, 10.8],
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
    const sconce = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.14, 0.32, 0.14)), warmLedMat);
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
  const canopyGlow = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(1.16, 0.045, 2.52)), warmLedMat);
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
    [32.2, 3.4, 1.22, 2.9],
    [32.4, 19.8, 1.16, 4.7],
    [34.2, 11.4, 0.88, 1.5],
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

  if (!isGhost) {
    const ao = new THREE.Mesh(
      new THREE.PlaneGeometry(width * 0.96, depth * 0.96),
      new THREE.MeshBasicMaterial({
        map: textures.contactShadow,
        transparent: true,
        depthWrite: false,
      })
    );
    ao.rotation.x = -Math.PI / 2;
    ao.position.y = 0.018;
    inner.add(ao);
  }

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
        // Glowing blue architectural front LED apron matching reference reception desk
        const ledApron = box(
          1.45,
          0.04,
          0.04,
          makeMat({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 0.85 }),
          0,
          0.08,
          0.42
        );
        ledApron.castShadow = false;
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
        box(
          1.54,
          0.04,
          0.04,
          makeMat({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 0.85 }),
          0,
          0.05,
          0.4
        );
        box(1.76, 0.07, 0.64, woodMat, 0, 0.75, 0.08);
        box(1.1, 0.22, 0.22, whiteBody, 0, 0.86, 0.26);
        box(0.08, 0.16, 0.08, darkSlate, 0.18, 0.85, 0.04);
        box(0.46, 0.28, 0.04, darkSlate, 0.18, 1.0, 0.04);
        box(
          0.42,
          0.23,
          0.02,
          makeMat({ map: textures.ecgScreen, emissive: 0x38bdf8, emissiveIntensity: 0.35 }),
          0.18,
          1.0,
          0.02
        );
        cyl(0.04, 0.18, 0.24, darkSlate, -0.1, 0.12, -0.32);
        box(0.36, 0.08, 0.34, blueUpholstery, -0.1, 0.36, -0.32);
        box(0.34, 0.4, 0.08, blueUpholstery, -0.1, 0.58, -0.45);
      }
      break;
    }

    case 'waiting_chairs': {
      const glbCouch = glbRegistry.cloneNormalized('furn_couch', {
        maxFootprint: { w: 1.78, d: 0.78 },
        targetHeight: 0.76,
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
      box(0.44, 0.72, 0.44, whiteBody, 0, 0.36, 0);
      box(0.36, 0.12, 0.1, darkSlate, 0, 0.52, 0.2);
      const jugMat = new THREE.MeshPhysicalMaterial({
        color: 0x7dd3fc,
        roughness: 0.1,
        transmission: 0.6,
        transparent: true,
        opacity: 0.78,
      });
      cyl(0.17, 0.17, 0.42, jugMat, 0, 0.93, 0);
      cyl(0.08, 0.15, 0.08, jugMat, 0, 1.15, 0);
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

    case 'tens_unit':
    case 'ultrasound_unit': {
      const isUs = sprite === 'ultrasound_unit';
      box(0.5, 0.06, 0.48, silverMetal, 0, 0.08, 0);
      for (const lx of [-0.2, 0.2]) {
        for (const lz of [-0.18, 0.18]) {
          cyl(0.04, 0.04, 0.08, darkSlate, lx, 0.04, lz);
        }
      }
      box(0.42, 0.62, 0.38, whiteBody, 0, 0.42, 0);
      box(0.44, 0.08, 0.4, isUs ? cyanAccent : blueUpholstery, 0, 0.74, 0);
      const screenMat = makeMat({
        map: textures.ecgScreen,
        emissive: 0x0ea5e9,
        emissiveIntensity: 0.35,
        roughness: 0.2,
      });
      const head = box(0.38, 0.28, 0.08, darkSlate, 0, 0.94, -0.02);
      head.rotation.x = -0.32;
      const scr = box(0.32, 0.21, 0.02, screenMat, 0, 0.94, 0.03);
      scr.rotation.x = -0.32;
      cyl(0.035, 0.025, 0.18, isUs ? silverMetal : cyanAccent, 0.22, 0.86, 0.08);
      break;
    }

    case 'traction_table': {
      for (const lx of [-0.7, 0.7]) {
        for (const lz of [-0.3, 0.3]) {
          box(0.08, 0.48, 0.08, darkSlate, lx, 0.24, lz);
        }
      }
      box(1.66, 0.08, 0.72, whiteBody, 0, 0.5, 0);
      box(0.75, 0.1, 0.66, blueUpholstery, -0.4, 0.58, 0);
      box(0.75, 0.1, 0.66, blueUpholstery, 0.42, 0.58, 0);
      box(0.24, 0.68, 0.42, whiteBody, 0.78, 0.82, 0);
      box(0.18, 0.18, 0.28, cyanAccent, 0.76, 1.04, 0);
      break;
    }

    case 'treadmill': {
      box(1.68, 0.14, 0.76, darkSlate, 0, 0.08, 0);
      box(1.38, 0.04, 0.58, makeMat({ color: 0x0f172a, roughness: 0.85 }), -0.06, 0.16, 0);
      box(1.5, 0.06, 0.06, silverMetal, 0, 0.16, 0.34);
      box(1.5, 0.06, 0.06, silverMetal, 0, 0.16, -0.34);
      for (const sz of [-0.33, 0.33]) {
        const post = box(0.09, 0.98, 0.07, silverMetal, 0.68, 0.58, sz);
        post.rotation.z = 0.12;
        box(0.52, 0.05, 0.06, darkSlate, 0.42, 0.86, sz);
      }
      const con = box(0.24, 0.22, 0.72, darkSlate, 0.62, 1.06, 0);
      con.rotation.z = 0.35;
      const scr = box(
        0.18,
        0.04,
        0.44,
        makeMat({ map: textures.ecgScreen, emissive: 0x38bdf8, emissiveIntensity: 0.35 }),
        0.6,
        1.15,
        0
      );
      scr.rotation.z = 0.35;
      break;
    }

    case 'exercise_bike': {
      box(0.76, 0.07, 0.44, silverMetal, 0, 0.04, 0);
      const wheel = cyl(0.22, 0.22, 0.14, whiteBody, 0.16, 0.28, 0);
      wheel.rotation.x = Math.PI / 2;
      cyl(0.035, 0.04, 0.52, silverMetal, -0.22, 0.34, 0);
      box(0.22, 0.07, 0.18, darkSlate, -0.22, 0.62, 0);
      const stem = box(0.08, 0.64, 0.08, silverMetal, 0.24, 0.52, 0);
      stem.rotation.z = 0.22;
      box(0.14, 0.08, 0.46, darkSlate, 0.16, 0.84, 0);
      box(0.16, 0.12, 0.24, cyanAccent, 0.18, 0.9, 0);
      break;
    }

    case 'wall_bars': {
      box(0.08, 1.65, 0.1, woodMat, -0.34, 0.825, -0.28);
      box(0.08, 1.65, 0.1, woodMat, 0.34, 0.825, -0.28);
      for (let ry = 0.22; ry <= 1.56; ry += 0.18) {
        const rung = cyl(0.025, 0.025, 0.7, woodMat, 0, ry, -0.28);
        rung.rotation.z = Math.PI / 2;
      }
      break;
    }

    case 'ball_rack': {
      for (const lx of [-0.3, 0.3]) {
        box(0.05, 0.96, 0.46, silverMetal, lx, 0.48, 0);
      }
      const ballBlue = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 16, 12),
        makeMat({ color: 0x0284c7, roughness: 0.35 })
      );
      ballBlue.position.set(0, 0.36, 0);
      const ballViolet = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 16, 12),
        makeMat({ color: 0x7c3aed, roughness: 0.35 })
      );
      ballViolet.position.set(0, 0.88, 0);
      inner.add(ballBlue, ballViolet);
      break;
    }

    case 'exercise_mat': {
      box(1.62, 0.07, 0.74, blueUpholstery, 0, 0.035, 0);
      box(1.52, 0.08, 0.08, cyanAccent, -0.02, 0.04, 0.32);
      break;
    }

    case 'parallel_bars': {
      box(1.76, 0.05, 0.76, woodMat, 0, 0.025, 0);
      for (const lx of [-0.72, 0.72]) {
        for (const lz of [-0.3, 0.3]) {
          cyl(0.03, 0.03, 0.82, silverMetal, lx, 0.42, lz);
        }
      }
      for (const lz of [-0.3, 0.3]) {
        const rail = cyl(0.032, 0.032, 1.68, woodMat, 0, 0.84, lz);
        rail.rotation.z = Math.PI / 2;
      }
      break;
    }

    case 'hydro_sink': {
      const glbSink = glbRegistry.cloneNormalized('furn_sink', {
        maxFootprint: { w: 0.82, d: 0.64 },
        targetHeight: 0.9,
      });
      if (glbSink) {
        inner.add(glbSink);
      } else {
        box(0.74, 0.78, 0.56, whiteBody, 0, 0.39, 0);
        box(0.68, 0.06, 0.52, silverMetal, 0, 0.8, 0);
        box(0.48, 0.14, 0.34, cyanAccent, -0.04, 0.77, 0.02);
        cyl(0.025, 0.025, 0.24, silverMetal, 0, 0.94, -0.18);
      }
      break;
    }

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
      box(
        0.16,
        0.18,
        0.16,
        makeMat({ color: 0xfde68a, emissive: 0xf59e0b, emissiveIntensity: 0.85 }),
        0,
        0.78,
        0
      );
      box(0.2, 0.05, 0.2, darkSlate, 0, 0.9, 0);
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

    case 'therason_sign': {
      // Glowing blue monument lightbox nested in botanical flowerbed border
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
        emissiveIntensity: 0.42,
        roughness: 0.25,
      });
      const faceFront = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.86, 1.3), faceMat);
      faceFront.position.set(0.13, 0.64, 0);
      const faceBack = faceFront.clone();
      faceBack.position.set(-0.13, 0.64, 0);
      inner.add(faceFront, faceBack);
      break;
    }

    case 'office_desk': {
      // Doctor Assessment Desk with dual monitors & swivel chair
      for (const lx of [-0.74, 0.74]) {
        for (const lz of [-0.26, 0.26]) {
          box(0.06, 0.68, 0.06, darkSlate, lx, 0.34, lz);
        }
      }
      box(1.66, 0.06, 0.68, woodMat, 0, 0.71, 0);
      for (const mx of [-0.3, 0.3]) {
        box(0.06, 0.12, 0.06, darkSlate, mx, 0.79, -0.14);
        box(0.46, 0.29, 0.04, darkSlate, mx, 0.98, -0.14);
        box(
          0.42,
          0.24,
          0.02,
          makeMat({ map: textures.ecgScreen, emissive: 0x38bdf8, emissiveIntensity: 0.3 }),
          mx,
          0.98,
          -0.11
        );
      }
      cyl(0.04, 0.18, 0.26, darkSlate, 0, 0.13, 0.34);
      box(0.38, 0.08, 0.36, blueUpholstery, 0, 0.38, 0.34);
      box(0.36, 0.42, 0.08, blueUpholstery, 0, 0.62, 0.48);
      break;
    }

    case 'supply_shelf': {
      // Open wooden supply shelving stocked with colorful therapy bottles & folded towels
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
      // Mobile anatomical skeleton educational stand
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

    case 'partition_wall': {
      box(0.12, 1.15, 0.86, whiteBody, 0, 0.575, 0);
      box(
        0.06,
        0.78,
        0.72,
        new THREE.MeshPhysicalMaterial({
          color: 0xcbeafe,
          transparent: true,
          opacity: 0.58,
          roughness: 0.15,
        }),
        0,
        0.65,
        0
      );
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
  outer.userData = { effW, effD };
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
