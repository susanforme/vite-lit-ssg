import { defineConfig } from 'vite'
import { litSSG } from 'vite-plugin-lit-ssg'

export default defineConfig({
  base: './',
  plugins: [litSSG()],
  build: {
    outDir: 'temp/dist-flat-assets-test',
  },
})
