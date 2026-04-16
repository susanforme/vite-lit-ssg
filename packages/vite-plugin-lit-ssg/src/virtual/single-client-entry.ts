import type { ResolvedSingleComponentOptions } from '../types.js'

const HYDRATE_SUPPORT_IMPORT = `import '@lit-labs/ssr-client/lit-element-hydrate-support.js'`

export function resolveEntryPath(entry: string): string {
  return entry.startsWith('/') ? entry : `/${entry}`
}

export function generateSingleClientEntry(opts: ResolvedSingleComponentOptions): string {
  const entryPath = resolveEntryPath(opts.entry)
  return `${HYDRATE_SUPPORT_IMPORT}\nimport '${entryPath}'\n`
}

export function generateSingleDevEntry(opts: ResolvedSingleComponentOptions): string {
  const entryPath = resolveEntryPath(opts.entry)
  const exportClause = opts.exportName === 'default'
    ? `import componentExport from '${entryPath}'`
    : `import { ${opts.exportName} as componentExport } from '${entryPath}'`

  return `${HYDRATE_SUPPORT_IMPORT}
${exportClause}
const tag = customElements.getName(componentExport)
if (tag) {
  const el = document.createElement(tag)
  document.body.appendChild(el)
} else {
  console.error('[vite-plugin-lit-ssg] Component export "${opts.exportName}" from "${opts.entry}" is not registered as a custom element. Make sure to use @customElement decorator.')
}
`
}
