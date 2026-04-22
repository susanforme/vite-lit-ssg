# vite-plugin-lit-ssg

**English** | [简体中文](./README-zh.md)

A Vite plugin for generating static sites with [Lit](https://lit.dev). It renders routes to static HTML at build time using [Lit SSR](https://lit.dev/docs/ssr/overview/), then injects the Vite-built client JS/CSS into each page.

Convention over configuration: drop your page files in `src/pages/` and run one command.

This repository is now a **pnpm monorepo** that contains the published package, its test suite, and two playground apps used to verify both page mode and single-component mode.

## Features

- Build-time prerendering with Lit SSR (`@lit-labs/ssr`)
- **Zero required configuration** — routes auto-discovered from `src/pages/`
- Page-level metadata via `defineLitRoute()` — title, lang, meta tags, and more
- Convention-based page scanning for `.ts`, `.tsx`, `.js`, and `.jsx`
- Shared component styles via `commonStyles`, injected into component `static styles`
- Ignore rules for skipping non-route files inside `src/pages/`
- Automatic JS/CSS asset injection from Vite's manifest
- Support for `LitElement` with Shadow DOM (Declarative Shadow DOM output)
- Optional single-component mode for embeddable SSR fragments
- Configurable Declarative Shadow DOM polyfill injection
- Static output deployable to any static hosting platform
- Single command (`vite-lit-ssg build`) does everything

## Install

```bash
npm install vite-plugin-lit-ssg lit vite
```

> `vite` and `lit` are peer dependencies. `@lit-labs/ssr` is bundled as a transitive dependency of `vite-plugin-lit-ssg`.

## Quick Start

### 1. Configure Vite

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { litSSG } from 'vite-plugin-lit-ssg'

export default defineConfig({
  plugins: [litSSG()], // zero configuration required
})
```

### 2. Add build script

```json
{
  "scripts": {
    "build": "vite-lit-ssg build"
  }
}
```

### 3. Create your page files

```ts
// src/pages/index.ts
import { LitElement, html } from 'lit'
import { customElement } from 'lit/decorators.js'
import { defineLitRoute } from 'vite-plugin-lit-ssg/browser'

@customElement('home-page')
export class HomePage extends LitElement {
  render() {
    return html`<h1>Welcome</h1>`
  }
}

export default defineLitRoute({
  component: HomePage,
  title: 'Home | My Site',
  meta: [{ name: 'description', content: 'My home page' }],
})
```

```ts
// src/pages/about.ts
import { LitElement, html } from 'lit'
import { customElement } from 'lit/decorators.js'
import { defineLitRoute } from 'vite-plugin-lit-ssg/browser'

@customElement('about-page')
export class AboutPage extends LitElement {
  render() {
    return html`<h1>About</h1>`
  }
}

export default defineLitRoute({
  component: AboutPage,
  title: 'About | My Site',
})
```

### 4. Build

```bash
npm run build
```

This generates a `dist/` directory ready to deploy:

```
dist/
  index.html          ← from src/pages/index.ts
  about/
    index.html        ← from src/pages/about.ts
  assets/
    [hash].js
```

If you want to point the CLI at a non-default Vite config or build mode, use:

```bash
vite-lit-ssg build --config vite.config.ts --mode production
```

## Page File Convention

Place page modules in `src/pages/`. Subdirectories are supported — the directory structure maps to the route hierarchy:

| File | Route |
|---|---|
| `src/pages/index.ts` | `/` |
| `src/pages/about.ts` | `/about` |
| `src/pages/blog/index.ts` | `/blog` |
| `src/pages/blog/post.ts` | `/blog/post` |

- Supported extensions: `.ts`, `.tsx`, `.js`, `.jsx`
- Filenames and directory names are used as-is (no case conversion)
- `index.ts` at any directory level resolves to the parent route (e.g. `blog/index.ts` → `/blog`)
- Two files that resolve to the same route (e.g. `about.ts` and `about/index.ts`) throw an error at startup
- Use the `ignore` option when `src/pages/` also contains helper folders such as `components/` or `layouts/`

## `defineLitRoute()` API

Each page file must export a `defineLitRoute()` call as its default export:

```ts
import { defineLitRoute } from 'vite-plugin-lit-ssg/browser'

export default defineLitRoute({
  component: MyComponent,   // required: your LitElement class
  title?: string,           // <title> tag
  lang?: string,            // <html lang="..."> (default: 'en')
  meta?: Array<Record<string, string>>,  // <meta> tags
  head?: string[],          // raw HTML strings appended to <head>
  htmlAttrs?: Record<string, string>,    // extra <html> attributes
  bodyAttrs?: Record<string, string>,    // extra <body> attributes
})
```

The component class must use the `@customElement` decorator — the tag name is auto-resolved via `customElements.getName()`.

## Plugin Options

`litSSG()` with no arguments defaults to **page mode** — the existing behavior described above. You can also opt into `single-component` mode for embedding a single prerendered component.

### Page Mode (default)

```ts
litSSG({
  pagesDir?: string
  ignore?: string | string[] | ((relPath: string) => boolean)
  commonStyles?: Array<{ file: string }>
  injectPolyfill?: boolean
})
```

| Option | Type | Default | Description |
|---|---|---|---|
| `pagesDir` | `string` | `'src/pages'` | Directory to scan for page files |
| `ignore` | `string \| string[] \| ((relPath: string) => boolean)` | — | Skip files or directories inside `pagesDir`; useful when pages live alongside route-local helpers |
| `commonStyles` | `Array<{ file: string }>` | — | Shared stylesheet entries resolved relative to project root and prepended into each rendered component's `static styles` |
| `injectPolyfill` | `boolean` | `true` | Inject the Declarative Shadow DOM polyfill scripts. Set to `false` to omit polyfill injection when targeting environments with native DSD support only. |

**Example:**

```ts
litSSG({
  pagesDir: 'src/pages',
  ignore: ['components', 'layouts'],
  commonStyles: [{ file: 'src/styles/common.css' }],
})
```

`commonStyles` are merged into component styles rather than emitted as top-level `<link rel="stylesheet">` tags, so the rendered Shadow DOM stays self-contained.

### Single-Component Mode

```ts
litSSG({
  mode: 'single-component',
  entry: string,
  commonStyles?: Array<{ file: string }>,
  exportName?: string,
  wrapperTag?: string | (() => string),
  preload?: 'inherit' | 'none' | 'entry-only',
  injectPolyfill?: boolean,
  dsdPendingStyle?: boolean,
})
```

| Option | Type | Default | Description |
|---|---|---|---|
| `mode` | `'single-component'` | — | Enables single-component build |
| `entry` | `string` | — | Module path to the component (e.g. `src/my-element.ts`) |
| `commonStyles` | `Array<{ file: string }>` | — | Shared stylesheet entries prepended into the rendered component's styles |
| `exportName` | `string` | `'default'` | Named export to use as the component class |
| `wrapperTag` | `string \| (() => string)` | `'lit-ssg-root'` | Custom element tag that wraps the SSR output |
| `preload` | `string` | `'inherit'` | Controls `<link rel="modulepreload">` injection: `inherit` = keep all preloads, `none` = remove all modulepreload links (CSS kept), `entry-only` = keep only the entry script (no CSS/preload links) |
| `injectPolyfill` | `boolean` | `false` | Inject Declarative Shadow DOM polyfill scripts into the fragment output. Useful when embedding into pages that may not support native DSD. |
| `dsdPendingStyle` | `boolean` | `true` (when `injectPolyfill` is `true`) | Inject `<style>wrapper-tag[dsd-pending]{display:none}</style>` and add the `dsd-pending` attribute to the wrapper to prevent FOUC. Only relevant when `injectPolyfill` is `true`. |

**Example:**

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { litSSG } from 'vite-plugin-lit-ssg'

export default defineConfig({
  plugins: [litSSG({
    mode: 'single-component',
    entry: 'src/my-widget.ts',
    commonStyles: [{ file: 'src/common.css' }],
    exportName: 'default',    // or a named export like 'MyWidget'
    wrapperTag: 'my-app',
    preload: 'entry-only',
  })],
})
```

**Output** — a single `dist/index.html` (fragment with SSR markup and a client hydration script, no HTML shell):

```html
<my-app>
  <my-widget>
    <template shadowrootmode="open"><!-- SSR content --></template>
  </my-widget>
</my-app>
<script type="module" src="/assets/my-widget-abc123.js"></script>
```

The output contains no `<!doctype>`, no `<html>`, no `<body>` — just the SSR fragment followed by the client module script for hydration. You embed this directly into your existing page.

The `preload` option controls what asset tags are appended after the wrapper:
- `inherit` (default) — CSS `<link>` tags + `<link rel="modulepreload">` hints + `<script type="module">`
- `none` — CSS `<link>` tags + `<script type="module">` (no modulepreload hints)
- `entry-only` — `<script type="module">` only (no CSS links, no modulepreload hints)

When you use `commonStyles`, the configured styles are injected into the component's rendered styles in both build output and hydration bundles. For reliable style injection, keep the exported component statically analyzable (for example, a named class or a named import/export binding).

**Important:** Page-level APIs (`title`, `meta`, `lang`, `head`, `htmlAttrs`, `bodyAttrs`) are **not** supported in single-component mode. If you need page metadata, use page mode instead.

Plain `litSSG()` (no arguments) always means **page mode** and is fully backward compatible.

## How It Works

### Page mode

1. **Scan pages** — `src/pages/**/*.{ts,tsx,js,jsx}` files are discovered recursively and mapped to routes
2. **Collect shared styles** — optional `commonStyles` entries are inlined into targeted Lit components
3. **Client build** — Vite builds client JS/CSS using a virtual entry that imports all page files
4. **Server build** — Vite builds a Node.js SSR bundle using a virtual server entry with a `render()` switch
5. **Render routes** — Each route is rendered using Lit SSR's `render()` + `collectResult()`
6. **Inject assets** — JS/CSS links are resolved from the Vite manifest and injected into `<head>`
7. **Write HTML** — Each route is written to `dist/<route>/index.html`
8. **Cleanup** — Temporary server build artifacts are removed

### Single-component mode

1. **Client build** — Vite builds a client bundle from the component entry (includes Lit hydration support)
2. **Collect shared styles** — optional `commonStyles` entries are prepended into the exported component's styles
3. **Server build** — Vite builds a Node.js SSR bundle for the component
4. **Render** — The component is rendered using Lit SSR's `render()` + `collectResult()`, wrapped in `wrapperTag`
5. **Inject assets** — JS/CSS/modulepreload tags are resolved from the manifest and appended after the wrapper (controlled by `preload` option)
6. **Write HTML** — Output written to `dist/index.html` as an embeddable fragment
7. **Cleanup** — Temporary server build artifacts are removed

## Local Development

This repo uses **pnpm workspaces**:

```text
.
├─ packages/
│  ├─ vite-plugin-lit-ssg
│  └─ vite-plugin-lit-ssg-tests
└─ playground/
   ├─ page-mode
   └─ single-component-app
```

Install dependencies at the repo root:

```bash
pnpm install
```

Useful root-level commands:

```bash
pnpm build              # build the published package
pnpm dev                # watch package sources with tsc
pnpm typecheck          # type-check the package
pnpm test               # run the Vitest suite
pnpm playground:build   # build the page-mode playground
pnpm playground:preview # preview the page-mode playground build
```

Playground-specific commands:

- `playground/page-mode` — convention-based page-mode fixture
- `playground/single-component-app` — single-component fixture with `inherit`, `none`, and `entry-only` preload variants

Example:

```bash
pnpm --filter playground build
pnpm --filter single-component-fixture build:entry-only
```

## What This Is Not

- Not an online SSR server — output is purely static files
- Not a partial hydration / islands framework
- Not a dynamic routing system — no `[slug].ts` parameterized routes
- Not a nested layout system — no `layout.ts` convention

## License

MIT
