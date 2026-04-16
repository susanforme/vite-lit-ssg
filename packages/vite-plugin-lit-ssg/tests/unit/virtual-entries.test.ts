import { describe, it, expect } from 'vitest'
import { generateClientEntry } from '../../src/virtual/client-entry.js'
import { generateServerEntry } from '../../src/virtual/server-entry.js'
import type { PageEntry } from '../../src/scanner/pages.js'

const pages: PageEntry[] = [
  { filePath: '/project/src/pages/index.ts', importPath: '/src/pages/index.ts', route: '/' },
  { filePath: '/project/src/pages/about.ts', importPath: '/src/pages/about.ts', route: '/about' },
]

describe('generateClientEntry', () => {
  it('generates import statements for each page', () => {
    const result = generateClientEntry(pages)
    expect(result).toContain("import '/src/pages/index.ts'")
    expect(result).toContain("import '/src/pages/about.ts'")
  })

  it('ends with a newline', () => {
    const result = generateClientEntry(pages)
    expect(result.endsWith('\n')).toBe(true)
  })

  it('generates one import per page plus the hydration support import', () => {
    const result = generateClientEntry(pages)
    const lines = result.trim().split('\n')
    expect(lines).toHaveLength(3) // 1 hydrate + 2 page imports
  })

  it('puts hydration support import first before page imports', () => {
    const result = generateClientEntry(pages)
    const lines = result.trim().split('\n')
    expect(lines[0]).toContain('@lit-labs/ssr-client/lit-element-hydrate-support.js')
    expect(lines[1]).toContain('/src/pages/index.ts')
  })

  it('still emits hydration support import when pages list is empty', () => {
    const result = generateClientEntry([])
    expect(result).toContain('@lit-labs/ssr-client/lit-element-hydrate-support.js')
    expect(result).not.toContain('/src/pages/')
    expect(result.trim().split('\n')).toHaveLength(1)
  })
})

describe('generateServerEntry', () => {
  it('includes imports for each page route', () => {
    const result = generateServerEntry(pages)
    expect(result).toContain("import route0 from '/src/pages/index.ts'")
    expect(result).toContain("import route1 from '/src/pages/about.ts'")
  })

  it('exports a render function', () => {
    const result = generateServerEntry(pages)
    expect(result).toContain('export async function render(')
  })

  it('generates switch cases for each route', () => {
    const result = generateServerEntry(pages)
    expect(result).toContain('case "/":')
    expect(result).toContain('case "/about":')
  })

  it('uses customElements.getName for tag resolution', () => {
    const result = generateServerEntry(pages)
    expect(result).toContain('customElements.getName(')
  })

  it('uses unsafeStatic for template rendering', () => {
    const result = generateServerEntry(pages)
    expect(result).toContain("from 'lit/static-html.js'")
    expect(result).toContain('unsafeStatic(tag)')
  })

  it('has a default null return', () => {
    const result = generateServerEntry(pages)
    expect(result).toContain('return null')
  })
})
