import { describe, it, expect } from 'vitest'
import { generateSingleClientEntry, generateSingleDevEntry } from '../../vite-plugin-lit-ssg/src/virtual/single-client-entry.js'
import { generateDevSingleServerEntry, generateSingleServerEntry } from '../../vite-plugin-lit-ssg/src/virtual/single-server-entry.ts'
import type { ResolvedSingleComponentOptions } from '../../vite-plugin-lit-ssg/src/types.js'

const defaultOpts: ResolvedSingleComponentOptions = {
  mode: 'single-component',
  entry: 'src/my-element.ts',
  exportName: 'default',
  wrapperTag: 'lit-ssg-root',
  client: 'load',
  componentExport: 'hydrate',
  preload: 'inherit',
  injectPolyfill: false,
  dsdPendingStyle: false,
}

const namedExportOpts: ResolvedSingleComponentOptions = {
  ...defaultOpts,
  exportName: 'MyElement',
}

describe('generateSingleClientEntry', () => {
  it('imports hydration support', () => {
    const result = generateSingleClientEntry(defaultOpts)
    expect(result).toContain('@lit-labs/ssr-client/lit-element-hydrate-support.js')
  })

  it('imports the component entry', () => {
    const result = generateSingleClientEntry(defaultOpts)
    expect(result).toContain("import componentExport from '/src/my-element.ts'")
  })

  it('exports a callable hydrate function', () => {
    const result = generateSingleClientEntry(defaultOpts)
    expect(result).toContain('export async function hydrate(host)')
    expect(result).toContain('customElements.getName(componentExport)')
  })
})

describe('generateSingleDevEntry', () => {
  it('imports hydration support', () => {
    const result = generateSingleDevEntry(defaultOpts)
    expect(result).toContain('@lit-labs/ssr-client/lit-element-hydrate-support.js')
  })

  it('uses default import for default export', () => {
    const result = generateSingleDevEntry(defaultOpts)
    expect(result).toContain('import componentExport from')
    expect(result).not.toContain('{ default as')
  })

  it('uses named import for named export', () => {
    const result = generateSingleDevEntry(namedExportOpts)
    expect(result).toContain('import { MyElement as componentExport }')
  })

  it('keeps the custom element registration check for dev hydration', () => {
    const result = generateSingleDevEntry(defaultOpts)
    expect(result).toContain('customElements.getName(componentExport)')
    expect(result).toContain('throw new Error')
  })

  it('does not append a second wrapper to the document body', () => {
    const result = generateSingleDevEntry(defaultOpts)
    expect(result).not.toContain('document.body.appendChild')
    expect(result).not.toContain('document.createElement(')
  })
})

describe('generateSingleServerEntry', () => {
  it('imports from the configured entry', () => {
    const result = generateSingleServerEntry(defaultOpts)
    expect(result).toContain("from '/src/my-element.ts'")
  })

  it('uses default import for default export', () => {
    const result = generateSingleServerEntry(defaultOpts)
    expect(result).toContain('import componentExport from')
  })

  it('uses named import for named export', () => {
    const result = generateSingleServerEntry(namedExportOpts)
    expect(result).toContain('import { MyElement as componentExport }')
  })

  it('exports a render function', () => {
    const result = generateSingleServerEntry(defaultOpts)
    expect(result).toContain('export async function render(')
    expect(result).toContain('const island = {')
    expect(result).toContain('island,')
  })

  it('throws error when export is missing', () => {
    const result = generateSingleServerEntry(defaultOpts)
    expect(result).toContain('is missing or undefined')
    expect(result).toContain('"default"')
  })

  it('throws error when component is not registered', () => {
    const result = generateSingleServerEntry(defaultOpts)
    expect(result).toContain('is not registered as a custom element')
    expect(result).toContain('@customElement decorator')
  })

  it('uses customElements.getName for tag resolution', () => {
    const result = generateSingleServerEntry(defaultOpts)
    expect(result).toContain('customElements.getName(componentExport)')
  })

  it('uses unsafeStatic for template rendering', () => {
    const result = generateSingleServerEntry(defaultOpts)
    expect(result).toContain("from 'lit/static-html.js'")
    expect(result).toContain('unsafeStatic(tag)')
  })

  it('emits island metadata with the runtime hydrator export', () => {
    const result = generateSingleServerEntry(defaultOpts)
    expect(result).toContain('"client": "load"')
    expect(result).toContain('"componentExport": "hydrate"')
  })
})

describe('generateDevSingleServerEntry', () => {
  it('exports a render function for dev SSR', () => {
    const result = generateDevSingleServerEntry(defaultOpts, '/ssr.js', '/render-result.js')
    expect(result).toContain('export async function render(')
  })

  it('imports Lit SSR helpers through the provided dev paths and exports renderToHtml', () => {
    const result = generateDevSingleServerEntry(defaultOpts, '/ssr.js', '/render-result.js')
    expect(result).toContain("import { render as ssrRender } from '/ssr.js'")
    expect(result).toContain("import { collectResult } from '/render-result.js'")
    expect(result).toContain('export async function renderToHtml(')
  })
})
