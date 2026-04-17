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

export async function buildDsdPolyfillScriptsForWrapper(wrapperTag: string, hasDsdPendingAttr: boolean): Promise<string> {
  const pkgPath = _require.resolve('@webcomponents/template-shadowroot/template-shadowroot.min.js')
  const polyfillSource = await readFile(pkgPath, 'utf-8')
  const cleanSource = polyfillSource.replace(/\/\/# sourceMappingURL=.*$/m, '').trimEnd()

  const polyfillDefineScript = `  <script>if(!('shadowRootMode'in HTMLTemplateElement.prototype)){${cleanSource}}</script>`

  if (hasDsdPendingAttr) {
    const pendingSel = `document.querySelector('${wrapperTag}[dsd-pending]')`
    const nativeCheckScript = `  <script>var __w=document.querySelector('${wrapperTag}[dsd-pending]');if(__w)__w.removeAttribute('dsd-pending')</script>`
    const polyfillHydrateScript = `  <script type="module">var __w=${pendingSel};if(__w&&!('shadowRootMode'in HTMLTemplateElement.prototype)){TemplateShadowRoot.hydrateShadowRoots(__w);__w.removeAttribute('dsd-pending')}else if(__w){__w.removeAttribute('dsd-pending')}</script>`
    return `${nativeCheckScript}\n${polyfillDefineScript}\n${polyfillHydrateScript}`
  }

  const sel = `document.querySelector('${wrapperTag}')`
  const polyfillHydrateScript = `  <script type="module">var __w=${sel};if(__w&&!('shadowRootMode'in HTMLTemplateElement.prototype))TemplateShadowRoot.hydrateShadowRoots(__w)</script>`
  return `${polyfillDefineScript}\n${polyfillHydrateScript}`
}
