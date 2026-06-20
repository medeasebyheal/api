import { GoogleGenAI } from '@google/genai';
import { recordGeminiUsage } from './geminiUsageStore.js';
import { callOpenAIRaw, extractOpenAIText } from './openaiHelper.js';
import { recordOpenAIUsage } from './openaiUsageStore.js';
import { splitBlocks, parseBlock, meetsBasicCriteria } from './mcqBulkParser.js';

const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const KEY_ENV_NAMES = ['GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3'];
const MAX_CHARS_PER_AI_REQUEST = 18000;
const BLOCK_SEPARATOR = '\n\n---\n\n';

let keyRoundRobinIndex = 0;

const OPTION_PREFIX = /^[a-dA-D][\.\)]\s*/;
const CORRECT_MARKERS = /\s*\((correct|c|right)\)\s*$/i;
const CHECKMARK_MARKERS = /\s*[✓✔✅\u2705]\s*$/;
const CORRECT_ANSWER_LABEL = /Correct\s+Answer\s*:\s*([A-Da-d])/i;
const QUESTION_PREFIX = /^(\d+[\.\)]\s*|Q\d+\.?\s*|Q\.?\s*|Question\s*:?\s*)/i;

const PARSE_PROMPT = `You are an expert medical MCQ parser. Extract ALL multiple-choice questions from the raw input text, even if formatting is inconsistent, incomplete, or messy.

INPUT FORMATS YOU MUST HANDLE
- Numbered questions: "1.", "1)", "Q.", "Q1.", "Question:"
- Option styles: "A)", "A.", "a.", plain lines without labels, inline single-line blocks
- Correct answer markers: "(correct)", "(c)", "(right)", checkmarks (✓ ✔ ✅), "Correct Answer: B"
- Explanation labels: "Explanation:", "explanation", multi-line paragraphs after options
- Block separators: blank lines, "---", horizontal rules, numbered blocks (1. 2. 3.)
- Ignore metadata: topic headers (e.g. "Topic 16:"), video/YouTube URLs

RULES
- Each MCQ must have exactly 4 options in the output (pad or merge if fewer/more in source)
- correctIndex is 0-based (0=A, 1=B, 2=C, 3=D)
- If no explanation is provided, write a brief 1-2 sentence explanation based on the correct answer
- Strip option prefixes (A), B., etc.) and correct-answer markers from option text
- Extract every identifiable MCQ; do not skip blocks due to minor formatting issues

OUTPUT
Return ONLY a valid JSON array with no markdown fences or commentary.
Each object must follow this schema:
{
  "question": "string",
  "options": ["string","string","string","string"],
  "correctIndex": 0|1|2|3,
  "explanation": "string"
}`;

function getGeminiApiKeys() {
  return [...new Set(KEY_ENV_NAMES.map((name) => process.env[name]?.trim()).filter(Boolean))];
}

function refineText(text) {
  if (!text?.trim()) return '';
  return text
    .trim()
    .replace(/\t/g, ' ')
    .replace(/\s*[\u2E3A\u2E3B\u2014\u2015\u2500]\s*/g, '\n\n---\n\n')
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sanitizeOption(s) {
  if (typeof s !== 'string') return '';
  let cleaned = s.trim()
    .replace(/\s*(✓|✔|✅)?\s*wrong\s+answer\s*$/gi, '')
    .replace(CORRECT_MARKERS, '')
    .replace(CHECKMARK_MARKERS, '')
    .replace(OPTION_PREFIX, '')
    .trim();
  return cleaned || s.trim();
}

function inferCorrectIndexFromOptions(options) {
  for (let i = 0; i < options.length; i++) {
    const raw = String(options[i] || '');
    if (CORRECT_MARKERS.test(raw) || CHECKMARK_MARKERS.test(raw)) return i;
  }
  return -1;
}

function inferCorrectIndexFromText(text) {
  const match = String(text || '').match(CORRECT_ANSWER_LABEL);
  if (match) return 'ABCD'.indexOf(match[1].toUpperCase());
  return -1;
}

/**
 * Normalize a parsed MCQ into a consistent shape.
 * Returns { mcq, partial, warning } or null if unusable.
 */
export function normalizeParsedMcq(item, blockIndex = null) {
  if (!item || typeof item !== 'object') return null;

  let question = String(item.question || '').replace(QUESTION_PREFIX, '').trim();
  if (!question) return null;

  let rawOptions = Array.isArray(item.options) ? item.options : [];
  if (rawOptions.length === 0 && typeof item.options === 'string') {
    rawOptions = item.options.split(/\n|,/).map((o) => o.trim()).filter(Boolean);
  }

  let correctIndex = typeof item.correctIndex === 'number' ? item.correctIndex : -1;
  if (correctIndex === -1 && typeof item.correctAnswer === 'string') {
    correctIndex = 'ABCD'.indexOf(item.correctAnswer.trim().toUpperCase().charAt(0));
  }
  if (correctIndex === -1) correctIndex = inferCorrectIndexFromOptions(rawOptions);
  if (correctIndex === -1) correctIndex = inferCorrectIndexFromText(question + ' ' + (item.explanation || ''));

  const options = rawOptions.map(sanitizeOption).filter(Boolean);
  let partial = false;
  let warning = null;

  if (options.length < 2) {
    partial = true;
    warning = blockIndex != null
      ? { blockIndex, message: 'Incomplete options – saved with placeholders; edit after import' }
      : { message: 'Incomplete options – saved with placeholders' };
    while (options.length < 4) options.push(`Option ${String.fromCharCode(65 + options.length)}`);
  } else if (options.length < 4) {
    while (options.length < 4) options.push(`Option ${String.fromCharCode(65 + options.length)}`);
  } else if (options.length > 4) {
    options.splice(4);
  }

  if (correctIndex < 0 || correctIndex > 3) {
    correctIndex = 0;
    if (blockIndex != null) {
      warning = { blockIndex, message: 'Could not determine correct answer – defaulted to option A' };
    }
  }

  let explanation = String(item.explanation || '').trim();
  if (!explanation) {
    explanation = `The correct answer is ${String.fromCharCode(65 + correctIndex)}: ${options[correctIndex]}.`;
  }

  return {
    mcq: { question, options, correctIndex, explanation },
    partial,
    warning,
  };
}

export function normalizeMcqList(items) {
  const mcqs = [];
  const partialBlockIndices = [];
  const errors = [];
  const list = Array.isArray(items) ? items : [];
  for (let i = 0; i < list.length; i++) {
    const result = normalizeParsedMcq(list[i], i + 1);
    if (!result) {
      errors.push({ blockIndex: i + 1, message: 'Skipped: empty or invalid MCQ' });
      continue;
    }
    mcqs.push(result.mcq);
    if (result.partial) partialBlockIndices.push(i + 1);
    if (result.warning) errors.push(result.warning);
  }
  return { mcqs, errors, partialBlockIndices };
}

function parseJSONSafely(raw) {
  raw = raw.trim().replace(/^```(?:json)?\s*\n?/i, '').replace(/```$/, '').trim();
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (err) {
    const pos = Number((err.message.match(/position\s+(\d+)/i) || [])[1] || raw.length);
    let slice = raw.slice(0, pos).trim().replace(/,\s*$/, '');
    const openBraces = (slice.match(/\{/g) || []).length - (slice.match(/\}/g) || []).length;
    const openBrackets = (slice.match(/\[/g) || []).length - (slice.match(/\]/g) || []).length;
    const repaired = slice + '}'.repeat(Math.max(0, openBraces)) + ']'.repeat(Math.max(0, openBrackets));
    const parsed = JSON.parse(repaired);
    return Array.isArray(parsed) ? parsed : [parsed];
  }
}

function mergeUsage(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return {
    promptTokenCount: (a.promptTokenCount || 0) + (b.promptTokenCount || 0),
    outputTokenCount: (a.outputTokenCount || 0) + (b.outputTokenCount || 0),
    totalTokenCount: (a.totalTokenCount || 0) + (b.totalTokenCount || 0),
  };
}

function openAIUsageFromBody(body) {
  const u = body?.usage;
  if (!u) return null;
  return {
    promptTokenCount: u.input_tokens ?? u.prompt_tokens ?? 0,
    outputTokenCount: u.output_tokens ?? u.completion_tokens ?? 0,
    totalTokenCount: u.total_tokens ?? 0,
  };
}

async function parseWithGeminiKey(apiKey, text, keyIndex = 0) {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: `${PARSE_PROMPT}\n\n---\n\nInput:\n${text}`,
    config: { maxOutputTokens: 8192, temperature: 0.1 },
  });

  const raw = response?.text;
  const usage = response?.usageMetadata || null;
  if (typeof keyIndex === 'number') {
    recordGeminiUsage(keyIndex, usage || { totalTokenCount: 0 }, { source: 'mcq-parser' });
  }
  if (!raw?.trim()) throw new Error('Empty Gemini response');
  return { items: parseJSONSafely(raw), usage, source: 'gemini' };
}

async function parseWithOpenAI(text) {
  const { status, body } = await callOpenAIRaw(`${PARSE_PROMPT}\n\n---\n\nInput:\n${text}`, {
    timeoutMs: 60000,
    temperature: 0.1,
    maxOutputTokens: 8192,
  });
  if (status !== 200) throw new Error(`OpenAI parse failed with status ${status}`);
  const raw = extractOpenAIText(body);
  if (!raw?.trim()) throw new Error('Empty OpenAI response');
  recordOpenAIUsage({ total_tokens: body?.usage?.total_tokens ?? 0 });
  return { items: parseJSONSafely(raw), usage: openAIUsageFromBody(body), source: 'openai' };
}

async function parseWithAI(text) {
  if (process.env.OPENAI_API_KEY) {
    try {
      return await parseWithOpenAI(text);
    } catch (err) {
      console.warn('[parseWithAI] OpenAI failed:', err.message);
    }
  }

  const keys = getGeminiApiKeys();
  if (!keys.length) throw new Error('No Gemini API keys configured');

  let lastError = null;
  for (let k = 0; k < keys.length; k++) {
    try {
      return await parseWithGeminiKey(keys[k], text, k);
    } catch (err) {
      lastError = err;
      console.warn(`[parseWithAI] Gemini attempt ${k + 1} failed:`, err.message);
    }
  }
  throw lastError || new Error('AI parse failed');
}

/** Pack blocks into AI request batches without splitting mid-block. */
function packBlockBatches(blocksWithIndex) {
  const batches = [];
  let current = [];
  let currentLen = 0;

  for (const entry of blocksWithIndex) {
    const blockLen = entry.block.length + BLOCK_SEPARATOR.length;
    if (current.length > 0 && currentLen + blockLen > MAX_CHARS_PER_AI_REQUEST) {
      batches.push(current);
      current = [];
      currentLen = 0;
    }
    current.push(entry);
    currentLen += blockLen;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

function normalizeRuleBased(parsed, blockIndex) {
  const result = normalizeParsedMcq(
    {
      question: parsed.question,
      options: parsed.options,
      correctIndex: parsed.correctIndex,
      explanation: parsed.explanation,
    },
    blockIndex
  );
  if (result?.partial) parsed.partial = true;
  return result;
}

export async function parseBulkMcqs(text) {
  const refined = refineText(text);
  if (!refined) {
    return { mcqs: [], errors: [], partialBlockIndices: [], source: 'manual', usage: null };
  }

  const blocks = splitBlocks(refined);
  if (blocks.length === 0) {
    // No block structure detected – send entire text to AI
    try {
      const { items, usage, source } = await parseWithAI(refined);
      const normalized = normalizeMcqList(items);
      return { ...normalized, source, usage };
    } catch (err) {
      return {
        mcqs: [],
        errors: [{ blockIndex: 1, message: err.message || 'AI parse failed' }],
        partialBlockIndices: [],
        source: 'gemini',
        usage: null,
      };
    }
  }

  const mcqs = [];
  const errors = [];
  const partialBlockIndices = [];
  const failedBlocks = [];
  let usedRuleBased = false;
  let usedAI = false;
  let aiSource = null;
  let usage = null;

  for (let i = 0; i < blocks.length; i++) {
    const blockIndex = i + 1;
    const parsed = parseBlock(blocks[i], i);

    if (parsed.error || !meetsBasicCriteria(parsed)) {
      failedBlocks.push({ block: blocks[i], blockIndex });
      if (parsed.error) {
        errors.push({ blockIndex, message: parsed.error });
      }
      continue;
    }

    const normalized = normalizeRuleBased(parsed, blockIndex);
    if (!normalized) {
      failedBlocks.push({ block: blocks[i], blockIndex });
      continue;
    }

    mcqs.push(normalized.mcq);
    usedRuleBased = true;
    if (normalized.partial || parsed.partial) partialBlockIndices.push(blockIndex);
    if (normalized.warning) errors.push(normalized.warning);
  }

  const batches = packBlockBatches(failedBlocks);

  for (const batch of batches) {
    const batchText = batch.map((b) => b.block).join(BLOCK_SEPARATOR);
    const blockIndices = batch.map((b) => b.blockIndex);

    try {
      const { items, usage: batchUsage, source } = await parseWithAI(batchText);
      usage = mergeUsage(usage, batchUsage);
      usedAI = true;
      aiSource = source;

      if (items.length === 0) {
        for (const idx of blockIndices) {
          errors.push({ blockIndex: idx, message: 'AI could not extract MCQs from this block' });
        }
        continue;
      }

      // If batch returned fewer items than blocks, assign sequentially; retry singles for leftovers
      if (items.length >= batch.length) {
        for (let j = 0; j < batch.length; j++) {
          const result = normalizeParsedMcq(items[j], blockIndices[j]);
          if (result) {
            mcqs.push(result.mcq);
            if (result.partial) partialBlockIndices.push(blockIndices[j]);
            if (result.warning) errors.push(result.warning);
          } else {
            errors.push({ blockIndex: blockIndices[j], message: 'AI returned invalid MCQ for this block' });
          }
        }
      } else {
        for (let j = 0; j < items.length; j++) {
          const result = normalizeParsedMcq(items[j], blockIndices[j]);
          if (result) {
            mcqs.push(result.mcq);
            if (result.partial) partialBlockIndices.push(blockIndices[j]);
            if (result.warning) errors.push(result.warning);
          }
        }
        for (let j = items.length; j < batch.length; j++) {
          const single = batch[j];
          try {
            const { items: singleItems, usage: singleUsage, source: singleSource } = await parseWithAI(single.block);
            usage = mergeUsage(usage, singleUsage);
            usedAI = true;
            aiSource = singleSource;
            const result = normalizeParsedMcq(singleItems[0], single.blockIndex);
            if (result) {
              mcqs.push(result.mcq);
              if (result.partial) partialBlockIndices.push(single.blockIndex);
              if (result.warning) errors.push(result.warning);
            } else {
              errors.push({ blockIndex: single.blockIndex, message: 'AI could not extract MCQ from this block' });
            }
          } catch (err) {
            errors.push({ blockIndex: single.blockIndex, message: err.message || 'AI parse failed for block' });
          }
        }
      }
    } catch (err) {
      for (const idx of blockIndices) {
        errors.push({ blockIndex: idx, message: err.message || 'AI parse failed for block batch' });
      }
    }
  }

  let source = 'manual';
  if (usedRuleBased && usedAI) source = 'hybrid';
  else if (usedAI) source = aiSource || 'gemini';
  else if (usedRuleBased) source = 'rule-based';

  return { mcqs, errors, partialBlockIndices, source, usage };
}
