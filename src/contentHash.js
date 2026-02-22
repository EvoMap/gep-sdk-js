import { createHash } from 'node:crypto';

export const SCHEMA_VERSION = '1.5.0';

export function canonicalize(obj) {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj === 'boolean') return obj ? 'true' : 'false';
  if (typeof obj === 'number') {
    if (!Number.isFinite(obj)) return 'null';
    return String(obj);
  }
  if (typeof obj === 'string') return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalize).join(',') + ']';
  }
  if (typeof obj === 'object') {
    const keys = Object.keys(obj).sort();
    const pairs = keys.map(k => JSON.stringify(k) + ':' + canonicalize(obj[k]));
    return '{' + pairs.join(',') + '}';
  }
  return 'null';
}

export function computeAssetId(obj, excludeFields) {
  if (!obj || typeof obj !== 'object') return null;
  const exclude = new Set(Array.isArray(excludeFields) ? excludeFields : ['asset_id']);
  const clean = {};
  for (const k of Object.keys(obj)) {
    if (exclude.has(k)) continue;
    clean[k] = obj[k];
  }
  const canonical = canonicalize(clean);
  const hash = createHash('sha256').update(canonical, 'utf8').digest('hex');
  return 'sha256:' + hash;
}

export function verifyAssetId(obj) {
  if (!obj || typeof obj !== 'object') return false;
  const claimed = obj.asset_id;
  if (!claimed || typeof claimed !== 'string') return false;
  return claimed === computeAssetId(obj);
}
