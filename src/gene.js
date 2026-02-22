import { SCHEMA_VERSION, computeAssetId } from './contentHash.js';

const REQUIRED_FIELDS = ['id', 'category', 'signals_match', 'strategy', 'constraints', 'validation'];
const VALID_CATEGORIES = ['repair', 'optimize', 'innovate'];

export function validateGene(gene) {
  const errors = [];
  if (!gene || typeof gene !== 'object') return { valid: false, errors: ['Gene must be an object'] };
  if (gene.type !== 'Gene') errors.push('type must be "Gene"');
  for (const f of REQUIRED_FIELDS) {
    if (gene[f] === undefined || gene[f] === null) errors.push(`Missing required field: ${f}`);
  }
  if (gene.category && !VALID_CATEGORIES.includes(gene.category)) {
    errors.push(`category must be one of: ${VALID_CATEGORIES.join(', ')}`);
  }
  if (gene.signals_match && (!Array.isArray(gene.signals_match) || gene.signals_match.length === 0)) {
    errors.push('signals_match must be a non-empty array');
  }
  if (gene.strategy && (!Array.isArray(gene.strategy) || gene.strategy.length === 0)) {
    errors.push('strategy must be a non-empty array of actionable steps');
  }
  if (gene.constraints) {
    if (typeof gene.constraints.max_files !== 'number' || gene.constraints.max_files < 1) {
      errors.push('constraints.max_files must be a positive integer');
    }
    if (!Array.isArray(gene.constraints.forbidden_paths) || gene.constraints.forbidden_paths.length === 0) {
      errors.push('constraints.forbidden_paths must be a non-empty array');
    }
  }
  if (gene.validation && (!Array.isArray(gene.validation) || gene.validation.length === 0)) {
    errors.push('validation must be a non-empty array');
  }
  return { valid: errors.length === 0, errors };
}

export function createGene({ id, category, signals_match, preconditions, strategy, constraints, validation }) {
  const gene = {
    type: 'Gene',
    schema_version: SCHEMA_VERSION,
    id,
    category,
    signals_match,
    preconditions: preconditions || [],
    strategy,
    constraints: {
      max_files: constraints?.max_files || 12,
      forbidden_paths: constraints?.forbidden_paths || ['.git', 'node_modules'],
    },
    validation,
    epigenetic_marks: [],
  };
  gene.asset_id = computeAssetId(gene);
  const result = validateGene(gene);
  if (!result.valid) throw new Error(`Invalid gene: ${result.errors.join('; ')}`);
  return gene;
}

export function matchPatternToSignals(pattern, signals) {
  if (!pattern || !signals || signals.length === 0) return false;
  const p = String(pattern);
  const sig = signals.map(s => String(s));
  if (p.length >= 2 && p.startsWith('/') && p.lastIndexOf('/') > 0) {
    const lastSlash = p.lastIndexOf('/');
    const body = p.slice(1, lastSlash);
    const flags = p.slice(lastSlash + 1);
    try {
      const re = new RegExp(body, flags || 'i');
      return sig.some(s => re.test(s));
    } catch { /* fallback */ }
  }
  const needle = p.toLowerCase();
  return sig.some(s => s.toLowerCase().includes(needle));
}

export function scoreGene(gene, signals) {
  if (!gene || gene.type !== 'Gene') return 0;
  const patterns = Array.isArray(gene.signals_match) ? gene.signals_match : [];
  let score = 0;
  for (const pat of patterns) {
    if (matchPatternToSignals(pat, signals)) score += 1;
  }
  return score;
}
