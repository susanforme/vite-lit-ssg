import { render } from '@lit-labs/ssr'
import { collectResult } from '@lit-labs/ssr/lib/render-result.js'
import type { AssetLinks, PageRenderResult, PreloadPolicy } from '../types'
import { normalizePage } from './normalize-page'
import { buildDsdPolyfillScriptsForWrapper } from './dsd-polyfill'

export interface RenderComponentOptions {
  preload?: PreloadPolicy
  injectPolyfill?: boolean
  dsdPendingStyle?: boolean
}

export async function renderComponent(
  result: PageRenderResult,
  wrapperTag: string | (() => string),
  assets?: AssetLinks,
  preloadOrOpts: PreloadPolicy | RenderComponentOptions = 'inherit',
): Promise<string> {
  const opts: RenderComponentOptions = typeof preloadOrOpts === 'string'
    ? { preload: preloadOrOpts }
    : preloadOrOpts
  const preload = opts.preload ?? 'inherit'
  const injectPolyfill = opts.injectPolyfill ?? false
  const dsdPendingStyle = opts.dsdPendingStyle ?? injectPolyfill

  const page = normalizePage(result)
  const tag = typeof wrapperTag === 'function' ? wrapperTag() : wrapperTag

  let componentHtml = ''
  if (page !== null) {
    componentHtml = await collectResult(render(page.template))
  }

  const wrapperOpenTag = injectPolyfill && dsdPendingStyle ? `<${tag} dsd-pending>` : `<${tag}>`
  const pendingStyleTag = injectPolyfill && dsdPendingStyle ? `<style>${tag}[dsd-pending]{display:none}</style>` : ''

  const assetTags: string[] = []

  if (assets) {
    if (preload !== 'entry-only') {
      for (const href of assets.css) {
        assetTags.push(`<link rel="stylesheet" href="${href}">`)
      }
    }

    if (preload === 'inherit') {
      for (const href of assets.modulepreloads) {
        assetTags.push(`<link rel="modulepreload" href="${href}">`)
      }
    }

    assetTags.push(`<script type="module" src="${assets.js}"></script>`)
  }

  const inner = assetTags.length > 0 ? `${componentHtml}\n${assetTags.join('\n')}` : componentHtml
  const wrapperHtml = `${wrapperOpenTag}${inner}</${tag}>`

  if (!injectPolyfill) {
    return wrapperHtml
  }

  const polyfillScripts = await buildDsdPolyfillScriptsForWrapper(tag, dsdPendingStyle)
  return [pendingStyleTag, wrapperHtml, polyfillScripts].filter(Boolean).join('\n')
}
