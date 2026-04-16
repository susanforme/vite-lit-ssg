import { render } from '@lit-labs/ssr'
import { collectResult } from '@lit-labs/ssr/lib/render-result.js'
import type { AssetLinks } from '../types.js'
import type { PageRenderResult } from '../types.js'
import type { PreloadPolicy } from '../types.js'
import { normalizePage } from './normalize-page.js'

const DSD_PENDING_STYLE = `  <style>body[dsd-pending]{display:none}</style>`

const DSD_POLYFILL_SCRIPTS = `  <script>if('shadowrootmode'in HTMLTemplateElement.prototype){document.body.removeAttribute('dsd-pending')}</script>
  <script type="module">if(!('shadowrootmode'in HTMLTemplateElement.prototype)){const{hydrateShadowRoots}=await import('https://unpkg.com/@webcomponents/template-shadowroot@0.2.1/template-shadowroot.js');hydrateShadowRoots(document.body);document.body.removeAttribute('dsd-pending')}</script>`

function filterAssetsByPolicy(assets: AssetLinks, preload: PreloadPolicy): AssetLinks {
  if (preload === 'inherit') {
    return assets
  }
  if (preload === 'none') {
    return { js: assets.js, css: assets.css, modulepreloads: [] }
  }
  return { js: assets.js, css: [], modulepreloads: [] }
}

export async function renderComponent(
  result: PageRenderResult,
  assets: AssetLinks,
  wrapperTag: string,
  preload: PreloadPolicy,
): Promise<string> {
  const page = normalizePage(result)

  let componentHtml = ''
  if (page !== null) {
    componentHtml = await collectResult(render(page.template))
  }

  const filtered = filterAssetsByPolicy(assets, preload)

  const cssLinks = filtered.css
    .map((href) => `  <link rel="stylesheet" href="${href}">`)
    .join('\n')

  const preloadLinks = filtered.modulepreloads
    .map((href) => `  <link rel="modulepreload" href="${href}">`)
    .join('\n')

  const headParts = [cssLinks, preloadLinks, DSD_PENDING_STYLE]
    .filter(Boolean)
    .join('\n')

  const wrappedComponent = `<${wrapperTag}>${componentHtml}</${wrapperTag}>`

  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '  <meta charset="UTF-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    headParts,
    '</head>',
    '<body dsd-pending>',
    DSD_POLYFILL_SCRIPTS,
    wrappedComponent,
    `  <script type="module" src="${filtered.js}"></script>`,
    '</body>',
    '</html>',
  ].join('\n')
}
