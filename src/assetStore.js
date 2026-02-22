import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { SCHEMA_VERSION, computeAssetId } from './contentHash.js';

export class AssetStore {
  constructor(assetsDir) {
    this.dir = assetsDir;
    if (!existsSync(assetsDir)) mkdirSync(assetsDir, { recursive: true });
  }

  genesPath() { return join(this.dir, 'genes.json'); }
  capsulesPath() { return join(this.dir, 'capsules.json'); }
  eventsPath() { return join(this.dir, 'events.jsonl'); }

  loadGenes() {
    const data = readJsonSafe(this.genesPath(), { version: 1, genes: [] });
    return Array.isArray(data.genes) ? data.genes : [];
  }

  loadCapsules() {
    const data = readJsonSafe(this.capsulesPath(), { version: 1, capsules: [] });
    return Array.isArray(data.capsules) ? data.capsules : [];
  }

  readAllEvents() {
    return readJsonl(this.eventsPath());
  }

  getLastEventId() {
    const events = this.readAllEvents();
    return events.length > 0 ? events[events.length - 1].id : null;
  }

  upsertGene(gene) {
    ensureSchemaFields(gene);
    const data = readJsonSafe(this.genesPath(), { version: 1, genes: [] });
    const genes = Array.isArray(data.genes) ? data.genes : [];
    const idx = genes.findIndex(g => g?.id === gene.id);
    if (idx >= 0) genes[idx] = gene; else genes.push(gene);
    writeJsonAtomic(this.genesPath(), { version: data.version || 1, genes });
  }

  upsertCapsule(capsule) {
    ensureSchemaFields(capsule);
    const data = readJsonSafe(this.capsulesPath(), { version: 1, capsules: [] });
    const capsules = Array.isArray(data.capsules) ? data.capsules : [];
    const idx = capsules.findIndex(c => c?.id === capsule.id);
    if (idx >= 0) capsules[idx] = capsule; else capsules.push(capsule);
    writeJsonAtomic(this.capsulesPath(), { version: data.version || 1, capsules });
  }

  appendEvent(event) {
    ensureSchemaFields(event);
    const dir = dirname(this.eventsPath());
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    appendFileSync(this.eventsPath(), JSON.stringify(event) + '\n', 'utf8');
  }

  ensureFiles() {
    const files = [
      { path: this.genesPath(), default: JSON.stringify({ version: 1, genes: [] }, null, 2) + '\n' },
      { path: this.capsulesPath(), default: JSON.stringify({ version: 1, capsules: [] }, null, 2) + '\n' },
      { path: this.eventsPath(), default: '' },
    ];
    for (const f of files) {
      if (!existsSync(f.path)) {
        try { writeFileSync(f.path, f.default, 'utf8'); } catch { /* ignore */ }
      }
    }
  }
}

function readJsonSafe(filePath, fallback) {
  try {
    if (!existsSync(filePath)) return fallback;
    const raw = readFileSync(filePath, 'utf8');
    return raw.trim() ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function readJsonl(filePath) {
  try {
    if (!existsSync(filePath)) return [];
    const raw = readFileSync(filePath, 'utf8');
    return raw.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);
  } catch { return []; }
}

function writeJsonAtomic(filePath, obj) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.tmp`;
  writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  renameSync(tmp, filePath);
}

function ensureSchemaFields(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (!obj.schema_version) obj.schema_version = SCHEMA_VERSION;
  if (!obj.asset_id) { try { obj.asset_id = computeAssetId(obj); } catch { /* ignore */ } }
  return obj;
}
