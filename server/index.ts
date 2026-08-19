import express, { Request, Response } from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 3001;

// Allow requests from all origins (localhost, Wi-Fi LAN IP, mobile devices)
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '256kb' }));

// ── Shared Cross-Device Sync Store ───────────────────────────────────────────
const DATA_DIR  = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'sync-store.json');

if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); }
  catch (e) { console.error('[SyncStore] mkdir error:', e); }
}

interface SyncStore {
  requests:    any[];
  resolvedIds: string[];
  helpingIds:  string[];
  version:     number;
}

function readStore(): SyncStore {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) { console.error('[SyncStore] Read error:', e); }
  return { requests: [], resolvedIds: [], helpingIds: [], version: 1 };
}

function writeStore(data: SyncStore) {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8'); }
  catch (e) { console.error('[SyncStore] Write error:', e); }
}

let syncStore = readStore();

// ── Gemini client ────────────────────────────────────────────────────────────
const API_KEY     = process.env.GEMINI_API_KEY;
const GEMINI_READY = !!(API_KEY && API_KEY.trim() && !API_KEY.startsWith('your_'));

const SYSTEM_INSTRUCTION = `You are the Disaster Assistant for a disaster-management application called ResQLink.

Your responsibilities are:
1. Explain how the application works.
2. Provide simple, basic, safety-focused disaster guidance.
3. Help users find resources using ONLY the application data provided to you in the context.
4. Adapt your responses to the currently selected region.
5. NEVER invent locations, shelter names, shelter capacity, available beds, hospitals, food points, water points, rescue locations, distances, or any other resource details.
6. Keep answers short, clear, and practical — maximum 4-5 sentences or 5 bullet points.
7. Use numbered steps or bullet points for emergency guidance.
8. Use simple language suitable for someone under stress.
9. If the user appears to be facing immediate danger, first say: call emergency services immediately, then move to the nearest safe location.
10. Do not provide dangerous, experimental, or risky instructions.
11. Do not pretend to be a doctor, firefighter, rescue worker, or emergency responder.
12. If you do not know something, say so clearly instead of guessing.
13. Reply in English when asked in English; reply in Hindi/Hinglish when asked in Hindi/Hinglish.
14. For resources (shelters, hospitals, food, water, rescue), only reference what appears in the structured app data given to you.
15. If the requested information is not in the app data, say: "I don't currently have that information in the app."`;

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    gemini: GEMINI_READY,
    syncRequestsCount: syncStore.requests.length,
    p2pPeers: Object.keys(p2pRegistry).length,
  });
});

// ── Real-Time Cross-Device Sync Endpoints ────────────────────────────────────
app.get('/api/sync', (_req: Request, res: Response) => {
  res.json(syncStore);
});

app.post('/api/sync/request', (req: Request, res: Response) => {
  const newReq = req.body;
  if (!newReq || !newReq.id) { res.status(400).json({ error: 'Invalid request payload.' }); return; }
  const idx = syncStore.requests.findIndex((r) => r.id === newReq.id);
  if (idx >= 0) { syncStore.requests[idx] = newReq; }
  else          { syncStore.requests.unshift(newReq); }
  syncStore.resolvedIds = syncStore.resolvedIds.filter((id) => id !== newReq.id);
  syncStore.version += 1;
  writeStore(syncStore);
  res.json({ ok: true, store: syncStore });
});

app.post('/api/sync/resolve', (req: Request, res: Response) => {
  const { id } = req.body as { id: string };
  if (!id) { res.status(400).json({ error: 'Missing request id.' }); return; }
  if (!syncStore.resolvedIds.includes(id)) syncStore.resolvedIds.push(id);
  syncStore.requests = syncStore.requests.filter((r) => r.id !== id);
  syncStore.version += 1;
  writeStore(syncStore);
  res.json({ ok: true, store: syncStore });
});

app.post('/api/sync/help', (req: Request, res: Response) => {
  const { id } = req.body as { id: string };
  if (!id) { res.status(400).json({ error: 'Missing request id.' }); return; }
  if (!syncStore.helpingIds.includes(id)) syncStore.helpingIds.push(id);
  syncStore.version += 1;
  writeStore(syncStore);
  res.json({ ok: true, store: syncStore });
});

app.post('/api/sync/cancel-help', (req: Request, res: Response) => {
  const { id } = req.body as { id: string };
  if (!id) { res.status(400).json({ error: 'Missing request id.' }); return; }
  syncStore.helpingIds = syncStore.helpingIds.filter((item) => item !== id);
  syncStore.version += 1;
  writeStore(syncStore);
  res.json({ ok: true, store: syncStore });
});

app.post('/api/sync/restore', (_req: Request, res: Response) => {
  syncStore.resolvedIds = [];
  syncStore.version += 1;
  writeStore(syncStore);
  res.json({ ok: true, store: syncStore });
});

// ════════════════════════════════════════════════════════════════════════════
// ── P2P SIGNALLING LAYER ─────────────────────────────────────────────────────
// Enables WebRTC peer discovery and SDP/ICE exchange between LAN devices.
// The server only brokers the initial handshake; data flows peer-to-peer after.
// ════════════════════════════════════════════════════════════════════════════

interface P2PPeer {
  deviceId:   string;   // random ephemeral ID, no PII
  alias:      string;   // display name e.g. "ResQLinkk Device #4A2"
  lastSeen:   number;   // ms timestamp
  recordCount: number;  // how many P2P records this device holds
}

// In-memory registry — intentionally ephemeral, resets on server restart
const p2pRegistry: Record<string, P2PPeer> = {};

// Pending signalling messages keyed by recipientDeviceId
// Each value is a queue of messages waiting to be collected
const p2pSignalQueue: Record<string, any[]> = {};

// Stale peer timeout — 30 s
const PEER_STALE_MS = 30_000;

function cleanStalePeers() {
  const now = Date.now();
  for (const id of Object.keys(p2pRegistry)) {
    if (now - p2pRegistry[id].lastSeen > PEER_STALE_MS) {
      delete p2pRegistry[id];
      delete p2pSignalQueue[id];
    }
  }
}

// Clean stale peers every 15 s
setInterval(cleanStalePeers, 15_000);

// ── Register / heartbeat ──────────────────────────────────────────────────────
// POST /api/p2p/register
// Body: { deviceId, alias, recordCount }
app.post('/api/p2p/register', (req: Request, res: Response) => {
  const { deviceId, alias, recordCount } = req.body as {
    deviceId: string; alias: string; recordCount: number;
  };
  if (!deviceId || typeof deviceId !== 'string' || deviceId.length > 64) {
    res.status(400).json({ error: 'Invalid deviceId.' }); return;
  }
  p2pRegistry[deviceId] = {
    deviceId,
    alias:       (typeof alias === 'string' ? alias : 'ResQLinkk Device').slice(0, 32),
    lastSeen:    Date.now(),
    recordCount: typeof recordCount === 'number' ? recordCount : 0,
  };
  if (!p2pSignalQueue[deviceId]) p2pSignalQueue[deviceId] = [];
  res.json({ ok: true });
});

// ── Discover peers ────────────────────────────────────────────────────────────
// GET /api/p2p/peers?deviceId=xxx
app.get('/api/p2p/peers', (req: Request, res: Response) => {
  cleanStalePeers();
  const self = req.query.deviceId as string;
  const peers = Object.values(p2pRegistry).filter((p) => p.deviceId !== self);
  res.json({ peers });
});

// ── Send a signalling message to a specific peer ──────────────────────────────
// POST /api/p2p/signal
// Body: { from, to, type, payload }
// type: 'offer' | 'answer' | 'ice-candidate'
app.post('/api/p2p/signal', (req: Request, res: Response) => {
  const { from, to, type, payload } = req.body as {
    from: string; to: string; type: string; payload: unknown;
  };
  if (!from || !to || !type) {
    res.status(400).json({ error: 'from, to, and type are required.' }); return;
  }
  // Validate type
  const ALLOWED = ['offer', 'answer', 'ice-candidate'];
  if (!ALLOWED.includes(type)) {
    res.status(400).json({ error: 'Invalid signal type.' }); return;
  }
  if (!p2pSignalQueue[to]) p2pSignalQueue[to] = [];
  // Max 32 queued messages per peer to prevent memory abuse
  if (p2pSignalQueue[to].length < 32) {
    p2pSignalQueue[to].push({ from, type, payload, ts: Date.now() });
  }
  res.json({ ok: true });
});

// ── Poll for pending signalling messages ──────────────────────────────────────
// GET /api/p2p/signal/poll?deviceId=xxx
app.get('/api/p2p/signal/poll', (req: Request, res: Response) => {
  const deviceId = req.query.deviceId as string;
  if (!deviceId) { res.status(400).json({ error: 'deviceId required.' }); return; }
  // Update last-seen
  if (p2pRegistry[deviceId]) p2pRegistry[deviceId].lastSeen = Date.now();
  const messages = p2pSignalQueue[deviceId] ?? [];
  p2pSignalQueue[deviceId] = []; // drain queue
  res.json({ messages });
});

// ── Unregister ────────────────────────────────────────────────────────────────
// POST /api/p2p/unregister
app.post('/api/p2p/unregister', (req: Request, res: Response) => {
  const { deviceId } = req.body as { deviceId: string };
  if (deviceId) {
    delete p2pRegistry[deviceId];
    delete p2pSignalQueue[deviceId];
  }
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════════════════
// ── CHAT ENDPOINT ────────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
app.post('/api/chat', async (req: Request, res: Response) => {
  const { message, context } = req.body as {
    message: string;
    context: {
      region: string;
      locationLabel: string;
      shelters: { name: string; address: string; capacity: number; occupied: number; status: string; amenities: string[] }[];
      resources: { type: string; name: string; address: string; status: string; phone: string; tags: string[] }[];
      activeRequests: { category: string; priority: string; title: string; peopleCount: number }[];
      gps?: string;
    };
  };

  if (!message || typeof message !== 'string' || message.length > 2000) {
    res.status(400).json({ error: 'Invalid message.' }); return;
  }
  if (!GEMINI_READY) { res.status(503).json({ error: 'Gemini not configured.' }); return; }

  const shelterLines  = (context?.shelters ?? []).map(s =>
    `  • ${s.name} (${s.address}) — Status: ${s.status}, Beds available: ${s.capacity - s.occupied}/${s.capacity}, Amenities: ${s.amenities.join(', ')}`
  ).join('\n');
  const resourceLines = (context?.resources ?? []).map(r =>
    `  • [${r.type.toUpperCase()}] ${r.name}, ${r.address} — ${r.status} | ☎ ${r.phone} | Tags: ${r.tags.join(', ')}`
  ).join('\n');
  const requestLines  = (context?.activeRequests ?? []).map(r =>
    `  • [${r.priority.toUpperCase()}] ${r.category}: ${r.title}${r.peopleCount > 0 ? ` (${r.peopleCount} people)` : ''}`
  ).join('\n');

  const appContext = `
=== CURRENT APP CONTEXT ===
Region: ${context?.locationLabel ?? 'Unknown'}
${context?.gps ? `User GPS: ${context.gps}` : 'GPS: not available'}

SHELTERS (${(context?.shelters ?? []).length}):
${shelterLines || '  (none)'}

RESOURCES / HELP POINTS (${(context?.resources ?? []).length}):
${resourceLines || '  (none)'}

ACTIVE AID REQUESTS (${(context?.activeRequests ?? []).length}):
${requestLines || '  (none)'}
===========================`;

  try {
    const ai       = new GoogleGenAI({ apiKey: API_KEY });
    const response = await ai.models.generateContent({
      model:    'gemini-2.0-flash',
      contents: `${appContext}\n\nUser question: ${message}`,
      config:   { systemInstruction: SYSTEM_INSTRUCTION, maxOutputTokens: 512 },
    });
    const text = response.text ?? '';
    if (!text) { res.status(502).json({ error: 'Empty response from Gemini.' }); return; }
    res.json({ reply: text, mode: 'online' });
  } catch (err) {
    console.error('[Gemini error]', err);
    res.status(502).json({ error: 'Gemini request failed.' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// ── AI TRIAGE ENDPOINT ───────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
const TRIAGE_SYSTEM_INSTRUCTION = `You are an emergency triage AI for a disaster-management system called ResQLink.

Your job is to analyze an emergency message — which may be in English, Hindi, or Hinglish — and extract structured information.

You MUST respond with ONLY a valid JSON object. No markdown, no code fences, no explanation — just the raw JSON.

The JSON must follow this exact schema:
{
  "incidentType": one of ["Flood","Fire","Earthquake","Landslide","Medical Emergency","Trapped","Building Collapse","Unknown"],
  "location": string or null (the location mentioned, or null if unclear),
  "locationConfidence": one of ["high","medium","low"],
  "people": number or null (total people affected, null if not mentioned),
  "vulnerable": {
    "elderly": number (0 if not mentioned),
    "children": number (0 if not mentioned),
    "pregnant": number (0 if not mentioned),
    "disabled": number (0 if not mentioned),
    "injured": number (0 if not mentioned)
  },
  "dangerIndicators": array of strings (e.g. ["Water level: first floor", "No boat access", "Rising rapidly"]),
  "medicalEmergency": boolean,
  "requiredResources": array of strings (e.g. ["Evacuation","Rescue Boat","Medical Assistance","Food","Water"]),
  "priority": one of ["CRITICAL","HIGH","MEDIUM","LOW"],
  "priorityReasons": array of strings (each reason on why this priority was assigned)
}

Priority rules:
- CRITICAL: trapped person, elderly/child/pregnant/disabled in immediate danger, serious injury, rapidly rising water, fire/collapse, immediate evacuation required
- HIGH: dangerous conditions, multiple people affected, limited time
- MEDIUM: assistance needed but relatively safe for now
- LOW: information request, non-urgent

Translate Hindi/Hinglish terms:
- "phas gaye" = trapped
- "bujurg/elderly" = elderly person
- "pani/paani" = water
- "aag" = fire
- "bhukamp" = earthquake
- "pahad/landslide" = landslide
- "bachcha/bacche" = children
- "garbhwati" = pregnant

If a field cannot be determined, use null for strings/numbers, false for booleans, and empty arrays for arrays.
Do NOT invent location names. If the location is ambiguous, set locationConfidence to "low".`;

app.post('/api/triage', async (req: Request, res: Response) => {
  const { message, region, locationLabel } = req.body as {
    message: string; region?: string; locationLabel?: string;
  };
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: 'Message is required.' }); return;
  }
  if (message.length > 2000) { res.status(400).json({ error: 'Message too long (max 2000 characters).' }); return; }
  if (!GEMINI_READY) { res.status(503).json({ error: 'Gemini not configured — use offline fallback.' }); return; }

  const prompt = `Current region context: ${locationLabel || region || 'Unknown'}\n\nEmergency message to analyze:\n"${message}"\n\nRespond with ONLY the JSON object as described.`;

  try {
    const ai       = new GoogleGenAI({ apiKey: API_KEY! });
    const response = await ai.models.generateContent({
      model:    'gemini-2.0-flash',
      contents: prompt,
      config:   { systemInstruction: TRIAGE_SYSTEM_INSTRUCTION, maxOutputTokens: 1024, responseMimeType: 'application/json' },
    });
    const raw     = response.text ?? '';
    if (!raw) { res.status(502).json({ error: 'Empty response from Gemini.' }); return; }
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(cleaned); }
    catch { res.status(502).json({ error: 'Gemini returned invalid JSON.', raw: cleaned.slice(0, 200) }); return; }
    res.json({ ...parsed, parsedBy: 'gemini' });
  } catch (err) {
    console.error('[Triage Gemini error]', err);
    res.status(502).json({ error: 'Gemini triage request failed.' });
  }
});

// ── Single app.listen() — fixes pre-existing duplicate listener bug ───────────
app.listen(PORT, () => {
  console.log(`[ResQLink API] Running on http://localhost:${PORT}`);
  console.log(`[ResQLink API] Gemini configured: ${GEMINI_READY}`);
  console.log(`[ResQLink API] P2P signalling layer ready`);
  if (!GEMINI_READY) console.log('[ResQLink API] Add GEMINI_API_KEY to server/.env to enable AI responses');
});
