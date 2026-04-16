import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'
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

    resolveId(id) {
      if (id === VIRTUAL_SHARED_ID) return RESOLVED_VIRTUAL_SHARED_ID
      if (id === VIRTUAL_SERVER_ID) return RESOLVED_VIRTUAL_SERVER_ID
      if (id.startsWith(VIRTUAL_PAGE_PREFIX)) {
        return RESOLVED_VIRTUAL_PAGE_PREFIX + id.slice(VIRTUAL_PAGE_PREFIX.length)
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
        const page = state.pages.find((p) => {
          const fileName = p.importPath.split('/').pop()!
          return fileName.replace(/\.ts$/, '') === pageName
        })
        if (!page) {
          throw new Error(
            `[vite-plugin-lit-ssg] No page found for virtual module: ${id}. Available pages: ${state.pages.map((p) => p.importPath).join(', ')}`,
          )
        }
        const { generatePageEntry } = await import('../virtual/client-entry.js')
        return generatePageEntry(page)
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
