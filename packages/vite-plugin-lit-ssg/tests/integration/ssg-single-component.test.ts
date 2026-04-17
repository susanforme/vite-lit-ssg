import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execSync } from 'node:child_process'
import { readFile, rm } from 'node:fs/promises'
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

  it('index.html is wrapper-only — no scripts or links outside wrapper', async () => {
    const content = await readFile(join(DIST_INHERIT, 'index.html'), 'utf-8')
    expect(content.trim()).toMatch(/^<demo-app-root>[\s\S]*<\/demo-app-root>$/)
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

  it('index.html is wrapper-only for named export', async () => {
    const content = await readFile(join(DIST_NAMED, 'index.html'), 'utf-8')
    expect(content.trim()).toMatch(/^<demo-named-root>[\s\S]*<\/demo-named-root>$/)
  })

  it('generates DSD markup for named export component', async () => {
    const content = await readFile(join(DIST_NAMED, 'index.html'), 'utf-8')
    expect(content).toContain('demo-widget')
    expect(content).toContain('shadowrootmode')
  })
})
