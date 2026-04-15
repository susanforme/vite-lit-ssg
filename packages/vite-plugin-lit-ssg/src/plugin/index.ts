import type { Plugin, ResolvedConfig } from 'vite'
import type { LitSSGOptionsNew } from '../types.js'
import { scanPages } from '../scanner/pages.js'
import { generateClientEntry } from '../virtual/client-entry.js'
import { generateServerEntry } from '../virtual/server-entry.js'
import type { PageEntry } from '../scanner/pages.js'

const PLUGIN_NAME = 'vite-plugin-lit-ssg'

const VIRTUAL_CLIENT_ID = 'virtual:lit-ssg-client'
const VIRTUAL_SERVER_ID = 'virtual:lit-ssg-server'
const RESOLVED_VIRTUAL_CLIENT_ID = '\0' + VIRTUAL_CLIENT_ID
const RESOLVED_VIRTUAL_SERVER_ID = '\0' + VIRTUAL_SERVER_ID

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
      return {
        build: {
          manifest: true,
        },
      }
    },

    configResolved(config) {
      state.resolvedConfig = config
    },

    async buildStart() {
      const root = state.resolvedConfig?.root ?? process.cwd()
      state.pages = await scanPages(root, pagesDir)
    },

    resolveId(id) {
      if (id === VIRTUAL_CLIENT_ID) return RESOLVED_VIRTUAL_CLIENT_ID
      if (id === VIRTUAL_SERVER_ID) return RESOLVED_VIRTUAL_SERVER_ID
      return undefined
    },

    load(id) {
      if (id === RESOLVED_VIRTUAL_CLIENT_ID) {
        return generateClientEntry(state.pages)
      }
      if (id === RESOLVED_VIRTUAL_SERVER_ID) {
        return generateServerEntry(state.pages)
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

export { PLUGIN_NAME }
