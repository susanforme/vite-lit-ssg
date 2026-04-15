import type { PageEntry } from '../scanner/pages.js'

export function generateClientEntry(pages: PageEntry[]): string {
  return pages.map((p) => `import '${p.importPath}'`).join('\n') + '\n'
}
