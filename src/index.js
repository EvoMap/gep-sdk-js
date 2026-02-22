export { SCHEMA_VERSION, canonicalize, computeAssetId, verifyAssetId } from './contentHash.js';
export { createGene, validateGene, scoreGene, matchPatternToSignals } from './gene.js';
export { createCapsule, validateCapsule } from './capsule.js';
export { buildMutation, validateMutation } from './mutation.js';
export { extractSignals, hasOpportunitySignal, analyzeRecentHistory, OPPORTUNITY_SIGNALS } from './signals.js';
export { selectGene, selectCapsule, selectGeneAndCapsule } from './selector.js';
export { MemoryGraph, computeSignalKey } from './memoryGraph.js';
export { AssetStore } from './assetStore.js';
export { exportGepx, importGepx } from './portable.js';
