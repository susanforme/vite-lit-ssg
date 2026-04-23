import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const PACKAGE_ROOT = resolve(import.meta.dirname, '../../vite-plugin-lit-ssg')
const publishFiles = ['LICENSE', 'README.md', 'README-zh.md']

let tarballPath = ''
let packedFiles = []

describe('package pack integration', () => {
  beforeAll(async () => {
    await Promise.all([
      rm(join(PACKAGE_ROOT, '.publish-files'), { recursive: true, force: true }),
      ...publishFiles.map((fileName) => rm(join(PACKAGE_ROOT, fileName), { force: true })),
    ])

    execFileSync('pnpm', ['build'], {
      cwd: PACKAGE_ROOT,
      stdio: 'pipe',
    })

    const packOutput = execFileSync('npm', ['pack', '--json'], {
      cwd: PACKAGE_ROOT,
      encoding: 'utf-8',
      stdio: 'pipe',
    })
    const [{ filename, files }] = JSON.parse(packOutput)

    tarballPath = join(PACKAGE_ROOT, filename)
    packedFiles = files.map((file) => file.path)
  }, 120_000)

  afterAll(async () => {
    await Promise.all([
      rm(tarballPath, { force: true }),
      rm(join(PACKAGE_ROOT, '.publish-files'), { recursive: true, force: true }),
      ...publishFiles.map((fileName) => rm(join(PACKAGE_ROOT, fileName), { force: true })),
    ])
  })

  it('includes root docs and license in the packed tarball', () => {
    expect(packedFiles).toEqual(expect.arrayContaining(publishFiles))
  })

  it('removes the copied publish files after packing', () => {
    for (const fileName of publishFiles) {
      expect(existsSync(join(PACKAGE_ROOT, fileName))).toBe(false)
    }
  })

  it('writes the tarball for inspection', () => {
    expect(existsSync(tarballPath)).toBe(true)
  })
})
