import React, { useEffect, useRef, useState } from 'react';
import {
  Flame,
  Hand,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ShieldAlert,
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

// Reusable tactile physical rotary knob (drag up/down or tap +/-)
const HardwareRotaryKnob: React.FC<{
  label: string;
  valueText: string;
  value: number;
  min: number;
  max: number;
  step: number;
  colorClass?: string;
  pointerColorClass?: string;
  size?: 'sm' | 'md';
  onChange: (nextVal: number) => void;
}> = ({
  label,
  valueText,
  value,
  min,
  max,
  step,
  colorClass = 'from-slate-200 to-slate-500 border-slate-600',
  pointerColorClass = 'bg-slate-900',
  size = 'md',
  onChange,
}) => {
  const dragStartRef = useRef<{ y: number; startVal: number; moved: boolean } | null>(null);
  const ratio = Math.max(0, Math.min(1, (value - min) / Math.max(1e-5, max - min)));
  const deg = -135 + ratio * 270;
  const dimCls = size === 'sm' ? 'w-9 h-9' : 'w-11 h-11';

  const commitDelta = (deltaSteps: number) => {
    const raw = value + deltaSteps * step;
    const snapped = Math.round(raw / step) * step;
    const clamped = Math.max(min, Math.min(max, Number(snapped.toFixed(2))));
    if (clamped !== value) onChange(clamped);
  };

  return (
    <div className="flex flex-col items-center gap-0.5 select-none">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => commitDelta(-1)}
          aria-label={`${label} decrease`}
          className="w-5 h-5 rounded bg-black/25 hover:bg-black/40 border border-white/15 text-[11px] font-black flex items-center justify-center cursor-pointer"
        >
          −
        </button>
        <div
          onPointerDown={(e) => {
            e.stopPropagation();
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              // ignore
            }
            dragStartRef.current = { y: e.clientY, startVal: value, moved: false };
          }}
          onPointerMove={(e) => {
            if (!dragStartRef.current) return;
            const dy = dragStartRef.current.y - e.clientY;
            if (Math.abs(dy) > 3) dragStartRef.current.moved = true;
            const span = max - min;
            const raw = dragStartRef.current.startVal + (dy / 90) * span;
            const snapped = Math.round(raw / step) * step;
            const clamped = Math.max(min, Math.min(max, Number(snapped.toFixed(2))));
            if (clamped !== value) onChange(clamped);
          }}
          onPointerUp={() => {
            if (dragStartRef.current && !dragStartRef.current.moved) {
              const next = value + step > max ? min : Number((value + step).toFixed(2));
              onChange(next);
            }
            dragStartRef.current = null;
          }}
          onPointerCancel={() => {
            dragStartRef.current = null;
          }}
          title="Drag up/down or tap"
          className={`relative ${dimCls} rounded-full bg-gradient-to-b ${colorClass} border-2 shadow-[0_3px_6px_rgba(0,0,0,0.45),inset_0_1px_1px_rgba(255,255,255,0.5)] flex items-start justify-center p-1 cursor-ns-resize touch-none`}
          style={{ transform: `rotate(${deg}deg)` }}
        >
          <span className={`w-1 h-3 rounded-full ${pointerColorClass}`} />
        </div>
        <button
          type="button"
          onClick={() => commitDelta(1)}
          aria-label={`${label} increase`}
          className="w-5 h-5 rounded bg-black/25 hover:bg-black/40 border border-white/15 text-[11px] font-black flex items-center justify-center cursor-pointer"
        >
          +
        </button>
      </div>
      <div className="text-[9px] font-black tracking-tight leading-none opacity-85 uppercase">
        {label} · <span className="font-mono">{valueText}</span>
      </div>
    </div>
  );
};

export const PhysicalDeviceController: React.FC<PhysicalDeviceControllerProps> = ({
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

  const params: DeviceConsoleParams = {
    ...getDefaultDeviceParams(device.sprite),
    ...(device.deviceParams ?? {}),
  };

  const probes: FppProbeAnchor[] =
    device.probeAnchors && device.probeAnchors.length > 0
      ? device.probeAnchors
      : getDefaultProbeAnchors(device.sprite);

  useEffect(() => {
    if (!device.isRunning) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.06, (now - last) / 1000);
      last = now;
      setTickPhase((p) => (p + dt * 2.8) % (Math.PI * 20));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [device.isRunning]);

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

  const resetTimer = () => {
    const curMin = params.timerMin ?? 15;
    patchParams({
      timerRemainingSec: curMin * 60,
      ...(device.sprite === 'shockwave_eswt' ? { deliveredShocks: 0 } : {}),
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

  const renderHardwareTopTrim = (title: string, lightBody = false) => (
    <div
      className={`px-3 py-1.5 flex items-center justify-between gap-2 border-b ${
        lightBody
          ? 'bg-slate-300/80 border-slate-400 text-slate-800'
          : 'bg-black/35 border-white/10 text-slate-200'
      }`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className={`w-2 h-2 rounded-full border border-black/40 shrink-0 ${
            running ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-slate-500'
          }`}
        />
        <span className="text-[10px] font-black tracking-wider uppercase truncate">{title}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onPickUp}
          title={isAr ? 'نقل الجهاز' : 'Move unit'}
          className={`h-6 px-1.5 rounded text-[9px] font-black flex items-center gap-0.5 border cursor-pointer ${
            lightBody
              ? 'bg-white/75 hover:bg-white border-slate-400 text-slate-800'
              : 'bg-white/10 hover:bg-white/20 border-white/15 text-white'
          }`}
        >
          <Hand className="w-2.5 h-2.5" />
          <span>{isAr ? 'نقل' : 'Move'}</span>
        </button>
        <button
          type="button"
          onClick={onReturn}
          title={isAr ? 'إرجاع' : 'Return'}
          className="h-6 px-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[9px] font-black flex items-center gap-0.5 cursor-pointer"
        >
          <Undo2 className="w-2.5 h-2.5" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={`w-6 h-6 rounded flex items-center justify-center border cursor-pointer ${
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

  // Small hardware 7-segment LED clock cell
  const renderLedClock = () => (
    <div className="inline-flex items-center gap-1 bg-[#08130f] border border-slate-600 rounded px-1.5 py-0.5 font-mono">
      <button
        type="button"
        onClick={() => adjustMinutes(-1)}
        className="w-4 h-4 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
      >
        <Minus className="w-2.5 h-2.5" />
      </button>
      <span className="text-[11px] font-black text-emerald-400 tabular-nums px-0.5">{timerStr}</span>
      <button
        type="button"
        onClick={() => adjustMinutes(1)}
        className="w-4 h-4 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
      >
        <Plus className="w-2.5 h-2.5" />
      </button>
      <button
        type="button"
        onClick={resetTimer}
        className="w-4 h-4 rounded bg-slate-800 hover:bg-sky-700 text-slate-300 flex items-center justify-center cursor-pointer"
      >
        <RotateCcw className="w-2.5 h-2.5" />
      </button>
    </div>
  );

  // 1) TENS UNIT — Compact Molded Ivory Electrotherapy Unit + 4 Rotary Knobs + Draped Cables
  const renderTensUnit = () => {
    const mA = Number(params.intensity ?? 16);
    const hz = Number(params.freqHz ?? 80);
    const us = Number(params.pulseUs ?? 120);
    const mode = params.mode ?? 'CONV';

    return (
      <div className="w-[min(94vw,27rem)] select-none">
        {/* Carry grip */}
        <div className="mx-auto w-28 h-2.5 rounded-t-lg bg-slate-300 border-x-2 border-t-2 border-slate-500" />
        <div className="rounded-2xl bg-gradient-to-b from-[#eef2f6] via-[#dce3ec] to-[#c7d1de] border-[3px] border-slate-500 shadow-[0_18px_40px_rgba(0,0,0,0.62)] text-slate-900 overflow-hidden">
          {renderHardwareTopTrim('TENS / IFC · 4-CH UNIT', true)}

          <div className="p-2.5 space-y-2">
            {/* Compact monochrome LCD + tactile program keys + START rocker */}
            <div className="grid grid-cols-12 gap-2 items-center">
              {/* Backlit 2-inch LCD window */}
              <div className="col-span-7 rounded-lg bg-[#1d2733] p-1.5 border-2 border-slate-600 shadow-inner">
                <div className="rounded bg-[#8fa89b] border border-slate-800 px-2 py-1.5 text-[#0f1f18] font-mono">
                  <div className="flex items-center justify-between text-[9px] font-black border-b border-[#0f1f18]/25 pb-0.5 mb-1">
                    <span>{mode} · CH1-4</span>
                    <span>{running ? '▶ OUT' : 'READY'}</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-black leading-none tabular-nums">{mA} mA</span>
                    <span className="text-xs font-black tabular-nums">{timerStr}</span>
                  </div>
                  <div className="flex items-center justify-between text-[9px] font-bold mt-1">
                    <span>{hz} Hz</span>
                    <span>{us} µs</span>
                  </div>
                </div>
              </div>

              {/* Tactile Start/Stop + Timer steppers + Waveform membrane keys */}
              <div className="col-span-5 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-1">
                  {renderLedClock()}
                  <button
                    type="button"
                    onClick={toggleRun}
                    className={`h-7 px-2.5 rounded border-2 text-[10px] font-black flex items-center gap-1 shadow cursor-pointer ${
                      running
                        ? 'bg-rose-600 border-rose-800 text-white'
                        : 'bg-emerald-500 border-emerald-700 text-slate-950'
                    }`}
                  >
                    {running ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                    <span>{running ? 'STOP' : 'RUN'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-1">
                  {['CONV', 'BURST', 'MOD', 'IFC'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => patchParams({ mode: m })}
                      className={`py-0.5 rounded border text-[8px] font-black cursor-pointer ${
                        mode === m
                          ? 'bg-sky-600 border-sky-800 text-white'
                          : 'bg-white border-slate-400 text-slate-700'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Physical Rotary Encoder Dials (Intensity, Freq, Width) */}
            <div className="rounded-xl bg-slate-300/90 border border-slate-400 px-2 py-1.5 flex items-center justify-around">
              <HardwareRotaryKnob
                label="CH INT"
                valueText={`${mA}mA`}
                value={mA}
                min={2}
                max={60}
                step={2}
                size="sm"
                colorClass="from-sky-400 to-sky-700 border-slate-700"
                pointerColorClass="bg-white"
                onChange={(v) => patchParams({ intensity: v })}
              />
              <HardwareRotaryKnob
                label="FREQ"
                valueText={`${hz}Hz`}
                value={hz}
                min={2}
                max={150}
                step={2}
                size="sm"
                colorClass="from-sky-400 to-sky-700 border-slate-700"
                pointerColorClass="bg-white"
                onChange={(v) => patchParams({ freqHz: v })}
              />
              <HardwareRotaryKnob
                label="WIDTH"
                valueText={`${us}µs`}
                value={us}
                min={50}
                max={250}
                step={10}
                size="sm"
                colorClass="from-sky-400 to-sky-700 border-slate-700"
                pointerColorClass="bg-white"
                onChange={(v) => patchParams({ pulseUs: v })}
              />
            </div>

            {/* Lower Socket Skirt + Curved Lead Wires + Clickable Adhesive Pads */}
            <div className="rounded-lg bg-slate-800 border border-slate-600 px-2 py-1.5 text-white">
              <div className="grid grid-cols-4 gap-1.5">
                {probes.map((probe, idx) => {
                  const isPos = idx % 2 === 0;
                  const isSel = device.selectedProbeId === probe.id;
                  return (
                    <button
                      key={probe.id}
                      type="button"
                      onClick={() => onSelectProbeToPlace(probe.id)}
                      className={`flex flex-col items-center rounded p-1 border cursor-pointer transition-colors ${
                        isSel
                          ? 'bg-emerald-500/25 border-emerald-400'
                          : probe.placed
                            ? 'bg-sky-500/20 border-sky-400'
                            : 'bg-slate-900 border-slate-700 hover:border-sky-400'
                      }`}
                    >
                      <svg viewBox="0 0 50 18" className="w-full h-4">
                        <circle
                          cx="25"
                          cy="4"
                          r="3.2"
                          fill={isPos ? '#dc2626' : '#020617'}
                          stroke="#94a3b8"
                          strokeWidth="1.2"
                        />
                        <path
                          d={idx < 2 ? 'M 25 7 C 19 13, 14 14, 25 17' : 'M 25 7 C 31 13, 36 14, 25 17'}
                          fill="none"
                          stroke={isPos ? '#ef4444' : '#475569'}
                          strokeWidth="2.2"
                          strokeLinecap="round"
                        />
                      </svg>
                      <span
                        className={`w-full py-0.5 rounded text-[9px] font-black text-center ${
                          probe.placed ? 'bg-emerald-400 text-slate-950' : 'bg-slate-200 text-slate-900'
                        }`}
                      >
                        {probe.placed ? `✓ ${probe.label}` : probe.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 2) ULTRASOUND — Steel Slanted Console + Side Transducer Cradle
  const renderUltrasoundUnit = () => {
    const freq = Number(params.freqHz ?? 1);
    const wcm2 = Number(params.intensity ?? 1.2);
    const duty = Number(params.dutyPct ?? 50);
    const headProbe = probes[0];

    return (
      <div className="w-[min(94vw,27rem)] select-none flex items-stretch gap-1.5">
        <div className="flex-1 rounded-2xl bg-gradient-to-b from-slate-600 via-slate-700 to-slate-800 border-[3px] border-slate-400 shadow-[0_18px_40px_rgba(0,0,0,0.65)] text-white overflow-hidden">
          {renderHardwareTopTrim(`SONIC ERA 5cm² · ${freq.toFixed(1)} MHz`)}

          <div className="p-2.5 space-y-2">
            <div className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-6 rounded-lg bg-[#0d1824] border-2 border-cyan-600/60 px-2.5 py-1.5 font-mono">
                <div className="flex justify-between text-[9px] text-cyan-300 font-black">
                  <span>{freq.toFixed(1)} MHz</span>
                  <span>{duty}%</span>
                </div>
                <div className="flex items-baseline justify-between mt-0.5">
                  <span className="text-base font-black text-white">{wcm2.toFixed(1)} W/cm²</span>
                </div>
                <div className="mt-1">{renderLedClock()}</div>
              </div>

              <div className="col-span-6 flex flex-col items-center gap-1.5">
                <HardwareRotaryKnob
                  label="POWER"
                  valueText={`${wcm2.toFixed(1)}W`}
                  value={wcm2}
                  min={0.2}
                  max={2.4}
                  step={0.1}
                  size="sm"
                  colorClass="from-slate-100 to-slate-400 border-slate-300 text-slate-900"
                  onChange={(v) => patchParams({ intensity: v })}
                />
                <button
                  type="button"
                  onClick={toggleRun}
                  className={`w-full py-1 rounded border-2 text-[10px] font-black flex items-center justify-center gap-1 cursor-pointer ${
                    running
                      ? 'bg-amber-500 border-amber-300 text-slate-950'
                      : 'bg-emerald-500 border-emerald-300 text-slate-950'
                  }`}
                >
                  {running ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                  <span>{running ? 'PAUSE' : 'EMIT'}</span>
                </button>
              </div>
            </div>

            {/* Tactile membrane switches */}
            <div className="flex items-center justify-between gap-1.5 bg-slate-900/70 rounded-lg border border-slate-600 p-1.5">
              <div className="flex gap-1">
                {[1, 3].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => patchParams({ freqHz: f })}
                    className={`px-2 py-0.5 rounded text-[9px] font-black border cursor-pointer ${
                      freq === f ? 'bg-cyan-500 border-cyan-300 text-slate-950' : 'bg-slate-800 border-slate-600 text-slate-200'
                    }`}
                  >
                    {f} MHz
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                {[20, 50, 100].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => patchParams({ dutyPct: d })}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-black border cursor-pointer ${
                      duty === d ? 'bg-emerald-500 border-emerald-300 text-slate-950' : 'bg-slate-800 border-slate-600 text-slate-300'
                    }`}
                  >
                    {d}%
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {headProbe && (
          <button
            type="button"
            onClick={() => onSelectProbeToPlace(headProbe.id)}
            className={`w-20 rounded-2xl border-[3px] p-1.5 flex flex-col items-center justify-between text-center cursor-pointer shadow-xl ${
              device.selectedProbeId === headProbe.id
                ? 'bg-emerald-900 border-emerald-400 text-white'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-400 text-white'
            }`}
          >
            <span className="text-[8px] font-black text-cyan-300">WAND</span>
            <svg viewBox="0 0 60 90" className="w-12 h-20">
              <ellipse cx="30" cy="14" rx="16" ry="9" fill="#e2e8f0" stroke="#64748b" strokeWidth="2" />
              <ellipse cx="30" cy="14" rx="10" ry="5" fill={running ? '#22d3ee' : '#94a3b8'} />
              <rect x="23" y="24" width="14" height="36" rx="4" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
              <path
                d="M 30 60 C 16 70, 40 76, 8 84"
                fill="none"
                stroke="#020617"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
            </svg>
            <span
              className={`w-full py-0.5 rounded text-[8px] font-black ${
                headProbe.placed ? 'bg-emerald-400 text-slate-950' : 'bg-cyan-400 text-slate-950'
              }`}
            >
              {headProbe.placed ? '✓ ON' : isAr ? 'ضع' : 'PLACE'}
            </span>
          </button>
        )}
      </div>
    );
  };

  // 3) LASER HILT — Dark Gunmetal Box + Red Mushroom E-Stop + Fiber Handpiece
  const renderLaserHilt = () => {
    const watts = Number(params.intensity ?? 10);
    const joules = Number(params.shocks ?? 850);
    const mode = params.mode ?? 'ANALGESIC';
    const headProbe = probes[0];

    return (
      <div className="w-[min(94vw,27.5rem)] select-none flex items-stretch gap-1.5">
        <div className="flex-1 rounded-2xl bg-gradient-to-b from-[#231f28] via-[#17141b] to-[#0d0a10] border-[3px] border-rose-500/75 shadow-[0_18px_40px_rgba(0,0,0,0.72)] text-white overflow-hidden">
          {renderHardwareTopTrim('HILT CLASS IV · 1064 nm')}

          <div className="p-2.5 space-y-2">
            <div className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-7 rounded-lg bg-[#120409] border-2 border-rose-500/50 px-2.5 py-1.5 font-mono">
                <div className="flex justify-between text-[9px] text-rose-300 font-black">
                  <span>{mode}</span>
                  <span>1064 nm</span>
                </div>
                <div className="flex items-baseline justify-between mt-0.5">
                  <span className="text-base font-black text-white">{watts.toFixed(1)} W</span>
                  <span className="text-xs font-black text-amber-300">{joules} J</span>
                </div>
                <div className="mt-1">{renderLedClock()}</div>
              </div>

              <div className="col-span-5 flex flex-col items-center gap-1.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => running && toggleRun()}
                    title="E-STOP"
                    className="w-8 h-8 rounded-full bg-red-600 border-2 border-yellow-400 flex items-center justify-center shadow cursor-pointer"
                  >
                    <ShieldAlert className="w-4 h-4 text-white" />
                  </button>
                  <button
                    type="button"
                    onClick={toggleRun}
                    className={`h-8 px-3 rounded border-2 text-[10px] font-black flex items-center gap-1 cursor-pointer ${
                      running ? 'bg-amber-500 border-amber-300 text-slate-950' : 'bg-rose-600 border-rose-400 text-white'
                    }`}
                  >
                    {running ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                    <span>{running ? 'OFF' : 'ARM'}</span>
                  </button>
                </div>
                <div className="flex gap-1 w-full">
                  {['ANALGESIC', 'BIOSTIM'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => patchParams({ mode: m })}
                      className={`flex-1 py-0.5 rounded text-[8px] font-black cursor-pointer ${
                        mode === m ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-black/35 border border-rose-500/30 px-2 py-1.5 flex items-center justify-around">
              <HardwareRotaryKnob
                label="WATTS"
                valueText={`${watts.toFixed(1)}W`}
                value={watts}
                min={1}
                max={15}
                step={0.5}
                size="sm"
                colorClass="from-rose-500 to-rose-800 border-rose-300"
                pointerColorClass="bg-white"
                onChange={(v) => patchParams({ intensity: v })}
              />
              <HardwareRotaryKnob
                label="ENERGY"
                valueText={`${joules}J`}
                value={joules}
                min={200}
                max={1800}
                step={50}
                size="sm"
                colorClass="from-amber-400 to-amber-700 border-amber-200"
                pointerColorClass="bg-slate-950"
                onChange={(v) => patchParams({ shocks: v })}
              />
            </div>
          </div>
        </div>

        {headProbe && (
          <button
            type="button"
            onClick={() => onSelectProbeToPlace(headProbe.id)}
            className={`w-20 rounded-2xl border-[3px] p-1.5 flex flex-col items-center justify-between text-center cursor-pointer shadow-xl ${
              device.selectedProbeId === headProbe.id
                ? 'bg-emerald-900 border-emerald-400 text-white'
                : 'bg-[#1a131b] hover:bg-[#271b28] border-rose-500/70 text-white'
            }`}
          >
            <span className="text-[8px] font-black text-rose-300">LASER</span>
            <svg viewBox="0 0 60 90" className="w-12 h-20">
              <circle cx="30" cy="10" r="4" fill={running ? '#f43f5e' : '#64748b'} />
              <path d="M 27 14 L 33 14 L 36 28 L 24 28 Z" fill="#f59e0b" />
              <rect x="23" y="28" width="14" height="34" rx="4" fill="#1e293b" stroke="#64748b" strokeWidth="1.5" />
              <path d="M 30 62 C 30 76, 16 82, 6 86" fill="none" stroke="#f59e0b" strokeWidth="3.5" strokeLinecap="round" />
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

  // 4) ESWT SHOCKWAVE — Riveted Aluminum Compressor + Side Ballistic Pistol
  const renderShockwaveEswt = () => {
    const bar = Number(params.intensity ?? 2.4);
    const hz = Number(params.freqHz ?? 10);
    const shocks = Number(params.shocks ?? 2000);
    const delivered = Math.round(Number(params.deliveredShocks ?? 0));
    const tip = params.tipSize ?? '15mm';
    const headProbe = probes[0];

    return (
      <div className="w-[min(94vw,27.5rem)] select-none flex items-stretch gap-1.5">
        <div className="flex-1 rounded-2xl bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 border-[3px] border-slate-500 shadow-[0_18px_40px_rgba(0,0,0,0.65)] text-slate-900 overflow-hidden">
          {renderHardwareTopTrim(`ESWT D-ACTOR ${tip}`, true)}

          <div className="p-2.5 space-y-2">
            <div className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-7 rounded-lg bg-[#0d1420] border-2 border-amber-500/60 px-2.5 py-1.5 font-mono text-white">
                <div className="flex justify-between text-[9px] text-amber-300 font-black">
                  <span>{bar.toFixed(1)} bar</span>
                  <span>{hz} Hz</span>
                </div>
                <div className="text-sm font-black text-emerald-300 mt-0.5">
                  {delivered}/{shocks} <span className="text-[9px] text-slate-400">SHK</span>
                </div>
                <div className="mt-1">{renderLedClock()}</div>
              </div>

              <div className="col-span-5 flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={toggleRun}
                  className={`py-2 rounded-lg border-2 text-[10px] font-black flex items-center justify-center gap-1 cursor-pointer ${
                    running ? 'bg-rose-600 border-rose-800 text-white' : 'bg-amber-500 border-amber-700 text-slate-950'
                  }`}
                >
                  {running ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  <span>{running ? 'STOP' : 'PULSE'}</span>
                </button>
                <div className="grid grid-cols-3 gap-1">
                  {['6mm', '15mm', '20mm'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => patchParams({ tipSize: t })}
                      className={`py-0.5 rounded text-[8px] font-black border cursor-pointer ${
                        tip === t ? 'bg-amber-600 border-amber-800 text-white' : 'bg-white border-slate-400 text-slate-700'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-slate-300 border border-slate-400 px-2 py-1.5 flex items-center justify-around">
              <HardwareRotaryKnob
                label="BAR"
                valueText={`${bar.toFixed(1)}`}
                value={bar}
                min={1}
                max={5}
                step={0.2}
                size="sm"
                colorClass="from-amber-400 to-amber-700 border-slate-700"
                onChange={(v) => patchParams({ intensity: v })}
              />
              <HardwareRotaryKnob
                label="FREQ"
                valueText={`${hz}Hz`}
                value={hz}
                min={1}
                max={21}
                step={1}
                size="sm"
                colorClass="from-slate-100 to-slate-400 border-slate-700"
                onChange={(v) => patchParams({ freqHz: v })}
              />
              <HardwareRotaryKnob
                label="COUNT"
                valueText={`${shocks}`}
                value={shocks}
                min={500}
                max={3000}
                step={250}
                size="sm"
                colorClass="from-slate-100 to-slate-400 border-slate-700"
                onChange={(v) => patchParams({ shocks: v })}
              />
            </div>
          </div>
        </div>

        {headProbe && (
          <button
            type="button"
            onClick={() => onSelectProbeToPlace(headProbe.id)}
            className={`w-20 rounded-2xl border-[3px] p-1.5 flex flex-col items-center justify-between text-center cursor-pointer shadow-xl ${
              device.selectedProbeId === headProbe.id
                ? 'bg-emerald-900 border-emerald-400 text-white'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-500 text-white'
            }`}
          >
            <span className="text-[8px] font-black text-amber-300">GUN</span>
            <svg viewBox="0 0 60 90" className="w-12 h-20">
              <rect x="36" y="14" width="16" height="9" rx="2" fill="#e2e8f0" stroke="#64748b" />
              <rect x="12" y="12" width="26" height="14" rx="3" fill="#475569" stroke="#cbd5e1" />
              <path d="M 16 26 L 28 26 L 23 60 L 12 60 Z" fill="#0f172a" stroke="#f59e0b" strokeWidth="1.5" />
              <path
                d="M 18 60 C 14 76, 36 80, 6 86"
                fill="none"
                stroke="#94a3b8"
                strokeWidth="3.5"
                strokeDasharray="3 2"
                strokeLinecap="round"
              />
            </svg>
            <span
              className={`w-full py-0.5 rounded text-[8px] font-black ${
                headProbe.placed ? 'bg-emerald-400 text-slate-950' : 'bg-amber-400 text-slate-950'
              }`}
            >
              {headProbe.placed ? '✓ ON' : isAr ? 'ضع' : 'PLACE'}
            </span>
          </button>
        )}
      </div>
    );
  };

  // 5) SWD DIATHERMY — 27.12 MHz Pedestal Head + Twin Cyan Tuning/Power Knobs + RF Drum
  const renderSwdUnit = () => {
    const watts = Number(params.intensity ?? 120);
    const mode = params.mode ?? 'CONT';
    const headProbe = probes[0];

    return (
      <div className="w-[min(94vw,27.5rem)] select-none flex items-stretch gap-1.5">
        <div className="flex-1 rounded-2xl bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 border-[3px] border-sky-400/75 shadow-[0_18px_40px_rgba(0,0,0,0.68)] text-white overflow-hidden">
          {renderHardwareTopTrim('SWD 27.12 MHz DIATHERMY')}

          <div className="p-2.5 space-y-2">
            <div className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-7 rounded-lg bg-[#091420] border-2 border-amber-500/45 px-2.5 py-1.5 font-mono">
                <div className="flex justify-between text-[9px] text-amber-300 font-black">
                  <span>{mode}</span>
                  <span>27.12 MHz</span>
                </div>
                <div className="text-base font-black text-white mt-0.5">
                  {watts} W{' '}
                  <span className="text-[9px] text-amber-300">
                    {watts >= 150 ? 'IV' : watts >= 90 ? 'III' : 'II'}
                  </span>
                </div>
                <div className="mt-1">{renderLedClock()}</div>
              </div>

              <div className="col-span-5 flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={toggleRun}
                  className={`py-2 rounded-lg border-2 text-[10px] font-black flex items-center justify-center gap-1 cursor-pointer ${
                    running ? 'bg-rose-600 border-rose-400 text-white' : 'bg-emerald-500 border-emerald-300 text-slate-950'
                  }`}
                >
                  {running ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  <span>{running ? 'STOP RF' : 'START RF'}</span>
                </button>
                <div className="grid grid-cols-2 gap-1">
                  {['CONT', 'PULSED'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => patchParams({ mode: m })}
                      className={`py-0.5 rounded text-[8px] font-black cursor-pointer ${
                        mode === m ? 'bg-amber-500 text-slate-950' : 'bg-slate-700 text-slate-200'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-black/30 border border-slate-600 px-2 py-1.5 flex items-center justify-around">
              <HardwareRotaryKnob
                label="RF OUTPUT"
                valueText={`${watts}W`}
                value={watts}
                min={20}
                max={200}
                step={10}
                size="sm"
                colorClass="from-cyan-400 to-cyan-700 border-slate-200"
                pointerColorClass="bg-slate-950"
                onChange={(v) => patchParams({ intensity: v })}
              />
            </div>
          </div>
        </div>

        {headProbe && (
          <button
            type="button"
            onClick={() => onSelectProbeToPlace(headProbe.id)}
            className={`w-20 rounded-2xl border-[3px] p-1.5 flex flex-col items-center justify-between text-center cursor-pointer shadow-xl ${
              device.selectedProbeId === headProbe.id
                ? 'bg-emerald-900 border-emerald-400 text-white'
                : 'bg-slate-900 hover:bg-slate-800 border-sky-400 text-white'
            }`}
          >
            <span className="text-[8px] font-black text-amber-300">DRUM</span>
            <svg viewBox="0 0 60 90" className="w-12 h-20">
              <ellipse cx="30" cy="24" rx="20" ry="15" fill="#1e293b" stroke="#38bdf8" strokeWidth="2.5" />
              <ellipse cx="30" cy="24" rx="12" ry="9" fill={running ? '#f59e0b' : '#475569'} />
              <path d="M 22 39 C 22 62, 16 74, 6 82" fill="none" stroke="#020617" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M 38 39 C 34 64, 22 78, 6 86" fill="none" stroke="#334155" strokeWidth="3.5" strokeLinecap="round" />
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

  // 6) EMG BIOFEEDBACK — Slim Enclosure + LED Bar + 3 Color Sensor Leads
  const renderEmgBiofeedback = () => {
    const thr = Number(params.intensity ?? 35);
    const gain = Number(params.freqHz ?? 2);
    const activeAmp = running ? Math.round(25 + Math.abs(Math.sin(tickPhase * 1.8)) * 55) : 0;

    return (
      <div className="w-[min(94vw,26.5rem)] select-none rounded-2xl bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 border-[3px] border-emerald-500/70 shadow-[0_18px_40px_rgba(0,0,0,0.68)] text-white overflow-hidden">
        {renderHardwareTopTrim(`sEMG BIOFEEDBACK · x${gain}`)}

        <div className="p-2.5 space-y-2">
          <div className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-7 rounded-lg bg-[#06130f] border-2 border-emerald-500/50 px-2.5 py-1.5 font-mono">
              <div className="flex justify-between text-[9px] text-amber-300 font-black">
                <span>THR {thr} µV</span>
                <span>SIG {activeAmp} µV</span>
              </div>
              {/* LED Bar Meter */}
              <div className="flex gap-1 my-1.5">
                {[15, 28, 42, 56, 70, 84, 96].map((v) => (
                  <span
                    key={v}
                    className={`h-2.5 flex-1 rounded-sm ${
                      activeAmp >= v
                        ? v >= thr
                          ? 'bg-amber-400'
                          : 'bg-emerald-400'
                        : 'bg-slate-800'
                    }`}
                  />
                ))}
              </div>
              <div>{renderLedClock()}</div>
            </div>

            <div className="col-span-5 flex flex-col items-center gap-1.5">
              <HardwareRotaryKnob
                label="THRESH"
                valueText={`${thr}µV`}
                value={thr}
                min={10}
                max={95}
                step={5}
                size="sm"
                colorClass="from-emerald-400 to-emerald-700 border-slate-200"
                onChange={(v) => patchParams({ intensity: v })}
              />
              <div className="flex gap-1 w-full">
                {[1, 2, 5].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => patchParams({ freqHz: g })}
                    className={`flex-1 py-0.5 rounded text-[9px] font-black cursor-pointer ${
                      gain === g ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-200'
                    }`}
                  >
                    x{g}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={toggleRun}
                  className={`px-2 py-0.5 rounded text-[9px] font-black cursor-pointer ${
                    running ? 'bg-amber-500 text-slate-950' : 'bg-emerald-400 text-slate-950'
                  }`}
                >
                  {running ? 'HOLD' : 'REC'}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-black/40 border border-emerald-600/35 p-1.5 grid grid-cols-3 gap-1.5">
            {probes.map((probe, idx) => {
              const wireColor = idx === 0 ? '#ef4444' : idx === 1 ? '#10b981' : '#f59e0b';
              const isSel = device.selectedProbeId === probe.id;
              return (
                <button
                  key={probe.id}
                  type="button"
                  onClick={() => onSelectProbeToPlace(probe.id)}
                  className={`flex flex-col items-center rounded p-1 border cursor-pointer ${
                    isSel
                      ? 'bg-emerald-500/25 border-emerald-400'
                      : probe.placed
                        ? 'bg-emerald-500/15 border-emerald-400/70'
                        : 'bg-slate-900 border-slate-700'
                  }`}
                >
                  <svg viewBox="0 0 50 16" className="w-full h-3.5">
                    <path d="M 25 1 C 18 8, 32 10, 25 15" fill="none" stroke={wireColor} strokeWidth="2.4" />
                  </svg>
                  <span
                    style={{ borderColor: wireColor }}
                    className={`w-full py-0.5 rounded-full border text-[9px] font-black text-center ${
                      probe.placed ? 'bg-emerald-400 text-slate-950' : 'bg-slate-800 text-white'
                    }`}
                  >
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

  // 7) CRYO TOWER — Glacier Control Box + Insulated Hose + Wrap Cuff
  const renderCryoUnit = () => {
    const tempC = Number(params.tempC ?? 4);
    const mmHg = Number(params.pressureMmHg ?? 45);
    const flow = params.flow ?? 'HIGH';
    const headProbe = probes[0];

    return (
      <div className="w-[min(94vw,27.5rem)] select-none flex items-stretch gap-1.5">
        <div className="flex-1 rounded-2xl bg-gradient-to-b from-slate-100 via-cyan-50 to-slate-200 border-[3px] border-cyan-500 shadow-[0_18px_40px_rgba(0,0,0,0.65)] text-slate-900 overflow-hidden">
          {renderHardwareTopTrim('CRYO-COMPRESSION UNIT', true)}

          <div className="p-2.5 space-y-2">
            <div className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-7 rounded-lg bg-[#071825] border-2 border-cyan-500/50 px-2.5 py-1.5 font-mono text-white">
                <div className="flex justify-between text-[9px] text-cyan-300 font-black">
                  <span className="flex items-center gap-0.5">
                    <Snowflake className="w-3 h-3" /> {tempC}°C
                  </span>
                  <span>{mmHg} mmHg</span>
                </div>
                <div className="text-xs font-black text-emerald-300 mt-0.5">FLOW: {flow}</div>
                <div className="mt-1">{renderLedClock()}</div>
              </div>

              <div className="col-span-5 flex flex-col items-center gap-1.5">
                <HardwareRotaryKnob
                  label="TEMP"
                  valueText={`${tempC}°C`}
                  value={tempC}
                  min={1}
                  max={12}
                  step={1}
                  size="sm"
                  colorClass="from-cyan-400 to-cyan-700 border-slate-600"
                  onChange={(v) => patchParams({ tempC: v })}
                />
                <button
                  type="button"
                  onClick={toggleRun}
                  className={`w-full py-1 rounded border-2 text-[10px] font-black flex items-center justify-center gap-1 cursor-pointer ${
                    running ? 'bg-amber-500 border-amber-700 text-slate-950' : 'bg-cyan-600 border-cyan-800 text-white'
                  }`}
                >
                  {running ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                  <span>{running ? 'PAUSE' : 'PUMP'}</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-1 bg-white/80 rounded-lg border border-cyan-300 p-1">
              <div className="flex gap-1">
                {[15, 30, 45, 60].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => patchParams({ pressureMmHg: p })}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-black cursor-pointer ${
                      mmHg === p ? 'bg-cyan-600 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                {['LOW', 'MED', 'HIGH'].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => patchParams({ flow: f })}
                    className={`px-1.5 py-0.5 rounded text-[8px] font-black cursor-pointer ${
                      flow === f ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {headProbe && (
          <button
            type="button"
            onClick={() => onSelectProbeToPlace(headProbe.id)}
            className={`w-20 rounded-2xl border-[3px] p-1.5 flex flex-col items-center justify-between text-center cursor-pointer shadow-xl ${
              device.selectedProbeId === headProbe.id
                ? 'bg-emerald-900 border-emerald-400 text-white'
                : 'bg-cyan-950 hover:bg-cyan-900 border-cyan-400 text-white'
            }`}
          >
            <span className="text-[8px] font-black text-cyan-300">CUFF</span>
            <svg viewBox="0 0 60 90" className="w-12 h-20">
              <rect x="14" y="14" width="32" height="40" rx="8" fill="#0284c7" stroke="#bae6fd" strokeWidth="2" />
              <path d="M 30 54 C 30 72, 16 80, 6 86" fill="none" stroke="#38bdf8" strokeWidth="5" strokeLinecap="round" />
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

  // 8) CPM HANDHELD PENDANT — Compact Wired Remote Shape
  const renderCpmPendant = () => {
    const extDeg = Number(params.extDeg ?? 0);
    const flexDeg = Number(params.flexDeg ?? 90);
    const speed = Number(params.speed ?? 2);
    const curWave = running ? 0.5 - 0.5 * Math.cos(tickPhase * (0.6 + speed * 0.35)) : 0.45;
    const curAngle = Math.round(extDeg + (flexDeg - extDeg) * curWave);

    return (
      <div className="w-[min(90vw,18.5rem)] select-none flex flex-col items-center">
        <div className="w-full rounded-[1.7rem] bg-gradient-to-b from-slate-100 via-sky-50 to-slate-200 border-[3px] border-sky-500 shadow-[0_18px_40px_rgba(0,0,0,0.68)] text-slate-900 overflow-hidden">
          {renderHardwareTopTrim('CPM PENDANT', true)}
          <div className="p-2.5 space-y-2">
            <div className="rounded-lg bg-[#081624] border border-sky-500/60 px-2.5 py-1.5 text-white font-mono flex items-center justify-between">
              <div>
                <div className="text-[9px] text-sky-300">ANGLE</div>
                <div className="text-lg font-black">{curAngle}°</div>
              </div>
              {renderLedClock()}
            </div>

            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
              <div className="rounded-lg bg-white border border-slate-300 p-1.5 flex items-center justify-between">
                <span className="font-black">EXT {extDeg}°</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => patchParams({ extDeg: Math.max(-10, extDeg - 5) })}
                    className="w-6 h-5 rounded bg-slate-200 font-black cursor-pointer"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={() => patchParams({ extDeg: Math.min(30, extDeg + 5) })}
                    className="w-6 h-5 rounded bg-slate-200 font-black cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="rounded-lg bg-white border border-slate-300 p-1.5 flex items-center justify-between">
                <span className="font-black">FLEX {flexDeg}°</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => patchParams({ flexDeg: Math.max(35, flexDeg - 5) })}
                    className="w-6 h-5 rounded bg-slate-200 font-black cursor-pointer"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={() => patchParams({ flexDeg: Math.min(120, flexDeg + 5) })}
                    className="w-6 h-5 rounded bg-slate-200 font-black cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-1.5">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => patchParams({ speed: s })}
                    className={`w-6 h-6 rounded text-[10px] font-black cursor-pointer ${
                      speed === s ? 'bg-sky-600 text-white' : 'bg-white border border-slate-300 text-slate-700'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={toggleRun}
                className={`px-3 py-1.5 rounded-lg border-2 text-xs font-black flex items-center gap-1 cursor-pointer ${
                  running ? 'bg-rose-600 border-rose-800 text-white' : 'bg-emerald-500 border-emerald-700 text-slate-950'
                }`}
              >
                {running ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>{running ? 'HOLD' : 'RUN'}</span>
              </button>
            </div>
          </div>
        </div>
        <svg viewBox="0 0 60 18" className="w-12 h-4 -mt-0.5">
          <path d="M 30 0 C 18 5, 42 10, 26 17" fill="none" stroke="#0f172a" strokeWidth="4.5" strokeLinecap="round" />
        </svg>
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
    const modes = isHydro ? ['CERVICAL', 'STD PACK', 'OVERSIZE'] : ['DIP&WRAP', 'IMMERSION', 'BRUSH'];
    const hotPackProbe = probes[0];

    return (
      <div className="w-[min(94vw,26.5rem)] select-none flex items-stretch gap-1.5">
        <div
          className={`flex-1 rounded-2xl border-[3px] shadow-[0_18px_40px_rgba(0,0,0,0.65)] overflow-hidden ${
            isHydro
              ? 'bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 border-slate-500 text-slate-900'
              : 'bg-gradient-to-b from-amber-50 via-slate-100 to-amber-100 border-amber-400 text-slate-900'
          }`}
        >
          {renderHardwareTopTrim(isHydro ? 'HYDROCOLLATOR TANK' : 'PARAFFIN WAX BATH', true)}
          <div className="p-2.5 space-y-2">
            <div className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-7 rounded-lg bg-[#16120c] border-2 border-amber-500/50 px-2.5 py-1.5 text-white font-mono">
                <div className="flex items-center justify-between text-[9px] text-amber-300">
                  <span className="flex items-center gap-0.5">
                    <Flame className="w-3 h-3" /> {mode}
                  </span>
                </div>
                <div className="text-lg font-black text-amber-300">{tempC} °C</div>
                <div className="mt-1">{renderLedClock()}</div>
              </div>
              <div className="col-span-5 flex flex-col items-center gap-1.5">
                <HardwareRotaryKnob
                  label="TEMP"
                  valueText={`${tempC}°C`}
                  value={tempC}
                  min={minT}
                  max={maxT}
                  step={1}
                  size="sm"
                  colorClass="from-amber-400 to-amber-700 border-slate-700"
                  onChange={(v) => patchParams({ tempC: v })}
                />
                <button
                  type="button"
                  onClick={toggleRun}
                  className={`w-full py-1 rounded border-2 text-[10px] font-black flex items-center justify-center gap-1 cursor-pointer ${
                    running ? 'bg-rose-600 border-rose-800 text-white' : 'bg-amber-500 border-amber-700 text-slate-950'
                  }`}
                >
                  {running ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                  <span>{running ? 'OFF' : 'HEAT'}</span>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {modes.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => patchParams({ mode: m })}
                  className={`py-0.5 rounded text-[8px] font-black border cursor-pointer ${
                    mode === m ? 'bg-amber-600 border-amber-800 text-white' : 'bg-white border-slate-400 text-slate-700'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isHydro && hotPackProbe && (
          <button
            type="button"
            onClick={() => onSelectProbeToPlace(hotPackProbe.id)}
            className={`w-20 rounded-2xl border-[3px] p-1.5 flex flex-col items-center justify-between text-center cursor-pointer shadow-xl ${
              device.selectedProbeId === hotPackProbe.id
                ? 'bg-emerald-900 border-emerald-400 text-white'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-500 text-white'
            }`}
          >
            <span className="text-[8px] font-black text-amber-300">PACK</span>
            <svg viewBox="0 0 60 76" className="w-12 h-16">
              <rect x="12" y="14" width="36" height="48" rx="6" fill="#d97706" stroke="#fde68a" strokeWidth="2" />
              <line x1="12" y1="30" x2="48" y2="30" stroke="#fbbf24" strokeWidth="1.5" />
              <line x1="12" y1="46" x2="48" y2="46" stroke="#fbbf24" strokeWidth="1.5" />
            </svg>
            <span
              className={`w-full py-0.5 rounded text-[8px] font-black ${
                hotPackProbe.placed ? 'bg-emerald-400 text-slate-950' : 'bg-amber-400 text-slate-950'
              }`}
            >
              {hotPackProbe.placed ? '✓ ON' : isAr ? 'ضع' : 'PACK'}
            </span>
          </button>
        )}
      </div>
    );
  };

  // 10) BALANCE TRAINER — Posturography Column Head
  const renderBalanceTrainer = () => {
    const lvl = Number(params.intensity ?? 2);
    const mode = params.mode ?? 'FIRM EO';

    return (
      <div className="w-[min(94vw,24rem)] select-none rounded-2xl bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 border-[3px] border-emerald-500/75 shadow-[0_18px_40px_rgba(0,0,0,0.68)] text-white overflow-hidden">
        {renderHardwareTopTrim(`BALANCE TRAINER · LVL ${lvl}`)}
        <div className="p-2.5 space-y-2">
          <div className="flex items-center justify-between gap-2 bg-[#041016] border border-emerald-500/50 rounded-lg px-2.5 py-1.5 font-mono">
            <div>
              <div className="text-[9px] text-emerald-300">{mode}</div>
              <div className="text-sm font-black">LEVEL {lvl}</div>
            </div>
            {renderLedClock()}
            <button
              type="button"
              onClick={toggleRun}
              className={`px-3 py-1 rounded text-[10px] font-black cursor-pointer ${
                running ? 'bg-amber-500 text-slate-950' : 'bg-emerald-500 text-slate-950'
              }`}
            >
              {running ? 'STOP' : 'TEST'}
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {['FIRM EO', 'FIRM EC', 'FOAM EO', 'DYNAMIC'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => patchParams({ mode: m })}
                className={`py-0.5 rounded text-[8px] font-black cursor-pointer ${
                  mode === m ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-5 gap-1">
            {[1, 2, 3, 4, 5].map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => patchParams({ intensity: l })}
                className={`py-0.5 rounded text-[10px] font-black cursor-pointer ${
                  lvl === l ? 'bg-sky-500 text-slate-950' : 'bg-slate-700 text-slate-200'
                }`}
              >
                L{l}
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
        className="pointer-events-auto max-h-[36vh] overflow-y-auto rounded-2xl shadow-2xl"
      >
        {renderChassis()}
      </div>
    </div>
  );
};
