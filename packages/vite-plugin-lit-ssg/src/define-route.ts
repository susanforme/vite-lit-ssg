import type { LitElement } from 'lit'

export interface LitRoute {
  component: typeof LitElement
  title?: string
  lang?: string
  meta?: Array<Record<string, string>>
  head?: string[]
  htmlAttrs?: Record<string, string>
  bodyAttrs?: Record<string, string>
}

/**
 * Factory function for defining a Lit SSG route.
 * Identity function — returns the same object for TypeScript type inference.
 */
export function defineLitRoute(route: LitRoute): LitRoute {
  return route
}
