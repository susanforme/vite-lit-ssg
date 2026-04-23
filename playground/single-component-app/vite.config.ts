import { defineConfig } from 'vite'
import { dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { litSSG } from 'vite-plugin-lit-ssg'
import Inspect from 'vite-plugin-inspect'

const litDedupePackages = ['lit', 'lit-html', 'lit-element', '@lit/reactive-element']
const workspaceRequire = createRequire(resolve(import.meta.dirname, '../../package.json'))
const workspaceLitEntry = workspaceRequire.resolve('lit')
const workspaceLitDir = dirname(workspaceLitEntry)
const workspaceLitElementEntry = createRequire(workspaceLitEntry).resolve('lit-element/lit-element.js')
const workspaceLitElementDir = dirname(workspaceLitElementEntry)
const litAlias = [
  { find: /^lit$/, replacement: resolve(workspaceLitDir, 'index.js') },
  { find: /^lit\//, replacement: `${workspaceLitDir}/` },
  { find: /^lit-element$/, replacement: workspaceLitElementEntry },
  { find: /^lit-element\//, replacement: `${workspaceLitElementDir}/` },
]

export default defineConfig({
  base: './',
  resolve: {
    alias: litAlias,
    dedupe: litDedupePackages,
  },
  plugins: [
    Inspect()
    , litSSG({
      mode: 'single-component',
      entry: 'src/demo-widget.ts',
      commonStyles: [{ file: 'src/common.css' }],
      wrapperTag: 'demo-app-root',
      preload: 'inherit',
    })],
})
