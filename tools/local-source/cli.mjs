#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import {
  accessSync,
  constants,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  developmentArtifacts,
  findPathExecutable,
  launcherInvocation,
  validateDevelopmentArtifacts,
} from "../dev-desktop/run.mjs";

export const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const installedCommand = path.join(os.homedir(), ".local", "bin", "codexhost");
const quoteShell = (value) => `'${value.replaceAll("'", "'\\''")}'`;

export function sourceLauncherContents() {
  return `#!/bin/sh\n# codexhost managed source launcher\nexec ${quoteShell(process.execPath)} ${quoteShell(fileURLToPath(import.meta.url))} "$@"\n`;
}

export function assertSourceLauncherInstalled(destination = installedCommand) {
  try {
    const entry = lstatSync(destination);
    if (
      !entry.isFile() ||
      entry.isSymbolicLink() ||
      readFileSync(destination, "utf8") !== sourceLauncherContents()
    ) {
      throw new Error("Source launcher does not match this checkout");
    }
    accessSync(destination, constants.X_OK);
  } catch {
    throw new Error(
      "Install this checkout's executable source launcher with npm run install:source before launch; existing files were not changed",
    );
  }
}

export function parseDesktopInspection(text) {
  const fields = Object.fromEntries(
    text
      .trim()
      .split(/\r?\n/u)
      .flatMap((line) => {
        const split = line.indexOf("=");
        return split > 0 ? [[line.slice(0, split), line.slice(split + 1)]] : [];
      }),
  );
  if (!Object.hasOwn(fields, "desktop_process_ids") || !fields.desktop_executable) {
    throw new Error("Desktop inspection did not return process ownership; refusing to launch");
  }
  const ids = fields.desktop_process_ids === "" ? [] : fields.desktop_process_ids.split(",");
  if (ids.some((id) => !/^[1-9][0-9]*$/u.test(id)))
    throw new Error("Desktop process inspection is invalid");
  return { fields, processIds: ids.map(Number) };
}

export function inspectDesktop(launcher, run = spawnSync) {
  const result = run(launcher, ["inspect"], {
    encoding: "utf8",
    timeout: 10_000,
    maxBuffer: 256 * 1024,
  });
  if (result.error || result.status !== 0)
    throw new Error("Cannot inspect Codex Desktop safely; no launch was attempted");
  return parseDesktopInspection(result.stdout);
}

export function assertDesktopStopped(launcher, run = spawnSync) {
  const inspection = inspectDesktop(launcher, run);
  if (inspection.processIds.length > 0) {
    throw new Error(
      "Codex Desktop is running. Nothing was stopped or restarted. Quit it yourself when ready, then run codexhost launch again.",
    );
  }
  return inspection;
}

function child(invocation, environment, cwd = sourceRoot) {
  return new Promise((resolve, reject) => {
    const process_ = spawn(invocation.command, invocation.arguments, {
      cwd,
      env: environment,
      stdio: "inherit",
    });
    process_.once("error", reject);
    process_.once("exit", (code, signal) =>
      signal ? reject(new Error(`Command exited on ${signal}`)) : resolve(code ?? 1),
    );
  });
}

async function launch(artifacts, environment) {
  assertSourceLauncherInstalled();
  validateDevelopmentArtifacts(artifacts);
  assertDesktopStopped(artifacts.launcher);
  const pi = findPathExecutable("pi", { environment });
  const invocation = launcherInvocation(artifacts, pi);
  return new Promise((resolve, reject) => {
    const process_ = spawn(invocation.command, invocation.arguments, {
      cwd: sourceRoot,
      env: environment,
      stdio: ["ignore", "pipe", "inherit"],
    });
    let settled = false;
    let output = "";
    process_.stdout.setEncoding("utf8");
    process_.stdout.on("data", (chunk) => {
      output = (output + chunk).slice(-4096);
      if (!settled && /(?:^|\n)ready\r?\n/u.test(output)) {
        settled = true;
        process_.stdout.destroy();
        process_.unref();
        resolve(0);
      }
    });
    process_.once("error", reject);
    process_.once("exit", (code) => {
      if (!settled) resolve(code ?? 1);
    });
  });
}

function install(artifacts) {
  validateDevelopmentArtifacts(artifacts);
  const bin = path.join(os.homedir(), ".local", "bin");
  const destination = installedCommand;
  const wrapper = sourceLauncherContents();
  mkdirSync(bin, { recursive: true });
  let existing;
  try {
    existing = lstatSync(destination);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (existing) {
    if (
      !existing.isFile() ||
      existing.isSymbolicLink() ||
      readFileSync(destination, "utf8") !== wrapper
    ) {
      throw new Error(
        `Preserving existing executable at ${destination}; choose another name manually`,
      );
    }
  } else writeFileSync(destination, wrapper, { mode: 0o755, flag: "wx" });
  console.log(
    `Installed source launcher: ${destination}\nSource checkout: ${sourceRoot}\nDesktop activation: not performed`,
  );
  return 0;
}

async function doctor(artifacts) {
  const report = {
    source: sourceRoot,
    node: process.execPath,
    version: JSON.parse(readFileSync(path.join(sourceRoot, "package.json"), "utf8")).version,
  };
  try {
    validateDevelopmentArtifacts(artifacts);
    report.build = "present";
  } catch (error) {
    report.build = error.message;
  }
  try {
    const inspected = inspectDesktop(artifacts.launcher);
    report.desktop = {
      version: inspected.fields.desktop_version,
      running: inspected.processIds.length > 0,
      processIds: inspected.processIds,
    };
  } catch (error) {
    report.desktop = { error: error.message };
  }
  const { createExternalHarnessAdapters } = await import(
    pathToFileURL(path.join(sourceRoot, "packages/host-runtime/dist/adapter-composition.js"))
  );
  const adapters = createExternalHarnessAdapters(process.env);
  report.harnesses = {};
  for (const [id, adapter] of adapters) {
    try {
      const inspection = await adapter.inspect({ cwd: sourceRoot });
      report.harnesses[id] =
        inspection.status === "ready"
          ? {
              status: "ready",
              models: inspection.catalog.models.length,
              history: inspection.capabilities.history,
            }
          : {
              status: inspection.status,
              errorCode: inspection.error.code,
              message: inspection.error.message,
            };
    } catch {
      report.harnesses[id] = { status: "error", message: "Inspection failed" };
    } finally {
      await adapter.close();
    }
  }
  report.autoUpdates = "disabled for the source launcher";
  report.desktopActivation = "not performed";
  console.log(JSON.stringify(report, null, 2));
  return 0;
}

export async function runSourceCli(arguments_ = process.argv.slice(2)) {
  const artifacts = developmentArtifacts(sourceRoot);
  const environment = {
    ...process.env,
    CODEXHOST_DISABLE_UPDATES: "1",
    CODEXHOST_REFUSE_RUNNING_DESKTOP: "1",
    CODEXHOST_HOST_NODE_PATH: artifacts.node,
    CODEXHOST_HOST_RUNTIME_PATH: artifacts.hostRuntime,
    CODEXHOST_CLI_PATH: installedCommand,
  };
  const command = arguments_[0] ?? "launch";
  const rest = arguments_.slice(1);
  if (command === "--help" || command === "help") {
    console.log(
      "codexhost source checkout (czz-dev)\n  install   Install ~/.local/bin/codexhost; never launches Desktop\n  build     Build this checkout; never stops Desktop\n  doctor    Inspect Desktop and local agents; no model prompts\n  inspect   Read native Desktop installation/process metadata\n  launch    Start only when Desktop is already stopped\n  delegate|harness|thread ...  Forward to this checkout's Host CLI\n\nSource updates are manual. No automatic restart or update is scheduled.",
    );
    return 0;
  }
  if (["build", "doctor", "install", "launch"].includes(command) && rest.length > 0)
    throw new Error(`Unexpected arguments for ${command}`);
  if (command === "build") {
    const npm = findPathExecutable("npm");
    if (!npm) throw new Error("npm is not installed");
    return child({ command: npm, arguments: ["run", "build"] }, environment);
  }
  if (command === "install") return install(artifacts);
  if (command === "doctor") return doctor(artifacts);
  if (command === "launch") return launch(artifacts, environment);
  if (["harness", "delegate", "thread"].includes(command)) {
    return child(
      {
        command: artifacts.node,
        arguments: [artifacts.hostRuntime, "--codexhost-delegation-cli", ...arguments_],
      },
      environment,
      process.cwd(),
    );
  }
  if (command === "inspect") {
    accessSync(artifacts.launcher, constants.X_OK);
    return child(
      { command: artifacts.launcher, arguments: arguments_ },
      environment,
      process.cwd(),
    );
  }
  throw new Error(`Unknown command: ${command}`);
}

const invoked = process.argv[1] ? pathToFileURL(realpathSync(process.argv[1])).href : null;
if (invoked === import.meta.url) {
  runSourceCli()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(`codexhost source: ${error.message}`);
      process.exitCode = 1;
    });
}
