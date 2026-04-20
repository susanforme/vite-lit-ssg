import { defineConfig } from 'vite'
import { litSSG } from 'vite-plugin-lit-ssg'
import Inspect from 'vite-plugin-inspect'

export default defineConfig({
  base:'./',
  plugins: [Inspect(),litSSG()],
})
