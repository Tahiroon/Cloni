import React, { useState } from 'react';
import { Building2, Check, Coins, X } from 'lucide-react';
import { SPECIALTY_META } from '../data/catalog';
import { ClinicRoom, Language, RoomSpecialty } from '../types/clinic';

interface RoomUnlockModalProps {
  room: ClinicRoom | null;
  coins: number;
  language: Language;
  onClose: () => void;
  onConfirmUnlock: (room: ClinicRoom, specialty: RoomSpecialty) => void;
}

const CHOICES: RoomSpecialty[] = [
  'kinesiotherapy',
  'orthopedics',
  'electrotherapy',
  'neurorehab',
  'hydrotherapy',
];

export const RoomUnlockModal: React.FC<RoomUnlockModalProps> = ({
  room,
  coins,
  language,
  onClose,
  onConfirmUnlock,
}) => {
  const [selected, setSelected] = useState<RoomSpecialty>('kinesiotherapy');

  if (!room) return null;
  const isAr = language === 'ar';
  const canAfford = coins >= room.unlockCost;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        <div className="px-5 py-4 bg-gradient-to-r from-sky-600 to-blue-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-5 h-5" />
            <h3 className="text-base font-extrabold">
              {isAr ? 'فتح جناح جديد واختيار التخصص' : 'Unlock Wing & Choose Specialty'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-600">
            {isAr
              ? `اختر التخصص الطبي لجناح "${room.nameAr}" ليبدأ استقبال الحالات المتخصصة:`
              : `Choose the clinical specialty for "${room.nameEn}" to unlock specialized patient cases:`}
          </p>

          <div className="space-y-2 max-h-[45vh] overflow-y-auto custom-scroll">
            {CHOICES.map((spec) => {
              const meta = SPECIALTY_META[spec];
              const active = selected === spec;
              return (
                <button
                  key={spec}
                  type="button"
                  onClick={() => setSelected(spec)}
                  className={`w-full text-start p-3 rounded-2xl border-2 transition-all flex items-center justify-between gap-3 ${
                    active
                      ? 'border-sky-500 bg-sky-50/70 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div>
                    <div className="text-sm font-extrabold text-slate-900" style={{ color: meta.color }}>
                      {isAr ? meta.nameAr : meta.nameEn}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {isAr ? meta.descAr : meta.descEn}
                    </div>
                  </div>
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                      active ? 'bg-sky-600 text-white' : 'bg-slate-100 text-transparent'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                  </div>
                </button>
              );
            })}
          </div>

          <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-sm font-black text-amber-600 tabular-nums">
              <Coins className="w-4 h-4" />
              <span>{room.unlockCost}</span>
            </div>
            <button
              type="button"
              disabled={!canAfford}
              onClick={() => onConfirmUnlock(room, selected)}
              className={`px-5 py-2.5 rounded-xl text-sm font-extrabold ${
                canAfford
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isAr ? 'تأكيد الفتح والبناء' : 'Unlock & Build'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
