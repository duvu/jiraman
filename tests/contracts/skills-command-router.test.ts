import { describe, expect, test } from "vitest";
import { asArray, asObject, asString, listSkillFiles, parseFrontmatter, readJson, readText } from "../../src/contracts.js";

describe("skills", () => {
  test("all declared skills are versioned and reference the canonical policy", () => {
    const files = listSkillFiles();
    expect(files).toHaveLength(10);
    const names = files.map((path) => parseFrontmatter(readText(path)).get("name"));
    expect(new Set(names).size).toBe(names.length);
    for (const path of files) expect(readText(path)).toContain(".kilo/policies/jiraman-safety.md");
  });
});

describe("command-router", () => {
  test("aliases preserve focus and only exact apply writes", () => {
    const wrapper = asObject(readJson("tests/fixtures/router/cases.json"), "router fixture");
    const cases = asArray(wrapper.data, "router cases");
    const router = asObject(readJson("template/.kilo/config/command-router.json"), "router");
    const canonical = asObject(router.canonical ?? null, "canonical");
    const aliases = asObject(router.aliases ?? null, "aliases");
    const prefixes = [...Object.keys(canonical), ...Object.keys(aliases)].sort((left, right) => right.length - left.length);
    for (const item of cases) {
      const entry = asObject(item, "route case");
      const input = asString(entry.input, "input").trim();
      const prefix = prefixes.find((candidate) => input === candidate || input.startsWith(`${candidate} `));
      const normalized = input === "" ? router.default_mode : prefix === undefined ? undefined : (aliases[prefix] ?? prefix);
      expect(normalized ?? null).toBe(entry.mode);
      const focus = prefix === undefined ? input : input.slice(prefix.length).trim();
      expect(focus).toBe(entry.focus);
      expect(normalized === "apply").toBe(entry.write);
    }
  });
});
