import React from 'react';
import { Coins, Settings, Star, Users } from 'lucide-react';
import { Language, LightingMode } from '../types/clinic';

interface TopHudBarProps {
  coins: number;
  stars: number;
  level?: number;
  xp?: number;
  onlineFriends: number;
  satisfaction: number;
  language: Language;
  lightingMode?: LightingMode;
  visitingFriendName: string | null;
  onOpenBonus: () => void;
  onOpenFriends: () => void;
  onOpenSettings: () => void;
  onExitFriendVisit: () => void;
}

export const TopHudBar: React.FC<TopHudBarProps> = ({
  coins,
  stars,
  level = 1,
  xp = 0,
  onlineFriends,
  satisfaction,
  language,
  lightingMode = 'day',
  visitingFriendName,
  onOpenBonus,
  onOpenFriends,
  onOpenSettings,
  onExitFriendVisit,
}) => {
  const isAr = language === 'ar';
  const isNight = lightingMode === 'night';
  const levelProgress = Math.min(100, Math.round(((xp % 300) / 300) * 100));
  const pillSurface = isNight
    ? 'bg-slate-950/90 border-sky-400/25 shadow-[0_8px_24px_rgba(2,6,23,0.65)]'
    : 'bg-slate-900/82 border-white/15 shadow-lg';

  return (
    <div className="pointer-events-none fixed top-0 left-0 right-0 z-30 flex flex-col gap-2 p-2 sm:p-3">
      <header
        dir="ltr"
        className="flex items-center justify-between gap-1.5 w-full max-w-full"
      >
        {/* Top-Left Compact Student Profile Badge (zero overlap on mobile) */}
        <div
          className={`pointer-events-auto flex items-center gap-1.5 sm:gap-2 backdrop-blur-md border rounded-2xl px-2 py-1.5 text-white min-w-0 shrink transition-colors ${pillSurface}`}
        >
          <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-sky-400 to-blue-700 border-2 border-sky-200 flex items-center justify-center shrink-0 shadow">
            <svg viewBox="0 0 36 36" className="w-6 h-6 sm:w-7 sm:h-7" aria-hidden="true">
              <circle cx="18" cy="13" r="6" fill="#f1c7a4" />
              <path d="M12 11c0-4 3-6 6-6s6 2 6 6c-1.5-1.5-3.5-2-6-2s-4.5.5-6 2z" fill="#1e293b" />
              <path d="M8 31c1-6 4.5-9 10-9s9 3 10 9z" fill="#f8fafc" />
              <path d="M15 22l3 4 3-4" fill="#0284c7" />
            </svg>
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-sky-500 border border-white text-[9px] font-black flex items-center justify-center tabular-nums">
              {level}
            </span>
          </div>

          <div className="min-w-0 pr-0.5">
            <div className="flex items-center gap-1">
              <span className="text-[11px] sm:text-xs font-extrabold truncate max-w-[78px] sm:max-w-[120px]">
                {isAr ? 'طالب ثيراسون' : 'Therason'}
              </span>
              <span className="text-[10px] font-bold text-amber-300 flex items-center gap-0.5 tabular-nums shrink-0">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                {stars}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <div className="w-12 sm:w-20 h-1.5 rounded-full bg-slate-700/90 overflow-hidden shrink-0">
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
        </div>

        {/* Top-Right Cluster: Coins (∞) + Colleagues + Settings */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenBonus}
            aria-label={isAr ? 'كسب عملات إضافية' : 'Earn bonus coins'}
            className={`pointer-events-auto flex items-center gap-1 hover:bg-slate-900/95 backdrop-blur-md rounded-xl pl-2 pr-1 py-1.5 border text-white active:scale-95 transition-all ${pillSurface}`}
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
            className={`pointer-events-auto h-8 sm:h-9 px-2 sm:px-2.5 rounded-xl hover:bg-slate-900/95 backdrop-blur-md border flex items-center gap-1 text-white active:scale-95 transition-all ${pillSurface}`}
          >
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-300 shrink-0" />
            <span className="text-xs font-bold tabular-nums">{onlineFriends}</span>
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label={isAr ? 'الإعدادات' : 'Settings'}
            className={`pointer-events-auto w-8 h-8 sm:w-9 sm:h-9 rounded-xl hover:bg-slate-900/95 backdrop-blur-md border flex items-center justify-center text-white active:scale-95 transition-all ${pillSurface}`}
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
};
