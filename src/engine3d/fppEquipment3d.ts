import * as THREE from 'three';
import { DeviceConsoleParams, FppProbeAnchor, SpriteKind } from '../types/clinic';
import { TextureBundle } from './textures3d';

export interface FppProbeWorldTarget {
  id: string;
  placed: boolean;
  worldX: number;
  worldY: number;
  worldZ: number;
  wnx: number;
  wny: number;
  wnz: number;
  selected?: boolean;
  holding?: boolean;
  attachBlend?: number;
  gripWorldX?: number;
  gripWorldY?: number;
  gripWorldZ?: number;
  gripAxisX?: number;
  gripAxisY?: number;
  gripAxisZ?: number;
}

interface FppEquipMotionInput {
  activeBlend: number;
  onBedBlend?: number;
  timeSec: number;
  aimWorldX: number;
  aimWorldY: number;
  aimWorldZ: number;
  bedHeight: number;
  closeRange: boolean;
  isRunning?: boolean;
  irIntensity?: number;
  irHeightOffset?: number;
  irLateralOffset?: number;
  irDistance?: number;
  deviceParams?: DeviceConsoleParams;
  probeWorldTargets?: FppProbeWorldTarget[];
}

interface FppEquipCarrySpec {
  carryMode: 'roll' | 'lift';
  gripStyle: 'pole' | 'bar' | 'crate';
  holdDist: number;
  holdY: number;
  holdRotOffset: number;
  leftLocal: [number, number, number];
  rightLocal: [number, number, number];
}

const DEVICE_SCREEN_SPRITES = new Set<SpriteKind>([
  'tens_unit',
  'ultrasound_unit',
  'laser_hilt',
  'swd_unit',
  'shockwave_eswt',
  'emg_biofeedback',
  'cryo_unit',
  'cpm_device',
  'paraffin_bath',
  'hydro_sink',
  'balance_trainer',
  'magnetotherapy',
  'tilt_table',
  'traction_table',
  'exercise_bike',
  'treadmill',
  'parallel_bars',
  'wall_bars',
  'multi_gym_pulley',
  'hand_rehab_table',
  'pt_toolkit_cart',
  'ball_rack',
]);

const DEVICE_PROBE_SPRITES = new Set<SpriteKind>([
  'tens_unit',
  'emg_biofeedback',
  'ultrasound_unit',
  'laser_hilt',
  'shockwave_eswt',
  'cryo_unit',
  'swd_unit',
  'infrared_lamp',
  'hydro_sink',
  'paraffin_bath',
  'pt_toolkit_cart',
]);

const CONTINUOUS_HANDHELD_SPRITES = new Set<SpriteKind>([
  'ultrasound_unit',
  'laser_hilt',
  'shockwave_eswt',
  'pt_toolkit_cart',
]);

export function hasDeviceInteractiveScreen(sprite: SpriteKind): boolean {
  return DEVICE_SCREEN_SPRITES.has(sprite);
}

export function hasDeviceProbes(sprite: SpriteKind): boolean {
  return DEVICE_PROBE_SPRITES.has(sprite);
}

export function isContinuousHandheldDevice(sprite: SpriteKind): boolean {
  return CONTINUOUS_HANDHELD_SPRITES.has(sprite);
}

export function getDefaultProbeAnchors(sprite: SpriteKind): FppProbeAnchor[] {
  switch (sprite) {
    case 'tens_unit':
      return [
        { id: 'ch1_a', label: 'CH1 +', bayX: 0, bayY: 0, bayZ: 0, nx: 0, ny: 1, nz: 0, placed: false },
        { id: 'ch1_b', label: 'CH1 −', bayX: 0, bayY: 0, bayZ: 0, nx: 0, ny: 1, nz: 0, placed: false },
        { id: 'ch2_a', label: 'CH2 +', bayX: 0, bayY: 0, bayZ: 0, nx: 0, ny: 1, nz: 0, placed: false },
        { id: 'ch2_b', label: 'CH2 −', bayX: 0, bayY: 0, bayZ: 0, nx: 0, ny: 1, nz: 0, placed: false },
      ];
    case 'emg_biofeedback':
      return [
        { id: 'emg_1', label: 'CH1 Active', bayX: 0, bayY: 0, bayZ: 0, nx: 0, ny: 1, nz: 0, placed: false },
        { id: 'emg_2', label: 'CH2 Active', bayX: 0, bayY: 0, bayZ: 0, nx: 0, ny: 1, nz: 0, placed: false },
        { id: 'emg_ref', label: 'Ref GND', bayX: 0, bayY: 0, bayZ: 0, nx: 0, ny: 1, nz: 0, placed: false },
      ];
    case 'ultrasound_unit':
      return [{ id: 'head', label: 'US Head', bayX: 0, bayY: 0, bayZ: 0, nx: 0, ny: 1, nz: 0, placed: false }];
    case 'laser_hilt':
      return [{ id: 'head', label: 'Laser Wand', bayX: 0, bayY: 0, bayZ: 0, nx: 0, ny: 1, nz: 0, placed: false }];
    case 'shockwave_eswt':
      return [{ id: 'head', label: 'ESWT Gun', bayX: 0, bayY: 0, bayZ: 0, nx: 0, ny: 1, nz: 0, placed: false }];
    case 'cryo_unit':
      return [{ id: 'head', label: 'Cryo Cuff', bayX: 0, bayY: 0, bayZ: 0, nx: 0, ny: 1, nz: 0, placed: false }];
    case 'swd_unit':
      return [{ id: 'head', label: 'RF Drum', bayX: 0, bayY: 0, bayZ: 0, nx: 0, ny: 1, nz: 0, placed: false }];
    case 'infrared_lamp':
      return [{ id: 'head', label: 'IR Beam', bayX: 0, bayY: 0, bayZ: 0, nx: 0, ny: 1, nz: 0, placed: false }];
    case 'hydro_sink':
      return [{ id: 'head', label: 'Hot Pack', bayX: 0, bayY: 0, bayZ: 0, nx: 0, ny: 1, nz: 0, placed: false }];
    case 'paraffin_bath':
      return [{ id: 'head', label: 'Paraffin Mitt', bayX: 0, bayY: 0, bayZ: 0, nx: 0, ny: 1, nz: 0, placed: false }];
    case 'pt_toolkit_cart':
      return [{ id: 'head', label: 'PT Tool', bayX: 0, bayY: 0, bayZ: 0, nx: 0, ny: 1, nz: 0, placed: false }];
    default:
      return [];
  }
}

export function getDefaultDeviceParams(sprite: SpriteKind): DeviceConsoleParams {
  switch (sprite) {
    case 'tens_unit':
      return { intensity: 16, freqHz: 80, pulseUs: 120, timerMin: 20, timerRemainingSec: 20 * 60, mode: 'CONV' };
    case 'ultrasound_unit':
      return { intensity: 1.2, freqHz: 1, dutyPct: 50, timerMin: 8, timerRemainingSec: 8 * 60, mode: 'PULSED' };
    case 'laser_hilt':
      return { intensity: 10, timerMin: 6, timerRemainingSec: 6 * 60, mode: 'ANALGESIC', shocks: 850 };
    case 'swd_unit':
      return { intensity: 120, timerMin: 15, timerRemainingSec: 15 * 60, mode: 'CONT' };
    case 'shockwave_eswt':
      return {
        intensity: 2.4,
        freqHz: 10,
        shocks: 2000,
        deliveredShocks: 0,
        timerMin: 5,
        timerRemainingSec: 5 * 60,
        tipSize: '15mm',
        mode: 'RADIAL',
      };
    case 'emg_biofeedback':
      return { intensity: 35, freqHz: 2, timerMin: 12, timerRemainingSec: 12 * 60, mode: 'WORK/REST' };
    case 'cryo_unit':
      return { tempC: 4, pressureMmHg: 45, flow: 'HIGH', timerMin: 15, timerRemainingSec: 15 * 60 };
    case 'cpm_device':
      return { extDeg: 0, flexDeg: 90, speed: 2, timerMin: 30, timerRemainingSec: 30 * 60 };
    case 'paraffin_bath':
      return { tempC: 53, timerMin: 15, timerRemainingSec: 15 * 60, mode: 'DIP&WRAP' };
    case 'hydro_sink':
      return { tempC: 74, timerMin: 15, timerRemainingSec: 15 * 60, mode: 'STD PACK' };
    case 'balance_trainer':
      return { intensity: 2, mode: 'FIRM EO', timerMin: 10, timerRemainingSec: 10 * 60 };
    case 'infrared_lamp':
      return { timerMin: 15, timerRemainingSec: 15 * 60 };
    case 'hand_rehab_table':
      return { tool: 'PEGBOARD', gripKg: 28, timerMin: 15, timerRemainingSec: 15 * 60 };
    case 'pt_toolkit_cart':
      return { tool: 'GONIOMETER', romDeg: 115, dtrGrade: '2+', timerMin: 10, timerRemainingSec: 10 * 60 };
    case 'ball_rack':
      return { tool: 'CORE STABILITY', ballSize: '55cm', timerMin: 12, timerRemainingSec: 12 * 60 };
    case 'traction_table':
      return { tensionKg: 22, mode: 'INTERM', timerMin: 15, timerRemainingSec: 15 * 60 };
    case 'exercise_bike':
      return { resistance: 4, rpm: 62, timerMin: 15, timerRemainingSec: 15 * 60 };
    case 'treadmill':
      return { speed: 2.8, inclinePct: 2, timerMin: 12, timerRemainingSec: 12 * 60 };
    case 'parallel_bars':
      return { barHeightCm: 85, mode: 'ALTERNATING', timerMin: 12, timerRemainingSec: 12 * 60 };
    case 'wall_bars':
      return { mode: 'SPINAL HANG', resistance: 2, timerMin: 10, timerRemainingSec: 10 * 60 };
    case 'multi_gym_pulley':
      return { weightKg: 7.5, mode: 'ROW PULL', timerMin: 12, timerRemainingSec: 12 * 60 };
    case 'magnetotherapy':
      return {
        intensity: 45,
        freqHz: 25,
        timerMin: 20,
        timerRemainingSec: 20 * 60,
        mode: 'PULSED',
        magnetZone: 'SCAN',
        speed: 2,
      };
    case 'tilt_table':
      return {
        tiltDeg: 45,
        currentTiltDeg: 0,
        speed: 2,
        timerMin: 15,
        timerRemainingSec: 15 * 60,
        mode: 'GRADUAL',
      };
    default:
      return { timerMin: 15, timerRemainingSec: 15 * 60 };
  }
}

export function formatTimerMmSs(params?: DeviceConsoleParams, fallbackMin = 15): string {
  const totalSec = Math.max(0, Math.round(params?.timerRemainingSec ?? (params?.timerMin ?? fallbackMin) * 60));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function getFppEquipCarrySpec(sprite: SpriteKind): FppEquipCarrySpec {
  switch (sprite) {
    case 'infrared_lamp':
      return {
        carryMode: 'roll',
        gripStyle: 'pole',
        holdDist: 0.70,
        holdY: 0,
        holdRotOffset: Math.PI,
        leftLocal: [0.022, 0.90, -0.055],
        rightLocal: [-0.022, 0.81, -0.055],
      };
    case 'swd_unit':
      return {
        carryMode: 'roll',
        gripStyle: 'bar',
        holdDist: 0.86,
        holdY: 0,
        holdRotOffset: Math.PI,
        leftLocal: [0.11, 0.82, -0.255],
        rightLocal: [-0.11, 0.82, -0.255],
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
        holdDist: 0.86,
        holdY: 0,
        holdRotOffset: Math.PI,
        leftLocal: [0.11, 0.78, -0.21],
        rightLocal: [-0.11, 0.78, -0.21],
      };
    case 'hand_rehab_table':
      return {
        carryMode: 'roll',
        gripStyle: 'bar',
        holdDist: 0.86,
        holdY: 0,
        holdRotOffset: Math.PI,
        leftLocal: [0.16, 0.81, -0.25],
        rightLocal: [-0.16, 0.81, -0.25],
      };
    case 'paraffin_bath':
    case 'hydro_sink':
    case 'pt_toolkit_cart':
      return {
        carryMode: 'roll',
        gripStyle: 'bar',
        holdDist: 0.86,
        holdY: 0,
        holdRotOffset: Math.PI,
        leftLocal: [0.13, 0.78, -0.23],
        rightLocal: [-0.13, 0.78, -0.23],
      };
    case 'cpm_device':
      return {
        carryMode: 'lift',
        gripStyle: 'crate',
        holdDist: 0.58,
        holdY: 0.88,
        holdRotOffset: 0,
        leftLocal: [-0.165, 0.056, 0.125],
        rightLocal: [0.165, 0.056, 0.125],
      };
    case 'balance_trainer':
      return {
        carryMode: 'lift',
        gripStyle: 'pole',
        holdDist: 0.62,
        holdY: 0.42,
        holdRotOffset: Math.PI,
        leftLocal: [0.21, 0.58, -0.17],
        rightLocal: [-0.21, 0.58, -0.17],
      };
    case 'ball_rack':
    default:
      return {
        carryMode: 'lift',
        gripStyle: 'crate',
        holdDist: 0.66,
        holdY: 0.22,
        holdRotOffset: Math.PI,
        leftLocal: [0.18, 0.84, 0.02],
        rightLocal: [-0.18, 0.84, 0.02],
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

type ScreenPlotMode = 'wave' | 'bars' | 'gauge' | 'grid' | 'cpm' | 'thermal';

interface LiveScreenController {
  texture: THREE.CanvasTexture;
  updateDisplay: (isRunning: boolean, key: string, lines: string[], statusWord?: string) => void;
}

function createLiveDeviceScreen(
  title: string,
  accent: string,
  initialLines: string[],
  mode: ScreenPlotMode
): LiveScreenController {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  let lastDrawKey = '';

  const draw = (isRunning: boolean, lines: string[], statusWord?: string) => {
    if (!ctx) return;
    ctx.fillStyle = isRunning ? '#061322' : '#08101a';
    ctx.fillRect(0, 0, 512, 320);

    ctx.fillStyle = isRunning ? '#0e253d' : '#111a26';
    ctx.fillRect(0, 0, 512, 54);
    ctx.fillStyle = isRunning ? accent : '#475569';
    ctx.fillRect(0, 51, 512, 3);

    ctx.font = 'bold 24px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = isRunning ? '#f1f5f9' : '#94a3b8';
    ctx.fillText(title, 18, 36);

    const badgeText = statusWord ?? (isRunning ? 'ACTIVE' : 'STANDBY');
    ctx.fillStyle = isRunning ? 'rgba(16, 185, 129, 0.22)' : 'rgba(100, 116, 139, 0.22)';
    ctx.fillRect(364, 11, 132, 32);
    ctx.strokeStyle = isRunning ? '#10b981' : '#64748b';
    ctx.lineWidth = 2;
    ctx.strokeRect(364, 11, 132, 32);
    ctx.font = 'bold 17px monospace';
    ctx.fillStyle = isRunning ? '#34d399' : '#94a3b8';
    ctx.fillText(badgeText, 382, 33);

    const drawAccent = isRunning ? accent : '#475569';
    const subAccent = isRunning ? '#38bdf8' : '#334155';

    ctx.strokeStyle = 'rgba(51, 65, 85, 0.38)';
    ctx.lineWidth = 1;
    for (let x = 22; x <= 296; x += 34) {
      ctx.beginPath();
      ctx.moveTo(x, 72);
      ctx.lineTo(x, 296);
      ctx.stroke();
    }
    for (let y = 72; y <= 296; y += 32) {
      ctx.beginPath();
      ctx.moveTo(22, y);
      ctx.lineTo(296, y);
      ctx.stroke();
    }

    if (mode === 'wave') {
      ctx.strokeStyle = drawAccent;
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      for (let x = 24; x <= 292; x += 4) {
        const amp = isRunning ? 34 : 12;
        const y = 148 + Math.sin(x * 0.085) * amp + Math.cos(x * 0.19) * (amp * 0.35);
        if (x === 24) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.strokeStyle = subAccent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x = 24; x <= 292; x += 4) {
        const amp = isRunning ? 22 : 8;
        const y = 236 + Math.sin(x * 0.12 + 1.2) * amp;
        if (x === 24) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    } else if (mode === 'bars') {
      const heights = isRunning ? [84, 132, 114, 168, 98, 152, 126] : [36, 54, 48, 66, 40, 58, 46];
      for (let i = 0; i < heights.length; i++) {
        ctx.fillStyle = i % 2 === 0 ? drawAccent : subAccent;
        ctx.fillRect(30 + i * 38, 286 - heights[i], 24, heights[i]);
      }
    } else if (mode === 'gauge') {
      ctx.beginPath();
      ctx.arc(158, 190, 78, Math.PI * 0.78, Math.PI * 2.22);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 18;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(158, 190, 78, Math.PI * 0.78, isRunning ? Math.PI * 1.96 : Math.PI * 1.18);
      ctx.strokeStyle = drawAccent;
      ctx.lineWidth = 18;
      ctx.stroke();
      ctx.fillStyle = isRunning ? '#f8fafc' : '#94a3b8';
      ctx.font = 'bold 26px monospace';
      ctx.fillText(isRunning ? 'OUTPUT' : 'READY', 106, 198);
    } else if (mode === 'cpm') {
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(46, 250);
      ctx.lineTo(148, 146);
      ctx.lineTo(270, 212);
      ctx.stroke();
      ctx.strokeStyle = drawAccent;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(148, 146, 46, -0.35, 0.95);
      ctx.stroke();
      ctx.fillStyle = drawAccent;
      ctx.beginPath();
      ctx.arc(148, 146, 10, 0, Math.PI * 2);
      ctx.fill();
    } else if (mode === 'thermal') {
      const grad = ctx.createLinearGradient(36, 270, 36, 90);
      grad.addColorStop(0, '#b45309');
      grad.addColorStop(1, isRunning ? accent : '#64748b');
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(40, 96, 232, 166);
      ctx.fillStyle = grad;
      ctx.fillRect(54, 118, 204, 122);
      ctx.fillStyle = '#09111d';
      ctx.font = 'bold 34px monospace';
      ctx.fillText(lines[0] ?? '53 °C', 86, 190);
    } else {
      ctx.strokeStyle = '#1e3a5f';
      ctx.lineWidth = 2;
      for (const r of [34, 66, 98]) {
        ctx.beginPath();
        ctx.arc(158, 184, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = drawAccent;
      ctx.beginPath();
      ctx.arc(158, 184, 16, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#0b1829';
    ctx.fillRect(312, 72, 184, 224);
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 2;
    ctx.strokeRect(312, 72, 184, 224);

    lines.slice(0, 4).forEach((ln, idx) => {
      ctx.font = idx === 0 ? 'bold 26px monospace' : 'bold 22px monospace';
      ctx.fillStyle = idx === 0 && isRunning ? accent : '#e2e8f0';
      ctx.fillText(ln, 326, 118 + idx * 52);
    });

    tex.needsUpdate = true;
  };

  draw(false, initialLines, 'STANDBY');

  return {
    texture: tex,
    updateDisplay: (isRunning: boolean, key: string, lines: string[], statusWord?: string) => {
      const nextKey = `${isRunning ? 1 : 0}|${key}|${statusWord ?? ''}`;
      if (nextKey === lastDrawKey) return;
      lastDrawKey = nextKey;
      draw(isRunning, lines, statusWord);
    },
  };
}

function createIrBeamTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, 'rgba(255, 68, 36, 0.0)');
    grad.addColorStop(0.35, 'rgba(255, 76, 42, 0.14)');
    grad.addColorStop(0.78, 'rgba(255, 96, 54, 0.36)');
    grad.addColorStop(1, 'rgba(255, 130, 82, 0.56)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 16, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function markDeviceScreen(obj: THREE.Object3D) {
  obj.userData.isDeviceScreen = true;
  obj.traverse((child) => {
    child.userData.isDeviceScreen = true;
  });
}

function markDraggableProbe(obj: THREE.Object3D, probeId: string) {
  obj.userData.isDraggableProbe = true;
  obj.userData.probeId = probeId;
  obj.traverse((child) => {
    child.userData.isDraggableProbe = true;
    child.userData.probeId = probeId;
  });
}

// Zero-GC smooth flexible cable mesh (Catmull-Rom / cubic Bezier gravity-draped hose/wire)
interface DynamicCableHandle {
  mesh: THREE.Mesh;
  update: (
    p0Local: THREE.Vector3,
    p1Local: THREE.Vector3,
    sag: number,
    exitDir?: THREE.Vector3,
    minY?: number
  ) => void;
}

const _cP0 = new THREE.Vector3();
const _cP1 = new THREE.Vector3();
const _cP2 = new THREE.Vector3();
const _cP3 = new THREE.Vector3();
const _cTan = new THREE.Vector3();
const _cUp = new THREE.Vector3(0, 1, 0);
const _cAltUp = new THREE.Vector3(1, 0, 0);
const _cN1 = new THREE.Vector3();
const _cB1 = new THREE.Vector3();
const _cCur = new THREE.Vector3();
const _cRingN = new THREE.Vector3();
const _cRingV = new THREE.Vector3();

function evalCubicBezier(
  out: THREE.Vector3,
  p0: THREE.Vector3,
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  p3: THREE.Vector3,
  t: number
) {
  const u = 1 - t;
  const uu = u * u;
  const tt = t * t;
  const uuu = uu * u;
  const uut3 = 3 * uu * t;
  const utt3 = 3 * u * tt;
  const ttt = tt * t;
  out.set(
    uuu * p0.x + uut3 * p1.x + utt3 * p2.x + ttt * p3.x,
    uuu * p0.y + uut3 * p1.y + utt3 * p2.y + ttt * p3.y,
    uuu * p0.z + uut3 * p1.z + utt3 * p2.z + ttt * p3.z
  );
}

function evalCubicBezierTangent(
  out: THREE.Vector3,
  p0: THREE.Vector3,
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  p3: THREE.Vector3,
  t: number
) {
  const u = 1 - t;
  const a = 3 * u * u;
  const b = 6 * u * t;
  const c = 3 * t * t;
  out.set(
    a * (p1.x - p0.x) + b * (p2.x - p1.x) + c * (p3.x - p2.x),
    a * (p1.y - p0.y) + b * (p2.y - p1.y) + c * (p3.y - p2.y),
    a * (p1.z - p0.z) + b * (p2.z - p1.z) + c * (p3.z - p2.z)
  );
  if (out.lengthSq() < 1e-8) out.set(0, -1, 0.01);
  out.normalize();
}

function createDynamicCable(
  radius: number,
  material: THREE.Material,
  disposables: Array<{ dispose: () => void }>,
  tubularSegs = 14,
  radialSegs = 8
): DynamicCableHandle {
  const ringStride = radialSegs + 1;
  const vertCount = (tubularSegs + 1) * ringStride;
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const indices: number[] = [];
  for (let i = 0; i < tubularSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * ringStride + j;
      const b = (i + 1) * ringStride + j;
      const c = (i + 1) * ringStride + (j + 1);
      const d = i * ringStride + (j + 1);
      indices.push(a, b, d, b, c, d);
    }
  }
  const geom = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  const normAttr = new THREE.BufferAttribute(normals, 3);
  normAttr.setUsage(THREE.DynamicDrawUsage);
  geom.setAttribute('position', posAttr);
  geom.setAttribute('normal', normAttr);
  geom.setIndex(indices);
  disposables.push(geom);

  const mesh = new THREE.Mesh(geom, material);
  mesh.frustumCulled = false;

  const cosTable = new Float32Array(ringStride);
  const sinTable = new Float32Array(ringStride);
  for (let j = 0; j <= radialSegs; j++) {
    const theta = (j / radialSegs) * Math.PI * 2;
    cosTable[j] = Math.cos(theta);
    sinTable[j] = Math.sin(theta);
  }

  let lastSig = '';
  const update = (
    p0Local: THREE.Vector3,
    p1Local: THREE.Vector3,
    sag: number,
    exitDir?: THREE.Vector3,
    minY = 0.03
  ) => {
    const sig = `${p0Local.x.toFixed(3)},${p0Local.y.toFixed(3)},${p0Local.z.toFixed(3)}|${p1Local.x.toFixed(3)},${p1Local.y.toFixed(3)},${p1Local.z.toFixed(3)}|${sag.toFixed(3)}`;
    if (sig === lastSig) return;
    lastSig = sig;

    _cP0.copy(p0Local);
    _cP3.copy(p1Local);
    const dist = _cP0.distanceTo(_cP3);
    const effSag = Math.max(0.03, sag * THREE.MathUtils.clamp(dist / 0.45, 0.35, 1.45));

    if (exitDir) {
      _cP1.copy(_cP0).addScaledVector(exitDir, Math.min(0.14, 0.04 + dist * 0.22));
    } else {
      _cP1.lerpVectors(_cP0, _cP3, 0.25);
    }
    _cP1.y = Math.max(minY, _cP1.y - effSag * 0.48);

    _cP2.lerpVectors(_cP0, _cP3, 0.66);
    _cP2.y = Math.max(minY, _cP2.y - effSag);

    for (let i = 0; i <= tubularSegs; i++) {
      const t = i / tubularSegs;
      evalCubicBezier(_cCur, _cP0, _cP1, _cP2, _cP3, t);
      if (_cCur.y < minY) _cCur.y = minY;
      evalCubicBezierTangent(_cTan, _cP0, _cP1, _cP2, _cP3, t);

      const refUp = Math.abs(_cTan.y) > 0.92 ? _cAltUp : _cUp;
      _cB1.crossVectors(_cTan, refUp).normalize();
      _cN1.crossVectors(_cB1, _cTan).normalize();

      for (let j = 0; j <= radialSegs; j++) {
        const ca = cosTable[j];
        const sa = sinTable[j];
        _cRingN.set(
          ca * _cN1.x + sa * _cB1.x,
          ca * _cN1.y + sa * _cB1.y,
          ca * _cN1.z + sa * _cB1.z
        );
        _cRingV.copy(_cCur).addScaledVector(_cRingN, radius);
        const idx = (i * ringStride + j) * 3;
        positions[idx] = _cRingV.x;
        positions[idx + 1] = _cRingV.y;
        positions[idx + 2] = _cRingV.z;
        normals[idx] = _cRingN.x;
        normals[idx + 1] = _cRingN.y;
        normals[idx + 2] = _cRingN.z;
      }
    }
    posAttr.needsUpdate = true;
    normAttr.needsUpdate = true;
  };

  return { mesh, update };
}

const _aimDirScratch = new THREE.Vector3();
const _worldPosScratch = new THREE.Vector3();
const _localAimScratch = new THREE.Vector3();
const _probeLocalPosScratch = new THREE.Vector3();
const _probeLocalNormScratch = new THREE.Vector3();
const _invGroupQuatScratch = new THREE.Quaternion();
const _upAxisY = new THREE.Vector3(0, 1, 0);
const _fwdAxisZ = new THREE.Vector3(0, 0, 1);
const _tangentU = new THREE.Vector3();
const _tangentV = new THREE.Vector3();
const _portPosScratch = new THREE.Vector3();
const _endPosScratch = new THREE.Vector3();
const _exitDirScratch = new THREE.Vector3();

const _rotMatScratch = new THREE.Matrix4();

function shortestAngleDiff(current: number, target: number): number {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function findProbeTarget(
  targets: FppProbeWorldTarget[] | undefined,
  id: string
): FppProbeWorldTarget | undefined {
  if (!targets) return undefined;
  for (let i = 0; i < targets.length; i++) {
    if (targets[i].id === id) return targets[i];
  }
  return undefined;
}

const _worldDirScratch = new THREE.Vector3();

function writeGripWorld(
  obj: THREE.Object3D,
  lx: number,
  ly: number,
  lz: number,
  target: FppProbeWorldTarget,
  ax = 0,
  ay = 1,
  az = 0
) {
  obj.updateMatrixWorld(true);
  _worldPosScratch.set(lx, ly, lz).applyMatrix4(obj.matrixWorld);
  target.gripWorldX = _worldPosScratch.x;
  target.gripWorldY = _worldPosScratch.y;
  target.gripWorldZ = _worldPosScratch.z;
  _worldDirScratch.set(ax, ay, az).transformDirection(obj.matrixWorld);
  target.gripAxisX = _worldDirScratch.x;
  target.gripAxisY = _worldDirScratch.y;
  target.gripAxisZ = _worldDirScratch.z;
}

function applyPlacedProbeTransform(
  probeObj: THREE.Object3D,
  parentGroup: THREE.Group,
  target: FppProbeWorldTarget,
  surfaceOffset: number,
  alignAxis: 'Y' | 'Z',
  tangentOffsetX = 0,
  tangentOffsetZ = 0
) {
  _probeLocalPosScratch.set(target.worldX, target.worldY, target.worldZ);
  parentGroup.worldToLocal(_probeLocalPosScratch);

  parentGroup.getWorldQuaternion(_invGroupQuatScratch).invert();
  _probeLocalNormScratch.set(target.wnx, target.wny, target.wnz).applyQuaternion(_invGroupQuatScratch);
  if (_probeLocalNormScratch.lengthSq() < 1e-4) _probeLocalNormScratch.set(0, 1, 0);
  else _probeLocalNormScratch.normalize();

  _probeLocalPosScratch.addScaledVector(_probeLocalNormScratch, surfaceOffset);
  const ref = Math.abs(_probeLocalNormScratch.y) > 0.9 ? _fwdAxisZ : _upAxisY;
  _tangentU.crossVectors(ref, _probeLocalNormScratch);
  if (_tangentU.lengthSq() < 1e-5) _tangentU.set(1, 0, 0);
  else _tangentU.normalize();
  _tangentV.crossVectors(_tangentU, _probeLocalNormScratch).normalize();

  if (tangentOffsetX !== 0 || tangentOffsetZ !== 0) {
    _probeLocalPosScratch.addScaledVector(_tangentU, tangentOffsetX).addScaledVector(_tangentV, tangentOffsetZ);
  }

  probeObj.position.copy(_probeLocalPosScratch);
  if (alignAxis === 'Y') {
    _rotMatScratch.makeBasis(_tangentU, _probeLocalNormScratch, _tangentV);
    probeObj.quaternion.setFromRotationMatrix(_rotMatScratch);
  } else {
    // Orient local -Z toward surface normal so wand tip (+Z) points into skin
    _aimDirScratch.copy(_probeLocalNormScratch).negate();
    probeObj.quaternion.setFromUnitVectors(_fwdAxisZ, _aimDirScratch);
  }
}

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

  const bodyWhiteMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf4f7fb,
      roughness: 0.30,
      metalness: 0.04,
    })
  );
  const slateFrameMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x263447,
      bumpMap: textures.brushedMetalBump,
      bumpScale: 0.004,
      roughness: 0.42,
      metalness: 0.48,
    })
  );
  const chromeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xdbe4ef,
      bumpMap: textures.brushedMetalBump,
      bumpScale: 0.003,
      roughness: 0.18,
      metalness: 0.88,
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
    new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      bumpMap: textures.brushedMetalBump,
      bumpScale: 0.0035,
      roughness: 0.28,
      metalness: 0.78,
    })
  );
  const woodOakMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.wood,
      bumpMap: textures.woodBump,
      bumpScale: 0.01,
      roughness: 0.50,
      metalness: 0.02,
    })
  );
  const blueUpholsteryMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.46,
      metalness: 0.04,
    })
  );
  const cyanAccentMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.35 }));
  const amberAccentMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35 }));
  const redAccentMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35 }));
  const emeraldAccentMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.35 }));
  const braidedHoseMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x475569,
      bumpMap: textures.brushedMetalBump,
      bumpScale: 0.008,
      roughness: 0.52,
      metalness: 0.35,
    })
  );

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

  // Lightweight contoured ergonomic push-bar assembly matching clinician grip anchor coords
  const addRearPushHandle = (
    parent: THREE.Group,
    xHalf: number,
    zAttach: number,
    zHandle: number,
    yAttach: number,
    yHandle: number,
    gripX: number
  ) => {
    const dy = yHandle - yAttach;
    const dz = zHandle - zAttach;
    const armLen = Math.max(0.04, Math.hypot(dy, dz));
    const armTiltX = Math.atan2(dz, dy);
    const armGeom = trackGeom(new THREE.CylinderGeometry(0.010, 0.011, armLen, 8));
    const mountGeom = trackGeom(new THREE.CylinderGeometry(0.015, 0.016, 0.022, 8));
    mountGeom.rotateX(Math.PI / 2);

    for (const sx of [-xHalf, xHalf]) {
      const mount = new THREE.Mesh(mountGeom, slateFrameMat);
      mount.position.set(sx, yAttach, zAttach);
      const arm = new THREE.Mesh(armGeom, chromeMat);
      arm.position.set(sx, (yAttach + yHandle) * 0.5, (zAttach + zHandle) * 0.5);
      arm.rotation.x = armTiltX;
      parent.add(mount, arm);
    }

    const crossLen = xHalf * 2 + 0.024;
    const barGeom = trackGeom(new THREE.CylinderGeometry(0.011, 0.011, crossLen, 10));
    barGeom.rotateZ(Math.PI / 2);
    const crossBar = new THREE.Mesh(barGeom, chromeMat);
    crossBar.position.set(0, yHandle, zHandle);

    const gripGeom = trackGeom(new THREE.CylinderGeometry(0.0165, 0.0165, 0.105, 10));
    gripGeom.rotateZ(Math.PI / 2);
    const gripL = new THREE.Mesh(gripGeom, darkRubberMat);
    gripL.position.set(-gripX, yHandle, zHandle);
    const gripR = new THREE.Mesh(gripGeom, darkRubberMat);
    gripR.position.set(gripX, yHandle, zHandle);
    parent.add(crossBar, gripL, gripR);
  };

  let colliderHalfW = 0.24;
  let colliderHalfD = 0.24;
  let updateMotion: (input: FppEquipMotionInput) => void = () => {};

  if (sprite === 'infrared_lamp') {
    colliderHalfW = 0.25;
    colliderHalfD = 0.25;

    const hub = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.048, 0.06, 0.06, 16)), slateFrameMat);
    hub.position.y = 0.056;
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

    const lowerPole = new THREE.Mesh(
      trackGeom(new THREE.CylinderGeometry(0.018, 0.023, 0.76, 14)),
      bodyWhiteMat
    );
    lowerPole.position.y = 0.44;
    const collar = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.029, 0.029, 0.06, 14)), slateFrameMat);
    collar.position.y = 0.82;
    const collarKnob = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.014, 0.014, 0.024, 10)), darkRubberMat);
    collarKnob.rotation.z = Math.PI / 2;
    collarKnob.position.set(0.036, 0.82, 0);

    // Rear vertical push handle anchored behind main stand column (clear of telescopic mast)
    const irPushBar = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.011, 0.011, 0.24, 10)), chromeMat);
    irPushBar.position.set(0, 0.84, -0.055);
    const irStrutGeom = trackGeom(new THREE.CylinderGeometry(0.009, 0.009, 0.056, 8));
    irStrutGeom.rotateX(Math.PI / 2);
    const irStrutBot = new THREE.Mesh(irStrutGeom, slateFrameMat);
    irStrutBot.position.set(0, 0.73, -0.028);
    const irStrutTop = new THREE.Mesh(irStrutGeom, slateFrameMat);
    irStrutTop.position.set(0, 0.82, -0.028);
    const irGripGeom = trackGeom(new THREE.CylinderGeometry(0.0175, 0.0175, 0.088, 10));
    const irGripTop = new THREE.Mesh(irGripGeom, darkRubberMat);
    irGripTop.position.set(0, 0.90, -0.055);
    const irGripBot = new THREE.Mesh(irGripGeom, darkRubberMat);
    irGripBot.position.set(0, 0.81, -0.055);
    group.add(lowerPole, collar, collarKnob, irPushBar, irStrutBot, irStrutTop, irGripTop, irGripBot);

    const dimmerBox = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.105, 0.16, 0.056)), bodyWhiteMat);
    dimmerBox.position.set(0, 0.69, 0.036);
    const dimmerFascia = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.092, 0.145, 0.01)), slateFrameMat);
    dimmerFascia.position.set(0, 0.69, 0.062);

    const irScreen = createLiveDeviceScreen('IR 250W', '#ef4444', ['85%', '55 cm', '15:00', 'HEAT'], 'thermal');
    trackTex(irScreen.texture);
    const irScreenMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: irScreen.texture,
        emissiveMap: irScreen.texture,
        emissive: 0xffffff,
        emissiveIntensity: 0.25,
        roughness: 0.2,
      })
    );
    const irScreenPlane = new THREE.Mesh(trackGeom(new THREE.PlaneGeometry(0.078, 0.048)), irScreenMat);
    irScreenPlane.position.set(0, 0.728, 0.068);

    const dimmerDialMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0xff3b30, emissive: 0xdc2626, emissiveIntensity: 0 })
    );
    const dimmerKnob = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 14)), chromeMat);
    dimmerKnob.rotation.x = Math.PI / 2;
    dimmerKnob.position.set(-0.014, 0.662, 0.074);
    const knobMarker = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.004, 0.012, 0.005)), redAccentMat);
    knobMarker.position.set(0, 0.012, 0.006);
    dimmerKnob.add(knobMarker);

    const powerSwitchMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0xef4444, emissiveIntensity: 0 })
    );
    const powerSwitch = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.018, 0.026, 0.012)), powerSwitchMat);
    powerSwitch.position.set(0.024, 0.662, 0.069);

    const indicatorLed = new THREE.Mesh(trackGeom(new THREE.SphereGeometry(0.006, 8, 8)), dimmerDialMat);
    indicatorLed.position.set(0.024, 0.688, 0.069);

    markDeviceScreen(dimmerBox);
    markDeviceScreen(dimmerFascia);
    markDeviceScreen(irScreenPlane);
    group.add(dimmerBox, dimmerFascia, irScreenPlane, dimmerKnob, powerSwitch, indicatorLed);

    const upperMast = new THREE.Group();
    upperMast.position.set(0, 0.78, 0);
    const innerPole = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.013, 0.013, 0.62, 12)), chromeMat);
    innerPole.position.y = 0.28;
    const knuckle = new THREE.Mesh(trackGeom(new THREE.SphereGeometry(0.026, 12, 10)), slateFrameMat);
    knuckle.position.y = 0.57;
    const lockWing = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.068, 0.016, 0.016)), darkRubberMat);
    lockWing.position.set(0.024, 0.57, 0);
    upperMast.add(innerPole, knuckle, lockWing);
    group.add(upperMast);

    const boomPivot = new THREE.Group();
    boomPivot.position.set(0, 0.57, 0);
    upperMast.add(boomPivot);

    const boomRod = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.011, 0.011, 0.48, 10)), chromeMat);
    boomRod.rotation.x = Math.PI / 2;
    boomRod.position.z = 0.24;
    const springCap = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.017, 0.017, 0.08, 10)), slateFrameMat);
    springCap.rotation.x = Math.PI / 2;
    springCap.position.z = 0.06;
    const midJoint = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.016, 0.016, 0.042, 10)), slateFrameMat);
    midJoint.rotation.z = Math.PI / 2;
    midJoint.position.z = 0.48;
    boomPivot.add(boomRod, springCap, midJoint);

    // Coiled power cord running cleanly from dimmer box up to the lamp head
    const irCord = createDynamicCable(0.0055, darkRubberMat, disposables, 12, 8);
    group.add(irCord.mesh);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0, 0.48);
    boomPivot.add(headPivot);

    const headYoke = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.02, 0.02, 0.052, 12)), slateFrameMat);
    const shadeHousingMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.22,
        metalness: 0.52,
        side: THREE.DoubleSide,
      })
    );
    const domeGeom = trackGeom(new THREE.CylinderGeometry(0.056, 0.125, 0.16, 20, 1, true));
    domeGeom.rotateX(-Math.PI / 2);
    const dome = new THREE.Mesh(domeGeom, shadeHousingMat);
    dome.position.z = 0.036;

    const innerReflectorMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfef2f2,
        emissive: 0xff4520,
        emissiveIntensity: 0,
        metalness: 0.65,
        roughness: 0.2,
        side: THREE.BackSide,
      })
    );
    const innerReflectorGeom = trackGeom(new THREE.CylinderGeometry(0.052, 0.12, 0.152, 20, 1, true));
    innerReflectorGeom.rotateX(-Math.PI / 2);
    const innerReflector = new THREE.Mesh(innerReflectorGeom, innerReflectorMat);
    innerReflector.position.z = 0.036;

    const shadeBack = new THREE.Mesh(
      trackGeom(new THREE.SphereGeometry(0.057, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5)),
      bodyWhiteMat
    );
    shadeBack.rotation.x = -Math.PI / 2;
    shadeBack.position.z = -0.042;

    const coolingCap = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.032, 0.036, 0.026, 14)), slateFrameMat);
    coolingCap.rotation.x = Math.PI / 2;
    coolingCap.position.z = -0.095;

    const ventRing = new THREE.Mesh(trackGeom(new THREE.TorusGeometry(0.124, 0.009, 8, 24)), slateFrameMat);
    ventRing.position.z = 0.115;

    const guardBarGeom = trackGeom(new THREE.CylinderGeometry(0.0024, 0.0024, 0.23, 6));
    const gBar1 = new THREE.Mesh(guardBarGeom, chromeMat);
    gBar1.position.z = 0.118;
    const gBar2 = new THREE.Mesh(guardBarGeom, chromeMat);
    gBar2.rotation.z = Math.PI / 2;
    gBar2.position.z = 0.118;
    const gRing1 = new THREE.Mesh(trackGeom(new THREE.TorusGeometry(0.048, 0.0024, 6, 18)), chromeMat);
    gRing1.position.z = 0.118;
    const gRing2 = new THREE.Mesh(trackGeom(new THREE.TorusGeometry(0.088, 0.0024, 6, 22)), chromeMat);
    gRing2.position.z = 0.118;

    const bulbMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x5c231c,
        emissive: 0xff3b14,
        emissiveIntensity: 0,
        roughness: 0.18,
      })
    );
    const bulb = new THREE.Mesh(trackGeom(new THREE.SphereGeometry(0.046, 14, 12)), bulbMat);
    bulb.position.z = 0.048;

    const beamTex = trackTex(createIrBeamTexture());
    const beamMat = trackMat(
      new THREE.MeshBasicMaterial({
        map: beamTex,
        color: 0xff6238,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    const beamGeom = trackGeom(new THREE.CylinderGeometry(0.4, 0.082, 0.82, 20, 1, true));
    beamGeom.rotateX(Math.PI / 2);
    const beamCone = new THREE.Mesh(beamGeom, beamMat);
    beamCone.position.z = 0.48;
    beamCone.visible = false;

    const irSpot = new THREE.SpotLight(0xff5a2c, 0, 3.2, Math.PI / 3.8, 0.62, 1.2);
    irSpot.position.set(0, 0, 0.1);
    irSpot.castShadow = false;
    const irTarget = new THREE.Object3D();
    irTarget.position.set(0, 0, 1.0);
    headPivot.add(
      headYoke,
      dome,
      innerReflector,
      shadeBack,
      coolingCap,
      ventRing,
      gBar1,
      gBar2,
      gRing1,
      gRing2,
      bulb,
      beamCone,
      irSpot,
      irTarget
    );
    irSpot.target = irTarget;
    markDraggableProbe(dome, 'head');
    markDraggableProbe(shadeBack, 'head');
    markDraggableProbe(ventRing, 'head');

    updateMotion = (input) => {
      const a = THREE.MathUtils.clamp(input.activeBlend, 0, 1);
      const onBed = THREE.MathUtils.clamp(input.onBedBlend ?? a, 0, 1);
      const irPower = THREE.MathUtils.clamp(input.irIntensity ?? 0.85, 0.1, 1.0);
      const heightOff = THREE.MathUtils.clamp(input.irHeightOffset ?? 0, -0.26, 0.38);
      const distVal = THREE.MathUtils.clamp(input.irDistance ?? (input.closeRange ? 0.48 : 0.72), 0.36, 1.08);
      const closeFactor = THREE.MathUtils.clamp(1.15 - (distVal - 0.36) * 0.7, 0.45, 1.25);

      const pTarget = findProbeTarget(input.probeWorldTargets, 'head');
      const aimWX = pTarget && pTarget.placed ? pTarget.worldX : input.aimWorldX;
      const aimWY = pTarget && pTarget.placed ? pTarget.worldY : input.aimWorldY;
      const aimWZ = pTarget && pTarget.placed ? pTarget.worldZ : input.aimWorldZ;

      const running = Boolean(input.isRunning ?? a > 0.25);
      const pctStr = `${Math.round(irPower * 100)}%`;
      const distCm = `${Math.round(distVal * 100)} cm`;
      const tmStr = formatTimerMmSs(input.deviceParams, 15);
      irScreen.updateDisplay(
        running,
        `${pctStr}|${distCm}|${tmStr}`,
        [pctStr, distCm, tmStr, running ? 'EMIT' : 'IDLE'],
        running ? 'ACTIVE' : 'READY'
      );
      irScreenMat.emissiveIntensity = 0.16 + a * 0.82;
      dimmerKnob.rotation.y = THREE.MathUtils.lerp(-2.2, 2.2, irPower);

      const baseMastY = 0.72 + (input.closeRange ? 0.0 : 0.10) * onBed;
      const targetMastY = THREE.MathUtils.clamp(baseMastY + heightOff * onBed, 0.46, 1.12);
      upperMast.position.y = targetMastY;

      if (onBed > 0.08 || a > 0.05) {
        _localAimScratch.set(aimWX, aimWY, aimWZ);
        group.worldToLocal(_localAimScratch);
        const horizLen = Math.hypot(_localAimScratch.x, _localAimScratch.z);
        if (horizLen > 0.06) {
          const desiredYaw = Math.atan2(_localAimScratch.x, _localAimScratch.z);
          upperMast.rotation.y += shortestAngleDiff(upperMast.rotation.y, desiredYaw) * 0.35;
        }
      } else {
        upperMast.rotation.y += shortestAngleDiff(upperMast.rotation.y, 0) * 0.2;
      }

      const boomTilt = THREE.MathUtils.clamp(0.18 - heightOff * 0.45 - (distVal - 0.55) * 0.25, -0.32, 0.42);
      boomPivot.rotation.x = THREE.MathUtils.lerp(0.32, boomTilt, Math.max(onBed, a));
      upperMast.updateMatrixWorld(true);

      coolingCap.getWorldPosition(_worldPosScratch);
      group.worldToLocal(_worldPosScratch);
      _portPosScratch.set(0, 0.77, 0.02);
      _exitDirScratch.set(0, 1, -0.3);
      irCord.update(_portPosScratch, _worldPosScratch, 0.06, _exitDirScratch, 0.4);

      if (onBed > 0.08 || a > 0.05) {
        _localAimScratch.set(aimWX, aimWY, aimWZ);
        headPivot.lookAt(_localAimScratch);
      } else {
        headPivot.rotation.set(0.68, 0, 0);
      }

      const pulse = 1 + Math.sin(input.timeSec * 2.4) * 0.06;
      const glowScale = a * (0.28 + irPower * 1.18);
      bulbMat.color.setRGB(
        THREE.MathUtils.lerp(0.36, 1.0, Math.min(1, glowScale)),
        THREE.MathUtils.lerp(0.14, 0.68, Math.min(1, glowScale)),
        THREE.MathUtils.lerp(0.11, 0.52, Math.min(1, glowScale))
      );
      const pilotGlow = !running && onBed > 0.35 ? 0.14 : 0;
      const effBeamGlow = Math.max(glowScale, pilotGlow);
      bulbMat.emissiveIntensity = (glowScale > 0.01 ? glowScale * 3.6 * pulse : pilotGlow * 1.4);
      innerReflectorMat.emissiveIntensity = effBeamGlow * 0.95;
      dimmerDialMat.emissiveIntensity = glowScale * 1.45;
      powerSwitchMat.emissiveIntensity = a * 1.35;
      irSpot.intensity = running ? glowScale * 4.2 * closeFactor * pulse : pilotGlow * 3.8 * closeFactor;
      beamCone.visible = effBeamGlow > 0.015;
      if (beamCone.visible) {
        const lenScale = THREE.MathUtils.clamp(distVal * 1.38, 0.65, 1.38);
        const radiusScale = 0.78 + irPower * 0.34;
        beamCone.scale.set(radiusScale, radiusScale, lenScale);
        beamCone.position.z = 0.09 + 0.39 * lenScale;
        beamMat.opacity = running
          ? Math.min(0.88, glowScale * 0.62 * pulse)
          : 0.14;
      }
    };
  } else if (sprite === 'swd_unit') {
    colliderHalfW = 0.24;
    colliderHalfD = 0.24;

    const chassis = new THREE.Group();
    group.add(chassis);
    addCasters(chassis, [
      [-0.15, -0.15],
      [0.15, -0.15],
      [-0.15, 0.15],
      [0.15, 0.15],
    ]);

    const tower = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.36, 0.74, 0.36)), bodyWhiteMat);
    tower.position.y = 0.42;
    const frontGrill = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.28, 0.24, 0.02)), aluminumMat);
    frontGrill.position.set(0, 0.36, 0.182);
    const accentTrim = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.368, 0.04, 0.368)), cyanAccentMat);
    accentTrim.position.y = 0.78;

    const fascia = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.32, 0.19, 0.14)), slateFrameMat);
    fascia.position.set(0, 0.76, 0.12);
    fascia.rotation.x = -0.35;

    const swdScreen = createLiveDeviceScreen('SWD 27.12 MHz', '#f59e0b', ['120 W', 'CONT', '15:00', 'TUNED'], 'gauge');
    trackTex(swdScreen.texture);
    const screenMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: swdScreen.texture,
        emissiveMap: swdScreen.texture,
        emissive: 0xffffff,
        emissiveIntensity: 0.2,
        roughness: 0.2,
      })
    );
    const screen = new THREE.Mesh(trackGeom(new THREE.PlaneGeometry(0.26, 0.135)), screenMat);
    screen.position.set(0, 0.785, 0.186);
    screen.rotation.x = -0.35;

    const dialL = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.02, 0.022, 0.022, 12)), cyanAccentMat);
    dialL.rotation.x = Math.PI / 2 - 0.35;
    dialL.position.set(-0.095, 0.675, 0.20);
    const dialR = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.02, 0.022, 0.022, 12)), cyanAccentMat);
    dialR.rotation.x = Math.PI / 2 - 0.35;
    dialR.position.set(0.095, 0.675, 0.20);

    markDeviceScreen(fascia);
    markDeviceScreen(screen);
    markDeviceScreen(dialL);
    markDeviceScreen(dialR);

    chassis.add(tower, frontGrill, accentTrim, fascia, screen, dialL, dialR);

    for (let li = 0; li < 4; li++) {
      const lv = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.372, 0.012, 0.2)), slateFrameMat);
      lv.position.set(0, 0.18 + li * 0.042, 0);
      chassis.add(lv);
    }
    addRearPushHandle(chassis, 0.145, -0.17, -0.255, 0.74, 0.82, 0.11);

    const armTurret = new THREE.Group();
    armTurret.position.set(0, 0.80, -0.05);
    chassis.add(armTurret);

    const turretRing = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.048, 0.052, 0.03, 14)), slateFrameMat);
    armTurret.add(turretRing);

    const armShoulder = new THREE.Group();
    armShoulder.position.set(0, 0.02, 0);
    armTurret.add(armShoulder);

    const armLower = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.036, 0.42, 0.042)), chromeMat);
    armLower.position.y = 0.21;
    armShoulder.add(armLower);

    const elbow = new THREE.Group();
    elbow.position.y = 0.42;
    armShoulder.add(elbow);

    const jointKnob = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.028, 0.028, 0.054, 12)), slateFrameMat);
    jointKnob.rotation.z = Math.PI / 2;
    const armUpper = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.032, 0.032, 0.46)), chromeMat);
    armUpper.position.z = 0.23;
    elbow.add(jointKnob, armUpper);

    const drumPivot = new THREE.Group();
    drumPivot.position.set(0, -0.03, 0.46);
    elbow.add(drumPivot);

    const drumBody = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.135, 0.135, 0.058, 22)), bodyWhiteMat);
    const drumPadMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x0ea5e9,
        emissive: 0x0284c7,
        emissiveIntensity: 0,
        roughness: 0.48,
      })
    );
    const drumPad = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.12, 0.12, 0.018, 22)), drumPadMat);
    drumPad.position.y = -0.034;
    const drumPortL = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 10)), slateFrameMat);
    drumPortL.position.set(-0.045, 0.04, -0.05);
    const drumPortR = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 10)), slateFrameMat);
    drumPortR.position.set(0.045, 0.04, -0.05);
    drumPivot.add(drumBody, drumPad, drumPortL, drumPortR);
    markDraggableProbe(drumPivot, 'head');

    // Twin heavy braided RF coaxial cables draping from rear chassis jacks up into the diplode drum
    const rfCableL = createDynamicCable(0.008, darkRubberMat, disposables, 14, 8);
    const rfCableR = createDynamicCable(0.008, darkRubberMat, disposables, 14, 8);
    group.add(rfCableL.mesh, rfCableR.mesh);

    updateMotion = (input) => {
      const a = THREE.MathUtils.clamp(input.activeBlend, 0, 1);
      const onBed = THREE.MathUtils.clamp(input.onBedBlend ?? a, 0, 1);
      const running = Boolean(input.isRunning ?? a > 0.25);
      const p = input.deviceParams;
      const wStr = `${p?.intensity ?? 120} W`;
      const mStr = p?.mode ?? 'CONT';
      const tStr = formatTimerMmSs(p, 15);
      swdScreen.updateDisplay(running, `${wStr}|${mStr}|${tStr}`, [wStr, mStr, tStr, 'TUNED']);

      const pTarget = findProbeTarget(input.probeWorldTargets, 'head');
      const hasPlacedAim = Boolean(pTarget && pTarget.placed);
      const aimWX = hasPlacedAim ? pTarget!.worldX : input.aimWorldX;
      const aimWY = hasPlacedAim ? pTarget!.worldY : input.aimWorldY;
      const aimWZ = hasPlacedAim ? pTarget!.worldZ : input.aimWorldZ;

      if (hasPlacedAim || onBed > 0.08 || a > 0.05) {
        _localAimScratch.set(aimWX, aimWY, aimWZ);
        group.worldToLocal(_localAimScratch);
        const hDist = Math.hypot(_localAimScratch.x, _localAimScratch.z);
        if (hDist > 0.05) {
          const aimYaw = Math.atan2(_localAimScratch.x, _localAimScratch.z);
          armTurret.rotation.y += shortestAngleDiff(armTurret.rotation.y, aimYaw) * 0.38;
        }
        const extendRatio = THREE.MathUtils.clamp((hDist - 0.32) / 0.62, 0, 1);
        const shoulderTarget = hasPlacedAim
          ? THREE.MathUtils.lerp(0.15, 0.56, extendRatio)
          : THREE.MathUtils.lerp(-0.18, input.closeRange ? 0.44 : 0.22, Math.max(onBed * 0.45, a));
        const elbowTarget = hasPlacedAim
          ? THREE.MathUtils.lerp(0.45, 0.14, extendRatio)
          : THREE.MathUtils.lerp(0.55, input.closeRange ? 0.32 : 0.18, Math.max(onBed * 0.45, a));
        armShoulder.rotation.x += (shoulderTarget - armShoulder.rotation.x) * 0.3;
        elbow.rotation.x += (elbowTarget - elbow.rotation.x) * 0.3;
      } else {
        armTurret.rotation.y += shortestAngleDiff(armTurret.rotation.y, 0) * 0.2;
        armShoulder.rotation.x += (-0.18 - armShoulder.rotation.x) * 0.2;
        elbow.rotation.x += (0.55 - elbow.rotation.x) * 0.2;
      }

      drumPivot.rotation.x = THREE.MathUtils.lerp(-0.2, -0.52, hasPlacedAim ? 0.85 : a);
      screenMat.emissiveIntensity = 0.14 + a * 0.88;
      drumPadMat.emissiveIntensity = a * (0.9 + Math.sin(input.timeSec * 3) * 0.2);

      armTurret.updateMatrixWorld(true);
      drumPortL.getWorldPosition(_endPosScratch);
      group.worldToLocal(_endPosScratch);
      _portPosScratch.set(-0.075, 0.74, -0.17);
      _exitDirScratch.set(0, 0.4, -1);
      rfCableL.update(_portPosScratch, _endPosScratch, 0.16, _exitDirScratch, 0.25);

      drumPortR.getWorldPosition(_endPosScratch);
      group.worldToLocal(_endPosScratch);
      _portPosScratch.set(0.075, 0.74, -0.17);
      rfCableR.update(_portPosScratch, _endPosScratch, 0.16, _exitDirScratch, 0.25);
    };
  } else if (sprite === 'tens_unit') {
    colliderHalfW = 0.23;
    colliderHalfD = 0.22;

    addCasters(group, [
      [-0.15, -0.14],
      [0.15, -0.14],
      [-0.15, 0.14],
      [0.15, 0.14],
    ]);
    const basePlate = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.36, 0.036, 0.34)), aluminumMat);
    basePlate.position.y = 0.068;

    for (const sx of [-0.145, 0.145]) {
      const rail = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.014, 0.014, 0.64, 12)), chromeMat);
      rail.position.set(sx, 0.4, -0.07);
      group.add(rail);
    }
    const basketFrame = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.28, 0.03, 0.22)), aluminumMat);
    basketFrame.position.set(0, 0.35, 0.02);
    const padPack = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.24, 0.048, 0.17)), blueUpholsteryMat);
    padPack.position.set(0, 0.39, 0.02);
    addRearPushHandle(group, 0.145, -0.13, -0.21, 0.71, 0.78, 0.11);

    const deck = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.36, 0.042, 0.32)), bodyWhiteMat);
    deck.position.set(0, 0.71, 0);
    const body = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.32, 0.135, 0.24)), bodyWhiteMat);
    body.position.set(0, 0.795, -0.01);
    body.rotation.x = 0.24;

    const scrBezel = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.26, 0.11, 0.02)), slateFrameMat);
    scrBezel.position.set(0, 0.845, 0.068);
    scrBezel.rotation.x = -0.52;

    const tensScreen = createLiveDeviceScreen('TENS / IFC', '#38bdf8', ['16 mA', '80 Hz', '120 us', '20:00'], 'wave');
    trackTex(tensScreen.texture);
    const screenMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: tensScreen.texture,
        emissiveMap: tensScreen.texture,
        emissive: 0xffffff,
        emissiveIntensity: 0.2,
        roughness: 0.18,
      })
    );
    const screenFace = new THREE.Mesh(trackGeom(new THREE.PlaneGeometry(0.235, 0.092)), screenMat);
    screenFace.position.set(0, 0.85, 0.08);
    screenFace.rotation.x = -0.52;

    const jackPorts: THREE.Vector3[] = [];
    for (let ki = 0; ki < 4; ki++) {
      const kx = -0.09 + ki * 0.06;
      const knob = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.016, 0.018, 0.022, 12)), cyanAccentMat);
      knob.position.set(kx, 0.775, 0.105);
      markDeviceScreen(knob);
      group.add(knob);
      const jack = new THREE.Mesh(
        trackGeom(new THREE.CylinderGeometry(0.008, 0.008, 0.018, 10)),
        ki % 2 === 0 ? redAccentMat : darkRubberMat
      );
      jack.rotation.x = Math.PI / 2;
      jack.position.set(kx, 0.735, 0.145);
      group.add(jack);
      jackPorts.push(new THREE.Vector3(kx, 0.735, 0.155));
    }

    // Side pad holster plates
    const holsterL = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.02, 0.18, 0.14)), aluminumMat);
    holsterL.position.set(-0.182, 0.64, 0.0);
    const holsterR = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.02, 0.18, 0.14)), aluminumMat);
    holsterR.position.set(0.182, 0.64, 0.0);

    markDeviceScreen(body);
    markDeviceScreen(scrBezel);
    markDeviceScreen(screenFace);
    group.add(basePlate, basketFrame, padPack, deck, body, scrBezel, screenFace, holsterL, holsterR);

    // 4 Contoured Skin-Adhering Hydrogel Electrode Pads + Flexible Red/Black Lead Wires + Live Skin Pulse Rings
    const padSpecs: Array<{
      id: string;
      wireMat: THREE.Material;
      padColor: number;
      dockPos: [number, number, number];
      dockRot: [number, number, number];
      portIdx: number;
    }> = [
      { id: 'ch1_a', wireMat: redAccentMat, padColor: 0xf8fafc, dockPos: [-0.20, 0.68, 0.04], dockRot: [0, 0, Math.PI / 2], portIdx: 0 },
      { id: 'ch1_b', wireMat: darkRubberMat, padColor: 0xe0f2fe, dockPos: [-0.20, 0.60, -0.03], dockRot: [0, 0, Math.PI / 2], portIdx: 1 },
      { id: 'ch2_a', wireMat: redAccentMat, padColor: 0xf8fafc, dockPos: [0.20, 0.68, 0.04], dockRot: [0, 0, -Math.PI / 2], portIdx: 2 },
      { id: 'ch2_b', wireMat: darkRubberMat, padColor: 0xe0f2fe, dockPos: [0.20, 0.60, -0.03], dockRot: [0, 0, -Math.PI / 2], portIdx: 3 },
    ];

    // Slim, contoured circular hydrogel pad with beveled backing so edges hug curved limbs without gaps
    const padFoamGeom = trackGeom(new THREE.CylinderGeometry(0.021, 0.025, 0.0052, 20));
    const gelSkirtGeom = trackGeom(new THREE.CylinderGeometry(0.025, 0.0285, 0.0032, 20));
    const contactShadowGeom = trackGeom(new THREE.RingGeometry(0.020, 0.030, 22));
    contactShadowGeom.rotateX(-Math.PI / 2);
    const studGeom = trackGeom(new THREE.CylinderGeometry(0.0065, 0.007, 0.007, 10));
    const haloGeom = trackGeom(new THREE.RingGeometry(0.031, 0.040, 22));
    haloGeom.rotateX(-Math.PI / 2);
    const pulseWaveGeom = trackGeom(new THREE.RingGeometry(0.022, 0.032, 24));
    pulseWaveGeom.rotateX(-Math.PI / 2);

    const contactShadowMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x0f172a,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      })
    );

    const padEntries = padSpecs.map((ps) => {
      const pGroup = new THREE.Group();
      pGroup.position.set(...ps.dockPos);
      pGroup.rotation.set(...ps.dockRot);
      const padMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: ps.padColor,
          emissive: 0x0ea5e9,
          emissiveIntensity: 0,
          roughness: 0.42,
        })
      );
      const gelMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0284c7,
          emissiveIntensity: 0.08,
          roughness: 0.2,
          transparent: true,
          opacity: 0.88,
        })
      );
      const contactRing = new THREE.Mesh(contactShadowGeom, contactShadowMat);
      contactRing.position.y = 0.0004;
      contactRing.visible = false;

      const gel = new THREE.Mesh(gelSkirtGeom, gelMat);
      gel.position.y = 0.0014;
      const foam = new THREE.Mesh(padFoamGeom, padMat);
      foam.position.y = 0.0052;
      const stud = new THREE.Mesh(studGeom, chromeMat);
      stud.position.y = 0.0102;

      const selMat = trackMat(
        new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
      );
      const selRing = new THREE.Mesh(haloGeom, selMat);
      selRing.position.y = 0.009;
      selRing.visible = false;

      const pulseMat1 = trackMat(
        new THREE.MeshBasicMaterial({
          color: ps.portIdx % 2 === 0 ? 0x38bdf8 : 0x22d3ee,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
        })
      );
      const pulseRing1 = new THREE.Mesh(pulseWaveGeom, pulseMat1);
      pulseRing1.position.y = 0.0022;
      pulseRing1.visible = false;

      const pulseMat2 = trackMat(
        new THREE.MeshBasicMaterial({
          color: 0x7dd3fc,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
        })
      );
      const pulseRing2 = new THREE.Mesh(pulseWaveGeom, pulseMat2);
      pulseRing2.position.y = 0.0024;
      pulseRing2.visible = false;

      pGroup.add(contactRing, gel, foam, stud, selRing, pulseRing1, pulseRing2);
      markDraggableProbe(pGroup, ps.id);
      group.add(pGroup);

      const cable = createDynamicCable(0.0040, ps.wireMat, disposables, 14, 7);
      group.add(cable.mesh);

      return { ...ps, pGroup, padMat, gelMat, contactRing, selRing, pulseRing1, pulseMat1, pulseRing2, pulseMat2, cable };
    });

    updateMotion = (input) => {
      const a = THREE.MathUtils.clamp(input.activeBlend, 0, 1);
      const onBed = THREE.MathUtils.clamp(input.onBedBlend ?? a, 0, 1);
      const running = Boolean(input.isRunning ?? a > 0.25);
      const p = input.deviceParams;
      const maVal = Number(p?.intensity ?? 16);
      const hzVal = Number(p?.freqHz ?? 80);
      const usVal = Number(p?.pulseUs ?? 120);
      const modeVal = p?.mode ?? 'CONV';
      const maStr = `${maVal} mA`;
      const hzStr = `${hzVal} Hz`;
      const mStr = modeVal;
      const tStr = formatTimerMmSs(p, 20);
      tensScreen.updateDisplay(running, `${maStr}|${hzStr}|${mStr}|${tStr}`, [maStr, hzStr, mStr, tStr]);
      screenMat.emissiveIntensity = 0.14 + a * 0.9;

      const maNorm = THREE.MathUtils.clamp((maVal - 2) / 58, 0.06, 1);
      const usNorm = THREE.MathUtils.clamp((usVal - 50) / 250, 0, 1);
      // Visual pulse cadence: clear beat-by-beat below 16 Hz, crisp rhythmic surge wave above
      const visRate =
        modeVal === 'BURST'
          ? 2.2
          : modeVal === 'IFC'
            ? 3.8
            : THREE.MathUtils.clamp(hzVal <= 15 ? hzVal * 0.72 : 3.2 + (hzVal - 15) * 0.055, 1.4, 11.5);

      for (const pe of padEntries) {
        const target = findProbeTarget(input.probeWorldTargets, pe.id);
        pe.selRing.visible = Boolean(target?.selected);
        pe.contactRing.visible = Boolean(target?.placed);

        const isActiveSkinPad = Boolean(target?.placed && running && onBed > 0.05);
        if (isActiveSkinPad) {
          const chPhaseOff = pe.portIdx * (modeVal === 'IFC' ? 0.25 : 0.06);
          const rawPhase1 = (input.timeSec * visRate + chPhaseOff) % 1;
          const rawPhase2 = (input.timeSec * visRate + chPhaseOff + 0.48) % 1;
          let gate = 1;
          if (modeVal === 'BURST') {
            const burstWin = (input.timeSec * 2.0) % 1;
            gate = burstWin < 0.48 ? 1 : 0.08;
          } else if (modeVal === 'IFC') {
            gate = 0.45 + 0.55 * Math.sin(input.timeSec * 7.5 + (pe.portIdx >= 2 ? Math.PI : 0));
          }
          const env1 = Math.sin(rawPhase1 * Math.PI);
          const env2 = Math.sin(rawPhase2 * Math.PI);
          const ampScale = (0.32 + maNorm * 0.92 + usNorm * 0.18) * gate;

          pe.pulseRing1.visible = true;
          const s1 = 0.98 + rawPhase1 * (0.28 + maNorm * 0.86 + usNorm * 0.16);
          pe.pulseRing1.scale.set(s1, 1, s1);
          pe.pulseMat1.opacity = THREE.MathUtils.clamp((0.24 + maNorm * 0.72) * (1 - rawPhase1) * gate, 0, 0.95);

          pe.pulseRing2.visible = maNorm > 0.22;
          const s2 = 0.96 + rawPhase2 * (0.22 + maNorm * 0.72);
          pe.pulseRing2.scale.set(s2, 1, s2);
          pe.pulseMat2.opacity = THREE.MathUtils.clamp((0.16 + maNorm * 0.58) * (1 - rawPhase2) * gate, 0, 0.85);

          const pulseLift = env1 * (0.0008 + maNorm * 0.0014);
          pe.padMat.emissiveIntensity = (0.18 + maNorm * 0.85) * (0.45 + 0.55 * env1) * gate;
          pe.gelMat.emissiveIntensity = (0.35 + maNorm * 1.45) * (0.4 + 0.6 * Math.max(env1, env2)) * ampScale;
          pe.pGroup.scale.set(1 + maNorm * 0.03 * env1, 1 + maNorm * 0.05 * env1, 1 + maNorm * 0.03 * env1);
          applyPlacedProbeTransform(pe.pGroup, group, target!, -0.0062 + pulseLift, 'Y');
          writeGripWorld(pe.pGroup, 0, 0.011, 0, target!);
        } else {
          pe.pulseRing1.visible = false;
          pe.pulseRing2.visible = false;
          pe.pGroup.scale.set(1, 1, 1);
          pe.padMat.emissiveIntensity = target?.selected ? 0.35 : 0;
          pe.gelMat.emissiveIntensity = target?.selected ? 0.4 : 0.06;

          if (target && (target.placed || target.holding) && onBed > 0.05) {
            const lift = target.placed ? 0 : (1 - (target.attachBlend ?? 0)) * 0.052;
            applyPlacedProbeTransform(pe.pGroup, group, target, -0.0062 + lift, 'Y');
            writeGripWorld(pe.pGroup, 0, 0.011, 0, target);
          } else {
            pe.pGroup.position.set(...pe.dockPos);
            pe.pGroup.rotation.set(...pe.dockRot);
          }
        }

        pe.pGroup.updateMatrix();
        _endPosScratch.set(0, 0.011, 0).applyMatrix4(pe.pGroup.matrix);
        _exitDirScratch.set(0, -0.35, 1).normalize();
        pe.cable.update(jackPorts[pe.portIdx], _endPosScratch, target?.placed ? 0.20 : 0.12, _exitDirScratch, 0.04);
      }
    };
  } else if (sprite === 'ultrasound_unit') {
    colliderHalfW = 0.24;
    colliderHalfD = 0.23;

    addCasters(group, [
      [-0.16, -0.15],
      [0.16, -0.15],
      [-0.16, 0.15],
      [0.16, 0.15],
    ]);
    const base = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.38, 0.042, 0.36)), slateFrameMat);
    base.position.y = 0.072;
    const cabinet = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.32, 0.56, 0.30)), bodyWhiteMat);
    cabinet.position.set(0, 0.37, -0.01);

    const drawer1 = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.27, 0.15, 0.02)), cyanAccentMat);
    drawer1.position.set(0, 0.26, 0.145);
    const drawer2 = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.27, 0.12, 0.02)), aluminumMat);
    drawer2.position.set(0, 0.43, 0.145);
    const hGeom = trackGeom(new THREE.BoxGeometry(0.11, 0.016, 0.022));
    const h1 = new THREE.Mesh(hGeom, chromeMat);
    h1.position.set(0, 0.28, 0.16);
    const h2 = new THREE.Mesh(hGeom, chromeMat);
    h2.position.set(0, 0.45, 0.16);
    const topDeck = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.36, 0.042, 0.33)), aluminumMat);
    topDeck.position.set(0, 0.67, 0);

    const head = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.33, 0.21, 0.13)), slateFrameMat);
    head.position.set(0, 0.79, -0.02);
    head.rotation.x = -0.34;

    const usScreen = createLiveDeviceScreen('ULTRASOUND', '#0ea5e9', ['1.0 MHz', '1.2 W', '50% D', '08:00'], 'bars');
    trackTex(usScreen.texture);
    const screenMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: usScreen.texture,
        emissiveMap: usScreen.texture,
        emissive: 0xffffff,
        emissiveIntensity: 0.2,
        roughness: 0.18,
      })
    );
    const screenFace = new THREE.Mesh(trackGeom(new THREE.PlaneGeometry(0.265, 0.14)), screenMat);
    screenFace.position.set(0, 0.805, 0.044);
    screenFace.rotation.x = -0.34;

    const intDial = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.02, 0.022, 0.024, 14)), chromeMat);
    intDial.position.set(0.105, 0.70, 0.115);
    const startBtn = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.015, 0.015, 0.02, 12)), emeraldAccentMat);
    startBtn.position.set(-0.095, 0.70, 0.115);

    const gelHolster = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.075, 0.065, 0.085)), aluminumMat);
    gelHolster.position.set(0.195, 0.65, 0.03);
    const gelBottle = new THREE.Mesh(
      trackGeom(new THREE.CylinderGeometry(0.032, 0.032, 0.14, 12)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.24, transparent: true, opacity: 0.86 }))
    );
    gelBottle.position.set(0.195, 0.74, 0.03);
    const gelCap = new THREE.Mesh(trackGeom(new THREE.ConeGeometry(0.02, 0.045, 10)), bodyWhiteMat);
    gelCap.position.set(0.195, 0.83, 0.03);

    const wandPort = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 10)), chromeMat);
    wandPort.rotation.z = Math.PI / 2;
    wandPort.position.set(-0.17, 0.70, 0.06);

    markDeviceScreen(head);
    markDeviceScreen(screenFace);
    markDeviceScreen(intDial);
    markDeviceScreen(startBtn);

    group.add(
      base,
      cabinet,
      drawer1,
      drawer2,
      h1,
      h2,
      topDeck,
      head,
      screenFace,
      intDial,
      startBtn,
      gelHolster,
      gelBottle,
      gelCap,
      wandPort
    );
    addRearPushHandle(group, 0.15, -0.14, -0.21, 0.67, 0.78, 0.11);

    // Ergonomic 5cm2 Ultrasound Transducer Wand + flexible coiled black cable
    const wandGroup = new THREE.Group();
    wandGroup.position.set(-0.19, 0.69, 0.02);
    wandGroup.rotation.set(Math.PI / 2, 0, 0);
    const wandHandle = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.014, 0.018, 0.15, 12)), bodyWhiteMat);
    wandHandle.rotation.x = Math.PI / 2;
    wandHandle.position.z = -0.085;
    const tipMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 0, roughness: 0.2 })
    );
    const headDisc = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.03, 0.034, 0.026, 16)), tipMat);
    headDisc.rotation.x = Math.PI / 2;
    headDisc.position.z = -0.005;
    const gelMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x7dd3fc,
        transparent: true,
        opacity: 0.44,
        roughness: 0.14,
        depthWrite: false,
      })
    );
    const gelDisc = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.037, 0.039, 0.005, 16)), gelMat);
    gelDisc.rotation.x = Math.PI / 2;
    gelDisc.position.z = 0.008;
    gelDisc.visible = false;
    wandGroup.add(wandHandle, headDisc, gelDisc);
    markDraggableProbe(wandGroup, 'head');
    group.add(wandGroup);

    const usCable = createDynamicCable(0.006, darkRubberMat, disposables, 14, 8);
    group.add(usCable.mesh);

    updateMotion = (input) => {
      const a = THREE.MathUtils.clamp(input.activeBlend, 0, 1);
      const onBed = THREE.MathUtils.clamp(input.onBedBlend ?? a, 0, 1);
      const running = Boolean(input.isRunning ?? a > 0.25);
      const p = input.deviceParams;
      const fStr = `${(p?.freqHz ?? 1).toFixed(1)} MHz`;
      const wStr = `${Number(p?.intensity ?? 1.2).toFixed(1)} W/cm2`;
      const dStr = `${p?.dutyPct ?? 50}% DUTY`;
      const tStr = formatTimerMmSs(p, 8);
      usScreen.updateDisplay(running, `${fStr}|${wStr}|${dStr}|${tStr}`, [fStr, wStr, dStr, tStr]);
      screenMat.emissiveIntensity = 0.14 + a * 0.9;
      tipMat.emissiveIntensity = a * (1.4 + Math.sin(input.timeSec * 4) * 0.3);

      const target = findProbeTarget(input.probeWorldTargets, 'head');
      if (target && (target.placed || target.holding) && onBed > 0.05) {
        const lift = target.placed ? 0 : (1 - (target.attachBlend ?? 0)) * 0.048;
        const sweepX = target.placed && running ? Math.cos(input.timeSec * 2.5) * 0.028 + Math.sin(input.timeSec * 1.15) * 0.010 : 0;
        const sweepZ = target.placed && running ? Math.sin(input.timeSec * 2.5) * 0.028 : 0;
        applyPlacedProbeTransform(wandGroup, group, target, 0.006 + lift, 'Z', sweepX, sweepZ);
        gelDisc.visible = Boolean(target.placed);
        writeGripWorld(wandGroup, 0, 0, -0.085, target, 0, 0, -1);
      } else {
        wandGroup.position.set(-0.19, 0.72, 0.02);
        wandGroup.rotation.set(Math.PI / 2, 0, 0);
        gelDisc.visible = false;
      }
      wandGroup.updateMatrix();
      _portPosScratch.set(-0.18, 0.70, 0.06);
      _endPosScratch.set(0, 0, -0.15).applyMatrix4(wandGroup.matrix);
      _exitDirScratch.set(-1, -0.2, 0.2).normalize();
      usCable.update(_portPosScratch, _endPosScratch, target?.placed ? 0.18 : 0.09, _exitDirScratch, 0.04);
    };
  } else if (sprite === 'laser_hilt') {
    colliderHalfW = 0.24;
    colliderHalfD = 0.24;

    addCasters(group, [
      [-0.16, -0.16],
      [0.16, -0.16],
      [-0.16, 0.16],
      [0.16, 0.16],
    ]);
    const base = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.39, 0.045, 0.39)), slateFrameMat);
    base.position.y = 0.072;
    const tower = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.33, 0.58, 0.30)), bodyWhiteMat);
    tower.position.set(0, 0.38, 0);
    const collar = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.35, 0.044, 0.32)), amberAccentMat);
    collar.position.set(0, 0.65, 0);
    const cyanStripe = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.065, 0.5, 0.315)), cyanAccentMat);
    cyanStripe.position.set(0, 0.37, 0.005);

    const panel = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.34, 0.24, 0.10)), slateFrameMat);
    panel.position.set(0, 0.79, 0.01);
    panel.rotation.x = -0.45;

    const laserScreen = createLiveDeviceScreen('HILT 1064nm', '#f43f5e', ['10.0 W', '850 J', 'CONT', '06:00'], 'gauge');
    trackTex(laserScreen.texture);
    const screenMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: laserScreen.texture,
        emissiveMap: laserScreen.texture,
        emissive: 0xffffff,
        emissiveIntensity: 0.2,
        roughness: 0.18,
      })
    );
    const screenFace = new THREE.Mesh(trackGeom(new THREE.PlaneGeometry(0.285, 0.175)), screenMat);
    screenFace.position.set(0, 0.81, 0.056);
    screenFace.rotation.x = -0.45;

    const eStop = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.024, 0.022, 0.024, 14)), redAccentMat);
    eStop.position.set(0.11, 0.685, 0.115);
    const keyLock = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 10)), chromeMat);
    keyLock.position.set(0.045, 0.685, 0.12);
    const goggles = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.11, 0.034, 0.048)), emeraldAccentMat);
    goggles.position.set(-0.11, 0.685, 0.11);

    markDeviceScreen(panel);
    markDeviceScreen(screenFace);
    group.add(base, tower, collar, cyanStripe, panel, screenFace, eStop, keyLock, goggles);
    addRearPushHandle(group, 0.15, -0.14, -0.21, 0.65, 0.78, 0.11);

    // Fiber optical wand + crimson laser aiming dot + curved armored fiber conduit
    const wandGroup = new THREE.Group();
    wandGroup.position.set(-0.18, 0.72, 0.0);
    wandGroup.rotation.set(Math.PI / 2, 0, 0);
    const laserWand = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.016, 0.013, 0.18, 12)), chromeMat);
    laserWand.rotation.x = Math.PI / 2;
    laserWand.position.z = -0.10;
    const tipMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0xe11d48, emissiveIntensity: 0, roughness: 0.2 })
    );
    const tipLens = new THREE.Mesh(trackGeom(new THREE.SphereGeometry(0.016, 10, 8)), tipMat);
    tipLens.position.z = -0.01;
    const beamMat = trackMat(
      new THREE.MeshBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending })
    );
    const beamRay = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.004, 0.012, 0.08, 8)), beamMat);
    beamRay.rotation.x = Math.PI / 2;
    beamRay.position.z = 0.04;
    beamRay.visible = false;
    wandGroup.add(laserWand, tipLens, beamRay);
    markDraggableProbe(wandGroup, 'head');
    group.add(wandGroup);

    const fiberCable = createDynamicCable(0.0075, darkRubberMat, disposables, 14, 8);
    group.add(fiberCable.mesh);

    updateMotion = (input) => {
      const a = THREE.MathUtils.clamp(input.activeBlend, 0, 1);
      const onBed = THREE.MathUtils.clamp(input.onBedBlend ?? a, 0, 1);
      const running = Boolean(input.isRunning ?? a > 0.25);
      const p = input.deviceParams;
      const wStr = `${p?.intensity ?? 10} W`;
      const jStr = `${Math.round(p?.shocks ?? 850)} J`;
      const mStr = p?.mode ?? 'ANALG';
      const tStr = formatTimerMmSs(p, 6);
      laserScreen.updateDisplay(running, `${wStr}|${jStr}|${mStr}|${tStr}`, [wStr, jStr, mStr, tStr]);
      screenMat.emissiveIntensity = 0.14 + a * 0.92;
      tipMat.emissiveIntensity = a * (2.1 + Math.sin(input.timeSec * 6) * 0.45);

      const target = findProbeTarget(input.probeWorldTargets, 'head');
      if (target && (target.placed || target.holding) && onBed > 0.05) {
        const lift = target.placed ? 0 : (1 - (target.attachBlend ?? 0)) * 0.046;
        const scanX = target.placed && running ? Math.sin(input.timeSec * 1.9) * 0.013 : 0;
        const scanZ = target.placed && running ? Math.cos(input.timeSec * 1.3) * 0.010 : 0;
        applyPlacedProbeTransform(wandGroup, group, target, 0.075 + lift, 'Z', scanX, scanZ);
        beamRay.visible = Boolean(target.placed && a > 0.05);
        writeGripWorld(wandGroup, 0, 0, -0.100, target, 0, 0, -1);
      } else {
        wandGroup.position.set(-0.18, 0.72, 0.0);
        wandGroup.rotation.set(Math.PI / 2, 0, 0);
        beamRay.visible = false;
      }
      wandGroup.updateMatrix();
      _portPosScratch.set(-0.15, 0.72, -0.04);
      _endPosScratch.set(0, 0, -0.18).applyMatrix4(wandGroup.matrix);
      _exitDirScratch.set(-1, 0.2, 0).normalize();
      fiberCable.update(_portPosScratch, _endPosScratch, target?.placed ? 0.22 : 0.10, _exitDirScratch, 0.04);
    };
  } else if (sprite === 'shockwave_eswt') {
    colliderHalfW = 0.24;
    colliderHalfD = 0.23;

    addCasters(group, [
      [-0.16, -0.15],
      [0.16, -0.15],
      [-0.16, 0.15],
      [0.16, 0.15],
    ]);
    const base = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.39, 0.044, 0.37)), aluminumMat);
    base.position.y = 0.072;
    const tower = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.33, 0.56, 0.31)), bodyWhiteMat);
    tower.position.set(0, 0.37, 0);

    for (let vy = 0.16; vy <= 0.32; vy += 0.05) {
      const lv = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.25, 0.016, 0.025)), slateFrameMat);
      lv.position.set(0, vy, 0.158);
      group.add(lv);
    }

    const pGauge = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 16)), chromeMat);
    pGauge.rotation.x = Math.PI / 2;
    pGauge.position.set(-0.10, 0.47, 0.16);

    const scrFrame = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.32, 0.20, 0.09)), slateFrameMat);
    scrFrame.position.set(0, 0.77, 0.02);
    scrFrame.rotation.x = -0.4;

    const eswtScreen = createLiveDeviceScreen('ESWT RADIAL', '#f59e0b', ['2.4 bar', '10 Hz', '0/2000', '15 mm'], 'bars');
    trackTex(eswtScreen.texture);
    const screenMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: eswtScreen.texture,
        emissiveMap: eswtScreen.texture,
        emissive: 0xffffff,
        emissiveIntensity: 0.2,
        roughness: 0.18,
      })
    );
    const screenFace = new THREE.Mesh(trackGeom(new THREE.PlaneGeometry(0.27, 0.15)), screenMat);
    screenFace.position.set(0, 0.785, 0.062);
    screenFace.rotation.x = -0.4;

    const tipRack = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.22, 0.024, 0.11)), aluminumMat);
    tipRack.position.set(0, 0.66, -0.09);
    for (const tx of [-0.065, 0, 0.065]) {
      const tip = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.016, 0.014, 0.04, 12)), chromeMat);
      tip.position.set(tx, 0.688, -0.09);
      group.add(tip);
    }

    markDeviceScreen(scrFrame);
    markDeviceScreen(screenFace);
    group.add(base, tower, pGauge, scrFrame, screenFace, tipRack);
    addRearPushHandle(group, 0.15, -0.14, -0.21, 0.66, 0.78, 0.11);

    const pistolGroup = new THREE.Group();
    pistolGroup.position.set(0.185, 0.68, 0.02);
    pistolGroup.rotation.set(Math.PI / 2, 0, 0);
    const barrel = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.02, 0.016, 0.19, 12)), chromeMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = -0.095;
    const pistolGrip = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.032, 0.11, 0.045)), slateFrameMat);
    pistolGrip.position.set(0, -0.06, -0.14);
    const tipMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0, roughness: 0.25 })
    );
    const cuffTip = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.024, 0.024, 0.028, 14)), tipMat);
    cuffTip.rotation.x = Math.PI / 2;
    cuffTip.position.z = -0.002;
    pistolGroup.add(barrel, pistolGrip, cuffTip);
    markDraggableProbe(pistolGroup, 'head');
    group.add(pistolGroup);

    const hose = createDynamicCable(0.0095, braidedHoseMat, disposables, 14, 8);
    group.add(hose.mesh);

    updateMotion = (input) => {
      const a = THREE.MathUtils.clamp(input.activeBlend, 0, 1);
      const onBed = THREE.MathUtils.clamp(input.onBedBlend ?? a, 0, 1);
      const running = Boolean(input.isRunning ?? a > 0.25);
      const p = input.deviceParams;
      const bStr = `${Number(p?.intensity ?? 2.4).toFixed(1)} bar`;
      const hStr = `${p?.freqHz ?? 10} Hz`;
      const sStr = `${Math.round(p?.deliveredShocks ?? 0)}/${p?.shocks ?? 2000}`;
      const tStr = p?.tipSize ?? '15 mm';
      eswtScreen.updateDisplay(running, `${bStr}|${hStr}|${sStr}|${tStr}`, [bStr, hStr, sStr, tStr]);
      screenMat.emissiveIntensity = 0.14 + a * 0.9;
      tipMat.emissiveIntensity = a * (1.3 + Math.sin(input.timeSec * 8) * 0.35);

      const target = findProbeTarget(input.probeWorldTargets, 'head');
      if (target && (target.placed || target.holding) && onBed > 0.05) {
        const lift = target.placed ? 0 : (1 - (target.attachBlend ?? 0)) * 0.048;
        const bar01 = THREE.MathUtils.clamp((Number(p?.intensity ?? 2.4) - 1) / 4, 0.1, 1);
        const eswtHz = THREE.MathUtils.clamp(Number(p?.freqHz ?? 10), 1, 21);
        const pulseOff = target.placed && running ? Math.abs(Math.sin(input.timeSec * eswtHz * Math.PI)) * (0.003 + bar01 * 0.005) : 0;
        applyPlacedProbeTransform(pistolGroup, group, target, 0.007 + lift + pulseOff, 'Z');
        writeGripWorld(pistolGroup, 0, -0.060, -0.140, target, 0, 1, 0);
      } else {
        pistolGroup.position.set(0.185, 0.68, 0.02);
        pistolGroup.rotation.set(Math.PI / 2, 0, 0);
      }
      pistolGroup.updateMatrix();
      _portPosScratch.set(0.16, 0.65, 0.06);
      _endPosScratch.set(0, -0.11, -0.14).applyMatrix4(pistolGroup.matrix);
      _exitDirScratch.set(1, -0.2, 0.2).normalize();
      hose.update(_portPosScratch, _endPosScratch, target?.placed ? 0.22 : 0.10, _exitDirScratch, 0.05);
    };
  } else if (sprite === 'emg_biofeedback') {
    colliderHalfW = 0.23;
    colliderHalfD = 0.23;

    for (let i = 0; i < 5; i++) {
      const ang = (i * Math.PI * 2) / 5;
      const legWrap = new THREE.Group();
      legWrap.rotation.y = ang;
      const leg = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.20, 0.024, 0.028)), chromeMat);
      leg.position.set(0.10, 0.055, 0);
      const wh = new THREE.Mesh(wheelGeom, darkRubberMat);
      wh.position.set(0.19, 0.024, 0);
      legWrap.add(leg, wh);
      group.add(legWrap);
    }

    const col = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.026, 0.032, 0.86, 14)), chromeMat);
    col.position.set(0, 0.48, -0.05);
    const tray = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.36, 0.032, 0.30)), bodyWhiteMat);
    tray.position.set(0, 0.62, 0.01);
    const preAmp = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.19, 0.064, 0.14)), slateFrameMat);
    preAmp.position.set(-0.04, 0.665, 0.02);

    const jackR = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.011, 0.011, 0.024, 10)), redAccentMat);
    jackR.position.set(0.08, 0.655, 0.07);
    const jackG = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.011, 0.011, 0.024, 10)), emeraldAccentMat);
    jackG.position.set(0.115, 0.655, 0.07);
    const jackY = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.011, 0.011, 0.024, 10)), amberAccentMat);
    jackY.position.set(0.15, 0.655, 0.07);

    const monFrame = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.42, 0.27, 0.042)), slateFrameMat);
    monFrame.position.set(0, 0.96, -0.03);
    monFrame.rotation.x = -0.15;

    const emgScreen = createLiveDeviceScreen('sEMG BIOFEEDBACK', '#10b981', ['THR 35uV', 'GAIN x2', 'WORK/REST', '12:00'], 'wave');
    trackTex(emgScreen.texture);
    const screenMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: emgScreen.texture,
        emissiveMap: emgScreen.texture,
        emissive: 0xffffff,
        emissiveIntensity: 0.2,
        roughness: 0.18,
      })
    );
    const screenFace = new THREE.Mesh(trackGeom(new THREE.PlaneGeometry(0.37, 0.22)), screenMat);
    screenFace.position.set(0, 0.962, -0.005);
    screenFace.rotation.x = -0.15;

    markDeviceScreen(monFrame);
    markDeviceScreen(screenFace);
    group.add(col, tray, preAmp, jackR, jackG, jackY, monFrame, screenFace);
    addRearPushHandle(group, 0.15, -0.13, -0.21, 0.62, 0.78, 0.11);

    const emgSpecs: Array<{
      id: string;
      mat: THREE.Material;
      dockPos: [number, number, number];
      port: THREE.Vector3;
    }> = [
      { id: 'emg_1', mat: emeraldAccentMat, dockPos: [0.08, 0.642, 0.125], port: new THREE.Vector3(0.08, 0.655, 0.075) },
      { id: 'emg_2', mat: redAccentMat, dockPos: [0.115, 0.642, 0.125], port: new THREE.Vector3(0.115, 0.655, 0.075) },
      { id: 'emg_ref', mat: amberAccentMat, dockPos: [0.15, 0.642, 0.125], port: new THREE.Vector3(0.15, 0.655, 0.075) },
    ];
    const discGeom = trackGeom(new THREE.CylinderGeometry(0.019, 0.021, 0.0085, 16));
    const emgGelGeom = trackGeom(new THREE.CylinderGeometry(0.023, 0.025, 0.0026, 16));
    const emgPulseGeom = trackGeom(new THREE.RingGeometry(0.021, 0.030, 20));
    emgPulseGeom.rotateX(-Math.PI / 2);
    const emgEntries = emgSpecs.map((es) => {
      const pGroup = new THREE.Group();
      pGroup.position.set(...es.dockPos);
      const emgGel = new THREE.Mesh(emgGelGeom, bodyWhiteMat);
      emgGel.position.y = 0.0012;
      const pod = new THREE.Mesh(discGeom, es.mat);
      pod.position.y = 0.005;
      const cap = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.012, 0.012, 0.006, 12)), bodyWhiteMat);
      cap.position.y = 0.010;
      const pulseMat = trackMat(
        new THREE.MeshBasicMaterial({
          color: 0x10b981,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
        })
      );
      const pulseRing = new THREE.Mesh(emgPulseGeom, pulseMat);
      pulseRing.position.y = 0.002;
      pulseRing.visible = false;
      pGroup.add(emgGel, pod, cap, pulseRing);
      markDraggableProbe(pGroup, es.id);
      group.add(pGroup);
      const cable = createDynamicCable(0.004, es.mat, disposables, 14, 7);
      group.add(cable.mesh);
      return { ...es, pGroup, pulseRing, pulseMat, cable };
    });

    updateMotion = (input) => {
      const a = THREE.MathUtils.clamp(input.activeBlend, 0, 1);
      const onBed = THREE.MathUtils.clamp(input.onBedBlend ?? a, 0, 1);
      const running = Boolean(input.isRunning ?? a > 0.25);
      const p = input.deviceParams;
      const thr = `THR ${p?.intensity ?? 35}uV`;
      const gain = `GAIN x${p?.freqHz ?? 2}`;
      const mStr = p?.mode ?? 'WORK/REST';
      const tStr = formatTimerMmSs(p, 12);
      emgScreen.updateDisplay(running, `${thr}|${gain}|${mStr}|${tStr}`, [thr, gain, mStr, tStr]);
      screenMat.emissiveIntensity = 0.14 + a * 0.9;

      const emgWave = Math.max(0, Math.sin(input.timeSec * 1.4));
      for (const ee of emgEntries) {
        const target = findProbeTarget(input.probeWorldTargets, ee.id);
        if (target && (target.placed || target.holding) && onBed > 0.05) {
          const lift = target.placed ? 0 : (1 - (target.attachBlend ?? 0)) * 0.052;
          applyPlacedProbeTransform(ee.pGroup, group, target, -0.0058 + lift, 'Y');
          if (target.placed && running) {
            ee.pulseRing.visible = true;
            const ph = (input.timeSec * 2.2) % 1;
            const s = 1.0 + ph * 0.52 * (0.4 + emgWave * 0.6);
            ee.pulseRing.scale.set(s, 1, s);
            ee.pulseMat.opacity = (1 - ph) * (0.25 + emgWave * 0.55);
          } else {
            ee.pulseRing.visible = false;
          }
          writeGripWorld(ee.pGroup, 0, 0.011, 0, target);
        } else {
          ee.pGroup.position.set(...ee.dockPos);
          ee.pGroup.rotation.set(0, 0, 0);
          ee.pulseRing.visible = false;
        }
        ee.pGroup.updateMatrix();
        _endPosScratch.set(0, 0.010, 0).applyMatrix4(ee.pGroup.matrix);
        _exitDirScratch.set(0, 0.25, 1).normalize();
        ee.cable.update(ee.port, _endPosScratch, target?.placed ? 0.18 : 0.06, _exitDirScratch, 0.05);
      }
    };
  } else if (sprite === 'cryo_unit') {
    colliderHalfW = 0.23;
    colliderHalfD = 0.23;

    addCasters(group, [
      [-0.15, -0.15],
      [0.15, -0.15],
      [-0.15, 0.15],
      [0.15, 0.15],
    ]);
    const compBox = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.36, 0.38, 0.35)), slateFrameMat);
    compBox.position.set(0, 0.24, 0);

    const scrBezel = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.24, 0.13, 0.025)), slateFrameMat);
    scrBezel.position.set(0, 0.33, 0.18);
    scrBezel.rotation.x = -0.2;

    const cryoScreen = createLiveDeviceScreen('CRYO COMP', '#22d3ee', ['4 C', '45 mmHg', 'HIGH', '15:00'], 'gauge');
    trackTex(cryoScreen.texture);
    const screenMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: cryoScreen.texture,
        emissiveMap: cryoScreen.texture,
        emissive: 0xffffff,
        emissiveIntensity: 0.2,
        roughness: 0.18,
      })
    );
    const screenFace = new THREE.Mesh(trackGeom(new THREE.PlaneGeometry(0.21, 0.105)), screenMat);
    screenFace.position.set(0, 0.332, 0.194);
    screenFace.rotation.x = -0.2;

    const iceMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x7dd3fc, roughness: 0.22, transparent: true, opacity: 0.78 })
    );
    const iceTank = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.145, 0.13, 0.30, 20)), iceMat);
    iceTank.position.set(0, 0.58, 0);
    const tankLid = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.154, 0.154, 0.048, 20)), cyanAccentMat);
    tankLid.position.set(0, 0.745, 0);
    const lidHandle = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.18, 0.028, 0.032)), bodyWhiteMat);
    lidHandle.position.set(0, 0.79, 0);

    markDeviceScreen(scrBezel);
    markDeviceScreen(screenFace);
    group.add(compBox, scrBezel, screenFace, iceTank, tankLid, lidHandle);
    addRearPushHandle(group, 0.155, -0.16, -0.21, 0.42, 0.78, 0.11);

    // Pneumatic Cryo-Cuff Wrap + insulated silver coolant hose
    const cuffGroup = new THREE.Group();
    cuffGroup.position.set(0.21, 0.50, 0);
    cuffGroup.rotation.set(0, 0, -Math.PI / 2);
    const cuffMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        emissive: 0x06b6d4,
        emissiveIntensity: 0,
        roughness: 0.42,
      })
    );
    const cuffShell = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.18, 0.042, 0.17)), cuffMat);
    cuffShell.position.y = 0.02;
    const strap1 = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.20, 0.012, 0.032)), darkRubberMat);
    strap1.position.set(0, 0.045, -0.045);
    const strap2 = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.20, 0.012, 0.032)), darkRubberMat);
    strap2.position.set(0, 0.045, 0.045);
    const nozzle = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.015, 0.015, 0.036, 10)), chromeMat);
    nozzle.position.set(0, 0.05, 0);
    cuffGroup.add(cuffShell, strap1, strap2, nozzle);
    markDraggableProbe(cuffGroup, 'head');
    group.add(cuffGroup);

    const cryoHose = createDynamicCable(0.012, aluminumMat, disposables, 14, 8);
    group.add(cryoHose.mesh);

    updateMotion = (input) => {
      const a = THREE.MathUtils.clamp(input.activeBlend, 0, 1);
      const onBed = THREE.MathUtils.clamp(input.onBedBlend ?? a, 0, 1);
      const running = Boolean(input.isRunning ?? a > 0.25);
      const p = input.deviceParams;
      const tmpStr = `${p?.tempC ?? 4} C`;
      const mmStr = `${p?.pressureMmHg ?? 45} mmHg`;
      const fStr = p?.flow ?? 'HIGH';
      const tStr = formatTimerMmSs(p, 15);
      cryoScreen.updateDisplay(running, `${tmpStr}|${mmStr}|${fStr}|${tStr}`, [tmpStr, mmStr, fStr, tStr]);
      screenMat.emissiveIntensity = 0.14 + a * 0.9;
      cuffMat.emissiveIntensity = a * (0.45 + Math.sin(input.timeSec * 3.5) * 0.2);

      const target = findProbeTarget(input.probeWorldTargets, 'head');
      if (target && (target.placed || target.holding) && onBed > 0.05) {
        const lift = target.placed ? 0 : (1 - (target.attachBlend ?? 0)) * 0.056;
        applyPlacedProbeTransform(cuffGroup, group, target, -0.003 + lift, 'Y');
        const mm01 = THREE.MathUtils.clamp((Number(p?.pressureMmHg ?? 45) - 20) / 55, 0.2, 1);
        const puff = target.placed && running ? 1 + Math.sin(input.timeSec * (2.2 + mm01 * 1.4)) * (0.04 + mm01 * 0.06) : 1;
        cuffGroup.scale.set(1, puff, 1);
        writeGripWorld(cuffGroup, 0, 0.034, 0, target);
      } else {
        cuffGroup.position.set(0.21, 0.50, 0);
        cuffGroup.rotation.set(0, 0, -Math.PI / 2);
        cuffGroup.scale.set(1, 1, 1);
      }
      cuffGroup.updateMatrix();
      _portPosScratch.set(0.17, 0.36, 0.08);
      _endPosScratch.set(0, 0.055, 0).applyMatrix4(cuffGroup.matrix);
      _exitDirScratch.set(1, 0.2, 0.3).normalize();
      cryoHose.update(_portPosScratch, _endPosScratch, target?.placed ? 0.20 : 0.10, _exitDirScratch, 0.04);
    };
  } else if (sprite === 'cpm_device') {
    colliderHalfW = 0.38;
    colliderHalfD = 0.18;

    const cradle = new THREE.Group();
    group.add(cradle);

    const railGeom = trackGeom(new THREE.CylinderGeometry(0.012, 0.012, 0.72, 10));
    railGeom.rotateZ(Math.PI / 2);
    for (const rz of [-0.095, 0.095]) {
      const r = new THREE.Mesh(railGeom, aluminumMat);
      r.position.set(0, 0.032, rz);
      cradle.add(r);
    }

    const motorHousing = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.16, 0.095, 0.24)), bodyWhiteMat);
    motorHousing.position.set(-0.3, 0.065, 0);

    const cpmScreen = createLiveDeviceScreen('CPM KNEE', '#0ea5e9', ['0..90 deg', 'SPD 2', 'CONT', '30:00'], 'cpm');
    trackTex(cpmScreen.texture);
    const screenMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: cpmScreen.texture,
        emissiveMap: cpmScreen.texture,
        emissive: 0xffffff,
        emissiveIntensity: 0.22,
        roughness: 0.2,
      })
    );
    const screenHousing = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.12, 0.026, 0.16)), slateFrameMat);
    screenHousing.position.set(-0.3, 0.118, 0);
    const screenTop = new THREE.Mesh(trackGeom(new THREE.PlaneGeometry(0.135, 0.095)), screenMat);
    screenTop.rotation.x = -Math.PI / 2;
    screenTop.rotation.z = Math.PI / 2;
    screenTop.position.set(-0.3, 0.132, 0);

    const pendant = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.09, 0.026, 0.14)), slateFrameMat);
    pendant.position.set(-0.04, 0.025, 0.21);
    const pendantScr = new THREE.Mesh(trackGeom(new THREE.PlaneGeometry(0.072, 0.095)), screenMat);
    pendantScr.rotation.x = -Math.PI / 2;
    pendantScr.position.set(-0.04, 0.039, 0.20);

    const pendantCord = createDynamicCable(0.005, darkRubberMat, disposables, 10, 6);
    cradle.add(pendantCord.mesh);

    markDeviceScreen(screenHousing);
    markDeviceScreen(screenTop);
    markDeviceScreen(pendant);
    markDeviceScreen(pendantScr);

    const hipRest = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.22, 0.032, 0.16)), blueUpholsteryMat);
    hipRest.position.set(-0.18, 0.085, 0);

    const thighArm = new THREE.Group();
    thighArm.position.set(-0.24, 0.07, 0);
    const thighBar = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.28, 0.022, 0.15)), aluminumMat);
    thighBar.position.set(0.14, 0, 0);
    const thighCushion = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.22, 0.025, 0.14)), blueUpholsteryMat);
    thighCushion.position.set(0.14, 0.022, 0);
    thighArm.add(thighBar, thighCushion);

    const kneeJoint = new THREE.Group();
    kneeJoint.position.set(0.28, 0, 0);
    thighArm.add(kneeJoint);

    const shinBar = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.28, 0.022, 0.15)), aluminumMat);
    shinBar.position.set(0.14, 0, 0);
    const shinCushion = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.22, 0.025, 0.14)), blueUpholsteryMat);
    shinCushion.position.set(0.14, 0.022, 0);
    const footBoot = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.032, 0.16, 0.14)), blueUpholsteryMat);
    footBoot.position.set(0.27, 0.08, 0);
    kneeJoint.add(shinBar, shinCushion, footBoot);

    const cpmGripBarGeom = trackGeom(new THREE.CylinderGeometry(0.012, 0.012, 0.095, 10));
    cpmGripBarGeom.rotateZ(Math.PI / 2);
    const cpmGripSleeveGeom = trackGeom(new THREE.CylinderGeometry(0.017, 0.017, 0.078, 10));
    cpmGripSleeveGeom.rotateZ(Math.PI / 2);
    const cpmStubGeom = trackGeom(new THREE.CylinderGeometry(0.0085, 0.0085, 0.044, 8));
    cpmStubGeom.rotateX(Math.PI / 2);
    for (const gx of [-0.165, 0.165]) {
      const gBar = new THREE.Mesh(cpmGripBarGeom, chromeMat);
      gBar.position.set(gx, 0.056, 0.125);
      const gSleeve = new THREE.Mesh(cpmGripSleeveGeom, darkRubberMat);
      gSleeve.position.set(gx, 0.056, 0.125);
      const stL = new THREE.Mesh(cpmStubGeom, slateFrameMat);
      stL.position.set(gx - 0.042, 0.044, 0.11);
      stL.rotation.x = -0.45;
      const stR = new THREE.Mesh(cpmStubGeom, slateFrameMat);
      stR.position.set(gx + 0.042, 0.044, 0.11);
      stR.rotation.x = -0.45;
      cradle.add(gBar, gSleeve, stL, stR);
    }

    cradle.add(motorHousing, screenHousing, screenTop, pendant, pendantScr, hipRest, thighArm);

    updateMotion = (input) => {
      const a = input.activeBlend;
      const mount = input.onBedBlend ?? a;
      const running = Boolean(input.isRunning ?? a > 0.25);
      const p = input.deviceParams;
      const extDeg = Number(p?.extDeg ?? 0);
      const flexDeg = Number(p?.flexDeg ?? 90);
      const speed = Number(p?.speed ?? 2);
      const romStr = `${extDeg}..${flexDeg}d`;
      const spdStr = `SPD ${speed}`;
      const tStr = formatTimerMmSs(p, 30);
      cpmScreen.updateDisplay(running, `${romStr}|${spdStr}|${tStr}`, [romStr, spdStr, 'CPM', tStr]);
      screenMat.emissiveIntensity = 0.16 + a * 0.85;

      cradle.position.y = THREE.MathUtils.lerp(0.02, Math.max(0.02, input.bedHeight), mount);
      _portPosScratch.set(-0.22, 0.06, 0.10);
      _endPosScratch.set(-0.08, 0.025, 0.16);
      pendantCord.update(_portPosScratch, _endPosScratch, 0.04, undefined, 0.01);

      const cycleRate = 0.65 + speed * 0.35;
      const flexScale = THREE.MathUtils.clamp((flexDeg - extDeg) / 110, 0.25, 1.15);
      const flexWave = a > 0.08 ? (0.5 - 0.5 * Math.cos(input.timeSec * cycleRate)) * a * flexScale : 0.14;
      thighArm.rotation.z = 0.18 + flexWave * 0.42;
      kneeJoint.rotation.z = -0.28 - flexWave * 0.78;
    };
  } else if (sprite === 'hand_rehab_table') {
    colliderHalfW = 0.30;
    colliderHalfD = 0.22;

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

    const pegBase = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.18, 0.018, 0.14)), woodOakMat);
    pegBase.position.set(-0.14, 0.783, 0);
    const handPegs: THREE.Mesh[] = [];
    for (let px = -2; px <= 2; px++) {
      const peg = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.005, 0.005, 0.048, 8)), cyanAccentMat);
      peg.position.set(-0.14 + px * 0.028, 0.812, -0.02 + (px % 2) * 0.04);
      handPegs.push(peg);
      group.add(peg);
    }

    const puttyTub1 = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.036, 0.036, 0.034, 12)), emeraldAccentMat);
    puttyTub1.position.set(0.08, 0.79, 0.06);
    const puttyTub2 = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.036, 0.036, 0.034, 12)), amberAccentMat);
    puttyTub2.position.set(0.17, 0.79, 0.06);
    const puttyMound = new THREE.Mesh(trackGeom(new THREE.SphereGeometry(0.032, 12, 10)), emeraldAccentMat);
    puttyMound.position.set(0.08, 0.812, 0.06);

    const dynaBody = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.04, 0.09, 0.08)), aluminumMat);
    dynaBody.position.set(0.12, 0.82, -0.07);
    const dynaGauge = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.028, 0.028, 0.015, 14)), bodyWhiteMat);
    dynaGauge.rotation.z = Math.PI / 2;
    dynaGauge.position.set(0.12, 0.86, -0.07);
    const dynaNeedle = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.004, 0.024, 0.004)), redAccentMat);
    dynaNeedle.position.set(0.132, 0.866, -0.07);

    const hrScreen = createLiveDeviceScreen('HAND REHAB', '#14b8a6', ['PEGBOARD', '28 KG', 'FINE MOTOR', '15:00'], 'grid');
    trackTex(hrScreen.texture);
    const hrScreenMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: hrScreen.texture,
        emissiveMap: hrScreen.texture,
        emissive: 0xffffff,
        emissiveIntensity: 0.22,
        roughness: 0.22,
      })
    );
    const hrBezel = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.18, 0.11, 0.016)), slateFrameMat);
    hrBezel.position.set(-0.15, 0.84, -0.14);
    hrBezel.rotation.x = -0.35;
    const hrFace = new THREE.Mesh(trackGeom(new THREE.PlaneGeometry(0.158, 0.092)), hrScreenMat);
    hrFace.position.set(-0.15, 0.842, -0.131);
    hrFace.rotation.x = -0.35;
    markDeviceScreen(hrBezel);
    markDeviceScreen(hrFace);

    group.add(
      cFootL, cFootR, cBack, col, topDeck, edgeBand, pegBase,
      puttyTub1, puttyTub2, puttyMound, dynaBody, dynaGauge, dynaNeedle, hrBezel, hrFace
    );
    addRearPushHandle(group, 0.22, -0.17, -0.25, 0.75, 0.81, 0.16);

    updateMotion = (input) => {
      const a = THREE.MathUtils.clamp(input.activeBlend, 0, 1);
      const running = Boolean(input.isRunning ?? a > 0.25);
      const p = input.deviceParams;
      const tool = String(p?.tool ?? 'PEGBOARD');
      const grip = Math.round(Number(p?.gripKg ?? 28));
      const tm = formatTimerMmSs(p, 15);
      hrScreen.updateDisplay(
        running,
        `${tool}|${grip}|${tm}`,
        [tool.slice(0, 10), `${grip} KG`, tool === 'PEGBOARD' ? 'DEXTERITY' : tool === 'PUTTY' ? 'PINCH' : 'GRIP TEST', tm]
      );
      hrScreenMat.emissiveIntensity = 0.15 + a * 0.85;

      for (let i = 0; i < handPegs.length; i++) {
        const lift =
          running && tool === 'PEGBOARD'
            ? Math.max(0, Math.sin(input.timeSec * 3.4 - i * 1.15)) * 0.042
            : 0;
        handPegs[i].position.y = 0.812 + lift;
      }
      if (running && tool === 'PUTTY') {
        const sq = 0.72 + 0.35 * Math.sin(input.timeSec * 2.8);
        puttyMound.scale.set(1.18 - sq * 0.15, sq, 1.18 - sq * 0.15);
      } else {
        puttyMound.scale.set(1, 0.85, 1);
      }
      if (running && tool === 'DYNAMOMETER') {
        const targetAng = 0.4 + (grip / 60) * 1.4 + Math.sin(input.timeSec * 4.0) * 0.16;
        dynaNeedle.rotation.x = targetAng;
      } else {
        dynaNeedle.rotation.x = 0.25;
      }
    };
  } else if (sprite === 'paraffin_bath' || sprite === 'hydro_sink') {
    colliderHalfW = 0.23;
    colliderHalfD = 0.21;
    const isHydro = sprite === 'hydro_sink';
    addCasters(group, [
      [-0.15, -0.13],
      [0.15, -0.13],
      [-0.15, 0.13],
      [0.15, 0.13],
    ]);

    if (isHydro) {
      const tank = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.40, 0.68, 0.34)), aluminumMat);
      tank.position.y = 0.39;
      const lid = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.42, 0.032, 0.35)), chromeMat);
      lid.position.set(0, 0.745, -0.01);
      lid.rotation.x = -0.12;
      const lidHandle = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.16, 0.022, 0.028)), darkRubberMat);
      lidHandle.position.set(0, 0.78, 0.11);

      const hydroScreen = createLiveDeviceScreen('HYDROCOLLATOR', '#f59e0b', ['74 C', 'STD', '15:00', 'HEATED'], 'thermal');
      trackTex(hydroScreen.texture);
      const screenMat = trackMat(
        new THREE.MeshStandardMaterial({
          map: hydroScreen.texture,
          emissiveMap: hydroScreen.texture,
          emissive: 0xffffff,
          emissiveIntensity: 0.2,
          roughness: 0.2,
        })
      );
      const scrBezel = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.22, 0.125, 0.02)), slateFrameMat);
      scrBezel.position.set(0, 0.56, 0.174);
      const scrFace = new THREE.Mesh(trackGeom(new THREE.PlaneGeometry(0.19, 0.10)), screenMat);
      scrFace.position.set(0, 0.56, 0.186);

      // Terrycloth-wrapped moist heat pack — draggable onto patient's painful area!
      const packGroup = new THREE.Group();
      packGroup.position.set(0, 0.77, -0.04);
      const packMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0xe2d5be,
          emissive: 0xf59e0b,
          emissiveIntensity: 0,
          roughness: 0.85,
        })
      );
      const hotPack = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.20, 0.034, 0.14)), packMat);
      hotPack.position.y = 0.017;
      const packStrap = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.204, 0.012, 0.045)), blueUpholsteryMat);
      packStrap.position.y = 0.028;
      packGroup.add(hotPack, packStrap);
      markDraggableProbe(packGroup, 'head');

      const sideRack = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.045, 0.20, 0.18)), blueUpholsteryMat);
      sideRack.position.set(0.225, 0.50, 0);

      markDeviceScreen(scrBezel);
      markDeviceScreen(scrFace);
      group.add(tank, lid, lidHandle, scrBezel, scrFace, packGroup, sideRack);
      addRearPushHandle(group, 0.16, -0.16, -0.23, 0.68, 0.78, 0.13);

      updateMotion = (input) => {
        const a = THREE.MathUtils.clamp(input.activeBlend, 0, 1);
        const onBed = THREE.MathUtils.clamp(input.onBedBlend ?? a, 0, 1);
        const running = Boolean(input.isRunning ?? a > 0.25);
        const p = input.deviceParams;
        const tC = `${p?.tempC ?? 74} C`;
        const mStr = p?.mode ?? 'STD';
        const tmStr = formatTimerMmSs(p, 15);
        hydroScreen.updateDisplay(running, `${tC}|${mStr}|${tmStr}`, [tC, mStr, tmStr, 'HOT']);
        screenMat.emissiveIntensity = 0.14 + a * 0.82;
        packMat.emissiveIntensity = a * (0.28 + Math.sin(input.timeSec * 2) * 0.08);

        const target = findProbeTarget(input.probeWorldTargets, 'head');
        if (target && (target.placed || target.holding) && onBed > 0.05) {
          const lift = target.placed ? 0 : (1 - (target.attachBlend ?? 0)) * 0.056;
          applyPlacedProbeTransform(packGroup, group, target, -0.004 + lift, 'Y');
          writeGripWorld(packGroup, 0, 0.032, 0, target);
        } else {
          packGroup.position.set(0, 0.77, -0.04);
          packGroup.rotation.set(0, 0, 0);
        }
      };
    } else {
      const shelfBot = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.38, 0.02, 0.32)), aluminumMat);
      shelfBot.position.y = 0.10;
      const shelfMid = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.36, 0.02, 0.30)), bodyWhiteMat);
      shelfMid.position.y = 0.30;
      const mittMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0x0284c7,
          emissive: 0xf59e0b,
          emissiveIntensity: 0,
          roughness: 0.72,
        })
      );
      const mittGroup = new THREE.Group();
      mittGroup.position.set(-0.08, 0.335, 0);
      const mittBlue = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.12, 0.044, 0.16)), mittMat);
      const mittCuff = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.126, 0.016, 0.045)), bodyWhiteMat);
      mittCuff.position.set(0, 0.016, -0.05);
      mittGroup.add(mittBlue, mittCuff);
      markDraggableProbe(mittGroup, 'head');

      const mittWhite = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.12, 0.044, 0.16)), bodyWhiteMat);
      mittWhite.position.set(0.08, 0.335, 0);
      const shelfTop = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.38, 0.022, 0.32)), aluminumMat);
      shelfTop.position.y = 0.56;
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

      const tub = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.32, 0.16, 0.26)), bodyWhiteMat);
      tub.position.set(0, 0.65, 0);
      const tubRim = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.335, 0.024, 0.275)), slateFrameMat);
      tubRim.position.set(0, 0.744, 0);
      const waxMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0xfde68a,
          emissive: 0xf59e0b,
          emissiveIntensity: 0.04,
          roughness: 0.2,
          envMapIntensity: 0.9,
        })
      );
      const waxPool = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.26, 0.018, 0.20)), waxMat);
      waxPool.position.set(0, 0.766, 0);

      const pScreen = createLiveDeviceScreen('PARAFFIN', '#f59e0b', ['53 C', 'DIP&WRAP', '15:00', 'MELT'], 'thermal');
      trackTex(pScreen.texture);
      const pScreenMat = trackMat(
        new THREE.MeshStandardMaterial({
          map: pScreen.texture,
          emissiveMap: pScreen.texture,
          emissive: 0xffffff,
          emissiveIntensity: 0.2,
          roughness: 0.2,
        })
      );
      const scrBezel = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.20, 0.105, 0.018)), slateFrameMat);
      scrBezel.position.set(0, 0.65, 0.14);
      const scrFace = new THREE.Mesh(trackGeom(new THREE.PlaneGeometry(0.175, 0.082)), pScreenMat);
      scrFace.position.set(0, 0.65, 0.154);

      markDeviceScreen(scrBezel);
      markDeviceScreen(scrFace);
      group.add(shelfBot, shelfMid, mittGroup, mittWhite, shelfTop, tub, tubRim, waxPool, scrBezel, scrFace);
      addRearPushHandle(group, 0.17, -0.14, -0.23, 0.56, 0.78, 0.13);

      updateMotion = (input) => {
        const a = THREE.MathUtils.clamp(input.activeBlend, 0, 1);
        const onBed = THREE.MathUtils.clamp(input.onBedBlend ?? a, 0, 1);
        const running = Boolean(input.isRunning ?? a > 0.25);
        const p = input.deviceParams;
        const tC = `${p?.tempC ?? 53} C`;
        const mStr = p?.mode ?? 'DIP&WRAP';
        const tmStr = formatTimerMmSs(p, 15);
        pScreen.updateDisplay(running, `${tC}|${mStr}|${tmStr}`, [tC, mStr, tmStr, 'WAX']);
        pScreenMat.emissiveIntensity = 0.14 + a * 0.85;
        waxMat.emissiveIntensity = 0.03 + a * 0.72;
        mittMat.emissiveIntensity = a * (0.24 + Math.sin(input.timeSec * 2.2) * 0.08);

        const target = findProbeTarget(input.probeWorldTargets, 'head');
        if (target && (target.placed || target.holding) && onBed > 0.05) {
          const lift = target.placed ? 0 : (1 - (target.attachBlend ?? 0)) * 0.052;
          applyPlacedProbeTransform(mittGroup, group, target, 0.012 + lift, 'Y');
          writeGripWorld(mittGroup, 0, 0.025, 0, target);
        } else {
          mittGroup.position.set(-0.08, 0.335, 0);
          mittGroup.rotation.set(0, 0, 0);
        }
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

    const ptScreen = createLiveDeviceScreen('PT DIAGNOSTICS', '#0ea5e9', ['GONIOMETER', 'ROM 115', 'DTR 2+', '10:00'], 'gauge');
    trackTex(ptScreen.texture);
    const ptScreenMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: ptScreen.texture,
        emissiveMap: ptScreen.texture,
        emissive: 0xffffff,
        emissiveIntensity: 0.22,
        roughness: 0.22,
      })
    );
    const ptBezel = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.24, 0.135, 0.018)), slateFrameMat);
    ptBezel.position.set(0, 0.61, 0.155);
    const ptFace = new THREE.Mesh(trackGeom(new THREE.PlaneGeometry(0.21, 0.108)), ptScreenMat);
    ptFace.position.set(0, 0.61, 0.168);
    markDeviceScreen(ptBezel);
    markDeviceScreen(ptFace);

    const activeToolGroup = new THREE.Group();
    activeToolGroup.position.set(-0.08, 0.764, 0.04);
    const goniSub = new THREE.Group();
    const dialMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.78, roughness: 0.2 })
    );
    const dialFace = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.032, 0.032, 0.006, 18)), dialMat);
    dialFace.position.y = 0.005;
    const armFixed = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.016, 0.005, 0.14)), chromeMat);
    armFixed.position.set(0, 0.006, 0.068);
    const armSwingPivot = new THREE.Group();
    armSwingPivot.position.set(0, 0.011, 0);
    const armMoving = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.015, 0.005, 0.14)), cyanAccentMat);
    armMoving.position.set(0, 0, -0.068);
    armSwingPivot.add(armMoving);
    goniSub.add(dialFace, armFixed, armSwingPivot);

    const reflexSub = new THREE.Group();
    reflexSub.visible = false;
    const rShaft = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.005, 0.006, 0.16, 8)), chromeMat);
    rShaft.rotation.z = Math.PI / 2;
    rShaft.position.set(0, 0.014, 0);
    const rTri = new THREE.Mesh(trackGeom(new THREE.ConeGeometry(0.022, 0.052, 6)), redAccentMat);
    rTri.rotation.x = Math.PI / 2;
    rTri.position.set(0.075, 0.014, 0);
    reflexSub.add(rShaft, rTri);

    const iastmSub = new THREE.Group();
    iastmSub.visible = false;
    const blade = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.125, 0.008, 0.046)), chromeMat);
    blade.position.y = 0.008;
    const bladeGrip = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.05, 0.018, 0.02)), cyanAccentMat);
    bladeGrip.position.y = 0.02;
    iastmSub.add(blade, bladeGrip);

    const tapeSub = new THREE.Group();
    tapeSub.visible = false;
    const tapeStrip = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.14, 0.004, 0.038)), cyanAccentMat);
    tapeStrip.position.y = 0.004;
    const tapeRoll = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.024, 0.024, 0.038, 12)), cyanAccentMat);
    tapeRoll.rotation.x = Math.PI / 2;
    tapeRoll.position.set(-0.04, 0.026, 0);
    tapeSub.add(tapeStrip, tapeRoll);

    const toolGripHub = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.013, 0.015, 0.046, 12)), darkRubberMat);
    toolGripHub.position.set(0, 0.025, 0);
    activeToolGroup.add(goniSub, reflexSub, iastmSub, tapeSub, toolGripHub);
    markDraggableProbe(activeToolGroup, 'head');

    const hammerHandle = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.005, 0.005, 0.16, 8)), chromeMat);
    hammerHandle.rotation.z = Math.PI / 2;
    hammerHandle.position.set(0.04, 0.76, -0.05);
    const hammerHead = new THREE.Mesh(trackGeom(new THREE.ConeGeometry(0.018, 0.045, 8)), redAccentMat);
    hammerHead.rotation.x = Math.PI / 2;
    hammerHead.position.set(0.11, 0.76, -0.05);
    const iastm = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.11, 0.006, 0.036)), chromeMat);
    iastm.position.set(0.06, 0.758, 0.06);
    const goni = new THREE.Mesh(
      trackGeom(new THREE.RingGeometry(0.02, 0.036, 16)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.75, side: THREE.DoubleSide }))
    );
    goni.rotation.x = -Math.PI / 2;
    goni.position.set(-0.1, 0.756, -0.06);
    group.add(ptBezel, ptFace, activeToolGroup, hammerHandle, hammerHead, iastm, goni);
    addRearPushHandle(group, 0.20, -0.13, -0.23, 0.74, 0.78, 0.13);

    updateMotion = (input) => {
      const a = THREE.MathUtils.clamp(input.activeBlend, 0, 1);
      const onBed = THREE.MathUtils.clamp(input.onBedBlend ?? a, 0, 1);
      const running = Boolean(input.isRunning ?? a > 0.25);
      const p = input.deviceParams;
      const tool = String(p?.tool ?? 'GONIOMETER');
      const rom = Math.round(Number(p?.romDeg ?? 115));
      const dtr = String(p?.dtrGrade ?? '2+');
      const tm = formatTimerMmSs(p, 10);

      goniSub.visible = tool === 'GONIOMETER';
      reflexSub.visible = tool === 'REFLEX';
      iastmSub.visible = tool === 'IASTM';
      tapeSub.visible = tool === 'TAPE';

      ptScreen.updateDisplay(
        running,
        `${tool}|${rom}|${dtr}|${tm}`,
        [tool.slice(0, 10), tool === 'REFLEX' ? `DTR ${dtr}` : `ROM ${rom}d`, tool === 'TAPE' ? 'KINESIO' : 'CLINICAL', tm]
      );
      ptScreenMat.emissiveIntensity = 0.15 + a * 0.85;

      const target = findProbeTarget(input.probeWorldTargets, 'head');
      if (target && (target.placed || target.holding) && onBed > 0.05) {
        const lift = target.placed ? 0 : (1 - (target.attachBlend ?? 0)) * 0.048;
        applyPlacedProbeTransform(activeToolGroup, group, target, 0.008 + lift, 'Y');
        if (tool === 'GONIOMETER') {
          const baseRad = THREE.MathUtils.degToRad(rom) * 0.55;
          armSwingPivot.rotation.y = target.placed && running ? baseRad + Math.sin(input.timeSec * 1.6) * 0.26 : baseRad;
        } else if (tool === 'REFLEX') {
          reflexSub.rotation.z = target.placed && running ? Math.sin(input.timeSec * 6.5) * 0.42 : 0.15;
        } else if (tool === 'IASTM') {
          iastmSub.position.x = target.placed && running ? Math.sin(input.timeSec * 4.2) * 0.032 : 0;
        }
        writeGripWorld(activeToolGroup, 0, 0.025, 0, target, 0, 1, 0);
      } else {
        activeToolGroup.position.set(-0.08, 0.764, 0.04);
        activeToolGroup.rotation.set(0, 0, 0);
        armSwingPivot.rotation.y = 0.2;
        reflexSub.rotation.z = 0;
        iastmSub.position.x = 0;
      }
    };
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

    const ball1Mat = trackMat(new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.38, emissive: 0x0284c7, emissiveIntensity: 0 }));
    const ball1 = new THREE.Mesh(trackGeom(new THREE.SphereGeometry(0.24, 20, 16)), ball1Mat);
    ball1.position.set(0, 0.34, 0.02);
    const ball2Mat = trackMat(new THREE.MeshStandardMaterial({ color: 0x14b8a6, roughness: 0.38, emissive: 0x0d9488, emissiveIntensity: 0 }));
    const ball2 = new THREE.Mesh(trackGeom(new THREE.SphereGeometry(0.21, 20, 16)), ball2Mat);
    ball2.position.set(0, 0.94, 0.02);
    const rackGripGeom = trackGeom(new THREE.CylinderGeometry(0.017, 0.017, 0.11, 10));
    rackGripGeom.rotateX(Math.PI / 2);
    const rackGripL = new THREE.Mesh(rackGripGeom, darkRubberMat);
    rackGripL.position.set(-0.18, 0.84, 0.02);
    const rackGripR = new THREE.Mesh(rackGripGeom, darkRubberMat);
    rackGripR.position.set(0.18, 0.84, 0.02);

    const ballScreen = createLiveDeviceScreen('SWISS BALL', '#14b8a6', ['CORE STAB', '55 cm', 'ACTIVE', '12:00'], 'bars');
    trackTex(ballScreen.texture);
    const ballScreenMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: ballScreen.texture,
        emissiveMap: ballScreen.texture,
        emissive: 0xffffff,
        emissiveIntensity: 0.22,
        roughness: 0.22,
      })
    );
    const ballPlaque = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.22, 0.125, 0.016)), slateFrameMat);
    ballPlaque.position.set(0, 1.14, -0.17);
    const ballScrFace = new THREE.Mesh(trackGeom(new THREE.PlaneGeometry(0.19, 0.10)), ballScreenMat);
    ballScrFace.position.set(0, 1.14, -0.158);
    markDeviceScreen(ballPlaque);
    markDeviceScreen(ballScrFace);

    group.add(baseRing, upright, rLow, rHigh, rackGripL, rackGripR, ball1, ball2, ballPlaque, ballScrFace);

    updateMotion = (input) => {
      const a = THREE.MathUtils.clamp(input.activeBlend, 0, 1);
      const onBed = THREE.MathUtils.clamp(input.onBedBlend ?? a, 0, 1);
      const running = Boolean(input.isRunning ?? a > 0.25);
      const p = input.deviceParams;
      const drill = String(p?.tool ?? 'CORE STABILITY');
      const sz = String(p?.ballSize ?? '55cm');
      const tm = formatTimerMmSs(p, 12);
      ballScreen.updateDisplay(running, `${drill}|${sz}|${tm}`, [drill.slice(0, 10), sz, running ? 'TRAINING' : 'READY', tm]);
      ballScreenMat.emissiveIntensity = 0.15 + a * 0.82;

      const use65 = sz === '65cm';
      const bounce = running && onBed > 0.05 ? Math.abs(Math.sin(input.timeSec * 2.2)) * 0.035 : 0;
      const pullFwd = onBed > 0.05 && running ? 0.34 : 0;
      ball1.position.set(0, use65 ? 0.24 + bounce : 0.34, use65 ? 0.02 + pullFwd : 0.02);
      ball2.position.set(0, !use65 && running && onBed > 0.05 ? 0.21 + bounce : 0.94, !use65 ? 0.02 + pullFwd : 0.02);
      ball1Mat.emissiveIntensity = use65 && running ? 0.24 : 0;
      ball2Mat.emissiveIntensity = !use65 && running ? 0.24 : 0;
    };
  } else if (sprite === 'balance_trainer') {
    colliderHalfW = 0.26;
    colliderHalfD = 0.24;

    const plate = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.48, 0.048, 0.44)), bodyWhiteMat);
    plate.position.y = 0.024;
    const forcePad = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.18, 0.19, 0.016, 22)), darkRubberMat);
    forcePad.position.set(0, 0.054, 0.02);
    const ledRingMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 0.35 })
    );
    const ledRing = new THREE.Mesh(trackGeom(new THREE.TorusGeometry(0.155, 0.008, 8, 24)), ledRingMat);
    ledRing.rotation.x = Math.PI / 2;
    ledRing.position.set(0, 0.064, 0.02);
    const railPostL = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.014, 0.014, 0.86, 10)), chromeMat);
    railPostL.position.set(-0.21, 0.46, -0.17);
    const railPostR = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.014, 0.014, 0.86, 10)), chromeMat);
    railPostR.position.set(0.21, 0.46, -0.17);
    const balGripGeom = trackGeom(new THREE.CylinderGeometry(0.019, 0.019, 0.13, 10));
    const balGripL = new THREE.Mesh(balGripGeom, darkRubberMat);
    balGripL.position.set(-0.21, 0.58, -0.17);
    const balGripR = new THREE.Mesh(balGripGeom, darkRubberMat);
    balGripR.position.set(0.21, 0.58, -0.17);
    const railTop = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.014, 0.014, 0.44, 10)), chromeMat);
    railTop.rotation.z = Math.PI / 2;
    railTop.position.set(0, 0.89, -0.17);

    const tablet = new THREE.Mesh(trackGeom(new THREE.BoxGeometry(0.24, 0.155, 0.018)), slateFrameMat);
    tablet.position.set(0, 0.93, -0.14);
    tablet.rotation.x = -0.45;
    const balScreen = createLiveDeviceScreen('BALANCE COP', '#10b981', ['LVL 2', 'FIRM EO', '92% STAB', '10:00'], 'grid');
    trackTex(balScreen.texture);
    const balScreenMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: balScreen.texture,
        emissiveMap: balScreen.texture,
        emissive: 0xffffff,
        emissiveIntensity: 0.25,
        roughness: 0.2,
      })
    );
    const tabletFace = new THREE.Mesh(trackGeom(new THREE.PlaneGeometry(0.21, 0.128)), balScreenMat);
    tabletFace.position.set(0, 0.934, -0.129);
    tabletFace.rotation.x = -0.45;

    markDeviceScreen(tablet);
    markDeviceScreen(tabletFace);

    group.add(plate, forcePad, ledRing, railPostL, railPostR, balGripL, balGripR, railTop, tablet, tabletFace);

    updateMotion = (input) => {
      const a = THREE.MathUtils.clamp(input.activeBlend, 0, 1);
      const running = Boolean(input.isRunning ?? a > 0.25);
      const p = input.deviceParams;
      const lvl = `LVL ${p?.intensity ?? 2}`;
      const mStr = p?.mode ?? 'FIRM EO';
      const tm = formatTimerMmSs(p, 10);
      balScreen.updateDisplay(running, `${lvl}|${mStr}|${tm}`, [lvl, mStr, 'COP 94%', tm]);
      balScreenMat.emissiveIntensity = 0.16 + a * 0.84;
      ledRingMat.emissiveIntensity = 0.2 + a * 0.95;
    };
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
    const bikeScreen = createLiveDeviceScreen('ERGO BIKE', '#38bdf8', ['62 RPM', 'RES L4', '85 W', '15:00'], 'bars');
    trackTex(bikeScreen.texture);
    const bikeScrMat = trackMat(new THREE.MeshStandardMaterial({ map: bikeScreen.texture, emissiveMap: bikeScreen.texture, emissive: 0xffffff, emissiveIntensity: 0.4 }));
    const bikeScrFace = new THREE.Mesh(trackGeom(new THREE.PlaneGeometry(0.22, 0.11)), bikeScrMat);
    bikeScrFace.position.set(0, 1.005, 0.258);
    bikeScrFace.rotation.x = -0.35;
    bikeScrFace.rotation.y = Math.PI;
    markDeviceScreen(consoleBox);
    markDeviceScreen(bikeScrFace);
    const barL = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 8)), darkRubberMat);
    barL.rotation.z = Math.PI / 2;
    barL.position.set(-0.18, 0.95, 0.27);
    const barR = new THREE.Mesh(trackGeom(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 8)), darkRubberMat);
    barR.rotation.z = Math.PI / 2;
    barR.position.set(0.18, 0.95, 0.27);
    group.add(base, shroud, seatPost, saddle, stemPost, consoleBox, bikeScrFace, barL, barR);

    updateMotion = (input) => {
      const p = input.deviceParams;
      const rpm = Math.round(Number(p?.rpm ?? 62));
      const res = Math.round(Number(p?.resistance ?? 4));
      const tm = formatTimerMmSs(p, 15);
      const running = Boolean(input.isRunning);
      bikeScreen.updateDisplay(running, `${rpm}|${res}|${tm}`, [`${rpm} RPM`, `RES L${res}`, `${Math.round(rpm * res * 0.35)} W`, tm]);
      bikeScrMat.emissiveIntensity = running ? 0.85 : 0.25;
    };
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
    consoleHead.rotation.x = 0.35;
    const tmScreen = createLiveDeviceScreen('GAIT TREADMILL', '#0ea5e9', ['2.8 km/h', '2.0 %', 'HR 102', '12:00'], 'wave');
    trackTex(tmScreen.texture);
    const tmScrMat = trackMat(new THREE.MeshStandardMaterial({ map: tmScreen.texture, emissiveMap: tmScreen.texture, emissive: 0xffffff, emissiveIntensity: 0.42 }));
    const tmFace = new THREE.Mesh(trackGeom(new THREE.PlaneGeometry(0.46, 0.13)), tmScrMat);
    tmFace.position.set(0, 1.075, 0.512);
    tmFace.rotation.x = -0.35;
    tmFace.rotation.y = Math.PI;
    markDeviceScreen(consoleHead);
    markDeviceScreen(tmFace);
    group.add(deckFrame, belt, motorHood, consoleHead, tmFace);

    updateMotion = (input) => {
      const p = input.deviceParams;
      const spd = Number(p?.speed ?? 2.8).toFixed(1);
      const inc = Number(p?.inclinePct ?? 2).toFixed(1);
      const tm = formatTimerMmSs(p, 12);
      const running = Boolean(input.isRunning);
      tmScreen.updateDisplay(running, `${spd}|${inc}|${tm}`, [`${spd} km/h`, `INC ${inc}%`, 'GAIT OK', tm]);
      tmScrMat.emissiveIntensity = running ? 0.88 : 0.25;
    };
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
