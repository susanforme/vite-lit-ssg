import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'

const PLAYGROUND_ROOT = resolve(import.meta.dirname, '../../../playground/page-mode')
const OUT_DIR = join(PLAYGROUND_ROOT, 'dist')

describe('Vite build page-mode integration', () => {
  beforeAll(async () => {
    await rm(OUT_DIR, { recursive: true, force: true })

    execFileSync('pnpm', ['build'], {
      cwd: PLAYGROUND_ROOT,
      stdio: 'pipe',
    })
  }, 120_000)

  afterAll(async () => {
    await rm(OUT_DIR, { recursive: true, force: true })
  })

  it('writes the Vite manifest before the SSR phase reads it', () => {
    expect(existsSync(join(OUT_DIR, '.vite', 'manifest.json'))).toBe(true)
  })

  it('completes the plugin-driven page-mode build and writes index.html', async () => {
    expect(existsSync(join(OUT_DIR, 'index.html'))).toBe(true)

    const content = await readFile(join(OUT_DIR, 'index.html'), 'utf-8')
    expect(content).toContain('Welcome to vite-plugin-lit-ssg')
    expect(content).toContain('<script type="module"')
  })
})
