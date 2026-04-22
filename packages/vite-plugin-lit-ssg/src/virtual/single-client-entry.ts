import type { ResolvedSingleComponentOptions } from '../types'

const DEFAULT_HYDRATE_SUPPORT_PATH = '@lit-labs/ssr-client/lit-element-hydrate-support.js'

function getHydrateSupportImport(hydrateSupportPath: string): string {
  return `import ${JSON.stringify(hydrateSupportPath)}`
}

export function resolveEntryPath(entry: string): string {
  return entry.startsWith('/') ? entry : `/${entry}`
}

export function generateSingleClientEntry(
  opts: ResolvedSingleComponentOptions,
  hydrateSupportPath: string = DEFAULT_HYDRATE_SUPPORT_PATH,
): string {
  const entryPath = resolveEntryPath(opts.entry)
  return `${getHydrateSupportImport(hydrateSupportPath)}\nimport '${entryPath}'\n`
}

export function generateSingleDevEntry(
  opts: ResolvedSingleComponentOptions,
  hydrateSupportPath: string = DEFAULT_HYDRATE_SUPPORT_PATH,
): string {
  const entryPath = resolveEntryPath(opts.entry)
  const exportClause = opts.exportName === 'default'
    ? `import componentExport from '${entryPath}'`
    : `import { ${opts.exportName} as componentExport } from '${entryPath}'`

  const wrapperTag = typeof opts.wrapperTag === 'function' ? opts.wrapperTag() : opts.wrapperTag

  return `${getHydrateSupportImport(hydrateSupportPath)}
${exportClause}
const tag = customElements.getName(componentExport)
if (tag) {
  const wrapper = document.createElement('${wrapperTag}')
  const el = document.createElement(tag)
  wrapper.appendChild(el)
  document.body.appendChild(wrapper)
} else {
  console.error('[vite-plugin-lit-ssg] Component export "${opts.exportName}" from "${opts.entry}" is not registered as a custom element. Make sure to use @customElement decorator.')
}
`
}
