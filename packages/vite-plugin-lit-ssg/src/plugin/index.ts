import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { dirname, join, resolve, relative, isAbsolute } from 'node:path'
import MagicString from 'magic-string'
import * as ts from 'typescript'
import type { Plugin, ResolvedConfig, UserConfig, ViteDevServer } from 'vite'
import type { CommonStylesOptions, LitSSGOptionsNew, ResolvedSingleComponentOptions } from '../types.js'
import { resolveSingleComponentOptions } from '../types.js'
import type { PageEntry, ScanPagesOptions } from '../scanner/pages.js'
import {
  _ssgActive,
  PLUGIN_NAME,
  RESOLVED_VIRTUAL_DEV_PAGE_PREFIX,
  RESOLVED_VIRTUAL_PAGE_PREFIX,
  RESOLVED_VIRTUAL_SERVER_ID,
  RESOLVED_VIRTUAL_SHARED_ID,
  RESOLVED_VIRTUAL_SINGLE_CLIENT_ID,
  RESOLVED_VIRTUAL_SINGLE_DEV_ID,
  RESOLVED_VIRTUAL_SINGLE_SERVER_ID,
  VIRTUAL_DEV_PAGE_PREFIX,
  VIRTUAL_PAGE_PREFIX,
  VIRTUAL_SERVER_ID,
  VIRTUAL_SHARED_ID,
  VIRTUAL_SINGLE_CLIENT_ID,
  VIRTUAL_SINGLE_DEV_ID,
  VIRTUAL_SINGLE_SERVER_ID,
} from './constants.js'

const _require = createRequire(import.meta.url)

const COMMON_STYLES_TEXT_IDENTIFIER = '__litSsgCommonCssText'
const COMMON_STYLES_IDENTIFIER = '__litSsgCommonStyles'
const COMMON_STYLES_CSS_IDENTIFIER = '__litSsgCss'
const COMMON_STYLES_UNSAFE_CSS_IDENTIFIER = '__litSsgUnsafeCSS'

type TransformTargetRequest =
  | { kind: 'class-name', name: string }
  | { kind: 'export-name', name: string }

type TargetResolution =
  | { kind: 'local-class', className: string }
  | { kind: 'external-export', moduleSpecifier: string, exportName: string }

interface SharedTransformState {
  resolvedConfig: ResolvedConfig | null
  commonStyles: CommonStylesOptions
  transformTargets: Map<string, TransformTargetRequest[]>
}

interface PageModeState extends SharedTransformState {
  kind: 'page'
  pagesDir: string
  scanOptions: ScanPagesOptions
  pages: PageEntry[]
  pageModuleIds: Set<string>
  injectPolyfill: boolean
}

interface SingleComponentState extends SharedTransformState {
  kind: 'single-component'
  resolved: ResolvedSingleComponentOptions
  entryModuleId: string | null
}

type PluginState = PageModeState | SingleComponentState

const pluginState = new WeakMap<object, PluginState>()

function normalizeFileId(id: string): string {
  const queryIdx = id.indexOf('?')
  const hashIdx = id.indexOf('#')
  const sliceIdx = [queryIdx, hashIdx].filter((idx) => idx >= 0).sort((a, b) => a - b)[0]
  const clean = sliceIdx == null ? id : id.slice(0, sliceIdx)
  return clean.replace(/\\/g, '/')
}

function toImportPath(filePath: string): string {
  return filePath.replace(/\\/g, '/')
}

function resolveCommonStylesImports(root: string, commonStyles: CommonStylesOptions | undefined): string[] {
  if (!commonStyles || commonStyles.length === 0) return []

  return commonStyles.map(({ file }) => {
    const absoluteFile = resolve(root, file)
    const relativeToRoot = relative(root, absoluteFile)
    const importPath = !relativeToRoot.startsWith('..') && !isAbsolute(relativeToRoot)
      ? `/${toImportPath(relativeToRoot)}`
      : toImportPath(absoluteFile)

    return `${importPath}?inline`
  })
}

function updateResolvedPaths(state: PluginState, root: string): void {
  if (state.kind === 'single-component') {
    state.entryModuleId = normalizeFileId(resolve(root, state.resolved.entry))
  }
}

function syncPageTargets(state: PageModeState): void {
  state.pageModuleIds = new Set(state.pages.map((page) => normalizeFileId(page.filePath)))
  state.transformTargets.clear()
}

function enqueueTransformTarget(
  targetMap: Map<string, TransformTargetRequest[]>,
  moduleId: string,
  request: TransformTargetRequest,
): void {
  const requests = targetMap.get(moduleId) ?? []
  if (!requests.some((entry) => entry.kind === request.kind && entry.name === request.name)) {
    requests.push(request)
    targetMap.set(moduleId, requests)
  }
}

function shouldHandleModule(id: string): boolean {
  if (id.startsWith('\0')) return false
  if (id.includes('/node_modules/')) return false
  if (id.endsWith('.d.ts')) return false
  return /\.(ts|tsx|js|jsx)$/.test(id)
}

function createSourceFile(fileName: string, source: string): ts.SourceFile {
  const scriptKind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX
    : fileName.endsWith('.jsx') ? ts.ScriptKind.JSX
      : fileName.endsWith('.js') ? ts.ScriptKind.JS
        : fileName.endsWith('.mjs') ? ts.ScriptKind.JS
          : fileName.endsWith('.cjs') ? ts.ScriptKind.JS
            : ts.ScriptKind.TS

  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, scriptKind)
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined
  return modifiers?.some((modifier) => modifier.kind === kind) ?? false
}

function isStaticStylesMember(member: ts.ClassElement): member is ts.PropertyDeclaration | ts.GetAccessorDeclaration {
  if (!('name' in member) || member.name == null) return false
  if (!hasModifier(member, ts.SyntaxKind.StaticKeyword)) return false
  return ts.isIdentifier(member.name) && member.name.text === 'styles' && (ts.isPropertyDeclaration(member) || ts.isGetAccessorDeclaration(member))
}

function collectClassDeclarations(sourceFile: ts.SourceFile): Map<string, ts.ClassDeclaration> {
  const classes = new Map<string, ts.ClassDeclaration>()

  const visit = (node: ts.Node) => {
    if (ts.isClassDeclaration(node) && node.name != null) {
      classes.set(node.name.text, node)
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return classes
}

function collectLitElementImportNames(sourceFile: ts.SourceFile): Set<string> {
  const names = new Set<string>()

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue

    const moduleName = statement.moduleSpecifier.text
    if (moduleName !== 'lit' && moduleName !== 'lit-element') continue

    const namedBindings = statement.importClause?.namedBindings
    if (!namedBindings || !ts.isNamedImports(namedBindings)) continue

    for (const element of namedBindings.elements) {
      const importedName = element.propertyName?.text ?? element.name.text
      if (importedName === 'LitElement') {
        names.add(element.name.text)
      }
    }
  }

  return names
}

function isLitElementSubclass(
  classDecl: ts.ClassDeclaration,
  classes: Map<string, ts.ClassDeclaration>,
  litElementNames: Set<string>,
  seen = new Set<string>(),
): boolean {
  const heritage = classDecl.heritageClauses?.find((clause) => clause.token === ts.SyntaxKind.ExtendsKeyword)
  const heritageType = heritage?.types[0]
  if (!heritageType) return false

  const expression = heritageType.expression
  if (!ts.isIdentifier(expression)) return false

  if (litElementNames.has(expression.text)) return true
  if (seen.has(expression.text)) return false

  const baseClass = classes.get(expression.text)
  if (!baseClass) return false

  seen.add(expression.text)
  return isLitElementSubclass(baseClass, classes, litElementNames, seen)
}

function getIdentifierBindingResolution(sourceFile: ts.SourceFile, identifierName: string): TargetResolution | null {
  const classes = collectClassDeclarations(sourceFile)
  if (classes.has(identifierName)) {
    return { kind: 'local-class', className: identifierName }
  }

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue

    const moduleSpecifier = statement.moduleSpecifier.text
    const importClause = statement.importClause
    if (!importClause) continue

    if (importClause.name?.text === identifierName) {
      return {
        kind: 'external-export',
        moduleSpecifier,
        exportName: 'default',
      }
    }

    const namedBindings = importClause.namedBindings
    if (namedBindings && ts.isNamedImports(namedBindings)) {
      for (const element of namedBindings.elements) {
        if (element.name.text === identifierName) {
          return {
            kind: 'external-export',
            moduleSpecifier,
            exportName: element.propertyName?.text ?? element.name.text,
          }
        }
      }
    }
  }

  return null
}

function isDefineLitRouteCall(expression: ts.Expression): expression is ts.CallExpression {
  return ts.isCallExpression(expression)
    && ts.isIdentifier(expression.expression)
    && expression.expression.text === 'defineLitRoute'
}

function resolvePageComponentTarget(sourceFile: ts.SourceFile): TargetResolution | null {
  const exportAssignment = sourceFile.statements.find(ts.isExportAssignment)
  if (!exportAssignment || !isDefineLitRouteCall(exportAssignment.expression)) return null

  const routeDescriptor = exportAssignment.expression.arguments[0]
  if (!routeDescriptor || !ts.isObjectLiteralExpression(routeDescriptor)) return null

  const componentProperty = routeDescriptor.properties.find((property) => {
    return ts.isPropertyAssignment(property)
      && ts.isIdentifier(property.name)
      && property.name.text === 'component'
  })

  if (!componentProperty || !ts.isPropertyAssignment(componentProperty)) return null
  if (!ts.isIdentifier(componentProperty.initializer)) {
    throw new Error('[vite-plugin-lit-ssg] commonStyles requires defineLitRoute({ component }) to use a statically analyzable identifier.')
  }

  const resolution = getIdentifierBindingResolution(sourceFile, componentProperty.initializer.text)
  if (!resolution) {
    throw new Error(
      `[vite-plugin-lit-ssg] commonStyles could not resolve route component "${componentProperty.initializer.text}" to a local class or imported binding.`,
    )
  }

  return resolution
}

function resolveExportTarget(sourceFile: ts.SourceFile, exportName: string): TargetResolution | null {
  const classes = collectClassDeclarations(sourceFile)

  if (exportName === 'default') {
    for (const statement of sourceFile.statements) {
      if (ts.isClassDeclaration(statement) && hasModifier(statement, ts.SyntaxKind.ExportKeyword) && hasModifier(statement, ts.SyntaxKind.DefaultKeyword)) {
        if (!statement.name) {
          throw new Error('[vite-plugin-lit-ssg] commonStyles does not support anonymous default-exported Lit components. Export a named class instead.')
        }
        return { kind: 'local-class', className: statement.name.text }
      }

      if (ts.isExportAssignment(statement)) {
        if (!ts.isIdentifier(statement.expression)) {
          throw new Error('[vite-plugin-lit-ssg] commonStyles requires the single-component default export to be a statically analyzable identifier or named class.')
        }

        const resolution = getIdentifierBindingResolution(sourceFile, statement.expression.text)
        if (!resolution) {
          throw new Error(
            `[vite-plugin-lit-ssg] commonStyles could not resolve default export "${statement.expression.text}" to a local class or imported binding.`,
          )
        }

        return resolution
      }

      if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          if (element.name.text !== 'default') continue

          if (statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
            return {
              kind: 'external-export',
              moduleSpecifier: statement.moduleSpecifier.text,
              exportName: element.propertyName?.text ?? 'default',
            }
          }

          const localName = element.propertyName?.text ?? element.name.text
          const resolution = getIdentifierBindingResolution(sourceFile, localName)
          if (!resolution) {
            throw new Error(
              `[vite-plugin-lit-ssg] commonStyles could not resolve local default export binding "${localName}".`,
            )
          }
          return resolution
        }
      }
    }

    return null
  }

  if (classes.has(exportName)) {
    const classDecl = classes.get(exportName)!
    if (hasModifier(classDecl, ts.SyntaxKind.ExportKeyword)) {
      return { kind: 'local-class', className: exportName }
    }
  }

  for (const statement of sourceFile.statements) {
    if (!ts.isExportDeclaration(statement) || !statement.exportClause || !ts.isNamedExports(statement.exportClause)) continue

    for (const element of statement.exportClause.elements) {
      if (element.name.text !== exportName) continue

      if (statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
        return {
          kind: 'external-export',
          moduleSpecifier: statement.moduleSpecifier.text,
          exportName: element.propertyName?.text ?? element.name.text,
        }
      }

      const localName = element.propertyName?.text ?? element.name.text
      const resolution = getIdentifierBindingResolution(sourceFile, localName)
      if (!resolution) {
        throw new Error(
          `[vite-plugin-lit-ssg] commonStyles could not resolve exported binding "${localName}" for export "${exportName}".`,
        )
      }
      return resolution
    }
  }

  return null
}

function prependCommonStyles(expression: ts.Expression, sourceFile: ts.SourceFile): string {
  if (ts.isArrayLiteralExpression(expression)) {
    const elements = expression.elements.map((element) => element.getText(sourceFile))
    return elements.length === 0
      ? `[...${COMMON_STYLES_IDENTIFIER}]`
      : `[...${COMMON_STYLES_IDENTIFIER}, ${elements.join(', ')}]`
  }

  return `[...${COMMON_STYLES_IDENTIFIER}, ${expression.getText(sourceFile)}]`
}

function getLineIndentation(source: string, position: number): string {
  let lineStart = source.lastIndexOf('\n', position)
  lineStart = lineStart === -1 ? 0 : lineStart + 1
  let cursor = lineStart

  while (cursor < source.length && (source[cursor] === ' ' || source[cursor] === '\t')) {
    cursor += 1
  }

  return source.slice(lineStart, cursor)
}

function insertCommonStylesMember(
  magicString: MagicString,
  source: string,
  classDecl: ts.ClassDeclaration,
): void {
  const openBrace = source.indexOf('{', classDecl.getStart())
  if (openBrace < 0) {
    throw new Error('[vite-plugin-lit-ssg] commonStyles could not locate the class body for style injection.')
  }

  const classIndent = getLineIndentation(source, classDecl.getStart())
  const memberIndent = `${classIndent}  `
  magicString.appendLeft(
    openBrace + 1,
    `\n${memberIndent}static styles = [...${COMMON_STYLES_IDENTIFIER}]\n`,
  )
}

function getCommonStylesTextIdentifier(index: number): string {
  return `${COMMON_STYLES_TEXT_IDENTIFIER}${index}`
}

function rewriteTargetClass(
  magicString: MagicString,
  source: string,
  sourceFile: ts.SourceFile,
  classDecl: ts.ClassDeclaration,
): void {
  const stylesMember = classDecl.members.find(isStaticStylesMember)

  if (stylesMember == null) {
    insertCommonStylesMember(magicString, source, classDecl)
    return
  }

  if (ts.isPropertyDeclaration(stylesMember)) {
    if (!stylesMember.initializer) {
      throw new Error('[vite-plugin-lit-ssg] commonStyles found a static styles field without an initializer, which is not supported.')
    }

    magicString.overwrite(
      stylesMember.initializer.getStart(sourceFile),
      stylesMember.initializer.getEnd(),
      prependCommonStyles(stylesMember.initializer, sourceFile),
    )
    return
  }

  const body = stylesMember.body
  const statement = body?.statements.length === 1 ? body.statements[0] : undefined
  if (!statement || !ts.isReturnStatement(statement) || !statement.expression) {
    throw new Error('[vite-plugin-lit-ssg] commonStyles only supports static get styles() getters with a single return statement.')
  }

  magicString.overwrite(
    statement.expression.getStart(sourceFile),
    statement.expression.getEnd(),
    prependCommonStyles(statement.expression, sourceFile),
  )
}

function insertCommonStylesHelper(
  magicString: MagicString,
  sourceFile: ts.SourceFile,
  commonStylesImports: string[],
): void {
  const textImports = commonStylesImports
    .map((commonStylesImport, index) => `import ${getCommonStylesTextIdentifier(index)} from '${commonStylesImport}'`)
    .join('\n')
  const commonStylesEntries = commonStylesImports
    .map((_, index) => `${COMMON_STYLES_CSS_IDENTIFIER}\`\${${COMMON_STYLES_UNSAFE_CSS_IDENTIFIER}(${getCommonStylesTextIdentifier(index)})}\``)
    .join(', ')
  const helperBlock = `import { css as ${COMMON_STYLES_CSS_IDENTIFIER}, unsafeCSS as ${COMMON_STYLES_UNSAFE_CSS_IDENTIFIER} } from 'lit'\n${textImports}\nconst ${COMMON_STYLES_IDENTIFIER} = [${commonStylesEntries}]\n`
  const imports = sourceFile.statements.filter(ts.isImportDeclaration)

  if (imports.length > 0) {
    magicString.appendRight(imports[imports.length - 1]!.end, `\n${helperBlock}`)
    return
  }

  magicString.prepend(`${helperBlock}\n`)
}

function rewriteModuleWithCommonStyles(
  code: string,
  sourceFile: ts.SourceFile,
  cleanId: string,
  commonStylesImports: string[],
  targetClassNames: Set<string>,
): { code: string, map: ReturnType<MagicString['generateMap']> } | null {
  if (targetClassNames.size === 0) return null

  const classes = collectClassDeclarations(sourceFile)
  const litElementNames = collectLitElementImportNames(sourceFile)
  const magicString = new MagicString(code, { filename: cleanId })

  for (const className of targetClassNames) {
    const classDecl = classes.get(className)
    if (!classDecl) {
      throw new Error(`[vite-plugin-lit-ssg] commonStyles could not find class "${className}" in ${cleanId}.`)
    }

    if (!isLitElementSubclass(classDecl, classes, litElementNames)) {
      throw new Error(
        `[vite-plugin-lit-ssg] commonStyles targeted "${className}" in ${cleanId}, but it is not a LitElement subclass.`,
      )
    }

    rewriteTargetClass(magicString, code, sourceFile, classDecl)
  }

  insertCommonStylesHelper(magicString, sourceFile, commonStylesImports)

  return {
    code: magicString.toString(),
    map: magicString.generateMap({
      source: cleanId,
      includeContent: true,
      hires: true,
    }),
  }
}

async function queueExternalTarget(
  context: { resolve: (source: string, importer?: string, options?: { skipSelf?: boolean }) => Promise<{ id: string } | null> },
  targetMap: Map<string, TransformTargetRequest[]>,
  importerId: string,
  moduleSpecifier: string,
  exportName: string,
): Promise<void> {
  const resolved = await context.resolve(moduleSpecifier, importerId, { skipSelf: true })
  if (!resolved?.id) {
    throw new Error(
      `[vite-plugin-lit-ssg] commonStyles could not resolve "${moduleSpecifier}" from "${importerId}".`,
    )
  }

  const resolvedId = normalizeFileId(resolved.id)
  if (!shouldHandleModule(resolvedId)) {
    throw new Error(
      `[vite-plugin-lit-ssg] commonStyles resolved "${moduleSpecifier}" from "${importerId}" to unsupported module "${resolved.id}".`,
    )
  }

  enqueueTransformTarget(targetMap, resolvedId, { kind: 'export-name', name: exportName })
}

async function applyTargetResolution(
  context: { resolve: (source: string, importer?: string, options?: { skipSelf?: boolean }) => Promise<{ id: string } | null> },
  targetMap: Map<string, TransformTargetRequest[]>,
  importerId: string,
  localTargets: Set<string>,
  resolution: TargetResolution | null,
): Promise<void> {
  if (!resolution) return

  if (resolution.kind === 'local-class') {
    localTargets.add(resolution.className)
    return
  }

  await queueExternalTarget(context, targetMap, importerId, resolution.moduleSpecifier, resolution.exportName)
}

async function resolveQueuedTargets(
  context: { resolve: (source: string, importer?: string, options?: { skipSelf?: boolean }) => Promise<{ id: string } | null> },
  targetMap: Map<string, TransformTargetRequest[]>,
  sourceFile: ts.SourceFile,
  importerId: string,
  requests: TransformTargetRequest[],
  localTargets: Set<string>,
): Promise<void> {
  for (const request of requests) {
    if (request.kind === 'class-name') {
      localTargets.add(request.name)
      continue
    }

    const resolution = resolveExportTarget(sourceFile, request.name)
    if (!resolution) {
      throw new Error(
        `[vite-plugin-lit-ssg] commonStyles could not resolve export "${request.name}" in ${importerId}.`,
      )
    }

    await applyTargetResolution(context, targetMap, importerId, localTargets, resolution)
  }
}

export function litSSG(options: LitSSGOptionsNew = {}): Plugin {
  let state: PluginState

  if (options.mode === 'single-component') {
    state = {
      kind: 'single-component',
      resolved: resolveSingleComponentOptions(options),
      resolvedConfig: null,
      entryModuleId: null,
      commonStyles: options.commonStyles ?? [],
      transformTargets: new Map(),
    }
  } else {
    const pagesDir = options.pagesDir ?? 'src/pages'
    state = {
      kind: 'page',
      pagesDir,
      scanOptions: options.ignore != null
        ? { pagesDir, ignore: options.ignore }
        : { pagesDir },
      resolvedConfig: null,
      pages: [],
      pageModuleIds: new Set(),
      injectPolyfill: options.injectPolyfill ?? true,
      commonStyles: options.commonStyles ?? [],
      transformTargets: new Map(),
    }
  }

  const plugin: Plugin = {
    name: PLUGIN_NAME,
    enforce: 'pre',

    config(_userConfig: UserConfig) {
      const nodePath = _require.resolve('@lit-labs/ssr-client/lit-element-hydrate-support.js')
      const browserHydratePath = join(dirname(nodePath), '..', 'lit-element-hydrate-support.js')
      return {
        build: {
          manifest: true,
        },
        esbuild: {
          tsconfigRaw: {
            compilerOptions: {
              experimentalDecorators: true,
            },
          },
        },
        resolve: {
          alias: {
            '@lit-labs/ssr-client/lit-element-hydrate-support.js': browserHydratePath,
          },
        },
      }
    },

    configResolved(config) {
      state.resolvedConfig = config
      updateResolvedPaths(state, config.root ?? process.cwd())
    },

    async options(rollupOptions) {
      const config = state.resolvedConfig
      if (!config) return
      if (config.build?.ssr) return
      if (config.command !== 'build') return

      const projectRoot = config.root
      if (_ssgActive.has(projectRoot)) return

      if (state.kind === 'single-component') {
        return {
          ...rollupOptions,
          input: { 'lit-ssg-single': VIRTUAL_SINGLE_CLIENT_ID },
        }
      }

      const { scanPages } = await import('../scanner/pages.js')
      const { buildPageInputs } = await import('../runner/build.js')
      const pages = await scanPages(projectRoot, state.scanOptions)
      state.pages = pages
      syncPageTargets(state)

      const { pageInputs } = buildPageInputs(pages)

      return {
        ...rollupOptions,
        input: {
          'lit-ssg-shared': VIRTUAL_SHARED_ID,
          ...pageInputs,
        },
      }
    },

    async buildStart() {
      if (state.kind === 'page' && state.pages.length === 0) {
        const { scanPages } = await import('../scanner/pages.js')
        const root = state.resolvedConfig?.root ?? process.cwd()
        state.pages = await scanPages(root, state.scanOptions)
        syncPageTargets(state)
      }
    },

    async closeBundle() {
      const config = state.resolvedConfig
      if (!config) return
      if (config.build?.ssr) return
      if (config.command !== 'build') return

      const projectRoot = config.root ?? process.cwd()
      if (_ssgActive.has(projectRoot)) return

      const base = config.base ?? '/'
      const outDir = config.build?.outDir ?? 'dist'
      const mode = config.mode ?? 'production'
      const configFile = config.configFile
      const ctx = { mode, configFile }

      if (state.kind === 'single-component') {
        const { runSingleSSRRender } = await import('../runner/ssr-render.js')
        await runSingleSSRRender(state.resolved, projectRoot, base, outDir, ctx)
        console.log('[vite-lit-ssg] Done!')
        return
      }

      if (state.kind === 'page') {
        const { buildPageInputs } = await import('../runner/build.js')
        const { runSSRRender } = await import('../runner/ssr-render.js')
        const pageInputResult = buildPageInputs(state.pages)
        await runSSRRender(state.pages, pageInputResult, projectRoot, base, outDir, ctx, state.injectPolyfill)
        console.log('[vite-lit-ssg] Done!')
      }
    },

    configureServer(server: ViteDevServer) {
      if (state.kind === 'single-component') {
        const resolved = state.resolved
        server.middlewares.use(async (req, res, next) => {
          const rawUrl = req.url ?? '/'
          const pathname = (rawUrl.split('?')[0] ?? '/').split('#')[0] ?? '/'

          if (req.method !== 'GET' && req.method !== 'HEAD') return next()

          const base = server.config.base ?? '/'
          const isRootBase = base === '/' || base === ''
          const normalizedBase = base.endsWith('/') ? base : base + '/'
          const isRoot = isRootBase
            ? pathname === '/'
            : pathname === base.replace(/\/$/, '') || pathname === normalizedBase
          if (!isRoot) return next()

          const hydrateScriptSrc = `/@id/__x00__${VIRTUAL_SINGLE_CLIENT_ID}`
          const fallbackScriptSrc = `/@id/__x00__${VIRTUAL_SINGLE_DEV_ID}`
          const wrapperTag = typeof resolved.wrapperTag === 'function' ? resolved.wrapperTag() : resolved.wrapperTag

          try {
            const { renderDevSingleComponent } = await import('../runner/dev-ssr.js')
            const fragment = await renderDevSingleComponent(
              server,
              wrapperTag,
              hydrateScriptSrc,
              resolved.injectPolyfill,
              resolved.dsdPendingStyle,
              resolved.preload,
            )
            const htmlShell = `<!DOCTYPE html>\n<html>\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Dev</title>\n  </head>\n  <body>\n${fragment}\n  </body>\n</html>`
            const transformed = await server.transformIndexHtml(rawUrl, htmlShell)
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.statusCode = 200
            res.end(transformed)
          } catch (e) {
            server.config.logger.error(
              `[vite-plugin-lit-ssg] SSR dev render failed, falling back to client-only: ${e instanceof Error ? e.message : String(e)}`,
            )
            const htmlTemplate = `<!DOCTYPE html>\n<html>\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Dev</title>\n  </head>\n  <body>\n    <script type="module" src="${fallbackScriptSrc}"></script>\n  </body>\n</html>`
            try {
              const transformed = await server.transformIndexHtml(rawUrl, htmlTemplate)
              res.setHeader('Content-Type', 'text/html; charset=utf-8')
              res.statusCode = 200
              res.end(transformed)
            } catch (e2) {
              next(e2)
            }
          }
        })
        return
      }

      const root = server.config.root ?? process.cwd()
      const absolutePagesDir = resolve(root, state.pagesDir)

      const seedPages = async () => {
        if (state.kind === 'page' && state.pages.length === 0) {
          const { scanPages } = await import('../scanner/pages.js')
          try {
            state.pages = await scanPages(root, state.scanOptions)
            syncPageTargets(state)
          } catch {
            // pages dir may not exist yet; watcher will pick up additions
          }
        }
      }

      const seedReady = seedPages()

      const rescanPages = async (addedFile?: string) => {
        if (state.kind !== 'page') return
        await seedReady
        const { scanPages } = await import('../scanner/pages.js')
        const prevRoutes = new Set(state.pages.map((p) => p.route))
        try {
          state.pages = await scanPages(root, state.scanOptions)
          syncPageTargets(state)
          for (const id of [RESOLVED_VIRTUAL_SHARED_ID, RESOLVED_VIRTUAL_SERVER_ID]) {
            const mod = server.moduleGraph.getModuleById(id)
            if (mod) server.moduleGraph.invalidateModule(mod)
          }
        } catch (err) {
          server.config.logger.warn(
            `[vite-plugin-lit-ssg] Page rescan failed: ${err instanceof Error ? err.message : String(err)}`,
          )
          return
        }
        if (addedFile) {
          for (const page of state.pages) {
            if (!prevRoutes.has(page.route)) {
              server.config.logger.info(
                `[vite-plugin-lit-ssg] New route detected: ${page.route} → ${page.importPath}`,
                { timestamp: true },
              )
            }
          }
        }
        server.ws.send({ type: 'full-reload' })
      }

      const isUnderPagesDir = (file: string) => {
        const rel = relative(absolutePagesDir, file)
        return !rel.startsWith('..') && !isAbsolute(rel)
      }

      const isPageFile = (file: string) => /\.(ts|tsx|js|jsx)$/.test(file)

      server.watcher.add(absolutePagesDir)
      server.watcher.on('add', (file) => {
        if (isUnderPagesDir(file) && isPageFile(file)) rescanPages(file)
      })
      server.watcher.on('unlink', (file) => {
        if (isUnderPagesDir(file) && isPageFile(file)) rescanPages()
      })

      server.middlewares.use(async (req, res, next) => {
        if (state.kind !== 'page') return next()
        const rawUrl = req.url ?? '/'
        const pathname = (rawUrl.split('?')[0] ?? '/').split('#')[0] ?? '/'

        if (req.method !== 'GET' && req.method !== 'HEAD') return next()

        if (state.pages.length === 0) {
          const { scanPages } = await import('../scanner/pages.js')
          const resolvedRoot = state.resolvedConfig?.root ?? process.cwd()
          state.pages = await scanPages(resolvedRoot, state.scanOptions)
          syncPageTargets(state)
        }

        const base = state.resolvedConfig?.base ?? '/'
        const normalizedBase = base.endsWith('/') ? base : base + '/'
        let routePath: string
        if (base === '/' || base === '') {
          routePath = pathname
        } else if (pathname.startsWith(normalizedBase)) {
          routePath = '/' + pathname.slice(normalizedBase.length)
        } else if (pathname === base.replace(/\/$/, '')) {
          routePath = '/'
        } else {
          return next()
        }

        const matchedPage = state.pages.find((p) => {
          if (p.route === routePath) return true
          if (p.route === routePath.replace(/\/$/, '') && routePath !== '/') return true
          return false
        })

        if (!matchedPage) {
          const accept = req.headers.accept ?? ''
          if (
            !accept.includes('text/html')
            || pathname.startsWith('/@')
            || pathname.startsWith('/node_modules/')
            || /\.\w+$/.test(pathname.split('/').pop() ?? '')
          ) {
            return next()
          }

          const safeRoutePath = routePath
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')

          const homeHref = base === '/' || base === '' ? '/' : base

          const html404 = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>404 Not Found</title>
    <style>
      body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
      .container { text-align: center; padding: 2rem; }
      h1 { font-size: 6rem; margin: 0; color: #333; }
      p { color: #666; font-size: 1.2rem; }
      a { color: #646cff; text-decoration: none; }
      a:hover { text-decoration: underline; }
      .badge { display: inline-block; background: #ff6b35; color: white; font-size: 0.75rem; padding: 2px 8px; border-radius: 4px; margin-bottom: 1rem; font-weight: bold; letter-spacing: 0.05em; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="badge">DEV ONLY</div>
      <h1>404</h1>
      <p>Page not found: <code>${safeRoutePath}</code></p>
      <p><a href="${homeHref}">← Back to home</a></p>
    </div>
  </body>
</html>`
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.statusCode = 404
          if (req.method === 'HEAD') {
            res.setHeader('Content-Length', Buffer.byteLength(html404))
            res.end()
          } else {
            try {
              const transformed = await server.transformIndexHtml(rawUrl, html404)
              res.end(transformed)
            } catch {
              res.end(html404)
            }
          }
          return
        }

        const hydrateScriptSrc = `/@id/__x00__${VIRTUAL_PAGE_PREFIX}${matchedPage.slug}`
        const injectPolyfill = (state as PageModeState).injectPolyfill

        try {
          const { renderDevPage } = await import('../runner/dev-ssr.js')
          const ssrHtml = await renderDevPage(server, matchedPage.route, hydrateScriptSrc, injectPolyfill)
          const transformed = await server.transformIndexHtml(rawUrl, ssrHtml)
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.statusCode = 200
          res.end(transformed)
        } catch (e) {
            server.config.logger.error(
              `[vite-plugin-lit-ssg] SSR dev render failed for ${matchedPage.route}, falling back to client-only: ${e instanceof Error ? e.message : String(e)}`,
            )
          const devPageId = `${VIRTUAL_DEV_PAGE_PREFIX}${matchedPage.route === '/' ? 'index' : matchedPage.route.slice(1)}`
          const htmlTemplate = `<!DOCTYPE html>\n<html>\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Dev</title>\n  </head>\n  <body>\n    <script type="module" src="/@id/__x00__${devPageId}"></script>\n  </body>\n</html>`
          try {
            const transformed = await server.transformIndexHtml(rawUrl, htmlTemplate)
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.statusCode = 200
            res.end(transformed)
          } catch (e2) {
            next(e2)
          }
        }
      })
    },

    async transform(code, id) {
      const cleanId = normalizeFileId(id)
      const root = state.resolvedConfig?.root ?? process.cwd()
      const commonStyleImports = resolveCommonStylesImports(root, state.commonStyles)

      if (commonStyleImports.length === 0) return null
      if (!shouldHandleModule(cleanId)) return null
      if (id.includes('?inline')) return null
      if (code.includes(`const ${COMMON_STYLES_IDENTIFIER} =`)) return null

      const queuedTargets = state.transformTargets.get(cleanId) ?? []
      const isPageModule = state.kind === 'page' && state.pageModuleIds.has(cleanId)
      const isSingleEntry = state.kind === 'single-component' && state.entryModuleId === cleanId

      if (!isPageModule && !isSingleEntry && queuedTargets.length === 0) {
        return null
      }

      const sourceFile = createSourceFile(cleanId, code)
      const localTargets = new Set<string>()

      if (isPageModule) {
        const resolution = resolvePageComponentTarget(sourceFile)
        await applyTargetResolution(this, state.transformTargets, cleanId, localTargets, resolution)
      }

      if (isSingleEntry && state.kind === 'single-component') {
        const resolution = resolveExportTarget(sourceFile, state.resolved.exportName)
        if (!resolution) {
          throw new Error(
            `[vite-plugin-lit-ssg] commonStyles could not find export "${state.resolved.exportName}" in ${cleanId}.`,
          )
        }
        await applyTargetResolution(this, state.transformTargets, cleanId, localTargets, resolution)
      }

      if (queuedTargets.length > 0) {
        await resolveQueuedTargets(this, state.transformTargets, sourceFile, cleanId, queuedTargets, localTargets)
      }

      return rewriteModuleWithCommonStyles(
        code,
        sourceFile,
        cleanId,
        commonStyleImports,
        localTargets,
      )
    },

    resolveId(id) {
      if (state.kind === 'single-component') {
        if (id === VIRTUAL_SINGLE_CLIENT_ID) return RESOLVED_VIRTUAL_SINGLE_CLIENT_ID
        if (id === VIRTUAL_SINGLE_SERVER_ID) return RESOLVED_VIRTUAL_SINGLE_SERVER_ID
        if (id === VIRTUAL_SINGLE_DEV_ID) return RESOLVED_VIRTUAL_SINGLE_DEV_ID
        return undefined
      }
      if (id === VIRTUAL_SHARED_ID) return RESOLVED_VIRTUAL_SHARED_ID
      if (id === VIRTUAL_SERVER_ID) return RESOLVED_VIRTUAL_SERVER_ID
      if (id.startsWith(VIRTUAL_PAGE_PREFIX)) {
        return RESOLVED_VIRTUAL_PAGE_PREFIX + id.slice(VIRTUAL_PAGE_PREFIX.length)
      }
      if (id.startsWith(VIRTUAL_DEV_PAGE_PREFIX)) {
        return RESOLVED_VIRTUAL_DEV_PAGE_PREFIX + id.slice(VIRTUAL_DEV_PAGE_PREFIX.length)
      }
      return undefined
    },

    async load(id) {
      if (id === RESOLVED_VIRTUAL_SINGLE_CLIENT_ID) {
        if (state.kind !== 'single-component') return undefined
        const { generateSingleClientEntry } = await import('../virtual/single-client-entry.js')
        return generateSingleClientEntry(state.resolved)
      }
      if (id === RESOLVED_VIRTUAL_SINGLE_SERVER_ID) {
        if (state.kind !== 'single-component') return undefined
        if (state.resolvedConfig?.command === 'serve') {
          const ssrIndexPath = pathToFileURL(_require.resolve('@lit-labs/ssr')).href
          const ssrRenderResultPath = pathToFileURL(_require.resolve('@lit-labs/ssr/lib/render-result.js')).href
          const { generateDevSingleServerEntry } = await import('../virtual/single-server-entry.js')
          return generateDevSingleServerEntry(state.resolved, ssrIndexPath, ssrRenderResultPath)
        }
        const { generateSingleServerEntry } = await import('../virtual/single-server-entry.js')
        return generateSingleServerEntry(state.resolved)
      }
      if (id === RESOLVED_VIRTUAL_SINGLE_DEV_ID) {
        if (state.kind !== 'single-component') return undefined
        const { generateSingleDevEntry } = await import('../virtual/single-client-entry.js')
        return generateSingleDevEntry(state.resolved)
      }
      if (id === RESOLVED_VIRTUAL_SHARED_ID) {
        const { generateSharedEntry } = await import('../virtual/client-entry.js')
        return generateSharedEntry()
      }
      if (id === RESOLVED_VIRTUAL_SERVER_ID) {
        if (state.kind !== 'page') return undefined
        if (state.resolvedConfig?.command === 'serve') {
          const ssrIndexPath = pathToFileURL(_require.resolve('@lit-labs/ssr')).href
          const ssrRenderResultPath = pathToFileURL(_require.resolve('@lit-labs/ssr/lib/render-result.js')).href
          const { generateDevServerEntry } = await import('../virtual/server-entry.js')
          return generateDevServerEntry(state.pages, ssrIndexPath, ssrRenderResultPath)
        }
        const { generateServerEntry } = await import('../virtual/server-entry.js')
        return generateServerEntry(state.pages)
      }
      if (id.startsWith(RESOLVED_VIRTUAL_PAGE_PREFIX)) {
        if (state.kind !== 'page') return undefined
        const pageName = id.slice(RESOLVED_VIRTUAL_PAGE_PREFIX.length)
        const page = state.pages.find((entry) => entry.slug === pageName)
        if (!page) {
          throw new Error(
            `[vite-plugin-lit-ssg] No page found for virtual module: ${id}. Available pages: ${state.pages.map((entry) => entry.importPath).join(', ')}`,
          )
        }
        const { generatePageEntry } = await import('../virtual/client-entry.js')
        return generatePageEntry(page)
      }
      if (id.startsWith(RESOLVED_VIRTUAL_DEV_PAGE_PREFIX)) {
        if (state.kind !== 'page') return undefined
        const pageName = id.slice(RESOLVED_VIRTUAL_DEV_PAGE_PREFIX.length)
        const page = state.pages.find((entry) => {
          const routeName = entry.route === '/' ? 'index' : entry.route.slice(1)
          return routeName === pageName
        })
        if (!page) {
          throw new Error(
            `[vite-plugin-lit-ssg] No dev page found for: ${id}. Available pages: ${state.pages.map((entry) => entry.route).join(', ')}`,
          )
        }
        return `import '@lit-labs/ssr-client/lit-element-hydrate-support.js'
import route from '${page.importPath}'
if (route.title) document.title = route.title
const tag = customElements.getName(route.component)
if (tag) {
  const el = document.createElement(tag)
  document.body.appendChild(el)
}
`
      }
      return undefined
    },
  }

  pluginState.set(plugin, state)

  return plugin
}

export function getSSGOptions(plugin: object): ScanPagesOptions | undefined {
  const state = pluginState.get(plugin)
  if (!state || state.kind !== 'page') return undefined
  return state.scanOptions
}

export function getPageInjectPolyfill(plugin: object): boolean {
  const state = pluginState.get(plugin)
  if (!state || state.kind !== 'page') return true
  return state.injectPolyfill
}

export function getSingleComponentOptions(plugin: object): ResolvedSingleComponentOptions | undefined {
  const state = pluginState.get(plugin)
  if (!state || state.kind !== 'single-component') return undefined
  return state.resolved
}

export {
  _ssgActive,
  PLUGIN_NAME,
  VIRTUAL_PAGE_PREFIX,
  VIRTUAL_SHARED_ID,
  VIRTUAL_SINGLE_CLIENT_ID,
  VIRTUAL_SINGLE_SERVER_ID,
}
export type { ScanPagesOptions }
