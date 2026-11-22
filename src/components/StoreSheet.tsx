import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BriefcaseMedical,
  Building2,
  Coins,
  Flower2,
  Hammer,
  LayoutGrid,
  Lock,
  Search,
  Sofa,
  Trees,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { CATALOG_ITEMS, SPECIALTY_META } from '../data/catalog';
import { glbRegistry } from '../engine3d/glbRegistry';
import { renderMissingCatalogThumbsChunked, useCatalogThumb } from '../engine3d/thumbRenderer';
import {
  CatalogItem,
  ClinicRoom,
  ItemCategory,
  Language,
  LightingMode,
  NavTab,
  StaffMember,
} from '../types/clinic';

interface StoreSheetProps {
  open: boolean;
  initialFilter: NavTab | 'staff';
  coins: number;
  rooms: ClinicRoom[];
  staff: StaffMember[];
  language: Language;
  lightingMode?: LightingMode;
  onClose: () => void;
  onBuyAndPlace: (item: CatalogItem) => void;
  onSelectRoomToUnlock: (room: ClinicRoom) => void;
  onHireStaff: (staffMember: StaffMember) => void;
}

type StoreFilter = 'all' | ItemCategory | 'staff';

const HappyFarmCardPreview: React.FC<{ item: CatalogItem; isNight: boolean }> = ({ item, isNight }) => {
  const thumbUrl = useCatalogThumb(item.sprite, item.width, item.depth);
  const CategoryIcon =
    item.category === 'equipment'
      ? Activity
      : item.category === 'furniture'
        ? Sofa
        : item.category === 'decor'
          ? Flower2
          : Hammer;

  return (
    <div
      className={`w-full h-24 rounded-2xl border flex items-center justify-center overflow-hidden relative ${
        isNight
          ? 'bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border-slate-700'
          : 'bg-gradient-to-b from-sky-50 via-white to-emerald-50/70 border-slate-200/80'
      }`}
    >
      {thumbUrl ? (
        <img
          src={thumbUrl}
          alt={item.nameEn}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="w-20 h-20 object-contain drop-shadow-md transition-transform duration-200 group-hover:scale-105"
        />
      ) : (
        <div className="flex flex-col items-center justify-center text-sky-500/80">
          <CategoryIcon className="w-8 h-8" />
        </div>
      )}
    </div>
  );
};

export const StoreSheet: React.FC<StoreSheetProps> = ({
  open,
  initialFilter,
  coins,
  rooms,
  staff,
  language,
  lightingMode = 'day',
  onClose,
  onBuyAndPlace,
  onSelectRoomToUnlock,
  onHireStaff,
}) => {
  const isAr = language === 'ar';
  const isNight = lightingMode === 'night';
  const infiniteCoins = coins >= 900000;

  const resolveTab = (f: NavTab | 'staff'): StoreFilter =>
    f === 'build' || f === 'furniture' || f === 'equipment' || f === 'decor' || f === 'staff'
      ? f
      : 'all';

  const [filter, setFilter] = useState<StoreFilter>(() => resolveTab(initialFilter));
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    setFilter(resolveTab(initialFilter));
    const specs = CATALOG_ITEMS.map((c) => ({
      sprite: c.sprite,
      width: c.width,
      depth: c.depth,
    }));
    let cancelChunked = () => {};
    const unsub = glbRegistry.onCoreReady(() => {
      cancelChunked();
      cancelChunked = renderMissingCatalogThumbsChunked(specs, 3, 28);
    });
    return () => {
      unsub();
      cancelChunked();
    };
  }, [open, initialFilter]);

  const filteredItems = useMemo(() => {
    return CATALOG_ITEMS.filter((item) => {
      if (filter !== 'all' && filter !== 'staff' && item.category !== filter) {
        return false;
      }
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        item.nameAr.toLowerCase().includes(q) ||
        item.nameEn.toLowerCase().includes(q) ||
        item.descAr.toLowerCase().includes(q) ||
        item.descEn.toLowerCase().includes(q)
      );
    });
  }, [filter, search]);

  if (!open) return null;

  const tabs: Array<{
    id: StoreFilter;
    labelAr: string;
    labelEn: string;
    Icon: React.FC<{ className?: string }>;
  }> = [
    { id: 'all', labelAr: 'الكل', labelEn: 'All', Icon: LayoutGrid },
    { id: 'equipment', labelAr: 'الأجهزة', labelEn: 'Equipment', Icon: Activity },
    { id: 'furniture', labelAr: 'الأثاث', labelEn: 'Furniture', Icon: Sofa },
    { id: 'decor', labelAr: 'الحديقة والزينة', labelEn: 'Garden & Decor', Icon: Trees },
    { id: 'build', labelAr: 'التوسعة والبناء', labelEn: 'Build & Wings', Icon: Building2 },
    { id: 'staff', labelAr: 'الطاقم', labelEn: 'Staff', Icon: Users },
  ];

  const lockedRooms = rooms.filter((r) => !r.unlocked);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-950/80"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-3xl rounded-t-3xl sm:rounded-3xl shadow-2xl border flex flex-col max-h-[86vh] animate-in slide-in-from-bottom duration-200 overflow-hidden transition-colors ${
          isNight
            ? 'bg-slate-950 border-slate-700/90 text-slate-100'
            : 'bg-[#f4f7f5] border-white/80 text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Store Header */}
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
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-300 to-amber-500 text-slate-950 flex items-center justify-center shadow-md shrink-0">
                <BriefcaseMedical className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black leading-tight">
                  {isAr ? 'متجر العيادة والتجهيزات' : 'THERASON Clinic Store'}
                </h2>
                <p className="text-xs text-sky-100/85">
                  {isAr
                    ? 'اختر أي جهاز أو قطعة أثاث أو ديكور ونزلها مباشرة في العيادة'
                    : 'Tap any asset to drop it straight onto your clinic grid'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 bg-slate-950/45 border border-white/20 text-amber-300 px-3 py-1.5 rounded-xl font-black text-xs tabular-nums">
                <Coins className="w-4 h-4 text-amber-400" />
                {infiniteCoins ? '∞' : coins}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close store"
                className="w-10 h-10 rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Visual Category Tabs Bar + Quick Search */}
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <div className="relative w-full sm:w-52 shrink-0">
              <Search className="w-4 h-4 text-sky-200 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isAr ? 'ابحث في المتجر...' : 'Search catalog...'}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950/35 border border-white/15 text-sm text-white placeholder:text-sky-200/65 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 custom-scroll">
              {tabs.map(({ id, labelAr, labelEn, Icon }) => {
                const active = filter === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFilter(id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap shrink-0 transition-all ${
                      active
                        ? 'bg-emerald-400 text-slate-950 shadow-md'
                        : 'bg-white/12 text-sky-50 hover:bg-white/20'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{isAr ? labelAr : labelEn}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Store Body */}
        <div className="p-4 overflow-y-auto custom-scroll space-y-5">
          {/* Room Expansion Section when in Build or All */}
          {(filter === 'build' || filter === 'all') && lockedRooms.length > 0 && (
            <section>
              <h3 className={`text-xs font-extrabold mb-2.5 flex items-center gap-1.5 ${isNight ? 'text-slate-300' : 'text-slate-600'}`}>
                <Building2 className="w-4 h-4 text-sky-500" />
                {isAr ? 'توسعة الأجنحة الجديدة' : 'Unlock Clinic Wings'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {lockedRooms.map((room) => {
                  const canAfford = infiniteCoins || coins >= room.unlockCost;
                  return (
                    <div
                      key={room.id}
                      className={`rounded-2xl p-3 border flex items-center justify-between gap-3 shadow-sm ${
                        isNight ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${
                            isNight
                              ? 'bg-amber-950/60 border-amber-700/60 text-amber-400'
                              : 'bg-amber-50 border-amber-200 text-amber-600'
                          }`}
                        >
                          <Lock className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className={`text-sm font-extrabold truncate ${isNight ? 'text-slate-100' : 'text-slate-900'}`}>
                            {isAr ? room.nameAr : room.nameEn}
                          </div>
                          <div className={`text-xs ${isNight ? 'text-slate-400' : 'text-slate-500'}`}>
                            {isAr ? 'اختر التخصص بعد الفتح' : 'Choose room specialty on unlock'}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!canAfford}
                        onClick={() => onSelectRoomToUnlock(room)}
                        className={`px-3.5 py-2.5 rounded-xl text-xs font-black whitespace-nowrap shrink-0 transition-transform active:scale-95 ${
                          canAfford
                            ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow'
                            : isNight
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        {isAr ? `فتح · ${room.unlockCost}` : `Unlock · ${room.unlockCost}`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Hireable Staff Section */}
          {(filter === 'staff' || filter === 'all') && (
            <section>
              <h3 className={`text-xs font-extrabold mb-2.5 flex items-center gap-1.5 ${isNight ? 'text-slate-300' : 'text-slate-600'}`}>
                <Users className="w-4 h-4 text-teal-500" />
                {isAr ? 'توظيف الطاقم الطبي والإداري' : 'Hire Clinic Staff'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {staff.map((member) => {
                  const canAfford = infiniteCoins || coins >= member.hireCost;
                  return (
                    <div
                      key={member.id}
                      className={`rounded-2xl p-3 border flex items-center justify-between gap-3 shadow-sm ${
                        isNight ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-12 h-12 rounded-xl text-white flex items-center justify-center shrink-0 font-bold shadow-sm"
                          style={{ backgroundColor: member.scrubColor }}
                        >
                          <UserCheck className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className={`text-sm font-extrabold truncate ${isNight ? 'text-slate-100' : 'text-slate-900'}`}>
                            {isAr ? member.nameAr : member.nameEn}
                          </div>
                          <div className={`text-xs ${isNight ? 'text-slate-400' : 'text-slate-500'}`}>
                            {member.role === 'receptionist'
                              ? isAr
                                ? 'تستقبل وتسجل المرضى تلقائياً'
                                : 'Auto-checks in arriving patients'
                              : isAr
                                ? 'متابعة الحالات داخل الغرف'
                                : 'Assists patients in treatment bays'}
                          </div>
                        </div>
                      </div>
                      {member.hired ? (
                        <span className="text-xs font-extrabold text-emerald-500 whitespace-nowrap px-2">
                          {isAr ? '✓ موظف' : '✓ Hired'}
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={!canAfford}
                          onClick={() => onHireStaff(member)}
                          className={`px-3.5 py-2.5 rounded-xl text-xs font-black whitespace-nowrap shrink-0 transition-transform active:scale-95 ${
                            canAfford
                              ? 'bg-sky-600 hover:bg-sky-700 text-white shadow'
                              : isNight
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          {isAr ? `توظيف · ${member.hireCost}` : `Hire · ${member.hireCost}`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Product Grid */}
          {filter !== 'staff' && (
            <section>
              <div className="flex items-center justify-between mb-2.5">
                <h3 className={`text-xs font-extrabold ${isNight ? 'text-slate-300' : 'text-slate-600'}`}>
                  {isAr ? 'اختر العنصر للشراء والوضع في العيادة' : 'Pick Any Item to Buy & Place'}
                </h3>
                <span className={`text-xs font-bold tabular-nums ${isNight ? 'text-slate-400' : 'text-slate-500'}`}>
                  {filteredItems.length} {isAr ? 'عنصر' : 'items'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredItems.map((item) => {
                  const canAfford = infiniteCoins || coins >= item.priceCoins;
                  const specMeta =
                    item.stationSpecialty && item.stationSpecialty !== 'any'
                      ? SPECIALTY_META[item.stationSpecialty]
                      : null;

                  return (
                    <div
                      key={item.id}
                      className={`group rounded-2xl p-2.5 border flex flex-col justify-between gap-2 shadow-sm hover:border-emerald-400 hover:shadow-md transition-all ${
                        isNight
                          ? 'bg-slate-900 border-slate-700/90'
                          : 'bg-white border-slate-200/90'
                      }`}
                    >
                      <div>
                        <HappyFarmCardPreview item={item} isNight={isNight} />
                        <h4 className={`mt-2 text-xs sm:text-sm font-extrabold leading-snug line-clamp-1 ${isNight ? 'text-slate-100' : 'text-slate-900'}`}>
                          {isAr ? item.nameAr : item.nameEn}
                        </h4>
                        <div className={`mt-0.5 text-[11px] font-semibold line-clamp-1 ${isNight ? 'text-slate-400' : 'text-slate-500'}`}>
                          <span>+{item.satisfactionBonus}% {isAr ? 'رضا' : 'Sat'}</span>
                          {item.speedBonus > 0 && (
                            <>
                              <span aria-hidden="true"> · </span>
                              <span className={isNight ? 'text-sky-400' : 'text-sky-700'}>
                                +{item.speedBonus}% {isAr ? 'كفاءة' : 'Eff'}
                              </span>
                            </>
                          )}
                          {specMeta && (
                            <>
                              <span aria-hidden="true"> · </span>
                              <span style={{ color: specMeta.color }}>
                                {isAr ? specMeta.nameAr : specMeta.nameEn}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={!canAfford}
                        onClick={() => onBuyAndPlace(item)}
                        className={`w-full min-h-[40px] py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 whitespace-nowrap transition-transform active:scale-95 ${
                          canAfford
                            ? 'bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-600 text-white shadow'
                            : isNight
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <Coins className="w-3.5 h-3.5 text-amber-200 shrink-0" />
                        <span className="tabular-nums">{item.priceCoins}</span>
                        <span aria-hidden="true">·</span>
                        <span>{isAr ? 'شراء' : 'Buy'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
          <div className="h-[env(safe-area-inset-bottom)]" />
        </div>
      </div>
    </div>
  );
};

