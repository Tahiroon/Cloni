import { CATALOG_ITEMS } from '../data/catalog';
import {
  cacheStaticAssetUrl,
  getCachedAssetBlobUrl,
  glbRegistry,
  openAssetCache,
} from '../engine3d/glbRegistry';
import {
  CatalogThumbSpec,
  getMissingCatalogThumbSpecs,
  hasPlayerOutfitThumb,
  hydrateThumbCacheFromIdb,
  PlayerThumbSpec,
  renderPlayerOutfitBatch,
  renderThumbBatch,
} from '../engine3d/thumbRenderer';
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
const FONT_STYLESHEET_URL =
  'https://fonts.googleapis.com/css2?family=Cairo:wght@500;600;700;800&family=JetBrains+Mono:wght@500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap';

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

/**
 * Resolves a browser-cached Blob URL for the splash artwork when available in CacheStorage,
 * or fetches & persists it silently in CacheStorage for instant future visits.
 */
export async function resolveAndCacheSplashArt(src: string): Promise<string | null> {
  const cachedBlobUrl = await getCachedAssetBlobUrl(src);
  if (cachedBlobUrl) return cachedBlobUrl;
  void cacheStaticAssetUrl(src, 'image/png');
  return null;
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
 * Hydrates persisted WebP thumbnails from IndexedDB first, then pre-renders any missing
 * core clinic items cleanly so opening the Store Sheet is instant.
 */
export async function prewarmCoreCatalogThumbs(): Promise<void> {
  await hydrateThumbCacheFromIdb();
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

  const specs: CatalogThumbSpec[] = priorityIds
    .map((id) => CATALOG_ITEMS.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => ({
      sprite: c.sprite,
      width: c.width,
      depth: c.depth,
    }));

  const missing = getMissingCatalogThumbSpecs(specs);
  if (missing.length === 0) return;

  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  renderThumbBatch(missing.slice(0, 4));
  if (missing.length > 4) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    renderThumbBatch(missing.slice(4));
  }
}

function waitForIdleSlice(delayMs = 140): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const w = window as unknown as {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      };
      if (typeof w.requestIdleCallback === 'function') {
        w.requestIdleCallback(() => resolve(), { timeout: 600 });
      } else {
        requestAnimationFrame(() => resolve());
      }
    }, delayMs);
  });
}

async function cacheWebFontsBestEffort(): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  const cache = await openAssetCache();
  if (!cache) return;
  try {
    let cssText = '';
    const existingCss = await cache.match(FONT_STYLESHEET_URL);
    if (existingCss && existingCss.ok) {
      cssText = await existingCss.text();
    } else {
      const res = await fetch(FONT_STYLESHEET_URL, { cache: 'default' });
      if (!res.ok) return;
      cssText = await res.text();
      await cache.put(
        FONT_STYLESHEET_URL,
        new Response(cssText, {
          status: 200,
          headers: { 'Content-Type': 'text/css; charset=utf-8' },
        })
      );
    }

    const matches = cssText.match(/https:\/\/fonts\.gstatic\.com\/[^)"']+\.woff2/g);
    if (!matches) return;
    const uniqueUrls = Array.from(new Set(matches)).slice(0, 24);
    for (const fontUrl of uniqueUrls) {
      const hit = await cache.match(fontUrl);
      if (!hit) {
        await cacheStaticAssetUrl(fontUrl, 'font/woff2');
      }
    }
  } catch {
    // Non-fatal font caching guard
  }
}

let idlePrewarmStarted = false;

/**
 * Quietly warms remaining catalog thumbnails, character outfit previews, and font files
 * in browser storage during idle slices after entering the clinic so gameplay stays at 60 FPS
 * and subsequent visits load cleanly from local storage.
 */
export function scheduleIdleBrowserPrewarm(): () => void {
  if (idlePrewarmStarted || typeof window === 'undefined') return () => {};
  idlePrewarmStarted = true;
  let cancelled = false;

  void (async () => {
    await waitForIdleSlice(1100);
    if (cancelled) return;

    await hydrateThumbCacheFromIdb();
    if (cancelled) return;

    // 1. Best-effort offline cache for Google Fonts CSS & woff2 faces
    void cacheWebFontsBestEffort();

    if (isSoftwareRenderer() || !glbRegistry.ready) return;

    // 2. Incrementally cache remaining store thumbnails in IndexedDB (3 per idle slice)
    const allSpecs: CatalogThumbSpec[] = CATALOG_ITEMS.map((c) => ({
      sprite: c.sprite,
      width: c.width,
      depth: c.depth,
    }));
    const missingCatalog = getMissingCatalogThumbSpecs(allSpecs);

    for (let i = 0; i < missingCatalog.length; i += 3) {
      if (cancelled) return;
      await waitForIdleSlice(150);
      if (cancelled) return;
      renderThumbBatch(missingCatalog.slice(i, i + 3));
    }

    // 3. Incrementally cache male & female clinician outfit thumbnails in IndexedDB
    const outfitSpecs: PlayerThumbSpec[] = [
      { gender: 'male', outfitId: 'lab_coat', hasTarha: false },
      { gender: 'male', outfitId: 'scrubs', hasTarha: false },
      { gender: 'male', outfitId: 'shirt_pants', hasTarha: false },
      { gender: 'female', outfitId: 'scrubs', hasTarha: true },
      { gender: 'female', outfitId: 'lab_coat', hasTarha: true },
      { gender: 'female', outfitId: 'shirt_pants', hasTarha: true },
      { gender: 'female', outfitId: 'female_abaya_closed', hasTarha: true },
      { gender: 'female', outfitId: 'female_abaya_light', hasTarha: true },
      { gender: 'female', outfitId: 'female_abaya_niqab', hasTarha: true },
    ];
    const missingOutfits = outfitSpecs.filter(
      (s) => !hasPlayerOutfitThumb(s.gender, s.outfitId, s.hasTarha)
    );

    for (let i = 0; i < missingOutfits.length; i += 2) {
      if (cancelled) return;
      await waitForIdleSlice(180);
      if (cancelled) return;
      renderPlayerOutfitBatch(missingOutfits.slice(i, i + 2));
    }
  })();

  return () => {
    cancelled = true;
  };
}
