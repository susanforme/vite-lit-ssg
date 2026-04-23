import type { SingleComponentIslandMetadata } from '../types'

export const SINGLE_COMPONENT_ISLAND_TAG = 'lit-ssg-island'
export const SINGLE_COMPONENT_ISLAND_CLIENT_ATTR = 'client'
export const SINGLE_COMPONENT_ISLAND_COMPONENT_URL_ATTR = 'component-url'
export const SINGLE_COMPONENT_ISLAND_COMPONENT_EXPORT_ATTR = 'component-export'
export const SINGLE_COMPONENT_ISLAND_CLIENT_MEDIA_ATTR = 'client-media'
export const SINGLE_COMPONENT_ISLAND_CLIENT_ROOT_MARGIN_ATTR = 'client-root-margin'
export const SINGLE_COMPONENT_ISLAND_CLIENT_IDLE_TIMEOUT_ATTR = 'client-idle-timeout'
export const SINGLE_COMPONENT_ISLAND_SSR_ATTR = 'ssr'
export const SINGLE_COMPONENT_ISLAND_HYDRATED_ATTR = 'data-lit-ssg-hydrated'

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

export function buildSingleComponentIslandAttrs(
  island: SingleComponentIslandMetadata,
  componentUrl?: string,
  dsdPendingStyle: boolean = false,
): string {
  const attrs = [
    SINGLE_COMPONENT_ISLAND_SSR_ATTR,
    `${SINGLE_COMPONENT_ISLAND_CLIENT_ATTR}="${escapeAttr(island.client)}"`,
    `${SINGLE_COMPONENT_ISLAND_COMPONENT_EXPORT_ATTR}="${escapeAttr(island.componentExport)}"`,
  ]

  if (componentUrl) {
    attrs.push(`${SINGLE_COMPONENT_ISLAND_COMPONENT_URL_ATTR}="${escapeAttr(componentUrl)}"`)
  }

  if (island.clientMedia) {
    attrs.push(`${SINGLE_COMPONENT_ISLAND_CLIENT_MEDIA_ATTR}="${escapeAttr(island.clientMedia)}"`)
  }

  if (island.clientRootMargin) {
    attrs.push(`${SINGLE_COMPONENT_ISLAND_CLIENT_ROOT_MARGIN_ATTR}="${escapeAttr(island.clientRootMargin)}"`)
  }

  if (island.clientIdleTimeout !== undefined) {
    attrs.push(`${SINGLE_COMPONENT_ISLAND_CLIENT_IDLE_TIMEOUT_ATTR}="${String(island.clientIdleTimeout)}"`)
  }

  if (dsdPendingStyle) {
    attrs.push('dsd-pending')
  }

  return attrs.join(' ')
}

export function buildSingleComponentIslandRuntimeScriptTag(runtimeUrl: string): string {
  return `<script type="module" src="${escapeAttr(runtimeUrl)}"></script>`
}
