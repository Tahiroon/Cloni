import React, { useMemo } from 'react';
import { Check, Shirt, Stethoscope, UserRound, X } from 'lucide-react';
import {
  PLAYER_OUTFITS,
  PlayerOutfitDef,
  resolvePlayerOutfitMeta,
} from '../data/catalog';
import { usePlayerOutfitThumb } from '../engine3d/thumbRenderer';
import {
  Language,
  LightingMode,
  PlayerCharacterConfig,
  PlayerGender,
  PlayerOutfitId,
} from '../types/clinic';

interface PlayerCharacterModalProps {
  open: boolean;
  profile: PlayerCharacterConfig;
  language: Language;
  lightingMode?: LightingMode;
  onClose: () => void;
  onChange: (next: PlayerCharacterConfig) => void;
}

const FEMALE_OUTFIT_ORDER: PlayerOutfitId[] = [
  'scrubs',
  'lab_coat',
  'shirt_pants',
  'female_abaya_closed',
  'female_abaya_light',
  'female_abaya_niqab',
];

const MALE_OUTFIT_ORDER: PlayerOutfitId[] = [
  'lab_coat',
  'scrubs',
  'shirt_pants',
];

const OutfitCardThumb: React.FC<{
  gender: PlayerGender;
  outfit: PlayerOutfitDef;
  hasTarha: boolean;
  isNight: boolean;
}> = ({ gender, outfit, hasTarha, isNight }) => {
  const thumbUrl = usePlayerOutfitThumb(gender, outfit.id, hasTarha);

  return (
    <div
      className={`w-full h-48 rounded-xl border flex items-center justify-center relative overflow-hidden ${
        isNight
          ? 'bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border-slate-800'
          : 'bg-gradient-to-b from-sky-100/75 via-white to-emerald-50/70 border-slate-200/80'
      }`}
    >
      {thumbUrl ? (
        <img
          src={thumbUrl}
          alt={outfit.nameEn}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="w-full h-full object-contain pt-1 drop-shadow-md transition-transform duration-200 group-hover:scale-105"
        />
      ) : (
        <div className="w-8 h-8 rounded-full border-2 border-sky-400/40 border-t-sky-500 animate-spin" />
      )}

      {outfit.hasStethoscope && (
        <span
          className={`absolute top-1.5 end-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-0.5 ${
            isNight ? 'bg-sky-900/90 text-sky-200' : 'bg-sky-100 text-sky-700'
          }`}
        >
          <Stethoscope className="w-3 h-3" />
        </span>
      )}
    </div>
  );
};

export const PlayerCharacterModal: React.FC<PlayerCharacterModalProps> = ({
  open,
  profile,
  language,
  lightingMode = 'day',
  onClose,
  onChange,
}) => {
  const isAr = language === 'ar';
  const isNight = lightingMode === 'night';
  const isFemale = profile.gender === 'female';
  const previewUrl = usePlayerOutfitThumb(profile.gender, profile.outfitId, profile.hasTarha);
  const currentOutfit = useMemo(
    () => resolvePlayerOutfitMeta(profile.outfitId),
    [profile.outfitId]
  );

  const availableOutfits = useMemo(() => {
    const order = isFemale ? FEMALE_OUTFIT_ORDER : MALE_OUTFIT_ORDER;
    return order
      .map((id) => PLAYER_OUTFITS.find((o) => o.id === id))
      .filter((o): o is PlayerOutfitDef => Boolean(o && o.genders.includes(profile.gender)));
  }, [isFemale, profile.gender]);

  if (!open) return null;

  const handleSelectGender = (gender: PlayerGender) => {
    const validForGender = PLAYER_OUTFITS.some(
      (o) => o.id === profile.outfitId && o.genders.includes(gender)
    );
    onChange({
      ...profile,
      gender,
      outfitId: validForGender ? profile.outfitId : 'lab_coat',
    });
  };

  const getOutfitLabel = (o: PlayerOutfitDef) => {
    if (isFemale) {
      return isAr ? o.femaleNameAr || o.nameAr : o.femaleNameEn || o.nameEn;
    }
    return isAr ? o.nameAr : o.nameEn;
  };

  const getOutfitDesc = (o: PlayerOutfitDef) => {
    if (isFemale) {
      return isAr ? o.femaleDescAr || o.descAr : o.femaleDescEn || o.descEn;
    }
    return isAr ? o.descAr : o.descEn;
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-950/80"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-3xl lg:max-w-4xl rounded-t-3xl sm:rounded-3xl shadow-2xl border flex flex-col max-h-[90vh] animate-in slide-in-from-bottom duration-200 overflow-hidden transition-colors ${
          isNight
            ? 'bg-slate-950 border-slate-700/90 text-slate-100'
            : 'bg-[#f4f7f5] border-white/80 text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          className={`px-4 pt-3 pb-3 text-white border-b ${
            isNight
              ? 'bg-gradient-to-r from-[#07162e] via-[#0c264a] to-[#082f49] border-sky-500/30'
              : 'bg-gradient-to-r from-[#0f3668] via-[#164b8a] to-[#0e4d7a] border-sky-300/30'
          }`}
        >
          <div className="w-10 h-1 bg-white/35 rounded-full mx-auto mb-2.5 sm:hidden" />
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-300 to-cyan-500 text-slate-950 flex items-center justify-center shadow-md shrink-0">
                <UserRound className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black leading-tight">
                  {isAr ? 'شخصيتي في العيادة' : 'My Clinic Character'}
                </h2>
                <p className="text-xs text-sky-100/85">
                  {isAr
                    ? 'اختر شخصيتك والملابس الطبية أو الكاجوال لتظهر بها في اللعب'
                    : 'Choose your avatar & outfit shown live inside the clinic'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label={isAr ? 'إغلاق' : 'Close'}
              className="w-10 h-10 rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto custom-scroll space-y-4">
          {/* Active Character Studio Portrait + Gender / Tarha Switchers */}
          <div
            className={`rounded-2xl p-3.5 border shadow-sm flex flex-col sm:flex-row items-center gap-4 ${
              isNight ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
            }`}
          >
            <div
              className={`w-40 h-52 rounded-2xl border flex items-center justify-center shrink-0 overflow-hidden shadow-inner ${
                isNight
                  ? 'bg-gradient-to-b from-slate-800 via-slate-950 to-slate-900 border-slate-700'
                  : 'bg-gradient-to-b from-sky-100/80 via-white to-emerald-50/75 border-sky-200/80'
              }`}
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={getOutfitLabel(currentOutfit)}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain pt-1 drop-shadow-lg"
                />
              ) : (
                <div className="w-8 h-8 rounded-full border-2 border-sky-400/40 border-t-sky-500 animate-spin" />
              )}
            </div>

            <div className="flex-1 w-full space-y-3">
              {/* Gender Selector */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={`text-xs font-extrabold ${isNight ? 'text-slate-300' : 'text-slate-600'}`}>
                  {isAr ? 'شخصية اللاعب' : 'Character'}
                </span>
                <div
                  className={`inline-flex p-1 rounded-xl border ${
                    isNight ? 'bg-slate-950 border-slate-700' : 'bg-slate-100 border-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectGender('male')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                      profile.gender === 'male'
                        ? 'bg-sky-600 text-white shadow-sm'
                        : isNight
                          ? 'text-slate-400 hover:text-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {isAr ? 'ولد' : 'Male'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectGender('female')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                      profile.gender === 'female'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : isNight
                          ? 'text-slate-400 hover:text-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {isAr ? 'بنت' : 'Female'}
                  </button>
                </div>
              </div>

              {/* Optional Tarha Switcher for Female Non-Abaya Outfits */}
              {isFemale && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`text-xs font-extrabold ${isNight ? 'text-slate-300' : 'text-slate-600'}`}>
                    {isAr ? 'الطرحة' : 'Tarha'}
                  </span>
                  {currentOutfit.allowsTarhaToggle ? (
                    <div
                      className={`inline-flex p-1 rounded-xl border ${
                        isNight ? 'bg-slate-950 border-slate-700' : 'bg-slate-100 border-slate-200'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onChange({ ...profile, hasTarha: true })}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                          profile.hasTarha
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : isNight
                              ? 'text-slate-400 hover:text-slate-200'
                              : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {isAr ? 'مع طرحة' : 'With Tarha'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onChange({ ...profile, hasTarha: false })}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                          !profile.hasTarha
                            ? 'bg-sky-600 text-white shadow-sm'
                            : isNight
                              ? 'text-slate-400 hover:text-slate-200'
                              : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {isAr ? 'بدون طرحة' : 'No Tarha'}
                      </button>
                    </div>
                  ) : (
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                        isNight
                          ? 'bg-slate-800 text-emerald-300'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {currentOutfit.hasNiqab
                        ? isAr
                          ? 'طرحة ونقاب متناسقان'
                          : 'Includes Tarha & Niqab'
                        : isAr
                          ? 'مع طرحة متناسقة'
                          : 'Includes matching Tarha'}
                    </span>
                  )}
                </div>
              )}

              {/* Active Outfit Details */}
              <div
                className={`rounded-xl px-3 py-2 border ${
                  isNight
                    ? 'bg-slate-950/75 border-slate-800'
                    : 'bg-slate-50 border-slate-200/80'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black">{getOutfitLabel(currentOutfit)}</span>
                  {currentOutfit.hasStethoscope && (
                    <span className="text-[11px] font-bold text-sky-500 flex items-center gap-1">
                      <Stethoscope className="w-3.5 h-3.5" />
                      {isAr ? 'بالسماعة الطبية' : 'With Stethoscope'}
                    </span>
                  )}
                </div>
                <p className={`mt-0.5 text-[11px] leading-snug ${isNight ? 'text-slate-400' : 'text-slate-500'}`}>
                  {getOutfitDesc(currentOutfit)}
                </p>
              </div>
            </div>
          </div>

          {/* Outfits Grid (All Real 3D Asset Previews) */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3
                className={`text-xs font-extrabold flex items-center gap-1.5 ${
                  isNight ? 'text-slate-300' : 'text-slate-600'
                }`}
              >
                <Shirt className="w-4 h-4 text-sky-500" />
                {isAr ? 'اختر الملابس' : 'Choose Your Outfit'}
              </h3>
              <span className={`text-[11px] font-bold ${isNight ? 'text-slate-400' : 'text-slate-500'}`}>
                {isAr ? 'يتحدث المظهر فوراً داخل العيادة' : 'Updates live in clinic'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {availableOutfits.map((outfit) => {
                const selected = profile.outfitId === outfit.id;
                return (
                  <button
                    key={outfit.id}
                    type="button"
                    onClick={() => onChange({ ...profile, outfitId: outfit.id })}
                    className={`group text-start rounded-2xl p-2.5 border flex flex-col justify-between gap-2 transition-all active:scale-98 ${
                      selected
                        ? isNight
                          ? 'bg-sky-950/65 border-sky-400 ring-2 ring-sky-400/35 shadow-md'
                          : 'bg-sky-50/90 border-sky-500 ring-2 ring-sky-500/25 shadow-md'
                        : isNight
                          ? 'bg-slate-900 border-slate-700/90 hover:border-slate-500'
                          : 'bg-white border-slate-200/90 hover:border-sky-300 shadow-sm'
                    }`}
                  >
                    <div>
                      <OutfitCardThumb
                        gender={profile.gender}
                        outfit={outfit}
                        hasTarha={profile.hasTarha}
                        isNight={isNight}
                      />
                      <h4
                        className={`mt-2 text-xs font-extrabold leading-snug ${
                          isNight ? 'text-slate-100' : 'text-slate-900'
                        }`}
                      >
                        {getOutfitLabel(outfit)}
                      </h4>
                      <p
                        className={`mt-0.5 text-[11px] leading-snug line-clamp-2 ${
                          isNight ? 'text-slate-400' : 'text-slate-500'
                        }`}
                      >
                        {getOutfitDesc(outfit)}
                      </p>
                    </div>

                    <div
                      className={`w-full py-1.5 px-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1 ${
                        selected
                          ? 'bg-emerald-500 text-white shadow-sm'
                          : isNight
                            ? 'bg-slate-800 text-slate-200'
                            : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {selected && <Check className="w-3.5 h-3.5" />}
                      <span>
                        {selected
                          ? isAr
                            ? 'مفعّل'
                            : 'Equipped'
                          : isAr
                            ? 'اختيار'
                            : 'Select'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
