import { describe, it, expect } from 'vitest'
import { slugToInputKey } from '../../src/runner/build.js'

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
