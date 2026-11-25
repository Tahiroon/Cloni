import React, { useMemo } from 'react';
import { BellRing, Clock, Stethoscope, UserCheck, Users, X } from 'lucide-react';
import { SPECIALTY_META } from '../data/catalog';
import { Language, LightingMode, PatientEntity } from '../types/clinic';

interface WaitingQueueModalProps {
  open: boolean;
  patients: PatientEntity[];
  freeStationsCount: number;
  totalStationsCount: number;
  language: Language;
  lightingMode?: LightingMode;
  onClose: () => void;
  onCallPatient: (patientId: string) => void;
  onAssignTreatmentPatient?: (patientId: string) => void;
  onInspectActivePatient?: (patientId: string) => void;
}

const formatWaitSeconds = (ms: number, isAr: boolean): string => {
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec < 60) {
    return isAr ? `${sec} ث` : `${sec}s`;
  }
  const mins = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${mins}:${rem.toString().padStart(2, '0')}`;
};

export const WaitingQueueModal: React.FC<WaitingQueueModalProps> = ({
  open,
  patients,
  freeStationsCount,
  totalStationsCount,
  language,
  lightingMode = 'day',
  onClose,
  onCallPatient,
  onAssignTreatmentPatient,
  onInspectActivePatient,
}) => {
  const isAr = language === 'ar';
  const isNight = lightingMode === 'night';

  const { readyQueue, receptionCheckingIn, inTreatmentWing } = useMemo(() => {
    const waiting: PatientEntity[] = [];
    const checkin: PatientEntity[] = [];
    const active: PatientEntity[] = [];

    for (const p of patients) {
      if (p.state === 'treated_leaving') continue;
      if (
        p.state === 'waiting_checkin' ||
        p.state === 'walking_to_wait' ||
        p.state === 'walking_to_water' ||
        p.state === 'drinking_water'
      ) {
        waiting.push(p);
      } else if (p.state === 'arriving' || p.state === 'checkin_at_desk') {
        checkin.push(p);
      } else if (
        p.state === 'walking_to_treatment_wait' ||
        p.state === 'waiting_in_treatment' ||
        p.state === 'walking_to_station' ||
        p.state === 'ready_for_exam' ||
        p.state === 'in_exam' ||
        p.state === 'in_treatment'
      ) {
        active.push(p);
      }
    }

    // Prioritize settled waiting patients longest in queue first
    waiting.sort((a, b) => (b.waitTimer || 0) - (a.waitTimer || 0));

    return {
      readyQueue: waiting,
      receptionCheckingIn: checkin,
      inTreatmentWing: active,
    };
  }, [patients]);

  if (!open) return null;

  const hasFreeBed = freeStationsCount > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-slate-950/60 pointer-events-auto"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClose}
    >
      <div
        dir={isAr ? 'rtl' : 'ltr'}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg md:max-w-2xl max-h-[82vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden ${
          isNight
            ? 'bg-slate-900 border-slate-700 text-slate-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between gap-3 px-5 py-4 border-b ${
            isNight ? 'border-slate-800 bg-slate-950/50' : 'border-slate-100 bg-slate-50/80'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/15 text-sky-500 flex items-center justify-center shrink-0">
              <BellRing className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-black truncate">
                {isAr ? 'تنظيم انتظار المرضى' : 'Patient Waiting Queue'}
              </h2>
              <p className={`text-xs mt-0.5 tabular-nums ${isNight ? 'text-slate-400' : 'text-slate-500'}`}>
                {isAr
                  ? `في الانتظار: ${readyQueue.length} · الأسرّة الفارغة: ${freeStationsCount} من ${totalStationsCount}`
                  : `Waiting: ${readyQueue.length} · Free Bays: ${freeStationsCount} / ${totalStationsCount}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={isAr ? 'إغلاق' : 'Close'}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
              isNight ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* No free bed helper notice */}
          {!hasFreeBed && readyQueue.length > 0 && (
            <div
              className={`rounded-2xl px-3.5 py-2.5 text-xs font-semibold border ${
                isNight
                  ? 'bg-amber-950/40 border-amber-500/30 text-amber-200'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}
            >
              {isAr
                ? 'جميع الأسرّة ممتلئة حالياً. لن يمكنك استدعاء مريض جديد حتى ينهي المرضى الحاليون جلساتهم.'
                : 'All treatment beds are currently occupied. You cannot call a new patient until current patients finish their sessions.'}
            </div>
          )}

          {/* Waiting Patients Ready to Call */}
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <h3
                className={`text-xs font-extrabold uppercase tracking-wide flex items-center gap-1.5 ${
                  isNight ? 'text-slate-300' : 'text-slate-600'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-sky-500" />
                <span>{isAr ? 'المرضى المنتظرون للاستدعاء' : 'Ready for Call-In'}</span>
              </h3>
              <span className={`text-xs font-bold tabular-nums ${isNight ? 'text-slate-400' : 'text-slate-500'}`}>
                {readyQueue.length}
              </span>
            </div>

            {readyQueue.length === 0 ? (
              <div
                className={`rounded-2xl border border-dashed px-4 py-6 text-center text-xs ${
                  isNight
                    ? 'border-slate-800 text-slate-400 bg-slate-950/30'
                    : 'border-slate-200 text-slate-500 bg-slate-50/70'
                }`}
              >
                {receptionCheckingIn.length > 0
                  ? isAr
                    ? 'لا يوجد مرضى جاهزون بالانتظار بعد — جاري استقبال المريض وتجهيز ملفه في الاستقبال.'
                    : 'No seated waiting patients yet — reception is preparing incoming patient files.'
                  : isAr
                    ? 'قاعة الانتظار فارغة حالياً. سيصل مرضى جدد إلى الاستقبال تلقائياً.'
                    : 'Waiting lounge is currently clear. New patients will arrive at reception shortly.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {readyQueue.map((p, idx) => {
                  const c = p.clinicalCase;
                  const specMeta = SPECIALTY_META[c.specialty];
                  const seatStatus =
                    p.state === 'drinking_water' || p.state === 'walking_to_water'
                      ? isAr
                        ? 'عند مبرد المياه'
                        : 'At water dispenser'
                      : p.state === 'walking_to_wait'
                        ? isAr
                          ? 'متجه للانتظار'
                          : 'Heading to lounge'
                        : p.isSeatedWait === false
                          ? isAr
                            ? 'واقف في الاستقبال'
                            : 'Standing in reception'
                          : isAr
                            ? 'جالس في كرسي الانتظار'
                            : 'Seated in waiting chair';

                  const waitStr = formatWaitSeconds(p.waitTimer || 0, isAr);

                  return (
                    <div
                      key={p.id}
                      className={`rounded-2xl border p-3.5 flex items-center justify-between gap-3 transition-colors ${
                        isNight
                          ? 'bg-slate-950/70 border-slate-800'
                          : 'bg-slate-50/75 border-slate-200'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black tabular-nums shrink-0 mt-0.5 ${
                            idx === 0
                              ? 'bg-sky-600 text-white'
                              : isNight
                                ? 'bg-slate-800 text-slate-300'
                                : 'bg-slate-200/80 text-slate-700'
                          }`}
                        >
                          {idx + 1}
                        </div>

                        <div className="min-w-0">
                          <div className="text-sm font-black truncate">
                            {isAr ? c.patientNameAr : c.patientNameEn}
                          </div>
                          <div
                            className={`text-xs mt-0.5 truncate ${
                              isNight ? 'text-slate-300' : 'text-slate-600'
                            }`}
                          >
                            {c.age} {isAr ? 'سنة' : 'y'} ·{' '}
                            {isAr ? specMeta?.nameAr || c.specialty : specMeta?.nameEn || c.specialty}
                          </div>
                          <div
                            className={`text-[11px] mt-1 flex items-center gap-1.5 flex-wrap tabular-nums ${
                              isNight ? 'text-slate-400' : 'text-slate-500'
                            }`}
                          >
                            <Clock className="w-3 h-3 shrink-0 text-sky-500" />
                            <span>{seatStatus}</span>
                            <span aria-hidden="true">·</span>
                            <span>{isAr ? `انتظار ${waitStr}` : `Waited ${waitStr}`}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={!hasFreeBed}
                        onClick={() => onCallPatient(p.id)}
                        className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-all active:scale-95 ${
                          hasFreeBed
                            ? 'bg-sky-600 hover:bg-sky-500 text-white shadow cursor-pointer'
                            : isNight
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <BellRing className="w-3.5 h-3.5 shrink-0" />
                        <span>{isAr ? 'استدعاء' : 'Call In'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Reception Check-In In Progress */}
          {receptionCheckingIn.length > 0 && (
            <section>
              <h3
                className={`text-xs font-extrabold uppercase tracking-wide mb-2 flex items-center gap-1.5 ${
                  isNight ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 text-teal-500" />
                <span>{isAr ? 'في مكتب الاستقبال (تجهيز الملف)' : 'At Reception Desk (File Check-In)'}</span>
              </h3>
              <div className="space-y-2">
                {receptionCheckingIn.map((p) => {
                  const c = p.clinicalCase;
                  return (
                    <div
                      key={p.id}
                      className={`rounded-2xl border px-3.5 py-2.5 flex items-center justify-between gap-3 ${
                        isNight
                          ? 'bg-slate-950/40 border-slate-800/80 text-slate-300'
                          : 'bg-white border-slate-200/80 text-slate-700'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">
                          {isAr ? c.patientNameAr : c.patientNameEn}
                        </div>
                        <div className={`text-[11px] truncate ${isNight ? 'text-slate-400' : 'text-slate-500'}`}>
                          {p.state === 'arriving'
                            ? isAr
                              ? 'قادم إلى مكتب الاستقبال'
                              : 'Walking to reception desk'
                            : isAr
                              ? 'الموظفة تحضّر ملفه الطبي الآن'
                              : 'Receptionist is retrieving chart'}
                        </div>
                      </div>
                      <span
                        className={`text-[11px] font-bold shrink-0 ${
                          isNight ? 'text-teal-400' : 'text-teal-700'
                        }`}
                      >
                        {isAr ? 'تسجيل' : 'Check-in'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Patients Currently in Treatment Rooms */}
          {inTreatmentWing.length > 0 && (
            <section>
              <h3
                className={`text-xs font-extrabold uppercase tracking-wide mb-2 flex items-center gap-1.5 ${
                  isNight ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                <Stethoscope className="w-3.5 h-3.5 text-emerald-500" />
                <span>{isAr ? 'داخل قسم العلاج' : 'Inside Treatment Rooms'}</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {inTreatmentWing.map((p) => {
                  const c = p.clinicalCase;
                  const awaitingAssign =
                    p.state === 'walking_to_treatment_wait' || p.state === 'waiting_in_treatment';
                  const statusLabel =
                    p.state === 'walking_to_treatment_wait'
                      ? isAr
                        ? 'متجه إلى صالة العلاج...'
                        : 'Entering treatment hall...'
                      : p.state === 'waiting_in_treatment'
                        ? p.isSeatedWait !== false
                          ? isAr
                            ? 'جالس في صالة العلاج — اختر له السرير أو الجهاز'
                            : 'Seated in hall — pick bed or device'
                          : isAr
                            ? 'واقف في صالة العلاج — اختر له السرير أو الجهاز'
                            : 'Standing in hall — pick bed or device'
                        : p.state === 'walking_to_station'
                          ? isAr
                            ? 'متجه إلى الجهاز المحدد'
                            : 'Walking to chosen station'
                          : p.state === 'in_treatment'
                            ? isAr
                              ? 'جلسة علاج نشطة'
                              : 'Therapy active'
                            : isAr
                              ? 'على الجهاز بانتظار بدء الجلسة'
                              : 'At station awaiting exam';
                  const canInspect = p.state === 'ready_for_exam' || p.state === 'in_exam';

                  return (
                    <div
                      key={p.id}
                      className={`rounded-2xl border px-3.5 py-2.5 flex items-center justify-between gap-3 ${
                        isNight
                          ? 'bg-slate-950/40 border-slate-800/80 text-slate-300'
                          : 'bg-white border-slate-200/80 text-slate-700'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">
                          {isAr ? c.patientNameAr : c.patientNameEn}
                        </div>
                        <div className={`text-[11px] truncate ${isNight ? 'text-slate-400' : 'text-slate-500'}`}>
                          {statusLabel}
                        </div>
                      </div>
                      {awaitingAssign && onAssignTreatmentPatient && (
                        <button
                          type="button"
                          onClick={() => onAssignTreatmentPatient(p.id)}
                          className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-black shrink-0 cursor-pointer active:scale-95"
                        >
                          {isAr ? 'اختر الجهاز' : 'Pick Station'}
                        </button>
                      )}
                      {canInspect && onInspectActivePatient && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onInspectActivePatient(p.id);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black shrink-0 cursor-pointer active:scale-95"
                        >
                          {isAr ? 'ابدأ الجلسة' : 'Start Session'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
