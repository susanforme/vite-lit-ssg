# vite-plugin-lit-ssg

A Vite plugin for generating static sites with [Lit](https://lit.dev). It renders routes to static HTML at build time using [Lit SSR](https://lit.dev/docs/ssr/overview/), then injects the Vite-built client JS/CSS into each page.

Convention over configuration: drop your page files in `src/pages/` and run one command.

## Features

- Build-time prerendering with Lit SSR (`@lit-labs/ssr`)
- **Zero required configuration** — routes auto-discovered from `src/pages/`
- Page-level metadata via `defineLitRoute()` — title, lang, meta tags, and more
- Automatic JS/CSS asset injection from Vite's manifest
- Support for `LitElement` with Shadow DOM (Declarative Shadow DOM output)
- Static output deployable to any static hosting platform
- Single command (`vite-lit-ssg build`) does everything

## Install

```bash
npm install vite-plugin-lit-ssg lit
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
import { defineLitRoute } from 'vite-plugin-lit-ssg'

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
import { defineLitRoute } from 'vite-plugin-lit-ssg'

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

## Page File Convention

Place `.ts` files in `src/pages/`. Subdirectories are supported — the directory structure maps to the route hierarchy:

| File | Route |
|---|---|
| `src/pages/index.ts` | `/` |
| `src/pages/about.ts` | `/about` |
| `src/pages/blog/index.ts` | `/blog` |
| `src/pages/blog/post.ts` | `/blog/post` |

- Only `.ts` files are scanned (not `.js`, `.tsx`, etc.)
- Filenames and directory names are used as-is (no case conversion)
- `index.ts` at any directory level resolves to the parent route (e.g. `blog/index.ts` → `/blog`)
- Two files that resolve to the same route (e.g. `about.ts` and `about/index.ts`) throw an error at startup

## `defineLitRoute()` API

Each page file must export a `defineLitRoute()` call as its default export:

```ts
import { defineLitRoute } from 'vite-plugin-lit-ssg'

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
  pagesDir?: string  // default: 'src/pages'
})
```

| Option | Type | Default | Description |
|---|---|---|---|
| `pagesDir` | `string` | `'src/pages'` | Directory to scan for page files |

### Single-Component Mode

```ts
litSSG({
  mode: 'single-component',
  entry: string,         // required: path to the component module (relative to project root)
  exportName?: string,   // default: 'default'
  wrapperTag?: string,   // default: 'lit-ssg-root'
  preload?: 'inherit' | 'none' | 'entry-only',  // default: 'inherit'
})
```

| Option | Type | Default | Description |
|---|---|---|---|
| `mode` | `'single-component'` | — | Enables single-component build |
| `entry` | `string` | — | Module path to the component (e.g. `src/my-element.ts`) |
| `exportName` | `string` | `'default'` | Named export to use as the component class |
| `wrapperTag` | `string` | `'lit-ssg-root'` | Custom element tag that wraps the SSR output |
| `preload` | `string` | `'inherit'` | Controls `<link rel="modulepreload">` injection: `inherit` = keep all preloads, `none` = remove all modulepreload links (CSS kept), `entry-only` = keep only the entry script (no CSS/preload links) |

**Example:**

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { litSSG } from 'vite-plugin-lit-ssg'

export default defineConfig({
  plugins: [litSSG({
    mode: 'single-component',
    entry: 'src/my-widget.ts',
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

**Important:** Page-level APIs (`title`, `meta`, `lang`, `head`, `htmlAttrs`, `bodyAttrs`) are **not** supported in single-component mode. If you need page metadata, use page mode instead.

Plain `litSSG()` (no arguments) always means **page mode** and is fully backward compatible.

## How It Works

### Page mode

1. **Scan pages** — `src/pages/**/*.ts` files are discovered recursively and mapped to routes
2. **Client build** — Vite builds client JS/CSS using a virtual entry that imports all page files
3. **Server build** — Vite builds a Node.js SSR bundle using a virtual server entry with a `render()` switch
4. **Render routes** — Each route is rendered using Lit SSR's `render()` + `collectResult()`
5. **Inject assets** — JS/CSS links are resolved from the Vite manifest and injected into `<head>`
6. **Write HTML** — Each route is written to `dist/<route>/index.html`
7. **Cleanup** — Temporary server build artifacts are removed

### Single-component mode

1. **Client build** — Vite builds a client bundle from the component entry (includes Lit hydration support)
2. **Server build** — Vite builds a Node.js SSR bundle for the component
3. **Render** — The component is rendered using Lit SSR's `render()` + `collectResult()`, wrapped in `wrapperTag`
4. **Inject assets** — JS/CSS/modulepreload tags are resolved from the manifest and appended after the wrapper (controlled by `preload` option)
5. **Write HTML** — Output written to `dist/index.html` as an embeddable fragment
6. **Cleanup** — Temporary server build artifacts are removed

## What This Is Not

- Not an online SSR server — output is purely static files
- Not a partial hydration / islands framework
- Not a dynamic routing system — no `[slug].ts` parameterized routes
- Not a nested layout system — no `layout.ts` convention

## License

MIT
