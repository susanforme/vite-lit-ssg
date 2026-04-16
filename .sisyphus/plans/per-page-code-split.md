# Per-page Code Splitting for vite-plugin-lit-ssg

## TL;DR

> **Quick Summary**: 把当前"单一 virtual client entry 包含所有页面"的架构，改造为每个页面独立 virtual entry + Rollup 原生 code splitting 自动提取共享 Lit 运行时，让每个路由只加载自己所需的组件代码。
>
> **Deliverables**:
> - 每个页面有独立的 `virtual:lit-ssg-page/{name}` entry
> - 一个共享 `virtual:lit-ssg-shared` entry 承载 hydration support
> - Rollup 自动 code split 共享 Lit 库代码
> - manifest 解析逻辑按页面 key 查找对应 entry
> - 每个 HTML 只注入本页面的 `<script>` 和 preloads
>
> **Estimated Effort**: Short  
> **Parallel Execution**: NO - sequential (相互依赖)  
> **Critical Path**: Task 1 → Task 2 → Task 3 → Task 4 → Task 5

---

## Context

### Original Request
用户发现 `packages/playground/dist/assets/_virtual_lit-ssg-client-EIUuYubr.js` 包含重复冗余的 DOM 和 CSS。

### 问题分析

**问题根源**：`src/virtual/client-entry.ts` 的 `generateClientEntry()` 把所有页面都 import 进同一个 virtual entry：

```ts
import '@lit-labs/ssr-client/lit-element-hydrate-support.js'
import '/src/pages/index.ts'   // home-page
import '/src/pages/about.ts'   // about-page  ← 访问 / 时也会下载这个！
```

**后果**：
1. 访问 `/` 下载 about-page 的 CSS + render 模板（纯浪费）
2. 访问 `/about` 下载 home-page 的 CSS + render 模板（纯浪费）
3. 当页面数量增长时，每个页面都要下载所有其他页面的代码

**当前 manifest**（只有 1 个 entry）：
```json
{
  "virtual:lit-ssg-client": {
    "file": "assets/_virtual_lit-ssg-client-EIUuYubr.js",
    "isEntry": true
  }
}
```

### 目标架构

**Rollup multi-entry input**：
```ts
rollupOptions: {
  input: {
    'lit-ssg-shared': 'virtual:lit-ssg-shared',           // hydrate support only
    'lit-ssg-page-index': 'virtual:lit-ssg-page/index',   // home-page only
    'lit-ssg-page-about': 'virtual:lit-ssg-page/about',   // about-page only
  }
}
```

**Rollup 自动提取 Lit 运行时**为共享 chunk（因为所有页面都用 lit）。

**每页 HTML** 注入该页的 entry + preloads（共享 chunk 通过 modulepreload 预加载）。

---

## Work Objectives

### Core Objective
改造 virtual entry 系统，使每个页面只下载自己需要的组件代码，共享 Lit 运行时通过 code splitting 自动提取。

### Concrete Deliverables
- `src/virtual/client-entry.ts` - 新增 `generateSharedEntry()` 和 `generatePageEntry(page)` 函数
- `src/plugin/index.ts` - 注册 `virtual:lit-ssg-shared` 和 `virtual:lit-ssg-page/{name}` 虚拟模块
- `src/assets/manifest.ts` - `resolveAssetsFromManifest` 接受 `pageKey` 参数，查找对应页面的 manifest entry
- `src/runner/build.ts` - 多 input 构建，route → manifest key 映射
- 测试通过

### Definition of Done
- [ ] `pnpm -F playground build` 成功执行
- [ ] 生成的每个 HTML 文件只注入本页面的 entry script
- [ ] `dist/.vite/manifest.json` 包含每个页面独立的 `isEntry: true` 条目
- [ ] `dist/assets/` 中 lit 运行时被提取为共享 chunk（不在每个页面 entry 中重复）
- [ ] 现有测试全部通过

### Must Have
- 向后兼容：base URL 逻辑不变（绝对/相对路径）
- 共享 Lit chunk 通过 `<link rel="modulepreload">` 预加载
- index 页面（route = `/`）的 entry key 正确映射

### Must NOT Have
- 不要修改 SSR server build 逻辑（server 端不涉及 code split）
- 不要改变 HTML 模板结构（`render-page.ts` 注入方式不大改）
- 不要引入新的运行时依赖
- 不要做 CSS 重复注入问题（Shadow DOM CSS 与 adoptedStyleSheets 双重注入），那是另一个独立问题

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (vitest)
- **Automated tests**: Tests-after（先实现，再验证/修改测试）
- **Framework**: vitest

### QA Policy
每个 task 包含 agent-executed QA scenarios。

---

## Execution Strategy

### Sequential Execution (tasks depend on each other)

```
Task 1: 改造 virtual/client-entry.ts
  ↓
Task 2: 改造 plugin/index.ts（注册新 virtual IDs）
  ↓
Task 3: 改造 assets/manifest.ts（per-page 查找）
  ↓
Task 4: 改造 runner/build.ts（multi-input + route→key 映射）
  ↓
Task 5: 验证构建 + 修复测试
```

---

## TODOs

- [ ] 1. 改造 `virtual/client-entry.ts` - 拆分为 shared + per-page entry 生成函数

  **What to do**:
  - 删除 `generateClientEntry(pages)` 函数（或重命名为废弃）
  - 新增 `generateSharedEntry(): string` - 只包含 hydrate support import：
    ```ts
    import '@lit-labs/ssr-client/lit-element-hydrate-support.js'
    ```
  - 新增 `generatePageEntry(page: PageEntry): string` - 只导入单个页面：
    ```ts
    import '@lit-labs/ssr-client/lit-element-hydrate-support.js'
    import '/src/pages/about.ts'
    ```
    注意：每个 page entry 也需要 import hydrate support，因为它必须在组件注册前执行；Rollup 会自动 deduplicate 共享模块为 chunk。

  **Must NOT do**:
  - 不要引入新的类型或运行时依赖
  - 不要在这个 task 里改 plugin/index.ts

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential - Task 1
  - **Blocks**: Task 2
  - **Blocked By**: None

  **References**:
  - `src/virtual/client-entry.ts` - 当前实现，全部替换
  - `src/scanner/pages.ts:PageEntry` - 类型定义（importPath, route 字段）

  **Acceptance Criteria**:
  - [ ] `generateSharedEntry()` 导出，返回仅含 hydrate support 的 string
  - [ ] `generatePageEntry(page)` 导出，返回 hydrate support + 单页面 import 的 string
  - [ ] TypeScript 无报错

  **QA Scenarios**:
  ```
  Scenario: generateSharedEntry 输出正确
    Tool: Bash (bun/node REPL or vitest unit test)
    Steps:
      1. Import generateSharedEntry from client-entry.ts
      2. Call generateSharedEntry()
      3. Assert result contains "@lit-labs/ssr-client/lit-element-hydrate-support.js"
      4. Assert result does NOT contain any page import
    Expected Result: 只有 hydrate support import
    Evidence: .sisyphus/evidence/task-1-shared-entry.txt

  Scenario: generatePageEntry 输出正确
    Tool: Bash
    Steps:
      1. Import generatePageEntry
      2. Call with { importPath: '/src/pages/about.ts', route: '/about' }
      3. Assert result contains hydrate support import
      4. Assert result contains "import '/src/pages/about.ts'"
    Expected Result: 两行 import，仅包含该页面
    Evidence: .sisyphus/evidence/task-1-page-entry.txt
  ```

  **Commit**: YES (group with Task 2)
  - Message: `feat(virtual): split client entry into shared + per-page generators`

---

- [ ] 2. 改造 `plugin/index.ts` - 注册 per-page virtual IDs

  **What to do**:
  - 新增常量：
    ```ts
    const VIRTUAL_SHARED_ID = 'virtual:lit-ssg-shared'
    const RESOLVED_VIRTUAL_SHARED_ID = '\0' + VIRTUAL_SHARED_ID
    const VIRTUAL_PAGE_PREFIX = 'virtual:lit-ssg-page/'
    const RESOLVED_VIRTUAL_PAGE_PREFIX = '\0' + VIRTUAL_PAGE_PREFIX
    ```
  - 保留原有 `VIRTUAL_CLIENT_ID` 仅用于向后兼容（如果需要）或直接移除
  - 在 `resolveId(id)` 中：
    - `id === VIRTUAL_SHARED_ID` → return `RESOLVED_VIRTUAL_SHARED_ID`
    - `id.startsWith(VIRTUAL_PAGE_PREFIX)` → return `RESOLVED_VIRTUAL_PAGE_PREFIX + id.slice(VIRTUAL_PAGE_PREFIX.length)`
  - 在 `load(id)` 中：
    - `id === RESOLVED_VIRTUAL_SHARED_ID` → return `generateSharedEntry()`
    - `id.startsWith(RESOLVED_VIRTUAL_PAGE_PREFIX)` → 从 id 提取 pageName，查找 `state.pages` 中匹配的 page，return `generatePageEntry(page)`

  **Page name 提取逻辑**:
  - `virtual:lit-ssg-page/about` → pageName = `about`
  - `src/pages/about.ts` → `fileNameToRoute('about.ts')` → `/about`（通过 route 匹配）
  - 也可以直接用 importPath 末尾的文件名匹配

  **Must NOT do**:
  - 不要删除 VIRTUAL_SERVER_ID 相关逻辑（服务端 build 不变）
  - 不要在这个 task 里改 build.ts

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential - Task 2
  - **Blocks**: Task 4
  - **Blocked By**: Task 1

  **References**:
  - `src/plugin/index.ts` - 全文，重点看 resolveId/load hooks
  - `src/virtual/client-entry.ts` - Task 1 完成后的新 API
  - `src/scanner/pages.ts:PageEntry` - importPath 字段格式（`/src/pages/about.ts`）

  **Acceptance Criteria**:
  - [ ] 请求 `virtual:lit-ssg-shared` 返回 shared entry 内容
  - [ ] 请求 `virtual:lit-ssg-page/about` 返回 about.ts 的 page entry
  - [ ] 请求 `virtual:lit-ssg-page/index` 返回 index.ts 的 page entry
  - [ ] 请求未知 page 时抛出明确错误信息
  - [ ] TypeScript 无报错

  **QA Scenarios**:
  ```
  Scenario: Plugin resolves virtual:lit-ssg-page/about correctly
    Tool: Bash (vitest unit test or vite dev preview)
    Steps:
      1. 构造 pages 数组含 about.ts
      2. 调用 plugin.load('\0virtual:lit-ssg-page/about')
      3. Assert 返回内容含 about.ts import
    Expected Result: 正确的 page entry 内容
    Evidence: .sisyphus/evidence/task-2-resolve-page.txt
  ```

  **Commit**: YES (group with Task 1)
  - Message: `feat(plugin): register per-page virtual module IDs`

---

- [ ] 3. 改造 `assets/manifest.ts` - per-page entry 查找

  **What to do**:
  - 修改 `resolveAssetsFromManifest` 签名：
    ```ts
    export function resolveAssetsFromManifest(
      manifest: ViteManifest,
      base: string,
      routeDepth: number,
      pageEntryKey: string,  // 新增：如 'virtual:lit-ssg-page/about'
    ): AssetLinks
    ```
  - 内部改为直接查找 `manifest[pageEntryKey]` 而不是 `filter(isEntry)` 找第一个
  - 删除 `entryItems.length > 1` 的 warn（现在有多个 entry 是正常的）
  - 如果 `manifest[pageEntryKey]` 不存在，抛出明确错误
  - `collectCss` 和 `collectModulePreloads` 逻辑不变

  **manifest key 格式说明**（CRITICAL - 需要精确处理）:
  - 当前 manifest 验证：key = `virtual:lit-ssg-client`（virtual module ID），name = `_virtual_lit-ssg-client`
  - Vite 的 manifest key 是：Rollup input 对象中的 **key name**（不是 value/src），如 `{ 'lit-ssg-page-about': 'virtual:lit-ssg-page/about' }` → manifest key = `lit-ssg-page-about`
  - 但当前用的是字符串 input（`input: VIRTUAL_CLIENT_ID`），key = virtual ID 本身
  - **推荐方案**：用对象形式 input，key 用 `lit-ssg-page-about` 格式（安全、无特殊字符）；manifest 中查找时用该 key
  - Task 4 实现时先 `console.log(JSON.stringify(manifest, null, 2))` 验证实际 key 格式，再硬化逻辑

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential - Task 3
  - **Blocks**: Task 4
  - **Blocked By**: Task 2 (需要确认 virtual ID 格式)

  **References**:
  - `src/assets/manifest.ts` - 全文替换
  - `src/types.ts:ViteManifest` - manifest 数据结构
  - Vite 文档：manifest.json 中 entry 的 key 是 rollup input 的 key name（对象形式）

  **Acceptance Criteria**:
  - [ ] `resolveAssetsFromManifest(manifest, '/', 0, 'lit-ssg-page-about')` 返回 about 页面的 js/css/modulepreloads
  - [ ] 找不到 key 时抛出明确错误（含 key 名）
  - [ ] 多 entry manifest 不再 warn
  - [ ] 现有 manifest.ts 的单元测试更新通过

  **QA Scenarios**:
  ```
  Scenario: 正确查找 per-page entry
    Tool: Bash (vitest unit test)
    Steps:
      1. 构造含 lit-ssg-page-about 的 mock manifest
      2. 调用 resolveAssetsFromManifest(manifest, '/', 0, 'lit-ssg-page-about')
      3. Assert js 字段等于 about 的文件路径
    Expected Result: 返回正确的 AssetLinks
    Evidence: .sisyphus/evidence/task-3-manifest-lookup.txt

  Scenario: key 不存在时报错
    Tool: Bash
    Steps:
      1. 传入不存在的 pageEntryKey
      2. Assert 抛出包含 key 名的 Error
    Expected Result: 明确的错误信息
    Evidence: .sisyphus/evidence/task-3-missing-key-error.txt
  ```

  **Commit**: YES
  - Message: `feat(assets): resolve assets per-page entry key from manifest`

---

- [ ] 4. 改造 `runner/build.ts` - multi-input + route→entry 映射

  **What to do**:
  - 构建 per-page input 对象：
    ```ts
    const pageInputs: Record<string, string> = {}
    for (const page of pages) {
      const pageName = pageToEntryName(page)  // e.g. 'lit-ssg-page-about'
      pageInputs[pageName] = `virtual:lit-ssg-page/${pageNameFromRoute(page)}`
    }
    ```
  - client build 的 rollupOptions.input 改为：
    ```ts
    input: {
      'lit-ssg-shared': VIRTUAL_SHARED_ID,
      ...pageInputs,
    }
    ```
  - 构建 route → entry key 映射：
    ```ts
    const routeToEntryKey = new Map<string, string>()
    for (const page of pages) {
      routeToEntryKey.set(page.route, pageToEntryName(page))
    }
    ```
  - 渲染循环中查找对应 key：
    ```ts
    const pageKey = routeToEntryKey.get(route)!
    const assets = resolveAssetsFromManifest(manifest, base, depth, pageKey)
    ```
  - 工具函数 `pageToEntryName(page: PageEntry): string`：
    - 取文件名（不含扩展名）：`index.ts` → `index`, `about.ts` → `about`
    - 返回 `lit-ssg-page-${name}`
  - 删除旧的 `VIRTUAL_CLIENT_ID` 引用

  **Must NOT do**:
  - 不要改变 server build 的 input（仍然是 `VIRTUAL_SERVER_ID`）
  - 不要改变 `renderPage` 调用签名

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential - Task 4
  - **Blocks**: Task 5
  - **Blocked By**: Task 3

  **References**:
  - `src/runner/build.ts` - 全文，重点 client build 的 rollupOptions.input 和渲染循环
  - `src/scanner/pages.ts:PageEntry` - filePath, importPath, route 字段
  - `src/assets/manifest.ts` - Task 3 完成后的新签名

  **Acceptance Criteria**:
  - [ ] client build input 是对象形式，含 `lit-ssg-shared` + 每页 `lit-ssg-page-{name}`
  - [ ] 渲染每个 route 时传入对应的 pageKey
  - [ ] TypeScript 无报错

  **QA Scenarios**:
  ```
  Scenario: 完整构建 playground 成功
    Tool: Bash
    Steps:
      1. cd packages/playground
      2. pnpm build
      3. Assert exit code 0
      4. Assert dist/.vite/manifest.json 含 lit-ssg-page-index 和 lit-ssg-page-about 的 isEntry: true 条目
      5. cat dist/index.html - Assert script src 含 lit-ssg-page-index 对应的文件
      6. cat dist/about/index.html - Assert script src 含 lit-ssg-page-about 对应的文件
      7. Assert 两个 HTML 文件的 script src 不同
    Expected Result: 每个页面注入不同的 entry script
    Evidence: .sisyphus/evidence/task-4-build-output.txt

  Scenario: about 页面不含 home-page 代码
    Tool: Bash
    Steps:
      1. 找到 dist/assets/ 中 lit-ssg-page-about*.js
      2. Assert 该文件不包含字符串 "home-page" 或 "HomePage"
      3. Assert dist/assets/ 中 lit-ssg-page-index*.js 不包含 "about-page"
    Expected Result: 页面 bundle 只含自己的组件
    Evidence: .sisyphus/evidence/task-4-no-cross-contamination.txt
  ```

  **Commit**: YES
  - Message: `feat(runner): use per-page rollup inputs and map routes to entry keys`

---

- [ ] 5. 更新/修复测试

  **What to do**:
  - 运行 `pnpm -F vite-plugin-lit-ssg test`，查看失败的测试
  - 主要需要更新的测试：
    - `manifest.ts` 相关测试：更新 `resolveAssetsFromManifest` 调用，加入 `pageEntryKey` 参数
    - `client-entry.ts` 相关测试：如有，更新为新的 `generateSharedEntry` / `generatePageEntry` API
  - 如果测试文件缺少对新功能的覆盖，补充 happy path 测试

  **Must NOT do**:
  - 不要删除现有测试，只更新签名和 mock 数据
  - 不要引入新的测试依赖

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential - Task 5
  - **Blocks**: None
  - **Blocked By**: Task 4

  **References**:
  - `packages/vite-plugin-lit-ssg/tests/` - 查找所有测试文件
  - 所有被修改的源文件

  **Acceptance Criteria**:
  - [ ] `pnpm -F vite-plugin-lit-ssg test` 全部通过（0 failures）
  - [ ] `pnpm -F playground build` 成功完成

  **QA Scenarios**:
  ```
  Scenario: 所有测试通过
    Tool: Bash
    Steps:
      1. pnpm -F vite-plugin-lit-ssg test
      2. Assert exit code 0
      3. Assert output 显示 "X passed, 0 failed"
    Expected Result: 测试全绿
    Evidence: .sisyphus/evidence/task-5-test-results.txt

  Scenario: playground 构建验证
    Tool: Bash
    Steps:
      1. pnpm -F playground build
      2. Assert exit code 0
      3. cat dist/.vite/manifest.json | grep isEntry - 应有 2+ 条目
      4. diff <(grep 'script' dist/index.html) <(grep 'script' dist/about/index.html) - 应不同
    Expected Result: 构建成功，两页脚本不同
    Evidence: .sisyphus/evidence/task-5-final-build.txt
  ```

  **Commit**: YES
  - Message: `test: update tests for per-page code splitting API changes`

---

## Final Verification Wave

- [ ] F1. **验证构建产物**: `pnpm -F playground build` 成功 + manifest 有多个 entry + 每个 HTML 只有本页 script
- [ ] F2. **测试通过**: `pnpm -F vite-plugin-lit-ssg test` 全部通过


- [ ] F1. **验证构建产物**: `pnpm -F playground build` 成功 + manifest 有多个 entry + 每个 HTML 只有本页 script
- [ ] F2. **测试通过**: `pnpm -F vite-plugin-lit-ssg test` 全部通过
