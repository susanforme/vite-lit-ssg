import type { PageEntry } from '../scanner/pages'

const DEFAULT_HYDRATE_SUPPORT_PATH = '@lit-labs/ssr-client/lit-element-hydrate-support.js'

function getHydrateSupportImport(hydrateSupportPath: string): string {
  return `import ${JSON.stringify(hydrateSupportPath)}`
}

export function generateSharedEntry(hydrateSupportPath: string = DEFAULT_HYDRATE_SUPPORT_PATH): string {
  return `${getHydrateSupportImport(hydrateSupportPath)}\n`
}

export function generatePageEntry(page: PageEntry, hydrateSupportPath: string = DEFAULT_HYDRATE_SUPPORT_PATH): string {
  return `${getHydrateSupportImport(hydrateSupportPath)}\nimport '${page.importPath}'\n`
}
