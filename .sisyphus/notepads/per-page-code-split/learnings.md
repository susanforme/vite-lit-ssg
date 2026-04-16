# Learnings - per-page-code-split

## Project Structure
- Plugin: `packages/vite-plugin-lit-ssg/src/`
- Playground: `packages/playground/`
- Tests: `packages/vite-plugin-lit-ssg/tests/unit/` and `tests/integration/`

## Key Facts
- `PageEntry` has: `{ filePath, importPath, route }` - importPath is like `/src/pages/about.ts`
- Current manifest key = `virtual:lit-ssg-client` (the virtual module src ID)
- When using Rollup object input `{ 'lit-ssg-page-about': 'virtual:...' }`, manifest key = `lit-ssg-page-about`
- `pnpm -F playground build` runs the full build
- `pnpm -F vite-plugin-lit-ssg test` runs unit + integration tests

## Key Files
- `src/virtual/client-entry.ts` - generates virtual entry content
- `src/plugin/index.ts` - Vite plugin, resolveId/load hooks for virtual modules
- `src/assets/manifest.ts` - `resolveAssetsFromManifest()` parses manifest.json
- `src/runner/build.ts` - `runSSG()` orchestrates client+server builds and rendering
- `tests/unit/virtual-entries.test.ts` - tests `generateClientEntry` (needs updating)
- `tests/unit/manifest.test.ts` - tests `resolveAssetsFromManifest` (needs updating for new signature)
