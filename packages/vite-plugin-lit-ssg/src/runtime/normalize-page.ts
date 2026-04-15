import { isTemplateResult } from 'lit/directive-helpers.js'
import type { PageDescriptor, PageRenderResult } from '../types.js'

export function normalizePage(result: PageRenderResult): PageDescriptor | null {
  if (result === null || result === undefined) {
    return null
  }

  if (isTemplateResult(result)) {
    return { template: result }
  }

  return result as PageDescriptor
}
