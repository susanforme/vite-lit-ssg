import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execSync } from 'node:child_process'
import { readFile, rm, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { existsSync } from 'node:fs'

const FIXTURE_ROOT = resolve(import.meta.dirname, '../fixtures/single-component-app')

const DIST_INHERIT = join(FIXTURE_ROOT, 'temp', 'dist-test-inherit')

describe('single-component SSG integration', () => {
  beforeAll(async () => {
    await rm(DIST_INHERIT, { recursive: true, force: true })

    execSync('pnpm vite-lit-ssg build --config vite.config.ts', {
      cwd: FIXTURE_ROOT,
      stdio: 'pipe',
    })
  }, 120_000)

  afterAll(async () => {
    await rm(DIST_INHERIT, { recursive: true, force: true })
  })

  it('generates index.html', () => {
    expect(existsSync(join(DIST_INHERIT, 'index.html'))).toBe(true)
  })

  it('index.html contains wrapper tag', async () => {
    const content = await readFile(join(DIST_INHERIT, 'index.html'), 'utf-8')
    expect(content).toContain('<demo-app-root>')
    expect(content).toContain('</demo-app-root>')
  })

  it('index.html is fully contained in wrapper — script inside wrapper', async () => {
    const content = await readFile(join(DIST_INHERIT, 'index.html'), 'utf-8')
    expect(content.trim()).toMatch(/^<demo-app-root>[\s\S]*<\/demo-app-root>$/)
    const scriptIdx = content.indexOf('<script type="module"')
    const closingIdx = content.indexOf('</demo-app-root>')
    expect(scriptIdx).toBeGreaterThan(-1)
    expect(closingIdx).toBeGreaterThan(scriptIdx)
  })

  it('index.html contains client hydration script', async () => {
    const content = await readFile(join(DIST_INHERIT, 'index.html'), 'utf-8')
    expect(content).toContain('<script type="module" src=')
  })

  it('index.html contains component DSD markup', async () => {
    const content = await readFile(join(DIST_INHERIT, 'index.html'), 'utf-8')
    expect(content).toContain('demo-widget')
    expect(content).toContain('shadowrootmode')
  })

  it('index.html has no html shell (no doctype, no <html>, no <body>)', async () => {
    const content = await readFile(join(DIST_INHERIT, 'index.html'), 'utf-8')
    expect(content).not.toContain('<!doctype')
    expect(content).not.toContain('<html')
    expect(content).not.toContain('<body')
  })

  it('index.html has no page-level title', async () => {
    const content = await readFile(join(DIST_INHERIT, 'index.html'), 'utf-8')
    expect(content).not.toContain('<title>')
  })

  it('index.html has no lang on html element', async () => {
    const content = await readFile(join(DIST_INHERIT, 'index.html'), 'utf-8')
    expect(content).not.toContain('lang=')
  })

  it('does not generate about/index.html (single-component has no sub-routes)', () => {
    expect(existsSync(join(DIST_INHERIT, 'about', 'index.html'))).toBe(false)
  })

  it('cleans up server build temp directory', () => {
    expect(existsSync(join(FIXTURE_ROOT, '.vite-ssg', 'server'))).toBe(false)
  })

  it('built client bundle contains Lit hydration runtime', async () => {
    const assetsDir = join(DIST_INHERIT, 'assets')
    const files = await readdir(assetsDir)
    const jsFiles = files.filter((f) => f.endsWith('.js'))
    expect(jsFiles.length).toBeGreaterThan(0)
    const bundleContents = await Promise.all(
      jsFiles.map((f) => readFile(join(assetsDir, f), 'utf-8')),
    )
    const combined = bundleContents.join('\n')
    expect(combined).toContain('litElementHydrateSupport')
  })
})

describe('named export integration', () => {
  const DIST_NAMED = join(FIXTURE_ROOT, 'temp', 'dist-test-named-export')

  beforeAll(async () => {
    await rm(DIST_NAMED, { recursive: true, force: true })
    execSync('pnpm vite-lit-ssg build --config vite.config.named-export.ts', {
      cwd: FIXTURE_ROOT,
      stdio: 'pipe',
    })
  }, 120_000)

  afterAll(async () => {
    await rm(DIST_NAMED, { recursive: true, force: true })
  })

  it('generates index.html with named export wrapper tag', async () => {
    const content = await readFile(join(DIST_NAMED, 'index.html'), 'utf-8')
    expect(content).toContain('<demo-named-root>')
    expect(content).toContain('</demo-named-root>')
  })

  it('index.html is fully contained in wrapper for named export', async () => {
    const content = await readFile(join(DIST_NAMED, 'index.html'), 'utf-8')
    expect(content.trim()).toMatch(/^<demo-named-root>[\s\S]*<\/demo-named-root>$/)
    const scriptIdx = content.indexOf('<script type="module"')
    const closingIdx = content.indexOf('</demo-named-root>')
    expect(scriptIdx).toBeGreaterThan(-1)
    expect(closingIdx).toBeGreaterThan(scriptIdx)
  })

  it('generates DSD markup for named export component', async () => {
    const content = await readFile(join(DIST_NAMED, 'index.html'), 'utf-8')
    expect(content).toContain('demo-widget')
    expect(content).toContain('shadowrootmode')
  })
})

describe('preload=none integration', () => {
  const DIST_NONE = join(FIXTURE_ROOT, 'temp', 'dist-test-none')

  beforeAll(async () => {
    await rm(DIST_NONE, { recursive: true, force: true })
    execSync('pnpm vite-lit-ssg build --config vite.config.none.ts', {
      cwd: FIXTURE_ROOT,
      stdio: 'pipe',
    })
  }, 120_000)

  afterAll(async () => {
    await rm(DIST_NONE, { recursive: true, force: true })
  })

  it('generates index.html', () => {
    expect(existsSync(join(DIST_NONE, 'index.html'))).toBe(true)
  })

  it('index.html contains client hydration script', async () => {
    const content = await readFile(join(DIST_NONE, 'index.html'), 'utf-8')
    expect(content).toContain('<script type="module" src=')
  })

  it('index.html has no modulepreload links', async () => {
    const content = await readFile(join(DIST_NONE, 'index.html'), 'utf-8')
    expect(content).not.toContain('rel="modulepreload"')
  })

  it('index.html has no html shell', async () => {
    const content = await readFile(join(DIST_NONE, 'index.html'), 'utf-8')
    expect(content).not.toContain('<!doctype')
    expect(content).not.toContain('<html')
  })

  it('built client bundle contains Lit hydration runtime', async () => {
    const assetsDir = join(DIST_NONE, 'assets')
    const files = await readdir(assetsDir)
    const jsFiles = files.filter((f) => f.endsWith('.js'))
    const bundleContents = await Promise.all(
      jsFiles.map((f) => readFile(join(assetsDir, f), 'utf-8')),
    )
    expect(bundleContents.join('\n')).toContain('litElementHydrateSupport')
  })
})

describe('preload=entry-only integration', () => {
  const DIST_ENTRY_ONLY = join(FIXTURE_ROOT, 'temp', 'dist-test-entry-only')

  beforeAll(async () => {
    await rm(DIST_ENTRY_ONLY, { recursive: true, force: true })
    execSync('pnpm vite-lit-ssg build --config vite.config.entry-only.ts', {
      cwd: FIXTURE_ROOT,
      stdio: 'pipe',
    })
  }, 120_000)

  afterAll(async () => {
    await rm(DIST_ENTRY_ONLY, { recursive: true, force: true })
  })

  it('generates index.html', () => {
    expect(existsSync(join(DIST_ENTRY_ONLY, 'index.html'))).toBe(true)
  })

  it('index.html contains client hydration script', async () => {
    const content = await readFile(join(DIST_ENTRY_ONLY, 'index.html'), 'utf-8')
    expect(content).toContain('<script type="module" src=')
  })

  it('index.html has no modulepreload links', async () => {
    const content = await readFile(join(DIST_ENTRY_ONLY, 'index.html'), 'utf-8')
    expect(content).not.toContain('rel="modulepreload"')
  })

  it('index.html has no stylesheet links', async () => {
    const content = await readFile(join(DIST_ENTRY_ONLY, 'index.html'), 'utf-8')
    expect(content).not.toContain('rel="stylesheet"')
  })

  it('index.html has no html shell', async () => {
    const content = await readFile(join(DIST_ENTRY_ONLY, 'index.html'), 'utf-8')
    expect(content).not.toContain('<!doctype')
    expect(content).not.toContain('<html')
  })

  it('built client bundle contains Lit hydration runtime', async () => {
    const assetsDir = join(DIST_ENTRY_ONLY, 'assets')
    const files = await readdir(assetsDir)
    const jsFiles = files.filter((f) => f.endsWith('.js'))
    const bundleContents = await Promise.all(
      jsFiles.map((f) => readFile(join(assetsDir, f), 'utf-8')),
    )
    expect(bundleContents.join('\n')).toContain('litElementHydrateSupport')
  })
})
