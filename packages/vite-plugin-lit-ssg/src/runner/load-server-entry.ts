import { pathToFileURL } from 'node:url'
import type { ServerEntry } from '../types'

export async function loadServerEntry(entryPath: string): Promise<ServerEntry> {
  const entryUrl = pathToFileURL(entryPath).href

  const mod = await import(/* webpackIgnore: true */ entryUrl)

  if (
    typeof mod !== 'object' ||
    mod === null ||
    typeof (mod as Record<string, unknown>)['render'] !== 'function'
  ) {
    throw new Error(
      `[vite-plugin-lit-ssg] Server entry at "${entryPath}" must export a \`render\` function`,
    )
  }

  return mod as ServerEntry
}
