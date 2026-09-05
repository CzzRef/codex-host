import { ANTIGRAVITY_PERMISSION_MODE_CATALOG } from "@codexhost/adapter-antigravity";
import { CLAUDE_PERMISSION_MODE_CATALOG } from "@codexhost/adapter-claude-code";
import { GROK_PERMISSION_MODE_CATALOG } from "@codexhost/adapter-grok";
import { OMP_PERMISSION_MODE_CATALOG } from "@codexhost/adapter-omp";
import { OPENCODE_PERMISSION_MODE_CATALOG } from "@codexhost/adapter-opencode";
import {
  HARNESS_PERMISSION_MODE_KINDS,
  type HarnessPermissionModeCatalog,
} from "@codexhost/shared-contracts";
import { describe, expect, it } from "vitest";

/**
 * Every Harness names its Permission Modes differently. The shared vocabulary
 * is what the Composer offers, so each static catalog has to say which shared
 * choice its native Modes stand for — otherwise the menu silently differs per
 * agent again.
 */
const catalogs: Array<[string, HarnessPermissionModeCatalog]> = [
  ["claude-code", CLAUDE_PERMISSION_MODE_CATALOG],
  ["grok", GROK_PERMISSION_MODE_CATALOG],
  ["omp", OMP_PERMISSION_MODE_CATALOG],
  ["opencode", OPENCODE_PERMISSION_MODE_CATALOG],
  ["antigravity", ANTIGRAVITY_PERMISSION_MODE_CATALOG],
];

describe("shared Permission Mode vocabulary", () => {
  it.each(catalogs)("%s tags every native Mode with a known shared choice", (_name, catalog) => {
    for (const mode of catalog.modes) {
      if (mode.canonical === undefined) continue;
      expect(HARNESS_PERMISSION_MODE_KINDS).toContain(mode.canonical);
    }
  });

  it.each(catalogs)("%s offers a bypass choice", (_name, catalog) => {
    const bypass = catalog.modes.find((mode) => mode.canonical === "bypass");
    expect(bypass).toBeDefined();
    // Bypass always drops approvals, so it must be marked dangerous.
    expect(bypass?.dangerous).toBe(true);
  });

  it.each(catalogs)("%s maps each shared choice at most once", (_name, catalog) => {
    const seen = new Set<string>();
    for (const mode of catalog.modes) {
      if (!mode.canonical) continue;
      expect(seen.has(mode.canonical)).toBe(false);
      seen.add(mode.canonical);
    }
  });
});
