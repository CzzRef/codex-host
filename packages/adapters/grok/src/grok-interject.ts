/**
 * Grok CLI exposes its ACP extension methods under the `_x.ai/` prefix, like
 * `_x.ai/session/fork` and `_x.ai/rewind/execute`. The unprefixed
 * `x.ai/interject` answers `-32601 Method not found` on grok 1.0.13.
 *
 * `_x.ai/interject` queues the text for the running prompt and delivers it at
 * the prompt's next model-call boundary as a synthetic user message inside the
 * same Native Turn: the prompt keeps its `prompt_id` and still persists exactly
 * one `turn_completed`.
 */
export const GROK_INTERJECT_METHOD = "_x.ai/interject";

export interface GrokInterjectParams {
  sessionId: string;
  text: string;
}

/** grok 1.0.13 answers `{ result: { status: "queued" } }`. */
export interface GrokInterjectResult {
  status?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function buildGrokInterjectParams(sessionId: string, text: string): GrokInterjectParams {
  return { sessionId, text };
}

export function parseGrokInterjectResult(value: unknown): GrokInterjectResult {
  if (!isRecord(value)) return {};
  const payload = isRecord(value.result) ? value.result : value;
  return typeof payload.status === "string" && payload.status.length > 0
    ? { status: payload.status }
    : {};
}

/**
 * grok 1.0.13 persists a delivered interjection as a synthetic user message
 * wrapped in its own template, followed by a trailing instruction line
 * ("Make sure to complete any unfinished tasks from previous turns.", live
 * probe 2026-09-02). The Host shows the user's words, not the template; an
 * unrecognized shape is kept verbatim rather than dropped.
 */
const GROK_INTERJECTION_WRAPPER =
  /^\s*The user sent a message while you were working:\s*<user_query>\s*([\s\S]*?)\s*<\/user_query>[\s\S]*$/u;

export function unwrapGrokInterjection(text: string): string {
  const match = GROK_INTERJECTION_WRAPPER.exec(text);
  return match?.[1] !== undefined && match[1].length > 0 ? match[1] : text;
}
