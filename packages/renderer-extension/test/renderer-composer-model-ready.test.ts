import { harnessModelRefSchema } from "@codexhost/shared-contracts";
import { describe, expect, it } from "vitest";

import { isExternalModelSelectionReady } from "../src/renderer-composer-dom.js";

const model = harnessModelRefSchema.parse({ id: "cursor.ZGVmYXVsdFtd" });
const catalog = { models: [{ ref: model, label: "Auto" }], thinkingOptions: [] };
const empty = {
  status: "empty" as const,
  catalog: { models: [], thinkingOptions: [] },
  thinkingSelectionSupported: false as const,
};

describe("external Model readiness for submission", () => {
  it("treats an empty catalog as Cursor's native default Model", () => {
    expect(isExternalModelSelectionReady(empty, "cursor")).toBe(true);
  });

  it("keeps an empty catalog terminal for Harnesses that publish one", () => {
    // Claude Code over a Host connection reports its Models; none means the
    // Host found none, and the draft must stay blocked.
    expect(isExternalModelSelectionReady(empty, "claude-code")).toBe(false);
    expect(isExternalModelSelectionReady(empty, "grok")).toBe(false);
  });

  it("still requires the selected Model to be in a loaded catalog", () => {
    expect(
      isExternalModelSelectionReady(
        {
          status: "ready",
          catalog,
          selected: model,
          thinkingSelectionSupported: false,
        },
        "cursor",
      ),
    ).toBe(true);
    expect(
      isExternalModelSelectionReady(
        {
          status: "ready",
          catalog,
          thinkingSelectionSupported: false,
        },
        "cursor",
      ),
    ).toBe(false);
    expect(isExternalModelSelectionReady({ status: "loading" }, "cursor")).toBe(false);
    expect(isExternalModelSelectionReady({ status: "waitingForAdapter" }, "cursor")).toBe(false);
  });
});
