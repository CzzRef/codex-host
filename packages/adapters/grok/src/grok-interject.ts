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
