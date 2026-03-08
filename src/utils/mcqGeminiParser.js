import { GoogleGenAI } from '@google/genai';
import { recordGeminiUsage, getGeminiUsage } from './geminiUsageStore.js';
import { callOpenAIRaw, extractOpenAIText } from './openaiHelper.js';
import { recordOpenAIUsage } from './openaiUsageStore.js';

const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const KEY_ENV_NAMES = ['GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3'];
let keyRoundRobinIndex = 0;

// Max characters per chunk to avoid model truncation
const MAX_CHARS_PER_REQUEST = 20000;

function getGeminiApiKeys() {
  const keys = [...new Set(KEY_ENV_NAMES.map(name => process.env[name]?.trim()).filter(Boolean))];
  console.log('[getGeminiApiKeys] Found keys:', keys.length);
  return keys;
}

function getNextApiKey() {
  const keys = getGeminiApiKeys();
  if (!keys.length) return null;
  const key = keys[keyRoundRobinIndex % keys.length];
  keyRoundRobinIndex += 1;
  console.log('[getNextApiKey] Using key index', keyRoundRobinIndex - 1);
  return key;
}

function refineText(text) {
  if (!text?.trim()) return '';
  let s = text.trim()
    .replace(/\t/g, ' ')
    .replace(/\s*[\u2E3A\u2E3B\u2014\u2015\u2500]\s*/g, '\n\n---\n\n')
    .split('\n').map(l => l.trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n');
  console.log('[refineText] Refined input length:', s.length);
  return s.trim();
}

const PARSE_PROMPT = `
You are an expert MCQ parser. From raw text containing multiple MCQs, return ONLY a valid JSON array. 
Each MCQ object must follow this schema:
{
  "question": "string",
  "options": ["string","string","string","string"],
  "correctIndex": 0|1|2|3,
  "explanation": "string"
}
Return only JSON array.
`;

function sanitizeOption(s) {
  if (typeof s !== 'string') return '';
  return s.trim().replace(/\s*(✓|✔|✅)?\s*wrong\s+answer\s*$/gi, '')
    .replace(/\s*[✓✔✅]\s*$/g, '').trim() || s.trim();
}

function parseJSONSafely(raw) {
  console.log('[parseJSONSafely] Raw response length:', raw?.length || 0);
  raw = raw.trim().replace(/^```(?:json)?\s*\n?/i, '').replace(/```$/, '').trim();
  try {
    const parsed = JSON.parse(raw);
    console.log('[parseJSONSafely] Successfully parsed JSON with', parsed.length, 'items');
    return parsed;
  } catch (err) {
    console.warn('[parseJSONSafely] JSON parse failed, attempting repair:', err.message);
    const pos = Number((err.message.match(/position\s+(\d+)/i) || [])[1] || raw.length);
    let slice = raw.slice(0, pos).trim().replace(/,\s*$/, '');
    const openBraces = (slice.match(/\{/g) || []).length - (slice.match(/\}/g) || []).length;
    const openBrackets = (slice.match(/\[/g) || []).length - (slice.match(/\]/g) || []).length;
    const repaired = slice + '}'.repeat(Math.max(0, openBraces)) + ']'.repeat(Math.max(0, openBrackets));
    const parsed = JSON.parse(repaired);
    console.log('[parseJSONSafely] Repaired JSON length:', parsed.length);
    return parsed;
  }
}

async function parseWithGeminiKey(apiKey, text, keyIndex = 0) {
  console.log('[parseWithGeminiKey] Parsing with key index', keyIndex);
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: `${PARSE_PROMPT}\n\n---\n\nInput:\n${text}`,
    config: { maxOutputTokens: 8192, temperature: 0.1 }
  });

  const raw = response?.text;
  console.log('[parseWithGeminiKey] Raw Gemini response length:', raw?.length || 0);
  const usage = response?.usageMetadata || null;
  if (typeof keyIndex === 'number') recordGeminiUsage(keyIndex, usage || { totalTokenCount: 0 }, { source: 'mcq-parser' });
  if (!raw?.trim()) throw new Error('Empty Gemini response');
  return parseJSONSafely(raw);
}

async function parseWithOpenAI(text) {
  console.log('[parseWithOpenAI] Parsing with OpenAI');
  const { status, body } = await callOpenAIRaw(`${PARSE_PROMPT}\n\n---\n\nInput:\n${text}`, { timeoutMs: 60000, temperature: 0.1, maxOutputTokens: 8192 });
  console.log('[parseWithOpenAI] OpenAI status:', status);
  if (![200].includes(status)) throw new Error(`OpenAI parse failed with status ${status}`);
  const raw = extractOpenAIText(body);
  console.log('[parseWithOpenAI] Raw OpenAI response length:', raw?.length || 0);
  if (!raw?.trim()) throw new Error('Empty OpenAI response');
  recordOpenAIUsage({ total_tokens: body?.usage?.total_tokens ?? 0 });
  return parseJSONSafely(raw);
}

export async function parseBulkMcqs(text) {
  const refined = refineText(text);
  if (!refined) return { mcqs: [], errors: [], partialBlockIndices: [], source: 'manual' };

  // Split input into manageable chunks
  const chunks = [];
  if (refined.length > MAX_CHARS_PER_REQUEST) {
    for (let i = 0; i < refined.length; i += MAX_CHARS_PER_REQUEST) {
      chunks.push(refined.slice(i, i + MAX_CHARS_PER_REQUEST));
    }
  } else {
    chunks.push(refined);
  }

  const results = [];
  const errors = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    // Try OpenAI first
    if (process.env.OPENAI_API_KEY) {
      try {
        const arr = await parseWithOpenAI(chunk);
        console.log(`[parseBulkMcqs] Chunk ${i + 1}/${chunks.length} parsed with OpenAI, items:`, arr.length);
        results.push(...arr);
        continue;
      } catch (err) {
        console.warn(`[parseBulkMcqs] OpenAI chunk ${i + 1} failed:`, err.message);
      }
    }

    // Gemini fallback
    const keys = getGeminiApiKeys();
    if (!keys.length) throw new Error('No Gemini API keys configured');

    let lastError = null;
    for (let k = 0; k < keys.length; k++) {
      try {
        const arr = await parseWithGeminiKey(keys[k], chunk, k);
        console.log(`[parseBulkMcqs] Chunk ${i + 1} parsed with Gemini, items:`, arr.length);
        results.push(...arr);
        break; // chunk parsed successfully
      } catch (err) {
        lastError = err;
        console.warn(`[parseBulkMcqs] Gemini attempt ${k + 1} chunk ${i + 1} failed:`, err.message);
      }
    }
    if (lastError) errors.push(lastError.message);
  }

  return { mcqs: results, errors, partialBlockIndices: [], source: 'mixed' };
}