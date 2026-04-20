import { resolve } from 'node:path'
import { build } from 'vite'
import type { ResolvedSingleComponentOptions } from '../types.js'
import { _ssgActive, VIRTUAL_SINGLE_CLIENT_ID } from '../plugin/constants.js'
import { runSingleSSRRender } from './ssr-render.js'
import type { BuildContext } from './build.js'

export async function runSingleSSG(
  opts: ResolvedSingleComponentOptions,
  projectRoot: string,
  base: string,
  outDir: string,
  ctx: BuildContext = { mode: 'production', configFile: undefined },
): Promise<void> {
  const resolvedOutDir = resolve(projectRoot, outDir)

  const sharedBuildConfig = {
    root: projectRoot,
    base,
    mode: ctx.mode,
    ...(ctx.configFile !== undefined ? { configFile: ctx.configFile } : {}),
    logLevel: 'warn' as const,
  }

  _ssgActive.add(projectRoot)
  try {
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

    await runSingleSSRRender(opts, projectRoot, base, outDir, ctx)
  } finally {
    _ssgActive.delete(projectRoot)
  }

  console.log('[vite-lit-ssg] Done!')
}
