import type { HarnessSessionCapabilities } from "@codexhost/shared-contracts";

import type { HarnessError } from "./text-session.js";
import { hostInputFiles } from "./turn-input.js";
import type { HostFileInput, HostInput } from "./text-session.js";

/**
 * What the Host can learn about an attachment without reading it. Callers own
 * the filesystem access so this module stays free of Node built-ins; the probe
 * returns undefined when the path is missing or unreadable.
 */
export type HostFileInputProbe = (path: string) => { size: number } | undefined;

export interface HostFileInputValidationOptions {
  /** Absolute Thread cwd. Attachments must resolve inside it. */
  cwd: string;
  capability: HarnessSessionCapabilities["input"];
  probe: HostFileInputProbe;
}

function invalidRequest(message: string): HarnessError {
  return { code: "invalidRequest", message, retryable: false };
}

/** POSIX and Windows absolute forms; the Host never resolves a relative path. */
function isAbsolutePath(value: string): boolean {
  return value.startsWith("/") || /^[A-Za-z]:[\\/]/u.test(value);
}

function normalizeSeparators(value: string): string {
  return value.replace(/\\/gu, "/");
}

/**
 * True when `candidate` is the root itself or sits under it. Compared on
 * normalized separators with an explicit boundary so `/work/repo-2` never
 * counts as inside `/work/repo`.
 */
function isInsideRoot(candidate: string, root: string): boolean {
  const normalizedRoot = normalizeSeparators(root).replace(/\/+$/u, "");
  const normalizedCandidate = normalizeSeparators(candidate);
  if (normalizedCandidate === normalizedRoot) return true;
  return normalizedCandidate.startsWith(`${normalizedRoot}/`);
}

function containsTraversal(value: string): boolean {
  return normalizeSeparators(value)
    .split("/")
    .some((segment) => segment === "..");
}

function describe(file: HostFileInput): string {
  return file.path;
}

/**
 * Validates every file part of one Turn before it is dispatched.
 *
 * The whole Turn is rejected on the first failure: dispatching the text while
 * dropping an attachment is the one outcome the file-input contract forbids,
 * because the user believes the file was sent while the Agent never sees it.
 *
 * This is not a sandbox. An Agent already reaches the filesystem through its
 * own tools, so the root check exists to turn a wrong path into a clear error,
 * not to confine the Agent.
 */
export function validateHostFileInputs(
  input: readonly HostInput[],
  options: HostFileInputValidationOptions,
): HarnessError | undefined {
  const files = hostInputFiles(input);
  if (files.length === 0) return undefined;
  if (options.capability?.attachFiles !== true) {
    return invalidRequest("Harness Session does not accept file input");
  }
  const { mediaTypes, maxBytes } = options.capability;
  for (const file of files) {
    if (!isAbsolutePath(file.path) || containsTraversal(file.path)) {
      return invalidRequest(`Attachment path must be absolute: ${describe(file)}`);
    }
    if (!isInsideRoot(file.path, options.cwd)) {
      return invalidRequest(`Attachment is outside the Thread directory: ${describe(file)}`);
    }
    if (mediaTypes && !mediaTypes.includes(file.mediaType)) {
      return invalidRequest(
        `Harness Session does not accept ${file.mediaType} attachments: ${describe(file)}`,
      );
    }
    const probed = options.probe(file.path);
    if (!probed) {
      return invalidRequest(`Attachment is missing or unreadable: ${describe(file)}`);
    }
    if (maxBytes !== undefined && probed.size > maxBytes) {
      return invalidRequest(
        `Attachment exceeds the ${maxBytes} byte limit of this Harness: ${describe(file)}`,
      );
    }
  }
  return undefined;
}
