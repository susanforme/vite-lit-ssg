import { render } from '@lit-labs/ssr'
import { collectResult } from '@lit-labs/ssr/lib/render-result.js'
import type { AssetLinks, PageRenderResult } from '../types'
import { normalizePage } from './normalize-page'
import { buildDsdPolyfillScripts } from './dsd-polyfill'

const DSD_PENDING_STYLE = `  <style>body[dsd-pending]{display:none}</style>`

export async function renderPage(
  result: PageRenderResult,
  assets: AssetLinks,
  injectPolyfill = true,
): Promise<string> {
  const page = normalizePage(result)

  const lang = page?.lang ?? 'en'
  const title = page?.title ?? ''
  const metaTags = page?.meta ?? []
  const extraHead = page?.head ?? []
  const htmlAttrs = page?.htmlAttrs ?? {}
  const bodyAttrs = page?.bodyAttrs ?? {}

  const htmlAttrStr = attrsToString({ lang, ...htmlAttrs })
  const bodyAttrStr = attrsToString(bodyAttrs)

  let appHtml = ''
  if (page !== null) {
    appHtml = await collectResult(render(page.template))
  }

  const cssLinks = assets.css
    .map((href) => `  <link rel="stylesheet" href="${href}">`)
    .join('\n')

  const preloadLinks = assets.modulepreloads
    .map((href) => `  <link rel="modulepreload" href="${href}">`)
    .join('\n')

  const metaTagsStr = metaTags
    .map((attrs) => `  <meta${attrsToString(attrs)}>`)
    .join('\n')

  const extraHeadStr = extraHead.map((h) => `  ${h}`).join('\n')

  const titleTag = title ? `  <title>${escapeHtml(title)}</title>` : ''

  const headParts = [
    titleTag,
    metaTagsStr,
    cssLinks,
    preloadLinks,
    injectPolyfill ? DSD_PENDING_STYLE : '',
    extraHeadStr,
  ]
    .filter(Boolean)
    .join('\n')

  const dsdPolyfillScripts = injectPolyfill ? await buildDsdPolyfillScripts() : ''

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
    `  <script type="module" src="${assets.js}"></script>`,
    '</body>',
    '</html>',
  ].join('\n')
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
