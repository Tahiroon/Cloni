import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Armchair,
  BedDouble,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Coins,
  Eye,
  EyeOff,
  Hand,
  Lock,
  LogOut,
  MoveHorizontal,
  Pause,
  PersonStanding,
  Play,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Star,
  Stethoscope,
  Undo2,
  X,
  Zap,
} from 'lucide-react';
import { getFppDeviceCapability, getPostureRulesForStation } from '../data/catalog';
import {
  FppActiveDeviceState,
  FppHeldDeviceInfo,
  FppNearbyDeviceInfo,
  FppPatientPosture,
  FppTargetRegion,
  Language,
  LightingMode,
  PatientEntity,
  SpriteKind,
} from '../types/clinic';

type SessionStep = 'subjective' | 'redflags' | 'objective' | 'plan' | 'summary';

interface PresetQuestion {
  id: string;
  qAr: string;
  qEn: string;
  aAr: string;
  aEn: string;
}

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
  onCloseActiveDevice?: () => void;
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
  const activePointerId = useRef<number | null>(null);
  const [knob, setKnob] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const maxR = 30;

  useEffect(() => {
    return () => {
      moveInputRef.current = { x: 0, y: 0 };
    };
  }, [moveInputRef]);

  const updateFromClient = (clientX: number, clientY: number) => {
    const el = trackRef.current;
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
    setKnob({ x: dx, y: dy });
    moveInputRef.current = {
      x: dx / maxR,
      y: -dy / maxR,
    };
  };

  const resetStick = () => {
    activePointerId.current = null;
    setKnob({ x: 0, y: 0 });
    moveInputRef.current = { x: 0, y: 0 };
  };

  return (
    <div
      className="pointer-events-auto flex flex-col items-center gap-1 select-none"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <div
        ref={trackRef}
        onPointerDown={(e) => {
          e.stopPropagation();
          e.currentTarget.setPointerCapture(e.pointerId);
          activePointerId.current = e.pointerId;
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
        className={`relative w-24 h-24 rounded-full border touch-none flex items-center justify-center shadow-xl cursor-grab active:cursor-grabbing ${
          isNight
            ? 'bg-slate-950/90 border-sky-400/35'
            : 'bg-slate-900/82 border-white/25'
        }`}
      >
        <div className="absolute inset-2.5 rounded-full border border-dashed border-white/15 pointer-events-none" />
        <span className="absolute top-1 text-[8px] font-black text-sky-300/75 pointer-events-none">
          ▲
        </span>
        <span className="absolute bottom-1 text-[8px] font-black text-sky-300/75 pointer-events-none">
          ▼
        </span>
        <span className="absolute left-1.5 text-[8px] font-black text-sky-300/75 pointer-events-none">
          ◀
        </span>
        <span className="absolute right-1.5 text-[8px] font-black text-sky-300/75 pointer-events-none">
          ▶
        </span>
        <div
          style={{ transform: `translate3d(${knob.x}px, ${knob.y}px, 0)` }}
          className="w-9 h-9 rounded-full bg-gradient-to-b from-sky-400 to-sky-600 border-2 border-white/85 shadow-lg pointer-events-none"
        />
      </div>
      <span className="text-[10px] font-bold text-white/90 drop-shadow">
        {isAr ? 'تحرك' : 'Move'}
      </span>
    </div>
  );
};

export const FirstPersonSessionHud: React.FC<FirstPersonSessionHudProps> = ({
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
  onCloseActiveDevice,
  language,
  lightingMode = 'day',
  moveInputRef,
  onPatientSpeak,
  onRecenterCamera,
  onExit,
  onCompleteCase,
}) => {
  const [step, setStep] = useState<SessionStep>('subjective');
  const [panelHidden, setPanelHidden] = useState(false);
  const [postureOpen, setPostureOpen] = useState(false);
  const postureButtonRef = useRef<HTMLButtonElement | null>(null);
  const posturePopoverRef = useRef<HTMLDivElement | null>(null);
  const [openQuestionId, setOpenQuestionId] = useState<string | null>(null);
  const [askedIds, setAskedIds] = useState<string[]>([]);
  const [speechCaption, setSpeechCaption] = useState<string | null>(null);
  const [revealedTests, setRevealedTests] = useState<string[]>([]);
  const [redFlagChoice, setRedFlagChoice] = useState<'safe' | 'refer' | null>(null);
  const [selectedDiag, setSelectedDiag] = useState<string | null>(null);
  const [selectedTx, setSelectedTx] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<{
    score: number;
    coinsEarned: number;
    starsEarned: number;
    feedback: string;
    caughtRedFlag: boolean;
  } | null>(null);

  const c = patient.clinicalCase;
  const isAr = language === 'ar';
  const isNight = lightingMode === 'night';

  const activeCap = useMemo(
    () => (activeDevice ? getFppDeviceCapability(activeDevice.sprite) : null),
    [activeDevice]
  );
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
      if (
        postureButtonRef.current?.contains(target) ||
        posturePopoverRef.current?.contains(target)
      ) {
        return;
      }
      setPostureOpen(false);
    };
    window.addEventListener('pointerdown', handleOutside);
    return () => window.removeEventListener('pointerdown', handleOutside);
  }, [postureOpen]);

  const presetQuestions = useMemo<PresetQuestion[]>(() => {
    const complaintReplyAr = `أشعر بـ${c.chiefComplaintAr}، وقد بدأت المشكلة منذ ${c.onsetAr}.`;
    const complaintReplyEn = `I'm having ${c.chiefComplaintEn}, and it started ${c.onsetEn}.`;

    const modReplyAr = `يزداد الألم مع ${c.aggravatingAr}، بينما يخف عند ${c.easingAr}.`;
    const modReplyEn = `It gets worse with ${c.aggravatingEn}, and feels better with ${c.easingEn}.`;

    const redReplyAr = c.redFlagsPresent
      ? `بصراحة هناك أمر مقلق: ${c.redFlagClueAr}.`
      : `لا توجد أعراض خطرة؛ الأمر يتركز حول: ${c.redFlagClueAr}.`;
    const redReplyEn = c.redFlagsPresent
      ? `Honestly there is something concerning: ${c.redFlagClueEn}.`
      : `No alarming signs; mostly ${c.redFlagClueEn}.`;

    const painReplyAr = `شدة الألم لدي تقارب ${c.vasPain} من 10، خصوصاً أثناء الحركة.`;
    const painReplyEn = `My pain is around ${c.vasPain} out of 10, especially when moving.`;

    return [
      {
        id: 'q_complaint',
        qAr: 'ما شكواك الرئيسية ومتى بدأت؟',
        qEn: 'What is your main complaint and onset?',
        aAr: complaintReplyAr,
        aEn: complaintReplyEn,
      },
      {
        id: 'q_agg_ease',
        qAr: 'ما الذي يزيد الألم وما الذي يخففه؟',
        qEn: 'What aggravates or eases your pain?',
        aAr: modReplyAr,
        aEn: modReplyEn,
      },
      {
        id: 'q_redflag',
        qAr: 'هل يوقظك الألم ليلاً أو هناك تنميل وضعف؟',
        qEn: 'Any night pain, numbness, or weakness?',
        aAr: redReplyAr,
        aEn: redReplyEn,
      },
      {
        id: 'q_severity',
        qAr: 'كم تقيّم شدة الألم حالياً؟',
        qEn: 'How severe is your pain right now?',
        aAr: painReplyAr,
        aEn: painReplyEn,
      },
    ];
  }, [c]);

  const handleToggleQuestion = (item: PresetQuestion) => {
    const isAlreadyOpen = openQuestionId === item.id;
    const answerText = isAr ? item.aAr : item.aEn;
    setOpenQuestionId(isAlreadyOpen ? null : item.id);
    if (!isAlreadyOpen) {
      setAskedIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
      setSpeechCaption(answerText);
      onPatientSpeak(patient.id, 2600);
    }
  };

  const toggleObjectiveTest = (testId: string) => {
    const test = c.objectiveTests.find((t) => t.id === testId);
    setRevealedTests((prev) => (prev.includes(testId) ? prev : [...prev, testId]));
    if (test) {
      setSpeechCaption(
        isAr
          ? `${test.nameAr}: ${test.findingAr}`
          : `${test.nameEn}: ${test.findingEn}`
      );
    }
    onPatientSpeak(patient.id, 1600);
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

    let score = 40;
    if (correctRedFlag) score += 20;
    if (correctDiag) score += 20;
    if (correctTx) score += 20;

    const coinsEarned = Math.round(45 + score * 0.7);
    const starsEarned = score >= 80 ? 2 : score >= 60 ? 1 : 0;

    let feedbackText = isAr ? c.clinicalPearlAr : c.clinicalPearlEn;

    try {
      const res = await fetch('/api/clinical/evaluate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicalCase: c,
          redFlagCorrect: correctRedFlag,
          selectedDiagnosis: isAr ? diagObj?.labelAr : diagObj?.labelEn,
          diagnosisCorrect: correctDiag,
          selectedTreatment: isAr ? txObj?.labelAr : txObj?.labelEn,
          treatmentCorrect: correctTx,
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
        score,
        coinsEarned,
        starsEarned,
        feedback: feedbackText,
        caughtRedFlag: Boolean(c.redFlagsPresent && correctRedFlag),
      });
      setStep('summary');
      onPatientSpeak(patient.id, 2200);
    }
  };

  const stepDefs: Array<{ id: SessionStep; labelAr: string; labelEn: string; disabled?: boolean }> = [
    { id: 'subjective', labelAr: '1. التاريخ المرضي', labelEn: '1. History' },
    { id: 'redflags', labelAr: '2. التحذيرات', labelEn: '2. Red Flags' },
    { id: 'objective', labelAr: '3. الفحص', labelEn: '3. Exam' },
    { id: 'plan', labelAr: '4. التشخيص', labelEn: '4. Plan' },
    {
      id: 'summary',
      labelAr: '5. العلاج',
      labelEn: '5. Therapy',
      disabled: !evaluationResult,
    },
  ];

  const surfaceCls = isNight
    ? 'bg-slate-950/94 border-slate-700/80 text-slate-100'
    : 'bg-white/96 border-slate-200 text-slate-900';

  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between p-2.5 sm:p-3.5">
      {/* Top Compact Strip + Progressive Steps + Smart Non-Blocking Speech Caption */}
      <div className="flex flex-col gap-1.5">
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto flex items-center justify-between gap-2 rounded-2xl bg-slate-950/88 border border-white/15 px-3 py-1.5 text-white shadow-lg"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Stethoscope className="w-4 h-4 text-sky-400 shrink-0" />
            <div className="flex items-center gap-1.5 min-w-0 text-xs sm:text-[13px]">
              <span className="font-black truncate">
                {isAr ? c.patientNameAr : c.patientNameEn}
              </span>
              <span className="text-slate-500" aria-hidden="true">·</span>
              <span className="text-sky-300 font-bold tabular-nums shrink-0">
                {c.age} {isAr ? 'س' : 'y'}
              </span>
              <span className="hidden sm:inline text-slate-500" aria-hidden="true">·</span>
              <span className="hidden sm:inline text-slate-300 truncate max-w-[16rem] md:max-w-[24rem]">
                {isAr ? c.chiefComplaintAr : c.chiefComplaintEn}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div dir="ltr" className="hidden md:flex items-center gap-1.5 text-[11px] font-mono tabular-nums text-slate-300">
              <span>{c.vitals?.bp ?? '120/78'}</span>
              <span className="text-slate-600">·</span>
              <span>{c.vitals?.hr ?? 74} bpm</span>
              <span className="text-slate-600">·</span>
              <span className="text-rose-400 font-bold">VAS {c.vasPain}/10</span>
            </div>

            <button
              ref={postureButtonRef}
              type="button"
              onClick={() => setPostureOpen((v) => !v)}
              aria-expanded={postureOpen}
              aria-label={isAr ? 'التحكم بوضعية المريض' : 'Patient Posture'}
              title={isAr ? 'وضعية المريض' : 'Patient Posture'}
              className={`h-8 px-2 sm:px-2.5 rounded-xl border flex items-center gap-1.5 text-[11px] font-extrabold transition-colors cursor-pointer ${
                postureOpen
                  ? 'bg-sky-500 border-sky-300 text-slate-950'
                  : 'bg-slate-800 hover:bg-sky-600 border-white/10 text-slate-200 hover:text-white'
              }`}
            >
              <PersonStanding className="w-3.5 h-3.5 shrink-0" />
              <span dir="ltr" className="hidden sm:inline whitespace-nowrap">
                {activePostureRule?.labelEn ?? 'Sitting'}
              </span>
            </button>

            {postureOpen && (
              <div
                ref={posturePopoverRef}
                dir="ltr"
                onPointerDown={(e) => e.stopPropagation()}
                className="pointer-events-auto fixed left-1/2 -translate-x-1/2 top-14 sm:top-16 z-50 w-[min(92vw,18.5rem)] rounded-2xl bg-slate-950/96 border border-white/15 p-3 shadow-2xl text-white"
              >
                <div className="flex items-center justify-between gap-2 px-0.5 pb-2 mb-2 border-b border-white/10">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[11px] font-black tracking-wide text-slate-200 whitespace-nowrap">
                      Patient Posture
                    </span>
                    {stationNameEn && (
                      <span className="text-[10px] font-bold text-sky-400 truncate max-w-[8.5rem]">
                        · {stationNameEn}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPostureOpen(false)}
                    aria-label="Close"
                    className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

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
                        }}
                        title={!rule.available ? rule.reason : rule.labelEn}
                        className={`rounded-xl border px-2.5 py-2 text-left transition-colors flex flex-col gap-0.5 ${
                          !rule.available
                            ? 'bg-slate-950/60 border-white/5 text-slate-500 opacity-60 cursor-not-allowed'
                            : isActive
                              ? 'bg-sky-500 border-sky-300 text-slate-950 shadow-sm cursor-pointer'
                              : 'bg-slate-900 hover:bg-slate-800 border-white/10 text-slate-100 cursor-pointer'
                        }`}
                      >
                        <span className="flex items-center justify-between gap-1 text-[11px] font-extrabold">
                          <span className="flex items-center gap-1.5 truncate">
                            <IconCmp className="w-3.5 h-3.5 shrink-0" />
                            <span>{rule.labelEn}</span>
                          </span>
                          {!rule.available && <Lock className="w-2.5 h-2.5 shrink-0 text-slate-500" />}
                        </span>
                        {!rule.available && rule.reason && (
                          <span className="text-[9px] leading-tight font-medium text-slate-500 truncate">
                            {rule.reason}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {onRecenterCamera && (
              <button
                type="button"
                onClick={onRecenterCamera}
                aria-label={isAr ? 'توجيه الكاميرا نحو المريض' : 'Center on Patient'}
                title={isAr ? 'التركيز على المريض' : 'Center on Patient'}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-sky-600 border border-white/10 text-slate-200 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setPanelHidden((v) => !v)}
              aria-label={panelHidden ? (isAr ? 'إظهار اللوحة' : 'Show Panel') : isAr ? 'إخفاء اللوحة' : 'Hide Panel'}
              title={panelHidden ? (isAr ? 'إظهار اللوحة' : 'Show Panel') : isAr ? 'إخفاء اللوحة' : 'Hide Panel'}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
            >
              {panelHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={onExit}
              aria-label={isAr ? 'خروج من الجلسة' : 'Exit Session'}
              title={isAr ? 'خروج' : 'Exit'}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-rose-600 border border-white/15 text-slate-200 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Slender Stage Tabs */}
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto pb-0.5"
        >
          {stepDefs.map((s) => {
            const active = step === s.id && !panelHidden;
            return (
              <button
                key={s.id}
                type="button"
                disabled={s.disabled}
                onClick={() => {
                  setPanelHidden(false);
                  setStep(s.id);
                }}
                className={`h-8 px-2.5 rounded-xl text-[11px] sm:text-xs font-extrabold whitespace-nowrap shrink-0 border transition-colors ${
                  active
                    ? 'bg-sky-500 border-sky-300 text-slate-950 shadow'
                    : s.disabled
                      ? 'bg-slate-950/60 border-white/10 text-slate-500 cursor-not-allowed'
                      : 'bg-slate-950/85 hover:bg-slate-900 border-white/15 text-slate-100 cursor-pointer'
                }`}
              >
                {isAr ? s.labelAr : s.labelEn}
              </button>
            );
          })}
        </div>

        {/* Smart Floating Patient Speech Reply — positioned neatly in the side corner, never blocking patient's face */}
        {speechCaption && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="pointer-events-auto self-start max-w-[19rem] sm:max-w-xs rounded-2xl bg-slate-950/90 border border-sky-400/35 text-white px-3 py-2 shadow-xl flex items-start justify-between gap-2"
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
        )}
      </div>

      {/* Direct Single "Use" Button on Proximity + "Place" Bar While Carrying + Tapped Device Controls */}
      {!heldDevice && !activeDevice && nearbyDevice && nearbyDevice.canDeploy && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto fixed left-1/2 -translate-x-1/2 bottom-28 sm:bottom-32 z-40"
        >
          <button
            type="button"
            onClick={() => onGrabDevice?.(nearbyDevice.catalogId)}
            className="h-10 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 border border-sky-300 text-slate-950 shadow-2xl flex items-center gap-2 text-xs font-black transition-colors cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current shrink-0" />
            <span>{isAr ? 'استخدام' : 'Use'}</span>
            <span dir="ltr" className="text-[11px] font-bold opacity-85 whitespace-nowrap">
              {nearbyDevice.nameEn}
            </span>
          </button>
        </div>
      )}

      {heldDevice && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto fixed left-1/2 -translate-x-1/2 bottom-28 sm:bottom-32 z-40 flex flex-col items-center gap-1.5"
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
                {isAr ? `عند المريض (${heldDevice.nearBedRegion ?? ''})` : `Patient · ${heldDevice.nearBedRegion ?? ''}`}
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
            </button>

            <button
              type="button"
              onClick={() => onReturnDevice?.(heldDevice.catalogId)}
              title={isAr ? 'إرجاع لمكانه' : 'Return to standby'}
              className="h-10 px-3 rounded-xl bg-slate-900/95 hover:bg-rose-600 border border-white/15 text-white text-xs font-bold flex items-center gap-1 shadow-xl transition-colors cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5 shrink-0" />
              <span>{isAr ? 'إرجاع' : 'Return'}</span>
            </button>
          </div>
        </div>
      )}

      {!heldDevice && activeDevice && (
        <div
          dir="ltr"
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto fixed left-1/2 -translate-x-1/2 bottom-28 sm:bottom-32 z-40 max-w-[95vw] rounded-2xl bg-slate-950/94 border border-sky-400/40 px-2.5 py-2 text-white shadow-2xl flex flex-wrap items-center justify-center gap-1.5"
        >
          <span className="text-[11px] font-black text-sky-300 px-1.5 flex items-center gap-1.5 whitespace-nowrap">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                activeDevice.isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
              }`}
            />
            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>{activeDevice.nameEn}</span>
          </span>

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
                : isAr
                  ? 'تشغيل'
                  : 'Start'}
            </span>
          </button>

          {activeDevice.placementMode === 'bed' && activeCap?.isAdjustable && (
            <>
              <span className="text-slate-600" aria-hidden="true">|</span>
              {(['cervical', 'shoulder', 'lumbar', 'knee'] as FppTargetRegion[]).map((reg) => {
                const label =
                  reg === 'cervical'
                    ? 'Cervical'
                    : reg === 'shoulder'
                      ? 'Shoulder'
                      : reg === 'lumbar'
                        ? 'Lumbar'
                        : 'Knee';
                const isRegActive = activeDevice.region === reg;
                return (
                  <button
                    key={reg}
                    type="button"
                    onClick={() =>
                      onUpdateActiveDevice?.({ ...activeDevice, region: reg })
                    }
                    className={`h-7 px-2 rounded-lg text-[10px] font-extrabold border transition-colors cursor-pointer ${
                      isRegActive
                        ? 'bg-sky-500 border-sky-300 text-slate-950'
                        : 'bg-slate-900 hover:bg-slate-800 border-white/10 text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() =>
                  onUpdateActiveDevice?.({
                    ...activeDevice,
                    side: activeDevice.side === 'front' ? 'back' : 'front',
                  })
                }
                title="Switch Bed Side"
                className="h-7 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/15 text-[10px] font-extrabold text-amber-300 flex items-center gap-1 cursor-pointer"
              >
                <MoveHorizontal className="w-3 h-3 shrink-0" />
                <span>{activeDevice.side === 'front' ? 'Front Side' : 'Back Side'}</span>
              </button>

              {activeCap.supportsDistance && (
                <button
                  type="button"
                  onClick={() =>
                    onUpdateActiveDevice?.({
                      ...activeDevice,
                      closeRange: !activeDevice.closeRange,
                    })
                  }
                  className="h-7 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/15 text-[10px] font-extrabold text-emerald-300 cursor-pointer"
                >
                  {activeDevice.closeRange ? 'Near' : 'Far'}
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={() => onGrabDevice?.(activeDevice.catalogId)}
            className="h-7 px-2 rounded-lg bg-slate-800 hover:bg-sky-500 hover:text-slate-950 border border-white/15 text-slate-100 text-[10px] font-black flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Hand className="w-3 h-3 shrink-0" />
            <span>{isAr ? 'حمل' : 'Pick Up'}</span>
          </button>

          <button
            type="button"
            onClick={() => onReturnDevice?.(activeDevice.catalogId)}
            className="h-7 px-2 rounded-lg bg-rose-600/90 hover:bg-rose-500 text-white text-[10px] font-black flex items-center gap-1 cursor-pointer"
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
      )}

      {/* Bottom Row: Compact Joystick + Smart End-Docked Clinical Sheet */}
      <div className="flex items-end justify-between gap-3 w-full">
        <div className="shrink-0">
          <VirtualJoystick isAr={isAr} isNight={isNight} moveInputRef={moveInputRef} />
        </div>

        {!panelHidden && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className={`pointer-events-auto w-full max-w-[15.5rem] sm:max-w-[20.5rem] rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[33vh] sm:max-h-[40vh] ${surfaceCls}`}
          >
            <div className="p-2.5 sm:p-3 overflow-y-auto custom-scroll space-y-2 flex-1">
              {step === 'subjective' && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold opacity-75 px-0.5">
                    <span>{isAr ? 'اضغط على السؤال لسماع رد المريض' : 'Tap a question to hear the patient'}</span>
                    <span className="tabular-nums text-rose-500">VAS {c.vasPain}/10</span>
                  </div>

                  {presetQuestions.map((item) => {
                    const isOpen = openQuestionId === item.id;
                    const wasAsked = askedIds.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        className={`rounded-xl border transition-colors overflow-hidden ${
                          isOpen
                            ? isNight
                              ? 'border-sky-500/60 bg-sky-950/35'
                              : 'border-sky-300 bg-sky-50/85'
                            : isNight
                              ? 'border-slate-800 bg-slate-900/75'
                              : 'border-slate-200 bg-slate-50/75'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleQuestion(item)}
                          className="w-full px-2.5 py-2 flex items-center justify-between gap-2 text-start text-xs font-extrabold cursor-pointer"
                        >
                          <span className="leading-snug">{isAr ? item.qAr : item.qEn}</span>
                          <span className="shrink-0 text-sky-500 flex items-center gap-1">
                            {wasAsked && !isOpen && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            )}
                            {isOpen ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </span>
                        </button>
                        {isOpen && (
                          <div
                            className={`px-2.5 pb-2.5 pt-1 text-[11px] font-semibold leading-relaxed border-t ${
                              isNight
                                ? 'border-sky-800/50 text-slate-200'
                                : 'border-sky-200/80 text-slate-700'
                            }`}
                          >
                            {isAr ? item.aAr : item.aEn}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {step === 'redflags' && (
                <div className="space-y-2">
                  <div
                    className={`border rounded-xl p-2 flex items-start gap-2 text-xs ${
                      isNight ? 'bg-amber-950/45 border-amber-800/70' : 'bg-amber-50 border-amber-200'
                    }`}
                  >
                    <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="font-semibold leading-snug">
                      {isAr ? c.redFlagClueAr : c.redFlagClueEn}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setRedFlagChoice('safe')}
                    className={`w-full p-2.5 rounded-xl border-2 text-start flex items-center gap-2 text-xs font-extrabold cursor-pointer ${
                      redFlagChoice === 'safe'
                        ? 'border-emerald-500 bg-emerald-500/15'
                        : isNight
                          ? 'border-slate-800'
                          : 'border-slate-200'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{isAr ? 'آمن للعلاج الطبيعي' : 'Cleared for Physiotherapy'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRedFlagChoice('refer')}
                    className={`w-full p-2.5 rounded-xl border-2 text-start flex items-center gap-2 text-xs font-extrabold cursor-pointer ${
                      redFlagChoice === 'refer'
                        ? 'border-rose-500 bg-rose-500/15'
                        : isNight
                          ? 'border-slate-800'
                          : 'border-slate-200'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>{isAr ? 'علامة تحذيرية — تحويل طبي' : 'Red Flag — Urgent Referral'}</span>
                  </button>
                </div>
              )}

              {step === 'objective' && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold opacity-75 px-0.5">
                    {isAr ? 'اضغط على الاختبار لإجرائه:' : 'Tap test to examine:'}
                  </div>
                  {c.objectiveTests.map((test) => {
                    const revealed = revealedTests.includes(test.id);
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
                          className="w-full p-2 flex items-center justify-between gap-2 text-start text-xs font-extrabold cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Activity className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                            <span className="truncate">{isAr ? test.nameAr : test.nameEn}</span>
                          </div>
                          <span className="text-[11px] text-sky-500 shrink-0">
                            {revealed ? (isAr ? '✓ تم' : '✓ Done') : isAr ? 'فحص' : 'Test'}
                          </span>
                        </button>
                        {revealed && (
                          <div
                            className={`px-2.5 py-1.5 text-[11px] font-bold border-t ${
                              test.isPositive
                                ? isNight
                                  ? 'bg-amber-950/50 text-amber-200 border-amber-800/70'
                                  : 'bg-amber-50 text-amber-900 border-amber-200'
                                : isNight
                                  ? 'bg-emerald-950/50 text-emerald-200 border-emerald-800/70'
                                  : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                            }`}
                          >
                            {test.isPositive ? '▲ ' : '● '}
                            {isAr ? test.findingAr : test.findingEn}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {step === 'plan' && (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <div className="text-[11px] font-extrabold opacity-75">
                      {isAr ? 'التشخيص المرجح:' : 'Clinical Diagnosis:'}
                    </div>
                    {c.diagnosisOptions.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setSelectedDiag(d.id)}
                        className={`w-full text-start p-2 rounded-xl border-2 text-xs font-bold cursor-pointer ${
                          selectedDiag === d.id
                            ? 'border-sky-500 bg-sky-500/15'
                            : isNight
                              ? 'border-slate-800'
                              : 'border-slate-200'
                        }`}
                      >
                        {isAr ? d.labelAr : d.labelEn}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-1">
                    <div className="text-[11px] font-extrabold opacity-75">
                      {isAr ? 'العلاج النهائي:' : 'Final Treatment:'}
                    </div>
                    {c.treatmentOptions.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedTx(t.id)}
                        className={`w-full text-start p-2 rounded-xl border-2 text-xs font-bold cursor-pointer ${
                          selectedTx === t.id
                            ? 'border-emerald-500 bg-emerald-500/15'
                            : isNight
                              ? 'border-slate-800'
                              : 'border-slate-200'
                        }`}
                      >
                        {isAr ? t.labelAr : t.labelEn}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 'summary' && evaluationResult && (
                <div className="space-y-2 text-center">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
                    <ClipboardCheck className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-black tabular-nums">
                    {isAr ? `الدقة السريرية: ${evaluationResult.score}%` : `Accuracy: ${evaluationResult.score}%`}
                  </div>
                  <div className="flex items-center justify-center gap-3 text-xs font-black tabular-nums">
                    <span className="flex items-center gap-1 text-amber-500">
                      <Coins className="w-3.5 h-3.5" />+{evaluationResult.coinsEarned}
                    </span>
                    <span className="text-slate-400" aria-hidden="true">·</span>
                    <span className="flex items-center gap-1 text-sky-500">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />+{evaluationResult.starsEarned}
                    </span>
                  </div>
                  <div
                    className={`rounded-xl border p-2 text-start text-[11px] space-y-1 ${
                      isNight ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-1 font-extrabold text-sky-500">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{isAr ? 'التقييم الإكلينيكي:' : 'Clinical Note:'}</span>
                    </div>
                    <p className="leading-snug opacity-90">{evaluationResult.feedback}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Stage Action */}
            <div
              className={`p-2 border-t ${
                isNight ? 'border-slate-800 bg-slate-900/90' : 'border-slate-200 bg-slate-50'
              }`}
            >
              {step === 'subjective' && (
                <button
                  type="button"
                  onClick={() => setStep('redflags')}
                  className="w-full py-2 rounded-xl game-btn-blue text-white text-xs font-extrabold cursor-pointer"
                >
                  {isAr ? 'التالي: التحذيرات ←' : 'Next: Red Flags →'}
                </button>
              )}
              {step === 'redflags' && (
                <button
                  type="button"
                  disabled={!redFlagChoice}
                  onClick={() => setStep('objective')}
                  className="w-full py-2 rounded-xl game-btn-blue disabled:opacity-45 text-white text-xs font-extrabold cursor-pointer"
                >
                  {isAr ? 'التالي: الفحص السريري ←' : 'Next: Clinical Exam →'}
                </button>
              )}
              {step === 'objective' && (
                <button
                  type="button"
                  onClick={() => setStep('plan')}
                  className="w-full py-2 rounded-xl game-btn-blue text-white text-xs font-extrabold cursor-pointer"
                >
                  {isAr ? 'التالي: التشخيص والعلاج ←' : 'Next: Diagnosis & Plan →'}
                </button>
              )}
              {step === 'plan' && (
                <button
                  type="button"
                  disabled={!selectedDiag || !selectedTx || evaluating}
                  onClick={handleSubmitPlan}
                  className="w-full py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-45 text-white text-xs font-extrabold cursor-pointer"
                >
                  {evaluating
                    ? isAr
                      ? 'جارٍ التقييم...'
                      : 'Evaluating...'
                    : isAr
                      ? 'تأكيد الخطة ← العلاج النهائي'
                      : 'Confirm Plan → Final Therapy'}
                </button>
              )}
              {step === 'summary' && evaluationResult && (
                <button
                  type="button"
                  onClick={() =>
                    onCompleteCase({
                      patientId: patient.id,
                      coinsEarned: evaluationResult.coinsEarned,
                      starsEarned: evaluationResult.starsEarned,
                      satisfactionDelta: evaluationResult.score >= 80 ? 2 : 0,
                      caughtRedFlag: evaluationResult.caughtRedFlag,
                    })
                  }
                  className="w-full py-2 rounded-xl game-btn-gold text-slate-950 text-xs font-black cursor-pointer"
                >
                  {isAr ? 'بدء العلاج النهائي وإكمال الجلسة ✓' : 'Complete & Start Therapy ✓'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
