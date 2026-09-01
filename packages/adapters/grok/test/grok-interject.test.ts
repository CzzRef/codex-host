import { describe, expect, it } from "vitest";

import {
  GROK_INTERJECT_METHOD,
  buildGrokInterjectParams,
  parseGrokInterjectResult,
} from "../src/grok-interject.js";

describe("Grok native interject", () => {
  it("builds the ACP prompt payload used by the native pager", () => {
    expect(GROK_INTERJECT_METHOD).toBe("x.ai/interject");
    expect(buildGrokInterjectParams("session-1", "second")).toEqual({
      sessionId: "session-1",
      prompt: [{ type: "text", text: "second" }],
    });
  });

  it("parses camelCase and snake_case acknowledgements", () => {
    expect(parseGrokInterjectResult(undefined)).toEqual({});
    expect(parseGrokInterjectResult({ interjectionId: "inj-1", queued: false })).toEqual({
      interjectionId: "inj-1",
      queued: false,
    });
    expect(parseGrokInterjectResult({ interjection_id: "inj-2", queued: true })).toEqual({
      interjectionId: "inj-2",
      queued: true,
    });
  });
});
