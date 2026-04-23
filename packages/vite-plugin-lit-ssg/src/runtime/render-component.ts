import { render } from '@lit-labs/ssr'
import { collectResult } from '@lit-labs/ssr/lib/render-result.js'
import type { AssetLinks, PageRenderResult, PreloadPolicy, SingleComponentIslandMetadata } from '../types'
import { normalizePage } from './normalize-page'
import { buildDsdPolyfillScriptsForWrapper } from './dsd-polyfill'
import {
  buildSingleComponentIslandAttrs,
  buildSingleComponentIslandRuntimeScriptTag,
  SINGLE_COMPONENT_ISLAND_TAG,
} from './single-island'

export interface RenderComponentOptions {
  preload?: PreloadPolicy
  injectPolyfill?: boolean
  dsdPendingStyle?: boolean
  islandRuntimeSrc: string
}

export async function renderComponent(
  result: PageRenderResult,
  wrapperTag: string | (() => string),
  assets?: AssetLinks,
  preloadOrOpts: PreloadPolicy | RenderComponentOptions = 'inherit',
): Promise<string> {
  const opts: RenderComponentOptions = typeof preloadOrOpts === 'string'
    ? { preload: preloadOrOpts, islandRuntimeSrc: '' }
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

  const island: SingleComponentIslandMetadata = page?.island ?? {
    client: 'load',
    componentExport: 'hydrate',
  }
  const wrapperHtml = `<${tag}>${componentHtml}</${tag}>`
  const islandAttrs = buildSingleComponentIslandAttrs(island, assets?.js, injectPolyfill && dsdPendingStyle)
  const islandRuntimeScript = opts.islandRuntimeSrc
    ? buildSingleComponentIslandRuntimeScriptTag(opts.islandRuntimeSrc)
    : ''
  const pendingStyleTag = injectPolyfill && dsdPendingStyle
    ? `<style>${SINGLE_COMPONENT_ISLAND_TAG}[dsd-pending]{display:none}</style>`
    : ''

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
  }

  const islandInner = assetTags.length > 0 ? `${assetTags.join('\n')}\n${wrapperHtml}` : wrapperHtml
  const islandHtml = `<${SINGLE_COMPONENT_ISLAND_TAG} ${islandAttrs}>${islandInner}</${SINGLE_COMPONENT_ISLAND_TAG}>`

  if (!injectPolyfill) {
    return [islandRuntimeScript, islandHtml].filter(Boolean).join('\n')
  }

  const polyfillScripts = await buildDsdPolyfillScriptsForWrapper(SINGLE_COMPONENT_ISLAND_TAG, dsdPendingStyle)
  return [islandRuntimeScript, pendingStyleTag, islandHtml, polyfillScripts].filter(Boolean).join('\n')
}
