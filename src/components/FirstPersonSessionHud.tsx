import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Armchair,
  ArrowLeft,
  ArrowRight,
  BedDouble,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  ClipboardList,
  Coins,
  Crosshair,
  Flame,
  Hand,
  Handshake,
  Lock,
  LogOut,
  Maximize2,
  Minimize2,
  Minus,
  Move,
  Pause,
  PersonStanding,
  Play,
  Plus,
  RotateCcw,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Star,
  Stethoscope,
  Undo2,
  X,
  Zap,
} from 'lucide-react';
import { getPostureRulesForStation } from '../data/catalog';
import {
  buildCategorizedHistory,
  evaluateClinicalSubmission,
  getRecommendedPrescription,
  HISTORY_CATEGORIES,
  HistoryCategory,
  HistoryQuestionItem,
  HOME_PRECAUTION_OPTIONS,
  HomePrecautionId,
  ModalityId,
  PRESCRIPTION_MODALITIES,
} from '../data/clinicalReasoning';
import {
  formatTimerMmSs,
  getDefaultDeviceParams,
  getDefaultProbeAnchors,
  isContinuousHandheldDevice,
} from '../engine3d/fppEquipment3d';
import {
  FppActiveDeviceState,
  FppHeldDeviceInfo,
  FppNearbyDeviceInfo,
  FppPatientPosture,
  Language,
  LightingMode,
  PatientEntity,
  SpriteKind,
} from '../types/clinic';
import { PhysicalDeviceController } from './PhysicalDeviceController';
import { useViewportProfile } from '../hooks/useViewportProfile';

type SessionStep = 'subjective' | 'redflags' | 'objective' | 'diagnosis' | 'plan' | 'summary';

const OBJECTIVE_CATEGORY_EN: Record<'rom' | 'mmt' | 'special' | 'palpation', string> = {
  rom: 'ROM',
  mmt: 'MMT',
  special: 'SPECIAL TEST',
  palpation: 'PALPATION',
};

const POSTURE_LABELS: Record<FppPatientPosture, { ar: string; en: string }> = {
  standing: { ar: 'وقوف', en: 'Standing' },
  sitting: { ar: 'جلوس', en: 'Sitting' },
  supine: { ar: 'استلقاء', en: 'Supine' },
  prone: { ar: 'على البطن', en: 'Prone' },
  right_side: { ar: 'جانب أيمن', en: 'Right Side' },
  left_side: { ar: 'جانب أيسر', en: 'Left Side' },
};

interface FirstPersonSessionHudProps {
  patient: PatientEntity;
  stationSprite?: SpriteKind;
  stationNameEn?: string;
  posture: FppPatientPosture;
  onChangePosture: (posture: FppPatientPosture) => void;
  nearbyDevice?: FppNearbyDeviceInfo | null;
  heldDevice?: FppHeldDeviceInfo | null;
  activeDevice?: FppActiveDeviceState | null;
  onGrabDevice?: (catalogId: string) => void;
  onPlaceHeldDevice?: () => void;
  onReturnDevice?: (catalogId: string) => void;
  onUpdateActiveDevice?: (next: FppActiveDeviceState) => void;
  onOpenStationConsole?: (deviceId: string) => void;
  onCloseActiveDevice?: () => void;
  handshakeReady?: boolean;
  onHandshake?: () => void;
  hoverBodyZone?: { ar: string; en: string } | null;
  language: Language;
  lightingMode?: LightingMode;
  moveInputRef: React.MutableRefObject<{ x: number; y: number }>;
  onPatientSpeak: (patientId: string, durationMs?: number) => void;
  onRecenterCamera?: () => void;
  onExit: () => void;
  onCompleteCase: (result: {
    patientId: string;
    coinsEarned: number;
    starsEarned: number;
    satisfactionDelta: number;
    caughtRedFlag: boolean;
  }) => void;
}

const VirtualJoystick: React.FC<{
  isAr: boolean;
  isNight: boolean;
  moveInputRef: React.MutableRefObject<{ x: number; y: number }>;
}> = ({ isAr, isNight, moveInputRef }) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const knobRef = useRef<HTMLDivElement | null>(null);
  const activePointerId = useRef<number | null>(null);
  const [isActive, setIsActive] = useState(false);
  const visualMaxR = 46;
  const fullThrottleR = 34;
  const deadzone = 0.05;

  useEffect(() => {
    return () => {
      moveInputRef.current = { x: 0, y: 0 };
    };
  }, [moveInputRef]);

  const setKnobTransform = (x: number, y: number, active: boolean) => {
    const k = knobRef.current;
    if (!k) return;
    k.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${active ? 1.06 : 1})`;
  };

  const updateFromClient = (clientX: number, clientY: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const rawDx = clientX - cx;
    const rawDy = clientY - cy;
    const dist = Math.hypot(rawDx, rawDy);

    let visDx = rawDx;
    let visDy = rawDy;
    if (dist > visualMaxR && dist > 1e-4) {
      visDx = (rawDx / dist) * visualMaxR;
      visDy = (rawDy / dist) * visualMaxR;
    }
    setKnobTransform(visDx, visDy, true);

    const normDist = Math.min(1, dist / fullThrottleR);
    if (normDist <= deadzone || dist < 1e-4) {
      moveInputRef.current = { x: 0, y: 0 };
      return;
    }
    const linear = (normDist - deadzone) / (1 - deadzone);
    const responsiveMag = Math.pow(linear, 0.82);
    const ux = rawDx / dist;
    const uy = rawDy / dist;
    moveInputRef.current = {
      x: ux * responsiveMag,
      y: -uy * responsiveMag,
    };
  };

  const resetStick = () => {
    activePointerId.current = null;
    setIsActive(false);
    setKnobTransform(0, 0, false);
    moveInputRef.current = { x: 0, y: 0 };
  };

  return (
    <div
      className="pointer-events-auto flex flex-col items-center gap-1 select-none touch-none"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <div className="p-3 -m-3 touch-none">
        <div
          ref={trackRef}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            activePointerId.current = e.pointerId;
            setIsActive(true);
            updateFromClient(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            e.stopPropagation();
            if (activePointerId.current !== e.pointerId) return;
            updateFromClient(e.clientX, e.clientY);
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            if (activePointerId.current === e.pointerId) {
              resetStick();
            }
          }}
          onPointerCancel={(e) => {
            e.stopPropagation();
            if (activePointerId.current === e.pointerId) {
              resetStick();
            }
          }}
          className={`relative w-36 h-36 sm:w-40 sm:h-40 rounded-full border-2 touch-none flex items-center justify-center shadow-2xl transition-colors cursor-grab active:cursor-grabbing ${
            isActive
              ? isNight
                ? 'bg-slate-950/92 border-sky-400/80 ring-4 ring-sky-400/20'
                : 'bg-slate-900/85 border-sky-300/85 ring-4 ring-sky-400/25'
              : isNight
                ? 'bg-slate-950/82 border-sky-400/40'
                : 'bg-slate-900/72 border-white/30'
          }`}
        >
          <div className="absolute inset-3.5 rounded-full border border-dashed border-white/20 pointer-events-none" />
          <div className="absolute w-2 h-2 rounded-full bg-white/25 pointer-events-none" />
          <span className="absolute top-2 text-[10px] font-black text-sky-300/85 pointer-events-none">
            ▲
          </span>
          <span className="absolute bottom-2 text-[10px] font-black text-sky-300/85 pointer-events-none">
            ▼
          </span>
          <span className="absolute left-2.5 text-[10px] font-black text-sky-300/85 pointer-events-none">
            ◀
          </span>
          <span className="absolute right-2.5 text-[10px] font-black text-sky-300/85 pointer-events-none">
            ▶
          </span>
          <div
            ref={knobRef}
            style={{ transform: 'translate3d(0px, 0px, 0) scale(1)' }}
            className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-b from-sky-300 via-sky-500 to-sky-600 border-2 border-white/95 shadow-lg flex items-center justify-center pointer-events-none will-change-transform ${
              isActive ? '' : 'transition-transform duration-100 ease-out'
            }`}
          >
            <div className="w-5 h-5 rounded-full border border-white/50 bg-white/20" />
          </div>
        </div>
      </div>
      <span className="text-xs font-extrabold text-white/95 drop-shadow">
        {isAr ? 'تحرك' : 'Move'}
      </span>
    </div>
  );
};

// 2-Axis Motorized Gimbal Joystick for Infrared Lamp Gooseneck Arm
const IrAimJoystick: React.FC<{
  activeDevice: FppActiveDeviceState;
  isAr: boolean;
  onUpdate: (next: FppActiveDeviceState) => void;
}> = ({ activeDevice, isAr, onUpdate }) => {
  const padRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const vecRef = useRef<{ nx: number; ny: number }>({ nx: 0, ny: 0 });
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);
  const lastEmitTsRef = useRef<number>(0);
  const dirtyEmitRef = useRef<boolean>(false);
  const latestRef = useRef<{ dev: FppActiveDeviceState; onUpdate: (n: FppActiveDeviceState) => void }>({
    dev: activeDevice,
    onUpdate,
  });
  latestRef.current = { dev: activeDevice, onUpdate };

  const [stickPx, setStickPx] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const maxR = 24;

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, []);

  const stopLoop = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (dirtyEmitRef.current) {
      dirtyEmitRef.current = false;
      latestRef.current.onUpdate(latestRef.current.dev);
    }
    vecRef.current = { nx: 0, ny: 0 };
    setStickPx({ x: 0, y: 0 });
    setDragging(false);
    pointerIdRef.current = null;
  };

  const applyStickCurve = (v: number): number => {
    const dead = 0.08;
    const av = Math.abs(v);
    if (av <= dead) return 0;
    const norm = (av - dead) / (1 - dead);
    return Math.sign(v) * Math.pow(norm, 1.85);
  };

  const stepLoop = (ts: number) => {
    if (pointerIdRef.current === null) {
      rafRef.current = null;
      return;
    }
    const dt = lastTsRef.current ? Math.min(0.05, Math.max(0.008, (ts - lastTsRef.current) / 1000)) : 0.016;
    lastTsRef.current = ts;

    const cx = applyStickCurve(vecRef.current.nx);
    const cy = applyStickCurve(vecRef.current.ny);
    if (cx !== 0 || cy !== 0) {
      const curDev = latestRef.current.dev;
      const sign = curDev.visualRightSign ?? 1;
      const curLat = curDev.irLateralOffset ?? 0;
      const curH = curDev.irHeightOffset ?? 0;
      const nextLat = Math.max(-0.9, Math.min(0.9, Number((curLat + cx * sign * dt * 0.36).toFixed(3))));
      const nextH = Math.max(-0.32, Math.min(0.44, Number((curH - cy * dt * 0.22).toFixed(3))));

      if (Math.abs(nextLat - curLat) > 0.0004 || Math.abs(nextH - curH) > 0.0004) {
        const nextDev: FppActiveDeviceState = {
          ...curDev,
          irLateralOffset: nextLat,
          irHeightOffset: nextH,
        };
        latestRef.current.dev = nextDev;
        dirtyEmitRef.current = true;
        if (ts - lastEmitTsRef.current >= 34) {
          lastEmitTsRef.current = ts;
          dirtyEmitRef.current = false;
          latestRef.current.onUpdate(nextDev);
        }
      }
    }
    rafRef.current = requestAnimationFrame(stepLoop);
  };

  const updateStickFromPointer = (clientX: number, clientY: number) => {
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    setStickPx({ x: dx, y: dy });
    vecRef.current = { nx: dx / maxR, ny: dy / maxR };
  };

  const latPct = Math.round(((activeDevice.irLateralOffset ?? 0) * (activeDevice.visualRightSign ?? 1)) * 100);
  const hCm = Math.round((activeDevice.irHeightOffset ?? 0) * 100);

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <div
        ref={padRef}
        onPointerDown={(e) => {
          e.stopPropagation();
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // ignore
          }
          pointerIdRef.current = e.pointerId;
          setDragging(true);
          updateStickFromPointer(e.clientX, e.clientY);
          lastTsRef.current = performance.now();
          if (rafRef.current === null) {
            rafRef.current = requestAnimationFrame(stepLoop);
          }
        }}
        onPointerMove={(e) => {
          if (pointerIdRef.current !== e.pointerId) return;
          e.stopPropagation();
          updateStickFromPointer(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          if (pointerIdRef.current !== e.pointerId) return;
          e.stopPropagation();
          stopLoop();
        }}
        onPointerCancel={stopLoop}
        title={isAr ? 'اسحب العصا لتوجيه المصباح' : 'Drag joystick to steer IR lamp head'}
        className="relative w-[84px] h-[84px] rounded-full bg-[radial-gradient(circle_at_center,#10141c_35%,#1d2330_85%,#0b0e14_100%)] border-2 border-[#4e596c] shadow-[inset_0_5px_12px_rgba(0,0,0,0.85),0_2px_6px_rgba(0,0,0,0.5)] flex items-center justify-center touch-none cursor-grab active:cursor-grabbing"
      >
        {/* Gimbal Crosshair & Rubber Boot Rings */}
        <div className="absolute inset-2.5 rounded-full border border-white/10 pointer-events-none" />
        <div className="absolute inset-5 rounded-full border border-rose-400/20 pointer-events-none" />
        <div className="absolute inset-x-3 top-1/2 h-[1px] bg-white/10 pointer-events-none" />
        <div className="absolute inset-y-3 left-1/2 w-[1px] bg-white/10 pointer-events-none" />

        {/* Live Aim Pip showing where the gooseneck is currently pointed */}
        <span
          style={{
            transform: `translate3d(${Math.max(-22, Math.min(22, ((activeDevice.irLateralOffset ?? 0) * (activeDevice.visualRightSign ?? 1)) * 22))}px, ${Math.max(-22, Math.min(22, -(activeDevice.irHeightOffset ?? 0) * 44))}px, 0)`,
          }}
          className="absolute w-2 h-2 rounded-full bg-rose-400/75 shadow-[0_0_6px_#fb7185] pointer-events-none"
        />

        {/* Joystick Shaft Shadow */}
        <div
          style={{
            transform: `translate3d(${stickPx.x * 0.5}px, ${stickPx.y * 0.5}px, 0)`,
          }}
          className="w-5 h-5 rounded-full bg-black/70 pointer-events-none"
        />

        {/* Physical Red-Capped Control Stick */}
        <div
          style={{
            transform: `translate3d(${stickPx.x}px, ${stickPx.y}px, 0)`,
          }}
          className={`absolute w-9 h-9 rounded-full bg-[radial-gradient(circle_at_32%_28%,#fb7185_0%,#e11d48_52%,#881337_100%)] border-2 ${
            dragging ? 'border-white scale-105' : 'border-rose-200/80'
          } shadow-[0_5px_10px_rgba(0,0,0,0.75),inset_0_2px_3px_rgba(255,255,255,0.45)] flex items-center justify-center pointer-events-none transition-transform duration-75`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-white/40 border border-white/60" />
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-300">
        <span className="tabular-nums">
          {latPct >= 0 ? `+${latPct}` : latPct} / {hCm >= 0 ? `+${hCm}` : hCm}cm
        </span>
        <button
          type="button"
          onClick={() =>
            onUpdate({
              ...activeDevice,
              irLateralOffset: 0,
              irHeightOffset: 0,
            })
          }
          title={isAr ? 'توسيط الذراع' : 'Center Arm'}
          className="w-4 h-4 rounded bg-slate-700 hover:bg-slate-600 border border-white/15 flex items-center justify-center text-slate-200 cursor-pointer"
        >
          <RotateCcw className="w-2.5 h-2.5" />
        </button>
      </div>
    </div>
  );
};

// Mobile-friendly Linear Fader for IR-250 Lamp Deck (Intensity % & Distance cm)
const IrHardwareFader: React.FC<{
  label: string;
  valueText: string;
  value: number;
  min: number;
  max: number;
  step: number;
  accentClass?: string;
  onChange: (nextVal: number) => void;
}> = ({
  label,
  valueText,
  value,
  min,
  max,
  step,
  accentClass = 'bg-rose-500',
  onChange,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const ratio = Math.max(0, Math.min(1, (value - min) / Math.max(1e-5, max - min)));

  const commitValue = (raw: number) => {
    const snapped = Math.round((raw - min) / step) * step + min;
    const clamped = Math.max(min, Math.min(max, Number(snapped.toFixed(2))));
    if (clamped !== value) onChange(clamped);
  };

  const applyClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
    commitValue(min + t * (max - min));
  };

  return (
    <div className="w-full select-none space-y-0.5">
      <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wide px-0.5">
        <span className="text-slate-300">{label}</span>
        <span className="font-mono font-black text-rose-200 tabular-nums">{valueText}</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => commitValue(value - step)}
          aria-label={`Decrease ${label}`}
          className="w-7 h-7 rounded-md bg-[#232a36] hover:bg-[#313b4b] border border-white/15 text-xs font-black text-slate-100 flex items-center justify-center shrink-0 cursor-pointer active:scale-95"
        >
          −
        </button>

        <div
          ref={trackRef}
          onPointerDown={(e) => {
            e.stopPropagation();
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              // ignore
            }
            pointerIdRef.current = e.pointerId;
            applyClientX(e.clientX);
          }}
          onPointerMove={(e) => {
            if (pointerIdRef.current !== e.pointerId) return;
            e.stopPropagation();
            applyClientX(e.clientX);
          }}
          onPointerUp={(e) => {
            if (pointerIdRef.current !== e.pointerId) return;
            pointerIdRef.current = null;
          }}
          onPointerCancel={() => {
            pointerIdRef.current = null;
          }}
          className="relative flex-1 h-7 rounded-md bg-[#090d12] border border-[#3a4354] shadow-inner touch-none cursor-ew-resize overflow-hidden flex items-center px-1"
        >
          <div className="absolute inset-x-2 flex justify-between pointer-events-none opacity-30">
            {[0, 1, 2, 3, 4].map((idx) => (
              <span key={idx} className="w-[1px] h-2 bg-slate-300" />
            ))}
          </div>
          <div
            style={{ width: `${ratio * 100}%` }}
            className={`absolute inset-y-1 left-0 rounded-r-sm opacity-75 pointer-events-none ${accentClass}`}
          />
          <div
            style={{ left: `calc(${ratio * 100}% - 10px)` }}
            className="relative z-10 w-5 h-5 rounded bg-gradient-to-b from-white via-slate-200 to-slate-400 border border-slate-900 shadow-[0_2px_5px_rgba(0,0,0,0.75)] flex items-center justify-center gap-[2px] pointer-events-none"
          >
            <span className="w-[1px] h-2.5 bg-slate-600" />
            <span className="w-[1px] h-2.5 bg-slate-600" />
          </div>
        </div>

        <button
          type="button"
          onClick={() => commitValue(value + step)}
          aria-label={`Increase ${label}`}
          className="w-7 h-7 rounded-md bg-[#232a36] hover:bg-[#313b4b] border border-white/15 text-xs font-black text-slate-100 flex items-center justify-center shrink-0 cursor-pointer active:scale-95"
        >
          +
        </button>
      </div>
    </div>
  );
};

function getProbePromptCopy(
  sprite: SpriteKind,
  probeId: string,
  probeLabel: string,
  hoverZone: { ar: string; en: string } | null,
  isAr: boolean
): string {
  if (hoverZone) {
    const z = isAr ? hoverZone.ar : hoverZone.en;
    switch (sprite) {
      case 'tens_unit':
        return isAr
          ? `تثبيت القطب (${probeLabel}) على: ${z}`
          : `Place pad (${probeLabel}) on: ${z}`;
      case 'emg_biofeedback':
        return probeId === 'emg_ref'
          ? isAr
            ? `تثبيت القطب المرجعي (${probeLabel}) على: ${z}`
            : `Place reference (${probeLabel}) on: ${z}`
          : isAr
            ? `تثبيت مستشعر (${probeLabel}) على: ${z}`
            : `Place sensor (${probeLabel}) on: ${z}`;
      case 'ultrasound_unit':
        return isAr
          ? `وضع رأس الموجات فوق الصوتية على: ${z}`
          : `Place US transducer on: ${z}`;
      case 'laser_hilt':
        return isAr
          ? `توجيه شعاع الليزر نحو: ${z}`
          : `Aim laser wand at: ${z}`;
      case 'shockwave_eswt':
        return isAr
          ? `تثبيت رأس الصدمات على: ${z}`
          : `Position ESWT applicator on: ${z}`;
      case 'cryo_unit':
        return isAr
          ? `لف كمادة التبريد على: ${z}`
          : `Wrap Cryo-Cuff around: ${z}`;
      case 'hydro_sink':
        return isAr
          ? `وضع الكمادة الساخنة على: ${z}`
          : `Place Hot Pack on: ${z}`;
      case 'swd_unit':
        return isAr
          ? `توجيه قرص التردد الحراري فوق: ${z}`
          : `Position RF drum over: ${z}`;
      case 'pt_toolkit_cart':
        return isAr
          ? `وضع (${probeLabel}) على: ${z}`
          : `Place (${probeLabel}) on: ${z}`;
      default:
        return isAr
          ? `وضع (${probeLabel}) على: ${z}`
          : `Place (${probeLabel}) on: ${z}`;
    }
  }

  switch (sprite) {
    case 'tens_unit':
      return isAr
        ? `اختر الجزء المستهدف على جسم المريض لتثبيت القطب (${probeLabel})`
        : `Choose target muscle/joint to place electrode (${probeLabel})`;
    case 'emg_biofeedback':
      return probeId === 'emg_ref'
        ? isAr
          ? `اختر منطقة عظمية محايدة لوضع القطب المرجعي (${probeLabel})`
          : `Select neutral bony landmark for (${probeLabel})`
        : isAr
          ? `اختر العضلة المستهدفة لوضع مستشعر (${probeLabel})`
          : `Choose target muscle belly for sensor (${probeLabel})`;
    case 'ultrasound_unit':
      return isAr
        ? 'اختر المفصل أو الوتر لوضع رأس الموجات فوق الصوتية'
        : 'Choose target joint or tendon for US transducer';
    case 'laser_hilt':
      return isAr
        ? 'اختر نقطة الألم أو الوتر لتوجيه شعاع الليزر'
        : 'Select pain point or tendon to aim laser wand';
    case 'shockwave_eswt':
      return isAr
        ? 'حدد بؤرة الألم لتثبيت رأس الموجات التصادمية'
        : 'Select focal trigger point for ESWT applicator';
    case 'cryo_unit':
      return isAr
        ? 'اختر المفصل أو الطرف المتورم للف كمادة التبريد'
        : 'Choose swollen joint/limb to wrap Cryo-Cuff';
    case 'hydro_sink':
      return isAr
        ? 'اختر العضلة المتشنجة لوضع الكمادة الساخنة'
        : 'Choose tense muscle to place Hot Pack';
    case 'swd_unit':
      return isAr
        ? 'حدد المنطقة العلاجية لتوجيه قرص التردد الحراري'
        : 'Choose treatment region for RF drum';
    case 'pt_toolkit_cart':
      return isAr
        ? `اختر المفصل أو الطرف لوضع (${probeLabel})`
        : `Choose target joint/limb to place (${probeLabel})`;
    default:
      return isAr
        ? `اختر الجزء المستهدف على المريض لوضع (${probeLabel})`
        : `Choose target body part to place (${probeLabel})`;
  }
}

export const FirstPersonSessionHud: React.FC<FirstPersonSessionHudProps> = React.memo(({
  patient,
  stationSprite,
  stationNameEn,
  posture,
  onChangePosture,
  nearbyDevice = null,
  heldDevice = null,
  activeDevice = null,
  onGrabDevice,
  onPlaceHeldDevice,
  onReturnDevice,
  onUpdateActiveDevice,
  onOpenStationConsole,
  onCloseActiveDevice,
  handshakeReady = false,
  onHandshake,
  hoverBodyZone = null,
  language,
  lightingMode = 'day',
  moveInputRef,
  onPatientSpeak,
  onRecenterCamera,
  onExit,
  onCompleteCase,
}) => {
  const c = patient.clinicalCase;
  const isAr = language === 'ar';
  const isNight = lightingMode === 'night';
  const viewport = useViewportProfile();
  const showPcFppControls = viewport.isDesktopOrTablet && viewport.isKeyboardMouseActive;

  const defaultPrescription = useMemo(() => getRecommendedPrescription(c), [c]);

  const [step, setStep] = useState<SessionStep>('subjective');
  const [panelHidden, setPanelHidden] = useState(false);
  const [chartExpanded, setChartExpanded] = useState(false);
  const [postureOpen, setPostureOpen] = useState(false);
  const postureDockRef = useRef<HTMLDivElement | null>(null);

  const [historyCategory, setHistoryCategory] = useState<HistoryCategory>('hpi');
  const [openQuestionId, setOpenQuestionId] = useState<string | null>(null);
  const [askedIds, setAskedIds] = useState<string[]>([]);
  const [speechCaption, setSpeechCaption] = useState<string | null>(null);
  const [revealedTests, setRevealedTests] = useState<string[]>([]);
  const [redFlagChoice, setRedFlagChoice] = useState<'safe' | 'refer' | null>(null);
  const [selectedDiag, setSelectedDiag] = useState<string | null>(null);
  const [selectedTx, setSelectedTx] = useState<string | null>(null);

  // Custom Treatment Prescription Builder state
  const [plannedSessions, setPlannedSessions] = useState<number>(defaultPrescription.defaultSessions);
  const [frequencyPerWeek, setFrequencyPerWeek] = useState<2 | 3 | 5>(defaultPrescription.defaultFreq);
  const [selectedModalities, setSelectedModalities] = useState<ModalityId[]>(() =>
    defaultPrescription.idealModalities.length > 0 ? [defaultPrescription.idealModalities[0]] : []
  );
  const [homePrecautions, setHomePrecautions] = useState<HomePrecautionId[]>(() =>
    c.redFlagsPresent ? ['urgent_ref'] : ['hep']
  );

  const [evaluating, setEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<{
    score: number;
    coinsEarned: number;
    starsEarned: number;
    feedback: string;
    prescriptionNote: string;
    caughtRedFlag: boolean;
  } | null>(null);

  const [screenExpanded, setScreenExpanded] = useState(false);
  const [therapyStarted, setTherapyStarted] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [entryReady, setEntryReady] = useState(false);
  const entryGreetedRef = useRef(false);

  const completeActiveSession = () => {
    if (!evaluationResult) {
      onExit();
      return;
    }
    onCompleteCase({
      patientId: patient.id,
      coinsEarned: evaluationResult.coinsEarned,
      starsEarned: evaluationResult.starsEarned,
      satisfactionDelta: evaluationResult.score >= 80 ? 2 : 0,
      caughtRedFlag: evaluationResult.caughtRedFlag,
    });
  };

  // Reset prescription defaults when switching to a different patient
  useEffect(() => {
    setPlannedSessions(defaultPrescription.defaultSessions);
    setFrequencyPerWeek(defaultPrescription.defaultFreq);
    setSelectedModalities(
      defaultPrescription.idealModalities.length > 0 ? [defaultPrescription.idealModalities[0]] : []
    );
    setHomePrecautions(c.redFlagsPresent ? ['urgent_ref'] : ['hep']);
  }, [patient.id, defaultPrescription, c.redFlagsPresent]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntryReady(true));
    let hideGreetTimer: number | null = null;
    if (!entryGreetedRef.current) {
      entryGreetedRef.current = true;
      const greetAr = `أهلاً دكتور، أنا ${c.patientNameAr} — أشتكي من ${c.chiefComplaintAr}.`;
      const greetEn = `Hello doctor, I'm ${c.patientNameEn} — dealing with ${c.chiefComplaintEn}.`;
      setSpeechCaption(isAr ? greetAr : greetEn);
      onPatientSpeak(patient.id, 2600);
      hideGreetTimer = window.setTimeout(() => {
        setSpeechCaption((cur) => (cur === (isAr ? greetAr : greetEn) ? null : cur));
      }, 4200);
    }
    return () => {
      cancelAnimationFrame(raf);
      if (hideGreetTimer !== null) window.clearTimeout(hideGreetTimer);
    };
  }, [patient.id, c.patientNameAr, c.patientNameEn, c.chiefComplaintAr, c.chiefComplaintEn, isAr, onPatientSpeak]);

  // Clear floating speech bubble when the Clinical Chart is open so replies never duplicate
  useEffect(() => {
    if (!panelHidden && (openQuestionId !== null || revealedTests.length > 0)) {
      setSpeechCaption(null);
    }
  }, [panelHidden, openQuestionId, revealedTests.length]);

  const activeDeviceIdentity = activeDevice ? `${activeDevice.instanceId ?? activeDevice.catalogId}` : '';
  useEffect(() => {
    if (!activeDevice || activeDevice.placementMode !== 'bed') {
      setScreenExpanded(false);
    } else if (activeDevice.selectedProbeId) {
      setScreenExpanded(false);
    } else if (activeDevice.hasScreen && activeDevice.screenTapped) {
      setScreenExpanded(true);
    } else if (!activeDevice.hasScreen) {
      setScreenExpanded(false);
    }
  }, [
    activeDeviceIdentity,
    activeDevice?.placementMode,
    activeDevice?.screenTapped,
    activeDevice?.hasScreen,
    activeDevice?.selectedProbeId,
  ]);

  const postureRules = useMemo(
    () => getPostureRulesForStation(stationSprite),
    [stationSprite]
  );

  const activePostureRule = useMemo(
    () => postureRules.find((r) => r.id === posture) ?? postureRules[0],
    [postureRules, posture]
  );

  useEffect(() => {
    if (!postureOpen) return;
    const handleOutside = (e: PointerEvent) => {
      const target = e.target as Node;
      if (postureDockRef.current?.contains(target)) {
        return;
      }
      setPostureOpen(false);
    };
    window.addEventListener('pointerdown', handleOutside);
    return () => window.removeEventListener('pointerdown', handleOutside);
  }, [postureOpen]);

  const categorizedHistory = useMemo<HistoryQuestionItem[]>(
    () => buildCategorizedHistory(c),
    [c]
  );

  const activeHistoryQuestions = useMemo(
    () => categorizedHistory.filter((q) => q.category === historyCategory),
    [categorizedHistory, historyCategory]
  );

  const handleToggleQuestion = (item: HistoryQuestionItem) => {
    const isAlreadyOpen = openQuestionId === item.id;
    const answerText = isAr ? item.aAr : item.aEn;
    setOpenQuestionId(isAlreadyOpen ? null : item.id);
    if (!isAlreadyOpen) {
      setAskedIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
      // Only show top floating speech caption if the clinical chart is hidden; otherwise show inside chart without duplication
      setSpeechCaption(panelHidden ? answerText : null);
      onPatientSpeak(patient.id, 2400);
    }
  };

  const toggleObjectiveTest = (testId: string) => {
    const test = c.objectiveTests.find((t) => t.id === testId);
    setRevealedTests((prev) => (prev.includes(testId) ? prev : [...prev, testId]));
    // Only show top floating speech caption if the clinical chart is hidden; otherwise show exclusively in the test card
    if (test && panelHidden) {
      setSpeechCaption(`${test.nameEn}: ${isAr ? test.findingAr : test.findingEn}`);
    } else {
      setSpeechCaption(null);
    }
    onPatientSpeak(patient.id, 1500);
  };

  const toggleModality = (modId: ModalityId) => {
    setSelectedModalities((prev) =>
      prev.includes(modId) ? prev.filter((id) => id !== modId) : [...prev, modId]
    );
  };

  const togglePrecaution = (precId: HomePrecautionId) => {
    setHomePrecautions((prev) =>
      prev.includes(precId) ? prev.filter((id) => id !== precId) : [...prev, precId]
    );
  };

  const handleSelectRedFlag = (choice: 'safe' | 'refer') => {
    setRedFlagChoice(choice);
    if (choice === 'refer') {
      setPlannedSessions(0);
      setSelectedModalities([]);
      setHomePrecautions(['urgent_ref']);
    } else if (plannedSessions === 0) {
      setPlannedSessions(defaultPrescription.defaultSessions || 6);
      setSelectedModalities(
        defaultPrescription.idealModalities.length > 0
          ? defaultPrescription.idealModalities.slice(0, 2)
          : ['exercise']
      );
      setHomePrecautions(['hep', 'ergonomics']);
    }
  };

  const handleSubmitPlan = async () => {
    if (!selectedDiag || !selectedTx || evaluating) return;
    setEvaluating(true);

    const diagObj = c.diagnosisOptions.find((d) => d.id === selectedDiag);
    const txObj = c.treatmentOptions.find((t) => t.id === selectedTx);
    const correctRedFlag =
      (c.redFlagsPresent && redFlagChoice === 'refer') ||
      (!c.redFlagsPresent && redFlagChoice === 'safe');
    const correctDiag = Boolean(diagObj?.isCorrect);
    const correctTx = Boolean(txObj?.isRecommended);

    const rubric = evaluateClinicalSubmission({
      clinicalCase: c,
      askedCount: askedIds.length,
      testedCount: revealedTests.length,
      redFlagChoice,
      diagCorrect: correctDiag,
      txCorrect: correctTx,
      plannedSessions,
      frequencyPerWeek,
      selectedModalities,
      language,
    });

    const modalityNames = selectedModalities.map(
      (id) => PRESCRIPTION_MODALITIES.find((m) => m.id === id)?.nameEn ?? id
    );
    const precautionNames = homePrecautions.map(
      (id) => HOME_PRECAUTION_OPTIONS.find((p) => p.id === id)?.nameEn ?? id
    );

    let feedbackText = isAr ? c.clinicalPearlAr : c.clinicalPearlEn;

    try {
      const res = await fetch('/api/clinical/evaluate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicalCase: c,
          redFlagCorrect: correctRedFlag,
          selectedDiagnosis: diagObj?.labelEn ?? (isAr ? diagObj?.labelAr : diagObj?.labelEn),
          diagnosisCorrect: correctDiag,
          selectedTreatment: isAr ? txObj?.labelAr : txObj?.labelEn,
          treatmentCorrect: correctTx,
          plannedSessions,
          frequencyPerWeek,
          selectedModalities: modalityNames,
          homePrecautions: precautionNames,
          studentNote: '',
          language,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.feedback) feedbackText = data.feedback;
      }
    } catch {
      // Offline rubric feedback already populated
    } finally {
      setEvaluating(false);
      setSpeechCaption(null);
      setEvaluationResult({
        score: rubric.score,
        coinsEarned: rubric.coinsEarned,
        starsEarned: rubric.starsEarned,
        feedback: feedbackText,
        prescriptionNote: rubric.prescriptionNote,
        caughtRedFlag: rubric.caughtRedFlag,
      });
      setStep('summary');
      onPatientSpeak(patient.id, 2200);
    }
  };

  const stepDefs = useMemo<
    Array<{
      id: SessionStep;
      num: number;
      tabAr: string;
      tabEn: string;
      labelAr: string;
      labelEn: string;
      done: boolean;
      badge?: string;
      disabled?: boolean;
    }>
  >(
    () => [
      {
        id: 'subjective',
        num: 1,
        tabAr: 'التاريخ',
        tabEn: 'History',
        labelAr: 'التاريخ المرضي (History)',
        labelEn: 'History (Hx)',
        done: askedIds.length >= 4,
        badge: `${askedIds.length}/${categorizedHistory.length}`,
      },
      {
        id: 'redflags',
        num: 2,
        tabAr: 'Red Flags',
        tabEn: 'Red Flags',
        labelAr: 'Red Flags · التحذيرات',
        labelEn: 'Red Flags Screening',
        done: redFlagChoice !== null,
      },
      {
        id: 'objective',
        num: 3,
        tabAr: 'Exam',
        tabEn: 'Exam',
        labelAr: 'الفحص السريري (Exam)',
        labelEn: 'Clinical Exam',
        done: revealedTests.length > 0 && revealedTests.length === c.objectiveTests.length,
        badge: `${revealedTests.length}/${c.objectiveTests.length}`,
      },
      {
        id: 'diagnosis',
        num: 4,
        tabAr: 'Diagnosis',
        tabEn: 'Diagnosis',
        labelAr: 'التشخيص (Diagnosis)',
        labelEn: 'Clinical Diagnosis',
        done: Boolean(selectedDiag),
      },
      {
        id: 'plan',
        num: 5,
        tabAr: 'الخطة',
        tabEn: 'Plan',
        labelAr: 'الخطة العلاجية (Plan)',
        labelEn: 'Treatment Plan',
        done: Boolean(evaluationResult),
      },
      {
        id: 'summary',
        num: 6,
        tabAr: 'الخلاصة',
        tabEn: 'Summary',
        labelAr: 'الخلاصة والتقييم',
        labelEn: 'Session Summary',
        done: Boolean(evaluationResult),
        disabled: !evaluationResult,
      },
    ],
    [
      askedIds.length,
      categorizedHistory.length,
      redFlagChoice,
      revealedTests.length,
      c.objectiveTests.length,
      selectedDiag,
      evaluationResult,
    ]
  );

  const surfaceCls = isNight
    ? 'bg-slate-950/95 border-slate-700/85 text-slate-100'
    : 'bg-white/97 border-slate-200/95 text-slate-900';

  const currentStepMeta = stepDefs.find((s) => s.id === step) ?? stepDefs[0];
  const activePostureLabelEn = activePostureRule?.labelEn ?? POSTURE_LABELS[posture].en;

  // PC Keyboard Shortcuts inside First-Person Examination & Therapy Bay
  useEffect(() => {
    const stepOrder: SessionStep[] = [
      'subjective',
      'redflags',
      'objective',
      'diagnosis',
      'plan',
      'summary',
    ];
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === 'Escape') {
        if (exitConfirmOpen) {
          setExitConfirmOpen(false);
          return;
        }
        if (postureOpen) {
          setPostureOpen(false);
          return;
        }
        if (screenExpanded && activeDevice) {
          setScreenExpanded(false);
          onUpdateActiveDevice?.({ ...activeDevice, screenTapped: false });
          return;
        }
        if (activeDevice) {
          onCloseActiveDevice?.();
          return;
        }
        return;
      }

      if (e.repeat || exitConfirmOpen) return;
      const k = e.key.toLowerCase();

      if (k === 'h' && !activeDevice) {
        e.preventDefault();
        setPanelHidden((v) => !v);
        setSpeechCaption(null);
      } else if (k === 'c' && onRecenterCamera) {
        e.preventDefault();
        onRecenterCamera();
      } else if (k === 'p' && !screenExpanded && !activeDevice?.selectedProbeId) {
        e.preventDefault();
        setPostureOpen((v) => !v);
      } else if (
        !activeDevice &&
        e.key >= '1' &&
        e.key <= '6'
      ) {
        const idx = Number(e.key) - 1;
        const targetId = stepOrder[idx];
        const targetDef = stepDefs.find((s) => s.id === targetId);
        if (targetId && targetDef && !targetDef.disabled) {
          e.preventDefault();
          setStep(targetId);
          setPanelHidden(false);
          setSpeechCaption(null);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    exitConfirmOpen,
    postureOpen,
    screenExpanded,
    activeDevice,
    stepDefs,
    onRecenterCamera,
    onUpdateActiveDevice,
    onCloseActiveDevice,
  ]);

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-30 flex flex-col justify-between p-2 sm:p-3 transition-all duration-300 ease-out ${
        entryReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1.5'
      }`}
    >
      {/* Top Patient Header Bar */}
      <div className="flex flex-col gap-1.5">
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto flex items-center justify-between gap-2 rounded-2xl bg-slate-950/95 border border-white/15 px-3 py-1.5 text-white shadow-lg"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-400/30 flex items-center justify-center shrink-0">
              <Stethoscope className="w-4 h-4 text-sky-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap text-xs sm:text-[13px]">
                <span className="font-black truncate max-w-[11rem] sm:max-w-none">
                  {isAr ? c.patientNameAr : c.patientNameEn}
                </span>
                <span className="text-slate-500" aria-hidden="true">·</span>
                <span className="text-sky-300 font-bold tabular-nums shrink-0">
                  {c.age} {isAr ? 'سنة' : 'y'}
                </span>
                <span className="hidden sm:inline text-slate-500" aria-hidden="true">·</span>
                <span className="hidden sm:inline text-slate-300 text-[11px] font-medium truncate">
                  {isAr ? c.occupationAr : c.occupationEn}
                </span>
              </div>
              <div className="hidden md:block text-[10.5px] text-slate-300/85 truncate max-w-[26rem]">
                {isAr ? c.chiefComplaintAr : c.chiefComplaintEn}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <div
              dir="ltr"
              className="hidden lg:flex items-center gap-1.5 text-[11px] font-mono tabular-nums text-slate-300 pe-1"
            >
              <span>BP {c.vitals?.bp ?? '120/78'}</span>
              <span className="text-slate-600">·</span>
              <span>HR {c.vitals?.hr ?? 74}</span>
              <span className="text-slate-600">·</span>
              <span className="text-rose-400 font-bold">VAS {c.vasPain}/10</span>
            </div>

            {onRecenterCamera && (
              <button
                type="button"
                onClick={onRecenterCamera}
                aria-label={isAr ? 'توجيه الكاميرا نحو المريض' : 'Center on Patient'}
                title={isAr ? 'التركيز على المريض' : 'Center on Patient'}
                className="h-8 px-2.5 rounded-xl bg-slate-800/90 hover:bg-sky-600 border border-white/10 text-slate-200 hover:text-white flex items-center gap-1 text-[11px] font-bold transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden md:inline">{isAr ? 'التركيز' : 'Center'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setPanelHidden((v) => !v);
                setSpeechCaption(null);
              }}
              aria-label={panelHidden ? (isAr ? 'إظهار الملف السريري' : 'Show Chart') : isAr ? 'المشي والحركة 3D' : '3D Move'}
              title={panelHidden ? (isAr ? 'إظهار الملف السريري' : 'Show Chart') : isAr ? 'إخفاء للتحرك بحرية' : 'Hide Chart to Walk'}
              className={`h-8 px-2.5 sm:px-3 rounded-xl border flex items-center gap-1.5 text-[11px] font-black transition-colors cursor-pointer ${
                panelHidden
                  ? 'bg-sky-500 hover:bg-sky-400 border-sky-300 text-slate-950 shadow-md'
                  : 'bg-slate-800/90 hover:bg-slate-700 border-white/10 text-slate-200'
              }`}
            >
              {panelHidden ? <ClipboardList className="w-3.5 h-3.5 shrink-0" /> : <Move className="w-3.5 h-3.5 shrink-0" />}
              <span>
                {panelHidden
                  ? isAr
                    ? `الملف السريري · ${currentStepMeta.num}/6`
                    : `Chart · ${currentStepMeta.num}/6`
                  : isAr
                    ? 'تحرك 3D'
                    : 'Walk'}
              </span>
            </button>

            {therapyStarted && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-400/35 text-emerald-300 text-[10.5px] font-black whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {isAr ? 'جلسة نشطة' : 'Therapy Active'}
              </span>
            )}

            <button
              type="button"
              onClick={() => {
                if (therapyStarted) {
                  setExitConfirmOpen(true);
                } else {
                  onExit();
                }
              }}
              aria-label={isAr ? 'خروج من الجلسة' : 'Exit Session'}
              title={therapyStarted ? (isAr ? 'إنهاء أو خروج' : 'Finish or Exit') : isAr ? 'خروج' : 'Exit'}
              className="w-8 h-8 rounded-xl bg-slate-800/90 hover:bg-rose-600 border border-white/15 text-slate-200 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Smart Floating Patient Speech Reply — positioned in the clear 3D area without colliding with the chart */}
        {!activeDevice && !heldDevice && !nearbyDevice && speechCaption && (panelHidden || (!openQuestionId && revealedTests.length === 0)) && (
          <div dir="ltr" className="w-full flex justify-end">
            <div
              dir={isAr ? 'rtl' : 'ltr'}
              onPointerDown={(e) => e.stopPropagation()}
              className="pointer-events-auto max-w-[18.5rem] sm:max-w-xs rounded-2xl bg-slate-950/95 border border-sky-400/35 text-white px-3 py-2 shadow-xl flex items-start justify-between gap-2"
            >
              <div className="min-w-0 text-xs leading-relaxed">
                <div className="text-[10px] font-extrabold text-sky-300 mb-0.5">
                  {isAr ? c.patientNameAr : c.patientNameEn}
                </div>
                <p className="text-slate-100 font-semibold">{speechCaption}</p>
              </div>
              <button
                type="button"
                onClick={() => setSpeechCaption(null)}
                aria-label={isAr ? 'إغلاق' : 'Close'}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 shrink-0 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Compact Top-Left Patient Posture Switcher — closed by default, never blocks face or chart */}
      {!screenExpanded && !activeDevice?.selectedProbeId && (
        <div
          ref={postureDockRef}
          dir="ltr"
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto fixed left-2.5 sm:left-4 top-[3.75rem] sm:top-[4.15rem] z-35 flex flex-col items-start gap-1.5"
        >
          <button
            type="button"
            onClick={() => setPostureOpen((v) => !v)}
            aria-expanded={postureOpen}
            className={`h-8 px-2.5 rounded-xl border shadow-lg flex items-center gap-1.5 text-[11px] font-extrabold transition-colors cursor-pointer ${
              postureOpen
                ? 'bg-sky-500 border-sky-300 text-slate-950'
                : 'bg-slate-950/90 hover:bg-slate-900 border-white/15 text-slate-100'
            }`}
          >
            <PersonStanding className="w-3.5 h-3.5 shrink-0" />
            <span dir="ltr" className="whitespace-nowrap">
              {isAr ? `الوضعية: ${activePostureLabelEn}` : `Posture: ${activePostureLabelEn}`}
            </span>
            {postureOpen ? (
              <ChevronUp className="w-3.5 h-3.5 shrink-0 opacity-80" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-80" />
            )}
          </button>

          {postureOpen && (
            <div
              dir="ltr"
              className="w-[15.5rem] rounded-2xl bg-slate-950/96 border border-white/15 p-2 shadow-2xl text-white space-y-1.5"
            >
              {stationNameEn && (
                <div className="px-1 pb-1 border-b border-white/10 text-[10px] font-bold text-sky-400 truncate">
                  {stationNameEn}
                </div>
              )}
              <div className="grid grid-cols-2 gap-1.5">
                {postureRules.map((rule) => {
                  const isActive = rule.id === posture;
                  const IconCmp =
                    rule.id === 'standing'
                      ? PersonStanding
                      : rule.id === 'sitting'
                        ? Armchair
                        : BedDouble;
                  return (
                    <button
                      key={rule.id}
                      type="button"
                      disabled={!rule.available}
                      onClick={() => {
                        if (!rule.available) return;
                        onChangePosture(rule.id);
                        setPostureOpen(false);
                      }}
                      title={!rule.available ? rule.reason : rule.labelEn}
                      className={`rounded-xl border px-2 py-2 text-left transition-colors flex items-center justify-between gap-1 text-[11px] font-extrabold ${
                        !rule.available
                          ? 'bg-slate-950/50 border-white/5 text-slate-500 opacity-50 cursor-not-allowed'
                          : isActive
                            ? 'bg-sky-500 border-sky-300 text-slate-950 shadow-sm cursor-pointer'
                            : 'bg-slate-900/90 hover:bg-slate-800 border-white/10 text-slate-100 cursor-pointer'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 min-w-0">
                        <IconCmp className="w-3.5 h-3.5 shrink-0" />
                        <span className="leading-tight truncate">{rule.labelEn}</span>
                      </span>
                      {!rule.available ? (
                        <Lock className="w-3 h-3 shrink-0 text-slate-500" />
                      ) : isActive ? (
                        <Check className="w-3 h-3 shrink-0" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Direct 3D Electrode / Probe Placement Guide Bar — only for bedside-deployed devices */}
      {!heldDevice &&
        activeDevice &&
        activeDevice.placementMode === 'bed' &&
        !screenExpanded &&
        activeDevice.selectedProbeId && (() => {
          const probes =
            activeDevice.probeAnchors && activeDevice.probeAnchors.length > 0
              ? activeDevice.probeAnchors
              : getDefaultProbeAnchors(activeDevice.sprite);
          const curProbe = probes.find((p) => p.id === activeDevice.selectedProbeId);
          const multiProbe = probes.length > 1;
          return (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="pointer-events-auto fixed left-1/2 -translate-x-1/2 bottom-2.5 sm:bottom-4 z-50 max-w-[95%] rounded-2xl bg-slate-950/94 border-2 border-emerald-400/75 px-3 py-1.5 text-white shadow-2xl flex flex-wrap items-center justify-center gap-2"
            >
              <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-black text-emerald-300">
                <Crosshair className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {getProbePromptCopy(
                    activeDevice.sprite,
                    activeDevice.selectedProbeId,
                    curProbe?.label ?? (isAr ? 'القطب' : 'Pad'),
                    hoverBodyZone,
                    isAr
                  )}
                </span>
              </div>

              {multiProbe && (
                <div dir="ltr" className="flex items-center gap-1">
                  {probes.map((p) => {
                    const isSel = activeDevice.selectedProbeId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() =>
                          onUpdateActiveDevice?.({
                            ...activeDevice,
                            screenTapped: false,
                            selectedProbeId: p.id,
                          })
                        }
                        className={`h-6 px-2 rounded-md text-[10px] font-black border cursor-pointer ${
                          isSel
                            ? 'bg-emerald-400 border-emerald-200 text-slate-950'
                            : p.placed
                              ? 'bg-sky-600/80 border-sky-400 text-white'
                              : 'bg-slate-800 border-white/15 text-slate-300'
                        }`}
                      >
                        {p.placed ? `✓ ${p.label}` : p.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {activeDevice.hasScreen ? (
                <button
                  type="button"
                  onClick={() => {
                    onUpdateActiveDevice?.({
                      ...activeDevice,
                      selectedProbeId: null,
                      screenTapped: true,
                    });
                    setScreenExpanded(true);
                  }}
                  className="h-6 px-2.5 rounded-md bg-sky-500 hover:bg-sky-400 text-slate-950 text-[10px] font-black cursor-pointer"
                >
                  {isAr ? 'الجهاز' : 'Machine'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    onUpdateActiveDevice?.({
                      ...activeDevice,
                      selectedProbeId: null,
                    })
                  }
                  className="h-6 px-2.5 rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-black cursor-pointer"
                >
                  {isAr ? 'تم ✓' : 'Done ✓'}
                </button>
              )}
            </div>
          );
        })()}

      {/* Direct Single "Use", Station Console, & Close-Proximity "Handshake" Buttons */}
      {!heldDevice && !activeDevice && ((nearbyDevice && (nearbyDevice.canDeploy || nearbyDevice.isStationConsole)) || (handshakeReady && onHandshake)) && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className={`therason-tip-enter pointer-events-auto fixed z-40 flex flex-wrap items-center gap-2 ${
            panelHidden
              ? 'left-1/2 -translate-x-1/2 bottom-6 sm:bottom-8'
              : 'right-2.5 top-[3.75rem] sm:right-auto sm:top-auto sm:left-5 sm:bottom-48'
          }`}
        >
          {handshakeReady && onHandshake && (
            <button
              type="button"
              onClick={onHandshake}
              className="h-9 px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 border border-emerald-300 text-slate-950 shadow-2xl flex items-center gap-1.5 text-xs font-black transition-colors cursor-pointer"
            >
              <Handshake className="w-4 h-4 shrink-0" />
              <span>{isAr ? 'مصافحة' : 'Handshake'}</span>
              {showPcFppControls && (
                <kbd className="px-1.5 py-0.5 rounded bg-black/15 text-[10px] font-mono">E</kbd>
              )}
            </button>
          )}
          {nearbyDevice && nearbyDevice.canDeploy && (
            <button
              type="button"
              onClick={() => onGrabDevice?.(nearbyDevice.instanceId || nearbyDevice.catalogId)}
              className="h-10 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 border border-sky-300 text-slate-950 shadow-2xl flex items-center gap-2 text-xs font-black transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current shrink-0" />
              <span>{isAr ? 'استخدام' : 'Use'}</span>
              <span dir="ltr" className="text-[11px] font-bold opacity-85 whitespace-nowrap">
                {nearbyDevice.nameEn}
              </span>
              {showPcFppControls && (
                <kbd className="px-1.5 py-0.5 rounded bg-black/15 text-[10px] font-mono">E</kbd>
              )}
            </button>
          )}
          {nearbyDevice && nearbyDevice.isStationConsole && (
            <button
              type="button"
              onClick={() => onOpenStationConsole?.(nearbyDevice.instanceId || nearbyDevice.catalogId)}
              className="h-10 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 border border-cyan-300 text-slate-950 shadow-2xl flex items-center gap-2 text-xs font-black transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
              <span>{isAr ? 'لوحة التحكم' : 'Control Panel'}</span>
              <span dir="ltr" className="text-[11px] font-bold opacity-85 whitespace-nowrap">
                {nearbyDevice.nameEn}
              </span>
              {showPcFppControls && (
                <kbd className="px-1.5 py-0.5 rounded bg-black/15 text-[10px] font-mono">E</kbd>
              )}
            </button>
          )}
        </div>
      )}

      {heldDevice && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className={`therason-tip-enter pointer-events-auto fixed left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-1.5 ${
            panelHidden ? 'bottom-6 sm:bottom-8' : 'top-[3.75rem] sm:top-auto sm:bottom-8'
          }`}
        >
          <div className="px-3 py-1 rounded-xl bg-slate-950/90 border border-white/15 text-[11px] font-bold text-slate-200 shadow-lg flex items-center gap-1.5 whitespace-nowrap">
            <span dir="ltr" className="text-sky-300 font-black">
              {heldDevice.nameEn}
            </span>
            <span className="text-slate-500">·</span>
            {heldDevice.nearBedPostureBlocked ? (
              <span className="text-amber-300">
                {isAr ? 'السرير لا يدعم وضعية الجهاز' : 'Bed posture unsupported'}
              </span>
            ) : heldDevice.nearBed ? (
              <span className="text-emerald-300">
                {isAr ? 'بجانب المريض · اضغط وضع' : 'Beside patient · Tap Place'}
              </span>
            ) : (
              <span className="text-slate-300">
                {isAr ? 'تحرك للمكان المطلوب ثم اضغط وضع' : 'Walk to target & tap Place'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPlaceHeldDevice?.()}
              className={`h-10 px-5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-2xl border transition-colors cursor-pointer ${
                heldDevice.nearBed
                  ? 'bg-emerald-500 hover:bg-emerald-400 border-emerald-300 text-slate-950'
                  : 'bg-sky-500 hover:bg-sky-400 border-sky-300 text-slate-950'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                {heldDevice.nearBed
                  ? isAr
                    ? 'وضع عند المريض'
                    : 'Place at Patient'
                  : isAr
                    ? 'وضع'
                    : 'Place'}
              </span>
              {showPcFppControls && (
                <kbd className="px-1.5 py-0.5 rounded bg-black/15 text-[10px] font-mono">E</kbd>
              )}
            </button>

            <button
              type="button"
              onClick={() => onReturnDevice?.(heldDevice.instanceId || heldDevice.catalogId)}
              title={isAr ? 'إرجاع لمكانه' : 'Return to standby'}
              className="h-10 px-3 rounded-xl bg-slate-900/95 hover:bg-rose-600 border border-white/15 text-white text-xs font-bold flex items-center gap-1 shadow-xl transition-colors cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5 shrink-0" />
              <span>{isAr ? 'إرجاع' : 'Return'}</span>
            </button>
          </div>
        </div>
      )}

      {!heldDevice && activeDevice && activeDevice.placementMode === 'bed' && activeDevice.hasScreen && screenExpanded && (
        <PhysicalDeviceController
          device={activeDevice}
          language={language}
          onUpdate={(next) => onUpdateActiveDevice?.(next)}
          onSelectProbeToPlace={(probeId) => {
            setScreenExpanded(false);
            onUpdateActiveDevice?.({
              ...activeDevice,
              screenTapped: false,
              selectedProbeId: probeId,
            });
          }}
          onPickUp={() => {
            setScreenExpanded(false);
            onGrabDevice?.(activeDevice.instanceId || activeDevice.catalogId);
          }}
          onReturn={() => {
            setScreenExpanded(false);
            onReturnDevice?.(activeDevice.instanceId || activeDevice.catalogId);
          }}
          onClose={() => {
            setScreenExpanded(false);
            onUpdateActiveDevice?.({
              ...activeDevice,
              screenTapped: false,
            });
          }}
        />
      )}

      {!heldDevice && activeDevice && activeDevice.placementMode === 'bed' && activeDevice.sprite === 'infrared_lamp' && !activeDevice.selectedProbeId && (
        <div
          dir="ltr"
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto fixed left-1/2 -translate-x-1/2 bottom-2.5 sm:bottom-4 z-40 w-[min(95vw,25.5rem)] rounded-[18px] bg-gradient-to-b from-[#2f3642] via-[#202630] to-[#141820] border-2 border-[#545f72] shadow-[0_14px_34px_rgba(0,0,0,0.68),inset_0_1px_0_rgba(255,255,255,0.18)] p-2 text-white space-y-1.5"
        >
          {/* Steel Column Chassis Top Plate */}
          <div className="flex items-center justify-between gap-1.5 pb-1.5 border-b border-white/10">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className={`w-2.5 h-2.5 rounded-full border border-black/60 shrink-0 ${
                  activeDevice.isRunning
                    ? 'bg-rose-500 shadow-[0_0_10px_#f43f5e]'
                    : 'bg-slate-600'
                }`}
              />
              <Flame className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="text-[11px] font-black tracking-wide text-slate-100 truncate">
                {isAr ? 'IR-250' : 'IR-250'}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* Hardware 7-Segment Timer Readout */}
              <div className="inline-flex items-center gap-1 rounded-md bg-[#090d12] border border-[#3a4354] px-1.5 py-0.5 font-mono text-[11px] shadow-inner">
                <button
                  type="button"
                  onClick={() => {
                    const m = Math.max(1, (activeDevice.deviceParams?.timerMin ?? 15) - 1);
                    onUpdateActiveDevice?.({
                      ...activeDevice,
                      deviceParams: {
                        ...(activeDevice.deviceParams ?? {}),
                        timerMin: m,
                        timerRemainingSec: m * 60,
                      },
                    });
                  }}
                  className="w-4 h-4 rounded bg-[#1d2430] hover:bg-[#2c3546] flex items-center justify-center cursor-pointer"
                >
                  <Minus className="w-2.5 h-2.5" />
                </button>
                <span className="font-black text-rose-400 tabular-nums px-0.5">
                  {formatTimerMmSs(activeDevice.deviceParams, 15)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const m = Math.min(45, (activeDevice.deviceParams?.timerMin ?? 15) + 1);
                    onUpdateActiveDevice?.({
                      ...activeDevice,
                      deviceParams: {
                        ...(activeDevice.deviceParams ?? {}),
                        timerMin: m,
                        timerRemainingSec: m * 60,
                      },
                    });
                  }}
                  className="w-4 h-4 rounded bg-[#1d2430] hover:bg-[#2c3546] flex items-center justify-center cursor-pointer"
                >
                  <Plus className="w-2.5 h-2.5" />
                </button>
              </div>

              {/* Illuminated Red Power Rocker */}
              <button
                type="button"
                onClick={() =>
                  onUpdateActiveDevice?.({
                    ...activeDevice,
                    isRunning: !activeDevice.isRunning,
                  })
                }
                className={`h-7 px-2 rounded-md text-[10px] font-black border-2 flex items-center gap-1 cursor-pointer shadow ${
                  activeDevice.isRunning
                    ? 'bg-rose-600 hover:bg-rose-500 border-rose-300 text-white shadow-[0_0_10px_rgba(244,63,94,0.45)]'
                    : 'bg-[#323a48] hover:bg-[#3f495a] border-[#5b677d] text-slate-100'
                }`}
              >
                {activeDevice.isRunning ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                <span>{activeDevice.isRunning ? (isAr ? 'إيقاف' : 'OFF') : isAr ? 'تشغيل' : 'ON'}</span>
              </button>

              <button
                type="button"
                onClick={() => onGrabDevice?.(activeDevice.instanceId || activeDevice.catalogId)}
                title={isAr ? 'نقل الجهاز' : 'Move'}
                className="h-7 w-7 rounded-md bg-[#252c38] hover:bg-sky-500 hover:text-slate-950 border border-white/15 flex items-center justify-center cursor-pointer"
              >
                <Hand className="w-3 h-3" />
              </button>

              <button
                type="button"
                onClick={() => onReturnDevice?.(activeDevice.instanceId || activeDevice.catalogId)}
                title={isAr ? 'إرجاع لمكانه' : 'Return'}
                className="h-7 w-7 rounded-md bg-rose-700 hover:bg-rose-600 border border-rose-400/50 text-white flex items-center justify-center cursor-pointer"
              >
                <Undo2 className="w-3 h-3" />
              </button>

              <button
                type="button"
                onClick={() => onCloseActiveDevice?.()}
                aria-label={isAr ? 'إغلاق' : 'Close'}
                className="h-7 w-7 rounded-md bg-[#2a313d] hover:bg-[#384152] border border-white/15 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Control Box Deck: Motorized Gimbal Joystick + Intensity & Distance Faders */}
          {(() => {
            const distCm = Math.round((activeDevice.irDistance ?? 0.52) * 100);
            const irPct = Math.round((activeDevice.irIntensity ?? 0.85) * 100);
            const zoneBadge =
              distCm < 42
                ? isAr
                  ? '⚠ قريب جداً (حرارة عالية)'
                  : '⚠ TOO CLOSE (<42cm)'
                : distCm <= 60
                  ? isAr
                    ? '● مسافة علاجية آمنة'
                    : '● OPTIMAL 45–60 cm'
                  : isAr
                    ? '○ بعيد (جرعة خفيفة)'
                    : '○ FAR (>60cm)';
            const zoneColor =
              distCm < 42 ? 'text-amber-400' : distCm <= 60 ? 'text-emerald-400' : 'text-sky-300';
            return (
              <>
                <div className="rounded-xl bg-[#161a22] border border-[#3a4354] px-2.5 py-1.5 flex items-center justify-between gap-2.5 shadow-inner">
                  <div className="flex flex-col items-center gap-0.5 shrink-0">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-300">
                      {isAr ? 'التوجيه' : 'AIM'}
                    </span>
                    <IrAimJoystick
                      activeDevice={activeDevice}
                      isAr={isAr}
                      onUpdate={(next) => onUpdateActiveDevice?.(next)}
                    />
                  </div>

                  <div className="h-16 w-[1px] bg-white/10 shrink-0" />

                  <div className="flex flex-col justify-center gap-1.5 flex-1 min-w-0">
                    <IrHardwareFader
                      label={isAr ? 'الشدة' : 'INTENSITY'}
                      valueText={`${irPct}%`}
                      value={irPct}
                      min={15}
                      max={100}
                      step={5}
                      accentClass="bg-rose-500"
                      onChange={(valPct) =>
                        onUpdateActiveDevice?.({
                          ...activeDevice,
                          irIntensity: Number((valPct / 100).toFixed(2)),
                        })
                      }
                    />

                    <IrHardwareFader
                      label={isAr ? 'المسافة' : 'DISTANCE'}
                      valueText={`${distCm} cm`}
                      value={distCm}
                      min={36}
                      max={102}
                      step={4}
                      accentClass="bg-amber-500"
                      onChange={(cm) => {
                        const nextD = Number((cm / 100).toFixed(2));
                        onUpdateActiveDevice?.({
                          ...activeDevice,
                          irDistance: nextD,
                          closeRange: nextD <= 0.6,
                        });
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 text-[9px] font-bold px-1">
                  <span className={zoneColor}>{zoneBadge}</span>
                  <span className="text-slate-400">
                    {hoverBodyZone
                      ? isAr
                        ? `توجيه الأشعة نحو: ${hoverBodyZone.ar}`
                        : `Aim beam at: ${hoverBodyZone.en}`
                      : isAr
                        ? 'حدد العضلة أو المفصل لتوجيه الأشعة'
                        : 'Select muscle/joint to aim IR beam'}
                  </span>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Room-placed device bar (too far from bed — no patient treatment options until moved closer) */}
      {!heldDevice && activeDevice && activeDevice.placementMode === 'room' && (
        <div
          dir={isAr ? 'rtl' : 'ltr'}
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto fixed left-1/2 -translate-x-1/2 bottom-2.5 sm:bottom-4 z-40 max-w-[95%] rounded-2xl bg-slate-950/94 border border-sky-400/35 px-3 py-2 text-white shadow-2xl flex flex-wrap items-center justify-center gap-2"
        >
          <div className="flex items-center gap-2 text-[11px] font-bold px-1">
            <span dir="ltr" className="font-black text-sky-300 whitespace-nowrap">
              {activeDevice.nameEn}
            </span>
            <span className="text-slate-500" aria-hidden="true">·</span>
            <span className="text-amber-300 whitespace-nowrap">
              {isAr
                ? 'بعيد عن سرير المريض — قرّبه أولاً'
                : 'Far from patient bed — move closer first'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onGrabDevice?.(activeDevice.instanceId || activeDevice.catalogId)}
              className="h-7 px-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-[10px] font-black flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Hand className="w-3 h-3 shrink-0" />
              <span>{isAr ? 'حمل وتقريب' : 'Move Closer'}</span>
            </button>

            <button
              type="button"
              onClick={() => onReturnDevice?.(activeDevice.instanceId || activeDevice.catalogId)}
              title={isAr ? 'إرجاع لمكانه' : 'Return'}
              className="h-7 px-2 rounded-lg bg-rose-600/90 hover:bg-rose-500 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
            >
              <Undo2 className="w-3 h-3 shrink-0" />
              <span>{isAr ? 'إرجاع' : 'Return'}</span>
            </button>

            <button
              type="button"
              onClick={() => onCloseActiveDevice?.()}
              aria-label={isAr ? 'إغلاق' : 'Close'}
              className="h-7 w-7 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {!heldDevice && activeDevice && activeDevice.placementMode === 'bed' && activeDevice.sprite !== 'infrared_lamp' && !activeDevice.selectedProbeId && !(activeDevice.hasScreen && screenExpanded) && (
        <div
          dir="ltr"
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto fixed left-1/2 -translate-x-1/2 bottom-2.5 sm:bottom-4 z-40 max-w-[95%] rounded-2xl bg-slate-950/94 border border-sky-400/40 px-2.5 py-1.5 text-white shadow-2xl flex flex-wrap items-center justify-center gap-1.5"
        >
          <span className="text-[11px] font-black text-sky-300 px-1 flex items-center gap-1.5 whitespace-nowrap">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                activeDevice.isRunning ? 'bg-emerald-400' : 'bg-slate-500'
              }`}
            />
            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>{activeDevice.nameEn}</span>
            {activeDevice.hasScreen && (
              <span className="font-mono text-emerald-300 text-[10px] px-1 rounded bg-slate-900 border border-white/10">
                {formatTimerMmSs(activeDevice.deviceParams, 15)}
              </span>
            )}
            {isContinuousHandheldDevice(activeDevice.sprite) &&
              activeDevice.probeAnchors?.some((p) => p.placed) && (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-400/35 px-1.5 py-0.5 text-[9px] font-black text-emerald-300">
                  <Hand className="w-2.5 h-2.5 shrink-0" />
                  <span>{isAr ? 'ممسك بالرأس' : 'Holding'}</span>
                </span>
              )}
          </span>

          {activeDevice.hasScreen && (
            <button
              type="button"
              onClick={() => {
                onUpdateActiveDevice?.({
                  ...activeDevice,
                  selectedProbeId: null,
                  screenTapped: true,
                });
                setScreenExpanded(true);
              }}
              className="h-7 px-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 border border-sky-300 text-slate-950 text-[10px] font-black flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Maximize2 className="w-3 h-3 shrink-0" />
              <span>{isAr ? 'الجهاز' : 'Machine'}</span>
            </button>
          )}

          {activeDevice.supportsProbes && (
            <button
              type="button"
              onClick={() => {
                const probes =
                  activeDevice.probeAnchors && activeDevice.probeAnchors.length > 0
                    ? activeDevice.probeAnchors
                    : getDefaultProbeAnchors(activeDevice.sprite);
                const nextId =
                  activeDevice.selectedProbeId
                    ? null
                    : probes.find((p) => !p.placed)?.id ?? probes[0]?.id ?? null;
                onUpdateActiveDevice?.({
                  ...activeDevice,
                  selectedProbeId: nextId,
                });
              }}
              className="h-7 px-2.5 rounded-lg border bg-slate-900 hover:bg-emerald-600 border-emerald-400/50 text-emerald-300 hover:text-white text-[10px] font-black flex items-center gap-1 cursor-pointer"
            >
              <Crosshair className="w-3 h-3 shrink-0" />
              <span>
                {isContinuousHandheldDevice(activeDevice.sprite)
                  ? activeDevice.probeAnchors?.some((p) => p.placed)
                    ? isAr
                      ? 'تغيير الموضع'
                      : 'Re-aim'
                    : isAr
                      ? 'الموضع'
                      : 'Aim'
                  : isAr
                    ? 'الأقطاب'
                    : 'Probes'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              onUpdateActiveDevice?.({
                ...activeDevice,
                isRunning: !activeDevice.isRunning,
              })
            }
            className={`h-7 px-2.5 rounded-lg text-[10px] font-black border flex items-center gap-1 transition-colors cursor-pointer ${
              activeDevice.isRunning
                ? 'bg-amber-500 hover:bg-amber-400 border-amber-300 text-slate-950'
                : 'bg-emerald-500 hover:bg-emerald-400 border-emerald-300 text-slate-950'
            }`}
          >
            {activeDevice.isRunning ? (
              <Pause className="w-3 h-3 fill-current shrink-0" />
            ) : (
              <Play className="w-3 h-3 fill-current shrink-0" />
            )}
            <span>
              {activeDevice.isRunning
                ? isAr
                  ? 'إيقاف'
                  : 'Stop'
                : activeDevice.sprite === 'pt_toolkit_cart'
                  ? isAr
                    ? 'قياس'
                    : 'Measure'
                  : isAr
                    ? 'تشغيل'
                    : 'Start'}
            </span>
          </button>

          {(activeDevice.sprite === 'hand_rehab_table' ||
            activeDevice.sprite === 'pt_toolkit_cart' ||
            activeDevice.sprite === 'ball_rack') && (() => {
            const tools =
              activeDevice.sprite === 'hand_rehab_table'
                ? ['PEGBOARD', 'PUTTY', 'DYNAMOMETER']
                : activeDevice.sprite === 'pt_toolkit_cart'
                  ? ['GONIOMETER', 'REFLEX', 'IASTM', 'TAPE']
                  : ['CORE STABILITY', 'PELVIC TILT', 'SCAPULAR'];
            const curTool =
              activeDevice.deviceParams?.tool ?? getDefaultDeviceParams(activeDevice.sprite).tool ?? tools[0];
            return tools.map((tl) => (
              <button
                key={tl}
                type="button"
                onClick={() =>
                  onUpdateActiveDevice?.({
                    ...activeDevice,
                    isRunning: true,
                    deviceParams: { ...(activeDevice.deviceParams ?? {}), tool: tl },
                  })
                }
                className={`h-7 px-2 rounded-lg text-[10px] font-extrabold border cursor-pointer ${
                  curTool === tl
                    ? 'bg-sky-500 border-sky-300 text-slate-950'
                    : 'bg-slate-900 hover:bg-slate-800 border-white/10 text-slate-200'
                }`}
              >
                {tl}
              </button>
            ));
          })()}

          {activeDevice.sprite !== 'magnetotherapy' && activeDevice.sprite !== 'tilt_table' && (
            <>
              <button
                type="button"
                onClick={() => onGrabDevice?.(activeDevice.instanceId || activeDevice.catalogId)}
                title={isAr ? 'نقل الجهاز' : 'Move'}
                className="h-7 w-7 rounded-lg bg-slate-800 hover:bg-sky-500 hover:text-slate-950 border border-white/15 text-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <Hand className="w-3 h-3" />
              </button>

              <button
                type="button"
                onClick={() => onReturnDevice?.(activeDevice.instanceId || activeDevice.catalogId)}
                title={isAr ? 'إرجاع لمكانه' : 'Return'}
                className="h-7 w-7 rounded-lg bg-rose-600/90 hover:bg-rose-500 text-white flex items-center justify-center cursor-pointer"
              >
                <Undo2 className="w-3 h-3" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => onCloseActiveDevice?.()}
            aria-label={isAr ? 'إغلاق' : 'Close'}
            className="h-7 w-7 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Bottom Row: Touch Joystick on Mobile/Touch Tablets OR Sleek PC Controls Bar + Spacious Clinical Chart */}
      {!activeDevice && (
        <div dir="ltr" className="relative w-full h-0">
          {/* Virtual Joystick: hidden ONLY when keyboard+mouse PC mode is active; preserved on phones & touch tablets */}
          {!showPcFppControls ? (
            <div
              className={`fixed right-4 bottom-24 sm:right-6 sm:bottom-28 z-30 transition-all ${
                panelHidden ? 'block' : 'hidden'
              }`}
            >
              <VirtualJoystick isAr={isAr} isNight={isNight} moveInputRef={moveInputRef} />
            </div>
          ) : (
            <div
              dir={isAr ? 'rtl' : 'ltr'}
              onPointerDown={(e) => e.stopPropagation()}
              className="pointer-events-auto fixed left-4 bottom-4 z-30 hidden md:flex flex-col gap-1.5 max-w-[min(42vw,28rem)] rounded-2xl bg-slate-950/94 border border-white/15 px-3.5 py-2.5 text-white shadow-2xl"
            >
              <div className="flex items-center justify-between gap-3 text-[11px] font-black text-sky-300">
                <span className="flex items-center gap-1.5">
                  <Crosshair className="w-3.5 h-3.5" />
                  {isAr ? 'تحكم الحاسوب' : 'PC First-Person Controls'}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {isAr ? 'F أو كليك يمين: الماوس' : 'F / Right-Click: Mouse Look'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10.5px] font-bold text-slate-200">
                <span className="inline-flex items-center gap-1"><kbd dir="ltr" className="font-mono text-cyan-300">WASD</kbd> {isAr ? 'مشي' : 'Walk'}</span>
                <span className="text-slate-600" aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1"><kbd dir="ltr" className="font-mono text-cyan-300">Shift</kbd> {isAr ? 'سرعة' : 'Sprint'}</span>
                <span className="text-slate-600" aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1"><kbd dir="ltr" className="font-mono text-cyan-300">E</kbd> {isAr ? 'تفاعل' : 'Interact'}</span>
                <span className="text-slate-600" aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1"><kbd dir="ltr" className="font-mono text-cyan-300">1-6</kbd> {isAr ? 'الخطوات' : 'Steps'}</span>
                <span className="text-slate-600" aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1"><kbd dir="ltr" className="font-mono text-cyan-300">H</kbd> {isAr ? 'الملف' : 'Chart'}</span>
                <span className="text-slate-600" aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1"><kbd dir="ltr" className="font-mono text-cyan-300">P</kbd> {isAr ? 'الوضعية' : 'Posture'}</span>
                <span className="text-slate-600" aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1"><kbd dir="ltr" className="font-mono text-cyan-300">C</kbd> {isAr ? 'توسيط' : 'Center'}</span>
              </div>
            </div>
          )}

          {/* Spacious, Unified Clinical Chart Tablet (replaces tiny multi-window cards) */}
          {!panelHidden && (
            <div
              dir={isAr ? 'rtl' : 'ltr'}
              onPointerDown={(e) => e.stopPropagation()}
              className={`pointer-events-auto fixed bottom-2 inset-x-2 sm:inset-x-auto sm:right-4 sm:bottom-4 z-35 rounded-2xl border shadow-2xl overflow-hidden flex flex-col transition-[max-height,width] duration-200 ${
                chartExpanded
                  ? 'sm:w-[min(calc(100vw-9.5rem),41rem)] lg:w-[min(45vw,42rem)] max-h-[80vh] sm:max-h-[86vh] lg:max-h-[calc(100vh-5.5rem)]'
                  : 'sm:w-[min(calc(100vw-9.5rem),36rem)] lg:w-[min(41vw,37rem)] max-h-[62vh] sm:max-h-[70vh] lg:max-h-[74vh]'
              } ${surfaceCls}`}
            >
              {/* Crisp Chart Header */}
              <div
                className={`px-3.5 py-2 border-b flex items-center justify-between gap-2 shrink-0 ${
                  isNight ? 'border-slate-800 bg-slate-900/95' : 'border-slate-200 bg-slate-50/95'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <ClipboardList className="w-4 h-4 text-sky-500 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs sm:text-[13px] font-black leading-tight truncate">
                      {currentStepMeta.num}/6 · {isAr ? currentStepMeta.labelAr : currentStepMeta.labelEn}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 text-[10.5px] font-bold">
                  <span dir="ltr" className="font-mono tabular-nums opacity-75 px-1">
                    VAS {c.vasPain}/10
                  </span>
                  <button
                    type="button"
                    onClick={() => setChartExpanded((v) => !v)}
                    aria-label={chartExpanded ? (isAr ? 'حجم عادي' : 'Compact') : isAr ? 'توسيع النافذة' : 'Expand'}
                    title={chartExpanded ? (isAr ? 'حجم عادي' : 'Compact size') : isAr ? 'توسيع النافذة' : 'Expand height'}
                    className={`h-7 px-2 rounded-lg border text-[10.5px] font-extrabold flex items-center gap-1 cursor-pointer ${
                      isNight
                        ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200'
                        : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    {chartExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">
                      {chartExpanded ? (isAr ? 'عادي' : 'Compact') : isAr ? 'توسيع' : 'Expand'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPanelHidden(true)}
                    aria-label={isAr ? 'إخفاء للتحرك' : 'Hide to Walk'}
                    title={isAr ? 'إخفاء النافذة والتحرك بحرية' : 'Hide panel to walk freely'}
                    className={`h-7 px-2 rounded-lg border text-[10.5px] font-extrabold flex items-center gap-1 cursor-pointer ${
                      isNight
                        ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-sky-300'
                        : 'border-slate-200 bg-white hover:bg-slate-100 text-sky-700'
                    }`}
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span className="sm:hidden">{isAr ? 'تحرك' : 'Walk'}</span>
                  </button>
                </div>
              </div>

              {/* Integrated 6-Step Wizard Tabs */}
              <div
                className={`px-2.5 py-1.5 border-b shrink-0 grid grid-cols-3 sm:grid-cols-6 gap-1 ${
                  isNight ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-slate-100/75'
                }`}
              >
                {stepDefs.map((s) => {
                  const active = step === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={s.disabled}
                      onClick={() => {
                        setStep(s.id);
                        setSpeechCaption(null);
                      }}
                      className={`px-1.5 py-1.5 rounded-lg text-[10.5px] font-extrabold border transition-all flex items-center justify-center gap-1 ${
                        active
                          ? 'bg-sky-500 border-sky-400 text-slate-950 shadow-sm'
                          : s.disabled
                            ? isNight
                              ? 'bg-slate-950/40 border-slate-800/60 text-slate-600 cursor-not-allowed'
                              : 'bg-slate-100 border-slate-200/60 text-slate-400 cursor-not-allowed'
                            : s.done
                              ? isNight
                                ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/50 cursor-pointer'
                                : 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100 cursor-pointer'
                              : isNight
                                ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 cursor-pointer'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer'
                      }`}
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded text-[9px] font-mono font-black flex items-center justify-center shrink-0 ${
                          active
                            ? 'bg-slate-950/20 text-slate-950'
                            : s.done
                              ? 'bg-emerald-500/20 text-emerald-500'
                              : 'bg-slate-500/15'
                        }`}
                      >
                        {s.done && !active ? <Check className="w-2.5 h-2.5" /> : s.num}
                      </span>
                      <span className="whitespace-nowrap leading-tight truncate">{isAr ? s.tabAr : s.tabEn}</span>
                    </button>
                  );
                })}
              </div>

              {/* Scrollable Clinical Stage Body */}
              <div className="p-3 sm:p-3.5 overflow-y-auto custom-scroll space-y-3 flex-1">
                {step === 'subjective' && (
                  <div className="space-y-2.5">
                    {/* History Type Category Segmented Selector (Light Clinical English + Arabic Cue) */}
                    <div
                      dir="ltr"
                      className={`grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 rounded-xl border ${
                        isNight ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'
                      }`}
                    >
                      {HISTORY_CATEGORIES.map((cat) => {
                        const catQs = categorizedHistory.filter((q) => q.category === cat.id);
                        const catAsked = catQs.filter((q) => askedIds.includes(q.id)).length;
                        const activeCat = historyCategory === cat.id;
                        const allAsked = catAsked === catQs.length && catQs.length > 0;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setHistoryCategory(cat.id)}
                            className={`px-2 py-1.5 rounded-lg transition-colors flex items-center justify-between gap-1.5 cursor-pointer ${
                              activeCat
                                ? 'bg-sky-500 text-slate-950 shadow-sm'
                                : isNight
                                  ? 'text-slate-200 hover:bg-slate-800'
                                  : 'text-slate-800 hover:bg-white'
                            }`}
                          >
                            <div className="min-w-0 text-left">
                              <div className="text-[11px] font-black leading-tight">{cat.shortEn}</div>
                              {isAr && (
                                <div
                                  className={`text-[9.5px] font-semibold leading-tight ${
                                    activeCat ? 'text-slate-950/75' : 'opacity-65'
                                  }`}
                                >
                                  {cat.labelAr}
                                </div>
                              )}
                            </div>
                            <span
                              className={`text-[10px] font-mono font-bold tabular-nums shrink-0 ${
                                activeCat
                                  ? 'text-slate-950/80'
                                  : allAsked
                                    ? 'text-emerald-500'
                                    : 'opacity-65'
                              }`}
                            >
                              {catAsked}/{catQs.length}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-semibold opacity-75 px-0.5">
                      <span>
                        {isAr
                          ? 'اضغط على السؤال لعرض إجابة المريض هنا:'
                          : 'Tap a question to view the patient response:'}
                      </span>
                      <span dir="ltr" className="font-mono tabular-nums">
                        {askedIds.length}/{categorizedHistory.length}
                      </span>
                    </div>

                    {activeHistoryQuestions.map((item) => {
                      const isOpen = openQuestionId === item.id;
                      const wasAsked = askedIds.includes(item.id);
                      return (
                        <div
                          key={item.id}
                          className={`rounded-xl border transition-colors overflow-hidden ${
                            isOpen
                              ? isNight
                                ? 'border-sky-500/70 bg-sky-950/40'
                                : 'border-sky-400 bg-sky-50/90'
                              : isNight
                                ? 'border-slate-800 bg-slate-900/80'
                                : 'border-slate-200 bg-slate-50/85'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleToggleQuestion(item)}
                            className="w-full px-3 py-2.5 flex items-start justify-between gap-2.5 text-start cursor-pointer"
                          >
                            <div className="min-w-0 space-y-0.5">
                              <div
                                dir="ltr"
                                className="text-[10px] font-mono font-bold uppercase tracking-wider text-sky-500"
                              >
                                {item.tagEn}
                              </div>
                              <div className="text-xs sm:text-[13px] font-extrabold leading-snug">
                                {isAr ? item.qAr : item.qEn}
                              </div>
                            </div>
                            <span className="shrink-0 text-sky-500 flex items-center gap-1 pt-0.5">
                              {wasAsked && !isOpen && (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              )}
                              {isOpen ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </span>
                          </button>
                          {isOpen && (
                            <div
                              className={`px-3 pb-3 pt-2 text-xs font-semibold leading-relaxed border-t ${
                                isNight
                                  ? 'border-sky-800/50 text-slate-100 bg-slate-950/45'
                                  : 'border-sky-200/80 text-slate-800 bg-white/80'
                              }`}
                            >
                              <div className="text-[10px] font-black text-sky-500 mb-0.5">
                                {isAr ? `رد ${c.patientNameAr}:` : `${c.patientNameEn}'s reply:`}
                              </div>
                              {isAr ? item.aAr : item.aEn}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {step === 'redflags' && (
                  <div className="space-y-2.5">
                    <div
                      className={`border rounded-xl p-3 flex items-start gap-2.5 text-xs ${
                        isNight
                          ? 'bg-amber-950/40 border-amber-800/60'
                          : 'bg-amber-50 border-amber-200'
                      }`}
                    >
                      <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <div className="space-y-1 min-w-0">
                        <div dir="ltr" className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-amber-500 text-start">
                          Red Flag Clinical Screen
                        </div>
                        <p dir="ltr" className="font-bold leading-relaxed text-[12px] text-start">
                          {c.redFlagClueEn}
                        </p>
                        {isAr && (
                          <p className="text-[11px] font-medium opacity-80 leading-relaxed">
                            {c.redFlagClueAr}
                          </p>
                        )}
                        <div
                          dir="ltr"
                          className="text-[10.5px] font-mono tabular-nums opacity-80 pt-0.5 text-start"
                        >
                          BP {c.vitals?.bp ?? '120/78'} · HR {c.vitals?.hr ?? 74} · Temp{' '}
                          {c.vitals?.temp ?? '36.7°C'}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectRedFlag('safe')}
                      className={`w-full p-3 rounded-xl border-2 text-start flex items-center gap-2.5 text-xs font-extrabold transition-colors cursor-pointer ${
                        redFlagChoice === 'safe'
                          ? 'border-emerald-500 bg-emerald-500/15'
                          : isNight
                            ? 'border-slate-800 hover:border-slate-700'
                            : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <div className="min-w-0 space-y-0.5">
                        <div className="text-[13px]">
                          {isAr ? 'Cleared for PT · آمن للعلاج الطبيعي' : 'Cleared for Physiotherapy'}
                        </div>
                        <div className="text-[11px] font-medium opacity-75 leading-snug">
                          {isAr
                            ? 'لا توجد موانع خطرة — متابعة الفحص ووضع الخطة'
                            : 'No systemic/vascular red flags — proceed to exam'}
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectRedFlag('refer')}
                      className={`w-full p-3 rounded-xl border-2 text-start flex items-center gap-2.5 text-xs font-extrabold transition-colors cursor-pointer ${
                        redFlagChoice === 'refer'
                          ? 'border-rose-500 bg-rose-500/15'
                          : isNight
                            ? 'border-slate-800 hover:border-slate-700'
                            : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                      <div className="min-w-0 space-y-0.5">
                        <div className="text-[13px]">
                          {isAr ? 'Urgent Referral (Red Flag) · تحويل طبي عاجل' : 'Red Flag — Urgent Referral'}
                        </div>
                        <div className="text-[11px] font-medium opacity-75 leading-snug">
                          {isAr
                            ? 'منع الأجهزة والتمارين وإحالة الحالة للطوارئ'
                            : 'Contraindicate PT modalities and refer urgently'}
                        </div>
                      </div>
                    </button>
                  </div>
                )}

                {step === 'objective' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold opacity-75 px-0.5">
                      <span>
                        {isAr
                          ? 'اضغط على الاختبار السريري لعرض النتيجة:'
                          : 'Tap each physical test to reveal findings:'}
                      </span>
                      <span dir="ltr" className="font-mono tabular-nums">
                        {revealedTests.length}/{c.objectiveTests.length}
                      </span>
                    </div>

                    {c.objectiveTests.map((test) => {
                      const revealed = revealedTests.includes(test.id);
                      const catLabel = OBJECTIVE_CATEGORY_EN[test.category] ?? 'TEST';
                      return (
                        <div
                          key={test.id}
                          className={`rounded-xl border overflow-hidden ${
                            isNight ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleObjectiveTest(test.id)}
                            className="w-full p-2.5 sm:p-3 flex items-start justify-between gap-2.5 text-start cursor-pointer"
                          >
                            <div className="flex items-start gap-2 min-w-0">
                              <Activity className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                              <div className="min-w-0 space-y-0.5">
                                <div
                                  dir="ltr"
                                  className="text-xs sm:text-[13px] font-black leading-snug text-start break-words"
                                >
                                  {test.nameEn}
                                </div>
                                <div
                                  dir="ltr"
                                  className="text-[10px] font-mono font-bold tracking-wider uppercase opacity-65 text-start"
                                >
                                  {catLabel}
                                </div>
                              </div>
                            </div>
                            <span
                              dir="ltr"
                              className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-md border shrink-0 ${
                                revealed
                                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-500'
                                  : 'border-sky-500/35 bg-sky-500/10 text-sky-500'
                              }`}
                            >
                              {revealed ? '✓ DONE' : 'RUN TEST'}
                            </span>
                          </button>
                          {revealed && (
                            <div
                              className={`px-3 py-2.5 text-xs font-semibold leading-relaxed border-t space-y-1 ${
                                test.isPositive
                                  ? isNight
                                    ? 'bg-amber-950/50 text-amber-100 border-amber-800/70'
                                    : 'bg-amber-50 text-amber-950 border-amber-200'
                                  : isNight
                                    ? 'bg-emerald-950/50 text-emerald-100 border-emerald-800/70'
                                    : 'bg-emerald-50 text-emerald-950 border-emerald-200'
                              }`}
                            >
                              <div dir="ltr" className="text-[10px] font-mono font-black uppercase">
                                {test.isPositive ? '▲ POSITIVE FINDING' : '● NEGATIVE / INTACT'}
                              </div>
                              <div dir="ltr" className="font-bold text-start">
                                {test.findingEn}
                              </div>
                              {isAr && (
                                <div className="text-[11px] opacity-80 leading-snug">
                                  {test.findingAr}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {step === 'diagnosis' && (
                  <div className="space-y-2.5">
                    {/* Quick Clinical Synthesis Recap */}
                    <div
                      className={`rounded-xl border px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold ${
                        isNight ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sky-500 font-black">
                          {isAr ? 'ملخص المعطيات:' : 'Clinical Clues:'}
                        </span>
                        <span dir="ltr" className="font-mono text-[10.5px]">
                          VAS {c.vasPain}/10
                        </span>
                        <span className="opacity-40">·</span>
                        <span>
                          {isAr
                            ? `اختبارات: ${revealedTests.length}/${c.objectiveTests.length}`
                            : `Tests: ${revealedTests.length}/${c.objectiveTests.length}`}
                        </span>
                      </div>
                      <span
                        className={`text-[10.5px] font-extrabold ${
                          redFlagChoice === 'refer'
                            ? 'text-rose-500'
                            : redFlagChoice === 'safe'
                              ? 'text-emerald-500'
                              : 'text-amber-500'
                        }`}
                      >
                        {redFlagChoice === 'refer'
                          ? isAr
                            ? 'تحذير: تحويل طبي'
                            : 'Red Flag: Refer'
                          : redFlagChoice === 'safe'
                            ? isAr
                              ? 'آمن للعلاج'
                              : 'Cleared'
                            : isAr
                              ? 'لم يُحسم التحذير'
                              : 'Red Flag pending'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-extrabold px-0.5">
                      <span className="text-sky-500">
                        {isAr ? 'اختر التشخيص السريري (Clinical Diagnosis):' : 'Select Primary Clinical Diagnosis:'}
                      </span>
                      <span dir="ltr" className="text-[10px] font-mono uppercase opacity-65">
                        Clinical Dx
                      </span>
                    </div>

                    <div dir="ltr" className="space-y-2">
                      {c.diagnosisOptions.map((d) => {
                        const isPicked = selectedDiag === d.id;
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => setSelectedDiag(d.id)}
                            className={`w-full text-left p-3 rounded-xl border-2 transition-colors flex items-center justify-between gap-2.5 cursor-pointer ${
                              isPicked
                                ? 'border-sky-500 bg-sky-500/15'
                                : isNight
                                  ? 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                                  : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <span className="text-xs sm:text-[13px] font-black leading-snug min-w-0">
                              {d.labelEn}
                            </span>
                            <span
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                isPicked
                                  ? 'border-sky-500 bg-sky-500 text-slate-950'
                                  : isNight
                                    ? 'border-slate-700'
                                    : 'border-slate-300'
                              }`}
                            >
                              {isPicked && <Check className="w-3 h-3 stroke-[3]" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {step === 'plan' && (
                  <div className="space-y-3">
                    {!selectedDiag && (
                      <button
                        type="button"
                        onClick={() => setStep('diagnosis')}
                        className={`w-full p-2.5 rounded-xl border text-xs font-extrabold flex items-center justify-between gap-2 cursor-pointer ${
                          isNight
                            ? 'bg-amber-950/45 border-amber-700/70 text-amber-200'
                            : 'bg-amber-50 border-amber-300 text-amber-900'
                        }`}
                      >
                        <span>
                          {isAr
                            ? 'تنبيه: يرجى تحديد التشخيص (Diagnosis) أولاً'
                            : 'Reminder: Select a Diagnosis first before submitting'}
                        </span>
                        <span className="underline shrink-0">
                          {isAr ? 'اختر التشخيص' : 'Pick Dx'}
                        </span>
                      </button>
                    )}

                    {/* Primary Treatment Strategy */}
                    <div className="space-y-2">
                      <div className="text-xs font-extrabold text-emerald-500">
                        {isAr ? 'أ. الاستراتيجية العلاجية (Primary Strategy):' : 'A. Primary Treatment Strategy:'}
                      </div>
                      <div className="space-y-1.5">
                        {c.treatmentOptions.map((t) => {
                          const picked = selectedTx === t.id;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setSelectedTx(t.id)}
                              className={`w-full text-start p-2.5 sm:p-3 rounded-xl border-2 flex items-start justify-between gap-2.5 transition-colors cursor-pointer ${
                                picked
                                  ? 'border-emerald-500 bg-emerald-500/15'
                                  : isNight
                                    ? 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                                    : 'border-slate-200 bg-white hover:border-slate-300'
                              }`}
                            >
                              <div className="min-w-0 space-y-1">
                                <div dir="ltr" className="text-xs sm:text-[13px] font-black leading-snug text-start">
                                  {t.labelEn}
                                </div>
                                {isAr && (
                                  <div className="text-[11px] font-medium opacity-75 leading-snug">
                                    {t.labelAr}
                                  </div>
                                )}
                              </div>
                              <span
                                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                                  picked
                                    ? 'border-emerald-500 bg-emerald-500 text-slate-950'
                                    : isNight
                                      ? 'border-slate-700'
                                      : 'border-slate-300'
                                }`}
                              >
                                {picked && <Check className="w-3 h-3 stroke-[3]" />}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Custom Treatment Prescription Builder (Sessions, Frequency, Modalities, Precautions) */}
                    <div
                      className={`rounded-xl border p-3 space-y-3 ${
                        isNight ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-extrabold text-sky-500">
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                          <span>
                            {isAr
                              ? 'ب. تفاصيل الجلسات والأجهزة والبرنامج المنزلي'
                              : 'B. Sessions, Modalities & Home Program'}
                          </span>
                        </div>
                        <span dir="ltr" className="text-[11px] font-mono font-bold opacity-75 tabular-nums">
                          {plannedSessions}× · {frequencyPerWeek}/wk
                        </span>
                      </div>

                      {/* Sessions Count & Weekly Frequency */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div
                          className={`rounded-lg border px-2.5 py-2 flex items-center justify-between gap-2 ${
                            isNight ? 'bg-slate-950/70 border-slate-800' : 'bg-white border-slate-200'
                          }`}
                        >
                          <span className="text-[11px] font-extrabold">
                            {isAr ? 'عدد الجلسات' : 'Sessions'}
                          </span>
                          <div dir="ltr" className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setPlannedSessions((v) => Math.max(0, v - 1))}
                              aria-label="Decrease sessions"
                              className={`w-7 h-7 rounded-md border flex items-center justify-center cursor-pointer ${
                                isNight
                                  ? 'border-slate-700 bg-slate-800 hover:bg-slate-700'
                                  : 'border-slate-200 bg-slate-100 hover:bg-slate-200'
                              }`}
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center text-xs font-mono font-black tabular-nums">
                              {plannedSessions}
                            </span>
                            <button
                              type="button"
                              onClick={() => setPlannedSessions((v) => Math.min(20, v + 1))}
                              aria-label="Increase sessions"
                              className={`w-7 h-7 rounded-md border flex items-center justify-center cursor-pointer ${
                                isNight
                                  ? 'border-slate-700 bg-slate-800 hover:bg-slate-700'
                                  : 'border-slate-200 bg-slate-100 hover:bg-slate-200'
                              }`}
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div
                          className={`rounded-lg border px-2.5 py-2 flex items-center justify-between gap-1.5 ${
                            isNight ? 'bg-slate-950/70 border-slate-800' : 'bg-white border-slate-200'
                          }`}
                        >
                          <span className="text-[11px] font-extrabold">
                            {isAr ? 'أسبوعياً' : 'Freq/wk'}
                          </span>
                          <div dir="ltr" className="flex items-center gap-1">
                            {([2, 3, 5] as const).map((fq) => (
                              <button
                                key={fq}
                                type="button"
                                onClick={() => setFrequencyPerWeek(fq)}
                                className={`h-7 px-2.5 rounded-md text-[10.5px] font-mono font-black border cursor-pointer tabular-nums ${
                                  frequencyPerWeek === fq
                                    ? 'bg-sky-500 border-sky-400 text-slate-950'
                                    : isNight
                                      ? 'border-slate-700 bg-slate-800 text-slate-300'
                                      : 'border-slate-200 bg-slate-100 text-slate-700'
                                }`}
                              >
                                {fq}x
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Quick Session Presets */}
                      <div dir="ltr" className="flex items-center gap-1.5 flex-wrap">
                        {[0, 4, 6, 8, 10, 12].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setPlannedSessions(preset)}
                            className={`h-7 px-2.5 rounded-md text-[10.5px] font-mono font-bold border tabular-nums cursor-pointer ${
                              plannedSessions === preset
                                ? 'bg-sky-500/20 border-sky-500 text-sky-400'
                                : isNight
                                  ? 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-slate-200'
                                  : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {preset === 0 ? '0 (Refer)' : `${preset} sess`}
                          </button>
                        ))}
                      </div>

                      {/* Equipment & Therapeutic Modalities Multi-Select */}
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-extrabold opacity-85">
                          {isAr
                            ? 'الأجهزة والوسائل العلاجية المختارة:'
                            : 'Select Equipment & Modalities:'}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {PRESCRIPTION_MODALITIES.map((mod) => {
                            const active = selectedModalities.includes(mod.id);
                            return (
                              <button
                                key={mod.id}
                                type="button"
                                onClick={() => toggleModality(mod.id)}
                                className={`rounded-lg border px-2.5 py-2 text-start transition-colors cursor-pointer ${
                                  active
                                    ? 'border-emerald-500 bg-emerald-500/15'
                                    : isNight
                                      ? 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                                      : 'border-slate-200 bg-white hover:border-slate-300'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1.5">
                                  <span dir="ltr" className="text-[11.5px] font-black leading-tight">
                                    {mod.nameEn}
                                  </span>
                                  {active && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                                </div>
                                <div className="text-[10px] opacity-70 leading-snug mt-0.5">
                                  {isAr ? mod.subAr : mod.subEn}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Home Program / Precautions */}
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-extrabold opacity-85">
                          {isAr ? 'البرنامج المنزلي والاحتياطات (HEP & Precautions):' : 'Home Program & Precautions:'}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {HOME_PRECAUTION_OPTIONS.map((prec) => {
                            const active = homePrecautions.includes(prec.id);
                            return (
                              <button
                                key={prec.id}
                                type="button"
                                onClick={() => togglePrecaution(prec.id)}
                                className={`rounded-lg border px-2.5 py-2 flex items-center justify-between gap-1.5 text-start cursor-pointer ${
                                  active
                                    ? 'border-sky-500 bg-sky-500/15 text-sky-400'
                                    : isNight
                                      ? 'border-slate-800 bg-slate-950/50 text-slate-300'
                                      : 'border-slate-200 bg-white text-slate-700'
                                }`}
                              >
                                <div className="min-w-0 space-y-0.5">
                                  <div dir="ltr" className="text-[11px] font-black leading-tight text-start">
                                    {prec.nameEn}
                                  </div>
                                  {isAr && (
                                    <div className="text-[10px] font-medium opacity-70 leading-tight">
                                      {prec.labelAr}
                                    </div>
                                  )}
                                </div>
                                {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {step === 'summary' && evaluationResult && (
                  <div className="space-y-2.5 text-center">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
                      <ClipboardCheck className="w-5 h-5" />
                    </div>
                    <div className="text-sm font-black tabular-nums">
                      {isAr
                        ? `الدقة السريرية: ${evaluationResult.score}%`
                        : `Clinical Accuracy: ${evaluationResult.score}%`}
                    </div>
                    <div className="flex items-center justify-center gap-3 text-xs font-black tabular-nums">
                      <span className="flex items-center gap-1 text-amber-500">
                        <Coins className="w-3.5 h-3.5" />+{evaluationResult.coinsEarned}
                      </span>
                      <span className="text-slate-400" aria-hidden="true">·</span>
                      <span className="flex items-center gap-1 text-sky-500">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />+
                        {evaluationResult.starsEarned}
                      </span>
                    </div>

                    {/* Prescribed Plan Overview */}
                    <div
                      className={`rounded-xl border p-3 text-start text-xs space-y-1.5 ${
                        isNight ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 font-extrabold text-emerald-500">
                        <span>{isAr ? 'ملخص الخطة المخصصة' : 'Prescribed Plan'}</span>
                        <span dir="ltr" className="font-mono tabular-nums text-[11px]">
                          {plannedSessions} sessions · {frequencyPerWeek}x/wk
                        </span>
                      </div>
                      {selectedDiag && (
                        <div dir="ltr" className="text-xs font-black text-start">
                          Dx: {c.diagnosisOptions.find((d) => d.id === selectedDiag)?.labelEn}
                        </div>
                      )}
                      {selectedModalities.length > 0 && (
                        <div dir="ltr" className="text-[11px] font-semibold opacity-85 text-start">
                          Modalities:{' '}
                          {selectedModalities
                            .map((id) => PRESCRIPTION_MODALITIES.find((m) => m.id === id)?.nameEn)
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      )}
                      <p className="text-[11px] font-semibold opacity-90 pt-0.5 leading-relaxed">
                        {evaluationResult.prescriptionNote}
                      </p>
                    </div>

                    <div
                      className={`rounded-xl border p-3 text-start text-xs space-y-1 ${
                        isNight ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-1 font-extrabold text-sky-500">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{isAr ? 'ملاحظة المشرف السريري:' : 'Clinical Mentor Note:'}</span>
                      </div>
                      <p className="leading-relaxed opacity-90">{evaluationResult.feedback}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Stage Navigation */}
              <div
                className={`p-2.5 border-t flex items-center gap-2 shrink-0 ${
                  isNight ? 'border-slate-800 bg-slate-900/95' : 'border-slate-200 bg-slate-50'
                }`}
              >
                {step === 'subjective' && (
                  <button
                    type="button"
                    onClick={() => setStep('redflags')}
                    className="w-full py-2.5 rounded-xl game-btn-blue text-white text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>{isAr ? 'التالي: فحص التحذيرات' : 'Next: Red Flags'}</span>
                    {isAr ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                  </button>
                )}

                {step === 'redflags' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setStep('subjective')}
                      className={`px-3.5 py-2.5 rounded-xl border text-xs font-extrabold cursor-pointer ${
                        isNight
                          ? 'border-slate-700 bg-slate-800 text-slate-200'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      {isAr ? 'السابق' : 'Back'}
                    </button>
                    <button
                      type="button"
                      disabled={!redFlagChoice}
                      onClick={() => setStep('objective')}
                      className="flex-1 py-2.5 rounded-xl game-btn-blue disabled:opacity-45 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>{isAr ? 'التالي: الفحص السريري (EN)' : 'Next: Clinical Exam'}</span>
                      {isAr ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                    </button>
                  </>
                )}

                {step === 'objective' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setStep('redflags')}
                      className={`px-3.5 py-2.5 rounded-xl border text-xs font-extrabold cursor-pointer ${
                        isNight
                          ? 'border-slate-700 bg-slate-800 text-slate-200'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      {isAr ? 'السابق' : 'Back'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep('diagnosis')}
                      className="flex-1 py-2.5 rounded-xl game-btn-blue text-white text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>{isAr ? 'التالي: التشخيص السريري' : 'Next: Clinical Diagnosis'}</span>
                      {isAr ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                    </button>
                  </>
                )}

                {step === 'diagnosis' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setStep('objective')}
                      className={`px-3.5 py-2.5 rounded-xl border text-xs font-extrabold cursor-pointer ${
                        isNight
                          ? 'border-slate-700 bg-slate-800 text-slate-200'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      {isAr ? 'السابق' : 'Back'}
                    </button>
                    <button
                      type="button"
                      disabled={!selectedDiag}
                      onClick={() => setStep('plan')}
                      className="flex-1 py-2.5 rounded-xl game-btn-blue disabled:opacity-45 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>{isAr ? 'التالي: الخطة العلاجية' : 'Next: Treatment Plan'}</span>
                      {isAr ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                    </button>
                  </>
                )}

                {step === 'plan' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setStep('diagnosis')}
                      className={`px-3.5 py-2.5 rounded-xl border text-xs font-extrabold cursor-pointer ${
                        isNight
                          ? 'border-slate-700 bg-slate-800 text-slate-200'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      {isAr ? 'السابق' : 'Back'}
                    </button>
                    {!selectedDiag ? (
                      <button
                        type="button"
                        onClick={() => setStep('diagnosis')}
                        className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black cursor-pointer"
                      >
                        {isAr ? 'اختر التشخيص أولاً ←' : 'Select Diagnosis First'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!selectedTx || evaluating}
                        onClick={handleSubmitPlan}
                        className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-45 text-white text-xs font-extrabold cursor-pointer"
                      >
                        {evaluating
                          ? isAr
                            ? 'جارٍ تقييم الخطة...'
                            : 'Evaluating Plan...'
                          : isAr
                            ? 'اعتماد الخطة ← الخلاصة'
                            : 'Confirm Plan → Summary'}
                      </button>
                    )}
                  </>
                )}

                {step === 'summary' && evaluationResult && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!therapyStarted) {
                        setTherapyStarted(true);
                        setPanelHidden(true);
                        setSpeechCaption(
                          isAr
                            ? 'تفضل دكتور، أنا مستعد لبدء الجلسة العلاجية.'
                            : 'Ready whenever you are, doctor.'
                        );
                        onPatientSpeak(patient.id, 1800);
                      } else {
                        completeActiveSession();
                      }
                    }}
                    className={`w-full py-2.5 rounded-xl text-xs font-black cursor-pointer ${
                      therapyStarted
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                        : 'game-btn-gold text-slate-950'
                    }`}
                  >
                    {therapyStarted
                      ? isAr
                        ? 'إنهاء الجلسة واحتساب النتيجة ✓'
                        : 'Complete Session & Claim Rewards ✓'
                      : isAr
                        ? 'بدء العلاج وتنفيذ الجلسة ✓'
                        : 'Start Therapy Session ✓'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Session Completion Confirmation Prompt on Exit after Starting Therapy */}
      {exitConfirmOpen && (
        <div
          dir={isAr ? 'rtl' : 'ltr'}
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4"
        >
          <div
            className={`w-full max-w-sm rounded-2xl border p-4 sm:p-5 shadow-2xl space-y-3.5 ${surfaceCls}`}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-400/35 text-emerald-500 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="min-w-0 space-y-1">
                <h3 className="text-sm sm:text-base font-black leading-snug">
                  {isAr ? 'هل أكملت الجلسة العلاجية؟' : 'Did you complete the therapy session?'}
                </h3>
                <p className="text-xs opacity-80 leading-relaxed">
                  {isAr
                    ? 'اختر "نعم، أكملت الجلسة" لإنهاء الحالة واحتساب النقاط، أو تابع لتجربة الأجهزة.'
                    : 'Choose "Yes, Complete Session" to finish and score the case, or continue using devices.'}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setExitConfirmOpen(false);
                  completeActiveSession();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs sm:text-[13px] font-black flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-colors"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{isAr ? 'نعم، أكملت الجلسة ✓' : 'Yes, Complete Session ✓'}</span>
              </button>

              <button
                type="button"
                onClick={() => setExitConfirmOpen(false)}
                className={`w-full py-2.5 px-4 rounded-xl border text-xs font-extrabold cursor-pointer transition-colors ${
                  isNight
                    ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-100'
                    : 'border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-800'
                }`}
              >
                {isAr ? 'لا، متابعة الجلسة وتجربة الأجهزة' : 'No, Continue Session'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setExitConfirmOpen(false);
                  onExit();
                }}
                className="w-full py-1.5 text-[11px] font-bold opacity-65 hover:opacity-100 hover:text-rose-500 cursor-pointer transition-opacity"
              >
                {isAr ? 'خروج دون إكمال الحالة' : 'Exit without completing'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
