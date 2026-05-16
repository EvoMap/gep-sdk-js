import { createHash } from 'node:crypto';

// Bump MINOR for additive fields; MAJOR for breaking changes. The current
// value MUST stay in lockstep with `schemas/*.schema.json` and
// `spec/gep-spec-v1.md` shipped in this package — that is exactly what
// downstream implementations (evolver, gep-mcp-server, evox-Rust)
// consume to detect protocol drift.
export const SCHEMA_VERSION = '1.6.0';

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
