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

// keyRoundRobinIndex is reserved for round-robin selection if needed.

function is429QuotaError(err) {
  return err?.status === 429 || err?.code === 429 || String(err?.message || '').includes('429') || String(err?.message || '').includes('RESOURCE_EXHAUSTED') || String(err?.message || '').includes('quota');
}

const SYSTEM_PROMPT = `You are EaseGPT, a learning assistant. You must ONLY answer about the current MCQ and its topic.

If an image description or visual note is provided, use it to interpret any visual content and incorporate that into your explanation.

Rules:
- Explain only: why the selected (wrong) answer is incorrect, why the correct answer is correct, and the underlying concept or theory.
- Allow short follow-up questions only if they clarify this question or its concept.
- Refuse any question unrelated to this MCQ or its topic. Say: "I can only help with this question and its topic."
- Keep answers concise and educational.`;

function buildContextBlock(context) {
  if (!context || typeof context !== 'object') return '';
  const q = (context.question || '').trim();
  const opts = Array.isArray(context.options) ? context.options : [];
  const correctIdx = context.correctIndex ?? 0;
  const selectedIdx = context.selectedIndex ?? -1;
  const explanation = context.explanation || '';
  const imgDesc = (context.imageDescription || '').trim();
  const correctOpt = opts[correctIdx];
  const selectedOpt = selectedIdx >= 0 && selectedIdx < opts.length ? opts[selectedIdx] : '';

  const parts = [];
  // Put visual context first when available
  if (imgDesc) parts.push(`Image description (visual context): ${imgDesc.slice(0, 300)}`);
  parts.push(`Question: ${q.slice(0, 1000)}`);
  if (opts.length) {
    parts.push(
      `Options: ${opts.map((o, i) => `${String.fromCharCode(65 + i)}. ${(o || '').slice(0, 250)}`).join(' | ')}`
    );
  }
  parts.push(`Correct answer index: ${correctIdx}${correctOpt ? ` (${correctOpt.slice(0, 200)})` : ''}`);
  parts.push(`User's selected answer index: ${selectedIdx}${selectedOpt ? ` (${selectedOpt.slice(0, 200)})` : ''}`);
  if (explanation) parts.push(`Stored explanation: ${explanation.slice(0, 600)}`);

  return `Current MCQ:\n${parts.join('\n')}\n`;
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
  // Round-robin start index so consecutive calls use different first keys
  const startIdx = keyRoundRobinIndex % keys.length;
  keyRoundRobinIndex = (keyRoundRobinIndex + 1) % Number.MAX_SAFE_INTEGER;
  for (let offset = 0; offset < keys.length; offset++) {
    const i = (startIdx + offset) % keys.length;
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
      recordGeminiUsage(i, response?.usageMetadata, { source: 'easegpt' });
      const text = response?.text;
      if (typeof text === 'string' && text.trim()) return text.trim();
      lastError = new Error('Empty response');
    } catch (err) {
      lastError = err;
      if (is429QuotaError(err)) {
        if (offset < keys.length - 1) continue;
        const e = new Error('All API keys have exceeded their quota. Please try again in a few minutes.');
        e.status = 429;
        throw e;
      }
      throw err;
    }
  }
  throw lastError || new Error('API request failed');
}

/**
 * OSPE-specific system prompt (generic medical education persona).
 * Persona: medical education assistant evaluating OSPE-style MCQs and viva answers.
 */
const SYSTEM_PROMPT_OSPE = `You are EaseGPT, a medical education assistant helping a student prepare for OSPE-style assessments.

Follow typical undergraduate medical curriculum and OSPE marking approaches used in medical schools.

General rules:
- Focus ONLY on the current OSPE station/question and closely related core concepts.
- Use clear, exam-oriented language suitable for undergraduate medical students.
- Never give management advice that contradicts standard undergraduate guidelines.
- If the student asks about unrelated topics, say: "I can only help with this OSPE question and closely related concepts right now."

For OSPE MCQs:
- Explain why the student's selected option is correct or incorrect.
- Explain why the correct option is correct, using clinico-pathological reasoning where appropriate.
- Emphasize key high-yield exam points.

For OSPE viva (written answers):
- First, classify the student's answer as correct / partially correct / incorrect.
- Point out clearly what is missing, incomplete, or wrong.
- Then provide a concise ideal viva answer in 4–7 bullet points covering key marking points.
- Be supportive and encouraging, with a focus on learning rather than improvement.`;

function buildOspeContextBlock(context = {}) {
  const type = context.type || '';
  const question = (context.questionText || context.question || '').trim();
  const stationNote = (context.stationNote || '').trim();
  const imgDesc = (context.imageDescription || context.stationImageDescription || '').trim();
  const opts = Array.isArray(context.options) ? context.options : [];
  const correctIdx = typeof context.correctIndex === 'number' ? context.correctIndex : null;
  const selectedIdx = typeof context.selectedIndex === 'number' ? context.selectedIndex : null;
  const expected = context.expectedAnswer || '';
  const studentAnswer = context.studentAnswer || '';

  const lines = [];
  if (stationNote) {
    lines.push(`Station description: ${stationNote.slice(0, 400)}`);
  }
  if (imgDesc) {
    lines.push(`Image description (visual context): ${imgDesc.slice(0, 300)}`);
  }
  lines.push(`Question type: ${type}`);
  lines.push(`Question: ${question.slice(0, 1000)}`);

  if (opts.length) {
    lines.push(
      `Options: ${opts
        .map((o, i) => `${String.fromCharCode(65 + i)}. ${(o || '').slice(0, 200)}`)
        .join(' | ')}`
    );
  }

  if (correctIdx != null && correctIdx >= 0 && correctIdx < opts.length) {
    lines.push(
      `Correct answer index: ${correctIdx} (${(opts[correctIdx] || '').slice(0, 150)})`
    );
  }
  if (selectedIdx != null && selectedIdx >= 0 && selectedIdx < opts.length) {
    lines.push(
      `Student selected index: ${selectedIdx} (${(opts[selectedIdx] || '').slice(0, 150)})`
    );
  }

  if (expected) {
    lines.push(`Model/expected answer: ${expected.slice(0, 600)}`);
  }
  if (studentAnswer) {
    lines.push(`Student viva answer: ${studentAnswer.slice(0, 600)}`);
  }

  return `Current OSPE question:
${lines.join('\n')}`;
}

/**
 * Generate a chat reply for OSPE MCQs and viva questions, using Pakistan MBBS–specific persona.
 * @param {{ type?: string, questionText?: string, question?: string, options?: string[], correctIndex?: number, selectedIndex?: number, expectedAnswer?: string, studentAnswer?: string, stationNote?: string }} context
 * @param {{ role: string, content: string }[]} history
 * @param {string} userMessage
 * @param {'mcq' | 'viva'} mode
 */
export async function generateOspeChatReply(context, history, userMessage, mode = 'mcq') {
  const keys = getGeminiApiKeys();
  if (keys.length === 0) throw new Error('No API keys configured');

  const msg = typeof userMessage === 'string' ? userMessage.slice(0, MAX_MESSAGE_LENGTH).trim() : '';
  const contextBlock = buildOspeContextBlock(context);

  const historySlice = Array.isArray(history) ? history.slice(-MAX_HISTORY_TURNS * 2) : [];
  let conversation = '';
  for (const turn of historySlice) {
    const role = turn.role === 'model' ? 'EaseGPT' : 'Student';
    const content = (turn.content || '').slice(0, 1500);
    conversation += `${role}: ${content}\n\n`;
  }

  const modeInstruction =
    mode === 'viva'
      ? 'The student has written a viva-style answer. First classify it as correct / partially correct / incorrect, then list missing or incorrect points, then give a concise ideal viva answer in bullet points suitable for OSPE marking.'
      : 'This is an OSPE MCQ. Explain why the selected option is right or wrong, why the correct option is correct, and highlight high-yield exam points.';

  const fullPrompt = `${SYSTEM_PROMPT_OSPE}

${contextBlock}

Additional instructions for this question:
${modeInstruction}

${conversation ? `Previous conversation:\n${conversation}` : ''}
Student: ${msg}`;

  let lastError = null;
  // Round-robin start index so consecutive calls use different first keys
  const startIdx = keyRoundRobinIndex % keys.length;
  keyRoundRobinIndex = (keyRoundRobinIndex + 1) % Number.MAX_SAFE_INTEGER;
  for (let offset = 0; offset < keys.length; offset++) {
    const i = (startIdx + offset) % keys.length;
    const apiKey = keys[i];
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: fullPrompt,
        config: {
          maxOutputTokens: 1024,
          temperature: 0.1,
        },
      });
      recordEaseGPTUsage(response?.usageMetadata);
      recordGeminiUsage(i, response?.usageMetadata, { source: 'easegpt' });
      const text = response?.text;
      if (typeof text === 'string' && text.trim()) return text.trim();
      lastError = new Error('Empty response');
    } catch (err) {
      lastError = err;
      if (is429QuotaError(err)) {
        if (offset < keys.length - 1) continue;
        const e = new Error('All API keys have exceeded their quota. Please try again in a few minutes.');
        e.status = 429;
        throw e;
      }
      throw err;
    }
  }
  throw lastError || new Error('API request failed');
}

