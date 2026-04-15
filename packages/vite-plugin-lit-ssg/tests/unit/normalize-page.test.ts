import { describe, it, expect } from 'vitest'
import { html } from 'lit'
import { normalizePage } from '../../src/runtime/normalize-page.js'

describe('normalizePage', () => {
  it('returns null for null input', () => {
    expect(normalizePage(null)).toBeNull()
  })

  it('wraps a TemplateResult in a PageDescriptor', () => {
    const template = html`<p>Hello</p>`
    const result = normalizePage(template)
    expect(result).not.toBeNull()
    expect(result!.template).toBe(template)
    expect(result!.title).toBeUndefined()
  })

  it('passes through a PageDescriptor as-is', () => {
    const template = html`<p>Hello</p>`
    const descriptor = { template, title: 'My Page', lang: 'fr' }
    const result = normalizePage(descriptor)
    expect(result).toBe(descriptor)
  })

  it('returns null for undefined input', () => {
    expect(normalizePage(undefined as unknown as null)).toBeNull()
  })
})
