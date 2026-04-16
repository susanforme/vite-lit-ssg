import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execSync } from 'node:child_process'
import { readFile, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { existsSync } from 'node:fs'

const FIXTURE_ROOT = resolve(import.meta.dirname, '../fixtures/single-component-app')

const DIST_INHERIT = join(FIXTURE_ROOT, 'dist-test-inherit')
const DIST_NONE = join(FIXTURE_ROOT, 'dist-test-none')
const DIST_ENTRY_ONLY = join(FIXTURE_ROOT, 'dist-test-entry-only')

describe('single-component SSG integration', () => {
  beforeAll(async () => {
    await rm(DIST_INHERIT, { recursive: true, force: true })
    await rm(DIST_NONE, { recursive: true, force: true })
    await rm(DIST_ENTRY_ONLY, { recursive: true, force: true })

    execSync('pnpm vite-lit-ssg build --config vite.config.ts', {
      cwd: FIXTURE_ROOT,
      stdio: 'pipe',
    })
    execSync('pnpm vite-lit-ssg build --config vite.config.none.ts', {
      cwd: FIXTURE_ROOT,
      stdio: 'pipe',
    })
    execSync('pnpm vite-lit-ssg build --config vite.config.entry-only.ts', {
      cwd: FIXTURE_ROOT,
      stdio: 'pipe',
    })
  }, 240_000)

  afterAll(async () => {
    await rm(DIST_INHERIT, { recursive: true, force: true })
    await rm(DIST_NONE, { recursive: true, force: true })
    await rm(DIST_ENTRY_ONLY, { recursive: true, force: true })
  })

  it('generates dist/index.html (inherit)', () => {
    expect(existsSync(join(DIST_INHERIT, 'index.html'))).toBe(true)
  })

  it('generates client JS assets (inherit)', () => {
    expect(existsSync(join(DIST_INHERIT, 'assets'))).toBe(true)
  })

  it('index.html contains wrapper tag', async () => {
    const content = await readFile(join(DIST_INHERIT, 'index.html'), 'utf-8')
    expect(content).toContain('<demo-app-root>')
    expect(content).toContain('</demo-app-root>')
  })

  it('index.html contains component DSD markup', async () => {
    const content = await readFile(join(DIST_INHERIT, 'index.html'), 'utf-8')
    expect(content).toContain('demo-widget')
    expect(content).toContain('shadowrootmode')
  })

  it('index.html has module script', async () => {
    const content = await readFile(join(DIST_INHERIT, 'index.html'), 'utf-8')
    expect(content).toContain('<script type="module"')
  })

  it('index.html has dsd-pending', async () => {
    const content = await readFile(join(DIST_INHERIT, 'index.html'), 'utf-8')
    expect(content).toContain('dsd-pending')
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

  describe('preload variants', () => {
    it('inherit: produces valid html like other modes', async () => {
      const content = await readFile(join(DIST_INHERIT, 'index.html'), 'utf-8')
      expect(content).toContain('<demo-app-root>')
    })

    it('none: has no modulepreload links', async () => {
      const content = await readFile(join(DIST_NONE, 'index.html'), 'utf-8')
      expect(content).not.toContain('<link rel="modulepreload"')
    })

    it('none: still has client script', async () => {
      const content = await readFile(join(DIST_NONE, 'index.html'), 'utf-8')
      expect(content).toContain('<script type="module"')
    })

    it('entry-only: has no modulepreload links', async () => {
      const content = await readFile(join(DIST_ENTRY_ONLY, 'index.html'), 'utf-8')
      expect(content).not.toContain('<link rel="modulepreload"')
    })

    it('entry-only: has no css links', async () => {
      const content = await readFile(join(DIST_ENTRY_ONLY, 'index.html'), 'utf-8')
      expect(content).not.toContain('<link rel="stylesheet"')
    })

    it('entry-only: still has client script', async () => {
      const content = await readFile(join(DIST_ENTRY_ONLY, 'index.html'), 'utf-8')
      expect(content).toContain('<script type="module"')
    })
  })
})
