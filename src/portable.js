import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { SCHEMA_VERSION } from './contentHash.js';

export function exportGepx({ assetsDir, memoryGraphPath, outputPath, agentId, agentName }) {
  const tmpDir = `${outputPath}.tmp`;
  mkdirSync(join(tmpDir, 'genes'), { recursive: true });
  mkdirSync(join(tmpDir, 'capsules'), { recursive: true });
  mkdirSync(join(tmpDir, 'events'), { recursive: true });
  mkdirSync(join(tmpDir, 'memory'), { recursive: true });
  mkdirSync(join(tmpDir, 'distiller'), { recursive: true });

  const filesToCopy = [
    { src: join(assetsDir, 'genes.json'), dest: join(tmpDir, 'genes', 'genes.json') },
    { src: join(assetsDir, 'genes.jsonl'), dest: join(tmpDir, 'genes', 'genes.jsonl') },
    { src: join(assetsDir, 'capsules.json'), dest: join(tmpDir, 'capsules', 'capsules.json') },
    { src: join(assetsDir, 'capsules.jsonl'), dest: join(tmpDir, 'capsules', 'capsules.jsonl') },
    { src: join(assetsDir, 'events.jsonl'), dest: join(tmpDir, 'events', 'events.jsonl') },
    { src: memoryGraphPath, dest: join(tmpDir, 'memory', 'memory_graph.jsonl') },
  ];

  const distillerLog = join(dirname(memoryGraphPath), 'distiller_log.jsonl');
  if (existsSync(distillerLog)) {
    filesToCopy.push({ src: distillerLog, dest: join(tmpDir, 'distiller', 'distiller_log.jsonl') });
  }

  const checksums = [];
  for (const f of filesToCopy) {
    if (!existsSync(f.src)) continue;
    const content = readFileSync(f.src);
    const destDir = dirname(f.dest);
    if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
    writeFileSync(f.dest, content);
    const hash = createHash('sha256').update(content).digest('hex');
    checksums.push(`${hash}  ${f.dest.replace(tmpDir + '/', '')}`);
  }

  const events = countJsonlLines(join(tmpDir, 'events', 'events.jsonl'));
  const genes = countJsonItems(join(tmpDir, 'genes', 'genes.json'), 'genes');
  const capsules = countJsonItems(join(tmpDir, 'capsules', 'capsules.json'), 'capsules');
  const memoryEntries = countJsonlLines(join(tmpDir, 'memory', 'memory_graph.jsonl'));

  const manifest = {
    gep_version: '1.0.0',
    schema_version: SCHEMA_VERSION,
    created_at: new Date().toISOString(),
    agent_id: agentId || null,
    agent_name: agentName || 'unknown',
    statistics: {
      total_events: events,
      total_genes: genes,
      total_capsules: capsules,
      memory_graph_entries: memoryEntries,
    },
    source: { platform: 'gep-sdk-js', version: '1.0.0' },
  };

  writeFileSync(join(tmpDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  writeFileSync(join(tmpDir, 'checksum.sha256'), checksums.join('\n') + '\n');

  execSync(`tar -czf "${outputPath}" -C "${dirname(tmpDir)}" "${tmpDir.split('/').pop()}"`, { timeout: 30000 });
  execSync(`rm -rf "${tmpDir}"`, { timeout: 5000 });

  return { outputPath, manifest };
}

export function importGepx({ gepxPath, assetsDir, memoryGraphPath, merge = true }) {
  const tmpDir = `${gepxPath}.extracted`;
  execSync(`mkdir -p "${tmpDir}" && tar -xzf "${gepxPath}" -C "${tmpDir}" --strip-components=1`, { timeout: 30000 });

  const manifestPath = join(tmpDir, 'manifest.json');
  if (!existsSync(manifestPath)) throw new Error('Invalid .gepx: missing manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  if (merge) {
    mergeJsonFile(join(tmpDir, 'genes', 'genes.json'), join(assetsDir, 'genes.json'), 'genes', 'id');
    mergeJsonFile(join(tmpDir, 'capsules', 'capsules.json'), join(assetsDir, 'capsules.json'), 'capsules', 'id');
    appendJsonlFile(join(tmpDir, 'events', 'events.jsonl'), join(assetsDir, 'events.jsonl'));
    appendJsonlFile(join(tmpDir, 'memory', 'memory_graph.jsonl'), memoryGraphPath);
  } else {
    const copies = [
      { src: join(tmpDir, 'genes', 'genes.json'), dest: join(assetsDir, 'genes.json') },
      { src: join(tmpDir, 'capsules', 'capsules.json'), dest: join(assetsDir, 'capsules.json') },
      { src: join(tmpDir, 'events', 'events.jsonl'), dest: join(assetsDir, 'events.jsonl') },
      { src: join(tmpDir, 'memory', 'memory_graph.jsonl'), dest: memoryGraphPath },
    ];
    for (const c of copies) {
      if (existsSync(c.src)) {
        mkdirSync(dirname(c.dest), { recursive: true });
        writeFileSync(c.dest, readFileSync(c.src));
      }
    }
  }

  execSync(`rm -rf "${tmpDir}"`, { timeout: 5000 });
  return { manifest, merged: merge };
}

function countJsonlLines(filePath) {
  if (!existsSync(filePath)) return 0;
  return readFileSync(filePath, 'utf8').split('\n').filter(l => l.trim()).length;
}

function countJsonItems(filePath, key) {
  if (!existsSync(filePath)) return 0;
  try {
    const data = JSON.parse(readFileSync(filePath, 'utf8'));
    return Array.isArray(data[key]) ? data[key].length : 0;
  } catch { return 0; }
}

function mergeJsonFile(srcPath, destPath, arrayKey, idKey) {
  if (!existsSync(srcPath)) return;
  const src = JSON.parse(readFileSync(srcPath, 'utf8'));
  const srcItems = Array.isArray(src[arrayKey]) ? src[arrayKey] : [];
  if (srcItems.length === 0) return;

  let dest = { version: 1, [arrayKey]: [] };
  if (existsSync(destPath)) {
    try { dest = JSON.parse(readFileSync(destPath, 'utf8')); } catch { /* ignore */ }
  }
  const destItems = Array.isArray(dest[arrayKey]) ? dest[arrayKey] : [];
  const existingIds = new Set(destItems.map(item => item[idKey]).filter(Boolean));

  for (const item of srcItems) {
    if (!existingIds.has(item[idKey])) {
      destItems.push(item);
      existingIds.add(item[idKey]);
    }
  }

  dest[arrayKey] = destItems;
  mkdirSync(dirname(destPath), { recursive: true });
  writeFileSync(destPath, JSON.stringify(dest, null, 2) + '\n');
}

function appendJsonlFile(srcPath, destPath) {
  if (!existsSync(srcPath)) return;
  const content = readFileSync(srcPath, 'utf8');
  if (!content.trim()) return;
  mkdirSync(dirname(destPath), { recursive: true });
  appendFileSync(destPath, content.endsWith('\n') ? content : content + '\n');
}
