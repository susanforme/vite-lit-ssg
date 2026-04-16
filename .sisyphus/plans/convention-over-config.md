# Convention Over Configuration Refactoring

## TL;DR

> **Quick Summary**: 对 vite-plugin-lit-ssg 进行"约定优于配置"重构，删除 `routes`、`entryServer`、`entryClient`、`outDir` 四个手动配置项，改为基于 `src/pages` 目录约定自动生成路由，引入 `defineLitRoute()` API 让每个页面文件自声明元数据。
>
> **Deliverables**:
> - 新的 `defineLitRoute()` 工厂函数（运行时 API）
> - 插件虚拟模块系统（`virtual:lit-ssg-client` + `virtual:lit-ssg-server`）
> - 基于 `src/pages` 的文件路由扫描器
> - manifest 查找策略重构（扫描 isEntry，不依赖入口路径）
> - playground 完全重构（删除 entry-server.ts、entry-client.ts）
> - 全套测试更新
> - README 更新
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: T1(Spike) → T2(types+defineLitRoute) → T3(scanner)+T4(virtual modules) → T5(manifest)+T6(build runner) → T7(plugin hooks) → T8(CLI) → T9(tests) → T10(playground) → F1-F4

---

## Context

### Original Request
用户要求按"约定优于配置"原则简化重构：
- 路由基于目录约定自动生成（参考 Next.js 文件路由）
- 废弃 `routes`, `entryClient`, `entryServer`, `outDir` 配置项
- 页面元数据改为每个路由文件导出（类似 TanStack Router）

### Interview Summary

**Key Discussions**:
- **页面模板格式**: `defineLitRoute({ component: LitElement class, title, meta, ... })` — 类与元数据分离定义，传入 class 引用
- **标签名推导**: 自动从 `@customElement` 装饰器获取标签名，用 `customElements.getName(component)` 在 SSR 环境中读取
- **单页失败行为**: 终止整个构建并报错
- **空 pages 目录**: 抛出错误并终止
- **文件名路由映射**: 保持原样，不做大小写转换（`About.ts` → `/About`）
- **defineLitRoute 导入**: 从 `vite-plugin-lit-ssg` 主包导入

**Research Findings**:
- 现有 `resolveAssetsFromManifest()` 依赖 `entryClient` 路径作为 manifest key → 改为扫描 `isEntry: true` 的项（更健壮）
- 现有插件只有 `config()` hook → 需新增 `resolveId()`, `load()`, `configResolved()`, `buildStart()` hooks
- `customElements.getName()` 在 Lit SSR Node.js 环境中的可用性需要 Task 1 验证
- CLI 当前从插件 WeakMap 读取 `outDir` → 改为从 Vite resolved config `build.outDir` 读取

### Metis Review
**Identified Gaps** (addressed):
- 虚拟模块 manifest key 格式不确定 → Task 1 Spike 先验证，manifest 改用 isEntry 扫描策略（方案B）
- `customElements.getName()` 在 SSR 中可用性 → Task 1 Spike 一并验证
- CLI outDir 迁移需要 fallback → Task 8 分步实现
- 页面扫描时序（configResolved vs buildStart）→ 在 `buildStart` hook 中执行扫描（异步友好）

---

## Work Objectives

### Core Objective
重构插件使其遵循约定优于配置原则：零强制配置项，通过 `src/pages` 目录约定自动完成路由发现、客户端/服务端入口生成和元数据收集。

### Concrete Deliverables
- `src/define-route.ts` — `defineLitRoute()` 工厂函数和 `LitRoute` 类型
- `src/scanner/pages.ts` — 页面文件扫描器
- `src/virtual/client-entry.ts` — 虚拟客户端模块代码生成
- `src/virtual/server-entry.ts` — 虚拟服务端模块代码生成
- `src/plugin/index.ts` — 新增虚拟模块 hooks，删除旧配置项验证
- `src/assets/manifest.ts` — 不再依赖 entryClient key，改为 isEntry 扫描
- `src/runner/build.ts` — 使用虚拟入口路径，从 resolvedConfig 读取 outDir
- `src/cli.ts` — 从 Vite config `build.outDir` 读取
- `src/types.ts` — 更新类型，删除旧选项字段
- `src/index.ts` — 导出 `defineLitRoute`
- `packages/playground/` — 完全重构
- `tests/` — 全套更新
- `README.md` — 文档更新

### Definition of Done
- [ ] `vite-lit-ssg build` 在无 `entryServer/entryClient/routes/outDir` 配置的 playground 上构建成功
- [ ] `dist/index.html` 和 `dist/about/index.html` 正确生成，含 Lit SSR 标记
- [ ] 页面元数据（title/meta）来自各页面文件的 `defineLitRoute` 导出
- [ ] 所有单元测试通过
- [ ] 所有集成测试通过

### Must Have
- `defineLitRoute({ component: LitElement class, title?, meta?, ... })` API
- 自动扫描 `src/pages/*.ts` 生成路由
- 虚拟模块 `virtual:lit-ssg-client` 和 `virtual:lit-ssg-server`
- manifest 资产注入不依赖 entryClient 路径
- CLI 从 `build.outDir` 读取输出目录
- 页面为空时报错，单页失败时终止构建

### Must NOT Have (Guardrails)
- 不支持动态路由（`[slug].ts` 参数化路由）
- 不支持 dev server HMR 自动重载（只在构建时有效）
- 不支持嵌套布局（`layout.ts` 约定）
- 不递归扫描子目录（只扫描 `src/pages/*.ts` 单层）
- 不在 manifest key 格式确认前编写依赖虚拟模块 manifest key 的代码
- 不同时修改 `plugin/index.ts` 和 `assets/manifest.ts`（分 Task 修改）
- 不修改 `normalize-page.ts` 的现有分支
- 不在新集成测试建立前删除旧集成测试
- 不在 `normalize-page.ts` 中添加 AI 风格的过度防御代码

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: YES (vitest)
- **Automated tests**: Tests-after（先实现，再补测试；集成测试先并存后替换）
- **Framework**: vitest

### QA Policy
每个任务必须包含 agent 可执行的 QA 场景。
- **CLI/Build**: Bash (shell commands)
- **API/Module**: Bash (bun/node eval)
- **File generation**: Bash (ls + cat + grep)

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (立即开始 - 独立基础工作):
├── Task 1: Spike — 验证 customElements.getName() 和 manifest isEntry 策略 [deep]
├── Task 2: 新建 defineLitRoute() 类型和工厂函数 [quick]
└── Task 3: 新建页面扫描器 pages.ts [quick]

Wave 2 (Wave 1 完成后 - 核心新机制，依赖 T1 spike 结论):
├── Task 4: 虚拟模块代码生成 (client + server entry) [deep]
└── Task 5: manifest.ts 重构 — 改用 isEntry 扫描策略 [quick]

Wave 3 (Wave 2 完成后 - 系统集成):
├── Task 6: 重构 runner/build.ts — 使用虚拟入口和新 manifest API [unspecified-high]
├── Task 7: 重构 plugin/index.ts — 新增虚拟模块 hooks，更新选项类型 [deep]
└── Task 8: 重构 CLI — 从 build.outDir 读取输出目录 [quick]

Wave 4 (Wave 3 完成后 - 验证层):
├── Task 9: 更新所有测试（单元 + 集成） [unspecified-high]
├── Task 10: 重构 playground [quick]
└── Task 11: 更新 README [writing]

Wave FINAL (全部完成后 - 并行 review):
├── F1: Plan Compliance Audit (oracle)
├── F2: Code Quality Review (unspecified-high)
├── F3: Real Manual QA (unspecified-high)
└── F4: Scope Fidelity Check (deep)
```

### Dependency Matrix

- **T1**: 无依赖 - 阻塞: T4, T5
- **T2**: 无依赖 - 阻塞: T4, T7
- **T3**: 无依赖 - 阻塞: T4, T7
- **T4**: T1, T2, T3 - 阻塞: T6, T7
- **T5**: T1 - 阻塞: T6
- **T6**: T4, T5 - 阻塞: T9
- **T7**: T2, T3, T4 - 阻塞: T9, T10
- **T8**: T6 - 阻塞: T9
- **T9**: T6, T7, T8 - 阻塞: F1-F4
- **T10**: T7 - 阻塞: F1-F4
- **T11**: T7 - 阻塞: F4

### Agent Dispatch Summary

- Wave 1: T1 → `deep`, T2 → `quick`, T3 → `quick`
- Wave 2: T4 → `deep`, T5 → `quick`
- Wave 3: T6 → `unspecified-high`, T7 → `deep`, T8 → `quick`
- Wave 4: T9 → `unspecified-high`, T10 → `quick`, T11 → `writing`
- FINAL: F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

---

- [x] 1. Spike — 验证 SSR 环境和 manifest 策略

  **What to do**:
  1. 在 `packages/vite-plugin-lit-ssg` 中编写一个最小测试脚本，验证 `customElements.getName()` 在 `@lit-labs/ssr` 的 Node.js 运行环境中是否可用（`@lit-labs/ssr` 使用 `@lit-labs/ssr/lib/dom-shim.js` 提供 DOM polyfill）
  2. 在 playground 中构建一次，检查 `.vite/manifest.json` 中的 `isEntry: true` 项格式，确认扫描策略可行
  3. 将发现记录为测试 fixture 文件 `tests/fixtures/spike-results.md`，包含：
     - `customElements.getName()` 是否可用（YES/NO）
     - `manifest.json` 中 `isEntry: true` 的项的格式示例
     - 若 `customElements.getName()` 不可用，提出备选方案（如从 `@customElement` 装饰器的静态属性 `component.tagName` 读取）
  4. **如果 `customElements.getName()` 不可用**，改用 `component.tagName` 或 `(component as any).__litTagName` 等 Lit 内部属性（记录在 fixture 中）

  **Must NOT do**:
  - 不修改任何生产代码
  - 不编写超过验证目的的代码

  **Recommended Agent Profile**:
  > 技术验证型任务，需要理解 Lit SSR Node.js 运行时和 Vite manifest 结构
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 1, 与 T2/T3 并行)
  - **Parallel Group**: Wave 1
  - **Blocks**: T4 (虚拟模块代码生成), T5 (manifest 重构)
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `packages/vite-plugin-lit-ssg/src/runner/load-server-entry.ts` — 了解当前 SSR 模块加载方式
  - `packages/playground/src/pages/home-page.ts` — 当前 LitElement + @customElement 使用方式

  **External References**:
  - `@lit-labs/ssr/lib/dom-shim.js` — 检查是否注册了 customElements polyfill
  - Lit 源码中 `@customElement` 装饰器实现，查找 `tagName` 静态属性

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: customElements.getName() 可用性验证
    Tool: Bash
    Preconditions: Node.js 环境，已安装 @lit-labs/ssr
    Steps:
      1. 创建脚本 spike-test.mjs，内容：
         import '@lit-labs/ssr/lib/dom-shim.js'
         import { LitElement } from 'lit'
         import { customElement } from 'lit/decorators.js'
         @customElement('test-el') class TestEl extends LitElement {}
         console.log(customElements.getName(TestEl))
      2. 运行: node spike-test.mjs
      3. 检查输出是否为 'test-el' 字符串
    Expected Result: 输出 "test-el" 或 报错信息（任一结果都是有效 spike 输出，记录即可）
    Failure Indicators: 脚本崩溃但无有用信息
    Evidence: .sisyphus/evidence/task-1-spike-customelements.txt

  Scenario: manifest isEntry 策略验证
    Tool: Bash
    Preconditions: playground 已构建（或重新构建）
    Steps:
      1. cd packages/playground && pnpm build（使用现有配置）
      2. cat dist/.vite/manifest.json | node -e "const m=require('fs').readFileSync('/dev/stdin','utf8'); const j=JSON.parse(m); const entries=Object.entries(j).filter(([k,v])=>v.isEntry); console.log(JSON.stringify(entries, null, 2))"
    Expected Result: 至少有一个 isEntry:true 的项，包含 file 字段
    Failure Indicators: 没有 isEntry:true 的项，或 manifest 格式不符合预期
    Evidence: .sisyphus/evidence/task-1-spike-manifest.json
  ```

  **Commit**: YES (单独 spike commit)
  - Message: `chore: add spike results for customElements.getName and manifest isEntry`
  - Files: `tests/fixtures/spike-results.md`, `.sisyphus/evidence/task-1-*`

---

- [x] 2. 新建 defineLitRoute() 类型和工厂函数

  **What to do**:
  1. 在 `src/define-route.ts` 中新建 `LitRoute` 类型接口：
     ```ts
     export interface LitRoute {
       component: typeof LitElement
       title?: string
       lang?: string
       meta?: Array<Record<string, string>>
       head?: string[]
       htmlAttrs?: Record<string, string>
       bodyAttrs?: Record<string, string>
     }
     ```
  2. 新建 `defineLitRoute(route: LitRoute): LitRoute` 工厂函数（identity function，仅用于类型推断）
  3. 在 `src/types.ts` 中新增 `LitSSGOptions` 的新版本：
     ```ts
     export interface LitSSGOptions {
       pagesDir?: string // 默认: 'src/pages'
     }
     ```
     保留旧的 `ResolvedLitSSGOptions`（暂时不删，后续 T7 再删）
  4. 在 `src/index.ts` 中新增 `defineLitRoute` 和 `LitRoute` 的导出

  **Must NOT do**:
  - 不删除 `types.ts` 中的旧类型字段（这个阶段只新增）
  - 不修改任何现有文件，只创建新文件并在 `index.ts` 新增导出
  - 不为 `defineLitRoute` 添加运行时逻辑（保持 identity function）

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 1, 与 T1/T3 并行)
  - **Parallel Group**: Wave 1
  - **Blocks**: T4, T7
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/types.ts` — 现有类型定义风格
  - `src/index.ts` — 现有导出方式
  - `src/runtime/normalize-page.ts` — `PageDescriptor` 字段（新 `LitRoute` 应覆盖相同的元数据字段）

  **Acceptance Criteria**:
  - [ ] `src/define-route.ts` 文件创建，包含 `LitRoute` 接口和 `defineLitRoute()` 函数
  - [ ] `src/index.ts` 导出 `defineLitRoute` 和 `LitRoute`
  - [ ] TypeScript 编译无错误：`tsc --noEmit`

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: TypeScript 类型检查通过
    Tool: Bash
    Preconditions: 在 packages/vite-plugin-lit-ssg 目录下
    Steps:
      1. 运行: pnpm typecheck（即 tsc --noEmit）
      2. 检查退出码为 0
    Expected Result: 无 TypeScript 错误
    Failure Indicators: 任何 TS 错误输出
    Evidence: .sisyphus/evidence/task-2-typecheck.txt

  Scenario: defineLitRoute 作为 identity function 工作
    Tool: Bash
    Preconditions: 安装依赖，能运行 node
    Steps:
      1. 创建临时测试：node -e "import('/path/to/define-route.js').then(m => { const r = m.defineLitRoute({component: class {}, title: 'Test'}); console.log(r.title === 'Test' ? 'OK' : 'FAIL') })"
    Expected Result: 输出 "OK"
    Failure Indicators: 输出 "FAIL" 或抛出错误
    Evidence: .sisyphus/evidence/task-2-identity.txt
  ```

  **Commit**: YES
  - Message: `feat(define-route): add defineLitRoute factory function and LitRoute type`
  - Files: `src/define-route.ts`, `src/index.ts`, `src/types.ts`

---

- [x] 3. 新建页面文件扫描器

  **What to do**:
  1. 在 `src/scanner/pages.ts` 中新建页面扫描函数：
     ```ts
     export interface PageEntry {
       /** 绝对路径到页面文件 */
       filePath: string
       /** 相对于项目根的路径，用于 import（如 '/src/pages/about.ts'）*/
       importPath: string
       /** 路由路径（如 '/about'）*/
       route: string
     }
     
     export async function scanPages(
       projectRoot: string,
       pagesDir: string = 'src/pages'
     ): Promise<PageEntry[]>
     ```
  2. 扫描规则（**单层，不递归**）：
     - 只扫描 `<projectRoot>/<pagesDir>/*.ts` 文件（单层，不含子目录）
     - `index.ts` → route `/`
     - `about.ts` → route `/about`（文件名去掉 `.ts` 扩展名，加前导 `/`）
     - 其他文件名保持原样（不做大小写转换）
  3. 错误处理：
     - `pagesDir` 不存在 → 抛出 `Error: [vite-plugin-lit-ssg] Pages directory not found: <path>. Create src/pages/ and add at least one page file.`
     - 扫描结果为空 → 抛出 `Error: [vite-plugin-lit-ssg] No page files found in <path>. Add at least one .ts file to generate routes.`
  4. 使用 Node.js 原生 `fs.readdir` 实现（不添加 `fast-glob` 依赖）

  **Must NOT do**:
  - 不递归扫描子目录
  - 不支持 `.js`, `.tsx`, `.jsx` 等其他扩展名（只处理 `.ts`）
  - 不添加 `fast-glob` 或其他 glob 库依赖
  - 不处理以 `_` 开头的文件（保持简单，不加特殊规则）

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 1, 与 T1/T2 并行)
  - **Parallel Group**: Wave 1
  - **Blocks**: T4, T7
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/runner/routes.ts` — 现有路由标准化逻辑（`normalizeRoute`），新扫描器中复用相同的标准化逻辑

  **Acceptance Criteria**:
  - [ ] `src/scanner/pages.ts` 文件创建
  - [ ] `scanPages('<root>', 'src/pages')` 返回正确的 `PageEntry[]`
  - [ ] 空目录时抛出正确错误信息
  - [ ] 不存在目录时抛出正确错误信息
  - [ ] 新建单元测试 `tests/unit/scanner.test.ts` 全部通过

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: 正常扫描两个页面文件
    Tool: Bash
    Preconditions: 存在 src/pages/index.ts 和 src/pages/about.ts
    Steps:
      1. 运行测试: pnpm test tests/unit/scanner.test.ts
      2. 验证测试包含对 route '/' 和 '/about' 的断言
    Expected Result: 测试通过，退出码 0
    Failure Indicators: 任何测试失败
    Evidence: .sisyphus/evidence/task-3-scanner-unit.txt

  Scenario: 空目录抛出错误
    Tool: Bash
    Preconditions: 创建临时空目录
    Steps:
      1. 在单元测试中：创建临时空目录，调用 scanPages，期望抛出包含 "No page files found" 的错误
    Expected Result: 测试通过
    Evidence: .sisyphus/evidence/task-3-scanner-empty.txt
  ```

  **Commit**: YES
  - Message: `feat(scanner): add pages directory scanner with route mapping`
  - Files: `src/scanner/pages.ts`, `tests/unit/scanner.test.ts`

---

- [x] 4. 虚拟模块代码生成（client + server entry）

  **What to do**:

  > **前提**: 必须先完成 Task 1 Spike，确认 `customElements.getName()` 在 SSR 环境中的可用性，再据此选择标签名推导方式。

  1. 新建 `src/virtual/client-entry.ts` — 生成客户端入口模块代码：
     ```ts
     export function generateClientEntry(pages: PageEntry[]): string {
       // 生成: import '/src/pages/index.ts'\nimport '/src/pages/about.ts'\n...
       return pages.map(p => `import '${p.importPath}'`).join('\n') + '\n'
     }
     ```

  2. 新建 `src/virtual/server-entry.ts` — 生成服务端入口模块代码：
     ```ts
     export function generateServerEntry(pages: PageEntry[]): string {
       // 生成虚拟 server entry，每个页面：
       // 1. import 页面的 default export (LitRoute)
       // 2. 在 render() switch 中：
       //    - 用 customElements.getName(route.component) 获取标签名
       //    - 用 unsafeStatic(tag) 生成 TemplateResult
       //    - 返回 { template, title, meta, ... }
     }
     ```
     
     生成的虚拟 server entry 代码示例：
     ```ts
     import { html } from 'lit'
     import { unsafeStatic } from 'lit/static-html.js'
     import indexRoute from '/src/pages/index.ts'
     import aboutRoute from '/src/pages/about.ts'
     
     export async function render(url, ctx) {
       switch (url) {
         case '/': {
           const tag = customElements.getName(indexRoute.component)
           if (!tag) throw new Error('[vite-plugin-lit-ssg] Component for route "/" is not registered. Make sure to use @customElement decorator.')
           return { template: html`<${unsafeStatic(tag)}></${unsafeStatic(tag)}>`, title: indexRoute.title, lang: indexRoute.lang, meta: indexRoute.meta, head: indexRoute.head, htmlAttrs: indexRoute.htmlAttrs, bodyAttrs: indexRoute.bodyAttrs }
         }
         case '/about': {
           // ...同上
         }
         default:
           return null
       }
     }
     ```

  3. **标签名推导 fallback**（基于 Task 1 Spike 结论）：
     - 如果 `customElements.getName()` 可用（Lit SSR 注册了 polyfill）：直接使用
     - 如果不可用：在生成的代码中改用 `(route.component as any).__litTagName` 或其他 Lit 内部属性（Task 1 Spike 已确认备选方案）

  **Must NOT do**:
  - 不在 Task 1 Spike 结论出来前编写此代码
  - 不使用字符串 import 以外的动态机制
  - 不为虚拟模块添加 HMR 支持

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 需要理解 Vite 虚拟模块机制、Lit SSR 环境、`unsafeStatic` API
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 2, 与 T5 并行)
  - **Parallel Group**: Wave 2
  - **Blocks**: T6, T7
  - **Blocked By**: T1 (spike 结论), T2 (LitRoute 类型), T3 (PageEntry 类型)

  **References**:

  **Pattern References**:
  - `src/runtime/render-page.ts` — 了解 `PageDescriptor` 结构，生成的 server entry 需要返回兼容格式
  - `src/runner/load-server-entry.ts` — 了解 server entry 期望的 `render()` 签名
  - `tests/fixtures/spike-results.md` — Task 1 spike 输出，标签名推导方案

  **External References**:
  - `lit/static-html.js` 中的 `unsafeStatic` API

  **Acceptance Criteria**:
  - [ ] `src/virtual/client-entry.ts` 生成正确的 import 语句
  - [ ] `src/virtual/server-entry.ts` 生成的 render() 函数结构正确
  - [ ] 新建单元测试 `tests/unit/virtual-entries.test.ts` 验证代码生成内容
  - [ ] TypeScript 编译无错误

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: client entry 生成正确 import 语句
    Tool: Bash
    Preconditions: 准备 PageEntry[] 测试数据
    Steps:
      1. 运行: pnpm test tests/unit/virtual-entries.test.ts
      2. 验证生成的字符串包含 "import '/src/pages/index.ts'" 等
    Expected Result: 测试通过
    Evidence: .sisyphus/evidence/task-4-virtual-unit.txt

  Scenario: server entry 生成包含正确的 switch case
    Tool: Bash
    Steps:
      1. 验证生成代码包含 "case '/'" 和 "case '/about'"
      2. 验证包含 customElements.getName 或备选标签推导方式
    Expected Result: 测试通过
    Evidence: .sisyphus/evidence/task-4-server-entry-content.txt
  ```

  **Commit**: YES
  - Message: `feat(virtual): add virtual client and server entry code generators`
  - Files: `src/virtual/client-entry.ts`, `src/virtual/server-entry.ts`, `tests/unit/virtual-entries.test.ts`

---

- [x] 5. 重构 manifest.ts — 改用 isEntry 扫描策略

  **What to do**:

  > **前提**: Task 1 Spike 需已确认 manifest 中 `isEntry: true` 项的格式。

  1. 修改 `resolveAssetsFromManifest()` 签名，**移除 `entryClient` 参数**：
     ```ts
     // 旧:
     export function resolveAssetsFromManifest(
       manifest: ViteManifest, entryClient: string, base: string, routeDepth: number
     ): AssetLinks
     
     // 新:
     export function resolveAssetsFromManifest(
       manifest: ViteManifest, base: string, routeDepth: number
     ): AssetLinks
     ```
  2. 新的入口 key 查找逻辑：扫描 manifest 找 `isEntry: true` 的项：
     ```ts
     const entries = Object.entries(manifest).filter(([, v]) => v.isEntry)
     if (entries.length === 0) throw new Error('...')
     // 使用 entries[0] 作为客户端入口
     // （只有一个 entry 时直接取；多个时取第一个并警告）
     const [entryKey, entry] = entries[0]!
     ```
  3. 更新 `readManifest()` 不需要改变（保持原样）
  4. 保留 `normalizeEntryKey()` 内部函数（虽然不再被 `resolveAssetsFromManifest` 使用，保留以防万一）

  **Must NOT do**:
  - 不同时修改 `plugin/index.ts`（分 Task 修改）
  - 不改变 `readManifest()` 的签名
  - 不删除 `normalizeEntryKey()` 函数（可能被测试引用）

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 2, 与 T4 并行)
  - **Parallel Group**: Wave 2
  - **Blocks**: T6
  - **Blocked By**: T1 (spike 结论)

  **References**:

  **Pattern References**:
  - `src/assets/manifest.ts:11-33` — 当前 `resolveAssetsFromManifest` 实现，修改入口 key 查找部分
  - `tests/unit/manifest.test.ts` — 现有 manifest 测试，需同步更新

  **Acceptance Criteria**:
  - [ ] `resolveAssetsFromManifest` 签名不再含 `entryClient` 参数
  - [ ] 单元测试 `tests/unit/manifest.test.ts` 更新并通过（移除 entryClient 参数）
  - [ ] 当 manifest 无 isEntry 项时抛出有意义的错误
  - [ ] TypeScript 编译无错误

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: isEntry 扫描策略正确找到入口
    Tool: Bash
    Steps:
      1. 运行: pnpm test tests/unit/manifest.test.ts
    Expected Result: 所有 manifest 单元测试通过
    Failure Indicators: 任何测试失败
    Evidence: .sisyphus/evidence/task-5-manifest-unit.txt

  Scenario: 无 isEntry 项时报错
    Tool: Bash
    Steps:
      1. 验证测试中有断言：当 manifest 中无 isEntry 项时，抛出包含 "isEntry" 的错误信息
    Expected Result: 测试通过
    Evidence: .sisyphus/evidence/task-5-manifest-no-entry.txt
  ```

  **Commit**: YES
  - Message: `refactor(manifest): resolve client entry via isEntry scan instead of path key`
  - Files: `src/assets/manifest.ts`, `tests/unit/manifest.test.ts`

---

- [x] 6. 重构 runner/build.ts — 使用虚拟入口和新 manifest API

  **What to do**:
  1. 修改 `runSSG()` 函数签名，**移除 `opts.entryServer`、`opts.entryClient`、`opts.outDir`**：
     ```ts
     export async function runSSG(
       pages: PageEntry[],          // 新增：扫描到的页面列表
       projectRoot: string,
       base: string,
       outDir: string,              // 现在由调用方传入（从 vite config 读取）
       pagesDir: string,            // 新增：用于生成 pagesDir 绝对路径
       ctx: BuildContext = { mode: 'production', configFile: undefined }
     ): Promise<void>
     ```
  2. 客户端构建：使用虚拟模块 ID `virtual:lit-ssg-client` 作为 rollupOptions.input
  3. 服务端构建：使用虚拟模块 ID `virtual:lit-ssg-server` 作为 `build.ssr`
  4. 调用 `resolveAssetsFromManifest(manifest, base, depth)`（去掉 entryClient 参数）
  5. 路由列表：从 `pages.map(p => p.route)` 生成

  **Must NOT do**:
  - 不修改 `manifest.ts`（已在 T5 完成）
  - 不修改 `plugin/index.ts`（在 T7 完成）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 3, 与 T7/T8 并行)
  - **Parallel Group**: Wave 3
  - **Blocks**: T9
  - **Blocked By**: T4 (虚拟模块生成器), T5 (manifest 新 API)

  **References**:

  **Pattern References**:
  - `src/runner/build.ts:1-106` — 当前完整实现，理解数据流
  - `src/scanner/pages.ts:PageEntry` — 新的输入类型（T3 创建）
  - `src/assets/manifest.ts` — T5 重构后的新 API 签名

  **Acceptance Criteria**:
  - [ ] `runSSG()` 不再接受 `entryServer`、`entryClient`、`outDir` 参数
  - [ ] 使用 `virtual:lit-ssg-client` 和 `virtual:lit-ssg-server` 作为入口
  - [ ] TypeScript 编译无错误

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: TypeScript 类型检查通过
    Tool: Bash
    Steps:
      1. 运行: pnpm typecheck
    Expected Result: 无 TS 错误
    Evidence: .sisyphus/evidence/task-6-typecheck.txt
  ```

  **Commit**: YES
  - Message: `refactor(build): use virtual entries and pages list in runSSG`
  - Files: `src/runner/build.ts`

---

- [x] 7. 重构 plugin/index.ts — 新增虚拟模块 hooks，更新选项类型

  **What to do**:
  1. 更新 `LitSSGOptions` 使用新类型（只保留 `pagesDir?: string`），删除 `entryServer`, `entryClient`, `routes`, `outDir` 字段
  2. 新增插件 hooks：
     - `configResolved(config)`: 存储 resolved config（包含 `build.outDir` 和 `root`）
     - `buildStart()`: 调用 `scanPages()` 扫描页面，结果存储在 WeakMap 中
     - `resolveId(id)`: 处理 `virtual:lit-ssg-client` 和 `virtual:lit-ssg-server`，返回 `\0virtual:lit-ssg-client`
     - `load(id)`: 处理 `\0virtual:lit-ssg-client` 和 `\0virtual:lit-ssg-server`，返回生成的代码
  3. 删除 `validateOptions()` 中对 `entryServer`、`entryClient`、`routes` 的验证
  4. 更新 WeakMap 存储结构，存储 `{ pagesDir: string, resolvedConfig: ResolvedConfig }` 等必要信息

  **Must NOT do**:
  - 不同时修改 `manifest.ts` 或 `build.ts`
  - 不修改 `normalize-page.ts` 的任何现有分支

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 需要深入理解 Vite Plugin API（resolveId/load/configResolved/buildStart hooks 的生命周期和 SSR 环境判断）
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 3, 与 T6/T8 并行)
  - **Parallel Group**: Wave 3
  - **Blocks**: T9, T10
  - **Blocked By**: T2 (LitRoute 类型), T3 (PageEntry/scanPages), T4 (虚拟模块代码生成器)

  **References**:

  **Pattern References**:
  - `src/plugin/index.ts:1-50` — 当前插件实现（WeakMap 存储模式）
  - `src/scanner/pages.ts` — 扫描器（T3 创建）
  - `src/virtual/client-entry.ts` 和 `src/virtual/server-entry.ts` — 代码生成器（T4 创建）

  **External References**:
  - Vite Plugin API 文档：`resolveId`, `load`, `configResolved`, `buildStart` hooks
  - Vite 虚拟模块约定：ID 以 `\0` 前缀区分虚拟模块（`\0virtual:xxx`）

  **Acceptance Criteria**:
  - [ ] `litSSG()` 接受 `{ pagesDir?: string }` 或无参数
  - [ ] `resolveId` 正确处理两个虚拟模块 ID
  - [ ] `load` 返回正确生成的代码字符串
  - [ ] `buildStart` 调用 `scanPages()` 并存储结果
  - [ ] TypeScript 编译无错误
  - [ ] 旧选项（entryServer 等）不再被接受

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: 插件注册并解析虚拟模块
    Tool: Bash
    Steps:
      1. 运行: pnpm typecheck
      2. 验证 TypeScript 无报错
    Expected Result: 退出码 0
    Evidence: .sisyphus/evidence/task-7-typecheck.txt
  ```

  **Commit**: YES
  - Message: `feat(plugin): add virtual module hooks and simplify options to pagesDir only`
  - Files: `src/plugin/index.ts`, `src/types.ts`, `src/runner/routes.ts`（如果 resolveRoutes 需要适配）

---

- [x] 8. 重构 CLI — 从 build.outDir 读取输出目录

  **What to do**:
  1. 在 `cli.ts` 的 `main()` 中，从 `loaded.config.build?.outDir` 读取 outDir（默认 `'dist'`）
  2. 从 `getSSGOptions()` 读取 `pagesDir`
  3. 调用 `scanPages(projectRoot, pagesDir)` 获取 pages 列表
  4. 调用新版 `runSSG(pages, projectRoot, base, outDir, pagesDir, ctx)` 传入 outDir
  5. 删除从 `ssgOpts.outDir` 读取的旧逻辑

  **Must NOT do**:
  - 不修改 `build.ts`（已在 T6 完成）
  - 不修改 CLI 的参数解析逻辑（保持 `--mode`、`--config` 支持）

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 3, 与 T6/T7 并行)
  - **Parallel Group**: Wave 3
  - **Blocks**: T9
  - **Blocked By**: T6 (runSSG 新签名), T7 (getSSGOptions 新返回值)

  **References**:

  **Pattern References**:
  - `src/cli.ts:59-69` — 当前 `runSSG` 调用处，需修改 outDir 来源和 pages 参数
  - `src/scanner/pages.ts` — T3 创建的扫描器

  **Acceptance Criteria**:
  - [ ] CLI 从 `config.build?.outDir ?? 'dist'` 读取输出目录
  - [ ] CLI 调用 `scanPages()` 并将结果传给 `runSSG()`
  - [ ] TypeScript 编译无错误

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: TypeScript 类型检查通过
    Tool: Bash
    Steps:
      1. 运行: pnpm typecheck
    Expected Result: 无 TS 错误
    Evidence: .sisyphus/evidence/task-8-typecheck.txt
  ```

  **Commit**: YES
  - Message: `refactor(cli): read outDir from vite build config instead of plugin options`
  - Files: `src/cli.ts`

---

- [x] 9. 更新所有测试（单元 + 集成）

  **What to do**:
  1. **更新单元测试**（不删除，只修改）：
     - `tests/unit/routes.test.ts` → 如果 `resolveRoutes` 被删除，更新或删除此测试
     - `tests/unit/manifest.test.ts` → 更新断言，移除 entryClient 参数，改用 isEntry fixture
     - `tests/unit/render-page.test.ts` → 不需要大改（renderPage 签名未变）
     - `tests/unit/normalize-page.test.ts` → 不需要大改
     - `tests/unit/write-route.test.ts` → 不需要大改
  2. **新建集成测试** `tests/integration/ssg-convention.test.ts`：
     基于重构后的 playground，验证：
     - `dist/index.html` 存在且含 Lit SSR 标记
     - `dist/about/index.html` 存在且含正确 title（来自 `defineLitRoute`）
     - about 页面含 meta description
     - 无 entry-server.ts、entry-client.ts 文件
     - 构建成功，退出码 0
  3. **保留旧集成测试** `tests/integration/ssg.test.ts`，直到新集成测试覆盖相同场景后才删除
  4. 如果旧集成测试由于 playground 重构（T10）而无法运行，将其标记为 `skip` 并在 T10 完成后决定是否删除

  **Must NOT do**:
  - 不在 T10 playground 重构完成前删除旧集成测试
  - 不减少现有断言覆盖率

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 4, 与 T10/T11 并行)
  - **Parallel Group**: Wave 4
  - **Blocks**: F1-F4
  - **Blocked By**: T6, T7, T8 (核心实现完成)

  **References**:

  **Pattern References**:
  - `tests/integration/ssg.test.ts` — 旧集成测试，作为新测试断言的参考
  - `tests/unit/manifest.test.ts` — 需要修改的单元测试
  - `packages/playground/` — T10 重构后的 playground（新测试的运行环境）

  **Acceptance Criteria**:
  - [ ] `pnpm test` 全部通过（不含 skip）
  - [ ] 新集成测试覆盖旧集成测试的所有关键断言
  - [ ] manifest 单元测试更新为无 entryClient 参数版本

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: 全套测试通过
    Tool: Bash
    Preconditions: 所有 Wave 3 任务完成，playground 已重构
    Steps:
      1. cd packages/vite-plugin-lit-ssg
      2. pnpm test
      3. 检查退出码为 0 且无失败测试
    Expected Result: 所有测试通过，0 failures
    Failure Indicators: 任何 FAIL 标记
    Evidence: .sisyphus/evidence/task-9-test-all.txt
  ```

  **Commit**: YES
  - Message: `test: update unit tests and add convention-based SSG integration test`
  - Files: `tests/unit/manifest.test.ts`, `tests/unit/scanner.test.ts`（新）, `tests/unit/virtual-entries.test.ts`（新）, `tests/integration/ssg-convention.test.ts`（新）

---

- [x] 10. 重构 playground

  **What to do**:
  1. 删除 `packages/playground/src/entry-server.ts`
  2. 删除 `packages/playground/src/entry-client.ts`
  3. 更新 `packages/playground/vite.config.ts`：
     ```ts
     import { defineConfig } from 'vite'
     import { litSSG } from 'vite-plugin-lit-ssg'
     
     export default defineConfig({
       plugins: [litSSG()], // 零配置
     })
     ```
  4. 更新 `packages/playground/src/pages/home-page.ts`：
     - 在文件底部添加：
       ```ts
       import { defineLitRoute } from 'vite-plugin-lit-ssg'
       export default defineLitRoute({
         component: HomePage,
         title: 'Home | vite-plugin-lit-ssg',
         meta: [{ name: 'description', content: 'Lit SSG home page' }],
       })
       ```
  5. 更新 `packages/playground/src/pages/about-page.ts`：
     - 添加类似的 `defineLitRoute` 默认导出
  6. 将 `packages/playground/src/pages/home-page.ts` 和 `about-page.ts` 移动到 `packages/playground/src/pages/index.ts` 和 `about.ts`（如果文件名需要符合路由约定）

  > **注意**: 现有 playground 页面文件是 `home-page.ts` 和 `about-page.ts`，但路由约定要求 `index.ts` → `/` 和 `about.ts` → `/about`。需要重命名/重组。

  **Must NOT do**:
  - 不修改插件核心代码（只修改 playground）
  - 不添加新的 Lit 组件功能，只做最小化迁移

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 4, 与 T9/T11 并行)
  - **Parallel Group**: Wave 4
  - **Blocks**: F3 (QA 需要 playground 可构建)
  - **Blocked By**: T7 (plugin hooks 完成)

  **References**:

  **Pattern References**:
  - `packages/playground/src/entry-server.ts` — 当前 server entry，包含要迁移到各页面文件的元数据
  - `packages/playground/src/pages/home-page.ts` — 当前页面组件，需要添加 defineLitRoute 导出
  - `packages/playground/vite.config.ts` — 当前配置，需简化

  **Acceptance Criteria**:
  - [ ] `packages/playground/src/entry-server.ts` 和 `entry-client.ts` 已删除
  - [ ] `vite.config.ts` 只有 `litSSG()` 无参调用
  - [ ] `src/pages/index.ts` 和 `src/pages/about.ts` 各含 `defineLitRoute` 默认导出
  - [ ] `cd packages/playground && pnpm build` 成功（退出码 0）
  - [ ] `dist/index.html` 含正确的 title 和 Lit SSR 标记
  - [ ] `dist/about/index.html` 含正确的 title 和 meta

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: playground 构建成功
    Tool: Bash
    Preconditions: 插件已构建（pnpm build in vite-plugin-lit-ssg）
    Steps:
      1. cd packages/playground
      2. pnpm build
      3. 检查退出码为 0
      4. ls dist/index.html dist/about/index.html（两个文件都存在）
    Expected Result: 构建成功，两个页面文件存在
    Failure Indicators: 构建报错或文件缺失
    Evidence: .sisyphus/evidence/task-10-playground-build.txt

  Scenario: playground 元数据正确注入
    Tool: Bash
    Steps:
      1. grep -q "<title>Home | vite-plugin-lit-ssg</title>" dist/index.html
      2. grep -q "<title>About | vite-plugin-lit-ssg</title>" dist/about/index.html
      3. grep -q 'name="description"' dist/about/index.html
    Expected Result: 所有 grep 命令退出码为 0
    Evidence: .sisyphus/evidence/task-10-playground-meta.txt
  ```

  **Commit**: YES
  - Message: `refactor(playground): migrate to convention-based routing with defineLitRoute`
  - Files: `packages/playground/vite.config.ts`, `packages/playground/src/pages/index.ts`, `packages/playground/src/pages/about.ts`（删除 entry-server.ts, entry-client.ts, home-page.ts, about-page.ts）

---

- [x] 11. 更新 README

  **What to do**:
  1. 完全重写 Quick Start 章节，展示新的零配置用法
  2. 更新插件选项表（只有 `pagesDir?: string`）
  3. 新增"页面文件约定"章节，说明：
     - `src/pages/index.ts` → route `/`
     - `src/pages/about.ts` → route `/about`
     - 文件名保持原样（不转换大小写）
  4. 新增 `defineLitRoute()` API 文档：字段说明，完整示例
  5. 更新"How It Works"章节描述新的构建流程
  6. 删除"Plugin Options"中旧字段的说明
  7. 保留并更新"What This Is Not"章节（补充：不支持动态路由、不支持子目录路由）

  **Must NOT do**:
  - 不为不存在的功能（如动态路由）写文档
  - 不删除 License 章节

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 4, 与 T9/T10 并行)
  - **Parallel Group**: Wave 4
  - **Blocks**: F4
  - **Blocked By**: T7 (API 确定后再写文档)

  **References**:
  - `README.md` — 当前文档，完整重写基础
  - `src/define-route.ts` — T2 创建的 API，文档化来源
  - `packages/playground/src/pages/` — T10 重构后的页面，作为文档示例来源

  **Acceptance Criteria**:
  - [ ] README 中无 `entryServer`, `entryClient`, `routes`, `outDir` 配置项的提及
  - [ ] 包含完整的 `defineLitRoute()` 使用示例
  - [ ] 包含页面文件约定说明（index.ts → `/` 等）

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: README 不含旧配置项
    Tool: Bash
    Steps:
      1. grep -c "entryServer\|entryClient\|routes:" README.md
    Expected Result: 输出 0（无匹配）
    Failure Indicators: 任何匹配数量 > 0
    Evidence: .sisyphus/evidence/task-11-readme-no-old-api.txt
  ```

  **Commit**: YES
  - Message: `docs: rewrite README for convention-based routing and defineLitRoute API`
  - Files: `README.md`

---

## Final Verification Wave

> 4 个审查 agent 并行运行。全部 APPROVE 后，向用户呈现结果并等待明确确认。

- [x] F1. **Plan Compliance Audit** — `oracle`
  阅读整个计划。对每个 "Must Have"：验证实现存在（读文件、运行命令）。对每个 "Must NOT Have"：搜索代码库确认无禁止模式。检查 evidence 文件存在于 `.sisyphus/evidence/`。对比实际产出与计划要求。
  输出：`Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  运行 `tsc --noEmit` + `pnpm test`。检查所有修改文件：`as any`/`@ts-ignore`、空 catch、生产环境 console.log、注释掉的代码、未使用的 import。检查 AI slop：过度注释、过度抽象、泛化命名（data/result/item/temp）。
  输出：`Build [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high`
  从干净状态开始。执行所有任务的 QA 场景（T1-T11 中的每一个 Scenario），按照精确步骤，保存 evidence。特别验证端到端构建：`cd packages/playground && pnpm build`，检查生成的 HTML 文件包含正确内容。
  输出：`Scenarios [N/N pass] | Integration [PASS/FAIL] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  对每个任务：阅读"What to do"，阅读实际 git diff。验证 1:1 对应——规范中所有内容都已实现（无遗漏），规范外无多余内容（无范围蔓延）。检查"Must NOT do"合规性。标记跨任务文件污染。
  输出：`Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **T1**: `chore: add spike results for customElements.getName and manifest isEntry`
- **T2**: `feat(define-route): add defineLitRoute factory function and LitRoute type`
- **T3**: `feat(scanner): add pages directory scanner with route mapping`
- **T4**: `feat(virtual): add virtual client and server entry code generators`
- **T5**: `refactor(manifest): resolve client entry via isEntry scan instead of path key`
- **T6**: `refactor(build): use virtual entries and pages list in runSSG`
- **T7**: `feat(plugin): add virtual module hooks and simplify options to pagesDir only`
- **T8**: `refactor(cli): read outDir from vite build config instead of plugin options`
- **T9**: `test: update unit tests and add convention-based SSG integration test`
- **T10**: `refactor(playground): migrate to convention-based routing with defineLitRoute`
- **T11**: `docs: rewrite README for convention-based routing and defineLitRoute API`

---

## Success Criteria

### Verification Commands
```bash
# 1. playground 构建成功（零配置）
cd packages/playground && pnpm build
# 期望: 退出码 0，无错误

# 2. 路由文件正确生成
ls packages/playground/dist/index.html packages/playground/dist/about/index.html
# 期望: 两个文件都存在

# 3. 元数据正确注入
grep -q "<title>Home | vite-plugin-lit-ssg</title>" packages/playground/dist/index.html
grep -q "<title>About | vite-plugin-lit-ssg</title>" packages/playground/dist/about/index.html
# 期望: 退出码 0

# 4. Lit SSR 标记存在
grep -q "shadowrootmode" packages/playground/dist/index.html
# 期望: 退出码 0

# 5. 所有测试通过
cd packages/vite-plugin-lit-ssg && pnpm test
# 期望: 所有测试通过，0 failures

# 6. TypeScript 无错误
cd packages/vite-plugin-lit-ssg && pnpm typecheck
# 期望: 退出码 0

# 7. 无旧配置项残留
grep -c "entryServer\|entryClient\|routes:" README.md
# 期望: 0
```

### Final Checklist
- [ ] `litSSG()` 可无参调用
- [ ] `defineLitRoute()` 从主包导出
- [ ] `src/pages/*.ts` 自动生成路由
- [ ] 不再需要 entry-server.ts、entry-client.ts
- [ ] outDir 遵循 Vite 的 `build.outDir`
- [ ] 单元测试全部通过
- [ ] 集成测试全部通过
- [ ] README 无旧 API 引用
