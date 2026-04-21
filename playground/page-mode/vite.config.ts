import { defineConfig } from 'vite'
import {createJiti} from 'jiti'
import Inspect from 'vite-plugin-inspect'
const jiti = createJiti(import.meta.url)

const { litSSG } = await jiti.import<typeof import('vite-plugin-lit-ssg')>('vite-plugin-lit-ssg')

export default defineConfig({
  base:'./',
  plugins: [Inspect(),litSSG()],
})
