import { describe, it, expect } from 'vitest'
import { generateSharedEntry, generatePageEntry } from '../../src/virtual/client-entry.js'
import { generateServerEntry } from '../../src/virtual/server-entry.js'
import type { PageEntry } from '../../src/scanner/pages.js'

const pages: PageEntry[] = [
  { filePath: '/project/src/pages/index.ts', importPath: '/src/pages/index.ts', route: '/' },
  { filePath: '/project/src/pages/about.ts', importPath: '/src/pages/about.ts', route: '/about' },
]

describe('generateSharedEntry', () => {
  it('contains only the hydration support import', () => {
    const result = generateSharedEntry()
    expect(result).toContain('@lit-labs/ssr-client/lit-element-hydrate-support.js')
    expect(result).not.toContain('/src/pages/')
  })

  it('ends with a newline', () => {
    const result = generateSharedEntry()
    expect(result.endsWith('\n')).toBe(true)
  })

  it('contains exactly one import statement', () => {
    const result = generateSharedEntry()
    const lines = result.trim().split('\n')
    expect(lines).toHaveLength(1)
  })
})

describe('generatePageEntry', () => {
  it('contains hydration support import and the page import', () => {
    const result = generatePageEntry(pages[0]!)
    expect(result).toContain('@lit-labs/ssr-client/lit-element-hydrate-support.js')
    expect(result).toContain("import '/src/pages/index.ts'")
  })

  it('ends with a newline', () => {
    const result = generatePageEntry(pages[0]!)
    expect(result.endsWith('\n')).toBe(true)
  })

  it('puts hydration support import first', () => {
    const result = generatePageEntry(pages[1]!)
    const lines = result.trim().split('\n')
    expect(lines[0]).toContain('@lit-labs/ssr-client/lit-element-hydrate-support.js')
    expect(lines[1]).toContain('/src/pages/about.ts')
  })

  it('contains exactly 2 import statements', () => {
    const result = generatePageEntry(pages[0]!)
    const lines = result.trim().split('\n')
    expect(lines).toHaveLength(2)
  })

  it('does NOT include other pages', () => {
    const result = generatePageEntry(pages[0]!)
    expect(result).not.toContain('/src/pages/about.ts')
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
