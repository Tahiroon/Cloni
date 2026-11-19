import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Coins, Trash2, Trees, X } from 'lucide-react';
import { BottomNavBar } from './components/BottomNavBar';
import { BonusQuizModal } from './components/BonusQuizModal';
import { ClinicCanvas, PlacementDraft } from './components/ClinicCanvas';
import { ClinicalAssessmentModal } from './components/ClinicalAssessmentModal';
import { FriendsModal } from './components/FriendsModal';
import { MissionsModal } from './components/MissionsModal';
import { RoomUnlockModal } from './components/RoomUnlockModal';
import { SettingsModal } from './components/SettingsModal';
import { StoreSheet } from './components/StoreSheet';
import { TopHudBar } from './components/TopHudBar';
import { WorldTreeDef } from './engine3d/models3d';
import {
  CATALOG_ITEMS,
  createInitialSaveState,
  FALLBACK_CLINICAL_CASES,
  FRIEND_CLINICS,
  SPECIALTY_META,
} from './data/catalog';
import {
  buildObstacleBoxes,
  findGridPath,
  getValidWallRotationsForTile,
  hasContinuousLineOfSight,
  isTileWalkable,
  isWallDecorId,
  resolveTileStep,
  snapToNearestValidWallSlot,
  SOLAR_ZONE,
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
  RoomSpecialty,
  StaffMember,
} from './types/clinic';

const SUDANESE_SKINS = [
  '#59331f', // أسمر غامق
  '#6c4028', // أسمر داكن دافئ
  '#7f4d31', // أسمر سوداني أصيل
  '#945e3d', // قمحي داكن
  '#ab744f', // أسمر فاتح
  '#bc865f', // فاتح دافئ
];

const MALE_CASUAL_LOOKS: Array<{ shirt: string; pants: string; shirtStyle: 'tshirt' | 'shirt' }> = [
  { shirt: '#f1f5f9', pants: '#1e293b', shirtStyle: 'shirt' },
  { shirt: '#0369a1', pants: '#334155', shirtStyle: 'tshirt' },
  { shirt: '#3f6212', pants: '#27272a', shirtStyle: 'tshirt' },
  { shirt: '#7c2d12', pants: '#1e293b', shirtStyle: 'shirt' },
  { shirt: '#334155', pants: '#475569', shirtStyle: 'shirt' },
  { shirt: '#0f766e', pants: '#1e293b', shirtStyle: 'tshirt' },
  { shirt: '#b45309', pants: '#27272a', shirtStyle: 'tshirt' },
  { shirt: '#1d4ed8', pants: '#334155', shirtStyle: 'shirt' },
];

const FEMALE_ABAYA_COLORS = [
  '#17171b',
  '#1e293b',
  '#172554',
  '#3b1d2a',
  '#133c42',
  '#3b2a22',
];
const FEMALE_OPEN_ABAYA_LOOKS = [
  { outer: '#18181b', inner: '#e5dfd3' },
  { outer: '#1e293b', inner: '#cbd5e1' },
  { outer: '#114247', inner: '#d6ccc2' },
  { outer: '#4a1d32', inner: '#e2d4d8' },
  { outer: '#362922', inner: '#dfd7cc' },
];
const FEMALE_DRESS_COLORS = ['#3d6b58', '#8b4958', '#0f5e73', '#8f4730', '#58355e'];
const FEMALE_CASUAL_LOOKS = [
  { shirt: '#0e7490', pants: '#1e293b' },
  { shirt: '#9f1239', pants: '#1e293b' },
  { shirt: '#334155', pants: '#0f172a' },
  { shirt: '#6b4f3a', pants: '#27272a' },
];

const EMPTY_REMOVED_TREES: string[] = [];

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

  const lightingMode: LightingMode = clinic.lightingMode || 'day';

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
    () => buildObstacleBoxes(clinic.rooms, clinic.placedItems, itemFootprints),
    [clinic.rooms, clinic.placedItems, itemFootprints]
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

        // Keep unlimited coins active on this account
        nextState = {
          ...nextState,
          lightingMode: nextState.lightingMode || 'day',
          removedTreeIds: nextState.removedTreeIds || [],
          version: 6,
          coins: 999999,
        };
        setClinic(nextState);
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
      setClinic((prev) => ({ ...prev, lastSyncedAt: iso }));
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

  // Pick a walkable reception desk check-in spot in front of the desk
  const getReceptionCheckinSpot = useCallback(
    (currentPatients: PatientEntity[]) => {
      const desk = clinic.placedItems.find((it) => it.catalogId === 'reception_desk');
      const rawSpots = desk
        ? desk.rotation === 0
          ? [
              { x: desk.gridX + 1, y: desk.gridY + 1 },
              { x: desk.gridX, y: desk.gridY + 1 },
              { x: desk.gridX + 1, y: Math.min(20, desk.gridY + 2) },
            ]
          : desk.rotation === 2
            ? [
                { x: desk.gridX, y: desk.gridY - 1 },
                { x: desk.gridX + 1, y: desk.gridY - 1 },
              ]
            : desk.rotation === 1
              ? [
                  { x: desk.gridX - 1, y: desk.gridY },
                  { x: desk.gridX - 1, y: desk.gridY + 1 },
                ]
              : [
                  { x: desk.gridX + 1, y: desk.gridY },
                  { x: desk.gridX + 1, y: desk.gridY + 1 },
                ]
        : [
            { x: 15, y: 13 },
            { x: 14, y: 13 },
            { x: 15, y: 14 },
          ];
      const spots = rawSpots.filter((s) => isTileWalkable(s.x, s.y, 0.22, obstacleBoxes));
      const pool = spots.length > 0 ? spots : [{ x: 15, y: 14 }, { x: 16, y: 14 }];
      const occupied = new Set(
        currentPatients
          .filter((p) => p.state === 'arriving' || p.state === 'checkin_at_desk')
          .map((p) => `${Math.round(p.targetX)},${Math.round(p.targetY)}`)
      );
      return pool.find((s) => !occupied.has(`${s.x},${s.y}`)) || pool[0];
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
            item.gridX >= r.minX &&
            item.gridX <= r.maxX &&
            item.gridY >= r.minY &&
            item.gridY <= r.maxY
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

  // Pick the nearest unoccupied waiting seat (waiting_chairs or park_bench) or null if all full
  const pickNearestFreeWaitingSeat = useCallback(
    (
      fromX: number,
      fromY: number,
      currentPatients: PatientEntity[],
      excludePatientId?: string
    ) => {
      const seats: Array<{
        x: number;
        y: number;
        offX: number;
        offZ: number;
        facingRad: number;
        seatHeight: number;
        seatKey: string;
        itemId: string;
        isOutdoor: boolean;
      }> = [];

      for (const item of clinic.placedItems) {
        const room = clinic.rooms.find(
          (r) =>
            item.gridX >= r.minX &&
            item.gridX <= r.maxX &&
            item.gridY >= r.minY &&
            item.gridY <= r.maxY
        );
        if (room && !room.unlocked) continue;

        if (item.catalogId === 'park_bench') {
          if (item.rotation === 0) {
            seats.push({ x: item.gridX, y: item.gridY, offX: 0.04, offZ: 0.12, facingRad: Math.PI / 2, seatHeight: 0.4, seatKey: `${item.instanceId}_0`, itemId: item.instanceId, isOutdoor: !room });
            seats.push({ x: item.gridX, y: item.gridY + 1, offX: 0.04, offZ: -0.12, facingRad: Math.PI / 2, seatHeight: 0.4, seatKey: `${item.instanceId}_1`, itemId: item.instanceId, isOutdoor: !room });
          } else if (item.rotation === 2) {
            seats.push({ x: item.gridX, y: item.gridY, offX: -0.04, offZ: 0.12, facingRad: -Math.PI / 2, seatHeight: 0.4, seatKey: `${item.instanceId}_0`, itemId: item.instanceId, isOutdoor: !room });
            seats.push({ x: item.gridX, y: item.gridY + 1, offX: -0.04, offZ: -0.12, facingRad: -Math.PI / 2, seatHeight: 0.4, seatKey: `${item.instanceId}_1`, itemId: item.instanceId, isOutdoor: !room });
          } else if (item.rotation === 1) {
            seats.push({ x: item.gridX, y: item.gridY, offX: 0.12, offZ: 0.04, facingRad: 0, seatHeight: 0.4, seatKey: `${item.instanceId}_0`, itemId: item.instanceId, isOutdoor: !room });
            seats.push({ x: item.gridX + 1, y: item.gridY, offX: -0.12, offZ: 0.04, facingRad: 0, seatHeight: 0.4, seatKey: `${item.instanceId}_1`, itemId: item.instanceId, isOutdoor: !room });
          } else {
            seats.push({ x: item.gridX, y: item.gridY, offX: 0.12, offZ: -0.04, facingRad: Math.PI, seatHeight: 0.4, seatKey: `${item.instanceId}_0`, itemId: item.instanceId, isOutdoor: !room });
            seats.push({ x: item.gridX + 1, y: item.gridY, offX: -0.12, offZ: -0.04, facingRad: Math.PI, seatHeight: 0.4, seatKey: `${item.instanceId}_1`, itemId: item.instanceId, isOutdoor: !room });
          }
        } else if (item.catalogId === 'waiting_chairs') {
          if (item.rotation === 0) {
            seats.push({ x: item.gridX, y: item.gridY, offX: 0.12, offZ: 0.06, facingRad: 0, seatHeight: 0.35, seatKey: `${item.instanceId}_0`, itemId: item.instanceId, isOutdoor: !room });
            seats.push({ x: item.gridX + 1, y: item.gridY, offX: -0.12, offZ: 0.06, facingRad: 0, seatHeight: 0.35, seatKey: `${item.instanceId}_1`, itemId: item.instanceId, isOutdoor: !room });
          } else if (item.rotation === 2) {
            seats.push({ x: item.gridX, y: item.gridY, offX: 0.12, offZ: -0.06, facingRad: Math.PI, seatHeight: 0.35, seatKey: `${item.instanceId}_0`, itemId: item.instanceId, isOutdoor: !room });
            seats.push({ x: item.gridX + 1, y: item.gridY, offX: -0.12, offZ: -0.06, facingRad: Math.PI, seatHeight: 0.35, seatKey: `${item.instanceId}_1`, itemId: item.instanceId, isOutdoor: !room });
          } else if (item.rotation === 1) {
            seats.push({ x: item.gridX, y: item.gridY, offX: -0.06, offZ: 0.12, facingRad: -Math.PI / 2, seatHeight: 0.35, seatKey: `${item.instanceId}_0`, itemId: item.instanceId, isOutdoor: !room });
            seats.push({ x: item.gridX, y: item.gridY + 1, offX: -0.06, offZ: -0.12, facingRad: -Math.PI / 2, seatHeight: 0.35, seatKey: `${item.instanceId}_1`, itemId: item.instanceId, isOutdoor: !room });
          } else {
            seats.push({ x: item.gridX, y: item.gridY, offX: 0.06, offZ: 0.12, facingRad: Math.PI / 2, seatHeight: 0.35, seatKey: `${item.instanceId}_0`, itemId: item.instanceId, isOutdoor: !room });
            seats.push({ x: item.gridX, y: item.gridY + 1, offX: 0.06, offZ: -0.12, facingRad: Math.PI / 2, seatHeight: 0.35, seatKey: `${item.instanceId}_1`, itemId: item.instanceId, isOutdoor: !room });
          }
        } else if (item.catalogId === 'lounge_chair' || item.catalogId === 'luxury_chair') {
          const sHeight = item.catalogId === 'luxury_chair' ? 0.36 : 0.34;
          if (item.rotation === 0) {
            seats.push({ x: item.gridX, y: item.gridY, offX: 0, offZ: 0.06, facingRad: 0, seatHeight: sHeight, seatKey: `${item.instanceId}_0`, itemId: item.instanceId, isOutdoor: !room });
          } else if (item.rotation === 1) {
            seats.push({ x: item.gridX, y: item.gridY, offX: -0.06, offZ: 0, facingRad: -Math.PI / 2, seatHeight: sHeight, seatKey: `${item.instanceId}_0`, itemId: item.instanceId, isOutdoor: !room });
          } else if (item.rotation === 2) {
            seats.push({ x: item.gridX, y: item.gridY, offX: 0, offZ: -0.06, facingRad: Math.PI, seatHeight: sHeight, seatKey: `${item.instanceId}_0`, itemId: item.instanceId, isOutdoor: !room });
          } else {
            seats.push({ x: item.gridX, y: item.gridY, offX: 0.06, offZ: 0, facingRad: Math.PI / 2, seatHeight: sHeight, seatKey: `${item.instanceId}_0`, itemId: item.instanceId, isOutdoor: !room });
          }
        }
      }

      if (seats.length === 0) return null;

      const claimedKeys = new Set<string>();
      const claimedCoords = new Set<string>();
      for (const p of currentPatients) {
        if (p.id === excludePatientId) continue;
        if (p.state !== 'walking_to_wait' && p.state !== 'waiting_checkin') continue;
        if (p.isSeatedWait === false) continue;
        if (p.waitingSeatKey) claimedKeys.add(p.waitingSeatKey);
        claimedCoords.add(`${Math.round(p.targetX)},${Math.round(p.targetY)}`);
      }

      const freeSeats = seats.filter(
        (s) => !claimedKeys.has(s.seatKey) && !claimedCoords.has(`${s.x},${s.y}`)
      );
      if (freeSeats.length === 0) return null;

      freeSeats.sort((a, b) => {
        const da = Math.hypot(a.x - fromX, a.y - fromY);
        const db = Math.hypot(b.x - fromX, b.y - fromY);
        return da - db;
      });
      return freeSeats[0];
    },
    [clinic.placedItems, clinic.rooms]
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
        let outfitStyle: 'casual' | 'jalabiya' | 'abaya' | 'abaya_open' | 'dress' = 'casual';
        let shirtStyle: 'tshirt' | 'shirt' | undefined;
        const heightScale = chosenCase.age < 15 ? 0.78 : undefined;
        let shirtColor = '#ece9e1';
        let pantsColor = '#1e293b';
        let hasHijab = false;
        let hasTurban = false;

        if (isFemale) {
          hasHijab = true; // All women wear a Tarha/Hijab cleanly
          const roll = Math.random();
          if (roll < 0.45) {
            outfitStyle = 'abaya';
            shirtColor =
              FEMALE_ABAYA_COLORS[Math.floor(Math.random() * FEMALE_ABAYA_COLORS.length)];
            pantsColor = shirtColor;
          } else if (roll < 0.72) {
            outfitStyle = 'abaya_open';
            const openLook =
              FEMALE_OPEN_ABAYA_LOOKS[Math.floor(Math.random() * FEMALE_OPEN_ABAYA_LOOKS.length)];
            shirtColor = openLook.outer;
            pantsColor = openLook.inner;
          } else if (roll < 0.86) {
            outfitStyle = 'dress';
            shirtColor =
              FEMALE_DRESS_COLORS[Math.floor(Math.random() * FEMALE_DRESS_COLORS.length)];
            pantsColor = shirtColor;
          } else {
            outfitStyle = 'casual';
            const c = FEMALE_CASUAL_LOOKS[Math.floor(Math.random() * FEMALE_CASUAL_LOOKS.length)];
            shirtColor = c.shirt;
            pantsColor = c.pants;
          }
        } else {
          // Older men (>=35): mostly Jalabiya (~82%); youth/kids (<35): mostly trousers + t-shirt/shirt (~85-100%)
          const jalabiyaChance = chosenCase.age < 15 ? 0 : chosenCase.age >= 35 ? 0.82 : 0.15;
          const wearJalabiya = Math.random() < jalabiyaChance;
          outfitStyle = wearJalabiya ? 'jalabiya' : 'casual';
          if (wearJalabiya) {
            const jTones = ['#f3f0e8', '#ebe3d3', '#e6edf2', '#dfd5c2'];
            shirtColor = jTones[Math.floor(Math.random() * jTones.length)];
            pantsColor = shirtColor;
            hasTurban = chosenCase.age >= 40 ? Math.random() < 0.72 : Math.random() < 0.45;
          } else {
            const c = MALE_CASUAL_LOOKS[Math.floor(Math.random() * MALE_CASUAL_LOOKS.length)];
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
      updated.state = 'walking_to_wait';
      updated.waitTimer = 0;
      updated.waterCoolerId = undefined;

      if (seat) {
        updated.isSeatedWait = true;
        updated.waitingSeatKey = seat.seatKey;
        updated.seatHeight = seat.seatHeight;
        updated.targetX = seat.x;
        updated.targetY = seat.y;
        updated.seatOffsetX = seat.offX;
        updated.seatOffsetZ = seat.offZ;
        updated.seatFacingRad = seat.facingRad;
        updated.idleMoveTimer = undefined;
        updated.path = findGridPath(
          updated.gridX,
          updated.gridY,
          seat.x,
          seat.y,
          clinic.rooms,
          clinic.placedItems,
          itemFootprints,
          obstacleBoxes,
          seat.itemId
        );
      } else {
        const standSpot = findStandingWaitSpot(claimedSoFar, updated.id);
        updated.isSeatedWait = false;
        updated.waitingSeatKey = undefined;
        updated.seatHeight = undefined;
        updated.seatOffsetX = undefined;
        updated.seatOffsetZ = undefined;
        updated.seatFacingRad = undefined;
        updated.targetX = standSpot.x;
        updated.targetY = standSpot.y;
        updated.idleMoveTimer = 2400 + Math.random() * 2000;
        updated.path = findGridPath(
          updated.gridX,
          updated.gridY,
          standSpot.x,
          standSpot.y,
          clinic.rooms,
          clinic.placedItems,
          itemFootprints,
          obstacleBoxes
        );
      }
    };

    const tick = setInterval(() => {
      const nowMs = performance.now();
      const dtSec = Math.min(0.15, Math.max(0.03, (nowMs - lastTickMs) / 1000));
      const dtMs = dtSec * 1000;
      lastTickMs = nowMs;

      setPatients((prev) => {
        let changed = false;
        const nextList: PatientEntity[] = [];

        for (let idx = 0; idx < prev.length; idx++) {
          const p = prev[idx];
          const updated = { ...p };
          const seatItemId = updated.waitingSeatKey
            ? updated.waitingSeatKey.slice(0, updated.waitingSeatKey.lastIndexOf('_'))
            : undefined;
          const ignoreId =
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
            // Smooth corner rounding when next-next waypoint has clear obstacle-free sightline
            let activePath = updated.path;
            if (
              activePath.length >= 2 &&
              hasContinuousLineOfSight(
                updated.gridX,
                updated.gridY,
                activePath[1].x,
                activePath[1].y,
                0.24,
                obstacleBoxes,
                ignoreId
              )
            ) {
              activePath = activePath.slice(1);
              updated.path = activePath;
            }

            const nextNode = activePath[0];
            const dx = nextNode.x - updated.gridX;
            const dy = nextNode.y - updated.gridY;
            const dist = Math.hypot(dx, dy);
            // Natural brisk walking speed (~1.62 tiles/sec) independent of tick jitter
            const speedStep = 1.62 * dtSec;

            if (activePath.length > 1 && dist <= 0.34) {
              updated.path = activePath.slice(1);
            } else if (dist <= speedStep) {
              const res = resolveTileStep(
                updated.gridX,
                updated.gridY,
                nextNode.x,
                nextNode.y,
                0.22,
                obstacleBoxes,
                ignoreId
              );
              updated.gridX = res.x;
              updated.gridY = res.y;
              updated.path = activePath.slice(1);
            } else {
              // Gentle separation steering only in open spaces (never push anyone into walls)
              let avoidX = 0;
              let avoidY = 0;
              for (let j = 0; j < prev.length; j++) {
                if (j === idx) continue;
                const other = prev[j];
                if (other.state === 'ready_for_exam' || other.state === 'in_treatment') continue;
                const sx = updated.gridX - other.gridX;
                const sy = updated.gridY - other.gridY;
                const sd = Math.hypot(sx, sy);
                if (sd > 0.01 && sd < 0.7) {
                  const push = (0.7 - sd) * 0.36;
                  avoidX += (sx / sd) * push;
                  avoidY += (sy / sd) * push;
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
                0.22,
                obstacleBoxes,
                ignoreId
              );
              updated.gridX = res.x;
              updated.gridY = res.y;
            }

            updated.walkPhase += speedStep * 3.4;
            changed = true;
          } else {
            // Reached current waypoint
            if (updated.state === 'arriving') {
              updated.state = 'checkin_at_desk';
              updated.waitTimer = 0;
              changed = true;
            } else if (updated.state === 'checkin_at_desk') {
              updated.waitTimer += dtMs;
              const checkinMs = receptionistHired ? 780 : 1200;
              if (updated.waitTimer >= checkinMs) {
                const claimedSoFar = [...nextList, ...prev.slice(idx + 1)];
                const coolerSpot =
                  Math.random() < 0.46
                    ? pickFreeWaterCoolerSpot(claimedSoFar, updated.id)
                    : null;

                const coolerPath = coolerSpot
                  ? findGridPath(
                      updated.gridX,
                      updated.gridY,
                      coolerSpot.x,
                      coolerSpot.y,
                      clinic.rooms,
                      clinic.placedItems,
                      itemFootprints,
                      obstacleBoxes
                    )
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
              if (updated.waitTimer >= 3650) {
                const claimedSoFar = [...nextList, ...prev.slice(idx + 1)];
                assignWaitingDestination(updated, claimedSoFar);
                changed = true;
              }
            } else if (updated.state === 'walking_to_wait') {
              updated.state = 'waiting_checkin';
              updated.waitTimer = 0;
              if (updated.isSeatedWait === false) {
                updated.idleMoveTimer = 2200 + Math.random() * 1800;
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
                  if (openSeat) {
                    updated.state = 'walking_to_wait';
                    updated.isSeatedWait = true;
                    updated.waitingSeatKey = openSeat.seatKey;
                    updated.seatHeight = openSeat.seatHeight;
                    updated.targetX = openSeat.x;
                    updated.targetY = openSeat.y;
                    updated.seatOffsetX = openSeat.offX;
                    updated.seatOffsetZ = openSeat.offZ;
                    updated.seatFacingRad = openSeat.facingRad;
                    updated.idleMoveTimer = undefined;
                    updated.path = findGridPath(
                      updated.gridX,
                      updated.gridY,
                      openSeat.x,
                      openSeat.y,
                      clinic.rooms,
                      clinic.placedItems,
                      itemFootprints,
                      obstacleBoxes,
                      openSeat.itemId
                    );
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
                      updated.targetX = drift.x;
                      updated.targetY = drift.y;
                      updated.path = findGridPath(
                        updated.gridX,
                        updated.gridY,
                        drift.x,
                        drift.y,
                        clinic.rooms,
                        clinic.placedItems,
                        itemFootprints,
                        obstacleBoxes
                      );
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
                  updated.assignedStationId = station.instanceId;
                  updated.state = 'walking_to_station';
                  updated.targetX = station.gridX;
                  updated.targetY = station.gridY;
                  updated.isSeatedWait = undefined;
                  updated.waitingSeatKey = undefined;
                  updated.seatHeight = undefined;
                  updated.seatOffsetX = undefined;
                  updated.seatOffsetZ = undefined;
                  updated.seatFacingRad = undefined;
                  updated.waterCoolerId = undefined;
                  updated.idleMoveTimer = undefined;
                  updated.headingRad = undefined;
                  updated.path = findGridPath(
                    updated.gridX,
                    updated.gridY,
                    station.gridX,
                    station.gridY,
                    clinic.rooms,
                    clinic.placedItems,
                    itemFootprints,
                    obstacleBoxes,
                    station.instanceId
                  );
                  changed = true;
                }
              }
            } else if (updated.state === 'walking_to_station') {
              updated.state = 'ready_for_exam';
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
              changed = true;
              continue;
            }
          }

          nextList.push(updated);
        }

        // Non-clipping personal-space resolution for standing/walking patients
        for (let i = 0; i < nextList.length; i++) {
          const a = nextList[i];
          if (a.state === 'ready_for_exam' || a.state === 'in_treatment' || a.isSeatedWait) continue;
          for (let j = 0; j < nextList.length; j++) {
            if (i === j) continue;
            const b = nextList[j];
            if (b.state === 'ready_for_exam' || b.state === 'in_treatment') continue;
            const sx = a.gridX - b.gridX;
            const sy = a.gridY - b.gridY;
            const d = Math.hypot(sx, sy);
            if (d > 0.001 && d < 0.62) {
              const push = (0.62 - d) * 0.22;
              const candX = a.gridX + (sx / d) * push;
              const candY = a.gridY + (sy / d) * push;
              const res = resolveTileStep(a.gridX, a.gridY, candX, candY, 0.22, obstacleBoxes);
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
    }, 95);

    return () => clearInterval(tick);
  }, [
    hydrated,
    visitingFriend,
    clinic.rooms,
    clinic.placedItems,
    clinic.staff,
    findFreeStation,
    pickNearestFreeWaitingSeat,
    pickFreeWaterCoolerSpot,
    findStandingWaitSpot,
    itemFootprints,
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
      setPatients((prev) =>
        prev.map((p) =>
          p.id === patient.id
            ? {
                ...p,
                assignedStationId: station.instanceId,
                state: 'walking_to_station',
                isSeatedWait: undefined,
                waitingSeatKey: undefined,
                seatHeight: undefined,
                seatOffsetX: undefined,
                seatOffsetZ: undefined,
                seatFacingRad: undefined,
                waterCoolerId: undefined,
                idleMoveTimer: undefined,
                headingRad: undefined,
                path: findGridPath(
                  p.gridX,
                  p.gridY,
                  station.gridX,
                  station.gridY,
                  clinic.rooms,
                  clinic.placedItems,
                  itemFootprints,
                  obstacleBoxes,
                  station.instanceId
                ),
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
                path: findGridPath(
                  pt.gridX,
                  pt.gridY,
                  32,
                  15,
                  clinic.rooms,
                  clinic.placedItems,
                  itemFootprints,
                  obstacleBoxes,
                  pt.assignedStationId || undefined
                ),
              }
            : pt
        )
      );
    },
    [addFloatingFeedback, bumpMission, clinic.placedItems, clinic.rooms, itemFootprints, obstacleBoxes]
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

    setTimeout(() => {
      finishTreatmentAndReward({ ...result, gridX: p.gridX, gridY: p.gridY });
    }, durationMs);
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
        for (let dx = 0; dx < ew; dx++) {
          for (let dy = 0; dy < ed; dy++) {
            occupiedTiles.add(`${existing.gridX + dx},${existing.gridY + dy}`);
          }
        }
      }

      const maxSlotX = SOLAR_ZONE.maxX - effW + 1;
      const maxSlotY = SOLAR_ZONE.maxY - effD + 1;
      const preferredXs: number[] = [];
      for (let x = 6; x <= maxSlotX; x++) preferredXs.push(x);
      for (let x = SOLAR_ZONE.minX; x < 6 && x <= maxSlotX; x++) preferredXs.push(x);

      let chosenX = Math.min(8, maxSlotX);
      let chosenY = SOLAR_ZONE.minY;
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

    // Suggest a sensible default hover coordinate based on indoor vs outdoor
    const defaultX = item.indoorAllowed === false ? 23 : 6;
    const defaultY = item.indoorAllowed === false ? 5 : 14;
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
      (r) => gx >= r.minX && gx <= r.maxX && gy >= r.minY && gy <= r.maxY
    );
    const roomId = room ? room.id : 'outdoor';

    if (placementDraft.movingInstanceId) {
      // Moving existing item
      setClinic((prev) => ({
        ...prev,
        placedItems: prev.placedItems.map((it) =>
          it.instanceId === placementDraft.movingInstanceId
            ? { ...it, gridX: gx, gridY: gy, rotation: finalRotation, roomId }
            : it
        ),
      }));
      addFloatingFeedback(gx, gy, clinic.language === 'ar' ? 'تم النقل ✓' : 'Moved ✓', '#38bdf8');
    } else {
      // Purchasing new item
      const item = placementDraft.catalogItem;
      if (clinic.coins < item.priceCoins) return;

      const newPlaced: PlacedItem = {
        instanceId: 'item_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        catalogId: item.id,
        gridX: gx,
        gridY: gy,
        rotation: finalRotation,
        roomId,
      };

      setClinic((prev) => ({
        ...prev,
        coins: prev.coins >= 900000 ? 999999 : prev.coins - item.priceCoins,
        satisfaction: Math.min(100, prev.satisfaction + Math.min(2, item.satisfactionBonus)),
        placedItems: [...prev.placedItems, newPlaced],
      }));

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
    const fresh = createInitialSaveState();
    fresh.language = clinic.language;
    setClinic(fresh);
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
          if (visitingFriend) return;
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
        onLongPressPlacedItem={(item) => {
          if (visitingFriend) return;
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
                prev.hoverX,
                prev.hoverY,
                clinic.rooms
              );
              if (validRots.length > 0) {
                const idx = validRots.indexOf(prev.rotation);
                const nextRot = validRots[(idx + 1) % validRots.length];
                return { ...prev, rotation: nextRot };
              }
              const snapped = snapToNearestValidWallSlot(
                prev.hoverX + 0.5,
                prev.hoverY + 0.5,
                ((prev.rotation + 1) % 4) as 0 | 1 | 2 | 3,
                clinic.rooms
              );
              if (snapped) {
                return {
                  ...prev,
                  hoverX: snapped.gx,
                  hoverY: snapped.gy,
                  rotation: snapped.rotation,
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
        lastSyncedAt={clinic.lastSyncedAt}
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
            setClinic((prev) => ({ ...prev, lastSyncedAt: iso }));
          });
        }}
        onResetClinic={handleResetClinic}
      />

      {/* Outdoor Tree Paid Removal Confirmation Card */}
      {selectedWorldTree && (
        <div
          className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4 bg-slate-950/40 backdrop-blur-[2px]"
          onClick={() => setSelectedWorldTree(null)}
        >
          <div
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
                    {isAr ? 'إزالة شجرة خارجية' : 'Remove Outdoor Tree'}
                  </h3>
                  <p
                    className={`text-xs mt-0.5 ${
                      lightingMode === 'night' ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    {isAr
                      ? 'ادفع رسوم الإزالة لإخلاء هذه الشجرة من محيط العيادة نهائياً'
                      : 'Pay a small clearing fee to permanently remove this tree'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedWorldTree(null)}
                aria-label="Close"
                className={`p-1.5 rounded-xl transition-colors ${
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
                className={`flex-1 py-2.5 px-3 rounded-2xl text-xs font-extrabold transition-colors ${
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
                className={`flex-[1.4] py-2.5 px-4 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 shadow transition-transform active:scale-95 ${
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
