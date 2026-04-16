import { describe, it, expect } from 'vitest'
import { html } from 'lit'
import { renderComponent } from '../../src/runtime/render-component.js'
import type { AssetLinks } from '../../src/types.js'

const baseAssets: AssetLinks = {
  js: '/assets/entry.js',
  css: ['/assets/style.css'],
  modulepreloads: ['/assets/chunk.js'],
}

const template = html`<demo-widget></demo-widget>`

describe('renderComponent', () => {
  it('outputs a minimal html document shell', async () => {
    const result = await renderComponent(template, baseAssets, 'my-app-root', 'inherit')
    expect(result).toContain('<!doctype html>')
    expect(result).toContain('<html>')
    expect(result).toContain('<head>')
    expect(result).toContain('<body')
  })

  it('wraps component output in the wrapper tag', async () => {
    const result = await renderComponent(template, baseAssets, 'my-app-root', 'inherit')
    expect(result).toContain('<my-app-root>')
    expect(result).toContain('</my-app-root>')
  })

  it('includes the component ssr markup inside the wrapper', async () => {
    const result = await renderComponent(template, baseAssets, 'my-app-root', 'inherit')
    expect(result).toContain('demo-widget')
    const wrapperStart = result.indexOf('<my-app-root>')
    const wrapperEnd = result.indexOf('</my-app-root>')
    expect(wrapperStart).toBeGreaterThan(-1)
    expect(wrapperEnd).toBeGreaterThan(wrapperStart)
    const wrapperContent = result.slice(wrapperStart, wrapperEnd)
    expect(wrapperContent).toContain('demo-widget')
  })

  it('includes the client module script', async () => {
    const result = await renderComponent(template, baseAssets, 'my-app-root', 'inherit')
    expect(result).toContain('<script type="module" src="/assets/entry.js">')
  })

  it('has dsd-pending on body', async () => {
    const result = await renderComponent(template, baseAssets, 'my-app-root', 'inherit')
    expect(result).toContain('<body dsd-pending>')
  })

  it('has DSD feature detection script', async () => {
    const result = await renderComponent(template, baseAssets, 'my-app-root', 'inherit')
    expect(result).toContain("'shadowrootmode'in HTMLTemplateElement.prototype")
  })

  it('has DSD polyfill loader', async () => {
    const result = await renderComponent(template, baseAssets, 'my-app-root', 'inherit')
    expect(result).toContain('hydrateShadowRoots')
  })

  it('never emits title tag', async () => {
    const result = await renderComponent(template, baseAssets, 'my-app-root', 'inherit')
    expect(result).not.toContain('<title>')
  })

  it('never emits lang attribute on html', async () => {
    const result = await renderComponent(template, baseAssets, 'my-app-root', 'inherit')
    expect(result).not.toContain('<html lang=')
  })

  it('never emits meta description or og tags', async () => {
    const result = await renderComponent(template, baseAssets, 'my-app-root', 'inherit')
    expect(result).not.toContain('<meta name="description"')
    expect(result).not.toContain('og:title')
  })

  describe('preload=inherit', () => {
    it('includes css link tags', async () => {
      const result = await renderComponent(template, baseAssets, 'my-app-root', 'inherit')
      expect(result).toContain('<link rel="stylesheet" href="/assets/style.css">')
    })

    it('includes modulepreload link tags', async () => {
      const result = await renderComponent(template, baseAssets, 'my-app-root', 'inherit')
      expect(result).toContain('<link rel="modulepreload" href="/assets/chunk.js">')
    })
  })

  describe('preload=none', () => {
    it('includes css link tags', async () => {
      const result = await renderComponent(template, baseAssets, 'my-app-root', 'none')
      expect(result).toContain('<link rel="stylesheet"')
    })

    it('removes modulepreload link tags', async () => {
      const result = await renderComponent(template, baseAssets, 'my-app-root', 'none')
      expect(result).not.toContain('<link rel="modulepreload"')
    })

    it('still has the client script', async () => {
      const result = await renderComponent(template, baseAssets, 'my-app-root', 'none')
      expect(result).toContain('<script type="module" src="/assets/entry.js">')
    })
  })

  describe('preload=entry-only', () => {
    it('removes css link tags', async () => {
      const result = await renderComponent(template, baseAssets, 'my-app-root', 'entry-only')
      expect(result).not.toContain('<link rel="stylesheet"')
    })

    it('removes modulepreload link tags', async () => {
      const result = await renderComponent(template, baseAssets, 'my-app-root', 'entry-only')
      expect(result).not.toContain('<link rel="modulepreload"')
    })

    it('keeps the client script', async () => {
      const result = await renderComponent(template, baseAssets, 'my-app-root', 'entry-only')
      expect(result).toContain('<script type="module" src="/assets/entry.js">')
    })
  })
})
