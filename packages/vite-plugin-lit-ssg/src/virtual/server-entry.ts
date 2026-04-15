import type { PageEntry } from '../scanner/pages.js'

export function generateServerEntry(pages: PageEntry[]): string {
  const imports = pages
    .map((p, i) => `import route${i} from '${p.importPath}'`)
    .join('\n')

  const cases = pages
    .map((p, i) => {
      const q = JSON.stringify(p.route)
      return `    case ${q}: {
      const tag = customElements.getName(route${i}.component)
      if (!tag) throw new Error('[vite-plugin-lit-ssg] Component for route ${p.route} is not registered. Make sure to use @customElement decorator.')
      return { template: html\`<\${unsafeStatic(tag)}></\${unsafeStatic(tag)}>\`, title: route${i}.title, lang: route${i}.lang, meta: route${i}.meta, head: route${i}.head, htmlAttrs: route${i}.htmlAttrs, bodyAttrs: route${i}.bodyAttrs }
    }`
    })
    .join('\n')

  return `import { html } from 'lit'
import { unsafeStatic } from 'lit/static-html.js'
${imports}

export async function render(url, _ctx) {
  switch (url) {
${cases}
    default:
      return null
  }
}
`
}
