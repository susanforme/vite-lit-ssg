import { rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { build } from 'vite'
import type { ResolvedLitSSGOptions } from '../types.js'
import { resolveRoutes } from './routes.js'
import { loadServerEntry } from './load-server-entry.js'
import { readManifest, resolveAssetsFromManifest } from '../assets/manifest.js'
import { renderPage } from '../runtime/render-page.js'
import { resolveRouteFilePath, routeDepth, writeRoute } from '../output/write-route.js'

const SERVER_BUILD_PARENT = '.vite-ssg'
const SERVER_BUILD_DIR_NAME = '.vite-ssg/server'
const SERVER_ENTRY_FILENAME = 'entry-server.js'

export interface BuildContext {
  mode: string
  configFile: string | false | undefined
}

export async function runSSG(
  opts: ResolvedLitSSGOptions,
  projectRoot: string,
  base: string,
  ctx: BuildContext = { mode: 'production', configFile: undefined },
): Promise<void> {
  const outDir = resolve(projectRoot, opts.outDir)
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
      outDir,
      manifest: true,
      rollupOptions: {
        input: opts.entryClient.startsWith('/')
          ? join(projectRoot, opts.entryClient.slice(1))
          : join(projectRoot, opts.entryClient),
      },
    },
  })

  console.log('[vite-lit-ssg] Starting server build...')

  try {
    await build({
      ...sharedBuildConfig,
      build: {
        ssr: opts.entryServer.startsWith('/')
          ? join(projectRoot, opts.entryServer.slice(1))
          : join(projectRoot, opts.entryServer),
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

    console.log('[vite-lit-ssg] Resolving routes...')
    const routes = await resolveRoutes(opts.routes)

    console.log('[vite-lit-ssg] Reading manifest...')
    const manifest = await readManifest(outDir)

    console.log(`[vite-lit-ssg] Rendering ${routes.length} route(s)...`)
    for (const route of routes) {
      console.log(`[vite-lit-ssg]   Rendering ${route}`)

      const pageResult = await serverEntry.render(route, { route, params: {} })

      if (pageResult === null || pageResult === undefined) {
        console.log(`[vite-lit-ssg]   Skipping ${route} (render returned null)`)
        continue
      }

      const depth = routeDepth(route)
      const assets = resolveAssetsFromManifest(manifest, opts.entryClient, base, depth)
      const html = await renderPage(pageResult, assets)

      const filePath = resolveRouteFilePath(route, outDir)
      await writeRoute(filePath, html)

      console.log(`[vite-lit-ssg]   Written ${filePath}`)
    }
  } finally {
    console.log('[vite-lit-ssg] Cleaning up server build...')
    await rm(serverBuildParent, { recursive: true, force: true })
  }

  console.log('[vite-lit-ssg] Done!')
}
