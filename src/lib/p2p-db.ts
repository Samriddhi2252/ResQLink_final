/**
 * p2p-db.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * IndexedDB wrapper for the ResQLinkk offline P2P record store.
 *
 * Responsibilities:
 *   • Persist P2P-received emergency records across page reloads / app restarts
 *   • Enforce deduplication: keep the record with the highest version/updatedAt
 *   • Track per-record TTL — mark stale records "expired" (never hard-delete
 *     critical records automatically)
 *   • Maintain sync statistics (sent / received counters)
 *   • Provide typed read/write helpers used by use-p2p-network.ts
 *
 * Database name : resqlink-p2p
 * Object stores :
 *   records   – the actual P2P emergency records
 *   meta      – key-value metadata (stats, last-sync timestamps)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export type P2PRecordType =
  | 'MEDICAL'
  | 'FOOD'
  | 'WATER'
  | 'SHELTER'
  | 'RESCUE'
  | 'VOLUNTEER'
  | 'RESOURCE'
  | 'STATUS_UPDATE';

export type P2PRecordStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'EXPIRED';

/** The canonical shape of a P2P-synchronised emergency record. */
export interface P2PRecord {
  /** Globally unique ID — format: REQ-<uuid-fragment> */
  id: string;
  type: P2PRecordType;
  /** Monotonically increasing integer; higher = newer */
  version: number;
  createdAt: number;   // ms epoch
  updatedAt: number;   // ms epoch
  /** Absolute ms epoch after which the record is considered stale */
  expiresAt: number;
  status: P2PRecordStatus;
  /** Ephemeral ID of the device that originally created this record */
  sourceDeviceId: string;
  /** Hop count — incremented each time the record is relayed */
  hopCount: number;
  /** The actual emergency payload — mirrors the AidRequest shape */
  payload: Record<string, unknown>;
  /** True if this record arrived via P2P relay (not created locally) */
  receivedViaP2P: boolean;
  /** deviceId of the peer who gave us this record */
  relayedBy?: string;
}

export interface P2PStats {
  totalReceived:  number;
  totalSent:      number;
  totalRelayed:   number;
  lastSyncAt:     number | null;   // ms epoch
  lastSyncPeer:   string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DB_NAME    = 'resqlink-p2p';
const DB_VERSION = 1;

const STORE_RECORDS = 'records';
const STORE_META    = 'meta';

/** Default TTL for non-critical records: 72 hours */
export const DEFAULT_TTL_MS = 72 * 60 * 60 * 1000;
/** TTL for critical (MEDICAL / RESCUE) records: 7 days */
export const CRITICAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const CRITICAL_TYPES: P2PRecordType[] = ['MEDICAL', 'RESCUE'];

// ─────────────────────────────────────────────────────────────────────────────
// DB open / upgrade
// ─────────────────────────────────────────────────────────────────────────────

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (ev) => {
      const db = (ev.target as IDBOpenDBRequest).result;

      // Records store — keyed by id, indexed by type and status
      if (!db.objectStoreNames.contains(STORE_RECORDS)) {
        const store = db.createObjectStore(STORE_RECORDS, { keyPath: 'id' });
        store.createIndex('by_type',      'type',      { unique: false });
        store.createIndex('by_status',    'status',    { unique: false });
        store.createIndex('by_createdAt', 'createdAt', { unique: false });
        store.createIndex('by_expiresAt', 'expiresAt', { unique: false });
      }

      // Meta store — generic key-value
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };

    req.onsuccess = (ev) => {
      _db = (ev.target as IDBOpenDBRequest).result;
      resolve(_db);
    };

    req.onerror = (ev) => {
      reject((ev.target as IDBOpenDBRequest).error);
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic IDB helpers
// ─────────────────────────────────────────────────────────────────────────────

function tx(
  db: IDBDatabase,
  stores: string | string[],
  mode: IDBTransactionMode,
): IDBTransaction {
  return db.transaction(stores, mode);
}

function put<T>(store: IDBObjectStore, value: T): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = store.put(value);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

function getByKey<T>(store: IDBObjectStore, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror   = () => reject(req.error);
  });
}

function getAllFromStore<T>(store: IDBObjectStore): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror   = () => reject(req.error);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TTL helper
// ─────────────────────────────────────────────────────────────────────────────

export function computeExpiresAt(type: P2PRecordType, createdAt: number): number {
  const ttl = CRITICAL_TYPES.includes(type) ? CRITICAL_TTL_MS : DEFAULT_TTL_MS;
  return createdAt + ttl;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upsert a record with deduplication logic:
 *   – If no existing record: insert.
 *   – If existing record has lower version: overwrite.
 *   – If same version: keep the one with the higher updatedAt.
 *   – If existing record has higher version: ignore incoming.
 *
 * Returns true if the record was actually written (new or updated).
 */
export async function upsertRecord(incoming: P2PRecord): Promise<boolean> {
  const db    = await openDB();
  const t     = tx(db, STORE_RECORDS, 'readwrite');
  const store = t.objectStore(STORE_RECORDS);

  const existing = await getByKey<P2PRecord>(store, incoming.id);

  let shouldWrite = false;

  if (!existing) {
    shouldWrite = true;
  } else if (incoming.version > existing.version) {
    shouldWrite = true;
  } else if (incoming.version === existing.version && incoming.updatedAt > existing.updatedAt) {
    shouldWrite = true;
  }

  if (shouldWrite) {
    // Mark expired if TTL already passed
    const record: P2PRecord = {
      ...incoming,
      status: Date.now() > incoming.expiresAt && incoming.status === 'OPEN'
        ? 'EXPIRED'
        : incoming.status,
    };
    await put(store, record);
  }

  return shouldWrite;
}

/**
 * Get a single record by ID.
 */
export async function getRecord(id: string): Promise<P2PRecord | undefined> {
  const db    = await openDB();
  const t     = tx(db, STORE_RECORDS, 'readonly');
  const store = t.objectStore(STORE_RECORDS);
  return getByKey<P2PRecord>(store, id);
}

/**
 * Get all non-expired records, optionally filtered by type.
 */
export async function getActiveRecords(type?: P2PRecordType): Promise<P2PRecord[]> {
  const db    = await openDB();
  const t     = tx(db, STORE_RECORDS, 'readonly');
  const store = t.objectStore(STORE_RECORDS);
  const all   = await getAllFromStore<P2PRecord>(store);
  const now   = Date.now();

  return all.filter((r) => {
    if (r.status === 'RESOLVED') return false;
    if (now > r.expiresAt)       return false;
    if (type && r.type !== type) return false;
    return true;
  });
}

/**
 * Get ALL records (including expired/resolved) — used for store-and-forward.
 * We forward even resolved records so that resolution propagates across the mesh.
 */
export async function getAllRecords(): Promise<P2PRecord[]> {
  const db    = await openDB();
  const t     = tx(db, STORE_RECORDS, 'readonly');
  const store = t.objectStore(STORE_RECORDS);
  return getAllFromStore<P2PRecord>(store);
}

/**
 * Mark stale records as EXPIRED (non-destructive).
 * Returns the count of records that were updated.
 */
export async function sweepExpiredRecords(): Promise<number> {
  const db    = await openDB();
  const t     = tx(db, STORE_RECORDS, 'readwrite');
  const store = t.objectStore(STORE_RECORDS);
  const all   = await getAllFromStore<P2PRecord>(store);
  const now   = Date.now();
  let count   = 0;

  for (const r of all) {
    if (r.status === 'OPEN' && now > r.expiresAt) {
      await put(store, { ...r, status: 'EXPIRED' as P2PRecordStatus });
      count++;
    }
  }

  return count;
}

/**
 * Resolve a record (marks it RESOLVED so it stops being surfaced as active).
 */
export async function resolveRecord(id: string): Promise<void> {
  const db    = await openDB();
  const t     = tx(db, STORE_RECORDS, 'readwrite');
  const store = t.objectStore(STORE_RECORDS);
  const rec   = await getByKey<P2PRecord>(store, id);
  if (rec) {
    await put(store, {
      ...rec,
      status:    'RESOLVED' as P2PRecordStatus,
      updatedAt: Date.now(),
      version:   rec.version + 1,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_STATS: P2PStats = {
  totalReceived: 0,
  totalSent:     0,
  totalRelayed:  0,
  lastSyncAt:    null,
  lastSyncPeer:  null,
};

export async function getStats(): Promise<P2PStats> {
  try {
    const db    = await openDB();
    const t     = tx(db, STORE_META, 'readonly');
    const store = t.objectStore(STORE_META);
    const row   = await getByKey<{ key: string; value: P2PStats }>(store, 'stats');
    return row?.value ?? { ...DEFAULT_STATS };
  } catch {
    return { ...DEFAULT_STATS };
  }
}

export async function updateStats(patch: Partial<P2PStats>): Promise<void> {
  try {
    const db      = await openDB();
    const current = await getStats();
    const next: P2PStats = {
      totalReceived: current.totalReceived + (patch.totalReceived ?? 0),
      totalSent:     current.totalSent     + (patch.totalSent     ?? 0),
      totalRelayed:  current.totalRelayed  + (patch.totalRelayed  ?? 0),
      lastSyncAt:    patch.lastSyncAt  ?? current.lastSyncAt,
      lastSyncPeer:  patch.lastSyncPeer ?? current.lastSyncPeer,
    };
    const t     = tx(db, STORE_META, 'readwrite');
    const store = t.objectStore(STORE_META);
    await put(store, { key: 'stats', value: next });
  } catch {
    // Non-fatal — stats are cosmetic
  }
}

/**
 * Count of all records (active + expired) — used for the peer registry heartbeat.
 */
export async function getRecordCount(): Promise<number> {
  try {
    const db    = await openDB();
    const t     = tx(db, STORE_RECORDS, 'readonly');
    const store = t.objectStore(STORE_RECORDS);
    return new Promise((resolve, reject) => {
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  } catch {
    return 0;
  }
}

/**
 * Delete records that are both RESOLVED and older than cutoffMs.
 * Hard-deletes only resolved records to reclaim space — never deletes OPEN/CRITICAL.
 */
export async function pruneOldResolvedRecords(cutoffMs = 7 * 24 * 60 * 60 * 1000): Promise<void> {
  try {
    const db    = await openDB();
    const t     = tx(db, STORE_RECORDS, 'readwrite');
    const store = t.objectStore(STORE_RECORDS);
    const all   = await getAllFromStore<P2PRecord>(store);
    const cutoff = Date.now() - cutoffMs;

    for (const r of all) {
      if (r.status === 'RESOLVED' && r.updatedAt < cutoff) {
        await new Promise<void>((resolve, reject) => {
          const req = store.delete(r.id);
          req.onsuccess = () => resolve();
          req.onerror   = () => reject(req.error);
        });
      }
    }
  } catch {
    // Non-fatal
  }
}

/**
 * Check whether IndexedDB is available in this environment.
 */
export function isP2PDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}
