import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import type { ResolvedConfig } from 'vite'
import { litSSG } from '../../vite-plugin-lit-ssg/src/plugin/index.js'

interface TestResolveContext {
  resolve: (specifier: string, importer?: string) => Promise<{ id: string }>
}

interface TestPlugin {
  name: string
  configResolved?: (config: ResolvedConfig) => void | Promise<void>
  buildStart?: () => void | Promise<void>
  transform?: (this: TestResolveContext, code: string, id: string) => unknown | Promise<unknown>
}

function getTransformedCode(result: unknown): string {
  if (typeof result === 'string') return result
  if (result && typeof result === 'object' && 'code' in result) {
    const { code } = result
    if (typeof code === 'string') return code
  }
  return ''
}

async function writeFixtureFiles(root: string, files: Record<string, string>) {
  await Promise.all(
    Object.entries(files).map(async ([relativePath, contents]) => {
      const filePath = join(root, relativePath)
      await mkdir(dirname(filePath), { recursive: true })
      await writeFile(filePath, contents)
    }),
  )
}

function createResolvedConfig(root: string): ResolvedConfig {
  return {
    root,
    base: '/',
    logger: {
      info: () => undefined,
      warn: () => undefined,
    },
  } as unknown as ResolvedConfig
}

function createResolveContext(root: string) {
  const context: TestResolveContext = {
    resolve: vi.fn(async (specifier: string, importer?: string) => {
      if (specifier.startsWith('.')) {
        return { id: resolve(dirname(importer ?? root), specifier) }
      }

      if (specifier.startsWith('/')) {
        return { id: resolve(root, specifier.slice(1)) }
      }

      return { id: specifier }
    }),
  }

  return context
}

async function createTempProject(files: Record<string, string>) {
  const root = await mkdtemp(join(tmpdir(), 'vite-lit-ssg-common-styles-'))
  await writeFixtureFiles(root, files)
  return root
}

async function initPagePlugin(root: string) {
  const plugin = litSSG({
    commonStyles: { file: 'src/styles/common.css' },
  }) as unknown as TestPlugin

  if (!plugin.configResolved || !plugin.buildStart) {
    throw new Error('Expected page plugin hooks to be defined for the transform test.')
  }

  await plugin.configResolved(createResolvedConfig(root))
  await plugin.buildStart()
  return plugin
}

async function initSinglePlugin(root: string, exportName = 'default') {
  const plugin = litSSG({
    mode: 'single-component',
    entry: 'src/demo-widget.ts',
    exportName,
    commonStyles: { file: 'src/styles/common.css' },
  }) as unknown as TestPlugin

  if (!plugin.configResolved) {
    throw new Error('Expected single-component plugin configResolved hook to be defined for the transform test.')
  }

  await plugin.configResolved(createResolvedConfig(root))
  return plugin
}

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('commonStyles source transform', () => {
  it('rewrites only the route component in a page module', async () => {
    const root = await createTempProject({
      'src/styles/common.css': ':host { border-top: 4px solid chartreuse; }',
      'src/pages/index.ts': `
import { LitElement, css } from 'lit'
import { defineLitRoute } from 'vite-plugin-lit-ssg'

class HelperCard extends LitElement {
  static styles = css\`p { color: orange; }\`
}

export class HomePage extends LitElement {
  static styles = css\`p { color: red; }\`
}

export default defineLitRoute({
  component: HomePage,
})
`,
    })
    roots.push(root)

    const plugin = await initPagePlugin(root)
    const pagePath = join(root, 'src/pages/index.ts')
    const code = await readFile(pagePath, 'utf-8')
    if (!plugin.transform) throw new Error('Expected transform hook to be defined.')
    const result = await plugin.transform.call(createResolveContext(root), code, pagePath)

    expect(result).not.toBeNull()
    const transformed = getTransformedCode(result)
    expect(transformed).toContain("import __litSsgCommonCssText from '/src/styles/common.css?inline'")
    expect(transformed).toContain('static styles = [__litSsgCommonStyles, css`p { color: red; }`]')
    expect(transformed).toContain('static styles = css`p { color: orange; }`')
    expect(transformed.match(/__litSsgCommonStyles/g)?.length).toBeGreaterThanOrEqual(2)
  })

  it('queues and rewrites an imported route component target', async () => {
    const root = await createTempProject({
      'src/styles/common.css': ':host { border-top: 4px solid chartreuse; }',
      'src/pages/index.ts': `
import { defineLitRoute } from 'vite-plugin-lit-ssg'
import { ImportedPage } from '../shared/imported-page.js'

export default defineLitRoute({
  component: ImportedPage,
})
`,
      'src/shared/imported-page.js': `
import { LitElement } from 'lit'

export class HelperCard extends LitElement {
  static styles = [
    'leave me alone',
  ]
}

export class ImportedPage extends LitElement {}
`,
    })
    roots.push(root)

    const plugin = await initPagePlugin(root)
    const resolveContext = createResolveContext(root)
    const pagePath = join(root, 'src/pages/index.ts')
    const importedPath = join(root, 'src/shared/imported-page.js')

    const pageCode = await readFile(pagePath, 'utf-8')
    if (!plugin.transform) throw new Error('Expected transform hook to be defined.')
    const pageResult = await plugin.transform.call(resolveContext, pageCode, pagePath)
    expect(pageResult).toBeNull()

    const importedCode = await readFile(importedPath, 'utf-8')
    const importedResult = await plugin.transform.call(resolveContext, importedCode, importedPath)
    const transformed = getTransformedCode(importedResult)

    expect(resolveContext.resolve).toHaveBeenCalled()
    expect(transformed).toContain('static styles = [__litSsgCommonStyles]')
    expect(transformed).toContain("static styles = [\n    'leave me alone',\n  ]")
  })

  it('prepends common styles ahead of existing static styles arrays', async () => {
    const root = await createTempProject({
      'src/styles/common.css': ':host { border-top: 4px solid chartreuse; }',
      'src/demo-widget.ts': `
import { LitElement, css } from 'lit'

export class DemoWidget extends LitElement {
  static styles = [css\`:host { color: blue; }\`, css\`p { color: red; }\`]
}

export default DemoWidget
`,
    })
    roots.push(root)

    const plugin = await initSinglePlugin(root)
    const entryPath = join(root, 'src/demo-widget.ts')
    const code = await readFile(entryPath, 'utf-8')
    if (!plugin.transform) throw new Error('Expected transform hook to be defined.')
    const result = await plugin.transform.call(createResolveContext(root), code, entryPath)
    const transformed = getTransformedCode(result)

    expect(transformed).toContain('static styles = [__litSsgCommonStyles, css`:host { color: blue; }`, css`p { color: red; }`]')
  })

  it('prepends common styles ahead of generic static styles expressions', async () => {
    const root = await createTempProject({
      'src/styles/common.css': ':host { border-top: 4px solid chartreuse; }',
      'src/demo-widget.ts': `
import { LitElement, css } from 'lit'

const localStyles = css\`p { color: teal; }\`

export class DemoWidget extends LitElement {
  static styles = localStyles
}

export default DemoWidget
`,
    })
    roots.push(root)

    const plugin = await initSinglePlugin(root)
    const entryPath = join(root, 'src/demo-widget.ts')
    const code = await readFile(entryPath, 'utf-8')
    if (!plugin.transform) throw new Error('Expected transform hook to be defined.')
    const result = await plugin.transform.call(createResolveContext(root), code, entryPath)
    const transformed = getTransformedCode(result)

    expect(transformed).toContain('static styles = [__litSsgCommonStyles, localStyles]')
  })

  it('rewrites only the configured single-component export', async () => {
    const root = await createTempProject({
      'src/styles/common.css': ':host { border-top: 4px solid chartreuse; }',
      'src/demo-widget.ts': `
import { LitElement, css } from 'lit'

class HelperWidget extends LitElement {
  static styles = css\`p { color: orange; }\`
}

class DemoWidget extends LitElement {
  static styles = css\`p { color: blue; }\`
}

export { DemoWidget as NamedWidget }
`,
    })
    roots.push(root)

    const plugin = await initSinglePlugin(root, 'NamedWidget')
    const entryPath = join(root, 'src/demo-widget.ts')
    const code = await readFile(entryPath, 'utf-8')
    if (!plugin.transform) throw new Error('Expected transform hook to be defined.')
    const result = await plugin.transform.call(createResolveContext(root), code, entryPath)
    const transformed = getTransformedCode(result)

    expect(transformed).toContain('static styles = [__litSsgCommonStyles, css`p { color: blue; }`]')
    expect(transformed).toContain('static styles = css`p { color: orange; }`')
  })

  it('fails on complex static get styles getters', async () => {
    const root = await createTempProject({
      'src/styles/common.css': ':host { border-top: 4px solid chartreuse; }',
      'src/demo-widget.ts': `
import { LitElement, css } from 'lit'

export class DemoWidget extends LitElement {
  static get styles() {
    if (Math.random() > 0.5) {
      return css\`p { color: blue; }\`
    }

    return css\`p { color: red; }\`
  }
}

export default DemoWidget
`,
    })
    roots.push(root)

    const plugin = await initSinglePlugin(root)
    const entryPath = join(root, 'src/demo-widget.ts')
    const code = await readFile(entryPath, 'utf-8')
    if (!plugin.transform) throw new Error('Expected transform hook to be defined.')

    await expect(
      plugin.transform.call(createResolveContext(root), code, entryPath),
    ).rejects.toThrow('static get styles() getters with a single return statement')
  })

  it('prepends common styles ahead of simple static get styles() returns', async () => {
    const root = await createTempProject({
      'src/styles/common.css': ':host { border-top: 4px solid chartreuse; }',
      'src/demo-widget.ts': `
import { LitElement, css } from 'lit'

export class DemoWidget extends LitElement {
  static get styles() {
    return css\`p { color: rebeccapurple; }\`
  }
}

export default DemoWidget
`,
    })
    roots.push(root)

    const plugin = await initSinglePlugin(root)
    const entryPath = join(root, 'src/demo-widget.ts')
    const code = await readFile(entryPath, 'utf-8')
    if (!plugin.transform) throw new Error('Expected transform hook to be defined.')
    const result = await plugin.transform.call(createResolveContext(root), code, entryPath)
    const transformed = getTransformedCode(result)

    expect(transformed).toContain('return [__litSsgCommonStyles, css`p { color: rebeccapurple; }`]')
  })
})
