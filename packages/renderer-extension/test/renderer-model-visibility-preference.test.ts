import { harnessModelCatalogSchema, harnessModelRefSchema } from "@codexhost/shared-contracts";
import { describe, expect, it } from "vitest";

import {
  RENDERER_MODEL_VISIBILITY_KEY,
  readHiddenModelIds,
  setExternalModelHidden,
  visibleExternalModelCatalog,
} from "../src/renderer-model-visibility-preference.js";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

const sol = harnessModelRefSchema.parse({ id: "gpt-5.6-sol" });
const luna = harnessModelRefSchema.parse({ id: "gpt-5.6-luna" });
const terra = harnessModelRefSchema.parse({ id: "gpt-5.6-terra" });
const catalog = harnessModelCatalogSchema.parse({
  models: [
    { ref: sol, label: "openai-codex / gpt-5.6-sol" },
    { ref: luna, label: "openai-codex / gpt-5.6-luna" },
    { ref: terra, label: "openai-codex / gpt-5.6-terra" },
  ],
  defaultModel: sol,
  thinkingOptions: [],
});

describe("Renderer model visibility preference", () => {
  it("round-trips hidden Model refs per Harness", () => {
    const storage = memoryStorage();
    setExternalModelHidden("omp", luna.id, true, storage);
    expect(storage.values.has(RENDERER_MODEL_VISIBILITY_KEY)).toBe(true);
    expect([...readHiddenModelIds("omp", storage)]).toEqual([luna.id]);
    expect(readHiddenModelIds("pi", storage).size).toBe(0);

    setExternalModelHidden("omp", luna.id, false, storage);
    expect(readHiddenModelIds("omp", storage).size).toBe(0);
  });

  it("filters hidden Models from the displayed catalog", () => {
    const storage = memoryStorage();
    setExternalModelHidden("omp", luna.id, true, storage);
    const visible = visibleExternalModelCatalog("omp", catalog, [], storage);
    expect(visible.models.map((model) => model.ref.id)).toEqual([sol.id, terra.id]);
    expect(visible.defaultModel).toEqual(sol);
  });

  it("keeps a Model named in keepRefIds visible even when hidden", () => {
    const storage = memoryStorage();
    setExternalModelHidden("omp", luna.id, true, storage);
    const visible = visibleExternalModelCatalog("omp", catalog, [luna.id], storage);
    expect(visible.models.map((model) => model.ref.id)).toEqual([sol.id, luna.id, terra.id]);
  });

  it("re-elects the default Model when the stored default is hidden", () => {
    const storage = memoryStorage();
    setExternalModelHidden("omp", sol.id, true, storage);
    const visible = visibleExternalModelCatalog("omp", catalog, [], storage);
    expect(visible.models.map((model) => model.ref.id)).toEqual([luna.id, terra.id]);
    expect(visible.defaultModel).toEqual(luna);
  });

  it("fails open when the preference would hide every Model", () => {
    const storage = memoryStorage();
    setExternalModelHidden("omp", sol.id, true, storage);
    setExternalModelHidden("omp", luna.id, true, storage);
    setExternalModelHidden("omp", terra.id, true, storage);
    expect(visibleExternalModelCatalog("omp", catalog, [], storage)).toEqual(catalog);
  });

  it("ignores corrupt stored values", () => {
    const storage = memoryStorage();
    storage.values.set(RENDERER_MODEL_VISIBILITY_KEY, "not json");
    expect(readHiddenModelIds("omp", storage).size).toBe(0);
    expect(visibleExternalModelCatalog("omp", catalog, [], storage)).toEqual(catalog);
  });
});
