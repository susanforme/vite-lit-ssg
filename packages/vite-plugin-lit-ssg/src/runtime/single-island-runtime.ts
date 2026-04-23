import {
  SINGLE_COMPONENT_ISLAND_CLIENT_ATTR,
  SINGLE_COMPONENT_ISLAND_CLIENT_IDLE_TIMEOUT_ATTR,
  SINGLE_COMPONENT_ISLAND_CLIENT_MEDIA_ATTR,
  SINGLE_COMPONENT_ISLAND_CLIENT_ROOT_MARGIN_ATTR,
  SINGLE_COMPONENT_ISLAND_COMPONENT_EXPORT_ATTR,
  SINGLE_COMPONENT_ISLAND_COMPONENT_URL_ATTR,
  SINGLE_COMPONENT_ISLAND_HYDRATED_ATTR,
  SINGLE_COMPONENT_ISLAND_SSR_ATTR,
  SINGLE_COMPONENT_ISLAND_TAG,
} from './single-island'
import type { SingleComponentClientStrategy } from '../types'

const moduleCache = new Map<string, Promise<Record<string, unknown>>>()

type Cleanup = () => void

function scheduleLoad(run: () => void): Cleanup {
  queueMicrotask(run)
  return () => {}
}

function scheduleIdle(host: HTMLElement, run: () => void): Cleanup {
  const timeoutValue = host.getAttribute(SINGLE_COMPONENT_ISLAND_CLIENT_IDLE_TIMEOUT_ATTR)
  const timeout = timeoutValue ? Number(timeoutValue) : undefined

  if ('requestIdleCallback' in globalThis) {
    const requestIdleCallback = globalThis.requestIdleCallback.bind(globalThis)
    const cancelIdleCallback = globalThis.cancelIdleCallback.bind(globalThis)
    const idleId = requestIdleCallback(run, timeout !== undefined ? { timeout } : undefined)
    return () => cancelIdleCallback(idleId)
  }

  const idleId = globalThis.setTimeout(run, timeout ?? 1)
  return () => globalThis.clearTimeout(idleId)
}

function scheduleVisible(host: HTMLElement, run: () => void): Cleanup {
  if (!('IntersectionObserver' in globalThis)) {
    return scheduleLoad(run)
  }

  const observer = new globalThis.IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      observer.disconnect()
      run()
    }
  }, {
    rootMargin: host.getAttribute(SINGLE_COMPONENT_ISLAND_CLIENT_ROOT_MARGIN_ATTR) ?? '0px',
  })

  observer.observe(host)
  return () => observer.disconnect()
}

function scheduleMedia(host: HTMLElement, run: () => void): Cleanup {
  const query = host.getAttribute(SINGLE_COMPONENT_ISLAND_CLIENT_MEDIA_ATTR)
  if (!query || !('matchMedia' in globalThis)) {
    return scheduleLoad(run)
  }

  const mediaQuery = globalThis.matchMedia(query)
  if (mediaQuery.matches) {
    return scheduleLoad(run)
  }

  const handleChange = (event: MediaQueryListEvent) => {
    if (!event.matches) return
    mediaQuery.removeEventListener('change', handleChange)
    run()
  }

  mediaQuery.addEventListener('change', handleChange)
  return () => mediaQuery.removeEventListener('change', handleChange)
}

function scheduleHydration(host: HTMLElement, strategy: SingleComponentClientStrategy, run: () => void): Cleanup {
  switch (strategy) {
    case 'idle':
      return scheduleIdle(host, run)
    case 'visible':
      return scheduleVisible(host, run)
    case 'media':
      return scheduleMedia(host, run)
    case 'load':
    default:
      return scheduleLoad(run)
  }
}

function readStrategy(host: HTMLElement): SingleComponentClientStrategy {
  const strategy = host.getAttribute(SINGLE_COMPONENT_ISLAND_CLIENT_ATTR)
  switch (strategy) {
    case 'idle':
    case 'visible':
    case 'media':
      return strategy
    case 'load':
    default:
      return 'load'
  }
}

function getModule(componentUrl: string): Promise<Record<string, unknown>> {
  const existing = moduleCache.get(componentUrl)
  if (existing) return existing

  const next = import(/* @vite-ignore */ componentUrl) as Promise<Record<string, unknown>>
  moduleCache.set(componentUrl, next)
  return next
}

class LitSsgIsland extends HTMLElement {
  private cleanup: Cleanup | null = null

  connectedCallback(): void {
    if (this.cleanup || this.hasAttribute(SINGLE_COMPONENT_ISLAND_HYDRATED_ATTR)) {
      return
    }

    const componentUrl = this.getAttribute(SINGLE_COMPONENT_ISLAND_COMPONENT_URL_ATTR)
    if (!componentUrl) {
      console.error('[vite-plugin-lit-ssg] lit-ssg-island is missing component-url')
      return
    }

    const strategy = readStrategy(this)
    this.cleanup = scheduleHydration(this, strategy, () => {
      void this.hydrate()
    })
  }

  disconnectedCallback(): void {
    this.cleanup?.()
    this.cleanup = null
  }

  private async hydrate(): Promise<void> {
    if (this.hasAttribute(SINGLE_COMPONENT_ISLAND_HYDRATED_ATTR)) {
      return
    }

    const componentUrl = this.getAttribute(SINGLE_COMPONENT_ISLAND_COMPONENT_URL_ATTR)
    if (!componentUrl) return

    const exportName = this.getAttribute(SINGLE_COMPONENT_ISLAND_COMPONENT_EXPORT_ATTR) ?? 'hydrate'
    this.setAttribute(SINGLE_COMPONENT_ISLAND_HYDRATED_ATTR, '')

    try {
      const mod = await getModule(componentUrl)
      const hydrateExport = mod[exportName]
      if (typeof hydrateExport !== 'function') {
        throw new Error(`[vite-plugin-lit-ssg] Island module "${componentUrl}" does not export a callable "${exportName}" hydrator`)
      }

      await hydrateExport(this)
      this.removeAttribute(SINGLE_COMPONENT_ISLAND_SSR_ATTR)
      this.dispatchEvent(new CustomEvent('lit-ssg:hydrate'))
    } catch (error) {
      this.removeAttribute(SINGLE_COMPONENT_ISLAND_HYDRATED_ATTR)
      console.error('[vite-plugin-lit-ssg] Failed to hydrate island', error)
    } finally {
      this.cleanup = null
    }
  }
}

if (!customElements.get(SINGLE_COMPONENT_ISLAND_TAG)) {
  customElements.define(SINGLE_COMPONENT_ISLAND_TAG, LitSsgIsland)
}
