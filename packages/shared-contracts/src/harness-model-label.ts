import type { HarnessModelCatalog } from "./harness-models.js";

/**
 * Separator between a Harness abbreviation and the Model name.
 *
 * A middle dot rather than ` / `: the Composer trigger clips its label with
 * `text-overflow: ellipsis`, so every character spent on the separator is a
 * character of Model name the user stops seeing. The dot also reads as one
 * token, which keeps the prefix from looking like a Provider path segment —
 * the shape this label deliberately no longer carries.
 */
export const HARNESS_MODEL_LABEL_SEPARATOR = "·";

/**
 * Lowercase 2–3 letter abbreviation per Harness, shown in front of every Model
 * label so the Composer trigger says which Agent the Thread runs on without
 * opening the Agent picker, and so typing `ds` filters that Harness's models
 * in the Model menu (the search index is built from the label).
 *
 * Every shipped Harness MUST have an entry here; `harness-model-label.test.ts`
 * fails when a preinstalled plugin is missing one. Adding a Harness therefore
 * means adding its abbreviation, which is the general rule the fallback below
 * only approximates.
 */
export const HARNESS_MODEL_LABEL_ABBREVIATIONS: Readonly<Record<string, string>> = Object.freeze({
  antigravity: "ag",
  "claude-code": "cc",
  cursor: "cs",
  "deepseek-harness": "ds",
  grok: "gk",
  omp: "omp",
  opencode: "oc",
  pi: "pi",
});

const MAX_ABBREVIATION_LENGTH = 3;

/**
 * Fallback for a Harness with no explicit entry. It reproduces how the known
 * abbreviations were chosen for compound names — the initials of the parts
 * (`deepseek-harness` → `ds` via deep+seek is the one case the parts do not
 * give, which is exactly why the table above is the authority) — and otherwise
 * takes the first two letters. It never throws: an unknown Harness gets a
 * usable label rather than a broken catalog.
 */
function deriveAbbreviation(harnessId: string): string {
  const normalized = harnessId
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
  if (!normalized) return "??";
  const parts = normalized.split(" ").filter(Boolean);
  if (parts.length > 1) {
    const initials = parts.map((part) => part[0] ?? "").join("");
    return initials.slice(0, MAX_ABBREVIATION_LENGTH);
  }
  const only = parts[0] ?? "";
  return only.length <= MAX_ABBREVIATION_LENGTH ? only : only.slice(0, 2);
}

export function harnessModelLabelAbbreviation(harnessId: string): string {
  return HARNESS_MODEL_LABEL_ABBREVIATIONS[harnessId] ?? deriveAbbreviation(harnessId);
}

export function harnessModelLabelPrefix(harnessId: string): string {
  return `${harnessModelLabelAbbreviation(harnessId)}${HARNESS_MODEL_LABEL_SEPARATOR}`;
}

export function isHarnessModelLabelPrefixed(harnessId: string, label: string): boolean {
  return label.startsWith(harnessModelLabelPrefix(harnessId));
}

/**
 * Apply the Harness prefix to a single Model label.
 *
 * The catalog is not the only place a Model name reaches a reader: Session
 * state carries `resolvedModelLabel`, which Desktop and the delegation CLI
 * project on inspect and after every Model / Thinking / Permission selection.
 * Leaving that one unprefixed would show the same Model as `ds·Model One` in
 * the picker and `Model One` in the delegation output. Same idempotence rule
 * as the catalog projection.
 */
export function prefixHarnessModelLabel(harnessId: string, label: string): string {
  const prefix = harnessModelLabelPrefix(harnessId);
  return label.startsWith(prefix) ? label : `${prefix}${label}`;
}

/**
 * Apply the Harness prefix to every Model label in a catalog.
 *
 * Idempotent on purpose: the Host projects a catalog on `harness/inspect` and
 * again through the delegation coordinator, and a cached inspection can reach
 * either path twice. Prefixing an already-prefixed label would compound.
 */
export function prefixHarnessModelCatalogLabels(
  harnessId: string,
  catalog: HarnessModelCatalog,
): HarnessModelCatalog {
  const prefix = harnessModelLabelPrefix(harnessId);
  return {
    ...catalog,
    models: catalog.models.map((model) =>
      model.label.startsWith(prefix) ? model : { ...model, label: `${prefix}${model.label}` },
    ),
  };
}
