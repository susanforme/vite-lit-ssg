import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServer } from 'vite'
import { resolve } from 'node:path'
import type { AddressInfo } from 'node:net'
import { litSSG } from '../../vite-plugin-lit-ssg/src/plugin/index.js'

const FIXTURE_ROOT = resolve(import.meta.dirname, '../fixtures/page-mode-app')

describe('page-mode dev mode — SSR rendering', () => {
  let server: Awaited<ReturnType<typeof createServer>>
  let port: number

  beforeAll(async () => {
    server = await createServer({
      root: FIXTURE_ROOT,
      base: '/',
      plugins: [litSSG()],
      server: { port: 0 },
      logLevel: 'silent',
    })
    await server.listen()
    port = (server.httpServer!.address() as AddressInfo).port
  }, 30_000)

  afterAll(async () => {
    await Promise.race([server.close(), new Promise(r => setTimeout(r, 5000))])
  }, 15_000)

  it('serves SSR HTML with DSD markup at /', async () => {
    const res = await fetch(`http://localhost:${port}/`)
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('shadowrootmode')
    expect(html).toContain('home-page')
    expect(html).toContain('Hello from SSR')
  })

  it('serves correct title from defineLitRoute metadata', async () => {
    const res = await fetch(`http://localhost:${port}/`)
    const html = await res.text()
    expect(html).toContain('<title>Home | Fixture</title>')
  })

  it('includes hydration script pointing to virtual:lit-ssg-page entry', async () => {
    const res = await fetch(`http://localhost:${port}/`)
    const html = await res.text()
    expect(html).toContain('virtual:lit-ssg-page/index')
  })

  it('does NOT include document.createElement — no client-only mount', async () => {
    const res = await fetch(`http://localhost:${port}/`)
    const html = await res.text()
    expect(html).not.toContain('document.createElement')
  })
})
