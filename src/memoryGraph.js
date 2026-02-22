import { readFileSync, appendFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export class MemoryGraph {
  constructor(filePath) {
    this.filePath = filePath;
    const dir = dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  readEvents(limit = 2000) {
    try {
      if (!existsSync(this.filePath)) return [];
      const raw = readFileSync(this.filePath, 'utf8');
      const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
      return lines.slice(Math.max(0, lines.length - limit)).map(l => {
        try { return JSON.parse(l); } catch { return null; }
      }).filter(Boolean);
    } catch { return []; }
  }

  append(event) {
    appendFileSync(this.filePath, JSON.stringify(event) + '\n', 'utf8');
  }

  recordSignal({ signals, observations }) {
    const ev = {
      type: 'MemoryGraphEvent',
      kind: 'signal',
      id: `mge_${Date.now()}_${stableHash(signals.join('|'))}`,
      ts: new Date().toISOString(),
      signal: {
        key: computeSignalKey(signals),
        signals: Array.isArray(signals) ? signals : [],
      },
      observed: observations || null,
    };
    this.append(ev);
    return ev;
  }

  recordOutcome({ signalKey, geneId, geneCategory, outcome }) {
    const ev = {
      type: 'MemoryGraphEvent',
      kind: 'outcome',
      id: `mge_${Date.now()}_${stableHash(`${signalKey}|${geneId}|outcome`)}`,
      ts: new Date().toISOString(),
      signal: { key: signalKey },
      gene: { id: geneId, category: geneCategory },
      outcome: {
        status: outcome.status,
        score: clamp01(outcome.score),
        note: outcome.note || null,
      },
    };
    this.append(ev);
    return ev;
  }

  getAdvice({ signals, genes }) {
    const events = this.readEvents(2000);
    const edges = aggregateEdges(events);
    const curKey = computeSignalKey(signals);

    const bannedGeneIds = new Set();
    const scoredGeneIds = [];

    for (const g of genes || []) {
      if (!g || g.type !== 'Gene' || !g.id) continue;
      const k = `${curKey}::${g.id}`;
      const edge = edges.get(k);
      if (edge) {
        const ex = expectedSuccess(edge);
        scoredGeneIds.push({ geneId: g.id, score: ex.value, attempts: ex.total });
        if (ex.total >= 2 && ex.value < 0.18) bannedGeneIds.add(g.id);
      }
    }

    scoredGeneIds.sort((a, b) => b.score - a.score);
    return {
      currentSignalKey: curKey,
      preferredGeneId: scoredGeneIds.length > 0 ? scoredGeneIds[0].geneId : null,
      bannedGeneIds,
    };
  }
}

function computeSignalKey(signals) {
  return [...new Set((signals || []).map(String).filter(Boolean))].sort().join('|') || '(none)';
}

function stableHash(input) {
  const s = String(input || '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function aggregateEdges(events) {
  const map = new Map();
  for (const ev of events) {
    if (!ev || ev.type !== 'MemoryGraphEvent' || ev.kind !== 'outcome') continue;
    const signalKey = ev.signal?.key || '(none)';
    const geneId = ev.gene?.id;
    if (!geneId) continue;
    const k = `${signalKey}::${geneId}`;
    const cur = map.get(k) || { success: 0, fail: 0, last_ts: null };
    if (ev.outcome?.status === 'success') cur.success++;
    else if (ev.outcome?.status === 'failed') cur.fail++;
    const ts = ev.ts;
    if (ts && (!cur.last_ts || Date.parse(ts) > Date.parse(cur.last_ts))) cur.last_ts = ts;
    map.set(k, cur);
  }
  return map;
}

function expectedSuccess(edge) {
  const succ = edge.success || 0;
  const fail = edge.fail || 0;
  const total = succ + fail;
  const p = (succ + 1) / (total + 2);
  const ageDays = edge.last_ts ? (Date.now() - Date.parse(edge.last_ts)) / 86400000 : 0;
  const w = Math.pow(0.5, ageDays / 30);
  return { p, w, total, value: p * w };
}

function clamp01(x) {
  const n = Number(x);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}

export { computeSignalKey, stableHash };
