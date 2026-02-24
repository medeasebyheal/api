/**
 * Intelligent MCQ parsing using Google Gemini API, with fallback to rule-based parser.
 * Supports multiple API keys (GEMINI_API_KEY, GEMINI_API_KEY_2, GEMINI_API_KEY_3): uses round-robin
 * to distribute load and retries with the next key on failure so no single key gets exhausted.
 */

import { GoogleGenAI } from '@google/genai';
import { parseBulkMcqs } from './mcqBulkParser.js';

const GEMINI_MODEL = 'gemini-2.0-flash';

const KEY_ENV_NAMES = ['GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3'];

/** Get all configured Gemini API keys (non-empty). */
function getGeminiApiKeys() {
  const keys = KEY_ENV_NAMES.map((name) => process.env[name]?.trim()).filter(Boolean);
  return [...new Set(keys)];
}

let keyRoundRobinIndex = 0;

/** Get next API key in round-robin order. */
function getNextApiKey() {
  const keys = getGeminiApiKeys();
  if (keys.length === 0) return null;
  const key = keys[keyRoundRobinIndex % keys.length];
  keyRoundRobinIndex += 1;
  return key;
}

const PARSE_PROMPT = `You are a parser for multiple-choice questions (MCQs). Given raw text that may contain one or more MCQs in any format (numbered, with A/B/C/D options, checkmarks, explanations, etc.), output a single JSON array of objects. No other text—only the JSON array.

Each object must have:
- "question": string (the question text only)
- "options": array of 4 strings (option texts; if fewer are present, use empty strings for missing)
- "correctIndex": number 0-3 (index of the correct option)
- "explanation": string (optional; explanation text if present, else "")

Rules:
- Detect the correct answer from markers like (correct), (c), ✓, ✔, ✅, or similar.
- Strip any question prefix like "1.", "Q1.", "Q." from the question text.
- Options should be plain text only (no "A." or "B)" prefix in the text).
- If the input has no valid MCQs, return [].

Output only the JSON array, no markdown code fences.`;

/**
 * Call Gemini with one API key. Returns parsed result or throws on failure.
 */
async function parseWithKey(apiKey, text) {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: `${PARSE_PROMPT}\n\n---\n\nInput:\n${text.trim().slice(0, 100000)}`,
    config: {
      maxOutputTokens: 8192,
      temperature: 0.1,
    },
  });

  const raw = response?.text;
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('Empty response');

  let jsonStr = raw.trim();
  const codeBlock = /^```(?:json)?\s*([\s\S]*?)```$/;
  const m = jsonStr.match(codeBlock);
  if (m) jsonStr = m[1].trim();

  const arr = JSON.parse(jsonStr);
  if (!Array.isArray(arr) || arr.length === 0) {
    return { mcqs: [], errors: [], partialBlockIndices: [] };
  }

  const errors = [];
  const partialBlockIndices = [];
  const mcqs = [];

  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    const question = typeof item.question === 'string' ? item.question.trim() : '';
    let options = Array.isArray(item.options) ? item.options.map((o) => String(o ?? '').trim()) : [];
    let correctIndex = typeof item.correctIndex === 'number' ? Math.max(0, Math.min(3, Math.floor(item.correctIndex))) : 0;
    const explanation = typeof item.explanation === 'string' ? item.explanation.trim() : '';

    if (!question) {
      errors.push({ blockIndex: i + 1, message: 'Missing question' });
      continue;
    }
    if (options.length < 2) {
      options = options.length ? [options[0], '(Add options in edit)'] : ['(No options parsed)', '(Add options in edit)'];
      partialBlockIndices.push(i + 1);
    }
    if (options.length < 4) {
      while (options.length < 4) options.push('');
    }
    if (correctIndex >= options.length) correctIndex = 0;

    mcqs.push({
      question,
      options: options.slice(0, 6),
      correctIndex,
      explanation: explanation || '',
    });
  }

  return { mcqs, errors, partialBlockIndices };
}

/**
 * Call Gemini to parse raw text into MCQs. Uses round-robin across multiple API keys and retries
 * with the next key on failure. Returns null if no keys configured or all keys fail.
 */
export async function parseBulkMcqsWithGemini(text) {
  const keys = getGeminiApiKeys();
  if (keys.length === 0 || !text?.trim()) return null;

  const firstKey = getNextApiKey();
  try {
    return await parseWithKey(firstKey, text);
  } catch (_) {
    for (const k of keys) {
      if (k === firstKey) continue;
      try {
        return await parseWithKey(k, text);
      } catch (_) {}
    }
    return null;
  }
}

/**
 * Parse bulk MCQ text: try Gemini first; if unavailable or failed, use rule-based parser.
 * @param {string} text - Raw paste of MCQs
 * @returns {Promise<{ mcqs, errors, partialBlockIndices, source: 'gemini' | 'manual' }>}
 */
export async function parseBulkMcqsWithFallback(text) {
  const geminiResult = await parseBulkMcqsWithGemini(text);
  if (geminiResult) {
    return { ...geminiResult, source: 'gemini' };
  }
  const manual = parseBulkMcqs(text || '');
  return { ...manual, source: 'manual' };
}
