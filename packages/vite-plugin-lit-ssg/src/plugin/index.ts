import type { Plugin } from 'vite'
import type { LitSSGOptions, ResolvedLitSSGOptions } from '../types.js'

const PLUGIN_NAME = 'vite-plugin-lit-ssg'

const registeredOptions = new WeakMap<object, ResolvedLitSSGOptions>()

export function litSSG(options: LitSSGOptions): Plugin {
  const resolved: ResolvedLitSSGOptions = {
    entryServer: options.entryServer,
    entryClient: options.entryClient,
    routes: options.routes,
    outDir: options.outDir ?? 'dist',
  }

  validateOptions(resolved)

  const plugin: Plugin = {
    name: PLUGIN_NAME,
    config() {
      return {
        build: {
          manifest: true,
        },
      }
    },
  }

  registeredOptions.set(plugin, resolved)

  return plugin
}

export function getSSGOptions(plugin: object): ResolvedLitSSGOptions | undefined {
  return registeredOptions.get(plugin)
}

export { PLUGIN_NAME }

function validateOptions(opts: ResolvedLitSSGOptions): void {
  if (!opts.entryServer) {
    throw new Error(`[${PLUGIN_NAME}] \`entryServer\` is required`)
  }
  if (!opts.entryClient) {
    throw new Error(`[${PLUGIN_NAME}] \`entryClient\` is required`)
  }
  if (!opts.routes) {
    throw new Error(`[${PLUGIN_NAME}] \`routes\` is required`)
  }
}
