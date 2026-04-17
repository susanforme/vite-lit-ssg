import { describe, it, expect } from 'vitest'
import { html } from 'lit'
import { renderComponent } from '../../vite-plugin-lit-ssg/src/runtime/render-component.js'
import type { AssetLinks } from '../../vite-plugin-lit-ssg/src/types.js'

const template = html`<demo-widget></demo-widget>`

const syntheticAssets: AssetLinks = {
  js: '/assets/entry.js',
  css: ['/assets/style.css'],
  modulepreloads: ['/assets/chunk-a.js', '/assets/chunk-b.js'],
}

describe('renderComponent', () => {
  it('outputs only the wrapper tag — no HTML shell', async () => {
    const result = await renderComponent(template, 'my-app-root')
    expect(result).not.toContain('<!doctype html>')
    expect(result).not.toContain('<html')
    expect(result).not.toContain('<head>')
    expect(result).not.toContain('<body')
  })

  it('outputs only the wrapper tag — no scripts or links outside wrapper', async () => {
    const result = await renderComponent(template, 'my-app-root')
    expect(result.trim()).toMatch(/^<my-app-root>[\s\S]*<\/my-app-root>$/)
  })

  it('wraps component output in the wrapper tag', async () => {
    const result = await renderComponent(template, 'my-app-root')
    expect(result).toContain('<my-app-root>')
    expect(result).toContain('</my-app-root>')
  })

  it('includes the component ssr markup inside the wrapper', async () => {
    const result = await renderComponent(template, 'my-app-root')
    expect(result).toContain('demo-widget')
    const wrapperStart = result.indexOf('<my-app-root>')
    const wrapperEnd = result.indexOf('</my-app-root>')
    expect(wrapperStart).toBeGreaterThan(-1)
    expect(wrapperEnd).toBeGreaterThan(wrapperStart)
    const wrapperContent = result.slice(wrapperStart, wrapperEnd)
    expect(wrapperContent).toContain('demo-widget')
  })

  it('never emits title tag', async () => {
    const result = await renderComponent(template, 'my-app-root')
    expect(result).not.toContain('<title>')
  })

  it('never emits lang attribute on html', async () => {
    const result = await renderComponent(template, 'my-app-root')
    expect(result).not.toContain('<html lang=')
  })

  it('never emits meta description or og tags', async () => {
    const result = await renderComponent(template, 'my-app-root')
    expect(result).not.toContain('<meta name="description"')
    expect(result).not.toContain('og:title')
  })

  it('uses custom wrapper tag name', async () => {
    const result = await renderComponent(template, 'custom-shell')
    expect(result).toContain('<custom-shell>')
    expect(result).toContain('</custom-shell>')
  })
})

describe('renderComponent with assets — preload policies', () => {
  it('inherit: includes CSS, modulepreloads, and entry script — all inside wrapper', async () => {
    const result = await renderComponent(template, 'my-app-root', syntheticAssets, 'inherit')
    expect(result).toContain('<link rel="stylesheet" href="/assets/style.css">')
    expect(result).toContain('<link rel="modulepreload" href="/assets/chunk-a.js">')
    expect(result).toContain('<link rel="modulepreload" href="/assets/chunk-b.js">')
    expect(result).toContain('<script type="module" src="/assets/entry.js">')
    expect(result.trim()).toMatch(/^<my-app-root>[\s\S]*<\/my-app-root>$/)
  })

  it('none: includes CSS and entry script but no modulepreload hints — all inside wrapper', async () => {
    const result = await renderComponent(template, 'my-app-root', syntheticAssets, 'none')
    expect(result).toContain('<link rel="stylesheet" href="/assets/style.css">')
    expect(result).not.toContain('<link rel="modulepreload"')
    expect(result).toContain('<script type="module" src="/assets/entry.js">')
    expect(result.trim()).toMatch(/^<my-app-root>[\s\S]*<\/my-app-root>$/)
  })

  it('entry-only: includes only entry script — inside wrapper, no CSS, no modulepreload hints', async () => {
    const result = await renderComponent(template, 'my-app-root', syntheticAssets, 'entry-only')
    expect(result).not.toContain('<link rel="stylesheet"')
    expect(result).not.toContain('<link rel="modulepreload"')
    expect(result).toContain('<script type="module" src="/assets/entry.js">')
    expect(result.trim()).toMatch(/^<my-app-root>[\s\S]*<\/my-app-root>$/)
  })

  it('all policies: asset tags are inside wrapper (wrapper closes last)', async () => {
    for (const preload of ['inherit', 'none', 'entry-only'] as const) {
      const result = await renderComponent(template, 'my-app-root', syntheticAssets, preload)
      expect(result.trim()).toMatch(/^<my-app-root>[\s\S]*<\/my-app-root>$/)
      const scriptIdx = result.indexOf('<script type="module"')
      const closingIdx = result.indexOf('</my-app-root>')
      expect(scriptIdx).toBeGreaterThan(-1)
      expect(closingIdx).toBeGreaterThan(scriptIdx)
    }
  })

  it('all policies: no HTML shell emitted', async () => {
    for (const preload of ['inherit', 'none', 'entry-only'] as const) {
      const result = await renderComponent(template, 'my-app-root', syntheticAssets, preload)
      expect(result).not.toContain('<!doctype')
      expect(result).not.toContain('<html')
      expect(result).not.toContain('<body')
    }
  })

  it('default preload is inherit when assets provided', async () => {
    const inherit = await renderComponent(template, 'my-app-root', syntheticAssets, 'inherit')
    const defaulted = await renderComponent(template, 'my-app-root', syntheticAssets)
    expect(defaulted).toBe(inherit)
  })
})

describe('renderComponent — wrapperTag as function', () => {
  it('calls the function to resolve the tag name', async () => {
    const result = await renderComponent(template, () => 'dynamic-shell')
    expect(result).toContain('<dynamic-shell>')
    expect(result).toContain('</dynamic-shell>')
  })

  it('produces identical output to string form when function returns same tag', async () => {
    const fromString = await renderComponent(template, 'my-app-root')
    const fromFn = await renderComponent(template, () => 'my-app-root')
    expect(fromFn).toBe(fromString)
  })

  it('calls the function once per render', async () => {
    let calls = 0
    const tag = () => { calls++; return 'counted-shell' }
    await renderComponent(template, tag)
    expect(calls).toBe(1)
  })

  it('respects assets when wrapperTag is a function', async () => {
    const result = await renderComponent(template, () => 'fn-shell', syntheticAssets, 'entry-only')
    expect(result.trim()).toMatch(/^<fn-shell>[\s\S]*<\/fn-shell>$/)
    expect(result).toContain('<script type="module" src="/assets/entry.js">')
  })
})

describe('renderComponent — injectPolyfill option', () => {
  it('does not inject polyfill by default', async () => {
    const result = await renderComponent(template, 'my-app-root')
    expect(result).not.toContain('shadowRootMode')
    expect(result).not.toContain('dsd-pending')
    expect(result.trim()).toMatch(/^<my-app-root>[\s\S]*<\/my-app-root>$/)
  })

  it('injectPolyfill=false produces same result as default', async () => {
    const def = await renderComponent(template, 'my-app-root')
    const explicit = await renderComponent(template, 'my-app-root', undefined, { injectPolyfill: false })
    expect(explicit).toBe(def)
  })

  it('injectPolyfill=true appends polyfill scripts after wrapper', async () => {
    const result = await renderComponent(template, 'my-app-root', undefined, { injectPolyfill: true })
    expect(result).toContain('shadowRootMode')
    const wrapperEnd = result.indexOf('</my-app-root>')
    const polyfillIdx = result.indexOf('shadowRootMode', wrapperEnd)
    expect(polyfillIdx).toBeGreaterThan(wrapperEnd)
  })

  it('injectPolyfill=true with dsdPendingStyle=true adds dsd-pending attribute and style', async () => {
    const result = await renderComponent(template, 'my-app-root', undefined, { injectPolyfill: true, dsdPendingStyle: true })
    expect(result).toContain('my-app-root[dsd-pending]{display:none}')
    expect(result).toContain('<my-app-root dsd-pending>')
  })

  it('injectPolyfill=true dsdPendingStyle defaults to true', async () => {
    const withDefault = await renderComponent(template, 'my-app-root', undefined, { injectPolyfill: true })
    const withExplicit = await renderComponent(template, 'my-app-root', undefined, { injectPolyfill: true, dsdPendingStyle: true })
    expect(withDefault).toBe(withExplicit)
  })

  it('injectPolyfill=true dsdPendingStyle=false omits pending style and attribute', async () => {
    const result = await renderComponent(template, 'my-app-root', undefined, { injectPolyfill: true, dsdPendingStyle: false })
    expect(result).not.toContain('my-app-root[dsd-pending]')
    expect(result).not.toContain('<my-app-root dsd-pending>')
    expect(result).toContain('<my-app-root>')
    expect(result).toContain('shadowRootMode')
  })

  it('polyfill targets the wrapper tag selector, not document.body', async () => {
    const result = await renderComponent(template, 'my-widget', undefined, { injectPolyfill: true })
    expect(result).toContain("querySelector('my-widget[dsd-pending]')")
    expect(result).not.toContain('document.body.removeAttribute')
  })

  it('injectPolyfill=true still appends asset tags inside wrapper', async () => {
    const result = await renderComponent(template, 'my-app-root', syntheticAssets, { injectPolyfill: true })
    const wrapperStart = result.indexOf('<my-app-root')
    const wrapperEnd = result.indexOf('</my-app-root>')
    const scriptInWrapper = result.indexOf('<script type="module" src="/assets/entry.js">')
    expect(scriptInWrapper).toBeGreaterThan(wrapperStart)
    expect(scriptInWrapper).toBeLessThan(wrapperEnd)
  })
})

describe('renderComponent — options object form (backward compat)', () => {
  it('accepts options object with preload field', async () => {
    const fromStr = await renderComponent(template, 'my-app-root', syntheticAssets, 'none')
    const fromObj = await renderComponent(template, 'my-app-root', syntheticAssets, { preload: 'none' })
    expect(fromObj).toBe(fromStr)
  })
})
