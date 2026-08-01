export interface SensitivePattern {
  readonly name: string;
  readonly expression: RegExp;
}

export const sensitivePatterns: readonly SensitivePattern[];
export const releaseInvariantNames: ReadonlySet<string>;
export function findSensitiveNames(text: string): string[];
export function sanitizeSensitiveText(text: string): string;
