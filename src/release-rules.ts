import { readText } from "./contracts.js";

export const REQUIRED_RELEASE_GATES = ["architecture", "schemas", "skills", "aliases", "migration", "fixtures", "security", "reproducibility", "package-verification", "manual-smoke", "rollback"] as const;

export const REQUIRED_RELEASE_GATE_CHECKS: Readonly<Record<(typeof REQUIRED_RELEASE_GATES)[number], readonly string[]>> = {
  architecture: ["prompt-first", "no-runtime"],
  schemas: ["config", "state", "action", "run-record", "exact-traceability", "structured-ac"],
  skills: ["primary-agent", "named-skills", "installed-goal-metadata", "jira-ticket-templates"],
  aliases: ["canonical", "v4-aliases", "exact-write"],
  migration: ["clean-install", "v4-migration", "mcp-preservation"],
  fixtures: ["mcp", "workflow", "sanitized", "ready-evidence", "acceptance-boundaries"],
  security: ["scope", "injection", "approval", "replay", "symlink", "secrets", "hostile-paraphrases"],
  reproducibility: ["manifest", "tar", "zip"],
  "package-verification": ["tar", "zip", "no-state", "no-backup", "no-runtime"],
  "manual-smoke": ["read", "degraded", "proposal", "reject", "apply", "failure", "read-after-write", "jira-authority", "managed-ac", "acceptance-read-back"],
  rollback: ["package", "managed-files", "action-state"],
};

export interface ChecklistEntry {
  readonly gate: string;
  readonly checks: readonly string[];
  readonly description: string;
}

export function checklistEntries(text: string): ChecklistEntry[] {
  const entries: ChecklistEntry[] = [];
  for (const line of text.split("\n")) {
    const match = /^- \[[ xX]\]\s+<!--\s*gate:([a-z-]+)\s+checks:([a-z0-9,-]+)\s*-->\s+(\S.*)$/.exec(line);
    const gate = match?.[1];
    const checks = match?.[2];
    const description = match?.[3];
    if (gate !== undefined && checks !== undefined && description !== undefined) {
      entries.push({ gate, checks: checks.split(",").filter((item) => item.length > 0), description });
    }
  }
  return entries;
}

export function checklistGates(text: string): string[] {
  return checklistEntries(text).map((entry) => entry.gate);
}

export function checklistViolations(text: string): string[] {
  const rawGates = [...text.matchAll(/<!--\s*gate:([a-z-]+)/g)].map((match) => match[1]).filter((value): value is string => value !== undefined);
  const entries = checklistEntries(text);
  const violations: string[] = [];
  const requiredGates: ReadonlySet<string> = new Set(REQUIRED_RELEASE_GATES);
  for (const gate of rawGates) if (!requiredGates.has(gate)) violations.push("unknown:" + gate);
  for (const gate of REQUIRED_RELEASE_GATES) {
    const rawCount = rawGates.filter((item) => item === gate).length;
    if (rawCount === 0) {
      violations.push("missing:" + gate);
      continue;
    }
    if (rawCount > 1) violations.push("duplicate:" + gate);
    const entry = entries.find((item) => item.gate === gate);
    if (entry === undefined) {
      violations.push("malformed:" + gate);
      continue;
    }
    if (new Set(entry.checks).size !== entry.checks.length) violations.push("duplicate-check:" + gate);
    for (const check of REQUIRED_RELEASE_GATE_CHECKS[gate]) {
      if (!entry.checks.includes(check)) violations.push("missing-check:" + gate + ":" + check);
    }
  }
  return violations;
}

export function missingChecklistGates(path = "docs/release-checklist.md"): string[] {
  return checklistViolations(readText(path));
}
