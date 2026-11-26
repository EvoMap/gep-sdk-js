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

export const GEP_GENE_CLAIM_KINDS: readonly [
  'behavioral',
  'structural',
  'performance',
  'safety',
];

export const GEP_GENE_RUNTIME_ENV_CLASSES: readonly [
  'ci',
  'local',
  'prod',
  'sandbox',
];

export const GEP_GENE_VERIFIER_DECISIONS: readonly [
  'pass',
  'fail',
  'inconclusive',
];

export declare const GEP_EVIDENCE_MODES: readonly ['reference_only'];

export declare const GEP_WORK_ORDER_TIERS: readonly ['light', 'standard', 'flagship'];

export declare const GEP_WORK_ORDER_FUNDING_MODES: readonly ['buyer_gateway_key', 'worker_byok'];

export declare const GEP_SWARM_HANDOFF_STAGES: readonly [
  'queued',
  'accepted',
  'handed_to_agent',
  'completed',
  'failed',
];

export declare const GEP_WORK_ORDER_TIER_FLOORS: Readonly<{
  light: Readonly<{ compute_min_credits: 25; labor_min_credits: 10; max_iterations: 12 }>;
  standard: Readonly<{ compute_min_credits: 120; labor_min_credits: 30; max_iterations: 24 }>;
  flagship: Readonly<{ compute_min_credits: 400; labor_min_credits: 80; max_iterations: 40 }>;
}>;
