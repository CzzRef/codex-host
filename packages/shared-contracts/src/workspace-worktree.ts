import { z } from "zod";

import {
  THREAD_WORKSPACE_BRANCH_MAX_LENGTH,
  THREAD_WORKSPACE_NAME_MAX_LENGTH,
  THREAD_WORKSPACE_PATH_MAX_LENGTH,
  THREAD_WORKSPACE_SHA_MAX_LENGTH,
} from "./thread-workspace.js";

const nonBlankTextSchema = z.string().refine((value) => value.trim().length > 0, {
  message: "Value must not be empty or whitespace",
});

export const WORKSPACE_WORKTREE_LIST_METHOD = "codexhost/workspace/worktree/list";
export const WORKSPACE_WORKTREE_CREATE_METHOD = "codexhost/workspace/worktree/create";
export const WORKSPACE_WORKTREE_MAX_LENGTH = 128;

/**
 * Host-managed worktree names follow the CodeNote convention: a `yyMMdd`
 * date (GMT+8) and a short lowercase functional core, e.g.
 * `260903-worktree-picker`. The Host places the checkout under
 * `{parent}/{Repo}-worktrees/{lane}/{name}` on branch `{lane}/{name}` and
 * never deletes anything.
 */
export const WORKSPACE_WORKTREE_NAME_PATTERN = /^\d{6}-[a-z0-9][a-z0-9-]{1,40}$/u;

export const workspaceWorktreeLaneSchema = z.enum(["codex", "claude", "cursor", "group"]);
export type WorkspaceWorktreeLane = z.infer<typeof workspaceWorktreeLaneSchema>;

export const workspaceWorktreeNameSchema = z
  .string()
  .regex(WORKSPACE_WORKTREE_NAME_PATTERN, "Worktree name must match yyMMdd-<lowercase-core>");

export const workspaceWorktreeEntrySchema = z
  .object({
    root: nonBlankTextSchema.max(THREAD_WORKSPACE_PATH_MAX_LENGTH),
    name: nonBlankTextSchema.max(THREAD_WORKSPACE_NAME_MAX_LENGTH),
    branch: nonBlankTextSchema.max(THREAD_WORKSPACE_BRANCH_MAX_LENGTH).nullable(),
    headSha: nonBlankTextSchema.max(THREAD_WORKSPACE_SHA_MAX_LENGTH),
    /** Lane inferred from the branch prefix or path; `null` for foreign layouts. */
    lane: workspaceWorktreeLaneSchema.nullable(),
    dirty: z.boolean(),
    isPrimary: z.boolean(),
  })
  .strict();
export type WorkspaceWorktreeEntry = z.infer<typeof workspaceWorktreeEntrySchema>;

export const workspaceWorktreeListParamsSchema = z
  .object({
    /** Any directory inside the checkout family (primary or a linked worktree). */
    projectRoot: nonBlankTextSchema.max(THREAD_WORKSPACE_PATH_MAX_LENGTH),
  })
  .strict();
export type WorkspaceWorktreeListParams = z.infer<typeof workspaceWorktreeListParamsSchema>;

export const workspaceWorktreeListResultSchema = z
  .object({
    primaryRoot: nonBlankTextSchema.max(THREAD_WORKSPACE_PATH_MAX_LENGTH),
    worktrees: z.array(workspaceWorktreeEntrySchema).max(WORKSPACE_WORKTREE_MAX_LENGTH),
    /** `yyMMdd-` prefix the picker prefills for a new name. */
    suggestedName: z.string().max(THREAD_WORKSPACE_NAME_MAX_LENGTH),
  })
  .strict();
export type WorkspaceWorktreeListResult = z.infer<typeof workspaceWorktreeListResultSchema>;

export const workspaceWorktreeCreateParamsSchema = z
  .object({
    projectRoot: nonBlankTextSchema.max(THREAD_WORKSPACE_PATH_MAX_LENGTH),
    name: workspaceWorktreeNameSchema,
    lane: workspaceWorktreeLaneSchema.optional(),
    baseRef: nonBlankTextSchema.max(THREAD_WORKSPACE_BRANCH_MAX_LENGTH).optional(),
  })
  .strict();
export type WorkspaceWorktreeCreateParams = z.infer<typeof workspaceWorktreeCreateParamsSchema>;

export const workspaceWorktreeCreateResultSchema = z
  .object({
    primaryRoot: nonBlankTextSchema.max(THREAD_WORKSPACE_PATH_MAX_LENGTH),
    worktree: workspaceWorktreeEntrySchema,
  })
  .strict();
export type WorkspaceWorktreeCreateResult = z.infer<typeof workspaceWorktreeCreateResultSchema>;

/** Branch a Host-managed worktree is created on. */
export function workspaceWorktreeBranch(lane: WorkspaceWorktreeLane, name: string): string {
  return `${lane}/${name}`;
}

/** `yyMMdd-` in GMT+8, the date part of a new worktree name. */
export function suggestedWorkspaceWorktreeName(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1_000);
  const yy = String(shifted.getUTCFullYear() % 100).padStart(2, "0");
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(shifted.getUTCDate()).padStart(2, "0");
  return `${yy}${mm}${dd}-`;
}

const CORE_MAX_LENGTH = 28;

/**
 * A complete `yyMMdd-core` name, so picking a new worktree does not ask the
 * user to invent one. The core comes from what they already typed in the
 * Composer; a prompt with no ASCII words (Chinese, for example) cannot produce
 * a readable slug, so it falls back to the GMT+8 time, which still says when
 * the worktree was made. `taken` disambiguates with a numeric suffix.
 */
export function suggestWorkspaceWorktreeName(
  input: {
    hint?: string | null;
    now?: Date;
    taken?: readonly string[];
    /** `yyMMdd-` from the Host, so the date does not come from the browser. */
    prefix?: string;
  } = {},
): string {
  const now = input.now ?? new Date();
  const prefix =
    input.prefix && /^\d{6}-$/u.test(input.prefix)
      ? input.prefix
      : suggestedWorkspaceWorktreeName(now);
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1_000);
  const clock = `${String(shifted.getUTCHours()).padStart(2, "0")}${String(
    shifted.getUTCMinutes(),
  ).padStart(2, "0")}`;
  const slug = (input.hint ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, CORE_MAX_LENGTH)
    .replace(/-+$/u, "");
  const core = slug.length >= 2 ? slug : `wt-${clock}`;
  const taken = new Set(input.taken ?? []);
  let candidate = `${prefix}${core}`;
  for (let suffix = 2; taken.has(candidate); suffix += 1) candidate = `${prefix}${core}-${suffix}`;
  return candidate;
}

/** Lane implied by a branch like `codex/260903-x`; `null` for other layouts. */
export function workspaceWorktreeLaneFromBranch(branch: string | null): WorkspaceWorktreeLane | null {
  if (!branch) return null;
  const prefix = branch.split("/")[0];
  const parsed = workspaceWorktreeLaneSchema.safeParse(prefix);
  return parsed.success && branch.includes("/") ? parsed.data : null;
}
