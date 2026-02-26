/**
 * In-memory usage store for EaseGPT (Gemini chat on quiz page).
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
 * Record one EaseGPT Gemini API call.
 * @param {{ totalTokenCount?: number } | null} usageMetadata - from response.usageMetadata
 */
export function recordEaseGPTUsage(usageMetadata) {
  const timestamp = Date.now();
  const tokens = usageMetadata?.totalTokenCount ?? 0;
  entries.push({ timestamp, tokens });
  trimOld();
}

/**
 * @returns {{ requestsToday: number, tokensToday: number }}
 */
export function getEaseGPTUsage() {
  trimOld();
  const dayStart = startOfTodayUTC();
  const todayEntries = entries.filter((e) => e.timestamp >= dayStart);
  return {
    requestsToday: todayEntries.length,
    tokensToday: todayEntries.reduce((s, e) => s + e.tokens, 0),
  };
}
