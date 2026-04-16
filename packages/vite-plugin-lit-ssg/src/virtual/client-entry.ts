import type { PageEntry } from '../scanner/pages.js'

const HYDRATE_SUPPORT_IMPORT = `import '@lit-labs/ssr-client/lit-element-hydrate-support.js'`

export function generateClientEntry(pages: PageEntry[]): string {
  const pageImports = pages.map((p) => `import '${p.importPath}'`).join('\n')
  return pageImports ? `${HYDRATE_SUPPORT_IMPORT}\n${pageImports}\n` : `${HYDRATE_SUPPORT_IMPORT}\n`
}
