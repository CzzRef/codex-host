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
  if (!model) {
    if (permissionModeId) throw new Error("Cursor transport Permission Mode requires a Model Ref");
    return CURSOR_NATIVE_TRANSPORT_MODEL_ID;
  }
  const parsedModel = harnessModelRefSchema.parse(model);
  const mode = permissionModeId ? harnessPermissionModeIdSchema.parse(permissionModeId) : undefined;
  return `${CURSOR_NATIVE_TRANSPORT_MODEL_PREFIX}${parsedModel.id}${mode ? `@${mode}` : ""}`;
}

export function decodeCursorTransportSelection(value: unknown): CursorTransportSelection | null {
  if (value === CURSOR_NATIVE_TRANSPORT_MODEL_ID) return {};
  if (typeof value !== "string" || !value.startsWith(CURSOR_NATIVE_TRANSPORT_MODEL_PREFIX))
    return null;
  const parts = value.slice(CURSOR_NATIVE_TRANSPORT_MODEL_PREFIX.length).split("@");
  if (parts.length > 2 || parts.length < 1 || (parts.length === 2 && !parts[1]))
    throw new Error("Invalid Cursor transport configuration");
  const model = harnessModelRefSchema.parse({ id: parts[0] });
  const permissionModeId = parts[1] ? harnessPermissionModeIdSchema.parse(parts[1]) : undefined;
  return { model, ...(permissionModeId ? { permissionModeId } : {}) };
}
