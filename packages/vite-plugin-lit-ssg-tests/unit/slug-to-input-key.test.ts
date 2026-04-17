import { describe, it, expect } from 'vitest'
import { slugToInputKey, buildPageInputs } from '../../vite-plugin-lit-ssg/src/runner/build.js'
import type { PageEntry } from '../../vite-plugin-lit-ssg/src/scanner/pages.js'

function makePage(slug: string, route: string): PageEntry {
  return { slug, route, filePath: `/src/pages/${slug}.ts`, importPath: `/src/pages/${slug}.ts` }
}

describe('slugToInputKey', () => {
  it('returns simple slug unchanged', () => {
    expect(slugToInputKey('about')).toBe('about')
  })

  it('returns index slug unchanged', () => {
    expect(slugToInputKey('index')).toBe('index')
  })

  it('replaces single slash with hyphen', () => {
    expect(slugToInputKey('test/child')).toBe('test-child')
  })

  it('replaces multiple slashes with hyphens', () => {
    expect(slugToInputKey('a/b/c')).toBe('a-b-c')
  })

  it('throws for slug that normalizes to lit-ssg-shared', () => {
    expect(() => slugToInputKey('lit-ssg-shared')).toThrow('lit-ssg-shared')
    expect(() => slugToInputKey('lit/ssg/shared')).toThrow('lit-ssg-shared')
  })

  it('never contains a forward slash — output key is always flat', () => {
    const slugs = ['index', 'about', 'test/child', 'test/index', 'a/b/c/d']
    for (const slug of slugs) {
      expect(slugToInputKey(slug)).not.toContain('/')
    }
  })

  it('playground slugs all produce flat keys (no lit-ssg-page prefix)', () => {
    const playgroundSlugs = ['index', 'about', 'test/child', 'test/index']
    const keys = playgroundSlugs.map(slugToInputKey)
    expect(keys).toEqual(['index', 'about', 'test-child', 'test-index'])
    for (const key of keys) {
      expect(key).not.toContain('lit-ssg-page')
      expect(key).not.toContain('/')
    }
  })
})

describe('buildPageInputs', () => {
  it('produces flat input keys for simple slugs', () => {
    const pages = [makePage('index', '/'), makePage('about', '/about')]
    const { pageInputs } = buildPageInputs(pages)
    expect(Object.keys(pageInputs)).toEqual(['index', 'about'])
  })

  it('produces flat input keys for nested slugs — no subfolders', () => {
    const pages = [makePage('test/child', '/test/child'), makePage('test/index', '/test')]
    const { pageInputs } = buildPageInputs(pages)
    expect(Object.keys(pageInputs)).toEqual(['test-child', 'test-index'])
    for (const key of Object.keys(pageInputs)) {
      expect(key).not.toContain('/')
      expect(key).not.toContain('lit-ssg-page')
    }
  })

  it('maps virtual IDs correctly for manifest resolution', () => {
    const pages = [makePage('about', '/about')]
    const { pageInputs, routeToManifestKey } = buildPageInputs(pages)
    expect(pageInputs['about']).toBe('virtual:lit-ssg-page/about')
    expect(routeToManifestKey.get('/about')).toBe('virtual:lit-ssg-page/about')
  })

  it('throws when two slugs normalize to the same key', () => {
    const pages = [makePage('test-child', '/test-child'), makePage('test/child', '/test/child')]
    expect(() => buildPageInputs(pages)).toThrow('test-child')
  })

  it('throws when a slug conflicts with lit-ssg-shared', () => {
    const pages = [makePage('lit/ssg/shared', '/lit/ssg/shared')]
    expect(() => buildPageInputs(pages)).toThrow('lit-ssg-shared')
  })
})
