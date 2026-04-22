# Lit Source Transform Compression for Dev + Build

## TL;DR
> **Summary**: Extend the existing `vite-plugin-lit-ssg` source transform path so the same conservative Lit template compression runs in both Vite dev and production build, targeting only component-source `css`` ` and `html`` ` literals.
> **Deliverables**:
> - Import-aware AST matcher for in-scope Lit `css`/`html` templates
> - Safe template-literal minification wrapper using `@literals/html-css-minifier`
> - `transform`-hook integration in `packages/vite-plugin-lit-ssg/src/plugin/index.ts`
> - Unit + integration regression coverage for supported and skipped cases
> **Effort**: Medium
> **Parallel**: YES - 2 waves
> **Critical Path**: 1 → 2 → 3/4 → 5 → 6/7/8/9/10

## Context
### Original Request
在开发环境和生产环境都进行源码转换，并安全压缩 Lit 组件中的 `static get styles()` / `static styles = css`` ` 与 `render() { return html`` }` 内联模板；方案优先基于 AST 提取目标字符串/模板，再交给成熟库处理。

### Interview Summary
- dev 与 build 必须共用同一套转换规则。
- 本次仅覆盖组件源码，不扩展到 SSR/SSG 输出 HTML 压缩。
- 允许使用 Vite 或现有库；偏好 AST 定位后调用现成压缩库。
- 测试策略确定为 **tests-after**。
- `static get styles()` 与 `static styles = css`` ` 两种 styles 写法都要覆盖。

### Metis Review (gaps addressed)
- 已锁定保守安全边界：非 Lit 标签不得误伤、空白敏感/raw-text HTML 必须跳过、CSS 插值必须跳过、dev 调试体验不得因整文件二次编译而恶化。
- 已拒绝 scope creep：不做 SSR/产物 HTML 压缩、不做通用 JS 压缩、不引入 MVP 配置面。
- 已把需要决策的灰区转为默认规则：HTML 允许普通表达式但采用保守跳过表；CSS 仅压缩无插值模板；不支持 aliased `html/css` 导入作为 MVP。

## Work Objectives
### Core Objective
在 `packages/vite-plugin-lit-ssg/src/plugin/index.ts` 的现有源码改写路径上，新增一个 **单次 AST 扫描 + 单次 MagicString 回写** 的 Lit 模板压缩能力，使其在 Vite serve/build 下都对同一批源码形态执行相同、安全、可回归验证的压缩。

### Deliverables
- 新的模板压缩辅助模块（负责 AST 目标识别、调用 `@literals/html-css-minifier`、返回精确替换片段）
- 对现有 `transform` 钩子的集成，不破坏 `commonStyles` 重写逻辑
- 明确的支持矩阵 / 跳过矩阵 / 失败回退策略
- 单测、集成测试、类型检查与构建验证

### Definition of Done (verifiable conditions with commands)
- `pnpm --filter vite-plugin-lit-ssg-tests exec vitest run unit/plugin-lit-source-compression.test.ts` 通过。
- `pnpm --filter vite-plugin-lit-ssg-tests exec vitest run integration/dev-page-mode.test.ts integration/dev-single-component.test.ts integration/ssg-single-component.test.ts integration/ssg-convention.test.ts` 通过。
- `pnpm test` 通过。
- `pnpm typecheck` 通过。
- `pnpm build` 通过。
- `pnpm playground:build` 通过。

### Must Have
- 同一插件 `transform` 路径同时作用于 serve/build。
- 仅处理 **Lit 直接导入** 的 `html` / `css` 标签模板。
- 仅覆盖以下源码形态：
  - `static styles = css\`...\``
  - `static get styles() { return css\`...\`; }`
  - `render() { return html\`...\`; }`
- HTML 表达式允许存在，但遇到空白敏感/raw-text 风险模板必须跳过且保持源码不变。
- CSS 中任意插值 `${...}` 必须跳过且保持源码不变。
- 失败时必须“no crash, no partial corruption”。

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- 不压缩 SSR/SSG 生成后的 HTML 字符串或 dist 产物。
- 不压缩非 Lit 标签模板、aliased `html/css` 导入、`unsafeHTML()` 生成的字符串块。
- 不引入按文件/按模式切换的配置项。
- 不通过整文件再次转译来完成压缩。
- 不修改运行时渲染逻辑或 public API。

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: tests-after + Vitest (`packages/vite-plugin-lit-ssg-tests/package.json`)
- QA policy: Every task has agent-executed scenarios
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: T1 dependency/policy, T2 AST matcher, T3 CSS field compression, T4 CSS getter compression, T5 static HTML render compression

Wave 2: T6 dynamic HTML render compression, T7 page-mode integration, T8 single-component integration, T9 unsupported-shape hardening, T10 sourcemap + full regression verification

### Dependency Matrix (full, all tasks)
| Task | Depends On | Notes |
|---|---|---|
| T1 | — | picks library, wrapper contract, skip policy |
| T2 | T1 | matcher contract must align with wrapper inputs |
| T3 | T1, T2 | CSS path relies on final matcher and wrapper |
| T4 | T1, T2 | CSS getter path relies on final matcher and wrapper |
| T5 | T1, T2 | static HTML minifier path relies on final matcher and wrapper |
| T6 | T1, T2, T5 | dynamic HTML path extends the static HTML contract |
| T7 | T2, T3, T4, T5, T6 | integrates page-mode rewrite into the existing plugin |
| T8 | T3, T4, T5, T6, T7 | applies the same policy to single-component mode |
| T9 | T1, T2, T3, T4, T5, T6, T7 | formalizes skip/no-crash guarantees |
| T10 | T7, T8, T9 | final sourcemap and full-repo verification |

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 5 tasks → `unspecified-high` x4, `deep` x1
- Wave 2 → 5 tasks → `deep` x1, `unspecified-high` x3, `quick` x1

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Lock compression engine and policy module

  **What to do**: Add `@literals/html-css-minifier` to `packages/vite-plugin-lit-ssg/package.json` and create `packages/vite-plugin-lit-ssg/src/plugin/lit-source-compression.ts` as the single policy module. In that file, define the v1 support matrix, the skip matrix, the raw-text/whitespace-sensitive HTML skip list (`pre`, `textarea`, `script`, `style`, `title`, `svg`), and wrapper helpers that accept a target kind (`css-field`, `css-getter`, `html-render-static`, `html-render-dynamic`) plus original template text, call `minifyHTMLLiterals()` on an isolated synthetic snippet, and return either `{ changed, text }` or `{ changed: false, reason }`. Set `generateSourceMap: false` inside the wrapper because the file-level sourcemap must come only from the outer MagicString rewrite.
  **Must NOT do**: Do not introduce separate HTML/CSS minifier packages, do not re-run a whole-file secondary transpile, and do not add user-facing plugin options in MVP.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: dependency choice + safety policy + helper contract are repo-wide decisions.
  - Skills: [`context7-mcp`] - Reason: lock package API/behavior against current docs.
  - Omitted: [`code-worktree-guard`] - Reason: execution agent will already be operating from a plan; this task is about internal implementation details.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [2, 3, 4, 5, 9, 10] | Blocked By: []

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `packages/vite-plugin-lit-ssg/src/plugin/index.ts:558-679` - existing single-pass MagicString rewrite pattern to preserve.
  - Pattern: `packages/vite-plugin-lit-ssg/src/plugin/index.ts:1116-1163` - existing Vite `transform` hook where the new helper will be called.
  - Test: `packages/vite-plugin-lit-ssg-tests/unit/plugin-common-styles-transform.test.ts:115-149` - source-to-source assertion style for transformed modules.
  - External: `https://www.npmjs.com/package/@literals/html-css-minifier` - source-template minifier; supports JS/TS, source maps, HTML expressions, static CSS, and CSS-interpolation skip behavior.
  - External: `https://github.com/vitejs/vite/blob/main/docs/guide/api-plugin.md` - confirms `transform` runs in serve/build and `configResolved` can distinguish command.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `packages/vite-plugin-lit-ssg/src/plugin/lit-source-compression.ts` exists and exports an explicit support/skip policy for HTML/CSS templates.
  - [ ] `packages/vite-plugin-lit-ssg/package.json` contains `@literals/html-css-minifier`.
  - [ ] `pnpm --filter vite-plugin-lit-ssg-tests exec vitest run unit/plugin-lit-source-compression.test.ts --testNamePattern "policy module"` passes.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Policy wrapper returns minified text for supported static snippets
    Tool: Bash
    Steps: Run `pnpm --filter vite-plugin-lit-ssg-tests exec vitest run unit/plugin-lit-source-compression.test.ts --testNamePattern "policy module"`
    Expected: Tests assert CSS `css` and HTML `html` synthetic snippets return compacted output and no thrown errors.
    Evidence: .sisyphus/evidence/task-1-policy-module.txt

  Scenario: Unsupported policy path exits cleanly
    Tool: Bash
    Steps: Run the same targeted Vitest command and inspect the skip-case assertions in the test output.
    Expected: Tests confirm unsupported snippets return unchanged/skip metadata rather than partial rewrites or thrown exceptions.
    Evidence: .sisyphus/evidence/task-1-policy-module-skip.txt
  ```

  **Commit**: NO | Message: `feat(plugin): add lit compression policy wrapper` | Files: `packages/vite-plugin-lit-ssg/package.json`, `packages/vite-plugin-lit-ssg/src/plugin/lit-source-compression.ts`, `packages/vite-plugin-lit-ssg-tests/unit/plugin-lit-source-compression.test.ts`

- [x] 2. Implement import-aware AST target classifier

  **What to do**: In `lit-source-compression.ts`, add AST traversal utilities that operate on the existing TypeScript `SourceFile` and classify only in-scope targets. The matcher must require direct imports from `'lit'`, direct `html`/`css` identifiers (no alias support), and a `LitElement` subclass boundary reused from the current plugin helpers. Supported AST shapes for v1 are exactly: `static styles = css\`...\``, `static get styles() { return css\`...\`; }`, and `render() { return html\`...\`; }`; arrays, identifier indirection, helper-returned templates, aliased imports, `svg`, and non-component tagged templates must be marked `unsupported` and left unchanged.
  **Must NOT do**: Do not broaden matching to every tagged template in the file, do not support aliased imports, and do not infer Lit-ness from tag names alone.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: AST shape discrimination is the main semantic safety gate.
  - Skills: [] - Reason: repo-local TypeScript AST patterns already exist.
  - Omitted: [`context7-mcp`] - Reason: this task is driven by repository AST patterns, not external APIs.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [3, 4, 5, 9] | Blocked By: [1]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `packages/vite-plugin-lit-ssg/src/plugin/index.ts:586-617` - current `static styles` field/getter discrimination.
  - Pattern: `playground/page-mode/src/pages/about.ts:7-52` - supported getter styles + static HTML render shape.
  - Pattern: `playground/page-mode/src/pages/index.ts:7-48` - supported field styles + dynamic HTML render shape.
  - Pattern: `playground/single-component-app/src/demo-widget.ts:6-25` - single-component field styles + dynamic HTML render shape.
  - Test: `packages/vite-plugin-lit-ssg-tests/unit/plugin-common-styles-transform.test.ts:311-367` - getter edge cases and exact assertion style.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Matcher returns `supported` only for the three v1 shapes and returns `unsupported` for alias/array/helper/non-Lit cases.
  - [ ] The classifier can emit ordered replacement targets without overlapping ranges.
  - [ ] `pnpm --filter vite-plugin-lit-ssg-tests exec vitest run unit/plugin-lit-source-compression.test.ts --testNamePattern "target classifier"` passes.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Supported AST shapes are discovered in stable source order
    Tool: Bash
    Steps: Run `pnpm --filter vite-plugin-lit-ssg-tests exec vitest run unit/plugin-lit-source-compression.test.ts --testNamePattern "target classifier"`
    Expected: Tests assert field/getter/render targets are found with non-overlapping ranges and stable ordering.
    Evidence: .sisyphus/evidence/task-2-target-classifier.txt

  Scenario: Unsupported shapes are explicitly skipped
    Tool: Bash
    Steps: Run the same targeted Vitest command.
    Expected: Tests cover aliased imports, arrays, helper-returned templates, and non-Lit tagged templates, all remaining unchanged.
    Evidence: .sisyphus/evidence/task-2-target-classifier-skip.txt
  ```

  **Commit**: NO | Message: `feat(plugin): add lit template target classifier` | Files: `packages/vite-plugin-lit-ssg/src/plugin/lit-source-compression.ts`, `packages/vite-plugin-lit-ssg-tests/unit/plugin-lit-source-compression.test.ts`

- [x] 3. Add CSS field compression for `static styles = css```

  **What to do**: Extend the policy helper so direct `static styles = css\`...\`` fields with **zero expressions** are minified through the isolated wrapper snippet, and their original tagged-template raw text is replaced in-place via file-level MagicString ranges collected from the classifier. Preserve quote/backtick form, preserve the `css` tag, and ensure the replacement writes only the literal body so surrounding class syntax stays untouched. If the `css` template contains any `${...}` interpolation, record a skip and leave the field byte-stable.
  **Must NOT do**: Do not minify CSS arrays, `localStyles` identifiers, `unsafeCSS(...)`, or interpolated `css` templates.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: precision overwrite logic must remain syntactically correct while preserving class structure.
  - Skills: [`context7-mcp`] - Reason: CSS minification behavior comes from the chosen library contract.
  - Omitted: [`code-worktree-guard`] - Reason: this task is internal source manipulation, not workflow policy.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [5, 7, 8, 10] | Blocked By: [1, 2]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `playground/page-mode/src/pages/index.ts:7-33` - direct `static styles = css`` ` field shape.
  - Pattern: `playground/single-component-app/src/demo-widget.ts:6-15` - second real field-style example.
  - Pattern: `packages/vite-plugin-lit-ssg/src/plugin/index.ts:593-603` - current field initializer overwrite pattern.
  - Test: `packages/vite-plugin-lit-ssg-tests/unit/plugin-common-styles-transform.test.ts:196-245` - field-expression and array cases that must remain out of scope for minification.
  - External: `https://www.npmjs.com/package/@literals/html-css-minifier` - documents static CSS minification and CSS interpolation skip behavior.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Direct `static styles = css\`p { color: red; }\`` rewrites to `static styles = css\`p{color:red}\``.
  - [ ] Interpolated CSS fields remain unchanged.
  - [ ] `pnpm --filter vite-plugin-lit-ssg-tests exec vitest run unit/plugin-lit-source-compression.test.ts --testNamePattern "css field"` passes.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Static CSS field is minified
    Tool: Bash
    Steps: Run `pnpm --filter vite-plugin-lit-ssg-tests exec vitest run unit/plugin-lit-source-compression.test.ts --testNamePattern "css field"`
    Expected: Tests assert transformed source contains exactly ``static styles = css`p{color:red}```.
    Evidence: .sisyphus/evidence/task-3-css-field.txt

  Scenario: Interpolated CSS field is skipped unchanged
    Tool: Bash
    Steps: Run the same targeted Vitest command.
    Expected: Tests assert a `${value}` CSS field remains byte-identical and no exception is thrown.
    Evidence: .sisyphus/evidence/task-3-css-field-skip.txt
  ```

  **Commit**: NO | Message: `feat(plugin): minify static css fields` | Files: `packages/vite-plugin-lit-ssg/src/plugin/lit-source-compression.ts`, `packages/vite-plugin-lit-ssg-tests/unit/plugin-lit-source-compression.test.ts`

- [x] 4. Add CSS getter compression for `static get styles()`

  **What to do**: Support only the simple getter shape `static get styles() { return css\`...\`; }`. Reuse the same CSS minification wrapper from Task 3 and overwrite only the getter return expression’s tagged-template body. Complex getters with conditionals, multiple returns, arrays, helper calls, or non-tagged returns must be classified unsupported and left unchanged, matching the repo’s existing getter safety precedent.
  **Must NOT do**: Do not add fallback rewriting for complex getters and do not change existing error/skip semantics outside the new minification path.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: getter support must align tightly with existing static-style safety rules.
  - Skills: [] - Reason: repo already contains the required getter-pattern precedent.
  - Omitted: [`context7-mcp`] - Reason: this is shape-control work, not new library behavior.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [5, 7, 8, 10] | Blocked By: [1, 2]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `playground/page-mode/src/pages/about.ts:7-35` - supported getter return shape.
  - Pattern: `packages/vite-plugin-lit-ssg/src/plugin/index.ts:606-616` - existing getter return overwrite path.
  - Test: `packages/vite-plugin-lit-ssg-tests/unit/plugin-common-styles-transform.test.ts:311-367` - complex getter rejection + simple getter success precedent.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Simple getter `return css\`p { color: rebeccapurple; }\`` rewrites to `return css\`p{color:rebeccapurple}\``.
  - [ ] Complex getters stay unchanged and do not crash the transform.
  - [ ] `pnpm --filter vite-plugin-lit-ssg-tests exec vitest run unit/plugin-lit-source-compression.test.ts --testNamePattern "css getter"` passes.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Simple CSS getter is minified
    Tool: Bash
    Steps: Run `pnpm --filter vite-plugin-lit-ssg-tests exec vitest run unit/plugin-lit-source-compression.test.ts --testNamePattern "css getter"`
    Expected: Tests assert transformed getter output contains exactly ``return css`p{color:rebeccapurple}```.
    Evidence: .sisyphus/evidence/task-4-css-getter.txt

  Scenario: Complex getter is skipped without corruption
    Tool: Bash
    Steps: Run the same targeted Vitest command.
    Expected: Conditional/multi-return getter fixtures remain unchanged and the transform returns successfully.
    Evidence: .sisyphus/evidence/task-4-css-getter-skip.txt
  ```

  **Commit**: NO | Message: `feat(plugin): minify simple css getters` | Files: `packages/vite-plugin-lit-ssg/src/plugin/lit-source-compression.ts`, `packages/vite-plugin-lit-ssg-tests/unit/plugin-lit-source-compression.test.ts`

- [x] 5. Add static HTML render compression

  **What to do**: Support `render() { return html\`...\`; }` when the returned Lit template has no expressions and does not contain any skip-list tags. Reuse the isolated wrapper strategy from Task 1, preserve the `html` tag and surrounding method structure, and overwrite only the raw template body. The output must collapse indentation/newlines/extra spaces conservatively but keep attribute/binding syntax valid for Lit.
  **Must NOT do**: Do not touch non-`render()` methods, non-Lit tagged templates, or HTML fragments containing `pre`, `textarea`, `script`, `style`, `title`, or `svg`.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: HTML compaction is semantics-sensitive and must stay conservative.
  - Skills: [`context7-mcp`] - Reason: behavior depends on the chosen template-literal minifier’s HTML engine.
  - Omitted: [`code-worktree-guard`] - Reason: this is implementation detail inside an already-scoped plan.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [7, 8, 10] | Blocked By: [1, 2]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `playground/page-mode/src/pages/about.ts:38-52` - static `render() { return html`` }` without expressions.
  - Pattern: `packages/vite-plugin-lit-ssg/src/plugin/index.ts:1116-1163` - final integration point that will consume this helper.
  - Test: `packages/vite-plugin-lit-ssg-tests/integration/dev-page-mode.test.ts:29-55` - current dev SSR assertions to extend with minified-source checks.
  - External: `https://www.npmjs.com/package/@literals/html-css-minifier` - HTML tagged-template minification behavior and dynamic-tag handling documentation.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Static render template like ``html`<div class="a"> x </div>` `` rewrites to ``html`<div class="a">x</div>` ``.
  - [ ] Static render templates with skip-list tags remain unchanged.
  - [ ] `pnpm --filter vite-plugin-lit-ssg-tests exec vitest run unit/plugin-lit-source-compression.test.ts --testNamePattern "html static render"` passes.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Static render template is minified
    Tool: Bash
    Steps: Run `pnpm --filter vite-plugin-lit-ssg-tests exec vitest run unit/plugin-lit-source-compression.test.ts --testNamePattern "html static render"`
    Expected: Tests assert transformed source contains exactly ``html`<div class="a">x</div>```.
    Evidence: .sisyphus/evidence/task-5-html-static.txt

  Scenario: Whitespace-sensitive static template is skipped
    Tool: Bash
    Steps: Run the same targeted Vitest command.
    Expected: A fixture such as ``html`<pre> a   b </pre>` `` remains unchanged and no exception is thrown.
    Evidence: .sisyphus/evidence/task-5-html-static-skip.txt
  ```

  **Commit**: NO | Message: `feat(plugin): minify static render templates` | Files: `packages/vite-plugin-lit-ssg/src/plugin/lit-source-compression.ts`, `packages/vite-plugin-lit-ssg-tests/unit/plugin-lit-source-compression.test.ts`

- [x] 6. Add dynamic HTML render compression

  **What to do**: Extend the HTML path to support `render()` templates containing ordinary Lit expressions (text/content bindings, attribute/property/event bindings, and dynamic tag-name placeholders that the library can safely round-trip). Keep the same skip list for raw-text/whitespace-sensitive tags, and if the helper reports parse/minify failure, return the original template unchanged. Add explicit fixtures for `@click=${this.handleClick}` and `${name}` content bindings so the plan proves dynamic expressions survive intact while surrounding whitespace is reduced.
  **Must NOT do**: Do not minify through `unsafeHTML()`, do not change binding sigils (`@`, `.`, `?`), and do not remove spaces across expression boundaries unless the library output is already proven by tests.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: dynamic Lit expression preservation is the trickiest semantic part of the feature.
  - Skills: [`context7-mcp`] - Reason: this task depends on current library support for expression placeholders and dynamic tag names.
  - Omitted: [`code-worktree-guard`] - Reason: worktree/commit policy belongs to execution orchestration, not this task’s implementation logic.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [7, 8, 10] | Blocked By: [1, 2, 5]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `playground/page-mode/src/pages/index.ts:38-48` - dynamic event-binding render example.
  - Pattern: `playground/single-component-app/src/demo-widget.ts:21-25` - second dynamic event-binding render example.
  - Test: `packages/vite-plugin-lit-ssg-tests/integration/dev-single-component.test.ts:54-63` - transformed module fetch assertion to extend with minified HTML-source checks.
  - External: `https://www.npmjs.com/package/@literals/html-css-minifier` - docs confirm HTML placeholder support and dynamic tag-name restoration.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Dynamic template like ``html`<div> ${name} </div>` `` rewrites to a documented minified form that preserves `${name}`.
  - [ ] Event-binding template like ``html`<button @click=${this.handleClick}> Click me </button>` `` preserves `@click=${this.handleClick}` while compacting static whitespace.
  - [ ] `pnpm --filter vite-plugin-lit-ssg-tests exec vitest run unit/plugin-lit-source-compression.test.ts --testNamePattern "html dynamic render"` passes.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Dynamic render template preserves expressions while minifying static HTML
    Tool: Bash
    Steps: Run `pnpm --filter vite-plugin-lit-ssg-tests exec vitest run unit/plugin-lit-source-compression.test.ts --testNamePattern "html dynamic render"`
    Expected: Tests assert `${name}` and `@click=${this.handleClick}` remain intact while surrounding whitespace is reduced to the chosen canonical output.
    Evidence: .sisyphus/evidence/task-6-html-dynamic.txt

  Scenario: Dynamic template failure path leaves source untouched
    Tool: Bash
    Steps: Run the same targeted Vitest command.
    Expected: A parse-failure or skip-list fixture returns unchanged source and no partial rewrite.
    Evidence: .sisyphus/evidence/task-6-html-dynamic-skip.txt
  ```

  **Commit**: NO | Message: `feat(plugin): minify dynamic render templates` | Files: `packages/vite-plugin-lit-ssg/src/plugin/lit-source-compression.ts`, `packages/vite-plugin-lit-ssg-tests/unit/plugin-lit-source-compression.test.ts`

- [x] 7. Integrate compression into the page-mode transform path

  **What to do**: Update `packages/vite-plugin-lit-ssg/src/plugin/index.ts` so page-mode modules go through the new classifier + literal overwrite flow inside the existing `transform` hook. Preserve the current page-target resolution logic, run `commonStyles` rewriting first when applicable, then build a fresh `SourceFile` from the post-`commonStyles` code and apply the compression overwrites on that version so final output includes both features. Generate one file-level MagicString map from the compression pass and return the combined transformed code for serve/build without adding a second Vite plugin.
  **Must NOT do**: Do not create a second plugin instance, do not bypass the current page route resolution, and do not let compression run on modules outside `shouldHandleModule(cleanId)`.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: this is the main integration seam across existing page-mode behavior.
  - Skills: [] - Reason: the repo already contains the relevant plugin control flow.
  - Omitted: [`context7-mcp`] - Reason: this task is integration of already-chosen APIs, not API discovery.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: [8, 9, 10] | Blocked By: [2, 3, 4, 5, 6]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `packages/vite-plugin-lit-ssg/src/plugin/index.ts:1116-1163` - existing page/single transform dispatch.
  - Pattern: `packages/vite-plugin-lit-ssg/src/plugin/index.ts:1137-1156` - page target resolution flow that must remain intact.
  - Test: `packages/vite-plugin-lit-ssg-tests/integration/dev-page-mode.test.ts:29-55` - dev server verification baseline.
  - Test: `packages/vite-plugin-lit-ssg-tests/integration/ssg-convention.test.ts:31-104` - build output verification baseline.
  - External: `https://github.com/vitejs/vite/blob/main/docs/guide/api-plugin.md` - `transform` behavior across serve/build.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Dev page-mode responses still contain valid SSR HTML and now originate from minified component source where supported.
  - [ ] Build page-mode outputs still contain valid SSR HTML and metadata after compression.
  - [ ] `pnpm --filter vite-plugin-lit-ssg-tests exec vitest run integration/dev-page-mode.test.ts integration/ssg-convention.test.ts` passes.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Page-mode dev server keeps SSR behavior after compression integration
    Tool: Bash
    Steps: Run `pnpm --filter vite-plugin-lit-ssg-tests exec vitest run integration/dev-page-mode.test.ts`
    Expected: SSR HTML, title, and hydration-entry assertions still pass; added assertions prove served module source is minified where supported.
    Evidence: .sisyphus/evidence/task-7-page-dev.txt

  Scenario: Page-mode build output stays correct after compression integration
    Tool: Bash
    Steps: Run `pnpm --filter vite-plugin-lit-ssg-tests exec vitest run integration/ssg-convention.test.ts`
    Expected: Built `index.html` and `about/index.html` still pass existing SSR checks and new assertions verify minified-source effects reach output.
    Evidence: .sisyphus/evidence/task-7-page-build.txt
  ```

  **Commit**: NO | Message: `feat(plugin): integrate page-mode source compression` | Files: `packages/vite-plugin-lit-ssg/src/plugin/index.ts`, `packages/vite-plugin-lit-ssg/src/plugin/lit-source-compression.ts`, `packages/vite-plugin-lit-ssg-tests/integration/dev-page-mode.test.ts`, `packages/vite-plugin-lit-ssg-tests/integration/ssg-convention.test.ts`

- [x] 8. Integrate compression into the single-component transform path

  **What to do**: Extend the same `transform`-hook integration so single-component mode (`entry` + `exportName` resolution) receives the identical compression policy as page mode. Preserve the current `commonStyles` single-component behavior, ensure minification affects the served entry module in dev and the final hydration/server bundles in build, and add assertions against the transformed `/src/demo-widget.ts` dev response plus generated `dist/index.html`/bundle contents.
  **Must NOT do**: Do not special-case single-component mode with a second compression policy and do not break named-export handling or preload variants.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: this is a second integration seam with separate routing/export resolution paths.
  - Skills: [] - Reason: existing single-component test fixtures already encode the behavior to preserve.
  - Omitted: [`context7-mcp`] - Reason: no new external API decisions are introduced here.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [10] | Blocked By: [3, 4, 5, 6, 7]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `packages/vite-plugin-lit-ssg/src/plugin/index.ts:1142-1156` - single-component export target resolution path.
  - Pattern: `playground/single-component-app/src/demo-widget.ts:6-25` - field styles + dynamic render example used by single-component mode.
  - Test: `packages/vite-plugin-lit-ssg-tests/integration/dev-single-component.test.ts:34-63` - dev shell and transformed-module assertions.
  - Test: `packages/vite-plugin-lit-ssg-tests/integration/ssg-single-component.test.ts:25-107` - build-output assertions to extend.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Dev single-component served module contains minified supported templates and still includes expected `commonStyles` markers.
  - [ ] Build single-component output remains wrapper-contained and still hydrates with common styles present.
  - [ ] `pnpm --filter vite-plugin-lit-ssg-tests exec vitest run integration/dev-single-component.test.ts integration/ssg-single-component.test.ts` passes.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Single-component dev module is minified without breaking shell rendering
    Tool: Bash
    Steps: Run `pnpm --filter vite-plugin-lit-ssg-tests exec vitest run integration/dev-single-component.test.ts`
    Expected: Existing shell assertions pass and new module-response assertions prove supported `html`/`css` templates were minified.
    Evidence: .sisyphus/evidence/task-8-single-dev.txt

  Scenario: Single-component build output stays correct across variants
    Tool: Bash
    Steps: Run `pnpm --filter vite-plugin-lit-ssg-tests exec vitest run integration/ssg-single-component.test.ts`
    Expected: Wrapper, DSD, hydration, preload-variant, and bundle-marker assertions still pass after source compression integration.
    Evidence: .sisyphus/evidence/task-8-single-build.txt
  ```

  **Commit**: NO | Message: `feat(plugin): integrate single-component source compression` | Files: `packages/vite-plugin-lit-ssg/src/plugin/index.ts`, `packages/vite-plugin-lit-ssg/src/plugin/lit-source-compression.ts`, `packages/vite-plugin-lit-ssg-tests/integration/dev-single-component.test.ts`, `packages/vite-plugin-lit-ssg-tests/integration/ssg-single-component.test.ts`

- [x] 9. Harden unsupported-shape and no-crash behavior

  **What to do**: Add explicit skip-path implementation and tests for aliased Lit imports, non-Lit `html`/`css` tags, `svg` templates, arrays/composed styles, identifier-indirected styles, `unsafeHTML()` content, whitespace-sensitive/raw-text tags, and parser/minifier exceptions. Every unsupported case must return original source unchanged and must not suppress unrelated plugin behavior. Record skip reasons in internal helper return values for debuggability, but do not expose them as public API.
  **Must NOT do**: Do not silently broaden support for any skipped shape and do not throw from the transform for minifier-only failures.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: safety hardening is mostly about edge-case discipline and non-regression.
  - Skills: [] - Reason: all required knowledge comes from the plan’s locked support matrix.
  - Omitted: [`context7-mcp`] - Reason: no further API discovery is needed; this is repository-local hardening.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [10] | Blocked By: [1, 2, 3, 4, 5, 6, 7]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `packages/vite-plugin-lit-ssg/src/plugin/index.ts:608-609` - current explicit guardrail style for unsupported getter complexity.
  - Pattern: `packages/vite-plugin-lit-ssg-tests/unit/plugin-common-styles-transform.test.ts:221-245` - out-of-scope `localStyles` expression precedent.
  - Pattern: `packages/vite-plugin-lit-ssg-tests/unit/plugin-common-styles-transform.test.ts:311-339` - unsupported complex getter precedent.
  - Test: `packages/vite-plugin-lit-ssg-tests/vitest.config.ts:3-11` - node-environment coverage entrypoint for all unit/integration files.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Unsupported shapes are covered by exact “unchanged source” assertions.
  - [ ] Minifier exceptions do not crash the Vite transform hook.
  - [ ] `pnpm --filter vite-plugin-lit-ssg-tests exec vitest run unit/plugin-lit-source-compression.test.ts --testNamePattern "unsupported|skip|no crash"` passes.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Unsupported syntax stays byte-stable
    Tool: Bash
    Steps: Run `pnpm --filter vite-plugin-lit-ssg-tests exec vitest run unit/plugin-lit-source-compression.test.ts --testNamePattern "unsupported|skip"`
    Expected: Aliases, arrays, helper indirection, raw-text tags, and non-Lit tags all remain unchanged.
    Evidence: .sisyphus/evidence/task-9-skip-matrix.txt

  Scenario: Minifier failure path does not crash
    Tool: Bash
    Steps: Run `pnpm --filter vite-plugin-lit-ssg-tests exec vitest run unit/plugin-lit-source-compression.test.ts --testNamePattern "no crash"`
    Expected: A forced helper/minifier failure returns original source and the test process exits successfully.
    Evidence: .sisyphus/evidence/task-9-no-crash.txt
  ```

  **Commit**: NO | Message: `fix(plugin): harden lit compression skip paths` | Files: `packages/vite-plugin-lit-ssg/src/plugin/lit-source-compression.ts`, `packages/vite-plugin-lit-ssg-tests/unit/plugin-lit-source-compression.test.ts`

- [x] 10. Finalize sourcemap and full-repo regression coverage

  **What to do**: Ensure the compression pass produces stable file-level MagicString maps after `commonStyles` rewrites and before Vite consumes the transformed module. Add targeted assertions that transformed modules remain decorator-free where expected, source transforms do not duplicate helper imports, and the repo still passes typecheck/build/test/playground build. If any fixture output changes only because of canonical minified whitespace, update the assertion strings to the new documented canonical output rather than loosening them.
  **Must NOT do**: Do not weaken assertions to broad substring checks where exact transformed output should be asserted, and do not ship with unverified sourcemap behavior.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: this is verification-heavy cleanup once feature behavior is already fixed.
  - Skills: [] - Reason: no new architecture decisions remain.
  - Omitted: [`context7-mcp`] - Reason: this task is entirely repo verification and assertion hardening.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: [F1, F2, F3, F4] | Blocked By: [7, 8, 9]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `packages/vite-plugin-lit-ssg/src/plugin/index.ts:652-677` - file-level MagicString map generation pattern to preserve.
  - Test: `packages/vite-plugin-lit-ssg-tests/integration/dev-single-component.test.ts:54-63` - module-response assertions that should stay exact and can catch duplicated helper imports.
  - Test: `package.json:6-13` - exact repo-wide verification commands.
  - Test: `packages/vite-plugin-lit-ssg-tests/package.json:6-8` - exact Vitest invocation points.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Targeted source-transform assertions remain exact, not vague.
  - [ ] `pnpm test` passes.
  - [ ] `pnpm typecheck` passes.
  - [ ] `pnpm build` passes.
  - [ ] `pnpm playground:build` passes.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Full automated regression suite passes
    Tool: Bash
    Steps: Run `pnpm test && pnpm typecheck && pnpm build && pnpm playground:build`
    Expected: All commands exit 0 with no fixture regressions or duplicated-helper/source-map failures.
    Evidence: .sisyphus/evidence/task-10-full-regression.txt

  Scenario: Exact transformed-module assertions stay strict
    Tool: Bash
    Steps: Run `pnpm --filter vite-plugin-lit-ssg-tests exec vitest run integration/dev-single-component.test.ts unit/plugin-lit-source-compression.test.ts`
    Expected: Tests assert exact canonical minified strings and detect any duplicated helper blocks or unstable rewrites.
    Evidence: .sisyphus/evidence/task-10-strict-assertions.txt
  ```

  **Commit**: NO | Message: `test(plugin): verify lit compression regressions` | Files: `packages/vite-plugin-lit-ssg/src/plugin/index.ts`, `packages/vite-plugin-lit-ssg/src/plugin/lit-source-compression.ts`, `packages/vite-plugin-lit-ssg-tests/unit/plugin-lit-source-compression.test.ts`, `packages/vite-plugin-lit-ssg-tests/integration/dev-page-mode.test.ts`, `packages/vite-plugin-lit-ssg-tests/integration/dev-single-component.test.ts`, `packages/vite-plugin-lit-ssg-tests/integration/ssg-convention.test.ts`, `packages/vite-plugin-lit-ssg-tests/integration/ssg-single-component.test.ts`

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [x] F1. Plan Compliance Audit — oracle
- [x] F2. Code Quality Review — unspecified-high
- [x] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [x] F4. Scope Fidelity Check — deep

## Commit Strategy
- Single atomic commit after T1-T10 and F1-F4 all pass and the user explicitly approves completion.
- Conventional commit message: `feat(plugin): add safe lit source template compression`
- No intermediate commits.

## Success Criteria
- The repository gains one conservative, source-level Lit template compression path shared by dev/build.
- Supported templates are minified with exact string assertions in tests.
- Unsupported/risky templates remain byte-stable or intentionally unchanged.
- Existing `commonStyles` behavior keeps passing without regression.
- All repo-level verification commands complete successfully.
