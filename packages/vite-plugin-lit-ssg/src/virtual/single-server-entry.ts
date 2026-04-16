import type { ResolvedSingleComponentOptions } from '../types.js'
import { resolveEntryPath } from './single-client-entry.js'

export function generateSingleServerEntry(opts: ResolvedSingleComponentOptions): string {
  const entryPath = resolveEntryPath(opts.entry)
  const exportClause = opts.exportName === 'default'
    ? `import componentExport from '${entryPath}'`
    : `import { ${opts.exportName} as componentExport } from '${entryPath}'`

  return `import { html, unsafeStatic } from 'lit/static-html.js'
${exportClause}

export async function render(_url, _ctx) {
  if (typeof componentExport === 'undefined' || componentExport === null) {
    throw new Error('[vite-plugin-lit-ssg] single-component: export "${opts.exportName}" is missing or undefined in "${opts.entry}"')
  }
  const tag = customElements.getName(componentExport)
  if (!tag) {
    throw new Error('[vite-plugin-lit-ssg] single-component: component export "${opts.exportName}" from "${opts.entry}" is not registered as a custom element. Make sure to use @customElement decorator.')
  }
  return { template: html\`<\${unsafeStatic(tag)}></\${unsafeStatic(tag)}>\` }
}
`
}
