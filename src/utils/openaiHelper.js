import fetch from 'node-fetch';

const OPENAI_MODEL = 'gpt-4o-mini';

async function callOpenAIRaw(prompt, { timeoutMs = 15000, temperature = 0.1, maxOutputTokens = 2048 } = {}) {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error('No OPENAI_API_KEY');
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: prompt,
        max_output_tokens: maxOutputTokens,
        temperature,
      }),
      signal: controller.signal,
    });
    const status = res.status;
    const body = await res.json().catch(() => null);
    return { status, body };
  } finally {
    clearTimeout(id);
  }
}

function extractOpenAIText(body) {
  if (!body) return '';
  // New Responses API may include output_text
  if (typeof body.output_text === 'string' && body.output_text.trim()) return body.output_text.trim();
  // Older/alternate shapes: body.output is an array of objects with 'content' arrays
  if (Array.isArray(body.output) && body.output.length > 0) {
    try {
      return body.output
        .map((o) => {
          if (!o) return '';
          if (typeof o === 'string') return o;
          if (Array.isArray(o?.content)) {
            return o.content.map((c) => c?.text || c?.content || '').join('');
          }
          if (typeof o?.text === 'string') return o.text;
          return '';
        })
        .join('\n')
        .trim();
    } catch (_) {
      return '';
    }
  }
  // Fallback: try choices/text (compat)
  if (Array.isArray(body.choices) && body.choices.length > 0) {
    return body.choices.map((c) => c?.text || '').join('\n').trim();
  }
  return '';
}

export { callOpenAIRaw, extractOpenAIText };

