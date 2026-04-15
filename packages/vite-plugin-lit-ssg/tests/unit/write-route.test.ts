import { describe, it, expect } from 'vitest'
import { resolveRouteFilePath, routeDepth } from '../../src/output/write-route.js'
import { join } from 'node:path'

describe('resolveRouteFilePath', () => {
  it('maps / to dist/index.html', () => {
    expect(resolveRouteFilePath('/', '/project/dist')).toBe(
      join('/project/dist', 'index.html'),
    )
  })

  it('maps /about to dist/about/index.html', () => {
    expect(resolveRouteFilePath('/about', '/project/dist')).toBe(
      join('/project/dist', 'about', 'index.html'),
    )
  })

  it('maps /blog/post to dist/blog/post/index.html', () => {
    expect(resolveRouteFilePath('/blog/post', '/project/dist')).toBe(
      join('/project/dist', 'blog', 'post', 'index.html'),
    )
  })

  it('handles trailing slash in route', () => {
    expect(resolveRouteFilePath('/about/', '/project/dist')).toBe(
      join('/project/dist', 'about', 'index.html'),
    )
  })
})

describe('routeDepth', () => {
  it('returns 0 for /', () => {
    expect(routeDepth('/')).toBe(0)
  })

  it('returns 1 for /about', () => {
    expect(routeDepth('/about')).toBe(1)
  })

  it('returns 2 for /blog/post', () => {
    expect(routeDepth('/blog/post')).toBe(2)
  })

  it('handles trailing slash', () => {
    expect(routeDepth('/about/')).toBe(1)
  })
})
