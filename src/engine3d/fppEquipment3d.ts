import * as THREE from 'three';
import { SpriteKind } from '../types/clinic';
import { TextureBundle } from './textures3d';

export interface FppEquipMotionInput {
  activeBlend: number;
  onBedBlend?: number;
  timeSec: number;
  aimWorldX: number;
  aimWorldY: number;
  aimWorldZ: number;
  bedHeight: number;
  closeRange: boolean;
}

export interface FppEquipCarrySpec {
  carryMode: 'roll' | 'lift';
  gripStyle: 'pole' | 'bar' | 'crate';
  holdDist: number;
  holdY: number;
  holdRotOffset: number;
  leftLocal: [number, number, number];
  rightLocal: [number, number, number];
}

export function getFppEquipCarrySpec(sprite: SpriteKind): FppEquipCarrySpec {
  switch (sprite) {
    case 'infrared_lamp':
      return {
        carryMode: 'roll',
        gripStyle: 'pole',
        holdDist: 0.68,
        holdY: 0,
        holdRotOffset: Math.PI,
        leftLocal: [0.032, 0.90, -0.015],
        rightLocal: [-0.032, 0.82, -0.015],
      };
    case 'swd_unit':
      return {
        carryMode: 'roll',
        gripStyle: 'bar',
        holdDist: 0.82,
        holdY: 0,
        holdRotOffset: Math.PI,
        leftLocal: [0.165, 0.80, -0.06],
        rightLocal: [-0.165, 0.80, -0.06],
      };
    case 'tens_unit':
    case 'ultrasound_unit':
    case 'laser_hilt':
    case 'shockwave_eswt':
    case 'emg_biofeedback':
    case 'cryo_unit':
      return {
        carryMode: 'roll',
        gripStyle: 'bar',
        holdDist: 0.84,
        holdY: 0,
        holdRotOffset: Math.PI,
        leftLocal: [0.145, 0.77, -0.15],
        rightLocal: [-0.145, 0.77, -0.15],
      };
    case 'hand_rehab_table':
      return {
        carryMode: 'roll',
        gripStyle: 'bar',
        holdDist: 0.84,
        holdY: 0,
        holdRotOffset: Math.PI,
        leftLocal: [0.22, 0.78, -0.12],
        rightLocal: [-0.22, 0.78, -0.12],
      };
    case 'paraffin_bath':
    case 'hydro_sink':
    case 'pt_toolkit_cart':
      return {
        carryMode: 'roll',
        gripStyle: 'bar',
        holdDist: 0.84,
        holdY: 0,
        holdRotOffset: Math.PI,
        leftLocal: [0.18, 0.76, -0.11],
        rightLocal: [-0.18, 0.76, -0.11],
      };
    case 'cpm_device':
      return {
        carryMode: 'lift',
        gripStyle: 'crate',
        holdDist: 0.58,
        holdY: 0.88,
        holdRotOffset: 0,
        leftLocal: [-0.21, 0.06, 0.08],
        rightLocal: [0.21, 0.06, 0.08],
      };
    case 'balance_trainer':
      return {
        carryMode: 'lift',
        gripStyle: 'pole',
        holdDist: 0.62,
        holdY: 0.42,
        holdRotOffset: Math.PI,
        leftLocal: [0.20, 0.58, -0.17],
        rightLocal: [-0.20, 0.58, -0.17],
      };
    case 'ball_rack':
    default:
      return {
        carryMode: 'lift',
        gripStyle: 'crate',
        holdDist: 0.66,
        holdY: 0.22,
        holdRotOffset: Math.PI,
        leftLocal: [0.18, 0.82, 0.02],
        rightLocal: [-0.18, 0.82, 0.02],
      };
  }
}

export interface FppEquipHandle {
  group: THREE.Group;
  colliderHalfW: number;
  colliderHalfD: number;
  updateMotion: (input: FppEquipMotionInput) => void;
  dispose: () => void;
}

function createDeviceScreenTexture(
  title: string,
  accent: string,
  lines: string[],
  mode: 'wave' | 'bars' | 'gauge' | 'grid'
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#07111e';
    ctx.fillRect(0, 0, 256, 160);

    // Subtle header bar
    ctx.fillStyle = '#0f2136';
    ctx.fillRect(0, 0, 256, 30);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 28, 256, 2);

    ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(title, 10, 20);

    // Telemetry graphic
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.4;
    if (mode === 'wave') {
      ctx.beginPath();
      for (let x = 12; x <= 148; x += 3) {
        const y = 78 + Math.sin(x * 0.14) * 18 + Math.cos(x * 0.31) * 7;
        if (x === 12) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let x = 12; x <= 148; x += 3) {
        const y = 114 + Math.sin(x * 0.22 + 1.1) * 10;
        if (x === 12) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    } else if (mode === 'bars') {
      const heights = [38, 62, 54, 78, 46, 70, 58];
      for (let i = 0; i < heights.length; i++) {
        ctx.fillStyle = i % 2 === 0 ? accent : '#38bdf8';
        ctx.fillRect(14 + i * 19, 134 - heights[i], 12, heights[i]);
      }
    } else if (mode === 'gauge') {
      ctx.beginPath();
      ctx.arc(76, 96, 36, Math.PI * 0.8, Math.PI * 2.2);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 9;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(76, 96, 36, Math.PI * 0.8, Math.PI * 1.85);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 9;
      ctx.stroke();
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 16px monospace';
      ctx.fillText('ACTIVE', 46, 102);
    } else {
      ctx.strokeStyle = '#1e3a5f';
      ctx.lineWidth = 1;
      for (let x = 16; x <= 144; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, 42);
        ctx.lineTo(x, 144);
        ctx.stroke();
      }
      for (let y = 42; y <= 144; y += 16) {
        ctx.beginPath();
        ctx.moveTo(16, y);
        ctx.lineTo(144, y);
        ctx.stroke();
      }
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(82, 92, 11, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 12px monospace';
    lines.slice(0, 4).forEach((ln, idx) => {
      ctx.fillText(ln, 158, 56 + idx * 24);
    });
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const _aimDirScratch = new THREE.Vector3();
const _worldPosScratch = new THREE.Vector3();
const _localAimScratch = new THREE.Vector3();

export function createFppEquipment3D(
  sprite: SpriteKind,
  textures: TextureBundle,
  opts?: { enableShadows?: boolean }
): FppEquipHandle {
  const group = new THREE.Group();
  const enableShadows = Boolean(opts?.enableShadows);
  const disposables: Array<{ dispose: () => void }> = [];

  const trackGeom = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.push(m);
    return m;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    disposables.push(t);
    return t;
  };

  const setShadow = (obj: THREE.Object3D, cast = true, recv = true) => {
    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = enableShadows && cast;
        child.receiveShadow = enableShadows && recv;
      }
    });
  };

  // Shared clinical PBR materials
  const bodyWhiteMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xf4f7fb,
      roughness: 0.34,
      metalness: 0.04,
      clearcoat: 0.36,
      clearcoatRoughness: 0.25,
    })
  );
  const slateFrameMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x334155,
      bumpMap: textures.brushedMetalBump,
      bumpScale: 0.004,
      roughness: 0.42,
      metalness: 0.48,
    })
  );
  const chromeMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xdbe4ef,
      bumpMap: textures.brushedMetalBump,
      bumpScale: 0.003,
      roughness: 0.18,
      metalness: 0.88,
      clearcoat: 0.2,
    })
  );
  const darkRubberMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.86,
      metalness: 0.04,
    })
  );
  const aluminumMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xcbd5e1,
      bumpMap: textures.brushedMetalBump,
      bumpScale: 0.0035,
      roughness: 0.28,
      metalness: 0.78,
    })
  );
  const woodOakMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      map: textures.wood,
      bumpMap: textures.woodBump,
      bumpScale: 0.01,
      roughness: 0.54,
      metalness: 0.02,
      clearcoat: 0.2,
    })
  );

  // Reusable caster assembly helper
  const wheelGeom = trackGeom(new THREE.CylinderGeometry(0.024, 0.024, 0.018, 12));
  wheelGeom.rotateZ(Math.PI / 2);
  const forkGeom = trackGeom(new THREE.BoxGeometry(0.024, 0.032, 0.024));
  const addCasters = (parent: THREE.Group, offsets: Array<[number, number]>) => {
    for (const [cx, cz] of offsets) {
      const fork = new THREE.Mesh(forkGeom, chromeMat);
      fork.position.set(cx, 0.036, cz);
      const wheel = new THREE.Mesh(wheelGeom, darkRubberMat);
      wheel.position.set(cx, 0.024, cz);
      parent.add(fork, wheel);
    }
  };

  let colliderHalfW = 0.24;
  let colliderHalfD = 0.24;
  let updateMotion: (input: FppEquipMotionInput) => void = () => {};

  if (sprite === 'infrared_lamp') {
    colliderHalfW = 0.25;
    colliderHalfD = 0.25;

    // 5-star chrome hospital caster base
    const hub = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.045, 0.056, 0.055, 16)), slateFrameMat);
    hub.position.y = 0.055;
    group.add(hub);

    const legGeom = trackGeom(new THREE.BoxGeometry(0.24, 0.022, 0.028));
    for (let i = 0; i < 5; i++) {
      const ang = (i * Math.PI * 2) / 5;
      const legWrap = new THREE.Group();
      legWrap.rotation.y = ang;
      const leg = new THREE.Mesh(legGeom, chromeMat);
      leg.position.set(0.12, 0.054, 0);
      const fork = new THREE.Mesh(forkGeom, chromeMat);
      fork.position.set(0.225, 0.036, 0);
      const wh = new THREE.Mesh(wheelGeom, darkRubberMat);
      wh.position.set(0.225, 0.024, 0);
      legWrap.add(leg, fork, wh);
      group.add(legWrap);
    }

    // Lower vertical upright column + height collar + control dimmer switch
    const lowerPole = new THREE.Mesh(
      trackGeom(new THREE.CylinderGeometry(0.017, 0.021, 0.72, 14)),
      bodyWhiteMat
    );
    lowerPole.position.y = 0.42;
    const collar = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.026, 0.026, 0.055, 14)), slateFrameMat);
    collar.position.y = 0.78;
    const dimmerBox = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.068, 0.11, 0.048)), bodyWhiteMat);
    dimmerBox.position.set(0, 0.7, 0.026);
    const dimmerDialMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x0ea5e9, emissive: 0x0284c7, emissiveIntensity: 0.4 })
    );
    const dimmerKnob = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.016, 0.016, 0.018, 12)), slateFrameMat);
    dimmerKnob.rotation.x = Math.PI / 2;
    dimmerKnob.position.set(0, 0.71, 0.055);
    const indicatorLed = new THREE.Mesh(trackGeom(new THREE.SphereGeometry(0.006, 8, 8)), dimmerDialMat);
    indicatorLed.position.set(0.018, 0.74, 0.052);
    group.add(lowerPole, collar, dimmerBox, dimmerKnob, indicatorLed);

    // Telescoping chrome upper mast (slides smoothly in height)
    const upperMast = new THREE.Group();
    upperMast.position.set(0, 0.78, 0);
    const innerPole = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.012, 0.012, 0.56, 12)), chromeMat);
    innerPole.position.y = 0.24;
    const knuckle = new THREE.Mesh(trackGeom(new THREE.SphereGeometry(0.024, 12, 10)), slateFrameMat);
    knuckle.position.y = 0.51;
    upperMast.add(innerPole, knuckle);
    group.add(upperMast);

    // Articulated boom arm cantilevering cleanly over patient
    const boomPivot = new THREE.Group();
    boomPivot.position.set(0, 0.51, 0);
    upperMast.add(boomPivot);

    const boomRod = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.01, 0.01, 0.46, 10)), chromeMat);
    boomRod.rotation.x = Math.PI / 2;
    boomRod.position.z = 0.23;
    const springCap = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.015, 0.015, 0.06, 10)), slateFrameMat);
    springCap.rotation.x = Math.PI / 2;
    springCap.position.z = 0.05;
    boomPivot.add(boomRod, springCap);

    // Swivel parabolic IR dome head + wire grill + quartz tungsten emitter + SpotLight
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0, 0.46);
    boomPivot.add(headPivot);

    const headYoke = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.018, 0.018, 0.045, 12)), slateFrameMat);
    const shadeHousingMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xe2e8f0,
        roughness: 0.26,
        metalness: 0.45,
        clearcoat: 0.45,
        side: THREE.DoubleSide,
      })
    );
    const domeGeom = trackGeom(new THREE.CylinderGeometry(0.048, 0.105, 0.14, 18, 1, true));
    domeGeom.rotateX(-Math.PI / 2);
    const dome = new THREE.Mesh(domeGeom, shadeHousingMat);
    dome.position.z = 0.03;

    const shadeBack = new THREE.Mesh(
      trackGeom(new THREE.SphereGeometry(0.049, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5)),
      bodyWhiteMat
    );
    shadeBack.rotation.x = -Math.PI / 2;
    shadeBack.position.z = -0.038;

    const ventRing = new THREE.Mesh(trackGeom(new THREE.TorusGeometry(0.104, 0.008, 8, 22)), slateFrameMat);
    ventRing.position.z = 0.10;

    // Protective wire guard bars
    const guardBarGeom = trackGeom(new THREE.CylinderGeometry(0.0022, 0.0022, 0.19, 6));
    const gBar1 = new THREE.Mesh(guardBarGeom, chromeMat);
    gBar1.position.z = 0.102;
    const gBar2 = new THREE.Mesh(guardBarGeom, chromeMat);
    gBar2.rotation.z = Math.PI / 2;
    gBar2.position.z = 0.102;
    const gRing = new THREE.Mesh(trackGeom(new THREE.TorusGeometry(0.056, 0.0022, 6, 18)), chromeMat);
    gRing.position.z = 0.102;

    const bulbMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffb399,
        emissive: 0xff3b14,
        emissiveIntensity: 0.2,
        roughness: 0.15,
      })
    );
    const bulb = new THREE.Mesh(trackGeom(new THREE.SphereGeometry(0.038, 12, 10)), bulbMat);
    bulb.position.z = 0.04;

    const irSpot = new THREE.SpotLight(0xff5a2c, 0, 2.4, Math.PI / 4.2, 0.65, 1.3);
    irSpot.position.set(0, 0, 0.09);
    irSpot.castShadow = false;
    const irTarget = new THREE.Object3D();
    irTarget.position.set(0, 0, 1.0);
    headPivot.add(headYoke, dome, shadeBack, ventRing, gBar1, gBar2, gRing, bulb, irSpot, irTarget);
    irSpot.target = irTarget;

    updateMotion = (input) => {
      const a = input.activeBlend;
      const desiredMastY = 0.72 + (input.closeRange ? 0.0 : 0.16) * a;
      upperMast.position.y = THREE.MathUtils.lerp(0.68, desiredMastY, a);
      boomPivot.rotation.x = THREE.MathUtils.lerp(0.32, input.closeRange ? 0.16 : -0.08, a);

      if (a > 0.05) {
        headPivot.getWorldPosition(_worldPosScratch);
        _aimDirScratch.set(
          input.aimWorldX - _worldPosScratch.x,
          input.aimWorldY - _worldPosScratch.y,
          input.aimWorldZ - _worldPosScratch.z
        );
        if (_aimDirScratch.lengthSq() > 1e-4) {
          _localAimScratch.set(input.aimWorldX, input.aimWorldY, input.aimWorldZ);
          headPivot.lookAt(_localAimScratch);
        }
      } else {
        headPivot.rotation.set(0.68, 0, 0);
      }

      const pulse = 1 + Math.sin(input.timeSec * 2.4) * 0.08;
      bulbMat.emissiveIntensity = 0.18 + a * 2.4 * pulse;
      dimmerDialMat.emissiveIntensity = 0.25 + a * 1.4;
      irSpot.intensity = a * (input.closeRange ? 3.2 : 2.1) * pulse;
    };
  } else if (sprite === 'swd_unit') {
    colliderHalfW = 0.23;
    colliderHalfD = 0.23;

    // Slim clinical shortwave diathermy tower (~0.36 x 0.36 x 0.84m)
    const chassis = new THREE.Group();
    group.add(chassis);
    addCasters(chassis, [
      [-0.14, -0.14],
      [0.14, -0.14],
      [-0.14, 0.14],
      [0.14, 0.14],
    ]);

    const tower = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.34, 0.74, 0.34)), bodyWhiteMat);
    tower.position.y = 0.42;
    const accentTrim = new THREE.Mesh(
      trackGeom(new THREE.BoxGeometry(0.348, 0.04, 0.348)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 }))
    );
    accentTrim.position.y = 0.78;
    const bezel = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.28, 0.16, 0.025)), slateFrameMat);
    bezel.position.set(0, 0.69, 0.172);
    bezel.rotation.x = -0.22;

    const screenTex = trackTex(
      createDeviceScreenTexture('SWD 27.12 MHz', '#f59e0b', ['120 W', 'CONT', '15:00', 'TUNED'], 'gauge')
    );
    const screenMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: screenTex,
        emissiveMap: screenTex,
        emissive: 0xffffff,
        emissiveIntensity: 0.45,
        roughness: 0.2,
      })
    );
    const screen = new THREE.Mesh(trackGeom(new THREE.PlaneGeometry(0.24, 0.13)), screenMat);
    screen.position.set(0, 0.694, 0.186);
    screen.rotation.x = -0.22;
    chassis.add(tower, accentTrim, bezel, screen);

    // Side ventilation louvers
    const louverGeom = trackGeom(new THREE.BoxGeometry(0.352, 0.012, 0.2));
    for (let li = 0; li < 5; li++) {
      const lv = new THREE.Mesh(louverGeom, slateFrameMat);
      lv.position.set(0, 0.18 + li * 0.04, 0);
      chassis.add(lv);
    }

    // Articulated pantograph RF arm + diplode drum
    const armShoulder = new THREE.Group();
    armShoulder.position.set(0, 0.8, -0.06);
    chassis.add(armShoulder);

    const armLower = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.036, 0.38, 0.042)), chromeMat);
    armLower.position.y = 0.19;
    armShoulder.add(armLower);

    const elbow = new THREE.Group();
    elbow.position.y = 0.38;
    armShoulder.add(elbow);

    const jointKnob = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.028, 0.028, 0.054, 12)), slateFrameMat);
    jointKnob.rotation.z = Math.PI / 2;
    const armUpper = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.032, 0.032, 0.42)), chromeMat);
    armUpper.position.z = 0.21;
    elbow.add(jointKnob, armUpper);

    const drumPivot = new THREE.Group();
    drumPivot.position.set(0, -0.03, 0.42);
    elbow.add(drumPivot);

    const drumBody = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.22, 0.055, 0.15)), bodyWhiteMat);
    const drumPadMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x0ea5e9,
        emissive: 0x0284c7,
        emissiveIntensity: 0.2,
        roughness: 0.5,
      })
    );
    const drumPad = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.20, 0.016, 0.13)), drumPadMat);
    drumPad.position.y = -0.032;
    drumPivot.add(drumBody, drumPad);

    updateMotion = (input) => {
      const a = input.activeBlend;
      armShoulder.rotation.x = THREE.MathUtils.lerp(-0.18, input.closeRange ? 0.46 : 0.22, a);
      elbow.rotation.x = THREE.MathUtils.lerp(0.55, input.closeRange ? 0.32 : 0.18, a);
      drumPivot.rotation.x = THREE.MathUtils.lerp(-0.2, -0.58, a);
      screenMat.emissiveIntensity = 0.32 + a * 0.58;
      drumPadMat.emissiveIntensity = 0.1 + a * (0.65 + Math.sin(input.timeSec * 3) * 0.18);
    };
  } else if (
    sprite === 'tens_unit' ||
    sprite === 'ultrasound_unit' ||
    sprite === 'laser_hilt' ||
    sprite === 'shockwave_eswt' ||
    sprite === 'emg_biofeedback' ||
    sprite === 'cryo_unit'
  ) {
    colliderHalfW = 0.22;
    colliderHalfD = 0.22;

    const accentHex =
      sprite === 'laser_hilt'
        ? 0xef4444
        : sprite === 'cryo_unit'
          ? 0x06b6d4
          : sprite === 'shockwave_eswt'
            ? 0xf59e0b
            : sprite === 'emg_biofeedback'
              ? 0x10b981
              : sprite === 'ultrasound_unit'
                ? 0x0ea5e9
                : 0x3b82f6;

    const screenCfg: Record<
      string,
      { title: string; accent: string; lines: string[]; mode: 'wave' | 'bars' | 'gauge' | 'grid' }
    > = {
      tens_unit: { title: 'TENS / IFC', accent: '#38bdf8', lines: ['80 Hz', '14 mA', 'BIPHAS', '20:00'], mode: 'wave' },
      ultrasound_unit: { title: 'ULTRASOUND', accent: '#0ea5e9', lines: ['1.0 MHz', '1.2 W', '50% D', '08:00'], mode: 'bars' },
      laser_hilt: { title: 'HILT 1064nm', accent: '#f43f5e', lines: ['10.5 W', '850 J', 'CONT', 'CLASS4'], mode: 'gauge' },
      shockwave_eswt: { title: 'ESWT RADIAL', accent: '#f59e0b', lines: ['2.4 bar', '10 Hz', '2000', 'PULSE'], mode: 'bars' },
      emg_biofeedback: { title: 'sEMG BIO', accent: '#10b981', lines: ['CH1 48uV', 'CH2 12uV', 'TARGET', 'GAIN x2'], mode: 'wave' },
      cryo_unit: { title: 'CRYO COMP', accent: '#22d3ee', lines: ['4.5 °C', '45 mmHg', 'FLOW H', '15:00'], mode: 'gauge' },
    };

    // Compact rolling medical trolley (0.35m W x 0.35m D x 0.80m H)
    addCasters(group, [
      [-0.135, -0.135],
      [0.135, -0.135],
      [-0.135, 0.135],
      [0.135, 0.135],
    ]);

    const basePlate = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.34, 0.032, 0.34)), bodyWhiteMat);
    basePlate.position.y = 0.068;
    const stem = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.028, 0.032, 0.64, 14)), aluminumMat);
    stem.position.set(0, 0.39, -0.05);
    const midTray = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.31, 0.022, 0.28)), bodyWhiteMat);
    midTray.position.set(0, 0.44, 0);
    const consoleTop = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.34, 0.04, 0.3)), bodyWhiteMat);
    consoleTop.position.set(0, 0.72, 0);

    const accentMat = trackMat(new THREE.MeshStandardMaterial({ color: accentHex, roughness: 0.35 }));
    const accentBand = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.344, 0.016, 0.304)), accentMat);
    accentBand.position.set(0, 0.70, 0);

    // Chrome rear/side push handle
    const handleBar = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.01, 0.01, 0.3, 10)), chromeMat);
    handleBar.rotation.z = Math.PI / 2;
    handleBar.position.set(0, 0.76, -0.17);

    // Tilted clinical unit housing + crisp live CanvasTexture monitor
    const unitBody = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.28, 0.14, 0.22)), bodyWhiteMat);
    unitBody.position.set(0, 0.79, -0.01);
    const screenFrame = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.24, 0.14, 0.02)), slateFrameMat);
    screenFrame.position.set(0, 0.84, 0.08);
    screenFrame.rotation.x = -0.45;

    const cfg = screenCfg[sprite];
    const sTex = trackTex(createDeviceScreenTexture(cfg.title, cfg.accent, cfg.lines, cfg.mode));
    const screenMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: sTex,
        emissiveMap: sTex,
        emissive: 0xffffff,
        emissiveIntensity: 0.45,
        roughness: 0.18,
      })
    );
    const screenFace = new THREE.Mesh(trackGeom(new THREE.PlaneGeometry(0.21, 0.115)), screenMat);
    screenFace.position.set(0, 0.844, 0.091);
    screenFace.rotation.x = -0.45;

    // Bottle / gel / accessory cup on mid tray
    const gelBottle = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.024, 0.024, 0.11, 10)), accentMat);
    gelBottle.position.set(0.1, 0.505, 0.06);
    const gelCap = new THREE.Mesh(trackGeom(new THREE.ConeGeometry(0.018, 0.03, 10)), bodyWhiteMat);
    gelCap.position.set(0.1, 0.57, 0.06);

    group.add(basePlate, stem, midTray, consoleTop, accentBand, handleBar, unitBody, screenFrame, screenFace, gelBottle, gelCap);

    // Articulated probe / lead arm extending cleanly toward target when active
    const probeArm = new THREE.Group();
    probeArm.position.set(0.12, 0.76, 0.07);
    group.add(probeArm);

    const leadCable = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.0055, 0.0055, 0.36, 8)), darkRubberMat);
    leadCable.rotation.x = Math.PI / 2;
    leadCable.position.z = 0.18;
    const handpiece = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.013, 0.016, 0.13, 10)), slateFrameMat);
    handpiece.rotation.x = Math.PI / 2;
    handpiece.position.z = 0.38;
    const tipMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: accentHex,
        emissive: accentHex,
        emissiveIntensity: 0.25,
        roughness: 0.25,
      })
    );
    const tipMesh = new THREE.Mesh(trackGeom(new THREE.SphereGeometry(0.017, 10, 8)), tipMat);
    tipMesh.position.z = 0.45;
    probeArm.add(leadCable, handpiece, tipMesh);

    updateMotion = (input) => {
      const a = input.activeBlend;
      screenMat.emissiveIntensity = 0.35 + a * 0.62;
      tipMat.emissiveIntensity = 0.18 + a * (1.2 + Math.sin(input.timeSec * 4) * 0.3);
      if (a > 0.05) {
        probeArm.getWorldPosition(_worldPosScratch);
        _localAimScratch.set(input.aimWorldX, input.aimWorldY, input.aimWorldZ);
        probeArm.lookAt(_localAimScratch);
        probeArm.scale.set(1, 1, THREE.MathUtils.lerp(0.45, 1.0, a));
      } else {
        probeArm.rotation.set(0.85, -0.35, 0);
        probeArm.scale.set(1, 1, 0.42);
      }
    };
  } else if (sprite === 'cpm_device') {
    colliderHalfW = 0.38;
    colliderHalfD = 0.18;

    // Wheeled standby dock carriage stays cleanly visible on floor when stowed; cradle tracks onto mattress height when active
    const cradle = new THREE.Group();
    group.add(cradle);

    const railGeom = trackGeom(new THREE.CylinderGeometry(0.012, 0.012, 0.72, 10));
    railGeom.rotateZ(Math.PI / 2);
    for (const rz of [-0.095, 0.095]) {
      const r = new THREE.Mesh(railGeom, aluminumMat);
      r.position.set(0, 0.032, rz);
      cradle.add(r);
    }

    const motorHousing = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.14, 0.075, 0.22)), bodyWhiteMat);
    motorHousing.position.set(-0.3, 0.055, 0);
    const padMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.55 }));
    const hipRest = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.22, 0.032, 0.16)), padMat);
    hipRest.position.set(-0.18, 0.085, 0);

    const thighArm = new THREE.Group();
    thighArm.position.set(-0.24, 0.07, 0);
    const thighBar = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.28, 0.022, 0.15)), aluminumMat);
    thighBar.position.set(0.14, 0, 0);
    const thighCushion = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.22, 0.025, 0.14)), padMat);
    thighCushion.position.set(0.14, 0.022, 0);
    thighArm.add(thighBar, thighCushion);

    const kneeJoint = new THREE.Group();
    kneeJoint.position.set(0.28, 0, 0);
    thighArm.add(kneeJoint);

    const shinBar = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.28, 0.022, 0.15)), aluminumMat);
    shinBar.position.set(0.14, 0, 0);
    const shinCushion = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.22, 0.025, 0.14)), padMat);
    shinCushion.position.set(0.14, 0.022, 0);
    const footBoot = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.032, 0.16, 0.14)), padMat);
    footBoot.position.set(0.27, 0.08, 0);
    kneeJoint.add(shinBar, shinCushion, footBoot);

    cradle.add(motorHousing, hipRest, thighArm);

    updateMotion = (input) => {
      const a = input.activeBlend;
      const mount = input.onBedBlend ?? a;
      // Smoothly lift cradle to rest cleanly on the mattress deck (bedHeight) when placed at patient
      cradle.position.y = THREE.MathUtils.lerp(0.02, Math.max(0.02, input.bedHeight), mount);
      const flexWave = a > 0.08 ? (0.5 - 0.5 * Math.cos(input.timeSec * 1.15)) * a : 0.12;
      thighArm.rotation.z = 0.2 + flexWave * 0.42;
      kneeJoint.rotation.z = -0.34 - flexWave * 0.76;
    };
  } else if (sprite === 'hand_rehab_table') {
    colliderHalfW = 0.30;
    colliderHalfD = 0.22;

    // C-frame height-adjustable overbed therapy table
    const cFootL = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.04, 0.025, 0.42)), slateFrameMat);
    cFootL.position.set(-0.24, 0.04, 0);
    const cFootR = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.04, 0.025, 0.42)), slateFrameMat);
    cFootR.position.set(0.24, 0.04, 0);
    const cBack = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.52, 0.028, 0.04)), slateFrameMat);
    cBack.position.set(0, 0.042, -0.19);
    addCasters(group, [
      [-0.24, -0.18],
      [-0.24, 0.18],
      [0.24, -0.18],
      [0.24, 0.18],
    ]);

    const col = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.024, 0.028, 0.72, 12)), chromeMat);
    col.position.set(0, 0.40, -0.18);
    const topDeck = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.58, 0.028, 0.36)), woodOakMat);
    topDeck.position.set(0, 0.76, 0);
    const edgeBand = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.586, 0.012, 0.366)), bodyWhiteMat);
    edgeBand.position.set(0, 0.752, 0);

    // Fine-motor hand rehab tools arranged neatly on top
    const pegBase = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.18, 0.018, 0.14)), woodOakMat);
    pegBase.position.set(-0.14, 0.783, 0);
    const pegMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 }));
    for (let px = -2; px <= 2; px++) {
      const peg = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.005, 0.005, 0.048, 8)), pegMat);
      peg.position.set(-0.14 + px * 0.028, 0.812, -0.02 + (px % 2) * 0.04);
      group.add(peg);
    }

    const puttyTub1 = new THREE.Mesh(
      trackGeom(new THREE.CylinderGeometry(0.036, 0.036, 0.034, 12)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.38 }))
    );
    puttyTub1.position.set(0.08, 0.79, 0.06);
    const puttyTub2 = new THREE.Mesh(
      trackGeom(new THREE.CylinderGeometry(0.036, 0.036, 0.034, 12)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.38 }))
    );
    puttyTub2.position.set(0.17, 0.79, 0.06);

    const dynaBody = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.04, 0.09, 0.08)), aluminumMat);
    dynaBody.position.set(0.12, 0.82, -0.07);
    const dynaGauge = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.028, 0.028, 0.015, 14)), bodyWhiteMat);
    dynaGauge.rotation.z = Math.PI / 2;
    dynaGauge.position.set(0.12, 0.86, -0.07);

    group.add(cFootL, cFootR, cBack, col, topDeck, edgeBand, pegBase, puttyTub1, puttyTub2, dynaBody, dynaGauge);
  } else if (sprite === 'paraffin_bath' || sprite === 'hydro_sink') {
    colliderHalfW = 0.22;
    colliderHalfD = 0.20;
    const isHydro = sprite === 'hydro_sink';
    addCasters(group, [
      [-0.15, -0.13],
      [0.15, -0.13],
      [-0.15, 0.13],
      [0.15, 0.13],
    ]);

    if (isHydro) {
      const tank = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.38, 0.68, 0.32)), aluminumMat);
      tank.position.y = 0.39;
      const lid = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.39, 0.028, 0.33)), chromeMat);
      lid.position.y = 0.74;
      const lidHandle = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.12, 0.018, 0.024)), darkRubberMat);
      lidHandle.position.set(0, 0.768, 0.11);
      const gauge = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.026, 0.026, 0.016, 14)), bodyWhiteMat);
      gauge.rotation.x = Math.PI / 2;
      gauge.position.set(0, 0.62, 0.162);
      const hotPack = new THREE.Mesh(
        trackGeom(new THREE.BoxGeometry(0.22, 0.032, 0.16)),
        trackMat(new THREE.MeshStandardMaterial({ color: 0xe2d5be, roughness: 0.85 }))
      );
      hotPack.position.set(0, 0.77, -0.04);
      group.add(tank, lid, lidHandle, gauge, hotPack);
    } else {
      // Clinical trolley carrying paraffin wax unit
      const shelfBot = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.38, 0.02, 0.32)), aluminumMat);
      shelfBot.position.y = 0.12;
      const shelfTop = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.38, 0.022, 0.32)), aluminumMat);
      shelfTop.position.y = 0.58;
      const postGeom = trackGeom(new THREE.CylinderGeometry(0.012, 0.012, 0.52, 8));
      for (const [px, pz] of [
        [-0.17, -0.14],
        [0.17, -0.14],
        [-0.17, 0.14],
        [0.17, 0.14],
      ]) {
        const post = new THREE.Mesh(postGeom, chromeMat);
        post.position.set(px, 0.33, pz);
        group.add(post);
      }
      const tub = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.30, 0.16, 0.24)), bodyWhiteMat);
      tub.position.set(0, 0.67, 0);
      const waxMat = trackMat(
        new THREE.MeshPhysicalMaterial({
          color: 0xfde68a,
          emissive: 0xf59e0b,
          emissiveIntensity: 0.15,
          roughness: 0.22,
          clearcoat: 0.6,
        })
      );
      const waxPool = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.25, 0.02, 0.19)), waxMat);
      waxPool.position.set(0, 0.745, 0);
      group.add(shelfBot, shelfTop, tub, waxPool);

      updateMotion = (input) => {
        waxMat.emissiveIntensity = 0.15 + input.activeBlend * 0.48;
      };
    }
  } else if (sprite === 'pt_toolkit_cart') {
    colliderHalfW = 0.24;
    colliderHalfD = 0.18;

    addCasters(group, [
      [-0.19, -0.13],
      [0.19, -0.13],
      [-0.19, 0.13],
      [0.19, 0.13],
    ]);
    const shelfGeom = trackGeom(new THREE.BoxGeometry(0.44, 0.022, 0.30));
    for (const sy of [0.12, 0.44, 0.74]) {
      const sh = new THREE.Mesh(shelfGeom, bodyWhiteMat);
      sh.position.y = sy;
      group.add(sh);
    }
    const postGeom = trackGeom(new THREE.CylinderGeometry(0.011, 0.011, 0.68, 8));
    for (const [px, pz] of [
      [-0.2, -0.13],
      [0.2, -0.13],
      [-0.2, 0.13],
      [0.2, 0.13],
    ]) {
      const p = new THREE.Mesh(postGeom, chromeMat);
      p.position.set(px, 0.42, pz);
      group.add(p);
    }

    // Clinical manual assessment tools on top shelf
    const tape1 = new THREE.Mesh(
      trackGeom(new THREE.TorusGeometry(0.028, 0.012, 8, 16)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.5 }))
    );
    tape1.rotation.x = Math.PI / 2;
    tape1.position.set(-0.12, 0.764, 0.05);
    const hammerHandle = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.005, 0.005, 0.16, 8)), chromeMat);
    hammerHandle.rotation.z = Math.PI / 2;
    hammerHandle.position.set(0.04, 0.76, -0.05);
    const hammerHead = new THREE.Mesh(
      trackGeom(new THREE.ConeGeometry(0.018, 0.045, 8)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.6 }))
    );
    hammerHead.rotation.x = Math.PI / 2;
    hammerHead.position.set(0.11, 0.76, -0.05);
    const iastm = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.11, 0.006, 0.036)), chromeMat);
    iastm.position.set(0.06, 0.758, 0.06);
    const goni = new THREE.Mesh(
      trackGeom(new THREE.RingGeometry(0.02, 0.036, 16)),
      trackMat(new THREE.MeshPhysicalMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.75, side: THREE.DoubleSide }))
    );
    goni.rotation.x = -Math.PI / 2;
    goni.position.set(-0.1, 0.756, -0.06);
    group.add(tape1, hammerHandle, hammerHead, iastm, goni);
  } else if (sprite === 'ball_rack') {
    colliderHalfW = 0.25;
    colliderHalfD = 0.25;

    const baseRing = new THREE.Mesh(trackGeom(new THREE.TorusGeometry(0.21, 0.016, 8, 22)), slateFrameMat);
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = 0.03;
    const upright = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.015, 0.018, 1.05, 10)), slateFrameMat);
    upright.position.set(0, 0.54, -0.2);

    const ringGeom = trackGeom(new THREE.TorusGeometry(0.18, 0.012, 8, 22));
    ringGeom.rotateX(Math.PI / 2);
    const rLow = new THREE.Mesh(ringGeom, slateFrameMat);
    rLow.position.set(0, 0.24, 0.02);
    const rHigh = new THREE.Mesh(ringGeom, slateFrameMat);
    rHigh.position.set(0, 0.84, 0.02);

    const ball1 = new THREE.Mesh(
      trackGeom(new THREE.SphereGeometry(0.24, 20, 16)),
      trackMat(new THREE.MeshPhysicalMaterial({ color: 0x0ea5e9, roughness: 0.42, clearcoat: 0.2 }))
    );
    ball1.position.set(0, 0.34, 0.02);
    const ball2 = new THREE.Mesh(
      trackGeom(new THREE.SphereGeometry(0.21, 20, 16)),
      trackMat(new THREE.MeshPhysicalMaterial({ color: 0x14b8a6, roughness: 0.42, clearcoat: 0.2 }))
    );
    ball2.position.set(0, 0.94, 0.02);
    group.add(baseRing, upright, rLow, rHigh, ball1, ball2);
  } else if (sprite === 'balance_trainer') {
    colliderHalfW = 0.26;
    colliderHalfD = 0.24;

    const plate = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.48, 0.048, 0.44)), bodyWhiteMat);
    plate.position.y = 0.024;
    const forcePad = new THREE.Mesh(
      trackGeom(new THREE.CylinderGeometry(0.18, 0.19, 0.016, 22)),
      darkRubberMat
    );
    forcePad.position.set(0, 0.054, 0.02);
    const railPostL = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.014, 0.014, 0.86, 10)), chromeMat);
    railPostL.position.set(-0.21, 0.46, -0.17);
    const railPostR = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.014, 0.014, 0.86, 10)), chromeMat);
    railPostR.position.set(0.21, 0.46, -0.17);
    const railTop = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.014, 0.014, 0.44, 10)), chromeMat);
    railTop.rotation.z = Math.PI / 2;
    railTop.position.set(0, 0.89, -0.17);
    const tablet = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.22, 0.14, 0.018)), slateFrameMat);
    tablet.position.set(0, 0.92, -0.14);
    tablet.rotation.x = -0.38;
    group.add(plate, forcePad, railPostL, railPostR, railTop, tablet);
  } else if (sprite === 'exercise_bike') {
    colliderHalfW = 0.26;
    colliderHalfD = 0.46;

    const base = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.42, 0.045, 0.84)), slateFrameMat);
    base.position.y = 0.0225;
    const shroud = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.22, 0.42, 0.42)), bodyWhiteMat);
    shroud.position.set(0, 0.25, 0.08);
    const seatPost = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.018, 0.022, 0.48, 10)), chromeMat);
    seatPost.position.set(0, 0.56, -0.18);
    seatPost.rotation.x = -0.18;
    const saddle = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.22, 0.055, 0.24)), darkRubberMat);
    saddle.position.set(0, 0.81, -0.22);
    const stemPost = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.02, 0.024, 0.68, 10)), chromeMat);
    stemPost.position.set(0, 0.66, 0.24);
    stemPost.rotation.x = 0.2;
    const consoleBox = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.26, 0.14, 0.04)), slateFrameMat);
    consoleBox.position.set(0, 1.0, 0.28);
    consoleBox.rotation.x = -0.35;
    const barL = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 8)), darkRubberMat);
    barL.rotation.z = Math.PI / 2;
    barL.position.set(-0.18, 0.95, 0.27);
    const barR = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 8)), darkRubberMat);
    barR.rotation.z = Math.PI / 2;
    barR.position.set(0.18, 0.95, 0.27);
    group.add(base, shroud, seatPost, saddle, stemPost, consoleBox, barL, barR);
  } else if (sprite === 'treadmill') {
    colliderHalfW = 0.38;
    colliderHalfD = 0.78;

    const deckFrame = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.68, 0.12, 1.48)), bodyWhiteMat);
    deckFrame.position.y = 0.06;
    const belt = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.50, 0.018, 1.24)), darkRubberMat);
    belt.position.set(0, 0.124, -0.06);
    const motorHood = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.64, 0.12, 0.28)), slateFrameMat);
    motorHood.position.set(0, 0.15, 0.56);

    for (const sx of [-0.31, 0.31]) {
      const upright = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.045, 0.96, 0.055)), aluminumMat);
      upright.position.set(sx, 0.56, 0.58);
      const rail = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.016, 0.016, 0.98, 10)), chromeMat);
      rail.rotation.x = Math.PI / 2;
      rail.position.set(sx, 0.92, 0.12);
      const midDrop = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.016, 0.016, 0.82, 10)), chromeMat);
      midDrop.position.set(sx, 0.51, -0.25);
      group.add(upright, rail, midDrop);
    }
    const consoleHead = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.62, 0.18, 0.09)), slateFrameMat);
    consoleHead.position.set(0, 1.06, 0.56);
    consoleHead.rotation.x = -0.35;
    group.add(deckFrame, belt, motorHood, consoleHead);
  } else if (sprite === 'parallel_bars') {
    colliderHalfW = 0.38;
    colliderHalfD = 0.82;

    const walkway = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.68, 0.036, 1.6)), woodOakMat);
    walkway.position.y = 0.018;
    group.add(walkway);

    const railGeom = trackGeom(new THREE.CylinderGeometry(0.016, 0.016, 1.56, 10));
    railGeom.rotateX(Math.PI / 2);
    const stanchionGeom = trackGeom(new THREE.CylinderGeometry(0.018, 0.022, 0.82, 10));
    for (const sx of [-0.29, 0.29]) {
      const bar = new THREE.Mesh(railGeom, chromeMat);
      bar.position.set(sx, 0.86, 0);
      group.add(bar);
      for (const sz of [-0.62, 0.62]) {
        const post = new THREE.Mesh(stanchionGeom, slateFrameMat);
        post.position.set(sx, 0.44, sz);
        group.add(post);
      }
    }
  } else if (sprite === 'wall_bars') {
    colliderHalfW = 0.40;
    colliderHalfD = 0.14;

    for (const sx of [-0.36, 0.36]) {
      const sideRail = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.04, 2.15, 0.12)), woodOakMat);
      sideRail.position.set(sx, 1.075, 0);
      group.add(sideRail);
    }
    const rungGeom = trackGeom(new THREE.CylinderGeometry(0.015, 0.015, 0.72, 10));
    rungGeom.rotateZ(Math.PI / 2);
    for (let ri = 0; ri < 11; ri++) {
      const rung = new THREE.Mesh(rungGeom, woodOakMat);
      rung.position.set(0, 0.2 + ri * 0.175, ri === 10 ? 0.05 : 0);
      group.add(rung);
    }
  } else {
    // multi_gym_pulley or any fallback stationary resistance unit
    colliderHalfW = 0.28;
    colliderHalfD = 0.26;

    const frameBase = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.48, 0.04, 0.44)), slateFrameMat);
    frameBase.position.y = 0.02;
    const column = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.1, 2.04, 0.1)), bodyWhiteMat);
    column.position.set(0, 1.04, -0.12);
    const guideL = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.01, 0.01, 1.9, 8)), chromeMat);
    guideL.position.set(-0.08, 1.0, 0);
    const guideR = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.01, 0.01, 1.9, 8)), chromeMat);
    guideR.position.set(0.08, 1.0, 0);
    const plateGeom = trackGeom(new THREE.BoxGeometry(0.22, 0.032, 0.12));
    for (let wi = 0; wi < 8; wi++) {
      const wt = new THREE.Mesh(plateGeom, darkRubberMat);
      wt.position.set(0, 0.12 + wi * 0.04, 0);
      group.add(wt);
    }
    const carriage = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.12, 0.1, 0.12)), chromeMat);
    carriage.position.set(0, 1.18, 0.14);
    group.add(frameBase, column, guideL, guideR, carriage);
  }

  setShadow(group, true, true);

  return {
    group,
    colliderHalfW,
    colliderHalfD,
    updateMotion,
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
