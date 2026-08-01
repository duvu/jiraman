import { describe, expect, test } from "vitest";
import { asArray, asObject, asString, listSkillFiles, parseFrontmatter, readJson, readText } from "../../src/contracts.js";
import { commandTableRoutes, parseRoute } from "../../src/routing-rules.js";

describe("skills", () => {
  test("all declared skills are versioned and reference the canonical policy", () => {
    const files = listSkillFiles();
    expect(files).toHaveLength(11);
    const metadata = files.map((path) => parseFrontmatter(readText(path)));
    const names = metadata.map((frontmatter) => frontmatter.get("name"));
    expect(new Set(names).size).toBe(names.length);
    for (const frontmatter of metadata) {
      expect(frontmatter.get("version")).toBe("5");
      expect(frontmatter.get("policy")).toBe(".kilo/policies/jiraman-safety.md");
    }
  });
});

describe("command-router", () => {
  test("aliases preserve focus and only exact apply writes", () => {
    const wrapper = asObject(readJson("tests/fixtures/router/cases.json"), "router fixture");
    const cases = asArray(wrapper.data, "router cases");
    const router = asObject(readJson("template/.kilo/config/command-router.json"), "router");
    const aliases = asObject(router.aliases ?? null, "aliases");
    const documented = commandTableRoutes(readText("template/.kilo/commands/jiraman.md"));
    for (const [mode, skill] of Object.entries(asObject(router.canonical ?? null, "canonical"))) expect(documented.get(mode)).toBe(skill);
    for (const item of cases) {
      const entry = asObject(item, "route case");
      const result = parseRoute(router, asString(entry.input, "input"));
      expect(result.mode).toBe(entry.mode);
      expect(result.focus).toBe(entry.focus);
      expect(result.mayWriteMcp).toBe(entry.write);
      if (result.mayWriteMcp) expect(result.focus).toMatch(/^(?:PMG|PMA)-[0-9]{8}-[0-9]{2}/);
    }
    const fixtureInputs = cases.map((item) => asString(asObject(item, "route case").input, "input"));
    for (const alias of Object.keys(aliases)) expect(fixtureInputs.some((input) => input === alias || input.startsWith(alias + " ")), alias).toBe(true);
    expect(parseRoute(router, "reject PMG-20260801-01").mutatesState).toBe(true);
    expect(parseRoute(router, "reject arbitrary prose").mutatesState).toBe(false);
    expect(parseRoute(router, "apply PMA-20260801-01 extra").mayWriteMcp).toBe(false);
  });
});
