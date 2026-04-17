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

  const wrapperTag = typeof opts.wrapperTag === 'function' ? opts.wrapperTag() : opts.wrapperTag

  // Dev mode: no hydrate-support import — component renders fresh (no SSR output to hydrate)
  return `${exportClause}
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
