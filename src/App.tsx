import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  CATALOG_ITEMS,
  createInitialSaveState,
  FALLBACK_CLINICAL_CASES,
  FRIEND_CLINICS,
  SPECIALTY_META,
} from './data/catalog';
import { canStepBetween, findGridPath } from './engine/isometricMath';
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
  const [focusedPatientId, setFocusedPatientId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [goldenHour, setGoldenHour] = useState(false);
  const [placementDraft, setPlacementDraft] = useState<PlacementDraft | null>(null);

  // Queue for optional AI-generated cases fetched silently in background
  const aiCasePoolRef = useRef<ClinicalCase[]>([]);
  const fetchingAiCaseRef = useRef(false);

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
            lastSyncedAt: saved.lastSyncedAt || null,
          };
        }

        // Keep unlimited coins active on this account
        nextState = { ...nextState, version: 6, coins: 999999 };
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

  // Pre-warm 1 Gemini clinical case in background when online
  const prefetchAiCase = useCallback(async (unlockedSpecs: RoomSpecialty[]) => {
    if (fetchingAiCaseRef.current || aiCasePoolRef.current.length >= 2) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    fetchingAiCaseRef.current = true;
    try {
      const spec = unlockedSpecs[Math.floor(Math.random() * unlockedSpecs.length)] || 'orthopedics';
      const res = await fetch('/api/clinical/generate-case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specialty: spec }),
      });
      if (res.ok) {
        const data = (await res.json()) as ClinicalCase;
        if (data && data.chiefComplaintEn && Array.isArray(data.diagnosisOptions)) {
          aiCasePoolRef.current.push(data);
        }
      }
    } catch {
      // Offline fallback works seamlessly
    } finally {
      fetchingAiCaseRef.current = false;
    }
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

  // Find available treatment station in unlocked rooms
  const findFreeStation = useCallback(
    (currentPatients: PatientEntity[]): PlacedItem | null => {
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

      return stations.length > 0 ? stations[Math.floor(Math.random() * stations.length)] : null;
    },
    [clinic.placedItems, clinic.rooms, catalogById]
  );

  // Pick a reception desk check-in spot in front of the desk
  const getReceptionCheckinSpot = useCallback(
    (currentPatients: PatientEntity[]) => {
      const desk = clinic.placedItems.find((it) => it.catalogId === 'reception_desk');
      const spots = desk
        ? [
            { x: desk.gridX + 1, y: desk.gridY + 1 },
            { x: desk.gridX, y: desk.gridY + 1 },
            { x: desk.gridX + 1, y: Math.min(20, desk.gridY + 2) },
          ]
        : [
            { x: 15, y: 13 },
            { x: 14, y: 13 },
            { x: 15, y: 14 },
          ];
      const occupied = new Set(
        currentPatients
          .filter((p) => p.state === 'arriving' || p.state === 'checkin_at_desk')
          .map((p) => `${Math.round(p.targetX)},${Math.round(p.targetY)}`)
      );
      return spots.find((s) => !occupied.has(`${s.x},${s.y}`)) || spots[0];
    },
    [clinic.placedItems]
  );

  // Pick a waiting seat (outdoor park_bench or indoor waiting_chairs)
  const pickWaitingSeat = useCallback(
    (currentPatients: PatientEntity[], excludePatientId?: string) => {
      const seats: Array<{
        x: number;
        y: number;
        offX: number;
        offZ: number;
        facingRad: number;
        isOutdoor: boolean;
      }> = [];

      for (const item of clinic.placedItems) {
        if (item.catalogId === 'park_bench') {
          if (item.rotation === 0) {
            seats.push({ x: item.gridX, y: item.gridY, offX: 0.12, offZ: 0.08, facingRad: Math.PI / 2, isOutdoor: true });
            seats.push({ x: item.gridX, y: item.gridY + 1, offX: 0.12, offZ: -0.08, facingRad: Math.PI / 2, isOutdoor: true });
          } else if (item.rotation === 2) {
            seats.push({ x: item.gridX, y: item.gridY, offX: -0.12, offZ: 0.08, facingRad: -Math.PI / 2, isOutdoor: true });
            seats.push({ x: item.gridX, y: item.gridY + 1, offX: -0.12, offZ: -0.08, facingRad: -Math.PI / 2, isOutdoor: true });
          } else if (item.rotation === 1) {
            seats.push({ x: item.gridX, y: item.gridY, offX: 0.08, offZ: 0.12, facingRad: 0, isOutdoor: true });
            seats.push({ x: item.gridX + 1, y: item.gridY, offX: -0.08, offZ: 0.12, facingRad: 0, isOutdoor: true });
          } else {
            seats.push({ x: item.gridX, y: item.gridY, offX: 0.08, offZ: -0.12, facingRad: Math.PI, isOutdoor: true });
            seats.push({ x: item.gridX + 1, y: item.gridY, offX: -0.08, offZ: -0.12, facingRad: Math.PI, isOutdoor: true });
          }
        } else if (item.catalogId === 'waiting_chairs') {
          if (item.rotation === 0) {
            seats.push({ x: item.gridX, y: item.gridY, offX: -0.06, offZ: 0.15, facingRad: 0, isOutdoor: false });
            seats.push({ x: item.gridX + 1, y: item.gridY, offX: 0.06, offZ: 0.15, facingRad: 0, isOutdoor: false });
          } else if (item.rotation === 2) {
            seats.push({ x: item.gridX, y: item.gridY, offX: -0.06, offZ: -0.15, facingRad: Math.PI, isOutdoor: false });
            seats.push({ x: item.gridX + 1, y: item.gridY, offX: 0.06, offZ: -0.15, facingRad: Math.PI, isOutdoor: false });
          } else if (item.rotation === 1) {
            seats.push({ x: item.gridX, y: item.gridY, offX: -0.15, offZ: -0.06, facingRad: -Math.PI / 2, isOutdoor: false });
            seats.push({ x: item.gridX, y: item.gridY + 1, offX: -0.15, offZ: 0.06, facingRad: -Math.PI / 2, isOutdoor: false });
          } else {
            seats.push({ x: item.gridX, y: item.gridY, offX: 0.15, offZ: -0.06, facingRad: Math.PI / 2, isOutdoor: false });
            seats.push({ x: item.gridX, y: item.gridY + 1, offX: 0.15, offZ: 0.06, facingRad: Math.PI / 2, isOutdoor: false });
          }
        }
      }

      if (seats.length === 0) {
        return { x: 16, y: 18, offX: 0, offZ: 0, facingRad: 0, isOutdoor: false };
      }

      const occupied = new Set(
        currentPatients
          .filter(
            (p) =>
              p.id !== excludePatientId &&
              (p.state === 'walking_to_wait' || p.state === 'waiting_checkin')
          )
          .map((p) => `${Math.round(p.targetX)},${Math.round(p.targetY)}`)
      );

      const freeSeats = seats.filter((s) => !occupied.has(`${s.x},${s.y}`));
      const pool = freeSeats.length > 0 ? freeSeats : seats;
      const outdoorFree = pool.filter((s) => s.isOutdoor);
      const indoorFree = pool.filter((s) => !s.isOutdoor);

      // Balance outdoor courtyard benches & indoor waiting lounge so patients actively use outside chairs too
      if (outdoorFree.length > 0 && (indoorFree.length === 0 || Math.random() < 0.58)) {
        return outdoorFree[Math.floor(Math.random() * outdoorFree.length)];
      }
      return pool[Math.floor(Math.random() * pool.length)];
    },
    [clinic.placedItems]
  );

  // Patient Spawner (calm pace: arrives -> Reception Desk -> outdoor bench / waiting chairs -> treatment wing)
  useEffect(() => {
    if (!hydrated || visitingFriend) return;

    const spawnCheck = () => {
      setPatients((prev) => {
        const unlockedTreatmentWings = clinic.rooms.filter(
          (r) => r.unlocked && r.specialty !== 'reception'
        ).length;
        const stationCount = clinic.placedItems.filter((i) => catalogById.get(i.catalogId)?.isTreatmentStation).length;
        const maxActive = Math.min(3, Math.min(Math.max(1, stationCount), unlockedTreatmentWings + 1));
        const activeCount = prev.filter((p) => p.state !== 'treated_leaving').length;
        if (activeCount >= maxActive) return prev;

        const unlockedSpecs = clinic.rooms
          .filter((r) => r.unlocked && r.specialty && r.specialty !== 'reception')
          .map((r) => r.specialty as RoomSpecialty);

        prefetchAiCase(unlockedSpecs);

        const aiCase = aiCasePoolRef.current.shift();
        const fallbackCase =
          FALLBACK_CLINICAL_CASES[Math.floor(Math.random() * FALLBACK_CLINICAL_CASES.length)];
        const chosenCase = aiCase || { ...fallbackCase, id: fallbackCase.id + '_' + Date.now() };
        const skin = SUDANESE_SKINS[Math.floor(Math.random() * SUDANESE_SKINS.length)];

        const receptionSpot = getReceptionCheckinSpot(prev);
        const startX = 28;
        const startY = 14;
        const path = findGridPath(
          startX,
          startY,
          receptionSpot.x,
          receptionSpot.y,
          clinic.rooms,
          clinic.placedItems,
          itemFootprints
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
          isAiGenerated: Boolean(aiCase),
        };
        return [...prev, newPatient];
      });
    };

    const bootTimer = setTimeout(spawnCheck, 1100);
    const interval = setInterval(spawnCheck, 12500);
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
    prefetchAiCase,
    getReceptionCheckinSpot,
  ]);

  // 10Hz Character & Staff Simulation Tick (paired with 60fps 3D damping)
  useEffect(() => {
    if (!hydrated || visitingFriend) return;

    const receptionistHired = clinic.staff.some((s) => s.role === 'receptionist' && s.hired);
    let latestPatientsSnapshot: PatientEntity[] = [];

    const tick = setInterval(() => {
      setPatients((prev) => {
        let changed = false;
        const nextList: PatientEntity[] = [];

        for (const p of prev) {
          let updated = { ...p };

          if (updated.path.length > 0) {
            let rem = 0.115;
            while (rem > 0.001 && updated.path.length > 0) {
              const nextNode = updated.path[0];
              const dx = nextNode.x - updated.gridX;
              const dy = nextNode.y - updated.gridY;
              const dist = Math.hypot(dx, dy);
              if (dist <= rem) {
                updated.gridX = nextNode.x;
                updated.gridY = nextNode.y;
                updated.path = updated.path.slice(1);
                rem -= dist;
              } else {
                updated.gridX += (dx / dist) * rem;
                updated.gridY += (dy / dist) * rem;
                rem = 0;
              }
            }
            updated.walkPhase += 0.42;
            changed = true;
          } else {
            // Reached current waypoint
            if (updated.state === 'arriving') {
              // Step 1 complete: Arrived at Reception Desk to check in
              updated.state = 'checkin_at_desk';
              updated.waitTimer = 0;
              changed = true;
            } else if (updated.state === 'checkin_at_desk') {
              updated.waitTimer += 100;
              const checkinMs = receptionistHired ? 900 : 1400;
              if (updated.waitTimer >= checkinMs) {
                // Step 2: Walk to sit on outdoor park bench or indoor waiting chairs
                const seat = pickWaitingSeat(prev, updated.id);
                updated.state = 'walking_to_wait';
                updated.targetX = seat.x;
                updated.targetY = seat.y;
                updated.seatOffsetX = seat.offX;
                updated.seatOffsetZ = seat.offZ;
                updated.seatFacingRad = seat.facingRad;
                updated.waitTimer = 0;
                updated.path = findGridPath(
                  updated.gridX,
                  updated.gridY,
                  seat.x,
                  seat.y,
                  clinic.rooms,
                  clinic.placedItems,
                  itemFootprints
                );
                changed = true;
              }
            } else if (updated.state === 'walking_to_wait') {
              // Step 3: Seated and waiting to be called by the specialist
              updated.state = 'waiting_checkin';
              updated.waitTimer = 0;
              changed = true;
            } else if (updated.state === 'waiting_checkin') {
              updated.waitTimer += 100;
              const autoCallMs = receptionistHired ? 2200 : 4800;
              if (updated.waitTimer >= autoCallMs) {
                const station = findFreeStation(prev);
                if (station) {
                  // Step 4: Called by specialist -> walks through doors to treatment wing
                  updated.assignedStationId = station.instanceId;
                  updated.state = 'walking_to_station';
                  updated.targetX = station.gridX;
                  updated.targetY = station.gridY;
                  updated.seatOffsetX = undefined;
                  updated.seatOffsetZ = undefined;
                  updated.seatFacingRad = undefined;
                  updated.path = findGridPath(
                    updated.gridX,
                    updated.gridY,
                    station.gridX,
                    station.gridY,
                    clinic.rooms,
                    clinic.placedItems,
                    itemFootprints
                  );
                  changed = true;
                }
              }
            } else if (updated.state === 'walking_to_station') {
              updated.state = 'ready_for_exam';
              changed = true;
            } else if (updated.state === 'in_treatment') {
              const nextProg = Math.min(1, (updated.treatmentProgress || 0) + 0.025);
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

        // Actor-to-actor collision avoidance for walking patients
        for (let i = 0; i < nextList.length; i++) {
          const a = nextList[i];
          if (a.path.length === 0) continue;
          for (let j = 0; j < nextList.length; j++) {
            if (i === j) continue;
            const b = nextList[j];
            if (b.state === 'ready_for_exam' || b.state === 'in_treatment') continue;
            const sx = a.gridX - b.gridX;
            const sy = a.gridY - b.gridY;
            const d = Math.hypot(sx, sy);
            if (d > 0.001 && d < 0.62) {
              const push = (0.62 - d) * 0.22;
              const nx = a.gridX + (sx / d) * push;
              const ny = a.gridY + (sy / d) * push;
              if (
                canStepBetween(
                  Math.round(a.gridX),
                  Math.round(a.gridY),
                  Math.round(nx),
                  Math.round(ny),
                  clinic.rooms
                )
              ) {
                a.gridX = nx;
                a.gridY = ny;
                changed = true;
              }
            }
          }
        }

        latestPatientsSnapshot = nextList;
        return changed ? nextList : prev;
      });

      // Therapist AI: attends active station patients, calls waiting patients, or strolls rooms freely
      setClinic((prev) => {
        let staffChanged = false;
        const nextStaff = prev.staff.map((st) => {
          if (!st.hired || st.role !== 'therapist') return st;
          const copy = { ...st };
          if (copy.path.length > 0) {
            let rem = 0.095;
            while (rem > 0.001 && copy.path.length > 0) {
              const nextNode = copy.path[0];
              const dx = nextNode.x - copy.gridX;
              const dy = nextNode.y - copy.gridY;
              const dist = Math.hypot(dx, dy);
              if (dist <= rem) {
                copy.gridX = nextNode.x;
                copy.gridY = nextNode.y;
                copy.path = copy.path.slice(1);
                rem -= dist;
              } else {
                copy.gridX += (dx / dist) * rem;
                copy.gridY += (dy / dist) * rem;
                rem = 0;
              }
            }
            copy.walkPhase += 0.36;
            staffChanged = true;
          } else if (Math.random() < 0.065) {
            const activeTarget =
              latestPatientsSnapshot.find((pt) => pt.state === 'in_treatment') ||
              latestPatientsSnapshot.find((pt) => pt.state === 'ready_for_exam');
            const waitingTarget = latestPatientsSnapshot.find((pt) => pt.state === 'waiting_checkin');

            let tx: number | null = null;
            let ty: number | null = null;

            if (activeTarget) {
              tx = Math.min(20, Math.max(3, Math.round(activeTarget.gridX) + 1));
              ty = Math.min(20, Math.max(3, Math.round(activeTarget.gridY) + 1));
            } else if (waitingTarget) {
              // Step to reception doorway / courtyard entrance to call waiting patient
              tx = waitingTarget.gridX >= 22 ? 20 : 12;
              ty = 14;
            } else if (Math.random() < 0.25) {
              // Occasionally step into the sunlit courtyard garden for fresh air
              tx = 22 + Math.floor(Math.random() * 4);
              ty = 10 + Math.floor(Math.random() * 8);
            } else {
              // Patrol naturally across any point inside unlocked clinic rooms
              const unlocked = prev.rooms.filter((r) => r.unlocked);
              const pickRoom = unlocked[Math.floor(Math.random() * unlocked.length)];
              if (pickRoom) {
                tx = pickRoom.minX + 1 + Math.floor(Math.random() * Math.max(1, pickRoom.maxX - pickRoom.minX - 1));
                ty = pickRoom.minY + 1 + Math.floor(Math.random() * Math.max(1, pickRoom.maxY - pickRoom.minY - 1));
              }
            }

            if (tx !== null && ty !== null && Math.hypot(tx - copy.gridX, ty - copy.gridY) > 0.8) {
              copy.path = findGridPath(
                copy.gridX,
                copy.gridY,
                tx,
                ty,
                prev.rooms,
                prev.placedItems,
                itemFootprints
              );
              staffChanged = true;
            }
          }
          return copy;
        });

        return staffChanged ? { ...prev, staff: nextStaff } : prev;
      });
    }, 100);

    return () => clearInterval(tick);
  }, [
    hydrated,
    visitingFriend,
    clinic.rooms,
    clinic.placedItems,
    clinic.staff,
    catalogById,
    findFreeStation,
    pickWaitingSeat,
    itemFootprints,
  ]);

  // Handle tapping a patient
  const handleTapPatient = (patient: PatientEntity) => {
    if (visitingFriend) return;
    soundFx.tap();

    if (
      patient.state === 'arriving' ||
      patient.state === 'checkin_at_desk' ||
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
                seatOffsetX: undefined,
                seatOffsetZ: undefined,
                seatFacingRad: undefined,
                path: findGridPath(
                  p.gridX,
                  p.gridY,
                  station.gridX,
                  station.gridY,
                  clinic.rooms,
                  clinic.placedItems,
                  itemFootprints
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
                assignedStationId: null,
                treatmentProgress: undefined,
                path: findGridPath(
                  pt.gridX,
                  pt.gridY,
                  28,
                  14,
                  clinic.rooms,
                  clinic.placedItems,
                  itemFootprints
                ),
              }
            : pt
        )
      );
    },
    [addFloatingFeedback, bumpMission, clinic.placedItems, clinic.rooms, itemFootprints]
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

    soundFx.tap();
    addFloatingFeedback(
      p.gridX,
      p.gridY,
      clinic.language === 'ar' ? 'جلسة علاج نشطة ⚡' : 'Therapy Active ⚡',
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
    }, 4100);
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

  const handleConfirmPlacement = (gx: number, gy: number) => {
    if (!placementDraft) return;
    soundFx.placeItem();

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
            ? { ...it, gridX: gx, gridY: gy, rotation: placementDraft.rotation, roomId }
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
        rotation: placementDraft.rotation,
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

  const handleResetClinic = () => {
    const fresh = createInitialSaveState();
    fresh.language = clinic.language;
    setClinic(fresh);
    setPatients([]);
    setFocusedPatientId(null);
    setPlacementDraft(null);
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
    <main className="relative w-screen h-screen overflow-hidden bg-[#5aa332]">
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
        goldenHour={goldenHour}
        onTapPatient={handleTapPatient}
        onTapLockedRoom={(room) => {
          if (!visitingFriend) {
            soundFx.tap();
            setUnlockTargetRoom(room);
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
        onUpdatePlacementHover={(gx, gy) =>
          setPlacementDraft((prev) => (prev ? { ...prev, hoverX: gx, hoverY: gy } : null))
        }
        onConfirmPlacement={handleConfirmPlacement}
        onCancelPlacement={() => {
          soundFx.tap();
          setPlacementDraft(null);
        }}
        onRotatePlacement={() => {
          soundFx.tap();
          setPlacementDraft((prev) =>
            prev ? { ...prev, rotation: ((prev.rotation + 1) % 4) as 0 | 1 | 2 | 3 } : null
          );
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
        onClose={() => setUnlockTargetRoom(null)}
        onConfirmUnlock={handleConfirmUnlockRoom}
      />

      {/* Core Educational Feature: Clinical Reasoning Zoom-In */}
      <ClinicalAssessmentModal
        key={focusedPatient?.id || 'none'}
        patient={focusedPatient}
        language={clinic.language}
        onClose={() => setFocusedPatientId(null)}
        onCompleteCase={handleCompleteCase}
      />

      {/* Daily Missions */}
      <MissionsModal
        open={missionsOpen}
        missions={clinic.missions}
        patientsTreatedTotal={clinic.patientsTreatedTotal}
        redFlagsCaughtTotal={clinic.redFlagsCaughtTotal}
        language={clinic.language}
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
        onClose={() => setFriendsOpen(false)}
        onVisitFriend={handleVisitFriend}
        onSendGift={handleSendFriendGift}
      />

      {/* Settings */}
      <SettingsModal
        open={settingsOpen}
        language={clinic.language}
        soundEnabled={clinic.soundEnabled}
        goldenHour={goldenHour}
        studentId={clinic.studentId}
        lastSyncedAt={clinic.lastSyncedAt}
        onClose={() => setSettingsOpen(false)}
        onToggleLanguage={handleToggleLanguage}
        onToggleSound={handleToggleSound}
        onToggleGoldenHour={() => {
          soundFx.tap();
          setGoldenHour((g) => !g);
        }}
        onManualSync={() => {
          soundFx.tap();
          scheduleSilentCloudSync(clinic, (iso) => {
            setClinic((prev) => ({ ...prev, lastSyncedAt: iso }));
          });
        }}
        onResetClinic={handleResetClinic}
      />

      {/* Bonus PT Flashcard Quiz */}
      <BonusQuizModal
        open={bonusOpen}
        language={clinic.language}
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
