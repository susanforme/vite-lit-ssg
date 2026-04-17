import { describe, it, expect } from 'vitest'
import { html } from 'lit'
import { renderComponent } from '../../src/runtime/render-component.js'

const template = html`<demo-widget></demo-widget>`

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
