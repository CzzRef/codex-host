import { describe, expect, it } from "vitest";

import {
  isComposerStopLabel,
  normalizeComposerPrompt,
  promptReuseStorageKey,
  readStoredPrompt,
  reusablePromptRemainder,
  shouldAcceptPromptTab,
  shouldQueueComposerPrompt,
  shouldRevealPromptGhost,
  writeStoredPrompt,
} from "../src/renderer-composer-prompt-reuse.js";

describe("composer prompt reuse", () => {
  it("returns the unused suffix when typed text prefixes the last prompt", () => {
    expect(reusablePromptRemainder("验收一下当前改动", "")).toBe("验收一下当前改动");
    expect(reusablePromptRemainder("验收一下当前改动", "验收")).toBe("一下当前改动");
    expect(reusablePromptRemainder("验收一下当前改动", "验收一下当前改动")).toBeNull();
    expect(reusablePromptRemainder("验收一下当前改动", "别的")).toBeNull();
  });

  it("accepts Tab only for a live remainder without competing UI", () => {
    const allowed = {
      remainder: "一下",
      shiftKey: false,
      altKey: false,
      metaKey: false,
      ctrlKey: false,
      composing: false,
      competing: false,
    };
    expect(shouldAcceptPromptTab(allowed)).toBe(true);
    expect(shouldAcceptPromptTab({ ...allowed, shiftKey: true })).toBe(false);
    expect(shouldAcceptPromptTab({ ...allowed, competing: true })).toBe(false);
    expect(shouldAcceptPromptTab({ ...allowed, remainder: null })).toBe(false);
  });

  it("queues the next prompt only while a turn is running, then reveals it when idle", () => {
    expect(isComposerStopLabel("Stop")).toBe(true);
    expect(isComposerStopLabel("Send")).toBe(false);
    expect(shouldQueueComposerPrompt({ turnBusy: true, prompt: "第二段" })).toBe(true);
    expect(shouldQueueComposerPrompt({ turnBusy: false, prompt: "第二段" })).toBe(false);
    expect(shouldQueueComposerPrompt({ turnBusy: true, prompt: "" })).toBe(false);
    expect(shouldRevealPromptGhost({ remainder: "第二段", turnBusy: true })).toBe(false);
    expect(shouldRevealPromptGhost({ remainder: "第二段", turnBusy: false })).toBe(true);
  });

  it("persists a trimmed prompt per Thread", () => {
    const storage = new Map<string, string>();
    const adapter = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    };
    writeStoredPrompt(adapter, "thread-a", "  验收一下  \n");
    expect(promptReuseStorageKey("thread-a")).toBe("codexhost.prompt-reuse:thread-a");
    expect(readStoredPrompt(adapter, "thread-a")).toBe("验收一下");
    writeStoredPrompt(adapter, "thread-a", "   ");
    expect(readStoredPrompt(adapter, "thread-a")).toBe("");
    expect(normalizeComposerPrompt("a\u00a0b  \n")).toBe("a b");
  });
});
