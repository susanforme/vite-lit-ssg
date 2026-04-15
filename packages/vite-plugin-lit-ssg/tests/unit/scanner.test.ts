import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { scanPages } from '../../src/scanner/pages.js'

describe('scanPages', () => {
  let tmpRoot: string
  let pagesDir: string

  beforeEach(async () => {
    tmpRoot = join(tmpdir(), `scanner-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    pagesDir = join(tmpRoot, 'src', 'pages')
    await mkdir(pagesDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(tmpRoot, { recursive: true, force: true })
  })

  it('maps index.ts to route /', async () => {
    await writeFile(join(pagesDir, 'index.ts'), '')
    const pages = await scanPages(tmpRoot, 'src/pages')
    const indexPage = pages.find((p) => p.route === '/')
    expect(indexPage).toBeDefined()
    expect(indexPage!.route).toBe('/')
    expect(indexPage!.importPath).toBe('/src/pages/index.ts')
  })

  it('maps about.ts to route /about', async () => {
    await writeFile(join(pagesDir, 'about.ts'), '')
    const pages = await scanPages(tmpRoot, 'src/pages')
    const aboutPage = pages.find((p) => p.route === '/about')
    expect(aboutPage).toBeDefined()
    expect(aboutPage!.route).toBe('/about')
    expect(aboutPage!.importPath).toBe('/src/pages/about.ts')
  })

  it('handles multiple pages correctly', async () => {
    await writeFile(join(pagesDir, 'index.ts'), '')
    await writeFile(join(pagesDir, 'about.ts'), '')
    const pages = await scanPages(tmpRoot, 'src/pages')
    expect(pages).toHaveLength(2)
    const routes = pages.map((p) => p.route).sort()
    expect(routes).toEqual(['/', '/about'])
  })

  it('preserves filename case (no conversion)', async () => {
    await writeFile(join(pagesDir, 'About.ts'), '')
    const pages = await scanPages(tmpRoot, 'src/pages')
    expect(pages[0]!.route).toBe('/About')
  })

  it('throws when pages directory does not exist', async () => {
    await expect(scanPages(tmpRoot, 'src/nonexistent')).rejects.toThrow(
      'Pages directory not found',
    )
  })

  it('throws when pages directory is empty (no .ts files)', async () => {
    await expect(scanPages(tmpRoot, 'src/pages')).rejects.toThrow('No page files found')
  })

  it('ignores non-.ts files', async () => {
    await writeFile(join(pagesDir, 'index.ts'), '')
    await writeFile(join(pagesDir, 'readme.md'), '')
    await writeFile(join(pagesDir, 'styles.css'), '')
    const pages = await scanPages(tmpRoot, 'src/pages')
    expect(pages).toHaveLength(1)
  })

  it('includes absolute filePath', async () => {
    await writeFile(join(pagesDir, 'index.ts'), '')
    const pages = await scanPages(tmpRoot, 'src/pages')
    expect(pages[0]!.filePath).toBe(join(pagesDir, 'index.ts'))
  })
})
