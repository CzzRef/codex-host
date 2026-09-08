import { describe, expect, it } from "vitest";
import { turnSubtitle } from "../src/renderer-turn-subtitle.js";

describe("turn subtitles", () => {
  it("extracts the action clause after context and removes conversational scaffolding", () => {
    const prompt =
      "目前我在很长的对话里找不到上一次操作。请帮我增加轮次快速跳转；同时保留完整原文。";
    expect(turnSubtitle(prompt, true)).toBe("增加轮次快速跳转");
    expect(prompt).toContain("目前我在很长的对话");
    expect(
      turnSubtitle("The old preview closes. Could you please keep the file detail open?"),
    ).toBe("keep the file detail open");
  });
  it("ignores code and link markup and keeps Chinese task words", () => {
    expect(
      turnSubtitle(
        "```ts\nthrow new Error('broken');\n```\n请修复 [工作区选择](https://example.test)。",
        true,
      ),
    ).toBe("修复 工作区选择");
  });
  it("bounds display text without replacing or mutating the input", () => {
    const prompt = "请检查" + "工作区目录与回滚动作".repeat(10);
    expect(Array.from(turnSubtitle(prompt, true))).toHaveLength(22);
    expect(turnSubtitle(prompt, true)).toMatch(/^检查.*…$/u);
    expect(turnSubtitle("", true)).toBe("本轮提问");
    expect(turnSubtitle("a short request")).toBe("a short request");
    expect(turnSubtitle("3D 模型", true)).toBe("3D 模型");
  });
});
