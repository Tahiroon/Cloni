import React from 'react';
import { Cloud, Globe, Moon, RotateCcw, Sun, Volume2, VolumeX, X } from 'lucide-react';
import { Language, LightingMode } from '../types/clinic';

interface SettingsModalProps {
  open: boolean;
  language: Language;
  soundEnabled: boolean;
  lightingMode: LightingMode;
  studentId: string;
  lastSyncedAt: string | null;
  onClose: () => void;
  onToggleLanguage: (lang: Language) => void;
  onToggleSound: () => void;
  onChangeLightingMode: (mode: LightingMode) => void;
  onManualSync: () => void;
  onResetClinic: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  language,
  soundEnabled,
  lightingMode,
  studentId,
  lastSyncedAt,
  onClose,
  onToggleLanguage,
  onToggleSound,
  onChangeLightingMode,
  onManualSync,
  onResetClinic,
}) => {
  if (!open) return null;
  const isAr = language === 'ar';
  const isNight = lightingMode === 'night';

  const cardClass = isNight
    ? 'bg-slate-800/90 border-slate-700 text-slate-100'
    : 'bg-slate-50 border-slate-200 text-slate-800';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80">
      <div
        className={`w-full max-w-sm rounded-3xl shadow-2xl border overflow-hidden transition-colors ${
          isNight ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <div
          className={`px-5 py-4 text-white flex items-center justify-between ${
            isNight
              ? 'bg-gradient-to-r from-[#061124] to-[#0c2d57] border-b border-slate-700/80'
              : 'bg-gradient-to-r from-[#0f294a] to-[#0284c7]'
          }`}
        >
          <h2 className="text-base font-extrabold">
            {isAr ? 'إعدادات العيادة والحساب' : 'Clinic & Account Settings'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3.5">
          {/* Language */}
          <div className={`flex items-center justify-between p-3 rounded-2xl border ${cardClass}`}>
            <div className="flex items-center gap-2.5">
              <Globe className={`w-4 h-4 ${isNight ? 'text-sky-400' : 'text-sky-600'}`} />
              <span className="text-sm font-bold">
                {isAr ? 'لغة الواجهة' : 'Language'}
              </span>
            </div>
            <div className={`flex items-center gap-1 p-1 rounded-xl ${isNight ? 'bg-slate-950' : 'bg-slate-200'}`}>
              <button
                type="button"
                onClick={() => onToggleLanguage('ar')}
                className={`px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                  isAr
                    ? isNight
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'bg-white text-sky-700 shadow-sm'
                    : isNight
                      ? 'text-slate-400'
                      : 'text-slate-600'
                }`}
              >
                العربية
              </button>
              <button
                type="button"
                onClick={() => onToggleLanguage('en')}
                className={`px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                  !isAr
                    ? isNight
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'bg-white text-sky-700 shadow-sm'
                    : isNight
                      ? 'text-slate-400'
                      : 'text-slate-600'
                }`}
              >
                English
              </button>
            </div>
          </div>

          {/* Sound FX */}
          <div className={`flex items-center justify-between p-3 rounded-2xl border ${cardClass}`}>
            <div className="flex items-center gap-2.5">
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-400" />
              )}
              <span className="text-sm font-bold">
                {isAr ? 'المؤثرات الصوتية' : 'Sound Effects'}
              </span>
            </div>
            <button
              type="button"
              onClick={onToggleSound}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold ${
                soundEnabled
                  ? 'bg-emerald-500 text-white'
                  : isNight
                    ? 'bg-slate-700 text-slate-300'
                    : 'bg-slate-200 text-slate-600'
              }`}
            >
              {soundEnabled ? (isAr ? 'مفعل' : 'On') : isAr ? 'صامت' : 'Muted'}
            </button>
          </div>

          {/* Day / Night Mode */}
          <div className={`flex items-center justify-between p-3 rounded-2xl border ${cardClass}`}>
            <div className="flex items-center gap-2.5">
              {isNight ? (
                <Moon className="w-4 h-4 text-indigo-400" />
              ) : (
                <Sun className="w-4 h-4 text-amber-500" />
              )}
              <span className="text-sm font-bold">
                {isAr ? 'وضع الإضاءة' : 'Time & Lighting'}
              </span>
            </div>
            <div className={`flex items-center gap-1 p-1 rounded-xl ${isNight ? 'bg-slate-950' : 'bg-slate-200'}`}>
              <button
                type="button"
                onClick={() => onChangeLightingMode('day')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-extrabold transition-colors ${
                  !isNight
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>{isAr ? 'النهار' : 'Day'}</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeLightingMode('night')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-extrabold transition-colors ${
                  isNight
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>{isAr ? 'الليل' : 'Night'}</span>
              </button>
            </div>
          </div>

          {/* Offline-First + Cloud Sync */}
          <div
            className={`p-3 rounded-2xl border space-y-2 ${
              isNight ? 'bg-sky-950/60 border-sky-800/70' : 'bg-sky-50 border-sky-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className={`w-4 h-4 ${isNight ? 'text-sky-400' : 'text-sky-600'}`} />
                <span className={`text-xs font-extrabold ${isNight ? 'text-sky-200' : 'text-sky-900'}`}>
                  {isAr ? 'المزامنة السحابية (IndexedDB + JSON)' : 'Offline-First Sync'}
                </span>
              </div>
              <button
                type="button"
                onClick={onManualSync}
                className="px-2.5 py-1 rounded-lg bg-sky-600 text-white text-[11px] font-bold hover:bg-sky-500"
              >
                {isAr ? 'مزامنة الآن' : 'Sync Now'}
              </button>
            </div>
            <div className={`text-[11px] font-mono ${isNight ? 'text-slate-300' : 'text-slate-600'}`}>
              ID: {studentId}
            </div>
            <div className={`text-[11px] ${isNight ? 'text-slate-400' : 'text-slate-500'}`}>
              {lastSyncedAt
                ? `${isAr ? 'آخر مزامنة:' : 'Last synced:'} ${new Date(lastSyncedAt).toLocaleTimeString()}`
                : isAr
                  ? 'محفوظ محلياً (IndexedDB) — جاهز للمزامنة'
                  : 'Saved locally (IndexedDB) — ready to sync'}
            </div>
          </div>

          {/* Reset */}
          <button
            type="button"
            onClick={onResetClinic}
            className={`w-full py-2.5 rounded-2xl border text-xs font-extrabold flex items-center justify-center gap-1.5 ${
              isNight
                ? 'border-rose-800/80 text-rose-400 hover:bg-rose-950/60'
                : 'border-rose-200 text-rose-600 hover:bg-rose-50'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isAr ? 'إعادة ضبط العيادة للوضع الابتدائي' : 'Reset Clinic to Starter Layout'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
