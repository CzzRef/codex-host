```json worktree-task-v1
{
  "schema": "worktree-task/v1",
  "task_id": "260901-composer-workspace-bar",
  "control_plane": "app-root",
  "target_branch": "czz-dev",
  "repositories": [
    {
      "repo_id": "codex-host",
      "base_sha": "820d2ac9ff9e0b8f1e32ff60cefe266e97c23be4",
      "worktree_branch": "codex/260901-composer-workspace-bar",
      "task_owner": "openspec/changes/add-composer-workspace-bar/tasks.md",
      "head": "820d2ac9ff9e0b8f1e32ff60cefe266e97c23be4",
      "upstream": null
    }
  ],
  "commit_mode": "verified-milestone",
  "push_mode": "current-message-only",
  "verification_state": "planned",
  "push_state": "not-authorized",
  "integration_state": "not-started",
  "next_action": "implement composer workspace bar milestone"
}
```

## 1. Workspace inspection contract

- [x] 1.1 Add Thread workspace snapshot and inspect-params schemas
- [x] 1.2 Export inspect/updated method names from shared-contracts and renderer client
- [x] 1.3 Cover valid primary/submodule/worktree snapshots and fail-closed empty lists

## 2. Host Git inspect and watch

- [x] 2.1 Inspect Thread cwd Git roots including submodules and linked worktrees
- [x] 2.2 Do not create, delete, or check out worktrees
- [x] 2.3 Watch Git identity files and emit workspace-updated for inspected Threads
- [x] 2.4 Route `codexhost/thread/workspace/inspect` from AppServerHost

## 3. Composer workspace list

- [x] 3.1 Mount a renderer-owned list as the previous sibling of the Composer root
- [x] 3.2 Render one row per repository with name, branch, and worktree identity
- [x] 3.3 Re-inspect on workspace-updated and Composer Thread identity changes
- [x] 3.4 Hide the list when inspection is empty or Composer identity is unsupported

## 4. Later slices

- [x] 4.1 Conversation-scoped file-change summary in the same surface
- [x] 4.2 Official Switch-branch worktree checkbox defaulting to a new worktree
- [x] 4.3 Tab-reusable implicit composer prompts

## 5. Validation

- [x] 5.1 Host inspect tests for primary, submodule, worktree, and missing Git
- [x] 5.2 Renderer tests for insertion, list rows, empty hide, and notification refresh
- [x] 5.3 Focused typecheck and affected vitest
- [x] 5.4 Chromium E2E for Composer repository rows, conversation files, branch worktree toggle, and Tab reuse

## 6. Sibling worktrees and additional roots

- [x] 6.1 Enumerate `git worktree list --porcelain` roots of the primary checkout as `worktree` rows
- [x] 6.2 Accept Thread `runtimeWorkspaceRoots` as `additional` rows without creating or checking out anything
- [x] 6.3 Contract kinds `worktree` / `additional`; Host and shared-contracts tests for both

## 7. Worktree checkbox routing correction

- [x] 7.1 Specify checked/unchecked routing through Desktop-owned new-chat Composer mode
- [x] 7.2 Bind only a verified null-conversation run-location React owner and fail closed elsewhere
- [x] 7.3 Cover mode routing, semantic ownership, false-positive labels, and Composer E2E
- [x] 7.4 Run focused renderer tests, TypeScript typecheck, and strict OpenSpec validation

## 8. Compact changed-files workspace surface

- [x] 8.1 Filter workspace locations to repositories owning conversation-changed files and render only Worktree identity plus branch on one line
- [x] 8.2 Move the file disclosure first and float its expanded list upward without Composer reflow
- [x] 8.3 Preserve file hover previews and native Review routing while conditionally hiding duplicate native Changes/Review controls
- [x] 8.4 Cover ownership filtering, native fallback/restoration, upward placement, and hover preview in focused unit/E2E verification

## 9. Right-side changed-file disclosure

- [x] 9.1 Keep changed-file Worktree identity and branch on the left of the compact line
- [x] 9.2 Move the file disclosure to the right and show file count plus aggregate conversation-file additions/deletions
- [x] 9.3 Align the upward file panel to the right edge and preserve direct file-to-native-change navigation
- [x] 9.4 Update preview and E2E coverage for the attached-reference layout

## 10. Default Local and explicit-only persistence

- [x] 10.1 Default the persisted Worktree preference to unchecked (`local`) when unset or unreadable
- [x] 10.2 Persist the preference only from an explicit checkbox change, never from an observed Desktop mode
- [x] 10.3 Cover default, opt-in/opt-out, unpersisted Desktop-side switch, and next-draft fallback in unit and Composer E2E
- [x] 10.4 Run focused renderer tests, TypeScript typecheck, and strict OpenSpec validation

## 11. Status bar overhaul (worktree surface overhaul slice 1)

- [x] 11.1 Mount the bar on `document.body` (fixed, Composer-aligned) instead of the Composer's parent
- [x] 11.2 Always show the core (Thread cwd) chip once inspection succeeds; add the file disclosure and hide native diff controls only when files exist
- [x] 11.3 Group conversation files by owning root with per-root additions/deletions; hide non-core roots with zero changed lines; collapse overflow behind `+N`
- [x] 11.4 Contract kind `external` and inspect `extraPaths`; Host resolves out-of-root changed paths to `external` rows; Renderer re-inspects once and keeps the paths on later inspections
- [x] 11.5 Key conversation files by File Change Item so replaced or empty change sets retire files
- [x] 11.6 Larger interactive hover preview beside the list with grace hide and `Escape`
- [x] 11.7 Unit (contracts, Host, Renderer grouping/preview origin/item sets) and Composer E2E coverage; typecheck, lint, boundaries

## 12. Draft worktree picker (worktree surface overhaul slice 3)

- [x] 12.1 Contract `codexhost/workspace/worktree/list|create` in shared-contracts (`workspace-worktree.ts`): name pattern, lanes, entry shape, `suggestedName`
- [x] 12.2 Host `workspace-worktree.ts`: resolve primary root from the common Git dir, `git worktree list --porcelain`, `git worktree add -b {lane}/{name} {parent}/{Repo}-worktrees/{lane}/{name}`; never delete; both methods routed in `AppServerHost` off the official app-server
- [x] 12.3 desktop-control draft policy: `selectWorkspace({ cwd } | null)` rewrites `cwd`/matching `runtimeWorkspaceRoots` on non-ephemeral `thread/start` (official Codex and external alike) at the same point as the Model carrier; discards prewarmed Threads on change; `draftCwd()` exposes the cwd Desktop itself sent so the Renderer learns the project root
- [x] 12.4 Renderer `renderer-draft-worktree-picker.ts` replaces the checkbox: `Worktree ▾` chip, menu (Local / Temporary worktree / Host-managed list / New…), inline validation and Host errors, preference `codexhost.draft-worktree.v1` for last-used marking only, Host pick released when the draft ends
- [x] 12.5 Unit coverage (contracts, Host worktree list/create/refusals, desktop-control rewrite, picker helpers) and Composer E2E (list, pick, temporary, create errors/success, draft end and next draft); typecheck, lint, boundaries
- [ ] 12.6 Live Desktop check: confirm which React owner prop (if any) exposes the draft project root; otherwise the policy-observed prewarm cwd is the source

## 13. Pinned Turn header (transcript turn header)

- [x] 13.1 Pure helpers + unit tests: current-Turn resolution with hysteresis, prompt-visibility rule, header placement and top-reservation math, native-control lookups skip codexhost overlays (`renderer-overlay-layout.ts`, `renderer-turn-actions.ts`)
- [x] 13.2 Header row 1: `第 N/M 轮`, prompt after bubble scroll-out (scroll-to-turn, expand panel), Edit / Rollback / Redo on the current Turn through `renderer-turn-action-controller.ts`; hover `⋯` chip, rail and floating cluster removed; native edit hides the actions, a running Turn disables them; one-rAF recomputation; Composer E2E covers the header row
- [ ] 13.3 Header row 2: workspace chips with `+N` collapse / click-expand / hover-preview, disclosure opening downward, preview beside the list between header and Composer; bottom bar and its `padding-bottom` reservation removed; native Changes / Review hiding condition unchanged
- [ ] 13.4 Composer E2E for row 2: collapse / expand at a narrow width, downward list, preview placement, native controls hidden, no bottom bar, transcript end reachable above the Composer
- [ ] 13.5 Preview page, proposal / design, task doc, hub, README matrix (zh / en / ko), update-impact inventory, glossary
- [ ] 13.6 `[live]` CDP checklist after a user-authorised normal quit + `codexhost launch`: no overlap with prompt text, last lines not covered, no drift on scroll, title-bar / native-summary clearance
