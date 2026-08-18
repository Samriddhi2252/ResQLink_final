import express, { Request, Response } from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:4173'] }));
app.use(express.json({ limit: '32kb' }));

// ── Gemini client ────────────────────────────────────────────────────────────
const API_KEY = process.env.GEMINI_API_KEY;
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
  res.json({ ok: true, gemini: GEMINI_READY });
});

// ── Chat endpoint ─────────────────────────────────────────────────────────────
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
    res.status(400).json({ error: 'Invalid message.' });
    return;
  }

  if (!GEMINI_READY) {
    res.status(503).json({ error: 'Gemini not configured.' });
    return;
  }

  // Build app-data context string
  const shelterLines = (context?.shelters ?? []).map(s => {
    const beds = s.capacity - s.occupied;
    return `  • ${s.name} (${s.address}) — Status: ${s.status}, Beds available: ${beds}/${s.capacity}, Amenities: ${s.amenities.join(', ')}`;
  }).join('\n');

  const resourceLines = (context?.resources ?? []).map(r =>
    `  • [${r.type.toUpperCase()}] ${r.name}, ${r.address} — ${r.status} | ☎ ${r.phone} | Tags: ${r.tags.join(', ')}`
  ).join('\n');

  const requestLines = (context?.activeRequests ?? []).map(r =>
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
    const ai      = new GoogleGenAI({ apiKey: API_KEY });
    const model   = 'gemini-2.0-flash';
    const prompt  = `${appContext}\n\nUser question: ${message}`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { systemInstruction: SYSTEM_INSTRUCTION, maxOutputTokens: 512 },
    });

    const text = response.text ?? '';
    if (!text) {
      res.status(502).json({ error: 'Empty response from Gemini.' });
      return;
    }

    res.json({ reply: text, mode: 'online' });
  } catch (err: unknown) {
    console.error('[Gemini error]', err);
    res.status(502).json({ error: 'Gemini request failed.' });
  }
});

app.listen(PORT, () => {
  console.log(`[ResQLink API] Running on http://localhost:${PORT}`);
  console.log(`[ResQLink API] Gemini configured: ${GEMINI_READY}`);
  if (!GEMINI_READY) console.log('[ResQLink API] Add GEMINI_API_KEY to server/.env to enable AI responses');
});

// ── AI Triage endpoint ────────────────────────────────────────────────────────
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
    message: string;
    region?: string;
    locationLabel?: string;
  };

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: 'Message is required.' });
    return;
  }
  if (message.length > 2000) {
    res.status(400).json({ error: 'Message too long (max 2000 characters).' });
    return;
  }

  if (!GEMINI_READY) {
    res.status(503).json({ error: 'Gemini not configured — use offline fallback.' });
    return;
  }

  const prompt = `Current region context: ${locationLabel || region || 'Unknown'}

Emergency message to analyze:
"${message}"

Respond with ONLY the JSON object as described.`;

  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY! });
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        systemInstruction: TRIAGE_SYSTEM_INSTRUCTION,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
      },
    });

    const raw = response.text ?? '';
    if (!raw) {
      res.status(502).json({ error: 'Empty response from Gemini.' });
      return;
    }

    // Strip markdown fences if model adds them despite instruction
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      res.status(502).json({ error: 'Gemini returned invalid JSON.', raw: cleaned.slice(0, 200) });
      return;
    }

    res.json({ ...parsed, parsedBy: 'gemini' });
  } catch (err: unknown) {
    console.error('[Triage Gemini error]', err);
    res.status(502).json({ error: 'Gemini triage request failed.' });
  }
});

app.listen(PORT, () => {
  console.log(`[ResQLink API] Running on http://localhost:${PORT}`);
  console.log(`[ResQLink API] Gemini configured: ${GEMINI_READY}`);
  if (!GEMINI_READY) console.log('[ResQLink API] Add GEMINI_API_KEY to server/.env to enable AI responses');
});
