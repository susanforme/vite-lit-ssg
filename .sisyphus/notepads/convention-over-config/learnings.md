# Learnings

## Project Structure
- Monorepo with pnpm workspaces
- `packages/vite-plugin-lit-ssg/` — the plugin package
- `packages/playground/` — demo/test app
- Main plugin source: `packages/vite-plugin-lit-ssg/src/`
- Tests: `packages/vite-plugin-lit-ssg/tests/`
- Playground pages: `packages/playground/src/pages/` (currently has home-page.ts, about-page.ts)
- Playground currently has entry-server.ts and entry-client.ts in `packages/playground/src/`

## Current Plugin Source Files
- `src/assets/` — manifest handling
- `src/cli.ts` — CLI entry point
- `src/index.ts` — public exports
- `src/output/` — HTML output writing
- `src/plugin/` — Vite plugin definition
- `src/runner/` — build runner
- `src/runtime/` — SSR runtime
- `src/types.ts` — TypeScript types

## Execution Plan Waves
- Wave 1 (parallel): T1 (spike), T2 (defineLitRoute), T3 (scanner)
- Wave 2 (parallel): T4 (virtual modules), T5 (manifest)
- Wave 3 (parallel): T6 (build runner), T7 (plugin hooks), T8 (CLI)
- Wave 4 (parallel): T9 (tests), T10 (playground), T11 (README)
- Final wave (parallel): F1-F4 reviews

## Task 1 Spike Learnings
- In the Lit SSR Node.js environment, `@lit-labs/ssr/lib/dom-shim.js` installs a `customElements` registry shim with a working `getName()` method.
- `customElements.getName(TestEl)` returned the registered tag name after applying Lit's `customElement()` decorator logic.
- For the class constructor itself, `tagName` and `__litTagName` were `undefined`, while the SSR shim-populated `__localName` contained the tag name.
- Playground manifest `isEntry: true` entries appear as `[manifestKey, manifestEntry]` tuples where the key is the source path (for example `src/entry-client.ts`).
- Manifest refactors can scan `Object.entries(manifest)` for `entry.isEntry` instead of depending on a configured entry-client path lookup.
