import { describe, expect, it } from 'vitest'
import {
  litSSG,
  type CommonStylesOptions,
  type LitSSGOptions,
  type PageModeOptions,
  type SingleComponentOptions,
} from 'vite-plugin-lit-ssg'
import type { LitElement } from 'lit'
import { defineLitRoute, type LitRoute } from 'vite-plugin-lit-ssg/browser'

describe('public root API types', () => {
  it('accepts commonStyles through page-mode root exports', () => {
    const commonStyles: CommonStylesOptions = [{ file: 'src/styles/common.css' }]
    const pageOptions: PageModeOptions = {
      commonStyles,
    }
    const publicOptions: LitSSGOptions = pageOptions

    const plugin = litSSG(publicOptions)
    expect(plugin.name).toBe('vite-plugin-lit-ssg')
  })

  it('accepts commonStyles through single-component root exports', () => {
    const singleOptions: SingleComponentOptions = {
      mode: 'single-component',
      entry: 'src/demo-widget.ts',
      commonStyles: [{ file: 'src/styles/common.css' }],
      client: 'visible',
      clientRootMargin: '150px',
      componentExport: 'hydrate',
    }
    const publicOptions: LitSSGOptions = singleOptions

    const plugin = litSSG(publicOptions)
    expect(plugin.name).toBe('vite-plugin-lit-ssg')
  })

  it('exposes defineLitRoute through the browser subpath', () => {
    const component = class BrowserPage {} as unknown as typeof LitElement

    const route: LitRoute = {
      component,
      title: 'Browser route',
    }

    expect(defineLitRoute(route)).toBe(route)
  })
})
