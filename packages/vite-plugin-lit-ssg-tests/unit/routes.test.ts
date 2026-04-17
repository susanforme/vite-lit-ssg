import { describe, it, expect } from 'vitest'
import { resolveRoutes } from '../../vite-plugin-lit-ssg/src/runner/routes.js'

describe('resolveRoutes', () => {
  it('returns static array as-is', async () => {
    const routes = ['/', '/about', '/blog']
    expect(await resolveRoutes(routes)).toEqual(routes)
  })

  it('calls async factory and returns its result', async () => {
    const factory = async () => ['/', '/dynamic']
    expect(await resolveRoutes(factory)).toEqual(['/', '/dynamic'])
  })

  it('normalizes trailing slashes', async () => {
    const routes = ['/about/', '/blog/post/']
    expect(await resolveRoutes(routes)).toEqual(['/about', '/blog/post'])
  })

  it('normalizes multiple trailing slashes', async () => {
    expect(await resolveRoutes(['/about///'])).toEqual(['/about'])
  })

  it('preserves root route', async () => {
    expect(await resolveRoutes(['/'])).toEqual(['/'])
  })
})
