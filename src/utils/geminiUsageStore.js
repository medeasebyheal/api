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
 */
export function recordGeminiUsage(keyIndex, usageMetadata) {
  const timestamp = Date.now();
  const tokens = usageMetadata?.totalTokenCount ?? 0;
  entries.push({ keyIndex: Math.max(0, Math.min(2, keyIndex)), timestamp, tokens });
  trimOld();
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
