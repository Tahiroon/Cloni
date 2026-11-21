import { CATALOG_ITEMS } from '../data/catalog';
import { glbRegistry } from '../engine3d/glbRegistry';
import { renderThumbBatch } from '../engine3d/thumbRenderer';
import { Language } from '../types/clinic';

export interface SmartLoadingTip {
  id: string;
  categoryAr: string;
  categoryEn: string;
  textAr: string;
  textEn: string;
}

export const GAME_LOADING_TIPS: SmartLoadingTip[] = [
  {
    id: 'tip_proper_devices',
    categoryAr: 'نصيحة',
    categoryEn: 'Tip',
    textAr: 'استخدم الأجهزة بشكل صحيح لتحقيق أفضل نتائج العلاج.',
    textEn: 'Use clinical devices accurately to achieve the best recovery results.',
  },
  {
    id: 'tip_fpp_proximity',
    categoryAr: 'نصيحة',
    categoryEn: 'Tip',
    textAr:
      'اقترب من أي جهاز في الغرفة لالتقاطه، ثم احمله بجانب سرير المريض لتبدأ الضبط والعلاج.',
    textEn:
      'Walk close to any modality cart to pick it up, then place it beside the bed to calibrate treatment.',
  },
  {
    id: 'tip_ir_distance',
    categoryAr: 'نصيحة',
    categoryEn: 'Tip',
    textAr:
      'المسافة المثالية لمصباح الأشعة تحت الحمراء (IR) هي 45 إلى 60 سم بشكل عمودي لتدفئة آمنة وفعّالة.',
    textEn:
      'Keep the Infrared Lamp (IR) at 45–60 cm perpendicular to the target area for safe, effective warmth.',
  },
  {
    id: 'tip_red_flags',
    categoryAr: 'نصيحة',
    categoryEn: 'Tip',
    textAr:
      'افحص علامات الخطر (Red Flags) أولاً قبل اختيار التمارين أو الأجهزة لحماية المريض ورفع تقييم عيادتك.',
    textEn:
      'Always screen for Red Flags before applying modalities to keep patients safe and boost your clinic rating.',
  },
  {
    id: 'tip_tens_vs_ifc',
    categoryAr: 'نصيحة',
    categoryEn: 'Tip',
    textAr:
      'تيار التداخل (IFC) يصل للأنسجة العميقة براحة أكبر مقارنة بـ TENS التقليدي في آلام الظهر والركبة.',
    textEn:
      'Interferential Current (IFC) reaches deeper tissues more comfortably than conventional TENS.',
  },
  {
    id: 'tip_ultrasound_coupling',
    categoryAr: 'نصيحة',
    categoryEn: 'Tip',
    textAr:
      'استخدم تردد 1 MHz للأنسجة العميقة و3 MHz للسطحية مع تحريك المجس باستمرار فوق الجل الموصل.',
    textEn:
      'Use 1 MHz for deep targets and 3 MHz for superficial tissue while gliding the head continuously.',
  },
  {
    id: 'tip_posture_sync',
    categoryAr: 'نصيحة',
    categoryEn: 'Tip',
    textAr:
      'اختر وضعية المريض المناسبة لكل جهاز: الاستلقاء لجهاز حركة الركبة (CPM) والوقوف لاختبارات التوازن.',
    textEn:
      'Match posture to the device: Supine for knee CPM mobilization and Standing beside the bed for balance.',
  },
  {
    id: 'tip_clinic_workflow',
    categoryAr: 'نصيحة',
    categoryEn: 'Tip',
    textAr:
      'وسّع الأجنحة التخصصية وأضف لمسات الديكور والنباتات والألواح الشمسية لتجذب المزيد من المرضى يومياً.',
    textEn:
      'Expand specialty wings and add plants, decor, and solar panels to welcome more patients every day.',
  },
];

const LANG_STORAGE_KEY = 'therason_clinic_language_v1';

export function getInitialBootLanguage(): Language {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'en' || saved === 'ar') return saved;
    const backup = localStorage.getItem('therason_clinic_backup_v1');
    if (backup) {
      const parsed = JSON.parse(backup) as { language?: unknown };
      if (parsed?.language === 'en' || parsed?.language === 'ar') {
        return parsed.language;
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return 'ar';
}

export function persistBootLanguage(lang: Language): void {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Ignore storage write errors
  }
}

export async function waitForWebFonts(timeoutMs = 2400): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts?.ready) return;
  await Promise.race([
    document.fonts.ready.then(() => undefined).catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

export async function decodeImageAsset(src: string, timeoutMs = 2200): Promise<void> {
  if (typeof Image === 'undefined') return;
  await Promise.race([
    new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        if (typeof img.decode === 'function') {
          img.decode().catch(() => undefined).finally(resolve);
        } else {
          resolve();
        }
      };
      img.onerror = () => resolve();
      img.src = src;
    }),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

function isSoftwareRenderer(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return true;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (!dbg) return false;
    const str = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '');
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(str);
  } catch {
    return true;
  }
}

let thumbsPrewarmed = false;

/**
 * Pre-renders core furniture & electrotherapy catalog thumbnails cleanly into
 * in-memory WebP cache once GLB models are loaded so opening the Store Sheet
 * is instant with zero UI stutter.
 */
export async function prewarmCoreCatalogThumbs(): Promise<void> {
  if (thumbsPrewarmed || !glbRegistry.ready) return;
  thumbsPrewarmed = true;
  if (isSoftwareRenderer()) return;

  const priorityIds = [
    'treatment_bed',
    'tens_unit',
    'ultrasound_unit',
    'infrared_lamp',
    'shockwave_eswt',
    'laser_therapy',
    'traction_table',
    'parallel_bars',
  ];

  const specs = priorityIds
    .map((id) => CATALOG_ITEMS.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => ({
      sprite: c.sprite,
      width: c.width,
      depth: c.depth,
    }));

  if (specs.length === 0) return;

  // Yield a frame first so main scene compilation breathes cleanly
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  renderThumbBatch(specs.slice(0, 4));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  renderThumbBatch(specs.slice(4));
}

export function formatBytesCompact(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
