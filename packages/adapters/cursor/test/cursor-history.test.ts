import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { harnessIdSchema } from "@codexhost/shared-contracts";

import {
  mapCursorHistory,
  readCursorNativeMessages,
  writeCursorSessionStore,
} from "../src/cursor-history.js";

const cursorId = harnessIdSchema.parse("cursor");
const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("Cursor native history", () => {
  it("walks the ACP store root and skips system plus user_info blobs", () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "cursor-history-"));
    directories.push(directory);
    writeCursorSessionStore(directory, {
      sessionId: "native-cursor-session",
      cwd: "/synthetic",
      title: "Cursor Host OK",
      messages: [
        { role: "system", content: "You are GPT" },
        { role: "user", content: "<user_info>\nOS: macOS\n</user_info>" },
        {
          role: "user",
          content: [{ type: "text", text: "Reply with exactly CODEXHOST_CURSOR_OK" }],
        },
        {
          role: "assistant",
          id: "asst-1",
          content: [{ type: "text", text: "CODEXHOST_CURSOR_OK" }],
        },
      ],
    });
    const messages = readCursorNativeMessages(directory);
    expect(messages).toEqual([
      {
        blobId: expect.any(String),
        role: "user",
        text: "Reply with exactly CODEXHOST_CURSOR_OK",
      },
      {
        blobId: expect.any(String),
        role: "assistant",
        text: "CODEXHOST_CURSOR_OK",
        nativeId: "asst-1",
      },
    ]);
    const snapshot = mapCursorHistory(messages, cursorId, "native-cursor-session");
    expect(snapshot.turns).toHaveLength(1);
    expect(snapshot.turns[0]).toMatchObject({
      nativeTurnRef: {
        harnessId: "cursor",
        nativeSessionId: "native-cursor-session",
        nativeTurnKey: "asst-1",
      },
      input: [{ type: "text", text: "Reply with exactly CODEXHOST_CURSOR_OK" }],
      items: [{ item: { type: "agentMessage", text: "CODEXHOST_CURSOR_OK" } }],
      outcome: { status: "succeeded" },
    });
  });

  it("reuses known NativeTurnRef keys when the assistant id is stable", () => {
    const snapshot = mapCursorHistory(
      [
        { blobId: "user-1", role: "user", text: "one" },
        { blobId: "asst-blob", role: "assistant", text: "two", nativeId: "asst-1" },
      ],
      cursorId,
      "native-cursor-session",
      [
        {
          harnessId: cursorId,
          nativeSessionId: "native-cursor-session",
          nativeTurnKey: "asst-1",
          formatVersion: 1,
        },
      ],
    );
    expect(snapshot.turns[0]?.nativeTurnRef.nativeTurnKey).toBe("asst-1");
  });
});
