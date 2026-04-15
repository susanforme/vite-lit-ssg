import { mkdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'

export function resolveRouteFilePath(route: string, outDir: string): string {
  if (route === '/') {
    return join(outDir, 'index.html')
  }

  const segments = route.replace(/^\//, '').replace(/\/$/, '')
  return join(outDir, segments, 'index.html')
}

export function routeDepth(route: string): number {
  if (route === '/') return 0
  const segments = route.replace(/^\//, '').replace(/\/$/, '').split('/')
  return segments.length
}

export async function writeRoute(filePath: string, html: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, html, 'utf-8')
}
