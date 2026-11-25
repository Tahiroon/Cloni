import React from 'react';
import {
  BellRing,
  Check,
  ClipboardList,
  Moon,
  Move,
  ShoppingCart,
  Sun,
  Users,
} from 'lucide-react';
import { Language, LightingMode, NavTab } from '../types/clinic';

interface BottomNavBarProps {
  activeTab: NavTab | null;
  editMode: boolean;
  language: Language;
  lightingMode?: LightingMode;
  storeAlert: boolean;
  disabled?: boolean;
  waitingCount?: number;
  missionsReadyCount?: number;
  onlineFriends?: number;
  onSelectTab: (tab: NavTab) => void;
  onToggleEditMode: () => void;
  onOpenWaitingQueue?: () => void;
  onOpenFriends?: () => void;
  onToggleLightingMode?: () => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = React.memo(({
  activeTab,
  editMode,
  language,
  lightingMode = 'day',
  storeAlert,
  disabled = false,
  waitingCount = 0,
  missionsReadyCount = 0,
  onlineFriends = 0,
  onSelectTab,
  onToggleEditMode,
  onOpenWaitingQueue,
  onOpenFriends,
  onToggleLightingMode,
}) => {
  const isAr = language === 'ar';
  const isNight = lightingMode === 'night';

  const dockSurface = isNight
    ? 'bg-slate-950/92 border-sky-400/25 shadow-[0_14px_38px_rgba(2,6,23,0.75)] text-slate-100'
    : 'bg-slate-900/92 border-white/20 shadow-[0_14px_38px_rgba(15,23,42,0.45)] text-white';

  return (
    <>
      {/* Standard Phone Bottom Bar (< 768px): 100% Untouched */}
      <nav
        aria-label="Clinic Navigation"
        dir="ltr"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 px-3 sm:px-3.5 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none"
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2.5 sm:gap-3">
          {/* Bottom-Left: Royal Blue Store Button */}
          <button
            type="button"
            disabled={disabled}
            onClick={(e) => {
              e.currentTarget.blur();
              onSelectTab('store');
            }}
            className={`pointer-events-auto relative min-w-[126px] sm:min-w-[138px] h-12 px-4 sm:px-5 rounded-2xl flex items-center justify-center gap-2 text-white border transition-transform whitespace-nowrap shrink-0 ${
              isNight
                ? 'border-sky-400/50 bg-gradient-to-b from-sky-600 to-slate-900 shadow-[0_6px_24px_rgba(14,165,233,0.35)]'
                : 'border-sky-300/40 bg-gradient-to-b from-sky-500 to-blue-800 shadow-[0_6px_20px_rgba(30,64,175,0.45)]'
            } ${
              activeTab === 'store' ? 'ring-2 ring-white -translate-y-0.5' : ''
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-95 hover:brightness-110'}`}
          >
            <ShoppingCart className="w-5 h-5 stroke-[2.2] shrink-0" />
            <span className="text-sm font-black">
              {isAr ? 'المتجر' : 'Store'}
            </span>
            {storeAlert && (
              <span className="absolute -top-1.5 -right-1 w-5 h-5 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center border-2 border-white shadow">
                !
              </span>
            )}
          </button>

          {/* Bottom-Right: Warm Gold Rearrange / Done Toggle Button */}
          <button
            type="button"
            disabled={disabled}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault();
              }
            }}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleEditMode();
            }}
            className={`pointer-events-auto min-w-[132px] sm:min-w-[144px] h-12 px-4 sm:px-5 rounded-2xl flex items-center justify-center gap-2 border shadow-[0_6px_20px_rgba(180,83,9,0.35)] transition-all whitespace-nowrap shrink-0 ${
              editMode
                ? 'bg-gradient-to-b from-emerald-400 to-emerald-600 text-slate-950 border-emerald-200 ring-2 ring-white font-black'
                : 'game-btn-gold text-slate-950 border-amber-200/80 font-black'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-95 hover:brightness-105'}`}
          >
            {editMode ? (
              <Check className="w-5 h-5 stroke-[2.5] shrink-0" />
            ) : (
              <Move className="w-4 h-4 stroke-[2.3] shrink-0" />
            )}
            <span className="text-sm">
              {editMode
                ? isAr
                  ? 'إنهاء الترتيب'
                  : 'Done Editing'
                : isAr
                  ? 'ترتيب العيادة'
                  : 'Rearrange'}
            </span>
          </button>
        </div>
      </nav>

      {/* Desktop / Laptop / Tablet Centered PC Simulation Command Dock (>= 768px) */}
      <nav
        aria-label="PC Clinic Command Dock"
        dir="ltr"
        onPointerDown={(e) => e.stopPropagation()}
        className="hidden md:flex fixed bottom-3 left-1/2 -translate-x-1/2 z-30 flex-col items-center gap-1.5 pointer-events-none max-w-[96vw]"
      >
        <div
          className={`pointer-events-auto flex items-center gap-1.5 p-1.5 rounded-2xl border ${dockSurface}`}
        >
          {/* Store [B] */}
          <button
            type="button"
            disabled={disabled}
            onClick={(e) => {
              e.currentTarget.blur();
              onSelectTab('store');
            }}
            title={isAr ? 'متجر العيادة (B)' : 'Clinic Store (B)'}
            className={`relative h-10 px-4 rounded-xl flex items-center gap-2 text-white border transition-all whitespace-nowrap cursor-pointer ${
              isNight
                ? 'border-sky-400/50 bg-gradient-to-b from-sky-600 to-slate-900'
                : 'border-sky-300/40 bg-gradient-to-b from-sky-500 to-blue-800'
            } ${
              activeTab === 'store' ? 'ring-2 ring-white -translate-y-0.5' : ''
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-110 active:scale-95'}`}
          >
            <ShoppingCart className="w-4 h-4 stroke-[2.2] shrink-0" />
            <span className="text-xs font-black">{isAr ? 'المتجر' : 'Store'}</span>
            <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 rounded bg-black/30 text-[10px] font-mono text-sky-200">
              B
            </kbd>
            {storeAlert && (
              <span className="absolute -top-1.5 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] font-black flex items-center justify-center border border-white shadow">
                !
              </span>
            )}
          </button>

          {/* Missions [M] */}
          <button
            type="button"
            disabled={disabled}
            onClick={(e) => {
              e.currentTarget.blur();
              onSelectTab('missions');
            }}
            title={isAr ? 'المهام السريرية (M)' : 'Clinical Missions (M)'}
            className={`relative h-10 px-3 rounded-xl flex items-center gap-1.5 border text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'missions'
                ? 'bg-sky-500 border-sky-300 text-slate-950'
                : 'bg-slate-800/80 hover:bg-slate-700/90 border-white/10 text-slate-100'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
          >
            <ClipboardList className="w-4 h-4 shrink-0 text-sky-300" />
            <span>{isAr ? 'المهام' : 'Missions'}</span>
            <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 rounded bg-black/30 text-[10px] font-mono text-slate-300">
              M
            </kbd>
            {missionsReadyCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black tabular-nums leading-none">
                {missionsReadyCount}
              </span>
            )}
          </button>

          {/* Waiting Queue [Tab] */}
          {onOpenWaitingQueue && (
            <button
              type="button"
              disabled={disabled}
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenWaitingQueue();
              }}
              title={isAr ? 'قائمة الانتظار (Tab)' : 'Waiting Queue (Tab)'}
              className={`relative h-10 px-3 rounded-xl flex items-center gap-1.5 border text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
                waitingCount > 0
                  ? 'bg-sky-900/90 hover:bg-sky-800 border-sky-400/50 text-white'
                  : 'bg-slate-800/80 hover:bg-slate-700/90 border-white/10 text-slate-100'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
            >
              <BellRing className={`w-4 h-4 shrink-0 ${waitingCount > 0 ? 'text-amber-300' : 'text-sky-300'}`} />
              <span>{isAr ? 'الانتظار' : 'Queue'}</span>
              {waitingCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black tabular-nums leading-none">
                  {waitingCount}
                </span>
              )}
              <kbd className="hidden xl:inline-flex items-center px-1.5 py-0.5 rounded bg-black/30 text-[10px] font-mono text-slate-300">
                Tab
              </kbd>
            </button>
          )}

          {/* Colleagues [K] */}
          {onOpenFriends && (
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenFriends();
              }}
              title={isAr ? 'زملاء العيادة (K)' : 'Colleagues (K)'}
              className="h-10 px-3 rounded-xl flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-700/90 border border-white/10 text-slate-100 text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer active:scale-95"
            >
              <Users className="w-4 h-4 shrink-0 text-sky-300" />
              <span className="hidden lg:inline">{isAr ? 'الزملاء' : 'Clinics'}</span>
              <span className="text-[11px] font-mono text-sky-300 tabular-nums">{onlineFriends}</span>
            </button>
          )}

          {/* Quick Day/Night Toggle [L] */}
          {onToggleLightingMode && (
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleLightingMode();
              }}
              title={isAr ? 'تبديل الليل / النهار (L)' : 'Toggle Day / Night (L)'}
              className="h-10 px-2.5 rounded-xl flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-700/90 border border-white/10 text-slate-100 text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer active:scale-95"
            >
              {isNight ? (
                <Moon className="w-4 h-4 text-indigo-300 shrink-0" />
              ) : (
                <Sun className="w-4 h-4 text-amber-300 shrink-0" />
              )}
              <kbd className="hidden xl:inline-flex items-center px-1.5 py-0.5 rounded bg-black/30 text-[10px] font-mono text-slate-300">
                L
              </kbd>
            </button>
          )}

          {/* Rearrange [V] */}
          <button
            type="button"
            disabled={disabled}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault();
              }
            }}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleEditMode();
            }}
            title={isAr ? 'وضع ترتيب العيادة (V)' : 'Rearrange Clinic Mode (V)'}
            className={`h-10 px-4 rounded-xl flex items-center gap-2 border transition-all whitespace-nowrap cursor-pointer ${
              editMode
                ? 'bg-gradient-to-b from-emerald-400 to-emerald-600 text-slate-950 border-emerald-200 ring-2 ring-white font-black'
                : 'game-btn-gold text-slate-950 border-amber-200/80 font-black'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-105 active:scale-95'}`}
          >
            {editMode ? (
              <Check className="w-4 h-4 stroke-[2.5] shrink-0" />
            ) : (
              <Move className="w-4 h-4 stroke-[2.3] shrink-0" />
            )}
            <span className="text-xs">
              {editMode
                ? isAr
                  ? 'إنهاء الترتيب'
                  : 'Done Editing'
                : isAr
                  ? 'ترتيب العيادة'
                  : 'Rearrange'}
            </span>
            <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 rounded bg-black/15 text-[10px] font-mono text-slate-900">
              V
            </kbd>
          </button>
        </div>

        {/* Subtle Desktop Control Hint Footer */}
        <div className="hidden lg:flex items-center gap-2.5 px-3 py-0.5 rounded-full bg-slate-950/70 border border-white/10 text-[10px] font-bold text-slate-300/90">
          <span><kbd className="text-sky-300 font-mono">WASD</kbd> {isAr ? 'تحريك' : 'Pan'}</span>
          <span className="text-slate-600">·</span>
          <span><kbd className="text-sky-300 font-mono">Right-Drag</kbd> {isAr ? 'سحب' : 'Drag Map'}</span>
          <span className="text-slate-600">·</span>
          <span><kbd className="text-sky-300 font-mono">Q/E</kbd> {isAr ? 'تدوير' : 'Orbit'}</span>
          <span className="text-slate-600">·</span>
          <span><kbd className="text-sky-300 font-mono">Scroll</kbd> {isAr ? 'تقريب' : 'Zoom'}</span>
        </div>
      </nav>
    </>
  );
});

