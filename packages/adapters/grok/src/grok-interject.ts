export const GROK_INTERJECT_METHOD = "x.ai/interject";

export interface GrokInterjectParams {
  sessionId: string;
  prompt: Array<{ type: "text"; text: string }>;
}

export interface GrokInterjectResult {
  interjectionId?: string;
  queued?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function buildGrokInterjectParams(sessionId: string, text: string): GrokInterjectParams {
  return {
    sessionId,
    prompt: [{ type: "text", text }],
  };
}

export function parseGrokInterjectResult(value: unknown): GrokInterjectResult {
  if (!isRecord(value)) return {};
  const interjectionId =
    typeof value.interjectionId === "string" && value.interjectionId.length > 0
      ? value.interjectionId
      : typeof value.interjection_id === "string" && value.interjection_id.length > 0
        ? value.interjection_id
        : undefined;
  const queued = typeof value.queued === "boolean" ? value.queued : undefined;
  return {
    ...(interjectionId ? { interjectionId } : {}),
    ...(queued !== undefined ? { queued } : {}),
  };
}
