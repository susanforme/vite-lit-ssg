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
  /** Unique relative slug without extension (e.g. 'blog/post', 'index') */
  slug: string
}

export async function scanPages(
  projectRoot: string,
  pagesDir: string = 'src/pages',
): Promise<PageEntry[]> {
  const absolutePagesDir = resolve(projectRoot, pagesDir)

  try {
    await access(absolutePagesDir)
  } catch {
    throw new Error(
      `[vite-plugin-lit-ssg] Pages directory not found: ${absolutePagesDir}. Create ${pagesDir}/ and add at least one page file.`,
    )
  }

  const files = await glob('**/*.ts', {
    cwd: absolutePagesDir,
    absolute: true,
  })

  if (files.length === 0) {
    throw new Error(
      `[vite-plugin-lit-ssg] No page files found in ${absolutePagesDir}. Add at least one .ts file to generate routes.`,
    )
  }

  const entries = files
    .sort()
    .map((filePath) => {
      const relPath = relative(absolutePagesDir, filePath)
      const normalized = relPath.split(sep).join('/')
      const slug = normalized.slice(0, -3)
      const importPath = `/${pagesDir}/${normalized}`
      const route = filePathToRoute(normalized)
      return { filePath, importPath, route, slug }
    })

  const routesSeen = new Set<string>()
  for (const entry of entries) {
    if (routesSeen.has(entry.route)) {
      throw new Error(
        `[vite-plugin-lit-ssg] Duplicate route "${entry.route}" detected. Multiple page files resolve to the same route.`,
      )
    }
    routesSeen.add(entry.route)
  }

  return entries
}

function filePathToRoute(normalizedRelPath: string): string {
  const withoutExt = normalizedRelPath.slice(0, -3)
  const segments = withoutExt.split('/')
  const cleaned = segments.map((seg) => (seg === 'index' ? '' : seg)).filter(Boolean)
  return '/' + cleaned.join('/')
}
