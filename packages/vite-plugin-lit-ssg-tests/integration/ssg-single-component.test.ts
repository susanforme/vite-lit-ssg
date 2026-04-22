import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execSync } from 'node:child_process'
import { readFile, rm, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { existsSync } from 'node:fs'

const FIXTURE_ROOT = resolve(import.meta.dirname, '../fixtures/single-component-app')
const CLI_PATH = resolve(import.meta.dirname, '../../vite-plugin-lit-ssg/dist/cli.cjs')

const DIST_INHERIT = join(FIXTURE_ROOT, 'temp', 'dist-test-inherit')

function runFixtureBuild(configFile: string): void {
  execSync(`${JSON.stringify(process.execPath)} ${JSON.stringify(CLI_PATH)} build --config ${configFile}`, {
    cwd: FIXTURE_ROOT,
    stdio: 'pipe',
  })
}

describe('single-component SSG integration', () => {
  beforeAll(async () => {
    await rm(DIST_INHERIT, { recursive: true, force: true })

    runFixtureBuild('vite.config.ts')
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

  it('index.html contains prepended common component styles before local styles', async () => {
    const content = await readFile(join(DIST_INHERIT, 'index.html'), 'utf-8')
    expect(content).toContain('chartreuse')
    expect(content).toContain('color: blue;')
    expect(content.indexOf('chartreuse')).toBeLessThan(content.indexOf('color: blue;'))
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

  it('built client hydration bundle keeps the common style marker and minifies supported local templates', async () => {
    const assetsDir = join(DIST_INHERIT, 'assets')
    const files = await readdir(assetsDir)
    const jsFiles = files.filter((f) => f.endsWith('.js'))
    const bundleContents = await Promise.all(
      jsFiles.map((f) => readFile(join(assetsDir, f), 'utf-8')),
    )
    const combined = bundleContents.join('\n')
    expect(combined).toContain('chartreuse')
    expect(combined).toMatch(/:host\{(?:display:block;font-family:sans-serif|font-family:sans-serif;display:block)\}p\{(?:color:blue|color:#00f)\}/)
    expect(combined).not.toContain('font-family: sans-serif;')
    expect(combined).not.toContain('p { color: blue; }')
  })
})

describe('named export integration', () => {
  const DIST_NAMED = join(FIXTURE_ROOT, 'temp', 'dist-test-named-export')

  beforeAll(async () => {
    await rm(DIST_NAMED, { recursive: true, force: true })
    runFixtureBuild('vite.config.named-export.ts')
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

  it('named export build also includes common styles', async () => {
    const content = await readFile(join(DIST_NAMED, 'index.html'), 'utf-8')
    expect(content).toContain('chartreuse')
  })
})

describe('preload=none integration', () => {
  const DIST_NONE = join(FIXTURE_ROOT, 'temp', 'dist-test-none')

  beforeAll(async () => {
    await rm(DIST_NONE, { recursive: true, force: true })
    runFixtureBuild('vite.config.none.ts')
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

  it('preload=none still keeps common styles inside component styles instead of stylesheet links', async () => {
    const content = await readFile(join(DIST_NONE, 'index.html'), 'utf-8')
    expect(content).toContain('chartreuse')
    expect(content).not.toContain('rel="stylesheet"')
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
    runFixtureBuild('vite.config.entry-only.ts')
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

  it('preload=entry-only still keeps common styles inside component styles', async () => {
    const content = await readFile(join(DIST_ENTRY_ONLY, 'index.html'), 'utf-8')
    expect(content).toContain('chartreuse')
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
