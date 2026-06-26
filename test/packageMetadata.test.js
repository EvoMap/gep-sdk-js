import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  assert.ok(pkg.files.includes('src'), 'src directory must be packed');

  for (const path of ['src/index.d.ts', 'src/contentHash.d.ts', 'src/protocolConstants.d.ts']) {
    assert.equal(existsSync(resolve(ROOT, path)), true, `${path} must exist`);
  }
});
