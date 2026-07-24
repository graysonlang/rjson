export type JsonReviver = (this: unknown, key: string, value: unknown) => unknown;

export interface RewriteOptions {
  /**
   * Replace every removed character with a space instead of deleting it, so
   * the result has the same length as the input and every character that
   * remains keeps its original offset. Useful for reporting `JSON.parse`
   * diagnostics against the original Relaxed JSON source. Defaults to `false`.
   */
  preserveOffsets?: boolean;
}

export declare const RELAXED_JSON_VERSION: string;

/**
 * Parse Relaxed JSON by accepting comments and trailing commas before native
 * JSON.parse validation. This is intentionally not JSON5.
 */
export function parse<T = unknown>(source: string, reviver?: JsonReviver): T;

/**
 * Convert Relaxed JSON source into strict JSON text.
 *
 * By default the output is clean: comments and trailing commas are deleted,
 * whitespace they orphan at the end of a line is trimmed, and a line holding
 * nothing but a comment is dropped. Pass `preserveOffsets` to pad instead.
 */
export function toJson(source: string, options?: RewriteOptions): string;

/** Remove line and block comments while preserving string contents. */
export function stripComments(source: string, options?: RewriteOptions): string;

/** Remove commas before a closing brace or bracket while preserving strings. */
export function stripTrailingCommas(source: string, options?: RewriteOptions): string;
