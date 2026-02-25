/**
 * Intelligent MCQ parsing using Google Gemini API, with fallback to rule-based parser.
 * Supports multiple API keys (GEMINI_API_KEY, GEMINI_API_KEY_2, GEMINI_API_KEY_3): uses round-robin
 * to distribute load and retries with the next key on failure so no single key gets exhausted.
 */

import { GoogleGenAI } from '@google/genai';
import { parseBulkMcqs } from './mcqBulkParser.js';
import { recordGeminiUsage } from './geminiUsageStore.js';

const GEMINI_MODEL = 'gemini-2.5-flash-lite';

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

const PARSE_PROMPT = `
You are an expert MCQ parser. From raw pasted text containing one or more MCQs, return ONLY a valid JSON array. No extra text, no markdown.

Each MCQ object must follow this schema:
{
  "question": "string",
  "options": ["string","string","string","string"],
  "correctIndex": 0|1|2|3,
  "explanation": "string"
}

Parsing Rules:

1. Question
- Starts with a number prefix like "8.", "Q1.", etc.
- Remove the prefix.
- Include only the question text.
- Do NOT include options or explanation in this field.

2. Options
- Exactly 4 options (A/B/C/D or variations like A), a., etc.).
- Strip option labels (A., A), etc.).
- Remove correct markers (✅, ✓, ✔, (correct), (c)).
- Do NOT truncate option text.
- Do NOT include explanation or “Correct Answer” lines as options.
- If fewer than 4 options are found, pad with empty strings.

3. Correct Answer
- If an option has a correct marker, use it.
- If a line like "Correct Answer: C" exists, map A=0, B=1, C=2, D=3.
- If both exist, prefer the marker on the option.

4. Explanation
- Text after "Explanation:" (or standalone "Explanation") until the next numbered question or end of input.
- Assign it only to the current MCQ.
- Never mix explanations between questions.
- If missing, use "".

5. Boundaries
- A new line starting with a number + period starts a new MCQ.
- Keep explanations strictly attached to the preceding question.

6. If no valid MCQs are found, return [].

Return only the JSON array.
`;

/**
 * Refine raw pasted text so Gemini can parse it more reliably.
 * - Normalize tabs and spaces; use clear block separators; collapse excess newlines.
 */
function refineTextForGemini(text) {
  if (typeof text !== 'string' || !text.trim()) return text;
  let s = text.trim();
  // Replace tab with space so "1.\tQuestion" becomes "1. Question"
  s = s.replace(/\t/g, ' ');
  // Replace Unicode horizontal line (⸻ U+2E3B) and similar with a clear separator
  s = s.replace(/\s*[\u2E3A\u2E3B\u2014\u2015\u2500]\s*/g, '\n\n---\n\n');
  // Trim each line so leading/trailing spaces are consistent
  s = s.split('\n').map((line) => line.trim()).join('\n');
  // Collapse 3+ newlines to 2 so block boundaries are clear but not excessive
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

/**
 * Call Gemini with one API key. Returns parsed result or throws on failure.
 * @param {string} apiKey
 * @param {string} text
 * @param {number} keyIndex - 0, 1, or 2 for usage tracking
 */
async function parseWithKey(apiKey, text, keyIndex) {
  const refined = refineTextForGemini(text);
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: `${PARSE_PROMPT}\n\n---\n\nInput:\n${refined.slice(0, 100000)}`,
    config: {
      maxOutputTokens: 8192,
      temperature: 0.1,
    },
  });

  const raw = response?.text;
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('Empty response');

  const usageMetadata = response?.usageMetadata;
  const usage = usageMetadata
    ? {
        promptTokenCount: usageMetadata.promptTokenCount ?? null,
        outputTokenCount: usageMetadata.candidatesTokenCount ?? null,
        totalTokenCount: usageMetadata.totalTokenCount ?? null,
      }
    : null;

  if (typeof keyIndex === 'number') {
    recordGeminiUsage(keyIndex, usageMetadata || { totalTokenCount: 0 });
  }

  let jsonStr = raw.trim();
  // Strip markdown code fences (Gemini often returns ```json\n[...]\n```)
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/i, '');
    const lastFence = jsonStr.lastIndexOf('```');
    if (lastFence !== -1) jsonStr = jsonStr.slice(0, lastFence);
    jsonStr = jsonStr.trim();
  }

  let arr;
  try {
    arr = JSON.parse(jsonStr);
  } catch (parseErr) {
    // Repair malformed or truncated JSON from Gemini (any SyntaxError with a position)
    const posMatch = String(parseErr.message).match(/position\s+(\d+)/i);
    const cut = posMatch ? Math.min(Number(posMatch[1]), jsonStr.length) : jsonStr.length;
    let slice = jsonStr.slice(0, cut).trim();
    // Remove trailing comma so we can close validly (e.g. "...," -> "...")
    slice = slice.replace(/,\s*$/, '');
    const openBraces = (slice.match(/\{/g) || []).length - (slice.match(/\}/g) || []).length;
    const openBrackets = (slice.match(/\[/g) || []).length - (slice.match(/\]/g) || []).length;
    const needsQuote = /"[^"]*$/.test(slice) && String(parseErr.message).includes('Unterminated string');
    const repaired = slice + (needsQuote ? '"' : '') + '}'.repeat(Math.max(0, openBraces)) + ']'.repeat(Math.max(0, openBrackets));
    try {
      arr = JSON.parse(repaired);
    } catch (_) {
      throw parseErr;
    }
  }

  if (!Array.isArray(arr)) {
    arr = [];
  }
  if (!Array.isArray(arr) || arr.length === 0) {
    return { mcqs: [], errors: [], partialBlockIndices: [], usage };
  }

  const errors = [];
  const partialBlockIndices = [];
  const mcqs = [];

  // Strip trailing "wrong answer", "✓ wrong answer", etc. from option text
  function sanitizeOptionText(s) {
    if (typeof s !== 'string') return '';
    return s
      .trim()
      .replace(/\s*(✓|✔|✅)?\s*wrong\s+answer\s*$/gi, '')
      .replace(/\s*[✓✔✅]\s*$/g, '')
      .trim() || s.trim();
  }

  const PLACEHOLDER_OPTIONS = /^(no options parsed|add options in edit|\(no options parsed[^)]*\)|\(add options in edit\))$/i;

  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    const question = typeof item.question === 'string' ? item.question.trim() : '';
    let options = Array.isArray(item.options)
      ? item.options.map((o) => sanitizeOptionText(String(o ?? '')))
      : [];
    let correctIndex = typeof item.correctIndex === 'number' ? Math.max(0, Math.min(3, Math.floor(item.correctIndex))) : 0;
    const explanation = typeof item.explanation === 'string' ? item.explanation.trim() : '';

    if (!question) {
      errors.push({ blockIndex: i + 1, message: 'Skipped: missing question' });
      continue;
    }
    if (options.length < 4) {
      while (options.length < 4) options.push('');
    }
    const optionsValid = options.length >= 4 && options.every((o) => o.length > 0 && !PLACEHOLDER_OPTIONS.test(o));
    if (!optionsValid) {
      errors.push({ blockIndex: i + 1, message: 'Skipped: need exactly 4 valid options' });
      continue;
    }
    if (correctIndex < 0 || correctIndex > 3 || !options[correctIndex]?.trim()) {
      errors.push({ blockIndex: i + 1, message: 'Skipped: missing or invalid correct answer' });
      continue;
    }
    if (!explanation) {
      errors.push({ blockIndex: i + 1, message: 'Skipped: missing explanation' });
      continue;
    }

    mcqs.push({
      question,
      options: options.slice(0, 4),
      correctIndex,
      explanation,
    });
  }

  return { mcqs, errors, partialBlockIndices, usage };
}

/**
 * Call Gemini to parse raw text into MCQs. Uses round-robin across multiple API keys and retries
 * with the next key on failure. Returns null if no keys configured or all keys fail.
 */
export async function parseBulkMcqsWithGemini(text) {
  const keys = getGeminiApiKeys();
  if (keys.length === 0) {
    console.log('[Bulk MCQ parse] Gemini skipped: no API keys configured (GEMINI_API_KEY, etc.)');
    return null;
  }
  if (!text?.trim()) {
    console.log('[Bulk MCQ parse] Gemini skipped: empty input text');
    return null;
  }

  let lastError = null;
  const firstKey = getNextApiKey();
  const firstKeyIndex = (keyRoundRobinIndex - 1 + keys.length) % keys.length;
  try {
    return await parseWithKey(firstKey, text, firstKeyIndex);
  } catch (err) {
    lastError = err;
    console.warn('[Bulk MCQ parse] Gemini failed (first key):', err?.message || err);
  }

  for (let i = 0; i < keys.length; i++) {
    if (keys[i] === firstKey) continue;
    try {
      return await parseWithKey(keys[i], text, i);
    } catch (err) {
      lastError = err;
      console.warn('[Bulk MCQ parse] Gemini failed (retry key):', err?.message || err);
    }
  }

  console.log('[Bulk MCQ parse] Gemini failed after all keys; falling back to manual parser. Last error:', lastError?.message || lastError);
  return null;
}

/**
 * Parse bulk MCQ text: try Gemini first; if unavailable or failed, use rule-based parser.
 * @param {string} text - Raw paste of MCQs
 * @returns {Promise<{ mcqs, errors, partialBlockIndices, source: 'gemini' | 'manual' }>}
 */
export async function parseBulkMcqsWithFallback(text) {
  const geminiResult = await parseBulkMcqsWithGemini(text);
  if (geminiResult) {
    console.log('[Bulk MCQ parse] Using Gemini parser');
    return { ...geminiResult, source: 'gemini' };
  }
  console.log('[Bulk MCQ parse] Using custom (rule-based) parser');
  const manual = parseBulkMcqs(text || '');
  return { ...manual, source: 'manual' };
}
