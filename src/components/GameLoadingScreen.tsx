import React, { useEffect, useMemo, useRef, useState } from 'react';
import { glbRegistry, GlbProgressInfo, startPreloadGlbs } from '../engine3d/glbRegistry';
import {
  decodeImageAsset,
  GAME_LOADING_TIPS,
  initSmartBrowserCache,
  resolveAndCacheSplashArt,
  waitForWebFonts,
} from '../services/gameBootLoader';
import { hydrateThumbCacheFromIdb } from '../engine3d/thumbRenderer';
import { Language } from '../types/clinic';

interface GameLoadingScreenProps {
  language: Language;
  hydrated: boolean;
  sceneReady: boolean;
  onFinished: () => void;
}

const SPLASH_KEYART_SRC = '/assets/aistudio/splash_cover.webp';
const SPLASH_BACKDROP_SRC = '/assets/aistudio/splash_backdrop.webp';
const MIN_WARM_SPLASH_MS = 700;
const MIN_COLD_SPLASH_MS = 1400;
const TIP_ROTATE_MS = 1650;

export const GameLoadingScreen: React.FC<GameLoadingScreenProps> = ({
  language,
  hydrated,
  sceneReady,
  onFinished,
}) => {
  const isAr = language === 'ar';
  const [fontsReady, setFontsReady] = useState(false);
  const [artReady, setArtReady] = useState(false);
  const [artFailed, setArtFailed] = useState(false);
  const [backdropFailed, setBackdropFailed] = useState(false);
  const [thumbsHydrated, setThumbsHydrated] = useState(false);
  const [warmDwellDone, setWarmDwellDone] = useState(false);
  const [coldDwellDone, setColdDwellDone] = useState(false);
  const [webglFallbackDone, setWebglFallbackDone] = useState(false);
  const [glbInfo, setGlbInfo] = useState<GlbProgressInfo>(() => glbRegistry.getProgressInfo());

  const [displayProgress, setDisplayProgress] = useState(0.08);
  const [phase, setPhase] = useState<'loading' | 'complete' | 'fading'>('loading');

  const [tipIndex, setTipIndex] = useState(0);
  const [tipVisible, setTipVisible] = useState(true);

  const startedAtRef = useRef<number>(
    typeof performance !== 'undefined' ? performance.now() : Date.now()
  );
  const completedRef = useRef(false);

  // Smart browser-first boot: Service Worker, priority Tier-1 GLB cache, fonts, WebP cover & persisted IDB thumbnails
  useEffect(() => {
    let active = true;
    const blobUrlsToRevoke: string[] = [];
    initSmartBrowserCache();
    startPreloadGlbs();

    waitForWebFonts(450).then(() => {
      if (active) setFontsReady(true);
    });

    hydrateThumbCacheFromIdb().finally(() => {
      if (active) setThumbsHydrated(true);
    });

    // Silently persist lightweight WebP cover & backdrop into CacheStorage without swapping src mid-paint
    void resolveAndCacheSplashArt(SPLASH_KEYART_SRC).then((url) => {
      if (url) blobUrlsToRevoke.push(url);
    });
    void resolveAndCacheSplashArt(SPLASH_BACKDROP_SRC).then((url) => {
      if (url) blobUrlsToRevoke.push(url);
    });

    decodeImageAsset(SPLASH_KEYART_SRC, 450).then(() => {
      if (active) setArtReady(true);
    });

    const unsubProgress = glbRegistry.onProgress((info) => {
      if (active) setGlbInfo(info);
    });

    const warmTimer = setTimeout(() => {
      if (active) setWarmDwellDone(true);
    }, MIN_WARM_SPLASH_MS);

    const coldTimer = setTimeout(() => {
      if (active) setColdDwellDone(true);
    }, MIN_COLD_SPLASH_MS);

    return () => {
      active = false;
      unsubProgress();
      clearTimeout(warmTimer);
      clearTimeout(coldTimer);
      for (const u of blobUrlsToRevoke) URL.revokeObjectURL(u);
    };
  }, []);

  // Safety guard after core GLBs & DB finish so broken WebGL cannot stall forever
  useEffect(() => {
    if (!glbInfo.coreReady || !hydrated || sceneReady) return;
    const t = setTimeout(() => setWebglFallbackDone(true), 6500);
    return () => clearTimeout(t);
  }, [glbInfo.coreReady, hydrated, sceneReady]);

  const effectiveSceneReady = sceneReady || webglFallbackDone;

  // Crisp fast tip rotation (already visible on initial frame)
  useEffect(() => {
    if (phase !== 'loading') return;
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;
    const interval = setInterval(() => {
      setTipVisible(false);
      fadeTimer = setTimeout(() => {
        setTipIndex((idx) => (idx + 1) % GAME_LOADING_TIPS.length);
        setTipVisible(true);
      }, 130);
    }, TIP_ROTATE_MS);

    return () => {
      clearInterval(interval);
      if (fadeTimer) clearTimeout(fadeTimer);
    };
  }, [phase]);

  const handleCycleTip = () => {
    if (phase !== 'loading') return;
    setTipIndex((idx) => (idx + 1) % GAME_LOADING_TIPS.length);
    setTipVisible(true);
  };

  const isWarmCacheBoot = glbInfo.cacheHits >= Math.max(8, Math.floor(glbInfo.coreTotal * 0.65));
  const minDwellDone = isWarmCacheBoot ? warmDwellDone : coldDwellDone;

  // Real weighted priority-first boot progress target (0..1)
  const realTargetProgress = useMemo(() => {
    const idbWeight = hydrated ? 0.1 : 0.04;
    const thumbWeight = thumbsHydrated ? 0.06 : 0.02;
    const fontWeight = fontsReady ? 0.08 : 0.03;
    const artWeight = artReady ? 0.06 : 0.02;
    const coreGlbWeight = glbInfo.coreProgress * 0.5;
    const sceneWeight = effectiveSceneReady ? 0.2 : glbInfo.coreReady ? 0.08 : 0;
    return Math.min(1, idbWeight + thumbWeight + fontWeight + artWeight + coreGlbWeight + sceneWeight);
  }, [hydrated, thumbsHydrated, fontsReady, artReady, glbInfo.coreProgress, glbInfo.coreReady, effectiveSceneReady]);

  const allWorkDone =
    hydrated && thumbsHydrated && fontsReady && glbInfo.coreReady && effectiveSceneReady && minDwellDone;

  // Monotonic damped real progress bar animation (only commits React state when displayed % changes)
  useEffect(() => {
    let rafId = 0;
    let lastT = performance.now();
    let localProg = displayProgress;
    let lastCommittedPct = Math.round(localProg * 100);
    const activeDwellMs = isWarmCacheBoot ? MIN_WARM_SPLASH_MS : MIN_COLD_SPLASH_MS;

    const step = (now: number) => {
      const dt = Math.min(0.08, Math.max(0.012, (now - lastT) / 1000));
      lastT = now;

      const elapsedFraction = Math.min(1, (now - startedAtRef.current) / activeDwellMs);
      const rawCap = allWorkDone
        ? 1
        : Math.min(0.97, Math.min(realTargetProgress, 0.2 + elapsedFraction * 0.8));

      if (allWorkDone && localProg >= 0.996) {
        if (localProg < 1) {
          localProg = 1;
          setDisplayProgress(1);
        }
        return;
      }

      if (rawCap > localProg) {
        const speed = allWorkDone ? 15 : isWarmCacheBoot ? 9.5 : 5.4;
        const next = localProg + (rawCap - localProg) * Math.min(1, dt * speed);
        localProg = Math.min(rawCap, Math.max(localProg, next));
        const nextPct = Math.round(localProg * 100);
        if (nextPct !== lastCommittedPct || localProg >= 0.992) {
          lastCommittedPct = nextPct;
          setDisplayProgress(localProg);
        }
      }

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realTargetProgress, allWorkDone, isWarmCacheBoot]);

  const readyToComplete = allWorkDone && displayProgress >= 0.992;
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  useEffect(() => {
    if (!readyToComplete || completedRef.current) return;
    completedRef.current = true;
    setDisplayProgress(1);
    setPhase('complete');

    const tFade = setTimeout(() => {
      setPhase('fading');
    }, 220);

    const tDone = setTimeout(() => {
      onFinishedRef.current();
    }, 620);

    return () => {
      clearTimeout(tFade);
      clearTimeout(tDone);
    };
  }, [readyToComplete]);

  const pct = Math.min(100, Math.max(1, Math.round(displayProgress * 100)));
  const activeTip = GAME_LOADING_TIPS[tipIndex % GAME_LOADING_TIPS.length];

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      role="status"
      aria-live="polite"
      className={`fixed inset-0 z-[100] w-full h-full overflow-hidden select-none bg-[#0a49b5] transition-opacity duration-400 ease-out ${
        phase === 'fading' ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
      }`}
    >
      {/* Matching Sunny Sky-to-Royal-Blue Widescreen Gradient Base */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-[#1374ee] via-[#268ef8] to-[#042466]"
      />

      {/* Lightweight Pre-Blurred Sky & Foliage Widescreen Extension for Tablet & Laptop (2KB WebP, zero GPU blur cost) */}
      {!backdropFailed && (
        <img
          src={SPLASH_BACKDROP_SRC}
          alt=""
          aria-hidden="true"
          decoding="async"
          onError={() => setBackdropFailed(true)}
          className="hidden sm:block pointer-events-none absolute inset-x-0 top-0 w-full h-[78vh] object-cover object-center opacity-55 [mask-image:linear-gradient(to_bottom,black_0%,black_50%,transparent_96%)] [-webkit-mask-image:linear-gradient(to_bottom,black_0%,black_50%,transparent_96%)]"
        />
      )}

      {/* Subtle Sunbeam Halo & Lateral Depth Vignette for Wide Tablet/Laptop Viewports */}
      <div
        aria-hidden="true"
        className="hidden sm:block absolute inset-0 bg-[radial-gradient(ellipse_at_50%_24%,rgba(125,211,252,0.28),transparent_62%)] pointer-events-none"
      />

      {/* Main Focal Clinic Cover Art Stage: Renders Immediately at Full Opacity & Adapts Cleanly to Mobile, Tablet & Laptop */}
      <div className="absolute inset-x-0 top-0 flex justify-center pointer-events-none">
        <div className="relative w-full h-[76vh] min-h-[400px] sm:w-auto sm:h-[75vh] md:h-[76vh] lg:h-[77vh] sm:max-h-[720px] sm:aspect-[580/712] max-w-full sm:max-w-[92vw] shrink-0 sm:[mask-image:linear-gradient(to_right,transparent_0%,black_10%,black_90%,transparent_100%)] sm:[-webkit-mask-image:linear-gradient(to_right,transparent_0%,black_10%,black_90%,transparent_100%)]">
          {!artFailed && (
            <img
              src={SPLASH_KEYART_SRC}
              alt="Therason Physiotherapy Clinic"
              referrerPolicy="no-referrer"
              fetchPriority="high"
              decoding="async"
              onLoad={() => setArtReady(true)}
              onError={() => {
                setArtFailed(true);
                setArtReady(true);
              }}
              className="w-full h-full object-cover object-top [mask-image:linear-gradient(to_bottom,black_0%,black_74%,transparent_98%)] [-webkit-mask-image:linear-gradient(to_bottom,black_0%,black_74%,transparent_98%)]"
            />
          )}
        </div>
      </div>

      {/* Seamless Lower Royal-Blue Deck Backing Behind Live Loading Bar & Auto-Tips */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[36vh] sm:h-[34vh] bg-gradient-to-t from-[#031f5c] via-[#093482]/90 to-transparent pointer-events-none"
      />

      {/* Interactive Live Bottom HUD (Progress + Instant Fast-Rotating Tips) */}
      <div className="relative z-10 flex flex-col justify-end items-center w-full h-full px-4 sm:px-6 pb-7 sm:pb-9 md:pb-11">
        <div className="w-full max-w-[540px] md:max-w-[600px] flex flex-col items-center gap-2.5 sm:gap-3.5">
          {/* Header Status Bar */}
          <div className="inline-flex items-center gap-2.5 px-7 py-1.5 rounded-full bg-[#13326e]/95 border border-sky-300/25 shadow-[0_8px_22px_rgba(3,18,54,0.45)]">
            <span className="text-base sm:text-xl font-extrabold text-white tracking-wide">
              {isAr ? 'جاري التحميل' : 'Loading'}
            </span>
            <span className="text-sm sm:text-base font-mono font-extrabold tabular-nums text-cyan-300">
              {pct}%
            </span>
          </div>

          {/* Live Illuminated Cyan Progress Track */}
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            className="w-full max-w-[460px] md:max-w-[500px] h-[18px] sm:h-[22px] rounded-full bg-[#031747]/92 border-2 border-[#2dd4ff]/90 p-[2.5px] overflow-hidden shadow-[0_0_20px_rgba(34,211,238,0.4)]"
          >
            <div
              className={`relative h-full rounded-full ${
                isAr
                  ? 'bg-gradient-to-l from-[#0284c7] via-[#06d6ff] to-[#8af3ff]'
                  : 'bg-gradient-to-r from-[#0284c7] via-[#06d6ff] to-[#8af3ff]'
              } shadow-[0_0_16px_rgba(34,211,238,0.8)] transition-[width] duration-150 ease-out`}
              style={{ width: `${pct}%` }}
            >
              <div
                aria-hidden="true"
                className="absolute inset-x-1.5 top-[2px] h-[35%] rounded-full bg-white/45"
              />
            </div>
          </div>

          {/* Glowing Cyan-Bordered Instant-Display Auto-Rotating Tips Banner (Click/Tap to Next Tip) */}
          <button
            type="button"
            onClick={handleCycleTip}
            aria-label={isAr ? 'عرض النصيحة التالية' : 'Show next tip'}
            className="w-full text-start cursor-pointer rounded-[24px] sm:rounded-[26px] bg-[#082661]/94 border-[1.5px] border-[#38d3ff]/80 px-3.5 py-2.5 sm:px-5 sm:py-3 shadow-[0_12px_32px_rgba(2,16,52,0.58)] flex items-center gap-3 active:scale-[0.99] transition-transform duration-150"
          >
            {/* Golden Lightbulb Icon */}
            <div className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 64 64" aria-hidden="true" className="w-full h-full drop-shadow-[0_0_10px_rgba(250,204,21,0.6)]">
                <g stroke="#fde047" strokeWidth="3.2" strokeLinecap="round">
                  <line x1="32" y1="4" x2="32" y2="10" />
                  <line x1="12" y1="14" x2="17" y2="18" />
                  <line x1="52" y1="14" x2="47" y2="18" />
                  <line x1="7" y1="30" x2="13" y2="30" />
                  <line x1="57" y1="30" x2="51" y2="30" />
                </g>
                <path
                  d="M32 14c-8.8 0-15 6.4-15 14.4 0 5.1 2.7 9.4 6.7 12.2 1.4 1 2.3 2.5 2.6 4.2h11.4c.3-1.7 1.2-3.2 2.6-4.2 4-2.8 6.7-7.1 6.7-12.2C47 20.4 40.8 14 32 14Z"
                  fill="url(#bulbGold)"
                />
                <path d="M26 30c0-3.2 2.4-5.5 6-5.5" stroke="#fffbeb" strokeWidth="2.4" strokeLinecap="round" fill="none" />
                <rect x="25.5" y="45.5" width="13" height="4" rx="2" fill="#cbd5e1" />
                <rect x="27" y="50.5" width="10" height="3.5" rx="1.75" fill="#94a3b8" />
                <defs>
                  <radialGradient id="bulbGold" cx="42%" cy="35%" r="60%">
                    <stop offset="0%" stopColor="#fef9c3" />
                    <stop offset="55%" stopColor="#facc15" />
                    <stop offset="100%" stopColor="#eab308" />
                  </radialGradient>
                </defs>
              </svg>
            </div>

            {/* Crisp White Vertical Divider */}
            <div aria-hidden="true" className="w-[1.5px] h-9 sm:h-10 bg-white/75 rounded-full shrink-0" />

            {/* Auto-Rotating Tip Text */}
            <div className="min-w-0 flex-1 text-center sm:text-start">
              <p
                className={`text-xs sm:text-sm font-bold leading-snug text-white will-change-[opacity,transform] transition-all duration-150 ${
                  tipVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-0.5'
                }`}
              >
                <span className="text-[#38e1ff] font-extrabold">
                  {isAr ? `${activeTip.categoryAr}: ` : `${activeTip.categoryEn}: `}
                </span>
                <span>{isAr ? activeTip.textAr : activeTip.textEn}</span>
              </p>
            </div>

            {/* Miniature Blue Clinical Bed & Therapy Cart Accent Graphic */}
            <div className="hidden xs:flex sm:flex w-14 sm:w-16 h-11 sm:h-12 shrink-0 items-center justify-center">
              <svg viewBox="0 0 96 72" aria-hidden="true" className="w-full h-full drop-shadow-[0_4px_10px_rgba(2,14,44,0.65)]">
                {/* Physiotherapy bed frame */}
                <path d="M12 40 L48 24 L72 34 L36 50 Z" fill="#1d85f8" stroke="#bae6fd" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M12 40 L36 50 L36 55 L12 45 Z" fill="#0f4eb8" />
                <path d="M36 50 L72 34 L72 39 L36 55 Z" fill="#1764d8" />
                {/* Raised headrest & screen */}
                <path d="M46 25 L62 16 L74 22 L58 31 Z" fill="#38bdf8" />
                <rect x="19" y="47" width="3.5" height="12" rx="1.5" fill="#cbd5e1" />
                <rect x="46" y="45" width="3.5" height="12" rx="1.5" fill="#cbd5e1" />
                {/* Side electrotherapy cart */}
                <rect x="74" y="29" width="14" height="22" rx="2.5" fill="#e2e8f0" stroke="#60a5fa" strokeWidth="1.2" />
                <rect x="76.5" y="22" width="9" height="7" rx="1.5" fill="#0284c7" stroke="#bae6fd" strokeWidth="1" />
                <rect x="78" y="23.5" width="6" height="4" rx="0.8" fill="#38bdf8" />
                {/* Gym stability ball */}
                <circle cx="62" cy="54" r="7.5" fill="url(#ballBlue)" />
                <defs>
                  <radialGradient id="ballBlue" cx="35%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="#7dd3fc" />
                    <stop offset="100%" stopColor="#0284c7" />
                  </radialGradient>
                </defs>
              </svg>
            </div>
          </button>
        </div>
      </div>

      {/* Signature Double-Wave Cyan & Deep Navy Footer Edge */}
      <svg
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 w-full h-9 sm:h-12 md:h-14 z-20"
      >
        <path
          d="M0,48 C320,96 620,12 960,48 C1180,70 1330,42 1440,20 L1440,120 L0,120 Z"
          fill="#0fc2ff"
        />
        <path
          d="M0,66 C340,112 640,34 980,68 C1200,88 1340,64 1440,42 L1440,120 L0,120 Z"
          fill="#03266d"
        />
      </svg>
    </div>
  );
};
