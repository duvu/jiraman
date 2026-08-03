export interface NamedPathEntry {
  readonly name: string;
  readonly path: string;
}

function duplicateValues(entries: readonly NamedPathEntry[], key: "name" | "path"): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const entry of entries) {
    const value = entry[key];
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort();
}

export function namedPathBijectionViolations(installed: readonly NamedPathEntry[], indexed: readonly NamedPathEntry[]): string[] {
  const violations: string[] = [];
  for (const name of duplicateValues(installed, "name")) violations.push(`installed:duplicate-name:${name}`);
  for (const path of duplicateValues(installed, "path")) violations.push(`installed:duplicate-path:${path}`);
  for (const name of duplicateValues(indexed, "name")) violations.push(`index:duplicate-name:${name}`);
  for (const path of duplicateValues(indexed, "path")) violations.push(`index:duplicate-path:${path}`);

  const installedByName = new Map(installed.map((entry) => [entry.name, entry]));
  const installedByPath = new Map(installed.map((entry) => [entry.path, entry]));
  for (const entry of indexed) {
    const named = installedByName.get(entry.name);
    const pathed = installedByPath.get(entry.path);
    if (named === undefined) violations.push(`index:unresolved-name:${entry.name}`);
    if (pathed === undefined) violations.push(`index:unresolved-path:${entry.path}`);
    if (named !== undefined && named.path !== entry.path) violations.push(`index:name-path-mismatch:${entry.name}`);
    if (pathed !== undefined && pathed.name !== entry.name) violations.push(`index:path-name-mismatch:${entry.path}`);
  }
  for (const entry of installed) {
    if (!indexed.some((candidate) => candidate.name === entry.name && candidate.path === entry.path)) {
      violations.push(`index:missing-entry:${entry.name}`);
    }
  }
  return [...new Set(violations)].sort();
}
