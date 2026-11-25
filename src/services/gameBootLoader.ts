import { CATALOG_ITEMS } from '../data/catalog';
import {
  cacheStaticAssetUrl,
  glbRegistry,
  openAssetCache,
} from '../engine3d/glbRegistry';
import {
  CatalogThumbSpec,
  disposeSharedThumbSession,
  getMissingCatalogThumbSpecs,
  hydrateThumbCacheFromIdb,
  renderThumbBatch,
} from '../engine3d/thumbRenderer';
import { Language } from '../types/clinic';

interface SmartLoadingTip {
  id: string;
  categoryAr: string;
  categoryEn: string;
  textAr: string;
  textEn: string;
}

export const GAME_LOADING_TIPS: SmartLoadingTip[] = [
  {
    id: 'tip_red_flags',
    categoryAr: 'نصيحة سريرية',
    categoryEn: 'Clinical Tip',
    textAr: 'افحص علامات الخطر أولاً قبل اختيار أي جهاز لحماية المريض ورفع التقييم.',
    textEn: 'Screen for Red Flags before applying any modality to keep patients safe.',
  },
  {
    id: 'tip_fpp_proximity',
    categoryAr: 'طريقة اللعب',
    categoryEn: 'Controls',
    textAr: 'اقترب من أي جهاز لالتقاطه ثم ضعه بجانب السرير لضبط الجرعة وتشغيله.',
    textEn: 'Walk near a modality cart to grab it, then place it bedside to configure.',
  },
  {
    id: 'tip_ir_distance',
    categoryAr: 'الأشعة الحرارية',
    categoryEn: 'Infrared Lamp',
    textAr: 'ثبّت مصباح الأشعة على مسافة 45 إلى 60 سم عمودياً لتدفئة آمنة وفعّالة.',
    textEn: 'Keep the Infrared Lamp 45–60 cm perpendicular for safe, effective warmth.',
  },
  {
    id: 'tip_tens_vs_ifc',
    categoryAr: 'العلاج الكهربائي',
    categoryEn: 'Electrotherapy',
    textAr: 'تيار التداخل يصل للأنسجة العميقة براحة أكبر في آلام الظهر والركبة.',
    textEn: 'Interferential Current reaches deeper tissues comfortably for back and knee pain.',
  },
  {
    id: 'tip_ultrasound_coupling',
    categoryAr: 'الموجات فوق الصوتية',
    categoryEn: 'Ultrasound',
    textAr: 'حرّك المجس باستمرار فوق الجل واختر 1 MHz للعمق أو 3 MHz للسطحي.',
    textEn: 'Glide continuously over gel: pick 1 MHz for deep or 3 MHz for superficial.',
  },
  {
    id: 'tip_posture_sync',
    categoryAr: 'وضعية المريض',
    categoryEn: 'Patient Posture',
    textAr: 'بدّل وضعية المريض بين الاستلقاء والجلوس والوقوف بما يناسب كل جهاز.',
    textEn: 'Match patient posture between supine, sitting, and standing per modality.',
  },
  {
    id: 'tip_clinic_workflow',
    categoryAr: 'تطوير العيادة',
    categoryEn: 'Clinic Growth',
    textAr: 'افتح أجنحة جديدة وأضف الديكور والألواح الشمسية لزيادة مرضاك يومياً.',
    textEn: 'Unlock new wings and add decor or solar panels to welcome more patients.',
  },
  {
    id: 'tip_proper_devices',
    categoryAr: 'الدقة العلاجية',
    categoryEn: 'Precision',
    textAr: 'اضبط الشدة والوقت بدقة وفق ملف المريض لتحقيق أعلى نقاط الجلسة.',
    textEn: 'Tailor intensity and timer to the patient chart for top session scores.',
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

export async function waitForWebFonts(timeoutMs = 500): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts?.ready) return;
  await Promise.race([
    document.fonts.ready.then(() => undefined).catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

/**
 * Silently ensures splash artwork is cached in CacheStorage after initial paint
 * without allocating unused Blob URLs or blocking frame-0 rasterization.
 */
export function ensureSplashArtCached(src: string): void {
  const mime = src.endsWith('.webp') ? 'image/webp' : 'image/png';
  void cacheStaticAssetUrl(src, mime);
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

let smartCacheInitStarted = false;

/**
 * Registers the browser-first Service Worker and requests persistent storage
 * so mobile & desktop browsers retain GLB models, thumbnails, and clinic saves.
 */
export function initSmartBrowserCache(): void {
  if (smartCacheInitStarted || typeof window === 'undefined') return;
  smartCacheInitStarted = true;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Graceful fallback when running in restricted embeds
    });
  }

  const storage = navigator.storage as (StorageManager & { persisted?: () => Promise<boolean> }) | undefined;
  if (storage && typeof storage.persist === 'function') {
    storage.persisted?.().then((already) => {
      if (!already) {
        return storage.persist();
      }
      return true;
    }).catch(() => {
      // Ignore permission/browser-specific rejections
    });
  }
}

let thumbsPrewarmPromise: Promise<void> | null = null;

/**
 * Hydrates persisted WebP thumbnails from IndexedDB first, then pre-renders any missing
 * core clinic items cleanly in small frame slices and releases the temporary WebGL session.
 */
export function prewarmCoreCatalogThumbs(): Promise<void> {
  if (thumbsPrewarmPromise) return thumbsPrewarmPromise;
  thumbsPrewarmPromise = (async () => {
    await hydrateThumbCacheFromIdb();
    if (!glbRegistry.coreReady || isSoftwareRenderer()) {
      thumbsPrewarmPromise = null;
      return;
    }

    const priorityIds = [
      'treatment_bed',
      'tens_unit',
      'ultrasound_unit',
      'infrared_lamp',
      'shockwave_eswt',
      'laser_therapy',
      'traction_table',
      'parallel_bars',
      'reception_desk',
      'waiting_chair',
      'biofeedback_trainer',
      'exercise_bike',
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

    const isMobile =
      typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const stepSize = isMobile ? 1 : 2;
    try {
      for (let i = 0; i < missing.length; i += stepSize) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        renderThumbBatch(missing.slice(i, i + stepSize));
      }
    } finally {
      disposeSharedThumbSession();
    }
  })();
  return thumbsPrewarmPromise;
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

let fontCachePromise: Promise<void> | null = null;

export function cacheWebFontsBestEffort(): Promise<void> {
  if (fontCachePromise) return fontCachePromise;
  fontCachePromise = (async () => {
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
  })();
  return fontCachePromise;
}

let idlePrewarmStarted = false;

/**
 * Quietly hydrates persisted thumbnails and warms web font & store thumbnail cache
 * during idle slices without impacting active clinic gameplay FPS.
 */
export function scheduleIdleBrowserPrewarm(): () => void {
  if (idlePrewarmStarted || typeof window === 'undefined') return () => {};
  idlePrewarmStarted = true;
  let cancelled = false;

  void (async () => {
    initSmartBrowserCache();
    await waitForIdleSlice(1400);
    if (cancelled) return;

    await hydrateThumbCacheFromIdb();
    if (cancelled) return;

    await prewarmCoreCatalogThumbs();
    if (cancelled) return;

    void cacheWebFontsBestEffort();
  })();

  return () => {
    cancelled = true;
  };
}
