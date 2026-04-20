import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execSync } from 'node:child_process'
import { readFile, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { existsSync } from 'node:fs'

const PLAYGROUND_ROOT = resolve(import.meta.dirname, '../../playground')
const DIST_DIR = join(PLAYGROUND_ROOT, 'temp', 'dist-vite-build-test')

describe('direct vite build integration (page mode)', () => {
  beforeAll(async () => {
    await rm(DIST_DIR, { recursive: true, force: true })
    execSync('pnpm exec vite build --config vite.config.vite-build-test.ts', {
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

  it('generates nested route dist/test/index.html', () => {
    expect(existsSync(join(DIST_DIR, 'test', 'index.html'))).toBe(true)
  })

  it('index.html contains Lit SSR rendered markup', async () => {
    const content = await readFile(join(DIST_DIR, 'index.html'), 'utf-8')
    expect(content).toContain('<!doctype html>')
    expect(content).toContain('<home-page')
    expect(content).toContain('shadowrootmode')
  })

  it('index.html has correct title from defineLitRoute', async () => {
    const content = await readFile(join(DIST_DIR, 'index.html'), 'utf-8')
    expect(content).toContain('<title>Home | vite-plugin-lit-ssg</title>')
  })

  it('index.html injects client JS', async () => {
    const content = await readFile(join(DIST_DIR, 'index.html'), 'utf-8')
    expect(content).toContain('<script type="module"')
  })

  it('about page has correct title from defineLitRoute', async () => {
    const content = await readFile(join(DIST_DIR, 'about', 'index.html'), 'utf-8')
    expect(content).toContain('<title>About | vite-plugin-lit-ssg</title>')
    expect(content).toContain('<about-page')
  })

  it('cleans up server build temp directory', () => {
    const serverBuildDir = join(PLAYGROUND_ROOT, '.vite-ssg', 'server')
    expect(existsSync(serverBuildDir)).toBe(false)
  })

  it('manifest.json exists in dist', () => {
    expect(existsSync(join(DIST_DIR, '.vite', 'manifest.json'))).toBe(true)
  })
})
