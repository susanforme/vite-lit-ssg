import { describe, it, expect, beforeAll } from 'vitest'
import { execSync } from 'node:child_process'
import { readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const PLAYGROUND_ROOT = resolve(import.meta.dirname, '../../../playground/page-mode')
const CLI_PATH = resolve(import.meta.dirname, '../../vite-plugin-lit-ssg/dist/cli.cjs')
const DIST_ROOT = join(PLAYGROUND_ROOT, 'temp', 'dist-flat-assets-test')
const DIST_ASSETS = join(DIST_ROOT, 'assets')

describe('flat asset output', () => {
  beforeAll(() => {
    execSync(`${JSON.stringify(process.execPath)} ${JSON.stringify(CLI_PATH)} build --config vite.config.flat-assets-test.ts`, { cwd: PLAYGROUND_ROOT, stdio: 'pipe' })
  }, 120_000)

  it('assets directory exists', () => {
    expect(existsSync(DIST_ASSETS)).toBe(true)
  })

  it('page entry scripts are flat — no lit-ssg-page subdirectory', () => {
    expect(existsSync(join(DIST_ASSETS, 'lit-ssg-page'))).toBe(false)
  })

  it('all page entry JS files are directly under assets with no nested page dirs', () => {
    const entries = readdirSync(DIST_ASSETS, { withFileTypes: true })
    const subdirs = entries.filter((e) => e.isDirectory()).map((e) => e.name)
    expect(subdirs).not.toContain('lit-ssg-page')
  })

  it('about page script is directly under assets', () => {
    const files = readdirSync(DIST_ASSETS)
    expect(files.some((f) => f.startsWith('about-') && f.endsWith('.js'))).toBe(true)
  })

  it('index page script is directly under assets', () => {
    const files = readdirSync(DIST_ASSETS)
    expect(files.some((f) => f.startsWith('index-') && f.endsWith('.js'))).toBe(true)
  })

  it('nested page test/child emits as test-child (flat, no subdir)', () => {
    const files = readdirSync(DIST_ASSETS)
    expect(files.some((f) => f.startsWith('test-child-') && f.endsWith('.js'))).toBe(true)
    expect(existsSync(join(DIST_ASSETS, 'test'))).toBe(false)
  })

  it('about html references flat asset path', () => {
    const html = require('node:fs').readFileSync(join(DIST_ROOT, 'about', 'index.html'), 'utf-8')
    expect(html).not.toContain('assets/lit-ssg-page/')
    expect(html).toMatch(/assets\/about-[^/]+\.js/)
  })

  it('commonStyles does not emit standalone CSS assets', () => {
    const files = readdirSync(DIST_ASSETS)
    expect(files.some((file) => file.endsWith('.css'))).toBe(false)
  })
})
