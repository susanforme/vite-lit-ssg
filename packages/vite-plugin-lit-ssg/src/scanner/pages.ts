import { readdir, access } from 'node:fs/promises'
import { join, resolve } from 'node:path'

export interface PageEntry {
  /** Absolute path to the page file */
  filePath: string
  /** Path relative to project root for import (e.g. '/src/pages/about.ts') */
  importPath: string
  /** Route path (e.g. '/about') */
  route: string
}

/**
 * Scans a flat pages directory for .ts files and maps them to routes.
 * Does NOT recurse into subdirectories.
 * Throws if directory doesn't exist or is empty.
 */
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

  const entries = await readdir(absolutePagesDir, { withFileTypes: true })

  const tsFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => entry.name)

  if (tsFiles.length === 0) {
    throw new Error(
      `[vite-plugin-lit-ssg] No page files found in ${absolutePagesDir}. Add at least one .ts file to generate routes.`,
    )
  }

  return tsFiles.map((fileName) => {
    const filePath = join(absolutePagesDir, fileName)
    const importPath = `/${pagesDir}/${fileName}`
    const route = fileNameToRoute(fileName)
    return { filePath, importPath, route }
  })
}

function fileNameToRoute(fileName: string): string {
  const name = fileName.slice(0, -3)
  if (name === 'index') return '/'
  return `/${name}`
}
