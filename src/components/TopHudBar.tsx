import React from 'react';
import { BellRing, Coins, Settings, Star, Users } from 'lucide-react';
import {
  normalizePlayerProfile,
  PLAYER_DEFAULT_SKIN,
  resolvePlayerOutfitMeta,
} from '../data/catalog';
import { Language, LightingMode, PlayerCharacterConfig } from '../types/clinic';

interface TopHudBarProps {
  coins: number;
  stars: number;
  level?: number;
  xp?: number;
  waitingCount?: number;
  onlineFriends: number;
  satisfaction: number;
  language: Language;
  lightingMode?: LightingMode;
  playerProfile?: PlayerCharacterConfig;
  visitingFriendName: string | null;
  onOpenBonus: () => void;
  onOpenWaitingQueue?: () => void;
  onOpenFriends: () => void;
  onOpenSettings: () => void;
  onOpenPlayerProfile?: () => void;
  onExitFriendVisit: () => void;
}

export const TopHudBar: React.FC<TopHudBarProps> = React.memo(({
  coins,
  stars,
  level = 1,
  xp = 0,
  waitingCount = 0,
  onlineFriends,
  satisfaction,
  language,
  lightingMode = 'day',
  playerProfile,
  visitingFriendName,
  onOpenBonus,
  onOpenWaitingQueue,
  onOpenFriends,
  onOpenSettings,
  onOpenPlayerProfile,
  onExitFriendVisit,
}) => {
  const isAr = language === 'ar';
  const isNight = lightingMode === 'night';
  const profile = normalizePlayerProfile(playerProfile);
  const outfit = resolvePlayerOutfitMeta(profile.outfitId);
  const isFemale = profile.gender === 'female';
  const effectiveTarha = isFemale ? (outfit.forceTarha ? true : profile.hasTarha) : false;
  const hasNiqab = Boolean(isFemale && outfit.hasNiqab);
  const displayName = isAr ? 'طالب ثيراسون' : 'Therason';
  const levelProgress = Math.min(100, Math.round(((xp % 300) / 300) * 100));
  const pillSurface = isNight
    ? 'bg-slate-950/94 border-sky-400/25 shadow-[0_8px_24px_rgba(2,6,23,0.65)]'
    : 'bg-slate-900/92 border-white/15 shadow-lg';

  const tarhaFill =
    outfit.outfitStyle === 'abaya'
      ? '#141418'
      : outfit.outfitStyle === 'abaya_open'
        ? '#cbbba6'
        : '#e2e8f0';
  const coatOrShirtFill =
    outfit.medicalWear === 'lab_coat'
      ? '#f8fafc'
      : outfit.outfitStyle === 'abaya'
        ? '#141418'
        : outfit.shirtColor;

  return (
    <div className="pointer-events-none fixed top-0 left-0 right-0 z-30 flex flex-col gap-2 p-2 sm:p-3 md:px-4 md:py-3">
      <header
        dir="ltr"
        className="flex items-center justify-between gap-1.5 md:gap-3 w-full max-w-full"
      >
        {/* Top-Left Compact Student Profile Badge (tappable to open My Character modal) */}
        <button
          type="button"
          onClick={onOpenPlayerProfile}
          aria-label={isAr ? 'شخصيتي' : 'My Character'}
          title={isAr ? 'شخصيتي في العيادة (U)' : 'My Clinic Character (U)'}
          className={`pointer-events-auto flex items-center gap-1.5 sm:gap-2 border rounded-2xl px-2 md:px-2.5 py-1.5 text-white min-w-0 shrink transition-all text-left active:scale-95 hover:border-sky-300/60 cursor-pointer ${pillSurface}`}
        >
          <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-sky-400 to-blue-700 border-2 border-sky-200 flex items-center justify-center shrink-0 shadow">
            <svg viewBox="0 0 36 36" className="w-6 h-6 sm:w-7 sm:h-7" aria-hidden="true">
              {isFemale && effectiveTarha && (
                <path
                  d="M10 14c0-5 3.6-9 8-9s8 4 8 9v6H10v-6z"
                  fill={tarhaFill}
                />
              )}
              {isFemale && !effectiveTarha && (
                <path
                  d="M10 14c0-5 3.6-8.5 8-8.5s8 3.5 8 8.5v7H10v-7z"
                  fill="#18100c"
                />
              )}
              <circle cx="18" cy="13" r="5.5" fill={PLAYER_DEFAULT_SKIN} />
              {!isFemale && (
                <path d="M12.5 11.5c0-3.5 2.5-5.5 5.5-5.5s5.5 2 5.5 5.5c-1.4-1.5-3.2-2-5.5-2s-4.1.5-5.5 2z" fill="#18100c" />
              )}
              {hasNiqab && (
                <>
                  <path d="M12.7 10.6c1.5-2.1 9.1-2.1 10.6 0v1.2H12.7z" fill="#111216" />
                  <path d="M12.4 13.8h11.2c-.3 3.4-2.5 5.5-5.6 5.5s-5.3-2.1-5.6-5.5z" fill="#111216" />
                  <rect x="17.3" y="11.6" width="1.4" height="2.4" fill="#111216" />
                </>
              )}
              <path
                d="M8 31c1-6 4.5-9 10-9s9 3 10 9z"
                fill={coatOrShirtFill}
              />
              {outfit.medicalWear === 'lab_coat' && (
                <path d="M15 22l3 4 3-4" fill="#0284c7" />
              )}
            </svg>
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-sky-500 border border-white text-[9px] font-black flex items-center justify-center tabular-nums">
              {level}
            </span>
          </div>

          <div className="min-w-0 pr-0.5">
            <div className="flex items-center gap-1">
              <span className="text-[11px] sm:text-xs font-extrabold truncate max-w-[78px] sm:max-w-[120px] md:max-w-[160px]">
                {displayName}
              </span>
              <span className="text-[10px] font-bold text-amber-300 flex items-center gap-0.5 tabular-nums shrink-0">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                {stars}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <div className="w-12 sm:w-20 md:w-24 h-1.5 rounded-full bg-slate-700/90 overflow-hidden shrink-0">
                <div
                  className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 rounded-full transition-all"
                  style={{ width: `${Math.max(12, levelProgress)}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-emerald-300 tabular-nums shrink-0">
                {satisfaction}%
              </span>
            </div>
          </div>
        </button>

        {/* Top-Right Cluster: Coins (∞) + Smart Waiting Queue + Colleagues + Settings */}
        <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 shrink-0">
          {!visitingFriendName && onOpenWaitingQueue && (
            <button
              type="button"
              onClick={onOpenWaitingQueue}
              aria-label={isAr ? 'قائمة انتظار المرضى' : 'Waiting Queue'}
              title={isAr ? 'قائمة انتظار المرضى (Tab)' : 'Waiting Queue (Tab)'}
              className={`pointer-events-auto h-8 sm:h-9 px-2 sm:px-2.5 md:px-3 rounded-xl border flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                waitingCount > 0
                  ? isNight
                    ? 'bg-sky-950/94 border-sky-400/60 text-sky-100 hover:bg-sky-900/95 shadow-[0_8px_24px_rgba(2,132,199,0.28)]'
                    : 'bg-sky-700 hover:bg-sky-600 border-sky-300/60 text-white shadow-lg'
                  : `${pillSurface} text-white hover:bg-slate-900/95`
              }`}
            >
              <BellRing
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${
                  waitingCount > 0 ? 'text-amber-300' : 'text-sky-300'
                }`}
              />
              <span className="text-xs font-extrabold tabular-nums">{waitingCount}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenBonus}
            aria-label={isAr ? 'كسب عملات إضافية' : 'Earn bonus coins'}
            title={isAr ? 'تحدي سريع لربح عملات إضافية' : 'Quick Clinical Quiz for Bonus Coins'}
            className={`pointer-events-auto flex items-center gap-1 hover:bg-slate-900/95 rounded-xl pl-2 pr-1 py-1.5 border text-white active:scale-95 transition-all cursor-pointer ${pillSurface}`}
          >
            <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
            <span className="text-xs sm:text-sm font-extrabold tabular-nums">
              {coins >= 900000 ? '∞' : coins}
            </span>
            <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-xs font-black flex items-center justify-center leading-none">
              +
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenFriends}
            aria-label={isAr ? 'زملاء العيادة' : 'Colleague Clinics'}
            title={isAr ? 'عيادات الزملاء (K)' : 'Colleague Clinics (K)'}
            className={`pointer-events-auto h-8 sm:h-9 px-2 sm:px-2.5 md:px-3 rounded-xl hover:bg-slate-900/95 border flex items-center gap-1 text-white active:scale-95 transition-all cursor-pointer ${pillSurface}`}
          >
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-300 shrink-0" />
            <span className="text-xs font-bold tabular-nums">{onlineFriends}</span>
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label={isAr ? 'الإعدادات' : 'Settings'}
            title={isAr ? 'الإعدادات' : 'Settings'}
            className={`pointer-events-auto w-8 h-8 sm:w-9 sm:h-9 rounded-xl hover:bg-slate-900/95 border flex items-center justify-center text-white active:scale-95 transition-all cursor-pointer ${pillSurface}`}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Visiting Colleague Banner */}
      {visitingFriendName && (
        <div className="flex justify-center">
          <div className="pointer-events-auto flex items-center gap-2.5 bg-indigo-950/95 text-white px-3.5 py-1.5 rounded-2xl border border-indigo-400/50 shadow-xl">
            <span className="text-xs font-bold whitespace-nowrap">
              {isAr ? `زيارة: ${visitingFriendName}` : `Visiting: ${visitingFriendName}`}
            </span>
            <button
              type="button"
              onClick={onExitFriendVisit}
              className="px-2.5 py-1 rounded-xl bg-amber-400 text-slate-950 text-xs font-extrabold whitespace-nowrap active:scale-95"
            >
              {isAr ? 'عودة لعيادتي' : 'Back Home'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
