import { describe, expect, it } from "vitest";
import {
  harnessModelRefSchema,
  harnessPermissionModeIdSchema,
  harnessSessionCapabilitiesSchema,
} from "@codexhost/shared-contracts";
import {
  decodeCreateRoute,
  encodeExternalTransportSelection,
  decodeExternalTransportSelection,
} from "../src/model-routing.js";

describe("Cursor routing and history contract", () => {
  it("uses the same safe transport codec on Host and renderer", () => {
    const model = harnessModelRefSchema.parse({ id: "cursor.ZGVmYXVsdFtd" });
    const permissionModeId = harnessPermissionModeIdSchema.parse("ask");
    const encoded = encodeExternalTransportSelection("cursor", { model, permissionModeId });
    expect(encoded).toBe("codexhost/cursor-native@cursor.ZGVmYXVsdFtd@ask");
    expect(decodeExternalTransportSelection("cursor", encoded)).toEqual({
      model,
      permissionModeId,
    });
    expect(
      decodeCreateRoute({
        jsonrpc: "2.0",
        id: 1,
        method: "thread/start",
        params: { model: encoded },
      }),
    ).toMatchObject({ harnessId: "cursor", model, permissionModeId });
  });

  it("carries a Permission Mode on Cursor's native default Model before a catalog exists", () => {
    const permissionModeId = harnessPermissionModeIdSchema.parse("plan");
    const encoded = encodeExternalTransportSelection("cursor", { permissionModeId });
    expect(encoded).toBe("codexhost/cursor-native@@plan");
    expect(decodeExternalTransportSelection("cursor", encoded)).toEqual({ permissionModeId });
    expect(encodeExternalTransportSelection("cursor", {})).toBe("codexhost/cursor-native");
    expect(decodeExternalTransportSelection("cursor", "codexhost/cursor-native")).toEqual({});
    expect(
      decodeCreateRoute({
        jsonrpc: "2.0",
        id: 1,
        method: "thread/start",
        params: { model: encoded },
      }),
    ).toMatchObject({ harnessId: "cursor", permissionModeId });
  });

  it("never sends malformed Cursor selections to native Codex", () => {
    for (const model of [
      "codexhost/cursor-native@",
      "codexhost/cursor-native@@",
      "codexhost/cursor-native@ref@",
      "codexhost/cursor-native@ref@ask@extra",
    ]) {
      expect(() =>
        decodeCreateRoute({ id: 1, method: "thread/start", params: { model } }),
      ).toThrow();
    }
  });

  it("keeps native as the omitted default and forbids live-only fork claims", () => {
    const configuration = {
      selectModel: false,
      selectThinkingOption: false,
      selectPermissionMode: false,
    };
    const native = harnessSessionCapabilitiesSchema.parse({
      configuration,
      history: { fork: false, forkAcrossCwd: false, rollbackLastTurn: false },
    });
    expect(native.history.transcript ?? "native").toBe("native");
    expect(
      harnessSessionCapabilitiesSchema.safeParse({
        configuration,
        history: {
          transcript: "live-only",
          fork: true,
          forkAcrossCwd: false,
          rollbackLastTurn: false,
        },
      }).success,
    ).toBe(false);
  });
});
