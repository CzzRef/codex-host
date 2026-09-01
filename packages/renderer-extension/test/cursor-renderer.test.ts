import { describe, expect, it } from "vitest";
import {
  harnessModelRefSchema,
  harnessPermissionModeIdSchema,
  encodeCursorTransportModel,
} from "@codexhost/shared-contracts";
import { DraftAgentController } from "../src/agent-selection-state.js";
import {
  cursorTransportModelId,
  decodeCursorTransportModelId,
} from "../src/cursor-renderer-models.js";

describe("Cursor renderer routing", () => {
  it("shares the Host transport codec and rejects malformed IDs", () => {
    const model = harnessModelRefSchema.parse({ id: "cursor.ZGVmYXVsdFtd" });
    const mode = harnessPermissionModeIdSchema.parse("ask");
    const value = cursorTransportModelId(model, mode);
    expect(value).toBe(encodeCursorTransportModel(model, mode));
    expect(decodeCursorTransportModelId(value)).toEqual({ model, permissionModeId: mode });
    for (const invalid of ["codexhost/cursor-native@", value + "@extra", "gpt-5"])
      expect(decodeCursorTransportModelId(invalid)).toBeNull();
  });

  it("keeps Cursor models isolated from OMP and has no separate Thinking selection", () => {
    const controller = new DraftAgentController<object>();
    const composer = {};
    const cursor = harnessModelRefSchema.parse({ id: "cursor.one" });
    const omp = harnessModelRefSchema.parse({ id: "omp.one" });
    controller.setExternalModel(composer, "omp", omp);
    controller.setExternalModel(composer, "cursor", cursor);
    expect(controller.modelForAgent(composer, "cursor")).toEqual(cursor);
    expect(controller.modelForAgent(composer, "omp")).toEqual(omp);
    expect(controller.thinkingOptionForAgent(composer, "cursor")).toBeUndefined();
  });
});
