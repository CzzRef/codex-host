import { watch, type FSWatcher } from "node:fs";
import { mkdir, readdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { hostThreadIdSchema } from "@codexhost/shared-contracts";

export const CODEXHOST_TITLE_OVERLAY_DIRNAME = "title-overlays";

export function defaultTitleOverlayDirectory(environment: NodeJS.ProcessEnv): string {
  const dataDirectory = environment.CODEXHOST_DATA_DIR;
  return path.join(
    dataDirectory ? path.resolve(dataDirectory) : path.join(os.homedir(), ".codexhost"),
    CODEXHOST_TITLE_OVERLAY_DIRNAME,
  );
}

export function titleOverlayPath(directory: string, threadId: string): string {
  return path.join(directory, `${threadId}.json`);
}

export function overlayThreadIdFromFilename(filename: string): string | undefined {
  if (!filename.endsWith(".json")) return undefined;
  const threadId = filename.slice(0, -".json".length);
  return hostThreadIdSchema.safeParse(threadId).success ? threadId : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseCodexhostTitleOverlay(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const text =
    typeof value.title === "string" && value.title.trim().length > 0
      ? value.title.trim()
      : typeof value.session_summary === "string" && value.session_summary.trim().length > 0
        ? value.session_summary.trim()
        : undefined;
  return text && text.length <= 120 ? text : undefined;
}

export async function readTitleOverlay(
  directory: string,
  threadId: string,
): Promise<string | undefined> {
  try {
    return parseCodexhostTitleOverlay(
      JSON.parse(await readFile(titleOverlayPath(directory, threadId), "utf8")),
    );
  } catch {
    return undefined;
  }
}

export interface TitleOverlayWatch {
  start(): Promise<void>;
  dispose(): void;
}

export function createTitleOverlayWatch(input: {
  directory: string;
  onTitle(threadId: string, title: string): void;
}): TitleOverlayWatch {
  let watcher: FSWatcher | null = null;
  let disposed = false;
  const pending = new Map<string, ReturnType<typeof setTimeout>>();

  const emit = (threadId: string): void => {
    const previous = pending.get(threadId);
    if (previous) clearTimeout(previous);
    pending.set(
      threadId,
      setTimeout(() => {
        pending.delete(threadId);
        void readTitleOverlay(input.directory, threadId).then((title) => {
          if (!title || disposed) return;
          input.onTitle(threadId, title);
        });
      }, 50),
    );
  };

  return {
    async start(): Promise<void> {
      await mkdir(input.directory, { recursive: true });
      const entries = await readdir(input.directory, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const threadId = overlayThreadIdFromFilename(entry.name);
        if (threadId) emit(threadId);
      }
      if (disposed) return;
      watcher = watch(input.directory, { persistent: false }, (_event, filename) => {
        const name = filename == null ? undefined : String(filename);
        const threadId = name ? overlayThreadIdFromFilename(name) : undefined;
        if (threadId) emit(threadId);
      });
    },
    dispose(): void {
      disposed = true;
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
      watcher?.close();
      watcher = null;
    },
  };
}
