import { describe, expect, it } from "vitest";

import {
  CURSOR_BYPASS_PERMISSION_MODE_ID,
  cursorConfiguration,
  isCursorBypassPermissionMode,
} from "../src/cursor-models.js";

const nativeResponse = {
  configOptions: [
    {
      type: "select" as const,
      id: "model",
      name: "Model",
      currentValue: "default[]",
      options: [{ value: "default[]", name: "Auto" }],
    },
  ],
  modes: {
    currentModeId: "agent",
    availableModes: [
      { id: "agent", name: "Agent", description: "Full agent capabilities with tool access" },
      { id: "plan", name: "Plan", description: "Read-only planning" },
      { id: "ask", name: "Ask", description: "Ask before acting" },
    ],
  },
};

describe("Cursor Permission Modes", () => {
  it("tags native Modes with the shared choice they stand for", () => {
    const { permissionModes } = cursorConfiguration(nativeResponse as never);
    const canonical = Object.fromEntries(
      (permissionModes?.modes ?? []).map((mode) => [mode.id, mode.canonical]),
    );
    expect(canonical).toMatchObject({ agent: "auto", plan: "plan", ask: "ask" });
  });

  it("adds the synthetic bypass Mode Cursor itself does not have", () => {
    const { permissionModes } = cursorConfiguration(nativeResponse as never);
    const bypass = permissionModes?.modes.find(
      (mode) => mode.id === CURSOR_BYPASS_PERMISSION_MODE_ID,
    );
    expect(bypass).toMatchObject({ canonical: "bypass", dangerous: true });
    // It must never be mistaken for one of Cursor's own Modes.
    expect(nativeResponse.modes.availableModes.map(({ id }) => id)).not.toContain(
      CURSOR_BYPASS_PERMISSION_MODE_ID,
    );
    expect(isCursorBypassPermissionMode(CURSOR_BYPASS_PERMISSION_MODE_ID)).toBe(true);
    expect(isCursorBypassPermissionMode("agent")).toBe(false);
  });

  it("offers no Modes at all when Cursor published none", () => {
    const { permissionModes } = cursorConfiguration({
      configOptions: nativeResponse.configOptions,
    } as never);
    expect(permissionModes).toBeUndefined();
  });
});
