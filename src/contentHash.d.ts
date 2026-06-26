export const SCHEMA_VERSION: '1.12.1';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue | undefined };
export type AssetLike = Record<string, unknown> & {
  asset_id?: string;
};

export function canonicalize(obj: unknown): string;
export function computeAssetId(obj: unknown, excludeFields?: readonly string[]): string | null;
export function verifyAssetId(obj: unknown): boolean;
