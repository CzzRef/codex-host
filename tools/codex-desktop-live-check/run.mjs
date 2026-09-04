#!/usr/bin/env node
// Codex Desktop live check: identify the installed Desktop, compare it with the
// last accepted build, read the Electron fuse block, make sure a codexhost-launched
// Desktop is running (launching one when nothing runs), then probe the live
// Renderer over Chromium DevTools Protocol and report a verdict. See README.md.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const defaultOutputRoot = path.join(repositoryRoot, ".codexhost", "update-impact");
const FUSE_SENTINEL = "dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX";
const FUSE_NAMES = [
  "RunAsNode",
  "EnableCookieEncryption",
  "EnableNodeOptionsEnvironmentVariable",
  "EnableNodeCliInspectArguments",
  "EnableEmbeddedAsarIntegrityValidation",
  "OnlyLoadAppFromAsar",
  "LoadBrowserProcessSpecificV8Snapshot",
  "GrantFileProtocolExtraPrivileges",
];

function usage() {
  console.error(`usage:
  node tools/codex-desktop-live-check/run.mjs
    [--launcher <codexhost executable>]   default: "codexhost" on PATH, else target/debug/codexhost
    [--no-launch]                         never start Desktop; only attach to a codexhost-launched one
    [--open none|official|external]       which sidebar Thread to open under exception capture (default none)
    [--seconds <n>]                       capture window after the open action (default 8)
    [--output <directory>]                report root (default .codexhost/update-impact)
    [--accept]                            record this build as last-known-good after an "ok" verdict

Exit codes: 0 ok, 1 usage/launch failure, 2 a Desktop not started by codexhost is running (quit it first),
3 verdict is not ok (injection missing, Renderer exception, or contract drift).`);
}

function parseArguments(argv) {
  const options = {
    launcher: null,
    launch: true,
    open: "none",
    seconds: 8,
    output: defaultOutputRoot,
    accept: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`${argument} requires a value`);
      return argv[index];
    };
    if (argument === "--launcher") options.launcher = path.resolve(next());
    else if (argument === "--no-launch") options.launch = false;
    else if (argument === "--open") {
      options.open = next();
      if (!["none", "official", "external"].includes(options.open)) throw new Error("--open value");
    } else if (argument === "--seconds") options.seconds = Math.max(1, Number(next()) || 8);
    else if (argument === "--output") options.output = path.resolve(next());
    else if (argument === "--accept") options.accept = true;
    else if (argument === "--help" || argument === "-h") {
      usage();
      process.exit(0);
    } else throw new Error(`unknown argument ${argument}`);
  }
  return options;
}

function resolveLauncher(explicit) {
  if (explicit) return explicit;
  const onPath = spawnSync("sh", ["-c", "command -v codexhost"], { encoding: "utf8" });
  const candidate = onPath.status === 0 ? onPath.stdout.trim() : "";
  if (candidate) return candidate;
  const built = path.join(repositoryRoot, "target", "debug", "codexhost");
  if (fs.existsSync(built)) return built;
  throw new Error("no codexhost launcher: install the source launcher or pass --launcher");
}

function inspectDesktop(launcher) {
  const output = execFileSync(launcher, ["inspect"], { encoding: "utf8" });
  const record = {};
  for (const line of output.split("\n")) {
    const separator = line.indexOf("=");
    if (separator > 0) record[line.slice(0, separator)] = line.slice(separator + 1).trim();
  }
  if (!record.desktop_version || !record.desktop_asar_integrity || !record.install_root) {
    throw new Error("codexhost inspect did not report desktop_version / asar / install_root");
  }
  return {
    version: record.desktop_version,
    build: record.desktop_build ?? "unknown",
    asarIntegrity: record.desktop_asar_integrity,
    installRoot: record.install_root,
    executable: record.desktop_executable ?? null,
    processIds: (record.desktop_process_ids ?? "")
      .split(/[\s,]+/u)
      .filter(Boolean)
      .map(Number),
  };
}

function frameworkBinary(installRoot) {
  const versions = path.join(
    installRoot,
    "Contents",
    "Frameworks",
    "Codex Framework.framework",
    "Versions",
  );
  if (!fs.existsSync(versions)) return null;
  for (const entry of fs.readdirSync(versions)) {
    if (entry === "Current") continue;
    const candidate = path.join(versions, entry, "Codex Framework");
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function readFuses(binaryPath) {
  if (!binaryPath) return null;
  const bytes = fs.readFileSync(binaryPath);
  const at = bytes.indexOf(FUSE_SENTINEL, 0, "latin1");
  if (at < 0) return null;
  const start = at + FUSE_SENTINEL.length;
  const version = bytes[start];
  const length = bytes[start + 1];
  const values = [...bytes.subarray(start + 2, start + 2 + length)].map((byte) =>
    String.fromCharCode(byte),
  );
  const fuses = {};
  values.forEach((value, index) => {
    fuses[FUSE_NAMES[index] ?? `fuse${index}`] = value;
  });
  return { version, fuses, raw: values.join(" ") };
}

function listProcesses() {
  const output = execFileSync("ps", ["-axo", "pid=,ppid=,args="], { encoding: "utf8" });
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [pid, ppid, ...rest] = line.split(/\s+/u);
      return { pid: Number(pid), ppid: Number(ppid), args: rest.join(" ") };
    });
}

function findDesktop(executable) {
  const processes = listProcesses().filter((entry) => entry.args.startsWith(executable));
  if (processes.length === 0) return null;
  const withPort = processes.find((entry) => /--remote-debugging-port=\d+/u.test(entry.args));
  const entry = withPort ?? processes[0];
  const port = entry.args.match(/--remote-debugging-port=(\d+)/u)?.[1] ?? null;
  return { pid: entry.pid, ppid: entry.ppid, cdpPort: port ? Number(port) : null };
}

function launchDesktop(launcher, logPath) {
  const environment = { ...process.env, CODEXHOST_STARTUP_TRACE: "1" };
  const log = fs.openSync(logPath, "w");
  const result = spawnSync(launcher, ["launch"], {
    env: environment,
    stdio: ["ignore", log, log],
    timeout: 180_000,
  });
  fs.closeSync(log);
  return result.status === 0;
}

async function waitForDesktop(executable, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const desktop = findDesktop(executable);
    if (desktop?.cdpPort) return desktop;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return findDesktop(executable);
}

async function mainPageTarget(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = await response.json();
  return (
    targets.find((target) => target.type === "page" && target.url === "app://-/index.html") ?? null
  );
}

function withSession(webSocketUrl, work, timeoutMs) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(webSocketUrl);
    const pending = new Map();
    const events = [];
    let nextId = 0;
    const send = (method, params = {}) =>
      new Promise((resolveCall, rejectCall) => {
        nextId += 1;
        pending.set(nextId, { resolveCall, rejectCall });
        socket.send(JSON.stringify({ id: nextId, method, params }));
      });
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error("CDP session timed out"));
    }, timeoutMs);
    socket.onerror = () => {
      clearTimeout(timer);
      reject(new Error("CDP socket error"));
    };
    socket.onmessage = (message) => {
      const payload = JSON.parse(message.data);
      if (payload.id && pending.has(payload.id)) {
        const { resolveCall, rejectCall } = pending.get(payload.id);
        pending.delete(payload.id);
        if (payload.error) rejectCall(new Error(payload.error.message));
        else resolveCall(payload.result);
      } else if (payload.method) events.push(payload);
    };
    socket.onopen = async () => {
      try {
        const value = await work({ send, events });
        clearTimeout(timer);
        socket.close();
        resolve(value);
      } catch (error) {
        clearTimeout(timer);
        socket.close();
        reject(error);
      }
    };
  });
}

async function evaluate(send, expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  }
  return result.result.value;
}

const STATE_SCRIPT = String.raw`(() => {
  const rect = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
  const header = document.querySelector("[data-codexhost-turn-header]");
  const shell = document.querySelector('header[data-pip-obstacle="app-shell-header"]');
  const composer = document.querySelector("[data-codex-composer-root]");
  const scroller = document.querySelector(".thread-scroll-container");
  const column = scroller?.firstElementChild ?? null;
  const keys = [...document.querySelectorAll("[data-turn-key]")].map((n) => n.getAttribute("data-turn-key") || "");
  return {
    route: document.querySelector("[data-settings-panel-slug]") ? "settings" : /hit a snag/i.test(document.body.innerText || "") ? "error-boundary" : composer ? "workspace" : "other",
    overlayRoots: document.querySelectorAll("[data-codexhost-overlay]").length,
    sidebarRows: document.querySelectorAll("[data-app-action-sidebar-thread-row]").length,
    shellBottom: shell ? Math.round(shell.getBoundingClientRect().bottom) : null,
    composer: rect(composer),
    header: rect(header),
    headerBackground: header ? getComputedStyle(header).backgroundColor : null,
    scrollerDirection: scroller ? getComputedStyle(scroller).flexDirection : null,
    reserve: column?.getAttribute("data-codexhost-transcript-reserve") ?? null,
    turnsInDom: keys.length,
    gapKeys: keys.filter((k) => k.startsWith("history-gap:")).length,
    bubbles: document.querySelectorAll('[data-user-message-bubble="true"]').length,
    index: header?.querySelector("[data-codexhost-turn-header-index]")?.textContent ?? null,
    steps: header ? [...header.querySelectorAll("[data-codexhost-turn-header-step]")].map((b) => ({ dir: b.getAttribute("data-codexhost-turn-header-step"), disabled: b.disabled })) : [],
    actions: header ? [...header.querySelectorAll("[data-codexhost-turn-action]")].map((b) => ({ id: b.getAttribute("data-codexhost-turn-action"), disabled: b.disabled })) : [],
  };
})()`;

function openScript(kind) {
  return String.raw`(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const retry = [...document.querySelectorAll("button")].find((b) => /try again/i.test(b.textContent || ""));
  if (retry) { retry.click(); await wait(2500); }
  const back = [...document.querySelectorAll("button, a")].find((b) => /back to app/i.test((b.textContent || "").trim()));
  if (back) { back.click(); await wait(2000); }
  const rows = [...document.querySelectorAll("[data-app-action-sidebar-thread-row]")];
  const isExternal = (row) => !!row.querySelector("[data-codexhost-sidebar-agent-icon]");
  const row = rows.find((r) => isExternal(r) === ${kind === "external"});
  if (!row) return { opened: false, rows: rows.length };
  row.click();
  await wait(3500);
  return { opened: true, rows: rows.length, external: ${kind === "external"} };
})()`;
}

function sanitizeException(text) {
  return String(text)
    .replace(/https?:\/\/\S+/gu, "<url>")
    .split("\n")
    .slice(0, 4)
    .join(" | ")
    .slice(0, 320);
}

function classify(identity, fuses, desktop, probe, exceptions, openResult) {
  const findings = [];
  if (fuses && fuses.fuses.EnableNodeCliInspectArguments !== "1") {
    findings.push({
      id: "inspect-fuse-off",
      severity: "info",
      note: "Electron --inspect is fused off; codexhost must attach over CDP (launcher --remote-debugging-port).",
    });
  }
  if (!desktop?.cdpPort) {
    findings.push({
      id: "no-cdp-port",
      severity: "blocker",
      note: "Desktop argv has no --remote-debugging-port; not launched by this codexhost.",
    });
  }
  if (probe && probe.overlayRoots === 0) {
    findings.push({
      id: "injection-missing",
      severity: "blocker",
      note: "No [data-codexhost-overlay] root: Renderer injection did not run. Owner: packages/desktop-control/src/renderer-cdp-control-session.ts, packages/desktop-control/src/production-controller.ts.",
    });
  }
  if (probe && probe.route === "workspace" && !probe.composer) {
    findings.push({
      id: "composer-contract",
      severity: "impact",
      note: "Workspace visible but [data-codex-composer-root] absent. Owner: renderer-composer-dom.ts.",
    });
  }
  if (probe && probe.route === "workspace" && probe.shellBottom === null) {
    findings.push({
      id: "shell-header-contract",
      severity: "impact",
      note: 'header[data-pip-obstacle="app-shell-header"] absent. Owner: renderer-overlay-layout.ts appShellChromeBottom.',
    });
  }
  if (probe && probe.turnsInDom > 0 && probe.scrollerDirection !== "column-reverse") {
    findings.push({
      id: "scroller-direction",
      severity: "impact",
      note: `transcript scroller flex-direction is ${probe.scrollerDirection}; the Turn header assumes column-reverse. Owner: renderer-overlay-layout.ts.`,
    });
  }
  if (probe && probe.turnsInDom > 0 && probe.header && probe.composer) {
    if (probe.shellBottom !== null && Math.abs(probe.header.y - probe.shellBottom) > 2) {
      findings.push({
        id: "header-top",
        severity: "impact",
        note: `Turn header y=${probe.header.y} vs shell bottom ${probe.shellBottom}. Owner: renderer-overlay-layout.ts turnHeaderBox.`,
      });
    }
    if (probe.header.x !== probe.composer.x || probe.header.w !== probe.composer.w) {
      findings.push({
        id: "header-align",
        severity: "impact",
        note: `Turn header x/w ${probe.header.x}/${probe.header.w} vs Composer ${probe.composer.x}/${probe.composer.w}.`,
      });
    }
    if (probe.reserve !== "true") {
      findings.push({
        id: "reserve-missing",
        severity: "impact",
        note: "Transcript column has no data-codexhost-transcript-reserve.",
      });
    }
  }
  if (probe && probe.turnsInDom > 0 && !probe.header) {
    findings.push({
      id: "header-missing",
      severity: "impact",
      note: "Transcript loaded but no [data-codexhost-turn-header]. Owner: renderer-turn-header.ts.",
    });
  }
  for (const exception of exceptions) {
    const owner = /app-initial|thread-app-shell/u.test(exception)
      ? "Desktop bundle threw while codexhost data was on screen: check Host projection shape (packages/protocol-core/src/codex-ui-projector.ts) and Host replies for the opened Thread"
      : /codexhost|renderer-/u.test(exception)
        ? "codexhost Renderer overlay threw: packages/renderer-extension/src"
        : "unattributed";
    findings.push({
      id: "renderer-exception",
      severity: "impact",
      note: `${exception} => ${owner}`,
    });
  }
  if (probe?.route === "error-boundary") {
    findings.push({
      id: "error-boundary",
      severity: "impact",
      note: `Desktop shows its error boundary${openResult?.opened ? ` after opening an ${openResult.external ? "external" : "official"} Thread` : ""}.`,
    });
  }
  const worst = findings.some((f) => f.severity === "blocker")
    ? "blocked"
    : findings.some((f) => f.severity === "impact")
      ? "impact"
      : "ok";
  return { verdict: worst, findings };
}

function markdown(report) {
  const lines = [
    `# Codex Desktop live check — ${report.identity.version} (build ${report.identity.build})`,
    "",
    `- verdict: **${report.verdict}**`,
    `- asar: ${report.identity.asarIntegrity}`,
    `- baseline: ${report.baseline ? `${report.baseline.version} (${report.baseline.changed ? "changed" : "unchanged"})` : "none recorded"}`,
    `- fuses: ${report.fuses ? report.fuses.raw : "unreadable"}`,
    `- desktop: pid ${report.desktop?.pid ?? "-"}, cdp port ${report.desktop?.cdpPort ?? "-"}, launched by this run: ${report.launched}`,
    `- probe route: ${report.probe?.route ?? "-"}, overlay roots ${report.probe?.overlayRoots ?? "-"}, turns ${report.probe?.turnsInDom ?? "-"}, header ${JSON.stringify(report.probe?.header ?? null)}`,
    "",
    "| finding | severity | note |",
    "| --- | --- | --- |",
    ...report.findings.map((f) => `| ${f.id} | ${f.severity} | ${f.note.replace(/\|/gu, "\\|")} |`),
  ];
  return `${lines.join("\n")}\n`;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const launcher = resolveLauncher(options.launcher);
  const identity = inspectDesktop(launcher);
  const outputDirectory = path.join(
    options.output,
    identity.version.replace(/[^a-zA-Z0-9._-]+/gu, "-"),
  );
  fs.mkdirSync(outputDirectory, { recursive: true });
  const lastKnownGoodPath = path.join(options.output, "last-known-good.json");
  const lastKnownGood = fs.existsSync(lastKnownGoodPath)
    ? JSON.parse(fs.readFileSync(lastKnownGoodPath, "utf8"))
    : null;
  const baseline = lastKnownGood
    ? {
        version: lastKnownGood.version,
        asarIntegrity: lastKnownGood.asarIntegrity,
        changed: lastKnownGood.asarIntegrity !== identity.asarIntegrity,
      }
    : null;
  const fuses = readFuses(frameworkBinary(identity.installRoot));

  let desktop = identity.executable ? findDesktop(identity.executable) : null;
  let launched = false;
  if (desktop && !desktop.cdpPort) {
    console.error(
      `A Desktop not started by codexhost is running (pid ${desktop.pid}). Quit it, then rerun.`,
    );
    process.exit(2);
  }
  if (!desktop) {
    if (!options.launch) {
      console.error("Desktop is not running and --no-launch was given.");
      process.exit(1);
    }
    const logPath = path.join(outputDirectory, "launch.log");
    console.error(`launching Desktop through ${launcher} (trace in ${logPath})`);
    if (!launchDesktop(launcher, logPath)) {
      console.error(`codexhost launch failed; see ${logPath}`);
      process.exit(1);
    }
    launched = true;
    desktop = await waitForDesktop(identity.executable, 30_000);
  }

  let probe = null;
  const exceptions = [];
  let openResult = null;
  if (desktop?.cdpPort) {
    const page = await mainPageTarget(desktop.cdpPort);
    if (!page) throw new Error("no app://-/index.html page target on the CDP endpoint");
    await withSession(
      page.webSocketDebuggerUrl,
      async ({ send, events }) => {
        await send("Runtime.enable");
        await send("Log.enable");
        if (options.open !== "none") openResult = await evaluate(send, openScript(options.open));
        await new Promise((resolve) => setTimeout(resolve, options.seconds * 1000));
        probe = await evaluate(send, STATE_SCRIPT);
        for (const event of events) {
          if (event.method === "Runtime.exceptionThrown") {
            const details = event.params.exceptionDetails;
            exceptions.push(
              sanitizeException(details.exception?.description ?? details.text ?? "exception"),
            );
          } else if (event.method === "Runtime.consoleAPICalled" && event.params.type === "error") {
            exceptions.push(
              sanitizeException(
                event.params.args.map((a) => a.value ?? a.description ?? "").join(" "),
              ),
            );
          }
        }
      },
      (options.seconds + 30) * 1000,
    );
  }

  const { verdict, findings } = classify(identity, fuses, desktop, probe, exceptions, openResult);
  const report = {
    checkedAt: new Date().toISOString(),
    host: os.hostname().length > 0 ? "recorded" : "unknown",
    identity: {
      version: identity.version,
      build: identity.build,
      asarIntegrity: identity.asarIntegrity,
    },
    baseline,
    fuses,
    desktop,
    launched,
    open: options.open,
    openResult,
    probe,
    exceptions,
    verdict,
    findings,
  };
  fs.writeFileSync(
    path.join(outputDirectory, "live-check.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  fs.writeFileSync(path.join(outputDirectory, "live-check.md"), markdown(report));
  process.stdout.write(markdown(report));
  if (options.accept && verdict === "ok") {
    fs.writeFileSync(
      lastKnownGoodPath,
      `${JSON.stringify({ version: identity.version, build: identity.build, asarIntegrity: identity.asarIntegrity, fuses: fuses?.raw ?? null, acceptedAt: report.checkedAt }, null, 2)}\n`,
    );
    console.error(`recorded ${identity.version} as last-known-good`);
  }
  process.exit(verdict === "ok" ? 0 : 3);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
