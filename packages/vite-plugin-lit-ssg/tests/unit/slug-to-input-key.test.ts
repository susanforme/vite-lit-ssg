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
})
