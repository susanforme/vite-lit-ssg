import type { ViteDevServer } from 'vite'
import type { PreloadPolicy } from '../types.js'
import { VIRTUAL_SERVER_ID, VIRTUAL_SINGLE_SERVER_ID } from '../plugin/constants.js'

interface DevServerMod {
  renderToHtml: (url: string, ctx: { route: string; params: Record<string, string> }) => Promise<string | null>
  getPageMeta?: (url: string) => {
    title?: string
    lang?: string
    meta?: Record<string, string>[]
    head?: string[]
    htmlAttrs?: Record<string, string>
    bodyAttrs?: Record<string, string>
  } | null
}

async function loadDevMod(server: ViteDevServer, virtualId: string): Promise<DevServerMod> {
  const mod = await server.ssrLoadModule(virtualId, { fixStacktrace: false })
  if (typeof mod['renderToHtml'] !== 'function') {
    throw new Error(
      `[vite-plugin-lit-ssg] Dev SSR entry "${virtualId}" must export a \`renderToHtml\` function`,
    )
  }
  return mod as DevServerMod
}

export async function renderDevPage(
  server: ViteDevServer,
  route: string,
  devScriptSrc: string,
  injectPolyfill: boolean,
): Promise<string> {
  const devMod = await loadDevMod(server, VIRTUAL_SERVER_ID)
  const [appHtml, rawMeta] = await Promise.all([
    devMod.renderToHtml(route, { route, params: {} }),
    devMod.getPageMeta ? devMod.getPageMeta(route) : null,
  ])

  if (appHtml === null || appHtml === undefined) return ''

  const lang = rawMeta?.lang ?? 'en'
  const title = rawMeta?.title ?? ''
  const metaTags = rawMeta?.meta ?? []
  const extraHead = rawMeta?.head ?? []
  const htmlAttrs = rawMeta?.htmlAttrs ?? {}
  const bodyAttrs = rawMeta?.bodyAttrs ?? {}

  const htmlAttrStr = attrsToString({ lang, ...htmlAttrs })
  const bodyAttrStr = attrsToString(bodyAttrs)

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
  const devMod = await loadDevMod(server, VIRTUAL_SINGLE_SERVER_ID)
  const appHtml = await devMod.renderToHtml('/', { route: '/', params: {} })

  if (appHtml === null || appHtml === undefined) {
    throw new Error('[vite-plugin-lit-ssg] single-component SSR dev render returned null — component may not be registered')
  }

  const scriptTag = `<script type="module" src="${devScriptSrc}"></script>`

  const innerContent = `${appHtml}\n${scriptTag}`

  if (!injectPolyfill) {
    return `<${wrapperTag}>${innerContent}</${wrapperTag}>`
  }

  const dsdStyle = dsdPendingStyle
    ? `<style>${wrapperTag}[dsd-pending]{display:none}</style>`
    : ''

  const { buildDsdPolyfillScripts } = await import('../runtime/dsd-polyfill.js')
  const polyfillScripts = await buildDsdPolyfillScripts()

  return [
    dsdStyle,
    `<${wrapperTag} dsd-pending>${innerContent}</${wrapperTag}>`,
    polyfillScripts,
  ].filter(Boolean).join('\n')
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
