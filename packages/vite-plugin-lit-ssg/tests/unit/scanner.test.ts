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

  it('throws when pages directory is empty (no page files)', async () => {
    await expect(scanPages(tmpRoot, 'src/pages')).rejects.toThrow('No page files found')
  })

  it('ignores non-page files', async () => {
    await writeFile(join(pagesDir, 'index.ts'), '')
    await writeFile(join(pagesDir, 'readme.md'), '')
    await writeFile(join(pagesDir, 'styles.css'), '')
    await writeFile(join(pagesDir, 'types.d.ts'), '')
    const pages = await scanPages(tmpRoot, 'src/pages')
    expect(pages).toHaveLength(1)
  })

  it('includes absolute filePath', async () => {
    await writeFile(join(pagesDir, 'index.ts'), '')
    const pages = await scanPages(tmpRoot, 'src/pages')
    expect(pages[0]!.filePath).toBe(join(pagesDir, 'index.ts'))
  })

  describe('multi-extension support', () => {
    it('maps test.ts to route /test', async () => {
      await writeFile(join(pagesDir, 'test.ts'), '')
      const pages = await scanPages(tmpRoot, 'src/pages')
      expect(pages.find((p) => p.route === '/test')).toBeDefined()
    })

    it('maps test.js to route /test', async () => {
      await writeFile(join(pagesDir, 'test.js'), '')
      const pages = await scanPages(tmpRoot, 'src/pages')
      expect(pages.find((p) => p.route === '/test')).toBeDefined()
    })

    it('maps test/index.ts to route /test', async () => {
      await mkdir(join(pagesDir, 'test'), { recursive: true })
      await writeFile(join(pagesDir, 'test', 'index.ts'), '')
      const pages = await scanPages(tmpRoot, 'src/pages')
      expect(pages.find((p) => p.route === '/test')).toBeDefined()
    })

    it('maps test/index.js to route /test', async () => {
      await mkdir(join(pagesDir, 'test'), { recursive: true })
      await writeFile(join(pagesDir, 'test', 'index.js'), '')
      const pages = await scanPages(tmpRoot, 'src/pages')
      expect(pages.find((p) => p.route === '/test')).toBeDefined()
    })

    it('throws duplicate route when test.ts and test/index.ts both exist', async () => {
      await mkdir(join(pagesDir, 'test'), { recursive: true })
      await writeFile(join(pagesDir, 'test.ts'), '')
      await writeFile(join(pagesDir, 'test', 'index.ts'), '')
      await expect(scanPages(tmpRoot, 'src/pages')).rejects.toThrow('Duplicate route')
    })
  })

  describe('ScanPagesOptions object form', () => {
    it('accepts options object with pagesDir', async () => {
      await writeFile(join(pagesDir, 'index.ts'), '')
      const pages = await scanPages(tmpRoot, { pagesDir: 'src/pages' })
      expect(pages).toHaveLength(1)
    })

    it('normalizes pagesDir with leading ./', async () => {
      await writeFile(join(pagesDir, 'index.ts'), '')
      const pages = await scanPages(tmpRoot, { pagesDir: './src/pages' })
      expect(pages[0]!.importPath).toBe('/src/pages/index.ts')
    })

    it('normalizes pagesDir with trailing /', async () => {
      await writeFile(join(pagesDir, 'index.ts'), '')
      const pages = await scanPages(tmpRoot, { pagesDir: 'src/pages/' })
      expect(pages[0]!.importPath).toBe('/src/pages/index.ts')
    })
  })

  describe('ignore option', () => {
    it('skips files in ignored directory by string', async () => {
      const componentDir = join(pagesDir, 'components')
      await mkdir(componentDir, { recursive: true })
      await writeFile(join(pagesDir, 'index.ts'), '')
      await writeFile(join(componentDir, 'button.ts'), '')
      const pages = await scanPages(tmpRoot, { pagesDir: 'src/pages', ignore: 'components' })
      expect(pages).toHaveLength(1)
      expect(pages[0]!.route).toBe('/')
    })

    it('skips files matching ignore function returning true', async () => {
      const componentDir = join(pagesDir, 'components')
      await mkdir(componentDir, { recursive: true })
      await writeFile(join(pagesDir, 'index.ts'), '')
      await writeFile(join(componentDir, 'button.ts'), '')
      const pages = await scanPages(tmpRoot, {
        pagesDir: 'src/pages',
        ignore: (relPath) => relPath.startsWith('components/'),
      })
      expect(pages).toHaveLength(1)
    })

    it('supports array of ignore rules', async () => {
      const compDir = join(pagesDir, 'components')
      const layoutDir = join(pagesDir, 'layouts')
      await mkdir(compDir, { recursive: true })
      await mkdir(layoutDir, { recursive: true })
      await writeFile(join(pagesDir, 'index.ts'), '')
      await writeFile(join(compDir, 'button.ts'), '')
      await writeFile(join(layoutDir, 'main.ts'), '')
      const pages = await scanPages(tmpRoot, {
        pagesDir: 'src/pages',
        ignore: ['components', 'layouts'],
      })
      expect(pages).toHaveLength(1)
    })
  })

  describe('nested routes', () => {
    it('maps test/a/index.ts to route /test/a', async () => {
      const nestedDir = join(pagesDir, 'test', 'a')
      await mkdir(nestedDir, { recursive: true })
      await writeFile(join(pagesDir, 'test', 'index.ts'), '')
      await writeFile(join(nestedDir, 'index.ts'), '')
      const pages = await scanPages(tmpRoot, 'src/pages')
      const routes = pages.map((p) => p.route).sort()
      expect(routes).toEqual(['/test', '/test/a'])
    })

    it('does NOT strip non-terminal index segment from route', async () => {
      const nestedDir = join(pagesDir, 'index')
      await mkdir(nestedDir, { recursive: true })
      await writeFile(join(nestedDir, 'a.ts'), '')
      const pages = await scanPages(tmpRoot, 'src/pages')
      expect(pages[0]!.route).toBe('/index/a')
    })
  })
})
