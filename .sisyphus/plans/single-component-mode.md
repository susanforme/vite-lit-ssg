# Add `single-component` mode to `litSSG()`

## TL;DR
> **Summary**: Add an opt-in `mode: "single-component"` path that bypasses page scanning, builds one configured Lit component, prerenders its DSD HTML, wraps that SSR output in a configurable custom-element wrapper, and writes a fixed `dist/index.html` plus client assets without disturbing the existing page-mode pipeline.
> **Deliverables**:
> - Discriminated plugin config for default page mode vs. `single-component`
> - New single-component client/server virtual modules and build runner
> - Minimal HTML renderer with wrapper support and `inherit | none | entry-only` preload policy
> - Unit + integration coverage for output shape, preload behavior, and default-mode regression
> - README/API documentation for the new mode
> **Effort**: Medium
> **Parallel**: YES - 2 waves
> **Critical Path**: 1 → 2 → 3 → 4 → 5 → 6 → 9 → F1-F4

## Context
### Original Request
- `litSSG()` 默认保持现有模式。
- 新增 `mode: "single-component"`。
- 该模式预编译单个组件片段，并把组件 SSR 结果放进一个可配置 root custom element wrapper 中。
- 产物固定为 `dist/index.html` 与对应客户端 JS。
- `single-component` 模式支持配置 wrapper 名称与 preload 策略，并覆盖当前默认注入行为。

### Interview Summary
- 新模式使用**单入口组件配置**，不复用 `pagesDir` 扫描。
- dev 环境可以保留便捷 shell 便于调试；生产构建聚焦单组件输出。
- 页面级能力（`title`、`meta`、`head`、`htmlAttrs`、`bodyAttrs`、`lang`）对 single-component **完全 out of scope**，不纳入设计。
- preload 首版采用受控枚举：`inherit | none | entry-only`。
- 测试策略选定为 **tests-after**。

### Metis Review (gaps addressed)
- 不在现有 page-mode 文件里堆叠大量条件分支；single-component 必须走**并行新链路**。
- `buildStart()`、`configureServer()`、CLI 扫描流程都必须按 mode 分支，避免 single-component 项目因缺少 `src/pages` 而报错。
- preload 过滤必须发生在 manifest 解析之后，而不是重写 manifest 遍历逻辑。
- wrapper 采用**字面量 custom element 标签**容器，而不是二次 SSR Lit wrapper 组件；即输出形态为 `<wrapper-tag><actual-component>...</actual-component></wrapper-tag>`。
- single-component 需要独立 virtual IDs、独立 renderer、独立 build runner；默认 page-mode 文件 `scanner/pages.ts`、`runtime/render-page.ts`、`runner/build.ts`、`virtual/server-entry.ts`、`output/write-route.ts` 不承担新模式核心逻辑。

## Work Objectives
### Core Objective
让 `vite-plugin-lit-ssg` 在保持默认 page-mode 完全兼容的前提下，新增一个明确、可测试、可部署的 `single-component` 构建模式。

### Deliverables
- `litSSG()` 模式化配置 API 与内部已解析配置契约
- single-component 专用 virtual client/server entry 生成器
- single-component 专用构建 runner
- single-component 专用 HTML renderer（最小文档壳 + wrapper + 资源注入）
- preload 策略实现：`inherit | none | entry-only`
- 单元测试、集成测试、默认模式回归保障
- README 文档与示例配置

### Definition of Done (verifiable conditions with commands)
- `pnpm --filter vite-plugin-lit-ssg typecheck`
- `pnpm --filter vite-plugin-lit-ssg test`
- `pnpm --filter vite-plugin-lit-ssg build`
- `pnpm test` 在仓库根目录通过

### Must Have
- `litSSG()` 默认调用保持现有行为与现有测试结果不变
- `mode: "single-component"` 时不扫描 `src/pages`
- 构建产物固定生成 `dist/index.html`
- `index.html` 中包含：最小文档壳、wrapper 标签、组件 DSD 输出、客户端模块脚本
- preload 策略仅支持 `inherit | none | entry-only`
- single-component 模式不支持页面级 head / meta / attrs 能力

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- 不修改默认模式输出结构或其 public API 语义
- 不把 single-component 设计成 page-mode 的“单页特例”
- 不在 single-component 模式中引入 `title`、`meta`、`head`、`htmlAttrs`、`bodyAttrs`、`lang`
- 不复用 `virtual:lit-ssg-server` / `virtual:lit-ssg-shared` / page virtual IDs
- 不重写 `resolveAssetsFromManifest()` 的递归收集规则；只在使用端过滤注入
- 不清理旧的 `LitSSGOptions` 遗留类型，除非阻塞编译

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: tests-after + Vitest
- QA policy: Every task has agent-executed scenarios
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: config contract, plugin branching, virtual entries, renderer, build runner
Wave 2: CLI dispatch, unit coverage, gating/regression tests, integration fixture, docs

### Dependency Matrix (full, all tasks)
| Task | Depends On | Enables |
|---|---|---|
| 1 | - | 2, 3, 5, 6, 10 |
| 2 | 1 | 3, 5, 6, 8 |
| 3 | 1, 2 | 5, 7, 8, 9 |
| 4 | 1, 3 | 5, 7, 9 |
| 5 | 1, 2, 3, 4 | 6, 9 |
| 6 | 1, 2, 5 | 8, 9 |
| 7 | 3, 4 | F1-F4 |
| 8 | 2, 3, 6 | F1-F4 |
| 9 | 5, 6, 7, 8 | F1-F4 |
| 10 | 1, 5, 9 | F1-F4 |

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 5 tasks → `unspecified-high` ×4, `quick` ×1
- Wave 2 → 5 tasks → `unspecified-high` ×3, `quick` ×1, `writing` ×1

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [ ] 1. Define the mode contract and single-component config surface

  **What to do**: In `packages/vite-plugin-lit-ssg/src/types.ts`, replace the current `LitSSGOptionsNew` interface with a discriminated union that preserves default page-mode compatibility while adding a new `mode: 'single-component'` branch. The single-component branch must define `entry`, `exportName?`, `wrapperTag?`, and `preload?`, with defaults of `exportName: 'default'`, `wrapperTag: 'lit-ssg-root'`, and `preload: 'inherit'`. Keep the legacy `LitSSGOptions` / `ResolvedLitSSGOptions` block untouched unless compilation forces a narrow compatibility shim. Add a small unit test file that locks the runtime-facing defaulting/normalization helper used by plugin state so later tasks do not re-decide option defaults.
  **Must NOT do**: Do not add page metadata fields to the single-component branch; do not delete the legacy types; do not require `mode` for existing callers that use `litSSG()` with no arguments.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: public typing changes affect multiple downstream modules and must stay backward compatible.
  - Skills: `[]` - No extra skill required; repo-local type patterns are sufficient.
  - Omitted: [`context7-mcp`] - Existing source contracts fully define the needed config shape.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 2, 3, 5, 6, 10 | Blocked By: none

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `packages/vite-plugin-lit-ssg/src/types.ts:6-39` - Legacy type block that must remain intact unless strictly necessary.
  - Pattern: `packages/vite-plugin-lit-ssg/src/types.ts:105-112` - Current authoritative `LitSSGOptionsNew` location to replace with a discriminated union.
  - Pattern: `packages/vite-plugin-lit-ssg/src/plugin/index.ts:29-39` - Current defaulting behavior for page-mode options.
  - Pattern: `packages/vite-plugin-lit-ssg/src/cli.ts:60-73` - Current consumer of plugin options; future discriminant must be usable here.
  - Test: `packages/vite-plugin-lit-ssg/tests/unit/cli-args.test.ts:1-65` - Existing compact unit-test style for configuration-related logic.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm --filter vite-plugin-lit-ssg typecheck` passes after introducing the discriminated config type.
  - [ ] `litSSG()` with no args remains type-valid and continues to imply the current page-mode defaults.
  - [ ] `mode: 'single-component'` requires an `entry` path and only accepts `inherit | none | entry-only` for preload.
  - [ ] A unit test locks normalization defaults for `exportName`, `wrapperTag`, and `preload`.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Config defaults normalize correctly
    Tool: Bash
    Steps: Run `pnpm --filter vite-plugin-lit-ssg test -- options-single-component.test.ts > .sisyphus/evidence/task-1-options-defaults.txt 2>&1`
    Expected: Exit code 0; evidence includes assertions for default `exportName`, `wrapperTag`, and `preload`
    Evidence: .sisyphus/evidence/task-1-options-defaults.txt

  Scenario: Existing page-mode typing remains stable
    Tool: Bash
    Steps: Run `pnpm --filter vite-plugin-lit-ssg typecheck > .sisyphus/evidence/task-1-typecheck.txt 2>&1`
    Expected: Exit code 0; no new type errors requiring `mode` in existing page-mode call sites
    Evidence: .sisyphus/evidence/task-1-typecheck.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `n/a`

- [ ] 2. Branch plugin state and dev/build hooks by mode

  **What to do**: Refactor `packages/vite-plugin-lit-ssg/src/plugin/index.ts` so plugin state is mode-aware and page scanning is skipped entirely for `single-component`. Add new single-component virtual IDs (`virtual:lit-ssg-single-client`, `virtual:lit-ssg-single-server`, `virtual:lit-ssg-single-dev`) and gate `buildStart()`, `configureServer()`, watcher setup, `resolveId()`, and `load()` so page-mode continues to use the existing scanner path while single-component mode serves a root-only dev shell without touching `scanPages()`. Preserve the WeakMap plugin-state pattern already used by the plugin.
  **Must NOT do**: Do not call `scanPages()` anywhere in single-component mode; do not reuse page-mode virtual IDs; do not change dev behavior for existing page-mode routes.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: this is the central mode split and mistakes here can break all existing workflows.
  - Skills: `[]` - Existing plugin implementation is the primary pattern.
  - Omitted: [`context7-mcp`] - No external API uncertainty beyond the current repo’s Vite plugin usage.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 3, 5, 6, 8 | Blocked By: 1

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `packages/vite-plugin-lit-ssg/src/plugin/index.ts:20-27` - Existing WeakMap-based plugin state pattern to preserve.
  - Pattern: `packages/vite-plugin-lit-ssg/src/plugin/index.ts:63-67` - `buildStart()` currently always scans pages; must be mode-gated.
  - Pattern: `packages/vite-plugin-lit-ssg/src/plugin/index.ts:69-130` - Watcher and rescan logic that must remain page-mode-only.
  - Pattern: `packages/vite-plugin-lit-ssg/src/plugin/index.ts:131-243` - Current dev HTML middleware that must branch to root-only single-component handling.
  - Pattern: `packages/vite-plugin-lit-ssg/src/plugin/index.ts:246-299` - Virtual module resolution/load structure to extend with new single-component IDs.
  - Risk Source: `packages/vite-plugin-lit-ssg/src/scanner/pages.ts:67-75` - `scanPages()` throws if pages dir is missing; single-component must never hit this path.

  **Acceptance Criteria** (agent-executable only):
  - [ ] In single-component mode, plugin startup does not access `scanPages()` or add `pagesDir` watchers.
  - [ ] In page-mode, existing virtual IDs and route middleware behavior remain unchanged.
  - [ ] In single-component mode dev server, `GET /` serves an HTML shell that points to the single-component dev virtual entry.
  - [ ] In single-component mode, non-root HTML requests fall through instead of using the page-mode 404 route list.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Single-component plugin path skips page scanning
    Tool: Bash
    Steps: Run `pnpm --filter vite-plugin-lit-ssg test -- plugin-single-mode.test.ts > .sisyphus/evidence/task-2-plugin-single-mode.txt 2>&1`
    Expected: Exit code 0; evidence shows assertions that `scanPages()` is not invoked and single virtual IDs are resolved
    Evidence: .sisyphus/evidence/task-2-plugin-single-mode.txt

  Scenario: Existing page-mode behavior still resolves current virtual entries
    Tool: Bash
    Steps: Run `pnpm --filter vite-plugin-lit-ssg test -- cli-args.test.ts render-page.test.ts > .sisyphus/evidence/task-2-page-regression.txt 2>&1`
    Expected: Exit code 0; no regressions in existing page-mode-related tests
    Evidence: .sisyphus/evidence/task-2-page-regression.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `n/a`

- [ ] 3. Create dedicated single-component virtual entries

  **What to do**: Add new virtual-entry generators in `packages/vite-plugin-lit-ssg/src/virtual/` for single-component mode. The client entry must import hydrate support and the configured component entry module. The server entry must import the configured module export (`exportName`, defaulting to `default`), derive the tag name with `customElements.getName(exportedCtor)`, throw a clear error if the export is missing or unregistered, and return a template for exactly one component tag. The dev entry must append the resolved component tag to `document.body` without introducing wrapper-specific behavior.
  **Must NOT do**: Do not modify `src/virtual/server-entry.ts` or `src/virtual/client-entry.ts`; do not guess the component export by scanning module text; do not require a second SSR pass for the wrapper.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: once the config and plugin branching exist, this is a focused new-file task with tight scope.
  - Skills: `[]` - Existing virtual entry patterns are sufficient.
  - Omitted: [`context7-mcp`] - No external library lookup is necessary beyond current repo examples.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 5, 7, 8, 9 | Blocked By: 1, 2

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `packages/vite-plugin-lit-ssg/src/virtual/client-entry.ts:3-10` - Current hydrate-support + import shape to mirror for the new client entry.
  - Pattern: `packages/vite-plugin-lit-ssg/src/virtual/server-entry.ts:3-29` - Current server-side tag resolution and error style to mirror, but for a single configured component.
  - Pattern: `packages/vite-plugin-lit-ssg/src/plugin/index.ts:258-299` - Current `load()` branches where the new generators will be wired in.
  - API/Type: `packages/vite-plugin-lit-ssg/src/types.ts:109-112` - Current option export location that task 1 will expand.

  **Acceptance Criteria** (agent-executable only):
  - [ ] New single-component client/server/dev virtual IDs resolve to generated source strings via plugin `load()`.
  - [ ] Server entry uses configured `exportName` and throws a clear error when the export is absent.
  - [ ] Server entry throws a clear error when the component export exists but has no registered custom-element tag.
  - [ ] Dev entry mounts the actual component tag and does not inject wrapper markup itself.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Virtual generators handle valid single-component input
    Tool: Bash
    Steps: Run `pnpm --filter vite-plugin-lit-ssg test -- single-virtual-entry.test.ts > .sisyphus/evidence/task-3-virtual-entries.txt 2>&1`
    Expected: Exit code 0; evidence shows generated client import, server render, and dev mount behavior
    Evidence: .sisyphus/evidence/task-3-virtual-entries.txt

  Scenario: Missing export or unregistered component produces explicit errors
    Tool: Bash
    Steps: Re-run `pnpm --filter vite-plugin-lit-ssg test -- single-virtual-entry.test.ts > .sisyphus/evidence/task-3-virtual-errors.txt 2>&1`
    Expected: Exit code 0; evidence includes dedicated negative-case assertions for missing export and missing custom-element registration
    Evidence: .sisyphus/evidence/task-3-virtual-errors.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `n/a`

- [ ] 4. Implement a dedicated single-component HTML renderer

  **What to do**: Create `packages/vite-plugin-lit-ssg/src/runtime/render-component.ts` as a separate renderer for single-component output. It must render the configured component template to DSD HTML, wrap the result in a literal custom-element wrapper tag, produce a minimal document shell (`<!doctype html>`, charset, viewport, body, DSD support scripts, client module script), and apply preload filtering after manifest resolution using these rules: `inherit` = current CSS + modulepreload behavior; `none` = keep CSS + entry script only, remove modulepreload links; `entry-only` = keep only the entry script, omit CSS preload/modulepreload additions. Retain DSD pending/polyfill behavior in the minimal shell because the output is still a deployable standalone `index.html`.
  **Must NOT do**: Do not edit `src/runtime/render-page.ts`; do not inject page-level title/meta/lang/body/html attrs; do not implement the wrapper as a second Lit SSR render.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: output semantics, DSD support, and preload policy all converge here.
  - Skills: `[]` - Existing renderer and tests are enough guidance.
  - Omitted: [`context7-mcp`] - The current repo’s SSR renderer already establishes the required patterns.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 5, 7, 9 | Blocked By: 1, 3

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `packages/vite-plugin-lit-ssg/src/runtime/render-page.ts:6-10` - Existing DSD pending style + polyfill scripts to preserve semantically in the new renderer.
  - Pattern: `packages/vite-plugin-lit-ssg/src/runtime/render-page.ts:27-39` - Current SSR HTML collection and asset link injection flow to mirror selectively.
  - Pattern: `packages/vite-plugin-lit-ssg/src/runtime/render-page.ts:52-66` - Current document-shell assembly pattern; single-component renderer should produce a smaller variant.
  - API/Type: `packages/vite-plugin-lit-ssg/src/assets/manifest.ts:11-31` - `AssetLinks` are resolved before rendering; preload filtering must happen after this point.
  - Test: `packages/vite-plugin-lit-ssg/tests/unit/render-page.test.ts:6-137` - Existing renderer assertions and DSD coverage to mirror where still applicable.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `renderComponent()` returns HTML containing the configured wrapper tag around the component SSR markup.
  - [ ] `renderComponent()` never emits `<title>`, `<meta name=...>`, `lang=`, `htmlAttrs`, or `bodyAttrs`-style output.
  - [ ] `inherit`, `none`, and `entry-only` each produce the expected asset injection shape.
  - [ ] DSD pending and polyfill behavior remain present in single-component `index.html`.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Renderer outputs wrapper + correct preload variants
    Tool: Bash
    Steps: Run `pnpm --filter vite-plugin-lit-ssg test -- render-component.test.ts > .sisyphus/evidence/task-4-render-component.txt 2>&1`
    Expected: Exit code 0; evidence shows `inherit`, `none`, and `entry-only` cases plus wrapper assertions
    Evidence: .sisyphus/evidence/task-4-render-component.txt

  Scenario: Renderer excludes page-level metadata APIs
    Tool: Bash
    Steps: Re-run `pnpm --filter vite-plugin-lit-ssg test -- render-component.test.ts > .sisyphus/evidence/task-4-render-scope.txt 2>&1`
    Expected: Exit code 0; evidence includes explicit assertions that title/meta/lang/html/body attrs are absent
    Evidence: .sisyphus/evidence/task-4-render-scope.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `n/a`

- [ ] 5. Implement the single-component build runner

  **What to do**: Add `packages/vite-plugin-lit-ssg/src/runner/build-single.ts` as a new production build path. It must mirror the shared Vite build setup in `runSSG()` (`root`, `base`, `mode`, `configFile`, cleanup discipline), but use the new single-component virtual client/server IDs instead of page inputs. Client build must emit one stable input entry for single-component assets; server build must load the new single server entry, render only route `/`, resolve manifest assets using the single-component client virtual key, call `renderComponent()`, and write output via `resolveRouteFilePath('/', outDir)` / `writeRoute()`. Add focused unit coverage for manifest key selection, root route output path, and cleanup behavior.
  **Must NOT do**: Do not modify `src/runner/build.ts`; do not introduce page arrays or route maps into single-component build logic; do not invent a new file-output helper for root output.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: build orchestration, manifest lookup, and server-bundle cleanup are cross-cutting and failure-prone.
  - Skills: `[]` - Existing runner + output helpers provide the pattern.
  - Omitted: [`context7-mcp`] - No external docs are needed for mirroring the repo’s current Vite build orchestration.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 6, 9, 10 | Blocked By: 1, 2, 3, 4

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `packages/vite-plugin-lit-ssg/src/runner/build.ts:11-16` - Existing server-build directory constants and entry naming.
  - Pattern: `packages/vite-plugin-lit-ssg/src/runner/build.ts:58-76` - Shared build-context shape and Vite config forwarding to preserve.
  - Pattern: `packages/vite-plugin-lit-ssg/src/runner/build.ts:79-145` - Existing client build → server build → manifest read → HTML write → cleanup flow to mirror.
  - Pattern: `packages/vite-plugin-lit-ssg/src/assets/manifest.ts:11-31` - Asset resolution contract; single-component must use this before applying preload filtering in the renderer.
  - Pattern: `packages/vite-plugin-lit-ssg/src/output/write-route.ts:4-21` - Existing root route file path (`/` → `index.html`) and write helper to reuse.
  - Test: `packages/vite-plugin-lit-ssg/tests/integration/ssg-convention.test.ts:11-85` - Existing runner-oriented integration style to mirror semantically.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `runSingleSSG()` accepts the same `BuildContext` shape as `runSSG()` and forwards `mode` / `configFile` into both Vite builds.
  - [ ] Client assets are resolved from the single-component manifest key, not from page-mode route maps.
  - [ ] The runner always renders exactly one output document to `dist/index.html`.
  - [ ] Temporary server-build artifacts are deleted after the run.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Single runner resolves root output and manifest key correctly
    Tool: Bash
    Steps: Run `pnpm --filter vite-plugin-lit-ssg test -- build-single.test.ts > .sisyphus/evidence/task-5-build-single.txt 2>&1`
    Expected: Exit code 0; evidence includes assertions for root route output, manifest key selection, and cleanup
    Evidence: .sisyphus/evidence/task-5-build-single.txt

  Scenario: Existing page-mode runner remains green
    Tool: Bash
    Steps: Run `pnpm --filter vite-plugin-lit-ssg test -- ssg-convention.test.ts > .sisyphus/evidence/task-5-page-runner-regression.txt 2>&1`
    Expected: Exit code 0; evidence shows current page-mode integration still passes
    Evidence: .sisyphus/evidence/task-5-page-runner-regression.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `n/a`

- [ ] 6. Dispatch CLI and internal option retrieval by mode

  **What to do**: Update the plugin’s internal option export/retrieval contract so CLI code can distinguish page-mode from single-component mode without reinterpreting raw user config. In `packages/vite-plugin-lit-ssg/src/cli.ts`, branch before `scanPages()`: page-mode continues to scan and call `runSSG()`, while single-component mode bypasses scanning and calls `runSingleSSG()` with the resolved single-component options. Preserve existing `--mode` and `--config` semantics for both modes. Add targeted CLI dispatch tests that prove single-component mode never touches `scanPages()`.
  **Must NOT do**: Do not make CLI behavior depend on guessing from the filesystem; do not remove existing `build` command parsing; do not duplicate build-context parsing between modes.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: this is the handoff point between config parsing and actual build execution.
  - Skills: `[]` - Existing CLI structure is sufficient.
  - Omitted: [`context7-mcp`] - Repo-local CLI patterns cover the entire behavior.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 8, 9 | Blocked By: 1, 2, 5

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `packages/vite-plugin-lit-ssg/src/cli.ts:9-27` - Current command and flag parsing to keep stable.
  - Pattern: `packages/vite-plugin-lit-ssg/src/cli.ts:33-73` - Current config load, plugin lookup, `scanPages()`, and `runSSG()` dispatch flow to branch.
  - Pattern: `packages/vite-plugin-lit-ssg/src/plugin/index.ts:308-315` - Current plugin option retrieval hook that CLI consumes.
  - Test: `packages/vite-plugin-lit-ssg/tests/unit/cli-args.test.ts:1-65` - Existing unit-test style for CLI behavior.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `vite-lit-ssg build --mode ... --config ...` still behaves the same for page-mode projects.
  - [ ] In single-component mode, CLI never calls `scanPages()` and dispatches directly to `runSingleSSG()`.
  - [ ] `mode` and `configFile` values are forwarded identically in both build paths.
  - [ ] Missing `litSSG()` plugin or invalid command handling stays unchanged.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: CLI dispatches single-component builds without page scanning
    Tool: Bash
    Steps: Run `pnpm --filter vite-plugin-lit-ssg test -- cli-single-mode.test.ts > .sisyphus/evidence/task-6-cli-single-mode.txt 2>&1`
    Expected: Exit code 0; evidence shows `scanPages()` is bypassed and `runSingleSSG()` is selected
    Evidence: .sisyphus/evidence/task-6-cli-single-mode.txt

  Scenario: Existing CLI arg parsing remains unchanged
    Tool: Bash
    Steps: Run `pnpm --filter vite-plugin-lit-ssg test -- cli-args.test.ts > .sisyphus/evidence/task-6-cli-args.txt 2>&1`
    Expected: Exit code 0; evidence shows current command/flag parsing is still intact
    Evidence: .sisyphus/evidence/task-6-cli-args.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `n/a`

- [ ] 7. Add reusable single-component test fixtures

  **What to do**: Create fixture assets under `packages/vite-plugin-lit-ssg/tests/fixtures/` for single-component mode. The fixture app must intentionally omit `src/pages/`, expose a named component export (to prove `exportName` works), and include three Vite config variants that differ only by preload strategy (`inherit`, `none`, `entry-only`) plus wrapper tag. Keep the fixture minimal and deterministic so later integration tests can inspect exact output strings. Add one small smoke test that validates the fixture contracts the integration suite relies on.
  **Must NOT do**: Do not mutate the existing `packages/playground` app for this new mode; do not create fixtures that require browser interaction; do not add page-mode files to the single-component fixture.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: fixture creation is self-contained once config and render contracts are decided.
  - Skills: `[]` - Existing playground and fixtures already show the repository’s expected structure.
  - Omitted: [`context7-mcp`] - No external references are needed for local fixture creation.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 9 | Blocked By: 3, 4

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `packages/vite-plugin-lit-ssg/tests/fixtures/spike-results.md:1-15` - Existing fixture area and naming precedent.
  - Pattern: `packages/playground/package.json:1-18` - Minimal app script structure that can inspire fixture shape if needed.
  - Pattern: `packages/playground/src/pages/index.ts:1-52` - Existing Lit component coding style; use only as a component reference, not as a page-mode contract.
  - Test: `packages/vite-plugin-lit-ssg/tests/integration/ssg-convention.test.ts:8-20` - Current integration fixture root pattern to mirror.

  **Acceptance Criteria** (agent-executable only):
  - [ ] The single-component fixture app has no `src/pages/` directory.
  - [ ] The fixture component is exported by name and registered with `@customElement(...)`.
  - [ ] Three config variants exist for `inherit`, `none`, and `entry-only` with a non-default wrapper tag.
  - [ ] A smoke test asserts fixture invariants so future refactors cannot silently invalidate the integration setup.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Fixture contracts are present and deterministic
    Tool: Bash
    Steps: Run `pnpm --filter vite-plugin-lit-ssg test -- single-component-fixture.test.ts > .sisyphus/evidence/task-7-fixture-smoke.txt 2>&1`
    Expected: Exit code 0; evidence confirms missing `src/pages`, named export usage, and three config variants
    Evidence: .sisyphus/evidence/task-7-fixture-smoke.txt

  Scenario: Fixture setup does not disturb existing playground expectations
    Tool: Bash
    Steps: Run `pnpm --filter vite-plugin-lit-ssg test -- flat-assets.test.ts > .sisyphus/evidence/task-7-playground-regression.txt 2>&1`
    Expected: Exit code 0; evidence shows existing playground build assertions still pass
    Evidence: .sisyphus/evidence/task-7-playground-regression.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `n/a`

- [ ] 8. Add focused regression tests for plugin and CLI mode gating

  **What to do**: Add or extend unit tests so the mode split is locked down independently of full builds. Cover these cases: plugin single-mode `load()` resolves the new virtual IDs; page-mode still resolves the old ones; CLI dispatch bypasses `scanPages()` in single-component mode; invalid single-component config (missing `entry`, unsupported preload) is rejected clearly if runtime validation exists. This task is about regression coverage, not new production code.
  **Must NOT do**: Do not rely on full integration builds for these cases; do not make tests assert implementation details unrelated to mode gating.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: these tests prevent future regressions in the mode split at low runtime cost.
  - Skills: `[]` - Existing Vitest patterns are sufficient.
  - Omitted: [`context7-mcp`] - No external documentation is necessary for test design.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 9 | Blocked By: 2, 3, 6

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `packages/vite-plugin-lit-ssg/src/plugin/index.ts:246-299` - Current virtual ID resolution/load branching that now needs explicit regression tests.
  - Pattern: `packages/vite-plugin-lit-ssg/src/cli.ts:67-73` - Current scan + build dispatch point to guard.
  - Test: `packages/vite-plugin-lit-ssg/tests/unit/cli-args.test.ts:25-65` - Existing CLI-focused Vitest style.
  - Test: `packages/vite-plugin-lit-ssg/tests/unit/render-page.test.ts:13-137` - Existing assertion style for low-level runtime behavior.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Unit tests fail if single-component mode accidentally reuses page-mode virtual IDs.
  - [ ] Unit tests fail if CLI single-mode dispatch ever calls `scanPages()`.
  - [ ] Unit tests prove page-mode still resolves current virtual IDs and parsing helpers.
  - [ ] Coverage is isolated enough that failures identify mode-gating bugs without running a full build.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Mode-gating unit coverage passes
    Tool: Bash
    Steps: Run `pnpm --filter vite-plugin-lit-ssg test -- plugin-single-mode.test.ts cli-single-mode.test.ts > .sisyphus/evidence/task-8-mode-gating.txt 2>&1`
    Expected: Exit code 0; evidence shows both plugin and CLI gating tests passing
    Evidence: .sisyphus/evidence/task-8-mode-gating.txt

  Scenario: Page-mode regression coverage remains green
    Tool: Bash
    Steps: Run `pnpm --filter vite-plugin-lit-ssg test -- cli-args.test.ts render-page.test.ts > .sisyphus/evidence/task-8-page-mode-regression.txt 2>&1`
    Expected: Exit code 0; evidence shows page-mode core unit tests still pass unchanged
    Evidence: .sisyphus/evidence/task-8-page-mode-regression.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `n/a`

- [ ] 9. Add end-to-end integration coverage for single-component output variants

  **What to do**: Add integration tests that build the single-component fixture app through the real plugin path and assert on the generated filesystem output. Cover at least four assertions: (1) the build succeeds with no `src/pages/`, (2) `dist/index.html` exists, (3) `dist/assets/` contains a client JS entry, and (4) `index.html` contains both the configured wrapper tag and the component’s DSD markup. Add separate assertions for `inherit`, `none`, and `entry-only` so preload behavior is validated at the real output level, not only in renderer unit tests.
  **Must NOT do**: Do not rely on browser automation; do not assert vague “looks correct” conditions; do not skip checking the actual emitted HTML strings.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: this is the authoritative proof that the full pipeline works in production mode.
  - Skills: `[]` - Existing integration tests provide the pattern.
  - Omitted: [`context7-mcp`] - Repo integration patterns are sufficient.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 10, F1-F4 | Blocked By: 5, 6, 7, 8

  **References** (executor has NO interview context - be exhaustive):
  - Test Pattern: `packages/vite-plugin-lit-ssg/tests/integration/ssg-convention.test.ts:11-85` - Existing build-and-read-output integration structure.
  - Test Pattern: `packages/vite-plugin-lit-ssg/tests/integration/flat-assets.test.ts:9-49` - Existing emitted-assets assertions to mirror for the single-component JS entry.
  - Runtime: `packages/vite-plugin-lit-ssg/src/runtime/render-page.ts:52-66` - Baseline document-output pattern; single-component integration should assert the minimal variant intentionally differs from this page-mode shell.
  - Output Helper: `packages/vite-plugin-lit-ssg/src/output/write-route.ts:4-10` - Root output path contract to assert (`dist/index.html`).

  **Acceptance Criteria** (agent-executable only):
  - [ ] Integration test proves single-component mode builds successfully when no `src/pages/` directory exists.
  - [ ] Integration test proves `dist/index.html` contains wrapper + component DSD markup + module script.
  - [ ] Integration test proves emitted JS assets exist in `dist/assets/`.
  - [ ] Integration test proves `inherit`, `none`, and `entry-only` differ exactly as designed.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Full single-component build succeeds and writes expected files
    Tool: Bash
    Steps: Run `pnpm --filter vite-plugin-lit-ssg test -- ssg-single-component.test.ts > .sisyphus/evidence/task-9-single-build.txt 2>&1`
    Expected: Exit code 0; evidence shows `dist/index.html`, wrapper markup, DSD output, and asset files
    Evidence: .sisyphus/evidence/task-9-single-build.txt

  Scenario: Preload variants differ correctly at integration level
    Tool: Bash
    Steps: Re-run `pnpm --filter vite-plugin-lit-ssg test -- ssg-single-component.test.ts > .sisyphus/evidence/task-9-preload-matrix.txt 2>&1`
    Expected: Exit code 0; evidence includes explicit assertions for `inherit`, `none`, and `entry-only`
    Evidence: .sisyphus/evidence/task-9-preload-matrix.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `n/a`

- [ ] 10. Update README and public examples for the new mode

  **What to do**: Update `README.md` so the plugin now documents two modes: the existing zero-config page-mode and the new `single-component` mode. Add one explicit `vite.config.ts` example showing `mode`, `entry`, `exportName`, `wrapperTag`, and `preload`; explain that page-level metadata APIs are not available in this mode; and document the exact emitted output contract (`dist/index.html` + client assets, wrapper around component DSD). Keep the existing page-mode Quick Start intact and additive.
  **Must NOT do**: Do not rewrite the README as if single-component were the default mode; do not document unsupported page-level options in single-component mode; do not omit the migration-safe statement that `litSSG()` still defaults to page-mode.

  **Recommended Agent Profile**:
  - Category: `writing` - Reason: this is user-facing API documentation with strong accuracy requirements.
  - Skills: `[]` - Existing README tone and structure are the target.
  - Omitted: [`context7-mcp`] - Documentation should reflect this repository’s implementation, not external examples.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: F1-F4 | Blocked By: 1, 5, 9

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `README.md:25-105` - Existing Quick Start and output-tree structure to preserve for page-mode.
  - Pattern: `README.md:143-163` - Current plugin options and “How It Works” sections that need additive mode-aware updates.
  - API/Type: `packages/vite-plugin-lit-ssg/src/types.ts:109-112` - Current options export location that will now represent both modes.
  - Test Pattern: `packages/vite-plugin-lit-ssg/tests/integration/ssg-convention.test.ts:30-85` - Existing verified-output assertion style to mirror when documenting the finalized single-component behavior.

  **Acceptance Criteria** (agent-executable only):
  - [ ] README explicitly states that plain `litSSG()` still means page-mode.
  - [ ] README documents single-component config fields and the fact that page-level metadata is unsupported there.
  - [ ] README example matches the implemented config names and defaults exactly.
  - [ ] Documentation claims are verified against the new integration test behavior, not guessed.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: README reflects actual single-component behavior
    Tool: Bash
    Steps: Run `pnpm --filter vite-plugin-lit-ssg test -- ssg-single-component.test.ts > .sisyphus/evidence/task-10-doc-truth.txt 2>&1`
    Expected: Exit code 0; documentation can be checked against the verified output contract in evidence
    Evidence: .sisyphus/evidence/task-10-doc-truth.txt

  Scenario: Existing page-mode documentation claims remain true
    Tool: Bash
    Steps: Run `pnpm --filter vite-plugin-lit-ssg test -- ssg-convention.test.ts > .sisyphus/evidence/task-10-page-doc-regression.txt 2>&1`
    Expected: Exit code 0; evidence confirms the original page-mode README path is still accurate
    Evidence: .sisyphus/evidence/task-10-page-doc-regression.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `n/a`

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy
- Single atomic commit after F1-F4 pass and after user explicitly approves the verified result.
- Recommended commit message: `feat(plugin): add single-component build mode`

## Success Criteria
- Default `litSSG()` usage remains green under the full existing test suite.
- `mode: "single-component"` can build a fixture app with no `src/pages/` directory.
- Generated `dist/index.html` contains wrapper + SSR component DSD + client JS.
- `inherit` preserves current preload behavior; `none` removes preload links; `entry-only` keeps entry script without modulepreload links.
- No single-component output includes page-level head metadata APIs or assertions.
