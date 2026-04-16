import { defineConfig } from 'vite'
import { litSSG } from 'vite-plugin-lit-ssg'

export default defineConfig({
  plugins: [litSSG({
    mode: 'single-component',
    entry: 'src/demo-widget.ts',
    wrapperTag: 'demo-app-root',
    preload: 'none',
  })],
  build: {
    outDir: 'dist-test-none',
  },
})
