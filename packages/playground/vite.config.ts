import { defineConfig } from 'vite'
import { litSSG } from 'vite-plugin-lit-ssg'

export default defineConfig({
  plugins: [
    litSSG({
      entryServer: '/src/entry-server.ts',
      entryClient: '/src/entry-client.ts',
      routes: ['/', '/about'],
      outDir: 'dist',
    }),
  ],
})
