/**
 * EaseGPT: AI tutor for MCQ explanations with OpenAI primary and Gemini fallback
 */

import { GoogleGenAI } from '@google/genai';
import { recordEaseGPTUsage } from './easegptUsageStore.js';
import { recordGeminiUsage } from './geminiUsageStore.js';
import { recordOpenAIUsage } from './openaiUsageStore.js';
import { callOpenAIRaw, extractOpenAIText } from './openaiHelper.js';

const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const KEY_ENV_NAMES = ['GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3'];

const MAX_MESSAGE_LENGTH = 500;
const MAX_HISTORY_TURNS = 10;

function getGeminiApiKeys() {
  const keys = KEY_ENV_NAMES.map((name) => process.env[name]?.trim()).filter(Boolean);
  return [...new Set(keys)];
}

let keyRoundRobinIndex = 0;

function is429QuotaError(err) {
  return (
    err?.status === 429 ||
    err?.code === 429 ||
    String(err?.message || '').includes('429') ||
    String(err?.message || '').includes('RESOURCE_EXHAUSTED') ||
    String(err?.message || '').includes('quota')
  );
}

/* -------------------------------------------------------------------------- */
/*                               MCQ SYSTEM PROMPT                            */
/* -------------------------------------------------------------------------- */

const SYSTEM_PROMPT = `
You are EaseGPT, an AI tutor helping students understand a multiple-choice question (MCQ) and the concepts behind it.

Your job is to help the student clearly understand the reasoning behind the correct answer.

PRIMARY TASK
When discussing the MCQ:
• Explain why the student's selected answer is incorrect (if wrong)
• Explain why the correct answer is correct
• Explain the key concept needed to solve the question

FOLLOW-UP QUESTIONS
Students may ask additional questions to better understand the MCQ or its explanation.

You ARE allowed to answer:
• Definitions of terms appearing in the question or explanation
• Conceptual questions related to the topic
• Clarifications about anatomy, physiology, formulas, mechanisms, or reasoning
• Simple examples that help the student understand the concept

If a question helps the student understand the MCQ, the explanation, or the concept behind it, you should answer it.

RESTRICTIONS
Do NOT answer questions that are clearly unrelated to this MCQ or its concepts.

If the user asks something unrelated, reply with:
"I can only help with this question and the concepts related to it."

STYLE
• Keep explanations concise
• Prefer short paragraphs or bullet points
• Focus on understanding rather than long textbook explanations
`;

/* -------------------------------------------------------------------------- */
/*                               CONTEXT BUILDER                              */
/* -------------------------------------------------------------------------- */

function buildContextBlock(context) {
  if (!context || typeof context !== 'object') return '';

  const q = (context.question || '').trim();
  const opts = Array.isArray(context.options) ? context.options : [];
  const correctIdx = context.correctIndex ?? 0;
  const selectedIdx = context.selectedIndex ?? -1;
  const explanation = context.explanation || '';
  const imgDesc = (context.imageDescription || '').trim();

  const correctOpt = opts[correctIdx];
  const selectedOpt =
    selectedIdx >= 0 && selectedIdx < opts.length ? opts[selectedIdx] : '';

  const parts = [];

  if (imgDesc)
    parts.push(`Image description: ${imgDesc.slice(0, 300)}`);

  parts.push(`Question: ${q.slice(0, 1000)}`);

  if (opts.length) {
    parts.push(
      `Options: ${opts
        .map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`)
        .join(' | ')}`
    );
  }

  parts.push(
    `Correct answer: ${correctIdx} (${(correctOpt || '').slice(0, 200)})`
  );

  parts.push(
    `Student selected: ${selectedIdx} (${(selectedOpt || '').slice(0, 200)})`
  );

  if (explanation)
    parts.push(`Stored explanation: ${explanation.slice(0, 600)}`);

  return `Current MCQ:\n${parts.join('\n')}\n`;
}

/* -------------------------------------------------------------------------- */
/*                               CONVERSATION                                 */
/* -------------------------------------------------------------------------- */

function buildConversation(history) {
  const historySlice = Array.isArray(history)
    ? history.slice(-MAX_HISTORY_TURNS * 2)
    : [];

  let conversation = '';

  for (const turn of historySlice) {
    const role = turn.role === 'model' ? 'Tutor' : 'Student';
    const content = (turn.content || '').slice(0, 1500);

    conversation += `${role}: ${content}\n\n`;
  }

  return conversation;
}

/* -------------------------------------------------------------------------- */
/*                             MCQ CHAT GENERATOR                             */
/* -------------------------------------------------------------------------- */

export async function generateChatReply(context, history, userMessage) {

  const keys = getGeminiApiKeys();
  const hasGeminiKeys = keys.length > 0;

  const msg =
    typeof userMessage === 'string'
      ? userMessage.slice(0, MAX_MESSAGE_LENGTH).trim()
      : '';

  const contextBlock = buildContextBlock(context);
  const conversation = buildConversation(history);

  const fullPrompt = `${SYSTEM_PROMPT}

${contextBlock}

${conversation ? `Previous conversation:\n${conversation}` : ''}

Student: ${msg}`;

  /* ----------------------------- OpenAI first ----------------------------- */

  if (process.env.OPENAI_API_KEY) {
    try {
      const { status, body } = await callOpenAIRaw(fullPrompt, {
        timeoutMs: 15000,
        temperature: 0.1
      });

      const text = extractOpenAIText(body);

      const tokens = body?.usage?.total_tokens ?? 0;

      try {
        recordEaseGPTUsage({ totalTokenCount: tokens });
        recordOpenAIUsage({ total_tokens: tokens });
      } catch {}

      if (status === 200 && text) {
        return text.trim();
      }

      if ([401,403,429].includes(status) || status >= 500) {
        // fallback to Gemini
      }

    } catch (err) {
      // fallback
    }
  }

  if (!hasGeminiKeys) throw new Error('No API keys configured');

  /* ----------------------------- Gemini fallback ----------------------------- */

  let lastError = null;

  const startIdx = keyRoundRobinIndex % keys.length;
  keyRoundRobinIndex =
    (keyRoundRobinIndex + 1) % Number.MAX_SAFE_INTEGER;

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
          temperature: 0.1
        }
      });

      recordEaseGPTUsage(response?.usageMetadata);
      recordGeminiUsage(i, response?.usageMetadata, { source: 'easegpt' });

      const text = response?.text;

      if (typeof text === 'string' && text.trim())
        return text.trim();

      lastError = new Error('Empty response');

    } catch (err) {

      lastError = err;

      if (is429QuotaError(err)) {
        if (offset < keys.length - 1) continue;

        const e = new Error(
          'All API keys have exceeded their quota. Please try again in a few minutes.'
        );

        e.status = 429;
        throw e;
      }

      throw err;
    }
  }

  throw lastError || new Error('API request failed');
}

/* -------------------------------------------------------------------------- */
/*                              OSPE SYSTEM PROMPT                            */
/* -------------------------------------------------------------------------- */

const SYSTEM_PROMPT_OSPE = `
You are EaseGPT, an AI tutor helping medical students prepare for OSPE (Objective Structured Practical Examination).

Your job is to evaluate the student's answer and explain the medical reasoning.

GENERAL RULES
• Focus on the current OSPE question
• Provide exam-oriented explanations
• Emphasize high-yield medical facts
• Use concise structured explanations

If a question is unrelated, reply:
"I can only help with this OSPE question and closely related concepts."

OSPE MCQ
Explain why the selected option is right or wrong and highlight key exam points.

OSPE VIVA
1. Classify answer: Correct / Partially Correct / Incorrect
2. Explain missing or incorrect points
3. Provide an ideal answer in 4–7 bullet points
`;

/* -------------------------------------------------------------------------- */
/*                              OSPE CONTEXT BUILDER                          */
/* -------------------------------------------------------------------------- */

function buildOspeContextBlock(context = {}) {

  const lines = [];

  if (context.stationNote)
    lines.push(`Station description: ${context.stationNote}`);

  if (context.imageDescription)
    lines.push(`Image description: ${context.imageDescription}`);

  lines.push(`Question: ${context.questionText || context.question || ''}`);

  if (context.options?.length) {
    lines.push(
      `Options: ${context.options
        .map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`)
        .join(' | ')}`
    );
  }

  if (typeof context.correctIndex === 'number')
    lines.push(`Correct index: ${context.correctIndex}`);

  if (typeof context.selectedIndex === 'number')
    lines.push(`Student selected: ${context.selectedIndex}`);

  if (context.expectedAnswer)
    lines.push(`Expected answer: ${context.expectedAnswer}`);

  if (context.studentAnswer)
    lines.push(`Student answer: ${context.studentAnswer}`);

  return `Current OSPE question:\n${lines.join('\n')}`;
}

/* -------------------------------------------------------------------------- */
/*                          OSPE CHAT GENERATOR                               */
/* -------------------------------------------------------------------------- */

export async function generateOspeChatReply(
  context,
  history,
  userMessage,
  mode = 'mcq'
) {

  const keys = getGeminiApiKeys();
  const msg = userMessage.slice(0, MAX_MESSAGE_LENGTH).trim();

  const contextBlock = buildOspeContextBlock(context);
  const conversation = buildConversation(history);

  let instruction;
  if (mode === 'viva') {
    instruction = 'Evaluate the student answer and provide ideal OSPE bullet points.';
  } else if (context && context.studentAnswer) {
    // If student provided a free-text answer for a non-viva OSPE (image identification, short answer), ask for classification + recommended answer.
    instruction =
      'Classify the student answer as Correct / Partially correct / Incorrect / Misconception. Then provide a one-line recommended answer and a 2-3 sentence explanation of the underlying concept. Keep the reply concise.';
  } else {
    instruction = 'Explain why the selected option is correct or incorrect.';
  }

  const prompt = `${SYSTEM_PROMPT_OSPE}

${contextBlock}

Instruction: ${instruction}

${conversation ? `Previous conversation:\n${conversation}` : ''}

Student: ${msg}`;

  if (process.env.OPENAI_API_KEY) {
    try {

      const { status, body } = await callOpenAIRaw(prompt, {
        timeoutMs: 15000,
        temperature: 0.1
      });

      const text = extractOpenAIText(body);

      if (status === 200 && text) return text.trim();

    } catch {}
  }

  const startIdx = keyRoundRobinIndex % keys.length;
  keyRoundRobinIndex =
    (keyRoundRobinIndex + 1) % Number.MAX_SAFE_INTEGER;

  for (let offset = 0; offset < keys.length; offset++) {

    const i = (startIdx + offset) % keys.length;

    const ai = new GoogleGenAI({ apiKey: keys[i] });

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: { maxOutputTokens: 1024, temperature: 0.1 },
    });

    const text = response?.text;

    if (text?.trim()) return text.trim();
  }

  throw new Error('API request failed');
}