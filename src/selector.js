import { scoreGene, matchPatternToSignals } from './gene.js';

export function selectGene(genes, signals, opts = {}) {
  const bannedGeneIds = opts.bannedGeneIds || new Set();
  const preferredGeneId = opts.preferredGeneId || null;
  const driftEnabled = !!opts.driftEnabled;

  const driftIntensity = computeDriftIntensity({
    driftEnabled,
    genePoolSize: genes?.length || 0,
  });
  const useDrift = driftEnabled || driftIntensity > 0.15;

  const scored = (genes || [])
    .map(g => {
      let s = scoreGene(g, signals);
      if (s > 0 && g.id?.startsWith('gene_distilled_')) s *= 0.8;
      return { gene: g, score: s };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return { selected: null, alternatives: [], driftIntensity };

  if (preferredGeneId) {
    const preferred = scored.find(x => x.gene?.id === preferredGeneId);
    if (preferred && (useDrift || !bannedGeneIds.has(preferredGeneId))) {
      const rest = scored.filter(x => x.gene?.id !== preferredGeneId);
      return { selected: preferred.gene, alternatives: rest.slice(0, 4).map(x => x.gene), driftIntensity };
    }
  }

  const filtered = useDrift ? scored : scored.filter(x => !bannedGeneIds.has(x.gene?.id));
  if (filtered.length === 0) return { selected: null, alternatives: scored.slice(0, 4).map(x => x.gene), driftIntensity };

  let selectedIdx = 0;
  if (driftIntensity > 0 && filtered.length > 1 && Math.random() < driftIntensity) {
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

export function selectGeneAndCapsule({ genes, capsules, signals, memoryAdvice, driftEnabled }) {
  const bannedGeneIds = memoryAdvice?.bannedGeneIds || new Set();
  const preferredGeneId = memoryAdvice?.preferredGeneId || null;

  const { selected, alternatives, driftIntensity } = selectGene(genes, signals, {
    bannedGeneIds, preferredGeneId, driftEnabled,
  });
  const capsule = selectCapsule(capsules, signals);

  return { selectedGene: selected, capsuleCandidates: capsule ? [capsule] : [], driftIntensity };
}

function computeDriftIntensity({ driftEnabled, genePoolSize }) {
  const ne = genePoolSize || 0;
  if (driftEnabled) return ne > 1 ? Math.min(1, 1 / Math.sqrt(ne) + 0.3) : 0.7;
  if (ne > 0) return Math.min(1, 1 / Math.sqrt(ne));
  return 0;
}
