import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { AssetLinks, ViteManifest } from '../types.js'

export async function readManifest(outDir: string): Promise<ViteManifest> {
  const manifestPath = join(outDir, '.vite', 'manifest.json')
  const raw = await readFile(manifestPath, 'utf-8')
  return JSON.parse(raw) as ViteManifest
}

export function resolveAssetsFromManifest(
  manifest: ViteManifest,
  base: string,
  routeDepth: number = 0,
): AssetLinks {
  const entryItems = Object.entries(manifest).filter(([, v]) => v.isEntry)

  if (entryItems.length === 0) {
    throw new Error(
      '[vite-plugin-lit-ssg] No isEntry item found in manifest. Make sure the client build has an entry point.',
    )
  }

  if (entryItems.length > 1) {
    console.warn(
      `[vite-plugin-lit-ssg] Multiple isEntry items found in manifest (${entryItems.length}). Using the first one.`,
    )
  }

  const [entryKey, entry] = entryItems[0]!

  const isRelativeBase = isRelative(base)

  const js = formatHref(base, entry.file, isRelativeBase, routeDepth)
  const css = collectCss(manifest, entryKey, base, isRelativeBase, routeDepth)
  const modulepreloads = collectModulePreloads(manifest, entry.imports ?? [], base, isRelativeBase, routeDepth)

  return { js, css, modulepreloads }
}

function collectCss(
  manifest: ViteManifest,
  entryKey: string,
  base: string,
  isRelativeBase: boolean,
  routeDepth: number,
  visited = new Set<string>(),
): string[] {
  if (visited.has(entryKey)) return []
  visited.add(entryKey)

  const chunk = manifest[entryKey]
  if (!chunk) return []

  const hrefs: string[] = (chunk.css ?? []).map((f) =>
    formatHref(base, f, isRelativeBase, routeDepth),
  )

  for (const importKey of chunk.imports ?? []) {
    hrefs.push(...collectCss(manifest, importKey, base, isRelativeBase, routeDepth, visited))
  }

  return hrefs
}

function collectModulePreloads(
  manifest: ViteManifest,
  importKeys: string[],
  base: string,
  isRelativeBase: boolean,
  routeDepth: number,
  visited = new Set<string>(),
): string[] {
  const hrefs: string[] = []

  for (const key of importKeys) {
    if (visited.has(key)) continue
    visited.add(key)

    const chunk = manifest[key]
    if (!chunk) continue

    hrefs.push(formatHref(base, chunk.file, isRelativeBase, routeDepth))

    if (chunk.imports) {
      hrefs.push(...collectModulePreloads(manifest, chunk.imports, base, isRelativeBase, routeDepth, visited))
    }
  }

  return hrefs
}

function normalizeEntryKey(entry: string): string {
  return entry.startsWith('/') ? entry.slice(1) : entry
}

function isRelative(base: string): boolean {
  return base === '' || base === './' || base === '.'
}

function formatHref(base: string, file: string, relativeBase: boolean, depth: number): string {
  if (relativeBase) {
    const prefix = depth === 0 ? './' : '../'.repeat(depth)
    return `${prefix}${file}`
  }

  if (!base || base === '/') return `/${file}`
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  return `${normalizedBase}${file}`
}
