import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'

const _require = createRequire(import.meta.url)

export async function buildDsdPolyfillScripts(): Promise<string> {
  const pkgPath = _require.resolve('@webcomponents/template-shadowroot/template-shadowroot.min.js')
  const polyfillSource = await readFile(pkgPath, 'utf-8')
  const cleanSource = polyfillSource.replace(/\/\/# sourceMappingURL=.*$/m, '').trimEnd()

  const nativeCheckScript = `  <script>if('shadowRootMode'in HTMLTemplateElement.prototype){document.body.removeAttribute('dsd-pending')}</script>`
  const polyfillDefineScript = `  <script>if(!('shadowRootMode'in HTMLTemplateElement.prototype)){${cleanSource}}</script>`
  const polyfillHydrateScript = `  <script type="module">if(!('shadowRootMode'in HTMLTemplateElement.prototype)){TemplateShadowRoot.hydrateShadowRoots(document.body);document.body.removeAttribute('dsd-pending')}</script>`

  return `${nativeCheckScript}\n${polyfillDefineScript}\n${polyfillHydrateScript}`
}
