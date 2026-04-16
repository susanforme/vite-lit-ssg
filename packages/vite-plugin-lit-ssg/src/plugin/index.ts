import { createRequire } from 'node:module'
import { dirname, join, resolve, relative, isAbsolute } from 'node:path'
import type { Plugin, ResolvedConfig, ViteDevServer } from 'vite'
import type { LitSSGOptionsNew } from '../types.js'
import type { PageEntry } from '../scanner/pages.js'

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

interface PluginState {
  pagesDir: string
  resolvedConfig: ResolvedConfig | null
  pages: PageEntry[]
}

const pluginState = new WeakMap<object, PluginState>()

export function litSSG(options: LitSSGOptionsNew = {}): Plugin {
  const pagesDir = options.pagesDir ?? 'src/pages'

  const state: PluginState = {
    pagesDir,
    resolvedConfig: null,
    pages: [],
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
      const { scanPages } = await import('../scanner/pages.js')
      const root = state.resolvedConfig?.root ?? process.cwd()
      state.pages = await scanPages(root, pagesDir)
    },

    configureServer(server: ViteDevServer) {
      const root = server.config.root ?? process.cwd()
      const absolutePagesDir = resolve(root, pagesDir)

      const rescanPages = async () => {
        const { scanPages } = await import('../scanner/pages.js')
        try {
          state.pages = await scanPages(root, pagesDir)
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
        server.ws.send({ type: 'full-reload' })
      }

      const isUnderPagesDir = (file: string) => {
        const rel = relative(absolutePagesDir, file)
        return !rel.startsWith('..') && !isAbsolute(rel)
      }

      server.watcher.add(absolutePagesDir)
      server.watcher.on('add', (file) => {
        if (isUnderPagesDir(file) && file.endsWith('.ts')) rescanPages()
      })
      server.watcher.on('unlink', (file) => {
        if (isUnderPagesDir(file) && file.endsWith('.ts')) rescanPages()
      })

      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url ?? '/'
        const pathname = (rawUrl.split('?')[0] ?? '/').split('#')[0] ?? '/'

        if (req.method !== 'GET' && req.method !== 'HEAD') return next()

        if (state.pages.length === 0) {
          const { scanPages } = await import('../scanner/pages.js')
          const root = state.resolvedConfig?.root ?? process.cwd()
          state.pages = await scanPages(root, pagesDir)
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

        if (!matchedPage) return next()

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
      if (id === RESOLVED_VIRTUAL_SHARED_ID) {
        const { generateSharedEntry } = await import('../virtual/client-entry.js')
        return generateSharedEntry()
      }
      if (id === RESOLVED_VIRTUAL_SERVER_ID) {
        const { generateServerEntry } = await import('../virtual/server-entry.js')
        return generateServerEntry(state.pages)
      }
      if (id.startsWith(RESOLVED_VIRTUAL_PAGE_PREFIX)) {
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

export function getSSGOptions(plugin: object): { pagesDir: string } | undefined {
  const state = pluginState.get(plugin)
  if (!state) return undefined
  return { pagesDir: state.pagesDir }
}

export { PLUGIN_NAME, VIRTUAL_PAGE_PREFIX, VIRTUAL_SHARED_ID }
