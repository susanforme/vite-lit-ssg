import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServer } from 'vite'
import { resolve } from 'node:path'
import type { AddressInfo } from 'node:net'
import { litSSG } from '../../vite-plugin-lit-ssg/src/plugin/index.js'

const FIXTURE_ROOT = resolve(import.meta.dirname, '../fixtures/single-component-app')

describe('single-component dev mode — HTML shell (base=/)', () => {
  let server: Awaited<ReturnType<typeof createServer>>
  let port: number

  beforeAll(async () => {
    server = await createServer({
      root: FIXTURE_ROOT,
      base: '/',
      plugins: [litSSG({
        mode: 'single-component',
        entry: 'src/demo-widget.ts',
        commonStyles: [{ file: 'src/common.css' }],
        wrapperTag: 'demo-app-root',
      })],
      server: { port: 0 },
      logLevel: 'silent',
    })
    await server.listen()
    port = (server.httpServer!.address() as AddressInfo).port
  }, 30_000)

  afterAll(async () => {
    await Promise.race([server.close(), new Promise(r => setTimeout(r, 5000))])
  }, 15_000)

  it('serves full HTML shell at /', async () => {
    const res = await fetch(`http://localhost:${port}/`)
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html')
    expect(html).toContain('<body')
    expect(html).toContain('virtual:lit-ssg-single-client')
    expect(html).toContain('shadowrootmode')
    expect(html).toContain('Hello from single-component mode')
    expect(html).toContain('<demo-app-root')
    expect(html).toContain('</demo-app-root>')
  })

  it('HTML shell contains module script tag for dev virtual entry', async () => {
    const res = await fetch(`http://localhost:${port}/`)
    const html = await res.text()
    expect(html).toContain('type="module"')
  })

  it('serves transformed entry module with minified supported templates and preserved commonStyles markers', async () => {
    const res = await fetch(`http://localhost:${port}/src/demo-widget.ts`)
    expect(res.status).toBe(200)
    const moduleCode = await res.text()
    expect(moduleCode).not.toContain('@customElement(')
    expect(moduleCode).toContain('demo-widget')
    expect(moduleCode).toMatch(/__litSsgCommonStyles,\s*css`:host\{(?:display:block;font-family:sans-serif|font-family:sans-serif;display:block)\}p\{(?:color:blue|color:#00f)\}`/)
    expect(moduleCode).not.toContain('font-family: sans-serif;')
    expect(moduleCode).not.toContain('p { color: blue; }')
    expect(moduleCode).toContain('?inline')
    expect(moduleCode).toContain('__litSsgCommonStyles')
    expect(moduleCode).toContain('unsafeCSS')
  })
})

describe('single-component dev mode — HTML shell (base=/demo/)', () => {
  let server: Awaited<ReturnType<typeof createServer>>
  let port: number

  beforeAll(async () => {
    server = await createServer({
      root: FIXTURE_ROOT,
      base: '/demo/',
      plugins: [litSSG({
        mode: 'single-component',
        entry: 'src/demo-widget.ts',
        commonStyles: [{ file: 'src/common.css' }],
        wrapperTag: 'demo-app-root',
      })],
      server: { port: 0 },
      logLevel: 'silent',
    })
    await server.listen()
    port = (server.httpServer!.address() as AddressInfo).port
  }, 30_000)

  afterAll(async () => {
    await Promise.race([server.close(), new Promise(r => setTimeout(r, 5000))])
  }, 15_000)

  it('serves HTML shell at /demo/ (base=/demo/)', async () => {
    const res = await fetch(`http://localhost:${port}/demo/`)
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('virtual:lit-ssg-single-client')
    expect(html).toContain('shadowrootmode')
  })

  it('asset URLs include /demo/ prefix when base=/demo/', async () => {
    const res = await fetch(`http://localhost:${port}/demo/`)
    const html = await res.text()
    expect(html).toContain('/demo/')
  })
})
