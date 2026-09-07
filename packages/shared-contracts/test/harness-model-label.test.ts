import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  HARNESS_MODEL_LABEL_ABBREVIATIONS,
  HARNESS_MODEL_LABEL_SEPARATOR,
  harnessModelLabelAbbreviation,
  harnessModelLabelPrefix,
  isHarnessModelLabelPrefixed,
  prefixHarnessModelCatalogLabels,
  prefixHarnessModelLabel,
} from "../src/harness-model-label.js";
import { harnessModelCatalogSchema, harnessModelRefSchema } from "../src/harness-models.js";

function catalog(labels: readonly string[]) {
  return harnessModelCatalogSchema.parse({
    models: labels.map((label, index) => ({
      ref: harnessModelRefSchema.parse({ id: `model-${index}` }),
      label,
    })),
    thinkingOptions: [],
  });
}

describe("Harness Model label abbreviations", () => {
  it("uses the declared abbreviation for every shipped Harness", () => {
    expect(HARNESS_MODEL_LABEL_ABBREVIATIONS).toEqual({
      antigravity: "ag",
      "claude-code": "cc",
      cursor: "cs",
      "deepseek-harness": "ds",
      grok: "gk",
      omp: "omp",
      opencode: "oc",
      pi: "pi",
    });
  });

  it("declares an abbreviation for every preinstalled plugin", () => {
    const manifest = JSON.parse(
      readFileSync(
        fileURLToPath(new URL("../../../scripts/release/harness-plugins.json", import.meta.url)),
        "utf8",
      ),
    ) as { plugins: string[] };
    for (const pluginPath of manifest.plugins) {
      const harnessId = JSON.parse(
        readFileSync(
          fileURLToPath(new URL(`../../../${pluginPath}/manifest.json`, import.meta.url)),
          "utf8",
        ),
      ).id as string;
      expect(HARNESS_MODEL_LABEL_ABBREVIATIONS).toHaveProperty(harnessId);
    }
  });

  it("keeps every abbreviation short, lowercase and unique", () => {
    const values = Object.values(HARNESS_MODEL_LABEL_ABBREVIATIONS);
    for (const value of values) expect(value).toMatch(/^[a-z]{2,3}$/u);
    expect(new Set(values).size).toBe(values.length);
  });

  it("derives a usable abbreviation for an unknown Harness", () => {
    expect(harnessModelLabelAbbreviation("oh-my-pi")).toBe("omp");
    expect(harnessModelLabelAbbreviation("gemini-cli")).toBe("gc");
    expect(harnessModelLabelAbbreviation("aider")).toBe("ai");
    expect(harnessModelLabelAbbreviation("zed")).toBe("zed");
    expect(harnessModelLabelAbbreviation("")).toBe("??");
  });

  it("builds the prefix with the middle-dot separator", () => {
    expect(HARNESS_MODEL_LABEL_SEPARATOR).toBe("·");
    expect(harnessModelLabelPrefix("deepseek-harness")).toBe("ds·");
    expect(isHarnessModelLabelPrefixed("pi", "pi·gpt-5.6-sol")).toBe(true);
    expect(isHarnessModelLabelPrefixed("pi", "gpt-5.6-sol")).toBe(false);
  });
});

describe("Session state Model label", () => {
  it("prefixes the resolved label the same way the catalog is prefixed", () => {
    expect(prefixHarnessModelLabel("deepseek-harness", "Model One")).toBe("ds·Model One");
  });

  it("is idempotent so a projected label does not compound", () => {
    expect(prefixHarnessModelLabel("pi", "pi·gpt-5.6-sol")).toBe("pi·gpt-5.6-sol");
  });

  it("agrees with the catalog projection for the same Harness and name", () => {
    const [model] = prefixHarnessModelCatalogLabels("grok", catalog(["grok-4.6"])).models;
    expect(model?.label).toBe(prefixHarnessModelLabel("grok", "grok-4.6"));
  });
});

describe("Model catalog label projection", () => {
  it("prefixes every Model label with the Harness abbreviation", () => {
    const projected = prefixHarnessModelCatalogLabels(
      "deepseek-harness",
      catalog(["DeepSeek V4 Flash", "DeepSeek V4 Pro"]),
    );
    expect(projected.models.map(({ label }) => label)).toEqual([
      "ds·DeepSeek V4 Flash",
      "ds·DeepSeek V4 Pro",
    ]);
  });

  it("is idempotent so a catalog projected twice does not compound", () => {
    const once = prefixHarnessModelCatalogLabels("pi", catalog(["gpt-5.6-sol"]));
    const twice = prefixHarnessModelCatalogLabels("pi", once);
    expect(twice.models.map(({ label }) => label)).toEqual(["pi·gpt-5.6-sol"]);
  });

  it("leaves refs and the rest of the catalog untouched", () => {
    const source = catalog(["grok-4.6"]);
    const projected = prefixHarnessModelCatalogLabels("grok", source);
    expect(projected.models[0]?.ref).toEqual(source.models[0]?.ref);
    expect(projected.thinkingOptions).toEqual(source.thinkingOptions);
  });
});
