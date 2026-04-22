import type { LitSSGOptions } from '../types'

export async function resolveRoutes(
  routes: LitSSGOptions['routes'],
): Promise<string[]> {
  const raw = typeof routes === 'function' ? await routes() : routes
  return raw.map(normalizeRoute)
}

function normalizeRoute(route: string): string {
  if (route === '/') return '/'
  return route.replace(/\/+$/, '')
}
