import { scoreGene, matchPatternToSignals } from './gene.js';

const DISTILLED_PREFIX = 'gene_distilled_';
const DISTILLED_SCORE_FACTOR = 0.8;

// Soft multiplier for memory-preferred genes. Replaces the v1.0.x hard
// override (which forced the preferred gene unconditionally and produced a
// negative-feedback loop where a globally popular gene was selected for
// every scenario regardless of pattern fit).
const MEMORY_PREFERENCE_MULTIPLIER = 1.5;

export function selectGene(genes, signals, opts = {}) {
  const bannedGeneIds = opts.bannedGeneIds || new Set();
  const preferredGeneId = opts.preferredGeneId || null;
  const driftEnabled = !!opts.driftEnabled;

  const driftIntensity = computeDriftIntensity({
    driftEnabled,
    genePoolSize: genes?.length || 0,
  });
  const useDrift = driftEnabled || driftIntensity > 0.15;

  let scored = (genes || [])
    .map(g => {
      let s = scoreGene(g, signals);
      if (s > 0 && g.id?.startsWith(DISTILLED_PREFIX)) s *= DISTILLED_SCORE_FACTOR;
      return { gene: g, score: s };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return { selected: null, alternatives: [], driftIntensity };

  // Memory preference applied as a score boost rather than a hard override.
  // Banned genes are filtered out below regardless, so we don't boost a
  // preferred gene that is already on the ban list.
  if (preferredGeneId && !bannedGeneIds.has(preferredGeneId)) {
    const idx = scored.findIndex(x => x.gene?.id === preferredGeneId);
    if (idx >= 0) {
      scored[idx] = { ...scored[idx], score: scored[idx].score * MEMORY_PREFERENCE_MULTIPLIER };
      scored.sort((a, b) => b.score - a.score);
    }
  }

  // Hard suppression: bannedGeneIds applies in all modes including drift.
  // The previous v1.0.x branch (`useDrift ? scored : ...`) was a self-defeating
  // loop: repeated failure → plateau → drift on → ban bypassed → same failed
  // gene re-selected. Drift exists to explore new combinations, not to
  // resurrect proven failures.
  const filtered = scored.filter(x => x.gene && !bannedGeneIds.has(x.gene.id));
  if (filtered.length === 0) return { selected: null, alternatives: scored.slice(0, 4).map(x => x.gene), driftIntensity };

  // Random drift jitter is gated by useDrift (not driftIntensity > 0). In
  // v1.0.x the looser gate produced ~14% jitter on small pools even when
  // drift was disabled. Pure exploitation now requires useDrift = false.
  let selectedIdx = 0;
  if (useDrift && driftIntensity > 0 && filtered.length > 1 && Math.random() < driftIntensity) {
    const topN = Math.min(filtered.length, Math.max(2, Math.ceil(filtered.length * driftIntensity)));
    selectedIdx = Math.floor(Math.random() * topN);
  }

  return {
    selected: filtered[selectedIdx].gene,
    alternatives: filtered.filter((_, i) => i !== selectedIdx).slice(0, 4).map(x => x.gene),
    driftIntensity,
  };
}

export function selectCapsule(capsules, signals) {
  const scored = (capsules || [])
    .map(c => {
      const triggers = Array.isArray(c.trigger) ? c.trigger : [];
      const score = triggers.reduce((acc, t) => matchPatternToSignals(t, signals) ? acc + 1 : acc, 0);
      return { capsule: c, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.length > 0 ? scored[0].capsule : null;
}

export function selectGeneAndCapsule({
  genes,
  capsules,
  signals,
  memoryAdvice,
  driftEnabled,
  failedCapsules,
}) {
  const baseBans = memoryAdvice?.bannedGeneIds instanceof Set
    ? memoryAdvice.bannedGeneIds
    : new Set();
  const preferredGeneId = memoryAdvice?.preferredGeneId || null;

  const effectiveBans = banGenesFromFailedCapsules(
    Array.isArray(failedCapsules) ? failedCapsules : [],
    signals,
    baseBans,
  );

  const { selected, alternatives, driftIntensity } = selectGene(genes, signals, {
    bannedGeneIds: effectiveBans,
    preferredGeneId,
    driftEnabled,
  });
  const capsule = selectCapsule(capsules, signals);

  return { selectedGene: selected, capsuleCandidates: capsule ? [capsule] : [], driftIntensity };
}

// Failure-driven ban derivation. When a capsule fails, the genes it relied
// on are candidates for banning -- but only when the failure context
// overlaps the current signal set (so a Windows-only failure does not ban
// the gene on Linux). Genes are added to the ban set after they accumulate
// FAILED_CAPSULE_BAN_THRESHOLD overlapping failures.
const FAILED_CAPSULE_BAN_THRESHOLD = 2;
const FAILED_CAPSULE_OVERLAP_MIN = 0.6;

export function banGenesFromFailedCapsules(failedCapsules, signals, existingBans) {
  const bans = existingBans instanceof Set ? new Set(existingBans) : new Set();
  if (!Array.isArray(failedCapsules) || failedCapsules.length === 0) return bans;

  const counts = {};
  for (const fc of failedCapsules) {
    if (!fc || !fc.gene) continue;
    if (computeSignalOverlap(signals, fc.trigger || []) < FAILED_CAPSULE_OVERLAP_MIN) continue;
    const gid = String(fc.gene);
    counts[gid] = (counts[gid] || 0) + 1;
  }
  for (const [gid, n] of Object.entries(counts)) {
    if (n >= FAILED_CAPSULE_BAN_THRESHOLD) bans.add(gid);
  }
  return bans;
}

export function computeSignalOverlap(signalsA, signalsB) {
  if (!Array.isArray(signalsA) || !Array.isArray(signalsB)) return 0;
  if (signalsA.length === 0 || signalsB.length === 0) return 0;
  const setB = new Set(signalsB.map(s => String(s).toLowerCase()));
  let hits = 0;
  for (const s of signalsA) {
    if (setB.has(String(s).toLowerCase())) hits++;
  }
  return hits / Math.max(signalsA.length, 1);
}

function computeDriftIntensity({ driftEnabled, genePoolSize }) {
  const ne = genePoolSize || 0;
  if (driftEnabled) return ne > 1 ? Math.min(1, 1 / Math.sqrt(ne) + 0.3) : 0.7;
  if (ne > 0) return Math.min(1, 1 / Math.sqrt(ne));
  return 0;
}
