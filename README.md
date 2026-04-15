# vite-plugin-lit-ssg

A Vite plugin for generating static sites with [Lit](https://lit.dev). It renders a set of known routes to static HTML at build time using [Lit SSR](https://lit.dev/docs/ssr/overview/), then injects the Vite-built client JS/CSS into each page.

## Features

- Build-time prerendering with Lit SSR (`@lit-labs/ssr`)
- Automatic JS/CSS asset injection from Vite's manifest
- Page-level `title`, `lang`, `meta`, and custom `<head>` tags
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
  plugins: [
    litSSG({
      entryServer: '/src/entry-server.ts',
      entryClient: '/src/entry-client.ts',
      routes: ['/', '/about'],
    }),
  ],
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

### 3. Create your server entry

```ts
// src/entry-server.ts
import { html } from 'lit'
import './pages/home-page.js'
import './pages/about-page.js'

export async function render(url, ctx) {
  switch (url) {
    case '/':
      return {
        template: html`<home-page></home-page>`,
        title: 'Home',
      }
    case '/about':
      return {
        template: html`<about-page></about-page>`,
        title: 'About',
      }
    default:
      return null
  }
}
```

### 4. Create your client entry

```ts
// src/entry-client.ts
import './pages/home-page.js'
import './pages/about-page.js'
```

### 5. Build

```bash
npm run build
```

This generates a `dist/` directory ready to deploy:

```
dist/
  index.html
  about/
    index.html
  assets/
    entry-client-[hash].js
```

## Plugin Options

```ts
litSSG({
  entryServer: '/src/entry-server.ts', // required
  entryClient: '/src/entry-client.ts', // required
  routes: ['/', '/about'],             // required: string[] or async factory
  outDir: 'dist',                      // optional, default: 'dist'
})
```

| Option | Type | Default | Description |
|---|---|---|---|
| `entryServer` | `string` | — | Server entry path (relative to project root) |
| `entryClient` | `string` | — | Client entry path (relative to project root) |
| `routes` | `string[] \| () => Promise<string[]>` | — | Routes to prerender |
| `outDir` | `string` | `'dist'` | Output directory |

## Render Function Contract

Your `entry-server.ts` must export a `render(url, ctx)` function:

```ts
import type { PageRenderResult, RenderContext } from 'vite-plugin-lit-ssg'

export async function render(url: string, ctx: RenderContext): Promise<PageRenderResult>
```

The return value can be:

```ts
type PageRenderResult =
  | null                // skip this route (404)
  | TemplateResult      // simple template (no page metadata)
  | {
      template: TemplateResult
      title?: string
      lang?: string                          // default: 'en'
      meta?: Array<Record<string, string>>   // typed <meta> tags
      head?: string[]                        // raw HTML strings for <head>
      htmlAttrs?: Record<string, string>
      bodyAttrs?: Record<string, string>
    }
```

## Dynamic Routes

Pass an async factory instead of a static array:

```ts
litSSG({
  routes: async () => {
    const posts = await fetchPosts()
    return ['/', '/about', ...posts.map(p => `/blog/${p.slug}`)]
  },
})
```

## How It Works

1. **Client build** — Vite builds client JS/CSS with `build.manifest = true`
2. **Server build** — Vite builds a Node.js-compatible SSR bundle of your server entry
3. **Load server entry** — The CLI imports the built server entry
4. **Render routes** — Each route is rendered using Lit SSR's `render()` + `collectResult()`
5. **Inject assets** — JS/CSS links are resolved from the Vite manifest and injected into `<head>`
6. **Write HTML** — Each route is written to `dist/<route>/index.html`
7. **Cleanup** — Temporary server build artifacts are removed

## What This Is Not

- Not an online SSR server — output is purely static files
- Not a file-based routing system — you provide explicit routes
- Not a partial hydration / islands framework

## License

MIT
