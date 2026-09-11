export const REFERENCE_ONLY_EVIDENCE_MODE: 'reference_only';

export type CapsuleEvidenceReason = {
  code: string;
  path: string;
  expected: unknown;
  actual: unknown;
};

export type CapsuleEvidenceResult = {
  valid: boolean;
  mode: 'legacy' | 'reference_only' | 'invalid';
  reason: CapsuleEvidenceReason | null;
  reasons: CapsuleEvidenceReason[];
};

export function classifyCapsuleEvidence(capsule: unknown): CapsuleEvidenceResult;
export const validateCapsuleEvidence: typeof classifyCapsuleEvidence;
