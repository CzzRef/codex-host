import { z } from "zod";

import { hostThreadIdSchema } from "./ids.js";

const nonBlankTextSchema = z.string().refine((value) => value.trim().length > 0, {
  message: "Value must not be empty or whitespace",
});

const nonNegativeSafeIntegerSchema = z.number().int().safe().nonnegative();

export const THREAD_WORKSPACE_REPOSITORY_MAX_LENGTH = 64;
export const THREAD_WORKSPACE_PATH_MAX_LENGTH = 16_384;
export const THREAD_WORKSPACE_NAME_MAX_LENGTH = 256;
export const THREAD_WORKSPACE_BRANCH_MAX_LENGTH = 256;
export const THREAD_WORKSPACE_SHA_MAX_LENGTH = 64;

export const threadWorkspaceRepositoryKindSchema = z.enum(["primary", "submodule"]);
export type ThreadWorkspaceRepositoryKind = z.infer<typeof threadWorkspaceRepositoryKindSchema>;

export const threadWorkspaceRepositorySchema = z
  .object({
    root: nonBlankTextSchema.max(THREAD_WORKSPACE_PATH_MAX_LENGTH),
    name: nonBlankTextSchema.max(THREAD_WORKSPACE_NAME_MAX_LENGTH),
    kind: threadWorkspaceRepositoryKindSchema,
    branch: nonBlankTextSchema.max(THREAD_WORKSPACE_BRANCH_MAX_LENGTH).nullable(),
    headSha: nonBlankTextSchema.max(THREAD_WORKSPACE_SHA_MAX_LENGTH),
    isWorktree: z.boolean(),
    worktreeName: nonBlankTextSchema.max(THREAD_WORKSPACE_NAME_MAX_LENGTH).nullable(),
    primaryRoot: nonBlankTextSchema.max(THREAD_WORKSPACE_PATH_MAX_LENGTH).nullable(),
    addedLines: nonNegativeSafeIntegerSchema,
    deletedLines: nonNegativeSafeIntegerSchema,
    dirty: z.boolean(),
  })
  .strict()
  .superRefine((repository, context) => {
    if (repository.isWorktree && repository.worktreeName === null) {
      context.addIssue({
        code: "custom",
        message: "Worktree repositories must include a worktree name",
        path: ["worktreeName"],
      });
    }
    if (!repository.isWorktree && repository.worktreeName !== null) {
      context.addIssue({
        code: "custom",
        message: "Primary checkouts must not include a worktree name",
        path: ["worktreeName"],
      });
    }
  });

export type ThreadWorkspaceRepository = z.infer<typeof threadWorkspaceRepositorySchema>;

export const threadWorkspaceInspectParamsSchema = z
  .object({
    threadId: hostThreadIdSchema,
  })
  .strict();

export type ThreadWorkspaceInspectParams = z.infer<typeof threadWorkspaceInspectParamsSchema>;

export const threadWorkspaceSnapshotSchema = z
  .object({
    threadId: hostThreadIdSchema,
    cwd: nonBlankTextSchema.max(THREAD_WORKSPACE_PATH_MAX_LENGTH).nullable(),
    repositories: z
      .array(threadWorkspaceRepositorySchema)
      .max(THREAD_WORKSPACE_REPOSITORY_MAX_LENGTH),
  })
  .strict()
  .superRefine((snapshot, context) => {
    const primaryCount = snapshot.repositories.filter(
      (repository) => repository.kind === "primary",
    ).length;
    if (snapshot.repositories.length > 0 && primaryCount !== 1) {
      context.addIssue({
        code: "custom",
        message: "A non-empty workspace snapshot must contain exactly one primary repository",
        path: ["repositories"],
      });
    }
    if (snapshot.cwd === null && snapshot.repositories.length > 0) {
      context.addIssue({
        code: "custom",
        message: "Workspace repositories require a cwd",
        path: ["cwd"],
      });
    }
  });

export type ThreadWorkspaceSnapshot = z.infer<typeof threadWorkspaceSnapshotSchema>;
