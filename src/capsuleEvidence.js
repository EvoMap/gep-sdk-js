// Copyright 2024-2026 EvoMap
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { createHash } from 'node:crypto';

export const REFERENCE_ONLY_EVIDENCE_MODE = 'reference_only';

function failure(code, path, expected, actual) {
  return { code, path, expected, actual };
}

/**
 * Classify and validate the non-execution Capsule evidence contract.
 * Legacy Capsules (without evidence_mode) remain valid and are classified as
 * legacy; reference_only Capsules are checked independently of JSON Schema.
 */
export function classifyCapsuleEvidence(capsule) {
  if (!capsule || typeof capsule !== 'object' || Array.isArray(capsule)) {
    const reason = failure('invalid_capsule', '', 'object', typeof capsule);
    return { valid: false, mode: 'invalid', reason, reasons: [reason] };
  }
  if (capsule.evidence_mode === undefined) {
    return { valid: true, mode: 'legacy', reason: null, reasons: [] };
  }
  if (capsule.evidence_mode !== REFERENCE_ONLY_EVIDENCE_MODE) {
    const reason = failure('unsupported_evidence_mode', 'evidence_mode', REFERENCE_ONLY_EVIDENCE_MODE, capsule.evidence_mode);
    return { valid: false, mode: 'invalid', reason, reasons: [reason] };
  }

  const checks = [];
  if (capsule.source_type !== 'reference') {
    checks.push(failure('source_type_must_be_reference', 'source_type', 'reference', capsule.source_type));
  }
  if (!capsule.blast_radius || typeof capsule.blast_radius !== 'object' ||
      capsule.blast_radius.files !== 0 || capsule.blast_radius.lines !== 0 ||
      Object.keys(capsule.blast_radius).some(key => !['files', 'lines'].includes(key))) {
    checks.push(failure('blast_radius_must_be_zero', 'blast_radius', { files: 0, lines: 0 }, capsule.blast_radius));
  }
  if (!Array.isArray(capsule.execution_trace) || capsule.execution_trace.length !== 0) {
    checks.push(failure('execution_trace_must_be_empty', 'execution_trace', [], capsule.execution_trace));
  }
  if (capsule.diff !== undefined && capsule.diff !== null) {
    checks.push(failure('diff_must_be_absent_or_null', 'diff', null, capsule.diff));
  }
  if (!capsule.content || typeof capsule.content !== 'object' ||
      typeof capsule.content.text !== 'string' || capsule.content.text.trim().length === 0) {
    checks.push(failure('content_text_must_be_non_empty', 'content.text', 'non-whitespace string', capsule.content?.text));
  }
  if (capsule.content?.mime !== 'text/plain') {
    checks.push(failure('content_mime_must_be_text_plain', 'content.mime', 'text/plain', capsule.content?.mime));
  }

  const artifact = capsule.proof_of_work?.artifact_hash;
  if (capsule.proof_of_work?.kind !== 'artifact_hash' || !artifact || typeof artifact !== 'object') {
    checks.push(failure('proof_of_work_must_be_artifact_hash', 'proof_of_work', { kind: 'artifact_hash' }, capsule.proof_of_work));
  } else {
    if (!/^[a-f0-9]{64}$/.test(artifact.sha256 ?? '')) {
      checks.push(failure('artifact_sha256_must_be_lowercase_hex', 'proof_of_work.artifact_hash.sha256', '64 lowercase hexadecimal characters', artifact.sha256));
    }
    if (artifact.mime !== 'text/plain' || artifact.mime !== capsule.content?.mime) {
      checks.push(failure('artifact_mime_mismatch', 'proof_of_work.artifact_hash.mime', capsule.content?.mime ?? 'text/plain', artifact.mime));
    }
    const text = capsule.content?.text;
    const bytes = typeof text === 'string' ? new TextEncoder().encode(text) : null;
    if (!Number.isInteger(artifact.size) || artifact.size < 0) {
      checks.push(failure('artifact_size_must_be_non_negative_integer', 'proof_of_work.artifact_hash.size', 'non-negative integer', artifact.size));
    } else if (bytes && artifact.size !== bytes.byteLength) {
      checks.push(failure('artifact_size_mismatch', 'proof_of_work.artifact_hash.size', bytes.byteLength, artifact.size));
    }
    if (bytes && /^[a-f0-9]{64}$/.test(artifact.sha256 ?? '')) {
      const hash = createHash('sha256').update(bytes).digest('hex');
      if (artifact.sha256 !== hash) {
        checks.push(failure('artifact_sha256_mismatch', 'proof_of_work.artifact_hash.sha256', hash, artifact.sha256));
      }
    }
  }

  return checks.length === 0
    ? { valid: true, mode: REFERENCE_ONLY_EVIDENCE_MODE, reason: null, reasons: [] }
    : { valid: false, mode: REFERENCE_ONLY_EVIDENCE_MODE, reason: checks[0], reasons: checks };
}

export const validateCapsuleEvidence = classifyCapsuleEvidence;
