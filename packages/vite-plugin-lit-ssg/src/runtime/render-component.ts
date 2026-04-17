import { render } from '@lit-labs/ssr'
import { collectResult } from '@lit-labs/ssr/lib/render-result.js'
import type { PageRenderResult } from '../types.js'
import { normalizePage } from './normalize-page.js'

export async function renderComponent(
  result: PageRenderResult,
  wrapperTag: string,
): Promise<string> {
  const page = normalizePage(result)

  let componentHtml = ''
  if (page !== null) {
    componentHtml = await collectResult(render(page.template))
  }

  return `<${wrapperTag}>${componentHtml}</${wrapperTag}>`
}
