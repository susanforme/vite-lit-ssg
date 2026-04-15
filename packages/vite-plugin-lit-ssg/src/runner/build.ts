import { rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { build } from 'vite'
import type { PageEntry } from '../scanner/pages.js'
import { loadServerEntry } from './load-server-entry.js'
import { readManifest, resolveAssetsFromManifest } from '../assets/manifest.js'
import { renderPage } from '../runtime/render-page.js'
import { resolveRouteFilePath, routeDepth, writeRoute } from '../output/write-route.js'

const SERVER_BUILD_PARENT = '.vite-ssg'
const SERVER_BUILD_DIR_NAME = '.vite-ssg/server'
const SERVER_ENTRY_FILENAME = 'entry-server.js'

const VIRTUAL_CLIENT_ID = 'virtual:lit-ssg-client'
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

  console.log('[vite-lit-ssg] Starting client build...')
  await build({
    ...sharedBuildConfig,
    build: {
      outDir: resolvedOutDir,
      manifest: true,
      rollupOptions: {
        input: VIRTUAL_CLIENT_ID,
      },
    },
  })

  console.log('[vite-lit-ssg] Starting server build...')

  try {
    await build({
      ...sharedBuildConfig,
      build: {
        ssr: VIRTUAL_SERVER_ID,
        outDir: serverBuildDir,
        rollupOptions: {
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
      const assets = resolveAssetsFromManifest(manifest, base, depth)
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
