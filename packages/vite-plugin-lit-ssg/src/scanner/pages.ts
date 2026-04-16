import { resolve, relative, sep } from 'node:path'
import { access } from 'node:fs/promises'
import { glob } from 'tinyglobby'

export interface PageEntry {
  /** Absolute path to the page file */
  filePath: string
  /** Path relative to project root for import (e.g. '/src/pages/about.ts') */
  importPath: string
  /** Route path (e.g. '/about') */
  route: string
  /** Relative slug without extension (e.g. 'blog/post', 'index') */
  slug: string
}

export type IgnoreOption = string | ((relPath: string) => boolean)

export interface ScanPagesOptions {
  /**
   * Directory to scan for page files, relative to project root.
   * @default 'src/pages'
   */
  pagesDir?: string

  /**
   * Directories or files to ignore.
   * - string: skip any file whose relative path includes a segment matching this string
   * - function: called with the relative path (forward-slash separated); return true to skip
   */
  ignore?: IgnoreOption | IgnoreOption[]
}

const SUPPORTED_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js']

function normalizePagesDirPath(pagesDir: string): string {
  return pagesDir.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '')
}

function shouldIgnore(relPath: string, ignore: IgnoreOption[]): boolean {
  const segments = relPath.split('/')
  for (const rule of ignore) {
    if (typeof rule === 'function') {
      if (rule(relPath)) return true
    } else {
      if (segments.some((seg) => seg === rule)) return true
    }
  }
  return false
}

export async function scanPages(
  projectRoot: string,
  pagsDirOrOptions: string | ScanPagesOptions = 'src/pages',
): Promise<PageEntry[]> {
  let pagesDir: string
  let ignoreRules: IgnoreOption[]

  if (typeof pagsDirOrOptions === 'string') {
    pagesDir = normalizePagesDirPath(pagsDirOrOptions)
    ignoreRules = []
  } else {
    pagesDir = normalizePagesDirPath(pagsDirOrOptions.pagesDir ?? 'src/pages')
    const raw = pagsDirOrOptions.ignore
    ignoreRules = raw == null ? [] : Array.isArray(raw) ? raw : [raw]
  }

  const absolutePagesDir = resolve(projectRoot, pagesDir)

  try {
    await access(absolutePagesDir)
  } catch {
    throw new Error(
      `[vite-plugin-lit-ssg] Pages directory not found: ${absolutePagesDir}. Create ${pagesDir}/ and add at least one page file.`,
    )
  }

  const files = await glob('**/*{.ts,.tsx,.js,.jsx}', {
    cwd: absolutePagesDir,
    absolute: true,
    ignore: ['**/*.d.ts'],
  })

  const filtered = files.filter((filePath) => {
    const relPath = relative(absolutePagesDir, filePath).split(sep).join('/')
    return !shouldIgnore(relPath, ignoreRules)
  })

  if (filtered.length === 0) {
    throw new Error(
      `[vite-plugin-lit-ssg] No page files found in ${absolutePagesDir}. Add at least one page file to generate routes.`,
    )
  }

  const entries = filtered
    .sort()
    .map((filePath) => {
      const relPath = relative(absolutePagesDir, filePath)
      const normalized = relPath.split(sep).join('/')
      const ext = SUPPORTED_EXTENSIONS.find((e) => normalized.endsWith(e))!
      const slug = normalized.slice(0, -ext.length)
      const importPath = `/${pagesDir}/${normalized}`
      const route = filePathToRoute(normalized)
      return { filePath, importPath, route, slug }
    })

  const routesSeen = new Map<string, string>()
  for (const entry of entries) {
    if (routesSeen.has(entry.route)) {
      throw new Error(
        `[vite-plugin-lit-ssg] Duplicate route "${entry.route}" detected. ` +
          `"${entry.importPath}" and "${routesSeen.get(entry.route)}" resolve to the same route.`,
      )
    }
    routesSeen.set(entry.route, entry.importPath)
  }

  return entries
}

function filePathToRoute(normalizedRelPath: string): string {
  const ext = SUPPORTED_EXTENSIONS.find((e) => normalizedRelPath.endsWith(e)) ?? '.ts'
  const withoutExt = normalizedRelPath.slice(0, -ext.length)
  const segments = withoutExt.split('/')
  const lastIdx = segments.length - 1
  const cleaned = segments
    .map((seg, i) => (i === lastIdx && seg === 'index' ? '' : seg))
    .filter(Boolean)
  return '/' + cleaned.join('/')
}
