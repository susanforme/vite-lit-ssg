import type { LitElement } from 'lit'

// ── Attribute map helpers ──────────────────────────────────────────────────────

/**
 * Known attributes for the `<meta>` element, with well-typed common names.
 * Arbitrary additional attributes are accepted via the index signature.
 */
export interface MetaAttributes extends Record<string, string> {
  /** Maps to the named metadata (e.g. 'description', 'author', 'viewport'). */
  name?: string
  /** The value paired with `name`, `property`, or `http-equiv`. */
  content?: string
  /** Open Graph / RDFa property (e.g. 'og:title'). */
  property?: string
  /** Pragma directive (e.g. 'refresh', 'X-UA-Compatible'). */
  'http-equiv'?: string
  /** Encoding declaration (e.g. 'UTF-8'). Typically used standalone. */
  charset?: string
  /** Microdata item property. */
  itemprop?: string
}

/**
 * Known global + `<html>`-specific attributes.
 * Arbitrary additional attributes (e.g. `data-*`, framework hints) are accepted.
 */
export interface HtmlElementAttributes extends Record<string, string> {
  /** BCP-47 language tag (e.g. 'en', 'zh-CN'). Merged with the top-level `lang` option. */
  lang?: string
  /** Text directionality. */
  dir?: 'ltr' | 'rtl' | 'auto'
  /** CSS class names on `<html>`. */
  class?: string
  /** Element id on `<html>`. */
  id?: string
}

/**
 * Known global + `<body>`-specific attributes.
 * Arbitrary additional attributes (e.g. `data-*`, HTMX attributes) are accepted.
 */
export interface BodyElementAttributes extends Record<string, string> {
  /** CSS class names on `<body>`. */
  class?: string
  /** Element id on `<body>`. */
  id?: string
  /** Inline styles on `<body>`. */
  style?: string
}

// ── Route descriptor ───────────────────────────────────────────────────────────

/**
 * Page-level descriptor passed to `defineLitRoute()`.
 *
 * @example
 * ```ts
 * export default defineLitRoute({
 *   component: HomePage,
 *   title: 'Home | My Site',
 *   lang: 'en',
 *   meta: [
 *     { name: 'description', content: 'Welcome to my site' },
 *     { property: 'og:title', content: 'Home' },
 *   ],
 *   htmlAttrs: { dir: 'ltr', class: 'theme-light' },
 *   bodyAttrs: { class: 'page-home' },
 * })
 * ```
 */
export interface LitRoute {
  /**
   * The `LitElement` subclass to render for this route.
   * Must be decorated with `@customElement` so its tag name is registered.
   */
  component: typeof LitElement

  /**
   * Content of the `<title>` element.
   * HTML-special characters are automatically escaped.
   */
  title?: string

  /**
   * BCP-47 language tag for the `lang` attribute on `<html>` (default: `'en'`).
   * Providing this at the top level is preferred over `htmlAttrs.lang`.
   */
  lang?: string

  /**
   * Zero or more `<meta>` tags to inject into `<head>`.
   * Each object maps attribute names to values.
   *
   * @example
   * ```ts
   * meta: [
   *   { name: 'description', content: 'Page description' },
   *   { property: 'og:image', content: 'https://example.com/og.png' },
   *   { charset: 'UTF-8' },
   * ]
   * ```
   */
  meta?: MetaAttributes[]

  /**
   * Raw HTML strings appended verbatim to `<head>`.
   * Use for tags not covered by the other options (e.g. `<link rel="canonical">`).
   *
   * @example
   * ```ts
   * head: ['<link rel="canonical" href="https://example.com/">']
   * ```
   */
  head?: string[]

  /**
   * Additional attributes merged onto the `<html>` element.
   * `lang` is applied from the top-level `lang` option first; a value here overrides it.
   *
   * @example
   * ```ts
   * htmlAttrs: { dir: 'rtl', class: 'dark' }
   * ```
   */
  htmlAttrs?: HtmlElementAttributes

  /**
   * Additional attributes merged onto the `<body>` element.
   *
   * @example
   * ```ts
   * bodyAttrs: { class: 'page-home', 'data-theme': 'ocean' }
   * ```
   */
  bodyAttrs?: BodyElementAttributes
}

// ── Factory ────────────────────────────────────────────────────────────────────

/**
 * Defines a Lit SSG route with full type checking.
 *
 * This is an identity function — it returns the same object unchanged.
 * Its only purpose is to provide TypeScript inference for the {@link LitRoute} shape.
 *
 * Each page file in `src/pages/` must export the return value as its **default export**.
 *
 * @example
 * ```ts
 * // src/pages/index.ts
 * import { LitElement, html } from 'lit'
 * import { customElement } from 'lit/decorators.js'
 * import { defineLitRoute } from 'vite-plugin-lit-ssg'
 *
 * \@customElement('home-page')
 * export class HomePage extends LitElement {
 *   render() { return html`<h1>Home</h1>` }
 * }
 *
 * export default defineLitRoute({
 *   component: HomePage,
 *   title: 'Home | My Site',
 * })
 * ```
 */
export function defineLitRoute(route: LitRoute): LitRoute {
  return route
}
