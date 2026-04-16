import { describe, it, expect, vi } from 'vitest'
import { litSSG, getSingleComponentOptions, getSSGOptions } from '../../src/plugin/index.js'

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
