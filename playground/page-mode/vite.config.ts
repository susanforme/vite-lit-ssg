import { defineConfig } from 'vite'
import Inspect from 'vite-plugin-inspect'
import { litSSG } from 'vite-plugin-lit-ssg'


export default defineConfig({
  base:'./',
  plugins: [Inspect(),litSSG()],
})
