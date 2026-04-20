import { defineConfig } from 'vite'
import { litSSG } from '../../../vite-plugin-lit-ssg/src/plugin/index.js'

export default defineConfig({
  plugins: [litSSG({
    mode: 'single-component',
    entry: 'src/demo-widget.ts',
    preload: 'inherit',
  })],
})
