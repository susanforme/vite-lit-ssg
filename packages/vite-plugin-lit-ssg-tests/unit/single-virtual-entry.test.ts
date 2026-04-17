import { describe, it, expect } from 'vitest'
import { generateSingleClientEntry, generateSingleDevEntry } from '../../vite-plugin-lit-ssg/src/virtual/single-client-entry.js'
import { generateSingleServerEntry } from '../../vite-plugin-lit-ssg/src/virtual/single-server-entry.js'
import type { ResolvedSingleComponentOptions } from '../../vite-plugin-lit-ssg/src/types.js'

const defaultOpts: ResolvedSingleComponentOptions = {
  mode: 'single-component',
  entry: 'src/my-element.ts',
  exportName: 'default',
  wrapperTag: 'lit-ssg-root',
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
    expect(result).toContain("import '/src/my-element.ts'")
  })

  it('ends with a newline', () => {
    const result = generateSingleClientEntry(defaultOpts)
    expect(result.endsWith('\n')).toBe(true)
  })
})

describe('generateSingleDevEntry', () => {
  it('does not import hydration support in dev mode', () => {
    const result = generateSingleDevEntry(defaultOpts)
    expect(result).not.toContain('@lit-labs/ssr-client/lit-element-hydrate-support.js')
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

  it('appends wrapper containing component to body', () => {
    const result = generateSingleDevEntry(defaultOpts)
    expect(result).toContain('customElements.getName(componentExport)')
    expect(result).toContain('document.body.appendChild')
    expect(result).toContain('wrapper')
  })

  it('creates wrapper element using configured wrapperTag', () => {
    const result = generateSingleDevEntry(defaultOpts)
    expect(result).toContain("document.createElement('lit-ssg-root')")
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
})
