import { defineConfig } from 'vite'
import { litSSG } from 'vite-plugin-lit-ssg'

export default defineConfig({
  plugins: [litSSG({
    mode: 'single-component',
    entry: 'src/demo-widget.ts',
    exportName: 'NamedWidget',
    wrapperTag: 'demo-named-root',
    preload: 'inherit',
  })],
  build: {
    outDir: 'dist-test-named-export',
  },
})
