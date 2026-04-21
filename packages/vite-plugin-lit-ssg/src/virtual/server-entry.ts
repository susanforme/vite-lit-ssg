import type { PageEntry } from '../scanner/pages'

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

  return `import { html, unsafeStatic } from 'lit/static-html.js'
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

export function generateDevServerEntry(
  pages: PageEntry[],
  ssrIndexPath: string,
  ssrRenderResultPath: string,
): string {
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

  return `import { html, unsafeStatic } from 'lit/static-html.js'
import { render as ssrRender } from '${ssrIndexPath}'
import { collectResult } from '${ssrRenderResultPath}'
${imports}

export async function render(url, _ctx) {
  switch (url) {
${cases}
    default:
      return null
  }
}

export async function renderToHtml(url, _ctx) {
  const result = await render(url, _ctx)
  if (result === null || result === undefined) return null
  return collectResult(ssrRender(result.template))
}

export function getPageMeta(url) {
  switch (url) {
${pages.map((p, i) => {
  const q = JSON.stringify(p.route)
  return `    case ${q}: return { title: route${i}.title, lang: route${i}.lang, meta: route${i}.meta, head: route${i}.head, htmlAttrs: route${i}.htmlAttrs, bodyAttrs: route${i}.bodyAttrs }`
}).join('\n')}
    default: return null
  }
}
`
}
