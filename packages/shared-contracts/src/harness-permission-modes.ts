import { z } from "zod";

import { hostThreadIdSchema } from "./ids.js";

export const HARNESS_PERMISSION_MODE_ID_MAX_LENGTH = 128;
export const HARNESS_PERMISSION_MODE_LABEL_MAX_LENGTH = 256;
export const HARNESS_PERMISSION_MODE_DESCRIPTION_MAX_LENGTH = 1_024;
export const HARNESS_PERMISSION_MODE_CATALOG_MAX_LENGTH = 32;

const nonBlankTextSchema = z.string().refine((value) => value.trim().length > 0, {
  message: "Value must not be empty or whitespace",
});

export const harnessPermissionModeIdSchema = nonBlankTextSchema
  .max(HARNESS_PERMISSION_MODE_ID_MAX_LENGTH)
  .regex(/^[A-Za-z0-9._~-]+$/u, "Permission Mode ID must use transport-safe characters")
  .brand<"HarnessPermissionModeId">();

export type HarnessPermissionModeId = z.infer<typeof harnessPermissionModeIdSchema>;

/**
 * The Permission Mode vocabulary codexhost offers for every Harness, in
 * increasing order of what the agent may do without asking.
 *
 * Harnesses name and implement these differently — Claude Code's
 * `bypassPermissions`, Grok's `always-approve`, OMP's `yolo`, OpenCode's
 * `allow` and Antigravity's `dangerously-skip-permissions` are all `bypass` —
 * so an Adapter tags each native Mode with the kind it corresponds to. The
 * native id stays the wire value; the kind only drives what the user is
 * offered, so the same four choices appear whichever Harness is selected.
 */
export const HARNESS_PERMISSION_MODE_KINDS = ["plan", "ask", "auto", "bypass"] as const;

export const harnessPermissionModeKindSchema = z.enum(HARNESS_PERMISSION_MODE_KINDS);

export type HarnessPermissionModeKind = z.infer<typeof harnessPermissionModeKindSchema>;

export const harnessPermissionModeSchema = z
  .object({
    id: harnessPermissionModeIdSchema,
    label: nonBlankTextSchema.max(HARNESS_PERMISSION_MODE_LABEL_MAX_LENGTH),
    description: nonBlankTextSchema.max(HARNESS_PERMISSION_MODE_DESCRIPTION_MAX_LENGTH).optional(),
    dangerous: z.boolean().optional(),
    /** Which shared choice this native Mode stands for, when it maps to one. */
    canonical: harnessPermissionModeKindSchema.optional(),
  })
  .strict();

export type HarnessPermissionMode = z.infer<typeof harnessPermissionModeSchema>;

export const harnessPermissionModeCatalogSchema = z
  .object({
    modes: z
      .array(harnessPermissionModeSchema)
      .min(1)
      .max(HARNESS_PERMISSION_MODE_CATALOG_MAX_LENGTH),
    defaultModeId: harnessPermissionModeIdSchema,
  })
  .strict()
  .superRefine((catalog, context) => {
    const ids = new Set<string>();
    for (const [index, mode] of catalog.modes.entries()) {
      if (ids.has(mode.id)) {
        context.addIssue({
          code: "custom",
          message: "Permission Mode IDs must be unique",
          path: ["modes", index, "id"],
        });
      }
      ids.add(mode.id);
    }
    if (!ids.has(catalog.defaultModeId)) {
      context.addIssue({
        code: "custom",
        message: "Default Permission Mode must exist in the catalog",
        path: ["defaultModeId"],
      });
    }
  });

export type HarnessPermissionModeCatalog = z.infer<typeof harnessPermissionModeCatalogSchema>;

export const threadPermissionModeSelectParamsSchema = z
  .object({
    threadId: hostThreadIdSchema,
    permissionModeId: harnessPermissionModeIdSchema,
  })
  .strict();

export type ThreadPermissionModeSelectParams = z.infer<
  typeof threadPermissionModeSelectParamsSchema
>;
