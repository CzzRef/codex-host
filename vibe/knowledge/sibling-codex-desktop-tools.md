# 同源 Desktop 工具对照：codexhost / Codex++ / OpenCodex

Tool: tool-neutral (codex, claude, grok, dsh, and any CodeNote-routed agent)
Date: 2026-09-07
Status: verified-local（源码 + 本机进程/配置；未做双开真机对撞）
Evidence: code, official-doc, user-confirmed, runtime

## 范围

本机 GitFork 并列检出（2026-09-07）：

| 仓库 | 路径 | 身份 |
| --- | --- | --- |
| codexhost | `/Users/gdkmjd/work/czz/GitFork/codex-host` | 本仓；主检出 `czz-dev` |
| Codex++ | `/Users/gdkmjd/work/czz/GitFork/CodexPlusPlus` | `CzzRef/CodexPlusPlus`，`main` @ `48d4315`，上游 BigPizzaV3，AGPL-3.0 |
| OpenCodex | `/Users/gdkmjd/work/czz/GitFork/opencodex` | `CzzRef/opencodex`，`main` @ `bba63222d`，包 `@bitkyc08/opencodex` 2.46.0，MIT |

不覆盖三仓内部功能清单，只记录**能否同时跑、互相参照了什么、家目录会不会被改写**。

## 各自做什么

| 工具 | 手段 | 目标 |
| --- | --- | --- |
| **codexhost** | 托管启动官方 Desktop + Shim 代理 `app-server` + CDP 注入 Renderer | 在官方壳里跑外部 Harness 独立 Thread |
| **Codex++** | 启动器带 `--remote-debugging-port=9229`，CDP 注入 `assets/inject/renderer-inject.js`；协议代理默认 `127.0.0.1:57321` | 供应商切换、账号/增强 UI；改 `~/.codex/config.toml` |
| **OpenCodex** | 本机 HTTP 代理 `127.0.0.1:10100`；改 `$CODEX_HOME` 的 `openai_base_url` / catalog | 官方 Codex / Claude Code 等客户端换任意 LLM；**不** CDP 注入、**不**改 `app.asar` |

## 同时运行

**同一份官方 Codex Desktop 上，三者不能叠开。**

1. Desktop 单实例。Host 发现已有 Desktop 则拒绝启动（`crates/platform/src/desktop_launch.rs`：`refusing to reuse or terminate it`）。Codex++ 在 macOS 上若已运行但 CDP 不是 9229，会 `RestartRunningApp`，拆掉 Host 链。
2. CDP 口对不上。Host 用临时口（本机曾见 `58659`）；Codex++ 默认 `9229`。已运行实例无法用二次启动参数补开 CDP（归档 `openspec/changes/archive/2026-08-01-attach-running-codex-desktop/验证结论.md`）。
3. Renderer 挂钩重叠。Codex++ 改写 `dispatcher.dispatchMessage`；Host 包装 `sendRequest` / `steerTurn`。后注入覆盖先注入。
4. `~/.codex` 共享。Codex++ / OpenCodex 都会写 `config.toml`（OpenCodex 写入 `openai_base_url = http://127.0.0.1:10100/v1`）。Host 官方 Thread 读同一份家目录。

可并存：三个 Git 目录并排；只开 OpenCodex **仪表盘**且 Integrations 关闭、不 Apply。错开使用前先确认 `config.toml` 没有代理 `base_url`。

## Host 是否参照了 Codex++

**参照行为事实，不复制 AGPL 代码。**

- `openspec/changes/archive/2026-07-27-verify-renderer-thread-intent-binding/design.md`：Codex++ 证明可用 direct CDP 注入、动态加载 Renderer chunk、包装 dispatcher / `sendRequest` / `electronBridge`；codexhost「只参考这些行为事实并独立实现，不复制 AGPL 代码」。
- `openspec/changes/archive/2026-08-01-attach-running-codex-desktop/design.md`：可借鉴 Codex++ 的三态启动（guard / 二次激活 / 已运行再注），但附加成功还必须有 Host / app-server 传输。
- 同 Change 验证结论：Windows 上不能用「Codex++ 式二次启动参数」给未受控实例补开 CDP；生产路径对独立官方实例是提示退出后重试。

不是 fork，也不是把 Codex++ 嵌进 Host。

## OpenCodex 本机操作（2026-09-07）

源码启动（当时无全局 `ocx`）：

```bash
cd /Users/gdkmjd/work/czz/GitFork/opencodex
bun install --frozen-lockfile
bun run build:gui          # 否则 GET / 回退 JSON：GUI build not found
bun run src/cli/index.ts start
```

仪表盘：`http://127.0.0.1:10100`。`ocx start` 默认会同步 Codex（`clientIntegrations.codex !== false` 即开启）。本轮后来在仪表盘打开了集成，并写入了 `~/.codex` 与 `~/.grok/config.toml` 的 managed block。

关停与清理（已做完）：

```bash
bun run src/cli/index.ts stop    # 停代理并按 journal 还原 Codex / 去掉 Grok fence
```

`ocx uninstall` 因端口探测误判失败，未再改共享配置。随后删除本轮状态：

- `~/.opencodex/`（整目录）
- `~/.codex/opencodex-catalog.json`（`stop` 后残留）

`stop` 后核验：`10100` 空闲；`~/.codex/config.toml` 无 `10100` / `opencodex`，`model_provider = "openai"`。源码检出未删。`models_cache.json` 可能仍有旧 “Routed via opencodex” 文案，官方下次刷新会覆盖。

## 非目标

- 不把 Codex++ / OpenCodex 做成 Host 的 Harness。
- 不在 Host 仓复制 AGPL 源码。
- 不把本笔记当作产品需求或 OpenSpec 能力规格。
