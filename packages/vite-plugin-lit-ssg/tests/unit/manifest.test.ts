import { describe, it, expect } from 'vitest'
import { resolveAssetsFromManifest } from '../../src/assets/manifest.js'
import type { ViteManifest } from '../../src/types.js'

const sampleManifest: ViteManifest = {
  'src/entry-client.ts': {
    file: 'assets/entry-client-abc123.js',
    isEntry: true,
    css: ['assets/style-def456.css'],
    imports: ['_shared-ghi789.js'],
  },
  '_shared-ghi789.js': {
    file: 'assets/shared-ghi789.js',
  },
}

describe('resolveAssetsFromManifest', () => {
  it('resolves main js, css, and modulepreloads', () => {
    const assets = resolveAssetsFromManifest(sampleManifest, '/src/entry-client.ts', '/')
    expect(assets.js).toBe('/assets/entry-client-abc123.js')
    expect(assets.css).toEqual(['/assets/style-def456.css'])
    expect(assets.modulepreloads).toEqual(['/assets/shared-ghi789.js'])
  })

  it('handles custom base path', () => {
    const assets = resolveAssetsFromManifest(sampleManifest, '/src/entry-client.ts', '/docs/')
    expect(assets.js).toBe('/docs/assets/entry-client-abc123.js')
    expect(assets.css).toEqual(['/docs/assets/style-def456.css'])
    expect(assets.modulepreloads).toEqual(['/docs/assets/shared-ghi789.js'])
  })

  it('throws when entry is not found', () => {
    expect(() =>
      resolveAssetsFromManifest(sampleManifest, '/src/missing.ts', '/'),
    ).toThrow(/Could not find entry/)
  })

  it('handles entry without leading slash', () => {
    const assets = resolveAssetsFromManifest(sampleManifest, 'src/entry-client.ts', '/')
    expect(assets.js).toBe('/assets/entry-client-abc123.js')
  })

  it('returns empty css and preloads when none in manifest', () => {
    const minimal: ViteManifest = {
      'src/entry-client.ts': {
        file: 'assets/entry-client.js',
        isEntry: true,
      },
    }
    const assets = resolveAssetsFromManifest(minimal, '/src/entry-client.ts', '/')
    expect(assets.css).toEqual([])
    expect(assets.modulepreloads).toEqual([])
  })

  it('collects css recursively from imported chunks', () => {
    const manifest: ViteManifest = {
      'src/entry-client.ts': {
        file: 'assets/entry.js',
        isEntry: true,
        css: ['assets/entry.css'],
        imports: ['_chunk-a.js'],
      },
      '_chunk-a.js': {
        file: 'assets/chunk-a.js',
        css: ['assets/chunk-a.css'],
        imports: ['_chunk-b.js'],
      },
      '_chunk-b.js': {
        file: 'assets/chunk-b.js',
        css: ['assets/chunk-b.css'],
      },
    }
    const assets = resolveAssetsFromManifest(manifest, '/src/entry-client.ts', '/')
    expect(assets.css).toContain('/assets/entry.css')
    expect(assets.css).toContain('/assets/chunk-a.css')
    expect(assets.css).toContain('/assets/chunk-b.css')
  })

  it('handles circular imports without infinite loop', () => {
    const manifest: ViteManifest = {
      'src/entry-client.ts': {
        file: 'assets/entry.js',
        isEntry: true,
        imports: ['_chunk-a.js'],
      },
      '_chunk-a.js': {
        file: 'assets/chunk-a.js',
        imports: ['_chunk-b.js'],
      },
      '_chunk-b.js': {
        file: 'assets/chunk-b.js',
        imports: ['_chunk-a.js'],
      },
    }
    expect(() =>
      resolveAssetsFromManifest(manifest, '/src/entry-client.ts', '/'),
    ).not.toThrow()
  })

  it('uses relative paths for root route when base is "./"', () => {
    const assets = resolveAssetsFromManifest(sampleManifest, '/src/entry-client.ts', './', 0)
    expect(assets.js).toBe('./assets/entry-client-abc123.js')
    expect(assets.css).toEqual(['./assets/style-def456.css'])
    expect(assets.modulepreloads).toEqual(['./assets/shared-ghi789.js'])
  })

  it('uses relative paths with depth adjustment for nested routes when base is "./"', () => {
    const assets = resolveAssetsFromManifest(sampleManifest, '/src/entry-client.ts', './', 1)
    expect(assets.js).toBe('../assets/entry-client-abc123.js')
    expect(assets.css).toEqual(['../assets/style-def456.css'])
    expect(assets.modulepreloads).toEqual(['../assets/shared-ghi789.js'])
  })

  it('uses relative paths for empty base at depth 0', () => {
    const assets = resolveAssetsFromManifest(sampleManifest, '/src/entry-client.ts', '', 0)
    expect(assets.js).toBe('./assets/entry-client-abc123.js')
  })

  it('uses relative paths with double depth for deeply nested routes', () => {
    const assets = resolveAssetsFromManifest(sampleManifest, '/src/entry-client.ts', './', 2)
    expect(assets.js).toBe('../../assets/entry-client-abc123.js')
  })
})
