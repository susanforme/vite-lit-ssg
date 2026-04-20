# Worktree Review / Save / Merge Plan for Lit Static Styles Proposal

## TL;DR
> **Summary**: Create a fresh topic worktree off the current `dev` tip, review and harden the previously proposed Lit external stylesheet design into a decision-complete design artifact, then land that docs-only artifact back onto `dev` with a fast-forward merge only after the dirty root checkout issue is resolved.
> **Deliverables**:
> - Dedicated worktree on a topic branch for this task only
> - Reviewed design document at `.sisyphus/plans/lit-static-styles-transform.md`
> - Evidence files proving scope remained docs-only and merge is ready
> - One atomic docs commit and ff-only merge handoff back to `dev`
> **Effort**: Short
> **Parallel**: NO
> **Critical Path**: 1 → 2 → 3 → 4 → 5 → 6 → F1-F4

## Context
### Original Request
- 建立一个新的 worktree
- 对上方 Lit 外部 CSS/LESS/SCSS 注入方案做仔细审查和优化
- 将优化后的方案保存到仓库中
- 最终合并回当前分支

### Interview Summary
- The current primary checkout is on `dev` and is dirty, so execution must not happen there.
- There is already an existing linked worktree at `.worktrees/fix-dev-syntax` on `fix/dev-syntax-error`; this task must not reuse or disturb it.
- The reviewed technical direction is already known: Vite source transform in `packages/vite-plugin-lit-ssg/src/plugin/index.ts`, Vite-processed stylesheet text via `?inline`, Lit `css\`${unsafeCSS(...)}\``, and deterministic normalization of Lit `static styles`.
- The user asked to review/save/merge the proposal, not to implement the feature code in this pass.

### Metis Review (gaps addressed)
- Constrain scope to a **docs-only design review artifact**; do not broaden into implementation during this task.
- Make the reviewed design explicit about supported syntax, unsupported syntax, failure behavior, and preprocessor validation assumptions.
- Preserve repo workflow: dedicated worktree, scoped verification, one atomic conventional commit, review gate before merge.
- Add an explicit merge blocker for the dirty root `dev` checkout; do not auto-stash or mutate unrelated local changes.

## Work Objectives
### Core Objective
Produce a decision-complete reviewed design artifact for the Lit static-styles feature inside a fresh worktree, save it in `.sisyphus/plans/`, and prepare a safe fast-forward merge back to `dev` without touching unrelated dirty changes in the primary checkout.

### Deliverables
- `.sisyphus/plans/lit-static-styles-transform.md` with reviewed architecture, syntax matrix, failure modes, verification matrix, and implementation roadmap.
- `.sisyphus/evidence/` artifacts showing worktree isolation, docs-only diff scope, and merge readiness.
- One docs-only commit on a dedicated topic branch.
- A fast-forward merge procedure back to `dev` that explicitly handles the dirty-root blocker.

### Definition of Done (verifiable conditions with commands)
- `git worktree list` includes a new dedicated path for this task and does not modify `.worktrees/fix-dev-syntax`.
- `test -f .sisyphus/plans/lit-static-styles-transform.md` succeeds inside the task worktree.
- `git diff --name-only dev...HEAD` lists only `.sisyphus/plans/lit-static-styles-transform.md` and optional `.sisyphus/evidence/*` artifacts.
- `git log -1 --pretty=%s` matches `docs: review lit static styles transform plan` (or equivalent conventional docs commit).
- `[DECISION NEEDED: root dev checkout must be made clean or moved off branch before the final ff-only merge can execute safely.]`

### Must Have
- Fresh dedicated worktree from current `dev` tip.
- Docs-only scope.
- Reviewed design document with:
  - recommended integration point
  - supported syntax matrix
  - unsupported syntax matrix
  - failure behavior / bailout rules
  - CSS vs LESS/SCSS validation policy
  - exact future implementation and verification commands
- One atomic conventional docs commit.
- ff-only merge back to `dev` after approval and after the dirty-root blocker is resolved.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No edits in the primary checkout at `/Users/sz-20250303-003/code/vite-lit-ssg`.
- No code implementation in `packages/vite-plugin-lit-ssg/src/**` during this task.
- No reuse or mutation of `.worktrees/fix-dev-syntax`.
- No merge commit.
- No auto-stash, auto-reset, or any destructive handling of the unrelated dirty files in the root checkout.
- No claims of verified LESS/SCSS support unless the reviewed document explicitly marks them as contingent on future dependency+fixture coverage.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: none for repo runtime/code behavior in this pass; this is a docs-only review artifact.
- QA policy: every task verifies file existence, diff scope, content completeness, or git state using agent-executable commands.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> This task is intentionally serial because each step depends on the reviewed document from the previous one.

Wave 1: worktree isolation, artifact creation, review expansion, verification matrix, self-audit, merge preparation

### Dependency Matrix (full, all tasks)
- 1 blocks 2, 3, 4, 5, 6
- 2 blocks 3, 4, 5, 6
- 3 blocks 4, 5, 6
- 4 blocks 5, 6
- 5 blocks 6
- 6 blocks F1-F4

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 6 tasks → `quick`, `writing`, `unspecified-low`
- Final Verification Wave → 4 review tasks → `oracle`, `unspecified-high`, `deep`

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [ ] 1. Establish isolated review worktree and topic branch

  **What to do**: From the repository root, inspect git state, then create a new dedicated worktree from the current `dev` tip using branch name `feat/lit-static-styles-design` and worktree path `.worktrees/feat-lit-static-styles-design`. Perform all subsequent file edits, reads, evidence capture, commit work, and merge-prep inside that worktree only.
  **Must NOT do**: Do not edit or clean the primary checkout; do not reuse `.worktrees/fix-dev-syntax`; do not create the new worktree on `dev` directly.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: isolated git/worktree setup with clear boundaries.
  - Skills: [`code-worktree-guard`, `git-master`] - enforce worktree-only workflow and safe git sequencing.
  - Omitted: [`context7-mcp`] - no external API uncertainty in this setup step.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 2, 3, 4, 5, 6 | Blocked By: none

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `/Users/sz-20250303-003/code/vite-lit-ssg/.claude/skills/code-worktree-guard/SKILL.md:18-26` - worktree is mandatory before any edit, with scoped verification and one atomic commit.
  - Pattern: `/Users/sz-20250303-003/code/vite-lit-ssg/.claude/skills/code-worktree-guard/SKILL.md:32-39` - establish/switch to a dedicated worktree before editing.
  - Pattern: existing linked worktree observed at `/Users/sz-20250303-003/code/vite-lit-ssg/.worktrees/fix-dev-syntax` on branch `fix/dev-syntax-error` - avoid collision with this active task area.
  - Risk Source: root checkout git status currently shows dirty files on `dev` - do not operate in the primary checkout.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `git worktree list` shows `.worktrees/feat-lit-static-styles-design` on branch `feat/lit-static-styles-design`.
  - [ ] `git status --short --branch` inside the new worktree starts clean before document edits.
  - [ ] The pre-existing `.worktrees/fix-dev-syntax` entry remains untouched.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Dedicated worktree exists and is isolated
    Tool: Bash
    Steps: Run `git worktree list > .sisyphus/evidence/task-1-worktree-list.txt 2>&1` from the repo root after creation.
    Expected: Evidence contains both `.worktrees/fix-dev-syntax` and `.worktrees/feat-lit-static-styles-design`; new worktree is on `feat/lit-static-styles-design`.
    Evidence: .sisyphus/evidence/task-1-worktree-list.txt

  Scenario: New worktree starts from clean topic branch
    Tool: Bash
    Steps: Run `git status --short --branch > .sisyphus/evidence/task-1-worktree-status.txt 2>&1` inside `.worktrees/feat-lit-static-styles-design` before edits.
    Expected: Evidence shows branch `feat/lit-static-styles-design` with no modified tracked files.
    Evidence: .sisyphus/evidence/task-1-worktree-status.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `n/a`

- [ ] 2. Create the reviewed design artifact skeleton

  **What to do**: In the new worktree, create `.sisyphus/plans/lit-static-styles-transform.md` and move the previously proposed idea into a formal design artifact. Include sections for context, recommended integration point, syntax coverage, unsupported cases, failure rules, future implementation roadmap, verification matrix, and merge handoff.
  **Must NOT do**: Do not edit code files; do not leave the design as an unstructured note; do not store it outside `.sisyphus/plans/`.

  **Recommended Agent Profile**:
  - Category: `writing` - Reason: this is a structured design-review artifact.
  - Skills: [] - repo evidence is sufficient.
  - Omitted: [`git-master`] - no git mutation needed in this content-authoring step.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 3, 4, 5, 6 | Blocked By: 1

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `/Users/sz-20250303-003/code/vite-lit-ssg/.sisyphus/plans/single-component-mode.md:127-146` - plan artifacts in this repo use explicit acceptance criteria and QA scenarios.
  - Pattern: `/Users/sz-20250303-003/code/vite-lit-ssg/.sisyphus/plans/lit-hydration.md:525-541` - verification sections in repo plans use exact executable commands and named evidence files.
  - Pattern: `/Users/sz-20250303-003/code/vite-lit-ssg/README.md` - user-facing repo context and mode distinctions that the reviewed design must respect.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `.sisyphus/plans/lit-static-styles-transform.md` exists.
  - [ ] The document contains top-level sections for `Supported Syntax`, `Unsupported Syntax`, `Failure Modes`, `Verification`, and `Merge Handoff`.
  - [ ] The document is the only new tracked artifact under `.sisyphus/plans/` for this task.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Reviewed design artifact exists with required headers
    Tool: Bash
    Steps: Run `grep -nE '^## (Supported Syntax|Unsupported Syntax|Failure Modes|Verification|Merge Handoff)$' .sisyphus/plans/lit-static-styles-transform.md > .sisyphus/evidence/task-2-required-headings.txt 2>&1`
    Expected: Evidence lists all five required section headers.
    Evidence: .sisyphus/evidence/task-2-required-headings.txt

  Scenario: Artifact path is scoped correctly
    Tool: Bash
    Steps: Run `git diff --name-only > .sisyphus/evidence/task-2-diff-scope.txt 2>&1` inside the worktree.
    Expected: Evidence includes `.sisyphus/plans/lit-static-styles-transform.md` and excludes source-code paths.
    Evidence: .sisyphus/evidence/task-2-diff-scope.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `n/a`

- [ ] 3. Convert the proposal into a decision-complete technical review

  **What to do**: Expand the artifact so it no longer contains open implementation ambiguity. Lock in the recommended integration point (`packages/vite-plugin-lit-ssg/src/plugin/index.ts` Vite transform), the Vite stylesheet-text path (`?inline`), the Lit wrapper (`css\`${unsafeCSS(...)}\``), the three requested style normalization cases, support for `static get styles()` as an explicitly reviewed extension, and explicit bailout/error behavior for unsupported AST shapes.
  **Must NOT do**: Do not leave “maybe”, “optional”, or “one possible approach” wording; do not claim verified preprocessor support beyond what the document marks as contingent.

  **Recommended Agent Profile**:
  - Category: `writing` - Reason: this is architecture hardening and ambiguity removal.
  - Skills: [`context7-mcp`] - preserve doc-backed Lit/Vite constraints in the reviewed artifact.
  - Omitted: [`git-master`] - still a document-content task.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 4, 5, 6 | Blocked By: 2

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `/Users/sz-20250303-003/code/vite-lit-ssg/packages/vite-plugin-lit-ssg/src/plugin/index.ts:47-97` - shared plugin setup/config path where a future transform would belong.
  - Pattern: `/Users/sz-20250303-003/code/vite-lit-ssg/packages/vite-plugin-lit-ssg/src/plugin/index.ts:325-403` - existing `resolveId()`/`load()` virtual-module structure that the reviewed design must not confuse with the recommended transform layer.
  - Pattern: `/Users/sz-20250303-003/code/vite-lit-ssg/packages/vite-plugin-lit-ssg/src/runner/build.ts:70-145` - page mode performs separate client and SSR builds, so shared transform placement matters.
  - Pattern: `/Users/sz-20250303-003/code/vite-lit-ssg/packages/vite-plugin-lit-ssg/src/runner/build-single.ts:27-94` - single-component mode also performs separate client and SSR builds and must see the same source rewrite.
  - Pattern: `/Users/sz-20250303-003/code/vite-lit-ssg/packages/vite-plugin-lit-ssg/src/virtual/client-entry.ts:3-10` - virtual entries are wrappers, not the correct place to normalize component internals.
  - Pattern: `/Users/sz-20250303-003/code/vite-lit-ssg/packages/vite-plugin-lit-ssg/src/virtual/single-server-entry.ts:4-24` - SSR entry imports component modules after transform time, reinforcing why the design must act earlier.

  **Acceptance Criteria** (agent-executable only):
  - [ ] The reviewed design explicitly states one recommended integration point and rejects render-time or post-definition mutation strategies.
  - [ ] The reviewed design documents the three requested normalization cases plus the `static get styles()` extension.
  - [ ] The reviewed design lists unsupported syntax and defines fail-closed behavior for ambiguous imports/usages.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Technical decision sections are explicit
    Tool: Bash
    Steps: Run `grep -nE 'recommended integration point|\?inline|unsafeCSS|static get styles|fail-closed|unsupported' .sisyphus/plans/lit-static-styles-transform.md > .sisyphus/evidence/task-3-technical-decisions.txt 2>&1`
    Expected: Evidence shows all required decision anchors present in the reviewed design.
    Evidence: .sisyphus/evidence/task-3-technical-decisions.txt

  Scenario: Design aligns with shared client+SSR build reality
    Tool: Bash
    Steps: Run `grep -nE 'page mode|single-component mode|shared transform|client and SSR' .sisyphus/plans/lit-static-styles-transform.md > .sisyphus/evidence/task-3-mode-coverage.txt 2>&1`
    Expected: Evidence confirms both existing plugin modes are addressed and no single-mode shortcut is proposed.
    Evidence: .sisyphus/evidence/task-3-mode-coverage.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `n/a`

- [ ] 4. Add executable verification and future implementation matrix

  **What to do**: Add a future-facing execution section to the reviewed design that tells the eventual implementer exactly what to build and how to verify it. Include syntax inventory, test fixture expectations, doc-backed preprocessor policy, exact future commands (`pnpm typecheck`, `pnpm test`, `pnpm build`, plus package-scoped commands), and a matrix separating docs-only review acceptance from later implementation acceptance.
  **Must NOT do**: Do not pretend the current task already validated runtime behavior; do not omit the difference between this docs-only pass and future code-implementation verification.

  **Recommended Agent Profile**:
  - Category: `writing` - Reason: this task converts research into executable downstream instructions.
  - Skills: [] - repo commands are already known.
  - Omitted: [`context7-mcp`] - no new library ambiguity beyond already-reviewed constraints.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 5, 6 | Blocked By: 3

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `/Users/sz-20250303-003/code/vite-lit-ssg/package.json:6-13` - root verification entrypoints (`build`, `typecheck`, `test`, playground build).
  - Pattern: `/Users/sz-20250303-003/code/vite-lit-ssg/packages/vite-plugin-lit-ssg/package.json:22-27` - package-level `build`, `typecheck`, and `lint` commands.
  - Pattern: `/Users/sz-20250303-003/code/vite-lit-ssg/packages/vite-plugin-lit-ssg-tests/integration/dev-single-component.test.ts:13-25` - existing dev-server test harness proves the repo can verify dev-mode behavior.
  - Pattern: `/Users/sz-20250303-003/code/vite-lit-ssg/packages/vite-plugin-lit-ssg-tests/integration/ssg-single-component.test.ts:12-19` - existing build/integration harness proves the repo can verify generated output.
  - Pattern: `/Users/sz-20250303-003/code/vite-lit-ssg/.sisyphus/plans/lit-hydration.md:525-541` - exact command + evidence-file style to emulate.

  **Acceptance Criteria** (agent-executable only):
  - [ ] The reviewed design distinguishes current-task verification from future implementation verification.
  - [ ] The reviewed design includes exact future commands for package-scoped and repo-level verification.
  - [ ] The reviewed design includes explicit evidence file conventions under `.sisyphus/evidence/`.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Verification matrix includes exact commands
    Tool: Bash
    Steps: Run `grep -nE 'pnpm (typecheck|test|build)|--filter vite-plugin-lit-ssg|--filter vite-plugin-lit-ssg-tests' .sisyphus/plans/lit-static-styles-transform.md > .sisyphus/evidence/task-4-verification-matrix.txt 2>&1`
    Expected: Evidence shows exact future verification commands, not vague prose.
    Evidence: .sisyphus/evidence/task-4-verification-matrix.txt

  Scenario: Evidence naming convention is specified
    Tool: Bash
    Steps: Run `grep -n '.sisyphus/evidence/' .sisyphus/plans/lit-static-styles-transform.md > .sisyphus/evidence/task-4-evidence-convention.txt 2>&1`
    Expected: Evidence confirms the reviewed design prescribes evidence capture paths.
    Evidence: .sisyphus/evidence/task-4-evidence-convention.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `n/a`

- [ ] 5. Self-audit the reviewed artifact against repo constraints

  **What to do**: Re-read the completed design artifact and remove any statement that implies code was implemented, runtime behavior was already validated, or preprocessors are already proven in this workspace. Verify the artifact is docs-only, repo-specific, and merge-ready. Ensure references point to real repo files and that the final artifact is decision-complete.
  **Must NOT do**: Do not leave speculative line-item claims without repo backing; do not broaden the scope into source edits.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: structured self-audit against explicit criteria.
  - Skills: [] - repo evidence and the created document are sufficient.
  - Omitted: [`git-master`] - no git mutation yet.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 6 | Blocked By: 4

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `/Users/sz-20250303-003/code/vite-lit-ssg/.claude/skills/code-worktree-guard/SKILL.md:47-58` - changed-scope verification should match the scope of actual changes.
  - Pattern: `/Users/sz-20250303-003/code/vite-lit-ssg/README.md` - current repo behavior/constraints that the reviewed artifact must not contradict.
  - Pattern: `/Users/sz-20250303-003/code/vite-lit-ssg/ROADMAP.md` - repo boundaries and unsupported areas to avoid claiming.

  **Acceptance Criteria** (agent-executable only):
  - [ ] No code files outside `.sisyphus/` are modified in the worktree.
  - [ ] The reviewed artifact contains no claim that LESS/SCSS are already validated unless accompanied by an explicit contingent condition.
  - [ ] All cited repo paths in the artifact resolve to real files.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Diff scope remains docs-only
    Tool: Bash
    Steps: Run `git diff --name-only > .sisyphus/evidence/task-5-docs-only-diff.txt 2>&1` inside the worktree.
    Expected: Evidence contains only `.sisyphus/plans/lit-static-styles-transform.md` and optional `.sisyphus/evidence/*` files.
    Evidence: .sisyphus/evidence/task-5-docs-only-diff.txt

  Scenario: Referenced paths resolve
    Tool: Bash
    Steps: Run `grep -oE '/Users/[^` ]+' .sisyphus/plans/lit-static-styles-transform.md | while read p; do test -e "$p" || echo "$p"; done > .sisyphus/evidence/task-5-missing-paths.txt 2>&1`
    Expected: Evidence file is empty.
    Evidence: .sisyphus/evidence/task-5-missing-paths.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `n/a`

- [ ] 6. Commit reviewed artifact and prepare safe merge handoff

  **What to do**: Stage only the reviewed design artifact (and any intentionally retained evidence files if the repo wants them committed; otherwise keep evidence untracked), create one atomic docs commit in the worktree, and prepare an ff-only merge handoff back to `dev`. Record the exact merge blocker caused by the dirty root `dev` checkout and stop before the final merge unless a clean integration checkout is available.
  **Must NOT do**: Do not merge from the dirty primary checkout; do not auto-stash or rewrite unrelated changes; do not create a merge commit.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: narrow git sequencing once the docs artifact is final.
  - Skills: [`code-worktree-guard`, `git-master`] - enforce one atomic commit and safe ff-only merge prep.
  - Omitted: [`context7-mcp`] - no external API uncertainty here.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: F1, F2, F3, F4 | Blocked By: 5

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `/Users/sz-20250303-003/code/vite-lit-ssg/.claude/skills/code-worktree-guard/SKILL.md:69-79` - review diff, summarize changes, create one atomic commit only.
  - Pattern: `/Users/sz-20250303-003/code/vite-lit-ssg/.claude/skills/code-worktree-guard/SKILL.md:81-103` - use conventional commit style, with `docs:` as the narrow type for this task.
  - Pattern: `/Users/sz-20250303-003/code/vite-lit-ssg/.sisyphus/plans/single-component-mode.md:127-146` - repo plan style expects explicit acceptance criteria and evidence-backed QA before finalization.
  - Risk Source: root checkout currently has unrelated dirty files on `dev`; checked-out branch cannot be safely fast-forwarded elsewhere without resolving that state first.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `git log -1 --pretty=%s` in the topic worktree shows a conventional docs commit for the reviewed artifact.
  - [ ] `git diff --name-only dev...HEAD` shows only the reviewed artifact (and intentionally committed evidence if explicitly chosen).
  - [ ] Merge procedure is documented as `ff-only` and explicitly blocked pending a clean `dev` checkout.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Atomic docs commit exists on the topic branch
    Tool: Bash
    Steps: Run `git log -1 --pretty=fuller > .sisyphus/evidence/task-6-last-commit.txt 2>&1` inside the worktree.
    Expected: Evidence shows one latest conventional docs commit for the reviewed artifact.
    Evidence: .sisyphus/evidence/task-6-last-commit.txt

  Scenario: Merge handoff is ff-only and blocked safely
    Tool: Bash
    Steps: Run `printf '%s\n' 'Root dev checkout is dirty; do not merge until a clean integration checkout is available.' > .sisyphus/evidence/task-6-merge-blocker.txt && git diff --name-only dev...HEAD >> .sisyphus/evidence/task-6-merge-blocker.txt 2>&1`
    Expected: Evidence documents the blocker and the topic branch diff scope for the future ff-only merge.
    Evidence: .sisyphus/evidence/task-6-merge-blocker.txt
  ```

  **Commit**: YES | Message: `docs: review lit static styles transform plan` | Files: `.sisyphus/plans/lit-static-styles-transform.md`

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Document Quality Review — unspecified-high
- [ ] F3. Docs-Only Scope QA — unspecified-high
- [ ] F4. Merge Safety Check — deep

## Commit Strategy
- Single atomic commit only: `docs: review lit static styles transform plan`
- Commit only after Task 5 self-audit passes.
- Do not commit evidence files unless the executing agent explicitly decides they belong in history; default is artifact-only commit.
- Merge strategy: fast-forward only from `feat/lit-static-styles-design` back to `dev` after explicit approval and after the root-checkout blocker is cleared.

## Success Criteria
- A new isolated worktree exists for this task.
- The reviewed design artifact is saved in `.sisyphus/plans/lit-static-styles-transform.md`.
- The artifact is decision-complete, repo-specific, and explicit about supported/unsupported syntax and failure behavior.
- The branch diff remains docs-only.
- One conventional docs commit exists on the topic branch.
- `[DECISION NEEDED: before final ff-only merge, choose how to free the checked-out dirty root branch `dev` without mutating or losing its unrelated local changes.]`
