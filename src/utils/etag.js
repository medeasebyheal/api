import crypto from 'crypto';

export function makeEtagFromString(s) {
  return '"' + crypto.createHash('sha256').update(String(s)).digest('hex') + '"';
}

export function maxUpdatedAtIso(items = []) {
  let max = 0;
  items.forEach((it) => {
    if (!it) return;
    const t = new Date(it.updatedAt || it.createdAt || 0).getTime();
    if (t > max) max = t;
  });
  return max === 0 ? '' : new Date(max).toISOString();
}

