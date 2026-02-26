/**
 * In-memory rate limit for EaseGPT: max 5 AI queries per (userId, mcqId).
 * Keys expire after TTL to avoid unbounded growth.
 */

const MAX_QUERIES_PER_MCQ = 5;
const TTL_MS = 60 * 60 * 1000; // 1 hour

/** @type {Map<string, { count: number; expiresAt: number }>} */
const store = new Map();

function key(userId, mcqId) {
  return `${String(userId)}:${String(mcqId)}`;
}

function trimExpired() {
  const now = Date.now();
  for (const [k, v] of store.entries()) {
    if (v.expiresAt <= now) store.delete(k);
  }
}

/**
 * Check if the user can make another EaseGPT request for this MCQ.
 * If allowed, increments the count and returns { allowed: true, remaining }.
 * If not allowed, returns { allowed: false, remaining: 0 }.
 * @param {string} userId
 * @param {string} mcqId
 * @returns {{ allowed: boolean; remaining: number }}
 */
export function checkAndIncrement(userId, mcqId) {
  trimExpired();
  const k = key(userId, mcqId);
  const now = Date.now();
  let entry = store.get(k);
  if (!entry) {
    entry = { count: 0, expiresAt: now + TTL_MS };
    store.set(k, entry);
  }
  if (entry.expiresAt <= now) {
    entry.count = 0;
    entry.expiresAt = now + TTL_MS;
  }
  const remaining = Math.max(0, MAX_QUERIES_PER_MCQ - entry.count);
  if (remaining <= 0) {
    return { allowed: false, remaining: 0 };
  }
  entry.count += 1;
  return { allowed: true, remaining: remaining - 1 };
}

/**
 * Get remaining queries for this user+mcqId without incrementing.
 * @param {string} userId
 * @param {string} mcqId
 * @returns {number}
 */
export function getRemaining(userId, mcqId) {
  trimExpired();
  const k = key(userId, mcqId);
  const entry = store.get(k);
  if (!entry || entry.expiresAt <= Date.now()) return MAX_QUERIES_PER_MCQ;
  return Math.max(0, MAX_QUERIES_PER_MCQ - entry.count);
}

/**
 * Decrement count (refund) when we didn't actually add a new cache entry (e.g. duplicate key).
 * @param {string} userId
 * @param {string} mcqId
 */
export function decrement(userId, mcqId) {
  trimExpired();
  const k = key(userId, mcqId);
  const entry = store.get(k);
  if (!entry || entry.expiresAt <= Date.now()) return;
  if (entry.count > 0) entry.count -= 1;
}
