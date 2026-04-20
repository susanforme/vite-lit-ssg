import { resolve } from 'node:path'
import { build } from 'vite'
import type { PageEntry } from '../scanner/pages.js'
import { _ssgActive, VIRTUAL_PAGE_PREFIX, VIRTUAL_SHARED_ID } from '../plugin/constants.js'
import { runSSRRender } from './ssr-render.js'

export function slugToInputKey(slug: string): string {
  const key = slug.replace(/\//g, '-')
  if (key === 'lit-ssg-shared') {
    throw new Error(
      `[vite-plugin-lit-ssg] Page slug "${slug}" conflicts with the reserved internal entry "lit-ssg-shared". ` +
        'Rename the page file to avoid this conflict.',
    )
  }
  return key
}

export interface PageInputResult {
  pageInputs: Record<string, string>
  routeToManifestKey: Map<string, string>
}

export function buildPageInputs(pages: PageEntry[]): PageInputResult {
  const pageInputs: Record<string, string> = {}
  const inputKeyToSlug = new Map<string, string>()
  const routeToManifestKey = new Map<string, string>()
  for (const page of pages) {
    const virtualId = `${VIRTUAL_PAGE_PREFIX}${page.slug}`
    const inputKey = slugToInputKey(page.slug)
    if (inputKeyToSlug.has(inputKey)) {
      throw new Error(
        `[vite-plugin-lit-ssg] Page slug "${page.slug}" and "${inputKeyToSlug.get(inputKey)}" both normalize to the same ` +
          `asset name "${inputKey}". Rename one of the page files to avoid this conflict.`,
      )
    }
    inputKeyToSlug.set(inputKey, page.slug)
    pageInputs[inputKey] = virtualId
    routeToManifestKey.set(page.route, virtualId)
  }
  return { pageInputs, routeToManifestKey }
}

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
  injectPolyfill = true,
): Promise<void> {
  const resolvedOutDir = resolve(projectRoot, outDir)

  const sharedBuildConfig = {
    root: projectRoot,
    base,
    mode: ctx.mode,
    ...(ctx.configFile !== undefined ? { configFile: ctx.configFile } : {}),
    logLevel: 'warn' as const,
  }

  const pageInputResult = buildPageInputs(pages)
  const { pageInputs } = pageInputResult

  _ssgActive.add(projectRoot)
  try {
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

    await runSSRRender(pages, pageInputResult, projectRoot, base, outDir, ctx, injectPolyfill)
  } finally {
    _ssgActive.delete(projectRoot)
  }

  console.log('[vite-lit-ssg] Done!')
}
