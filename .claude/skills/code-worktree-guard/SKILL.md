---
name: code-worktree-guard
description: "enforce a strict engineering workflow whenever the user starts coding, asks to write or modify code, requests an implementation, bug fix, refactor, test update, or shares code for edits. use for coding tasks that should begin in a git worktree and end with scoped verification, a concise change summary, and one conventional atomic commit. require: never work directly in the main checkout, always create or switch to a worktree before editing, run tests or linters for the changed scope, do not commit if verification fails, and use conventional commit style."
---

# Code Worktree Guard

Enforce a non-optional coding workflow for repository changes.

Treat this skill as a guardrail, not a suggestion. Once it is active, ChatGPT must follow the workflow below for all code-editing work in the current task.

## Activation rule

When the user asks to write code, modify code, implement a feature, fix a bug, refactor, add or update tests, adjust configuration tied to code, or pastes code expecting edits, immediately enter this workflow before making changes.

Apply the same workflow to small changes and one-file patches. Do not skip steps just because the request looks minor.

## Core rules

1. Always work in a Git worktree. Never edit directly in the main checkout.
2. Before changing files, verify whether the current directory is already an active worktree for the task.
3. If there is no suitable active worktree, create one or switch to one before editing.
4. After code changes, run verification for the modified scope. Prefer targeted tests, linters, or type checks that cover the changed area.
5. If verification fails, do not commit.
6. If verification succeeds, summarize the change set and create exactly one atomic commit.
7. Use conventional commit style for the commit message.

## Required workflow

Follow these steps in order.

### 1. Establish the worktree

- Inspect the Git state before editing.
- Confirm whether the current location is already a non-primary worktree suitable for the task.
- If not, create or switch to a dedicated worktree.
- Keep all file edits, test runs, and commit operations inside that worktree.

Do not proceed with code edits until this is satisfied.

### 2. Implement the requested code change

- Make only the changes required for the task.
- Prefer minimal, scoped edits.
- Avoid unrelated cleanup unless the user explicitly requests it or it is necessary to make the change work.

### 3. Verify the changed scope

Run the smallest meaningful validation that gives confidence in the modified area, such as:

- targeted unit tests
- package-level tests
- affected linter checks
- affected formatter check
- affected type checks
- build or compile checks when required by the change

Prefer changed-scope verification over full-repository verification unless the repo tooling or the task makes broader validation necessary.

### 4. Handle verification failure

If any required verification fails:

- report the failure clearly
- do not create a commit
- keep the response focused on what failed and why
- if possible, include the likely cause and the file or command involved

### 5. Prepare the commit

If verification succeeds:

- review the diff for scope control
- summarize the changes concisely
- create one atomic commit only

An atomic commit means the commit should represent one coherent change that can be understood and reverted independently.

Do not split into multiple commits unless the user explicitly asks for that.

## Commit rules

Use conventional commit style.

Preferred formats:

- `feat: ...`
- `fix: ...`
- `refactor: ...`
- `test: ...`
- `chore: ...`
- `build: ...`
- `ci: ...`
- `docs: ...`

Choose the narrowest accurate type. Keep the subject line specific and concise.

Examples:

- `fix: handle empty state in billing summary`
- `feat: add retry logic for webhook delivery`
- `test: cover invalid token refresh path`
- `refactor: extract workspace path resolver`

## Response requirements while using this skill

When reporting completion of a coding task, include these items when applicable:

1. whether a worktree was used or created
2. what changed
3. what verification was run
4. whether verification passed
5. the commit message, if a commit was created

If verification failed, explicitly state that no commit was created.

## Decision defaults

- If the repository has both tests and linters, run the most relevant changed-scope checks from both categories when practical.
- If there is no obvious targeted check, run the narrowest available project validation command and explain the limitation.
- If the environment prevents commit creation, still prepare the exact conventional commit message that should be used, and clearly say the commit could not be executed.
- If the environment prevents worktree creation, stop and report that limitation instead of editing in the main checkout.

## What not to do

- Do not edit code in the primary checkout.
- Do not skip verification after making code changes.
- Do not commit after a failed test, lint, build, or type check that is relevant to the changed scope.
- Do not create multiple commits for a single requested change unless the user asks for that explicitly.
- Do not use vague commit messages like `update code` or `fix stuff`.
