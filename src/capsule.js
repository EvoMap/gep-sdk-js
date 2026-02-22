import { SCHEMA_VERSION, computeAssetId } from './contentHash.js';

export function createCapsule({ trigger, gene, summary, confidence, blastRadius, outcome, envFingerprint }) {
  const capsule = {
    type: 'Capsule',
    schema_version: SCHEMA_VERSION,
    id: `capsule_${Date.now()}`,
    trigger: Array.isArray(trigger) ? trigger : [],
    gene: String(gene),
    summary: String(summary),
    confidence: clamp01(confidence),
    blast_radius: {
      files: blastRadius?.files || 0,
      lines: blastRadius?.lines || 0,
    },
    outcome: {
      status: outcome?.status === 'success' ? 'success' : 'failed',
      score: clamp01(outcome?.score),
    },
    success_streak: 1,
    env_fingerprint: envFingerprint || null,
    a2a: { eligible_to_broadcast: false },
  };
  capsule.asset_id = computeAssetId(capsule);
  return capsule;
}

export function validateCapsule(capsule) {
  const errors = [];
  if (!capsule || typeof capsule !== 'object') return { valid: false, errors: ['Capsule must be an object'] };
  if (capsule.type !== 'Capsule') errors.push('type must be "Capsule"');
  if (!capsule.id) errors.push('Missing id');
  if (!Array.isArray(capsule.trigger) || capsule.trigger.length === 0) errors.push('trigger must be a non-empty array');
  if (!capsule.gene) errors.push('Missing gene');
  if (!capsule.summary) errors.push('Missing summary');
  if (typeof capsule.confidence !== 'number') errors.push('confidence must be a number');
  if (!capsule.outcome || !capsule.outcome.status) errors.push('Missing outcome.status');
  return { valid: errors.length === 0, errors };
}

function clamp01(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
