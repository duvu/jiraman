import { expect, test } from "vitest";
import { asArray, asObject, readJson } from "../../src/contracts.js";
test("meeting-risk-decision records preserve ambiguity and duplicate disposition", () => {
  const data = asObject(asObject(readJson("tests/fixtures/governance/meeting-risk-decision.json"), "fixture").data ?? null, "data");
  const meeting = asObject(data.meeting ?? null, "meeting");
  const items = asArray(meeting.items, "items").map((value) => asObject(value, "item"));
  expect(items.find((item) => item.kind === "discussion")?.disposition).toBe("not-a-decision");
  expect(asObject(data.duplicate_search ?? null, "duplicates").disposition).toBe("update-link");
  expect(asObject(data.decision ?? null, "decision").decision).toBeNull();
});
