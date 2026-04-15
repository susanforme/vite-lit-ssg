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

Place `.ts` files in `src/pages/` (flat, no subdirectories):

| File | Route |
|---|---|
| `src/pages/index.ts` | `/` |
| `src/pages/about.ts` | `/about` |
| `src/pages/Contact.ts` | `/Contact` |

- Only `.ts` files are scanned (not `.js`, `.tsx`, etc.)
- Filenames are used as-is (no case conversion)
- No recursive scanning — only the top-level `src/pages/` directory

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

```ts
litSSG({
  pagesDir?: string  // default: 'src/pages'
})
```

| Option | Type | Default | Description |
|---|---|---|---|
| `pagesDir` | `string` | `'src/pages'` | Directory to scan for page files |

## How It Works

1. **Scan pages** — `src/pages/*.ts` files are discovered and mapped to routes
2. **Client build** — Vite builds client JS/CSS using a virtual entry that imports all page files
3. **Server build** — Vite builds a Node.js SSR bundle using a virtual server entry with a `render()` switch
4. **Render routes** — Each route is rendered using Lit SSR's `render()` + `collectResult()`
5. **Inject assets** — JS/CSS links are resolved from the Vite manifest and injected into `<head>`
6. **Write HTML** — Each route is written to `dist/<route>/index.html`
7. **Cleanup** — Temporary server build artifacts are removed

## What This Is Not

- Not an online SSR server — output is purely static files
- Not a partial hydration / islands framework
- Not a dynamic routing system — no `[slug].ts` parameterized routes
- Not a nested layout system — no `layout.ts` convention
- No recursive directory scanning — only flat `src/pages/` files

## License

MIT
