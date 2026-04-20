---
name: code-worktree-guard
description: "enforce a strict engineering workflow whenever the user starts coding, asks to write or modify code, requests an implementation, bug fix, refactor, test update, or shares code for edits. use for coding tasks that should begin in a git worktree and end with scoped verification, a concise change summary, and one conventional atomic commit. require: never work directly in the main checkout, always create or switch to a worktree before editing, run tests or linters for the changed scope, do not commit if verification fails, and use conventional commit style."
---
# Code Worktree Guard（代码工作树守卫）

为仓库变更强制执行一套**不可跳过的编码工作流程**。

将此技能视为一种**强约束（guardrail）**，而不是建议。一旦启用，ChatGPT 在当前任务中所有代码编辑工作都必须遵循以下流程。

---

## 启用规则

当用户提出以下请求时，必须**立即进入该工作流程**，再进行任何代码修改：

* 编写代码
* 修改代码
* 实现功能
* 修复 bug
* 重构代码
* 添加或更新测试
* 调整与代码相关的配置
* 粘贴代码并期望进行修改

即使只是**小改动或单文件补丁**，也必须应用相同流程，不能因为请求看起来简单而跳过步骤。

---

## 核心规则

1. **始终在 Git worktree（工作树）中操作**，禁止直接在主检出（main checkout）中编辑。
2. 修改文件前，必须确认当前目录是否已经是该任务对应的 worktree。
3. 如果没有合适的 worktree，必须先创建或切换到一个。
4. 完成代码修改后，必须对变更范围进行验证（测试 / lint / 类型检查等）。
5. 如果验证失败，**禁止提交（commit）**。
6. 如果验证成功，总结变更并创建**且仅创建一个原子提交（atomic commit）**。
7. 提交信息必须使用**Conventional Commit 规范**。

---

## 必须遵循的工作流程

按顺序执行以下步骤：

---

### 1. 建立 worktree

* 修改前检查 Git 状态
* 确认当前目录是否为适用于该任务的非主 worktree
* 如果不是，则创建或切换到专用 worktree
* 所有操作（修改 / 测试 / 提交）必须在该 worktree 内完成

⚠️ 在满足上述条件之前，不得进行任何代码修改。

---

### 2. 实现代码变更

* 仅实现任务所需的修改
* 优先做**最小范围变更**
* 避免无关的代码清理（除非用户明确要求或必须）

---

### 3. 验证变更范围

执行最小但有效的验证，例如：

* 针对性单元测试
* 包级测试
* 受影响的 lint 检查
* 受影响的格式检查
* 受影响的类型检查
* 必要时进行构建或编译检查

优先进行**变更范围验证**，除非项目或任务要求全量验证。

---

### 4. 处理验证失败

如果任何验证失败：

* 清晰报告失败情况
* **不要提交代码**
* 说明失败原因
* 尽量指出可能的原因及相关文件或命令

---

### 5. 准备提交

如果验证成功：

* 检查 diff，确保变更范围合理
* 简要总结变更内容
* 创建**一个原子提交**

📌 原子提交：表示一个完整、可独立理解和回滚的变更。

除非用户明确要求，否则不要拆分为多个提交。

### 6. 合并并清理 worktree

如果验证成功且已完成原子提交，还必须执行收尾流程：

将 worktree 中的提交合并回目标分支
确认合并成功
删除该任务使用的 worktree
保持主分支工作区整洁，不遗留临时 worktree
具体要求
合并前，先确认 worktree 中的提交已经完成并且验证通过
合并时，优先使用能保持历史清晰的方式，并遵循仓库既有流程
合并完成后，删除该任务对应的 worktree
如果 worktree 已不再需要，不应长期保留
如果环境或权限限制导致无法执行合并或删除，必须明确说明

---

## 提交规范（Commit Rules）

使用 **Conventional Commit** 格式：

常见类型：

* `feat:` 新功能
* `fix:` 修复
* `refactor:` 重构
* `test:` 测试相关
* `chore:` 杂项
* `build:` 构建相关
* `ci:` CI 配置
* `docs:` 文档

要求：

* 选择最精确的类型
* 描述简洁明确

示例：

* `fix: handle empty state in billing summary`
* `feat: add retry logic for webhook delivery`
* `test: cover invalid token refresh path`
* `refactor: extract workspace path resolver`

---

## 使用本技能时的响应要求

在完成编码任务时，应包含以下信息：

1. 是否使用或创建了 worktree
2. 修改了什么内容
3. 执行了哪些验证
4. 验证是否通过
5. 提交信息（如果已提交）
6. 是否已合并回目标分支
7. 是否已删除 worktree

如果因为环境限制无法合并或删除，也要明确写出。

---

## 默认决策规则

* 若项目同时有测试和 lint，应尽量执行两者中与变更相关的检查
* 若没有明确的局部验证方式，应执行最小范围的项目验证，并说明限制
* 若环境不支持提交：

  * 仍需提供完整的 commit message
  * 明确说明未能实际提交
* 若环境不支持创建 worktree：

  * 必须停止操作并报告问题
  * 不得在主分支直接修改代码

---

## 禁止行为

* ❌ 在主检出（main checkout）中直接修改代码
* ❌ 修改后跳过验证
* ❌ 在测试 / lint / 构建 / 类型检查失败后仍提交
* ❌ 对单一变更创建多个提交（除非用户明确要求）
* ❌ 使用模糊提交信息（如 `update code`、`fix stuff`）
