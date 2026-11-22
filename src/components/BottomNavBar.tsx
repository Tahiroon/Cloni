import React from 'react';
import { Check, Move, ShoppingCart } from 'lucide-react';
import { Language, LightingMode, NavTab } from '../types/clinic';

interface BottomNavBarProps {
  activeTab: NavTab | null;
  editMode: boolean;
  language: Language;
  lightingMode?: LightingMode;
  storeAlert: boolean;
  disabled?: boolean;
  onSelectTab: (tab: NavTab) => void;
  onToggleEditMode: () => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = React.memo(({
  activeTab,
  editMode,
  language,
  lightingMode = 'day',
  storeAlert,
  disabled = false,
  onSelectTab,
  onToggleEditMode,
}) => {
  const isAr = language === 'ar';
  const isNight = lightingMode === 'night';

  return (
    <nav
      aria-label="Clinic Navigation"
      dir="ltr"
      className="fixed bottom-0 left-0 right-0 z-30 px-3 sm:px-3.5 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none"
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
  );
});
