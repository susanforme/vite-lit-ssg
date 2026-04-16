import { describe, it, expect } from 'vitest'
import { resolveSingleComponentOptions } from '../../src/types.js'
import type { LitSSGOptionsNew, SingleComponentOptions } from '../../src/types.js'

describe('resolveSingleComponentOptions', () => {
  it('applies default exportName', () => {
    const resolved = resolveSingleComponentOptions({
      mode: 'single-component',
      entry: 'src/components/my-element.ts',
    })
    expect(resolved.exportName).toBe('default')
  })

  it('applies default wrapperTag', () => {
    const resolved = resolveSingleComponentOptions({
      mode: 'single-component',
      entry: 'src/components/my-element.ts',
    })
    expect(resolved.wrapperTag).toBe('lit-ssg-root')
  })

  it('applies default preload', () => {
    const resolved = resolveSingleComponentOptions({
      mode: 'single-component',
      entry: 'src/components/my-element.ts',
    })
    expect(resolved.preload).toBe('inherit')
  })

  it('preserves explicit exportName', () => {
    const resolved = resolveSingleComponentOptions({
      mode: 'single-component',
      entry: 'src/components/my-element.ts',
      exportName: 'MyElement',
    })
    expect(resolved.exportName).toBe('MyElement')
  })

  it('preserves explicit wrapperTag', () => {
    const resolved = resolveSingleComponentOptions({
      mode: 'single-component',
      entry: 'src/components/my-element.ts',
      wrapperTag: 'my-app-root',
    })
    expect(resolved.wrapperTag).toBe('my-app-root')
  })

  it('preserves preload=none', () => {
    const resolved = resolveSingleComponentOptions({
      mode: 'single-component',
      entry: 'src/components/my-element.ts',
      preload: 'none',
    })
    expect(resolved.preload).toBe('none')
  })

  it('preserves preload=entry-only', () => {
    const resolved = resolveSingleComponentOptions({
      mode: 'single-component',
      entry: 'src/components/my-element.ts',
      preload: 'entry-only',
    })
    expect(resolved.preload).toBe('entry-only')
  })

  it('preserves the entry path', () => {
    const resolved = resolveSingleComponentOptions({
      mode: 'single-component',
      entry: 'src/components/my-element.ts',
    })
    expect(resolved.entry).toBe('src/components/my-element.ts')
  })
})

describe('LitSSGOptionsNew type compatibility', () => {
  it('allows page-mode with no arguments (default case)', () => {
    const opts: LitSSGOptionsNew = {}
    expect(opts).toBeDefined()
  })

  it('allows page-mode with pagesDir', () => {
    const opts: LitSSGOptionsNew = { pagesDir: 'src/pages' }
    expect(opts).toBeDefined()
  })

  it('allows single-component mode with required entry', () => {
    const opts: LitSSGOptionsNew = {
      mode: 'single-component',
      entry: 'src/my-element.ts',
    }
    expect(opts).toBeDefined()
  })

  it('discriminates single-component by mode field', () => {
    const opts: LitSSGOptionsNew = {
      mode: 'single-component',
      entry: 'src/my-element.ts',
    }
    if (opts.mode === 'single-component') {
      expect(opts.entry).toBe('src/my-element.ts')
    } else {
      throw new Error('Should have taken single-component branch')
    }
  })
})
