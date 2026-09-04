# Codex Desktop live check

Maintainer tool for the moment after Codex Desktop updates itself: identify the installed build, compare it with the last accepted one, read the Electron fuse block, make sure a codexhost-launched Desktop is running, probe the live Renderer over Chromium DevTools Protocol, and print a verdict with owner hints. It complements the bundle-level [contract audit](../codex-desktop-contract-audit/README.md); it does not replace the [update-impact audit skill](../../.agents/skills/codexhost-update-impact-audit/SKILL.md).

## Run

```bash
npm run live-check:codex-desktop -- --open official
```

Steps, in order:

1. `codexhost inspect` (the source launcher on `PATH`, else `target/debug/codexhost`, or `--launcher`) gives version, build, `app.asar` integrity and install root.
2. `.codexhost/update-impact/last-known-good.json`, when present, tells whether the asar changed since the last accepted build.
3. The `Codex Framework` binary's fuse block is decoded; `EnableNodeCliInspectArguments = 0` means `--inspect` is dead and only the CDP attach path can work.
4. Process discovery by the Desktop executable path: a Desktop **without** `--remote-debugging-port` was not started by codexhost, so the tool stops with exit code 2 (only the user quits Desktop). No Desktop means `codexhost launch` with `CODEXHOST_STARTUP_TRACE=1` (trace saved next to the report) unless `--no-launch`.
5. The `app://-/index.html` page target is probed: overlay root, sidebar rows, Composer and app-shell header rects, transcript scroller direction, Turn header rect / index / arrows / actions, transcript reservation. `--open official|external` first clicks "Try again" / "Back to app" when needed and then the first matching sidebar row (external rows carry `data-codexhost-sidebar-agent-icon`), capturing `Runtime.exceptionThrown` and console errors for `--seconds`.
6. Findings map to owners: missing overlay root → desktop-control CDP session; Desktop bundle exception while codexhost data is on screen → Host projection shape (`packages/protocol-core/src/codex-ui-projector.ts`); geometry drift → `renderer-overlay-layout.ts` / `renderer-turn-header.ts`.

Reports land in `.codexhost/update-impact/<version>/live-check.{json,md}` (ignored directory; no prompts, titles, Thread ids or full DOM are stored). `--accept` after an `ok` verdict writes `last-known-good.json`.

Exit codes: `0` ok, `1` usage or launch failure, `2` a non-codexhost Desktop is running, `3` findings with impact.

## Limits

- Adaptation itself stays a code change: the tool localises the failing contract and names the owner file, it does not patch.
- `--open` clicks inside the user's live Desktop; do not run it while the user is working in the window.
- Rollback / Redo / Edit behaviour is not exercised; use the Turn header task's live checklist for that.
