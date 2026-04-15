import { describe, it, expect } from 'vitest'
import { html } from 'lit'
import { renderPage } from '../../src/runtime/render-page.js'
import type { AssetLinks } from '../../src/types.js'

const baseAssets: AssetLinks = {
  js: '/assets/entry-client.js',
  css: ['/assets/style.css'],
  modulepreloads: ['/assets/chunk.js'],
}

describe('renderPage', () => {
  it('renders a page with TemplateResult', async () => {
    const result = html`<home-page></home-page>`
    const html_str = await renderPage(result, baseAssets)
    expect(html_str).toContain('<!doctype html>')
    expect(html_str).toContain('<html')
    expect(html_str).toContain('<head>')
    expect(html_str).toContain('<body>')
    expect(html_str).toContain('home-page')
    expect(html_str).toContain('entry-client.js')
    expect(html_str).toContain('style.css')
    expect(html_str).toContain('chunk.js')
  })

  it('includes page title when provided', async () => {
    const page = {
      template: html`<p>content</p>`,
      title: 'My <Page>',
    }
    const html_str = await renderPage(page, baseAssets)
    expect(html_str).toContain('<title>My &lt;Page&gt;</title>')
  })

  it('renders with custom lang attribute', async () => {
    const page = {
      template: html`<p>content</p>`,
      lang: 'fr',
    }
    const html_str = await renderPage(page, baseAssets)
    expect(html_str).toContain('<html lang="fr"')
  })

  it('injects extra head tags', async () => {
    const page = {
      template: html`<p>content</p>`,
      head: ['<meta name="robots" content="noindex">'],
    }
    const html_str = await renderPage(page, baseAssets)
    expect(html_str).toContain('<meta name="robots" content="noindex">')
  })

  it('renders null page as empty body', async () => {
    const html_str = await renderPage(null, baseAssets)
    expect(html_str).toContain('<!doctype html>')
    expect(html_str).not.toContain('<title>')
  })

  it('injects css as link tags', async () => {
    const html_str = await renderPage(null, baseAssets)
    expect(html_str).toContain('<link rel="stylesheet" href="/assets/style.css">')
  })

  it('injects modulepreload link tags', async () => {
    const html_str = await renderPage(null, baseAssets)
    expect(html_str).toContain('<link rel="modulepreload" href="/assets/chunk.js">')
  })

  it('injects script tag with type=module', async () => {
    const html_str = await renderPage(null, baseAssets)
    expect(html_str).toContain('<script type="module" src="/assets/entry-client.js">')
  })

  it('escapes & before " in html attributes to avoid double-encoding', async () => {
    const page = {
      template: html`<p>content</p>`,
      htmlAttrs: { 'data-test': 'a"&b' },
    }
    const html_str = await renderPage(page, baseAssets)
    expect(html_str).toContain('data-test="a&quot;&amp;b"')
  })

  it('renders typed meta tags', async () => {
    const page = {
      template: html`<p>content</p>`,
      meta: [
        { name: 'description', content: 'My page' },
        { property: 'og:title', content: 'Open Graph Title' },
      ],
    }
    const html_str = await renderPage(page, baseAssets)
    expect(html_str).toContain('name="description"')
    expect(html_str).toContain('content="My page"')
    expect(html_str).toContain('property="og:title"')
  })

  it('escapes body attributes correctly', async () => {
    const page = {
      template: html`<p>content</p>`,
      bodyAttrs: { class: 'foo"bar' },
    }
    const html_str = await renderPage(page, baseAssets)
    expect(html_str).toContain('class="foo&quot;bar"')
  })
})
