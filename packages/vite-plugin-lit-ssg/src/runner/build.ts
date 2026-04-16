import { rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { build } from 'vite'
import type { PageEntry } from '../scanner/pages.js'
import { loadServerEntry } from './load-server-entry.js'
import { readManifest, resolveAssetsFromManifest } from '../assets/manifest.js'
import { renderPage } from '../runtime/render-page.js'
import { resolveRouteFilePath, routeDepth, writeRoute } from '../output/write-route.js'
import { VIRTUAL_PAGE_PREFIX, VIRTUAL_SHARED_ID } from '../plugin/index.js'

const SERVER_BUILD_PARENT = '.vite-ssg'
const SERVER_BUILD_DIR_NAME = '.vite-ssg/server'
const SERVER_ENTRY_FILENAME = 'entry-server.js'

const VIRTUAL_SERVER_ID = 'virtual:lit-ssg-server'

export interface BuildContext {
  mode: string
  configFile: string | false | undefined
}

export async function runSSG(
  pages: PageEntry[],
  projectRoot: string,
  base: string,
  outDir: string,
  ctx: BuildContext = { mode: 'production', configFile: undefined },
): Promise<void> {
  const resolvedOutDir = resolve(projectRoot, outDir)
  const serverBuildDir = resolve(projectRoot, SERVER_BUILD_DIR_NAME)
  const serverBuildParent = resolve(projectRoot, SERVER_BUILD_PARENT)

  const sharedBuildConfig = {
    root: projectRoot,
    base,
    mode: ctx.mode,
    ...(ctx.configFile !== undefined ? { configFile: ctx.configFile } : {}),
    logLevel: 'warn' as const,
  }

  const pageInputs: Record<string, string> = {}
  const routeToManifestKey = new Map<string, string>()
  for (const page of pages) {
    const virtualId = `${VIRTUAL_PAGE_PREFIX}${page.slug}`
    pageInputs[`lit-ssg-page/${page.slug}`] = virtualId
    routeToManifestKey.set(page.route, virtualId)
  }

  console.log('[vite-lit-ssg] Starting client build...')
  await build({
    ...sharedBuildConfig,
    build: {
      outDir: resolvedOutDir,
      manifest: true,
      rollupOptions: {
        input: {
          'lit-ssg-shared': VIRTUAL_SHARED_ID,
          ...pageInputs,
        },
      },
    },
  })

  console.log('[vite-lit-ssg] Starting server build...')

  try {
    await build({
      ...sharedBuildConfig,
      build: {
        ssr: true,
        outDir: serverBuildDir,
        rollupOptions: {
          input: VIRTUAL_SERVER_ID,
          output: {
            format: 'esm',
            entryFileNames: SERVER_ENTRY_FILENAME,
          },
        },
      },
    })

    console.log('[vite-lit-ssg] Loading server entry...')
    const serverEntry = await loadServerEntry(join(serverBuildDir, SERVER_ENTRY_FILENAME))

    const routes = pages.map((p) => p.route)

    console.log('[vite-lit-ssg] Reading manifest...')
    const manifest = await readManifest(resolvedOutDir)

    console.log(`[vite-lit-ssg] Rendering ${routes.length} route(s)...`)
    for (const route of routes) {
      console.log(`[vite-lit-ssg]   Rendering ${route}`)

      const pageResult = await serverEntry.render(route, { route, params: {} })

      if (pageResult === null || pageResult === undefined) {
        console.log(`[vite-lit-ssg]   Skipping ${route} (render returned null)`)
        continue
      }

      const depth = routeDepth(route)
      const pageKey = routeToManifestKey.get(route)!
      const assets = resolveAssetsFromManifest(manifest, base, depth, pageKey)
      const html = await renderPage(pageResult, assets)

      const filePath = resolveRouteFilePath(route, resolvedOutDir)
      await writeRoute(filePath, html)

      console.log(`[vite-lit-ssg]   Written ${filePath}`)
    }
  } finally {
    console.log('[vite-lit-ssg] Cleaning up server build...')
    await rm(serverBuildParent, { recursive: true, force: true })
  }

  console.log('[vite-lit-ssg] Done!')
}
