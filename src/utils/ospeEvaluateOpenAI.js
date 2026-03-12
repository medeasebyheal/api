/**
 * OSPE written-answer evaluation via OpenAI.
 * Returns qualitative assessment and correctness percentage (0-100).
 */
import { callOpenAIRaw, extractOpenAIText } from './openaiHelper.js';

const ASSESSMENTS = ['Correct', 'Incorrect', 'Partially correct', 'Partially incorrect'];

/**
 * Evaluate a single OSPE written answer.
 * @param {{ questionText: string, expectedAnswer: string, userAnswer: string }} params
 * @returns {Promise<{ assessment: string, percentage: number }>}
 */
export async function evaluateOspeWrittenAnswer({ questionText, expectedAnswer, userAnswer }) {
  const fallback = { assessment: 'Incorrect', percentage: 0 };
  const q = (questionText || '').trim();
  const expected = (expectedAnswer || '').trim();
  const user = (userAnswer || '').trim();
  if (!q || !expected || !user) return fallback;

  const prompt = `You are an expert medical examiner evaluating a student's written OSPE answer.

Question: ${q.slice(0, 800)}

Model/expected answer: ${expected.slice(0, 600)}

Student's answer: ${user.slice(0, 600)}

Evaluate the student's answer and respond with ONLY a single JSON object, no other text:
{"assessment":"<Correct|Incorrect|Partially correct|Partially incorrect>","percentage":<0-100>}

Guidelines:
- Ignore minor spelling mistakes; evaluate based on meaning and key medical terms.
- Correct: answer is accurate and complete (percentage 90-100).
- Partially correct: key points present but incomplete or minor errors (50-89).
- Partially incorrect: some relevance but significant errors or omissions (10-49).
- Incorrect: wrong or irrelevant (0-9).

Reply with only the JSON object.`;

  try {
    const { status, body } = await callOpenAIRaw(prompt, {
      timeoutMs: 20000,
      temperature: 0.1,
      maxOutputTokens: 256,
    });
    const text = extractOpenAIText(body);
    if (!text || status !== 200) return fallback;
    const cleaned = text.replace(/[\s\S]*?(\{[\s\S]*\})[\s\S]*/, '$1').trim();
    const parsed = JSON.parse(cleaned);
    let assessment = parsed.assessment;
    if (!ASSESSMENTS.includes(assessment)) assessment = fallback.assessment;
    let percentage = Number(parsed.percentage);
    if (Number.isNaN(percentage) || percentage < 0) percentage = 0;
    if (percentage > 100) percentage = 100;
    return { assessment, percentage };
  } catch (_) {
    return fallback;
  }
}
