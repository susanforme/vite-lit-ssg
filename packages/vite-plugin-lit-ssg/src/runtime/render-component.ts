import { render } from '@lit-labs/ssr'
import { collectResult } from '@lit-labs/ssr/lib/render-result.js'
import type { AssetLinks, PageRenderResult, PreloadPolicy } from '../types.js'
import { normalizePage } from './normalize-page.js'

export async function renderComponent(
  result: PageRenderResult,
  wrapperTag: string | (() => string),
  assets?: AssetLinks,
  preload: PreloadPolicy = 'inherit',
): Promise<string> {
  const page = normalizePage(result)
  const tag = typeof wrapperTag === 'function' ? wrapperTag() : wrapperTag

  let componentHtml = ''
  if (page !== null) {
    componentHtml = await collectResult(render(page.template))
  }

  if (!assets) {
    return `<${tag}>${componentHtml}</${tag}>`
  }

  const assetTags: string[] = []

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

  const inner = assetTags.length > 0
    ? `${componentHtml}\n${assetTags.join('\n')}`
    : componentHtml

  return `<${tag}>${inner}</${tag}>`
}
