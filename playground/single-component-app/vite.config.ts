import { defineConfig } from 'vite'
import { litSSG } from 'vite-plugin-lit-ssg'
import Inspect from 'vite-plugin-inspect'

export default defineConfig({
  base: './',
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
