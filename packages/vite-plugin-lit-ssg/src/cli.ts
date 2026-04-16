#!/usr/bin/env node
import { resolve } from 'node:path'
import { loadConfigFromFile } from 'vite'
import type { Plugin } from 'vite'
import { PLUGIN_NAME, getSSGOptions } from './plugin/index.js'
import { runSSG } from './runner/build.js'
import { scanPages } from './scanner/pages.js'

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  const flagValues = new Set<string>()
  for (const flag of ['--mode', '--config']) {
    const val = getFlagValue(args, flag)
    if (val) flagValues.add(val)
  }

  const command = args.find((a) => !a.startsWith('-') && !flagValues.has(a)) ?? 'build'

  if (command !== 'build') {
    console.error(`[vite-lit-ssg] Unknown command: ${command}`)
    console.error('Usage: vite-lit-ssg build [--mode <mode>] [--config <path>]')
    process.exit(1)
  }

  const mode = getFlagValue(args, '--mode') ?? 'production'
  const configFile = getFlagValue(args, '--config')

  const projectRoot = resolve(process.cwd())

  console.log('[vite-lit-ssg] Loading vite config...')

  const loaded = await loadConfigFromFile(
    { command: 'build', mode },
    configFile ? resolve(configFile) : undefined,
    projectRoot,
  )

  if (!loaded) {
    console.error(
      `[vite-lit-ssg] Could not find a vite config in ${projectRoot}. ` +
        `Expected vite.config.{ts,js,mts,mjs,cts,cjs}.`,
    )
    process.exit(1)
  }

  const { config } = loaded

  const plugins = (config.plugins ?? []).flat() as Plugin[]
  const ssgPlugin = plugins.find((p) => p && typeof p === 'object' && p.name === PLUGIN_NAME)

  if (!ssgPlugin) {
    console.error(
      `[vite-lit-ssg] Could not find litSSG() plugin in your vite.config. ` +
        `Make sure you have added litSSG() to the plugins array.`,
    )
    process.exit(1)
  }

  const ssgOpts = getSSGOptions(ssgPlugin)

  if (!ssgOpts) {
    console.error('[vite-lit-ssg] Failed to retrieve SSG options from plugin')
    process.exit(1)
  }

  const base = config.base ?? '/'
  const outDir = config.build?.outDir ?? 'dist'
  const resolvedConfigFile = configFile ? resolve(configFile) : loaded.path

  const pages = await scanPages(projectRoot, ssgOpts)

  await runSSG(pages, projectRoot, base, outDir, { mode, configFile: resolvedConfigFile })
}

function getFlagValue(args: string[], flag: string): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    if (arg === flag) {
      const val = args[i + 1]
      if (val && !val.startsWith('-')) return val
    } else if (arg.startsWith(`${flag}=`)) {
      return arg.slice(flag.length + 1)
    }
  }
  return undefined
}

main().catch((err: unknown) => {
  console.error('[vite-lit-ssg] Fatal error:', err)
  process.exit(1)
})
