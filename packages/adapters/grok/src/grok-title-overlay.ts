export const GROK_CODEXHOST_TITLE_OVERLAY_FILE = "codexhost-title.json";

export interface GrokNativeTitle {
  text: string;
  source: "user" | "generated";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseGrokSummaryTitle(value: unknown): GrokNativeTitle | undefined {
  if (!isRecord(value)) return undefined;
  const text =
    typeof value.session_summary === "string" && value.session_summary.trim().length > 0
      ? value.session_summary.trim()
      : undefined;
  if (!text) return undefined;
  return {
    text,
    source: value.title_is_manual === true ? "user" : "generated",
  };
}

export function parseGrokCodexhostTitleOverlay(value: unknown): GrokNativeTitle | undefined {
  if (!isRecord(value)) return undefined;
  const text =
    typeof value.title === "string" && value.title.trim().length > 0
      ? value.title.trim()
      : typeof value.session_summary === "string" && value.session_summary.trim().length > 0
        ? value.session_summary.trim()
        : undefined;
  if (!text) return undefined;
  return {
    text,
    source: value.title_is_manual === false ? "generated" : "user",
  };
}

export function resolveGrokNativeTitle(input: {
  summary?: unknown;
  overlay?: unknown;
}): GrokNativeTitle | undefined {
  return parseGrokCodexhostTitleOverlay(input.overlay) ?? parseGrokSummaryTitle(input.summary);
}
