import {
  resolveHarnessExecutable,
  VERSION_MANAGER_ROOTS,
  type HarnessDiscoverySpec,
} from "@codexhost/harness-discovery";

export const cursorDiscoverySpec: HarnessDiscoverySpec = {
  id: "cursor",
  // `agent` is also installed by Grok. Never use it as a Cursor fallback.
  command: "cursor-agent",
  commandEnvironmentVariable: "CODEXHOST_CURSOR_COMMAND",
  installRoots: {
    posix: ["~/.local/bin", VERSION_MANAGER_ROOTS, "/opt/homebrew/bin", "/usr/local/bin"],
    windows: ["~/.local/bin", "${APPDATA}/npm", VERSION_MANAGER_ROOTS],
  },
};

export class CursorExecutableError extends Error {}

export function resolveCursorExecutable(
  input: {
    command?: string;
    environment?: NodeJS.ProcessEnv;
    homeDirectory?: string;
    platform?: NodeJS.Platform;
  } = {},
): string {
  const resolved = resolveHarnessExecutable(cursorDiscoverySpec, {
    ...input,
    environment: input.environment ?? process.env,
    platform: input.platform ?? process.platform,
  });
  if (!resolved) throw new CursorExecutableError("Cursor CLI (cursor-agent) is not installed");
  return resolved.executable;
}
