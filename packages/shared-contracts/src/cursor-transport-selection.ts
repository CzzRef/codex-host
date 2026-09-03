import { harnessModelRefSchema, type HarnessModelRef } from "./harness-models.js";
import {
  harnessPermissionModeIdSchema,
  type HarnessPermissionModeId,
} from "./harness-permission-modes.js";

export const CURSOR_NATIVE_TRANSPORT_MODEL_ID = "codexhost/cursor-native";
export const CURSOR_NATIVE_TRANSPORT_MODEL_PREFIX = `${CURSOR_NATIVE_TRANSPORT_MODEL_ID}@`;

export interface CursorTransportSelection {
  model?: HarnessModelRef;
  permissionModeId?: HarnessPermissionModeId;
}

export function encodeCursorTransportModel(
  model?: HarnessModelRef,
  permissionModeId?: HarnessPermissionModeId,
): string {
  const mode = permissionModeId ? harnessPermissionModeIdSchema.parse(permissionModeId) : undefined;
  if (!model) {
    // Cursor publishes its Model catalog only from a live native Session, so a
    // new-Thread draft may carry a Permission Mode while leaving the Model to
    // Cursor's own default.
    return mode
      ? `${CURSOR_NATIVE_TRANSPORT_MODEL_PREFIX}@${mode}`
      : CURSOR_NATIVE_TRANSPORT_MODEL_ID;
  }
  const parsedModel = harnessModelRefSchema.parse(model);
  return `${CURSOR_NATIVE_TRANSPORT_MODEL_PREFIX}${parsedModel.id}${mode ? `@${mode}` : ""}`;
}

export function decodeCursorTransportSelection(value: unknown): CursorTransportSelection | null {
  if (value === CURSOR_NATIVE_TRANSPORT_MODEL_ID) return {};
  if (typeof value !== "string" || !value.startsWith(CURSOR_NATIVE_TRANSPORT_MODEL_PREFIX))
    return null;
  const parts = value.slice(CURSOR_NATIVE_TRANSPORT_MODEL_PREFIX.length).split("@");
  if (parts.length > 2 || parts.length < 1 || (parts.length === 2 && !parts[1]))
    throw new Error("Invalid Cursor transport configuration");
  const permissionModeId = parts[1] ? harnessPermissionModeIdSchema.parse(parts[1]) : undefined;
  if (parts[0] === "" && permissionModeId) return { permissionModeId };
  const model = harnessModelRefSchema.parse({ id: parts[0] });
  return { model, ...(permissionModeId ? { permissionModeId } : {}) };
}
