import { describe, it, expect } from 'vitest'
import { html } from 'lit'
import { renderComponent } from '../../vite-plugin-lit-ssg/src/runtime/render-component.js'
import type { AssetLinks } from '../../vite-plugin-lit-ssg/src/types.js'

const template = html`<demo-widget></demo-widget>`
const islandTag = 'lit-ssg-island'
const islandRuntimeSrc = '/assets/island-runtime.js'

const syntheticAssets: AssetLinks = {
  js: '/assets/entry.js',
  css: ['/assets/style.css'],
  modulepreloads: ['/assets/chunk-a.js', '/assets/chunk-b.js'],
}

function getWrapperContent(result: string, tag: string): string {
  const wrapperStart = result.indexOf(`<${tag}>`)
  const wrapperEnd = result.indexOf(`</${tag}>`)
  expect(wrapperStart).toBeGreaterThan(-1)
  expect(wrapperEnd).toBeGreaterThan(wrapperStart)
  return result.slice(wrapperStart, wrapperEnd)
}

describe('renderComponent', () => {
  it('outputs only a fragment — no HTML shell', async () => {
    const result = await renderComponent(template, 'my-app-root')
    expect(result).not.toContain('<!doctype html>')
    expect(result).not.toContain('<html')
    expect(result).not.toContain('<head>')
    expect(result).not.toContain('<body')
  })

  it('defines lit-ssg-island before first island usage', async () => {
    const result = await renderComponent(template, 'my-app-root', undefined, { islandRuntimeSrc })
    expect(result).toContain(`<script type="module" src="${islandRuntimeSrc}"></script>`)
    expect(result.indexOf(`<script type="module" src="${islandRuntimeSrc}"></script>`)).toBeLessThan(result.indexOf('<lit-ssg-island'))
  })

  it('wraps component output in the framework island and configured inner wrapper', async () => {
    const result = await renderComponent(template, 'my-app-root', undefined, { islandRuntimeSrc })
    expect(result).toContain('<lit-ssg-island ssr client="load" component-export="hydrate">')
    expect(result).toContain('<my-app-root>')
    expect(result).toContain('</my-app-root>')
    expect(result).toContain('</lit-ssg-island>')
  })

  it('includes the component ssr markup inside the inner wrapper', async () => {
    const result = await renderComponent(template, 'my-app-root')
    const wrapperContent = getWrapperContent(result, 'my-app-root')
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

  it('uses custom wrapper tag name for the inner wrapper', async () => {
    const result = await renderComponent(template, 'custom-shell', undefined, { islandRuntimeSrc })
    expect(result).toContain('<custom-shell>')
    expect(result).toContain('</custom-shell>')
    expect(result).toContain('<lit-ssg-island ssr client="load" component-export="hydrate">')
  })

  it('emits island metadata from the page descriptor instead of hardcoded runtime values', async () => {
    const result = await renderComponent({
      template,
      island: {
        client: 'visible',
        componentExport: 'customHydrate',
        clientRootMargin: '250px',
      },
    }, 'my-app-root', syntheticAssets, { islandRuntimeSrc })
    expect(result).toContain('client="visible"')
    expect(result).toContain('component-export="customHydrate"')
    expect(result).toContain('client-root-margin="250px"')
  })
})

describe('renderComponent with assets — preload policies', () => {
  it('inherit: includes CSS and modulepreloads in the island and stores hydration URL on the island', async () => {
    const result = await renderComponent(template, 'my-app-root', syntheticAssets, { preload: 'inherit', islandRuntimeSrc })
    expect(result).toContain('<link rel="stylesheet" href="/assets/style.css">')
    expect(result).toContain('<link rel="modulepreload" href="/assets/chunk-a.js">')
    expect(result).toContain('<link rel="modulepreload" href="/assets/chunk-b.js">')
    expect(result).toContain('<lit-ssg-island ssr client="load" component-export="hydrate" component-url="/assets/entry.js">')
    expect(result).not.toContain('<script type="module" src="/assets/entry.js"></script>')
  })

  it('none: includes CSS and island hydration URL but no modulepreload hints', async () => {
    const result = await renderComponent(template, 'my-app-root', syntheticAssets, { preload: 'none', islandRuntimeSrc })
    expect(result).toContain('<link rel="stylesheet" href="/assets/style.css">')
    expect(result).not.toContain('<link rel="modulepreload"')
    expect(result).toContain('component-url="/assets/entry.js"')
    expect(result).not.toContain('<script type="module" src="/assets/entry.js">')
  })

  it('entry-only: keeps only the island hydration URL — no CSS or modulepreload hints', async () => {
    const result = await renderComponent(template, 'my-app-root', syntheticAssets, { preload: 'entry-only', islandRuntimeSrc })
    expect(result).not.toContain('<link rel="stylesheet"')
    expect(result).not.toContain('<link rel="modulepreload"')
    expect(result).toContain('component-url="/assets/entry.js"')
    expect(result).not.toContain('<script type="module" src="/assets/entry.js">')
  })

  it('all policies: inner wrapper contains SSR markup only, while the island owns hydration metadata', async () => {
    for (const preload of ['inherit', 'none', 'entry-only'] as const) {
      const result = await renderComponent(template, 'my-app-root', syntheticAssets, { preload, islandRuntimeSrc })
      expect(result).not.toContain('<script type="module" src="/assets/entry.js"></script>')
      const islandStart = result.indexOf(`<${islandTag}`)
      const wrapperStart = result.indexOf('<my-app-root>')
      const wrapperEnd = result.indexOf('</my-app-root>')
      const islandEnd = result.indexOf(`</${islandTag}>`)
      expect(islandStart).toBeGreaterThan(-1)
      expect(wrapperStart).toBeGreaterThan(islandStart)
      expect(wrapperEnd).toBeGreaterThan(wrapperStart)
      expect(islandEnd).toBeGreaterThan(wrapperEnd)
      const wrapperContent = getWrapperContent(result, 'my-app-root')
      expect(wrapperContent).toContain('demo-widget')
      expect(wrapperContent).not.toContain('component-url=')
      expect(wrapperContent).not.toContain('<script type="module" src="/assets/entry.js"></script>')
    }
  })

  it('all policies: no HTML shell emitted', async () => {
    for (const preload of ['inherit', 'none', 'entry-only'] as const) {
      const result = await renderComponent(template, 'my-app-root', syntheticAssets, { preload, islandRuntimeSrc })
      expect(result).not.toContain('<!doctype')
      expect(result).not.toContain('<html')
      expect(result).not.toContain('<body')
    }
  })

  it('default preload is inherit when assets provided', async () => {
    const inherit = await renderComponent(template, 'my-app-root', syntheticAssets, { preload: 'inherit', islandRuntimeSrc })
    const defaulted = await renderComponent(template, 'my-app-root', syntheticAssets, { islandRuntimeSrc })
    expect(defaulted).toBe(inherit)
  })
})

describe('renderComponent — wrapperTag as function', () => {
  it('calls the function to resolve the inner wrapper tag name', async () => {
    const result = await renderComponent(template, () => 'dynamic-shell', undefined, { islandRuntimeSrc })
    expect(result).toContain('<dynamic-shell>')
    expect(result).toContain('</dynamic-shell>')
  })

  it('produces identical output to string form when function returns same tag', async () => {
    const fromString = await renderComponent(template, 'my-app-root', undefined, { islandRuntimeSrc })
    const fromFn = await renderComponent(template, () => 'my-app-root', undefined, { islandRuntimeSrc })
    expect(fromFn).toBe(fromString)
  })

  it('calls the function once per render', async () => {
    let calls = 0
    const tag = () => { calls++; return 'counted-shell' }
    await renderComponent(template, tag, undefined, { islandRuntimeSrc })
    expect(calls).toBe(1)
  })

  it('respects assets when wrapperTag is a function', async () => {
    const result = await renderComponent(template, () => 'fn-shell', syntheticAssets, { preload: 'entry-only', islandRuntimeSrc })
    expect(result).toContain('<fn-shell>')
    expect(result).toContain('component-url="/assets/entry.js"')
    expect(result).not.toContain('<script type="module" src="/assets/entry.js">')
  })
})

describe('renderComponent — injectPolyfill option', () => {
  it('does not inject polyfill by default', async () => {
    const result = await renderComponent(template, 'my-app-root', undefined, { islandRuntimeSrc })
    expect(result).not.toContain('shadowRootMode')
    expect(result).not.toContain('dsd-pending')
    expect(result).toContain('<lit-ssg-island ssr client="load" component-export="hydrate">')
  })

  it('injectPolyfill=false produces same result as default', async () => {
    const def = await renderComponent(template, 'my-app-root', undefined, { islandRuntimeSrc })
    const explicit = await renderComponent(template, 'my-app-root', undefined, { injectPolyfill: false, islandRuntimeSrc })
    expect(explicit).toBe(def)
  })

  it('injectPolyfill=true appends polyfill scripts after the island', async () => {
    const result = await renderComponent(template, 'my-app-root', undefined, { injectPolyfill: true, islandRuntimeSrc })
    expect(result).toContain('shadowRootMode')
    const islandEnd = result.indexOf('</lit-ssg-island>')
    const polyfillIdx = result.indexOf('shadowRootMode', islandEnd)
    expect(polyfillIdx).toBeGreaterThan(islandEnd)
  })

  it('injectPolyfill=true with dsdPendingStyle=true adds island dsd-pending attribute and style', async () => {
    const result = await renderComponent(template, 'my-app-root', undefined, { injectPolyfill: true, dsdPendingStyle: true, islandRuntimeSrc })
    expect(result).toContain('lit-ssg-island[dsd-pending]{display:none}')
    expect(result).toContain('<lit-ssg-island ssr client="load" component-export="hydrate" dsd-pending>')
    expect(result).toContain('<my-app-root>')
  })

  it('injectPolyfill=true dsdPendingStyle defaults to true', async () => {
    const withDefault = await renderComponent(template, 'my-app-root', undefined, { injectPolyfill: true, islandRuntimeSrc })
    const withExplicit = await renderComponent(template, 'my-app-root', undefined, { injectPolyfill: true, dsdPendingStyle: true, islandRuntimeSrc })
    expect(withDefault).toBe(withExplicit)
  })

  it('injectPolyfill=true dsdPendingStyle=false omits pending style and attribute', async () => {
    const result = await renderComponent(template, 'my-app-root', undefined, { injectPolyfill: true, dsdPendingStyle: false, islandRuntimeSrc })
    expect(result).not.toContain('lit-ssg-island[dsd-pending]')
    expect(result).not.toContain('<lit-ssg-island ssr client="load" component-export="hydrate" dsd-pending>')
    expect(result).toContain('<lit-ssg-island ssr client="load" component-export="hydrate">')
    expect(result).toContain('shadowRootMode')
  })

  it('polyfill targets the framework island selector, not document.body', async () => {
    const result = await renderComponent(template, 'my-widget', undefined, { injectPolyfill: true, dsdPendingStyle: true, islandRuntimeSrc })
    expect(result).toContain("querySelector('lit-ssg-island[dsd-pending]')")
    expect(result).not.toContain('document.body.removeAttribute')
  })

  it('native-check script is guarded by shadowRootMode check, not unconditional', async () => {
    const result = await renderComponent(template, 'my-widget', undefined, { injectPolyfill: true, dsdPendingStyle: true, islandRuntimeSrc })
    const scripts = result.match(/<script[^>]*>[\s\S]*?<\/script>/g) ?? []
    const syncScripts = scripts.filter(s => !s.includes('type="module"'))
    const nativeCheckScript = syncScripts[0] ?? ''
    expect(nativeCheckScript).toContain('shadowRootMode')
    expect(nativeCheckScript).not.toMatch(/^<script>var __w/)
  })

  it('on non-native browsers polyfill script still finds the island via [dsd-pending] selector', async () => {
    const result = await renderComponent(template, 'my-app', undefined, { injectPolyfill: true, dsdPendingStyle: true, islandRuntimeSrc })
    const moduleScripts = result.match(/<script type="module">[\s\S]*?<\/script>/g) ?? []
    const polyfillModuleScript = moduleScripts.find((script) => script.includes('hydrateShadowRoots')) ?? ''
    expect(polyfillModuleScript).toContain("querySelector('lit-ssg-island[dsd-pending]')")
    expect(polyfillModuleScript).toContain('hydrateShadowRoots')
    expect(polyfillModuleScript).toContain("removeAttribute('dsd-pending')")
  })

  it('injectPolyfill=true still keeps the hydration URL on the island instead of a direct entry script tag', async () => {
    const result = await renderComponent(template, 'my-app-root', syntheticAssets, { injectPolyfill: true, islandRuntimeSrc })
    expect(result).toContain('<lit-ssg-island ssr client="load" component-export="hydrate" component-url="/assets/entry.js" dsd-pending>')
    expect(result).not.toContain('<script type="module" src="/assets/entry.js">')
    const wrapperContent = getWrapperContent(result, 'my-app-root')
    expect(wrapperContent).not.toContain('/assets/entry.js')
  })
})

describe('renderComponent — options object form (backward compat)', () => {
  it('accepts options object with preload field', async () => {
    const fromStr = await renderComponent(template, 'my-app-root', syntheticAssets, { preload: 'none', islandRuntimeSrc })
    const fromObj = await renderComponent(template, 'my-app-root', syntheticAssets, { preload: 'none', islandRuntimeSrc })
    expect(fromObj).toBe(fromStr)
  })
})
