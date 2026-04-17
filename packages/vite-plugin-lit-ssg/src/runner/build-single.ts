import { rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { build } from 'vite'
import type { ResolvedSingleComponentOptions } from '../types.js'
import { loadServerEntry } from './load-server-entry.js'
import { readManifest, resolveAssetsFromManifest } from '../assets/manifest.js'
import { renderComponent } from '../runtime/render-component.js'
import { resolveRouteFilePath, writeRoute } from '../output/write-route.js'
import { VIRTUAL_SINGLE_CLIENT_ID, VIRTUAL_SINGLE_SERVER_ID } from '../plugin/index.js'
import type { BuildContext } from './build.js'

const SERVER_BUILD_DIR_NAME = '.vite-ssg/server'
const SERVER_BUILD_PARENT = '.vite-ssg'
const SERVER_ENTRY_FILENAME = 'entry-server.js'

export async function runSingleSSG(
  opts: ResolvedSingleComponentOptions,
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

  console.log('[vite-lit-ssg] Starting client build (single-component)...')
  await build({
    ...sharedBuildConfig,
    build: {
      outDir: resolvedOutDir,
      manifest: true,
      rollupOptions: {
        input: {
          'lit-ssg-single': VIRTUAL_SINGLE_CLIENT_ID,
        },
      },
    },
  })

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

    const html = await renderComponent(renderResult, opts.wrapperTag, assets, {
      preload: opts.preload,
      injectPolyfill: opts.injectPolyfill,
      dsdPendingStyle: opts.dsdPendingStyle,
    })

    const filePath = resolveRouteFilePath('/', resolvedOutDir)
    await writeRoute(filePath, html)

    console.log(`[vite-lit-ssg] Written ${filePath}`)
  } finally {
    console.log('[vite-lit-ssg] Cleaning up server build...')
    await rm(serverBuildParent, { recursive: true, force: true })
  }

  console.log('[vite-lit-ssg] Done!')
}
