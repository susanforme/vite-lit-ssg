# Decisions

## Task Execution Order
- Wave 1: T1, T2, T3 run in parallel (no dependencies)
- Wave 2: T4 and T5 run in parallel (both depend on T1)
- Wave 3: T6, T7, T8 run in parallel
- Wave 4: T9, T10, T11 run in parallel
- Final: F1-F4 run in parallel

## Key Architecture Decisions (from plan)
- `defineLitRoute()` is an identity function (no runtime logic)
- Tag name lookup: use `customElements.getName(component)` with fallback to `component.tagName` or `.__litTagName`
- manifest entry lookup: scan for `isEntry: true` instead of using entryClient path key
- Virtual modules: `virtual:lit-ssg-client` and `virtual:lit-ssg-server`
- No recursive directory scanning (flat `src/pages/*.ts` only)
- File route mapping: `index.ts` → `/`, `about.ts` → `/about` (no case conversion)
