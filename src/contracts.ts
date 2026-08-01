import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

import { Ajv, type ErrorObject, type ValidateFunction } from "ajv";

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export const ROOT = resolve(process.cwd());

export class ContractError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ContractError";
  }
}

export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new ContractError(message);
  }
}

export function validDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function validDateTime(value: string): boolean {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (match === null || !validDate(match[1] ?? "")) return false;
  const offsetHour = match[5] === undefined ? 0 : Number(match[5]);
  const offsetMinute = match[6] === undefined ? 0 : Number(match[6]);
  return Number(match[2]) <= 23 && Number(match[3]) <= 59 && Number(match[4]) <= 59 && offsetHour <= 23 && offsetMinute <= 59;
}

export function readText(path: string): string {
  return readFileSync(resolve(ROOT, path), "utf8");
}

export function readJson(path: string): JsonValue {
  const parsed: unknown = JSON.parse(readText(path));
  return asJsonValue(parsed, path);
}

export function asJsonValue(value: unknown, label: string): JsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => asJsonValue(item, `${label}[${index}]`));
  }
  invariant(typeof value === "object", `${label} must be JSON`);
  const output: JsonObject = {};
  for (const [key, item] of Object.entries(value)) {
    output[key] = asJsonValue(item, `${label}.${key}`);
  }
  return output;
}

export function asObject(value: JsonValue, label: string): JsonObject {
  invariant(value !== null && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  return value;
}

export function asArray(value: JsonValue | undefined, label: string): JsonValue[] {
  invariant(Array.isArray(value), `${label} must be an array`);
  return value;
}

export function asString(value: JsonValue | undefined, label: string): string {
  invariant(typeof value === "string", `${label} must be a string`);
  return value;
}

export function walkFiles(path: string): string[] {
  const absolute = resolve(ROOT, path);
  const files: string[] = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const child = join(absolute, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(relative(ROOT, child)));
    } else if (entry.isFile()) {
      files.push(relative(ROOT, child));
    }
  }
  return files.sort();
}

export function listSkillFiles(): string[] {
  return walkFiles("template/.kilo/skills").filter((path) => path.endsWith("/SKILL.md"));
}

export function parseFrontmatter(text: string): ReadonlyMap<string, string> {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  invariant(match?.[1] !== undefined, "Markdown frontmatter is required");
  const values = new Map<string, string>();
  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":");
    if (separator > 0) {
      values.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^"|"$/g, ""));
    }
  }
  return values;
}

function schemaValidator(schemaName: string): ValidateFunction {
  const ajv = new Ajv({
    allErrors: true,
    strict: true,
    allowUnionTypes: true,
    formats: {
      date: { type: "string", validate: validDate },
      "date-time": { type: "string", validate: validDateTime },
    },
  });
  for (const path of walkFiles("schemas").filter((item) => item.endsWith(".schema.json"))) {
    const schema = asObject(readJson(path), path);
    ajv.addSchema(schema, basename(path));
  }
  const validator = ajv.getSchema(schemaName);
  invariant(validator !== undefined, `schema not registered: ${schemaName}`);
  return validator;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ErrorObject[];
}

function actionStatusesMatchGroup(groupStatus: string, actionStatuses: readonly string[]): boolean {
  if (groupStatus === "proposed") return actionStatuses.every((status) => status === "proposed");
  if (groupStatus === "approved") return actionStatuses.every((status) => status === "approved");
  if (groupStatus === "rejected") return actionStatuses.includes("rejected") && actionStatuses.every((status) => ["proposed", "approved", "rejected"].includes(status));
  if (groupStatus === "stale") return actionStatuses.every((status) => status === "stale");
  if (groupStatus === "applying") return actionStatuses.includes("applying") && actionStatuses.every((status) => ["approved", "applying", "applied", "failed", "verification-failed"].includes(status));
  if (groupStatus === "applied") return actionStatuses.every((status) => status === "applied");
  if (groupStatus === "failed") return actionStatuses.includes("failed") && actionStatuses.every((status) => ["approved", "applied", "failed"].includes(status));
  if (groupStatus === "verification-failed") return actionStatuses.includes("verification-failed") && actionStatuses.every((status) => ["approved", "applied", "verification-failed"].includes(status));
  return false;
}

function actionGroupApprovalErrors(value: JsonValue): ErrorObject[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return [];
  const executableStatuses = new Set(["approved", "applying", "applied", "failed", "verification-failed"]);
  if (typeof value.status !== "string") return [];
  const executable = executableStatuses.has(value.status);
  if (!Array.isArray(value.actions) || value.approval === null || typeof value.approval !== "object" || Array.isArray(value.approval)) return [];

  const actionIds: string[] = [];
  const actionStatuses: string[] = [];
  for (const action of value.actions) {
    if (action === null || typeof action !== "object" || Array.isArray(action) || typeof action.id !== "string" || typeof action.status !== "string") return [];
    actionIds.push(action.id);
    actionStatuses.push(action.status);
  }

  const errors: ErrorObject[] = [];
  const approvedIds = value.approval.approved_action_ids;
  if (executable) {
    const approvedIdSet = Array.isArray(approvedIds) && approvedIds.every((id) => typeof id === "string") ? new Set(approvedIds) : null;
    if (approvedIdSet === null || approvedIdSet.size !== actionIds.length || actionIds.some((id) => !approvedIdSet.has(id))) {
      errors.push({
        instancePath: "/approval/approved_action_ids",
        schemaPath: "#/x-action-group-approval/approved-action-ids",
        keyword: "approvalActionIds",
        params: {},
        message: "must contain every action ID exactly once",
      });
    }
  }
  if (!actionStatusesMatchGroup(value.status, actionStatuses)) {
    errors.push({
      instancePath: "/actions",
      schemaPath: "#/x-action-group-lifecycle/status",
      keyword: "actionLifecycle",
      params: {},
      message: "must match the action group lifecycle state",
    });
  }
  if (typeof value.payload_hash === "string" && typeof value.approval.payload_hash === "string" && value.approval.payload_hash !== value.payload_hash) {
    errors.push({
      instancePath: "/approval/payload_hash",
      schemaPath: "#/x-action-group-approval/payload-hash",
      keyword: "approvalPayloadHash",
      params: {},
      message: "must equal the action group payload_hash",
    });
  }
  return errors;
}

export function validateJson(schemaName: string, value: JsonValue): ValidationResult {
  const validator = schemaValidator(schemaName);
  const schemaValid = validator(value);
  const semanticErrors = schemaName === "action-group.schema.json" ? actionGroupApprovalErrors(value) : [];
  return { valid: schemaValid && semanticErrors.length === 0, errors: [...(validator.errors ?? []), ...semanticErrors] };
}

export function requireValid(schemaName: string, path: string): void {
  const result = validateJson(schemaName, readJson(path));
  invariant(result.valid, `${path} failed ${schemaName}: ${JSON.stringify(result.errors)}`);
}

export function requireInvalid(schemaName: string, path: string): void {
  const result = validateJson(schemaName, readJson(path));
  invariant(!result.valid, `${path} unexpectedly passed ${schemaName}`);
}

export function fixtureFiles(directory: string): string[] {
  return walkFiles(directory).filter((path) => path.endsWith(".json"));
}

export function hashFiles(paths: readonly string[]): string {
  const hash = createHash("sha256");
  for (const path of [...paths].sort()) {
    hash.update(path);
    hash.update("\0");
    hash.update(readFileSync(resolve(ROOT, path)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function isExecutable(path: string): boolean {
  return (statSync(resolve(ROOT, path)).mode & 0o111) !== 0;
}
