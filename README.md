# vite-plugin-lit-ssg

**English** | [简体中文](./README-zh.md)

> [!WARNING]
> This package is in **alpha** (`0.0.1-alpha.1`). APIs and output format may change before the first stable release. Not recommended for production use yet.

Build-time static site generation for [Lit](https://lit.dev) web components. Drop your `LitElement` page files in `src/pages/`, run one command, and get a fully pre-rendered static site ready to deploy anywhere — no server required.

## Why vite-plugin-lit-ssg

- **Zero configuration** — routes are auto-discovered from `src/pages/`. No route manifest to maintain.
- **True SSR prerendering** — pages render to real HTML at build time via [Lit SSR](https://lit.dev/docs/ssr/overview/), so users get content immediately without waiting for JS.
- **Full Lit compatibility** — Shadow DOM, `@customElement`, decorators, and `LitElement` lifecycle all work as expected. No special wrappers or adapters needed.
- **Single command** — `vite-lit-ssg build` replaces your normal `vite build`. It handles the client bundle, the SSR pass, and the final HTML in one step.
- **Deploy anywhere** — output is plain HTML files in `dist/`. Netlify, GitHub Pages, S3, Vercel — any static host works.

## Install

```bash
npm install vite-plugin-lit-ssg lit vite
```

`vite` and `lit` are peer dependencies. `@lit-labs/ssr` is pulled in automatically.

## Quick Start

### 1. Add the plugin

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { litSSG } from 'vite-plugin-lit-ssg'

export default defineConfig({
  plugins: [litSSG()],
})
```

### 2. Add the build script

```json
{
  "scripts": {
    "build": "vite-lit-ssg build"
  }
}
```

### 3. Create a page

```ts
// src/pages/index.ts
import { LitElement, html } from 'lit'
import { customElement } from 'lit/decorators.js'
import { defineLitRoute } from 'vite-plugin-lit-ssg/browser'

@customElement('home-page')
export class HomePage extends LitElement {
  render() {
    return html`<h1>Hello, world</h1>`
  }
}

export default defineLitRoute({
  component: HomePage,
  title: 'Home',
})
```

### 4. Build

```bash
npm run build
```

Output in `dist/` is ready to deploy:

```
dist/
  index.html
  about/
    index.html
  assets/
    [hash].js
```

## Page Routes

Files in `src/pages/` map directly to routes:

| File | Route |
|---|---|
| `src/pages/index.ts` | `/` |
| `src/pages/about.ts` | `/about` |
| `src/pages/blog/index.ts` | `/blog` |
| `src/pages/blog/post.ts` | `/blog/post` |

Supported extensions: `.ts`, `.tsx`, `.js`, `.jsx`.

Use the `ignore` option to skip non-route folders (e.g. `components/`, `layouts/`) that live inside `src/pages/`.

## Page Metadata

Each page exports a `defineLitRoute()` call to set its HTML metadata:

```ts
import { defineLitRoute } from 'vite-plugin-lit-ssg/browser'

export default defineLitRoute({
  component: MyPage,
  title: 'My Page',
  lang: 'en',
  meta: [{ name: 'description', content: 'My page description' }],
  head: ['<link rel="canonical" href="https://example.com/">'],
  htmlAttrs: { 'data-theme': 'light' },
  bodyAttrs: { class: 'page-home' },
})
```

## Plugin Options

### Page Mode (default)

```ts
litSSG({
  pagesDir?: string                                        // default: 'src/pages'
  ignore?: string | string[] | ((relPath: string) => boolean)
  commonStyles?: Array<{ file: string }>                   // shared CSS prepended into each component
  injectPolyfill?: boolean                                 // default: true
})
```

### Single-Component Mode

Instead of generating a full site, produce a single embeddable SSR fragment — useful for embedding a prerendered Lit component into an existing page or CMS.

```ts
litSSG({
  mode: 'single-component',
  entry: 'src/my-widget.ts',
  exportName?: string,                   // default: 'default'
  wrapperTag?: string | (() => string),  // default: 'lit-ssg-root'
  preload?: 'inherit' | 'none' | 'entry-only',
  commonStyles?: Array<{ file: string }>,
  injectPolyfill?: boolean,              // default: false
  dsdPendingStyle?: boolean,
})
```

Output is an embeddable HTML fragment (no `<!doctype>`, no `<html>` shell) written to `dist/index.html`.

## What This Is Not

- Not an online SSR server — output is static files only
- Not a partial hydration / islands framework
- Not a dynamic routing system — no `[slug].ts` parameterized routes yet
- Not a nested layout system — no `layout.ts` convention yet

## License

MIT
