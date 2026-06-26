export const GEP_GENE_CATEGORIES: readonly [
  'repair',
  'optimize',
  'innovate',
  'explore',
];

export const GEP_MUTATION_CATEGORIES: typeof GEP_GENE_CATEGORIES;

export const GEP_OUTCOME_STATUSES: readonly [
  'success',
  'failed',
];

export const GEP_SOURCE_TYPES: readonly [
  'generated',
  'reused',
  'reference',
  'user_authored',
];

export const GEP_RISK_LEVELS: readonly [
  'low',
  'medium',
  'high',
];

export const GEP_CAPSULE_VISIBILITIES: readonly [
  'private',
  'unlisted',
  'public',
];

export const GEP_CAPSULE_COST_TIERS: readonly [
  'cheap',
  'standard',
  'premium',
];

export const GEP_GENE_ROUTING_TIERS: readonly [
  'cheap',
  'mid',
  'expensive',
];

export const GEP_GENE_REASONING_LEVELS: readonly [
  'off',
  'low',
  'medium',
  'high',
];

export const GEP_GENE_TOOL_POLICY_SEVERITIES: readonly [
  'warn',
  'block',
];
