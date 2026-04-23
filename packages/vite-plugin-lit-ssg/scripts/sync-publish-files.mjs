import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const command = process.argv[2]
const scriptDir = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(scriptDir, '..')
const repoRoot = resolve(packageRoot, '../..')
const stateDir = join(packageRoot, '.publish-files')
const stateFile = join(stateDir, 'state.json')
const fileNames = ['LICENSE', 'README.md', 'README-zh.md']

async function copyPublishFiles() {
  await mkdir(stateDir, { recursive: true })

  const state = []

  for (const fileName of fileNames) {
    const sourcePath = join(repoRoot, fileName)
    const targetPath = join(packageRoot, fileName)
    const backupPath = join(stateDir, `${fileName}.bak`)
    const hadOriginal = existsSync(targetPath)

    if (!existsSync(sourcePath)) {
      throw new Error(`Missing publish file at repo root: ${fileName}`)
    }

    if (hadOriginal) {
      await copyFile(targetPath, backupPath)
    }

    await copyFile(sourcePath, targetPath)

    state.push({
      fileName,
      hadOriginal,
    })
  }

  await writeFile(stateFile, JSON.stringify(state, null, 2))
}

async function cleanupPublishFiles() {
  if (!existsSync(stateFile)) {
    return
  }

  const state = JSON.parse(await readFile(stateFile, 'utf-8'))

  for (const entry of state) {
    const targetPath = join(packageRoot, entry.fileName)
    const backupPath = join(stateDir, `${entry.fileName}.bak`)

    if (entry.hadOriginal && existsSync(backupPath)) {
      await copyFile(backupPath, targetPath)
      await rm(backupPath, { force: true })
      continue
    }

    await rm(targetPath, { force: true })
  }

  await rm(stateDir, { recursive: true, force: true })
}

if (command === 'copy') {
  await copyPublishFiles()
} else if (command === 'cleanup') {
  await cleanupPublishFiles()
} else {
  throw new Error(`Unknown command: ${command}`)
}
