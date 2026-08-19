/**
 * use-p2p-network.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * React hook that implements the complete offline LAN peer-to-peer
 * communication layer for ResQLinkk using WebRTC DataChannels.
 *
 * ARCHITECTURE OVERVIEW
 * ─────────────────────
 * Transport     : WebRTC DataChannel (browser-native, no native code required)
 * Discovery     : HTTP polling against the existing Express signalling server
 *                 (LAN-reachable at the same IP phones use to open the app)
 * Signalling    : SDP offer/answer + ICE candidates exchanged via Express
 *                 /api/p2p/signal  (store-and-poll, not WebSocket)
 * Data flow     : Once the DataChannel is OPEN, all emergency data travels
 *                 directly phone↔phone — the signalling server is no longer
 *                 in the data path.
 * Persistence   : IndexedDB via p2p-db.ts
 * Identity      : Random ephemeral deviceId (no PII ever transmitted)
 *
 * STORE-AND-FORWARD
 * ─────────────────
 * When a peer connects we immediately send ALL records we hold (not just
 * locally-created ones). This lets records hop:  A→B, then B→C, then C→D.
 * Each hop increments hopCount. We deduplicate via upsertRecord() in p2p-db.
 *
 * WHAT HAPPENS WITHOUT INTERNET
 * ──────────────────────────────
 * Both discovery polling and WebRTC DataChannels work on a local network
 * with no internet at all.  The hook degrades gracefully if the signalling
 * server is unreachable — it retries on a back-off schedule and surfaces
 * a "searching" state to the UI without throwing.
 *
 * WHEN INTERNET RETURNS
 * ──────────────────────
 * The hook fires onSyncToBackend() with every locally-held P2P record.
 * App.tsx calls addCustomRequest() for each record, which already handles
 * the /api/sync/request → Supabase pipeline.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  upsertRecord,
  getAllRecords,
  getActiveRecords,
  getRecordCount,
  getStats,
  updateStats,
  sweepExpiredRecords,
  pruneOldResolvedRecords,
  computeExpiresAt,
  isP2PDbAvailable,
  type P2PRecord,
  type P2PRecordType,
  type P2PStats,
} from '@/lib/p2p-db';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SIGNAL_BASE     = '/api/p2p';
const POLL_INTERVAL   = 3_000;   // ms between signal polls
const DISCOVER_INTERVAL = 8_000; // ms between peer-list refreshes
const HEARTBEAT_INTERVAL = 10_000; // ms between register heartbeats
const MAX_PEERS       = 8;        // max simultaneous WebRTC connections
const DC_LABEL        = 'resqlink-p2p-v1';
const MSG_MAX_BYTES   = 200_000;  // ~200 KB per DataChannel message

/** ICE servers — all STUN, no TURN needed for pure LAN use */
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Public types exposed to the UI
// ─────────────────────────────────────────────────────────────────────────────

export type P2PPhase =
  | 'unavailable'   // WebRTC / IDB not supported in this browser
  | 'searching'     // looking for peers, no connections yet
  | 'connecting'    // WebRTC handshake in progress
  | 'syncing'       // DataChannel open, sending/receiving records
  | 'connected'     // at least one DataChannel open, idle
  | 'error';        // unrecoverable error (shown to user)

export interface P2PPeerInfo {
  deviceId:    string;
  alias:       string;
  recordCount: number;
  /** Whether we currently have an open DataChannel with this peer */
  connected:   boolean;
}

export interface UseP2PNetworkResult {
  phase:          P2PPhase;
  peers:          P2PPeerInfo[];
  connectedCount: number;
  stats:          P2PStats;
  recordCount:    number;
  errorMessage:   string | null;
  deviceId:       string;
  deviceAlias:    string;
  /** Manually trigger a full sync with all connected peers */
  syncNow:        () => void;
  /** Create a new P2P record from an existing AidRequest (called by App.tsx) */
  publishRecord:  (record: Omit<P2PRecord, 'hopCount' | 'receivedViaP2P' | 'relayedBy'>) => Promise<void>;
  /** Get all active P2P records (for map / feed integration) */
  getActiveP2PRecords: (type?: P2PRecordType) => Promise<P2PRecord[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal types
// ─────────────────────────────────────────────────────────────────────────────

interface PeerConn {
  pc:         RTCPeerConnection;
  dc:         RTCDataChannel | null;
  deviceId:   string;
  alias:      string;
  state:      'connecting' | 'open' | 'closed';
  recordCount: number;
}

// Wire message types sent over the DataChannel
type DCMessage =
  | { kind: 'HELLO';   deviceId: string; alias: string; recordCount: number }
  | { kind: 'RECORDS'; records: P2PRecord[] }
  | { kind: 'ACK';     count: number }
  | { kind: 'PING' }
  | { kind: 'PONG' };

// ─────────────────────────────────────────────────────────────────────────────
// Ephemeral device identity (persisted in localStorage, no PII)
// ─────────────────────────────────────────────────────────────────────────────

function getOrCreateDeviceId(): string {
  const KEY = 'resqlink-p2p-device-id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    // Random 8-char hex suffix — anonymous, ephemeral
    id = 'dev-' + Array.from(crypto.getRandomValues(new Uint8Array(4)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    localStorage.setItem(KEY, id);
  }
  return id;
}

function getOrCreateAlias(): string {
  const KEY = 'resqlink-p2p-alias';
  let alias = localStorage.getItem(KEY);
  if (!alias) {
    // Human-readable random suffix — no location, no name, no PII
    const hex = Array.from(crypto.getRandomValues(new Uint8Array(2)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
    alias = `ResQLinkk Device #${hex}`;
    localStorage.setItem(KEY, alias);
  }
  return alias;
}

// ─────────────────────────────────────────────────────────────────────────────
// Signalling helpers — thin wrappers around the Express signalling API
// ─────────────────────────────────────────────────────────────────────────────

async function sigRegister(deviceId: string, alias: string, recordCount: number): Promise<void> {
  await fetch(`${SIGNAL_BASE}/register`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ deviceId, alias, recordCount }),
  });
}

async function sigPeers(deviceId: string): Promise<P2PPeerInfo[]> {
  const res = await fetch(`${SIGNAL_BASE}/peers?deviceId=${encodeURIComponent(deviceId)}`);
  const j   = await res.json() as { peers: Array<{ deviceId: string; alias: string; recordCount: number }> };
  return (j.peers ?? []).map(p => ({ ...p, connected: false }));
}

async function sigSend(from: string, to: string, type: string, payload: unknown): Promise<void> {
  await fetch(`${SIGNAL_BASE}/signal`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ from, to, type, payload }),
  });
}

async function sigPoll(deviceId: string): Promise<Array<{ from: string; type: string; payload: unknown }>> {
  const res = await fetch(`${SIGNAL_BASE}/signal/poll?deviceId=${encodeURIComponent(deviceId)}`);
  const j   = await res.json() as { messages: Array<{ from: string; type: string; payload: unknown }> };
  return j.messages ?? [];
}

async function sigUnregister(deviceId: string): Promise<void> {
  await fetch(`${SIGNAL_BASE}/unregister`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ deviceId }),
  }).catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────────────
// The hook
// ─────────────────────────────────────────────────────────────────────────────

export function useP2PNetwork(opts: {
  /** Called whenever P2P records arrive so App.tsx can feed them into the main pipeline */
  onRecordsReceived?: (records: P2PRecord[]) => void;
  /** Called when internet is back and we should push P2P records to the backend */
  onSyncToBackend?:  (records: P2PRecord[]) => void;
  /** Whether the app currently considers itself online (from useNetwork) */
  isOnline?: boolean;
} = {}): UseP2PNetworkResult {

  const { onRecordsReceived, onSyncToBackend, isOnline = true } = opts;

  // ── State ──────────────────────────────────────────────────────────────────
  const [phase,        setPhase]        = useState<P2PPhase>('searching');
  const [peers,        setPeers]        = useState<P2PPeerInfo[]>([]);
  const [stats,        setStats]        = useState<P2PStats>({
    totalReceived: 0, totalSent: 0, totalRelayed: 0, lastSyncAt: null, lastSyncPeer: null,
  });
  const [recordCount,  setRecordCount]  = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── Stable refs ────────────────────────────────────────────────────────────
  const deviceId    = useRef(getOrCreateDeviceId());
  const deviceAlias = useRef(getOrCreateAlias());
  const conns       = useRef<Map<string, PeerConn>>(new Map());
  const destroyed   = useRef(false);

  const onRecordsRef  = useRef(onRecordsReceived);
  const onBackendRef  = useRef(onSyncToBackend);
  const isOnlineRef   = useRef(isOnline);
  useEffect(() => { onRecordsRef.current  = onRecordsReceived; }, [onRecordsReceived]);
  useEffect(() => { onBackendRef.current  = onSyncToBackend;   }, [onSyncToBackend]);
  useEffect(() => { isOnlineRef.current   = isOnline;           }, [isOnline]);

  // ── Check environment ──────────────────────────────────────────────────────
  const supported = typeof RTCPeerConnection !== 'undefined' && isP2PDbAvailable();

  // ── Helpers ────────────────────────────────────────────────────────────────

  const refreshStats = useCallback(async () => {
    const [s, c] = await Promise.all([getStats(), getRecordCount()]);
    setStats(s);
    setRecordCount(c);
  }, []);

  const recomputePhase = useCallback(() => {
    const open = [...conns.current.values()].filter(c => c.state === 'open');
    const connecting = [...conns.current.values()].filter(c => c.state === 'connecting');
    if (open.length > 0)         setPhase('connected');
    else if (connecting.length > 0) setPhase('connecting');
    else                          setPhase('searching');
  }, []);

  const refreshPeerList = useCallback(() => {
    const connMap = conns.current;
    setPeers(prev => prev.map(p => ({
      ...p,
      connected: connMap.get(p.deviceId)?.state === 'open',
    })));
  }, []);

  // ── DataChannel message handler ────────────────────────────────────────────

  const handleDCMessage = useCallback(async (conn: PeerConn, raw: string) => {
    let msg: DCMessage;
    try { msg = JSON.parse(raw); }
    catch { return; }

    if (msg.kind === 'PING') {
      conn.dc?.send(JSON.stringify({ kind: 'PONG' }));
      return;
    }

    if (msg.kind === 'PONG') return;

    if (msg.kind === 'HELLO') {
      conn.alias       = msg.alias;
      conn.recordCount = msg.recordCount;
      setPeers(prev => prev.map(p =>
        p.deviceId === conn.deviceId ? { ...p, alias: msg.alias, recordCount: msg.recordCount, connected: true } : p
      ));
      return;
    }

    if (msg.kind === 'RECORDS') {
      const incoming = msg.records;
      if (!Array.isArray(incoming) || incoming.length === 0) return;

      setPhase('syncing');

      let newCount = 0;
      const newRecords: P2PRecord[] = [];

      for (const rec of incoming) {
        // Basic schema validation — never trust incoming data blindly
        if (!rec.id || !rec.type || typeof rec.version !== 'number') continue;

        // Sanitise: strip any field that could contain auth tokens / API keys
        const safe: P2PRecord = {
          id:             String(rec.id).slice(0, 64),
          type:           rec.type,
          version:        rec.version,
          createdAt:      rec.createdAt ?? Date.now(),
          updatedAt:      rec.updatedAt ?? Date.now(),
          expiresAt:      rec.expiresAt ?? computeExpiresAt(rec.type, rec.createdAt ?? Date.now()),
          status:         rec.status    ?? 'OPEN',
          sourceDeviceId: String(rec.sourceDeviceId ?? 'unknown').slice(0, 64),
          hopCount:       Math.min((rec.hopCount ?? 0) + 1, 99),
          payload:        sanitisePayload(rec.payload ?? {}),
          receivedViaP2P: true,
          relayedBy:      conn.deviceId,
        };

        const written = await upsertRecord(safe);
        if (written) {
          newCount++;
          newRecords.push(safe);
        }
      }

      if (newCount > 0) {
        await updateStats({ totalReceived: newCount, lastSyncAt: Date.now(), lastSyncPeer: conn.deviceId });
        await refreshStats();
        onRecordsRef.current?.(newRecords);
      }

      // ACK
      conn.dc?.send(JSON.stringify({ kind: 'ACK', count: newCount }));

      // When internet is available, push newly arrived records to the backend
      if (isOnlineRef.current && newRecords.length > 0) {
        onBackendRef.current?.(newRecords);
      }

      recomputePhase();
      return;
    }

    if (msg.kind === 'ACK') {
      await updateStats({ totalSent: msg.count, lastSyncAt: Date.now(), lastSyncPeer: conn.deviceId });
      await refreshStats();
      recomputePhase();
    }
  }, [refreshStats, recomputePhase]);

  // ── Send all local records to a peer ───────────────────────────────────────

  const sendAllRecordsToPeer = useCallback(async (conn: PeerConn) => {
    if (conn.state !== 'open' || !conn.dc) return;
    const records = await getAllRecords();
    if (records.length === 0) return;

    setPhase('syncing');

    // Chunk large payloads to stay under MSG_MAX_BYTES
    const CHUNK = 50;
    for (let i = 0; i < records.length; i += CHUNK) {
      const slice = records.slice(i, i + CHUNK);
      const msg   = JSON.stringify({ kind: 'RECORDS', records: slice });
      if (msg.length > MSG_MAX_BYTES) {
        // Send one-by-one if a single chunk is too big
        for (const r of slice) {
          const single = JSON.stringify({ kind: 'RECORDS', records: [r] });
          try { conn.dc.send(single); } catch { break; }
        }
      } else {
        try { conn.dc.send(msg); } catch { break; }
      }
    }

    await updateStats({ totalSent: records.length });
    await refreshStats();
  }, [refreshStats]);

  // ── Set up a DataChannel (either we created it or we received it) ──────────

  const wireDataChannel = useCallback((conn: PeerConn, dc: RTCDataChannel) => {
    conn.dc = dc;

    dc.onopen = async () => {
      conn.state = 'open';
      recomputePhase();
      refreshPeerList();

      // Announce ourselves
      dc.send(JSON.stringify({
        kind:        'HELLO',
        deviceId:    deviceId.current,
        alias:       deviceAlias.current,
        recordCount: await getRecordCount(),
      }));

      // Immediately exchange all records (store-and-forward)
      await sendAllRecordsToPeer(conn);
    };

    dc.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        handleDCMessage(conn, ev.data);
      }
    };

    dc.onclose = () => {
      conn.state = 'closed';
      recomputePhase();
      refreshPeerList();
    };

    dc.onerror = () => {
      conn.state = 'closed';
      recomputePhase();
    };
  }, [handleDCMessage, refreshPeerList, recomputePhase, sendAllRecordsToPeer]);

  // ── Create a new outbound PeerConnection (we are the offerer) ─────────────

  const createOffer = useCallback(async (remotePeerId: string, remoteAlias: string, remoteRecordCount: number) => {
    if (conns.current.has(remotePeerId)) return;  // already connecting/connected
    if (conns.current.size >= MAX_PEERS)  return;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const dc = pc.createDataChannel(DC_LABEL, { ordered: true });

    const conn: PeerConn = {
      pc, dc: null, deviceId: remotePeerId, alias: remoteAlias,
      state: 'connecting', recordCount: remoteRecordCount,
    };
    conns.current.set(remotePeerId, conn);
    wireDataChannel(conn, dc);
    recomputePhase();

    pc.onicecandidate = async (ev) => {
      if (ev.candidate) {
        await sigSend(deviceId.current, remotePeerId, 'ice-candidate', ev.candidate.toJSON()).catch(() => {});
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        conn.state = 'closed';
        conns.current.delete(remotePeerId);
        recomputePhase();
        refreshPeerList();
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sigSend(deviceId.current, remotePeerId, 'offer', pc.localDescription?.toJSON());
    } catch (err) {
      console.warn('[P2P] createOffer failed:', err);
      conn.state = 'closed';
      conns.current.delete(remotePeerId);
      recomputePhase();
    }
  }, [wireDataChannel, recomputePhase, refreshPeerList]);

  // ── Handle incoming signalling messages ───────────────────────────────────

  const handleSignal = useCallback(async (from: string, type: string, payload: unknown) => {
    if (type === 'offer') {
      // We are the answerer
      if (conns.current.has(from)) return;
      if (conns.current.size >= MAX_PEERS) return;

      const pc   = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const conn: PeerConn = {
        pc, dc: null, deviceId: from, alias: `ResQLinkk Device`,
        state: 'connecting', recordCount: 0,
      };
      conns.current.set(from, conn);
      recomputePhase();

      pc.ondatachannel = (ev) => {
        wireDataChannel(conn, ev.channel);
      };

      pc.onicecandidate = async (ev) => {
        if (ev.candidate) {
          await sigSend(deviceId.current, from, 'ice-candidate', ev.candidate.toJSON()).catch(() => {});
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          conn.state = 'closed';
          conns.current.delete(from);
          recomputePhase();
          refreshPeerList();
        }
      };

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sigSend(deviceId.current, from, 'answer', pc.localDescription?.toJSON());
      } catch (err) {
        console.warn('[P2P] handleOffer failed:', err);
        conn.state = 'closed';
        conns.current.delete(from);
        recomputePhase();
      }
      return;
    }

    if (type === 'answer') {
      const conn = conns.current.get(from);
      if (!conn) return;
      try {
        await conn.pc.setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit));
      } catch (err) {
        console.warn('[P2P] setRemoteDescription(answer) failed:', err);
      }
      return;
    }

    if (type === 'ice-candidate') {
      const conn = conns.current.get(from);
      if (!conn) return;
      try {
        await conn.pc.addIceCandidate(new RTCIceCandidate(payload as RTCIceCandidateInit));
      } catch {
        // ICE candidates can legitimately fail if connection is already established
      }
    }
  }, [wireDataChannel, recomputePhase, refreshPeerList]);

  // ── Public: publish a record locally + forward to connected peers ──────────

  const publishRecord = useCallback(async (
    record: Omit<P2PRecord, 'hopCount' | 'receivedViaP2P' | 'relayedBy'>
  ) => {
    const full: P2PRecord = { ...record, hopCount: 0, receivedViaP2P: false };
    await upsertRecord(full);
    await refreshStats();

    // Forward to all open peers immediately
    for (const conn of conns.current.values()) {
      if (conn.state === 'open' && conn.dc) {
        try {
          conn.dc.send(JSON.stringify({ kind: 'RECORDS', records: [full] }));
        } catch { /* peer may have just disconnected */ }
      }
    }
  }, [refreshStats]);

  // ── Public: manual full sync ───────────────────────────────────────────────

  const syncNow = useCallback(() => {
    for (const conn of conns.current.values()) {
      if (conn.state === 'open') {
        sendAllRecordsToPeer(conn);
      }
    }
  }, [sendAllRecordsToPeer]);

  // ── Public: get active records ────────────────────────────────────────────

  const getActiveP2PRecords = useCallback(async (type?: P2PRecordType) => {
    return getActiveRecords(type);
  }, []);

  // ── Main lifecycle ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!supported) {
      setPhase('unavailable');
      return;
    }

    destroyed.current = false;

    // ── 1. Register heartbeat ─────────────────────────────────────────────
    let heartbeatTimer: ReturnType<typeof setInterval>;

    const doHeartbeat = async () => {
      if (destroyed.current) return;
      try {
        const count = await getRecordCount();
        await sigRegister(deviceId.current, deviceAlias.current, count);
      } catch { /* server unreachable — fine, we retry */ }
    };

    doHeartbeat();
    heartbeatTimer = setInterval(doHeartbeat, HEARTBEAT_INTERVAL);

    // ── 2. Peer discovery ─────────────────────────────────────────────────
    let discoverTimer: ReturnType<typeof setInterval>;

    const discoverPeers = async () => {
      if (destroyed.current) return;
      try {
        const discovered = await sigPeers(deviceId.current);
        // Annotate with current connection state
        const annotated = discovered.map(p => ({
          ...p,
          connected: conns.current.get(p.deviceId)?.state === 'open',
        }));
        setPeers(annotated);

        // Initiate connections to new peers (offerer = device with lexicographically smaller ID)
        for (const peer of discovered) {
          if (
            !conns.current.has(peer.deviceId) &&
            deviceId.current < peer.deviceId        // deterministic offerer selection
          ) {
            createOffer(peer.deviceId, peer.alias, peer.recordCount);
          }
        }
      } catch { /* server unreachable */ }
    };

    discoverPeers();
    discoverTimer = setInterval(discoverPeers, DISCOVER_INTERVAL);

    // ── 3. Signal polling ─────────────────────────────────────────────────
    let pollTimer: ReturnType<typeof setInterval>;

    const pollSignals = async () => {
      if (destroyed.current) return;
      try {
        const messages = await sigPoll(deviceId.current);
        for (const msg of messages) {
          await handleSignal(msg.from, msg.type, msg.payload);
        }
      } catch { /* server unreachable */ }
    };

    pollTimer = setInterval(pollSignals, POLL_INTERVAL);

    // ── 4. Periodic maintenance ───────────────────────────────────────────
    let maintTimer: ReturnType<typeof setInterval>;

    const runMaintenance = async () => {
      if (destroyed.current) return;
      await sweepExpiredRecords();
      await pruneOldResolvedRecords();
      await refreshStats();

      // If we're online, push all P2P records to the backend
      if (isOnlineRef.current) {
        const active = await getActiveRecords();
        if (active.length > 0) {
          onBackendRef.current?.(active);
        }
      }
    };

    runMaintenance();
    maintTimer = setInterval(runMaintenance, 60_000); // every minute

    // ── 5. Initial stats load ──────────────────────────────────────────────
    refreshStats();

    // ── 6. Cleanup ────────────────────────────────────────────────────────
    return () => {
      destroyed.current = true;
      clearInterval(heartbeatTimer);
      clearInterval(discoverTimer);
      clearInterval(pollTimer);
      clearInterval(maintTimer);

      // Close all peer connections
      for (const conn of conns.current.values()) {
        try { conn.dc?.close(); } catch { /* ignore */ }
        try { conn.pc.close();  } catch { /* ignore */ }
      }
      conns.current.clear();

      // Unregister from signalling server (best-effort)
      sigUnregister(deviceId.current);
    };
  }, [supported, createOffer, handleSignal, refreshStats]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync to backend when internet returns ─────────────────────────────────
  useEffect(() => {
    if (!isOnline || !supported) return;
    (async () => {
      const active = await getActiveRecords();
      if (active.length > 0) {
        onBackendRef.current?.(active);
      }
    })();
  }, [isOnline, supported]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived state ─────────────────────────────────────────────────────────
  const connectedCount = peers.filter(p => p.connected).length;

  return {
    phase:          supported ? phase : 'unavailable',
    peers,
    connectedCount,
    stats,
    recordCount,
    errorMessage,
    deviceId:       deviceId.current,
    deviceAlias:    deviceAlias.current,
    syncNow,
    publishRecord,
    getActiveP2PRecords,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Security: strip sensitive fields from incoming record payloads
// We only allow a known set of emergency-data keys — nothing auth-related.
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_PAYLOAD_KEYS = new Set([
  'title', 'details', 'category', 'priority', 'status',
  'contactName', 'contactPhone', 'distanceMiles', 'coords',
  'peopleCount', 'items', 'region', 'locationLabel',
  'triage', 'isUserCreated', 'createdAt', 'id',
]);

function sanitisePayload(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) {
    if (ALLOWED_PAYLOAD_KEYS.has(key)) {
      out[key] = raw[key];
    }
  }
  return out;
}
