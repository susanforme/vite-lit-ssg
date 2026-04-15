import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFile, rm, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { runSSG } from '../../src/runner/build.js'
import type { ResolvedLitSSGOptions } from '../../src/types.js'

const PLAYGROUND_ROOT = resolve(import.meta.dirname, '../../../playground')
const DIST_DIR = join(PLAYGROUND_ROOT, 'dist-test')

const opts: ResolvedLitSSGOptions = {
  entryServer: '/src/entry-server.ts',
  entryClient: '/src/entry-client.ts',
  routes: ['/', '/about'],
  outDir: 'dist-test',
}

describe('SSG integration', () => {
  beforeAll(async () => {
    await rm(DIST_DIR, { recursive: true, force: true })
    await runSSG(opts, PLAYGROUND_ROOT, '/')
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
    expect(content).toContain('<home-page>')
    expect(content).toContain('shadowrootmode')
    expect(content).toContain('Welcome to vite-plugin-lit-ssg')
  })

  it('index.html has correct title', async () => {
    const content = await readFile(join(DIST_DIR, 'index.html'), 'utf-8')
    expect(content).toContain('<title>Home | vite-plugin-lit-ssg</title>')
  })

  it('index.html injects client JS', async () => {
    const content = await readFile(join(DIST_DIR, 'index.html'), 'utf-8')
    expect(content).toContain('<script type="module" src="/')
    expect(content).toContain('entry-client')
  })

  it('about page has correct content and title', async () => {
    const content = await readFile(join(DIST_DIR, 'about', 'index.html'), 'utf-8')
    expect(content).toContain('<title>About | vite-plugin-lit-ssg</title>')
    expect(content).toContain('<about-page>')
    expect(content).toContain('Build-time prerendering')
  })

  it('about page injects meta description', async () => {
    const content = await readFile(join(DIST_DIR, 'about', 'index.html'), 'utf-8')
    expect(content).toContain('name="description"')
    expect(content).toContain('content="About vite-plugin-lit-ssg"')
  })

  it('cleans up server build temp directory', () => {
    const serverBuildDir = join(PLAYGROUND_ROOT, '.vite-ssg', 'server')
    expect(existsSync(serverBuildDir)).toBe(false)
  })

  it('does not generate html for a null-rendered route', async () => {
    const optsWithNull: ResolvedLitSSGOptions = {
      entryServer: '/src/entry-server.ts',
      entryClient: '/src/entry-client.ts',
      routes: ['/nonexistent-route'],
      outDir: 'dist-null-test',
    }
    const distNull = join(PLAYGROUND_ROOT, 'dist-null-test')
    try {
      await runSSG(optsWithNull, PLAYGROUND_ROOT, '/')
      expect(existsSync(join(distNull, 'nonexistent-route', 'index.html'))).toBe(false)
    } finally {
      await rm(distNull, { recursive: true, force: true })
    }
  }, 120_000)

  it('uses /docs/ prefixed paths for base: /docs/', async () => {
    const docsOpts: ResolvedLitSSGOptions = {
      entryServer: '/src/entry-server.ts',
      entryClient: '/src/entry-client.ts',
      routes: ['/'],
      outDir: 'dist-docs-test',
    }
    const distDocs = join(PLAYGROUND_ROOT, 'dist-docs-test')
    try {
      await runSSG(docsOpts, PLAYGROUND_ROOT, '/docs/')
      const content = await readFile(join(distDocs, 'index.html'), 'utf-8')
      expect(content).toContain('/docs/assets/')
    } finally {
      await rm(distDocs, { recursive: true, force: true })
    }
  }, 120_000)

  it('uses relative paths for root route when base is "./"', async () => {
    const relOpts: ResolvedLitSSGOptions = {
      entryServer: '/src/entry-server.ts',
      entryClient: '/src/entry-client.ts',
      routes: ['/', '/about'],
      outDir: 'dist-rel-test',
    }
    const distRel = join(PLAYGROUND_ROOT, 'dist-rel-test')
    try {
      await runSSG(relOpts, PLAYGROUND_ROOT, './')
      const rootContent = await readFile(join(distRel, 'index.html'), 'utf-8')
      expect(rootContent).toContain('src="./assets/')
      const aboutContent = await readFile(join(distRel, 'about', 'index.html'), 'utf-8')
      expect(aboutContent).toContain('src="../assets/')
    } finally {
      await rm(distRel, { recursive: true, force: true })
    }
  }, 120_000)
})
