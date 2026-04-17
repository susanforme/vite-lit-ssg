import { createRequire } from 'node:module'
import { dirname, join, resolve, relative, isAbsolute } from 'node:path'
import type { Plugin, ResolvedConfig, ViteDevServer } from 'vite'
import type { LitSSGOptionsNew, ResolvedSingleComponentOptions } from '../types.js'
import { resolveSingleComponentOptions } from '../types.js'
import type { PageEntry, ScanPagesOptions } from '../scanner/pages.js'

const _require = createRequire(import.meta.url)

const PLUGIN_NAME = 'vite-plugin-lit-ssg'

const VIRTUAL_SHARED_ID = 'virtual:lit-ssg-shared'
const VIRTUAL_SERVER_ID = 'virtual:lit-ssg-server'
const RESOLVED_VIRTUAL_SHARED_ID = '\0' + VIRTUAL_SHARED_ID
const RESOLVED_VIRTUAL_SERVER_ID = '\0' + VIRTUAL_SERVER_ID
const VIRTUAL_PAGE_PREFIX = 'virtual:lit-ssg-page/'
const RESOLVED_VIRTUAL_PAGE_PREFIX = '\0' + VIRTUAL_PAGE_PREFIX
const VIRTUAL_DEV_PAGE_PREFIX = 'virtual:lit-ssg-dev-page/'
const RESOLVED_VIRTUAL_DEV_PAGE_PREFIX = '\0' + VIRTUAL_DEV_PAGE_PREFIX

const VIRTUAL_SINGLE_CLIENT_ID = 'virtual:lit-ssg-single-client'
const RESOLVED_VIRTUAL_SINGLE_CLIENT_ID = '\0' + VIRTUAL_SINGLE_CLIENT_ID
const VIRTUAL_SINGLE_SERVER_ID = 'virtual:lit-ssg-single-server'
const RESOLVED_VIRTUAL_SINGLE_SERVER_ID = '\0' + VIRTUAL_SINGLE_SERVER_ID
const VIRTUAL_SINGLE_DEV_ID = 'virtual:lit-ssg-single-dev'
const RESOLVED_VIRTUAL_SINGLE_DEV_ID = '\0' + VIRTUAL_SINGLE_DEV_ID

interface PageModeState {
  kind: 'page'
  pagesDir: string
  scanOptions: ScanPagesOptions
  resolvedConfig: ResolvedConfig | null
  pages: PageEntry[]
  injectPolyfill: boolean
}

interface SingleComponentState {
  kind: 'single-component'
  resolved: ResolvedSingleComponentOptions
  resolvedConfig: ResolvedConfig | null
}

type PluginState = PageModeState | SingleComponentState

const pluginState = new WeakMap<object, PluginState>()

export function litSSG(options: LitSSGOptionsNew = {}): Plugin {
  let state: PluginState

  if (options.mode === 'single-component') {
    state = {
      kind: 'single-component',
      resolved: resolveSingleComponentOptions(options),
      resolvedConfig: null,
    }
  } else {
    const pagesDir = options.pagesDir ?? 'src/pages'
    state = {
      kind: 'page',
      pagesDir,
      scanOptions: options.ignore != null
        ? { pagesDir, ignore: options.ignore }
        : { pagesDir },
      resolvedConfig: null,
      pages: [],
      injectPolyfill: options.injectPolyfill ?? true,
    }
  }

  const plugin: Plugin = {
    name: PLUGIN_NAME,

    config() {
      const nodePath = _require.resolve('@lit-labs/ssr-client/lit-element-hydrate-support.js')
      const browserHydratePath = join(dirname(nodePath), '..', 'lit-element-hydrate-support.js')
      return {
        build: {
          manifest: true,
        },
        resolve: {
          alias: {
            '@lit-labs/ssr-client/lit-element-hydrate-support.js': browserHydratePath,
          },
        },
      }
    },

    configResolved(config) {
      state.resolvedConfig = config
    },

    async buildStart() {
      if (state.kind === 'page') {
        const { scanPages } = await import('../scanner/pages.js')
        const root = state.resolvedConfig?.root ?? process.cwd()
        state.pages = await scanPages(root, state.scanOptions)
      }
    },

    configureServer(server: ViteDevServer) {
      if (state.kind === 'single-component') {
        server.middlewares.use(async (req, res, next) => {
          const rawUrl = req.url ?? '/'
          const pathname = (rawUrl.split('?')[0] ?? '/').split('#')[0] ?? '/'

          if (req.method !== 'GET' && req.method !== 'HEAD') return next()

          if (pathname !== '/') return next()

          const htmlTemplate = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Dev</title>
  </head>
  <body>
    <script type="module" src="/@id/__x00__${VIRTUAL_SINGLE_DEV_ID}"></script>
  </body>
</html>`

          try {
            const transformed = await server.transformIndexHtml(rawUrl, htmlTemplate)
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.statusCode = 200
            res.end(transformed)
          } catch (e) {
            next(e)
          }
        })
        return
      }

      const root = server.config.root ?? process.cwd()
      const absolutePagesDir = resolve(root, state.pagesDir)

      const seedPages = async () => {
        if (state.kind === 'page' && state.pages.length === 0) {
          const { scanPages } = await import('../scanner/pages.js')
          try {
            state.pages = await scanPages(root, state.scanOptions)
          } catch {
            // pages dir may not exist yet; watcher will pick up additions
          }
        }
      }

      const seedReady = seedPages()

      const rescanPages = async (addedFile?: string) => {
        if (state.kind !== 'page') return
        await seedReady
        const { scanPages } = await import('../scanner/pages.js')
        const prevRoutes = new Set(state.pages.map((p) => p.route))
        try {
          state.pages = await scanPages(root, state.scanOptions)
          for (const id of [RESOLVED_VIRTUAL_SHARED_ID, RESOLVED_VIRTUAL_SERVER_ID]) {
            const mod = server.moduleGraph.getModuleById(id)
            if (mod) server.moduleGraph.invalidateModule(mod)
          }
        } catch (err) {
          server.config.logger.warn(
            `[vite-plugin-lit-ssg] Page rescan failed: ${err instanceof Error ? err.message : String(err)}`,
          )
          return
        }
        if (addedFile) {
          for (const page of state.pages) {
            if (!prevRoutes.has(page.route)) {
              server.config.logger.info(
                `[vite-plugin-lit-ssg] New route detected: ${page.route} → ${page.importPath}`,
                { timestamp: true },
              )
            }
          }
        }
        server.ws.send({ type: 'full-reload' })
      }

      const isUnderPagesDir = (file: string) => {
        const rel = relative(absolutePagesDir, file)
        return !rel.startsWith('..') && !isAbsolute(rel)
      }

      const isPageFile = (file: string) =>
        /\.(ts|tsx|js|jsx)$/.test(file)

      server.watcher.add(absolutePagesDir)
      server.watcher.on('add', (file) => {
        if (isUnderPagesDir(file) && isPageFile(file)) rescanPages(file)
      })
      server.watcher.on('unlink', (file) => {
        if (isUnderPagesDir(file) && isPageFile(file)) rescanPages()
      })

      server.middlewares.use(async (req, res, next) => {
        if (state.kind !== 'page') return next()
        const rawUrl = req.url ?? '/'
        const pathname = (rawUrl.split('?')[0] ?? '/').split('#')[0] ?? '/'

        if (req.method !== 'GET' && req.method !== 'HEAD') return next()

        if (state.pages.length === 0) {
          const { scanPages } = await import('../scanner/pages.js')
          const root = state.resolvedConfig?.root ?? process.cwd()
          state.pages = await scanPages(root, state.scanOptions)
        }

        const base = state.resolvedConfig?.base ?? '/'
        const normalizedBase = base.endsWith('/') ? base : base + '/'
        let routePath: string
        if (base === '/' || base === '') {
          routePath = pathname
        } else if (pathname.startsWith(normalizedBase)) {
          routePath = '/' + pathname.slice(normalizedBase.length)
        } else if (pathname === base.replace(/\/$/, '')) {
          routePath = '/'
        } else {
          return next()
        }

        const matchedPage = state.pages.find((p) => {
          if (p.route === routePath) return true
          if (p.route === routePath.replace(/\/$/, '') && routePath !== '/') return true
          return false
        })

        if (!matchedPage) {
          const accept = req.headers['accept'] ?? ''
          if (
            !accept.includes('text/html') ||
            pathname.startsWith('/@') ||
            pathname.startsWith('/node_modules/') ||
            /\.\w+$/.test(pathname.split('/').pop() ?? '')
          ) {
            return next()
          }

          const safeRoutePath = routePath
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')

          const homeHref = base === '/' || base === '' ? '/' : base

          const html404 = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>404 Not Found</title>
    <style>
      body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
      .container { text-align: center; padding: 2rem; }
      h1 { font-size: 6rem; margin: 0; color: #333; }
      p { color: #666; font-size: 1.2rem; }
      a { color: #646cff; text-decoration: none; }
      a:hover { text-decoration: underline; }
      .badge { display: inline-block; background: #ff6b35; color: white; font-size: 0.75rem; padding: 2px 8px; border-radius: 4px; margin-bottom: 1rem; font-weight: bold; letter-spacing: 0.05em; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="badge">DEV ONLY</div>
      <h1>404</h1>
      <p>Page not found: <code>${safeRoutePath}</code></p>
      <p><a href="${homeHref}">← Back to home</a></p>
    </div>
  </body>
</html>`
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.statusCode = 404
          if (req.method === 'HEAD') {
            res.setHeader('Content-Length', Buffer.byteLength(html404))
            res.end()
          } else {
            try {
              const transformed = await server.transformIndexHtml(rawUrl, html404)
              res.end(transformed)
            } catch {
              res.end(html404)
            }
          }
          return
        }

        const devPageId = `${VIRTUAL_DEV_PAGE_PREFIX}${matchedPage.route === '/' ? 'index' : matchedPage.route.slice(1)}`
        const htmlTemplate = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Dev</title>
  </head>
  <body>
    <script type="module" src="/@id/__x00__${devPageId}"></script>
  </body>
</html>`

        try {
          const transformed = await server.transformIndexHtml(rawUrl, htmlTemplate)
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.statusCode = 200
          res.end(transformed)
        } catch (e) {
          next(e)
        }
      })
    },

    resolveId(id) {
      if (state.kind === 'single-component') {
        if (id === VIRTUAL_SINGLE_CLIENT_ID) return RESOLVED_VIRTUAL_SINGLE_CLIENT_ID
        if (id === VIRTUAL_SINGLE_SERVER_ID) return RESOLVED_VIRTUAL_SINGLE_SERVER_ID
        if (id === VIRTUAL_SINGLE_DEV_ID) return RESOLVED_VIRTUAL_SINGLE_DEV_ID
        return undefined
      }
      if (id === VIRTUAL_SHARED_ID) return RESOLVED_VIRTUAL_SHARED_ID
      if (id === VIRTUAL_SERVER_ID) return RESOLVED_VIRTUAL_SERVER_ID
      if (id.startsWith(VIRTUAL_PAGE_PREFIX)) {
        return RESOLVED_VIRTUAL_PAGE_PREFIX + id.slice(VIRTUAL_PAGE_PREFIX.length)
      }
      if (id.startsWith(VIRTUAL_DEV_PAGE_PREFIX)) {
        return RESOLVED_VIRTUAL_DEV_PAGE_PREFIX + id.slice(VIRTUAL_DEV_PAGE_PREFIX.length)
      }
      return undefined
    },

    async load(id) {
      if (id === RESOLVED_VIRTUAL_SINGLE_CLIENT_ID) {
        if (state.kind !== 'single-component') return undefined
        const { generateSingleClientEntry } = await import('../virtual/single-client-entry.js')
        return generateSingleClientEntry(state.resolved)
      }
      if (id === RESOLVED_VIRTUAL_SINGLE_SERVER_ID) {
        if (state.kind !== 'single-component') return undefined
        const { generateSingleServerEntry } = await import('../virtual/single-server-entry.js')
        return generateSingleServerEntry(state.resolved)
      }
      if (id === RESOLVED_VIRTUAL_SINGLE_DEV_ID) {
        if (state.kind !== 'single-component') return undefined
        const { generateSingleDevEntry } = await import('../virtual/single-client-entry.js')
        return generateSingleDevEntry(state.resolved)
      }
      if (id === RESOLVED_VIRTUAL_SHARED_ID) {
        const { generateSharedEntry } = await import('../virtual/client-entry.js')
        return generateSharedEntry()
      }
      if (id === RESOLVED_VIRTUAL_SERVER_ID) {
        if (state.kind !== 'page') return undefined
        const { generateServerEntry } = await import('../virtual/server-entry.js')
        return generateServerEntry(state.pages)
      }
      if (id.startsWith(RESOLVED_VIRTUAL_PAGE_PREFIX)) {
        if (state.kind !== 'page') return undefined
        const pageName = id.slice(RESOLVED_VIRTUAL_PAGE_PREFIX.length)
        const page = state.pages.find((p) => p.slug === pageName)
        if (!page) {
          throw new Error(
            `[vite-plugin-lit-ssg] No page found for virtual module: ${id}. Available pages: ${state.pages.map((p) => p.importPath).join(', ')}`,
          )
        }
        const { generatePageEntry } = await import('../virtual/client-entry.js')
        return generatePageEntry(page)
      }
      if (id.startsWith(RESOLVED_VIRTUAL_DEV_PAGE_PREFIX)) {
        if (state.kind !== 'page') return undefined
        const pageName = id.slice(RESOLVED_VIRTUAL_DEV_PAGE_PREFIX.length)
        const page = state.pages.find((p) => {
          const routeName = p.route === '/' ? 'index' : p.route.slice(1)
          return routeName === pageName
        })
        if (!page) {
          throw new Error(
            `[vite-plugin-lit-ssg] No dev page found for: ${id}. Available pages: ${state.pages.map((p) => p.route).join(', ')}`,
          )
        }
        return `import '@lit-labs/ssr-client/lit-element-hydrate-support.js'
import route from '${page.importPath}'
if (route.title) document.title = route.title
const tag = customElements.getName(route.component)
if (tag) {
  const el = document.createElement(tag)
  document.body.appendChild(el)
}
`
      }
      return undefined
    },
  }

  pluginState.set(plugin, state)

  return plugin
}

export function getSSGOptions(plugin: object): ScanPagesOptions | undefined {
  const state = pluginState.get(plugin)
  if (!state || state.kind !== 'page') return undefined
  return state.scanOptions
}

export function getPageInjectPolyfill(plugin: object): boolean {
  const state = pluginState.get(plugin)
  if (!state || state.kind !== 'page') return true
  return state.injectPolyfill
}

export function getSingleComponentOptions(plugin: object): ResolvedSingleComponentOptions | undefined {
  const state = pluginState.get(plugin)
  if (!state || state.kind !== 'single-component') return undefined
  return state.resolved
}

export {
  PLUGIN_NAME,
  VIRTUAL_PAGE_PREFIX,
  VIRTUAL_SHARED_ID,
  VIRTUAL_SINGLE_CLIENT_ID,
  VIRTUAL_SINGLE_SERVER_ID,
}
export type { ScanPagesOptions }
