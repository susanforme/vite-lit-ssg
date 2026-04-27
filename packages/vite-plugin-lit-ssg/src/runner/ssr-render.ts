import { rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { build } from 'vite'
import type { PageEntry } from '../scanner/pages'
import type { ResolvedSingleComponentOptions } from '../types'
import { loadServerEntry } from './load-server-entry'
import { readManifest, resolveAssetsFromManifest } from '../assets/manifest'
import { renderPage } from '../runtime/render-page'
import { renderComponent } from '../runtime/render-component'
import { resolveRouteFilePath, routeDepth, writeRoute } from '../output/write-route'
import { VIRTUAL_SINGLE_CLIENT_ID, VIRTUAL_SINGLE_ISLAND_RUNTIME_ID, VIRTUAL_SINGLE_SERVER_ID } from '../plugin/constants'
import type { BuildContext, PageInputResult } from './build'

const SERVER_BUILD_PARENT = '.vite-ssg'
const SERVER_BUILD_DIR_NAME = '.vite-ssg/server'
const SERVER_ENTRY_FILENAME = 'entry-server.js'

const VIRTUAL_SERVER_ID = 'virtual:lit-ssg-server'

export async function runSSRRender(
  pages: PageEntry[],
  pageInputResult: PageInputResult,
  projectRoot: string,
  base: string,
  outDir: string,
  ctx: BuildContext,
  injectPolyfill: boolean,
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
      const pageKey = pageInputResult.routeToManifestKey.get(route)!
      const assets = resolveAssetsFromManifest(manifest, base, depth, pageKey)
      const html = await renderPage(pageResult, assets, injectPolyfill)

      const filePath = resolveRouteFilePath(route, resolvedOutDir)
      await writeRoute(filePath, html)

      console.log(`[vite-lit-ssg]   Written ${filePath}`)
    }
  } finally {
    console.log('[vite-lit-ssg] Cleaning up server build...')
    await rm(serverBuildParent, { recursive: true, force: true })
  }
}

export async function runSingleSSRRender(
  opts: ResolvedSingleComponentOptions,
  projectRoot: string,
  base: string,
  outDir: string,
  ctx: BuildContext,
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

  console.log('[vite-lit-ssg] Starting server build (single-component)...')

  try {
    await build({
      ...sharedBuildConfig,
      build: {
        ssr: true,
        outDir: serverBuildDir,
        rollupOptions: {
          input: VIRTUAL_SINGLE_SERVER_ID,
          output: {
            format: 'esm',
            entryFileNames: SERVER_ENTRY_FILENAME,
          },
        },
      },
    })

    console.log('[vite-lit-ssg] Loading server entry...')
    const serverEntry = await loadServerEntry(join(serverBuildDir, SERVER_ENTRY_FILENAME))

    console.log('[vite-lit-ssg] Rendering single-component route...')
    const renderResult = await serverEntry.render('/', { route: '/', params: {} })

    if (renderResult === null || renderResult === undefined) {
      throw new Error('[vite-plugin-lit-ssg] single-component render returned null — component may not be registered')
    }

    console.log('[vite-lit-ssg] Reading manifest...')
    const manifest = await readManifest(resolvedOutDir)
    const assets = resolveAssetsFromManifest(manifest, base, 0, VIRTUAL_SINGLE_CLIENT_ID)
    const islandRuntime = resolveAssetsFromManifest(manifest, base, 0, VIRTUAL_SINGLE_ISLAND_RUNTIME_ID)

    const html = await renderComponent(renderResult, opts.wrapperTag, assets, {
      preload: opts.preload,
      injectPolyfill: opts.injectPolyfill,
      dsdPendingStyle: opts.dsdPendingStyle,
      islandRuntimeSrc: islandRuntime.js,
    })

    const filePath = resolveRouteFilePath('/', resolvedOutDir)
    await writeRoute(filePath, html)

    console.log(`[vite-lit-ssg] Written ${filePath}`)
  } finally {
    console.log('[vite-lit-ssg] Cleaning up server build...')
    await rm(serverBuildParent, { recursive: true, force: true })
  }
}
