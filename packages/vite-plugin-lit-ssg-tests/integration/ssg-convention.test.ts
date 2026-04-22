import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFile, readdir, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { loadConfigFromFile } from 'vite'
import type { Plugin } from 'vite'
import { getPageInjectPolyfill, getSSGOptions } from '../../vite-plugin-lit-ssg/src/plugin/index.js'
import { runSSG } from '../../vite-plugin-lit-ssg/src/runner/build.js'
import { scanPages } from '../../vite-plugin-lit-ssg/src/scanner/pages.js'

const PLAYGROUND_ROOT = resolve(import.meta.dirname, '../../../playground/page-mode')
const DIST_DIR = join(PLAYGROUND_ROOT, 'temp', 'dist-convention-test')

async function runConventionBuild() {
  const configPath = resolve(PLAYGROUND_ROOT, 'vite.config.convention-test.ts')
  const loaded = await loadConfigFromFile(
    { command: 'build', mode: 'production' },
    configPath,
    PLAYGROUND_ROOT,
  )

  if (!loaded) {
    throw new Error(`Could not load Vite config from ${configPath}.`)
  }

  const { config, path: loadedConfigPath } = loaded
  const plugins = (config.plugins ?? []).flat() as Plugin[]
  const ssgPlugin = plugins.find((plugin) => getSSGOptions(plugin) != null)
  const ssgOptions = ssgPlugin ? getSSGOptions(ssgPlugin) : undefined

  if (!ssgPlugin || !ssgOptions) {
    throw new Error('Could not find litSSG() page-mode plugin in the convention-test Vite config.')
  }

  const pages = await scanPages(PLAYGROUND_ROOT, ssgOptions)

  await runSSG(
    pages,
    PLAYGROUND_ROOT,
    config.base ?? '/',
    config.build?.outDir ?? 'dist',
    { mode: 'production', configFile: loadedConfigPath },
    getPageInjectPolyfill(ssgPlugin),
  )
}

describe('SSG convention-based integration', () => {
  beforeAll(async () => {
    await rm(DIST_DIR, { recursive: true, force: true })
    await runConventionBuild()
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

  it('index.html contains prepended common component styles before local styles', async () => {
    const content = await readFile(join(DIST_DIR, 'index.html'), 'utf-8')
    expect(content).toContain('chartreuse')
    expect(content).toContain('color:red')
    expect(content.indexOf('chartreuse')).toBeLessThan(content.indexOf('color:red'))
  })

  it('index.html keeps commonStyles ordering while compressing the rendered page markup', async () => {
    const content = await readFile(join(DIST_DIR, 'index.html'), 'utf-8')
    expect(content).toContain('<style>:host{border-top:4px solid chartreuse}:host{display:block;font-family:sans-serif;max-width:800px;margin:0 auto;padding:2rem}h1{color:#333}nav a{margin-right:1rem;color:#06c;text-decoration:none}nav a:hover{text-decoration:underline}h1:hover{color:red}</style><nav><a href="/">Home</a><a href="/about">About</a></nav><h1>Welcome to vite-plugin-lit-ssg</h1><p>This page was statically generated using Lit SSR and Vite.</p><p>It supports LitElement with Shadow DOM, server-side rendering, and client-side hydration.</p><button>Click me</button>')
  })

  it('about page has correct content and title from defineLitRoute', async () => {
    const content = await readFile(join(DIST_DIR, 'about', 'index.html'), 'utf-8')
    expect(content).toContain('<title>About | vite-plugin-lit-ssg</title>')
    expect(content).toContain('<about-page')
    expect(content).toContain('Build-time prerendering')
  })

  it('about page applies common styles through static get styles()', async () => {
    const content = await readFile(join(DIST_DIR, 'about', 'index.html'), 'utf-8')
    expect(content).toContain('chartreuse')
    expect(content).toContain('rebeccapurple')
    expect(content.indexOf('chartreuse')).toBeLessThan(content.indexOf('rebeccapurple'))
  })

  it('about page still compresses static render markup after commonStyles rewrites', async () => {
    const content = await readFile(join(DIST_DIR, 'about', 'index.html'), 'utf-8')
    expect(content).toContain('<nav><a href="/">Home</a><a href="/about">About</a></nav><h1>About</h1><p>vite-plugin-lit-ssg is a Vite plugin for generating static sites with Lit.</p><ul><li>Build-time prerendering with Lit SSR</li><li>Automatic JS/CSS asset injection</li><li>Support for page-level title and meta tags</li><li>Deploy anywhere as static files</li></ul>')
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
    expect(content).toContain("'shadowRootMode'in HTMLTemplateElement.prototype")
  })

  it('index.html has DSD polyfill inline script', async () => {
    const content = await readFile(join(DIST_DIR, 'index.html'), 'utf-8')
    expect(content).toContain('hydrateShadowRoots')
  })

  it('commonStyles does not create top-level stylesheet links', async () => {
    const content = await readFile(join(DIST_DIR, 'index.html'), 'utf-8')
    expect(content).not.toContain('rel="stylesheet"')
  })

  it('built client hydration bundle also contains the common style marker', async () => {
    const assetsDir = join(DIST_DIR, 'assets')
    const files = (await readdir(assetsDir)).filter((file) => file.endsWith('.js'))
    const bundleContents = await Promise.all(files.map((file) => readFile(join(assetsDir, file), 'utf-8')))
    const combined = bundleContents.join('\n')
    expect(combined).toContain('chartreuse')
  })
})
