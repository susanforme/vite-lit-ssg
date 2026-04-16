import type { PageEntry } from '../scanner/pages.js'

const HYDRATE_SUPPORT_IMPORT = `import '@lit-labs/ssr-client/lit-element-hydrate-support.js'`

export function generateSharedEntry(): string {
  return `${HYDRATE_SUPPORT_IMPORT}\n`
}

export function generatePageEntry(page: PageEntry): string {
  return `${HYDRATE_SUPPORT_IMPORT}\nimport '${page.importPath}'\n`
}
