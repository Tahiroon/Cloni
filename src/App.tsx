import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BellRing, Clock, Coins, Play, Stethoscope, Trash2, Trees, X } from 'lucide-react';
import { BottomNavBar } from './components/BottomNavBar';
import { BonusQuizModal } from './components/BonusQuizModal';
import { ClinicCanvas, PlacementDraft } from './components/ClinicCanvas';
import { FirstPersonSessionHud } from './components/FirstPersonSessionHud';
import { FriendsModal } from './components/FriendsModal';
import { GameLoadingScreen } from './components/GameLoadingScreen';
import { MissionsModal } from './components/MissionsModal';
import { PlayerCharacterModal } from './components/PlayerCharacterModal';
import { RoomUnlockModal } from './components/RoomUnlockModal';
import { SettingsModal } from './components/SettingsModal';
import { StoreSheet } from './components/StoreSheet';
import { TopHudBar } from './components/TopHudBar';
import { WaitingQueueModal } from './components/WaitingQueueModal';
import { WorldTreeDef } from './engine3d/models3d';
import {
  CATALOG_ITEMS,
  createInitialSaveState,
  DEFAULT_PLAYER_PROFILE,
  FALLBACK_CLINICAL_CASES,
  FRIEND_CLINICS,
  getDefaultPostureForStation,
  normalizePlayerProfile,
  SPECIALTY_META,
} from './data/catalog';
import {
  buildObstacleBoxes,
  buildWaitSeatSlots,
  findGridPath,
  findNearestWalkableTile,
  getReceptionDeskPose,
  getStationApproachTarget,
  getValidWallRotationsForTile,
  hasContinuousLineOfSight,
  isInSolarZone,
  isTileInOutdoorGarden,
  isTileWalkable,
  isValidWallMount,
  isWallDecorId,
  overlapsActiveWorldTree,
  resolveTileStep,
  snapToNearestValidWallSlot,
  SOLAR_ZONE,
  WaitSeatSlot,
  WorldTreeSpecies,
} from './engine/isometricMath';
import {
  getInitialBootLanguage,
  persistBootLanguage,
  scheduleIdleBrowserPrewarm,
} from './services/gameBootLoader';
import {
  loadClinicLocal,
  loadClinicLocalSync,
  saveClinicLocal,
  scheduleSilentCloudSync,
} from './services/indexedDbStorage';
import { soundFx } from './services/soundEffects';
import {
  CatalogItem,
  ClinicRoom,
  ClinicSaveState,
  EyewearStyle,
  FacialHairStyle,
  FloatingFeedback,
  FppActiveDeviceState,
  FppDeviceCommandApi,
  FppHeldDeviceInfo,
  FppNearbyDeviceInfo,
  FppPatientPosture,
  FriendClinic,
  HeadwearStyle,
  Language,
  LightingMode,
  NavTab,
  PatientAttachedDevice,
  PatientEntity,
  PlacedItem,
  PlayerCharacterConfig,
  RoomSpecialty,
  StaffMember,
} from './types/clinic';

const SUDANESE_SKINS = [
  '#be8862', // قمحي فاتح دافئ
  '#a66e49', // أسمر فاتح ذهبي
  '#8f5938', // قمحي دافئ
  '#79472b', // أسمر سوداني أصيل
  '#653920', // أسمر متوسط غني
  '#522c18', // بني داكن دافئ
  '#412111', // أسمر غامق
];

const MALE_CASUAL_LOOKS: Array<{ shirt: string; pants: string; shirtStyle: 'tshirt' | 'shirt' }> = [
  // Bright / Light Shirts paired with Deep / Dark Trousers
  { shirt: '#f8fafc', pants: '#172554', shirtStyle: 'shirt' },   // Crisp White + Deep Navy
  { shirt: '#38bdf8', pants: '#1e293b', shirtStyle: 'tshirt' },  // Sky Blue Tee + Charcoal
  { shirt: '#fbbf24', pants: '#27272a', shirtStyle: 'tshirt' },  // Warm Amber Tee + Onyx
  { shirt: '#34d399', pants: '#1e293b', shirtStyle: 'tshirt' },  // Fresh Mint Tee + Slate
  { shirt: '#e7dcc8', pants: '#3b2618', shirtStyle: 'shirt' },   // Cream Linen + Espresso Brown
  { shirt: '#fb7185', pants: '#172554', shirtStyle: 'tshirt' },  // Coral Rose Tee + Navy
  { shirt: '#a3e635', pants: '#1f2937', shirtStyle: 'tshirt' },  // Lime Tee + Charcoal
  { shirt: '#93c5fd', pants: '#334155', shirtStyle: 'shirt' },   // Powder Blue Shirt + Slate
  // Rich / Deep Shirts paired with Light Khaki, Stone & Medium Denim Trousers
  { shirt: '#9f1239', pants: '#d6cfc2', shirtStyle: 'shirt' },   // Burgundy + Light Stone
  { shirt: '#047857', pants: '#cbb696', shirtStyle: 'tshirt' },  // Emerald Tee + Warm Khaki
  { shirt: '#1d4ed8', pants: '#e2dcd0', shirtStyle: 'shirt' },   // Royal Blue + Sand Beige
  { shirt: '#c2410c', pants: '#4b6b94', shirtStyle: 'tshirt' },  // Terracotta Tee + Mid Denim
  { shirt: '#1e293b', pants: '#cbb696', shirtStyle: 'tshirt' },  // Dark Charcoal Tee + Khaki
  { shirt: '#6d28d9', pants: '#d6cfc2', shirtStyle: 'shirt' },   // Deep Violet + Light Stone
  { shirt: '#0f766e', pants: '#bfb097', shirtStyle: 'tshirt' },  // Teal Tee + Warm Tan
  { shirt: '#7c2d12', pants: '#94a3b8', shirtStyle: 'shirt' },   // Rust Brown + Cool Silver Grey
];

const FEMALE_ABAYA_COLORS = [
  '#141418',
  '#1e293b',
  '#172554',
  '#4c1d32',
  '#0f4c52',
  '#423026',
  '#3b2f4a',
];
const FEMALE_OPEN_ABAYA_LOOKS = [
  { outer: '#141418', inner: '#f4efe6' },
  { outer: '#1e293b', inner: '#bae6fd' },
  { outer: '#0f4c52', inner: '#f3e8d8' },
  { outer: '#581c3a', inner: '#fce7f3' },
  { outer: '#362922', inner: '#e7dcc8' },
  { outer: '#1e3a8a', inner: '#f8fafc' },
  { outer: '#3b4a32', inner: '#f4ebd9' },
];
const FEMALE_DRESS_COLORS = [
  '#2f6f5b',
  '#9f3f58',
  '#0369a1',
  '#b45309',
  '#6d28d9',
  '#0f766e',
  '#be123c',
  '#3f6212',
];
const FEMALE_CASUAL_LOOKS = [
  { shirt: '#0284c7', pants: '#172554' },
  { shirt: '#e11d48', pants: '#1e293b' },
  { shirt: '#f59e0b', pants: '#27272a' },
  { shirt: '#10b981', pants: '#1e293b' },
  { shirt: '#f8fafc', pants: '#3b2618' },
  { shirt: '#7c3aed', pants: '#d6cfc2' },
  { shirt: '#0f766e', pants: '#cbb696' },
  { shirt: '#9f1239', pants: '#e2dcd0' },
];
const FEMALE_SUDANESE_THOBE_LOOKS = [
  { thobe: '#f6f2e7', inner: '#3b262a' }, // Classic Sudanese White/Ivory Thobe + Deep Plum-Brown Inner
  { thobe: '#6d1d31', inner: '#f3e8d8' }, // Rich Maroon Thobe + Warm Cream Inner
  { thobe: '#0f5c4a', inner: '#f5efe2' }, // Nile Emerald Thobe + Ivory Inner
  { thobe: '#1d396b', inner: '#e8eef7' }, // Royal Indigo Thobe + Soft Sky Cream Inner
  { thobe: '#b4741d', inner: '#f7f1e3' }, // Warm Saffron Gold Thobe + Cream Inner
  { thobe: '#5b2557', inner: '#f4e6ef' }, // Dignified Plum Thobe + Soft Rose-Cream Inner
  { thobe: '#157188', inner: '#f0f7fa' }, // Turquoise Teal Thobe + Crisp Mist Inner
  { thobe: '#9c3b27', inner: '#f5eadf' }, // Henna Terracotta Thobe + Sand Ivory Inner
];

const REALISTIC_CASUAL_LOOKS = [
  { shirt: '#bfdbfe', pants: '#1e293b' }, // Sky Shirt + Dark Navy
  { shirt: '#cbd5e1', pants: '#3f352c' }, // Cool Slate Shirt + Espresso
  { shirt: '#a7f3d0', pants: '#1f2937' }, // Soft Mint Shirt + Charcoal
  { shirt: '#fef3c7', pants: '#273549' }, // Ivory Cream Shirt + Slate Blue
  { shirt: '#991b1b', pants: '#cbb696' }, // Deep Burgundy Shirt + Khaki
  { shirt: '#1d4ed8', pants: '#d6cfc2' }, // Cobalt Shirt + Light Stone
  { shirt: '#0f766e', pants: '#1e293b' }, // Deep Teal Shirt + Dark Navy
  { shirt: '#f1f5f9', pants: '#334155' }, // Crisp White Shirt + Graphite
];

const SUDANESE_ROBE_LOOKS = [
  { robe: '#f6f3ec', headwear: 'turban' as HeadwearStyle },
  { robe: '#ece2cd', headwear: 'turban' as HeadwearStyle },
  { robe: '#dde7ef', headwear: 'taqiyah' as HeadwearStyle },
  { robe: '#e4e8de', headwear: 'taqiyah' as HeadwearStyle },
  { robe: '#f2e8d7', headwear: 'turban' as HeadwearStyle },
  { robe: '#e5dfd6', headwear: 'turban' as HeadwearStyle },
  { robe: '#d9e1e8', headwear: 'cap' as HeadwearStyle },
  { robe: '#ece7df', headwear: 'taqiyah' as HeadwearStyle },
];

const EYEWEAR_VARIETY: EyewearStyle[] = ['round', 'square', 'half_rim', 'sunglasses'];
const EYEWEAR_FRAME_PALETTE = ['#18181b', '#78350f', '#94a3b8', '#b45309', '#1e3a8a'];
const YOUTH_HAIR_TONES = ['#17100c', '#241712', '#100c0a', '#2e1d15'];
const SENIOR_HAIR_TONES = ['#6b7280', '#9ca3af', '#4b5563', '#858a91'];

const EMPTY_REMOVED_TREES: string[] = [];
const ASSIGNABLE_STATION_SPRITES = new Set([
  'treatment_bed',
  'traction_table',
  'magnetotherapy',
  'tilt_table',
  'exercise_mat',
  'exercise_bike',
  'treadmill',
  'parallel_bars',
  'balance_trainer',
  'wall_bars',
  'multi_gym_pulley',
]);

const TREE_SPECIES_LABELS: Record<WorldTreeSpecies, { ar: string; en: string }> = {
  oak: { ar: 'شجرة بلوط برية', en: 'Wild Oak Tree' },
  wild_fig: { ar: 'شجرة جميز برية', en: 'Wild Fig Tree' },
  acacia: { ar: 'شجرة أكاسيا برية', en: 'Wild Acacia Tree' },
  cypress: { ar: 'شجرة سرو برية', en: 'Wild Cypress Tree' },
  birch: { ar: 'شجرة بتولا برية', en: 'Wild Birch Tree' },
};

const STATIC_CATALOG_BY_ID = new Map<string, CatalogItem>(
  CATALOG_ITEMS.map((c) => [c.id, c])
);

function migrateClinicSaveState(saved: ClinicSaveState): ClinicSaveState {
  let nextState: ClinicSaveState = saved;
  const needsExpansionMigration =
    (saved.version || 1) < 6 || (saved.rooms[0]?.maxX ?? 0) < 21;

  if (needsExpansionMigration) {
    const fresh = createInitialSaveState();
    const prevRoomMap = new Map(saved.rooms.map((r) => [r.id, r]));
    const prevStaffMap = new Map(saved.staff.map((s) => [s.id, s]));

    nextState = {
      ...fresh,
      studentId: saved.studentId || fresh.studentId,
      language: saved.language || fresh.language,
      soundEnabled: saved.soundEnabled ?? fresh.soundEnabled,
      lightingMode: saved.lightingMode || 'day',
      stars: saved.stars || 0,
      xp: saved.xp || 0,
      level: saved.level || 1,
      satisfaction: saved.satisfaction || 98,
      patientsTreatedTotal: saved.patientsTreatedTotal || 0,
      redFlagsCaughtTotal: saved.redFlagsCaughtTotal || 0,
      missions: saved.missions?.length ? saved.missions : fresh.missions,
      rooms: fresh.rooms.map((r) => {
        const old = prevRoomMap.get(r.id);
        if (old && old.unlocked && old.specialty) {
          const meta = SPECIALTY_META[old.specialty];
          return {
            ...r,
            unlocked: true,
            specialty: old.specialty,
            floorTheme: meta?.floorTheme || r.floorTheme,
            nameAr: meta?.nameAr || r.nameAr,
            nameEn: meta?.nameEn || r.nameEn,
          };
        }
        return r;
      }),
      staff: fresh.staff.map((st) => {
        const old = prevStaffMap.get(st.id);
        return old?.hired ? { ...st, hired: true } : st;
      }),
      removedTreeIds: saved.removedTreeIds || [],
      lastSyncedAt: saved.lastSyncedAt || null,
    };
  }

  // Relocate any legacy south-zone solar panels cleanly to the Rear Solar Zone behind the clinic
  const relocatedItems = nextState.placedItems.map((it) => ({ ...it }));
  let nextRearSolarIdx = 0;
  const rearOccupied = new Set<string>();
  for (const it of relocatedItems) {
    if (it.catalogId === 'solar_panel' && isInSolarZone(it.gridX, it.gridY, 2, 2)) {
      for (let dx = 0; dx < 2; dx++) {
        for (let dy = 0; dy < 2; dy++) {
          rearOccupied.add(`${it.gridX + dx},${it.gridY + dy}`);
        }
      }
    }
  }
  const rearSlots: Array<{ gx: number; gy: number }> = [];
  for (let y = SOLAR_ZONE.minY; y <= SOLAR_ZONE.maxY - 1; y += 2) {
    for (let x = SOLAR_ZONE.minX; x <= SOLAR_ZONE.maxX - 1; x += 2) {
      rearSlots.push({ gx: x, gy: y });
    }
  }
  for (const it of relocatedItems) {
    if (it.catalogId === 'solar_panel' && !isInSolarZone(it.gridX, it.gridY, 2, 2)) {
      while (nextRearSolarIdx < rearSlots.length) {
        const slot = rearSlots[nextRearSolarIdx++];
        let busy = false;
        for (let dx = 0; dx < 2 && !busy; dx++) {
          for (let dy = 0; dy < 2; dy++) {
            if (rearOccupied.has(`${slot.gx + dx},${slot.gy + dy}`)) {
              busy = true;
              break;
            }
          }
        }
        if (!busy) {
          it.gridX = slot.gx;
          it.gridY = slot.gy;
          for (let dx = 0; dx < 2; dx++) {
            for (let dy = 0; dy < 2; dy++) {
              rearOccupied.add(`${slot.gx + dx},${slot.gy + dy}`);
            }
          }
          break;
        }
      }
    }
  }

  // Auto-repair any legacy wall-mounted items whose saved rotation/tile is not on a visible wall face
  const occupiedWallKeys = new Set<string>();
  for (const it of relocatedItems) {
    const cat = STATIC_CATALOG_BY_ID.get(it.catalogId);
    if (!cat?.isWallDecor && !isWallDecorId(it.catalogId)) continue;
    if (isValidWallMount(it.gridX, it.gridY, it.rotation, nextState.rooms)) {
      const k = `${it.gridX},${it.gridY},${it.rotation}`;
      if (!occupiedWallKeys.has(k)) {
        occupiedWallKeys.add(k);
        continue;
      }
    }
    const tileRots = getValidWallRotationsForTile(it.gridX, it.gridY, nextState.rooms);
    const freeTileRot = tileRots.find((r) => !occupiedWallKeys.has(`${it.gridX},${it.gridY},${r}`));
    if (freeTileRot !== undefined) {
      it.rotation = freeTileRot;
      occupiedWallKeys.add(`${it.gridX},${it.gridY},${freeTileRot}`);
      continue;
    }
    const fallback = snapToNearestValidWallSlot(
      it.gridX + 0.5,
      it.gridY + 0.5,
      it.rotation === 0 ? 0 : 1,
      nextState.rooms
    );
    if (fallback) {
      it.gridX = fallback.gx;
      it.gridY = fallback.gy;
      it.rotation = fallback.rotation;
      occupiedWallKeys.add(`${fallback.gx},${fallback.gy},${fallback.rotation}`);
    }
  }

  // Ensure essential starter reception assets (file_cabinet & reception_desk) are never missing from saved clinics
  const ensureEssentialReceptionItem = (
    catalogId: 'file_cabinet' | 'reception_desk',
    defaultItem: PlacedItem
  ) => {
    if (relocatedItems.some((it) => it.catalogId === catalogId)) return;
    const cat = STATIC_CATALOG_BY_ID.get(catalogId);
    if (!cat) return;
    const occupiedTiles = new Set<string>();
    for (const existing of relocatedItems) {
      const eCat = STATIC_CATALOG_BY_ID.get(existing.catalogId);
      if (!eCat || eCat.isWallDecor || eCat.id === 'floor_rug' || eCat.id === 'stone_pathway') {
        continue;
      }
      const ew = existing.rotation % 2 === 0 ? eCat.width : eCat.depth;
      const ed = existing.rotation % 2 === 0 ? eCat.depth : eCat.width;
      for (let dx = 0; dx < ew; dx++) {
        for (let dy = 0; dy < ed; dy++) {
          occupiedTiles.add(`${existing.gridX + dx},${existing.gridY + dy}`);
        }
      }
    }
    const receptionRoom = nextState.rooms.find((r) => r.id === 'room_reception');
    const minX = receptionRoom?.minX ?? 12;
    const maxX = receptionRoom?.maxX ?? 21;
    const minY = receptionRoom?.minY ?? 10;
    const maxY = receptionRoom?.maxY ?? 21;
    const canPlaceAt = (gx: number, gy: number) => {
      for (let dx = 0; dx < cat.width; dx++) {
        for (let dy = 0; dy < cat.depth; dy++) {
          const tx = gx + dx;
          const ty = gy + dy;
          if (tx < minX || tx > maxX || ty < minY || ty > maxY) return false;
          // Keep interior clinic doors clear
          if ((tx === 12 && (ty === 14 || ty === 15)) || (ty === 10 && (tx === 16 || tx === 17))) {
            return false;
          }
          if (occupiedTiles.has(`${tx},${ty}`)) return false;
        }
      }
      return true;
    };

    if (canPlaceAt(defaultItem.gridX, defaultItem.gridY)) {
      relocatedItems.push({ ...defaultItem });
      return;
    }
    for (let gy = minY; gy <= maxY; gy++) {
      for (let gx = minX; gx <= maxX; gx++) {
        if (canPlaceAt(gx, gy)) {
          relocatedItems.push({ ...defaultItem, gridX: gx, gridY: gy });
          return;
        }
      }
    }
  };

  ensureEssentialReceptionItem('file_cabinet', {
    instanceId: 'init_cabinet',
    catalogId: 'file_cabinet',
    gridX: 13,
    gridY: 10,
    rotation: 0,
    roomId: 'room_reception',
  });
  ensureEssentialReceptionItem('reception_desk', {
    instanceId: 'init_desk',
    catalogId: 'reception_desk',
    gridX: 14,
    gridY: 12,
    rotation: 0,
    roomId: 'room_reception',
  });

  const migratedStaff = (nextState.staff || [])
    .filter((st) => st.id !== 'staff_therapist_1')
    .map((st) => (st.role === 'receptionist' ? { ...st, hired: true } : st));

  return {
    ...nextState,
    staff: migratedStaff,
    playerProfile: normalizePlayerProfile(nextState.playerProfile),
    placedItems: relocatedItems,
    lightingMode: nextState.lightingMode || 'day',
    removedTreeIds: nextState.removedTreeIds || [],
    version: 6,
    coins: 999999,
  };
}

export default function App() {
  const [clinic, setClinic] = useState<ClinicSaveState>(() => {
    const syncSaved = loadClinicLocalSync();
    if (syncSaved) {
      const migrated = migrateClinicSaveState(syncSaved);
      soundFx.enabled = migrated.soundEnabled;
      persistBootLanguage(migrated.language);
      if (typeof document !== 'undefined') {
        document.documentElement.lang = migrated.language;
        document.documentElement.dir = migrated.language === 'ar' ? 'rtl' : 'ltr';
      }
      return migrated;
    }
    const initial = createInitialSaveState();
    const savedLang = getInitialBootLanguage();
    return savedLang !== initial.language ? { ...initial, language: savedLang } : initial;
  });
  const [hydrated, setHydrated] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [bootDismissed, setBootDismissed] = useState(false);
  const [canvasMounted, setCanvasMounted] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setCanvasMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!bootDismissed) return;
    return scheduleIdleBrowserPrewarm();
  }, [bootDismissed]);

  const [patients, setPatients] = useState<PatientEntity[]>([]);
  const [floatingFeedbacks, setFloatingFeedbacks] = useState<FloatingFeedback[]>([]);
  const [friends, setFriends] = useState<FriendClinic[]>(FRIEND_CLINICS);
  const [visitingFriend, setVisitingFriend] = useState<FriendClinic | null>(null);

  const [activeNavTab, setActiveNavTab] = useState<NavTab | null>(null);
  const [storeOpen, setStoreOpen] = useState(false);
  const [storeFilter, setStoreFilter] = useState<NavTab | 'staff'>('store');
  const [characterModalOpen, setCharacterModalOpen] = useState(false);
  const [missionsOpen, setMissionsOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bonusOpen, setBonusOpen] = useState(false);

  const [unlockTargetRoom, setUnlockTargetRoom] = useState<ClinicRoom | null>(null);
  const [selectedWorldTree, setSelectedWorldTree] = useState<WorldTreeDef | null>(null);
  const [selectedBedPatientId, setSelectedBedPatientId] = useState<string | null>(null);
  const [firstPersonPatientId, setFirstPersonPatientId] = useState<string | null>(null);
  const [fppPosture, setFppPosture] = useState<FppPatientPosture>('sitting');
  const [fppNearbyDevice, setFppNearbyDevice] = useState<FppNearbyDeviceInfo | null>(null);
  const [fppHeldDevice, setFppHeldDevice] = useState<FppHeldDeviceInfo | null>(null);
  const [fppActiveDevice, setFppActiveDevice] = useState<FppActiveDeviceState | null>(null);
  const [fppHandshakeReady, setFppHandshakeReady] = useState(false);
  const [fppHoverBodyZone, setFppHoverBodyZone] = useState<{ ar: string; en: string } | null>(null);
  const fppDeviceCmdRef = useRef<FppDeviceCommandApi | null>(null);
  const [fppBlinkPhase, setFppBlinkPhase] = useState<'idle' | 'closing' | 'hold' | 'opening'>('idle');
  const [fppRecenterNonce, setFppRecenterNonce] = useState(0);
  const [speakingPatientId, setSpeakingPatientId] = useState<string | null>(null);
  const [waitingQueueOpen, setWaitingQueueOpen] = useState(false);
  const [selectedWaitingPatientId, setSelectedWaitingPatientId] = useState<string | null>(null);
  const [selectedTreatmentWaitPatientId, setSelectedTreatmentWaitPatientId] = useState<string | null>(
    null
  );
  const [pendingStationIdForPick, setPendingStationIdForPick] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [placementDraft, setPlacementDraft] = useState<PlacementDraft | null>(null);
  const [orbitStep, setOrbitStep] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const treatmentTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const receptionCheckedInIdsRef = useRef<Set<string>>(new Set());
  const fppMoveInputRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const speakingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activePatientCountRef = useRef(0);
  const servedCaseIdsRef = useRef<Set<string>>(new Set());
  const sessionSpawnedRealisticRef = useRef(false);
  const sessionSpawnedSudaneseRef = useRef(false);
  const fppBlinkLockRef = useRef(false);
  const fppBlinkTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const fppBlinkRafsRef = useRef<number[]>([]);
  const isFppSessionActive = Boolean(firstPersonPatientId);

  const clearFppBlinkTimers = useCallback(() => {
    for (const t of fppBlinkTimersRef.current) {
      clearTimeout(t);
    }
    fppBlinkTimersRef.current = [];
    for (const id of fppBlinkRafsRef.current) {
      cancelAnimationFrame(id);
    }
    fppBlinkRafsRef.current = [];
  }, []);

  const triggerFppBlinkTransition = useCallback(
    (onHoldSwap: () => void, onOpeningStart?: () => void) => {
      if (fppBlinkLockRef.current) return;
      fppBlinkLockRef.current = true;
      clearFppBlinkTimers();
      setFppBlinkPhase('closing');

      const tHold = setTimeout(() => {
        setFppBlinkPhase('hold');
        onHoldSwap();

        const tOpen = setTimeout(() => {
          // Wait 2 animation frames behind closed eyelids so 3D bay & HUD commit cleanly before opening
          const raf1 = requestAnimationFrame(() => {
            const raf2 = requestAnimationFrame(() => {
              setFppBlinkPhase('opening');
              onOpeningStart?.();

              const tDone = setTimeout(() => {
                setFppBlinkPhase('idle');
                fppBlinkLockRef.current = false;
                fppBlinkTimersRef.current = [];
                fppBlinkRafsRef.current = [];
              }, 245);
              fppBlinkTimersRef.current.push(tDone);
            });
            fppBlinkRafsRef.current.push(raf2);
          });
          fppBlinkRafsRef.current.push(raf1);
        }, 95);
        fppBlinkTimersRef.current.push(tOpen);
      }, 155);
      fppBlinkTimersRef.current.push(tHold);
    },
    [clearFppBlinkTimers]
  );

  const handleReceptionCheckinDone = useCallback((patientId: string) => {
    receptionCheckedInIdsRef.current.add(patientId);
    if (receptionCheckedInIdsRef.current.size > 32) {
      const first = receptionCheckedInIdsRef.current.values().next().value;
      if (first) receptionCheckedInIdsRef.current.delete(first);
    }
  }, []);

  const handlePatientSpeak = useCallback((patientId: string, durationMs = 2600) => {
    if (speakingTimerRef.current) {
      clearTimeout(speakingTimerRef.current);
    }
    setSpeakingPatientId(patientId);
    speakingTimerRef.current = setTimeout(() => {
      speakingTimerRef.current = null;
      setSpeakingPatientId((cur) => (cur === patientId ? null : cur));
    }, durationMs);
  }, []);

  const lightingMode: LightingMode = clinic.lightingMode || 'day';

  useEffect(() => {
    const timers = treatmentTimersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
      clearFppBlinkTimers();
      if (speakingTimerRef.current) {
        clearTimeout(speakingTimerRef.current);
        speakingTimerRef.current = null;
      }
    };
  }, [clearFppBlinkTimers]);

  const itemFootprints = useMemo(() => {
    const map = new Map<string, { w: number; d: number }>();
    CATALOG_ITEMS.forEach((c) => map.set(c.id, { w: c.width, d: c.depth }));
    return map;
  }, []);

  const catalogById = useMemo(() => {
    const map = new Map<string, CatalogItem>();
    CATALOG_ITEMS.forEach((c) => map.set(c.id, c));
    return map;
  }, []);

  const obstacleBoxes = useMemo(
    () =>
      buildObstacleBoxes(
        clinic.rooms,
        clinic.placedItems,
        itemFootprints,
        clinic.removedTreeIds || EMPTY_REMOVED_TREES
      ),
    [clinic.rooms, clinic.placedItems, itemFootprints, clinic.removedTreeIds]
  );

  // Reconcile offline-first save & missions cleanly with IndexedDB (frame 0 already hydrated from sync mirror)
  useEffect(() => {
    let active = true;
    loadClinicLocal().then((saved) => {
      if (!active) return;
      if (saved && saved.rooms && saved.placedItems) {
        const nextState = migrateClinicSaveState(saved);
        setClinic(nextState);
        setLastSyncedAt(nextState.lastSyncedAt || null);
        soundFx.enabled = nextState.soundEnabled;
        persistBootLanguage(nextState.language);
        document.documentElement.lang = nextState.language;
        document.documentElement.dir = nextState.language === 'ar' ? 'rtl' : 'ltr';
      }
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // Idle-scheduled local persist (zero frame drops on mobile) + guaranteed flush on page exit + silent cloud sync
  const latestClinicRef = useRef(clinic);
  latestClinicRef.current = clinic;
  const pendingLocalSaveRef = useRef(false);

  useEffect(() => {
    if (!hydrated) return;
    pendingLocalSaveRef.current = true;
    let idleId: number | null = null;
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    const saveTimer = setTimeout(() => {
      const commitSave = () => {
        pendingLocalSaveRef.current = false;
        void saveClinicLocal(latestClinicRef.current);
      };
      if (typeof w.requestIdleCallback === 'function') {
        idleId = w.requestIdleCallback(commitSave, { timeout: 1200 });
      } else {
        commitSave();
      }
    }, 450);

    scheduleSilentCloudSync(clinic, (iso) => {
      setLastSyncedAt(iso);
    });
    return () => {
      clearTimeout(saveTimer);
      if (idleId !== null && typeof w.cancelIdleCallback === 'function') {
        w.cancelIdleCallback(idleId);
      }
    };
  }, [clinic, hydrated]);

  useEffect(() => {
    const flushLocalSave = () => {
      if (pendingLocalSaveRef.current) {
        pendingLocalSaveRef.current = false;
        void saveClinicLocal(latestClinicRef.current, true);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        flushLocalSave();
      }
    };
    window.addEventListener('pagehide', flushLocalSave);
    window.addEventListener('beforeunload', flushLocalSave);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flushLocalSave);
      window.removeEventListener('beforeunload', flushLocalSave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const addFloatingFeedback = useCallback((gridX: number, gridY: number, text: string, color: string) => {
    const id = 'fb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    setFloatingFeedbacks((prev) => [...prev.slice(-8), { id, gridX, gridY, text, color, createdAt: Date.now() }]);
  }, []);

  // Helper to update mission progress
  const bumpMission = useCallback((type: ClinicSaveState['missions'][0]['type'], amount = 1) => {
    setClinic((prev) => ({
      ...prev,
      missions: prev.missions.map((m) =>
        m.type === type && !m.claimed
          ? { ...m, progress: Math.min(m.target, m.progress + amount) }
          : m
      ),
    }));
  }, []);

  // Pick a walkable reception desk check-in spot in front of the desk (supports any rotation & sub-tile position)
  const getReceptionCheckinSpot = useCallback(
    (currentPatients: PatientEntity[]) => {
      const desk = clinic.placedItems.find((it) => it.catalogId === 'reception_desk');
      const rawSpots = desk
        ? getReceptionDeskPose(desk).checkinCandidates
        : [
            { x: 15, y: 13 },
            { x: 14, y: 13 },
            { x: 15, y: 14 },
          ];
      const spots = rawSpots.filter((s) => isTileWalkable(s.x, s.y, 0.22, obstacleBoxes));
      const pool =
        spots.length > 0
          ? spots
          : [findNearestWalkableTile(rawSpots[0].x, rawSpots[0].y, 0.22, obstacleBoxes)];
      const activeAtReception = currentPatients.filter(
        (p) => p.state === 'arriving' || p.state === 'checkin_at_desk'
      );
      return (
        pool.find(
          (s) =>
            !activeAtReception.some(
              (p) => Math.hypot(p.targetX - s.x, p.targetY - s.y) < 0.42
            )
        ) || pool[0]
      );
    },
    [clinic.placedItems, obstacleBoxes]
  );

  // Pick a walkable spot in front of an unlocked Reception water cooler for a quick hydration sip
  const pickFreeWaterCoolerSpot = useCallback(
    (currentPatients: PatientEntity[], excludePatientId?: string) => {
      const busyIds = new Set(
        currentPatients
          .filter(
            (p) =>
              p.id !== excludePatientId &&
              (p.state === 'walking_to_water' || p.state === 'drinking_water') &&
              p.waterCoolerId
          )
          .map((p) => p.waterCoolerId!)
      );

      for (const item of clinic.placedItems) {
        if (item.catalogId !== 'water_cooler' || busyIds.has(item.instanceId)) continue;
        const room = clinic.rooms.find(
          (r) =>
            item.gridX >= r.minX - 0.05 &&
            item.gridX < r.maxX + 1 &&
            item.gridY >= r.minY - 0.05 &&
            item.gridY < r.maxY + 1
        );
        // Never send waiting patients outdoors or into treatment wings for a sip of water
        if (!room || !room.unlocked || room.specialty !== 'reception') continue;

        const pref =
          item.rotation === 0
            ? { dx: 0, dy: 0.68 }
            : item.rotation === 1
              ? { dx: -0.68, dy: 0 }
              : item.rotation === 2
                ? { dx: 0, dy: -0.68 }
                : { dx: 0.68, dy: 0 };

        const candidates = [
          pref,
          { dx: 0, dy: 0.68 },
          { dx: 0.68, dy: 0 },
          { dx: -0.68, dy: 0 },
          { dx: 0, dy: -0.68 },
        ];
        for (const c of candidates) {
          const tx = item.gridX + c.dx;
          const ty = item.gridY + c.dy;
          if (isTileWalkable(tx, ty, 0.22, obstacleBoxes)) {
            return {
              coolerId: item.instanceId,
              x: tx,
              y: ty,
              facingRad: Math.atan2(item.gridX - tx, item.gridY - ty),
            };
          }
        }
      }
      return null;
    },
    [clinic.placedItems, clinic.rooms, obstacleBoxes]
  );

  const getStationTargetPos = useCallback(
    (station: PlacedItem, fromTileX: number, fromTileY: number) => {
      const cat = catalogById.get(station.catalogId);
      if (!cat) return { x: station.gridX, y: station.gridY };
      return getStationApproachTarget(
        station,
        cat.sprite,
        cat.width,
        cat.depth,
        obstacleBoxes,
        fromTileX + 0.5,
        fromTileY + 0.5
      );
    },
    [catalogById, obstacleBoxes]
  );

  const isNearStation = useCallback(
    (station: PlacedItem, gx: number, gy: number) => {
      const cat = catalogById.get(station.catalogId);
      const w = cat ? (station.rotation % 2 === 0 ? cat.width : cat.depth) : 1;
      const d = cat ? (station.rotation % 2 === 0 ? cat.depth : cat.width) : 1;
      const cx = Math.max(station.gridX, Math.min(gx, station.gridX + w - 1));
      const cy = Math.max(station.gridY, Math.min(gy, station.gridY + d - 1));
      return Math.hypot(cx - gx, cy - gy) <= 1.2;
    },
    [catalogById]
  );

  // Build ONLY indoor waiting/reception chair slots inside Reception (never outdoor benches or treatment-room chairs)
  const getReceptionWaitSeatSlots = useCallback((): WaitSeatSlot[] => {
    const recRoom = clinic.rooms.find(
      (r) => r.unlocked && (r.id === 'room_reception' || r.specialty === 'reception')
    );
    if (!recRoom) return [];

    return buildWaitSeatSlots(clinic.placedItems, clinic.rooms, obstacleBoxes).filter((s) => {
      if (s.isOutdoor || s.catalogId === 'park_bench' || s.catalogId === 'doctor_stool') return false;
      const inReception =
        s.seatTileX >= recRoom.minX - 0.15 &&
        s.seatTileX <= recRoom.maxX + 0.45 &&
        s.seatTileY >= recRoom.minY - 0.15 &&
        s.seatTileY <= recRoom.maxY + 0.45 &&
        s.approachTileX >= recRoom.minX - 0.35 &&
        s.approachTileX <= recRoom.maxX + 0.35 &&
        s.approachTileY >= recRoom.minY - 0.35 &&
        s.approachTileY <= recRoom.maxY + 0.35;
      if (!inReception) return false;
      return isTileWalkable(s.approachTileX, s.approachTileY, 0.16, obstacleBoxes, s.itemId);
    });
  }, [clinic.placedItems, clinic.rooms, obstacleBoxes]);

  // Build indoor chair/stool slots inside unlocked treatment wings (patients sit here if a chair is placed!)
  const getTreatmentWaitSeatSlots = useCallback((): Array<WaitSeatSlot & { isPrimaryBay: boolean }> => {
    const unlockedTreatRooms = clinic.rooms.filter(
      (r) => r.unlocked && r.specialty !== 'reception'
    );
    if (unlockedTreatRooms.length === 0) return [];

    const out: Array<WaitSeatSlot & { isPrimaryBay: boolean }> = [];
    for (const s of buildWaitSeatSlots(clinic.placedItems, clinic.rooms, obstacleBoxes)) {
      if (s.isOutdoor || s.catalogId === 'park_bench') continue;
      const room = unlockedTreatRooms.find(
        (r) =>
          s.seatTileX >= r.minX - 0.15 &&
          s.seatTileX <= r.maxX + 0.45 &&
          s.seatTileY >= r.minY - 0.15 &&
          s.seatTileY <= r.maxY + 0.45 &&
          s.approachTileX >= r.minX - 0.35 &&
          s.approachTileX <= r.maxX + 0.35 &&
          s.approachTileY >= r.minY - 0.35 &&
          s.approachTileY <= r.maxY + 0.35
      );
      if (!room) continue;
      if (!isTileWalkable(s.approachTileX, s.approachTileY, 0.16, obstacleBoxes, s.itemId)) continue;
      out.push({
        ...s,
        isPrimaryBay: room.id === 'room_bay_1',
      });
    }
    return out;
  }, [clinic.placedItems, clinic.rooms, obstacleBoxes]);

  const getFreeTreatmentWaitSeats = useCallback(
    (
      fromX: number,
      fromY: number,
      currentPatients: PatientEntity[],
      excludePatientId?: string
    ): WaitSeatSlot[] => {
      const seats = getTreatmentWaitSeatSlots();
      if (seats.length === 0) return [];

      const claimedKeys = new Set<string>();
      for (const p of currentPatients) {
        if (p.id === excludePatientId) continue;
        if (p.state !== 'walking_to_treatment_wait' && p.state !== 'waiting_in_treatment') continue;
        if (p.isSeatedWait === false) continue;
        if (p.waitingSeatKey) claimedKeys.add(p.waitingSeatKey);
      }

      const freeSeats = seats.filter((s) => !claimedKeys.has(s.seatKey));
      freeSeats.sort((a, b) => {
        if (a.isPrimaryBay !== b.isPrimaryBay) return a.isPrimaryBay ? -1 : 1;
        const da = Math.hypot(a.approachTileX - fromX, a.approachTileY - fromY);
        const db = Math.hypot(b.approachTileX - fromX, b.approachTileY - fromY);
        return da - db;
      });
      return freeSeats;
    },
    [getTreatmentWaitSeatSlots]
  );

  // Pick free reception waiting seats sorted by distance (excluding outdoor benches & treatment wings)
  const getFreeReceptionWaitSeats = useCallback(
    (
      fromX: number,
      fromY: number,
      currentPatients: PatientEntity[],
      excludePatientId?: string
    ): WaitSeatSlot[] => {
      const seats = getReceptionWaitSeatSlots();
      if (seats.length === 0) return [];

      const claimedKeys = new Set<string>();
      for (const p of currentPatients) {
        if (p.id === excludePatientId) continue;
        if (p.state !== 'walking_to_wait' && p.state !== 'waiting_checkin') continue;
        if (p.isSeatedWait === false) continue;
        if (p.waitingSeatKey) claimedKeys.add(p.waitingSeatKey);
      }

      const freeSeats = seats.filter((s) => !claimedKeys.has(s.seatKey));
      freeSeats.sort((a, b) => {
        const da = Math.hypot(a.approachTileX - fromX, a.approachTileY - fromY);
        const db = Math.hypot(b.approachTileX - fromX, b.approachTileY - fromY);
        return da - db;
      });
      return freeSeats;
    },
    [getReceptionWaitSeatSlots]
  );

  // Receptionist seat & desk-front hub in tile coordinates (for spontaneous gathering & natural gaze)
  const getReceptionHubCoords = useCallback(() => {
    const desk = clinic.placedItems.find((it) => it.catalogId === 'reception_desk');
    if (desk) {
      const pose = getReceptionDeskPose(desk);
      return {
        recTileX: pose.seatTileX - 0.5,
        recTileY: pose.seatTileY - 0.5,
        frontTileX: pose.deskFrontWorldX - 0.5,
        frontTileY: pose.deskFrontWorldZ - 0.5,
      };
    }
    return {
      recTileX: 14.5,
      recTileY: 11.7,
      frontTileX: 14.5,
      frontTileY: 13.4,
    };
  }, [clinic.placedItems]);

  // Natural standing gaze: mostly faces the receptionist/desk, occasionally chats/glances toward a nearby patient or lobby
  const pickSpontaneousStandingHeading = useCallback(
    (
      x: number,
      y: number,
      currentPatients: PatientEntity[],
      excludePatientId?: string
    ): number => {
      const { recTileX, recTileY } = getReceptionHubCoords();
      const roll = Math.random();
      if (roll < 0.26) {
        const nearby = currentPatients.filter(
          (pt) =>
            pt.id !== excludePatientId &&
            pt.state !== 'treated_leaving' &&
            (pt.state === 'waiting_checkin' || pt.state === 'walking_to_wait') &&
            Math.hypot(pt.gridX - x, pt.gridY - y) >= 0.75 &&
            Math.hypot(pt.gridX - x, pt.gridY - y) <= 2.6
        );
        if (nearby.length > 0) {
          const peer = nearby[Math.floor(Math.random() * nearby.length)];
          return Math.atan2(peer.gridX - x, peer.gridY - y) + (Math.random() - 0.5) * 0.42;
        }
      }
      if (roll < 0.86) {
        return Math.atan2(recTileX - x, recTileY - y) + (Math.random() - 0.5) * 0.78;
      }
      return Math.atan2(15.2 - x, 15.0 - y) + (Math.random() - 0.5) * 1.65;
    },
    [getReceptionHubCoords]
  );

  // Pick an open non-colliding standing waiting spot clustered organically around the receptionist/desk when chairs are full
  const findStandingWaitSpot = useCallback(
    (currentPatients: PatientEntity[], excludePatientId?: string) => {
      const recRoom = clinic.rooms.find(
        (r) => r.unlocked && (r.id === 'room_reception' || r.specialty === 'reception')
      );
      const minX = (recRoom?.minX ?? 12) + 0.85;
      const maxX = (recRoom?.maxX ?? 21) - 1.35; // Keep well inside away from exterior door x=21..22
      const minY = (recRoom?.minY ?? 10) + 1.85;
      const maxY = (recRoom?.maxY ?? 21) - 1.05;

      const { recTileX, recTileY, frontTileX, frontTileY } = getReceptionHubCoords();
      const seatSlots = getReceptionWaitSeatSlots();

      const rawCandidates: Array<{ x: number; y: number; distToHub: number }> = [];
      for (let x = minX; x <= maxX; x += 0.72) {
        for (let y = minY; y <= maxY; y += 0.72) {
          const jx = x + (Math.random() - 0.5) * 0.34;
          const jy = y + (Math.random() - 0.5) * 0.34;
          // Keep doorway threshold corridors clear (east main door, west wing door, north wing door)
          if (jx > maxX - 0.55 && jy >= 13.0 && jy <= 16.6) continue;
          if (jx <= (recRoom?.minX ?? 12) + 1.15 && jy >= 13.1 && jy <= 15.7) continue;
          if (jy <= (recRoom?.minY ?? 10) + 1.45 && jx >= 15.1 && jx <= 17.4) continue;
          // Keep receptionist seat / cabinet corridor unobstructed
          if (Math.hypot(jx - recTileX, jy - recTileY) < 1.05) continue;
          // Keep waiting chair approaches clear so seated transitions never jam
          if (
            seatSlots.some(
              (s) => Math.hypot(jx - s.approachTileX, jy - s.approachTileY) < 0.58
            )
          ) {
            continue;
          }
          if (!isTileWalkable(jx, jy, 0.24, obstacleBoxes)) continue;
          const dHub = Math.hypot(jx - frontTileX, jy - frontTileY);
          rawCandidates.push({ x: jx, y: jy, distToHub: dHub });
        }
      }

      const pickWithSeparation = (minSep: number) => {
        const free = rawCandidates.filter(
          (cand) =>
            !currentPatients.some((pt) => {
              if (pt.id === excludePatientId || pt.state === 'treated_leaving') return false;
              const distNow = Math.hypot(pt.gridX - cand.x, pt.gridY - cand.y);
              const distTarget = Math.hypot(pt.targetX - cand.x, pt.targetY - cand.y);
              return distNow < minSep || distTarget < minSep;
            })
        );
        if (free.length === 0) return null;

        // Gather naturally around the receptionist/desk (sweet spot ~1.1m..3.4m around front/side of desk)
        const scored = free.map((c) => {
          const ringBias =
            c.distToHub < 1.05
              ? (1.05 - c.distToHub) * 2.2
              : c.distToHub <= 3.35
                ? c.distToHub * 0.45
                : 1.5 + (c.distToHub - 3.35) * 1.15;
          return {
            ...c,
            score: ringBias + Math.random() * 1.35,
          };
        });
        scored.sort((a, b) => a.score - b.score);
        const topSlice = scored.slice(0, Math.min(6, scored.length));
        return topSlice[Math.floor(Math.random() * topSlice.length)];
      };

      const chosen = pickWithSeparation(0.72) || pickWithSeparation(0.56);
      if (chosen) {
        return { x: chosen.x, y: chosen.y };
      }
      return {
        x: Math.min(maxX, Math.max(minX, frontTileX + (Math.random() - 0.5) * 2.2)),
        y: Math.min(maxY, Math.max(minY, frontTileY + 1.2 + Math.random() * 1.6)),
      };
    },
    [clinic.rooms, obstacleBoxes, getReceptionHubCoords, getReceptionWaitSeatSlots]
  );

  // Pick a clean open standing spot inside the primary treatment wing when no chair is placed there
  const findTreatmentStandingSpot = useCallback(
    (currentPatients: PatientEntity[], excludePatientId?: string) => {
      const bayRoom =
        clinic.rooms.find((r) => r.unlocked && r.id === 'room_bay_1') ||
        clinic.rooms.find((r) => r.unlocked && r.specialty !== 'reception');
      const minX = (bayRoom?.minX ?? 2) + 1.05;
      const maxX = (bayRoom?.maxX ?? 11) - 0.95;
      const minY = (bayRoom?.minY ?? 10) + 1.15;
      const maxY = (bayRoom?.maxY ?? 21) - 0.95;
      const seatSlots = getTreatmentWaitSeatSlots();

      const stationCenters: Array<{ x: number; y: number }> = [];
      for (const it of clinic.placedItems) {
        const cat = catalogById.get(it.catalogId);
        if (!cat?.isTreatmentStation || !ASSIGNABLE_STATION_SPRITES.has(cat.sprite)) continue;
        const w = it.rotation % 2 === 0 ? cat.width : cat.depth;
        const d = it.rotation % 2 === 0 ? cat.depth : cat.width;
        stationCenters.push({ x: it.gridX + (w - 1) * 0.5, y: it.gridY + (d - 1) * 0.5 });
      }

      const rawCandidates: Array<{ x: number; y: number; score: number }> = [];
      for (let x = minX; x <= maxX; x += 0.65) {
        for (let y = minY; y <= maxY; y += 0.65) {
          // Keep doorway thresholds completely clear (door_reception_bay x~11.5,y~14..15 & door_bay_west x~6..7,y~9.5)
          if (Math.hypot(x - 11.5, y - 14.2) < 1.25) continue;
          if (Math.hypot(x - 6.2, y - 9.5) < 1.25) continue;
          if (seatSlots.some((s) => Math.hypot(x - s.approachTileX, y - s.approachTileY) < 0.68)) {
            continue;
          }
          if (!isTileWalkable(x, y, 0.24, obstacleBoxes)) continue;

          // Prefer an open staging spot near the inner east/center of the treatment hall away from active beds
          let minStationDist = Infinity;
          for (const sc of stationCenters) {
            const sd = Math.hypot(x - sc.x, y - sc.y);
            if (sd < minStationDist) minStationDist = sd;
          }
          const nearDoorBonus = Math.hypot(x - 8.6, y - 15.2) * 0.35;
          const stationCrowdPenalty = minStationDist < 1.35 ? (1.35 - minStationDist) * 3.0 : 0;
          rawCandidates.push({
            x,
            y,
            score: nearDoorBonus + stationCrowdPenalty,
          });
        }
      }

      const pickWithSeparation = (minSep: number) => {
        const free = rawCandidates.filter(
          (cand) =>
            !currentPatients.some((pt) => {
              if (pt.id === excludePatientId || pt.state === 'treated_leaving') return false;
              const distNow = Math.hypot(pt.gridX - cand.x, pt.gridY - cand.y);
              const distTarget = Math.hypot(pt.targetX - cand.x, pt.targetY - cand.y);
              return distNow < minSep || distTarget < minSep;
            })
        );
        if (free.length === 0) return null;
        const sorted = [...free].sort((a, b) => a.score - b.score);
        const top = sorted.slice(0, Math.min(4, sorted.length));
        return top[Math.floor(Math.random() * top.length)];
      };

      const chosen = pickWithSeparation(0.75) || pickWithSeparation(0.55);
      if (chosen) {
        return { x: chosen.x, y: chosen.y };
      }
      return findNearestWalkableTile(8.6, 15.2, 0.23, obstacleBoxes);
    },
    [clinic.rooms, clinic.placedItems, catalogById, obstacleBoxes, getTreatmentWaitSeatSlots]
  );

  useEffect(() => {
    activePatientCountRef.current = patients.filter(
      (p) => p.state !== 'treated_leaving'
    ).length;
  }, [patients]);

  // Patient Spawner: admits up to 4 patients at a time to protect performance, cycling through all 20 cases as each finishes
  useEffect(() => {
    if (!hydrated || visitingFriend || isFppSessionActive) return;

    let cancelled = false;
    let spawnTimer: ReturnType<typeof setTimeout> | null = null;
    const MAX_CONCURRENT_PATIENTS = 4;

    const spawnCheck = () => {
      setPatients((prev) => {
        const activeCount = prev.filter((p) => p.state !== 'treated_leaving').length;
        if (activeCount >= MAX_CONCURRENT_PATIENTS || prev.length >= MAX_CONCURRENT_PATIENTS + 1) {
          return prev;
        }

        const isFirstEntry = clinic.patientsTreatedTotal === 0 && prev.length === 0;
        const shouldUseRealisticFirst =
          isFirstEntry ||
          (!sessionSpawnedRealisticRef.current &&
            prev.length === 0 &&
            !prev.some((p) => p.modelKey === 'char_patient_realistic_1'));
        const shouldUseSudaneseFirst =
          !shouldUseRealisticFirst &&
          !sessionSpawnedSudaneseRef.current &&
          !prev.some((p) => p.modelKey === 'char_sudanese_man_1');
        if (shouldUseRealisticFirst) {
          sessionSpawnedRealisticRef.current = true;
        }
        if (shouldUseSudaneseFirst) {
          sessionSpawnedSudaneseRef.current = true;
        }

        const activeBaseIds = new Set(
          prev.map((p) => p.clinicalCase.id.replace(/_\d+$/, ''))
        );
        let unseenPool = FALLBACK_CLINICAL_CASES.filter(
          (c) => !activeBaseIds.has(c.id) && !servedCaseIdsRef.current.has(c.id)
        );
        if (unseenPool.length === 0) {
          servedCaseIdsRef.current = new Set(activeBaseIds);
          unseenPool = FALLBACK_CLINICAL_CASES.filter((c) => !activeBaseIds.has(c.id));
        }
        const casePool = unseenPool.length > 0 ? unseenPool : FALLBACK_CLINICAL_CASES;
        const sudanesePreferredCase =
          casePool.find(
            (c) =>
              c.gender === 'male' &&
              (c.id === 'case_knee_oa_elder' ||
                c.id === 'case_stroke_gait_neuro' ||
                c.id === 'case_lumbar_disc' ||
                c.age >= 36)
          ) ||
          casePool.find((c) => c.gender === 'male') ||
          casePool[0];
        const fallbackCase = shouldUseRealisticFirst
          ? casePool[0]
          : shouldUseSudaneseFirst
            ? sudanesePreferredCase
            : casePool[Math.floor(Math.random() * casePool.length)];
        servedCaseIdsRef.current.add(fallbackCase.id);
        const chosenCase = { ...fallbackCase, id: fallbackCase.id + '_' + Date.now() };
        const isFemale = chosenCase.gender === 'female';

        // Pick base GLB intelligently across existing models so concurrent patients never look identical
        let chosenModelKey: string | undefined;
        if (!isFemale) {
          if (shouldUseRealisticFirst) {
            chosenModelKey = 'char_patient_realistic_1';
          } else if (shouldUseSudaneseFirst) {
            chosenModelKey = 'char_sudanese_man_1';
          } else if (chosenCase.age < 15) {
            chosenModelKey = undefined; // youth uses man_casual2 stylized rig cleanly at heightScale 0.78
          } else {
            const countModel = (k: string | undefined) =>
              prev.filter((p) => p.clinicalCase.gender === 'male' && p.modelKey === k).length;
            const candidates: Array<string | undefined> =
              chosenCase.age >= 36
                ? ['char_sudanese_man_1', 'char_patient_realistic_1', undefined]
                : ['char_patient_realistic_1', 'char_sudanese_man_1', undefined];
            candidates.sort((a, b) => countModel(a) - countModel(b));
            chosenModelKey = candidates[0];
          }
        }
        const useRealisticModel = chosenModelKey === 'char_patient_realistic_1';
        const useSudaneseRealisticModel = chosenModelKey === 'char_sudanese_man_1';

        const skin = useRealisticModel
          ? SUDANESE_SKINS[Math.floor(Math.random() * Math.min(5, SUDANESE_SKINS.length))]
          : SUDANESE_SKINS[Math.floor(Math.random() * SUDANESE_SKINS.length)];

        const hairColor =
          chosenCase.age >= 54
            ? SENIOR_HAIR_TONES[Math.floor(Math.random() * SENIOR_HAIR_TONES.length)]
            : chosenCase.age >= 44 && Math.random() < 0.45
              ? '#4b5563'
              : YOUTH_HAIR_TONES[Math.floor(Math.random() * YOUTH_HAIR_TONES.length)];

        const receptionSpot = getReceptionCheckinSpot(prev);
        const startX = 27.85 + Math.random() * 0.95;
        const startY = 14.0 + Math.random() * 1.35;
        const path = findGridPath(
          startX,
          startY,
          receptionSpot.x,
          receptionSpot.y,
          clinic.rooms,
          clinic.placedItems,
          itemFootprints,
          obstacleBoxes
        );

        let outfitStyle: 'casual' | 'jalabiya' | 'abaya' | 'abaya_open' | 'dress' | 'sudanese_thobe' = 'casual';
        let shirtStyle: 'tshirt' | 'shirt' | undefined;
        const heightScale =
          chosenCase.age < 15 ? 0.78 : Number((0.95 + Math.random() * 0.11).toFixed(2));
        const buildScale =
          chosenCase.age < 15 ? 0.94 : Number((0.94 + Math.random() * 0.13).toFixed(2));
        let shirtColor = '#ece9e1';
        let pantsColor = '#1e293b';
        let hasHijab = false;
        let hasNiqab = false;
        let hasTurban = false;
        let headwearStyle: HeadwearStyle = 'none';
        let facialHairStyle: FacialHairStyle = 'none';

        const activeOutfits = new Set(
          prev.map((p) => `${p.modelKey || p.outfitStyle}_${p.shirtColor}_${p.pantsColor}_${p.headwearStyle || 'none'}`)
        );
        const pickDistinct = <T,>(items: T[], getKey: (x: T) => string): T => {
          const fresh = items.filter((item) => !activeOutfits.has(getKey(item)));
          const pool = fresh.length > 0 ? fresh : items;
          return pool[Math.floor(Math.random() * pool.length)];
        };

        if (useSudaneseRealisticModel) {
          const robeLook = pickDistinct(
            SUDANESE_ROBE_LOOKS,
            (l) => `char_sudanese_man_1_${l.robe}_${l.robe}_${l.headwear}`
          );
          outfitStyle = 'jalabiya';
          shirtColor = robeLook.robe;
          pantsColor = robeLook.robe;
          hasHijab = false;
          headwearStyle = shouldUseSudaneseFirst ? 'turban' : robeLook.headwear;
          hasTurban = headwearStyle === 'turban';
          facialHairStyle = 'full_beard';
        } else if (useRealisticModel) {
          outfitStyle = 'casual';
          shirtStyle = 'shirt';
          const realLook = shouldUseRealisticFirst
            ? REALISTIC_CASUAL_LOOKS[0]
            : pickDistinct(
                REALISTIC_CASUAL_LOOKS,
                (l) => `char_patient_realistic_1_${l.shirt}_${l.pants}_none`
              );
          shirtColor = realLook.shirt;
          pantsColor = realLook.pants;
          hasHijab = false;
          headwearStyle = !shouldUseRealisticFirst && chosenCase.age <= 34 && Math.random() < 0.35 ? 'cap' : 'none';
          hasTurban = false;
          facialHairStyle = 'none';
        } else if (isFemale) {
          hasHijab = true; // Women wear a Tarha/Hijab or Sudanese Thobe cleanly
          const thobeChance = chosenCase.age >= 48 ? 0.72 : chosenCase.age >= 28 ? 0.36 : 0.16;
          if (Math.random() < thobeChance) {
            outfitStyle = 'sudanese_thobe';
            const thobeLook = pickDistinct(
              FEMALE_SUDANESE_THOBE_LOOKS,
              (l) => `sudanese_thobe_${l.thobe}_${l.inner}_none`
            );
            shirtColor = thobeLook.thobe;
            pantsColor = thobeLook.inner;
          } else {
            const roll = Math.random();
            if (roll < 0.34) {
              outfitStyle = 'abaya';
              shirtColor = pickDistinct(FEMALE_ABAYA_COLORS, (c) => `abaya_${c}_${c}_none`);
              pantsColor = shirtColor;
            } else if (roll < 0.64) {
              outfitStyle = 'abaya_open';
              const openLook = pickDistinct(
                FEMALE_OPEN_ABAYA_LOOKS,
                (l) => `abaya_open_${l.outer}_${l.inner}_none`
              );
              shirtColor = openLook.outer;
              pantsColor = openLook.inner;
            } else if (roll < 0.82) {
              outfitStyle = 'dress';
              shirtColor = pickDistinct(FEMALE_DRESS_COLORS, (c) => `dress_${c}_${c}_none`);
              pantsColor = shirtColor;
            } else {
              outfitStyle = 'casual';
              const c = pickDistinct(FEMALE_CASUAL_LOOKS, (l) => `casual_${l.shirt}_${l.pants}_none`);
              shirtColor = c.shirt;
              pantsColor = c.pants;
            }
          }
        } else {
          // Stylized men: mix trousers + t-shirt/shirt, athletic cap, or Jalabiya with taqiyah/turban
          const jalabiyaChance = chosenCase.age < 15 ? 0 : chosenCase.age >= 40 ? 0.52 : 0.14;
          const wearJalabiya = Math.random() < jalabiyaChance;
          outfitStyle = wearJalabiya ? 'jalabiya' : 'casual';
          if (wearJalabiya) {
            const jTones = ['#f8fafc', '#efe2c9', '#dbe8f4', '#dce6db', '#e6d3b3', '#e2e8f0'];
            shirtColor = pickDistinct(jTones, (c) => `jalabiya_${c}_${c}_turban`);
            pantsColor = shirtColor;
            headwearStyle = chosenCase.age >= 45 || Math.random() < 0.6 ? 'turban' : 'taqiyah';
            hasTurban = headwearStyle === 'turban';
          } else {
            const c = pickDistinct(MALE_CASUAL_LOOKS, (l) => `casual_${l.shirt}_${l.pants}_none`);
            shirtColor = c.shirt;
            pantsColor = c.pants;
            shirtStyle = c.shirtStyle;
            if (c.shirtStyle === 'tshirt' && Math.random() < 0.42) {
              headwearStyle = 'cap';
            }
          }
          if (chosenCase.age >= 18) {
            const fhChoices: FacialHairStyle[] =
              chosenCase.age >= 45
                ? ['full_beard', 'mustache', 'goatee', 'none']
                : ['goatee', 'mustache', 'none', 'full_beard'];
            facialHairStyle = fhChoices[Math.floor(Math.random() * fhChoices.length)];
          }
        }

        // Assign distinct eyewear style (~42% of adult patients, prioritizing unused shapes)
        let eyewearStyle: EyewearStyle = 'none';
        let eyewearColor: string | undefined;
        if (chosenCase.age >= 18) {
          const glassesChance = chosenCase.age >= 42 ? 0.52 : 0.36;
          if (Math.random() < glassesChance) {
            const usedEyewear = new Set(prev.map((p) => p.eyewearStyle).filter(Boolean));
            const availEye = EYEWEAR_VARIETY.filter((e) => !usedEyewear.has(e));
            const eyePool = availEye.length > 0 ? availEye : EYEWEAR_VARIETY;
            eyewearStyle = eyePool[Math.floor(Math.random() * eyePool.length)];
            eyewearColor = EYEWEAR_FRAME_PALETTE[Math.floor(Math.random() * EYEWEAR_FRAME_PALETTE.length)];
          }
        }

        const newPatient: PatientEntity = {
          id: isFirstEntry
            ? 'pat_' + Date.now() + '_a3'
            : 'pat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
          gridX: startX,
          gridY: startY,
          targetX: receptionSpot.x,
          targetY: receptionSpot.y,
          path,
          walkPhase: 0,
          facing: 2,
          skinTone: skin,
          hairColor,
          shirtColor,
          pantsColor,
          hasHijab,
          hasNiqab,
          hasTurban,
          outfitStyle,
          shirtStyle,
          heightScale,
          buildScale,
          eyewearStyle,
          eyewearColor,
          facialHairStyle,
          headwearStyle,
          orthosisType: chosenCase.orthosisType ?? 'none',
          hasBeard: facialHairStyle === 'full_beard',
          state: 'arriving',
          assignedStationId: null,
          waitTimer: 0,
          clinicalCase: chosenCase,
          isAiGenerated: false,
          modelKey: chosenModelKey,
        };
        return [...prev, newPatient];
      });
    };

    const scheduleNext = (delayMs: number) => {
      if (cancelled) return;
      spawnTimer = setTimeout(() => {
        if (cancelled) return;
        spawnCheck();
        const curActive = activePatientCountRef.current;
        const nextDelay =
          curActive < MAX_CONCURRENT_PATIENTS
            ? 1400 + Math.random() * 1100
            : 2200 + Math.random() * 1400;
        scheduleNext(nextDelay);
      }, delayMs);
    };

    scheduleNext(900);
    return () => {
      cancelled = true;
      if (spawnTimer) clearTimeout(spawnTimer);
    };
  }, [
    hydrated,
    visitingFriend,
    isFppSessionActive,
    clinic.placedItems,
    clinic.rooms,
    clinic.patientsTreatedTotal,
    itemFootprints,
    obstacleBoxes,
    getReceptionCheckinSpot,
  ]);

  // Helper: computes obstacle-respecting path from any patient position (stepping cleanly off seats/beds first!)
  const buildPatientPath = useCallback(
    (
      patient: PatientEntity,
      goalX: number,
      goalY: number,
      ignoreGoalItemId?: string
    ): Array<{ x: number; y: number }> => {
      let sx = patient.gridX;
      let sy = patient.gridY;
      const prefix: Array<{ x: number; y: number }> = [];

      // If starting seated on a chair or standing inside a displaced furniture footprint, step out cleanly first
      if (!isTileWalkable(sx, sy, 0.21, obstacleBoxes)) {
        const stepOut =
          patient.seatApproachX !== undefined &&
          patient.seatApproachY !== undefined &&
          isTileWalkable(patient.seatApproachX, patient.seatApproachY, 0.21, obstacleBoxes)
            ? { x: patient.seatApproachX, y: patient.seatApproachY }
            : findNearestWalkableTile(sx, sy, 0.22, obstacleBoxes);
        if (Math.hypot(stepOut.x - sx, stepOut.y - sy) > 0.08) {
          prefix.push(stepOut);
          sx = stepOut.x;
          sy = stepOut.y;
        }
      }

      const mainPath = findGridPath(
        sx,
        sy,
        goalX,
        goalY,
        clinic.rooms,
        clinic.placedItems,
        itemFootprints,
        obstacleBoxes,
        ignoreGoalItemId
      );
      return [...prefix, ...mainPath];
    },
    [clinic.rooms, clinic.placedItems, itemFootprints, obstacleBoxes]
  );

  const buildPathToWaitSeat = useCallback(
    (patient: PatientEntity, seat: WaitSeatSlot): Array<{ x: number; y: number }> => {
      const toFront = buildPatientPath(patient, seat.approachTileX, seat.approachTileY);
      const lastApp =
        toFront.length > 0
          ? toFront[toFront.length - 1]
          : { x: patient.gridX, y: patient.gridY };
      if (Math.hypot(lastApp.x - seat.approachTileX, lastApp.y - seat.approachTileY) > 0.78) {
        return [];
      }
      return [...toFront, { x: seat.seatTileX, y: seat.seatTileY }];
    },
    [buildPatientPath]
  );

  // Pick the nearest free reception chair with a verified complete indoor path (falling back across remaining free seats if one is blocked)
  const pickReachableFreeWaitingSeat = useCallback(
    (
      patient: PatientEntity,
      fromX: number,
      fromY: number,
      currentPatients: PatientEntity[],
      excludePatientId?: string
    ): { seat: WaitSeatSlot; path: Array<{ x: number; y: number }> } | null => {
      const candidates = getFreeReceptionWaitSeats(fromX, fromY, currentPatients, excludePatientId);
      for (const seat of candidates) {
        const path = buildPathToWaitSeat(patient, seat);
        if (path.length > 0) {
          return { seat, path };
        }
      }
      return null;
    },
    [getFreeReceptionWaitSeats, buildPathToWaitSeat]
  );

  // Pick the nearest free chair inside an unlocked treatment wing with a verified indoor path
  const pickReachableFreeTreatmentSeat = useCallback(
    (
      patient: PatientEntity,
      fromX: number,
      fromY: number,
      currentPatients: PatientEntity[],
      excludePatientId?: string
    ): { seat: WaitSeatSlot; path: Array<{ x: number; y: number }> } | null => {
      const candidates = getFreeTreatmentWaitSeats(fromX, fromY, currentPatients, excludePatientId);
      for (const seat of candidates) {
        const path = buildPathToWaitSeat(patient, seat);
        if (path.length > 0) {
          return { seat, path };
        }
      }
      return null;
    },
    [getFreeTreatmentWaitSeats, buildPathToWaitSeat]
  );

  const walkableLayoutSig = useMemo(() => {
    const rmSig = clinic.rooms.map((r) => (r.unlocked ? r.id : '')).join(',');
    const itemSig = clinic.placedItems
      .map((i) => `${i.instanceId}@${i.gridX},${i.gridY},${i.rotation}`)
      .join(';');
    const treeSig = (clinic.removedTreeIds || EMPTY_REMOVED_TREES).join(',');
    return `${rmSig}|${itemSig}|${treeSig}`;
  }, [clinic.rooms, clinic.placedItems, clinic.removedTreeIds]);
  const lastRerouteLayoutSigRef = useRef<string>('');

  // Immediately re-route & re-validate seats/stations ONLY when walkable geometry actually changes
  useEffect(() => {
    if (!hydrated || visitingFriend || isFppSessionActive) return;
    if (lastRerouteLayoutSigRef.current === walkableLayoutSig) return;
    lastRerouteLayoutSigRef.current = walkableLayoutSig;

    setPatients((prev) => {
      if (prev.length === 0) return prev;
      const receptionSeats = getReceptionWaitSeatSlots();
      const seatByKey = new Map(receptionSeats.map((s) => [s.seatKey, s]));
      const treatmentSeats = getTreatmentWaitSeatSlots();
      const treatmentSeatByKey = new Map(treatmentSeats.map((s) => [s.seatKey, s]));
      let anyChanged = false;
      const updatedList: PatientEntity[] = [];

      for (let i = 0; i < prev.length; i++) {
        const p = prev[i];

        if (p.state === 'arriving') {
          const up = { ...p };
          const claimedSoFar = [...updatedList, ...prev.slice(i + 1)];
          const spot = getReceptionCheckinSpot(claimedSoFar);
          const safePos = findNearestWalkableTile(up.gridX, up.gridY, 0.21, obstacleBoxes);
          if (Math.hypot(safePos.x - up.gridX, safePos.y - up.gridY) > 0.02) {
            up.gridX = safePos.x;
            up.gridY = safePos.y;
          }
          up.targetX = spot.x;
          up.targetY = spot.y;
          up.blockedTicks = 0;
          up.path = buildPatientPath(up, spot.x, spot.y);
          anyChanged = true;
          updatedList.push(up);
        } else if (p.state === 'walking_to_water') {
          const up = { ...p };
          const claimedSoFar = [...updatedList, ...prev.slice(i + 1)];
          const cooler = up.waterCoolerId
            ? clinic.placedItems.find((it) => it.instanceId === up.waterCoolerId)
            : undefined;
          const coolerRoom = cooler
            ? clinic.rooms.find(
                (r) =>
                  cooler.gridX >= r.minX - 0.05 &&
                  cooler.gridX < r.maxX + 1 &&
                  cooler.gridY >= r.minY - 0.05 &&
                  cooler.gridY < r.maxY + 1
              )
            : undefined;
          if (!cooler || !coolerRoom || !coolerRoom.unlocked || coolerRoom.specialty !== 'reception') {
            const altCooler = pickFreeWaterCoolerSpot(claimedSoFar, up.id);
            if (altCooler) {
              up.waterCoolerId = altCooler.coolerId;
              up.targetX = altCooler.x;
              up.targetY = altCooler.y;
              up.headingRad = altCooler.facingRad;
              up.path = buildPatientPath(up, altCooler.x, altCooler.y);
            } else {
              const reachable = pickReachableFreeWaitingSeat(
                up,
                up.gridX,
                up.gridY,
                claimedSoFar,
                up.id
              );
              up.state = 'walking_to_wait';
              up.waterCoolerId = undefined;
              if (reachable) {
                up.isSeatedWait = true;
                up.waitingSeatKey = reachable.seat.seatKey;
                up.seatHeight = reachable.seat.seatHeight;
                up.targetX = reachable.seat.seatTileX;
                up.targetY = reachable.seat.seatTileY;
                up.seatApproachX = reachable.seat.approachTileX;
                up.seatApproachY = reachable.seat.approachTileY;
                up.seatOffsetX = 0;
                up.seatOffsetZ = 0;
                up.seatFacingRad = reachable.seat.facingRad;
                up.path = reachable.path;
              } else {
                const stand = findStandingWaitSpot(claimedSoFar, up.id);
                up.isSeatedWait = false;
                up.waitingSeatKey = undefined;
                up.targetX = stand.x;
                up.targetY = stand.y;
                up.path = buildPatientPath(up, stand.x, stand.y);
              }
            }
          } else {
            up.path = buildPatientPath(up, up.targetX, up.targetY);
          }
          up.blockedTicks = 0;
          anyChanged = true;
          updatedList.push(up);
        } else if (
          (p.state === 'walking_to_wait' || p.state === 'waiting_checkin') &&
          p.isSeatedWait !== false
        ) {
          const matchedSeat = p.waitingSeatKey ? seatByKey.get(p.waitingSeatKey) : undefined;
          const stillSameSpot =
            matchedSeat &&
            Math.hypot(matchedSeat.seatTileX - p.targetX, matchedSeat.seatTileY - p.targetY) < 0.08 &&
            p.gridX < 21.3;

          if (stillSameSpot && matchedSeat) {
            if (p.state === 'walking_to_wait') {
              const up = { ...p };
              const nextSeatPath = buildPathToWaitSeat(up, matchedSeat);
              if (nextSeatPath.length > 0) {
                up.path = nextSeatPath;
                up.blockedTicks = 0;
                anyChanged = true;
              } else {
                const claimedSoFar = [...updatedList, ...prev.slice(i + 1)];
                const alt = pickReachableFreeWaitingSeat(
                  up,
                  up.gridX,
                  up.gridY,
                  claimedSoFar,
                  up.id
                );
                if (alt) {
                  up.isSeatedWait = true;
                  up.waitingSeatKey = alt.seat.seatKey;
                  up.seatHeight = alt.seat.seatHeight;
                  up.targetX = alt.seat.seatTileX;
                  up.targetY = alt.seat.seatTileY;
                  up.seatApproachX = alt.seat.approachTileX;
                  up.seatApproachY = alt.seat.approachTileY;
                  up.seatOffsetX = 0;
                  up.seatOffsetZ = 0;
                  up.seatFacingRad = alt.seat.facingRad;
                  up.path = alt.path;
                } else {
                  const stand = findStandingWaitSpot(claimedSoFar, up.id);
                  up.isSeatedWait = false;
                  up.waitingSeatKey = undefined;
                  up.seatHeight = undefined;
                  up.seatApproachX = undefined;
                  up.seatApproachY = undefined;
                  up.seatOffsetX = undefined;
                  up.seatOffsetZ = undefined;
                  up.seatFacingRad = undefined;
                  up.targetX = stand.x;
                  up.targetY = stand.y;
                  up.path = buildPatientPath(up, stand.x, stand.y);
                }
                up.blockedTicks = 0;
                anyChanged = true;
              }
              updatedList.push(up);
            } else {
              updatedList.push(p);
            }
          } else {
            const up = { ...p };
            const claimedSoFar = [...updatedList, ...prev.slice(i + 1)];
            // Chair was moved/sold/blocked or outside Reception: stand up smoothly and pick nearest Reception seat/spot
            const clearPos = findNearestWalkableTile(up.gridX, up.gridY, 0.21, obstacleBoxes);
            up.gridX = clearPos.x;
            up.gridY = clearPos.y;
            const reachable = pickReachableFreeWaitingSeat(
              up,
              up.gridX,
              up.gridY,
              claimedSoFar,
              up.id
            );
            up.state = 'walking_to_wait';
            up.blockedTicks = 0;
            if (reachable) {
              up.isSeatedWait = true;
              up.waitingSeatKey = reachable.seat.seatKey;
              up.seatHeight = reachable.seat.seatHeight;
              up.targetX = reachable.seat.seatTileX;
              up.targetY = reachable.seat.seatTileY;
              up.seatApproachX = reachable.seat.approachTileX;
              up.seatApproachY = reachable.seat.approachTileY;
              up.seatOffsetX = 0;
              up.seatOffsetZ = 0;
              up.seatFacingRad = reachable.seat.facingRad;
              up.path = reachable.path;
            } else {
              const stand = findStandingWaitSpot(claimedSoFar, up.id);
              up.isSeatedWait = false;
              up.waitingSeatKey = undefined;
              up.seatHeight = undefined;
              up.seatApproachX = undefined;
              up.seatApproachY = undefined;
              up.seatOffsetX = undefined;
              up.seatOffsetZ = undefined;
              up.seatFacingRad = undefined;
              up.targetX = stand.x;
              up.targetY = stand.y;
              up.path = buildPatientPath(up, stand.x, stand.y);
            }
            anyChanged = true;
            updatedList.push(up);
          }
        } else if (
          (p.state === 'walking_to_wait' || p.state === 'waiting_checkin') &&
          p.isSeatedWait === false
        ) {
          const up = { ...p };
          const claimedSoFar = [...updatedList, ...prev.slice(i + 1)];
          const safePos = findNearestWalkableTile(up.gridX, up.gridY, 0.21, obstacleBoxes);
          up.gridX = safePos.x;
          up.gridY = safePos.y;
          const reachable = pickReachableFreeWaitingSeat(
            up,
            up.gridX,
            up.gridY,
            claimedSoFar,
            up.id
          );
          if (reachable) {
            up.state = 'walking_to_wait';
            up.isSeatedWait = true;
            up.waitingSeatKey = reachable.seat.seatKey;
            up.seatHeight = reachable.seat.seatHeight;
            up.targetX = reachable.seat.seatTileX;
            up.targetY = reachable.seat.seatTileY;
            up.seatApproachX = reachable.seat.approachTileX;
            up.seatApproachY = reachable.seat.approachTileY;
            up.seatOffsetX = 0;
            up.seatOffsetZ = 0;
            up.seatFacingRad = reachable.seat.facingRad;
            up.path = reachable.path;
            up.blockedTicks = 0;
            anyChanged = true;
            updatedList.push(up);
          } else if (
            !isTileWalkable(up.targetX, up.targetY, 0.22, obstacleBoxes) ||
            up.targetX >= 20.5 ||
            up.gridX >= 20.5
          ) {
            const stand = findStandingWaitSpot(claimedSoFar, up.id);
            up.state = 'walking_to_wait';
            up.targetX = stand.x;
            up.targetY = stand.y;
            up.path = buildPatientPath(up, stand.x, stand.y);
            up.blockedTicks = 0;
            anyChanged = true;
            updatedList.push(up);
          } else {
            updatedList.push(p);
          }
        } else if (
          (p.state === 'walking_to_treatment_wait' || p.state === 'waiting_in_treatment') &&
          p.isSeatedWait !== false
        ) {
          const matchedSeat = p.waitingSeatKey ? treatmentSeatByKey.get(p.waitingSeatKey) : undefined;
          const stillSameSpot =
            matchedSeat &&
            Math.hypot(matchedSeat.seatTileX - p.targetX, matchedSeat.seatTileY - p.targetY) < 0.08;

          if (stillSameSpot && matchedSeat) {
            if (p.state === 'walking_to_treatment_wait') {
              const up = { ...p };
              const nextSeatPath = buildPathToWaitSeat(up, matchedSeat);
              if (nextSeatPath.length > 0) {
                up.path = nextSeatPath;
                up.blockedTicks = 0;
                anyChanged = true;
              } else {
                const claimedSoFar = [...updatedList, ...prev.slice(i + 1)];
                const alt = pickReachableFreeTreatmentSeat(
                  up,
                  up.gridX,
                  up.gridY,
                  claimedSoFar,
                  up.id
                );
                if (alt) {
                  up.isSeatedWait = true;
                  up.waitingSeatKey = alt.seat.seatKey;
                  up.seatHeight = alt.seat.seatHeight;
                  up.targetX = alt.seat.seatTileX;
                  up.targetY = alt.seat.seatTileY;
                  up.seatApproachX = alt.seat.approachTileX;
                  up.seatApproachY = alt.seat.approachTileY;
                  up.seatOffsetX = 0;
                  up.seatOffsetZ = 0;
                  up.seatFacingRad = alt.seat.facingRad;
                  up.path = alt.path;
                } else {
                  const stand = findTreatmentStandingSpot(claimedSoFar, up.id);
                  up.isSeatedWait = false;
                  up.waitingSeatKey = undefined;
                  up.seatHeight = undefined;
                  up.seatApproachX = undefined;
                  up.seatApproachY = undefined;
                  up.seatOffsetX = undefined;
                  up.seatOffsetZ = undefined;
                  up.seatFacingRad = undefined;
                  up.targetX = stand.x;
                  up.targetY = stand.y;
                  up.headingRad = -Math.PI / 2;
                  up.path = buildPatientPath(up, stand.x, stand.y);
                }
                up.blockedTicks = 0;
                anyChanged = true;
              }
              updatedList.push(up);
            } else {
              updatedList.push(p);
            }
          } else {
            const up = { ...p };
            const claimedSoFar = [...updatedList, ...prev.slice(i + 1)];
            const clearPos = findNearestWalkableTile(up.gridX, up.gridY, 0.21, obstacleBoxes);
            up.gridX = clearPos.x;
            up.gridY = clearPos.y;
            const reachable = pickReachableFreeTreatmentSeat(
              up,
              up.gridX,
              up.gridY,
              claimedSoFar,
              up.id
            );
            up.state = 'walking_to_treatment_wait';
            up.blockedTicks = 0;
            if (reachable) {
              up.isSeatedWait = true;
              up.waitingSeatKey = reachable.seat.seatKey;
              up.seatHeight = reachable.seat.seatHeight;
              up.targetX = reachable.seat.seatTileX;
              up.targetY = reachable.seat.seatTileY;
              up.seatApproachX = reachable.seat.approachTileX;
              up.seatApproachY = reachable.seat.approachTileY;
              up.seatOffsetX = 0;
              up.seatOffsetZ = 0;
              up.seatFacingRad = reachable.seat.facingRad;
              up.path = reachable.path;
            } else {
              const stand = findTreatmentStandingSpot(claimedSoFar, up.id);
              up.isSeatedWait = false;
              up.waitingSeatKey = undefined;
              up.seatHeight = undefined;
              up.seatApproachX = undefined;
              up.seatApproachY = undefined;
              up.seatOffsetX = undefined;
              up.seatOffsetZ = undefined;
              up.seatFacingRad = undefined;
              up.targetX = stand.x;
              up.targetY = stand.y;
              up.headingRad = -Math.PI / 2;
              up.path = buildPatientPath(up, stand.x, stand.y);
            }
            anyChanged = true;
            updatedList.push(up);
          }
        } else if (
          (p.state === 'walking_to_treatment_wait' || p.state === 'waiting_in_treatment') &&
          p.isSeatedWait === false
        ) {
          const up = { ...p };
          const claimedSoFar = [...updatedList, ...prev.slice(i + 1)];
          const safePos = findNearestWalkableTile(up.gridX, up.gridY, 0.21, obstacleBoxes);
          up.gridX = safePos.x;
          up.gridY = safePos.y;
          const reachable = pickReachableFreeTreatmentSeat(
            up,
            up.gridX,
            up.gridY,
            claimedSoFar,
            up.id
          );
          if (reachable) {
            up.state = 'walking_to_treatment_wait';
            up.isSeatedWait = true;
            up.waitingSeatKey = reachable.seat.seatKey;
            up.seatHeight = reachable.seat.seatHeight;
            up.targetX = reachable.seat.seatTileX;
            up.targetY = reachable.seat.seatTileY;
            up.seatApproachX = reachable.seat.approachTileX;
            up.seatApproachY = reachable.seat.approachTileY;
            up.seatOffsetX = 0;
            up.seatOffsetZ = 0;
            up.seatFacingRad = reachable.seat.facingRad;
            up.path = reachable.path;
            up.blockedTicks = 0;
            anyChanged = true;
            updatedList.push(up);
          } else if (
            !isTileWalkable(up.targetX, up.targetY, 0.22, obstacleBoxes) ||
            up.targetX >= 11.5 ||
            up.gridX >= 11.5
          ) {
            const stand = findTreatmentStandingSpot(claimedSoFar, up.id);
            up.state = 'walking_to_treatment_wait';
            up.targetX = stand.x;
            up.targetY = stand.y;
            up.headingRad = -Math.PI / 2;
            up.path = buildPatientPath(up, stand.x, stand.y);
            up.blockedTicks = 0;
            anyChanged = true;
            updatedList.push(up);
          } else {
            updatedList.push(p);
          }
        } else if (p.state === 'walking_to_station' || p.state === 'ready_for_exam') {
          const station = p.assignedStationId
            ? clinic.placedItems.find((it) => it.instanceId === p.assignedStationId)
            : undefined;
          if (station) {
            const stTarget = getStationTargetPos(station, p.gridX, p.gridY);
            const targetMoved = Math.hypot(stTarget.x - p.targetX, stTarget.y - p.targetY) > 0.28;
            if (targetMoved || p.state === 'walking_to_station') {
              const up = { ...p };
              if (up.state === 'ready_for_exam') {
                const safePos = findNearestWalkableTile(up.gridX, up.gridY, 0.21, obstacleBoxes);
                up.gridX = safePos.x;
                up.gridY = safePos.y;
                up.state = 'walking_to_station';
              }
              up.targetX = stTarget.x;
              up.targetY = stTarget.y;
              up.path = buildPatientPath(up, stTarget.x, stTarget.y, station.instanceId);
              up.blockedTicks = 0;
              anyChanged = true;
              updatedList.push(up);
            } else {
              updatedList.push(p);
            }
          } else {
            const up = { ...p };
            const claimedSoFar = [...updatedList, ...prev.slice(i + 1)];
            // Assigned station was sold: return patient to the treatment hall waiting seat/spot so the player can pick another station
            const clearPos = findNearestWalkableTile(up.gridX, up.gridY, 0.21, obstacleBoxes);
            up.gridX = clearPos.x;
            up.gridY = clearPos.y;
            up.assignedStationId = null;
            const reachable = pickReachableFreeTreatmentSeat(
              up,
              up.gridX,
              up.gridY,
              claimedSoFar,
              up.id
            );
            up.state = 'walking_to_treatment_wait';
            if (reachable) {
              up.isSeatedWait = true;
              up.waitingSeatKey = reachable.seat.seatKey;
              up.seatHeight = reachable.seat.seatHeight;
              up.targetX = reachable.seat.seatTileX;
              up.targetY = reachable.seat.seatTileY;
              up.seatApproachX = reachable.seat.approachTileX;
              up.seatApproachY = reachable.seat.approachTileY;
              up.seatOffsetX = 0;
              up.seatOffsetZ = 0;
              up.seatFacingRad = reachable.seat.facingRad;
              up.path = reachable.path;
            } else {
              const stand = findTreatmentStandingSpot(claimedSoFar, up.id);
              up.isSeatedWait = false;
              up.waitingSeatKey = undefined;
              up.seatHeight = undefined;
              up.seatApproachX = undefined;
              up.seatApproachY = undefined;
              up.seatOffsetX = undefined;
              up.seatOffsetZ = undefined;
              up.seatFacingRad = undefined;
              up.targetX = stand.x;
              up.targetY = stand.y;
              up.headingRad = -Math.PI / 2;
              up.path = buildPatientPath(up, stand.x, stand.y);
            }
            up.blockedTicks = 0;
            anyChanged = true;
            updatedList.push(up);
          }
        } else if (p.state === 'treated_leaving') {
          const up = { ...p };
          up.path = buildPatientPath(up, 32, 15, up.leavingItemId);
          up.blockedTicks = 0;
          anyChanged = true;
          updatedList.push(up);
        } else {
          updatedList.push(p);
        }
      }

      return anyChanged ? updatedList : prev;
    });
  }, [
    hydrated,
    visitingFriend,
    isFppSessionActive,
    walkableLayoutSig,
    obstacleBoxes,
    clinic.placedItems,
    clinic.rooms,
    buildPatientPath,
    buildPathToWaitSeat,
    getReceptionWaitSeatSlots,
    getTreatmentWaitSeatSlots,
    pickReachableFreeWaitingSeat,
    pickReachableFreeTreatmentSeat,
    getReceptionCheckinSpot,
    pickFreeWaterCoolerSpot,
    findStandingWaitSpot,
    findTreatmentStandingSpot,
    getStationTargetPos,
  ]);

  // Smooth dt-driven ~10Hz simulation tick (zero IndexedDB thrashing, brisk natural speed, optional water-cooler sips)
  useEffect(() => {
    if (!hydrated || visitingFriend || isFppSessionActive) return;

    const receptionistHired = clinic.staff.some((s) => s.role === 'receptionist' && s.hired);
    let lastTickMs = performance.now();

    const assignWaitingDestination = (
      updated: PatientEntity,
      claimedSoFar: PatientEntity[]
    ) => {
      const reachable = pickReachableFreeWaitingSeat(
        updated,
        updated.gridX,
        updated.gridY,
        claimedSoFar,
        updated.id
      );
      updated.state = 'walking_to_wait';
      updated.waitTimer = 0;
      updated.waterCoolerId = undefined;
      updated.blockedTicks = 0;

      if (reachable) {
        updated.isSeatedWait = true;
        updated.waitingSeatKey = reachable.seat.seatKey;
        updated.seatHeight = reachable.seat.seatHeight;
        updated.targetX = reachable.seat.seatTileX;
        updated.targetY = reachable.seat.seatTileY;
        updated.seatApproachX = reachable.seat.approachTileX;
        updated.seatApproachY = reachable.seat.approachTileY;
        updated.seatOffsetX = 0;
        updated.seatOffsetZ = 0;
        updated.seatFacingRad = reachable.seat.facingRad;
        updated.idleMoveTimer = undefined;
        updated.path = reachable.path;
      } else {
        const standSpot = findStandingWaitSpot(claimedSoFar, updated.id);
        updated.isSeatedWait = false;
        updated.waitingSeatKey = undefined;
        updated.seatHeight = undefined;
        updated.seatApproachX = undefined;
        updated.seatApproachY = undefined;
        updated.seatOffsetX = undefined;
        updated.seatOffsetZ = undefined;
        updated.seatFacingRad = undefined;
        updated.targetX = standSpot.x;
        updated.targetY = standSpot.y;
        updated.headingRad = pickSpontaneousStandingHeading(
          standSpot.x,
          standSpot.y,
          claimedSoFar,
          updated.id
        );
        updated.idleMoveTimer = 3600 + Math.random() * 3400;
        updated.path = buildPatientPath(updated, standSpot.x, standSpot.y);
      }
    };

    const isDoorwayThreshold = (nx: number, ny: number) =>
      Math.hypot(nx - 11.5, ny - 14) < 0.72 ||
      Math.hypot(nx - 6, ny - 9.5) < 0.72 ||
      Math.hypot(nx - 16, ny - 9.5) < 0.72 ||
      Math.hypot(nx - 11.5, ny - 5) < 0.72 ||
      Math.hypot(nx - 21.5, ny - 14.5) < 1.05;

    const hasReceptionDesk = clinic.placedItems.some((it) => it.catalogId === 'reception_desk');
    const hasFileCabinet = clinic.placedItems.some((it) => it.catalogId === 'file_cabinet');
    const placedItemById = new Map(clinic.placedItems.map((it) => [it.instanceId, it] as const));

    const standingIdleMap = new Map<string, number>();
    const seatedWaitAccumMap = new Map<string, number>();

    const tick = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const nowMs = performance.now();
      const dtSec = Math.min(0.28, Math.max(0.016, (nowMs - lastTickMs) / 1000));
      const dtMs = dtSec * 1000;
      lastTickMs = nowMs;

      setPatients((prev) => {
        if (prev.length === 0) return prev;
        let changed = false;
        const nextList: PatientEntity[] = [];

        for (let idx = 0; idx < prev.length; idx++) {
          const p = prev[idx];
          if (p.path.length === 0 && (p.state === 'ready_for_exam' || p.state === 'in_exam')) {
            nextList.push(p);
            continue;
          }
          if (
            p.path.length === 0 &&
            (p.state === 'waiting_checkin' || p.state === 'waiting_in_treatment') &&
            p.isSeatedWait !== false &&
            p.gridX < 20.8 &&
            p.targetX < 20.8
          ) {
            const accum = (seatedWaitAccumMap.get(p.id) ?? 0) + dtMs;
            if (accum < 1000) {
              seatedWaitAccumMap.set(p.id, accum);
              nextList.push(p);
              continue;
            }
            seatedWaitAccumMap.set(p.id, 0);
            changed = true;
            nextList.push({ ...p, waitTimer: p.waitTimer + accum });
            continue;
          }
          const updated = { ...p };
          const seatItemId = updated.waitingSeatKey
            ? updated.waitingSeatKey.slice(0, updated.waitingSeatKey.lastIndexOf('_'))
            : undefined;
          const targetItemId =
            updated.state === 'walking_to_wait' ||
            updated.state === 'waiting_checkin' ||
            updated.state === 'walking_to_treatment_wait' ||
            updated.state === 'waiting_in_treatment'
              ? seatItemId
              : updated.state === 'walking_to_station' ||
                  updated.state === 'ready_for_exam' ||
                  updated.state === 'in_treatment'
                ? updated.assignedStationId || undefined
                : updated.state === 'treated_leaving'
                  ? updated.leavingItemId || seatItemId || updated.assignedStationId || undefined
                  : undefined;

          if (updated.path.length > 0) {
            let activePath = updated.path;
            // Ignore target chair/bed ONLY when on the final short entry/exit segment
            const lastNode = activePath[activePath.length - 1];
            const nearFinalEntry =
              activePath.length <= 2 &&
              Math.hypot(lastNode.x - updated.gridX, lastNode.y - updated.gridY) < 1.65;
            const leavingStart =
              !isTileWalkable(updated.gridX, updated.gridY, 0.21, obstacleBoxes);
            const activeIgnoreId = leavingStart
              ? updated.leavingItemId || seatItemId || targetItemId
              : nearFinalEntry
                ? targetItemId
                : undefined;
            if (!leavingStart && updated.leavingItemId && updated.state !== 'treated_leaving') {
              if (isTileWalkable(updated.gridX, updated.gridY, 0.23, obstacleBoxes)) {
                updated.leavingItemId = undefined;
              }
            }

            // Smooth corner rounding ONLY on clear unobstructed open sightlines (never skip doorway centers or chair approach tiles)
            const isSeatWalk =
              (updated.state === 'walking_to_wait' ||
                updated.state === 'walking_to_treatment_wait') &&
              updated.isSeatedWait !== false;
            const preserveSeatApproach = isSeatWalk && activePath.length <= 2;
            if (
              !preserveSeatApproach &&
              activePath.length >= 2 &&
              !isDoorwayThreshold(activePath[0].x, activePath[0].y)
            ) {
              const maxProbe = isSeatWalk
                ? Math.max(0, activePath.length - 3)
                : activePath.length - 1;
              let jumpIdx = 0;
              for (let probe = maxProbe; probe >= 1; probe--) {
                if (isDoorwayThreshold(activePath[probe - 1].x, activePath[probe - 1].y)) break;
                if (
                  hasContinuousLineOfSight(
                    updated.gridX,
                    updated.gridY,
                    activePath[probe].x,
                    activePath[probe].y,
                    0.26,
                    obstacleBoxes,
                    undefined
                  )
                ) {
                  jumpIdx = probe;
                  break;
                }
              }
              if (jumpIdx > 0) {
                activePath = activePath.slice(jumpIdx);
                updated.path = activePath;
              }
            }

            const nextNode = activePath[0];
            const dx = nextNode.x - updated.gridX;
            const dy = nextNode.y - updated.gridY;
            const dist = Math.hypot(dx, dy);
            const onEntranceStairs =
              updated.gridX + 0.5 >= 22.45 &&
              updated.gridX + 0.5 <= 23.6 &&
              updated.gridY + 0.5 >= 13.7 &&
              updated.gridY + 0.5 <= 16.3;
            const idSeed =
              (updated.id.charCodeAt(updated.id.length - 1) + updated.id.length * 7) % 11;
            const hasAid =
              Boolean(updated.clinicalCase.mobilityAid) &&
              updated.clinicalCase.mobilityAid !== 'none';
            const baseWalkSpeed = hasAid
              ? 0.96 + idSeed * 0.008
              : 1.20 + idSeed * 0.013;
            const speedStep = (onEntranceStairs ? Math.min(0.92, baseWalkSpeed * 0.78) : baseWalkSpeed) * dtSec;
            const advanceThresh = isDoorwayThreshold(nextNode.x, nextNode.y) ? 0.16 : 0.28;

            if (activePath.length > 1 && dist <= advanceThresh) {
              updated.path = activePath.slice(1);
              updated.blockedTicks = 0;
            } else if (dist <= speedStep) {
              const res = resolveTileStep(
                updated.gridX,
                updated.gridY,
                nextNode.x,
                nextNode.y,
                0.23,
                obstacleBoxes,
                activeIgnoreId
              );
              updated.gridX = res.x;
              updated.gridY = res.y;
              updated.path = activePath.slice(1);
              updated.blockedTicks = 0;
            } else {
              // Gentle separation steering only in open spaces (never shove laterally inside doorways or final seat/bed entry)
              let avoidX = 0;
              let avoidY = 0;
              const suppressFinalSteer =
                ((updated.state === 'walking_to_wait' ||
                  updated.state === 'walking_to_treatment_wait') &&
                  updated.isSeatedWait !== false &&
                  (activePath.length <= 2 ||
                    Math.hypot(updated.targetX - updated.gridX, updated.targetY - updated.gridY) < 1.25)) ||
                (updated.state === 'walking_to_station' && activePath.length <= 1);
              if (!suppressFinalSteer && !isDoorwayThreshold(updated.gridX, updated.gridY)) {
                for (let j = 0; j < prev.length; j++) {
                  if (j === idx) continue;
                  const other = prev[j];
                  if (other.state === 'ready_for_exam' || other.state === 'in_treatment') continue;
                  const sx = updated.gridX - other.gridX;
                  const sy = updated.gridY - other.gridY;
                  const sd = Math.hypot(sx, sy);
                  const minSep = other.isSeatedWait ? 0.56 : 0.72;
                  if (sd > 0.01 && sd < minSep) {
                    const push = (minSep - sd) * 0.42;
                    avoidX += (sx / sd) * push;
                    avoidY += (sy / sd) * push;
                  }
                }
              }

              const steerX = dx / dist + avoidX;
              const steerY = dy / dist + avoidY;
              const steerLen = Math.hypot(steerX, steerY) || 1;
              const candX = updated.gridX + (steerX / steerLen) * speedStep;
              const candY = updated.gridY + (steerY / steerLen) * speedStep;
              const res = resolveTileStep(
                updated.gridX,
                updated.gridY,
                candX,
                candY,
                0.23,
                obstacleBoxes,
                activeIgnoreId
              );
              const movedDist = Math.hypot(res.x - updated.gridX, res.y - updated.gridY);
              updated.gridX = res.x;
              updated.gridY = res.y;

              if (res.blocked && movedDist < speedStep * 0.25) {
                const nextBlocked = (updated.blockedTicks || 0) + 1;
                if (nextBlocked >= 2) {
                  // Immediately re-route around obstacle via nearest open path
                  updated.blockedTicks = 0;
                  const safeHere = findNearestWalkableTile(
                    updated.gridX,
                    updated.gridY,
                    0.21,
                    obstacleBoxes
                  );
                  if (
                    isTileWalkable(safeHere.x, safeHere.y, 0.21, obstacleBoxes) &&
                    Math.hypot(safeHere.x - updated.gridX, safeHere.y - updated.gridY) < 0.85
                  ) {
                    updated.gridX = safeHere.x;
                    updated.gridY = safeHere.y;
                  }
                  const finalNode = activePath[activePath.length - 1];
                  const distToGoal = Math.hypot(
                    finalNode.x - updated.gridX,
                    finalNode.y - updated.gridY
                  );
                  const rerouteIgnoreId =
                    updated.state === 'walking_to_station'
                      ? updated.assignedStationId || undefined
                      : (updated.state === 'walking_to_wait' ||
                            updated.state === 'walking_to_treatment_wait') &&
                          updated.isSeatedWait !== false
                        ? seatItemId
                        : updated.state === 'treated_leaving'
                          ? updated.leavingItemId
                          : undefined;
                  const rerouted = buildPatientPath(
                    updated,
                    finalNode.x,
                    finalNode.y,
                    rerouteIgnoreId
                  );
                  if (rerouted.length > 0) {
                    updated.path = rerouted;
                  } else if (
                    (updated.state === 'walking_to_wait' ||
                      updated.state === 'walking_to_treatment_wait') &&
                    updated.isSeatedWait !== false &&
                    distToGoal > 0.35 &&
                    distToGoal <= 0.88
                  ) {
                    updated.path = [{ x: updated.targetX, y: updated.targetY }];
                  } else if (distToGoal <= 0.65) {
                    updated.path = [];
                  } else {
                    const claimedSoFar = [...nextList, ...prev.slice(idx + 1)];
                    if (
                      updated.state === 'walking_to_wait' ||
                      updated.state === 'walking_to_water'
                    ) {
                      assignWaitingDestination(updated, claimedSoFar);
                    } else if (updated.state === 'walking_to_treatment_wait') {
                      const seatAlt = pickReachableFreeTreatmentSeat(
                        updated,
                        updated.gridX,
                        updated.gridY,
                        claimedSoFar,
                        updated.id
                      );
                      if (seatAlt) {
                        updated.isSeatedWait = true;
                        updated.waitingSeatKey = seatAlt.seat.seatKey;
                        updated.seatHeight = seatAlt.seat.seatHeight;
                        updated.targetX = seatAlt.seat.seatTileX;
                        updated.targetY = seatAlt.seat.seatTileY;
                        updated.seatApproachX = seatAlt.seat.approachTileX;
                        updated.seatApproachY = seatAlt.seat.approachTileY;
                        updated.seatFacingRad = seatAlt.seat.facingRad;
                        updated.path = seatAlt.path;
                      } else {
                        const stand = findTreatmentStandingSpot(claimedSoFar, updated.id);
                        updated.isSeatedWait = false;
                        updated.waitingSeatKey = undefined;
                        updated.targetX = stand.x;
                        updated.targetY = stand.y;
                        updated.headingRad = -Math.PI / 2;
                        updated.path = buildPatientPath(updated, stand.x, stand.y);
                      }
                    } else if (updated.state === 'walking_to_station') {
                      updated.assignedStationId = null;
                      updated.state = 'walking_to_treatment_wait';
                      const stand = findTreatmentStandingSpot(claimedSoFar, updated.id);
                      updated.isSeatedWait = false;
                      updated.waitingSeatKey = undefined;
                      updated.targetX = stand.x;
                      updated.targetY = stand.y;
                      updated.headingRad = -Math.PI / 2;
                      updated.path = buildPatientPath(updated, stand.x, stand.y);
                    } else if (updated.state === 'arriving') {
                      const spot = getReceptionCheckinSpot(claimedSoFar);
                      updated.targetX = spot.x;
                      updated.targetY = spot.y;
                      updated.path = buildPatientPath(updated, spot.x, spot.y);
                    } else if (updated.state === 'treated_leaving') {
                      updated.path =
                        updated.gridX < 21.5
                          ? buildPatientPath(updated, 22, 14.5, updated.leavingItemId)
                          : [{ x: 32, y: 15 }];
                    }
                  }
                } else {
                  updated.blockedTicks = nextBlocked;
                }
              } else {
                updated.blockedTicks = 0;
              }
            }

            changed = true;
          } else {
            // Reached current waypoint
            if (updated.state === 'arriving') {
              const outsideClinic = updated.gridX >= 20.9;
              if (
                outsideClinic ||
                Math.hypot(updated.targetX - updated.gridX, updated.targetY - updated.gridY) > 0.65
              ) {
                const claimedSoFar = [...nextList, ...prev.slice(idx + 1)];
                const spot = getReceptionCheckinSpot(claimedSoFar);
                const rerouted = buildPatientPath(updated, spot.x, spot.y);
                updated.targetX = spot.x;
                updated.targetY = spot.y;
                if (rerouted.length > 0) {
                  updated.path = rerouted;
                } else if (outsideClinic) {
                  // Never complete check-in outdoors: guide straight inside through the front reception doors
                  updated.path = buildPatientPath(updated, 20.1, 14.5);
                } else {
                  updated.state = 'checkin_at_desk';
                  updated.waitTimer = 0;
                }
              } else {
                updated.state = 'checkin_at_desk';
                updated.waitTimer = 0;
              }
              changed = true;
            } else if (updated.state === 'checkin_at_desk') {
              updated.waitTimer += dtMs;
              const checkedByRec = receptionCheckedInIdsRef.current.has(updated.id);
              const maxCheckinMs =
                receptionistHired && hasReceptionDesk && hasFileCabinet
                  ? 12000
                  : receptionistHired && hasReceptionDesk
                    ? 3500
                    : 1600;
              if ((checkedByRec && updated.waitTimer >= 650) || updated.waitTimer >= maxCheckinMs) {
                receptionCheckedInIdsRef.current.delete(updated.id);
                const claimedSoFar = [...nextList, ...prev.slice(idx + 1)];
                const coolerSpot =
                  Math.random() < 0.26
                    ? pickFreeWaterCoolerSpot(claimedSoFar, updated.id)
                    : null;

                const coolerPath = coolerSpot
                  ? buildPatientPath(updated, coolerSpot.x, coolerSpot.y)
                  : [];

                if (coolerSpot && coolerPath.length > 0) {
                  updated.state = 'walking_to_water';
                  updated.waitTimer = 0;
                  updated.waterCoolerId = coolerSpot.coolerId;
                  updated.targetX = coolerSpot.x;
                  updated.targetY = coolerSpot.y;
                  updated.headingRad = coolerSpot.facingRad;
                  updated.path = coolerPath;
                } else {
                  assignWaitingDestination(updated, claimedSoFar);
                }
                changed = true;
              }
            } else if (updated.state === 'walking_to_water') {
              updated.state = 'drinking_water';
              updated.waitTimer = 0;
              changed = true;
            } else if (updated.state === 'drinking_water') {
              updated.waitTimer += dtMs;
              if (updated.waitTimer >= 3850) {
                const claimedSoFar = [...nextList, ...prev.slice(idx + 1)];
                assignWaitingDestination(updated, claimedSoFar);
                changed = true;
              }
            } else if (updated.state === 'walking_to_wait') {
              const distToWaitTarget = Math.hypot(
                updated.targetX - updated.gridX,
                updated.targetY - updated.gridY
              );
              if (updated.isSeatedWait !== false) {
                if (updated.targetX >= 20.9 || distToWaitTarget > 0.9) {
                  const claimedSoFar = [...nextList, ...prev.slice(idx + 1)];
                  assignWaitingDestination(updated, claimedSoFar);
                } else if (distToWaitTarget > 0.35) {
                  // Finish stepping onto the exact seat cushion instead of sitting out on the floor
                  updated.path = [{ x: updated.targetX, y: updated.targetY }];
                } else {
                  updated.gridX = updated.targetX;
                  updated.gridY = updated.targetY;
                  updated.state = 'waiting_checkin';
                  updated.waitTimer = 0;
                }
              } else {
                if (updated.targetX >= 20.9 || distToWaitTarget > 0.78) {
                  const claimedSoFar = [...nextList, ...prev.slice(idx + 1)];
                  assignWaitingDestination(updated, claimedSoFar);
                } else {
                  updated.state = 'waiting_checkin';
                  updated.waitTimer = 0;
                  updated.idleMoveTimer = 2200 + Math.random() * 1800;
                }
              }
              changed = true;
            } else if (updated.state === 'waiting_checkin') {
              const prevWaitTimer = updated.waitTimer;
              updated.waitTimer += dtMs;

              // Safety check: if a waiting patient ever sits/stands outside Reception, immediately bring them back inside
              if (updated.gridX >= 20.8 || updated.targetX >= 20.8) {
                const claimedSoFar = [...nextList, ...prev.slice(idx + 1)];
                assignWaitingDestination(updated, claimedSoFar);
                changed = true;
                nextList.push(updated);
                continue;
              }

              if (updated.isSeatedWait === false) {
                if (
                  updated.waitTimer <= dtMs + 5 ||
                  Math.floor(prevWaitTimer / 1800) !== Math.floor(updated.waitTimer / 1800)
                ) {
                  const claimedSoFar = [...nextList, ...prev.slice(idx + 1)];
                  const reachable = pickReachableFreeWaitingSeat(
                    updated,
                    updated.gridX,
                    updated.gridY,
                    claimedSoFar,
                    updated.id
                  );
                  if (reachable) {
                    updated.state = 'walking_to_wait';
                    updated.isSeatedWait = true;
                    updated.waitingSeatKey = reachable.seat.seatKey;
                    updated.seatHeight = reachable.seat.seatHeight;
                    updated.targetX = reachable.seat.seatTileX;
                    updated.targetY = reachable.seat.seatTileY;
                    updated.seatApproachX = reachable.seat.approachTileX;
                    updated.seatApproachY = reachable.seat.approachTileY;
                    updated.seatOffsetX = 0;
                    updated.seatOffsetZ = 0;
                    updated.seatFacingRad = reachable.seat.facingRad;
                    updated.idleMoveTimer = undefined;
                    updated.blockedTicks = 0;
                    updated.path = reachable.path;
                    changed = true;
                    nextList.push(updated);
                    continue;
                  }
                }

                // Natural standing waiting idle movements strictly inside Reception around the receptionist
                const curIdle = standingIdleMap.get(updated.id) ?? updated.idleMoveTimer ?? 3600;
                const nextIdle = curIdle - dtMs;
                if (nextIdle <= 0) {
                  const resetIdle = 4200 + Math.random() * 4200;
                  standingIdleMap.set(updated.id, resetIdle);
                  updated.idleMoveTimer = resetIdle;
                  const peers = [...nextList, ...prev.slice(idx + 1)];
                  if (Math.random() < 0.32) {
                    const drift = findStandingWaitSpot(peers, updated.id);
                    if (
                      drift.x < 19.8 &&
                      Math.hypot(drift.x - updated.gridX, drift.y - updated.gridY) <= 1.95
                    ) {
                      const driftPath = buildPatientPath(updated, drift.x, drift.y);
                      if (driftPath.length > 0) {
                        updated.targetX = drift.x;
                        updated.targetY = drift.y;
                        updated.headingRad = pickSpontaneousStandingHeading(
                          drift.x,
                          drift.y,
                          peers,
                          updated.id
                        );
                        updated.path = driftPath;
                      }
                    }
                  } else {
                    updated.headingRad = pickSpontaneousStandingHeading(
                      updated.gridX,
                      updated.gridY,
                      peers,
                      updated.id
                    );
                  }
                  changed = true;
                } else {
                  standingIdleMap.set(updated.id, nextIdle);
                }
              }
              // Waiting patients strictly stay in Reception chairs / Reception standing area until explicitly called by the user.
            } else if (updated.state === 'walking_to_treatment_wait') {
              const distToTreatTarget = Math.hypot(
                updated.targetX - updated.gridX,
                updated.targetY - updated.gridY
              );
              if (updated.isSeatedWait !== false) {
                if (distToTreatTarget > 0.9) {
                  const claimedSoFar = [...nextList, ...prev.slice(idx + 1)];
                  const reachable = pickReachableFreeTreatmentSeat(
                    updated,
                    updated.gridX,
                    updated.gridY,
                    claimedSoFar,
                    updated.id
                  );
                  if (reachable) {
                    updated.waitingSeatKey = reachable.seat.seatKey;
                    updated.seatHeight = reachable.seat.seatHeight;
                    updated.targetX = reachable.seat.seatTileX;
                    updated.targetY = reachable.seat.seatTileY;
                    updated.seatApproachX = reachable.seat.approachTileX;
                    updated.seatApproachY = reachable.seat.approachTileY;
                    updated.seatFacingRad = reachable.seat.facingRad;
                    updated.path = reachable.path;
                  } else {
                    const stand = findTreatmentStandingSpot(claimedSoFar, updated.id);
                    updated.isSeatedWait = false;
                    updated.waitingSeatKey = undefined;
                    updated.targetX = stand.x;
                    updated.targetY = stand.y;
                    updated.headingRad = -Math.PI / 2;
                    updated.path = buildPatientPath(updated, stand.x, stand.y);
                  }
                } else if (distToTreatTarget > 0.35) {
                  updated.path = [{ x: updated.targetX, y: updated.targetY }];
                } else {
                  updated.gridX = updated.targetX;
                  updated.gridY = updated.targetY;
                  updated.state = 'waiting_in_treatment';
                  updated.waitTimer = 0;
                }
              } else {
                if (updated.gridX >= 11.4 || distToTreatTarget > 0.78) {
                  const claimedSoFar = [...nextList, ...prev.slice(idx + 1)];
                  const stand = findTreatmentStandingSpot(claimedSoFar, updated.id);
                  updated.targetX = stand.x;
                  updated.targetY = stand.y;
                  updated.headingRad = -Math.PI / 2;
                  updated.path = buildPatientPath(updated, stand.x, stand.y);
                } else {
                  updated.state = 'waiting_in_treatment';
                  updated.waitTimer = 0;
                  updated.idleMoveTimer = 2800 + Math.random() * 2200;
                }
              }
              changed = true;
            } else if (updated.state === 'waiting_in_treatment') {
              const prevTreatTimer = updated.waitTimer;
              updated.waitTimer += dtMs;
              if (updated.isSeatedWait === false) {
                if (
                  updated.waitTimer <= dtMs + 5 ||
                  Math.floor(prevTreatTimer / 1800) !== Math.floor(updated.waitTimer / 1800)
                ) {
                  const claimedSoFar = [...nextList, ...prev.slice(idx + 1)];
                  const reachable = pickReachableFreeTreatmentSeat(
                    updated,
                    updated.gridX,
                    updated.gridY,
                    claimedSoFar,
                    updated.id
                  );
                  if (reachable) {
                    updated.state = 'walking_to_treatment_wait';
                    updated.isSeatedWait = true;
                    updated.waitingSeatKey = reachable.seat.seatKey;
                    updated.seatHeight = reachable.seat.seatHeight;
                    updated.targetX = reachable.seat.seatTileX;
                    updated.targetY = reachable.seat.seatTileY;
                    updated.seatApproachX = reachable.seat.approachTileX;
                    updated.seatApproachY = reachable.seat.approachTileY;
                    updated.seatOffsetX = 0;
                    updated.seatOffsetZ = 0;
                    updated.seatFacingRad = reachable.seat.facingRad;
                    updated.idleMoveTimer = undefined;
                    updated.blockedTicks = 0;
                    updated.path = reachable.path;
                    changed = true;
                    nextList.push(updated);
                    continue;
                  }
                }
                const curIdle = standingIdleMap.get(updated.id) ?? updated.idleMoveTimer ?? 3600;
                const nextIdle = curIdle - dtMs;
                if (nextIdle <= 0) {
                  const resetIdle = 4200 + Math.random() * 4200;
                  standingIdleMap.set(updated.id, resetIdle);
                  updated.idleMoveTimer = resetIdle;
                  updated.headingRad = -Math.PI / 2 + (Math.random() - 0.5) * 0.9;
                  changed = true;
                } else {
                  standingIdleMap.set(updated.id, nextIdle);
                }
              }
            } else if (updated.state === 'walking_to_station') {
              const station = updated.assignedStationId
                ? placedItemById.get(updated.assignedStationId)
                : undefined;
              const arrivedAtStation = Boolean(
                station &&
                  (Math.hypot(updated.targetX - updated.gridX, updated.targetY - updated.gridY) <= 0.78 ||
                    isNearStation(station, updated.gridX, updated.gridY))
              );
              if (station && !arrivedAtStation) {
                const stTarget = getStationTargetPos(station, updated.gridX, updated.gridY);
                updated.targetX = stTarget.x;
                updated.targetY = stTarget.y;
                const retryPath = buildPatientPath(
                  updated,
                  stTarget.x,
                  stTarget.y,
                  station.instanceId
                );
                if (retryPath.length > 0) {
                  updated.path = retryPath;
                } else {
                  updated.assignedStationId = null;
                  const claimedSoFar = [...nextList, ...prev.slice(idx + 1)];
                  const stand = findTreatmentStandingSpot(claimedSoFar, updated.id);
                  updated.state = 'walking_to_treatment_wait';
                  updated.isSeatedWait = false;
                  updated.waitingSeatKey = undefined;
                  updated.targetX = stand.x;
                  updated.targetY = stand.y;
                  updated.headingRad = -Math.PI / 2;
                  updated.path = buildPatientPath(updated, stand.x, stand.y);
                }
              } else if (station) {
                updated.state = 'ready_for_exam';
              } else {
                updated.assignedStationId = null;
                const claimedSoFar = [...nextList, ...prev.slice(idx + 1)];
                const stand = findTreatmentStandingSpot(claimedSoFar, updated.id);
                updated.state = 'walking_to_treatment_wait';
                updated.isSeatedWait = false;
                updated.waitingSeatKey = undefined;
                updated.targetX = stand.x;
                updated.targetY = stand.y;
                updated.headingRad = -Math.PI / 2;
                updated.path = buildPatientPath(updated, stand.x, stand.y);
              }
              changed = true;
            } else if (updated.state === 'in_treatment') {
              const stItem = updated.assignedStationId
                ? placedItemById.get(updated.assignedStationId)
                : undefined;
              const stBoost = stItem ? catalogById.get(stItem.catalogId)?.speedBonus || 0 : 0;
              const nextProg = Math.min(
                1,
                (updated.treatmentProgress || 0) + dtSec * 0.245 * (1 + stBoost / 100)
              );
              if (nextProg !== updated.treatmentProgress) {
                updated.treatmentProgress = nextProg;
                changed = true;
              }
            } else if (updated.state === 'treated_leaving') {
              if (updated.gridX < 28.5) {
                const exitPath = buildPatientPath(updated, 32, 15, updated.leavingItemId);
                updated.path = exitPath.length > 0 ? exitPath : [{ x: 32, y: 15 }];
                changed = true;
              } else {
                changed = true;
                continue;
              }
            }
          }

          nextList.push(updated);
        }

        // Non-clipping personal-space resolution for standing/walking patients (skip doorways and final seat/bed entry)
        for (let i = 0; i < nextList.length; i++) {
          const a = nextList[i];
          if (
            a.state === 'ready_for_exam' ||
            a.state === 'in_exam' ||
            a.state === 'in_treatment' ||
            a.isSeatedWait ||
            (a.state === 'walking_to_station' && a.path.length <= 1) ||
            isDoorwayThreshold(a.gridX, a.gridY)
          ) {
            continue;
          }
          for (let j = 0; j < nextList.length; j++) {
            if (i === j) continue;
            const b = nextList[j];
            if (
              b.state === 'ready_for_exam' ||
              b.state === 'in_exam' ||
              b.state === 'in_treatment' ||
              b.isSeatedWait
            )
              continue;
            const sx = a.gridX - b.gridX;
            const sy = a.gridY - b.gridY;
            const d = Math.hypot(sx, sy);
            if (d > 0.001 && d < 0.62) {
              const push = (0.62 - d) * 0.22;
              const candX = a.gridX + (sx / d) * push;
              const candY = a.gridY + (sy / d) * push;
              if (isDoorwayThreshold(candX, candY)) continue;
              const res = resolveTileStep(a.gridX, a.gridY, candX, candY, 0.23, obstacleBoxes);
              if (res.x !== a.gridX || res.y !== a.gridY) {
                a.gridX = res.x;
                a.gridY = res.y;
                changed = true;
              }
            }
          }
        }

        return changed ? nextList : prev;
      });
    }, 200);

    return () => clearInterval(tick);
  }, [
    hydrated,
    visitingFriend,
    isFppSessionActive,
    clinic.rooms,
    clinic.placedItems,
    clinic.staff,
    getReceptionCheckinSpot,
    pickReachableFreeWaitingSeat,
    pickReachableFreeTreatmentSeat,
    pickFreeWaterCoolerSpot,
    findStandingWaitSpot,
    findTreatmentStandingSpot,
    buildPatientPath,
    buildPathToWaitSeat,
    catalogById,
    obstacleBoxes,
    getStationTargetPos,
    isNearStation,
  ]);

  // Explicitly call a waiting patient from reception/waiting lounge into the treatment hall (sits on a chair if present, or stands waiting for station assignment)
  const callPatientToStation = useCallback(
    (patientId: string): boolean => {
      if (visitingFriend) return false;
      const patient = patients.find((p) => p.id === patientId);
      if (!patient) return false;

      if (
        patient.state !== 'waiting_checkin' &&
        patient.state !== 'walking_to_wait' &&
        patient.state !== 'walking_to_water' &&
        patient.state !== 'drinking_water'
      ) {
        return false;
      }

      const occupiedIds = new Set(
        patients
          .filter((p) => p.state !== 'treated_leaving' && p.assignedStationId)
          .map((p) => p.assignedStationId!)
      );
      const freeStations = clinic.placedItems.filter((item) => {
        const cat = catalogById.get(item.catalogId);
        if (!cat?.isTreatmentStation || !ASSIGNABLE_STATION_SPRITES.has(cat.sprite)) return false;
        const room = clinic.rooms.find((r) => r.id === item.roomId);
        return (!room || room.unlocked) && !occupiedIds.has(item.instanceId);
      }).length;
      const hallWaitCount = patients.filter(
        (p) => p.state === 'walking_to_treatment_wait' || p.state === 'waiting_in_treatment'
      ).length;

      if (freeStations - hallWaitCount <= 0) {
        soundFx.tap();
        addFloatingFeedback(
          patient.gridX,
          patient.gridY,
          clinic.language === 'ar'
            ? 'جميع الأسرّة والأجهزة ممتلئة! أكمل الجلسة الحالية أولاً'
            : 'All stations are full! Finish current session first',
          '#f59e0b'
        );
        return false;
      }

      const seatPick = pickReachableFreeTreatmentSeat(
        patient,
        patient.gridX,
        patient.gridY,
        patients,
        patient.id
      );

      let targetX = 0;
      let targetY = 0;
      let nextPath: Array<{ x: number; y: number }> = [];
      let isSeatedWait = false;
      let waitingSeatKey: string | undefined;
      let seatHeight: number | undefined;
      let seatApproachX: number | undefined;
      let seatApproachY: number | undefined;
      let seatFacingRad: number | undefined;
      let headingRad: number | undefined;

      if (seatPick) {
        isSeatedWait = true;
        waitingSeatKey = seatPick.seat.seatKey;
        seatHeight = seatPick.seat.seatHeight;
        targetX = seatPick.seat.seatTileX;
        targetY = seatPick.seat.seatTileY;
        seatApproachX = seatPick.seat.approachTileX;
        seatApproachY = seatPick.seat.approachTileY;
        seatFacingRad = seatPick.seat.facingRad;
        nextPath = seatPick.path;
      } else {
        const stand = findTreatmentStandingSpot(patients, patient.id);
        targetX = stand.x;
        targetY = stand.y;
        headingRad = -Math.PI / 2;
        nextPath = buildPatientPath(patient, stand.x, stand.y);
      }

      if (nextPath.length === 0) {
        soundFx.tap();
        addFloatingFeedback(
          patient.gridX,
          patient.gridY,
          clinic.language === 'ar' ? 'الممر إلى صالة العلاج مغلق!' : 'Path to treatment hall blocked!',
          '#f59e0b'
        );
        return false;
      }

      const prevSeatItemId = patient.waitingSeatKey
        ? patient.waitingSeatKey.slice(0, patient.waitingSeatKey.lastIndexOf('_'))
        : undefined;

      soundFx.tap();
      setPatients((prev) =>
        prev.map((p) =>
          p.id === patient.id
            ? {
                ...p,
                assignedStationId: null,
                state: 'walking_to_treatment_wait',
                targetX,
                targetY,
                leavingItemId: prevSeatItemId,
                isSeatedWait,
                waitingSeatKey,
                seatHeight,
                seatApproachX,
                seatApproachY,
                seatOffsetX: isSeatedWait ? 0 : undefined,
                seatOffsetZ: isSeatedWait ? 0 : undefined,
                seatFacingRad,
                waterCoolerId: undefined,
                idleMoveTimer: undefined,
                headingRad,
                blockedTicks: 0,
                path: nextPath,
              }
            : p
        )
      );
      setSelectedWaitingPatientId((cur) => (cur === patient.id ? null : cur));
      addFloatingFeedback(
        patient.gridX,
        patient.gridY,
        clinic.language === 'ar'
          ? isSeatedWait
            ? 'دخل صالة العلاج وسيتجه للكرسي'
            : 'تم استدعاء المريض لصالة العلاج'
          : isSeatedWait
            ? 'Entering treatment lounge seat'
            : 'Called to treatment hall',
        '#38bdf8'
      );
      return true;
    },
    [
      visitingFriend,
      patients,
      clinic.placedItems,
      clinic.rooms,
      catalogById,
      pickReachableFreeTreatmentSeat,
      findTreatmentStandingSpot,
      buildPatientPath,
      addFloatingFeedback,
      clinic.language,
    ]
  );

  // Direct a patient waiting inside the treatment hall to the exact station selected by the player
  const assignTreatmentPatientToStation = useCallback(
    (patientId: string, stationId: string): boolean => {
      if (visitingFriend) return false;
      const patient = patients.find((p) => p.id === patientId);
      if (!patient) return false;
      if (
        patient.state !== 'waiting_in_treatment' &&
        patient.state !== 'walking_to_treatment_wait'
      ) {
        return false;
      }
      const station = clinic.placedItems.find((it) => it.instanceId === stationId);
      const stationCat = station ? catalogById.get(station.catalogId) : undefined;
      if (!station || !stationCat?.isTreatmentStation || !ASSIGNABLE_STATION_SPRITES.has(stationCat.sprite)) {
        return false;
      }
      const room = clinic.rooms.find((r) => r.id === station.roomId);
      if (room && !room.unlocked) return false;

      const occupiedBy = patients.find(
        (p) => p.id !== patientId && p.state !== 'treated_leaving' && p.assignedStationId === stationId
      );
      if (occupiedBy) {
        soundFx.tap();
        addFloatingFeedback(
          station.gridX,
          station.gridY,
          clinic.language === 'ar' ? 'هذا الجهاز مشغول حالياً!' : 'This station is currently occupied!',
          '#f59e0b'
        );
        return false;
      }

      const stTarget = getStationTargetPos(station, patient.gridX, patient.gridY);
      const stationPath = buildPatientPath(patient, stTarget.x, stTarget.y, station.instanceId);
      if (stationPath.length === 0 && !isNearStation(station, patient.gridX, patient.gridY)) {
        soundFx.tap();
        addFloatingFeedback(
          station.gridX,
          station.gridY,
          clinic.language === 'ar' ? 'الممر إلى هذا الجهاز مغلق!' : 'Path to this station is blocked!',
          '#f59e0b'
        );
        return false;
      }

      const prevSeatItemId = patient.waitingSeatKey
        ? patient.waitingSeatKey.slice(0, patient.waitingSeatKey.lastIndexOf('_'))
        : undefined;

      soundFx.tap();
      setPatients((prev) =>
        prev.map((p) =>
          p.id === patient.id
            ? {
                ...p,
                assignedStationId: station.instanceId,
                state: 'walking_to_station',
                targetX: stTarget.x,
                targetY: stTarget.y,
                leavingItemId: prevSeatItemId,
                isSeatedWait: undefined,
                waitingSeatKey: undefined,
                seatHeight: undefined,
                seatApproachX: undefined,
                seatApproachY: undefined,
                seatOffsetX: undefined,
                seatOffsetZ: undefined,
                seatFacingRad: undefined,
                idleMoveTimer: undefined,
                headingRad: undefined,
                blockedTicks: 0,
                path: stationPath,
              }
            : p
        )
      );
      setSelectedTreatmentWaitPatientId(null);
      setPendingStationIdForPick(null);
      addFloatingFeedback(
        station.gridX,
        station.gridY,
        clinic.language === 'ar'
          ? `متجه إلى ${stationCat.nameAr}`
          : `Walking to ${stationCat.nameEn}`,
        '#10b981'
      );
      return true;
    },
    [
      visitingFriend,
      patients,
      clinic.placedItems,
      clinic.rooms,
      catalogById,
      getStationTargetPos,
      buildPatientPath,
      isNearStation,
      addFloatingFeedback,
      clinic.language,
    ]
  );

  const handleSyncPatientDevices = useCallback(
    (patientId: string, devices: PatientAttachedDevice[]) => {
      setPatients((prev) =>
        prev.map((pt) =>
          pt.id === patientId
            ? {
                ...pt,
                attachedDevices: devices.length > 0 ? devices : undefined,
              }
            : pt
        )
      );
    },
    []
  );

  const handleSetPatientFppPosture = useCallback(
    (nextPosture: FppPatientPosture, targetPatientId?: string | null) => {
      setFppPosture(nextPosture);
      const pid = targetPatientId ?? firstPersonPatientId;
      if (!pid) return;
      setPatients((prev) =>
        prev.map((pt) =>
          pt.id === pid && pt.sessionPosture !== nextPosture
            ? { ...pt, sessionPosture: nextPosture }
            : pt
        )
      );
    },
    [firstPersonPatientId]
  );

  const startFirstPersonSession = useCallback(
    (patientId: string) => {
      if (fppBlinkLockRef.current) return;
      soundFx.tap();
      const targetPt = patients.find((pt) => pt.id === patientId);
      const targetStation = targetPt?.assignedStationId
        ? clinic.placedItems.find((it) => it.instanceId === targetPt.assignedStationId)
        : undefined;
      const targetStationCat = targetStation ? catalogById.get(targetStation.catalogId) : undefined;
      const initialPosture =
        targetPt?.sessionPosture ?? getDefaultPostureForStation(targetStationCat?.sprite);

      setSelectedBedPatientId(null);
      setSelectedWaitingPatientId(null);
      setSelectedTreatmentWaitPatientId(null);
      setPendingStationIdForPick(null);
      setWaitingQueueOpen(false);
      setStoreOpen(false);
      setMissionsOpen(false);
      setFriendsOpen(false);
      setSettingsOpen(false);
      setBonusOpen(false);
      setCharacterModalOpen(false);
      setEditMode(false);
      setPlacementDraft(null);
      setActiveNavTab(null);
      triggerFppBlinkTransition(() => {
        setPatients((prev) =>
          prev.map((pt) =>
            pt.id === patientId && pt.state === 'ready_for_exam'
              ? { ...pt, state: 'in_exam', sessionPosture: pt.sessionPosture ?? initialPosture }
              : pt
          )
        );
        setFppPosture(initialPosture);
        setFirstPersonPatientId(patientId);
        setFppNearbyDevice(null);
        setFppHeldDevice(null);
        setFppActiveDevice(null);
        setFppHandshakeReady(false);
        setFppHoverBodyZone(null);
      });
    },
    [patients, clinic.placedItems, catalogById, triggerFppBlinkTransition]
  );

  const latestActionRef = useRef({
    clinic,
    patients,
    placementDraft,
    visitingFriend,
    editMode,
    selectedTreatmentWaitPatientId,
  });
  latestActionRef.current = {
    clinic,
    patients,
    placementDraft,
    visitingFriend,
    editMode,
    selectedTreatmentWaitPatientId,
  };

  // Handle tapping a patient
  const handleTapPatient = useCallback(
    (patient: PatientEntity) => {
      const { visitingFriend: curVisiting, clinic: curClinic } = latestActionRef.current;
      if (curVisiting) return;
      soundFx.tap();

      if (patient.state === 'arriving' || patient.state === 'checkin_at_desk') {
        addFloatingFeedback(
          patient.gridX,
          patient.gridY,
          curClinic.language === 'ar'
            ? 'جاري تسجيل الملف في الاستقبال...'
            : 'Preparing chart at reception...',
          '#0ea5e9'
        );
        return;
      }

      if (
        patient.state === 'waiting_checkin' ||
        patient.state === 'walking_to_wait' ||
        patient.state === 'walking_to_water' ||
        patient.state === 'drinking_water'
      ) {
        setSelectedBedPatientId(null);
        setSelectedTreatmentWaitPatientId(null);
        setPendingStationIdForPick(null);
        setSelectedWaitingPatientId((cur) => (cur === patient.id ? null : patient.id));
        return;
      }

      if (
        patient.state === 'walking_to_treatment_wait' ||
        patient.state === 'waiting_in_treatment'
      ) {
        setSelectedBedPatientId(null);
        setSelectedWaitingPatientId(null);
        setPendingStationIdForPick(null);
        setSelectedTreatmentWaitPatientId((cur) => (cur === patient.id ? null : patient.id));
        return;
      }

      if (patient.state === 'walking_to_station') {
        setSelectedWaitingPatientId(null);
        setSelectedTreatmentWaitPatientId(null);
        setPendingStationIdForPick(null);
        addFloatingFeedback(
          patient.gridX,
          patient.gridY,
          curClinic.language === 'ar' ? 'المريض في طريقه إلى الجهاز...' : 'Walking to station...',
          '#38bdf8'
        );
        return;
      }

      if (patient.state === 'ready_for_exam' || patient.state === 'in_exam') {
        setSelectedWaitingPatientId(null);
        setSelectedTreatmentWaitPatientId(null);
        setPendingStationIdForPick(null);
        setSelectedBedPatientId((cur) => (cur === patient.id ? null : patient.id));
      }
    },
    [addFloatingFeedback]
  );

  // Smart context tap on Reception Desk: opens Smart Waiting Queue or staff hiring
  const handleTapReceptionDesk = useCallback(() => {
    const { visitingFriend: curVisiting, clinic: curClinic } = latestActionRef.current;
    if (curVisiting) return;
    const receptionistHired = curClinic.staff.some((s) => s.role === 'receptionist' && s.hired);
    if (!receptionistHired) {
      soundFx.tap();
      setStoreFilter('staff');
      setStoreOpen(true);
      setActiveNavTab('store');
      return;
    }
    soundFx.tap();
    setSelectedWaitingPatientId(null);
    setWaitingQueueOpen(true);
  }, []);

  // Finalize patient discharge + XP/coins/stars payout
  const finishTreatmentAndReward = useCallback(
    (result: {
      patientId: string;
      coinsEarned: number;
      starsEarned: number;
      satisfactionDelta: number;
      caughtRedFlag: boolean;
      gridX: number;
      gridY: number;
    }) => {
      addFloatingFeedback(result.gridX, result.gridY, `+${result.coinsEarned}`, '#fbbf24');
      if (result.starsEarned > 0) {
        setTimeout(() => {
          addFloatingFeedback(result.gridX, result.gridY - 0.5, `+${result.starsEarned} ★`, '#38bdf8');
        }, 220);
      }

      if (result.starsEarned > 0) soundFx.starSuccess();
      else soundFx.coin();

      setClinic((prev) => {
        const nextXp = (prev.xp || 0) + 120;
        const nextLevel = Math.floor(nextXp / 300) + 1;
        return {
          ...prev,
          coins: Math.max(999999, prev.coins + result.coinsEarned),
          stars: prev.stars + result.starsEarned,
          xp: nextXp,
          level: nextLevel,
          satisfaction: Math.min(100, Math.max(70, prev.satisfaction + result.satisfactionDelta)),
          patientsTreatedTotal: prev.patientsTreatedTotal + 1,
          redFlagsCaughtTotal: prev.redFlagsCaughtTotal + (result.caughtRedFlag ? 1 : 0),
        };
      });

      bumpMission('treat_patients', 1);

      setPatients((prev) =>
        prev.map((pt) =>
          pt.id === result.patientId
            ? {
                ...pt,
                state: 'treated_leaving',
                leavingItemId: pt.assignedStationId || undefined,
                assignedStationId: null,
                treatmentProgress: undefined,
                attachedDevices: undefined,
                sessionPosture: undefined,
                blockedTicks: 0,
                path: buildPatientPath(pt, 32, 15, pt.assignedStationId || undefined),
              }
            : pt
        )
      );
    },
    [addFloatingFeedback, bumpMission, buildPatientPath]
  );

  // Complete clinical reasoning session -> run live 3D therapy session (or immediate ER referral)
  const handleCompleteCase = (result: {
    patientId: string;
    coinsEarned: number;
    starsEarned: number;
    satisfactionDelta: number;
    caughtRedFlag: boolean;
  }) => {
    const p = patients.find((pt) => pt.id === result.patientId);
    const wasInFpp = Boolean(firstPersonPatientId);

    if (wasInFpp) {
      triggerFppBlinkTransition(
        () => {
          soundFx.stopAllDevices();
          setFirstPersonPatientId(null);
          setFppNearbyDevice(null);
          setFppHeldDevice(null);
          setFppActiveDevice(null);
          setSelectedBedPatientId(null);
          setSpeakingPatientId(null);
          if (speakingTimerRef.current) {
            clearTimeout(speakingTimerRef.current);
            speakingTimerRef.current = null;
          }
          if (p && !p.clinicalCase.redFlagsPresent) {
            setPatients((prev) =>
              prev.map((pt) =>
                pt.id === result.patientId
                  ? { ...pt, state: 'in_treatment', treatmentProgress: 0.04 }
                  : pt
              )
            );
          }
        },
        () => {
          if (!p) return;
          if (p.clinicalCase.redFlagsPresent) {
            finishTreatmentAndReward({ ...result, gridX: p.gridX, gridY: p.gridY });
            return;
          }

          const station = p.assignedStationId
            ? clinic.placedItems.find((it) => it.instanceId === p.assignedStationId)
            : undefined;
          const stationCat = station ? catalogById.get(station.catalogId) : undefined;
          const speedBoost = stationCat?.speedBonus || 0;
          const durationMs = Math.max(2900, Math.round(4600 / (1 + speedBoost / 100)));

          soundFx.tap();
          addFloatingFeedback(
            p.gridX,
            p.gridY,
            clinic.language === 'ar'
              ? stationCat
                ? `جلسة ${stationCat.nameEn} ⚡`
                : 'جلسة علاج نشطة ⚡'
              : stationCat
                ? `${stationCat.nameEn} Session ⚡`
                : 'Therapy Active ⚡',
            '#38bdf8'
          );

          const timer = setTimeout(() => {
            treatmentTimersRef.current.delete(timer);
            finishTreatmentAndReward({ ...result, gridX: p.gridX, gridY: p.gridY });
          }, durationMs);
          treatmentTimersRef.current.add(timer);
        }
      );
      return;
    }

    soundFx.stopAllDevices();
    setFirstPersonPatientId(null);
    setFppNearbyDevice(null);
    setFppHeldDevice(null);
    setFppActiveDevice(null);
    setSelectedBedPatientId(null);
    setSpeakingPatientId(null);
    if (speakingTimerRef.current) {
      clearTimeout(speakingTimerRef.current);
      speakingTimerRef.current = null;
    }
    if (!p) return;

    if (p.clinicalCase.redFlagsPresent) {
      finishTreatmentAndReward({ ...result, gridX: p.gridX, gridY: p.gridY });
      return;
    }

    const station = p.assignedStationId
      ? clinic.placedItems.find((it) => it.instanceId === p.assignedStationId)
      : undefined;
    const stationCat = station ? catalogById.get(station.catalogId) : undefined;
    const speedBoost = stationCat?.speedBonus || 0;
    const durationMs = Math.max(2900, Math.round(4600 / (1 + speedBoost / 100)));

    soundFx.tap();
    addFloatingFeedback(
      p.gridX,
      p.gridY,
      clinic.language === 'ar'
        ? stationCat
          ? `جلسة ${stationCat.nameEn} ⚡`
          : 'جلسة علاج نشطة ⚡'
        : stationCat
          ? `${stationCat.nameEn} Session ⚡`
          : 'Therapy Active ⚡',
      '#38bdf8'
    );
    setPatients((prev) =>
      prev.map((pt) =>
        pt.id === result.patientId
          ? { ...pt, state: 'in_treatment', treatmentProgress: 0.04 }
          : pt
      )
    );

    const timer = setTimeout(() => {
      treatmentTimersRef.current.delete(timer);
      finishTreatmentAndReward({ ...result, gridX: p.gridX, gridY: p.gridY });
    }, durationMs);
    treatmentTimersRef.current.add(timer);
  };

  // Bottom Nav selection
  const handleSelectNavTab = useCallback((tab: NavTab) => {
    soundFx.tap();
    setPlacementDraft(null);
    if (tab === 'missions') {
      setMissionsOpen(true);
      setStoreOpen(false);
      setActiveNavTab(tab);
      return;
    }
    setStoreFilter(tab);
    setStoreOpen(true);
    setActiveNavTab(tab);
  }, []);

  // Buy & immediately enter placement mode on an open valid tile
  const handleBuyAndPlace = (item: CatalogItem) => {
    if (clinic.coins < item.priceCoins) return;
    soundFx.tap();
    setStoreOpen(false);
    setActiveNavTab(null);
    setEditMode(false);

    if (item.isWallDecor || isWallDecorId(item.id)) {
      const occupiedWallKeys = new Set(
        clinic.placedItems
          .filter((it) => isWallDecorId(it.catalogId) || catalogById.get(it.catalogId)?.isWallDecor)
          .map((it) => `${it.gridX},${it.gridY},${it.rotation}`)
      );
      const preferredSlots: Array<{ gx: number; gy: number; rotation: 0 | 1 | 2 | 3 }> = [
        { gx: 14, gy: 10, rotation: 1 },
        { gx: 15, gy: 10, rotation: 1 },
        { gx: 18, gy: 10, rotation: 1 },
        { gx: 12, gy: 15, rotation: 0 },
        { gx: 12, gy: 16, rotation: 0 },
        { gx: 5, gy: 10, rotation: 1 },
        { gx: 8, gy: 10, rotation: 1 },
      ];
      let chosen: { gx: number; gy: number; rotation: 0 | 1 | 2 | 3 } | null = null;
      for (const s of preferredSlots) {
        if (
          getValidWallRotationsForTile(s.gx, s.gy, clinic.rooms).includes(s.rotation) &&
          !occupiedWallKeys.has(`${s.gx},${s.gy},${s.rotation}`)
        ) {
          chosen = s;
          break;
        }
      }
      if (!chosen) {
        outer: for (let gy = 2; gy <= 21; gy++) {
          for (let gx = 2; gx <= 21; gx++) {
            const rots = getValidWallRotationsForTile(gx, gy, clinic.rooms);
            for (const rot of rots) {
              if (!occupiedWallKeys.has(`${gx},${gy},${rot}`)) {
                chosen = { gx, gy, rotation: rot };
                break outer;
              }
            }
          }
        }
      }
      if (!chosen) {
        chosen = snapToNearestValidWallSlot(14.5, 10.2, 1, clinic.rooms) || {
          gx: 14,
          gy: 10,
          rotation: 1,
        };
      }
      setPlacementDraft({
        catalogItem: item,
        rotation: chosen.rotation,
        hoverX: chosen.gx,
        hoverY: chosen.gy,
      });
      return;
    }

    if (item.isSolarPanel || item.id === 'solar_panel') {
      const effW = item.width;
      const effD = item.depth;
      const occupiedTiles = new Set<string>();
      for (const existing of clinic.placedItems) {
        const cat = catalogById.get(existing.catalogId);
        if (!cat || cat.isWallDecor) continue;
        const ew = existing.rotation % 2 === 0 ? cat.width : cat.depth;
        const ed = existing.rotation % 2 === 0 ? cat.depth : cat.width;
        const minTx = Math.floor(existing.gridX + 0.05);
        const maxTx = Math.floor(existing.gridX + ew - 0.05);
        const minTy = Math.floor(existing.gridY + 0.05);
        const maxTy = Math.floor(existing.gridY + ed - 0.05);
        for (let tx = minTx; tx <= maxTx; tx++) {
          for (let ty = minTy; ty <= maxTy; ty++) {
            occupiedTiles.add(`${tx},${ty}`);
          }
        }
      }

      const maxSlotX = SOLAR_ZONE.maxX - effW + 1;
      const maxSlotY = SOLAR_ZONE.maxY - effD + 1;
      const preferredXs: number[] = [];
      for (let x = SOLAR_ZONE.minX; x <= maxSlotX; x++) preferredXs.push(x);

      let chosenX: number = SOLAR_ZONE.minX;
      let chosenY: number = SOLAR_ZONE.minY;
      let found = false;

      outerSolar: for (let y = SOLAR_ZONE.minY; y <= maxSlotY; y++) {
        for (const x of preferredXs) {
          let free = true;
          for (let dx = 0; dx < effW && free; dx++) {
            for (let dy = 0; dy < effD; dy++) {
              if (occupiedTiles.has(`${x + dx},${y + dy}`)) {
                free = false;
                break;
              }
            }
          }
          if (free) {
            chosenX = x;
            chosenY = y;
            found = true;
            break outerSolar;
          }
        }
      }

      if (!found) {
        chosenX = SOLAR_ZONE.minX;
        chosenY = SOLAR_ZONE.minY;
      }

      setPlacementDraft({
        catalogItem: item,
        rotation: 0,
        hoverX: chosenX,
        hoverY: chosenY,
      });
      return;
    }

    // Suggest an open default hover coordinate based on indoor vs outdoor
    let defaultX = item.indoorAllowed === false ? 23 : 6;
    let defaultY = item.indoorAllowed === false ? 5 : 14;
    let defaultRot: 0 | 1 | 2 | 3 = 0;
    if (item.id === 'reception_display_stand') {
      const occupiedIndoor = new Set<string>();
      for (const existing of clinic.placedItems) {
        const cat = catalogById.get(existing.catalogId);
        if (!cat || cat.isWallDecor) continue;
        const ew = existing.rotation % 2 === 0 ? cat.width : cat.depth;
        const ed = existing.rotation % 2 === 0 ? cat.depth : cat.width;
        const minTx = Math.floor(existing.gridX + 0.05);
        const maxTx = Math.floor(existing.gridX + ew - 0.05);
        const minTy = Math.floor(existing.gridY + 0.05);
        const maxTy = Math.floor(existing.gridY + ed - 0.05);
        for (let tx = minTx; tx <= maxTx; tx++) {
          for (let ty = minTy; ty <= maxTy; ty++) {
            occupiedIndoor.add(`${tx},${ty}`);
          }
        }
      }
      const preferredReception: Array<[number, number]> = [
        [14, 11],
        [19, 12],
        [19, 13],
        [14, 12],
        [18, 11],
        [13, 12],
        [19, 16],
        [14, 16],
      ];
      let picked = false;
      for (const [rx, ry] of preferredReception) {
        if (!occupiedIndoor.has(`${rx},${ry}`) && isTileWalkable(rx, ry, 0.2, obstacleBoxes)) {
          defaultX = rx;
          defaultY = ry;
          picked = true;
          break;
        }
      }
      if (!picked) {
        outerRec: for (let y = 11; y <= 19; y++) {
          for (let x = 13; x <= 20; x++) {
            if (!occupiedIndoor.has(`${x},${y}`) && isTileWalkable(x, y, 0.2, obstacleBoxes)) {
              defaultX = x;
              defaultY = y;
              break outerRec;
            }
          }
        }
      }
    } else if (item.indoorAllowed === false) {
      const occupiedOutdoor = new Set<string>();
      for (const existing of clinic.placedItems) {
        const cat = catalogById.get(existing.catalogId);
        if (!cat || cat.isWallDecor) continue;
        const ew = existing.rotation % 2 === 0 ? cat.width : cat.depth;
        const ed = existing.rotation % 2 === 0 ? cat.depth : cat.width;
        const minTx = Math.floor(existing.gridX + 0.05);
        const maxTx = Math.floor(existing.gridX + ew - 0.05);
        const minTy = Math.floor(existing.gridY + 0.05);
        const maxTy = Math.floor(existing.gridY + ed - 0.05);
        for (let tx = minTx; tx <= maxTx; tx++) {
          for (let ty = minTy; ty <= maxTy; ty++) {
            occupiedOutdoor.add(`${tx},${ty}`);
          }
        }
      }
      const allowFenceLamps =
        item.sprite === 'street_lamp_post' ||
        item.sprite === 'garden_lamp' ||
        item.sprite === 'garden_spot_lamp';
      const searchBoxes: Array<[number, number, number, number]> = [
        [22, 26, 3, 20], // Courtyard
        [2, 26, 22, 26], // South Lawn
        [11, 21, -4, -3], // Freed North-East Lawn (away from Villa)
        [0, 26, -2, 1], // North Rear Perimeter
        [-1, 1, 0, 5], // West Perimeter (North of solar zone)
        [-1, 1, 20, 25], // West Perimeter (South of solar zone)
      ];
      let foundSpot = false;
      for (const [x0, x1, y0, y1] of searchBoxes) {
        if (foundSpot) break;
        for (let y = y0; y <= y1 - item.depth + 1 && !foundSpot; y++) {
          for (let x = x0; x <= x1 - item.width + 1; x++) {
            let valid = true;
            for (let dx = 0; dx < item.width && valid; dx++) {
              for (let dy = 0; dy < item.depth; dy++) {
                const tx = x + dx;
                const ty = y + dy;
                if (!isTileInOutdoorGarden(tx, ty, allowFenceLamps) || occupiedOutdoor.has(`${tx},${ty}`)) {
                  valid = false;
                  break;
                }
              }
            }
            if (valid && !overlapsActiveWorldTree(x, y, item.width, item.depth, clinic.removedTreeIds || [])) {
              defaultX = x;
              defaultY = y;
              foundSpot = true;
              break;
            }
          }
        }
      }
    } else {
      // Find a clean open indoor spot inside unlocked rooms (supports slim 0.2m dividers in narrow gaps)
      const isFloorMat = (id: string) => id === 'floor_rug' || id === 'stone_pathway';
      const draftIsMat = isFloorMat(item.id);
      const indoorBoxes: Array<{ minX: number; maxX: number; minY: number; maxY: number }> = [];
      for (const existing of clinic.placedItems) {
        const cat = catalogById.get(existing.catalogId);
        if (!cat || cat.isWallDecor) continue;
        if (draftIsMat !== isFloorMat(existing.catalogId)) continue;
        const ew = existing.rotation % 2 === 0 ? cat.width : cat.depth;
        const ed = existing.rotation % 2 === 0 ? cat.depth : cat.width;
        indoorBoxes.push({
          minX: existing.gridX,
          maxX: existing.gridX + ew,
          minY: existing.gridY,
          maxY: existing.gridY + ed,
        });
      }
      const unlockedRooms = [
        ...clinic.rooms.filter((r) => r.unlocked && r.id !== 'room_reception'),
        ...clinic.rooms.filter((r) => r.unlocked && r.id === 'room_reception'),
      ];
      const canDropAt = (gx: number, gy: number, rot: 0 | 1) => {
        const ew = rot === 0 ? item.width : item.depth;
        const ed = rot === 0 ? item.depth : item.width;
        const eps = 0.015;
        const fitsRoom = unlockedRooms.some(
          (r) =>
            gx >= r.minX - eps &&
            gx + ew <= r.maxX + 1 + eps &&
            gy >= r.minY - eps &&
            gy + ed <= r.maxY + 1 + eps
        );
        if (!fitsRoom) return false;
        const tol = 0.03;
        for (const b of indoorBoxes) {
          if (gx + tol < b.maxX && gx + ew - tol > b.minX && gy + tol < b.maxY && gy + ed - tol > b.minY) {
            return false;
          }
        }
        return true;
      };

      if (!canDropAt(defaultX, defaultY, 0)) {
        const isSlim = item.width < 0.45 || item.depth < 0.45;
        const step = isSlim ? 0.25 : 0.5;
        const rots: Array<0 | 1> = isSlim ? [0, 1] : [0];
        let picked = false;
        searchIndoor: for (const r of unlockedRooms) {
          for (const rot of rots) {
            const ew = rot === 0 ? item.width : item.depth;
            const ed = rot === 0 ? item.depth : item.width;
            for (let y = r.minY + 0.5; y <= r.maxY + 1 - ed - 0.25; y += step) {
              for (let x = r.minX + 0.5; x <= r.maxX + 1 - ew - 0.25; x += step) {
                const sx = Math.round(x * 20) / 20;
                const sy = Math.round(y * 20) / 20;
                if (canDropAt(sx, sy, rot)) {
                  defaultX = sx;
                  defaultY = sy;
                  defaultRot = rot;
                  picked = true;
                  break searchIndoor;
                }
              }
            }
          }
        }
        if (!picked && unlockedRooms[0]) {
          defaultX = unlockedRooms[0].minX + 1;
          defaultY = unlockedRooms[0].minY + 1;
        }
      }
    }
    setPlacementDraft({
      catalogItem: item,
      rotation: defaultRot,
      hoverX: defaultX,
      hoverY: defaultY,
    });
  };

  const handleConfirmPlacement = useCallback(
    (gx: number, gy: number, rotation?: 0 | 1 | 2 | 3) => {
      const { placementDraft: curDraft, clinic: curClinic } = latestActionRef.current;
      if (!curDraft) return;
      soundFx.placeItem();

      const finalRotation = rotation ?? curDraft.rotation;
      const room = curClinic.rooms.find(
        (r) => gx >= r.minX - 0.05 && gx < r.maxX + 1 && gy >= r.minY - 0.05 && gy < r.maxY + 1
      );
      const roomId = room ? room.id : 'outdoor';

      const nextPlacedItems = curDraft.movingInstanceId
        ? curClinic.placedItems.map((it) =>
            it.instanceId === curDraft.movingInstanceId
              ? { ...it, gridX: gx, gridY: gy, rotation: finalRotation, roomId }
              : it
          )
        : [
            ...curClinic.placedItems,
            {
              instanceId: 'item_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
              catalogId: curDraft.catalogItem.id,
              gridX: gx,
              gridY: gy,
              rotation: finalRotation,
              roomId,
            },
          ];

      if (curDraft.movingInstanceId) {
        // Moving existing item
        const movedId = curDraft.movingInstanceId;
        const updatedBoxes = buildObstacleBoxes(
          curClinic.rooms,
          nextPlacedItems,
          itemFootprints,
          curClinic.removedTreeIds || []
        );
        const updatedSeats = buildWaitSeatSlots(nextPlacedItems, curClinic.rooms);
        setClinic((prev) => ({
          ...prev,
          placedItems: prev.placedItems.map((it) =>
            it.instanceId === movedId
              ? { ...it, gridX: gx, gridY: gy, rotation: finalRotation, roomId }
              : it
          ),
        }));
        setPatients((prevPts) =>
          prevPts.map((pt) => {
            let nextPt = pt;
            if (pt.attachedDevices?.some((d) => d.instanceId === movedId)) {
              const filtered = pt.attachedDevices.filter((d) => d.instanceId !== movedId);
              nextPt = {
                ...nextPt,
                attachedDevices: filtered.length > 0 ? filtered : undefined,
              };
            }
            if (nextPt.waitingSeatKey && nextPt.waitingSeatKey.startsWith(movedId + '_')) {
              const matchingSeat = updatedSeats.find((s) => s.seatKey === nextPt.waitingSeatKey);
              if (
                matchingSeat &&
                (nextPt.state === 'waiting_checkin' || nextPt.state === 'waiting_in_treatment')
              ) {
                return {
                  ...nextPt,
                  gridX: matchingSeat.seatTileX,
                  gridY: matchingSeat.seatTileY,
                  targetX: matchingSeat.seatTileX,
                  targetY: matchingSeat.seatTileY,
                  seatApproachX: matchingSeat.approachTileX,
                  seatApproachY: matchingSeat.approachTileY,
                  seatFacingRad: matchingSeat.facingRad,
                  seatHeight: matchingSeat.seatHeight,
                };
              }
            }
            if (
              nextPt.state !== 'in_treatment' &&
              nextPt.state !== 'ready_for_exam' &&
              !(
                (nextPt.state === 'waiting_checkin' || nextPt.state === 'waiting_in_treatment') &&
                nextPt.isSeatedWait
              ) &&
              !isTileWalkable(nextPt.gridX, nextPt.gridY, 0.21, updatedBoxes)
            ) {
              const safe = findNearestWalkableTile(nextPt.gridX, nextPt.gridY, 0.22, updatedBoxes);
              return { ...nextPt, gridX: safe.x, gridY: safe.y };
            }
            return nextPt;
          })
        );
        addFloatingFeedback(
          gx,
          gy,
          curClinic.language === 'ar' ? 'تم النقل ✓' : 'Moved ✓',
          '#38bdf8'
        );
      } else {
        // Purchasing new item
        const item = curDraft.catalogItem;
        if (curClinic.coins < item.priceCoins) return;

        const newPlaced = nextPlacedItems[nextPlacedItems.length - 1];
        const updatedBoxes = buildObstacleBoxes(
          curClinic.rooms,
          nextPlacedItems,
          itemFootprints,
          curClinic.removedTreeIds || []
        );

        setClinic((prev) => ({
          ...prev,
          coins: prev.coins >= 900000 ? 999999 : prev.coins - item.priceCoins,
          satisfaction: Math.min(100, prev.satisfaction + Math.min(2, item.satisfactionBonus)),
          placedItems: [...prev.placedItems, newPlaced],
        }));
        setPatients((prevPts) =>
          prevPts.map((pt) => {
            if (
              pt.state !== 'in_treatment' &&
              pt.state !== 'ready_for_exam' &&
              !(
                (pt.state === 'waiting_checkin' || pt.state === 'waiting_in_treatment') &&
                pt.isSeatedWait
              ) &&
              !isTileWalkable(pt.gridX, pt.gridY, 0.21, updatedBoxes)
            ) {
              const safe = findNearestWalkableTile(pt.gridX, pt.gridY, 0.22, updatedBoxes);
              return { ...pt, gridX: safe.x, gridY: safe.y };
            }
            return pt;
          })
        );

        if (item.category === 'equipment') {
          bumpMission('buy_equipment', 1);
        }

        addFloatingFeedback(
          gx,
          gy,
          curClinic.language === 'ar' ? 'تم التثبيت ✓' : 'Placed ✓',
          '#34d399'
        );
      }

      setPlacementDraft(null);
    },
    [itemFootprints, addFloatingFeedback, bumpMission]
  );

  const handleSellMovingDraft = useCallback(
    (instanceId: string) => {
      const { clinic: curClinic } = latestActionRef.current;
      const targetItem = curClinic.placedItems.find((it) => it.instanceId === instanceId);
      if (targetItem) {
        if (
          targetItem.catalogId === 'file_cabinet' &&
          curClinic.placedItems.filter((it) => it.catalogId === 'file_cabinet').length <= 1
        ) {
          soundFx.alert();
          addFloatingFeedback(
            targetItem.gridX,
            targetItem.gridY,
            curClinic.language === 'ar'
              ? 'لا يمكن بيع آخر رف ملفات بالاستقبال'
              : 'Keep at least 1 records shelf',
            '#f87171'
          );
          setPlacementDraft(null);
          return;
        }
        if (
          targetItem.catalogId === 'reception_desk' &&
          curClinic.placedItems.filter((it) => it.catalogId === 'reception_desk').length <= 1
        ) {
          soundFx.alert();
          addFloatingFeedback(
            targetItem.gridX,
            targetItem.gridY,
            curClinic.language === 'ar'
              ? 'لا يمكن بيع مكتب الاستقبال الوحيد'
              : 'Keep at least 1 reception desk',
            '#f87171'
          );
          setPlacementDraft(null);
          return;
        }
      }
      const cat = targetItem ? catalogById.get(targetItem.catalogId) : undefined;
      const refund = cat ? Math.round(cat.priceCoins * 0.7) : 30;
      soundFx.coin();
      setClinic((prev) => ({
        ...prev,
        coins: Math.max(999999, prev.coins + refund),
        placedItems: prev.placedItems.filter((it) => it.instanceId !== instanceId),
      }));
      setPatients((prevPts) =>
        prevPts.map((pt) => {
          if (!pt.attachedDevices?.some((d) => d.instanceId === instanceId)) return pt;
          const filtered = pt.attachedDevices.filter((d) => d.instanceId !== instanceId);
          return {
            ...pt,
            attachedDevices: filtered.length > 0 ? filtered : undefined,
          };
        })
      );
      if (targetItem) {
        addFloatingFeedback(targetItem.gridX, targetItem.gridY, `+${refund}`, '#fbbf24');
      }
      setPlacementDraft(null);
    },
    [catalogById, addFloatingFeedback]
  );

  const handleConfirmUnlockRoom = (room: ClinicRoom, specialty: RoomSpecialty) => {
    if (clinic.coins < room.unlockCost) return;
    soundFx.starSuccess();
    const specMeta = SPECIALTY_META[specialty];

    setClinic((prev) => ({
      ...prev,
      coins: prev.coins >= 900000 ? 999999 : prev.coins - room.unlockCost,
      rooms: prev.rooms.map((r) =>
        r.id === room.id
          ? {
              ...r,
              unlocked: true,
              specialty,
              floorTheme: specMeta.floorTheme,
              nameAr: specMeta.nameAr,
              nameEn: specMeta.nameEn,
            }
          : r
      ),
    }));

    bumpMission('unlock_room', 1);
    setUnlockTargetRoom(null);
    addFloatingFeedback(
      (room.minX + room.maxX) / 2,
      (room.minY + room.maxY) / 2,
      clinic.language === 'ar' ? `تم فتح ${specMeta.nameAr}!` : `${specMeta.nameEn} Unlocked!`,
      '#fbbf24'
    );
  };

  const handleHireStaff = (member: StaffMember) => {
    if (member.hired || clinic.coins < member.hireCost) return;
    soundFx.starSuccess();
    setClinic((prev) => ({
      ...prev,
      coins: prev.coins >= 900000 ? 999999 : prev.coins - member.hireCost,
      staff: prev.staff.map((s) => (s.id === member.id ? { ...s, hired: true } : s)),
    }));
    addFloatingFeedback(
      member.gridX,
      member.gridY,
      clinic.language === 'ar' ? 'تم التوظيف ✓' : 'Hired ✓',
      '#34d399'
    );
  };

  const handleUpdatePlayerProfile = useCallback((nextProfile: PlayerCharacterConfig) => {
    soundFx.tap();
    setClinic((prev) => ({
      ...prev,
      playerProfile: nextProfile,
    }));
  }, []);

  const handleClaimMission = (missionId: string) => {
    const m = clinic.missions.find((ms) => ms.id === missionId);
    if (!m || m.claimed || m.progress < m.target) return;
    soundFx.starSuccess();
    setClinic((prev) => ({
      ...prev,
      coins: prev.coins + m.rewardCoins,
      stars: prev.stars + m.rewardStars,
      missions: prev.missions.map((ms) => (ms.id === missionId ? { ...ms, claimed: true } : ms)),
    }));
  };

  const handleSendFriendGift = (friendId: string) => {
    soundFx.coin();
    setFriends((prev) =>
      prev.map((f) => (f.id === friendId ? { ...f, giftedToday: true } : f))
    );
    setClinic((prev) => ({ ...prev, coins: prev.coins + 25 }));
    bumpMission('visit_friend', 1);
  };

  const handleVisitFriend = (friend: FriendClinic) => {
    soundFx.tap();
    setVisitingFriend(friend);
    setFriendsOpen(false);
    setStoreOpen(false);
    setEditMode(false);
    setPlacementDraft(null);
    bumpMission('visit_friend', 1);
  };

  const handleToggleLanguage = (lang: Language) => {
    persistBootLanguage(lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    setClinic((prev) => ({ ...prev, language: lang }));
  };

  const handleToggleSound = () => {
    setClinic((prev) => {
      const next = !prev.soundEnabled;
      soundFx.enabled = next;
      if (!next) {
        soundFx.stopAllDevices();
      }
      return { ...prev, soundEnabled: next };
    });
  };

  const handleConfirmRemoveTree = () => {
    if (!selectedWorldTree) return;
    const cost = selectedWorldTree.removeCost;
    if (clinic.coins < 900000 && clinic.coins < cost) return;
    soundFx.placeItem();
    const target = selectedWorldTree;
    setClinic((prev) => {
      const existing = prev.removedTreeIds || [];
      if (existing.includes(target.id)) return prev;
      return {
        ...prev,
        coins: prev.coins >= 900000 ? 999999 : prev.coins - cost,
        removedTreeIds: [...existing, target.id],
      };
    });
    addFloatingFeedback(
      Math.round(target.x),
      Math.round(target.z),
      clinic.language === 'ar' ? `تمت إزالة الشجرة · -${cost}` : `Tree Cleared · -${cost}`,
      '#fbbf24'
    );
    setSelectedWorldTree(null);
  };

  const handleResetClinic = () => {
    soundFx.stopAllDevices();
    treatmentTimersRef.current.forEach((t) => clearTimeout(t));
    treatmentTimersRef.current.clear();
    clearFppBlinkTimers();
    fppBlinkLockRef.current = false;
    setFppBlinkPhase('idle');
    if (speakingTimerRef.current) {
      clearTimeout(speakingTimerRef.current);
      speakingTimerRef.current = null;
    }
    activePatientCountRef.current = 0;
    servedCaseIdsRef.current.clear();
    const fresh = createInitialSaveState();
    fresh.language = clinic.language;
    setClinic(fresh);
    setLastSyncedAt(null);
    setPatients([]);
    setSelectedBedPatientId(null);
    setFirstPersonPatientId(null);
    setSpeakingPatientId(null);
    setSelectedWaitingPatientId(null);
    setWaitingQueueOpen(false);
    setPlacementDraft(null);
    setSelectedWorldTree(null);
    setSettingsOpen(false);
  };

  const firstPersonPatient = useMemo(
    () => patients.find((p) => p.id === firstPersonPatientId) || null,
    [patients, firstPersonPatientId]
  );

  const firstPersonStationCat = useMemo(() => {
    if (!firstPersonPatient?.assignedStationId) return undefined;
    const item = clinic.placedItems.find(
      (it) => it.instanceId === firstPersonPatient.assignedStationId
    );
    return item ? catalogById.get(item.catalogId) : undefined;
  }, [firstPersonPatient?.assignedStationId, clinic.placedItems, catalogById]);

  useEffect(() => {
    setFppNearbyDevice(null);
    setFppHeldDevice(null);
    setFppActiveDevice(null);
  }, [firstPersonPatientId]);

  const selectedBedPatient = useMemo(() => {
    if (!selectedBedPatientId) return null;
    const found = patients.find((p) => p.id === selectedBedPatientId);
    if (!found || (found.state !== 'ready_for_exam' && found.state !== 'in_exam')) {
      return null;
    }
    return found;
  }, [patients, selectedBedPatientId]);

  const selectedWaitingPatient = useMemo(() => {
    if (!selectedWaitingPatientId) return null;
    const found = patients.find((p) => p.id === selectedWaitingPatientId);
    if (
      !found ||
      (found.state !== 'waiting_checkin' &&
        found.state !== 'walking_to_wait' &&
        found.state !== 'walking_to_water' &&
        found.state !== 'drinking_water')
    ) {
      return null;
    }
    return found;
  }, [patients, selectedWaitingPatientId]);

  const selectedTreatmentWaitPatient = useMemo(() => {
    if (!selectedTreatmentWaitPatientId) return null;
    const found = patients.find((p) => p.id === selectedTreatmentWaitPatientId);
    if (
      !found ||
      (found.state !== 'waiting_in_treatment' && found.state !== 'walking_to_treatment_wait')
    ) {
      return null;
    }
    return found;
  }, [patients, selectedTreatmentWaitPatientId]);

  const treatmentHallWaitingPatients = useMemo(
    () =>
      patients.filter(
        (p) => p.state === 'waiting_in_treatment' || p.state === 'walking_to_treatment_wait'
      ),
    [patients]
  );

  const freeStationsList = useMemo(() => {
    const occupiedIds = new Set(
      patients
        .filter((p) => p.state !== 'treated_leaving' && p.assignedStationId)
        .map((p) => p.assignedStationId!)
    );
    return clinic.placedItems
      .filter((item) => {
        const cat = catalogById.get(item.catalogId);
        if (!cat?.isTreatmentStation || !ASSIGNABLE_STATION_SPRITES.has(cat.sprite)) return false;
        const room = clinic.rooms.find((r) => r.id === item.roomId);
        return (!room || room.unlocked) && !occupiedIds.has(item.instanceId);
      })
      .map((item) => ({
        item,
        cat: catalogById.get(item.catalogId)!,
        room: clinic.rooms.find((r) => r.id === item.roomId),
      }));
  }, [patients, clinic.placedItems, clinic.rooms, catalogById]);

  const pendingStationForPick = useMemo(() => {
    if (!pendingStationIdForPick || treatmentHallWaitingPatients.length === 0) return null;
    return freeStationsList.find((entry) => entry.item.instanceId === pendingStationIdForPick) || null;
  }, [pendingStationIdForPick, freeStationsList, treatmentHallWaitingPatients.length]);

  const { waitingPatientsCount, totalStationsCount, callableSlotsCount } = useMemo(() => {
    const waiting = patients.filter(
      (p) =>
        p.state === 'waiting_checkin' ||
        p.state === 'walking_to_wait' ||
        p.state === 'walking_to_water' ||
        p.state === 'drinking_water'
    ).length;
    const occupiedIds = new Set(
      patients
        .filter((p) => p.state !== 'treated_leaving' && p.assignedStationId)
        .map((p) => p.assignedStationId!)
    );
    const unlockedBeds = clinic.placedItems.filter((item) => {
      const cat = catalogById.get(item.catalogId);
      if (!cat?.isTreatmentStation || !ASSIGNABLE_STATION_SPRITES.has(cat.sprite)) return false;
      const room = clinic.rooms.find((r) => r.id === item.roomId);
      return !room || room.unlocked;
    });
    const free = unlockedBeds.filter((st) => !occupiedIds.has(st.instanceId)).length;
    const hallWait = patients.filter(
      (p) => p.state === 'waiting_in_treatment' || p.state === 'walking_to_treatment_wait'
    ).length;
    return {
      waitingPatientsCount: waiting,
      totalStationsCount: unlockedBeds.length,
      callableSlotsCount: Math.max(0, free - hallWait),
    };
  }, [patients, clinic.placedItems, clinic.rooms, catalogById]);

  const displayedRooms = visitingFriend ? visitingFriend.rooms : clinic.rooms;
  const displayedItems = visitingFriend ? visitingFriend.placedItems : clinic.placedItems;
  const displayedPatients = visitingFriend ? [] : patients;
  const displayedStaff = visitingFriend ? [] : clinic.staff;

  const isAr = clinic.language === 'ar';
  const canUnlockAnyRoom = useMemo(
    () => clinic.rooms.some((r) => !r.unlocked && clinic.coins >= r.unlockCost),
    [clinic.rooms, clinic.coins]
  );
  const onlineFriendsCount = useMemo(
    () => friends.filter((f) => f.online).length,
    [friends]
  );
  const missionsReadyCount = useMemo(
    () => clinic.missions.filter((m) => m.progress >= m.target && !m.claimed).length,
    [clinic.missions]
  );
  const isoShortcutsBlocked = Boolean(
    !bootDismissed ||
      storeOpen ||
      missionsOpen ||
      friendsOpen ||
      settingsOpen ||
      bonusOpen ||
      characterModalOpen ||
      waitingQueueOpen ||
      unlockTargetRoom ||
      selectedWorldTree
  );

  const handleOrbitStepDelta = useCallback((delta: number) => {
    soundFx.tap();
    setOrbitStep((s) => s + delta);
  }, []);

  const handleToggleLightingMode = useCallback(() => {
    soundFx.tap();
    setClinic((prev) => ({
      ...prev,
      lightingMode: prev.lightingMode === 'night' ? 'day' : 'night',
    }));
  }, []);

  const handleOpenBonus = useCallback(() => {
    soundFx.tap();
    setSelectedWaitingPatientId(null);
    setBonusOpen(true);
  }, []);
  const handleOpenWaitingQueue = useCallback(() => {
    soundFx.tap();
    setSelectedWaitingPatientId(null);
    setStoreOpen(false);
    setMissionsOpen(false);
    setActiveNavTab(null);
    setWaitingQueueOpen(true);
  }, []);
  const handleOpenFriends = useCallback(() => {
    soundFx.tap();
    setSelectedWaitingPatientId(null);
    setFriendsOpen(true);
  }, []);
  const handleOpenSettings = useCallback(() => {
    soundFx.tap();
    setSelectedWaitingPatientId(null);
    setSettingsOpen(true);
  }, []);
  const handleOpenPlayerProfile = useCallback(() => {
    soundFx.tap();
    setStoreOpen(false);
    setWaitingQueueOpen(false);
    setSelectedWaitingPatientId(null);
    setCharacterModalOpen(true);
    setEditMode(false);
    setPlacementDraft(null);
    setActiveNavTab(null);
  }, []);
  const handleExitFriendVisit = useCallback(() => {
    soundFx.tap();
    setVisitingFriend(null);
  }, []);
  const handleToggleEditMode = useCallback(() => {
    soundFx.tap();
    setPlacementDraft(null);
    setStoreOpen(false);
    setMissionsOpen(false);
    setWaitingQueueOpen(false);
    setSelectedWaitingPatientId(null);
    setActiveNavTab(null);
    setEditMode((v) => !v);
  }, []);

  const handleFppActiveBedDeviceChange = useCallback((next: FppActiveDeviceState | null) => {
    setFppActiveDevice((prev) => {
      if (next && (prev?.instanceId ?? prev?.catalogId) !== (next.instanceId ?? next.catalogId)) {
        soundFx.tap();
      }
      return next;
    });
  }, []);

  const handleSceneReady = useCallback(() => setSceneReady(true), []);

  const handleTapLockedRoom = useCallback((room: ClinicRoom) => {
    if (!latestActionRef.current.visitingFriend) {
      soundFx.tap();
      setUnlockTargetRoom(room);
    }
  }, []);

  const handleTapWorldTree = useCallback((tree: WorldTreeDef) => {
    if (!latestActionRef.current.visitingFriend) {
      soundFx.tap();
      setSelectedWorldTree(tree);
    }
  }, []);

  const handleTapPlacedItem = useCallback(
    (item: PlacedItem) => {
      const { visitingFriend: curVisiting, editMode: curEditMode } = latestActionRef.current;
      if (curVisiting || !curEditMode) return;
      const cat = catalogById.get(item.catalogId);
      if (!cat) return;
      soundFx.tap();
      setPlacementDraft({
        catalogItem: cat,
        movingInstanceId: item.instanceId,
        rotation: item.rotation,
        hoverX: item.gridX,
        hoverY: item.gridY,
      });
    },
    [catalogById]
  );

  const handleStartDragPlacedItem = useCallback(
    (item: PlacedItem) => {
      const { visitingFriend: curVisiting, editMode: curEditMode } = latestActionRef.current;
      if (curVisiting || !curEditMode) return;
      const cat = catalogById.get(item.catalogId);
      if (!cat) return;
      setPlacementDraft({
        catalogItem: cat,
        movingInstanceId: item.instanceId,
        rotation: item.rotation,
        hoverX: item.gridX,
        hoverY: item.gridY,
      });
    },
    [catalogById]
  );

  const handleSwitchEditingItem = useCallback(
    (nextItem: PlacedItem, commitCurrent = true) => {
      const {
        visitingFriend: curVisiting,
        editMode: curEditMode,
        placementDraft: curDraft,
        clinic: curClinic,
      } = latestActionRef.current;
      if (curVisiting || !curEditMode) return;
      const nextCat = catalogById.get(nextItem.catalogId);
      if (!nextCat) return;
      soundFx.tap();
      if (commitCurrent && curDraft?.movingInstanceId) {
        const prev = curDraft;
        const targetRoom = curClinic.rooms.find(
          (r) =>
            prev.hoverX >= r.minX - 0.05 &&
            prev.hoverX < r.maxX + 1 &&
            prev.hoverY >= r.minY - 0.05 &&
            prev.hoverY < r.maxY + 1
        );
        const nextRoomId = targetRoom ? targetRoom.id : 'outdoor';
        const isMoved = curClinic.placedItems.some(
          (it) =>
            it.instanceId === prev.movingInstanceId &&
            (it.gridX !== prev.hoverX ||
              it.gridY !== prev.hoverY ||
              it.rotation !== prev.rotation)
        );
        if (isMoved) {
          setClinic((cur) => ({
            ...cur,
            placedItems: cur.placedItems.map((it) =>
              it.instanceId === prev.movingInstanceId
                ? {
                    ...it,
                    gridX: prev.hoverX,
                    gridY: prev.hoverY,
                    rotation: prev.rotation,
                    roomId: nextRoomId,
                  }
                : it
            ),
          }));
        }
      }
      setPlacementDraft({
        catalogItem: nextCat,
        movingInstanceId: nextItem.instanceId,
        rotation: nextItem.rotation,
        hoverX: nextItem.gridX,
        hoverY: nextItem.gridY,
      });
    },
    [catalogById]
  );

  const handleInspectItem = useCallback(
    (item: PlacedItem) => {
      const curPts = latestActionRef.current.patients;
      const assignedPatient = curPts.find(
        (pt) => pt.assignedStationId === item.instanceId && pt.state !== 'treated_leaving'
      );
      if (assignedPatient) {
        handleTapPatient(assignedPatient);
        return;
      }
      const cat = catalogById.get(item.catalogId);
      if (cat?.isTreatmentStation && ASSIGNABLE_STATION_SPRITES.has(cat.sprite)) {
        const curRooms = latestActionRef.current.clinic.rooms;
        const room = curRooms.find((r) => r.id === item.roomId);
        if (!room || room.unlocked) {
          const curSelectedId = latestActionRef.current.selectedTreatmentWaitPatientId;
          const hallWaiting = curPts.filter(
            (pt) =>
              pt.state === 'waiting_in_treatment' || pt.state === 'walking_to_treatment_wait'
          );
          if (curSelectedId && hallWaiting.some((pt) => pt.id === curSelectedId)) {
            assignTreatmentPatientToStation(curSelectedId, item.instanceId);
            return;
          }
          if (hallWaiting.length === 1) {
            assignTreatmentPatientToStation(hallWaiting[0].id, item.instanceId);
            return;
          }
          if (hallWaiting.length > 1) {
            soundFx.tap();
            setSelectedWaitingPatientId(null);
            setSelectedBedPatientId(null);
            setSelectedTreatmentWaitPatientId(null);
            setPendingStationIdForPick((cur) =>
              cur === item.instanceId ? null : item.instanceId
            );
            return;
          }
        }
      }
      if (cat && (cat.isTreatmentStation || cat.speedBonus > 0)) {
        soundFx.tap();
        addFloatingFeedback(
          item.gridX,
          item.gridY,
          `${latestActionRef.current.clinic.language === 'ar' ? cat.nameAr : cat.nameEn} · ⚡ +${cat.speedBonus}%`,
          '#38bdf8'
        );
      }
    },
    [catalogById, handleTapPatient, assignTreatmentPatientToStation, addFloatingFeedback]
  );

  const handleUpdatePlacementHover = useCallback(
    (gx: number, gy: number, rotation?: 0 | 1 | 2 | 3) => {
      setPlacementDraft((prev) =>
        prev ? { ...prev, hoverX: gx, hoverY: gy, rotation: rotation ?? prev.rotation } : null
      );
    },
    []
  );

  const handleCancelPlacement = useCallback(() => {
    soundFx.tap();
    setPlacementDraft(null);
  }, []);

  const handleRotatePlacement = useCallback(() => {
    soundFx.tap();
    setPlacementDraft((prev) => {
      if (!prev) return null;
      const curClinic = latestActionRef.current.clinic;
      if (prev.catalogItem.isWallDecor || isWallDecorId(prev.catalogItem.id)) {
        const validRots = getValidWallRotationsForTile(
          Math.floor(prev.hoverX + 0.05),
          Math.floor(prev.hoverY + 0.05),
          curClinic.rooms
        );
        if (validRots.length > 1) {
          const idx = validRots.indexOf(prev.rotation);
          const nextRot = validRots[(idx + 1) % validRots.length];
          return { ...prev, rotation: nextRot };
        }
        const targetRot: 0 | 1 = prev.rotation === 0 ? 1 : 0;
        const occupiedWallKeys = new Set<string>();
        for (const existing of curClinic.placedItems) {
          if (existing.instanceId === prev.movingInstanceId) continue;
          const ec = catalogById.get(existing.catalogId);
          if (!ec?.isWallDecor && !isWallDecorId(existing.catalogId)) continue;
          occupiedWallKeys.add(`${existing.gridX},${existing.gridY},${existing.rotation}`);
        }
        let best: { gx: number; gy: number; rotation: 0 | 1; distSq: number } | null = null;
        for (let gx = 2; gx <= 21; gx++) {
          for (let gy = 2; gy <= 21; gy++) {
            const rots = getValidWallRotationsForTile(gx, gy, curClinic.rooms);
            if (!rots.includes(targetRot)) continue;
            if (occupiedWallKeys.has(`${gx},${gy},${targetRot}`)) continue;
            const distSq =
              (gx - prev.hoverX) * (gx - prev.hoverX) +
              (gy - prev.hoverY) * (gy - prev.hoverY);
            if (!best || distSq < best.distSq) {
              best = { gx, gy, rotation: targetRot, distSq };
            }
          }
        }
        if (best) {
          return {
            ...prev,
            hoverX: best.gx,
            hoverY: best.gy,
            rotation: best.rotation,
          };
        }
        return prev;
      }
      return { ...prev, rotation: ((prev.rotation + 1) % 4) as 0 | 1 | 2 | 3 };
    });
  }, [catalogById]);

  // PC Keyboard Shortcuts & Escape Dismissal for Isometric Clinic View
  useEffect(() => {
    if (!bootDismissed || isFppSessionActive) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
        }
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === 'Escape') {
        if (unlockTargetRoom) {
          setUnlockTargetRoom(null);
          return;
        }
        if (selectedWorldTree) {
          setSelectedWorldTree(null);
          return;
        }
        if (settingsOpen) {
          setSettingsOpen(false);
          return;
        }
        if (bonusOpen) {
          setBonusOpen(false);
          return;
        }
        if (friendsOpen) {
          setFriendsOpen(false);
          return;
        }
        if (characterModalOpen) {
          setCharacterModalOpen(false);
          return;
        }
        if (waitingQueueOpen) {
          setWaitingQueueOpen(false);
          return;
        }
        if (missionsOpen) {
          setMissionsOpen(false);
          setActiveNavTab(null);
          return;
        }
        if (storeOpen) {
          setStoreOpen(false);
          setActiveNavTab(null);
          return;
        }
        if (selectedWaitingPatientId) {
          setSelectedWaitingPatientId(null);
          return;
        }
        if (selectedTreatmentWaitPatientId) {
          setSelectedTreatmentWaitPatientId(null);
          return;
        }
        if (pendingStationIdForPick) {
          setPendingStationIdForPick(null);
          return;
        }
        if (selectedBedPatientId) {
          setSelectedBedPatientId(null);
          return;
        }
        if (placementDraft) {
          setPlacementDraft(null);
          return;
        }
        if (editMode) {
          setEditMode(false);
          return;
        }
        if (visitingFriend) {
          setVisitingFriend(null);
          return;
        }
        return;
      }

      if (e.repeat) return;
      const k = e.key.toLowerCase();

      if (k === 'k') {
        e.preventDefault();
        if (friendsOpen) {
          setFriendsOpen(false);
        } else if (!isoShortcutsBlocked) {
          handleOpenFriends();
        }
        return;
      }

      if (isoShortcutsBlocked || visitingFriend) return;

      if (k === 'b') {
        e.preventDefault();
        handleSelectNavTab('store');
      } else if (k === 'm') {
        e.preventDefault();
        handleSelectNavTab('missions');
      } else if (e.key === 'Tab' || k === 'n') {
        e.preventDefault();
        handleOpenWaitingQueue();
      } else if (k === 'u') {
        e.preventDefault();
        handleOpenPlayerProfile();
      } else if (k === 'v') {
        e.preventDefault();
        handleToggleEditMode();
      } else if (k === 'l') {
        e.preventDefault();
        handleToggleLightingMode();
      } else if (k === 'q' && !placementDraft) {
        e.preventDefault();
        handleOrbitStepDelta(-1);
      } else if (k === 'e' && !placementDraft) {
        e.preventDefault();
        handleOrbitStepDelta(1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    bootDismissed,
    isFppSessionActive,
    isoShortcutsBlocked,
    visitingFriend,
    unlockTargetRoom,
    selectedWorldTree,
    settingsOpen,
    bonusOpen,
    friendsOpen,
    characterModalOpen,
    waitingQueueOpen,
    missionsOpen,
    storeOpen,
    selectedWaitingPatientId,
    selectedTreatmentWaitPatientId,
    pendingStationIdForPick,
    selectedBedPatientId,
    placementDraft,
    editMode,
    handleSelectNavTab,
    handleOpenWaitingQueue,
    handleOpenFriends,
    handleOpenPlayerProfile,
    handleToggleEditMode,
    handleToggleLightingMode,
    handleOrbitStepDelta,
  ]);

  const handleFppHudChangePosture = useCallback(
    (nextPosture: FppPatientPosture) => {
      soundFx.tap();
      handleSetPatientFppPosture(nextPosture, firstPersonPatientId);
    },
    [handleSetPatientFppPosture, firstPersonPatientId]
  );

  const handleFppHudGrabDevice = useCallback((catalogId: string) => {
    soundFx.tap();
    fppDeviceCmdRef.current?.grabDevice(catalogId);
  }, []);

  const handleFppHudPlaceHeldDevice = useCallback(() => {
    soundFx.tap();
    fppDeviceCmdRef.current?.placeHeldDevice();
  }, []);

  const handleFppHudReturnDevice = useCallback((catalogId: string) => {
    soundFx.tap();
    fppDeviceCmdRef.current?.returnDevice(catalogId);
  }, []);

  const handleFppHudUpdateActiveDevice = useCallback((next: FppActiveDeviceState) => {
    fppDeviceCmdRef.current?.updateActiveBedDevice(next);
  }, []);

  const handleFppHudOpenStationConsole = useCallback((deviceId: string) => {
    soundFx.tap();
    fppDeviceCmdRef.current?.openStationConsole?.(deviceId);
  }, []);

  const handleFppHudCloseActiveDevice = useCallback(() => {
    soundFx.tap();
    setFppActiveDevice(null);
  }, []);

  const handleFppHudHandshake = useCallback(() => {
    soundFx.tap();
    fppDeviceCmdRef.current?.triggerHandshake?.();
  }, []);

  const handleFppHudRecenterCamera = useCallback(() => {
    soundFx.tap();
    setFppRecenterNonce((n) => n + 1);
  }, []);

  const handleFppHudExit = useCallback(() => {
    soundFx.tap();
    triggerFppBlinkTransition(() => {
      soundFx.stopAllDevices();
      setFirstPersonPatientId(null);
      setFppNearbyDevice(null);
      setFppHeldDevice(null);
      setFppActiveDevice(null);
      setFppHandshakeReady(false);
      setFppHoverBodyZone(null);
      setSpeakingPatientId(null);
      if (speakingTimerRef.current) {
        clearTimeout(speakingTimerRef.current);
        speakingTimerRef.current = null;
      }
    });
  }, [triggerFppBlinkTransition]);

  return (
    <main
      className={`relative w-screen h-[100dvh] overflow-hidden transition-colors duration-500 ${
        lightingMode === 'night' ? 'bg-[#050a18]' : 'bg-[#5aa332]'
      }`}
    >
      {/* 2.5D Isometric Clinic Canvas (mounts right after splash frame 0 paints) */}
      {canvasMounted && (
        <ClinicCanvas
          rooms={displayedRooms}
          placedItems={displayedItems}
          patients={displayedPatients}
          staff={displayedStaff}
          playerProfile={clinic.playerProfile || DEFAULT_PLAYER_PROFILE}
          showPlayerCharacter={!visitingFriend}
          floatingFeedbacks={floatingFeedbacks}
          firstPersonPatientId={visitingFriend ? null : firstPersonPatientId}
          orbitStep={orbitStep}
          onOrbitStepDelta={handleOrbitStepDelta}
          shortcutsBlocked={
            isoShortcutsBlocked ||
            Boolean(
              selectedWaitingPatientId ||
                selectedTreatmentWaitPatientId ||
                pendingStationIdForPick ||
                selectedBedPatientId
            )
          }
          fppPosture={fppPosture}
          fppActiveDevice={visitingFriend ? null : fppActiveDevice}
          fppCommandRef={fppDeviceCmdRef}
          fppRecenterNonce={fppRecenterNonce}
          fppMoveInputRef={fppMoveInputRef}
          onFppNearbyDeviceChange={setFppNearbyDevice}
          onFppHeldDeviceChange={setFppHeldDevice}
          onFppHandshakeReadyChange={setFppHandshakeReady}
          onFppHoverBodyZoneChange={setFppHoverBodyZone}
          onFppActiveBedDeviceChange={handleFppActiveBedDeviceChange}
          onFppRequirePosture={handleSetPatientFppPosture}
          onSyncPatientDevices={handleSyncPatientDevices}
          speakingPatientId={visitingFriend ? null : speakingPatientId}
          selectedBedPatientId={visitingFriend ? null : selectedBedPatientId}
          selectedTreatmentWaitPatientId={visitingFriend ? null : selectedTreatmentWaitPatientId}
          pendingStationIdForPick={visitingFriend ? null : pendingStationIdForPick}
          placementDraft={placementDraft}
          editMode={editMode && !visitingFriend}
          language={clinic.language}
          lightingMode={lightingMode}
          removedTreeIds={visitingFriend ? EMPTY_REMOVED_TREES : clinic.removedTreeIds ?? EMPTY_REMOVED_TREES}
          selectedTreeId={visitingFriend ? null : selectedWorldTree?.id || null}
          hideInternalLoader={!bootDismissed}
          onSceneReady={handleSceneReady}
          onReceptionCheckinDone={handleReceptionCheckinDone}
          onTapPatient={handleTapPatient}
          onTapLockedRoom={handleTapLockedRoom}
          onTapWorldTree={handleTapWorldTree}
          onTapPlacedItem={handleTapPlacedItem}
          onStartDragPlacedItem={handleStartDragPlacedItem}
          onSwitchEditingItem={handleSwitchEditingItem}
          onTapReceptionDesk={handleTapReceptionDesk}
          onInspectItem={handleInspectItem}
          onUpdatePlacementHover={handleUpdatePlacementHover}
          onConfirmPlacement={handleConfirmPlacement}
          onCancelPlacement={handleCancelPlacement}
          onRotatePlacement={handleRotatePlacement}
          onSellMovingDraft={handleSellMovingDraft}
        />
      )}

      {/* Top HUD Cluster & Bottom Navigation (hidden in First-Person Clinical Session) */}
      {!firstPersonPatient && (
        <>
          <TopHudBar
            coins={clinic.coins}
            stars={clinic.stars}
            level={clinic.level || 1}
            xp={clinic.xp || 0}
            waitingCount={waitingPatientsCount}
            onlineFriends={onlineFriendsCount}
            satisfaction={clinic.satisfaction}
            language={clinic.language}
            lightingMode={lightingMode}
            playerProfile={clinic.playerProfile || DEFAULT_PLAYER_PROFILE}
            visitingFriendName={
              visitingFriend ? (isAr ? visitingFriend.nameAr : visitingFriend.nameEn) : null
            }
            onOpenBonus={handleOpenBonus}
            onOpenWaitingQueue={handleOpenWaitingQueue}
            onOpenFriends={handleOpenFriends}
            onOpenSettings={handleOpenSettings}
            onOpenPlayerProfile={handleOpenPlayerProfile}
            onExitFriendVisit={handleExitFriendVisit}
          />

          <BottomNavBar
            activeTab={activeNavTab}
            editMode={editMode && !visitingFriend}
            language={clinic.language}
            lightingMode={lightingMode}
            storeAlert={canUnlockAnyRoom}
            disabled={Boolean(visitingFriend)}
            waitingCount={waitingPatientsCount}
            missionsReadyCount={missionsReadyCount}
            onlineFriends={onlineFriendsCount}
            onSelectTab={handleSelectNavTab}
            onToggleEditMode={handleToggleEditMode}
            onOpenWaitingQueue={!visitingFriend ? handleOpenWaitingQueue : undefined}
            onOpenFriends={handleOpenFriends}
            onToggleLightingMode={handleToggleLightingMode}
          />
        </>
      )}

      {/* First-Person Bedside Examination & Treatment HUD */}
      {firstPersonPatient && !visitingFriend && (
        <FirstPersonSessionHud
          key={firstPersonPatient.id}
          patient={firstPersonPatient}
          stationSprite={firstPersonStationCat?.sprite}
          stationNameEn={firstPersonStationCat?.nameEn}
          posture={fppPosture}
          onChangePosture={handleFppHudChangePosture}
          nearbyDevice={fppNearbyDevice}
          heldDevice={fppHeldDevice}
          activeDevice={fppActiveDevice}
          onGrabDevice={handleFppHudGrabDevice}
          onPlaceHeldDevice={handleFppHudPlaceHeldDevice}
          onReturnDevice={handleFppHudReturnDevice}
          onUpdateActiveDevice={handleFppHudUpdateActiveDevice}
          onOpenStationConsole={handleFppHudOpenStationConsole}
          onCloseActiveDevice={handleFppHudCloseActiveDevice}
          handshakeReady={fppHandshakeReady}
          onHandshake={handleFppHudHandshake}
          hoverBodyZone={fppHoverBodyZone}
          language={clinic.language}
          lightingMode={lightingMode}
          moveInputRef={fppMoveInputRef}
          onPatientSpeak={handlePatientSpeak}
          onRecenterCamera={handleFppHudRecenterCamera}
          onExit={handleFppHudExit}
          onCompleteCase={handleCompleteCase}
        />
      )}

      {/* Store / Build / Equipment / Decor Drawer */}
      <StoreSheet
        open={storeOpen}
        initialFilter={storeFilter}
        coins={clinic.coins}
        rooms={clinic.rooms}
        staff={clinic.staff}
        language={clinic.language}
        lightingMode={lightingMode}
        onClose={() => {
          setStoreOpen(false);
          setActiveNavTab(null);
        }}
        onBuyAndPlace={handleBuyAndPlace}
        onSelectRoomToUnlock={(room) => {
          setStoreOpen(false);
          setUnlockTargetRoom(room);
        }}
        onHireStaff={handleHireStaff}
      />

      {/* Player Character Customizer (opened from Top-Left HUD Card) */}
      <PlayerCharacterModal
        open={characterModalOpen}
        profile={normalizePlayerProfile(clinic.playerProfile)}
        language={clinic.language}
        lightingMode={lightingMode}
        onClose={() => setCharacterModalOpen(false)}
        onChange={handleUpdatePlayerProfile}
      />

      {/* Room Unlock & Specialty Picker */}
      <RoomUnlockModal
        room={unlockTargetRoom}
        coins={clinic.coins}
        language={clinic.language}
        lightingMode={lightingMode}
        onClose={() => setUnlockTargetRoom(null)}
        onConfirmUnlock={handleConfirmUnlockRoom}
      />

      {/* Daily Missions */}
      <MissionsModal
        open={missionsOpen}
        missions={clinic.missions}
        patientsTreatedTotal={clinic.patientsTreatedTotal}
        redFlagsCaughtTotal={clinic.redFlagsCaughtTotal}
        language={clinic.language}
        lightingMode={lightingMode}
        onClose={() => {
          setMissionsOpen(false);
          setActiveNavTab(null);
        }}
        onClaimMission={handleClaimMission}
      />

      {/* Colleague Clinics Visit & Gift */}
      <FriendsModal
        open={friendsOpen}
        friends={friends}
        language={clinic.language}
        lightingMode={lightingMode}
        onClose={() => setFriendsOpen(false)}
        onVisitFriend={handleVisitFriend}
        onSendGift={handleSendFriendGift}
      />

      {/* Settings */}
      <SettingsModal
        open={settingsOpen}
        language={clinic.language}
        soundEnabled={clinic.soundEnabled}
        lightingMode={lightingMode}
        studentId={clinic.studentId}
        lastSyncedAt={lastSyncedAt ?? clinic.lastSyncedAt}
        onClose={() => setSettingsOpen(false)}
        onToggleLanguage={handleToggleLanguage}
        onToggleSound={handleToggleSound}
        onChangeLightingMode={(mode) => {
          soundFx.tap();
          setClinic((prev) => ({ ...prev, lightingMode: mode }));
        }}
        onManualSync={() => {
          soundFx.tap();
          scheduleSilentCloudSync(clinic, (iso) => {
            setLastSyncedAt(iso);
          });
        }}
        onResetClinic={handleResetClinic}
      />

      {/* Outdoor Tree Paid Removal Confirmation Card */}
      {selectedWorldTree && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-950/55 pointer-events-auto"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setSelectedWorldTree(null)}
        >
          <div
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm rounded-3xl border shadow-2xl p-5 transition-colors ${
              lightingMode === 'night'
                ? 'bg-slate-900 border-slate-700 text-slate-100'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                  <Trees className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black">
                    {isAr
                      ? `إزالة ${TREE_SPECIES_LABELS[selectedWorldTree.species].ar}`
                      : `Remove ${TREE_SPECIES_LABELS[selectedWorldTree.species].en}`}
                  </h3>
                  <p
                    className={`text-xs mt-0.5 ${
                      lightingMode === 'night' ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    {isAr
                      ? 'ادفع رسوم الإزالة لاقتلاع هذه الشجرة البرية من محيط العيادة نهائياً'
                      : 'Pay the clearing fee to remove this wild perimeter tree permanently'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedWorldTree(null)}
                aria-label="Close"
                className={`p-2 rounded-xl transition-colors touch-manipulation cursor-pointer ${
                  lightingMode === 'night'
                    ? 'text-slate-400 hover:bg-slate-800'
                    : 'text-slate-400 hover:bg-slate-100'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedWorldTree(null)}
                className={`flex-1 min-h-[48px] py-2.5 px-3 rounded-2xl text-xs font-extrabold transition-colors touch-manipulation cursor-pointer ${
                  lightingMode === 'night'
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={clinic.coins < 900000 && clinic.coins < selectedWorldTree.removeCost}
                onClick={handleConfirmRemoveTree}
                className={`flex-[1.4] min-h-[48px] py-2.5 px-4 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 shadow transition-transform active:scale-95 touch-manipulation cursor-pointer ${
                  clinic.coins >= 900000 || clinic.coins >= selectedWorldTree.removeCost
                    ? 'bg-gradient-to-b from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-600 text-slate-950'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                <span>{isAr ? 'إزالة' : 'Remove'}</span>
                <span aria-hidden="true">·</span>
                <Coins className="w-3.5 h-3.5" />
                <span className="tabular-nums">{selectedWorldTree.removeCost}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tapped Waiting Patient Quick Call-In Action Card */}
      {selectedWaitingPatient && !visitingFriend && (
        <div
          dir={isAr ? 'rtl' : 'ltr'}
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto fixed bottom-[calc(env(safe-area-inset-bottom,0px)+5.75rem)] sm:bottom-24 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1.5rem)] max-w-sm"
        >
          <div
            className={`rounded-3xl border shadow-2xl p-4 ${
              lightingMode === 'night'
                ? 'bg-slate-900 border-sky-400/35 text-slate-100'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-start justify-between gap-2.5">
              <div className="min-w-0">
                <div className="text-sm font-black truncate">
                  {isAr
                    ? selectedWaitingPatient.clinicalCase.patientNameAr
                    : selectedWaitingPatient.clinicalCase.patientNameEn}
                </div>
                <div
                  className={`text-xs mt-0.5 truncate ${
                    lightingMode === 'night' ? 'text-slate-300' : 'text-slate-600'
                  }`}
                >
                  {selectedWaitingPatient.clinicalCase.age} {isAr ? 'سنة' : 'y'} ·{' '}
                  {isAr
                    ? SPECIALTY_META[selectedWaitingPatient.clinicalCase.specialty]?.nameAr ||
                      selectedWaitingPatient.clinicalCase.specialty
                    : SPECIALTY_META[selectedWaitingPatient.clinicalCase.specialty]?.nameEn ||
                      selectedWaitingPatient.clinicalCase.specialty}
                </div>
                <div
                  className={`text-[11px] mt-1 flex items-center gap-1.5 tabular-nums ${
                    lightingMode === 'night' ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  <Clock className="w-3 h-3 text-sky-500 shrink-0" />
                  <span>
                    {selectedWaitingPatient.isSeatedWait === false
                      ? isAr
                        ? 'واقف في صالة الاستقبال'
                        : 'Standing in reception'
                      : isAr
                        ? 'جالس في كرسي الانتظار'
                        : 'Seated in waiting chair'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {isAr
                      ? `أماكن متاحة: ${callableSlotsCount}`
                      : `Open bays: ${callableSlotsCount}`}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedWaitingPatientId(null)}
                aria-label={isAr ? 'إغلاق' : 'Close'}
                className={`p-1.5 rounded-xl shrink-0 transition-colors cursor-pointer ${
                  lightingMode === 'night'
                    ? 'text-slate-400 hover:bg-slate-800'
                    : 'text-slate-400 hover:bg-slate-100'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedWaitingPatientId(null)}
                className={`px-3.5 min-h-[42px] rounded-2xl text-xs font-extrabold transition-colors cursor-pointer ${
                  lightingMode === 'night'
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {isAr ? 'إغلاق' : 'Dismiss'}
              </button>
              <button
                type="button"
                disabled={callableSlotsCount === 0}
                onClick={() => callPatientToStation(selectedWaitingPatient.id)}
                className={`flex-1 min-h-[42px] px-4 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                  callableSlotsCount > 0
                    ? 'bg-sky-600 hover:bg-sky-500 text-white shadow cursor-pointer'
                    : lightingMode === 'night'
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <BellRing className="w-4 h-4 shrink-0" />
                <span>
                  {callableSlotsCount > 0
                    ? isAr
                      ? 'استدعاء لصالة العلاج'
                      : 'Call to Treatment Hall'
                    : isAr
                      ? 'لا يوجد جهاز متاح'
                      : 'No Free Station'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tapped Patient Waiting in Treatment Hall -> Simple One-Tap Station Selector Card */}
      {selectedTreatmentWaitPatient && !firstPersonPatient && !visitingFriend && (
        <div
          dir={isAr ? 'rtl' : 'ltr'}
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto fixed bottom-[calc(env(safe-area-inset-bottom,0px)+5.75rem)] sm:bottom-24 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1.5rem)] max-w-md"
        >
          <div
            className={`rounded-3xl border shadow-2xl p-4 ${
              lightingMode === 'night'
                ? 'bg-slate-900 border-sky-400/40 text-slate-100'
                : 'bg-white border-sky-200 text-slate-900'
            }`}
          >
            <div className="flex items-start justify-between gap-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-sky-500 shrink-0" />
                  <span className="text-sm font-black truncate">
                    {isAr
                      ? selectedTreatmentWaitPatient.clinicalCase.patientNameAr
                      : selectedTreatmentWaitPatient.clinicalCase.patientNameEn}
                  </span>
                </div>
                <div
                  className={`text-xs mt-0.5 truncate ${
                    lightingMode === 'night' ? 'text-slate-300' : 'text-slate-600'
                  }`}
                >
                  {isAr
                    ? selectedTreatmentWaitPatient.clinicalCase.chiefComplaintAr
                    : selectedTreatmentWaitPatient.clinicalCase.chiefComplaintEn}
                </div>
                <div
                  className={`text-[11px] mt-1 font-semibold ${
                    lightingMode === 'night' ? 'text-sky-300' : 'text-sky-700'
                  }`}
                >
                  {isAr
                    ? 'اضغط مباشرة على السرير أو الجهاز في الصالة، أو اختره هنا:'
                    : 'Tap any bed/device directly in the hall, or pick below:'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTreatmentWaitPatientId(null)}
                aria-label={isAr ? 'إغلاق' : 'Close'}
                className={`p-1.5 rounded-xl shrink-0 transition-colors cursor-pointer ${
                  lightingMode === 'night'
                    ? 'text-slate-400 hover:bg-slate-800'
                    : 'text-slate-400 hover:bg-slate-100'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {freeStationsList.length === 0 ? (
              <div
                className={`mt-3 rounded-2xl px-3 py-2.5 text-xs font-semibold ${
                  lightingMode === 'night'
                    ? 'bg-amber-950/50 text-amber-200 border border-amber-500/30'
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}
              >
                {isAr
                  ? 'كل الأسرّة والأجهزة مشغولة حالياً — انتظر انتهاء جلسة.'
                  : 'All stations are currently occupied — wait for a free bay.'}
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-0.5">
                {(() => {
                  const ptSpec = selectedTreatmentWaitPatient.clinicalCase.specialty;
                  const ptHint = selectedTreatmentWaitPatient.clinicalCase.chiefComplaintEn.toLowerCase();
                  const ptX = selectedTreatmentWaitPatient.gridX;
                  const ptY = selectedTreatmentWaitPatient.gridY;

                  const isEntryBestMatch = (cat: CatalogItem, room?: ClinicRoom) => {
                    let match =
                      cat.stationSpecialty === ptSpec ||
                      (room?.specialty && room.specialty === ptSpec);
                    if (!match && ptHint) {
                      if (
                        /lumbar|disc|sciatica|cervical|neck|spine/.test(ptHint) &&
                        (cat.sprite === 'traction_table' ||
                          cat.sprite === 'wall_bars' ||
                          cat.sprite === 'magnetotherapy')
                      ) {
                        match = true;
                      } else if (
                        /knee|acl|meniscus|ankle|cardio|arthritis/.test(ptHint) &&
                        (cat.sprite === 'exercise_bike' ||
                          cat.sprite === 'treadmill' ||
                          cat.sprite === 'balance_trainer')
                      ) {
                        match = true;
                      } else if (
                        /stroke|hemi|parkinson|gait|balance|vestibular/.test(ptHint) &&
                        (cat.sprite === 'parallel_bars' ||
                          cat.sprite === 'balance_trainer' ||
                          cat.sprite === 'tilt_table' ||
                          cat.sprite === 'treadmill')
                      ) {
                        match = true;
                      } else if (
                        /shoulder|rotator|frozen|scapula|thoracic/.test(ptHint) &&
                        (cat.sprite === 'wall_bars' ||
                          cat.sprite === 'multi_gym_pulley' ||
                          cat.sprite === 'exercise_mat')
                      ) {
                        match = true;
                      }
                    }
                    return Boolean(match);
                  };

                  const grouped = new Map<
                    string,
                    {
                      item: PlacedItem;
                      cat: CatalogItem;
                      room?: ClinicRoom;
                      bestMatch: boolean;
                      distSq: number;
                      count: number;
                      roomIds: Set<string>;
                    }
                  >();

                  for (const { item, cat, room } of freeStationsList) {
                    const match = isEntryBestMatch(cat, room);
                    const dx = item.gridX - ptX;
                    const dy = item.gridY - ptY;
                    const distSq = dx * dx + dy * dy;
                    const existing = grouped.get(cat.id);
                    if (!existing) {
                      grouped.set(cat.id, {
                        item,
                        cat,
                        room,
                        bestMatch: match,
                        distSq,
                        count: 1,
                        roomIds: new Set(room ? [room.id] : []),
                      });
                    } else {
                      existing.count += 1;
                      if (room) existing.roomIds.add(room.id);
                      const betterCandidate =
                        (match && !existing.bestMatch) ||
                        (match === existing.bestMatch && distSq < existing.distSq);
                      if (betterCandidate) {
                        existing.item = item;
                        existing.room = room;
                        existing.bestMatch = match;
                        existing.distSq = distSq;
                      }
                    }
                  }

                  const deduped = Array.from(grouped.values());
                  deduped.sort((a, b) => Number(b.bestMatch) - Number(a.bestMatch));

                  return deduped.map(({ item, cat, room, bestMatch, count, roomIds }) => {
                    const subtitle =
                      count > 1
                        ? roomIds.size <= 1 && room
                          ? `${isAr ? room.nameAr : room.nameEn} (×${count})`
                          : isAr
                            ? `${count} متاح`
                            : `${count} available`
                        : room
                          ? isAr
                            ? room.nameAr
                            : room.nameEn
                          : '';
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() =>
                          assignTreatmentPatientToStation(
                            selectedTreatmentWaitPatient.id,
                            item.instanceId
                          )
                        }
                        className={`text-start px-3 py-2.5 rounded-2xl border transition-all active:scale-95 cursor-pointer flex flex-col justify-between gap-0.5 ${
                          bestMatch
                            ? lightingMode === 'night'
                              ? 'bg-emerald-950/60 hover:bg-emerald-900/70 border-emerald-500/45 text-emerald-100'
                              : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-950'
                            : lightingMode === 'night'
                              ? 'bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-slate-100'
                              : 'bg-slate-50 hover:bg-sky-50 border-slate-200 text-slate-900'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-xs font-black truncate">
                            {isAr ? cat.nameAr : cat.nameEn}
                          </span>
                          {bestMatch && (
                            <span
                              className={`text-[10px] font-black shrink-0 ${
                                lightingMode === 'night' ? 'text-emerald-300' : 'text-emerald-700'
                              }`}
                            >
                              {isAr ? 'مناسب' : 'Fit'}
                            </span>
                          )}
                        </div>
                        {subtitle && (
                          <span
                            className={`text-[10px] truncate ${
                              lightingMode === 'night' ? 'text-slate-400' : 'text-slate-500'
                            }`}
                          >
                            {subtitle}
                          </span>
                        )}
                      </button>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tapped Empty Station When 2+ Patients Are Waiting in Treatment Hall */}
      {pendingStationForPick && !selectedTreatmentWaitPatient && !firstPersonPatient && !visitingFriend && (
        <div
          dir={isAr ? 'rtl' : 'ltr'}
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto fixed bottom-[calc(env(safe-area-inset-bottom,0px)+5.75rem)] sm:bottom-24 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1.5rem)] max-w-sm"
        >
          <div
            className={`rounded-3xl border shadow-2xl p-4 ${
              lightingMode === 'night'
                ? 'bg-slate-900 border-emerald-400/40 text-slate-100'
                : 'bg-white border-emerald-200 text-slate-900'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-black truncate">
                  {isAr
                    ? `توجيه إلى: ${pendingStationForPick.cat.nameAr}`
                    : `Send to: ${pendingStationForPick.cat.nameEn}`}
                </div>
                <div
                  className={`text-xs mt-0.5 ${
                    lightingMode === 'night' ? 'text-slate-300' : 'text-slate-600'
                  }`}
                >
                  {isAr ? 'اختر المريض الذي سيتجه لهذا الجهاز:' : 'Pick which patient uses this station:'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingStationIdForPick(null)}
                aria-label={isAr ? 'إغلاق' : 'Close'}
                className={`p-1.5 rounded-xl shrink-0 cursor-pointer ${
                  lightingMode === 'night'
                    ? 'text-slate-400 hover:bg-slate-800'
                    : 'text-slate-400 hover:bg-slate-100'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-3 space-y-1.5 max-h-40 overflow-y-auto">
              {treatmentHallWaitingPatients.map((pt) => (
                <button
                  key={pt.id}
                  type="button"
                  onClick={() =>
                    assignTreatmentPatientToStation(pt.id, pendingStationForPick.item.instanceId)
                  }
                  className={`w-full text-start px-3.5 py-2.5 rounded-2xl border transition-all active:scale-95 cursor-pointer flex items-center justify-between gap-2 ${
                    lightingMode === 'night'
                      ? 'bg-slate-800 hover:bg-emerald-950/60 border-slate-700 hover:border-emerald-500/40 text-slate-100'
                      : 'bg-slate-50 hover:bg-emerald-50 border-slate-200 hover:border-emerald-300 text-slate-900'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-black truncate">
                      {isAr ? pt.clinicalCase.patientNameAr : pt.clinicalCase.patientNameEn}
                    </div>
                    <div
                      className={`text-[10px] truncate ${
                        lightingMode === 'night' ? 'text-slate-400' : 'text-slate-500'
                      }`}
                    >
                      {isAr ? pt.clinicalCase.chiefComplaintAr : pt.clinicalCase.chiefComplaintEn}
                    </div>
                  </div>
                  <span className="text-[11px] font-black text-emerald-500 shrink-0">
                    {isAr ? 'توجيه' : 'Send'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tapped Bed-Seated Patient Quick Start-Session Action Card */}
      {selectedBedPatient && !firstPersonPatient && !visitingFriend && (
        <div
          dir={isAr ? 'rtl' : 'ltr'}
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto fixed bottom-[calc(env(safe-area-inset-bottom,0px)+5.75rem)] sm:bottom-24 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1.5rem)] max-w-sm"
        >
          <div
            className={`rounded-3xl border shadow-2xl p-4 ${
              lightingMode === 'night'
                ? 'bg-slate-900 border-emerald-400/35 text-slate-100'
                : 'bg-white border-emerald-200 text-slate-900'
            }`}
          >
            <div className="flex items-start justify-between gap-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-sm font-black truncate">
                    {isAr
                      ? selectedBedPatient.clinicalCase.patientNameAr
                      : selectedBedPatient.clinicalCase.patientNameEn}
                  </span>
                </div>
                <div
                  className={`text-xs mt-0.5 truncate ${
                    lightingMode === 'night' ? 'text-slate-300' : 'text-slate-600'
                  }`}
                >
                  {selectedBedPatient.clinicalCase.age} {isAr ? 'سنة' : 'y'} ·{' '}
                  {isAr
                    ? SPECIALTY_META[selectedBedPatient.clinicalCase.specialty]?.nameAr ||
                      selectedBedPatient.clinicalCase.specialty
                    : SPECIALTY_META[selectedBedPatient.clinicalCase.specialty]?.nameEn ||
                      selectedBedPatient.clinicalCase.specialty}
                </div>
                <div
                  className={`text-[11px] mt-1 truncate ${
                    lightingMode === 'night' ? 'text-emerald-300' : 'text-emerald-700'
                  }`}
                >
                  {(() => {
                    const st = selectedBedPatient.assignedStationId
                      ? clinic.placedItems.find(
                          (it) => it.instanceId === selectedBedPatient.assignedStationId
                        )
                      : undefined;
                    const spr = st ? catalogById.get(st.catalogId)?.sprite : undefined;
                    if (spr === 'magnetotherapy') {
                      return isAr ? 'على جهاز المغناطيسية — ' : 'On PEMF Magneto — ';
                    }
                    if (spr === 'traction_table') {
                      return isAr ? 'على طاولة الشد — ' : 'On Traction Table — ';
                    }
                    if (spr === 'tilt_table') {
                      return isAr ? 'على طاولة الإمالة — ' : 'On Tilt Table — ';
                    }
                    if (spr === 'exercise_bike') {
                      return isAr ? 'جالس على الدراجة العلاجية — ' : 'Seated on Rehab Bike — ';
                    }
                    if (spr === 'treadmill') {
                      return isAr ? 'على جهاز المشي العلاجي — ' : 'On Gait Treadmill — ';
                    }
                    if (spr === 'parallel_bars') {
                      return isAr ? 'داخل المتوازي العلاجي — ' : 'In Parallel Bars — ';
                    }
                    if (spr === 'balance_trainer') {
                      return isAr ? 'على منصة التوازن — ' : 'On Balance Platform — ';
                    }
                    if (spr === 'wall_bars') {
                      return isAr ? 'أمام السلم الجداري — ' : 'At Swedish Wall Bars — ';
                    }
                    if (spr === 'multi_gym_pulley') {
                      return isAr ? 'على جهاز البكرات والمقاومة — ' : 'At Pulley Station — ';
                    }
                    if (spr === 'exercise_mat') {
                      return isAr ? 'على فرشة التمارين — ' : 'On Exercise Mat — ';
                    }
                    return isAr ? 'جالس على السرير — ' : 'Seated on bed — ';
                  })()}
                  {isAr
                    ? selectedBedPatient.clinicalCase.chiefComplaintAr
                    : selectedBedPatient.clinicalCase.chiefComplaintEn}
                </div>
                {selectedBedPatient.attachedDevices &&
                  selectedBedPatient.attachedDevices.length > 0 && (
                    <div
                      className={`text-[11px] mt-1 font-semibold tabular-nums ${
                        lightingMode === 'night' ? 'text-sky-300' : 'text-sky-700'
                      }`}
                    >
                      {isAr
                        ? `أجهزة متصلة حالياً: ${selectedBedPatient.attachedDevices.length}`
                        : `Active bedside devices: ${selectedBedPatient.attachedDevices.length}`}
                    </div>
                  )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedBedPatientId(null)}
                aria-label={isAr ? 'إغلاق' : 'Close'}
                className={`p-1.5 rounded-xl shrink-0 transition-colors cursor-pointer ${
                  lightingMode === 'night'
                    ? 'text-slate-400 hover:bg-slate-800'
                    : 'text-slate-400 hover:bg-slate-100'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedBedPatientId(null)}
                className={`px-3.5 min-h-[42px] rounded-2xl text-xs font-extrabold transition-colors cursor-pointer ${
                  lightingMode === 'night'
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {isAr ? 'إغلاق' : 'Dismiss'}
              </button>
              <button
                type="button"
                onClick={() => startFirstPersonSession(selectedBedPatient.id)}
                className="flex-1 min-h-[42px] px-4 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow cursor-pointer transition-all active:scale-95"
              >
                <Play className="w-4 h-4 shrink-0 fill-current" />
                <span>
                  {selectedBedPatient.state === 'in_exam'
                    ? isAr
                      ? 'استكمال الجلسة'
                      : 'Resume Session'
                    : isAr
                      ? 'ابدأ الجلسة'
                      : 'Start Session'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Smart Waiting Room Queue Manager Modal */}
      <WaitingQueueModal
        open={waitingQueueOpen && !visitingFriend}
        patients={patients}
        freeStationsCount={callableSlotsCount}
        totalStationsCount={totalStationsCount}
        language={clinic.language}
        lightingMode={lightingMode}
        onClose={() => setWaitingQueueOpen(false)}
        onCallPatient={(patientId) => {
          callPatientToStation(patientId);
        }}
        onAssignTreatmentPatient={(patientId) => {
          setWaitingQueueOpen(false);
          setSelectedWaitingPatientId(null);
          setSelectedBedPatientId(null);
          setPendingStationIdForPick(null);
          setSelectedTreatmentWaitPatientId(patientId);
        }}
        onInspectActivePatient={(patientId) => {
          startFirstPersonSession(patientId);
        }}
      />

      {/* Bonus PT Flashcard Quiz */}
      <BonusQuizModal
        open={bonusOpen}
        language={clinic.language}
        lightingMode={lightingMode}
        onClose={() => setBonusOpen(false)}
        onEarnReward={(c, s) => {
          soundFx.starSuccess();
          setClinic((prev) => ({
            ...prev,
            coins: prev.coins + c,
            stars: prev.stars + s,
          }));
        }}
      />

      {/* Anatomical Curved Eye-Blink Transition for First-Person Session Mode (GPU-composited, zero backdrop-filter) */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-[70] overflow-hidden select-none ${
          fppBlinkPhase === 'idle' ? 'pointer-events-none' : 'pointer-events-auto'
        }`}
      >
        {/* Peripheral ocular vignette narrowing field of view during blink */}
        <div
          className={`absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_32%,rgba(2,4,10,0.68)_74%,rgba(2,4,10,0.98)_100%)] will-change-[opacity] transition-opacity ${
            fppBlinkPhase === 'closing'
              ? 'opacity-100 duration-[140ms] ease-in'
              : fppBlinkPhase === 'hold'
                ? 'opacity-100 duration-0'
                : fppBlinkPhase === 'opening'
                  ? 'opacity-0 duration-[240ms] ease-out'
                  : 'opacity-0 duration-0'
          }`}
        />

        {/* Core dark seal right as the almond slit closes */}
        <div
          className={`absolute inset-0 bg-[#02040a] will-change-[opacity] transition-opacity ${
            fppBlinkPhase === 'closing'
              ? 'opacity-100 duration-[95ms] delay-[55ms] ease-in'
              : fppBlinkPhase === 'hold'
                ? 'opacity-100 duration-0'
                : fppBlinkPhase === 'opening'
                  ? 'opacity-0 duration-[185ms] ease-out'
                  : 'opacity-0 duration-0'
          }`}
        />

        {/* Curved Upper Eyelid (sweeps ~75% travel with corner-first almond arch & feathered lash shadow) */}
        <div
          className={`absolute inset-x-0 top-0 h-[78vh] will-change-transform transition-transform ${
            fppBlinkPhase === 'closing'
              ? 'translate-y-0 duration-[155ms] ease-[cubic-bezier(0.42,0,0.88,0.52)]'
              : fppBlinkPhase === 'hold'
                ? 'translate-y-0 duration-0'
                : fppBlinkPhase === 'opening'
                  ? '-translate-y-[104%] duration-[245ms] ease-[cubic-bezier(0.16,1,0.3,1)]'
                  : '-translate-y-[104%] duration-0'
          }`}
        >
          <svg
            viewBox="0 0 1000 780"
            preserveAspectRatio="none"
            className="w-full h-full block"
          >
            <path
              d="M0,0 L1000,0 L1000,780 Q500,665 0,780 Z"
              fill="#060b16"
              fillOpacity="0.34"
            />
            <path
              d="M0,0 L1000,0 L1000,780 Q500,618 0,780 Z"
              fill="#040812"
              fillOpacity="0.72"
            />
            <path
              d="M0,0 L1000,0 L1000,780 Q500,575 0,780 Z"
              fill="#02040a"
            />
          </svg>
        </div>

        {/* Curved Lower Eyelid (rises gently ~25% travel to meet slightly below midline) */}
        <div
          className={`absolute inset-x-0 bottom-0 h-[64vh] will-change-transform transition-transform ${
            fppBlinkPhase === 'closing'
              ? 'translate-y-0 duration-[155ms] ease-[cubic-bezier(0.42,0,0.88,0.52)]'
              : fppBlinkPhase === 'hold'
                ? 'translate-y-0 duration-0'
                : fppBlinkPhase === 'opening'
                  ? 'translate-y-[104%] duration-[245ms] ease-[cubic-bezier(0.16,1,0.3,1)]'
                  : 'translate-y-[104%] duration-0'
          }`}
        >
          <svg
            viewBox="0 0 1000 640"
            preserveAspectRatio="none"
            className="w-full h-full block"
          >
            <path
              d="M0,640 L0,0 Q500,45 1000,0 L1000,640 Z"
              fill="#060b16"
              fillOpacity="0.32"
            />
            <path
              d="M0,640 L0,0 Q500,82 1000,0 L1000,640 Z"
              fill="#040812"
              fillOpacity="0.7"
            />
            <path
              d="M0,640 L0,0 Q500,115 1000,0 L1000,640 Z"
              fill="#02040a"
            />
          </svg>
        </div>
      </div>

      {/* AAA-Style Initial Game Splash & Asset-Caching Loading Screen */}
      {!bootDismissed && (
        <GameLoadingScreen
          language={clinic.language}
          hydrated={hydrated}
          sceneReady={sceneReady}
          onFinished={() => setBootDismissed(true)}
        />
      )}
    </main>
  );
}
