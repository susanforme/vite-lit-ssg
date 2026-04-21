import { rspack } from '@rspack/core'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import config from '../rspack.config.mjs'

const configs = Array.isArray(config) ? config : [config]

for (const currentConfig of configs) {
  const compiler = rspack(currentConfig)

  await new Promise((resolve, reject) => {
    compiler.run((error, stats) => {
      compiler.close(() => {})

      if (error) {
        reject(error)
        return
      }

      if (!stats || stats.hasErrors()) {
        reject(new Error(stats?.toString({ colors: false }) ?? 'Rspack build failed'))
        return
      }

      resolve()
    })
  })
}

const runtimeProxyPath = resolve(import.meta.dirname, '../dist/runtime/hydrate-support-proxy.js')

await mkdir(dirname(runtimeProxyPath), { recursive: true })
await writeFile(
  runtimeProxyPath,
  "import '@lit-labs/ssr-client/lit-element-hydrate-support.js'\n\nexport {}\n",
  'utf8',
)
