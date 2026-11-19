import React from 'react';
import { Cloud, Globe, RotateCcw, Sun, Sunset, Volume2, VolumeX, X } from 'lucide-react';
import { Language } from '../types/clinic';

interface SettingsModalProps {
  open: boolean;
  language: Language;
  soundEnabled: boolean;
  goldenHour: boolean;
  studentId: string;
  lastSyncedAt: string | null;
  onClose: () => void;
  onToggleLanguage: (lang: Language) => void;
  onToggleSound: () => void;
  onToggleGoldenHour: () => void;
  onManualSync: () => void;
  onResetClinic: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  language,
  soundEnabled,
  goldenHour,
  studentId,
  lastSyncedAt,
  onClose,
  onToggleLanguage,
  onToggleSound,
  onToggleGoldenHour,
  onManualSync,
  onResetClinic,
}) => {
  if (!open) return null;
  const isAr = language === 'ar';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 bg-gradient-to-r from-[#0f294a] to-[#0284c7] text-white flex items-center justify-between">
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
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2.5">
              <Globe className="w-4 h-4 text-sky-600" />
              <span className="text-sm font-bold text-slate-800">
                {isAr ? 'لغة الواجهة' : 'Language'}
              </span>
            </div>
            <div className="flex items-center gap-1 bg-slate-200 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => onToggleLanguage('ar')}
                className={`px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                  isAr ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-600'
                }`}
              >
                العربية
              </button>
              <button
                type="button"
                onClick={() => onToggleLanguage('en')}
                className={`px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                  !isAr ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-600'
                }`}
              >
                English
              </button>
            </div>
          </div>

          {/* Sound FX */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2.5">
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-400" />
              )}
              <span className="text-sm font-bold text-slate-800">
                {isAr ? 'المؤثرات الصوتية' : 'Sound Effects'}
              </span>
            </div>
            <button
              type="button"
              onClick={onToggleSound}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold ${
                soundEnabled ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {soundEnabled ? (isAr ? 'مفعل' : 'On') : isAr ? 'صامت' : 'Muted'}
            </button>
          </div>

          {/* Daylight / Golden Hour */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2.5">
              {goldenHour ? (
                <Sunset className="w-4 h-4 text-amber-500" />
              ) : (
                <Sun className="w-4 h-4 text-sky-500" />
              )}
              <span className="text-sm font-bold text-slate-800">
                {isAr ? 'إضاءة العيادة' : 'Clinic Lighting'}
              </span>
            </div>
            <button
              type="button"
              onClick={onToggleGoldenHour}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold ${
                goldenHour ? 'bg-amber-500 text-slate-950' : 'bg-sky-600 text-white'
              }`}
            >
              {goldenHour ? (isAr ? 'غروب دافئ' : 'Golden Hour') : isAr ? 'نهار طبيعي' : 'Daylight'}
            </button>
          </div>

          {/* Offline-First + Cloud Sync */}
          <div className="p-3 rounded-2xl bg-sky-50 border border-sky-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-sky-600" />
                <span className="text-xs font-extrabold text-sky-900">
                  {isAr ? 'المزامنة السحابية (IndexedDB + JSON)' : 'Offline-First Sync'}
                </span>
              </div>
              <button
                type="button"
                onClick={onManualSync}
                className="px-2.5 py-1 rounded-lg bg-sky-600 text-white text-[11px] font-bold hover:bg-sky-700"
              >
                {isAr ? 'مزامنة الآن' : 'Sync Now'}
              </button>
            </div>
            <div className="text-[11px] text-slate-600 font-mono">
              ID: {studentId}
            </div>
            <div className="text-[11px] text-slate-500">
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
            className="w-full py-2.5 rounded-2xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-extrabold flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isAr ? 'إعادة ضبط العيادة للوضع الابتدائي' : 'Reset Clinic to Starter Layout'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
