import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Coins,
  MessageSquare,
  Send,
  ShieldAlert,
  Sparkles,
  Star,
  Stethoscope,
  X,
} from 'lucide-react';
import { ClinicalCase, Language, LightingMode, PatientEntity } from '../types/clinic';

interface ClinicalAssessmentModalProps {
  patient: PatientEntity | null;
  language: Language;
  lightingMode?: LightingMode;
  onClose: () => void;
  onCompleteCase: (result: {
    patientId: string;
    coinsEarned: number;
    starsEarned: number;
    satisfactionDelta: number;
    caughtRedFlag: boolean;
  }) => void;
  onUpdatePatientCase?: (patientId: string, nextCase: ClinicalCase) => void;
}

type ExamStep = 'subjective' | 'redflags' | 'objective' | 'plan' | 'summary';

export const ClinicalAssessmentModal: React.FC<ClinicalAssessmentModalProps> = ({
  patient,
  language,
  lightingMode = 'day',
  onClose,
  onCompleteCase,
}) => {
  const [step, setStep] = useState<ExamStep>('subjective');
  const [revealedTests, setRevealedTests] = useState<string[]>([]);
  const [redFlagChoice, setRedFlagChoice] = useState<'safe' | 'refer' | null>(null);
  const [selectedDiag, setSelectedDiag] = useState<string | null>(null);
  const [selectedTx, setSelectedTx] = useState<string | null>(null);
  const [studentNote, setStudentNote] = useState('');
  const [questionInput, setQuestionInput] = useState('');
  const [chatLog, setChatLog] = useState<Array<{ q: string; a: string }>>([]);
  const [askingAi, setAskingAi] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<{
    score: number;
    coinsEarned: number;
    starsEarned: number;
    feedback: string;
    caughtRedFlag: boolean;
  } | null>(null);

  if (!patient) return null;
  const c = patient.clinicalCase;
  const isAr = language === 'ar';
  const isNight = lightingMode === 'night';

  const quickQuestions = isAr
    ? [
        'هل يوقظك الألم أثناء النوم ليلاً؟',
        'هل تشعر بتنميل أو ضعف مفاجئ في العضلات؟',
        'هل تتحسن الأعراض مع تغيير الوضعية؟',
      ]
    : [
        'Does the pain wake you up at night?',
        'Any numbness, tingling, or sudden muscle weakness?',
        'Do symptoms change with specific postures?',
      ];

  const handleAskPatient = async (questionText: string) => {
    const q = questionText.trim();
    if (!q || askingAi) return;
    setAskingAi(true);
    setQuestionInput('');

    try {
      const res = await fetch('/api/clinical/ask-patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicalCase: c,
          question: q,
          language,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setChatLog((prev) => [...prev, { q, a: data.answer }]);
      } else {
        throw new Error('offline');
      }
    } catch {
      const fallbackAnswer = c.redFlagsPresent
        ? isAr
          ? `نعم دكتور، الأعراض مستمرة ومقلقة، خاصة: ${c.redFlagClueAr}`
          : `Yes doctor, symptoms feel concerning: ${c.redFlagClueEn}`
        : isAr
          ? `يزداد الألم مع ${c.aggravatingAr}، ولكن يخف عند ${c.easingAr}.`
          : `It worsens with ${c.aggravatingEn}, and eases with ${c.easingEn}.`;
      setChatLog((prev) => [...prev, { q, a: fallbackAnswer }]);
    } finally {
      setAskingAi(false);
    }
  };

  const toggleObjectiveTest = (testId: string) => {
    setRevealedTests((prev) => (prev.includes(testId) ? prev : [...prev, testId]));
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
          studentNote,
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
      setEvaluationResult({
        score,
        coinsEarned,
        starsEarned,
        feedback: feedbackText,
        caughtRedFlag: Boolean(c.redFlagsPresent && correctRedFlag),
      });
      setStep('summary');
    }
  };

  const steps: Array<{ id: ExamStep; labelAr: string; labelEn: string }> = [
    { id: 'subjective', labelAr: '1. التاريخ', labelEn: '1. Subjective' },
    { id: 'redflags', labelAr: '2. التحذيرات', labelEn: '2. Red Flags' },
    { id: 'objective', labelAr: '3. الفحص', labelEn: '3. Objective' },
    { id: 'plan', labelAr: '4. الخطة', labelEn: '4. Plan' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/75">
      <div
        className={`w-full max-w-lg rounded-3xl shadow-2xl border overflow-hidden flex flex-col max-h-[90vh] ${
          isNight ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-sky-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div
          className={`px-4 py-3.5 text-white flex items-center justify-between gap-3 ${
            isNight
              ? 'bg-gradient-to-r from-[#061124] via-[#0c264a] to-[#083358]'
              : 'bg-gradient-to-r from-[#0f294a] via-[#15457a] to-[#0284c7]'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <Stethoscope className="w-5 h-5 text-sky-200" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-extrabold truncate">
                  {isAr ? c.patientNameAr : c.patientNameEn}
                </h2>
                <span className="text-[11px] font-bold text-sky-200 tabular-nums">
                  · {c.age} {isAr ? 'سنة' : 'y/o'}
                </span>
              </div>
              <p className="text-xs text-sky-100/85 truncate">
                {isAr ? c.occupationAr : c.occupationEn}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close clinical case"
            className="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Clinical Vitals EMR Strip */}
        <div
          dir="ltr"
          className="px-4 py-2 bg-slate-950 text-slate-200 border-b border-slate-800 flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums overflow-x-auto"
        >
          <span>BP {c.vitals?.bp ?? '120/78'}</span>
          <span className="text-slate-600">·</span>
          <span>HR {c.vitals?.hr ?? 74} bpm</span>
          <span className="text-slate-600">·</span>
          <span>SpO₂ {c.vitals?.spo2 ?? 99}%</span>
          <span className="text-slate-600">·</span>
          <span>{c.vitals?.temp ?? '36.7°C'}</span>
          <span className="text-slate-600">·</span>
          <span className="text-rose-400 font-bold">VAS {c.vasPain}/10</span>
        </div>

        {/* Step Indicator */}
        {step !== 'summary' && (
          <div
            className={`grid grid-cols-4 gap-1 p-2 border-b ${
              isNight ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
            }`}
          >
            {steps.map((s) => {
              const active = step === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStep(s.id)}
                  className={`py-2 px-1 rounded-xl text-[11px] font-extrabold transition-colors truncate ${
                    active
                      ? isNight
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'bg-white text-sky-700 shadow-sm'
                      : isNight
                        ? 'text-slate-400 hover:text-slate-200'
                        : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {isAr ? s.labelAr : s.labelEn}
                </button>
              );
            })}
          </div>
        )}

        {/* Body */}
        <div className="p-4 overflow-y-auto custom-scroll space-y-4 flex-1">
          {step === 'subjective' && (
            <>
              <div
                className={`border rounded-2xl p-3.5 space-y-2 ${
                  isNight ? 'bg-sky-950/45 border-sky-800/70' : 'bg-sky-50/80 border-sky-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-extrabold ${isNight ? 'text-sky-300' : 'text-sky-800'}`}>
                    {isAr ? 'الشكوى الرئيسية' : 'Chief Complaint'}
                  </span>
                  <span className="text-xs font-black text-rose-500 tabular-nums">
                    VAS {c.vasPain}/10
                  </span>
                </div>
                <p className={`text-sm font-bold leading-relaxed ${isNight ? 'text-slate-100' : 'text-slate-900'}`}>
                  {isAr ? c.chiefComplaintAr : c.chiefComplaintEn}
                </p>
                <div className={`grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t text-xs ${isNight ? 'border-sky-800/60' : 'border-sky-200/70'}`}>
                  <div>
                    <span className={`font-bold block ${isNight ? 'text-slate-400' : 'text-slate-500'}`}>
                      {isAr ? 'البداية:' : 'Onset:'}
                    </span>
                    <span className={`font-semibold ${isNight ? 'text-slate-200' : 'text-slate-800'}`}>
                      {isAr ? c.onsetAr : c.onsetEn}
                    </span>
                  </div>
                  <div>
                    <span className={`font-bold block ${isNight ? 'text-slate-400' : 'text-slate-500'}`}>
                      {isAr ? 'يزيد الألم:' : 'Aggravating:'}
                    </span>
                    <span className={`font-semibold ${isNight ? 'text-slate-200' : 'text-slate-800'}`}>
                      {isAr ? c.aggravatingAr : c.aggravatingEn}
                    </span>
                  </div>
                  <div>
                    <span className={`font-bold block ${isNight ? 'text-slate-400' : 'text-slate-500'}`}>
                      {isAr ? 'يخفف الألم:' : 'Easing:'}
                    </span>
                    <span className={`font-semibold ${isNight ? 'text-slate-200' : 'text-slate-800'}`}>
                      {isAr ? c.easingAr : c.easingEn}
                    </span>
                  </div>
                </div>
              </div>

              {/* Interactive AI Patient History Chat */}
              <div className="space-y-2">
                <div className={`flex items-center gap-1.5 text-xs font-extrabold ${isNight ? 'text-slate-200' : 'text-slate-700'}`}>
                  <MessageSquare className="w-4 h-4 text-sky-500" />
                  <span>{isAr ? 'اسأل المريض (مقابلة تفاعلية)' : 'Ask Patient (Interactive History)'}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {quickQuestions.map((qq) => (
                    <button
                      key={qq}
                      type="button"
                      onClick={() => handleAskPatient(qq)}
                      className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl transition-colors text-start ${
                        isNight
                          ? 'bg-slate-800 hover:bg-sky-900/60 text-slate-200 hover:text-sky-200'
                          : 'bg-slate-100 hover:bg-sky-100 text-slate-700 hover:text-sky-800'
                      }`}
                    >
                      {qq}
                    </button>
                  ))}
                </div>

                {chatLog.length > 0 && (
                  <div
                    className={`space-y-2 border rounded-2xl p-3 max-h-36 overflow-y-auto custom-scroll ${
                      isNight ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    {chatLog.map((entry, idx) => (
                      <div key={idx} className="space-y-1 text-xs">
                        <div className={`font-bold ${isNight ? 'text-sky-400' : 'text-sky-800'}`}>
                          {isAr ? 'أنت:' : 'You:'} {entry.q}
                        </div>
                        <div
                          className={`p-2 rounded-xl border ${
                            isNight
                              ? 'text-slate-200 bg-slate-900 border-slate-800'
                              : 'text-slate-700 bg-white border-slate-200'
                          }`}
                        >
                          {entry.a}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={questionInput}
                    onChange={(e) => setQuestionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAskPatient(questionInput);
                    }}
                    placeholder={isAr ? 'اكتب سؤالاً سريرياً للمريض...' : 'Ask the patient a clinical question...'}
                    className={`flex-1 px-3 py-2.5 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                      isNight ? 'bg-slate-800 text-slate-100 placeholder:text-slate-400' : 'bg-slate-100 text-slate-900'
                    }`}
                  />
                  <button
                    type="button"
                    disabled={askingAi || !questionInput.trim()}
                    onClick={() => handleAskPatient(questionInput)}
                    className="w-10 h-10 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white flex items-center justify-center shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}

          {step === 'redflags' && (
            <div className="space-y-3">
              <div
                className={`border rounded-2xl p-3.5 flex items-start gap-2.5 ${
                  isNight ? 'bg-amber-950/45 border-amber-800/70' : 'bg-amber-50 border-amber-200'
                }`}
              >
                <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className={`text-xs space-y-1 ${isNight ? 'text-amber-100' : 'text-amber-950'}`}>
                  <div className="font-extrabold text-sm">
                    {isAr ? 'فحص العلامات التحذيرية (Red Flags)' : 'Red Flags Clinical Screening'}
                  </div>
                  <p className="leading-relaxed">
                    {isAr
                      ? 'بناءً على الأعراض والعلامات الحيوية: ' + c.redFlagClueAr
                      : 'Based on clinical cues: ' + c.redFlagClueEn}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                <button
                  type="button"
                  onClick={() => setRedFlagChoice('safe')}
                  className={`p-3.5 rounded-2xl border-2 text-start transition-all flex items-center gap-3 ${
                    redFlagChoice === 'safe'
                      ? isNight
                        ? 'border-emerald-500 bg-emerald-950/50'
                        : 'border-emerald-500 bg-emerald-50'
                      : isNight
                        ? 'border-slate-700 hover:border-slate-600'
                        : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <div>
                    <div className={`text-sm font-extrabold ${isNight ? 'text-slate-100' : 'text-slate-900'}`}>
                      {isAr ? 'آمن للعلاج الطبيعي (لا توجد موانع خطرة)' : 'Cleared for Physiotherapy (No Red Flags)'}
                    </div>
                    <div className={`text-xs ${isNight ? 'text-slate-400' : 'text-slate-500'}`}>
                      {isAr ? 'يمكن متابعة الفحص السريري والخطة التأهيلية' : 'Proceed safely with physical exam & rehab'}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRedFlagChoice('refer')}
                  className={`p-3.5 rounded-2xl border-2 text-start transition-all flex items-center gap-3 ${
                    redFlagChoice === 'refer'
                      ? isNight
                        ? 'border-rose-500 bg-rose-950/50'
                        : 'border-rose-500 bg-rose-50'
                      : isNight
                        ? 'border-slate-700 hover:border-slate-600'
                        : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                  <div>
                    <div className={`text-sm font-extrabold ${isNight ? 'text-slate-100' : 'text-slate-900'}`}>
                      {isAr ? 'علامة تحذيرية خطيرة — تحويل طبي طارئ' : 'Red Flag Detected — Urgent Medical Referral'}
                    </div>
                    <div className={`text-xs ${isNight ? 'text-slate-400' : 'text-slate-500'}`}>
                      {isAr ? 'تمنع الجلسة ويجب التحويل الفوري للطبيب/الطوارئ' : 'Contraindicates PT; refer urgently to physician/ER'}
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {step === 'objective' && (
            <div className="space-y-3">
              <p className={`text-xs font-semibold ${isNight ? 'text-slate-300' : 'text-slate-600'}`}>
                {isAr
                  ? 'اضغط على الاختبارات السريرية لإجرائها واكتشاف النتائج:'
                  : 'Tap clinical tests below to perform examination and reveal findings:'}
              </p>

              <div className="space-y-2.5">
                {c.objectiveTests.map((test) => {
                  const revealed = revealedTests.includes(test.id);
                  return (
                    <div
                      key={test.id}
                      className={`rounded-2xl border overflow-hidden ${
                        isNight ? 'border-slate-700 bg-slate-800/80' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleObjectiveTest(test.id)}
                        className={`w-full p-3.5 flex items-center justify-between gap-2 text-start ${
                          isNight ? 'hover:bg-slate-800' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Activity className="w-4 h-4 text-sky-500 shrink-0" />
                          <span className={`text-sm font-extrabold ${isNight ? 'text-slate-100' : 'text-slate-900'}`}>
                            {isAr ? test.nameAr : test.nameEn}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-sky-500 whitespace-nowrap">
                          {revealed
                            ? isAr
                              ? '✓ تم الفحص'
                              : '✓ Tested'
                            : isAr
                              ? 'إجراء الفحص'
                              : 'Perform Test'}
                        </span>
                      </button>

                      {revealed && (
                        <div
                          className={`px-3.5 py-2.5 text-xs font-bold border-t ${
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
            </div>
          )}

          {step === 'plan' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className={`text-xs font-extrabold ${isNight ? 'text-slate-300' : 'text-slate-700'}`}>
                  {isAr ? 'التشخيص السريري المرجح:' : 'Primary Clinical Impression:'}
                </h3>
                {c.diagnosisOptions.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSelectedDiag(d.id)}
                    className={`w-full text-start p-3 rounded-2xl border-2 text-xs sm:text-sm font-bold transition-all ${
                      selectedDiag === d.id
                        ? isNight
                          ? 'border-sky-500 bg-sky-950/60 text-sky-200'
                          : 'border-sky-600 bg-sky-50 text-sky-900'
                        : isNight
                          ? 'border-slate-700 hover:border-slate-600 text-slate-200'
                          : 'border-slate-200 hover:border-slate-300 text-slate-800'
                    }`}
                  >
                    {isAr ? d.labelAr : d.labelEn}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <h3 className={`text-xs font-extrabold ${isNight ? 'text-slate-300' : 'text-slate-700'}`}>
                  {isAr ? 'الخطة العلاجية المبنية على الدليل:' : 'Evidence-Based Intervention Plan:'}
                </h3>
                {c.treatmentOptions.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTx(t.id)}
                    className={`w-full text-start p-3 rounded-2xl border-2 text-xs sm:text-sm font-bold transition-all ${
                      selectedTx === t.id
                        ? isNight
                          ? 'border-emerald-500 bg-emerald-950/60 text-emerald-200'
                          : 'border-emerald-600 bg-emerald-50 text-emerald-950'
                        : isNight
                          ? 'border-slate-700 hover:border-slate-600 text-slate-200'
                          : 'border-slate-200 hover:border-slate-300 text-slate-800'
                    }`}
                  >
                    {isAr ? t.labelAr : t.labelEn}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5">
                <label className={`text-xs font-extrabold block ${isNight ? 'text-slate-300' : 'text-slate-600'}`}>
                  {isAr
                    ? 'الجرعة السريرية وملاحظة المتابعة (اختياري):'
                    : 'Dosage Parameters & Clinical Rationale Note (Optional):'}
                </label>
                <div className="flex flex-wrap gap-1.5 pb-1">
                  {(isAr
                    ? ['TENS 80-100Hz / 20 د', 'تمارين 3×10 تكرارات', 'موجات 1MHz / 1.2 W/cm²', 'تحويل طارئ فوري']
                    : ['TENS 80-100Hz · 20m', 'TherEx 3×10 reps', 'US 1MHz · 1.2 W/cm²', 'Urgent ER Referral']
                  ).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() =>
                        setStudentNote((prev) => (prev ? `${prev} · ${preset}` : preset))
                      }
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                        isNight
                          ? 'bg-slate-800 hover:bg-sky-900/60 text-slate-200'
                          : 'bg-slate-100 hover:bg-sky-100 text-slate-700'
                      }`}
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={2}
                  value={studentNote}
                  onChange={(e) => setStudentNote(e.target.value)}
                  placeholder={
                    isAr
                      ? 'اكتب سبب اختيارك لهذه الخطة أو احتياطات الأمان...'
                      : 'Explain your clinical rationale or key precautions...'
                  }
                  className={`w-full p-2.5 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                    isNight ? 'bg-slate-800 text-slate-100 placeholder:text-slate-400' : 'bg-slate-100 text-slate-900'
                  }`}
                />
              </div>
            </div>
          )}

          {step === 'summary' && evaluationResult && (
            <div className="space-y-4 text-center py-2">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto shadow-inner">
                <ClipboardCheck className="w-9 h-9" />
              </div>
              <div>
                <h3 className={`text-lg font-black ${isNight ? 'text-slate-100' : 'text-slate-900'}`}>
                  {isAr ? 'اكتمل التقييم السريري!' : 'Clinical Assessment Complete!'}
                </h3>
                <p className="text-sm font-bold text-sky-500 tabular-nums mt-0.5">
                  {isAr ? `الدقة السريرية: ${evaluationResult.score}%` : `Clinical Accuracy: ${evaluationResult.score}%`}
                </p>
              </div>

              <div className="flex items-center justify-center gap-4">
                <div className="flex items-center gap-1.5 bg-amber-500/20 text-amber-400 px-4 py-2 rounded-2xl font-black text-sm tabular-nums">
                  <Coins className="w-4 h-4 text-amber-500" />
                  +{evaluationResult.coinsEarned}
                </div>
                <div className="flex items-center gap-1.5 bg-sky-500/20 text-sky-400 px-4 py-2 rounded-2xl font-black text-sm tabular-nums">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                  +{evaluationResult.starsEarned}
                </div>
              </div>

              <div
                className={`border rounded-2xl p-3.5 text-start space-y-1.5 ${
                  isNight ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-sky-500">
                  <Sparkles className="w-4 h-4" />
                  <span>{isAr ? 'ملاحظة المشرف الإكلينيكي:' : 'Clinical Mentor Feedback:'}</span>
                </div>
                <p className={`text-xs sm:text-sm leading-relaxed ${isNight ? 'text-slate-200' : 'text-slate-700'}`}>
                  {evaluationResult.feedback}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div
          className={`p-3.5 border-t flex items-center justify-between gap-2 ${
            isNight ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-slate-50'
          }`}
        >
          {step === 'subjective' && (
            <button
              type="button"
              onClick={() => setStep('redflags')}
              className="w-full py-3 rounded-2xl game-btn-blue text-white text-sm font-extrabold"
            >
              {isAr ? 'التالي: فحص العلامات التحذيرية ←' : 'Next: Red Flags Screening →'}
            </button>
          )}
          {step === 'redflags' && (
            <button
              type="button"
              disabled={!redFlagChoice}
              onClick={() => setStep('objective')}
              className="w-full py-3 rounded-2xl game-btn-blue disabled:opacity-45 text-white text-sm font-extrabold"
            >
              {isAr ? 'التالي: الفحص السريري ←' : 'Next: Objective Exam →'}
            </button>
          )}
          {step === 'objective' && (
            <button
              type="button"
              onClick={() => setStep('plan')}
              className="w-full py-3 rounded-2xl game-btn-blue text-white text-sm font-extrabold"
            >
              {isAr ? 'التالي: التشخيص والخطة العلاجية ←' : 'Next: Diagnosis & Plan →'}
            </button>
          )}
          {step === 'plan' && (
            <button
              type="button"
              disabled={!selectedDiag || !selectedTx || evaluating}
              onClick={handleSubmitPlan}
              className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-45 text-white text-sm font-extrabold shadow-md"
            >
              {evaluating
                ? isAr
                  ? 'جارٍ التقييم الإكلينيكي...'
                  : 'Evaluating Clinical Plan...'
                : isAr
                  ? 'اعتماد الخطة وإنهاء الجلسة ✓'
                  : 'Confirm Plan & Treat Patient ✓'}
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
              className="w-full py-3 rounded-2xl game-btn-gold text-slate-950 text-sm font-black"
            >
              {isAr ? 'استلام المكافأة والعودة للعيادة' : 'Collect Reward & Return'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
