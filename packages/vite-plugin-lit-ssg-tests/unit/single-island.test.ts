import { describe, expect, it } from 'vitest'
import {
  buildSingleComponentIslandAttrs,
  buildSingleComponentIslandRuntimeScriptTag,
} from '../../vite-plugin-lit-ssg/src/runtime/single-island.js'

describe('single island runtime contract helpers', () => {
  it('serializes runtime-owned island metadata onto the element', () => {
    const attrs = buildSingleComponentIslandAttrs({
      client: 'visible',
      componentExport: 'hydrate',
      clientRootMargin: '200px',
    }, '/assets/entry.js')

    expect(attrs).toContain('ssr')
    expect(attrs).toContain('client="visible"')
    expect(attrs).toContain('component-export="hydrate"')
    expect(attrs).toContain('component-url="/assets/entry.js"')
    expect(attrs).toContain('client-root-margin="200px"')
  })

  it('emits a runtime definition script tag that can be ordered before the island', () => {
    expect(buildSingleComponentIslandRuntimeScriptTag('/assets/island-runtime.js')).toBe(
      '<script type="module" src="/assets/island-runtime.js"></script>',
    )
  })
})
