import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve, join } from 'node:path'

const FIXTURE_ROOT = resolve(import.meta.dirname, '../fixtures/single-component-app')

describe('single-component fixture contracts', () => {
  it('fixture has no src/pages directory', () => {
    expect(existsSync(join(FIXTURE_ROOT, 'src', 'pages'))).toBe(false)
  })

  it('fixture component file exists', () => {
    expect(existsSync(join(FIXTURE_ROOT, 'src', 'demo-widget.ts'))).toBe(true)
  })

  it('inherit config exists', () => {
    expect(existsSync(join(FIXTURE_ROOT, 'vite.config.inherit.ts'))).toBe(true)
  })

  it('none config exists', () => {
    expect(existsSync(join(FIXTURE_ROOT, 'vite.config.none.ts'))).toBe(true)
  })

  it('entry-only config exists', () => {
    expect(existsSync(join(FIXTURE_ROOT, 'vite.config.entry-only.ts'))).toBe(true)
  })
})
