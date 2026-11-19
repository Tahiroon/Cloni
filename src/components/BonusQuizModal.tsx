import React, { useState } from 'react';
import { Brain, Coins, Sparkles, Star, X } from 'lucide-react';
import { Language } from '../types/clinic';

interface BonusQuizModalProps {
  open: boolean;
  language: Language;
  onClose: () => void;
  onEarnReward: (coins: number, stars: number) => void;
}

interface QuizQuestion {
  qAr: string;
  qEn: string;
  options: Array<{ ar: string; en: string; correct: boolean }>;
}

const QUESTIONS: QuizQuestion[] = [
  {
    qAr: 'ما هي الأولوية القصوى في الأسبوعين الأولين بعد عملية إعادة بناء الرباط الصليبي (ACL)؟',
    qEn: 'What is the #1 priority during the first 2 weeks post-ACL reconstruction?',
    options: [
      { ar: 'استعادة البسط الكامل للركبة (0°) وتفعيل العضلة الرباعية', en: 'Restore full 0° knee extension & quad activation', correct: true },
      { ar: 'بدء تمارين القفز والجري السريع', en: 'Begin plyometric jumping & sprinting', correct: false },
      { ar: 'تثبيت المفصل في وضع الثني 45 درجة', en: 'Immobilize knee at 45° flexion', correct: false },
    ],
  },
  {
    qAr: 'أي اختبار خاص يُستخدم لتشخيص متلازمة النفق الرسغي (Carpal Tunnel)؟',
    qEn: 'Which special test is classic for Carpal Tunnel Syndrome?',
    options: [
      { ar: 'اختبار فالن (Phalen Test) وعلامة تينيل', en: 'Phalen Test & Tinel Sign', correct: true },
      { ar: 'اختبار لاكمان (Lachman Test)', en: 'Lachman Test', correct: false },
      { ar: 'اختبار ماكموري (McMurray Test)', en: 'McMurray Test', correct: false },
    ],
  },
  {
    qAr: 'أي عرض يمثل "علامة تحذيرية" (Red Flag) في آلام أسفل الظهر ويتطلب تحويلاً طبياً طارئاً؟',
    qEn: 'Which symptom is a lumbar Red Flag requiring urgent medical referral?',
    options: [
      { ar: 'فقدان التحكم في البول/البراز وتنميل منطقة السرج (Cauda Equina)', en: 'Bowel/bladder retention & saddle anesthesia', correct: true },
      { ar: 'تيبس صباحي بسيط يتحسن بعد المشي 10 دقائق', en: 'Mild morning stiffness easing after 10 min walk', correct: false },
      { ar: 'ألم موضعي خفيف بعد الجلوس الطويل', en: 'Localized dull ache after prolonged sitting', correct: false },
    ],
  },
];

export const BonusQuizModal: React.FC<BonusQuizModalProps> = ({
  open,
  language,
  onClose,
  onEarnReward,
}) => {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * QUESTIONS.length));
  const [answered, setAnswered] = useState<'correct' | 'wrong' | null>(null);

  if (!open) return null;
  const isAr = language === 'ar';
  const q = QUESTIONS[idx % QUESTIONS.length];

  const handlePick = (isCorrect: boolean) => {
    if (answered) return;
    if (isCorrect) {
      setAnswered('correct');
      onEarnReward(45, 1);
    } else {
      setAnswered('wrong');
    }
  };

  const nextQuestion = () => {
    setAnswered(null);
    setIdx((prev) => prev + 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            <h2 className="text-base font-black">
              {isAr ? 'تحدي العلاج الطبيعي السريع' : 'PT Clinical Knowledge Boost'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-black/10 hover:bg-black/20 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between text-xs font-extrabold text-slate-600">
            <span className="flex items-center gap-1 text-sky-700">
              <Sparkles className="w-4 h-4" />
              {isAr ? 'أجب لربح مكافأة فورية' : 'Answer to earn instant clinic rewards'}
            </span>
            <span className="flex items-center gap-2 tabular-nums">
              <span className="flex items-center gap-0.5 text-amber-600">
                <Coins className="w-3.5 h-3.5" />+45
              </span>
              <span className="flex items-center gap-0.5 text-sky-600">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />+1
              </span>
            </span>
          </div>

          <p className="text-sm font-extrabold text-slate-900 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            {isAr ? q.qAr : q.qEn}
          </p>

          <div className="space-y-2">
            {q.options.map((opt, i) => (
              <button
                key={i}
                type="button"
                disabled={Boolean(answered)}
                onClick={() => handlePick(opt.correct)}
                className={`w-full text-start p-3 rounded-2xl border-2 text-xs sm:text-sm font-bold transition-colors ${
                  answered
                    ? opt.correct
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                      : 'border-slate-200 text-slate-400'
                    : 'border-slate-200 hover:border-sky-400 hover:bg-sky-50 text-slate-800'
                }`}
              >
                {isAr ? opt.ar : opt.en}
              </button>
            ))}
          </div>

          {answered && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span
                className={`text-xs font-extrabold ${
                  answered === 'correct' ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {answered === 'correct'
                  ? isAr
                    ? '✓ إجابة صحيحة! تم إضافة المكافأة'
                    : '✓ Correct! Reward added'
                  : isAr
                    ? '✗ حاول سؤالاً آخر'
                    : '✗ Try another clinical question'}
              </span>
              <button
                type="button"
                onClick={nextQuestion}
                className="px-4 py-2 rounded-xl game-btn-blue text-white text-xs font-extrabold"
              >
                {isAr ? 'سؤال جديد' : 'Next Question'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
