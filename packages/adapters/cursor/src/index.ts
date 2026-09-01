import { WORKSPACE_CONTRACT_VERSION } from "@codexhost/shared-contracts";

export { CursorAdapter } from "./cursor-adapter.js";
export { cursorDiscoverySpec, resolveCursorExecutable } from "./command.js";
export { cursorModelRef, cursorNativeModelId } from "./cursor-models.js";

export const packageMetadata = {
  name: "@codexhost/adapter-cursor",
  contractVersion: WORKSPACE_CONTRACT_VERSION,
} as const;
