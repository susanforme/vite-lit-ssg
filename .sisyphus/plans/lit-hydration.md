# Lit SSR 客户端水合修复

## TL;DR

> **Quick Summary**: 修复 vite-plugin-lit-ssg 的客户端 JS，从"粗暴重新渲染"改为正确的 Lit SSR 水合。核心是在任何组件模块加载前注入 `@lit-labs/ssr-client/lit-element-hydrate-support.js`，并在 HTML 模板里加入 DSD polyfill 支持。
>
> **Deliverables**:
> - `src/virtual/client-entry.ts` — 生成的虚拟入口第一行为水合支持 import
> - `src/runtime/render-page.ts` — HTML 包含 `dsd-pending` body 属性 + DSD polyfill 内联 script
> - `package.json` — 添加 `@lit-labs/ssr-client` 到 `dependencies`
> - `src/plugin/index.ts` — 添加 Vite `resolve.alias` 将虚拟入口的 ssr-client import 解析为插件自身 node_modules 中的路径
> - 单元测试更新 (`virtual-entries.test.ts`, `render-page.test.ts`)
> - 集成测试更新 (`ssg-convention.test.ts`)

> **Estimated Effort**: Short
> **Parallel Execution**: YES — 2 waves
> **Critical Path**: Task 1 (package.json) → Task 2 (plugin alias) → Task 3 (client-entry) → Task 4 (render-page) → Task 5 (tests) → Final

---

## Context

### Original Request
客户端 JS 再次包含了服务端已经渲染好的 DOM 和 CSS，应该使用 https://lit.dev/docs/ssr/client-usage/ 水合，参照 Astro Island 实现思路。

### Interview Summary
**Key Discussions**:
- 问题根因：`generateClientEntry()` 直接 `import` 各页面模块，LitElement 升级时重调 `render()`，替换 SSR 已生成的 `<template shadowrootmode="open">` DOM
- 解决方案：在 Lit/组件模块前加载 `@lit-labs/ssr-client/lit-element-hydrate-support.js`（monkey-patch LitElement 使其水合而非重渲染）
- 包解析策略：`@lit-labs/ssr-client` 已经是 `@lit-labs/ssr` 的 dependency（version 1.1.8 在 pnpm store），但未被 hoist 到用户项目的 node_modules。解决方案：添加到 plugin dependencies，并在 Vite plugin 的 `config()` hook 里用 `resolve.alias` 将虚拟模块中的 import 映射到插件自身的绝对路径

**Research Findings**:
- `@lit-labs/ssr-client` 在 pnpm 的 `.pnpm/@lit-labs+ssr-client@1.1.8` 中，需要显式安装才能可靠 resolve
- Lit 官方文档要求：hydrate support 模块必须在所有 `lit` 模块**之前**静态 import
- DSD polyfill 使用 `@webcomponents/template-shadowroot`（CDN）或内联检测 + 条件加载

### Metis Review
**Identified Gaps** (addressed):
- `@lit-labs/ssr-client` resolve 问题：用 Vite alias 解决
- `dsd-pending` 是布尔属性，不能用 `attrsToString()` 处理：直接字符串拼接
- `generateClientEntry([])` 空页面边界情况：确保水合 import 始终存在
- `virtual-entries.test.ts` 中 3 个测试将在修改后失效，需要同步更新

---

## Work Objectives

### Core Objective
将客户端模块入口从"粗暴重渲染"改为正确水合 SSR DOM，保证 LitElement 在检测到 `<template shadowrootmode>` 时进行水合而不重建 shadow root。

### Concrete Deliverables
- `packages/vite-plugin-lit-ssg/package.json` 中 `dependencies` 包含 `@lit-labs/ssr-client: ^1.1.7`
- `generateClientEntry()` 输出的第一行是 `import '@lit-labs/ssr-client/lit-element-hydrate-support.js'`
- `renderPage()` 生成的 HTML 包含 `<body dsd-pending` 属性和 DSD polyfill 内联 script
- Vite plugin 通过 `resolve.alias` 确保 ssr-client 路径可 resolve
- 全部 vitest 单元测试 + 集成测试通过

### Definition of Done
- [ ] `pnpm test` 在 `packages/vite-plugin-lit-ssg` 中退出码为 0，所有测试通过
- [ ] `generateClientEntry([{ importPath: '/src/pages/index.ts', ... }])` 输出的第一行为水合 import
- [ ] 生成的 HTML 包含 `<body dsd-pending` 和 DSD 检测 script

### Must Have
- `@lit-labs/ssr-client/lit-element-hydrate-support.js` 作为虚拟 entry 的第一个静态 import
- `dsd-pending` 布尔属性添加到 `<body>` 元素（直接字符串拼接，不经过 `attrsToString`）
- DSD 原生支持检测 inline script（`'shadowrootmode' in HTMLTemplateElement.prototype`）
- DSD polyfill 的异步加载 script（`type="module"` 避免阻塞）
- Vite alias 确保 `@lit-labs/ssr-client` 从插件 node_modules 绝对路径解析

### Must NOT Have (Guardrails)
- **不得**修改 `generateServerEntry` 或 `src/virtual/server-entry.ts`
- **不得**修改 `renderPage()` 函数签名或 `AssetLinks` 类型
- **不得**修改 `plugin/index.ts` 以外的构建逻辑（`runner/build.ts` 不动）
- **不得**用 `attrsToString()` 处理 `dsd-pending` 布尔属性
- **不得**在 `render-page.ts` 引入新的辅助函数或重构现有结构
- **不得**实现 islands 架构、`client:load` 指令、或延迟水合功能
- **不得**添加 CSP nonce、hydration 事件分发等额外功能

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: YES (vitest)
- **Automated tests**: Tests-after (修改现有 + 新增单元测试)
- **Framework**: vitest

### QA Policy
每个 task 包含 agent 可直接执行的验证场景，使用 Bash (node/pnpm) 工具。

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — 并行):
├── Task 1: 添加 @lit-labs/ssr-client 到 package.json dependencies [quick]
└── Task 2: Vite plugin 添加 resolve.alias [quick]

Wave 2 (After Wave 1 — 并行):
├── Task 3: 修改 generateClientEntry() 注入水合 import [quick]
└── Task 4: 修改 render-page.ts 加入 DSD polyfill HTML [quick]

Wave 3 (After Wave 2 — 并行):
├── Task 5: 更新 virtual-entries.test.ts [quick]
├── Task 6: 更新 render-page.test.ts [quick]
└── Task 7: 更新 ssg-convention.test.ts (integration) [quick]

Wave FINAL (After All — 串行):
└── Task F1: 运行全量测试验证 [unspecified-high]

Critical Path: Task 1 → Task 3 → Task 5 → F1
Parallel Speedup: ~50% faster than sequential
```

### Dependency Matrix

- **1**: none → 2 (alias 需要知道 package 已安装)
- **2**: 1 → 3 (client-entry 依赖 alias 可 resolve)
- **3**: 2 → 5
- **4**: none → 6
- **5**: 3 → F1
- **6**: 4 → F1
- **7**: 4, 5 → F1
- **F1**: 5, 6, 7

### Agent Dispatch Summary

- **Wave 1**: 2 tasks → `quick`, `quick`
- **Wave 2**: 2 tasks → `quick`, `quick`
- **Wave 3**: 3 tasks → `quick`, `quick`, `quick`
- **Final**: 1 task → `unspecified-high`

---

## TODOs

---

- [x] 1. 添加 `@lit-labs/ssr-client` 到 plugin 的 dependencies

  **What to do**:
  - 编辑 `packages/vite-plugin-lit-ssg/package.json`
  - 在 `dependencies` 对象中添加 `"@lit-labs/ssr-client": "^1.1.7"`（与 `@lit-labs/ssr` 的依赖版本一致）
  - 注意：不是 `peerDependencies`，是 `dependencies`（插件运行时需要）
  - 运行 `pnpm install` 在工作区根目录以安装新依赖

  **Must NOT do**:
  - 不要放到 `devDependencies`（生产依赖）
  - 不要修改任何其他 `package.json` 字段

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（与 Task 2 无强依赖，但 Task 2 需要知道安装成功，建议 Wave 1 同时执行）
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Task 2 (alias 路径需要包已安装)
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `packages/vite-plugin-lit-ssg/package.json:30-33` — 现有 `dependencies` 对象结构，仿照 `@lit-labs/ssr` 的格式添加

  **External References**:
  - `@lit-labs/ssr` 的 package.json 中 `@lit-labs/ssr-client: "^1.1.7"` 是版本锚点
  - pnpm store 中的实际版本：`@lit-labs+ssr-client@1.1.8`

  **Acceptance Criteria**:

  - [ ] `packages/vite-plugin-lit-ssg/package.json` 的 `dependencies` 包含 `@lit-labs/ssr-client`
  - [ ] `node -e "const p=JSON.parse(require('fs').readFileSync('packages/vite-plugin-lit-ssg/package.json')); console.assert('@lit-labs/ssr-client' in p.dependencies); console.log('PASS')"` 输出 PASS
  - [ ] `pnpm install` 后 `packages/vite-plugin-lit-ssg/node_modules/@lit-labs/ssr-client/` 目录存在

  **QA Scenarios**:

  ```
  Scenario: package.json dependencies 包含 ssr-client
    Tool: Bash
    Preconditions: 编辑完 package.json
    Steps:
      1. node -e "const p=JSON.parse(require('fs').readFileSync('packages/vite-plugin-lit-ssg/package.json','utf8')); console.assert('@lit-labs/ssr-client' in (p.dependencies||{}), 'MISSING'); console.log('PASS')"
      2. 预期输出 "PASS"
    Expected Result: 命令退出码 0，输出 "PASS"
    Evidence: .sisyphus/evidence/task-1-package-dep.txt

  Scenario: pnpm install 后可以解析到 ssr-client
    Tool: Bash
    Preconditions: pnpm install 已运行
    Steps:
      1. ls packages/vite-plugin-lit-ssg/node_modules/@lit-labs/ssr-client/
      2. 预期能列出 package.json 和 lit-element-hydrate-support.js
    Expected Result: 目录存在，ls 退出码 0
    Failure Indicators: "No such file or directory"
    Evidence: .sisyphus/evidence/task-1-node-modules.txt
  ```

  **Commit**: YES (groups with Task 2)
  - Message: `deps(plugin): add @lit-labs/ssr-client as runtime dependency`
  - Files: `packages/vite-plugin-lit-ssg/package.json`
  - Pre-commit: `node -e "const p=JSON.parse(require('fs').readFileSync('packages/vite-plugin-lit-ssg/package.json','utf8')); console.assert('@lit-labs/ssr-client' in (p.dependencies||{}))"`

---

- [x] 2. Vite plugin 添加 `resolve.alias` 将 ssr-client bare specifier 映射到绝对路径

  **What to do**:
  - 编辑 `packages/vite-plugin-lit-ssg/src/plugin/index.ts`
  - 在 `config()` hook 返回值中添加 `resolve.alias`，将 `@lit-labs/ssr-client` 映射到插件 package 的实际绝对路径
  - 使用 `import.meta.resolve()` 或 `createRequire(import.meta.url).resolve()` 获取插件自身 node_modules 中的 `@lit-labs/ssr-client` 绝对路径
  - 目的：确保用户项目（playground）构建时，虚拟 entry 里的 `import '@lit-labs/ssr-client/lit-element-hydrate-support.js'` 能正确 resolve，即使用户项目自身没有直接安装

  **实现思路**:
  ```ts
  // plugin/index.ts 顶部
  import { createRequire } from 'node:module'
  import { dirname } from 'node:path'
  import { fileURLToPath } from 'node:url'

  const require = createRequire(import.meta.url)

  // 在 config() hook 里
  config() {
    const ssrClientPath = require.resolve('@lit-labs/ssr-client/lit-element-hydrate-support.js')
    return {
      build: { manifest: true },
      resolve: {
        alias: {
          '@lit-labs/ssr-client/lit-element-hydrate-support.js': ssrClientPath,
        },
      },
    }
  }
  ```

  **Must NOT do**:
  - 不要用硬编码路径（如 `../node_modules/...`）——必须动态 resolve
  - 不要修改 `resolveId()` / `load()` / `configResolved()` 等其他 hooks
  - 不要引入 Vite rollup options 变化

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（可与 Task 1 同时执行，但 Task 1 必须先完成 pnpm install）
  - **Parallel Group**: Wave 1 (逻辑上与 Task 1 并行，但 pnpm install 需要 Task 1 先完成)
  - **Blocks**: Task 3
  - **Blocked By**: Task 1 (pnpm install 需要先完成)

  **References**:

  **Pattern References**:
  - `packages/vite-plugin-lit-ssg/src/plugin/index.ts:32-38` — 现有 `config()` hook 结构，在其中添加 `resolve.alias`

  **External References**:
  - Node.js `createRequire` API：用于在 ESM 模块中使用 CommonJS 的 `require.resolve()`
  - Vite 文档：`resolve.alias` 接受 `{ find: string, replacement: string }` 或直接 `{ [key: string]: string }` 形式

  **Acceptance Criteria**:

  - [ ] `plugin/index.ts` 的 `config()` 返回值包含 `resolve.alias` 字段
  - [ ] TypeScript 编译无错误：`pnpm typecheck` 通过

  **QA Scenarios**:

  ```
  Scenario: TypeScript 编译通过（无类型错误）
    Tool: Bash
    Preconditions: Task 1 完成，Task 2 代码修改完毕
    Steps:
      1. cd packages/vite-plugin-lit-ssg && pnpm typecheck
      2. 预期退出码 0，无 error 输出
    Expected Result: 0 exit code
    Failure Indicators: "error TS" 出现在输出中
    Evidence: .sisyphus/evidence/task-2-typecheck.txt

  Scenario: require.resolve 在运行时能解析 ssr-client 路径
    Tool: Bash
    Preconditions: pnpm install 已完成
    Steps:
      1. node --input-type=module -e "
         import {createRequire} from 'node:module';
         const req = createRequire('./packages/vite-plugin-lit-ssg/src/plugin/index.ts');
         const p = req.resolve('@lit-labs/ssr-client/lit-element-hydrate-support.js');
         console.assert(p.includes('ssr-client'), 'FAIL: path does not include ssr-client');
         console.log('PASS:', p);"
      2. 预期输出 "PASS: <absolute-path>"
    Expected Result: 退出码 0，输出包含 "PASS"
    Failure Indicators: "Cannot find module" 或 "FAIL"
    Evidence: .sisyphus/evidence/task-2-resolve.txt
  ```

  **Commit**: YES (groups with Task 1)
  - Message: `feat(plugin): alias @lit-labs/ssr-client to plugin-local path for Vite build`
  - Files: `packages/vite-plugin-lit-ssg/src/plugin/index.ts`
  - Pre-commit: `pnpm --filter vite-plugin-lit-ssg typecheck`

---

- [x] 3. 修改 `generateClientEntry()` — 注入水合 import 为第一行

  **What to do**:
  - 编辑 `packages/vite-plugin-lit-ssg/src/virtual/client-entry.ts`
  - 将函数返回值改为：先输出水合支持的静态 import 行，再输出页面 import 列表
  - 空页面（`pages = []`）时也必须输出水合 import（不能有条件）
  - 新的生成逻辑：
    ```ts
    export function generateClientEntry(pages: PageEntry[]): string {
      const hydrateImport = `import '@lit-labs/ssr-client/lit-element-hydrate-support.js'`
      const pageImports = pages.map((p) => `import '${p.importPath}'`).join('\n')
      return pageImports ? `${hydrateImport}\n${pageImports}\n` : `${hydrateImport}\n`
    }
    ```

  **Must NOT do**:
  - 不要将水合 import 放在页面 import 之后
  - 不要用动态 import（必须是静态 import 语句）
  - 不要修改 `PageEntry` 类型或其他接口

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（与 Task 4 并行）
  - **Parallel Group**: Wave 2 (with Task 4)
  - **Blocks**: Task 5
  - **Blocked By**: Task 2 (alias 需要配置完成才能保证构建时 resolve 成功)

  **References**:

  **Pattern References**:
  - `packages/vite-plugin-lit-ssg/src/virtual/client-entry.ts:1-5` — 完整当前实现（仅 5 行），在此基础上修改

  **Acceptance Criteria**:

  - [ ] `generateClientEntry([{ importPath: '/src/pages/index.ts', filePath: '', route: '/' }])` 的输出第一行是 `import '@lit-labs/ssr-client/lit-element-hydrate-support.js'`
  - [ ] `generateClientEntry([])` 的输出只有一行且包含 `@lit-labs/ssr-client`
  - [ ] 页面 import 行数仍与 pages 数组长度一致

  **QA Scenarios**:

  ```
  Scenario: 水合 import 是第一行（有页面）
    Tool: Bash
    Preconditions: 代码修改完成，plugin 已构建（或通过 tsx 直接运行 src）
    Steps:
      1. node --input-type=module -e "
         import {generateClientEntry} from './packages/vite-plugin-lit-ssg/src/virtual/client-entry.js';
         const out = generateClientEntry([{importPath:'/src/pages/index.ts',filePath:'',route:'/'}]);
         const lines = out.split('\n').filter(Boolean);
         console.assert(lines[0].includes('@lit-labs/ssr-client'), 'FAIL: not first line');
         console.assert(lines[1].includes('/src/pages/index.ts'), 'FAIL: page import missing');
         console.log('PASS, lines:', lines);"
      2. 预期输出包含 "PASS"
    Expected Result: 退出码 0
    Failure Indicators: "FAIL" 或 AssertionError
    Evidence: .sisyphus/evidence/task-3-entry-output.txt

  Scenario: 空页面时仍有水合 import
    Tool: Bash
    Steps:
      1. node --input-type=module -e "
         import {generateClientEntry} from './packages/vite-plugin-lit-ssg/src/virtual/client-entry.js';
         const out = generateClientEntry([]);
         console.assert(out.includes('@lit-labs/ssr-client'), 'FAIL: missing hydration import');
         console.assert(!out.includes('/src/pages'), 'FAIL: unexpected page import');
         console.log('PASS:', JSON.stringify(out));"
      2. 预期输出 "PASS: \"import '@lit-labs/ssr-client/lit-element-hydrate-support.js'\n\""
    Expected Result: 退出码 0
    Evidence: .sisyphus/evidence/task-3-empty-pages.txt
  ```

  **Commit**: YES
  - Message: `feat(virtual): prepend lit-element-hydrate-support import to client entry`
  - Files: `packages/vite-plugin-lit-ssg/src/virtual/client-entry.ts`
  - Pre-commit: none (tests updated in Task 5)

---

- [x] 4. 修改 `render-page.ts` — 添加 DSD polyfill 支持到 HTML 模板

  **What to do**:
  - 编辑 `packages/vite-plugin-lit-ssg/src/runtime/render-page.ts`
  - 在 `<body>` 标签上添加 `dsd-pending` 布尔属性（直接字符串拼接，不经过 `attrsToString`）
  - 在 `appHtml` 之前（body 开始后），插入两个内联 script：

  **Script 1 — 原生 DSD 检测（同步，无 type=module）**:
  ```html
  <script>
    if ('shadowrootmode' in HTMLTemplateElement.prototype) {
      document.body.removeAttribute('dsd-pending');
    }
  </script>
  ```

  **Script 2 — 条件加载 DSD polyfill（异步，type=module）**:
  ```html
  <script type="module">
    if (!('shadowrootmode' in HTMLTemplateElement.prototype)) {
      const {hydrateShadowRoots} = await import('https://unpkg.com/@webcomponents/template-shadowroot@0.2.1/template-shadowroot.js');
      hydrateShadowRoots(document.body);
      document.body.removeAttribute('dsd-pending');
    }
  </script>
  ```

  **body 标签修改**:
  - 当前：`` `<body${bodyAttrStr}>` ``
  - 修改后：`` `<body dsd-pending${bodyAttrStr}>` ``
  - 注意：`bodyAttrStr` 已是 ` attr="value"` 形式（带前导空格），所以 `dsd-pending` 直接跟在 `<body` 后，不影响现有 attrs

  **CSS 部分注意**:
  - 在 `<head>` 里添加 `body[dsd-pending] { display: none; }` 内联 style，防止 FOUC

  **Must NOT do**:
  - 不要修改 `renderPage()` 函数签名
  - 不要修改 `AssetLinks` 类型
  - 不要将 polyfill script 放在 `<head>` 里（应在 body 内，appHtml 之前）
  - 不要使用 render-blocking script（polyfill 加载 script 必须是 `type="module"`）
  - 不要把 `dsd-pending` 加入 `bodyAttrs` 对象（避免和用户自定义 bodyAttrs 冲突）

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（与 Task 3 并行）
  - **Parallel Group**: Wave 2 (with Task 3)
  - **Blocks**: Task 6, Task 7
  - **Blocked By**: None（不依赖 Task 1/2/3）

  **References**:

  **Pattern References**:
  - `packages/vite-plugin-lit-ssg/src/runtime/render-page.ts:47-60` — 现有 HTML 构建数组，在此结构内添加新内容
  - `packages/vite-plugin-lit-ssg/src/runtime/render-page.ts:55` — 当前 `<body${bodyAttrStr}>` 行，修改为 `<body dsd-pending${bodyAttrStr}>`

  **External References**:
  - Lit SSR 客户端文档示例：https://lit.dev/docs/ssr/client-usage/#using-the-template-shadowroot-polyfill
  - `@webcomponents/template-shadowroot` CDN：`https://unpkg.com/@webcomponents/template-shadowroot@0.2.1/template-shadowroot.js`

  **Acceptance Criteria**:

  - [ ] 生成的 HTML 包含 `<body dsd-pending`（注意：不是 `<body dsd-pending="">`）
  - [ ] 生成的 HTML 包含 `'shadowrootmode' in HTMLTemplateElement.prototype`
  - [ ] 生成的 HTML 包含 `hydrateShadowRoots`
  - [ ] `bodyAttrs: { class: 'foo' }` 时，生成 `<body dsd-pending class="foo">`（已有 attrs 仍正确）
  - [ ] `<head>` 包含 `body[dsd-pending] { display: none; }`

  **QA Scenarios**:

  ```
  Scenario: body 标签包含 dsd-pending 属性
    Tool: Bash (node REPL)
    Preconditions: render-page.ts 修改完成，plugin 已构建 (tsc) 或通过 ts 直接运行
    Steps:
      1. 运行现有集成测试: cd packages/vite-plugin-lit-ssg && pnpm test -- render-page
      2. 同时手动检查: 运行 Task 7 的集成测试生成实际 HTML，grep 结果
    Expected Result: 生成的 index.html 包含 "dsd-pending"
    Evidence: .sisyphus/evidence/task-4-body-attr.txt

  Scenario: 用户自定义 bodyAttrs 不被 dsd-pending 覆盖
    Tool: Bash
    Steps:
      1. 在 render-page.test.ts 中的 bodyAttrs 测试用例里（如果已有），验证 dsd-pending 和 bodyAttrs 同时出现
      2. 如果 render-page.test.ts 中没有 bodyAttrs 测试，在 Task 6 中添加
    Expected Result: HTML 输出为 `<body dsd-pending class="page-class">`（两个属性共存）
    Evidence: .sisyphus/evidence/task-4-body-attrs-coexist.txt

  Scenario: DSD polyfill feature-detect script 存在
    Tool: Bash
    Steps:
      1. 构建完成后: grep "shadowrootmode" packages/playground/dist/index.html
      2. 预期输出包含 "shadowrootmode"
    Expected Result: grep 退出码 0，找到匹配
    Failure Indicators: "No such file" 或空输出
    Evidence: .sisyphus/evidence/task-4-dsd-script.txt
  ```

  **Commit**: YES
  - Message: `feat(render): add dsd-pending body attr and DSD polyfill inline scripts`
  - Files: `packages/vite-plugin-lit-ssg/src/runtime/render-page.ts`
  - Pre-commit: none (tests updated in Task 6)

---

- [x] 5. 更新 `virtual-entries.test.ts` — 同步测试期望到新的 entry 格式

  **What to do**:
  - 编辑 `packages/vite-plugin-lit-ssg/tests/unit/virtual-entries.test.ts`
  - 找到所有 `generateClientEntry` 相关测试（预计 3 个），更新期望：
    1. 第一行应为 `import '@lit-labs/ssr-client/lit-element-hydrate-support.js'`
    2. 行数期望需要 +1（新增水合 import 行）
    3. 空页面测试：结果只有水合 import 一行
  - 保留所有已有测试的语义（页面 import 顺序、路径格式），只更新受影响的断言

  **Must NOT do**:
  - 不要删除现有测试——只修改断言
  - 不要修改 `generateServerEntry` 相关测试
  - 不要改变测试的组织结构

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（与 Task 6 并行）
  - **Parallel Group**: Wave 3 (with Task 6, Task 7)
  - **Blocks**: F1
  - **Blocked By**: Task 3

  **References**:

  **Pattern References**:
  - `packages/vite-plugin-lit-ssg/tests/unit/virtual-entries.test.ts` — 读取当前测试内容，定位需要修改的断言

  **Acceptance Criteria**:

  - [ ] `pnpm test -- virtual-entries` 通过（0 failures）
  - [ ] 测试覆盖：有页面时，水合 import 在第一行
  - [ ] 测试覆盖：空页面时，仍有水合 import

  **QA Scenarios**:

  ```
  Scenario: virtual-entries 单元测试全部通过
    Tool: Bash
    Steps:
      1. cd packages/vite-plugin-lit-ssg && pnpm test -- --reporter=verbose virtual-entries
    Expected Result: 退出码 0，所有 describe/it 显示 ✓
    Failure Indicators: "FAIL" 或红色输出
    Evidence: .sisyphus/evidence/task-5-virtual-entries-test.txt
  ```

  **Commit**: YES (groups with Task 6, Task 7)
  - Message: `test(virtual): update client-entry expectations for hydration import`
  - Files: `packages/vite-plugin-lit-ssg/tests/unit/virtual-entries.test.ts`

---

- [x] 6. 更新 `render-page.test.ts` — 添加 DSD polyfill 相关断言

  **What to do**:
  - 编辑 `packages/vite-plugin-lit-ssg/tests/unit/render-page.test.ts`
  - 在现有测试基础上添加新断言（不破坏现有断言）：
    1. 生成的 HTML 包含 `<body dsd-pending`
    2. 生成的 HTML 包含 `'shadowrootmode' in HTMLTemplateElement.prototype`
    3. 生成的 HTML 包含 `hydrateShadowRoots`
    4. 生成的 HTML 的 `<head>` 包含 `body[dsd-pending]` CSS
    5. 当 `bodyAttrs` 存在时（如 `{ class: 'page' }`），输出为 `<body dsd-pending class="page">`（dsd-pending 与其他 attrs 共存）
  - 检查现有测试：如果已有 body tag 断言，确保它们兼容新的 `dsd-pending` 属性

  **Must NOT do**:
  - 不要删除现有测试
  - 不要修改 `renderPage()` 函数本身（仅修改测试文件）

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（与 Task 5 并行）
  - **Parallel Group**: Wave 3 (with Task 5, Task 7)
  - **Blocks**: F1
  - **Blocked By**: Task 4

  **References**:

  **Pattern References**:
  - `packages/vite-plugin-lit-ssg/tests/unit/render-page.test.ts` — 读取全部内容，找到 body 相关测试位置
  - 现有测试模式：`expect(html).toContain(...)` — 仿照添加新断言

  **Acceptance Criteria**:

  - [ ] `pnpm test -- render-page` 通过（0 failures）
  - [ ] 有新断言：`toContain('dsd-pending')`
  - [ ] 有新断言：`toContain("'shadowrootmode' in HTMLTemplateElement.prototype")`
  - [ ] 有新断言验证 bodyAttrs 与 dsd-pending 共存

  **QA Scenarios**:

  ```
  Scenario: render-page 单元测试全部通过（含新断言）
    Tool: Bash
    Steps:
      1. cd packages/vite-plugin-lit-ssg && pnpm test -- --reporter=verbose render-page
    Expected Result: 退出码 0，所有测试 ✓，新断言也通过
    Failure Indicators: "FAIL" 或 "expected ... to contain ..."
    Evidence: .sisyphus/evidence/task-6-render-page-test.txt
  ```

  **Commit**: YES (groups with Task 5, Task 7)
  - Message: `test(render): add dsd-pending and polyfill assertions to render-page tests`
  - Files: `packages/vite-plugin-lit-ssg/tests/unit/render-page.test.ts`

---

- [x] 7. 更新 `ssg-convention.test.ts` — 添加水合相关集成断言

  **What to do**:
  - 编辑 `packages/vite-plugin-lit-ssg/tests/integration/ssg-convention.test.ts`
  - 在现有集成测试中添加新断言：
    1. `index.html` 包含 `dsd-pending`（body 属性）
    2. `index.html` 包含 `'shadowrootmode' in HTMLTemplateElement.prototype`（DSD 检测 script）
    3. `index.html` 包含 `@lit-labs/ssr-client` 的引用（可以是 script tag src 包含该字符串，或者 client JS 包含该 import）
  - 现有断言（`shadowrootmode` in markup, title, meta, etc.）保持不变

  **Must NOT do**:
  - 不要修改 `beforeAll` / `afterAll` 的构建逻辑
  - 不要修改现有断言
  - 不要添加新的测试 suite，只在现有 `describe` 块内添加 `it` 用例

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（与 Task 5, Task 6 并行）
  - **Parallel Group**: Wave 3
  - **Blocks**: F1
  - **Blocked By**: Task 4 (render-page.ts 必须先改，否则生成的 HTML 里没有 dsd-pending)

  **References**:

  **Pattern References**:
  - `packages/vite-plugin-lit-ssg/tests/integration/ssg-convention.test.ts:30-36` — 现有内容断言模式，仿照添加新 it 用例

  **Acceptance Criteria**:

  - [ ] 新 it 用例通过：HTML 包含 `dsd-pending`
  - [ ] 新 it 用例通过：HTML 包含 DSD feature-detect 代码
  - [ ] 现有全部 it 用例保持通过

  **QA Scenarios**:

  ```
  Scenario: 集成测试所有用例通过（含新断言）
    Tool: Bash
    Steps:
      1. cd packages/vite-plugin-lit-ssg && pnpm test -- --reporter=verbose ssg-convention
    Expected Result: 退出码 0，所有 it 显示 ✓（包括新加的）
    Failure Indicators: "FAIL" 或构建失败
    Evidence: .sisyphus/evidence/task-7-integration-test.txt
  ```

  **Commit**: YES (groups with Task 5, Task 6)
  - Message: `test(integration): assert dsd-pending and hydration script in generated HTML`
  - Files: `packages/vite-plugin-lit-ssg/tests/integration/ssg-convention.test.ts`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

- [x] F1. **全量测试 + 最终验证**

  运行全量测试套件，验证所有修改的正确性和一致性：

  ```bash
  # 1. 在插件目录运行全部单元 + 集成测试
  cd packages/vite-plugin-lit-ssg && pnpm test

  # 2. 验证 TypeScript 编译无错误
  pnpm typecheck

  # 3. 验证生成的 HTML 包含正确内容（抽样验证）
  # 集成测试运行后，dist 已被清理，需要手动构建 playground：
  cd packages/playground && pnpm build
  grep -c "dsd-pending" dist/index.html   # 预期: >= 1
  grep -c "shadowrootmode" dist/index.html  # 预期: >= 2（SSR DOM + feature detect script）
  grep -c "hydrateShadowRoots" dist/index.html  # 预期: >= 1
  ```

  预期结果：
  - `pnpm test` 退出码 0，所有测试通过（无 failures，无 errors）
  - `pnpm typecheck` 退出码 0
  - `grep` 命令均找到匹配（退出码 0）

  Output: `Tests [N/N pass] | TypeCheck [PASS/FAIL] | HTML [dsd-pending ✓ | DSD-detect ✓ | polyfill ✓] | VERDICT: APPROVE/REJECT`

---

## Commit Strategy

```
Wave 1: deps(plugin): add @lit-labs/ssr-client as runtime dependency
        feat(plugin): alias @lit-labs/ssr-client to plugin-local path for Vite build

Wave 2: feat(virtual): prepend lit-element-hydrate-support import to client entry
        feat(render): add dsd-pending body attr and DSD polyfill inline scripts

Wave 3: test(virtual): update client-entry expectations for hydration import
        test(render): add dsd-pending and polyfill assertions to render-page tests
        test(integration): assert dsd-pending and hydration script in generated HTML
```

---

## Success Criteria

### Verification Commands
```bash
# 全量测试
cd packages/vite-plugin-lit-ssg && pnpm test
# Expected: all tests PASS, exit 0

# TypeScript 检查
cd packages/vite-plugin-lit-ssg && pnpm typecheck
# Expected: exit 0, no errors

# playground 构建验证
cd packages/playground && pnpm build
grep "dsd-pending" dist/index.html     # Expected: match found
grep "shadowrootmode" dist/index.html  # Expected: >= 2 matches
grep "hydrateShadowRoots" dist/index.html  # Expected: match found
```

### Final Checklist
- [ ] `@lit-labs/ssr-client` 在 plugin `dependencies` 中
- [ ] 虚拟 entry 第一行是水合 import
- [ ] 生成 HTML 包含 `dsd-pending`、DSD 检测脚本、polyfill 加载脚本
- [ ] 全量 pnpm test 通过
- [ ] TypeScript 无错误
- [ ] 不含被禁止的修改（server-entry, types, build.ts 等）
