import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execSync } from 'node:child_process'
import { readFile, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { existsSync } from 'node:fs'

const PLAYGROUND_ROOT = resolve(import.meta.dirname, '../../playground')
const DIST_DIR = join(PLAYGROUND_ROOT, 'temp', 'dist-convention-test')

describe('SSG convention-based integration', () => {
  beforeAll(async () => {
    await rm(DIST_DIR, { recursive: true, force: true })
    execSync('pnpm vite-lit-ssg build --config vite.config.convention-test.ts', {
      cwd: PLAYGROUND_ROOT,
      stdio: 'pipe',
    })
  }, 120_000)

  afterAll(async () => {
    await rm(DIST_DIR, { recursive: true, force: true })
  })

  it('generates dist/index.html', () => {
    expect(existsSync(join(DIST_DIR, 'index.html'))).toBe(true)
  })

  it('generates dist/about/index.html', () => {
    expect(existsSync(join(DIST_DIR, 'about', 'index.html'))).toBe(true)
  })

  it('index.html contains Lit SSR rendered markup', async () => {
    const content = await readFile(join(DIST_DIR, 'index.html'), 'utf-8')
    expect(content).toContain('<!doctype html>')
    expect(content).toContain('<home-page')
    expect(content).toContain('shadowrootmode')
    expect(content).toContain('Welcome to vite-plugin-lit-ssg')
  })

  it('index.html has correct title from defineLitRoute', async () => {
    const content = await readFile(join(DIST_DIR, 'index.html'), 'utf-8')
    expect(content).toContain('<title>Home | vite-plugin-lit-ssg</title>')
  })

  it('index.html injects client JS', async () => {
    const content = await readFile(join(DIST_DIR, 'index.html'), 'utf-8')
    expect(content).toContain('<script type="module"')
  })

  it('about page has correct content and title from defineLitRoute', async () => {
    const content = await readFile(join(DIST_DIR, 'about', 'index.html'), 'utf-8')
    expect(content).toContain('<title>About | vite-plugin-lit-ssg</title>')
    expect(content).toContain('<about-page')
    expect(content).toContain('Build-time prerendering')
  })

  it('about page injects meta description from defineLitRoute', async () => {
    const content = await readFile(join(DIST_DIR, 'about', 'index.html'), 'utf-8')
    expect(content).toContain('name="description"')
    expect(content).toContain('content="About vite-plugin-lit-ssg"')
  })

  it('cleans up server build temp directory', () => {
    const serverBuildDir = join(PLAYGROUND_ROOT, '.vite-ssg', 'server')
    expect(existsSync(serverBuildDir)).toBe(false)
  })

  it('no entry-server.ts or entry-client.ts in playground src', () => {
    expect(existsSync(join(PLAYGROUND_ROOT, 'src', 'entry-server.ts'))).toBe(false)
    expect(existsSync(join(PLAYGROUND_ROOT, 'src', 'entry-client.ts'))).toBe(false)
  })

  it('index.html has dsd-pending attribute on body for hydration', async () => {
    const content = await readFile(join(DIST_DIR, 'index.html'), 'utf-8')
    expect(content).toContain('<body dsd-pending')
  })

  it('index.html has DSD feature-detection script', async () => {
    const content = await readFile(join(DIST_DIR, 'index.html'), 'utf-8')
    expect(content).toContain("'shadowrootmode'in HTMLTemplateElement.prototype")
  })

  it('index.html has DSD polyfill async loader', async () => {
    const content = await readFile(join(DIST_DIR, 'index.html'), 'utf-8')
    expect(content).toContain('hydrateShadowRoots')
  })
})
