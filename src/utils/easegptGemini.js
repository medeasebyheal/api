/**
 * EaseGPT: Gemini chat completion for MCQ explanations.
 * Reuses same API key rotation pattern as mcqGeminiParser.
 */

import { GoogleGenAI } from '@google/genai';
import { recordEaseGPTUsage } from './easegptUsageStore.js';
import { recordGeminiUsage } from './geminiUsageStore.js';

const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const KEY_ENV_NAMES = ['GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3'];
const MAX_MESSAGE_LENGTH = 500;
const MAX_HISTORY_TURNS = 10;

function getGeminiApiKeys() {
  const keys = KEY_ENV_NAMES.map((name) => process.env[name]?.trim()).filter(Boolean);
  return [...new Set(keys)];
}

let keyRoundRobinIndex = 0;

/** Returns next API key in round-robin order and its index (0, 1, 2) for usage tracking. */
function getNextApiKey() {
  const keys = getGeminiApiKeys();
  if (keys.length === 0) return null;
  const idx = keyRoundRobinIndex % keys.length;
  keyRoundRobinIndex += 1;
  return { apiKey: keys[idx], keyIndex: idx };
}

function is429QuotaError(err) {
  return err?.status === 429 || err?.code === 429 || String(err?.message || '').includes('429') || String(err?.message || '').includes('RESOURCE_EXHAUSTED') || String(err?.message || '').includes('quota');
}

const SYSTEM_PROMPT = `You are EaseGPT, a learning assistant. You must ONLY answer about the current MCQ and its topic.

Rules:
- Explain only: why the selected (wrong) answer is incorrect, why the correct answer is correct, and the underlying concept or theory.
- Allow short follow-up questions only if they clarify this question or its concept.
- Refuse any question unrelated to this MCQ or its topic. Say: "I can only help with this question and its topic."
- Keep answers concise and educational.`;

function buildContextBlock(context) {
  if (!context || typeof context !== 'object') return '';
  const q = context.question || '';
  const opts = Array.isArray(context.options) ? context.options : [];
  const correctIdx = context.correctIndex ?? 0;
  const selectedIdx = context.selectedIndex ?? -1;
  const explanation = context.explanation || '';
  const correctOpt = opts[correctIdx];
  const selectedOpt = selectedIdx >= 0 && selectedIdx < opts.length ? opts[selectedIdx] : '';
  return `
Current MCQ:
Question: ${q.slice(0, 800)}
Options: ${opts.map((o, i) => `${String.fromCharCode(65 + i)}. ${(o || '').slice(0, 200)}`).join(' | ')}
Correct answer index: ${correctIdx}${correctOpt ? ` (${correctOpt.slice(0, 150)})` : ''}
User's selected answer index: ${selectedIdx}${selectedOpt ? ` (${selectedOpt.slice(0, 150)})` : ''}
Stored explanation: ${explanation.slice(0, 400)}
`;
}

/**
 * Generate a chat reply from Gemini.
 * @param {{ question?: string, options?: string[], correctIndex?: number, selectedIndex?: number, explanation?: string }} context
 * @param {{ role: string, content: string }[]} history - last N turns (user/model)
 * @param {string} userMessage - current user message (max 500 chars enforced by caller)
 * @returns {Promise<string>} - model reply text
 */
export async function generateChatReply(context, history, userMessage) {
  const keys = getGeminiApiKeys();
  if (keys.length === 0) throw new Error('No API keys configured');

  const msg = typeof userMessage === 'string' ? userMessage.slice(0, MAX_MESSAGE_LENGTH).trim() : '';
  const contextBlock = buildContextBlock(context);

  const historySlice = Array.isArray(history) ? history.slice(-MAX_HISTORY_TURNS * 2) : [];
  let conversation = '';
  for (const turn of historySlice) {
    const role = turn.role === 'model' ? 'EaseGPT' : 'User';
    const content = (turn.content || '').slice(0, 1500);
    conversation += `${role}: ${content}\n\n`;
  }

  const fullPrompt = `${SYSTEM_PROMPT}
${contextBlock}
${conversation ? `Previous conversation:\n${conversation}` : ''}
User: ${msg}`;

  let lastError = null;
  for (let i = 0; i < keys.length; i++) {
    const apiKey = keys[i];
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: fullPrompt,
        config: {
          maxOutputTokens: 1024,
          temperature: 0.3,
        },
      });
      recordEaseGPTUsage(response?.usageMetadata);
      recordGeminiUsage(i, response?.usageMetadata);
      const text = response?.text;
      if (typeof text === 'string' && text.trim()) return text.trim();
      lastError = new Error('Empty response');
    } catch (err) {
      lastError = err;
      if (is429QuotaError(err)) {
        if (i < keys.length - 1) continue;
        const e = new Error('All API keys have exceeded their quota. Please try again in a few minutes.');
        e.status = 429;
        throw e;
      }
      throw err;
    }
  }
  throw lastError || new Error('API request failed');
}
