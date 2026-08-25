import { asObject, asString, invariant, type JsonObject } from "./contracts.js";

export interface RouteResult {
  readonly mode: string | null;
  readonly skill: string | null;
  readonly focus: string;
  readonly mutatesState: boolean;
  readonly mayWriteMcp: boolean;
}

export function commandTableRoutes(markdown: string): ReadonlyMap<string, string> {
  const routes = new Map<string, string>();
  for (const match of markdown.matchAll(/^\|\s*((?:`[^`]+`(?:,\s*)?)+)\s*\|\s*`([^`]+)`\s*\|$/gm)) {
    const modes = match[1]?.match(/`([^`]+)`/g) ?? [];
    const skill = match[2];
    invariant(skill !== undefined, "command table skill is required");
    for (const token of modes) routes.set(token.slice(1, -1), skill);
  }
  return routes;
}

function isExactActionSelection(focus: string): boolean {
  return /^(?:PMG-[0-9]{8}-[0-9]{2}|PMA-[0-9]{8}-[0-9]{2}(?:\s+PMA-[0-9]{8}-[0-9]{2})*)$/.test(focus);
}

function isExactProjectSelection(focus: string): boolean {
  return /^[a-z][a-z0-9-]{1,31}$/.test(focus) && !["remote-content", "unknown", "missing"].includes(focus);
}

export function parseRoute(router: JsonObject, rawInput: string): RouteResult {
  const input = rawInput.trim();
  const canonical = asObject(router.canonical ?? null, "canonical routes");
  const aliases = asObject(router.aliases ?? null, "aliases");
  if (input === "") {
    const mode = asString(router.default_mode, "default mode");
    return { mode, skill: asString(canonical[mode], "default skill"), focus: "", mutatesState: false, mayWriteMcp: false };
  }
  const prefixes = [...Object.keys(canonical), ...Object.keys(aliases)].sort((left, right) => right.length - left.length);
  const prefix = prefixes.find((candidate) => input === candidate || input.startsWith(`${candidate} `));
  if (prefix === undefined) return { mode: null, skill: null, focus: input, mutatesState: false, mayWriteMcp: false };
  const aliasTarget = aliases[prefix];
  const mode = aliasTarget === undefined ? prefix : asString(aliasTarget, "alias target");
  const skill = canonical[mode];
  invariant(typeof skill === "string", `mode has no skill: ${mode}`);
  const focus = input.slice(prefix.length).trim();
  const exactActionSelection = isExactActionSelection(focus);
  const mutatesState = (mode === "propose" && focus === "") || ((mode === "apply" || mode === "reject") && exactActionSelection) || (mode === "use" && isExactProjectSelection(focus));
  return { mode, skill, focus, mutatesState, mayWriteMcp: mode === "apply" && exactActionSelection };
}
