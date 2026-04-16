import type { TemplateResult } from 'lit'

/**
 * User configuration passed to litSSG() plugin.
 */
export interface LitSSGOptions {
  /**
   * Path to the server entry file (relative to project root, e.g. '/src/entry-server.ts').
   * This file must export an async `render(url, ctx)` function.
   */
  entryServer: string

  /**
   * Path to the client entry file (relative to project root, e.g. '/src/entry-client.ts').
   * This is the entry used for the client-side JS bundle.
   */
  entryClient: string

  /**
   * The routes to prerender. Can be a static array or an async factory.
   * @example ['/'] or ['/', '/about', '/blog']
   */
  routes: string[] | (() => Promise<string[]>)

  /**
   * Output directory for the final deployable files (default: 'dist').
   */
  outDir?: string
}

/**
 * Normalized options with all defaults applied.
 */
export interface ResolvedLitSSGOptions {
  entryServer: string
  entryClient: string
  routes: string[] | (() => Promise<string[]>)
  outDir: string
}

/**
 * Context object passed to the server-side render function.
 */
export interface RenderContext {
  route: string
  params: Record<string, string>
}

/**
 * Full page descriptor returned by the user's render function.
 */
export interface PageDescriptor {
  template: TemplateResult
  title?: string
  lang?: string
  meta?: Array<Record<string, string>>
  head?: string[]
  htmlAttrs?: Record<string, string>
  bodyAttrs?: Record<string, string>
}

/**
 * What the user's `render(url, ctx)` can return.
 */
export type PageRenderResult = null | TemplateResult | PageDescriptor

/**
 * Server entry module shape.
 */
export interface ServerEntry {
  render: (url: string, ctx: RenderContext) => Promise<PageRenderResult>
}

/**
 * Asset links resolved from the Vite manifest for injection into HTML.
 */
export interface AssetLinks {
  /** Main client JS entry (type="module" script) */
  js: string
  /** CSS files linked to the entry */
  css: string[]
  /** Module preload hrefs */
  modulepreloads: string[]
}

/**
 * Shape of a single entry in `manifest.json`.
 */
export interface ManifestEntry {
  file: string
  src?: string
  isEntry?: boolean
  isDynamicEntry?: boolean
  css?: string[]
  assets?: string[]
  imports?: string[]
  dynamicImports?: string[]
}

/**
 * Shape of the full Vite `manifest.json`.
 */
export type ViteManifest = Record<string, ManifestEntry>

import type { IgnoreOption } from './scanner/pages.js'

export type { IgnoreOption }

export interface LitSSGOptionsNew {
  pagesDir?: string
  ignore?: IgnoreOption | IgnoreOption[]
}
