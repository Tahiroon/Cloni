import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Coins, Trash2, Trees, X } from 'lucide-react';
import { BottomNavBar } from './components/BottomNavBar';
import { BonusQuizModal } from './components/BonusQuizModal';
import { ClinicCanvas, PlacementDraft } from './components/ClinicCanvas';
import { ClinicalAssessmentModal } from './components/ClinicalAssessmentModal';
import { FriendsModal } from './components/FriendsModal';
import { MissionsModal } from './components/MissionsModal';
import { PlayerCharacterModal } from './components/PlayerCharacterModal';
import { RoomUnlockModal } from './components/RoomUnlockModal';
import { SettingsModal } from './components/SettingsModal';
import { StoreSheet } from './components/StoreSheet';
import { TopHudBar } from './components/TopHudBar';
import { WorldTreeDef } from './engine3d/models3d';
import {
  CATALOG_ITEMS,
  createInitialSaveState,
  DEFAULT_PLAYER_PROFILE,
  FALLBACK_CLINICAL_CASES,
  FRIEND_CLINICS,
  normalizePlayerProfile,
  SPECIALTY_META,
} from './data/catalog';
import {
  buildObstacleBoxes,
  buildWaitSeatSlots,
  findGridPath,
  findNearestWalkableTile,
  getReceptionDeskPose,
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
  loadClinicLocal,
  saveClinicLocal,
  scheduleSilentCloudSync,
} from './services/indexedDbStorage';
import { soundFx } from './services/soundEffects';
import {
  CatalogItem,
  ClinicRoom,
  ClinicSaveState,
  ClinicalCase,
  FloatingFeedback,
  FriendClinic,
  Language,
  LightingMode,
  NavTab,
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

const EMPTY_REMOVED_TREES: string[] = [];

const TREE_SPECIES_LABELS: Record<WorldTreeSpecies, { ar: string; en: string }> = {
  oak: { ar: 'شجرة بلوط برية', en: 'Wild Oak Tree' },
  wild_fig: { ar: 'شجرة جميز برية', en: 'Wild Fig Tree' },
  acacia: { ar: 'شجرة أكاسيا برية', en: 'Wild Acacia Tree' },
  cypress: { ar: 'شجرة سرو برية', en: 'Wild Cypress Tree' },
  birch: { ar: 'شجرة بتولا برية', en: 'Wild Birch Tree' },
};

export default function App() {
  const [clinic, setClinic] = useState<ClinicSaveState>(() => createInitialSaveState());
  const [hydrated, setHydrated] = useState(false);

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
  const [orbitStep] = useState(0);

  const [unlockTargetRoom, setUnlockTargetRoom] = useState<ClinicRoom | null>(null);
  const [selectedWorldTree, setSelectedWorldTree] = useState<WorldTreeDef | null>(null);
  const [focusedPatientId, setFocusedPatientId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [placementDraft, setPlacementDraft] = useState<PlacementDraft | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const treatmentTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const receptionCheckedInIdsRef = useRef<Set<string>>(new Set());

  const handleReceptionCheckinDone = useCallback((patientId: string) => {
    receptionCheckedInIdsRef.current.add(patientId);
    if (receptionCheckedInIdsRef.current.size > 32) {
      const first = receptionCheckedInIdsRef.current.values().next().value;
      if (first) receptionCheckedInIdsRef.current.delete(first);
    }
  }, []);

  const lightingMode: LightingMode = clinic.lightingMode || 'day';

  useEffect(() => {
    const timers = treatmentTimersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  // On-demand patient case updater (used when the student explicitly requests a fresh Gemini AI case)
  const handleUpdatePatientCase = useCallback((patientId: string, nextCase: ClinicalCase) => {
    setPatients((prev) =>
      prev.map((p) => (p.id === patientId ? { ...p, clinicalCase: nextCase, isAiGenerated: true } : p))
    );
  }, []);

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

  // Hydrate offline-first from IndexedDB / LocalStorage (+ clean v2 expanded clinic migration & infinite coins)
  useEffect(() => {
    let active = true;
    loadClinicLocal().then((saved) => {
      if (!active) return;
      if (saved && saved.rooms && saved.placedItems) {
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

        // Relocate any legacy south-zone solar panels cleanly to the new Rear Solar Zone behind the clinic
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
          const cat = catalogById.get(it.catalogId);
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

        // Strip legacy Dr. Sara (staff_therapist_1) so the student's own character leads the clinic
        const migratedStaff = (nextState.staff || []).filter((st) => st.id !== 'staff_therapist_1');

        // Keep unlimited coins active on this account
        nextState = {
          ...nextState,
          staff: migratedStaff,
          playerProfile: normalizePlayerProfile(nextState.playerProfile),
          placedItems: relocatedItems,
          lightingMode: nextState.lightingMode || 'day',
          removedTreeIds: nextState.removedTreeIds || [],
          version: 6,
          coins: 999999,
        };
        setClinic(nextState);
        setLastSyncedAt(nextState.lastSyncedAt || null);
        soundFx.enabled = nextState.soundEnabled;
        document.documentElement.lang = nextState.language;
        document.documentElement.dir = nextState.language === 'ar' ? 'rtl' : 'ltr';
      }
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // Persist to IndexedDB + trigger silent background sync on changes
  useEffect(() => {
    if (!hydrated) return;
    saveClinicLocal(clinic);
    scheduleSilentCloudSync(clinic, (iso) => {
      setLastSyncedAt(iso);
    });
  }, [clinic, hydrated]);

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

  // Find available treatment station in unlocked rooms, preferring devices matching the patient's specialty
  const findFreeStation = useCallback(
    (currentPatients: PatientEntity[], patientSpecialty?: RoomSpecialty): PlacedItem | null => {
      const occupiedIds = new Set(
        currentPatients
          .filter((p) => p.state !== 'treated_leaving' && p.assignedStationId)
          .map((p) => p.assignedStationId!)
      );

      const stations = clinic.placedItems.filter((item) => {
        const cat = catalogById.get(item.catalogId);
        if (!cat?.isTreatmentStation) return false;
        const room = clinic.rooms.find((r) => r.id === item.roomId);
        return (!room || room.unlocked) && !occupiedIds.has(item.instanceId);
      });

      if (stations.length === 0) return null;

      if (patientSpecialty) {
        const directMatches = stations.filter((item) => {
          const cat = catalogById.get(item.catalogId);
          const room = clinic.rooms.find((r) => r.id === item.roomId);
          return (
            cat?.stationSpecialty === patientSpecialty ||
            room?.specialty === patientSpecialty
          );
        });
        if (directMatches.length > 0) {
          return directMatches[Math.floor(Math.random() * directMatches.length)];
        }
        const generalMatches = stations.filter(
          (item) => catalogById.get(item.catalogId)?.stationSpecialty === 'any'
        );
        if (generalMatches.length > 0) {
          return generalMatches[Math.floor(Math.random() * generalMatches.length)];
        }
      }

      return stations[Math.floor(Math.random() * stations.length)];
    },
    [clinic.placedItems, clinic.rooms, catalogById]
  );

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

  // Pick a walkable spot in front of an unlocked water cooler for a quick hydration sip
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
        if (room && !room.unlocked) continue;

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

  // Pick the nearest unoccupied waiting seat (supports all 3 seats on waiting_chairs, 2 on park_bench, 1 on armchairs)
  const pickNearestFreeWaitingSeat = useCallback(
    (
      fromX: number,
      fromY: number,
      currentPatients: PatientEntity[],
      excludePatientId?: string
    ): WaitSeatSlot | null => {
      const seats = buildWaitSeatSlots(clinic.placedItems, clinic.rooms).filter((s) =>
        isTileWalkable(s.approachTileX, s.approachTileY, 0.21, obstacleBoxes)
      );
      if (seats.length === 0) return null;

      const claimedKeys = new Set<string>();
      for (const p of currentPatients) {
        if (p.id === excludePatientId) continue;
        if (p.state !== 'walking_to_wait' && p.state !== 'waiting_checkin') continue;
        if (p.isSeatedWait === false) continue;
        if (p.waitingSeatKey) claimedKeys.add(p.waitingSeatKey);
      }

      const freeSeats = seats.filter((s) => !claimedKeys.has(s.seatKey));
      if (freeSeats.length === 0) return null;

      freeSeats.sort((a, b) => {
        const da = Math.hypot(a.approachTileX - fromX, a.approachTileY - fromY);
        const db = Math.hypot(b.approachTileX - fromX, b.approachTileY - fromY);
        return da - db;
      });
      return freeSeats[0];
    },
    [clinic.placedItems, clinic.rooms, obstacleBoxes]
  );

  // Pick an open non-colliding standing waiting spot inside reception when all chairs are full
  const findStandingWaitSpot = useCallback(
    (currentPatients: PatientEntity[], excludePatientId?: string) => {
      const candidates: Array<{ x: number; y: number }> = [];
      for (let x = 13.4; x <= 20.4; x += 1.2) {
        for (let y = 13.6; y <= 20.2; y += 1.2) {
          const jx = x + (Math.random() - 0.5) * 0.45;
          const jy = y + (Math.random() - 0.5) * 0.45;
          if (!isTileWalkable(jx, jy, 0.28, obstacleBoxes)) continue;
          const crowded = currentPatients.some(
            (pt) =>
              pt.id !== excludePatientId &&
              pt.state !== 'treated_leaving' &&
              Math.hypot(pt.gridX - jx, pt.gridY - jy) < 0.95
          );
          if (!crowded) candidates.push({ x: jx, y: jy });
        }
      }
      if (candidates.length > 0) {
        return candidates[Math.floor(Math.random() * candidates.length)];
      }
      return { x: 16.2 + (Math.random() - 0.5) * 0.8, y: 15.6 + (Math.random() - 0.5) * 0.8 };
    },
    [obstacleBoxes]
  );

  // Patient Spawner (always arrives -> Reception Desk -> nearest free seat or calm standing wait -> treatment wing)
  useEffect(() => {
    if (!hydrated || visitingFriend) return;

    const spawnCheck = () => {
      setPatients((prev) => {
        const unlockedTreatmentWings = clinic.rooms.filter(
          (r) => r.unlocked && r.specialty !== 'reception'
        ).length;
        const stationCount = clinic.placedItems.filter((i) => catalogById.get(i.catalogId)?.isTreatmentStation).length;
        // Keep clinic calm and readable: 2-3 active patients normally, up to 4 when expanded
        const maxActive = Math.min(
          unlockedTreatmentWings >= 2 ? 4 : 3,
          Math.max(2, Math.min(stationCount, unlockedTreatmentWings + 1))
        );
        const activeCount = prev.filter((p) => p.state !== 'treated_leaving').length;
        if (activeCount >= maxActive) return prev;

        const activeBaseIds = new Set(
          prev.map((p) => p.clinicalCase.id.replace(/_\d+$/, ''))
        );
        const unseenPool = FALLBACK_CLINICAL_CASES.filter((c) => !activeBaseIds.has(c.id));
        const casePool = unseenPool.length > 0 ? unseenPool : FALLBACK_CLINICAL_CASES;
        const fallbackCase = casePool[Math.floor(Math.random() * casePool.length)];
        const chosenCase = { ...fallbackCase, id: fallbackCase.id + '_' + Date.now() };
        const skin = SUDANESE_SKINS[Math.floor(Math.random() * SUDANESE_SKINS.length)];

        const receptionSpot = getReceptionCheckinSpot(prev);
        const startX = 27.9;
        const startY = 14.3 + (Math.random() - 0.5) * 0.5;
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

        const isFemale = chosenCase.gender === 'female';
        let outfitStyle: 'casual' | 'jalabiya' | 'abaya' | 'abaya_open' | 'dress' | 'sudanese_thobe' = 'casual';
        let shirtStyle: 'tshirt' | 'shirt' | undefined;
        const heightScale = chosenCase.age < 15 ? 0.78 : undefined;
        let shirtColor = '#ece9e1';
        let pantsColor = '#1e293b';
        let hasHijab = false;
        let hasTurban = false;

        const activeOutfits = new Set(prev.map((p) => `${p.shirtColor}_${p.pantsColor}`));
        const pickDistinct = <T,>(items: T[], getKey: (x: T) => string): T => {
          const fresh = items.filter((item) => !activeOutfits.has(getKey(item)));
          const pool = fresh.length > 0 ? fresh : items;
          return pool[Math.floor(Math.random() * pool.length)];
        };

        if (isFemale) {
          hasHijab = true; // All women wear a Tarha/Hijab or Sudanese Thobe cleanly
          const thobeChance = chosenCase.age >= 48 ? 0.75 : chosenCase.age >= 28 ? 0.38 : 0.16;
          if (Math.random() < thobeChance) {
            outfitStyle = 'sudanese_thobe';
            const thobeLook = pickDistinct(
              FEMALE_SUDANESE_THOBE_LOOKS,
              (l) => `${l.thobe}_${l.inner}`
            );
            shirtColor = thobeLook.thobe;
            pantsColor = thobeLook.inner;
          } else {
            const roll = Math.random();
            if (roll < 0.36) {
              outfitStyle = 'abaya';
              shirtColor = pickDistinct(FEMALE_ABAYA_COLORS, (c) => `${c}_${c}`);
              pantsColor = shirtColor;
            } else if (roll < 0.65) {
              outfitStyle = 'abaya_open';
              const openLook = pickDistinct(
                FEMALE_OPEN_ABAYA_LOOKS,
                (l) => `${l.outer}_${l.inner}`
              );
              shirtColor = openLook.outer;
              pantsColor = openLook.inner;
            } else if (roll < 0.84) {
              outfitStyle = 'dress';
              shirtColor = pickDistinct(FEMALE_DRESS_COLORS, (c) => `${c}_${c}`);
              pantsColor = shirtColor;
            } else {
              outfitStyle = 'casual';
              const c = pickDistinct(FEMALE_CASUAL_LOOKS, (l) => `${l.shirt}_${l.pants}`);
              shirtColor = c.shirt;
              pantsColor = c.pants;
            }
          }
        } else {
          // Older men (>=35): mostly Jalabiya (~82%); youth/kids (<35): mostly trousers + t-shirt/shirt (~85-100%)
          const jalabiyaChance = chosenCase.age < 15 ? 0 : chosenCase.age >= 35 ? 0.82 : 0.15;
          const wearJalabiya = Math.random() < jalabiyaChance;
          outfitStyle = wearJalabiya ? 'jalabiya' : 'casual';
          if (wearJalabiya) {
            const jTones = ['#f8fafc', '#efe2c9', '#dbe8f4', '#dce6db', '#e6d3b3', '#e2e8f0'];
            shirtColor = pickDistinct(jTones, (c) => `${c}_${c}`);
            pantsColor = shirtColor;
            hasTurban = chosenCase.age >= 40 ? Math.random() < 0.72 : Math.random() < 0.45;
          } else {
            const c = pickDistinct(MALE_CASUAL_LOOKS, (l) => `${l.shirt}_${l.pants}`);
            shirtColor = c.shirt;
            pantsColor = c.pants;
            shirtStyle = c.shirtStyle;
          }
        }

        const newPatient: PatientEntity = {
          id: 'pat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
          gridX: startX,
          gridY: startY,
          targetX: receptionSpot.x,
          targetY: receptionSpot.y,
          path,
          walkPhase: 0,
          facing: 2,
          skinTone: skin,
          hairColor: '#17100c',
          shirtColor,
          pantsColor,
          hasHijab,
          hasTurban,
          outfitStyle,
          shirtStyle,
          heightScale,
          hasBeard: !isFemale && chosenCase.age >= 28,
          state: 'arriving',
          assignedStationId: null,
          waitTimer: 0,
          clinicalCase: chosenCase,
          isAiGenerated: false,
        };
        return [...prev, newPatient];
      });
    };

    const bootTimer = setTimeout(spawnCheck, 1300);
    const interval = setInterval(spawnCheck, 13800);
    return () => {
      clearTimeout(bootTimer);
      clearInterval(interval);
    };
  }, [
    hydrated,
    visitingFriend,
    clinic.placedItems,
    clinic.rooms,
    catalogById,
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
      if (
        toFront.length === 0 &&
        Math.hypot(seat.approachTileX - patient.gridX, seat.approachTileY - patient.gridY) > 0.75
      ) {
        return [];
      }
      return [...toFront, { x: seat.seatTileX, y: seat.seatTileY }];
    },
    [buildPatientPath]
  );

  // Immediately re-route & re-validate seats/stations whenever the student places, moves, rotates, or sells furniture
  useEffect(() => {
    if (!hydrated || visitingFriend) return;
    setPatients((prev) => {
      if (prev.length === 0) return prev;
      const allSeats = buildWaitSeatSlots(clinic.placedItems, clinic.rooms);
      const seatByKey = new Map(allSeats.map((s) => [s.seatKey, s]));
      let anyChanged = false;
      const updatedList: PatientEntity[] = [];

      for (let i = 0; i < prev.length; i++) {
        const p = prev[i];
        const up = { ...p };
        const claimedSoFar = [...updatedList, ...prev.slice(i + 1)];

        if (up.state === 'arriving') {
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
        } else if (up.state === 'walking_to_water') {
          const cooler = up.waterCoolerId
            ? clinic.placedItems.find((it) => it.instanceId === up.waterCoolerId)
            : undefined;
          if (!cooler) {
            const altCooler = pickFreeWaterCoolerSpot(claimedSoFar, up.id);
            if (altCooler) {
              up.waterCoolerId = altCooler.coolerId;
              up.targetX = altCooler.x;
              up.targetY = altCooler.y;
              up.headingRad = altCooler.facingRad;
              up.path = buildPatientPath(up, altCooler.x, altCooler.y);
            } else {
              const seat = pickNearestFreeWaitingSeat(up.gridX, up.gridY, claimedSoFar, up.id);
              up.state = 'walking_to_wait';
              up.waterCoolerId = undefined;
              if (seat) {
                up.isSeatedWait = true;
                up.waitingSeatKey = seat.seatKey;
                up.seatHeight = seat.seatHeight;
                up.targetX = seat.seatTileX;
                up.targetY = seat.seatTileY;
                up.seatApproachX = seat.approachTileX;
                up.seatApproachY = seat.approachTileY;
                up.seatOffsetX = 0;
                up.seatOffsetZ = 0;
                up.seatFacingRad = seat.facingRad;
                up.path = buildPathToWaitSeat(up, seat);
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
        } else if (
          (up.state === 'walking_to_wait' || up.state === 'waiting_checkin') &&
          up.isSeatedWait !== false
        ) {
          const matchedSeat = up.waitingSeatKey ? seatByKey.get(up.waitingSeatKey) : undefined;
          const stillSameSpot =
            matchedSeat &&
            Math.hypot(matchedSeat.seatTileX - up.targetX, matchedSeat.seatTileY - up.targetY) < 0.08 &&
            isTileWalkable(matchedSeat.approachTileX, matchedSeat.approachTileY, 0.21, obstacleBoxes);

          if (stillSameSpot && matchedSeat) {
            if (up.state === 'walking_to_wait') {
              const nextSeatPath = buildPathToWaitSeat(up, matchedSeat);
              if (nextSeatPath.length > 0) {
                up.path = nextSeatPath;
                up.blockedTicks = 0;
                anyChanged = true;
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
                up.blockedTicks = 0;
                anyChanged = true;
              }
            }
          } else {
            // Chair was moved, rotated, sold, or blocked: stand up smoothly and pick nearest valid seat/spot
            const clearPos = findNearestWalkableTile(up.gridX, up.gridY, 0.21, obstacleBoxes);
            up.gridX = clearPos.x;
            up.gridY = clearPos.y;
            const newSeat = pickNearestFreeWaitingSeat(up.gridX, up.gridY, claimedSoFar, up.id);
            const newSeatPath = newSeat ? buildPathToWaitSeat(up, newSeat) : [];
            up.state = 'walking_to_wait';
            up.blockedTicks = 0;
            if (newSeat && newSeatPath.length > 0) {
              up.isSeatedWait = true;
              up.waitingSeatKey = newSeat.seatKey;
              up.seatHeight = newSeat.seatHeight;
              up.targetX = newSeat.seatTileX;
              up.targetY = newSeat.seatTileY;
              up.seatApproachX = newSeat.approachTileX;
              up.seatApproachY = newSeat.approachTileY;
              up.seatOffsetX = 0;
              up.seatOffsetZ = 0;
              up.seatFacingRad = newSeat.facingRad;
              up.path = newSeatPath;
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
          }
        } else if (up.state === 'walking_to_wait' && up.isSeatedWait === false) {
          const safePos = findNearestWalkableTile(up.gridX, up.gridY, 0.21, obstacleBoxes);
          up.gridX = safePos.x;
          up.gridY = safePos.y;
          if (!isTileWalkable(up.targetX, up.targetY, 0.22, obstacleBoxes)) {
            const stand = findStandingWaitSpot(claimedSoFar, up.id);
            up.targetX = stand.x;
            up.targetY = stand.y;
          }
          up.path = buildPatientPath(up, up.targetX, up.targetY);
          up.blockedTicks = 0;
          anyChanged = true;
        } else if (up.state === 'walking_to_station' || up.state === 'ready_for_exam') {
          const station = up.assignedStationId
            ? clinic.placedItems.find((it) => it.instanceId === up.assignedStationId)
            : undefined;
          if (station) {
            if (
              Math.hypot(station.gridX - up.targetX, station.gridY - up.targetY) > 0.08 ||
              up.state === 'walking_to_station'
            ) {
              if (up.state === 'ready_for_exam') {
                const safePos = findNearestWalkableTile(up.gridX, up.gridY, 0.21, obstacleBoxes);
                up.gridX = safePos.x;
                up.gridY = safePos.y;
                up.state = 'walking_to_station';
              }
              up.targetX = station.gridX;
              up.targetY = station.gridY;
              up.path = buildPatientPath(up, station.gridX, station.gridY, station.instanceId);
              up.blockedTicks = 0;
              anyChanged = true;
            }
          } else {
            // Assigned station was sold: re-assign to another free station or walk back to waiting lounge
            const altStation = findFreeStation(claimedSoFar, up.clinicalCase.specialty);
            const clearPos = findNearestWalkableTile(up.gridX, up.gridY, 0.21, obstacleBoxes);
            up.gridX = clearPos.x;
            up.gridY = clearPos.y;
            if (altStation) {
              up.assignedStationId = altStation.instanceId;
              up.state = 'walking_to_station';
              up.targetX = altStation.gridX;
              up.targetY = altStation.gridY;
              up.path = buildPatientPath(up, altStation.gridX, altStation.gridY, altStation.instanceId);
            } else {
              up.assignedStationId = null;
              const newSeat = pickNearestFreeWaitingSeat(up.gridX, up.gridY, claimedSoFar, up.id);
              up.state = 'walking_to_wait';
              if (newSeat) {
                up.isSeatedWait = true;
                up.waitingSeatKey = newSeat.seatKey;
                up.seatHeight = newSeat.seatHeight;
                up.targetX = newSeat.seatTileX;
                up.targetY = newSeat.seatTileY;
                up.seatApproachX = newSeat.approachTileX;
                up.seatApproachY = newSeat.approachTileY;
                up.seatOffsetX = 0;
                up.seatOffsetZ = 0;
                up.seatFacingRad = newSeat.facingRad;
                up.path = buildPathToWaitSeat(up, newSeat);
              } else {
                const stand = findStandingWaitSpot(claimedSoFar, up.id);
                up.isSeatedWait = false;
                up.waitingSeatKey = undefined;
                up.targetX = stand.x;
                up.targetY = stand.y;
                up.path = buildPatientPath(up, stand.x, stand.y);
              }
            }
            up.blockedTicks = 0;
            anyChanged = true;
          }
        } else if (up.state === 'treated_leaving') {
          up.path = buildPatientPath(up, 32, 15, up.leavingItemId);
          up.blockedTicks = 0;
          anyChanged = true;
        }

        updatedList.push(up);
      }

      return anyChanged ? updatedList : prev;
    });
  }, [
    hydrated,
    visitingFriend,
    obstacleBoxes,
    clinic.placedItems,
    clinic.rooms,
    buildPatientPath,
    buildPathToWaitSeat,
    getReceptionCheckinSpot,
    pickFreeWaterCoolerSpot,
    pickNearestFreeWaitingSeat,
    findStandingWaitSpot,
    findFreeStation,
  ]);

  // Smooth dt-driven ~10Hz simulation tick (zero IndexedDB thrashing, brisk natural speed, optional water-cooler sips)
  useEffect(() => {
    if (!hydrated || visitingFriend) return;

    const receptionistHired = clinic.staff.some((s) => s.role === 'receptionist' && s.hired);
    let lastTickMs = performance.now();

    const assignWaitingDestination = (
      updated: PatientEntity,
      claimedSoFar: PatientEntity[]
    ) => {
      const seat = pickNearestFreeWaitingSeat(
        updated.gridX,
        updated.gridY,
        claimedSoFar,
        updated.id
      );
      const seatPath = seat ? buildPathToWaitSeat(updated, seat) : [];
      updated.state = 'walking_to_wait';
      updated.waitTimer = 0;
      updated.waterCoolerId = undefined;
      updated.blockedTicks = 0;

      if (seat && seatPath.length > 0) {
        updated.isSeatedWait = true;
        updated.waitingSeatKey = seat.seatKey;
        updated.seatHeight = seat.seatHeight;
        updated.targetX = seat.seatTileX;
        updated.targetY = seat.seatTileY;
        updated.seatApproachX = seat.approachTileX;
        updated.seatApproachY = seat.approachTileY;
        updated.seatOffsetX = 0;
        updated.seatOffsetZ = 0;
        updated.seatFacingRad = seat.facingRad;
        updated.idleMoveTimer = undefined;
        updated.path = seatPath;
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
        updated.idleMoveTimer = 2400 + Math.random() * 2000;
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

    const tick = setInterval(() => {
      const nowMs = performance.now();
      const dtSec = Math.min(0.12, Math.max(0.016, (nowMs - lastTickMs) / 1000));
      const dtMs = dtSec * 1000;
      lastTickMs = nowMs;

      setPatients((prev) => {
        let changed = false;
        const nextList: PatientEntity[] = [];

        for (let idx = 0; idx < prev.length; idx++) {
          const p = prev[idx];
          if (p.path.length === 0 && p.state === 'ready_for_exam') {
            nextList.push(p);
            continue;
          }
          const updated = { ...p };
          const seatItemId = updated.waitingSeatKey
            ? updated.waitingSeatKey.slice(0, updated.waitingSeatKey.lastIndexOf('_'))
            : undefined;
          const targetItemId =
            updated.state === 'walking_to_wait' || updated.state === 'waiting_checkin'
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
            const nearFinalEntry =
              activePath.length === 1 &&
              Math.hypot(activePath[0].x - updated.gridX, activePath[0].y - updated.gridY) < 1.55;
            const leavingStart =
              !isTileWalkable(updated.gridX, updated.gridY, 0.21, obstacleBoxes);
            const activeIgnoreId =
              nearFinalEntry || leavingStart ? targetItemId : undefined;

            // Smooth corner rounding ONLY on clear unobstructed open sightlines (never skip doorway centers or chair approach tiles)
            const preserveSeatApproach =
              updated.state === 'walking_to_wait' &&
              updated.isSeatedWait !== false &&
              activePath.length <= 2;
            if (
              !preserveSeatApproach &&
              activePath.length >= 2 &&
              !isDoorwayThreshold(activePath[0].x, activePath[0].y)
            ) {
              const maxProbe =
                updated.state === 'walking_to_wait' && updated.isSeatedWait !== false
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
              // Gentle separation steering only in open spaces (never shove laterally inside doorways)
              let avoidX = 0;
              let avoidY = 0;
              if (!isDoorwayThreshold(updated.gridX, updated.gridY)) {
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
                  const rerouted = buildPatientPath(
                    updated,
                    finalNode.x,
                    finalNode.y,
                    updated.state === 'walking_to_station'
                      ? updated.assignedStationId || undefined
                      : updated.state === 'treated_leaving'
                        ? updated.leavingItemId
                        : undefined
                  );
                  if (rerouted.length > 0) {
                    updated.path = rerouted;
                  } else if (distToGoal <= 0.65) {
                    updated.path = [];
                  } else {
                    const claimedSoFar = [...nextList, ...prev.slice(idx + 1)];
                    if (
                      updated.state === 'walking_to_wait' ||
                      updated.state === 'walking_to_water'
                    ) {
                      assignWaitingDestination(updated, claimedSoFar);
                    } else if (updated.state === 'walking_to_station') {
                      updated.assignedStationId = null;
                      assignWaitingDestination(updated, claimedSoFar);
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

            updated.walkPhase += speedStep * (7.2 / Math.max(0.82, updated.heightScale || 1));
            changed = true;
          } else {
            // Reached current waypoint
            if (updated.state === 'arriving') {
              if (Math.hypot(updated.targetX - updated.gridX, updated.targetY - updated.gridY) > 0.58) {
                const claimedSoFar = [...nextList, ...prev.slice(idx + 1)];
                const spot = getReceptionCheckinSpot(claimedSoFar);
                const rerouted = buildPatientPath(updated, spot.x, spot.y);
                updated.targetX = spot.x;
                updated.targetY = spot.y;
                if (rerouted.length > 0) {
                  updated.path = rerouted;
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
                  ? 9000
                  : receptionistHired && hasReceptionDesk
                    ? 2600
                    : 1800;
              if ((checkedByRec && updated.waitTimer >= 1600) || updated.waitTimer >= maxCheckinMs) {
                receptionCheckedInIdsRef.current.delete(updated.id);
                const claimedSoFar = [...nextList, ...prev.slice(idx + 1)];
                const coolerSpot =
                  Math.random() < 0.46
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
              if (
                Math.hypot(updated.targetX - updated.gridX, updated.targetY - updated.gridY) > 0.78
              ) {
                const claimedSoFar = [...nextList, ...prev.slice(idx + 1)];
                assignWaitingDestination(updated, claimedSoFar);
              } else {
                updated.state = 'waiting_checkin';
                updated.waitTimer = 0;
                if (updated.isSeatedWait === false) {
                  updated.idleMoveTimer = 2200 + Math.random() * 1800;
                }
              }
              changed = true;
            } else if (updated.state === 'waiting_checkin') {
              updated.waitTimer += dtMs;

              if (updated.isSeatedWait === false) {
                if (updated.waitTimer % 500 < dtMs) {
                  const claimedSoFar = [...nextList, ...prev.slice(idx + 1)];
                  const openSeat = pickNearestFreeWaitingSeat(
                    updated.gridX,
                    updated.gridY,
                    claimedSoFar,
                    updated.id
                  );
                  const openSeatPath = openSeat
                    ? buildPathToWaitSeat(updated, openSeat)
                    : [];
                  if (openSeat && openSeatPath.length > 0) {
                    updated.state = 'walking_to_wait';
                    updated.isSeatedWait = true;
                    updated.waitingSeatKey = openSeat.seatKey;
                    updated.seatHeight = openSeat.seatHeight;
                    updated.targetX = openSeat.seatTileX;
                    updated.targetY = openSeat.seatTileY;
                    updated.seatApproachX = openSeat.approachTileX;
                    updated.seatApproachY = openSeat.approachTileY;
                    updated.seatOffsetX = 0;
                    updated.seatOffsetZ = 0;
                    updated.seatFacingRad = openSeat.facingRad;
                    updated.idleMoveTimer = undefined;
                    updated.blockedTicks = 0;
                    updated.path = openSeatPath;
                    changed = true;
                    nextList.push(updated);
                    continue;
                  }
                }

                // Natural standing waiting idle movements
                const nextIdle = (updated.idleMoveTimer ?? 2400) - dtMs;
                if (nextIdle <= 0) {
                  updated.idleMoveTimer = 2600 + Math.random() * 2400;
                  if (Math.random() < 0.5) {
                    const drift = findStandingWaitSpot([...nextList, ...prev.slice(idx + 1)], updated.id);
                    if (Math.hypot(drift.x - updated.gridX, drift.y - updated.gridY) <= 2.6) {
                      const driftPath = buildPatientPath(updated, drift.x, drift.y);
                      if (driftPath.length > 0) {
                        updated.targetX = drift.x;
                        updated.targetY = drift.y;
                        updated.path = driftPath;
                      }
                    }
                  } else {
                    updated.headingRad = Math.PI + (Math.random() - 0.5) * 1.4;
                  }
                } else {
                  updated.idleMoveTimer = nextIdle;
                }
                changed = true;
              }

              const autoCallMs = receptionistHired ? 2400 : 4800;
              if (updated.waitTimer >= autoCallMs) {
                const station = findFreeStation(
                  [...nextList, ...prev.slice(idx + 1)],
                  updated.clinicalCase.specialty
                );
                if (station) {
                  const stationPath = buildPatientPath(
                    updated,
                    station.gridX,
                    station.gridY,
                    station.instanceId
                  );
                  const alreadyClose =
                    Math.hypot(station.gridX - updated.gridX, station.gridY - updated.gridY) < 0.85;
                  if (stationPath.length > 0 || alreadyClose) {
                    updated.assignedStationId = station.instanceId;
                    updated.state = 'walking_to_station';
                    updated.targetX = station.gridX;
                    updated.targetY = station.gridY;
                    updated.isSeatedWait = undefined;
                    updated.waitingSeatKey = undefined;
                    updated.seatHeight = undefined;
                    updated.seatApproachX = undefined;
                    updated.seatApproachY = undefined;
                    updated.seatOffsetX = undefined;
                    updated.seatOffsetZ = undefined;
                    updated.seatFacingRad = undefined;
                    updated.waterCoolerId = undefined;
                    updated.idleMoveTimer = undefined;
                    updated.headingRad = undefined;
                    updated.blockedTicks = 0;
                    updated.path = stationPath;
                    changed = true;
                  }
                }
              }
            } else if (updated.state === 'walking_to_station') {
              const station = updated.assignedStationId
                ? clinic.placedItems.find((it) => it.instanceId === updated.assignedStationId)
                : undefined;
              if (
                station &&
                Math.hypot(station.gridX - updated.gridX, station.gridY - updated.gridY) > 0.95
              ) {
                const retryPath = buildPatientPath(
                  updated,
                  station.gridX,
                  station.gridY,
                  station.instanceId
                );
                if (retryPath.length > 0) {
                  updated.path = retryPath;
                } else {
                  updated.assignedStationId = null;
                  assignWaitingDestination(updated, [...nextList, ...prev.slice(idx + 1)]);
                }
              } else {
                updated.state = 'ready_for_exam';
              }
              changed = true;
            } else if (updated.state === 'in_treatment') {
              const stItem = updated.assignedStationId
                ? clinic.placedItems.find((it) => it.instanceId === updated.assignedStationId)
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

        // Non-clipping personal-space resolution for standing/walking patients (skip doorways)
        for (let i = 0; i < nextList.length; i++) {
          const a = nextList[i];
          if (
            a.state === 'ready_for_exam' ||
            a.state === 'in_treatment' ||
            a.isSeatedWait ||
            isDoorwayThreshold(a.gridX, a.gridY)
          ) {
            continue;
          }
          for (let j = 0; j < nextList.length; j++) {
            if (i === j) continue;
            const b = nextList[j];
            if (b.state === 'ready_for_exam' || b.state === 'in_treatment' || b.isSeatedWait) continue;
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
    }, 50);

    return () => clearInterval(tick);
  }, [
    hydrated,
    visitingFriend,
    clinic.rooms,
    clinic.placedItems,
    clinic.staff,
    findFreeStation,
    getReceptionCheckinSpot,
    pickNearestFreeWaitingSeat,
    pickFreeWaterCoolerSpot,
    findStandingWaitSpot,
    buildPatientPath,
    buildPathToWaitSeat,
    catalogById,
    obstacleBoxes,
  ]);

  // Handle tapping a patient
  const handleTapPatient = (patient: PatientEntity) => {
    if (visitingFriend) return;
    soundFx.tap();

    if (
      patient.state === 'arriving' ||
      patient.state === 'checkin_at_desk' ||
      patient.state === 'walking_to_water' ||
      patient.state === 'drinking_water' ||
      patient.state === 'walking_to_wait' ||
      patient.state === 'waiting_checkin'
    ) {
      const station = findFreeStation(patients);
      if (!station) {
        addFloatingFeedback(
          patient.gridX,
          patient.gridY,
          clinic.language === 'ar' ? 'لا يوجد سرير فارغ!' : 'No free station!',
          '#f59e0b'
        );
        return;
      }
      const stationPath = buildPatientPath(
        patient,
        station.gridX,
        station.gridY,
        station.instanceId
      );
      if (
        stationPath.length === 0 &&
        Math.hypot(station.gridX - patient.gridX, station.gridY - patient.gridY) >= 0.85
      ) {
        addFloatingFeedback(
          patient.gridX,
          patient.gridY,
          clinic.language === 'ar' ? 'الممر إلى السرير مغلق!' : 'Path to station blocked!',
          '#f59e0b'
        );
        return;
      }
      setPatients((prev) =>
        prev.map((p) =>
          p.id === patient.id
            ? {
                ...p,
                assignedStationId: station.instanceId,
                state: 'walking_to_station',
                targetX: station.gridX,
                targetY: station.gridY,
                isSeatedWait: undefined,
                waitingSeatKey: undefined,
                seatHeight: undefined,
                seatApproachX: undefined,
                seatApproachY: undefined,
                seatOffsetX: undefined,
                seatOffsetZ: undefined,
                seatFacingRad: undefined,
                waterCoolerId: undefined,
                idleMoveTimer: undefined,
                headingRad: undefined,
                blockedTicks: 0,
                path: stationPath,
              }
            : p
        )
      );
      setClinic((prev) => ({ ...prev, coins: Math.max(999999, prev.coins + 5) }));
      addFloatingFeedback(
        patient.gridX,
        patient.gridY,
        clinic.language === 'ar' ? 'استدعاء فوري +5' : 'Express Call-In +5',
        '#38bdf8'
      );
      return;
    }

    if (patient.state === 'ready_for_exam' || patient.state === 'walking_to_station') {
      setFocusedPatientId(patient.id);
    }
  };

  // Smart context tap on Reception Desk: checks in a waiting patient or opens staff hiring
  const handleTapReceptionDesk = () => {
    if (visitingFriend) return;
    const waiting = patients.find((p) => p.state === 'waiting_checkin');
    if (waiting) {
      handleTapPatient(waiting);
      return;
    }
    const receptionistHired = clinic.staff.some((s) => s.role === 'receptionist' && s.hired);
    if (!receptionistHired) {
      soundFx.tap();
      setStoreFilter('staff');
      setStoreOpen(true);
      setActiveNavTab('store');
    }
  };

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
                blockedTicks: 0,
                path: buildPatientPath(pt, 32, 15, pt.assignedStationId || undefined),
              }
            : pt
        )
      );
    },
    [addFloatingFeedback, bumpMission, buildPatientPath]
  );

  // Complete clinical reasoning modal -> run live 3D therapy session (or immediate ER referral)
  const handleCompleteCase = (result: {
    patientId: string;
    coinsEarned: number;
    starsEarned: number;
    satisfactionDelta: number;
    caughtRedFlag: boolean;
  }) => {
    const p = patients.find((pt) => pt.id === result.patientId);
    setFocusedPatientId(null);
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
    const durationMs = Math.max(2000, Math.round(4100 / (1 + speedBoost / 100)));

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
  const handleSelectNavTab = (tab: NavTab) => {
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
  };

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
    }
    setPlacementDraft({
      catalogItem: item,
      rotation: 0,
      hoverX: defaultX,
      hoverY: defaultY,
    });
  };

  const handleConfirmPlacement = (gx: number, gy: number, rotation?: 0 | 1 | 2 | 3) => {
    if (!placementDraft) return;
    soundFx.placeItem();

    const finalRotation = rotation ?? placementDraft.rotation;
    const room = clinic.rooms.find(
      (r) => gx >= r.minX - 0.05 && gx < r.maxX + 1 && gy >= r.minY - 0.05 && gy < r.maxY + 1
    );
    const roomId = room ? room.id : 'outdoor';

    const nextPlacedItems = placementDraft.movingInstanceId
      ? clinic.placedItems.map((it) =>
          it.instanceId === placementDraft.movingInstanceId
            ? { ...it, gridX: gx, gridY: gy, rotation: finalRotation, roomId }
            : it
        )
      : [
          ...clinic.placedItems,
          {
            instanceId: 'item_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            catalogId: placementDraft.catalogItem.id,
            gridX: gx,
            gridY: gy,
            rotation: finalRotation,
            roomId,
          },
        ];

    if (placementDraft.movingInstanceId) {
      // Moving existing item
      const movedId = placementDraft.movingInstanceId;
      const updatedBoxes = buildObstacleBoxes(
        clinic.rooms,
        nextPlacedItems,
        itemFootprints,
        clinic.removedTreeIds || []
      );
      const updatedSeats = buildWaitSeatSlots(nextPlacedItems, clinic.rooms);
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
          if (pt.waitingSeatKey && pt.waitingSeatKey.startsWith(movedId + '_')) {
            const matchingSeat = updatedSeats.find((s) => s.seatKey === pt.waitingSeatKey);
            if (matchingSeat && pt.state === 'waiting_checkin') {
              return {
                ...pt,
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
            pt.state !== 'in_treatment' &&
            pt.state !== 'ready_for_exam' &&
            !(pt.state === 'waiting_checkin' && pt.isSeatedWait) &&
            !isTileWalkable(pt.gridX, pt.gridY, 0.21, updatedBoxes)
          ) {
            const safe = findNearestWalkableTile(pt.gridX, pt.gridY, 0.22, updatedBoxes);
            return { ...pt, gridX: safe.x, gridY: safe.y };
          }
          return pt;
        })
      );
      addFloatingFeedback(gx, gy, clinic.language === 'ar' ? 'تم النقل ✓' : 'Moved ✓', '#38bdf8');
    } else {
      // Purchasing new item
      const item = placementDraft.catalogItem;
      if (clinic.coins < item.priceCoins) return;

      const newPlaced = nextPlacedItems[nextPlacedItems.length - 1];
      const updatedBoxes = buildObstacleBoxes(
        clinic.rooms,
        nextPlacedItems,
        itemFootprints,
        clinic.removedTreeIds || []
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
            !(pt.state === 'waiting_checkin' && pt.isSeatedWait) &&
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
        clinic.language === 'ar' ? 'تم التثبيت ✓' : 'Placed ✓',
        '#34d399'
      );
    }

    setPlacementDraft(null);
  };

  const handleSellMovingDraft = (instanceId: string) => {
    const targetItem = clinic.placedItems.find((it) => it.instanceId === instanceId);
    const cat = targetItem ? catalogById.get(targetItem.catalogId) : undefined;
    const refund = cat ? Math.round(cat.priceCoins * 0.7) : 30;
    soundFx.coin();
    setClinic((prev) => ({
      ...prev,
      coins: Math.max(999999, prev.coins + refund),
      placedItems: prev.placedItems.filter((it) => it.instanceId !== instanceId),
    }));
    if (targetItem) {
      addFloatingFeedback(targetItem.gridX, targetItem.gridY, `+${refund}`, '#fbbf24');
    }
    setPlacementDraft(null);
  };

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
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    setClinic((prev) => ({ ...prev, language: lang }));
  };

  const handleToggleSound = () => {
    setClinic((prev) => {
      const next = !prev.soundEnabled;
      soundFx.enabled = next;
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
    treatmentTimersRef.current.forEach((t) => clearTimeout(t));
    treatmentTimersRef.current.clear();
    const fresh = createInitialSaveState();
    fresh.language = clinic.language;
    setClinic(fresh);
    setLastSyncedAt(null);
    setPatients([]);
    setFocusedPatientId(null);
    setPlacementDraft(null);
    setSelectedWorldTree(null);
    setSettingsOpen(false);
  };

  const focusedPatient = useMemo(
    () => patients.find((p) => p.id === focusedPatientId) || null,
    [patients, focusedPatientId]
  );

  const displayedRooms = visitingFriend ? visitingFriend.rooms : clinic.rooms;
  const displayedItems = visitingFriend ? visitingFriend.placedItems : clinic.placedItems;
  const displayedPatients = visitingFriend ? [] : patients;
  const displayedStaff = visitingFriend ? [] : clinic.staff;

  const isAr = clinic.language === 'ar';
  const canUnlockAnyRoom = clinic.rooms.some((r) => !r.unlocked && clinic.coins >= r.unlockCost);

  return (
    <main
      className={`relative w-screen h-screen overflow-hidden transition-colors duration-500 ${
        lightingMode === 'night' ? 'bg-[#050a18]' : 'bg-[#5aa332]'
      }`}
    >
      {/* 2.5D Isometric Clinic Canvas */}
      <ClinicCanvas
        rooms={displayedRooms}
        placedItems={displayedItems}
        patients={displayedPatients}
        staff={displayedStaff}
        playerProfile={clinic.playerProfile || DEFAULT_PLAYER_PROFILE}
        showPlayerCharacter={!visitingFriend}
        floatingFeedbacks={floatingFeedbacks}
        focusedPatientId={focusedPatientId}
        placementDraft={placementDraft}
        editMode={editMode && !visitingFriend}
        isBlurred={Boolean(focusedPatient)}
        language={clinic.language}
        orbitStep={orbitStep}
        lightingMode={lightingMode}
        removedTreeIds={visitingFriend ? EMPTY_REMOVED_TREES : clinic.removedTreeIds ?? EMPTY_REMOVED_TREES}
        selectedTreeId={visitingFriend ? null : selectedWorldTree?.id || null}
        onReceptionCheckinDone={handleReceptionCheckinDone}
        onTapPatient={handleTapPatient}
        onTapLockedRoom={(room) => {
          if (!visitingFriend) {
            soundFx.tap();
            setUnlockTargetRoom(room);
          }
        }}
        onTapWorldTree={(tree) => {
          if (!visitingFriend) {
            soundFx.tap();
            setSelectedWorldTree(tree);
          }
        }}
        onTapPlacedItem={(item) => {
          if (visitingFriend || !editMode) return;
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
        }}
        onLongPressPlacedItem={undefined}
        onStartDragPlacedItem={(item) => {
          if (visitingFriend || !editMode) return;
          const cat = catalogById.get(item.catalogId);
          if (!cat) return;
          setPlacementDraft({
            catalogItem: cat,
            movingInstanceId: item.instanceId,
            rotation: item.rotation,
            hoverX: item.gridX,
            hoverY: item.gridY,
          });
        }}
        onSwitchEditingItem={(nextItem, commitCurrent = true) => {
          if (visitingFriend || !editMode) return;
          const nextCat = catalogById.get(nextItem.catalogId);
          if (!nextCat) return;
          soundFx.tap();
          if (commitCurrent && placementDraft?.movingInstanceId) {
            const prev = placementDraft;
            const targetRoom = clinic.rooms.find(
              (r) =>
                prev.hoverX >= r.minX - 0.05 &&
                prev.hoverX < r.maxX + 1 &&
                prev.hoverY >= r.minY - 0.05 &&
                prev.hoverY < r.maxY + 1
            );
            const nextRoomId = targetRoom ? targetRoom.id : 'outdoor';
            const isMoved = clinic.placedItems.some(
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
        }}
        onTapReceptionDesk={handleTapReceptionDesk}
        onInspectItem={(item) => {
          const assignedPatient = patients.find(
            (pt) => pt.assignedStationId === item.instanceId && pt.state !== 'treated_leaving'
          );
          if (assignedPatient) {
            handleTapPatient(assignedPatient);
            return;
          }
          const cat = catalogById.get(item.catalogId);
          if (cat && (cat.isTreatmentStation || cat.speedBonus > 0)) {
            soundFx.tap();
            addFloatingFeedback(
              item.gridX,
              item.gridY,
              `${cat.nameEn} · ⚡ +${cat.speedBonus}%`,
              '#38bdf8'
            );
          }
        }}
        onUpdatePlacementHover={(gx, gy, rotation) =>
          setPlacementDraft((prev) =>
            prev ? { ...prev, hoverX: gx, hoverY: gy, rotation: rotation ?? prev.rotation } : null
          )
        }
        onConfirmPlacement={handleConfirmPlacement}
        onCancelPlacement={() => {
          soundFx.tap();
          setPlacementDraft(null);
        }}
        onRotatePlacement={() => {
          soundFx.tap();
          setPlacementDraft((prev) => {
            if (!prev) return null;
            if (prev.catalogItem.isWallDecor || isWallDecorId(prev.catalogItem.id)) {
              const validRots = getValidWallRotationsForTile(
                Math.floor(prev.hoverX + 0.05),
                Math.floor(prev.hoverY + 0.05),
                clinic.rooms
              );
              if (validRots.length > 1) {
                const idx = validRots.indexOf(prev.rotation);
                const nextRot = validRots[(idx + 1) % validRots.length];
                return { ...prev, rotation: nextRot };
              }
              const targetRot: 0 | 1 = prev.rotation === 0 ? 1 : 0;
              const occupiedWallKeys = new Set<string>();
              for (const existing of clinic.placedItems) {
                if (existing.instanceId === prev.movingInstanceId) continue;
                const ec = catalogById.get(existing.catalogId);
                if (!ec?.isWallDecor && !isWallDecorId(existing.catalogId)) continue;
                occupiedWallKeys.add(`${existing.gridX},${existing.gridY},${existing.rotation}`);
              }
              let best: { gx: number; gy: number; rotation: 0 | 1; distSq: number } | null = null;
              for (let gx = 2; gx <= 21; gx++) {
                for (let gy = 2; gy <= 21; gy++) {
                  const rots = getValidWallRotationsForTile(gx, gy, clinic.rooms);
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
        }}
        onSellMovingDraft={handleSellMovingDraft}
      />

      {/* Top HUD Cluster: Compact Student Profile (Left) & Controls (Right) */}
      <TopHudBar
        coins={clinic.coins}
        stars={clinic.stars}
        level={clinic.level || 1}
        xp={clinic.xp || 0}
        onlineFriends={friends.filter((f) => f.online).length}
        satisfaction={clinic.satisfaction}
        language={clinic.language}
        lightingMode={lightingMode}
        playerProfile={clinic.playerProfile || DEFAULT_PLAYER_PROFILE}
        visitingFriendName={
          visitingFriend ? (isAr ? visitingFriend.nameAr : visitingFriend.nameEn) : null
        }
        onOpenBonus={() => {
          soundFx.tap();
          setBonusOpen(true);
        }}
        onOpenFriends={() => {
          soundFx.tap();
          setFriendsOpen(true);
        }}
        onOpenSettings={() => {
          soundFx.tap();
          setSettingsOpen(true);
        }}
        onOpenPlayerProfile={() => {
          soundFx.tap();
          setStoreOpen(false);
          setCharacterModalOpen(true);
          setEditMode(false);
          setPlacementDraft(null);
          setActiveNavTab(null);
        }}
        onExitFriendVisit={() => {
          soundFx.tap();
          setVisitingFriend(null);
        }}
      />

      {/* Two-Corner Bottom Navigation (Store & Rearrange) */}
      <BottomNavBar
        activeTab={activeNavTab}
        editMode={editMode && !visitingFriend}
        language={clinic.language}
        lightingMode={lightingMode}
        storeAlert={canUnlockAnyRoom}
        disabled={Boolean(visitingFriend) || Boolean(focusedPatient)}
        onSelectTab={handleSelectNavTab}
        onToggleEditMode={() => {
          soundFx.tap();
          setPlacementDraft(null);
          setStoreOpen(false);
          setMissionsOpen(false);
          setActiveNavTab(null);
          setEditMode((v) => !v);
        }}
      />

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

      {/* Core Educational Feature: Clinical Reasoning Zoom-In */}
      <ClinicalAssessmentModal
        key={focusedPatient?.id || 'none'}
        patient={focusedPatient}
        language={clinic.language}
        lightingMode={lightingMode}
        onClose={() => setFocusedPatientId(null)}
        onCompleteCase={handleCompleteCase}
        onUpdatePatientCase={handleUpdatePatientCase}
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
    </main>
  );
}
