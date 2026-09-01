import type { HarnessModelCatalog } from "@codexhost/shared-contracts";

import { KNOWN_RENDERER_AGENTS, type ExternalRendererAgent } from "./agent-selection-state.js";

export const RENDERER_MODEL_VISIBILITY_KEY = "codexhost.model-visibility.v1";

/** Dispatched on `window` after the stored visibility preference changes. */
export const RENDERER_MODEL_VISIBILITY_CHANGED_EVENT = "codexhost:model-visibility-changed";

interface ModelVisibilityPreference {
  version: 1;
  /**
   * Per-Harness hidden opaque Model Ref IDs. A deny-list keeps new Catalog
   * entries visible by default and stays valid when refs churn.
   */
  hiddenModelIdsByAgent: Partial<Record<ExternalRendererAgent, string[]>>;
}

interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function rendererStorage(): PreferenceStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const externalAgents = KNOWN_RENDERER_AGENTS.filter(
  (agent): agent is ExternalRendererAgent => agent !== "codex",
);

function readPreference(storage: PreferenceStorage | null): ModelVisibilityPreference | undefined {
  if (!storage) return undefined;
  try {
    const raw = storage.getItem(RENDERER_MODEL_VISIBILITY_KEY);
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1) return undefined;
    const byAgent = isRecord(parsed.hiddenModelIdsByAgent) ? parsed.hiddenModelIdsByAgent : {};
    const hiddenModelIdsByAgent = Object.fromEntries(
      externalAgents.flatMap((agent) => {
        const ids = byAgent[agent];
        if (!Array.isArray(ids)) return [];
        const validated = [
          ...new Set(ids.filter((id): id is string => typeof id === "string" && id.length > 0)),
        ];
        return validated.length > 0 ? [[agent, validated]] : [];
      }),
    ) as ModelVisibilityPreference["hiddenModelIdsByAgent"];
    return { version: 1, hiddenModelIdsByAgent };
  } catch {
    return undefined;
  }
}

function writePreference(
  preference: ModelVisibilityPreference,
  storage: PreferenceStorage | null,
): void {
  if (!storage) return;
  try {
    storage.setItem(RENDERER_MODEL_VISIBILITY_KEY, JSON.stringify(preference));
  } catch {
    // Visibility persistence must not prevent Composer configuration.
  }
}

export function readHiddenModelIds(
  agent: ExternalRendererAgent,
  storage: PreferenceStorage | null = rendererStorage(),
): ReadonlySet<string> {
  return new Set(readPreference(storage)?.hiddenModelIdsByAgent[agent] ?? []);
}

export function setExternalModelHidden(
  agent: ExternalRendererAgent,
  modelRefId: string,
  hidden: boolean,
  storage: PreferenceStorage | null = rendererStorage(),
): void {
  if (modelRefId.length === 0) return;
  const current = readPreference(storage);
  const ids = new Set(current?.hiddenModelIdsByAgent[agent] ?? []);
  if (hidden) ids.add(modelRefId);
  else ids.delete(modelRefId);
  const hiddenModelIdsByAgent = Object.fromEntries(
    externalAgents.flatMap((candidate) => {
      const candidateIds =
        candidate === agent ? [...ids] : (current?.hiddenModelIdsByAgent[candidate] ?? []);
      return candidateIds.length > 0 ? [[candidate, candidateIds]] : [];
    }),
  ) as ModelVisibilityPreference["hiddenModelIdsByAgent"];
  writePreference({ version: 1, hiddenModelIdsByAgent }, storage);
}

/**
 * Applies the stored visibility preference to a Harness Model Catalog for
 * display. Models named in `keepRefIds` (an existing Thread's Model, the
 * current draft selection) always stay visible so locked-thread recovery and
 * the active selection are never broken by a display preference. Fails open:
 * when the preference would empty the Catalog, the Catalog is returned
 * unchanged.
 */
export function visibleExternalModelCatalog(
  agent: ExternalRendererAgent,
  catalog: HarnessModelCatalog,
  keepRefIds: readonly string[] = [],
  storage: PreferenceStorage | null = rendererStorage(),
): HarnessModelCatalog {
  const hidden = readHiddenModelIds(agent, storage);
  if (hidden.size === 0) return catalog;
  const keep = new Set(keepRefIds);
  const models = catalog.models.filter(
    (model) => keep.has(model.ref.id) || !hidden.has(model.ref.id),
  );
  if (models.length === 0 || models.length === catalog.models.length) return catalog;
  if (catalog.defaultModel === undefined) return { ...catalog, models };
  const defaultModelVisible = models.some((model) => model.ref.id === catalog.defaultModel?.id);
  const defaultModel = defaultModelVisible ? catalog.defaultModel : models[0]?.ref;
  return {
    ...catalog,
    models,
    ...(defaultModel ? { defaultModel } : {}),
  };
}
