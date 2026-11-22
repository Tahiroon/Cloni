import { ClinicSaveState } from '../types/clinic';

const DB_NAME = 'therason_clinic_db';
const DB_VERSION = 1;
const STORE_NAME = 'clinic_state';
const RECORD_KEY = 'active_clinic';
const LS_BACKUP_KEY = 'therason_clinic_backup_v1';

type StoredClinicEnvelope = ClinicSaveState & { _savedAt?: number };

let cachedDbPromise: Promise<IDBDatabase | null> | null = null;
let lastSavedFingerprint = '';

function computeQuickFingerprint(state: ClinicSaveState): string {
  const mSig = state.missions.map((m) => `${m.progress}:${m.claimed ? 1 : 0}`).join(',');
  return [
    state.version,
    state.language,
    state.soundEnabled ? 1 : 0,
    state.lightingMode || 'day',
    state.coins,
    state.stars,
    state.xp || 0,
    state.level || 1,
    state.satisfaction,
    state.patientsTreatedTotal,
    state.redFlagsCaughtTotal,
    state.placedItems.length,
    state.rooms.filter((r) => r.unlocked).length,
    state.staff.filter((s) => s.hired).length,
    (state.removedTreeIds || []).length,
    mSig,
    state.playerProfile?.gender || '',
    state.playerProfile?.outfitId || '',
    state.playerProfile?.hasTarha ? 1 : 0,
    state.placedItems.map((p) => `${p.instanceId}@${p.gridX},${p.gridY},${p.rotation}`).join(';'),
  ].join('|');
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (cachedDbPromise) return cachedDbPromise;
  cachedDbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        cachedDbPromise = null;
        resolve(null);
      };
    } catch {
      cachedDbPromise = null;
      resolve(null);
    }
  });
  return cachedDbPromise;
}

/**
 * Synchronous frame-0 hydration from localStorage mirror so missions, rooms,
 * profile, and language are available immediately before IndexedDB resolves.
 */
export function loadClinicLocalSync(): ClinicSaveState | null {
  try {
    const raw = localStorage.getItem(LS_BACKUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredClinicEnvelope;
    if (parsed && Array.isArray(parsed.rooms) && Array.isArray(parsed.placedItems)) {
      return parsed;
    }
  } catch {
    // Ignore storage read / JSON parse errors
  }
  return null;
}

export async function loadClinicLocal(): Promise<ClinicSaveState | null> {
  const lsState = loadClinicLocalSync() as StoredClinicEnvelope | null;
  let idbState: StoredClinicEnvelope | null = null;

  const db = await openDatabase();
  if (db) {
    try {
      idbState = await new Promise<StoredClinicEnvelope | null>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(RECORD_KEY);
        req.onsuccess = () => resolve((req.result as StoredClinicEnvelope) || null);
        req.onerror = () => resolve(null);
      });
    } catch {
      idbState = null;
    }
  }

  if (idbState && lsState) {
    return (lsState._savedAt || 0) > (idbState._savedAt || 0) ? lsState : idbState;
  }
  return idbState || lsState || null;
}

export async function saveClinicLocal(state: ClinicSaveState, force = false): Promise<void> {
  const fp = computeQuickFingerprint(state);
  if (!force && fp === lastSavedFingerprint) return;
  lastSavedFingerprint = fp;

  const envelope: StoredClinicEnvelope = { ...state, _savedAt: Date.now() };

  // Compact payload for zero-lag mobile storage
  try {
    localStorage.setItem(LS_BACKUP_KEY, JSON.stringify(envelope));
  } catch {
    // Ignore quota errors
  }

  const db = await openDatabase();
  if (!db) return;

  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(envelope, RECORD_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    // Ignore IDB errors
  }
}

/**
 * Lightweight Supabase-compatible JSON payload for background sync.
 * In Next.js + Supabase, point this to `supabase.from('clinic_saves').upsert(payload)`.
 */
function buildLightweightSyncPayload(state: ClinicSaveState) {
  return {
    studentId: state.studentId,
    coins: state.coins,
    stars: state.stars,
    satisfaction: state.satisfaction,
    patientsTreatedTotal: state.patientsTreatedTotal,
    rooms: state.rooms.map((r) => ({
      id: r.id,
      unlocked: r.unlocked,
      specialty: r.specialty,
      floorTheme: r.floorTheme,
    })),
    placedItems: state.placedItems.map((p) => ({
      id: p.instanceId,
      c: p.catalogId,
      x: p.gridX,
      y: p.gridY,
      r: p.rotation,
      rm: p.roomId,
    })),
    hiredStaffIds: state.staff.filter((s) => s.hired).map((s) => s.id),
    playerProfile: state.playerProfile,
    updatedAt: new Date().toISOString(),
  };
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleSilentCloudSync(
  state: ClinicSaveState,
  onSynced?: (isoTimestamp: string) => void
) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    try {
      const payload = buildLightweightSyncPayload(state);
      const res = await fetch('/api/clinic/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (onSynced && data.syncedAt) {
          onSynced(data.syncedAt);
        }
      }
    } catch {
      // Silent offline-first behavior: local IndexedDB remains authoritative
    }
  }, 1800);
}
