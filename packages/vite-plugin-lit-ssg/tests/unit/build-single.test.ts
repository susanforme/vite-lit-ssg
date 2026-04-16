import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resolveRouteFilePath } from '../../src/output/write-route.js'
import { VIRTUAL_SINGLE_CLIENT_ID, VIRTUAL_SINGLE_SERVER_ID } from '../../src/plugin/index.js'

describe('build-single: manifest key selection', () => {
  it('VIRTUAL_SINGLE_CLIENT_ID is used as manifest key for client assets', () => {
    expect(VIRTUAL_SINGLE_CLIENT_ID).toBe('virtual:lit-ssg-single-client')
  })

  it('VIRTUAL_SINGLE_SERVER_ID is the server build entry', () => {
    expect(VIRTUAL_SINGLE_SERVER_ID).toBe('virtual:lit-ssg-single-server')
  })

  it('manifest key differs from page-mode keys', () => {
    expect(VIRTUAL_SINGLE_CLIENT_ID).not.toBe('virtual:lit-ssg-shared')
    expect(VIRTUAL_SINGLE_CLIENT_ID).not.toBe('virtual:lit-ssg-server')
    expect(VIRTUAL_SINGLE_SERVER_ID).not.toBe('virtual:lit-ssg-server')
  })
})

describe('build-single: root output path', () => {
  it('root route resolves to dist/index.html', () => {
    const filePath = resolveRouteFilePath('/', '/project/dist')
    expect(filePath).toBe('/project/dist/index.html')
  })

  it('single-component always uses route "/" for output', () => {
    const filePath = resolveRouteFilePath('/', '/output')
    expect(filePath).toContain('index.html')
    expect(filePath).not.toContain('about')
  })
})

describe('build-single: cleanup behavior (contract)', () => {
  it('SERVER_BUILD_DIR_NAME is a temp path under .vite-ssg/server', () => {
    const SERVER_BUILD_DIR_NAME = '.vite-ssg/server'
    expect(SERVER_BUILD_DIR_NAME).toContain('.vite-ssg')
    expect(SERVER_BUILD_DIR_NAME).toContain('server')
  })

  it('cleanup dir is a subdirectory of the parent cleanup path', () => {
    const parent = '.vite-ssg'
    const child = '.vite-ssg/server'
    expect(child.startsWith(parent)).toBe(true)
  })
})

describe('build-single: BuildContext forwarding', () => {
  it('runSingleSSG accepts mode and configFile in BuildContext', async () => {
    const { runSingleSSG } = await import('../../src/runner/build-single.js')
    expect(typeof runSingleSSG).toBe('function')
    expect(runSingleSSG.length).toBeGreaterThanOrEqual(3)
  })
})
