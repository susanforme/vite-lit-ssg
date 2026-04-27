import type { ResolvedSingleComponentOptions } from '../types'

const DEFAULT_HYDRATE_SUPPORT_PATH = '@lit-labs/ssr-client/lit-element-hydrate-support.js'

function getHydrateSupportImport(hydrateSupportPath: string): string {
  return `import ${JSON.stringify(hydrateSupportPath)}`
}

export function resolveEntryPath(entry: string): string {
  return entry.startsWith('/') ? entry : `/${entry}`
}

function getExportClause(opts: ResolvedSingleComponentOptions, entryPath: string): string {
  return opts.exportName === 'default'
    ? `import componentExport from '${entryPath}'`
    : `import { ${opts.exportName} as componentExport } from '${entryPath}'`
}

function getHydrateFunctionSource(opts: ResolvedSingleComponentOptions): string[] {
  return [
    'export async function hydrate(host) {',
    '  const tag = customElements.getName(componentExport)',
    '  if (!tag) {',
    `    throw new Error('[vite-plugin-lit-ssg] Component export "${opts.exportName}" from "${opts.entry}" is not registered as a custom element. Make sure to use @customElement decorator.')`,
    '  }',
    '  host.removeAttribute(\'ssr\')',
    '  return host.querySelector(tag)',
    '}',
  ]
}

export function generateSingleClientEntry(
  opts: ResolvedSingleComponentOptions,
  hydrateSupportPath: string = DEFAULT_HYDRATE_SUPPORT_PATH,
): string {
  const entryPath = resolveEntryPath(opts.entry)

  return [
    getHydrateSupportImport(hydrateSupportPath),
    getExportClause(opts, entryPath),
    '',
    ...getHydrateFunctionSource(opts),
    '',
  ].join('\n')
}

export function generateSingleDevEntry(
  opts: ResolvedSingleComponentOptions,
  hydrateSupportPath: string = DEFAULT_HYDRATE_SUPPORT_PATH,
): string {
  return generateSingleClientEntry(opts, hydrateSupportPath)
}
