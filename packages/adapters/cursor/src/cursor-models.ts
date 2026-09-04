import type { NewSessionResponse, SessionConfigSelectOption } from "@agentclientprotocol/sdk";
import type { HarnessSessionState } from "@codexhost/harness-adapter";
import {
  harnessModelCatalogSchema,
  harnessModelRefSchema,
  harnessPermissionModeCatalogSchema,
  harnessPermissionModeIdSchema,
  type HarnessModelRef,
} from "@codexhost/shared-contracts";

const PREFIX = "cursor.";

export function cursorModelRef(nativeId: string): HarnessModelRef {
  return harnessModelRefSchema.parse({
    id: PREFIX + Buffer.from(nativeId, "utf8").toString("base64url"),
  });
}

export function cursorNativeModelId(model: HarnessModelRef): string {
  if (!model.id.startsWith(PREFIX)) throw new Error("Model Ref does not belong to Cursor");
  const encoded = model.id.slice(PREFIX.length);
  const decoded = Buffer.from(encoded, "base64url").toString("utf8");
  if (!decoded || Buffer.from(decoded, "utf8").toString("base64url") !== encoded) {
    throw new Error("Cursor Model Ref is invalid");
  }
  return decoded;
}

export function cursorConfiguration(response: Pick<NewSessionResponse, "configOptions" | "modes">) {
  const modelOption = response.configOptions?.find(
    (option) => option.type === "select" && option.id === "model",
  );
  const models: SessionConfigSelectOption[] =
    modelOption?.type === "select"
      ? modelOption.options.flatMap((option) => ("options" in option ? option.options : [option]))
      : [];
  const catalog = harnessModelCatalogSchema.parse({
    models: models.map((model) => ({ ref: cursorModelRef(model.value), label: model.name })),
    ...(typeof modelOption?.currentValue === "string" &&
    models.some((model) => model.value === modelOption.currentValue)
      ? { defaultModel: cursorModelRef(modelOption.currentValue) }
      : {}),
    thinkingOptions: [],
  });
  const modes = response.modes?.availableModes ?? [];
  const permissionModes =
    response.modes && modes.length > 0
      ? harnessPermissionModeCatalogSchema.parse({
          modes: modes.map((mode) => ({
            id: mode.id,
            label: mode.name,
            ...(mode.description ? { description: mode.description } : {}),
          })),
          defaultModeId: response.modes.currentModeId,
        })
      : undefined;
  const current = models.find((model) => model.value === modelOption?.currentValue);
  const state: HarnessSessionState = {
    ...(current
      ? { effectiveModel: cursorModelRef(current.value), resolvedModelLabel: current.name }
      : {}),
    ...(permissionModes
      ? {
          effectivePermissionModeId: harnessPermissionModeIdSchema.parse(
            permissionModes.defaultModeId,
          ),
        }
      : {}),
  };
  return { catalog, permissionModes, state };
}

export const cursorHistory = {
  transcript: "native",
  fork: false,
  forkAcrossCwd: false,
  rollbackLastTurn: false,
} as const;

export function cursorCapabilities(configuration: ReturnType<typeof cursorConfiguration>) {
  return {
    configuration: {
      selectModel: configuration.catalog.models.length > 0,
      selectThinkingOption: false,
      selectPermissionMode: Boolean(configuration.permissionModes),
      permissionModeScope: "live" as const,
    },
    history: cursorHistory,
    // Cursor has no mid-prompt injection; steer is interrupt-then-re-prompt in
    // the same ACP session and the same Host Turn (see CursorAdapter #run).
    turns: { steer: true },
  };
}
