import { describe, it, expect } from 'vitest'
import { resolveSingleComponentOptions } from '../../vite-plugin-lit-ssg/src/types.js'
import type { LitSSGOptionsNew, SingleComponentOptions } from '../../vite-plugin-lit-ssg/src/types.js'

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

  it('preserves explicit wrapperTag as string', () => {
    const resolved = resolveSingleComponentOptions({
      mode: 'single-component',
      entry: 'src/components/my-element.ts',
      wrapperTag: 'my-app-root',
    })
    expect(resolved.wrapperTag).toBe('my-app-root')
  })

  it('preserves wrapperTag as function', () => {
    const fn = () => 'dynamic-root'
    const resolved = resolveSingleComponentOptions({
      mode: 'single-component',
      entry: 'src/components/my-element.ts',
      wrapperTag: fn,
    })
    expect(resolved.wrapperTag).toBe(fn)
    expect(typeof resolved.wrapperTag).toBe('function')
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

  it('applies default injectPolyfill (false)', () => {
    const resolved = resolveSingleComponentOptions({
      mode: 'single-component',
      entry: 'src/components/my-element.ts',
    })
    expect(resolved.injectPolyfill).toBe(false)
  })

  it('applies default dsdPendingStyle (false when injectPolyfill is false)', () => {
    const resolved = resolveSingleComponentOptions({
      mode: 'single-component',
      entry: 'src/components/my-element.ts',
    })
    expect(resolved.dsdPendingStyle).toBe(false)
  })

  it('dsdPendingStyle defaults to true when injectPolyfill is true', () => {
    const resolved = resolveSingleComponentOptions({
      mode: 'single-component',
      entry: 'src/components/my-element.ts',
      injectPolyfill: true,
    })
    expect(resolved.injectPolyfill).toBe(true)
    expect(resolved.dsdPendingStyle).toBe(true)
  })

  it('preserves explicit injectPolyfill=true', () => {
    const resolved = resolveSingleComponentOptions({
      mode: 'single-component',
      entry: 'src/components/my-element.ts',
      injectPolyfill: true,
    })
    expect(resolved.injectPolyfill).toBe(true)
  })

  it('preserves explicit dsdPendingStyle=false even when injectPolyfill=true', () => {
    const resolved = resolveSingleComponentOptions({
      mode: 'single-component',
      entry: 'src/components/my-element.ts',
      injectPolyfill: true,
      dsdPendingStyle: false,
    })
    expect(resolved.dsdPendingStyle).toBe(false)
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
