import React, { useEffect, useRef, useState } from 'react';
import {
  Flame,
  Hand,
  Minus,
  Pause,
  Play,
  Plus,
  Snowflake,
  Undo2,
  X,
} from 'lucide-react';
import {
  formatTimerMmSs,
  getDefaultDeviceParams,
  getDefaultProbeAnchors,
} from '../engine3d/fppEquipment3d';
import {
  DeviceConsoleParams,
  FppActiveDeviceState,
  FppProbeAnchor,
  Language,
} from '../types/clinic';

interface PhysicalDeviceControllerProps {
  device: FppActiveDeviceState;
  language: Language;
  onUpdate: (next: FppActiveDeviceState) => void;
  onSelectProbeToPlace: (probeId: string) => void;
  onPickUp: () => void;
  onReturn: () => void;
  onClose: () => void;
}

// Mobile-friendly Medical Hardware Linear Fader: tap track anywhere, slide horizontally, or tap −/+ steppers
const HardwareFader: React.FC<{
  label: string;
  valueText: string;
  value: number;
  min: number;
  max: number;
  step: number;
  lightBody?: boolean;
  accentClass?: string;
  onChange: (nextVal: number) => void;
}> = ({
  label,
  valueText,
  value,
  min,
  max,
  step,
  lightBody = false,
  accentClass = 'bg-sky-500',
  onChange,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const ratio = Math.max(0, Math.min(1, (value - min) / Math.max(1e-5, max - min)));

  const commitValue = (raw: number) => {
    const snapped = Math.round((raw - min) / step) * step + min;
    const decimals = step < 1 ? 1 : 0;
    const clamped = Math.max(min, Math.min(max, Number(snapped.toFixed(decimals))));
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
    <div className="select-none space-y-0.5">
      <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wide px-0.5">
        <span className={lightBody ? 'text-slate-700' : 'text-slate-300'}>{label}</span>
        <span
          className={`font-mono font-black tabular-nums ${
            lightBody ? 'text-slate-950' : 'text-white'
          }`}
        >
          {valueText}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => commitValue(value - step)}
          aria-label={`Decrease ${label}`}
          className={`w-7 h-7 rounded-md border flex items-center justify-center font-black text-xs shrink-0 cursor-pointer active:scale-95 ${
            lightBody
              ? 'bg-white hover:bg-slate-100 border-slate-400 text-slate-800 shadow-sm'
              : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-100 shadow-sm'
          }`}
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
          className={`relative flex-1 h-7 rounded-md border touch-none cursor-ew-resize overflow-hidden flex items-center px-1 ${
            lightBody
              ? 'bg-slate-800/90 border-slate-500 shadow-inner'
              : 'bg-[#070b11] border-slate-600 shadow-inner'
          }`}
        >
          <div className="absolute inset-x-2 flex justify-between pointer-events-none opacity-35">
            {[0, 1, 2, 3, 4, 5, 6].map((idx) => (
              <span key={idx} className="w-[1px] h-2 bg-slate-300" />
            ))}
          </div>

          <div
            style={{ width: `${ratio * 100}%` }}
            className={`absolute inset-y-1 left-0 rounded-r-sm opacity-75 pointer-events-none ${accentClass}`}
          />

          <div
            style={{ left: `calc(${ratio * 100}% - 10px)` }}
            className="relative z-10 w-5 h-5 rounded bg-gradient-to-b from-white via-slate-200 to-slate-400 border border-slate-800 shadow-[0_2px_5px_rgba(0,0,0,0.65)] flex items-center justify-center gap-[2px] pointer-events-none"
          >
            <span className="w-[1px] h-2.5 bg-slate-600" />
            <span className="w-[1px] h-2.5 bg-slate-600" />
          </div>
        </div>

        <button
          type="button"
          onClick={() => commitValue(value + step)}
          aria-label={`Increase ${label}`}
          className={`w-7 h-7 rounded-md border flex items-center justify-center font-black text-xs shrink-0 cursor-pointer active:scale-95 ${
            lightBody
              ? 'bg-white hover:bg-slate-100 border-slate-400 text-slate-800 shadow-sm'
              : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-100 shadow-sm'
          }`}
        >
          +
        </button>
      </div>
    </div>
  );
};

const ANIMATED_TICK_SPRITES = new Set<string>([
  'tens_unit',
  'emg_biofeedback',
  'cpm_device',
  'balance_trainer',
  'tilt_table',
  'traction_table',
  'exercise_bike',
  'treadmill',
  'multi_gym_pulley',
]);

export const PhysicalDeviceController: React.FC<PhysicalDeviceControllerProps> = React.memo(({
  device,
  language,
  onUpdate,
  onSelectProbeToPlace,
  onPickUp,
  onReturn,
  onClose,
}) => {
  const isAr = language === 'ar';
  const [tickPhase, setTickPhase] = useState(0);
  const needsLiveTick = device.isRunning && ANIMATED_TICK_SPRITES.has(device.sprite);

  const params: DeviceConsoleParams = {
    ...getDefaultDeviceParams(device.sprite),
    ...(device.deviceParams ?? {}),
  };

  const probes: FppProbeAnchor[] =
    device.probeAnchors && device.probeAnchors.length > 0
      ? device.probeAnchors
      : getDefaultProbeAnchors(device.sprite);

  useEffect(() => {
    if (!needsLiveTick) return;
    let raf = 0;
    let last = performance.now();
    let lastEmit = last;
    const step = (now: number) => {
      if (now - lastEmit >= 65) {
        const dt = Math.min(0.15, (now - last) / 1000);
        last = now;
        lastEmit = now;
        setTickPhase((p) => (p + dt * 2.8) % (Math.PI * 20));
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [needsLiveTick]);

  const patchParams = (patch: Partial<DeviceConsoleParams>) => {
    onUpdate({
      ...device,
      deviceParams: { ...params, ...patch },
    });
  };

  const adjustMinutes = (deltaMin: number) => {
    const curMin = params.timerMin ?? 15;
    const nextMin = Math.max(1, Math.min(45, curMin + deltaMin));
    patchParams({
      timerMin: nextMin,
      timerRemainingSec: nextMin * 60,
    });
  };

  const toggleRun = () => {
    const rem = params.timerRemainingSec ?? (params.timerMin ?? 15) * 60;
    onUpdate({
      ...device,
      isRunning: !device.isRunning,
      deviceParams: {
        ...params,
        timerRemainingSec: rem <= 0 ? (params.timerMin ?? 15) * 60 : rem,
      },
    });
  };

  const timerStr = formatTimerMmSs(params);
  const running = device.isRunning;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const renderHardwareTopTrim = (
    title: string,
    lightBody = false,
    runLabel?: { on: string; off: string }
  ) => (
    <div
      className={`px-2.5 py-1.5 flex items-center justify-between gap-1.5 border-b ${
        lightBody
          ? 'bg-slate-300/85 border-slate-400 text-slate-800'
          : 'bg-black/40 border-white/10 text-slate-100'
      }`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className={`w-2.5 h-2.5 rounded-full border border-black/40 shrink-0 ${
            running ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-slate-500'
          }`}
        />
        <span className="text-[10px] font-black tracking-wide uppercase truncate">{title}</span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <div className="inline-flex items-center gap-0.5 bg-[#08130f] border border-slate-600 rounded px-1 py-0.5 font-mono">
          <button
            type="button"
            onClick={() => adjustMinutes(-1)}
            aria-label="Decrease timer"
            className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
          >
            <Minus className="w-2.5 h-2.5" />
          </button>
          <span className="text-[10px] font-black text-emerald-400 tabular-nums px-1">
            {timerStr}
          </span>
          <button
            type="button"
            onClick={() => adjustMinutes(1)}
            aria-label="Increase timer"
            className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
          >
            <Plus className="w-2.5 h-2.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={toggleRun}
          className={`h-7 px-2.5 rounded border text-[10px] font-black flex items-center gap-1 cursor-pointer shadow ${
            running
              ? 'bg-rose-600 hover:bg-rose-500 border-rose-300 text-white'
              : 'bg-emerald-500 hover:bg-emerald-400 border-emerald-700 text-slate-950'
          }`}
        >
          {running ? (
            <Pause className="w-2.5 h-2.5 fill-current" />
          ) : (
            <Play className="w-2.5 h-2.5 fill-current" />
          )}
          <span>
            {running
              ? (runLabel?.on ?? (isAr ? 'إيقاف' : 'STOP'))
              : (runLabel?.off ?? (isAr ? 'تشغيل' : 'START'))}
          </span>
        </button>

        {device.sprite !== 'magnetotherapy' &&
          device.sprite !== 'tilt_table' &&
          device.sprite !== 'traction_table' &&
          device.sprite !== 'exercise_bike' &&
          device.sprite !== 'treadmill' &&
          device.sprite !== 'parallel_bars' &&
          device.sprite !== 'wall_bars' &&
          device.sprite !== 'multi_gym_pulley' && (
          <>
            <button
              type="button"
              onClick={onPickUp}
              title={isAr ? 'نقل الجهاز' : 'Move device'}
              aria-label={isAr ? 'نقل الجهاز' : 'Move device'}
              className={`w-7 h-7 rounded flex items-center justify-center border cursor-pointer ${
                lightBody
                  ? 'bg-white/75 hover:bg-white border-slate-400 text-slate-800'
                  : 'bg-white/10 hover:bg-white/20 border-white/15 text-white'
              }`}
            >
              <Hand className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={onReturn}
              title={isAr ? 'إرجاع لمكانه' : 'Return'}
              aria-label={isAr ? 'إرجاع لمكانه' : 'Return'}
              className="w-7 h-7 rounded bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center cursor-pointer"
            >
              <Undo2 className="w-3 h-3" />
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={`w-7 h-7 rounded flex items-center justify-center border cursor-pointer ${
            lightBody
              ? 'bg-white/75 hover:bg-rose-500 hover:text-white border-slate-400 text-slate-800'
              : 'bg-white/10 hover:bg-rose-500 border-white/15 text-white'
          }`}
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );

  // 1) TENS / IFC — Dual-Channel LCD Scope + Biphasic Pulse Controls + 4 Lead Plugs
  const renderTensUnit = () => {
    const mA = Number(params.intensity ?? 16);
    const hz = Number(params.freqHz ?? 80);
    const pulseUs = Number(params.pulseUs ?? 120);
    const mode = params.mode ?? 'CONV';
    const placedCount = probes.filter((p) => p.placed).length;
    const ampPx = 3 + Math.min(8, (mA / 60) * 8);
    const shift = running ? (tickPhase * 14) % 24 : 0;

    return (
      <div className="w-[min(95vw,27rem)] select-none">
        <div className="mx-auto w-24 h-2 rounded-t-md bg-slate-300 border-x-2 border-t-2 border-slate-500" />
        <div className="rounded-2xl bg-gradient-to-b from-[#eef2f6] via-[#dce3ec] to-[#c7d1de] border-[3px] border-slate-500 shadow-[0_14px_34px_rgba(0,0,0,0.62)] text-slate-900 overflow-hidden">
          {renderHardwareTopTrim('TENS / IFC PRO', true)}

          <div className="p-2 space-y-1.5">
            <div className="flex items-stretch gap-2">
              {/* Backlit Monochrome LCD + Live Biphasic Oscilloscope */}
              <div className="flex-1 rounded-lg bg-[#1d2733] p-1 border-2 border-slate-600 shadow-inner">
                <div className="rounded bg-[#8fa89b] border border-slate-800 px-2 py-1 text-[#0f1f18] font-mono h-full flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[9px] font-black">
                    <span>{mode} · {pulseUs}µs</span>
                    <span>{placedCount >= 2 ? '● LEAD OK' : '○ NO PAD'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-base font-black leading-none tabular-nums">
                      {mA} <span className="text-[10px]">mA</span>
                    </div>
                    <svg viewBox="0 0 80 22" className="w-20 h-5">
                      <line x1="0" y1="11" x2="80" y2="11" stroke="#0f1f18" strokeOpacity="0.25" strokeWidth="1" />
                      <path
                        d={`M 0 11 L ${10 - shift * 0.2} 11 L ${12 - shift * 0.2} ${11 - ampPx} L ${16 - shift * 0.2} ${11 - ampPx} L ${18 - shift * 0.2} ${11 + ampPx} L ${22 - shift * 0.2} ${11 + ampPx} L ${24 - shift * 0.2} 11 L 42 11 L 44 ${11 - ampPx} L 48 ${11 - ampPx} L 50 ${11 + ampPx} L 54 ${11 + ampPx} L 56 11 L 80 11`}
                        fill="none"
                        stroke="#0a1f16"
                        strokeWidth="1.6"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Waveform Mode Membrane Keys */}
              <div className="flex flex-col gap-1 w-16 shrink-0">
                {['CONV', 'BURST', 'IFC'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => patchParams({ mode: m })}
                    className={`flex-1 rounded border text-[9px] font-black cursor-pointer ${
                      mode === m
                        ? 'bg-sky-600 border-sky-800 text-white shadow-sm'
                        : 'bg-white border-slate-400 text-slate-700'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Linear Faders: Intensity + Freq + Pulse Width */}
            <HardwareFader
              label={isAr ? 'شدة التيار (INTENSITY)' : 'INTENSITY (CH1/CH2)'}
              valueText={`${mA} mA`}
              value={mA}
              min={2}
              max={60}
              step={2}
              lightBody
              accentClass="bg-sky-500"
              onChange={(v) => patchParams({ intensity: v })}
            />

            <div className="grid grid-cols-2 gap-2">
              <HardwareFader
                label="FREQ"
                valueText={`${hz} Hz`}
                value={hz}
                min={2}
                max={150}
                step={2}
                lightBody
                accentClass="bg-emerald-500"
                onChange={(v) => patchParams({ freqHz: v })}
              />
              <HardwareFader
                label="PULSE"
                valueText={`${pulseUs} µs`}
                value={pulseUs}
                min={50}
                max={250}
                step={10}
                lightBody
                accentClass="bg-amber-500"
                onChange={(v) => patchParams({ pulseUs: v })}
              />
            </div>

            {/* 4 Banana-Jack Lead Sockets */}
            <div className="rounded-lg bg-slate-800 border border-slate-600 p-1 grid grid-cols-4 gap-1 text-white">
              {probes.map((probe, idx) => {
                const isPos = idx % 2 === 0;
                const isSel = device.selectedProbeId === probe.id;
                return (
                  <button
                    key={probe.id}
                    type="button"
                    onClick={() => onSelectProbeToPlace(probe.id)}
                    className={`flex items-center justify-center gap-1 rounded py-1 px-1 border cursor-pointer transition-colors ${
                      isSel
                        ? 'bg-emerald-500/30 border-emerald-400'
                        : probe.placed
                          ? 'bg-sky-500/25 border-sky-400'
                          : 'bg-slate-900 border-slate-700 hover:border-sky-400'
                    }`}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full border border-slate-300 shrink-0 ${
                        isPos ? 'bg-red-600' : 'bg-slate-950'
                      }`}
                    />
                    <span className="text-[9px] font-black truncate">
                      {probe.placed ? `✓ ${probe.label}` : probe.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 2) ULTRASOUND — 5cm² ERA Console + Acoustic Gel Contact LED + Side Wand
  const renderUltrasoundUnit = () => {
    const freq = Number(params.freqHz ?? 1);
    const wcm2 = Number(params.intensity ?? 1.2);
    const duty = Number(params.dutyPct ?? 50);
    const headProbe = probes[0];
    const coupled = Boolean(headProbe?.placed);

    return (
      <div className="w-[min(95vw,27rem)] select-none flex items-stretch gap-1.5">
        <div className="flex-1 rounded-2xl bg-gradient-to-b from-slate-600 via-slate-700 to-slate-800 border-[3px] border-slate-400 shadow-[0_14px_34px_rgba(0,0,0,0.65)] text-white overflow-hidden">
          {renderHardwareTopTrim('ULTRASOUND ERA 5cm²', false, { on: 'STOP', off: 'EMIT' })}

          <div className="p-2 space-y-1.5">
            <div className="rounded-lg bg-[#0d1824] border-2 border-cyan-600/60 px-2.5 py-1 font-mono flex items-center justify-between gap-2">
              <div>
                <div className="text-[9px] text-cyan-300 font-black">
                  {freq === 1 ? '1.0 MHz (DEEP 3-5cm)' : '3.0 MHz (SUP 1-2cm)'}
                </div>
                <div className="text-base font-black text-white leading-tight">
                  {wcm2.toFixed(1)} <span className="text-[10px] text-cyan-200">W/cm²</span>
                </div>
              </div>
              <div className="text-right text-[9px] font-black space-y-0.5">
                <div className={coupled ? 'text-emerald-400' : 'text-amber-400'}>
                  {coupled ? '● GEL COUPLED' : '○ NO CONTACT'}
                </div>
                <div className="text-slate-400">BNR 4.0:1 · {duty === 100 ? 'CONT' : `${duty}%`}</div>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-1">
              {[
                { label: '1 MHz', active: freq === 1, fn: () => patchParams({ freqHz: 1 }) },
                { label: '3 MHz', active: freq === 3, fn: () => patchParams({ freqHz: 3 }) },
                { label: '20%', active: duty === 20, fn: () => patchParams({ dutyPct: 20 }) },
                { label: '50%', active: duty === 50, fn: () => patchParams({ dutyPct: 50 }) },
                { label: 'CONT', active: duty === 100, fn: () => patchParams({ dutyPct: 100 }) },
              ].map((b) => (
                <button
                  key={b.label}
                  type="button"
                  onClick={b.fn}
                  className={`py-1 rounded text-[9px] font-black border cursor-pointer ${
                    b.active
                      ? 'bg-cyan-500 border-cyan-300 text-slate-950'
                      : 'bg-slate-800 border-slate-600 text-slate-200'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>

            <HardwareFader
              label="OUTPUT INTENSITY"
              valueText={`${wcm2.toFixed(1)} W/cm²`}
              value={wcm2}
              min={0.2}
              max={2.4}
              step={0.1}
              accentClass="bg-cyan-500"
              onChange={(v) => patchParams({ intensity: v })}
            />
          </div>
        </div>

        {headProbe && (
          <button
            type="button"
            onClick={() => onSelectProbeToPlace(headProbe.id)}
            className={`w-16 rounded-2xl border-[3px] p-1 flex flex-col items-center justify-between text-center cursor-pointer shadow-xl ${
              device.selectedProbeId === headProbe.id
                ? 'bg-emerald-900 border-emerald-400 text-white'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-400 text-white'
            }`}
          >
            <span className="text-[8px] font-black text-cyan-300">WAND</span>
            <svg viewBox="0 0 60 72" className="w-10 h-14">
              <ellipse cx="30" cy="12" rx="15" ry="8" fill="#e2e8f0" stroke="#64748b" strokeWidth="2" />
              <ellipse cx="30" cy="12" rx="9" ry="4.5" fill={running ? '#22d3ee' : '#94a3b8'} />
              <rect x="23" y="21" width="14" height="30" rx="4" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
              <path d="M 30 51 C 18 60, 38 64, 10 69" fill="none" stroke="#020617" strokeWidth="3.5" strokeLinecap="round" />
            </svg>
            <span
              className={`w-full py-0.5 rounded text-[8px] font-black ${
                headProbe.placed ? 'bg-emerald-400 text-slate-950' : 'bg-cyan-400 text-slate-950'
              }`}
            >
              {headProbe.placed ? '✓ ON' : isAr ? 'ضع' : 'AIM'}
            </span>
          </button>
        )}
      </div>
    );
  };

  // 3) LASER HILT — Class IV 1064nm + Joules Dose Target + Shutter Safety
  const renderLaserHilt = () => {
    const watts = Number(params.intensity ?? 10);
    const targetJ = Number(params.shocks ?? 850);
    const mode = params.mode ?? 'ANALGESIC';
    const headProbe = probes[0];
    const elapsedSec = Math.max(
      0,
      (params.timerMin ?? 6) * 60 - (params.timerRemainingSec ?? (params.timerMin ?? 6) * 60)
    );
    const deliveredJ = Math.min(targetJ, Math.round(elapsedSec * watts * (mode === 'BIOSTIM' ? 0.85 : 0.65)));

    return (
      <div className="w-[min(95vw,27rem)] select-none flex items-stretch gap-1.5">
        <div className="flex-1 rounded-2xl bg-gradient-to-b from-[#231f28] via-[#17141b] to-[#0d0a10] border-[3px] border-rose-500/75 shadow-[0_14px_34px_rgba(0,0,0,0.72)] text-white overflow-hidden">
          {renderHardwareTopTrim('HILT 1064nm CLASS IV', false, { on: 'OFF', off: 'EMIT' })}

          <div className="p-2 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 rounded-lg bg-[#120409] border-2 border-rose-500/50 px-2.5 py-1 font-mono flex items-center justify-between">
                <div>
                  <div className="text-[9px] text-rose-300 font-black">
                    {mode} · {running ? 'SHUTTER OPEN' : 'INTERLOCK SAFE'}
                  </div>
                  <div className="text-sm font-black text-white">
                    {watts.toFixed(1)} W <span className="text-[10px] text-rose-300">· {deliveredJ}/{targetJ} J</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1 w-20 shrink-0">
                {['ANALGESIC', 'BIOSTIM'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => patchParams({ mode: m })}
                    className={`py-1 rounded text-[8px] font-black cursor-pointer ${
                      mode === m ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <HardwareFader
                label="POWER"
                valueText={`${watts.toFixed(1)} W`}
                value={watts}
                min={1}
                max={15}
                step={0.5}
                accentClass="bg-rose-500"
                onChange={(v) => patchParams({ intensity: v })}
              />
              <HardwareFader
                label="DOSE"
                valueText={`${targetJ} J`}
                value={targetJ}
                min={200}
                max={2000}
                step={50}
                accentClass="bg-amber-500"
                onChange={(v) => patchParams({ shocks: v })}
              />
            </div>
          </div>
        </div>

        {headProbe && (
          <button
            type="button"
            onClick={() => onSelectProbeToPlace(headProbe.id)}
            className={`w-16 rounded-2xl border-[3px] p-1 flex flex-col items-center justify-between text-center cursor-pointer shadow-xl ${
              device.selectedProbeId === headProbe.id
                ? 'bg-emerald-900 border-emerald-400 text-white'
                : 'bg-[#1a131b] hover:bg-[#271b28] border-rose-500/70 text-white'
            }`}
          >
            <span className="text-[8px] font-black text-rose-300">LASER</span>
            <svg viewBox="0 0 60 72" className="w-10 h-14">
              <circle cx="30" cy="10" r="4" fill={running ? '#f43f5e' : '#64748b'} />
              <path d="M 27 14 L 33 14 L 36 26 L 24 26 Z" fill="#f59e0b" />
              <rect x="23" y="26" width="14" height="28" rx="4" fill="#1e293b" stroke="#64748b" strokeWidth="1.5" />
              <path d="M 30 54 C 30 64, 16 68, 8 70" fill="none" stroke="#f59e0b" strokeWidth="3.5" strokeLinecap="round" />
            </svg>
            <span
              className={`w-full py-0.5 rounded text-[8px] font-black ${
                headProbe.placed ? 'bg-emerald-400 text-slate-950' : 'bg-rose-500 text-white'
              }`}
            >
              {headProbe.placed ? '✓ ON' : isAr ? 'وجه' : 'AIM'}
            </span>
          </button>
        )}
      </div>
    );
  };

  // 4) ESWT SHOCKWAVE — Bar Pressure + Hz + Transmitter Tip + Shot Progress
  const renderShockwaveEswt = () => {
    const bar = Number(params.intensity ?? 2.4);
    const hz = Number(params.freqHz ?? 10);
    const shocks = Number(params.shocks ?? 2000);
    const delivered = Math.round(Number(params.deliveredShocks ?? 0));
    const tipSize = params.tipSize ?? '15mm';
    const headProbe = probes[0];
    const pct = Math.min(100, Math.round((delivered / Math.max(1, shocks)) * 100));

    return (
      <div className="w-[min(95vw,27.5rem)] select-none flex items-stretch gap-1.5">
        <div className="flex-1 rounded-2xl bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 border-[3px] border-slate-500 shadow-[0_14px_34px_rgba(0,0,0,0.65)] text-slate-900 overflow-hidden">
          {renderHardwareTopTrim('RADIAL SHOCKWAVE ESWT', true, { on: 'STOP', off: 'PULSE' })}

          <div className="p-2 space-y-1.5">
            <div className="rounded-lg bg-[#0d1420] border-2 border-amber-500/60 px-2.5 py-1 font-mono text-white">
              <div className="flex justify-between text-[9px] text-amber-300 font-black">
                <span>{bar.toFixed(1)} bar · {hz} Hz · TIP {tipSize}</span>
                <span>{delivered}/{shocks} SHK</span>
              </div>
              <div className="w-full h-1.5 rounded bg-slate-800 mt-1 overflow-hidden">
                <div style={{ width: `${pct}%` }} className="h-full bg-emerald-400" />
              </div>
            </div>

            <div className="grid grid-cols-6 gap-1">
              {['6mm', '15mm', '35mm'].map((tip) => (
                <button
                  key={tip}
                  type="button"
                  onClick={() => patchParams({ tipSize: tip })}
                  className={`py-1 rounded text-[9px] font-black border cursor-pointer ${
                    tipSize === tip
                      ? 'bg-amber-500 border-amber-700 text-slate-950'
                      : 'bg-white border-slate-400 text-slate-700'
                  }`}
                >
                  {tip}
                </button>
              ))}
              {[1500, 2000, 3000].map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => patchParams({ shocks: cnt })}
                  className={`py-1 rounded text-[8px] font-black border cursor-pointer ${
                    shocks === cnt
                      ? 'bg-sky-600 border-sky-800 text-white'
                      : 'bg-white border-slate-400 text-slate-700'
                  }`}
                >
                  {cnt}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <HardwareFader
                label="PRESSURE"
                valueText={`${bar.toFixed(1)} bar`}
                value={bar}
                min={1}
                max={5}
                step={0.2}
                lightBody
                accentClass="bg-amber-500"
                onChange={(v) => patchParams({ intensity: v })}
              />
              <HardwareFader
                label="FREQ"
                valueText={`${hz} Hz`}
                value={hz}
                min={1}
                max={21}
                step={1}
                lightBody
                accentClass="bg-sky-500"
                onChange={(v) => patchParams({ freqHz: v })}
              />
            </div>
          </div>
        </div>

        {headProbe && (
          <button
            type="button"
            onClick={() => onSelectProbeToPlace(headProbe.id)}
            className={`w-16 rounded-2xl border-[3px] p-1 flex flex-col items-center justify-between text-center cursor-pointer shadow-xl ${
              device.selectedProbeId === headProbe.id
                ? 'bg-emerald-900 border-emerald-400 text-white'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-500 text-white'
            }`}
          >
            <span className="text-[8px] font-black text-amber-300">GUN</span>
            <svg viewBox="0 0 60 72" className="w-10 h-14">
              <rect x="36" y="12" width="14" height="8" rx="2" fill="#e2e8f0" stroke="#64748b" />
              <rect x="12" y="10" width="26" height="12" rx="3" fill="#475569" stroke="#cbd5e1" />
              <path d="M 16 22 L 28 22 L 23 50 L 12 50 Z" fill="#0f172a" stroke="#f59e0b" strokeWidth="1.5" />
              <path d="M 18 50 C 14 64, 34 66, 8 70" fill="none" stroke="#94a3b8" strokeWidth="3.5" strokeDasharray="3 2" strokeLinecap="round" />
            </svg>
            <span
              className={`w-full py-0.5 rounded text-[8px] font-black ${
                headProbe.placed ? 'bg-emerald-400 text-slate-950' : 'bg-amber-400 text-slate-950'
              }`}
            >
              {headProbe.placed ? '✓ ON' : isAr ? 'ضع' : 'AIM'}
            </span>
          </button>
        )}
      </div>
    );
  };

  // 5) SWD DIATHERMY — 27.12 MHz Resonance Bar + Metal Contraindication Check + RF Drum
  const renderSwdUnit = () => {
    const watts = Number(params.intensity ?? 120);
    const mode = params.mode ?? 'CONT';
    const headProbe = probes[0];
    const tuned = Boolean(headProbe?.placed);

    return (
      <div className="w-[min(95vw,27rem)] select-none flex items-stretch gap-1.5">
        <div className="flex-1 rounded-2xl bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 border-[3px] border-sky-400/75 shadow-[0_14px_34px_rgba(0,0,0,0.68)] text-white overflow-hidden">
          {renderHardwareTopTrim('SWD 27.12 MHz', false, { on: 'STOP', off: 'RF ON' })}

          <div className="p-2 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 rounded-lg bg-[#091420] border-2 border-amber-500/45 px-2.5 py-1 font-mono">
                <div className="flex justify-between text-[9px] font-black">
                  <span className="text-amber-300">{mode} · 27.12 MHz</span>
                  <span className={tuned ? 'text-emerald-400' : 'text-amber-400'}>
                    {tuned ? 'RESONANCE OK' : 'NO METAL!'}
                  </span>
                </div>
                <div className="text-base font-black text-white leading-tight">{watts} W</div>
              </div>

              <div className="flex flex-col gap-1 w-20 shrink-0">
                {['CONT', 'PULSED'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => patchParams({ mode: m })}
                    className={`py-1 rounded text-[9px] font-black cursor-pointer ${
                      mode === m ? 'bg-amber-500 text-slate-950' : 'bg-slate-700 text-slate-200'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <HardwareFader
              label="RF OUTPUT POWER"
              valueText={`${watts} W`}
              value={watts}
              min={20}
              max={200}
              step={10}
              accentClass="bg-amber-500"
              onChange={(v) => patchParams({ intensity: v })}
            />
          </div>
        </div>

        {headProbe && (
          <button
            type="button"
            onClick={() => onSelectProbeToPlace(headProbe.id)}
            className={`w-16 rounded-2xl border-[3px] p-1 flex flex-col items-center justify-between text-center cursor-pointer shadow-xl ${
              device.selectedProbeId === headProbe.id
                ? 'bg-emerald-900 border-emerald-400 text-white'
                : 'bg-slate-900 hover:bg-slate-800 border-sky-400 text-white'
            }`}
          >
            <span className="text-[8px] font-black text-amber-300">DRUM</span>
            <svg viewBox="0 0 60 72" className="w-10 h-14">
              <ellipse cx="30" cy="20" rx="18" ry="13" fill="#1e293b" stroke="#38bdf8" strokeWidth="2.5" />
              <ellipse cx="30" cy="20" rx="10" ry="7" fill={running ? '#f59e0b' : '#475569'} />
              <path d="M 24 33 C 22 52, 16 62, 8 69" fill="none" stroke="#020617" strokeWidth="3.5" strokeLinecap="round" />
            </svg>
            <span
              className={`w-full py-0.5 rounded text-[8px] font-black ${
                headProbe.placed ? 'bg-emerald-400 text-slate-950' : 'bg-sky-400 text-slate-950'
              }`}
            >
              {headProbe.placed ? '✓ ON' : isAr ? 'وجه' : 'AIM'}
            </span>
          </button>
        )}
      </div>
    );
  };

  // 6) EMG BIOFEEDBACK — Live LED VU Bar + Threshold Fader + 3 Snap Leads
  const renderEmgBiofeedback = () => {
    const thr = Number(params.intensity ?? 35);
    const mode = params.mode ?? 'WORK/REST';
    const activeAmp = running ? Math.round(25 + Math.abs(Math.sin(tickPhase * 1.8)) * 60) : 0;

    return (
      <div className="w-[min(95vw,27rem)] select-none rounded-2xl bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 border-[3px] border-emerald-500/70 shadow-[0_14px_34px_rgba(0,0,0,0.68)] text-white overflow-hidden">
        {renderHardwareTopTrim('sEMG BIOFEEDBACK', false, { on: 'HOLD', off: 'REC' })}

        <div className="p-2 space-y-1.5">
          <div className="flex items-stretch gap-2">
            <div className="flex-1 rounded-lg bg-[#06130f] border-2 border-emerald-500/50 px-2.5 py-1.5 font-mono">
              <div className="flex justify-between text-[9px] text-amber-300 font-black">
                <span>THR {thr} µV</span>
                <span className={activeAmp >= thr ? 'text-emerald-400' : 'text-slate-300'}>
                  SIG {activeAmp} µV
                </span>
              </div>
              <div className="flex gap-1 mt-1.5">
                {[10, 20, 30, 40, 50, 60, 70, 80, 90, 98].map((v) => (
                  <span
                    key={v}
                    className={`h-2.5 flex-1 rounded-sm ${
                      activeAmp >= v
                        ? v >= thr
                          ? 'bg-amber-400 shadow-[0_0_5px_#fbbf24]'
                          : 'bg-emerald-400'
                        : 'bg-slate-800'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1 w-20 shrink-0">
              {['WORK/REST', 'RELAX'].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => patchParams({ mode: m })}
                  className={`flex-1 rounded text-[8px] font-black cursor-pointer ${
                    mode === m ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <HardwareFader
            label="TARGET THRESHOLD (µV)"
            valueText={`${thr} µV`}
            value={thr}
            min={10}
            max={95}
            step={5}
            accentClass="bg-emerald-500"
            onChange={(v) => patchParams({ intensity: v })}
          />

          <div className="rounded-lg bg-black/40 border border-emerald-600/35 p-1 grid grid-cols-3 gap-1">
            {probes.map((probe, idx) => {
              const wireColor = idx === 0 ? '#ef4444' : idx === 1 ? '#10b981' : '#f59e0b';
              const isSel = device.selectedProbeId === probe.id;
              return (
                <button
                  key={probe.id}
                  type="button"
                  onClick={() => onSelectProbeToPlace(probe.id)}
                  className={`flex items-center justify-center gap-1 rounded p-1 border cursor-pointer ${
                    isSel
                      ? 'bg-emerald-500/25 border-emerald-400'
                      : probe.placed
                        ? 'bg-emerald-500/15 border-emerald-400/70'
                        : 'bg-slate-900 border-slate-700'
                  }`}
                >
                  <span style={{ backgroundColor: wireColor }} className="w-2 h-2 rounded-full shrink-0" />
                  <span className="text-[9px] font-black truncate">
                    {probe.placed ? `✓ ${probe.label}` : probe.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // 7) CRYO TOWER — Temp Fader + Pressure Cuff + Flow Mode
  const renderCryoUnit = () => {
    const tempC = Number(params.tempC ?? 4);
    const mmHg = Number(params.pressureMmHg ?? 45);
    const flow = params.flow ?? 'HIGH';
    const headProbe = probes[0];

    return (
      <div className="w-[min(95vw,27rem)] select-none flex items-stretch gap-1.5">
        <div className="flex-1 rounded-2xl bg-gradient-to-b from-slate-100 via-cyan-50 to-slate-200 border-[3px] border-cyan-500 shadow-[0_14px_34px_rgba(0,0,0,0.65)] text-slate-900 overflow-hidden">
          {renderHardwareTopTrim('CRYO-COMPRESSION', true, { on: 'STOP', off: 'PUMP' })}

          <div className="p-2 space-y-1.5">
            <div className="rounded-lg bg-[#071825] border-2 border-cyan-500/50 px-2.5 py-1 font-mono text-white flex items-center justify-between">
              <span className="flex items-center gap-1 text-xs text-cyan-300 font-black">
                <Snowflake className="w-3.5 h-3.5" /> {tempC}°C
              </span>
              <span className="text-[10px] font-black text-sky-200">
                {mmHg} mmHg · FLOW {flow}
              </span>
            </div>

            <div className="grid grid-cols-6 gap-1">
              {[15, 30, 45, 60].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => patchParams({ pressureMmHg: p })}
                  className={`py-1 rounded text-[9px] font-black border cursor-pointer ${
                    mmHg === p
                      ? 'bg-cyan-600 border-cyan-800 text-white'
                      : 'bg-white border-slate-300 text-slate-700'
                  }`}
                >
                  {p}
                </button>
              ))}
              {['MED', 'HIGH'].map((fl) => (
                <button
                  key={fl}
                  type="button"
                  onClick={() => patchParams({ flow: fl })}
                  className={`py-1 rounded text-[9px] font-black border cursor-pointer ${
                    flow === fl
                      ? 'bg-sky-600 border-sky-800 text-white'
                      : 'bg-white border-slate-300 text-slate-700'
                  }`}
                >
                  {fl}
                </button>
              ))}
            </div>

            <HardwareFader
              label="TARGET COOLING TEMP"
              valueText={`${tempC} °C`}
              value={tempC}
              min={1}
              max={12}
              step={1}
              lightBody
              accentClass="bg-cyan-500"
              onChange={(v) => patchParams({ tempC: v })}
            />
          </div>
        </div>

        {headProbe && (
          <button
            type="button"
            onClick={() => onSelectProbeToPlace(headProbe.id)}
            className={`w-16 rounded-2xl border-[3px] p-1 flex flex-col items-center justify-between text-center cursor-pointer shadow-xl ${
              device.selectedProbeId === headProbe.id
                ? 'bg-emerald-900 border-emerald-400 text-white'
                : 'bg-cyan-950 hover:bg-cyan-900 border-cyan-400 text-white'
            }`}
          >
            <span className="text-[8px] font-black text-cyan-300">CUFF</span>
            <svg viewBox="0 0 60 72" className="w-10 h-14">
              <rect x="14" y="12" width="32" height="34" rx="8" fill="#0284c7" stroke="#bae6fd" strokeWidth="2" />
              <path d="M 30 46 C 30 60, 16 66, 8 70" fill="none" stroke="#38bdf8" strokeWidth="5" strokeLinecap="round" />
            </svg>
            <span
              className={`w-full py-0.5 rounded text-[8px] font-black ${
                headProbe.placed ? 'bg-emerald-400 text-slate-950' : 'bg-cyan-400 text-slate-950'
              }`}
            >
              {headProbe.placed ? '✓ ON' : isAr ? 'لف' : 'WRAP'}
            </span>
          </button>
        )}
      </div>
    );
  };

  // 8) CPM HANDHELD PENDANT — Live Goniometer Knee Arc + Dual ROM Faders
  const renderCpmPendant = () => {
    const extDeg = Number(params.extDeg ?? 0);
    const flexDeg = Number(params.flexDeg ?? 90);
    const speed = Number(params.speed ?? 2);
    const curWave = running ? 0.5 - 0.5 * Math.cos(tickPhase * (0.6 + speed * 0.35)) : 0.45;
    const curAngle = Math.round(extDeg + (flexDeg - extDeg) * curWave);
    const rad = (curAngle * Math.PI) / 180;
    const armX = 28 + Math.cos(rad * 0.85) * 20;
    const armY = 26 - Math.sin(rad * 0.85) * 20;

    return (
      <div className="w-[min(95vw,26.5rem)] select-none flex flex-col items-center">
        <div className="w-full rounded-2xl bg-gradient-to-b from-slate-100 via-sky-50 to-slate-200 border-[3px] border-sky-500 shadow-[0_14px_34px_rgba(0,0,0,0.68)] text-slate-900 overflow-hidden">
          {renderHardwareTopTrim(`CPM KNEE · ${curAngle}°`, true, { on: 'HOLD', off: 'FLEX' })}
          <div className="p-2 space-y-1.5">
            <div className="rounded-lg bg-[#091826] border-2 border-sky-500/50 px-2.5 py-1 text-white flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 56 32" className="w-14 h-8 shrink-0">
                  <line x1="6" y1="26" x2="28" y2="26" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
                  <line x1="28" y1="26" x2={armX} y2={armY} stroke="#34d399" strokeWidth="3" strokeLinecap="round" />
                  <circle cx="28" cy="26" r="3" fill="#f59e0b" />
                </svg>
                <div className="font-mono">
                  <div className="text-[9px] text-sky-300 font-black">ROM {extDeg}° → {flexDeg}°</div>
                  <div className="text-sm font-black tabular-nums">{curAngle}°</div>
                </div>
              </div>

              <div className="flex gap-1">
                {[1, 2, 3].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => patchParams({ speed: s })}
                    className={`w-7 h-7 rounded text-[10px] font-black cursor-pointer ${
                      speed === s ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 border border-slate-600 text-slate-200'
                    }`}
                  >
                    S{s}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <HardwareFader
                label="EXTENSION"
                valueText={`${extDeg}°`}
                value={extDeg}
                min={-10}
                max={30}
                step={5}
                lightBody
                accentClass="bg-sky-500"
                onChange={(v) => patchParams({ extDeg: v })}
              />
              <HardwareFader
                label="FLEXION"
                valueText={`${flexDeg}°`}
                value={flexDeg}
                min={35}
                max={120}
                step={5}
                lightBody
                accentClass="bg-emerald-500"
                onChange={(v) => patchParams({ flexDeg: v })}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 9) THERMAL BATHS (Paraffin / Hydrocollator) + Hot Pack Slot
  const renderThermalTank = () => {
    const isHydro = device.sprite === 'hydro_sink';
    const minT = isHydro ? 65 : 48;
    const maxT = isHydro ? 78 : 56;
    const tempC = Number(params.tempC ?? (isHydro ? 74 : 53));
    const mode = params.mode ?? (isHydro ? 'STD PACK' : 'DIP&WRAP');
    const modes = isHydro ? ['CERVICAL', 'STD PACK'] : ['DIP&WRAP', 'IMMERSION'];
    const hotPackProbe = probes[0];
    const safeOk = isHydro ? tempC >= 70 && tempC <= 76 : tempC >= 51 && tempC <= 54;

    return (
      <div className="w-[min(95vw,27rem)] select-none flex items-stretch gap-1.5">
        <div
          className={`flex-1 rounded-2xl border-[3px] shadow-[0_14px_34px_rgba(0,0,0,0.65)] overflow-hidden ${
            isHydro
              ? 'bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 border-slate-500 text-slate-900'
              : 'bg-gradient-to-b from-amber-50 via-slate-100 to-amber-100 border-amber-400 text-slate-900'
          }`}
        >
          {renderHardwareTopTrim(
            isHydro ? 'HYDROCOLLATOR' : 'PARAFFIN BATH',
            true,
            { on: 'OFF', off: 'HEAT' }
          )}
          <div className="p-2 space-y-1.5">
            <div className="rounded-lg bg-[#16120c] border-2 border-amber-500/50 px-2.5 py-1 text-white font-mono flex items-center justify-between">
              <span className="flex items-center gap-1 text-[10px] text-amber-300 font-black">
                <Flame className="w-3 h-3" /> {mode}
              </span>
              <span className={`text-[9px] font-black ${safeOk ? 'text-emerald-400' : 'text-amber-300'}`}>
                {safeOk ? '● OPTIMAL TEMP' : 'ADJUST TEMP'} · {tempC}°C
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1">
              {modes.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => patchParams({ mode: m })}
                  className={`py-1 rounded text-[9px] font-black border cursor-pointer ${
                    mode === m ? 'bg-amber-600 border-amber-800 text-white' : 'bg-white border-slate-400 text-slate-700'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <HardwareFader
              label={isHydro ? 'WATER TANK TEMP' : 'WAX MELT TEMP'}
              valueText={`${tempC} °C`}
              value={tempC}
              min={minT}
              max={maxT}
              step={1}
              lightBody
              accentClass="bg-amber-500"
              onChange={(v) => patchParams({ tempC: v })}
            />
          </div>
        </div>

        {hotPackProbe && (
          <button
            type="button"
            onClick={() => onSelectProbeToPlace(hotPackProbe.id)}
            className={`w-16 rounded-2xl border-[3px] p-1 flex flex-col items-center justify-between text-center cursor-pointer shadow-xl ${
              device.selectedProbeId === hotPackProbe.id
                ? 'bg-emerald-900 border-emerald-400 text-white'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-500 text-white'
            }`}
          >
            <span className="text-[8px] font-black text-amber-300">{isHydro ? 'PACK' : 'MITT'}</span>
            <svg viewBox="0 0 60 66" className="w-10 h-12">
              {isHydro ? (
                <>
                  <rect x="12" y="10" width="36" height="44" rx="6" fill="#d97706" stroke="#fde68a" strokeWidth="2" />
                  <line x1="12" y1="26" x2="48" y2="26" stroke="#fbbf24" strokeWidth="1.5" />
                  <line x1="12" y1="40" x2="48" y2="40" stroke="#fbbf24" strokeWidth="1.5" />
                </>
              ) : (
                <>
                  <rect x="15" y="12" width="30" height="40" rx="11" fill="#0284c7" stroke="#fde68a" strokeWidth="2" />
                  <rect x="15" y="42" width="30" height="10" rx="3" fill="#f8fafc" />
                </>
              )}
            </svg>
            <span
              className={`w-full py-0.5 rounded text-[8px] font-black ${
                hotPackProbe.placed ? 'bg-emerald-400 text-slate-950' : 'bg-amber-400 text-slate-950'
              }`}
            >
              {hotPackProbe.placed ? '✓ ON' : isAr ? 'ضع' : isHydro ? 'PACK' : 'MITT'}
            </span>
          </button>
        )}
      </div>
    );
  };

  // 10) BALANCE TRAINER — Live CoP Sway Bullseye + Difficulty Fader
  const renderBalanceTrainer = () => {
    const lvl = Number(params.intensity ?? 2);
    const mode = params.mode ?? 'FIRM EO';
    const swayR = running ? Math.min(10, lvl * 2.1) : 1.5;
    const copX = 20 + Math.cos(tickPhase * 1.9) * swayR;
    const copY = 20 + Math.sin(tickPhase * 2.4) * swayR * 0.75;

    return (
      <div className="w-[min(95vw,26.5rem)] select-none rounded-2xl bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 border-[3px] border-emerald-500/75 shadow-[0_14px_34px_rgba(0,0,0,0.68)] text-white overflow-hidden">
        {renderHardwareTopTrim(`BALANCE · L${lvl}`, false, { on: 'STOP', off: 'TEST' })}
        <div className="p-2 space-y-1.5">
          <div className="flex items-center gap-2.5">
            <svg viewBox="0 0 40 40" className="w-11 h-11 rounded-lg bg-[#071510] border border-emerald-500/50 shrink-0">
              <circle cx="20" cy="20" r="14" fill="none" stroke="#10b981" strokeOpacity="0.3" strokeWidth="1" />
              <circle cx="20" cy="20" r="7" fill="none" stroke="#10b981" strokeOpacity="0.4" strokeWidth="1" />
              <line x1="20" y1="3" x2="20" y2="37" stroke="#10b981" strokeOpacity="0.25" strokeWidth="1" />
              <line x1="3" y1="20" x2="37" y2="20" stroke="#10b981" strokeOpacity="0.25" strokeWidth="1" />
              <circle cx={copX} cy={copY} r="3" fill={running ? '#34d399' : '#94a3b8'} />
            </svg>

            <div className="flex-1 grid grid-cols-2 gap-1">
              {['FIRM EO', 'FIRM EC', 'FOAM EO', 'DYNAMIC'].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => patchParams({ mode: m })}
                  className={`py-1 rounded text-[9px] font-black cursor-pointer ${
                    mode === m ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <HardwareFader
            label="TILT INSTABILITY LEVEL"
            valueText={`LEVEL ${lvl}`}
            value={lvl}
            min={1}
            max={5}
            step={1}
            accentClass="bg-emerald-500"
            onChange={(v) => patchParams({ intensity: v })}
          />
        </div>
      </div>
    );
  };

  // 11) PEMF MAGNETOTHERAPY COUCH — Motorized Solenoid Scan/Zone + Flux mT/Gauss + Hz
  const renderMagnetotherapyConsole = () => {
    const mT = Number(params.intensity ?? 45);
    const hz = Number(params.freqHz ?? 25);
    const mode = params.mode ?? 'PULSED';
    const zone = params.magnetZone ?? 'SCAN';
    const speed = Number(params.speed ?? 2);
    const gauss = mT * 10;

    // Solenoid X indicator (12..62 px on miniature 76x28 schematic)
    const ringX = !running
      ? 62
      : zone === 'CERVICAL'
        ? 16
        : zone === 'LUMBAR'
          ? 34
          : zone === 'KNEE'
            ? 50
            : 16 + (0.5 - 0.5 * Math.cos(tickPhase * (0.45 + speed * 0.25))) * 34;

    const zones = [
      { id: 'SCAN', label: isAr ? 'مسح تلقائي' : 'AUTO SCAN' },
      { id: 'CERVICAL', label: isAr ? 'عنقية' : 'CERVICAL' },
      { id: 'LUMBAR', label: isAr ? 'قطنية' : 'LUMBAR' },
      { id: 'KNEE', label: isAr ? 'ركبة' : 'KNEE' },
    ];

    return (
      <div className="w-[min(95vw,27.5rem)] select-none rounded-2xl bg-gradient-to-b from-[#1f2937] via-[#131b26] to-[#0b1018] border-[3px] border-cyan-500/80 shadow-[0_14px_34px_rgba(0,0,0,0.72)] text-white overflow-hidden">
        {renderHardwareTopTrim('PEMF MAGNETO COUCH', false, {
          on: isAr ? 'إيقاف' : 'STOP',
          off: isAr ? 'تشغيل' : 'START',
        })}

        <div className="p-2 space-y-1.5">
          {/* Telemetry Display + Live Gantry Solenoid Schematic */}
          <div className="rounded-lg bg-[#06131f] border-2 border-cyan-500/50 px-2.5 py-1.5 font-mono flex items-center justify-between gap-2">
            <div>
              <div className="text-[9px] text-cyan-300 font-black flex items-center gap-1.5">
                <span>{mode} · {hz} Hz</span>
                <span className="text-slate-500">·</span>
                <span className={running ? 'text-emerald-400' : 'text-amber-300'}>
                  {running ? (zone === 'SCAN' ? 'SCANNING' : `LOCKED ${zone}`) : 'STANDBY'}
                </span>
              </div>
              <div className="text-base font-black text-white leading-tight tabular-nums">
                {mT} <span className="text-[10px] text-cyan-300">mT</span>{' '}
                <span className="text-[10px] text-slate-400">({gauss} G)</span>
              </div>
            </div>

            <svg viewBox="0 0 76 28" className="w-20 h-7 shrink-0 rounded bg-[#030b14] border border-cyan-900/70">
              <line x1="8" y1="21" x2="68" y2="21" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="14" cy="17" r="2.2" fill="#94a3b8" />
              <line x1="17" y1="18" x2="58" y2="18" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />
              <rect
                x={ringX - 4}
                y="6"
                width="8"
                height="16"
                rx="2.5"
                fill={running ? '#22d3ee' : '#475569'}
                fillOpacity={running ? 0.35 : 0.4}
                stroke={running ? '#38bdf8' : '#94a3b8'}
                strokeWidth="1.6"
              />
            </svg>
          </div>

          {/* Solenoid Target Zone / Auto-Scan Selector */}
          <div className="grid grid-cols-4 gap-1">
            {zones.map((z) => (
              <button
                key={z.id}
                type="button"
                onClick={() => patchParams({ magnetZone: z.id })}
                className={`py-1 rounded text-[9px] font-black border cursor-pointer transition-colors ${
                  zone === z.id
                    ? 'bg-cyan-500 border-cyan-300 text-slate-950 shadow-sm'
                    : 'bg-slate-800 border-slate-600 text-slate-200 hover:border-cyan-400/60'
                }`}
              >
                {z.label}
              </button>
            ))}
          </div>

          {/* Waveform Mode + Scan Speed */}
          <div className="flex items-center gap-1">
            {['CONT', 'PULSED', 'BURST'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => patchParams({ mode: m })}
                className={`flex-1 py-1 rounded text-[9px] font-black border cursor-pointer ${
                  mode === m
                    ? 'bg-sky-500 border-sky-300 text-slate-950'
                    : 'bg-slate-800 border-slate-600 text-slate-300'
                }`}
              >
                {m}
              </button>
            ))}
            {zone === 'SCAN' && (
              <div className="flex items-center gap-1 pl-1 border-l border-white/15">
                {[1, 2, 3].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => patchParams({ speed: s })}
                    className={`w-7 py-1 rounded text-[9px] font-black border cursor-pointer ${
                      speed === s
                        ? 'bg-emerald-500 border-emerald-300 text-slate-950'
                        : 'bg-slate-800 border-slate-600 text-slate-300'
                    }`}
                  >
                    S{s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Flux & Frequency Linear Faders */}
          <div className="grid grid-cols-2 gap-2">
            <HardwareFader
              label={isAr ? 'شدة المجال' : 'FLUX (mT)'}
              valueText={`${mT} mT`}
              value={mT}
              min={10}
              max={100}
              step={5}
              accentClass="bg-cyan-500"
              onChange={(v) => patchParams({ intensity: v })}
            />
            <HardwareFader
              label={isAr ? 'التردد' : 'FREQ (Hz)'}
              valueText={`${hz} Hz`}
              value={hz}
              min={2}
              max={100}
              step={2}
              accentClass="bg-sky-500"
              onChange={(v) => patchParams({ freqHz: v })}
            />
          </div>
        </div>
      </div>
    );
  };

  // 12) ELECTRIC STANDING TILT TABLE — Digital Inclinometer + Progressive Angle + % Body Weight Bearing
  const renderTiltTableConsole = () => {
    const targetDeg = Number(params.tiltDeg ?? 45);
    const liveDeg = Math.round(Number(params.currentTiltDeg ?? 0));
    const speed = Number(params.speed ?? 2);
    const wbPct = Math.round(Math.sin((liveDeg * Math.PI) / 180) * 100);
    const presets = [0, 30, 45, 60, 75, 85];

    const stageLabel = !running
      ? liveDeg > 3
        ? isAr ? 'نزول تدريجي 0°' : 'LOWERING 0°'
        : isAr ? 'وضع أفقي' : 'FLAT 0°'
      : Math.abs(liveDeg - targetDeg) > 2
        ? liveDeg < targetDeg
          ? isAr ? 'جاري الرفع' : 'ELEVATING'
          : isAr ? 'جاري الخفض' : 'LOWERING'
        : liveDeg >= 70
          ? isAr ? 'وقوف كامل' : 'FULL STAND'
          : liveDeg >= 30
            ? isAr ? 'تحميل جزئي' : 'PARTIAL WB'
            : isAr ? 'تدرج انتصابي' : 'ORTHOSTATIC';

    // Schematic tilt angle around hinge (x=38, y=22) on 76x30 SVG
    const rad = (liveDeg * Math.PI) / 180;
    const deckLen = 24;
    const hx = 40 - Math.cos(rad) * deckLen;
    const hy = 20 - Math.sin(rad) * deckLen;
    const fx = 40 + Math.cos(rad) * 16;
    const fy = 20 + Math.sin(rad) * 16;

    return (
      <div className="w-[min(95vw,27.5rem)] select-none rounded-2xl bg-gradient-to-b from-slate-100 via-sky-50 to-slate-200 border-[3px] border-sky-500 shadow-[0_14px_34px_rgba(0,0,0,0.68)] text-slate-900 overflow-hidden">
        {renderHardwareTopTrim('TILT TABLE · INCLINOMETER', true, {
          on: isAr ? 'إيقاف (0°)' : 'STOP 0°',
          off: isAr ? 'رفع الطاولة' : 'START TILT',
        })}

        <div className="p-2 space-y-1.5">
          {/* Digital Inclinometer Readout + Live Tilting Deck Schematic */}
          <div className="rounded-lg bg-[#071624] border-2 border-sky-500/50 px-2.5 py-1.5 font-mono text-white flex items-center justify-between gap-2">
            <div>
              <div className="text-[9px] text-sky-300 font-black flex items-center gap-1.5">
                <span>{isAr ? `الهدف ${targetDeg}°` : `TARGET ${targetDeg}°`}</span>
                <span className="text-slate-500">·</span>
                <span className={running ? 'text-emerald-400' : 'text-amber-300'}>{stageLabel}</span>
              </div>
              <div className="text-base font-black text-white leading-tight tabular-nums flex items-baseline gap-2">
                <span>{liveDeg}°</span>
                <span className="text-[10px] text-cyan-300 font-bold">
                  {isAr ? `وزن ${wbPct}%` : `${wbPct}% BW`}
                </span>
              </div>
            </div>

            <svg viewBox="0 0 76 30" className="w-20 h-7 shrink-0 rounded bg-[#030b14] border border-sky-900/70">
              <line x1="10" y1="26" x2="66" y2="26" stroke="#334155" strokeWidth="2" strokeLinecap="round" />
              <line x1="38" y1="26" x2="38" y2="20" stroke="#64748b" strokeWidth="2.5" />
              <line x1={hx} y1={hy} x2={fx} y2={fy} stroke={running ? '#38bdf8' : '#94a3b8'} strokeWidth="3" strokeLinecap="round" />
              <line
                x1={fx}
                y1={fy}
                x2={fx + Math.sin(rad) * 5}
                y2={fy - Math.cos(rad) * 5}
                stroke="#10b981"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* Target Angle Quick Clinical Presets */}
          <div className="grid grid-cols-6 gap-1">
            {presets.map((deg) => (
              <button
                key={deg}
                type="button"
                onClick={() => patchParams({ tiltDeg: deg })}
                className={`py-1 rounded text-[9px] font-black border cursor-pointer transition-colors ${
                  targetDeg === deg
                    ? 'bg-sky-600 border-sky-800 text-white shadow-sm'
                    : 'bg-white border-slate-300 text-slate-700 hover:border-sky-400'
                }`}
              >
                {deg}°
              </button>
            ))}
          </div>

          {/* Actuator Speed + Fine Target Angle Fader */}
          <div className="flex items-stretch gap-2">
            <div className="flex-1">
              <HardwareFader
                label={isAr ? 'زاوية الإمالة المستهدفة' : 'TARGET TILT ANGLE'}
                valueText={`${targetDeg}°`}
                value={targetDeg}
                min={0}
                max={85}
                step={5}
                lightBody
                accentClass="bg-sky-500"
                onChange={(v) => patchParams({ tiltDeg: v })}
              />
            </div>

            <div className="flex flex-col justify-between gap-1 shrink-0 w-20">
              <div className="text-[8px] font-black text-slate-600 text-center">
                {isAr ? 'السرعة' : 'SPEED'}
              </div>
              <div className="flex gap-1">
                {[1, 2, 3].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => patchParams({ speed: s })}
                    className={`flex-1 py-1.5 rounded text-[9px] font-black border cursor-pointer ${
                      speed === s
                        ? 'bg-emerald-600 border-emerald-800 text-white'
                        : 'bg-white border-slate-300 text-slate-700'
                    }`}
                  >
                    S{s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 13) LUMBAR TRACTION TABLE
  const renderTractionTable = () => {
    const kg = Number(params.tensionKg ?? 22);
    const mode = params.mode ?? 'INTERM';
    const pullWave = running ? (mode === 'INTERM' ? 0.5 + 0.5 * Math.sin(tickPhase * 0.85) : 1) : 0;
    const liveKg = Math.round(kg * pullWave);

    return (
      <div className="w-[min(95vw,27rem)] select-none rounded-2xl bg-gradient-to-b from-slate-100 via-sky-50 to-slate-200 border-[3px] border-sky-600 shadow-[0_14px_34px_rgba(0,0,0,0.68)] text-slate-900 overflow-hidden">
        {renderHardwareTopTrim('TRACTION UNIT', true)}
        <div className="p-2 space-y-1.5">
          <div className="rounded-lg bg-[#071624] border-2 border-sky-500/50 px-2.5 py-1.5 font-mono text-white flex items-center justify-between">
            <div>
              <div className="text-[9px] text-sky-300 font-black">{mode} · DECOMPRESSION</div>
              <div className="text-base font-black tabular-nums">
                {running ? liveKg : kg} <span className="text-[10px] text-cyan-300">kg</span>
                <span className="text-[10px] text-slate-400 ml-1.5">/ {kg} kg</span>
              </div>
            </div>
            <div className="w-24 h-2.5 rounded-full bg-slate-800 overflow-hidden border border-slate-600">
              <div
                style={{ width: `${Math.min(100, ((running ? liveKg : kg) / 45) * 100)}%` }}
                className="h-full bg-sky-400 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1">
            {['INTERM', 'STATIC', 'PROGR'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => patchParams({ mode: m })}
                className={`py-1 rounded text-[9px] font-black border cursor-pointer ${
                  mode === m ? 'bg-sky-600 border-sky-800 text-white' : 'bg-white border-slate-300 text-slate-700'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <HardwareFader
            label={isAr ? 'قوة الشد (كجم)' : 'TRACTION FORCE (kg)'}
            valueText={`${kg} kg`}
            value={kg}
            min={5}
            max={45}
            step={1}
            lightBody
            accentClass="bg-sky-500"
            onChange={(v) => patchParams({ tensionKg: v })}
          />
        </div>
      </div>
    );
  };

  // 14) EXERCISE BIKE ERGOMETER
  const renderExerciseBike = () => {
    const rpm = Number(params.rpm ?? 62);
    const res = Number(params.resistance ?? 4);
    const watts = Math.round(rpm * res * 0.35);

    return (
      <div className="w-[min(95vw,27rem)] select-none rounded-2xl bg-gradient-to-b from-slate-800 via-slate-900 to-[#090e17] border-[3px] border-sky-500/80 shadow-[0_14px_34px_rgba(0,0,0,0.72)] text-white overflow-hidden">
        {renderHardwareTopTrim('ERGO BIKE · CONSOLE', false)}
        <div className="p-2 space-y-1.5">
          <div className="rounded-lg bg-[#061322] border-2 border-sky-500/50 px-2.5 py-1.5 font-mono flex items-center justify-between">
            <div className="text-base font-black tabular-nums">
              {rpm} <span className="text-[10px] text-sky-300">RPM</span>
              <span className="text-slate-500 mx-1.5">·</span>
              <span className="text-emerald-400">{watts} W</span>
            </div>
            <span className="text-[10px] font-black text-amber-300">RES L{res}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <HardwareFader
              label={isAr ? 'السرعة (دورة/د)' : 'CADENCE (RPM)'}
              valueText={`${rpm} RPM`}
              value={rpm}
              min={25}
              max={95}
              step={5}
              accentClass="bg-sky-500"
              onChange={(v) => patchParams({ rpm: v })}
            />
            <HardwareFader
              label={isAr ? 'المقاومة' : 'RESISTANCE'}
              valueText={`LVL ${res}`}
              value={res}
              min={1}
              max={10}
              step={1}
              accentClass="bg-emerald-500"
              onChange={(v) => patchParams({ resistance: v })}
            />
          </div>
        </div>
      </div>
    );
  };

  // 15) GAIT TREADMILL
  const renderTreadmill = () => {
    const spd = Number(params.speed ?? 2.8);
    const inc = Number(params.inclinePct ?? 2);

    return (
      <div className="w-[min(95vw,27rem)] select-none rounded-2xl bg-gradient-to-b from-slate-800 via-slate-900 to-[#090e17] border-[3px] border-cyan-500/80 shadow-[0_14px_34px_rgba(0,0,0,0.72)] text-white overflow-hidden">
        {renderHardwareTopTrim('GAIT TREADMILL', false)}
        <div className="p-2 space-y-1.5">
          <div className="rounded-lg bg-[#061322] border-2 border-cyan-500/50 px-2.5 py-1.5 font-mono flex items-center justify-between">
            <div className="text-base font-black tabular-nums">
              {spd.toFixed(1)} <span className="text-[10px] text-cyan-300">km/h</span>
              <span className="text-slate-500 mx-1.5">·</span>
              <span className="text-amber-300">{inc}% INC</span>
            </div>
            <span className={`text-[9px] font-black ${running ? 'text-emerald-400' : 'text-slate-400'}`}>
              {running ? 'BELT ACTIVE' : 'BELT STOPPED'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <HardwareFader
              label={isAr ? 'السرعة (كم/س)' : 'SPEED (km/h)'}
              valueText={`${spd.toFixed(1)}`}
              value={spd}
              min={0.5}
              max={8.0}
              step={0.5}
              accentClass="bg-cyan-500"
              onChange={(v) => patchParams({ speed: v })}
            />
            <HardwareFader
              label={isAr ? 'الميل (%)' : 'INCLINE (%)'}
              valueText={`${inc}%`}
              value={inc}
              min={0}
              max={12}
              step={1}
              accentClass="bg-amber-500"
              onChange={(v) => patchParams({ inclinePct: v })}
            />
          </div>
        </div>
      </div>
    );
  };

  // 16) PARALLEL BARS (GAIT REHAB)
  const renderParallelBars = () => {
    const barH = Number(params.barHeightCm ?? 85);
    const mode = params.mode ?? 'ALTERNATING';

    return (
      <div className="w-[min(95vw,26.5rem)] select-none rounded-2xl bg-gradient-to-b from-slate-100 via-slate-200 to-slate-300 border-[3px] border-emerald-600 shadow-[0_14px_34px_rgba(0,0,0,0.65)] text-slate-900 overflow-hidden">
        {renderHardwareTopTrim('PARALLEL BARS · GAIT', true)}
        <div className="p-2 space-y-1.5">
          <div className="grid grid-cols-3 gap-1">
            {['ALTERNATING', 'TANDEM', 'STEP-OVER'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => patchParams({ mode: m })}
                className={`py-1 rounded text-[9px] font-black border cursor-pointer ${
                  mode === m ? 'bg-emerald-600 border-emerald-800 text-white' : 'bg-white border-slate-400 text-slate-700'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <HardwareFader
            label={isAr ? 'ارتفاع المتوازي (سم)' : 'RAIL HEIGHT (cm)'}
            valueText={`${barH} cm`}
            value={barH}
            min={70}
            max={105}
            step={5}
            lightBody
            accentClass="bg-emerald-500"
            onChange={(v) => patchParams({ barHeightCm: v })}
          />
        </div>
      </div>
    );
  };

  // 17) SWEDISH WALL BARS
  const renderWallBars = () => {
    const mode = params.mode ?? 'SPINAL HANG';
    const band = Number(params.resistance ?? 2);

    return (
      <div className="w-[min(95vw,26.5rem)] select-none rounded-2xl bg-gradient-to-b from-amber-50 via-stone-100 to-amber-100 border-[3px] border-amber-600 shadow-[0_14px_34px_rgba(0,0,0,0.65)] text-slate-900 overflow-hidden">
        {renderHardwareTopTrim('SWEDISH WALL BARS', true)}
        <div className="p-2 space-y-1.5">
          <div className="grid grid-cols-2 gap-1">
            {['SPINAL HANG', 'SCAPULAR', 'HAMSTRING', 'BAND PULL'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => patchParams({ mode: m })}
                className={`py-1 rounded text-[9px] font-black border cursor-pointer ${
                  mode === m ? 'bg-amber-600 border-amber-800 text-white' : 'bg-white border-slate-400 text-slate-700'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <HardwareFader
            label={isAr ? 'مستوى الحبل المطاطي' : 'BAND RESISTANCE'}
            valueText={`BAND L${band}`}
            value={band}
            min={1}
            max={4}
            step={1}
            lightBody
            accentClass="bg-amber-500"
            onChange={(v) => patchParams({ resistance: v })}
          />
        </div>
      </div>
    );
  };

  // 18) MULTI-GYM PULLEY TOWER
  const renderPulley = () => {
    const kg = Number(params.weightKg ?? 7.5);
    const mode = params.mode ?? 'ROW PULL';

    return (
      <div className="w-[min(95vw,26.5rem)] select-none rounded-2xl bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 border-[3px] border-sky-500/80 shadow-[0_14px_34px_rgba(0,0,0,0.70)] text-white overflow-hidden">
        {renderHardwareTopTrim('CABLE PULLEY TOWER', false)}
        <div className="p-2 space-y-1.5">
          <div className="grid grid-cols-3 gap-1">
            {['ROW PULL', 'LAT PULL', 'PRESS'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => patchParams({ mode: m })}
                className={`py-1 rounded text-[9px] font-black border cursor-pointer ${
                  mode === m ? 'bg-sky-500 border-sky-300 text-slate-950' : 'bg-slate-800 border-slate-600 text-slate-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <HardwareFader
            label={isAr ? 'وزن الكيبل (كجم)' : 'WEIGHT STACK (kg)'}
            valueText={`${kg.toFixed(1)} kg`}
            value={kg}
            min={2.5}
            max={20}
            step={2.5}
            accentClass="bg-sky-500"
            onChange={(v) => patchParams({ weightKg: v })}
          />
        </div>
      </div>
    );
  };

  // 19) HAND REHAB TABLE
  const renderHandRehabTable = () => {
    const tool = String(params.tool ?? 'PEGBOARD');
    const grip = Number(params.gripKg ?? 28);

    return (
      <div className="w-[min(95vw,26.5rem)] select-none rounded-2xl bg-gradient-to-b from-teal-50 via-slate-100 to-teal-100 border-[3px] border-teal-600 shadow-[0_14px_34px_rgba(0,0,0,0.65)] text-slate-900 overflow-hidden">
        {renderHardwareTopTrim('HAND REHAB TABLE', true)}
        <div className="p-2 space-y-1.5">
          <div className="grid grid-cols-3 gap-1">
            {['PEGBOARD', 'PUTTY', 'DYNAMOMETER'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => patchParams({ tool: t })}
                className={`py-1 rounded text-[9px] font-black border cursor-pointer ${
                  tool === t ? 'bg-teal-600 border-teal-800 text-white' : 'bg-white border-slate-400 text-slate-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <HardwareFader
            label={isAr ? 'قوة القبضة (كجم)' : 'TARGET GRIP (kg)'}
            valueText={`${grip} kg`}
            value={grip}
            min={5}
            max={65}
            step={1}
            lightBody
            accentClass="bg-teal-500"
            onChange={(v) => patchParams({ gripKg: v })}
          />
        </div>
      </div>
    );
  };

  // 20) PT DIAGNOSTIC TOOLKIT CART
  const renderPtToolkitCart = () => {
    const tool = String(params.tool ?? 'GONIOMETER');
    const rom = Number(params.romDeg ?? 115);
    const dtr = String(params.dtrGrade ?? '2+');
    const headProbe = probes[0];

    return (
      <div className="w-[min(95vw,27.5rem)] select-none flex items-stretch gap-1.5">
        <div className="flex-1 rounded-2xl bg-gradient-to-b from-slate-100 via-sky-50 to-slate-200 border-[3px] border-sky-500 shadow-[0_14px_34px_rgba(0,0,0,0.65)] text-slate-900 overflow-hidden">
          {renderHardwareTopTrim('PT TOOLKIT CART', true, { on: 'STOP', off: isAr ? 'قياس' : 'MEASURE' })}
          <div className="p-2 space-y-1.5">
            <div className="grid grid-cols-4 gap-1">
              {['GONIOMETER', 'REFLEX', 'IASTM', 'TAPE'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => patchParams({ tool: t })}
                  className={`py-1 rounded text-[8.5px] font-black border cursor-pointer ${
                    tool === t ? 'bg-sky-600 border-sky-800 text-white' : 'bg-white border-slate-400 text-slate-700'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {tool === 'REFLEX' ? (
              <div className="flex items-center justify-between gap-1 bg-white/80 rounded-lg border border-slate-300 px-2 py-1">
                <span className="text-[9px] font-black text-slate-700">
                  {isAr ? 'تقييم المنعكس' : 'DTR GRADE'}
                </span>
                <div className="flex gap-1">
                  {['0', '1+', '2+', '3+', '4+'].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => patchParams({ dtrGrade: g })}
                      className={`px-2 py-0.5 rounded text-[9px] font-black border cursor-pointer ${
                        dtr === g ? 'bg-sky-600 border-sky-800 text-white' : 'bg-white border-slate-300 text-slate-700'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <HardwareFader
                label={isAr ? 'المدى الحركي (°)' : 'MEASURED ROM (°)'}
                valueText={`${rom}°`}
                value={rom}
                min={15}
                max={165}
                step={5}
                lightBody
                accentClass="bg-sky-500"
                onChange={(v) => patchParams({ romDeg: v })}
              />
            )}
          </div>
        </div>

        {headProbe && (
          <button
            type="button"
            onClick={() => onSelectProbeToPlace(headProbe.id)}
            className={`w-16 rounded-2xl border-[3px] p-1 flex flex-col items-center justify-between text-center cursor-pointer shadow-xl ${
              device.selectedProbeId === headProbe.id
                ? 'bg-emerald-900 border-emerald-400 text-white'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-500 text-white'
            }`}
          >
            <span className="text-[8px] font-black text-sky-300">{tool.slice(0, 5)}</span>
            <span className="text-sm font-black text-white">⌖</span>
            <span
              className={`w-full py-0.5 rounded text-[8px] font-black ${
                headProbe.placed ? 'bg-emerald-400 text-slate-950' : 'bg-sky-400 text-slate-950'
              }`}
            >
              {headProbe.placed ? '✓ ON' : isAr ? 'موضع' : 'APPLY'}
            </span>
          </button>
        )}
      </div>
    );
  };

  // 21) SWISS GYM BALL RACK
  const renderBallRack = () => {
    const drill = String(params.tool ?? 'CORE STABILITY');
    const ballSz = String(params.ballSize ?? '55cm');

    return (
      <div className="w-[min(95vw,26.5rem)] select-none rounded-2xl bg-gradient-to-b from-cyan-50 via-slate-100 to-teal-100 border-[3px] border-teal-500 shadow-[0_14px_34px_rgba(0,0,0,0.65)] text-slate-900 overflow-hidden">
        {renderHardwareTopTrim('SWISS BALL LAB', true)}
        <div className="p-2 space-y-1.5">
          <div className="grid grid-cols-3 gap-1">
            {['CORE STABILITY', 'PELVIC TILT', 'SCAPULAR'].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => patchParams({ tool: d })}
                className={`py-1 rounded text-[8.5px] font-black border cursor-pointer ${
                  drill === d ? 'bg-teal-600 border-teal-800 text-white' : 'bg-white border-slate-400 text-slate-700'
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {['55cm', '65cm'].map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => patchParams({ ballSize: sz })}
                className={`py-1 rounded text-[10px] font-black border cursor-pointer ${
                  ballSz === sz ? 'bg-sky-600 border-sky-800 text-white' : 'bg-white border-slate-400 text-slate-700'
                }`}
              >
                {isAr ? `كرة سويسرية ${sz}` : `Swiss Ball ${sz}`}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderChassis = () => {
    switch (device.sprite) {
      case 'tens_unit':
        return renderTensUnit();
      case 'ultrasound_unit':
        return renderUltrasoundUnit();
      case 'laser_hilt':
        return renderLaserHilt();
      case 'shockwave_eswt':
        return renderShockwaveEswt();
      case 'swd_unit':
        return renderSwdUnit();
      case 'emg_biofeedback':
        return renderEmgBiofeedback();
      case 'cryo_unit':
        return renderCryoUnit();
      case 'cpm_device':
        return renderCpmPendant();
      case 'paraffin_bath':
      case 'hydro_sink':
        return renderThermalTank();
      case 'magnetotherapy':
        return renderMagnetotherapyConsole();
      case 'tilt_table':
        return renderTiltTableConsole();
      case 'traction_table':
        return renderTractionTable();
      case 'exercise_bike':
        return renderExerciseBike();
      case 'treadmill':
        return renderTreadmill();
      case 'parallel_bars':
        return renderParallelBars();
      case 'wall_bars':
        return renderWallBars();
      case 'multi_gym_pulley':
        return renderPulley();
      case 'hand_rehab_table':
        return renderHandRehabTable();
      case 'pt_toolkit_cart':
        return renderPtToolkitCart();
      case 'ball_rack':
        return renderBallRack();
      default:
        return renderBalanceTrainer();
    }
  };

  // Docked cleanly at the very bottom edge (never covers the focused patient above!)
  return (
    <div
      dir="ltr"
      className="pointer-events-none fixed inset-x-0 bottom-2.5 sm:bottom-4 z-40 flex justify-center px-2"
    >
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="pointer-events-auto max-h-[38vh] overflow-y-auto rounded-2xl shadow-2xl"
      >
        {renderChassis()}
      </div>
    </div>
  );
});
