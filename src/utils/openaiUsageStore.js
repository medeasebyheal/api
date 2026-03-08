/**
 * In-memory usage store for OpenAI API (EaseGPT chat + MCQ parsing).
 * Tracks requests and tokens per UTC day. Resets on server restart.
 */

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** @type {{ timestamp: number, tokens: number }[]} */
const entries = [];

function startOfTodayUTC() {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function trimOld() {
  const cutoff = startOfTodayUTC();
  while (entries.length > 0 && entries[0].timestamp < cutoff) {
    entries.shift();
  }
}

/**
 * Record one OpenAI API call.
 * @param {{ totalTokenCount?: number, total_tokens?: number } | null} usageMetadata
 */
export function recordOpenAIUsage(usageMetadata, meta = {}) {
  const timestamp = Date.now();
  const tokens = usageMetadata?.totalTokenCount ?? usageMetadata?.total_tokens ?? 0;
  entries.push({ timestamp, tokens, meta });
  trimOld();

  // Persist to MongoDB asynchronously (non-blocking).
  (async () => {
    try {
      const mod = await import('../models/OpenAIUsageLog.js');
      const OpenAIUsageLog = mod.OpenAIUsageLog || mod.default;
      if (OpenAIUsageLog && typeof OpenAIUsageLog.create === 'function') {
        OpenAIUsageLog.create({
          tokens,
          timestamp: new Date(timestamp),
          meta: meta || {},
        }).catch((err) => {
          // eslint-disable-next-line no-console
          console.warn('[OpenAIUsageLog] failed to write log', err && err.message ? err.message : err);
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[OpenAIUsageLog] import failed', err && err.message ? err.message : err);
    }
  })();
}

/**
 * @returns {{ requestsToday: number, tokensToday: number }}
 */
export function getOpenAIUsage() {
  trimOld();
  const dayStart = startOfTodayUTC();
  const todayEntries = entries.filter((e) => e.timestamp >= dayStart);
  return {
    requestsToday: todayEntries.length,
    tokensToday: todayEntries.reduce((s, e) => s + e.tokens, 0),
  };
}
