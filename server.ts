import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

dotenv.config();

const PORT = 3000;
const app = express();
app.use(express.json({ limit: '1mb' }));

// Initialize Gemini SDK server-side only
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// Lightweight local persistence mimicking Supabase clinic_saves table
const SAVE_DIR = path.resolve(process.cwd(), '.therason_cache');
const SAVE_FILE = path.join(SAVE_DIR, 'clinic_saves.json');

function readSaves(): Record<string, unknown> {
  try {
    if (!fs.existsSync(SAVE_FILE)) return {};
    return JSON.parse(fs.readFileSync(SAVE_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function writeSaves(data: Record<string, unknown>) {
  try {
    if (!fs.existsSync(SAVE_DIR)) {
      fs.mkdirSync(SAVE_DIR, { recursive: true });
    }
    fs.writeFileSync(SAVE_FILE, JSON.stringify(data, null, 2));
  } catch {
    // Ignore filesystem errors in read-only sandboxes
  }
}

// 1. Background Sync Endpoint (Lightweight JSON of grid coordinates & item IDs)
app.post('/api/clinic/sync', (req, res) => {
  const payload = req.body;
  if (!payload || !payload.studentId) {
    res.status(400).json({ error: 'Missing studentId' });
    return;
  }
  const saves = readSaves();
  const syncedAt = new Date().toISOString();
  saves[payload.studentId] = { ...payload, syncedAt };
  writeSaves(saves);
  res.json({ ok: true, syncedAt });
});

app.get('/api/clinic/load/:studentId', (req, res) => {
  const saves = readSaves();
  const record = saves[req.params.studentId];
  if (!record) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(record);
});

// 2. Gemini AI: Generate Dynamic Physiotherapy Case
app.post('/api/clinical/generate-case', async (req, res) => {
  if (!ai) {
    res.status(503).json({ error: 'AI unavailable' });
    return;
  }

  const { specialty = 'orthopedics' } = req.body || {};

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Generate 1 realistic undergraduate physiotherapy clinical reasoning patient case for specialty "${specialty}".
Include both Arabic (natural clinical Arabic) and English fields, realistic VAS pain 2-9, 2-3 objective clinical tests (ROM/MMT/Special Test), 3 diagnosis options (exactly 1 isCorrect: true), and 3 treatment plan options (exactly 1 isRecommended: true).
Roughly 25% of cases should contain an authentic physiotherapy Red Flag (e.g., Cauda Equina, DVT, Fracture, Cervical Myelopathy) requiring urgent medical referral.`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            patientNameAr: { type: Type.STRING },
            patientNameEn: { type: Type.STRING },
            age: { type: Type.INTEGER },
            gender: { type: Type.STRING },
            occupationAr: { type: Type.STRING },
            occupationEn: { type: Type.STRING },
            chiefComplaintAr: { type: Type.STRING },
            chiefComplaintEn: { type: Type.STRING },
            vasPain: { type: Type.INTEGER },
            onsetAr: { type: Type.STRING },
            onsetEn: { type: Type.STRING },
            aggravatingAr: { type: Type.STRING },
            aggravatingEn: { type: Type.STRING },
            easingAr: { type: Type.STRING },
            easingEn: { type: Type.STRING },
            redFlagsPresent: { type: Type.BOOLEAN },
            redFlagClueAr: { type: Type.STRING },
            redFlagClueEn: { type: Type.STRING },
            objectiveTests: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  nameAr: { type: Type.STRING },
                  nameEn: { type: Type.STRING },
                  category: { type: Type.STRING },
                  findingAr: { type: Type.STRING },
                  findingEn: { type: Type.STRING },
                  isPositive: { type: Type.BOOLEAN },
                },
              },
            },
            diagnosisOptions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  labelAr: { type: Type.STRING },
                  labelEn: { type: Type.STRING },
                  isCorrect: { type: Type.BOOLEAN },
                },
              },
            },
            treatmentOptions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  labelAr: { type: Type.STRING },
                  labelEn: { type: Type.STRING },
                  isRecommended: { type: Type.BOOLEAN },
                },
              },
            },
            clinicalPearlAr: { type: Type.STRING },
            clinicalPearlEn: { type: Type.STRING },
          },
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json({
      id: 'ai_case_' + Date.now(),
      specialty,
      ...parsed,
    });
  } catch (err) {
    console.error('Gemini case generation failed:', err);
    res.status(500).json({ error: 'Case generation failed' });
  }
});

// 3. Gemini AI: Interactive Patient Subjective History Dialogue
app.post('/api/clinical/ask-patient', async (req, res) => {
  if (!ai) {
    res.status(503).json({ error: 'AI unavailable' });
    return;
  }

  const { clinicalCase, question, language = 'ar' } = req.body || {};
  if (!clinicalCase || !question) {
    res.status(400).json({ error: 'Missing clinicalCase or question' });
    return;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `You are roleplaying as a physiotherapy patient in a clinic assessment.
Patient profile: ${clinicalCase.patientNameEn}, age ${clinicalCase.age}, complaint: ${clinicalCase.chiefComplaintEn}.
Onset: ${clinicalCase.onsetEn}. Aggravating: ${clinicalCase.aggravatingEn}. Easing: ${clinicalCase.easingEn}.
Red flags present: ${clinicalCase.redFlagsPresent} (${clinicalCase.redFlagClueEn}).
Student question: "${question}"
Reply concisely in 1-2 natural sentences in ${language === 'ar' ? 'Arabic' : 'English'} from the patient's first-person perspective without revealing the medical diagnosis name.`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    res.json({ answer: (response.text ?? '').trim() });
  } catch (err) {
    console.error('Gemini ask-patient failed:', err);
    res.status(500).json({ error: 'Patient dialogue failed' });
  }
});

// 4. Gemini AI: Senior PT Clinical Mentor Evaluation
app.post('/api/clinical/evaluate-plan', async (req, res) => {
  if (!ai) {
    res.status(503).json({ error: 'AI unavailable' });
    return;
  }

  const {
    clinicalCase,
    redFlagCorrect,
    selectedDiagnosis,
    diagnosisCorrect,
    selectedTreatment,
    treatmentCorrect,
    studentNote,
    language = 'ar',
  } = req.body || {};

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `You are a senior physiotherapy clinical instructor evaluating a PT student.
Case: ${clinicalCase.chiefComplaintEn}. Clinical Pearl: ${clinicalCase.clinicalPearlEn}.
Student results: Red Flag Screening Correct=${redFlagCorrect}, Diagnosis Chosen="${selectedDiagnosis}" (Correct=${diagnosisCorrect}), Treatment Chosen="${selectedTreatment}" (Correct=${treatmentCorrect}).
Student rationale note: "${studentNote || 'None provided'}".
Write concise, encouraging, high-yield clinical mentor feedback in 2-3 sentences in ${language === 'ar' ? 'Arabic' : 'English'}.`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    res.json({ feedback: (response.text ?? '').trim() });
  } catch (err) {
    console.error('Gemini evaluation failed:', err);
    res.status(500).json({ error: 'Evaluation failed' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`THERASON CLINIC server running on http://localhost:${PORT}`);
  });
}

startServer();
