# SSR 依赖一致性社区方案计划

## TL;DR

> **Summary**: 对当前仓库的 Lit hydration 依赖解析策略，优先采用社区更普遍的 **config-first** 方案：`resolve.dedupe` + 定向 `ssr.noExternal` + 定向 `optimizeDeps.include`，把包级 `resolveId` 硬编码收缩为最后兜底，而不是主路径。
>
> **Deliverables**:
> - 一份面向本仓库的迁移/收敛计划，明确推荐方案、边界、验证矩阵与回退条件
> - 未来实现时的 phased rollout：现状基线 → config-first 原型 → 回归验证 → 仅保留必要兜底
> - 一组可追溯的 GitHub / 官方文档依据，用来解释为什么推荐该路径
>
> **Effort**: Medium
> **Parallel**: YES — 2 waves + final verification
> **Critical Path**: 1 → 2 → 3 → 4 → 5 → F1

---

## Context

### Original Request
- 整理一种社区的普遍方案
- 列出计划
- 保存为 plan 到当前仓库

### Problem Statement
当前仓库在 `packages/vite-plugin-lit-ssg/src/plugin/index.ts` 中使用了 Lit 相关包的定向解析逻辑，用来避免 hydration / SSR 期间出现不同物理路径、不同模块实例、以及随之而来的 hydration singleton 失配问题。

这条路径对 Lit 场景有效，但它比 Vue / React / Nuxt / Vite 社区更常见的做法更“主动”：主流生态通常先用配置层手段统一依赖落点，只在配置不足时才接受更窄的插件级补丁。

### Current Repo Baseline
当前仓库并不是完全没有走社区路线：`litSSG()` 已经在 plugin `config()` 中为 client 环境注入了 `resolve.dedupe`，覆盖 `lit`、`lit-html`、`lit-element`、`@lit/reactive-element`。因此这份计划不是“从零引入 dedupe”，而是要把这条已有的 **client-side config-first 基线** 进一步扩展到 SSR 一致性，并尽量收缩 `resolveHydrationDependency()` 的职责范围。

### Research Summary
本次外部调研得到的共同模式是：

1. **优先 config-first**：
   - `resolve.dedupe` 用于把单实例运行时包统一解析到根位置
   - `ssr.noExternal` 用于避免 SSR 时 Node 与 Vite 各走一套缓存/加载路径
   - `optimizeDeps.include` / `ssr.optimizeDeps` 用于补齐 CJS、晚发现依赖、或特定转译问题

2. **插件/框架会特殊照顾核心依赖，但通常先落在 config hook，而不是 `resolveId` 子路径白名单**：
   - `@vitejs/plugin-react` / `vite-plugin-react-swc` 有 React 相关 dedupe / optimize 处理
   - Nuxt / VueFire / Nuxt Icon / 其他生态模块经常主动向 Vite config 注入 `dedupe`、`noExternal`、`optimizeDeps.include`

3. **包级硬编码不是完全没有，但应降级为最后兜底**：
   - 当子路径导出、CJS/ESM 混用、插件重写 specifier、或外部化边界导致 config-first 仍无法保证单实例时，才保留窄范围补丁

### Evidence Anchors
- Vite docs: `resolve.dedupe`, `ssr.noExternal`, `optimizeDeps.include`, `ssr.optimizeDeps`
- `vitejs/vite#8917` — `ssr.optimizeDeps`
- `vitejs/vite#19463` — SSR dedupe 对部分 CJS 不足，需结合 `noExternal` / optimize
- `vitejs/vite#20849` — 同一模块因不同 specifier / loader 路径出现双实例
- `vitejs/vite-plugin-react-swc#223` — 为 React / React DOM 添加 dedupe
- `vitejs/vite-plugin-react#280` — 社区对“插件自动 dedupe”的边界讨论
- `nuxt/nuxt` pages module、`nuxt/icon`、`vuefire`、`clerk/javascript` 等仓库中，均能看到 config-first 注入模式

---

## Work Objectives

### Core Objective
为本仓库制定一条更贴近社区主流的 SSR 依赖一致性路线：**先以 Vite 配置层机制解决 80%-90% 的单实例 / hydration 一致性问题，再只对 config-first 无法覆盖的 Lit 子路径保留最小兜底。**

### Concrete Deliverables
- 明确推荐方案：`resolve.dedupe` + 定向 `ssr.noExternal` + 定向 `optimizeDeps.include`
- 明确适用对象：仅限已证实会影响 hydration/SSR 单实例的 Lit 运行时依赖
- 明确兜底策略：仅在 config-first 失败且有复现证据时，才保留窄范围 `resolveId` 特判
- 给出 phased rollout 与 acceptance criteria，供后续实现使用

### Definition of Done
- [ ] 推荐方案已在计划中被唯一确定，且不再把包级 `resolveId` 硬编码作为默认路径
- [ ] 计划列出了 config-first 的分阶段实施步骤、失败判据与回退条件
- [ ] 计划明确指出哪些包应该先纳入 `dedupe` / `noExternal` / `optimizeDeps.include` 的评估矩阵
- [ ] 计划包含可执行的验证矩阵，覆盖 page mode、single-component mode、workspace/linked package、SSR build、hydration 行为

### Must Have
- 优先策略必须是 **config-first**
- 必须保留“Lit 专属兜底逻辑”的窄门，只在证据充分时才使用
- 必须把“单实例 / hydration 一致性”作为唯一目标，而不是顺手重构整个解析层
- 必须覆盖 page mode 与 single-component mode
- 必须要求对每一个纳入的包都有“为什么需要它”的证据说明

### Must NOT Have
- 不得把“删除所有硬编码”当成目标本身
- 不得在没有回归验证前直接移除现有 hydration 修复逻辑
- 不得把所有 Lit 相关包一股脑加入 `noExternal` 或 `optimizeDeps.include`，必须是定向收敛
- 不得把用户项目的 node_modules 目录结构假设写死为长期方案
- 不得把 config-first 失败场景模糊化；失败必须能复现、能说明、能回退

---

## Recommended Community Strategy

### Primary Path
对本仓库，优先推荐以下收敛顺序：

1. **`resolve.dedupe`**
   - 目标：统一单实例运行时包的根解析位置
   - 首批候选：`lit`, `lit-html`, `lit-element`, `@lit/reactive-element`, `@lit-labs/ssr-client`
   - 适用原因：这些包与 hydration support、template/cache/reactive state 共享语义直接相关

2. **定向 `ssr.noExternal`**
   - 目标：避免 SSR 外部化把同一依赖拆成 Node 原生加载与 Vite SSR runner 两条路径
   - 仅用于已证明会因 externalization 出现双实例或错位缓存的包

3. **定向 `optimizeDeps.include` / `ssr.optimizeDeps`**
   - 目标：补齐 CJS、转译、晚发现依赖，或特定开发/SSR 场景下的预打包一致性
   - 仅用于 dedupe + noExternal 仍不足的包

### Last-Resort Fallback
如果某个 **Lit 子路径导入** 在上述三层之后仍无法稳定收敛到同一物理模块实例，则允许保留或重写一个**更窄**的 `resolveId` 兜底，但必须满足：

- 有最小复现
- 能说明为何 config-first 不足
- 兜底范围只覆盖失败 specifier，不扩大到整个包族
- 文档中记录触发条件与移除条件

### Why This Matches Community Practice
- 主流框架和插件更常通过 Vite config hook 注入约束，而不是长期维护一大批包/子路径白名单
- config-first 更符合 Vite 官方机制，兼容性和可解释性更好
- 兜底仍然保留，意味着不会为了“看起来更标准”而牺牲现有 Lit hydration 正确性

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — 未来实现时，所有验证都应由 agent / CI 直接执行。

### Test Decision
- **Infrastructure exists**: YES（Vitest + playground builds）
- **Automated tests**: tests-after + targeted regression fixtures
- **Framework**: Vitest / Vite build / playground build

### Verification Matrix
- **Module identity**: 关键 Lit 运行时依赖在 client / SSR 路径上是否只落到单一解析位置
- **Build behavior**: page mode 与 single-component mode 都能成功构建
- **Hydration behavior**: 客户端不应退化为粗暴重渲染或产生明显 hydration mismatch
- **Workspace behavior**: 对 linked package / monorepo 安装方式保持稳定
- **Fallback gate**: 只有当 config-first 失败场景被重现时，才允许恢复或新增特判逻辑

---

## Execution Strategy

### Parallel Execution Waves

```text
Wave 1A (串行):
└── Task 1: 建立现状基线与问题矩阵 [unspecified-high]

Wave 1B (并行):
├── Task 2: 设计 config-first 目标配置集合 [writing]
└── Task 3: 标出必须保留的兜底边界 [writing]

Wave 2 (并行):
├── Task 4: 先行实现/验证 dedupe + noExternal 原型 [unspecified-high]
└── Task 5: 补充 optimizeDeps / ssr.optimizeDeps 并做回归 [unspecified-high]

Wave FINAL (串行):
└── Task F1: 判断是否仍需要极窄 resolveId 兜底并完成文档更新 [deep]
```

### Dependency Matrix
- **1** blocks 2, 3, 4, 5, F1
- **2** blocks 4, 5, F1
- **3** blocks F1
- **4** blocks 5, F1
- **5** blocks F1

### Success Criteria by Phase
- **Phase 1**: 知道哪些 Lit 包真的需要单实例保障，哪些只是“看起来相关”
- **Phase 2**: 能用 config-first 解决主要场景，不回退到大范围硬编码
- **Phase 3**: 只把剩余失败 specifier 留给兜底逻辑，并留下可移除条件

---

## TODOs

> 这是后续实现计划，不代表当前文档任务已实施。

---

- [ ] 1. 建立当前依赖解析与 hydration 风险基线

  **What to do**:
  - 审计 `resolveHydrationDependency()` 当前覆盖的 specifier 列表
  - 列出它们分别对应的风险：单实例、externalization、子路径导出、还是仅为了路径可达
  - 为每个包写出“保留现状的理由”和“尝试 config-first 的理由”

  **Must NOT do**:
  - 不要在这一步修改行为
  - 不要把多个失败模式混成一个结论

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（与 Task 2/3 同波次）
  - **Blocks**: 2, 3, 4, 5, F1
  - **Blocked By**: None

  **Acceptance Criteria**:
  - [ ] 当前所有硬编码 specifier 均被枚举
  - [ ] 每个 specifier 都对应一个明确风险标签
  - [ ] 形成一份“可先尝试 config-first / 必须保留兜底待验证”的初始分类

  **QA Scenarios**:
  ```text
  Scenario: specifier 清单完整
    Tool: grep / read
    Expected Result: `resolveHydrationDependency()` 内所有分支均被提取并归类
  ```

  **Commit**: NO

---

- [ ] 2. 为本仓库设计 config-first 目标配置集合

  **What to do**:
  - 设计优先级：`resolve.dedupe` → `ssr.noExternal` → `optimizeDeps.include`
  - 给出首批候选包，并写出每个候选包进入该层的理由
  - 明确哪些项是 page mode / single-component mode 共用，哪些可能需要模式差异处理

  **Must NOT do**:
  - 不要直接默认“全部都加”
  - 不要把 fallback 逻辑混进 primary path

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（与 Task 1/3 同波次）
  - **Blocks**: 4, 5, F1
  - **Blocked By**: 1

  **Acceptance Criteria**:
  - [ ] 三层 config-first 顺序被明确写死
  - [ ] 每个候选包都有证据化理由
  - [ ] 没有把 `resolveId` 白名单当成 primary path

  **QA Scenarios**:
  ```text
  Scenario: 目标配置集合清晰
    Tool: read
    Expected Result: 文档中能直接映射出 dedupe / noExternal / optimize 三层职责
  ```

  **Commit**: NO

---

- [ ] 3. 定义兜底逻辑的触发条件与收缩边界

  **What to do**:
  - 明确什么叫 config-first 失败
  - 规定何时允许保留/新增 `resolveId` 级特判
  - 为每个特判定义未来移除条件
  - 为每个候选 fallback 项填写统一表格：`specifier`、`importer`、`复现 fixture`、`失败信号`、`已尝试的 config-first 手段`、`保留/移除决定`、`移除条件`

  **Must NOT do**:
  - 不要把“有风险”当成失败证据
  - 不要给无限期保留兜底开口子

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（与 Task 1/2 同波次）
  - **Blocks**: F1
  - **Blocked By**: 1

  **Acceptance Criteria**:
  - [ ] 失败判据可执行、可复现
  - [ ] 兜底范围要求为最小 specifier 集合
  - [ ] 每项兜底都带有未来移除条件

  **QA Scenarios**:
  ```text
  Scenario: 兜底门槛明确
    Tool: read
    Expected Result: 文档明确区分 primary path 与 last-resort fallback，且每个 fallback 都能落到 `specifier/importer/失败信号/移除条件` 四类关键信息
  ```

  **Commit**: NO

---

- [ ] 4. 以 config-first 方式做最小可行原型

  **What to do**:
  - 先只实现 `resolve.dedupe` 和最小 `ssr.noExternal`
  - 在 page mode、single-component mode、playground 构建中验证行为
  - 记录哪些硬编码分支因此可以删除、哪些还不能动

  **Must NOT do**:
  - 不要同时改动太多层，避免无法归因
  - 不要在原型阶段一次性删除全部兜底

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: 5, F1
  - **Blocked By**: 1, 2

  **Acceptance Criteria**:
  - [ ] 原型能覆盖主要 happy path
  - [ ] 行为差异可归因到 dedupe / noExternal
  - [ ] 至少能识别一批可收缩的硬编码分支

  **QA Scenarios**:
  ```text
  Scenario: 原型不破坏现有构建
    Tool: Bash
    Steps:
      1. 在仓库根目录运行 `pnpm test`
      2. 在仓库根目录运行 `pnpm build`
      3. 在仓库根目录运行 `pnpm playground:build`
      4. 在仓库根目录运行 `pnpm --filter single-component-fixture build`
    Expected Result: 四条命令均退出码 0；page mode 与 single-component mode 均无新增 hydration / build 回归
  ```

  **Commit**: NO

---

- [ ] 5. 补齐 optimizeDeps / ssr.optimizeDeps 并做回归验证

  **What to do**:
  - 只对仍然失败的包加 `optimizeDeps.include` / `ssr.optimizeDeps`
  - 把每个新增项与具体失败案例绑定
  - 回归 monorepo / linked package / subpath import 场景

  **Must NOT do**:
  - 不要把 optimizeDeps 当成万能修复器
  - 不要加入没有失败证据支撑的依赖

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: F1
  - **Blocked By**: 1, 2, 4

  **Acceptance Criteria**:
  - [ ] 每项 optimize 配置都能对应失败样例
  - [ ] 没有出现与目标无关的依赖膨胀
  - [ ] config-first 覆盖率进一步提升

  **QA Scenarios**:
  ```text
  Scenario: optimizeDeps 是定向补强而非大水漫灌
    Tool: Bash + Read
    Steps:
      1. 读取修改后的 Vite/plugin 配置，确认每个 `optimizeDeps.include` / `ssr.optimizeDeps` 项都对应已记录失败案例
      2. 在仓库根目录运行 `pnpm test`
      3. 在仓库根目录运行 `pnpm build`
      4. 在仓库根目录运行 `pnpm playground:build`
      5. 在仓库根目录运行 `pnpm --filter single-component-fixture build:none`
      6. 在仓库根目录运行 `pnpm --filter single-component-fixture build:entry-only`
    Expected Result: 所有命令退出码 0；新增 optimize 项数量可解释，并与失败样例一一对应
  ```

  **Commit**: NO

---

- [ ] F1. 决定最终是否保留极窄 `resolveId` 兜底并更新文档

  **What to do**:
  - 汇总前面各阶段结果
  - 仅保留 config-first 明确无法覆盖的 specifier
  - 把“为什么仍需兜底”与“何时可移除”写入文档和代码注释策略

  **Must NOT do**:
  - 不要为了稳妥而保留大范围旧逻辑
  - 不要在没有失败证据时维持历史包清单

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: None
  - **Blocked By**: 1, 2, 3, 4, 5

  **Acceptance Criteria**:
  - [ ] 最终 primary path 仍然是 config-first
  - [ ] 剩余兜底范围比当前方案更窄且更可解释
  - [ ] 文档明确记录保留理由与移除条件

  **QA Scenarios**:
  ```text
  Scenario: 最终策略收敛完成
    Tool: Bash + Read
    Steps:
      1. 读取最终文档/实现，核对 remaining fallback 表格是否只覆盖残余失败 specifier
      2. 运行 `pnpm test`
      3. 运行 `pnpm build`
      4. 运行 `pnpm playground:build`
      5. 运行 `pnpm --filter single-component-fixture build`
      6. 如仍保留 `resolveId` 兜底，逐项核对其 `specifier`、失败信号、移除条件是否与文档一致
    Expected Result: 文档、实现、验证结果三者一致；最终 primary path 仍为 config-first，兜底只覆盖残余失败点
  ```

  **Commit**: YES
  - Message: `docs: add ssr dependency normalization plan`

---

## Notes for Future Execution

- 这份文档的目标是**收敛策略**，不是立刻否定当前 Lit 定向解析。
- 如果未来验证表明 Lit 的某些子路径天然不适合完全 config-first，则允许保留少量特判，但必须从“默认路径”降为“证据驱动兜底”。
- 任何实现都必须先验证 page mode 与 single-component mode，再考虑进一步清理旧逻辑。
