import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as rootExports from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function readJson(path) {
  return JSON.parse(readFileSync(resolve(ROOT, path), 'utf8'));
}

test('package exposes TypeScript declarations for public entrypoints', () => {
  const pkg = readJson('package.json');

  assert.equal(pkg.types, 'src/index.d.ts');
  assert.deepEqual(pkg.exports['.'], {
    types: './src/index.d.ts',
    import: './src/index.js',
    default: './src/index.js',
  });
  assert.deepEqual(pkg.exports['./content-hash'], {
    types: './src/contentHash.d.ts',
    import: './src/contentHash.js',
    default: './src/contentHash.js',
  });
  assert.deepEqual(pkg.exports['./capsule-evidence'], {
    types: './src/capsuleEvidence.d.ts',
    import: './src/capsuleEvidence.js',
    default: './src/capsuleEvidence.js',
  });
  assert.ok(pkg.files.includes('src'), 'src directory must be packed');

  for (const path of [
    'src/index.d.ts',
    'src/contentHash.d.ts',
    'src/protocolConstants.d.ts',
    'src/capsuleEvidence.d.ts',
  ]) {
    assert.equal(existsSync(resolve(ROOT, path)), true, `${path} must exist`);
  }
});

test('package version, SCHEMA_VERSION, .d.ts literal, spec, and root exports stay in lockstep', () => {
  const pkg = readJson('package.json');
  const contentHashDts = readFileSync(resolve(ROOT, 'src/contentHash.d.ts'), 'utf8');
  const indexDts = readFileSync(resolve(ROOT, 'src/index.d.ts'), 'utf8');
  const spec = readFileSync(resolve(ROOT, 'spec/gep-spec-v1.md'), 'utf8');

  assert.equal(pkg.version, '1.15.0');
  assert.equal(rootExports.SCHEMA_VERSION, pkg.version);
  assert.match(
    contentHashDts,
    new RegExp(`export const SCHEMA_VERSION: '${pkg.version.replace(/\./g, '\\.')}';`),
  );
  const specVersion = spec.match(/\*\*Schema Version:\*\*\s*([0-9]+\.[0-9]+\.[0-9]+)/);
  assert.ok(specVersion);
  assert.equal(specVersion[1], pkg.version);

  for (const schemaFile of readdirSync(resolve(ROOT, 'schemas'))) {
    assert.equal(pkg.exports[`./schemas/${schemaFile}`], `./schemas/${schemaFile}`);
  }
  assert.equal(pkg.exports['./spec/gep-spec-v1.md'], './spec/gep-spec-v1.md');

  for (const exportedSymbol of Object.keys(rootExports)) {
    assert.match(
      indexDts,
      new RegExp(`\\b${exportedSymbol}\\b`),
      `${exportedSymbol} must be re-exported in src/index.d.ts`,
    );
  }
});
