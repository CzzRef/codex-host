/** Extract a compact task clause locally. Never alters the prompt used by actions. */
export function turnSubtitle(prompt: string, chinese = false): string {
  const prose = prompt
    .replace(/```[\s\S]*?```/gu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/^\s*(?:#{1,6}\s+|>\s*|[-*]\s+|\d+[.)、]\s*)/gmu, "")
    .replace(/[`*_]/gu, "");
  const clauses = prose
    .split(/[\n。！？!?；;]|(?<=[.!?])\s+/u)
    .map((text) => text.trim())
    .filter(Boolean);
  const action =
    /修复|改版|调整|增加|添加|移除|删除|支持|实现|优化|检查|核验|分析|设计|创建|整理|更新|保留|保持|展示|改成|改为|需要|希望|\b(?:fix|add|remove|support|implement|update|create|design|check|review|debug|improve|keep|show)\b/iu;
  // Prefer the requested action over a long contextual preamble. A comma is
  // only a candidate boundary; the selected clause keeps its original words.
  const candidates = clauses.flatMap((clause) => {
    const parts = clause.split(/[，,]\s*/u);
    const actionable = parts.filter((part) => action.test(part));
    return actionable.length ? actionable : [clause];
  });
  const chosen = candidates.find((text) => action.test(text)) ?? candidates[0] ?? "";
  const compact = chosen
    .replace(
      /^(?:请问|麻烦|请|能不能|能否|可以|你可以|帮我|帮忙|我想要|我想|我希望|希望你|需要你|先|再|一下|\s)+/u,
      "",
    )
    .replace(
      /^(?:(?:could|can|would) you\s+|please\s+|help me\s+|i (?:want|would like) (?:you )?to\s+)+/iu,
      "",
    )
    .replace(/(?:一下|即可|就行|好吗|吗)[？?]?$/u, "")
    .replace(/\s+/gu, " ")
    .trim();
  if (!compact) return chinese ? "本轮提问" : "Turn request";
  const limit = /[\p{Script=Han}]/u.test(compact) ? 22 : 60;
  const chars = Array.from(compact);
  if (chars.length <= limit) return compact;
  // Preserve the task clause, then bound its display. English ends on a word.
  const head = chars.slice(0, limit - 1).join("");
  return `${/\p{Script=Han}/u.test(head) ? head : head.replace(/\s+\S*$/u, "")}…`;
}
