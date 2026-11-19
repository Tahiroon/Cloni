import { ClinicSaveState } from '../types/clinic';

const DB_NAME = 'therason_clinic_db';
const DB_VERSION = 1;
const STORE_NAME = 'clinic_state';
const RECORD_KEY = 'active_clinic';
const LS_BACKUP_KEY = 'therason_clinic_backup_v1';

function openDatabase(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
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
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function loadClinicLocal(): Promise<ClinicSaveState | null> {
  const db = await openDatabase();
  if (db) {
    try {
      const result = await new Promise<ClinicSaveState | null>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(RECORD_KEY);
        req.onsuccess = () => resolve((req.result as ClinicSaveState) || null);
        req.onerror = () => resolve(null);
      });
      if (result) return result;
    } catch {
      // Fallback to localStorage
    }
  }

  try {
    const raw = localStorage.getItem(LS_BACKUP_KEY);
    return raw ? (JSON.parse(raw) as ClinicSaveState) : null;
  } catch {
    return null;
  }
}

export async function saveClinicLocal(state: ClinicSaveState): Promise<void> {
  // Compact payload for zero-lag mobile storage
  try {
    localStorage.setItem(LS_BACKUP_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota errors
  }

  const db = await openDatabase();
  if (!db) return;

  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(state, RECORD_KEY);
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
export function buildLightweightSyncPayload(state: ClinicSaveState) {
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
