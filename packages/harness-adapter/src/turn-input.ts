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
