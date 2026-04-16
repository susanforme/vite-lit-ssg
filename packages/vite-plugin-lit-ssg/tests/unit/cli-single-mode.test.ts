import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { litSSG, getSingleComponentOptions, getSSGOptions } from '../../src/plugin/index.js'

describe('CLI mode dispatch logic', () => {
  it('getSingleComponentOptions returns options for single-component plugin', () => {
    const plugin = litSSG({
      mode: 'single-component',
      entry: 'src/my-element.ts',
      exportName: 'MyElement',
      wrapperTag: 'my-root',
      preload: 'none',
    })
    const opts = getSingleComponentOptions(plugin)
    expect(opts).not.toBeNull()
    expect(opts?.mode).toBe('single-component')
    expect(opts?.entry).toBe('src/my-element.ts')
    expect(opts?.exportName).toBe('MyElement')
    expect(opts?.wrapperTag).toBe('my-root')
    expect(opts?.preload).toBe('none')
  })

  it('getSSGOptions returns undefined for single-component plugin', () => {
    const plugin = litSSG({ mode: 'single-component', entry: 'src/my-element.ts' })
    const opts = getSSGOptions(plugin)
    expect(opts).toBeUndefined()
  })

  it('getSingleComponentOptions returns undefined for page-mode plugin', () => {
    const plugin = litSSG({ pagesDir: 'src/pages' })
    const opts = getSingleComponentOptions(plugin)
    expect(opts).toBeUndefined()
  })

  it('getSSGOptions returns scan options for page-mode plugin', () => {
    const plugin = litSSG({ pagesDir: 'src/pages' })
    const opts = getSSGOptions(plugin)
    expect(opts).toBeDefined()
  })

  it('single-component defaults are applied when not specified', () => {
    const plugin = litSSG({ mode: 'single-component', entry: 'src/my-element.ts' })
    const opts = getSingleComponentOptions(plugin)
    expect(opts?.exportName).toBe('default')
    expect(opts?.wrapperTag).toBe('lit-ssg-root')
    expect(opts?.preload).toBe('inherit')
  })
})
