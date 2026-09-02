import { describe, expect, it } from "vitest";

import {
  GROK_INTERJECT_METHOD,
  buildGrokInterjectParams,
  parseGrokInterjectResult,
} from "../src/grok-interject.js";

describe("Grok native interject", () => {
  it("targets the prefixed ACP extension method with a plain text payload", () => {
    // grok 1.0.13: `x.ai/interject` is Method not found; `_x.ai/interject`
    // wants `text`, not an ACP prompt block array.
    expect(GROK_INTERJECT_METHOD).toBe("_x.ai/interject");
    expect(buildGrokInterjectParams("session-1", "second")).toEqual({
      sessionId: "session-1",
      text: "second",
    });
  });

  it("parses the nested and flat status acknowledgements", () => {
    expect(parseGrokInterjectResult(undefined)).toEqual({});
    expect(parseGrokInterjectResult({ result: { status: "queued" } })).toEqual({
      status: "queued",
    });
    expect(parseGrokInterjectResult({ status: "queued" })).toEqual({ status: "queued" });
    expect(parseGrokInterjectResult({ result: {} })).toEqual({});
  });
});
