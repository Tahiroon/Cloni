import React from 'react';
import { Eye, Gift, Smile, Star, Users, X } from 'lucide-react';
import { FriendClinic, Language, LightingMode } from '../types/clinic';

interface FriendsModalProps {
  open: boolean;
  friends: FriendClinic[];
  language: Language;
  lightingMode?: LightingMode;
  onClose: () => void;
  onVisitFriend: (friend: FriendClinic) => void;
  onSendGift: (friendId: string) => void;
}

export const FriendsModal: React.FC<FriendsModalProps> = ({
  open,
  friends,
  language,
  lightingMode = 'day',
  onClose,
  onVisitFriend,
  onSendGift,
}) => {
  if (!open) return null;
  const isAr = language === 'ar';
  const isNight = lightingMode === 'night';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80">
      <div
        className={`w-full max-w-md rounded-3xl shadow-2xl border overflow-hidden flex flex-col max-h-[85vh] ${
          isNight ? 'bg-slate-950 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900'
        }`}
      >
        <div
          className={`px-5 py-4 text-white flex items-center justify-between ${
            isNight ? 'bg-gradient-to-r from-[#061124] to-[#0c2d57] border-b border-slate-800' : 'bg-gradient-to-r from-[#0f294a] to-[#0284c7]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-sky-200" />
            <div>
              <h2 className="text-base font-extrabold">
                {isAr ? 'عيادات الزملاء المتصلين' : 'Colleague Clinics Online'}
              </h2>
              <p className="text-[11px] text-sky-100/80">
                {isAr ? 'زر عيادات دفعتك وتبادل الهدايا والخبرات' : 'Visit fellow PT students and send daily support gifts'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3.5 space-y-2.5 overflow-y-auto custom-scroll">
          {friends.map((f) => (
            <div
              key={f.id}
              className={`rounded-2xl p-3.5 border shadow-sm flex flex-col gap-3 ${
                isNight ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-11 h-11 rounded-2xl text-white font-black text-sm flex items-center justify-center shrink-0 shadow"
                    style={{ backgroundColor: f.avatarColor }}
                  >
                    {(isAr ? f.nameAr : f.nameEn).slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <div className={`text-sm font-extrabold truncate ${isNight ? 'text-slate-100' : 'text-slate-900'}`}>
                      {isAr ? f.nameAr : f.nameEn}
                    </div>
                    <div className={`text-xs truncate ${isNight ? 'text-slate-400' : 'text-slate-500'}`}>
                      {isAr ? f.universityAr : f.universityEn}
                    </div>
                    <div className={`flex items-center gap-2 text-[11px] font-bold mt-0.5 tabular-nums ${isNight ? 'text-slate-300' : 'text-slate-600'}`}>
                      <span className={`flex items-center gap-0.5 ${isNight ? 'text-sky-400' : 'text-sky-700'}`}>
                        <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                        {f.stars}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className={`flex items-center gap-0.5 ${isNight ? 'text-emerald-400' : 'text-emerald-700'}`}>
                        <Smile className="w-3 h-3" />
                        {f.satisfaction}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onVisitFriend(f)}
                  className="flex-1 py-2 px-3 rounded-xl game-btn-blue text-white text-xs font-extrabold flex items-center justify-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{isAr ? 'زيارة العيادة' : 'Visit Clinic'}</span>
                </button>
                <button
                  type="button"
                  disabled={f.giftedToday}
                  onClick={() => onSendGift(f.id)}
                  className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 ${
                    f.giftedToday
                      ? isNight
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow'
                  }`}
                >
                  <Gift className="w-3.5 h-3.5" />
                  <span>{f.giftedToday ? (isAr ? 'تم الإرسال' : 'Sent') : isAr ? 'هدية (+25)' : 'Gift (+25)'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
