import type { ViteDevServer } from 'vite'
import type { PageRenderResult, PreloadPolicy, ServerEntry } from '../types.js'
import { VIRTUAL_SERVER_ID, VIRTUAL_SINGLE_SERVER_ID } from '../plugin/constants.js'

async function loadDevServerEntry(server: ViteDevServer, virtualId: string): Promise<ServerEntry> {
  const mod = await server.ssrLoadModule(virtualId, { fixStacktrace: false })
  if (typeof mod['render'] !== 'function') {
    throw new Error(
      `[vite-plugin-lit-ssg] Dev SSR entry "${virtualId}" must export a \`render\` function`,
    )
  }
  return mod as ServerEntry
}

async function collectSsrHtml(result: PageRenderResult): Promise<string> {
  if (result === null || result === undefined) return ''

  const { render } = await import('@lit-labs/ssr')
  const { collectResult } = await import('@lit-labs/ssr/lib/render-result.js')
  const { isTemplateResult } = await import('lit/directive-helpers.js')

  const template = isTemplateResult(result) ? result : (result as { template: unknown }).template
  return collectResult(render(template as Parameters<typeof render>[0]))
}

export async function renderDevPage(
  server: ViteDevServer,
  route: string,
  devScriptSrc: string,
  injectPolyfill: boolean,
): Promise<string> {
  const serverEntry = await loadDevServerEntry(server, VIRTUAL_SERVER_ID)
  const result = await serverEntry.render(route, { route, params: {} })

  if (result === null || result === undefined) return ''

  const { normalizePage } = await import('../runtime/normalize-page.js')
  const page = normalizePage(result)

  const lang = page?.lang ?? 'en'
  const title = page?.title ?? ''
  const metaTags = page?.meta ?? []
  const extraHead = page?.head ?? []
  const htmlAttrs = page?.htmlAttrs ?? {}
  const bodyAttrs = page?.bodyAttrs ?? {}

  const htmlAttrStr = attrsToString({ lang, ...htmlAttrs })
  const bodyAttrStr = attrsToString(bodyAttrs)

  const appHtml = await collectSsrHtml(result)

  const titleTag = title ? `  <title>${escapeHtml(title)}</title>` : ''
  const metaTagsStr = metaTags.map((attrs) => `  <meta${attrsToString(attrs)}>`).join('\n')
  const extraHeadStr = extraHead.map((h) => `  ${h}`).join('\n')

  const DSD_PENDING_STYLE = `  <style>body[dsd-pending]{display:none}</style>`

  const headParts = [
    titleTag,
    metaTagsStr,
    injectPolyfill ? DSD_PENDING_STYLE : '',
    extraHeadStr,
  ]
    .filter(Boolean)
    .join('\n')

  let dsdPolyfillScripts = ''
  if (injectPolyfill) {
    const { buildDsdPolyfillScripts } = await import('../runtime/dsd-polyfill.js')
    dsdPolyfillScripts = await buildDsdPolyfillScripts()
  }

  const bodyOpenTag = injectPolyfill ? `<body dsd-pending${bodyAttrStr}>` : `<body${bodyAttrStr}>`

  return [
    '<!doctype html>',
    `<html${htmlAttrStr}>`,
    '<head>',
    '  <meta charset="UTF-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    headParts,
    '</head>',
    bodyOpenTag,
    ...(dsdPolyfillScripts ? [dsdPolyfillScripts] : []),
    appHtml,
    `  <script type="module" src="${devScriptSrc}"></script>`,
    '</body>',
    '</html>',
  ].join('\n')
}

export async function renderDevSingleComponent(
  server: ViteDevServer,
  wrapperTag: string,
  devScriptSrc: string,
  injectPolyfill: boolean,
  dsdPendingStyle: boolean,
  preload: PreloadPolicy,
): Promise<string> {
  const serverEntry = await loadDevServerEntry(server, VIRTUAL_SINGLE_SERVER_ID)
  const result = await serverEntry.render('/', { route: '/', params: {} })

  if (result === null || result === undefined) {
    throw new Error('[vite-plugin-lit-ssg] single-component SSR dev render returned null u2014 component may not be registered')
  }

  const { renderComponent } = await import('../runtime/render-component.js')

  return renderComponent(result, wrapperTag, { js: devScriptSrc, css: [], modulepreloads: [] }, {
    preload,
    injectPolyfill,
    dsdPendingStyle,
  })
}

function attrsToString(attrs: Record<string, string>): string {
  const pairs = Object.entries(attrs)
  if (pairs.length === 0) return ''
  return ' ' + pairs.map(([k, v]) => `${k}="${escapeAttr(v)}"`).join(' ')
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}
