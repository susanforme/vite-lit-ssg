import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServer } from 'vite'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { litSSG } from '../../vite-plugin-lit-ssg/src/plugin/index.js'

const FIXTURE_ROOT = resolve(import.meta.dirname, '../fixtures/page-mode-app')
const TEMP_FIXTURE_ROOT = resolve(import.meta.dirname, '../fixtures')

async function writeFixtureFiles(root: string, files: Record<string, string>) {
  await Promise.all(
    Object.entries(files).map(async ([relativePath, contents]) => {
      const filePath = join(root, relativePath)
      await mkdir(dirname(filePath), { recursive: true })
      await writeFile(filePath, contents)
    }),
  )
}

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

  it('compresses page-mode CSS and render output without requiring commonStyles', async () => {
    const tempRoot = await mkdtemp(join(TEMP_FIXTURE_ROOT, 'vite-lit-ssg-dev-page-compression-'))

    try {
      await writeFixtureFiles(tempRoot, {
        'src/pages/index.ts': `
import { LitElement, css, html } from 'lit'
import { customElement } from 'lit/decorators.js'
import { defineLitRoute } from 'vite-plugin-lit-ssg/browser'

@customElement('compression-page')
export class CompressionPage extends LitElement {
  static styles = css\`
    .card {
      color: rgb(255, 0, 0);
    }
  \`

  render() {
    return html\`
      <div class="card"> Compressed </div>
    \`
  }
}

export default defineLitRoute({
  component: CompressionPage,
  title: 'Compression | Fixture',
})
`,
      })

      const compressionServer = await createServer({
        root: tempRoot,
        base: '/',
        plugins: [litSSG()],
        server: { port: 0 },
        logLevel: 'silent',
      })

      try {
        await compressionServer.listen()
        const compressionPort = (compressionServer.httpServer!.address() as AddressInfo).port
        const res = await fetch(`http://localhost:${compressionPort}/`)
        expect(res.status).toBe(200)

        const html = await res.text()
        expect(html).toContain('<style>.card{color:red}</style>')
        expect(html).toContain('<div class="card">Compressed</div>')
      } finally {
        await Promise.race([compressionServer.close(), new Promise(r => setTimeout(r, 5000))])
      }
    } finally {
      await rm(tempRoot, { recursive: true, force: true })
    }
  }, 30_000)
})
