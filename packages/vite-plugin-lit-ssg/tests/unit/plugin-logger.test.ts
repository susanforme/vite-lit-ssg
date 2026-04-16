import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { EventEmitter } from 'node:events'
import type { Plugin } from 'vite'
import { litSSG } from '../../src/plugin/index.js'

function buildMockServer(root: string) {
  const watcher = new EventEmitter() as EventEmitter & { add: ReturnType<typeof vi.fn> }
  watcher.add = vi.fn()

  const loggerInfo = vi.fn()
  const loggerWarn = vi.fn()

  const moduleGraph = {
    getModuleById: vi.fn().mockReturnValue(null),
    invalidateModule: vi.fn(),
  }

  const ws = { send: vi.fn() }

  const server = {
    config: {
      root,
      base: '/',
      logger: { info: loggerInfo, warn: loggerWarn },
    },
    watcher,
    moduleGraph,
    ws,
    middlewares: { use: vi.fn() },
  }

  return { server, loggerInfo, loggerWarn }
}

describe('dev server route logger (requirement 5)', () => {
  let tmpRoot: string
  let pagesDir: string

  beforeEach(async () => {
    tmpRoot = join(tmpdir(), `plugin-logger-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    pagesDir = join(tmpRoot, 'src', 'pages')
    await mkdir(pagesDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(tmpRoot, { recursive: true, force: true })
  })

  it('logs new route via vite logger when a new page file is added', async () => {
    await writeFile(join(pagesDir, 'index.ts'), '')

    const plugin = litSSG({ pagesDir: 'src/pages' }) as Plugin
    const { server, loggerInfo } = buildMockServer(tmpRoot)

    const configureServer = plugin.configureServer as ((server: unknown) => void) | undefined
    expect(configureServer).toBeDefined()
    configureServer!(server)

    await new Promise((r) => setTimeout(r, 100))

    await writeFile(join(pagesDir, 'about.ts'), '')
    server.watcher.emit('add', join(pagesDir, 'about.ts'))

    await new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        try {
          const newRouteLogs = loggerInfo.mock.calls.filter(
            (args) =>
              typeof args[0] === 'string' &&
              args[0].includes('[vite-plugin-lit-ssg]') &&
              args[0].includes('New route'),
          )
          expect(newRouteLogs).toHaveLength(1)
          expect(newRouteLogs[0]![0]).toContain('/about')
          expect(newRouteLogs[0]![0]).not.toContain(' / ')
          resolve()
        } catch (e) {
          reject(e)
        }
      }, 300)
    })
  })

  it('does not log when a file is removed (unlink)', async () => {
    await writeFile(join(pagesDir, 'index.ts'), '')
    await writeFile(join(pagesDir, 'about.ts'), '')

    const plugin = litSSG({ pagesDir: 'src/pages' }) as Plugin
    const { server, loggerInfo } = buildMockServer(tmpRoot)

    const configureServer = plugin.configureServer as ((server: unknown) => void) | undefined
    configureServer!(server)

    await rm(join(pagesDir, 'about.ts'))

    await new Promise<void>((resolve) => {
      server.watcher.emit('unlink', join(pagesDir, 'about.ts'))
      setTimeout(() => {
        const newRouteLogs = loggerInfo.mock.calls.filter(
          (args) =>
            typeof args[0] === 'string' && args[0].includes('New route'),
        )
        expect(newRouteLogs).toHaveLength(0)
        resolve()
      }, 200)
    })
  })

  it('does not log for files outside the pages directory', async () => {
    await writeFile(join(pagesDir, 'index.ts'), '')

    const plugin = litSSG({ pagesDir: 'src/pages' }) as Plugin
    const { server, loggerInfo } = buildMockServer(tmpRoot)

    const configureServer = plugin.configureServer as ((server: unknown) => void) | undefined
    configureServer!(server)

    await new Promise<void>((resolve) => {
      server.watcher.emit('add', join(tmpRoot, 'src', 'components', 'button.ts'))
      setTimeout(() => {
        const newRouteLogs = loggerInfo.mock.calls.filter(
          (args) => typeof args[0] === 'string' && args[0].includes('New route'),
        )
        expect(newRouteLogs).toHaveLength(0)
        resolve()
      }, 200)
    })
  })
})
