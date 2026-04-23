import type { ResolvedSingleComponentOptions, SingleComponentIslandMetadata } from '../types'
import { resolveEntryPath } from './single-client-entry'

function getExportClause(opts: ResolvedSingleComponentOptions, entryPath: string): string {
  return opts.exportName === 'default'
    ? `import componentExport from '${entryPath}'`
    : `import { ${opts.exportName} as componentExport } from '${entryPath}'`
}

function getIslandMetadata(opts: ResolvedSingleComponentOptions): SingleComponentIslandMetadata {
  return {
    client: opts.client,
    componentExport: opts.componentExport,
    ...(opts.clientMedia ? { clientMedia: opts.clientMedia } : {}),
    ...(opts.clientRootMargin ? { clientRootMargin: opts.clientRootMargin } : {}),
    ...(opts.clientIdleTimeout !== undefined ? { clientIdleTimeout: opts.clientIdleTimeout } : {}),
  }
}

function getRenderFunctionSource(opts: ResolvedSingleComponentOptions): string[] {
  const island = JSON.stringify(getIslandMetadata(opts), null, 2)

  return [
    'export async function render(_url, _ctx) {',
    '  if (typeof componentExport === \'undefined\' || componentExport === null) {',
    `    throw new Error('[vite-plugin-lit-ssg] single-component: export "${opts.exportName}" is missing or undefined in "${opts.entry}"')`,
    '  }',
    '  const tag = customElements.getName(componentExport)',
    '  if (!tag) {',
    `    throw new Error('[vite-plugin-lit-ssg] single-component: component export "${opts.exportName}" from "${opts.entry}" is not registered as a custom element. Make sure to use @customElement decorator.')`,
    '  }',
    `  const island = ${island}`,
    '  return {',
    '    template: html`<${unsafeStatic(tag)}></${unsafeStatic(tag)}>`,',
    '    island,',
    '  }',
    '}',
  ]
}

export function generateSingleServerEntry(opts: ResolvedSingleComponentOptions): string {
  const entryPath = resolveEntryPath(opts.entry)
  return [
    `import { html, unsafeStatic } from 'lit/static-html.js'`,
    getExportClause(opts, entryPath),
    '',
    ...getRenderFunctionSource(opts),
    '',
  ].join('\n')
}

export function generateDevSingleServerEntry(
  opts: ResolvedSingleComponentOptions,
  ssrIndexPath: string,
  ssrRenderResultPath: string,
): string {
  const entryPath = resolveEntryPath(opts.entry)
  return [
    `import { html, unsafeStatic } from 'lit/static-html.js'`,
    `import { render as ssrRender } from '${ssrIndexPath}'`,
    `import { collectResult } from '${ssrRenderResultPath}'`,
    getExportClause(opts, entryPath),
    '',
    ...getRenderFunctionSource(opts),
    '',
    'export async function renderToHtml(_url, _ctx) {',
    '  const result = await render(_url, _ctx)',
    '  if (result === null || result === undefined) return null',
    '  return collectResult(ssrRender(result.template))',
    '}',
    '',
  ].join('\n')
}
