import { asObject, asString, invariant, type JsonObject } from "./contracts.js";

export interface RouteResult {
  readonly mode: string | null;
  readonly skill: string | null;
  readonly focus: string;
  readonly mutatesState: boolean;
  readonly mayWriteMcp: boolean;
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
  return { mode, skill, focus: input.slice(prefix.length).trim(), mutatesState: mode === "apply" || mode === "reject", mayWriteMcp: mode === "apply" };
}
