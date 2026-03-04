/**
 * In-memory usage store for Gemini API keys (bulk MCQ parsing).
 * Tracks RPM, TPM, RPD per key. Resets on server restart.
 * Limits: Gemini 2.5 Flash Lite — 10 RPM, 250K TPM, 20 RPD per key.
 */

const RPM_LIMIT = 10;
const TPM_LIMIT = 250000;
const RPD_LIMIT = 20;

const NUM_KEYS = 3;
const ONE_MINUTE_MS = 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** @type {{ keyIndex: number, timestamp: number, tokens: number }[]} */
const entries = [];

function trimOld() {
  const cutoff = Date.now() - ONE_DAY_MS;
  while (entries.length > 0 && entries[0].timestamp < cutoff) {
    entries.shift();
  }
}

/**
 * Record one Gemini API call for a key.
 * @param {number} keyIndex - 0, 1, or 2
 * @param {{ totalTokenCount?: number } | null} usageMetadata - from response.usageMetadata
 * @param {object} [meta] - additional metadata to store (e.g., { source: 'easegpt' })
 */
export function recordGeminiUsage(keyIndex, usageMetadata, meta = {}) {
  const timestamp = Date.now();
  const tokens = usageMetadata?.totalTokenCount ?? 0;
  // keep meta in-memory as well for richer introspection if needed
  entries.push({ keyIndex: Math.max(0, Math.min(2, keyIndex)), timestamp, tokens, meta });
  trimOld();

  // Persist to MongoDB asynchronously (non-blocking).
  // Dynamic import so this module doesn't require DB during startup.
  (async () => {
    try {
      const mod = await import('../models/GeminiUsageLog.js');
      const GeminiUsageLog = mod.GeminiUsageLog || mod.default;
      if (GeminiUsageLog && typeof GeminiUsageLog.create === 'function') {
        GeminiUsageLog.create({
          keyIndex: Math.max(0, Math.min(2, keyIndex)),
          tokens,
          timestamp: new Date(timestamp),
          meta: meta || {},
        }).catch((err) => {
          // Don't throw — just log and continue
          // eslint-disable-next-line no-console
          console.warn('[GeminiUsageLog] failed to write log', err && err.message ? err.message : err);
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[GeminiUsageLog] import failed', err && err.message ? err.message : err);
    }
  })();
}

/**
 * Start of current UTC calendar day.
 */
function startOfTodayUTC() {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * @returns {{ keys: Array<{ keyIndex: number, label: string, rpm: number, tpm: number, rpd: number, limits: { rpm: number, tpm: number, rpd: number }, exhausted: boolean, exhaustedReasons: string[] }>, totals: { requestsToday: number, tokensToday: number } }}
 */
export function getGeminiUsage() {
  trimOld();
  const now = Date.now();
  const oneMinuteAgo = now - ONE_MINUTE_MS;
  const dayStart = startOfTodayUTC();

  const keys = [];
  let totalRequestsToday = 0;
  let totalTokensToday = 0;

  for (let keyIndex = 0; keyIndex < NUM_KEYS; keyIndex++) {
    const keyEntries = entries.filter((e) => e.keyIndex === keyIndex);
    const inLastMinute = keyEntries.filter((e) => e.timestamp >= oneMinuteAgo);
    const todayEntries = keyEntries.filter((e) => e.timestamp >= dayStart);

    const rpm = inLastMinute.length;
    const tpm = inLastMinute.reduce((s, e) => s + e.tokens, 0);
    const rpd = todayEntries.length;
    const tokensToday = todayEntries.reduce((s, e) => s + e.tokens, 0);

    totalRequestsToday += rpd;
    totalTokensToday += tokensToday;

    const exhaustedReasons = [];
    if (rpm >= RPM_LIMIT) exhaustedReasons.push('RPM');
    if (tpm >= TPM_LIMIT) exhaustedReasons.push('TPM');
    if (rpd >= RPD_LIMIT) exhaustedReasons.push('RPD');
    const exhausted = exhaustedReasons.length > 0;

    keys.push({
      keyIndex,
      label: `Key ${keyIndex + 1}`,
      rpm,
      tpm,
      rpd,
      tokensToday,
      limits: { rpm: RPM_LIMIT, tpm: TPM_LIMIT, rpd: RPD_LIMIT },
      exhausted,
      exhaustedReasons,
    });
  }

  return {
    keys,
    totals: { requestsToday: totalRequestsToday, tokensToday: totalTokensToday },
  };
}
