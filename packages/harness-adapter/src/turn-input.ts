import type { HostFileInput, HostInput, HostTextInput } from "./text-session.js";

/**
 * Text parts of a Turn input, joined the way every Adapter already joined
 * them before file parts existed.
 *
 * This helper deliberately does not represent file parts: an Adapter that
 * only sends text must declare no file-input capability, and Host rejects a
 * Turn carrying file parts for such a Session before dispatch. Dropping a file
 * part silently is never correct — the user believes it was sent while the
 * Agent never sees it.
 */
export function hostInputText(input: readonly HostInput[]): string {
  return input
    .filter((part): part is HostTextInput => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

/** File parts of a Turn input, in the order the Host sent them. */
export function hostInputFiles(input: readonly HostInput[]): HostFileInput[] {
  return input.filter((part): part is HostFileInput => part.type === "file");
}

/**
 * Marker that opens the line standing in for a file part wherever only text
 * can travel — a Harness whose native protocol takes a plain prompt string,
 * and the Codex UI projection of a historical Turn.
 *
 * codexhost never parses this line back into a file part; it is only ever
 * generated. So there is no parser here for a user to fool. What a user can
 * still do is type a lookalike line and mislead the Agent, which is inherent
 * to any text channel and is not claimed to be prevented. What the escaping
 * below does guarantee is that a path can never introduce extra lines of its
 * own.
 */
export const HOST_FILE_INPUT_MARKER = "[attachment]";

/** One deterministic line naming a file part by absolute path. */
export function hostFileInputLine(file: HostFileInput): string {
  const path = file.path.replace(/[\r\n]+/g, " ");
  return `${HOST_FILE_INPUT_MARKER} ${path} (${file.mediaType}, ${file.bytes} bytes)`;
}

/**
 * Prompt text for a Harness that cannot carry file parts: the user's text
 * first, then one line per file part. File parts are never dropped here —
 * degraded into a path the Agent can read for itself, they stay usable.
 */
export function hostInputPromptText(input: readonly HostInput[]): string {
  const text = hostInputText(input);
  const files = hostInputFiles(input).map((file) => hostFileInputLine(file));
  if (files.length === 0) return text;
  return text.length > 0 ? [text, ...files].join("\n") : files.join("\n");
}
