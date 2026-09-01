import {
  decodeCursorTransportSelection,
  encodeCursorTransportModel,
} from "@codexhost/shared-contracts";

export {
  CURSOR_NATIVE_TRANSPORT_MODEL_ID as CURSOR_TRANSPORT_MODEL_ID,
  CURSOR_NATIVE_TRANSPORT_MODEL_PREFIX as CURSOR_TRANSPORT_MODEL_PREFIX,
} from "@codexhost/shared-contracts";

export const cursorTransportModelId = encodeCursorTransportModel;

export function decodeCursorTransportModelId(value: unknown) {
  try {
    return decodeCursorTransportSelection(value);
  } catch {
    return null;
  }
}

export function isCursorTransportModelId(value: unknown): value is string {
  return decodeCursorTransportModelId(value) !== null;
}
