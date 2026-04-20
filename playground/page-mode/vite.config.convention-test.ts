import { defineConfig } from 'vite'
import { litSSG } from 'vite-plugin-lit-ssg'
import Inspect from 'vite-plugin-inspect'

export default defineConfig({
  base: './',
  plugins: [Inspect(), litSSG({
    commonStyles: [{
      file: 'src/styles/common.css',
    }],
  })],
  build: {
    outDir: 'temp/dist-convention-test',
  },
})
