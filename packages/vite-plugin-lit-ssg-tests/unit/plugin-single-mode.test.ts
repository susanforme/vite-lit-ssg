import { describe, it, expect, vi } from 'vitest'
import { litSSG, getSingleComponentOptions, getSSGOptions } from '../../vite-plugin-lit-ssg/src/plugin/index.js'
import type { Plugin } from 'vite'

function buildSingleComponentDevServer(base: string) {
  const nextFn = vi.fn()
  const endFn = vi.fn()
  const setHeaderFn = vi.fn()

  const makeReq = (url: string, method = 'GET') => ({ url, method, headers: {} })
  const makeRes = () => ({ setHeader: setHeaderFn, end: endFn, statusCode: 200 })

  const server = {
    config: { root: '/tmp', base, logger: { warn: vi.fn(), error: vi.fn() } },
    middlewares: { use: vi.fn() },
    watcher: { add: vi.fn(), on: vi.fn() },
    moduleGraph: { getModuleById: vi.fn(), invalidateModule: vi.fn() },
    ws: { send: vi.fn() },
    ssrLoadModule: vi.fn().mockRejectedValue(new Error('ssrLoadModule not available in unit test mock')),
    transformIndexHtml: vi.fn().mockImplementation((_url: string, html: string) => Promise.resolve(html)),
  }

  return { server, nextFn, endFn, makeReq, makeRes }
}

describe('plugin mode gating', () => {
  it('page-mode plugin has getSSGOptions set', () => {
    const plugin = litSSG()
    expect(getSSGOptions(plugin)).toBeDefined()
  })

  it('page-mode plugin has getSingleComponentOptions undefined', () => {
    const plugin = litSSG()
    expect(getSingleComponentOptions(plugin)).toBeUndefined()
  })

  it('single-component plugin has getSingleComponentOptions set', () => {
    const plugin = litSSG({ mode: 'single-component', entry: 'src/my-element.ts' })
    const opts = getSingleComponentOptions(plugin)
    expect(opts).toBeDefined()
    expect(opts?.mode).toBe('single-component')
    expect(opts?.entry).toBe('src/my-element.ts')
  })

  it('single-component plugin has getSSGOptions undefined', () => {
    const plugin = litSSG({ mode: 'single-component', entry: 'src/my-element.ts' })
    expect(getSSGOptions(plugin)).toBeUndefined()
  })

  it('single-component plugin does not resolve page-mode virtual IDs', async () => {
    const plugin = litSSG({ mode: 'single-component', entry: 'src/my-element.ts' })
    const resolveId = plugin.resolveId as ((id: string) => string | undefined)
    expect(resolveId('virtual:lit-ssg-shared')).toBeUndefined()
    expect(resolveId('virtual:lit-ssg-server')).toBeUndefined()
    expect(resolveId('virtual:lit-ssg-page/index')).toBeUndefined()
  })

  it('page-mode plugin does not resolve single-component virtual IDs', async () => {
    const plugin = litSSG()
    const resolveId = plugin.resolveId as ((id: string) => string | undefined)
    expect(resolveId('virtual:lit-ssg-single-client')).toBeUndefined()
    expect(resolveId('virtual:lit-ssg-single-server')).toBeUndefined()
    expect(resolveId('virtual:lit-ssg-single-dev')).toBeUndefined()
  })

  it('single-component plugin resolves single virtual IDs', async () => {
    const plugin = litSSG({ mode: 'single-component', entry: 'src/my-element.ts' })
    const resolveId = plugin.resolveId as ((id: string) => string | undefined)
    expect(resolveId('virtual:lit-ssg-single-client')).toBe('\0virtual:lit-ssg-single-client')
    expect(resolveId('virtual:lit-ssg-single-server')).toBe('\0virtual:lit-ssg-single-server')
    expect(resolveId('virtual:lit-ssg-single-dev')).toBe('\0virtual:lit-ssg-single-dev')
  })
})

describe('single-component dev middleware — base routing', () => {
  async function invokeMiddleware(
    server: ReturnType<typeof buildSingleComponentDevServer>['server'],
    req: ReturnType<ReturnType<typeof buildSingleComponentDevServer>['makeReq']>,
    res: ReturnType<ReturnType<typeof buildSingleComponentDevServer>['makeRes']>,
    next: ReturnType<typeof vi.fn>,
  ) {
    const plugin = litSSG({ mode: 'single-component', entry: 'src/my-element.ts' }) as Plugin
    const configureServer = plugin.configureServer as ((s: unknown) => void)
    configureServer(server)
    const middlewareFn = (server.middlewares.use as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
    await middlewareFn(req, res, next)
  }

  it('base=/ : serves shell for /', async () => {
    const { server, nextFn, makeReq, makeRes } = buildSingleComponentDevServer('/')
    const req = makeReq('/')
    const res = makeRes()
    await invokeMiddleware(server as any, req as any, res as any, nextFn)
    expect(nextFn).not.toHaveBeenCalled()
    expect(res.end).toHaveBeenCalled()
  })

  it('base=/demo/ : serves shell for /demo/', async () => {
    const { server, nextFn, makeReq, makeRes } = buildSingleComponentDevServer('/demo/')
    const req = makeReq('/demo/')
    const res = makeRes()
    await invokeMiddleware(server as any, req as any, res as any, nextFn)
    expect(nextFn).not.toHaveBeenCalled()
    expect(res.end).toHaveBeenCalled()
  })

  it('base=/demo/ : serves shell for /demo (without trailing slash)', async () => {
    const { server, nextFn, makeReq, makeRes } = buildSingleComponentDevServer('/demo/')
    const req = makeReq('/demo')
    const res = makeRes()
    await invokeMiddleware(server as any, req as any, res as any, nextFn)
    expect(nextFn).not.toHaveBeenCalled()
    expect(res.end).toHaveBeenCalled()
  })

  it('base=/demo/ : does NOT serve shell for /', async () => {
    const { server, nextFn, makeReq, makeRes } = buildSingleComponentDevServer('/demo/')
    const req = makeReq('/')
    const res = makeRes()
    await invokeMiddleware(server as any, req as any, res as any, nextFn)
    expect(nextFn).toHaveBeenCalled()
    expect(server.transformIndexHtml).not.toHaveBeenCalled()
  })

  it('base=/demo/ : does NOT serve shell for /demo/about', async () => {
    const { server, nextFn, makeReq, makeRes } = buildSingleComponentDevServer('/demo/')
    const req = makeReq('/demo/about')
    const res = makeRes()
    await invokeMiddleware(server as any, req as any, res as any, nextFn)
    expect(nextFn).toHaveBeenCalled()
    expect(server.transformIndexHtml).not.toHaveBeenCalled()
  })

  it('non-GET request falls through to next()', async () => {
    const { server, nextFn, makeReq, makeRes } = buildSingleComponentDevServer('/')
    const req = makeReq('/', 'POST')
    const res = makeRes()
    await invokeMiddleware(server as any, req as any, res as any, nextFn)
    expect(nextFn).toHaveBeenCalled()
  })
})
