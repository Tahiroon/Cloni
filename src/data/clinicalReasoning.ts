import { ClinicalCase, Language, RoomSpecialty } from '../types/clinic';

export type HistoryCategory = 'hpi' | 'pmh' | 'redflags' | 'social';

export interface HistoryQuestionItem {
  id: string;
  category: HistoryCategory;
  tagEn: string;
  qAr: string;
  qEn: string;
  aAr: string;
  aEn: string;
}

interface HistoryCategoryMeta {
  id: HistoryCategory;
  labelAr: string;
  labelEn: string;
  shortEn: string;
}

export const HISTORY_CATEGORIES: HistoryCategoryMeta[] = [
  { id: 'hpi', labelAr: 'المرض الحالي', labelEn: 'Present Illness (HPI)', shortEn: 'HPI' },
  { id: 'pmh', labelAr: 'الطبي والجراحي', labelEn: 'Past Medical (PMH)', shortEn: 'PMH' },
  { id: 'redflags', labelAr: 'علامات الخطر', labelEn: 'Red Flags', shortEn: 'Red Flags' },
  { id: 'social', labelAr: 'الوظيفة والأهداف', labelEn: 'Social & Goals', shortEn: 'Social' },
];

export type ModalityId =
  | 'tens_ifc'
  | 'ultrasound'
  | 'laser_hilt'
  | 'heat_ir'
  | 'cryo'
  | 'traction_cpm'
  | 'hydro'
  | 'exercise';

interface PrescriptionModalityOption {
  id: ModalityId;
  nameEn: string;
  subAr: string;
  subEn: string;
}

export const PRESCRIPTION_MODALITIES: PrescriptionModalityOption[] = [
  { id: 'tens_ifc', nameEn: 'TENS / IFC', subAr: 'تخفيف الألم الكهربائي', subEn: 'Electro-analgesia' },
  { id: 'ultrasound', nameEn: 'Therapeutic US', subAr: 'موجات فوق صوتية', subEn: 'Deep thermal / repair' },
  { id: 'laser_hilt', nameEn: 'Laser (HILT)', subAr: 'ليزر عالي الشدة', subEn: 'Photobiomodulation' },
  { id: 'heat_ir', nameEn: 'IR / Hot Pack', subAr: 'حرارة سطحية وأشعة', subEn: 'Superficial heat' },
  { id: 'cryo', nameEn: 'Cryotherapy', subAr: 'كمادات وتبريد علاجي', subEn: 'Edema & acute pain' },
  { id: 'traction_cpm', nameEn: 'Traction / CPM', subAr: 'شد فقري أو تحريك آلي', subEn: 'Decompression / ROM' },
  { id: 'hydro', nameEn: 'Hydrotherapy', subAr: 'علاج وتمرين مائي', subEn: 'Aquatic offloading' },
  { id: 'exercise', nameEn: 'Therapeutic Ex.', subAr: 'تمارين علاجية وتأهيل', subEn: 'Strength & mobility' },
];

export type HomePrecautionId = 'hep' | 'ergonomics' | 'activity_mod' | 'urgent_ref';

interface HomePrecautionOption {
  id: HomePrecautionId;
  nameEn: string;
  labelAr: string;
}

export const HOME_PRECAUTION_OPTIONS: HomePrecautionOption[] = [
  { id: 'hep', nameEn: 'Home Exercise (HEP)', labelAr: 'برنامج تمارين منزلي' },
  { id: 'ergonomics', nameEn: 'Ergonomic Advice', labelAr: 'تعديل الوضعية والعمل' },
  { id: 'activity_mod', nameEn: 'Load Management', labelAr: 'تقنين الأحمال اليومية' },
  { id: 'urgent_ref', nameEn: 'Medical Referral', labelAr: 'إحالة طبية عاجلة' },
];

export function buildCategorizedHistory(c: ClinicalCase): HistoryQuestionItem[] {
  const lower = `${c.id} ${c.chiefComplaintEn} ${c.onsetEn}`.toLowerCase();
  const isPostOp =
    lower.includes('post-op') ||
    lower.includes('post-acl') ||
    lower.includes('reconstruction') ||
    lower.includes('orif') ||
    lower.includes('عملية');
  const isNeuro = c.specialty === 'neurorehab';
  const isHydro = c.specialty === 'hydrotherapy';
  const isAcute =
    c.vasPain >= 7 ||
    lower.includes('24 hours') ||
    lower.includes('sudden') ||
    lower.includes('أسبوع') ||
    lower.includes('ساعة');

  // HPI answers
  const hpiOnsetAr = `أعاني من ${c.chiefComplaintAr}، وقد بدأت المشكلة ${c.onsetAr}.`;
  const hpiOnsetEn = `I have ${c.chiefComplaintEn}, and it started ${c.onsetEn}.`;

  const hpiBehaviorAr = `يزداد الألم مع ${c.aggravatingAr}، بينما يتحسن عند ${c.easingAr}.`;
  const hpiBehaviorEn = `Symptoms worsen with ${c.aggravatingEn}, and ease with ${c.easingEn}.`;

  const hpi24hAr = isAcute
    ? `شدة الألم تصل إلى ${c.vasPain}/10؛ أشعر بتيبس أو انزعاج أكبر في الصباح وعند بداية الحركة.`
    : `شدة الألم حوالي ${c.vasPain}/10 وتزداد بنهاية اليوم مع المجهود المتكرر.`;
  const hpi24hEn = isAcute
    ? `Pain reaches ${c.vasPain}/10; it feels stiffest first thing in the morning or after resting.`
    : `Pain averages ${c.vasPain}/10 and builds up toward the end of the day with repeated load.`;

  // PMH / Surgical answers
  const pmhSurgAr = isPostOp
    ? `نعم، خضعت للتدخل الجراحي المذكور (${c.onsetAr}) وأتابع حالياً برنامج التأهيل دون التهابات أو مضاعفات سابقة.`
    : `لم أجرِ عمليات جراحية في هذه المنطقة من قبل، وهذه أول نوبة واضحة بهذه الشدة.`;
  const pmhSurgEn = isPostOp
    ? `Yes, I underwent the surgical procedure (${c.onsetEn}) with normal healing so far and no prior surgeries on this side.`
    : `No previous surgeries in this region, and no prior severe episodes like this one.`;

  const bpVal = c.vitals?.bp ?? '120/78';
  const pmhMedsAr =
    c.age >= 55
      ? `ضغط الدم المسجل ${bpVal}؛ ألتزم بمتابعة صحتي العامة وأتناول مسكناً خفيفاً عند اللزوم فقط دون حساسية دوائية معروفة.`
      : `لا أعاني من أمراض مزمنة كالسكري أو الضغط (${bpVal})، ولا أتناول سوى مسكن بسيط عند اشتداد الألم.`;
  const pmhMedsEn =
    c.age >= 55
      ? `Blood pressure is ${bpVal}; I manage routine age-related checkups and take occasional mild analgesics with no known drug allergies.`
      : `No chronic conditions like diabetes or hypertension (BP ${bpVal}), just occasional over-the-counter pain relief.`;

  // Red Flags & Systems Review
  const rfSystemicAr = c.redFlagsPresent
    ? `بصراحة هناك عرض مقلق يستدعي الانتباه: ${c.redFlagClueAr}.`
    : `لا توجد حرارة غير مبررة أو فقدان وزن أو ألم ليلي عميق لا يتأثر بالوضعية؛ المؤشرات العامة مستقرة.`;
  const rfSystemicEn = c.redFlagsPresent
    ? `Honestly there is a concerning sign: ${c.redFlagClueEn}.`
    : `No unexplained weight loss, fever, or constant unrelenting night pain; systemic review is unremarkable.`;

  const rfNeuroAr = c.redFlagsPresent
    ? `الأعراض المقلقة واضحة في الطرف المصاب: ${c.redFlagClueAr}، وأحتاج تقييماً طبياً فورياً قبل أي جلسة.`
    : isNeuro
      ? `التوازن والوظيفة الحركية متأثرة بالحالة العصبية الحالية، لكن ${c.redFlagClueAr}.`
      : `لا يوجد فقدان مفاجئ في القوة العضلية أو مشاكل في التحكم العصبي؛ ${c.redFlagClueAr}.`;
  const rfNeuroEn = c.redFlagsPresent
    ? `Concerning local signs are present: ${c.redFlagClueEn} — urgent medical clearance is needed.`
    : isNeuro
      ? `Motor control and balance are affected by the primary neurological condition, while ${c.redFlagClueEn}.`
      : `No progressive neurological deficit or sphincter changes; ${c.redFlagClueEn}.`;

  // Social & Functional Goals
  const aidLabelAr =
    c.mobilityAid === 'crutches'
      ? 'أستخدم عكازين للمشي حالياً'
      : c.mobilityAid === 'cane'
        ? 'أستخدم عصا مساعدة في التنقل'
        : 'أتناول تنقلاتي دون أدوات مساعدة';
  const aidLabelEn =
    c.mobilityAid === 'crutches'
      ? 'currently walking with crutches'
      : c.mobilityAid === 'cane'
        ? 'using a single cane for outdoor support'
        : 'ambulating independently without walking aids';

  const socWorkAr = `عملي كـ (${c.occupationAr}) يتطلب مجهوداً متواصلاً، وحالياً ${aidLabelAr}.`;
  const socWorkEn = `My role as a ${c.occupationEn} demands daily physical endurance, and I am ${aidLabelEn}.`;

  const socGoalAr = isHydro
    ? `هدفي تقليل الألم والتيبس بأمان والعودة إلى ممارسة حياتي اليومية والنوم براحة.`
    : isNeuro
      ? `هدفي تحسين التوازن واستقلالية المشي وأداء الأنشطة اليومية بأمان.`
      : `هدفي استعادة المدى الحركي الكامل والقوة للعودة إلى عملي وحياتي الطبيعية دون ألم.`;
  const socGoalEn = isHydro
    ? `My main goal is to reduce stiffness gently, restore pain-free daily tasks, and improve sleep quality.`
    : isNeuro
      ? `My main goal is safer balance, independent gait, and confidence with daily self-care.`
      : `My main goal is regaining full range of motion and strength to return to work and daily life pain-free.`;

  return [
    {
      id: 'hpi_onset',
      category: 'hpi',
      tagEn: 'Chief Complaint & Onset',
      qAr: 'ما الشكوى الرئيسية ومتى وكيف بدأت؟',
      qEn: 'What is your main complaint, onset & mechanism?',
      aAr: hpiOnsetAr,
      aEn: hpiOnsetEn,
    },
    {
      id: 'hpi_agg_ease',
      category: 'hpi',
      tagEn: 'Aggravating & Easing',
      qAr: 'ما الحركات التي تزيد الألم وما الذي يخففه؟',
      qEn: 'What aggravates or eases your symptoms?',
      aAr: hpiBehaviorAr,
      aEn: hpiBehaviorEn,
    },
    {
      id: 'hpi_24h',
      category: 'hpi',
      tagEn: 'Severity (VAS) & 24h Pattern',
      qAr: 'كم شدة الألم (0-10) وكيف يتغير خلال اليوم؟',
      qEn: 'What is your pain severity (0–10) & 24-hour pattern?',
      aAr: hpi24hAr,
      aEn: hpi24hEn,
    },
    {
      id: 'pmh_surgical',
      category: 'pmh',
      tagEn: 'Past Surgeries & Trauma',
      qAr: 'هل أجريت عمليات جراحية أو تعرضت لإصابات سابقة؟',
      qEn: 'Any prior surgeries, fractures, or recurring injuries?',
      aAr: pmhSurgAr,
      aEn: pmhSurgEn,
    },
    {
      id: 'pmh_meds',
      category: 'pmh',
      tagEn: 'Medical Conditions & Meds',
      qAr: 'هل لديك أمراض مزمنة (ضغط/سكري) أو أدوية حالية؟',
      qEn: 'Any chronic illnesses, medications, or allergies?',
      aAr: pmhMedsAr,
      aEn: pmhMedsEn,
    },
    {
      id: 'rf_systemic',
      category: 'redflags',
      tagEn: 'Systemic & Night Pain',
      qAr: 'هل هناك ألم ليلي شديد أو حرارة أو تورم غير طبيعي؟',
      qEn: 'Any unrelenting night pain, fever, or unexplained swelling?',
      aAr: rfSystemicAr,
      aEn: rfSystemicEn,
    },
    {
      id: 'rf_neuro',
      category: 'redflags',
      tagEn: 'Neurological & Vascular Check',
      qAr: 'هل تشعر بتنميل متزايد أو ضعف مفاجئ أو سخونة بالساق؟',
      qEn: 'Any progressive weakness, numbness, or acute calf warmth?',
      aAr: rfNeuroAr,
      aEn: rfNeuroEn,
    },
    {
      id: 'soc_work',
      category: 'social',
      tagEn: 'Occupation & Mobility',
      qAr: 'ما طبيعة عملك وهل تستخدم وسيلة مساعدة للمشي؟',
      qEn: 'What does your work involve and do you use any mobility aid?',
      aAr: socWorkAr,
      aEn: socWorkEn,
    },
    {
      id: 'soc_goals',
      category: 'social',
      tagEn: 'Functional Goals',
      qAr: 'ما أهم هدف وظيفي تتمنى تحقيقه من العلاج الطبيعي؟',
      qEn: 'What is your primary functional goal for physiotherapy?',
      aAr: socGoalAr,
      aEn: socGoalEn,
    },
  ];
}

export function getRecommendedPrescription(c: ClinicalCase): {
  idealModalities: ModalityId[];
  contraindicatedModalities: ModalityId[];
  idealSessionsMin: number;
  idealSessionsMax: number;
  defaultSessions: number;
  defaultFreq: 2 | 3 | 5;
} {
  if (c.redFlagsPresent) {
    return {
      idealModalities: [],
      contraindicatedModalities: ['ultrasound', 'heat_ir', 'tens_ifc', 'hydro'],
      idealSessionsMin: 0,
      idealSessionsMax: 0,
      defaultSessions: 0,
      defaultFreq: 2,
    };
  }

  const text = `${c.id} ${c.chiefComplaintEn} ${c.treatmentOptions
    .filter((t) => t.isRecommended)
    .map((t) => t.labelEn)
    .join(' ')}`.toLowerCase();

  const ideal = new Set<ModalityId>(['exercise']);

  if (text.includes('tens') || text.includes('ifc') || text.includes('pain') || c.vasPain >= 6) {
    ideal.add('tens_ifc');
  }
  if (text.includes('ultrasound') || text.includes(' us') || text.includes('tendon') || text.includes('carpal')) {
    ideal.add('ultrasound');
  }
  if (text.includes('laser') || text.includes('hilt') || text.includes('plantar') || text.includes('epicondyl')) {
    ideal.add('laser_hilt');
  }
  if (text.includes('cryo') || text.includes('ice') || text.includes('swelling') || text.includes('sprain') || text.includes('acl')) {
    ideal.add('cryo');
  }
  if (text.includes('heat') || text.includes('infrared') || text.includes('warm') || text.includes('frozen') || text.includes('stiff')) {
    ideal.add('heat_ir');
  }
  if (text.includes('traction') || text.includes('cpm') || text.includes('radiculopathy') || text.includes('stenosis')) {
    ideal.add('traction_cpm');
  }
  if (c.specialty === 'hydrotherapy' || text.includes('hydro') || text.includes('aquatic')) {
    ideal.add('hydro');
  }

  const specialtyMap: Record<RoomSpecialty, ModalityId[]> = {
    reception: ['exercise'],
    electrotherapy: ['tens_ifc', 'ultrasound'],
    kinesiotherapy: ['exercise', 'cryo'],
    orthopedics: ['exercise', 'tens_ifc'],
    neurorehab: ['exercise', 'tens_ifc'],
    hydrotherapy: ['hydro', 'exercise'],
  };

  for (const m of specialtyMap[c.specialty]) {
    if (ideal.size < 3) ideal.add(m);
  }

  const isNeuroOrChronic = c.specialty === 'neurorehab' || text.includes('frozen') || text.includes('scoliosis');
  return {
    idealModalities: Array.from(ideal),
    contraindicatedModalities: [],
    idealSessionsMin: isNeuroOrChronic ? 8 : 4,
    idealSessionsMax: isNeuroOrChronic ? 16 : 12,
    defaultSessions: isNeuroOrChronic ? 10 : 6,
    defaultFreq: c.vasPain >= 7 || c.specialty === 'neurorehab' ? 3 : 2,
  };
}

export function evaluateClinicalSubmission(params: {
  clinicalCase: ClinicalCase;
  askedCount: number;
  testedCount: number;
  redFlagChoice: 'safe' | 'refer' | null;
  diagCorrect: boolean;
  txCorrect: boolean;
  plannedSessions: number;
  frequencyPerWeek: number;
  selectedModalities: ModalityId[];
  language: Language;
}): {
  score: number;
  coinsEarned: number;
  starsEarned: number;
  caughtRedFlag: boolean;
  prescriptionNote: string;
} {
  const {
    clinicalCase: c,
    askedCount,
    testedCount,
    redFlagChoice,
    diagCorrect,
    txCorrect,
    plannedSessions,
    frequencyPerWeek,
    selectedModalities,
    language,
  } = params;
  const isAr = language === 'ar';
  const rec = getRecommendedPrescription(c);

  const redFlagCorrect =
    (c.redFlagsPresent && redFlagChoice === 'refer') ||
    (!c.redFlagsPresent && redFlagChoice === 'safe');

  // Base clinical thoroughness (up to 24 pts)
  const historyPts = Math.min(12, askedCount * 2);
  const examPts = Math.min(12, testedCount * 4);
  // Core reasoning (up to 56 pts)
  const rfPts = redFlagCorrect ? 20 : 0;
  const diagPts = diagCorrect ? 20 : 0;
  const txPts = txCorrect ? 16 : 0;

  // Custom Prescription evaluation (up to 20 pts)
  let rxPts = 0;
  let rxNoteAr = '';
  let rxNoteEn = '';

  if (c.redFlagsPresent) {
    const usedContraindicated = selectedModalities.some((m) =>
      rec.contraindicatedModalities.includes(m)
    );
    if (redFlagChoice === 'refer' && !usedContraindicated && plannedSessions === 0) {
      rxPts = 20;
      rxNoteAr = 'قرار آمن ممتاز: تم إيقاف الجلسات والأجهزة وإحالة الحالة للطوارئ.';
      rxNoteEn = 'Excellent clinical safety: PT modalities withheld and urgent referral prioritized.';
    } else if (usedContraindicated) {
      rxPts = 0;
      rxNoteAr = 'تحذير سلامة: استخدام الحرارة أو الموجات فوق الصوتية مع الاشتباه بجلطة (DVT) خطر جداً.';
      rxNoteEn = 'Safety alert: Thermal/US modalities are strictly contraindicated in suspected DVT.';
    } else {
      rxPts = 10;
      rxNoteAr = 'يفضل تعيين الجلسات إلى 0 مع التحويل الطبي الفوري عند وجود Red Flag.';
      rxNoteEn = 'Set PT sessions to 0 when referring an acute Red Flag case.';
    }
  } else {
    const sessionOk =
      plannedSessions >= rec.idealSessionsMin && plannedSessions <= rec.idealSessionsMax;
    const freqOk = frequencyPerWeek >= 2 && frequencyPerWeek <= 5;
    const overlapCount = selectedModalities.filter((m) =>
      rec.idealModalities.includes(m)
    ).length;

    rxPts += sessionOk ? 8 : plannedSessions > 0 ? 4 : 0;
    rxPts += freqOk ? 2 : 0;
    rxPts += Math.min(10, overlapCount * 4 + (selectedModalities.includes('exercise') ? 2 : 0));

    if (overlapCount >= 2 && sessionOk) {
      rxNoteAr = `خطة مخصصة متوازنة (${plannedSessions} جلسات · ${frequencyPerWeek}x أسبوعياً) مع دمج ممتاز بين الأجهزة والتمارين.`;
      rxNoteEn = `Well-calibrated prescription (${plannedSessions} sessions · ${frequencyPerWeek}x/wk) pairing appropriate modalities with active rehab.`;
    } else if (!selectedModalities.includes('exercise')) {
      rxNoteAr = 'تذكر أن التمارين العلاجية (Therapeutic Ex.) ركيزة أساسية بجانب الأجهزة.';
      rxNoteEn = 'Remember to pair electro/thermal modalities with Therapeutic Exercise for lasting gains.';
    } else {
      rxNoteAr = `تم تسجيل الخطة (${plannedSessions} جلسات · ${frequencyPerWeek}x أسبوعياً). يمكن تحسين اختيار الأجهزة لتناسب الحالة بدقة أكبر.`;
      rxNoteEn = `Prescription logged (${plannedSessions} sessions · ${frequencyPerWeek}x/wk); refine modality selection to target primary impairments.`;
    }
  }

  const score = Math.max(25, Math.min(100, historyPts + examPts + rfPts + diagPts + txPts + rxPts));
  const coinsEarned = Math.round(45 + score * 0.75);
  const starsEarned = score >= 82 ? 2 : score >= 62 ? 1 : 0;

  return {
    score,
    coinsEarned,
    starsEarned,
    caughtRedFlag: Boolean(c.redFlagsPresent && redFlagCorrect),
    prescriptionNote: isAr ? rxNoteAr : rxNoteEn,
  };
}
