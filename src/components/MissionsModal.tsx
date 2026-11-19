import React from 'react';
import { Award, CheckCircle2, ClipboardList, Coins, Star, X } from 'lucide-react';
import { Language, Mission } from '../types/clinic';

interface MissionsModalProps {
  open: boolean;
  missions: Mission[];
  patientsTreatedTotal: number;
  redFlagsCaughtTotal: number;
  language: Language;
  onClose: () => void;
  onClaimMission: (missionId: string) => void;
}

export const MissionsModal: React.FC<MissionsModalProps> = ({
  open,
  missions,
  patientsTreatedTotal,
  redFlagsCaughtTotal,
  language,
  onClose,
  onClaimMission,
}) => {
  if (!open) return null;
  const isAr = language === 'ar';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80">
      <div className="w-full max-w-md bg-slate-50 rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        <div className="px-5 py-4 bg-gradient-to-r from-[#0f294a] to-[#0284c7] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ClipboardList className="w-5 h-5 text-sky-200" />
            <h2 className="text-base font-extrabold">
              {isAr ? 'المهام السريرية والإنجازات' : 'Clinical Missions & Achievements'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Career Summary Strip */}
        <div className="grid grid-cols-2 gap-2.5 p-3.5 bg-white border-b border-slate-200">
          <div className="bg-sky-50 rounded-2xl p-2.5 border border-sky-100 text-center">
            <div className="text-lg font-black text-sky-700 tabular-nums">{patientsTreatedTotal}</div>
            <div className="text-[11px] font-bold text-slate-600">
              {isAr ? 'حالات تم علاجها' : 'Patients Treated'}
            </div>
          </div>
          <div className="bg-amber-50 rounded-2xl p-2.5 border border-amber-100 text-center">
            <div className="text-lg font-black text-amber-700 tabular-nums">{redFlagsCaughtTotal}</div>
            <div className="text-[11px] font-bold text-slate-600">
              {isAr ? 'علامات تحذيرية مكتشفة' : 'Red Flags Caught'}
            </div>
          </div>
        </div>

        <div className="p-3.5 space-y-2.5 overflow-y-auto custom-scroll">
          {missions.map((m) => {
            const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
            const ready = m.progress >= m.target && !m.claimed;

            return (
              <div
                key={m.id}
                className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      {isAr ? m.titleAr : m.titleEn}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {isAr ? m.descAr : m.descEn}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs font-extrabold tabular-nums">
                    <span className="flex items-center gap-0.5 text-amber-600">
                      <Coins className="w-3.5 h-3.5" />+{m.rewardCoins}
                    </span>
                    <span className="flex items-center gap-0.5 text-sky-600">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />+{m.rewardStars}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        m.claimed ? 'bg-emerald-500' : 'bg-sky-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-extrabold text-slate-700 tabular-nums">
                    {Math.min(m.progress, m.target)}/{m.target}
                  </span>
                </div>

                {m.claimed ? (
                  <div className="flex items-center gap-1 text-xs font-extrabold text-emerald-600">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isAr ? 'تم استلام المكافأة' : 'Reward Claimed'}</span>
                  </div>
                ) : ready ? (
                  <button
                    type="button"
                    onClick={() => onClaimMission(m.id)}
                    className="w-full py-2 rounded-xl game-btn-gold text-slate-950 text-xs font-black flex items-center justify-center gap-1.5"
                  >
                    <Award className="w-4 h-4" />
                    <span>{isAr ? 'استلام المكافأة' : 'Claim Reward'}</span>
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
