import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { classifyCapsuleEvidence, REFERENCE_ONLY_EVIDENCE_MODE } from '../src/index.js';

const schema = JSON.parse(readFileSync(new URL('../schemas/capsule.schema.json', import.meta.url)));
const spec = readFileSync(new URL('../spec/gep-spec-v1.md', import.meta.url), 'utf8');
function capsule(overrides = {}) {
  const text = '引用资料：你好';
  return {
    evidence_mode: REFERENCE_ONLY_EVIDENCE_MODE,
    source_type: 'reference',
    blast_radius: { files: 0, lines: 0 }, execution_trace: [], diff: null,
    content: { text, mime: 'text/plain' }, proof_of_work: { kind: 'artifact_hash', artifact_hash: {
      sha256: createHash('sha256').update(text, 'utf8').digest('hex'), mime: 'text/plain', size: Buffer.byteLength(text, 'utf8'),
    } }, ...overrides,
  };
}

test('reference-only valid UTF-8 Capsule', () => {
  const result = classifyCapsuleEvidence(capsule());
  assert.deepEqual(result, { valid: true, mode: 'reference_only', reason: null, reasons: [] });
});
test('omitted evidence_mode preserves legacy classification', () => {
  assert.equal(classifyCapsuleEvidence({}).valid, true);
  assert.equal(classifyCapsuleEvidence({}).mode, 'legacy');
});
[
  ['wrong source', { source_type: 'generated' }, 'source_type_must_be_reference'],
  ['nonzero files', { blast_radius: { files: 1, lines: 0 } }, 'blast_radius_must_be_zero'],
  ['extra blast key', { blast_radius: { files: 0, lines: 0, commands: 0 } }, 'blast_radius_must_be_zero'],
  ['trace entry', { execution_trace: [{ stage: 'validate' }] }, 'execution_trace_must_be_empty'],
  ['diff object', { diff: {} }, 'diff_must_be_absent_or_null'],
  ['empty text', { content: { text: '', mime: 'text/plain' } }, 'content_text_must_be_non_empty'],
  ['whitespace text', { content: { text: '  \n', mime: 'text/plain' } }, 'content_text_must_be_non_empty'],
  ['content mime', { content: { text: '引用资料：你好', mime: 'text/html' } }, 'content_mime_must_be_text_plain'],
  ['wrong proof kind', { proof_of_work: { kind: 'git_diff' } }, 'proof_of_work_must_be_artifact_hash'],
  ['proof mime mismatch', { proof_of_work: { kind: 'artifact_hash', artifact_hash: { sha256: createHash('sha256').update('引用资料：你好').digest('hex'), mime: 'text/html', size: 21 } } }, 'artifact_mime_mismatch'],
  ['uppercase hash', { proof_of_work: { kind: 'artifact_hash', artifact_hash: { sha256: 'A'.repeat(64), mime: 'text/plain', size: 21 } } }, 'artifact_sha256_must_be_lowercase_hex'],
  ['wrong hash', { proof_of_work: { kind: 'artifact_hash', artifact_hash: { sha256: '0'.repeat(64), mime: 'text/plain', size: 21 } } }, 'artifact_sha256_mismatch'],
  ['wrong byte size', { proof_of_work: { kind: 'artifact_hash', artifact_hash: { sha256: createHash('sha256').update('引用资料：你好').digest('hex'), mime: 'text/plain', size: 1 } } }, 'artifact_size_mismatch'],
].forEach(([name, overrides, code]) => test(`rejects ${name} with structured reason`, () => {
  const result = classifyCapsuleEvidence(capsule(overrides));
  assert.equal(result.valid, false); assert.equal(result.reason.code, code); assert.ok(result.reason.path);
}));
test('reference-only schema and specification encode non-execution and text integrity invariants', () => {
  const contract = schema.allOf.find(rule => rule.if?.properties?.evidence_mode?.const === 'reference_only')?.then;
  assert.ok(contract);
  assert.equal(contract.properties.blast_radius.properties.files.const, 0);
  assert.equal(contract.properties.blast_radius.properties.lines.const, 0);
  assert.equal(contract.properties.execution_trace.maxItems, 0);
  assert.equal(contract.properties.diff.const, null);
  assert.equal(contract.properties.content.properties.mime.const, 'text/plain');
  assert.equal(contract.properties.content.properties.text.pattern, '\\S');
  assert.equal(contract.properties.proof_of_work.properties.kind.const, 'artifact_hash');
  assert.equal(contract.properties.proof_of_work.properties.artifact_hash.properties.size.minimum, 1);
  assert.match(spec, /`content\.mime` MUST be `"text\/plain"`/);
  assert.match(spec, /`artifact_hash\.mime` MUST be `"text\/plain"` and equal `content\.mime`/);
});

test('invalid input is structured', () => {
  const result = classifyCapsuleEvidence(null);
  assert.equal(result.reason.code, 'invalid_capsule');
});
