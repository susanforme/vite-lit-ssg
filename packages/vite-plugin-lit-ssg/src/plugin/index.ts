import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve, relative, isAbsolute } from 'node:path'
import MagicString from 'magic-string'
import * as ts from 'typescript'
import type { Plugin, ResolvedConfig, UserConfig, ViteDevServer } from 'vite'
import type { CommonStylesOptions, LitSSGOptionsNew, ResolvedSingleComponentOptions } from '../types'
import { resolveSingleComponentOptions } from '../types'
import type { PageEntry, ScanPagesOptions } from '../scanner/pages'
import {
  _ssgActive,
  PLUGIN_NAME,
  RESOLVED_VIRTUAL_DEV_PAGE_PREFIX,
  RESOLVED_VIRTUAL_PAGE_PREFIX,
  RESOLVED_VIRTUAL_SERVER_ID,
  RESOLVED_VIRTUAL_SHARED_ID,
  RESOLVED_VIRTUAL_SINGLE_CLIENT_ID,
  RESOLVED_VIRTUAL_SINGLE_DEV_ID,
  RESOLVED_VIRTUAL_SINGLE_ISLAND_RUNTIME_ID,
  RESOLVED_VIRTUAL_SINGLE_SERVER_ID,
  VIRTUAL_DEV_PAGE_PREFIX,
  VIRTUAL_PAGE_PREFIX,
  VIRTUAL_SERVER_ID,
  VIRTUAL_SHARED_ID,
  VIRTUAL_SINGLE_CLIENT_ID,
  VIRTUAL_SINGLE_DEV_ID,
  VIRTUAL_SINGLE_ISLAND_RUNTIME_ID,
  VIRTUAL_SINGLE_SERVER_ID,
} from './constants'
import {
  collectLitSourceCompressionDependencySpecifiers,
  classifyLitSourceCompressionTargets,
  createLitSourceCompressionSourceFile,
  minifyLitSourceCompressionTarget,
} from './lit-source-compression'

function resolveCurrentPackageRoot(): string {
  let currentDir = dirname(fileURLToPath(import.meta.url))

  while (true) {
    const packageJsonPath = join(currentDir, 'package.json')
    if (existsSync(packageJsonPath)) return currentDir

    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) break
    currentDir = parentDir
  }

  throw new Error(`[vite-plugin-lit-ssg] Could not resolve package root from ${import.meta.url}.`)
}

function resolvePackageInternalModulePath(sourceRelativePath: string, distRelativePath: string): string {
  const packageRoot = resolveCurrentPackageRoot()
  const candidates = [
    join(packageRoot, distRelativePath),
    join(packageRoot, sourceRelativePath),
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }

  throw new Error(
    `[vite-plugin-lit-ssg] Could not resolve internal module. Tried: ${candidates.join(', ')}`,
  )
}

function resolveInstalledPackageDir(packageName: string): string {
  let currentDir = dirname(fileURLToPath(import.meta.url))

  while (true) {
    const candidate = join(currentDir, 'node_modules', packageName)
    if (existsSync(candidate)) return candidate

    const pnpmDir = join(currentDir, 'node_modules', '.pnpm')
    if (existsSync(pnpmDir)) {
      for (const entry of readdirSync(pnpmDir)) {
        const pnpmCandidate = join(pnpmDir, entry, 'node_modules', packageName)
        if (existsSync(pnpmCandidate)) return pnpmCandidate
      }
    }

    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) break
    currentDir = parentDir
  }

  throw new Error(`[vite-plugin-lit-ssg] Could not resolve installed package "${packageName}" from ${import.meta.url}.`)
}

function resolveSiblingPackageFilePath(
  fromPackageName: string,
  siblingPackageName: string,
  siblingSubpath: string,
): string {
  const fromPackageDir = resolveInstalledPackageDir(fromPackageName)

  const getNodeModulesDir = (packageDir: string): string => {
    return fromPackageName.startsWith('@')
      ? dirname(dirname(packageDir))
      : dirname(packageDir)
  }

  const candidates = [
    join(getNodeModulesDir(fromPackageDir), siblingPackageName, siblingSubpath),
    join(getNodeModulesDir(realpathSync(fromPackageDir)), siblingPackageName, siblingSubpath),
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }

  throw new Error(
    `[vite-plugin-lit-ssg] Could not resolve sibling package file for ${fromPackageName} -> ${siblingPackageName}/${siblingSubpath}. Tried: ${candidates.join(', ')}`,
  )
}

function resolveConsumerModulePath(specifier: string, importer: string | undefined, root: string | undefined): string | undefined {
  if (importer) {
    try {
      return createRequire(importer).resolve(specifier)
    } catch (_error) {
      // Fall through to root-based resolution.
    }
  }

  if (!root) return undefined

  try {
    return createRequire(join(root, 'package.json')).resolve(specifier)
  } catch (_error) {
    return undefined
  }
}

function resolveConsumerModuleUrl(specifier: string, importer: string | undefined, root: string | undefined): string | undefined {
  const resolvedPath = resolveConsumerModulePath(specifier, importer, root)
  return resolvedPath ? pathToFileURL(resolvedPath).href : undefined
}

function resolveConsumerPluginPackageJsonPath(root: string | undefined): string | undefined {
  return resolveConsumerModulePath('vite-plugin-lit-ssg/package.json', undefined, root)
    ?? resolveConsumerModulePath('@cherrywind/vite-plugin-lit-ssg/package.json', undefined, root)
}

function resolveConsumerPluginInternalModulePath(
  root: string | undefined,
  sourceRelativePath: string,
  distRelativePath: string,
): string | undefined {
  const packageJsonPath = resolveConsumerPluginPackageJsonPath(root)
  if (!packageJsonPath) return undefined

  const packageRoot = dirname(packageJsonPath)
  const candidates = [
    join(packageRoot, distRelativePath),
    join(packageRoot, sourceRelativePath),
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }

  return undefined
}

function getHydrationImporterPackage(importer: string | undefined): 'lit' | 'lit-element' | '@lit-labs/ssr-client' | undefined {
  if (!importer) return undefined
  if (importer.includes('/@lit-labs/ssr-client/')) return '@lit-labs/ssr-client'
  if (importer.includes('/node_modules/lit-element/')) return 'lit-element'
  if (importer.includes('/node_modules/lit/')) return 'lit'
  return undefined
}

function resolveHydrationDependency(id: string, importer: string | undefined): string | undefined {
  const importerPackage = getHydrationImporterPackage(importer)
  if (!importerPackage || !importer) return undefined

  const resolvePackageSubpathFromImporter = (packageName: string, subpath: string): string | undefined => {
    try {
      const resolvedEntry = createRequire(importer).resolve(packageName)
      let currentDir = dirname(resolvedEntry)

      while (true) {
        const packageJsonPath = join(currentDir, 'package.json')
        if (existsSync(packageJsonPath)) {
          const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as { name?: string }
          if (packageJson.name === packageName) {
            return join(currentDir, subpath)
          }
        }

        const parentDir = dirname(currentDir)
        if (parentDir === currentDir) break
        currentDir = parentDir
      }
    } catch (_error) {
      return undefined
    }

    return undefined
  }

  if (id === 'lit-html') {
    return resolvePackageSubpathFromImporter('lit-html', 'lit-html.js')
      ?? resolveSiblingPackageFilePath(importerPackage, 'lit-html', 'lit-html.js')
  }

  if (id.startsWith('lit-html/')) {
    return resolvePackageSubpathFromImporter('lit-html', id.slice('lit-html/'.length))
      ?? resolveSiblingPackageFilePath(importerPackage, 'lit-html', id.slice('lit-html/'.length))
  }

  if (importerPackage === 'lit' || importerPackage === 'lit-element') {
    const litDependencyAnchor = 'lit'

    if (id === '@lit/reactive-element') {
      return resolvePackageSubpathFromImporter('@lit/reactive-element', 'reactive-element.js')
        ?? resolveSiblingPackageFilePath(litDependencyAnchor, '@lit/reactive-element', 'reactive-element.js')
    }

    if (id.startsWith('@lit/reactive-element/')) {
      return resolvePackageSubpathFromImporter('@lit/reactive-element', id.slice('@lit/reactive-element/'.length))
        ?? resolveSiblingPackageFilePath(litDependencyAnchor, '@lit/reactive-element', id.slice('@lit/reactive-element/'.length))
    }

    if (id.startsWith('lit-element/')) {
      return resolvePackageSubpathFromImporter('lit-element', id.slice('lit-element/'.length))
        ?? resolveSiblingPackageFilePath(litDependencyAnchor, 'lit-element', id.slice('lit-element/'.length))
    }
  }

  return undefined
}


function splitPackageSpecifier(specifier: string): { packageName: string, packageSubpath: string } {
  const segments = specifier.split('/').filter(Boolean)
  if (segments.length === 0) {
    throw new Error('[vite-plugin-lit-ssg] Package specifier must not be empty.')
  }

  if (specifier.startsWith('@')) {
    const [scope, name, ...rest] = segments
    if (!scope || !name) {
      throw new Error(`[vite-plugin-lit-ssg] Invalid scoped package specifier: ${specifier}`)
    }
    return {
      packageName: `${scope}/${name}`,
      packageSubpath: rest.join('/'),
    }
  }

  const [name, ...rest] = segments
  return {
    packageName: name!,
    packageSubpath: rest.join('/'),
  }
}

function resolvePackageFilePath(specifier: string): string {
  const { packageName, packageSubpath } = splitPackageSpecifier(specifier)
  const packageDir = resolveInstalledPackageDir(packageName)

  if (packageSubpath) {
    return join(packageDir, packageSubpath)
  }

  const packageJsonPath = join(packageDir, 'package.json')
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as {
    module?: string
    main?: string
  }
  const entryFile = packageJson.module ?? packageJson.main ?? 'index.js'
  return join(packageDir, entryFile)
}

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
  sourceCompressionTargets: Set<string>
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

const PLUGIN_STATE_KEY = '__vitePluginLitSsgState'

type PluginWithState = Plugin & {
  [PLUGIN_STATE_KEY]?: PluginState
}

function getStoredPluginState(plugin: object): PluginState | undefined {
  if (typeof plugin !== 'object' || plugin === null) return undefined
  return (plugin as PluginWithState)[PLUGIN_STATE_KEY]
}

function normalizeFileId(id: string): string {
  const queryIdx = id.indexOf('?')
  const hashIdx = id.indexOf('#')
  const sliceIdx = [queryIdx, hashIdx].filter((idx) => idx >= 0).sort((a, b) => a - b)[0]
  const clean = sliceIdx == null ? id : id.slice(0, sliceIdx)
  return clean.replace(/\\/g, '/')
}

function normalizeServeBase(base: string | undefined): string {
  const value = base ?? '/'
  if (value === '' || value === '/' || value === '.' || value === './') return '/'
  if (value.startsWith('/')) return value
  return `/${value.replace(/^\.\/?/, '')}`
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
  state.sourceCompressionTargets.clear()
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

function shouldQueueSourceCompressionDependency(moduleSpecifier: string): boolean {
  return moduleSpecifier.startsWith('.') || moduleSpecifier.startsWith('/')
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

interface LitSourceCompressionRewrite {
  key: string
  replacementText: string
  start: number
  end: number
}

function getLitSourceCompressionRewriteKey(start: number, end: number): string {
  return `${start}:${end}`
}

function getExpressionRewriteKey(expression: ts.Expression, sourceFile: ts.SourceFile): string {
  return getLitSourceCompressionRewriteKey(expression.getStart(sourceFile), expression.getEnd())
}

async function collectLitSourceCompressionRewrites(
  fileName: string,
  sourceFile: ts.SourceFile,
): Promise<LitSourceCompressionRewrite[]> {
  const { replacementTargets } = classifyLitSourceCompressionTargets(sourceFile)
  const rewrites: LitSourceCompressionRewrite[] = []

  for (const target of replacementTargets) {
    const result = await minifyLitSourceCompressionTarget({
      fileName,
      kind: target.kind,
      tagName: target.tagName,
      text: target.text,
    })

    if (!result.changed) continue

    rewrites.push({
      key: getLitSourceCompressionRewriteKey(target.expressionRange.start, target.expressionRange.end),
      replacementText: `${target.tagName}\`${result.text}\``,
      start: target.expressionRange.start,
      end: target.expressionRange.end,
    })
  }

  return rewrites
}

function prependCommonStylesWithOptionalRewrite(
  expression: ts.Expression,
  sourceFile: ts.SourceFile,
  replacementText?: string,
): string {
  if (ts.isArrayLiteralExpression(expression)) {
    const elements = expression.elements.map((element) => element.getText(sourceFile))
    return elements.length === 0
      ? `[...${COMMON_STYLES_IDENTIFIER}]`
      : `[...${COMMON_STYLES_IDENTIFIER}, ${elements.join(', ')}]`
  }

  return `[...${COMMON_STYLES_IDENTIFIER}, ${replacementText ?? expression.getText(sourceFile)}]`
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
  compressionRewrites: Map<string, string>,
  consumedCompressionRewriteKeys: Set<string>,
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

    const rewriteKey = getExpressionRewriteKey(stylesMember.initializer, sourceFile)
    const replacementText = compressionRewrites.get(rewriteKey)
    if (replacementText) consumedCompressionRewriteKeys.add(rewriteKey)

    magicString.overwrite(
      stylesMember.initializer.getStart(sourceFile),
      stylesMember.initializer.getEnd(),
      prependCommonStylesWithOptionalRewrite(stylesMember.initializer, sourceFile, replacementText),
    )
    return
  }

  const body = stylesMember.body
  const statement = body?.statements.length === 1 ? body.statements[0] : undefined
  if (!statement || !ts.isReturnStatement(statement) || !statement.expression) {
    throw new Error('[vite-plugin-lit-ssg] commonStyles only supports static get styles() getters with a single return statement.')
  }

  const rewriteKey = getExpressionRewriteKey(statement.expression, sourceFile)
  const replacementText = compressionRewrites.get(rewriteKey)
  if (replacementText) consumedCompressionRewriteKeys.add(rewriteKey)

  magicString.overwrite(
    statement.expression.getStart(sourceFile),
    statement.expression.getEnd(),
    prependCommonStylesWithOptionalRewrite(statement.expression, sourceFile, replacementText),
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
  compressionRewrites: LitSourceCompressionRewrite[] = [],
): { code: string, map: ReturnType<MagicString['generateMap']> } | null {
  if (targetClassNames.size === 0 && compressionRewrites.length === 0) return null

  const classes = collectClassDeclarations(sourceFile)
  const litElementNames = collectLitElementImportNames(sourceFile)
  const magicString = new MagicString(code, { filename: cleanId })
  const compressionRewriteMap = new Map(compressionRewrites.map((rewrite) => [rewrite.key, rewrite.replacementText]))
  const consumedCompressionRewriteKeys = new Set<string>()

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

    rewriteTargetClass(
      magicString,
      code,
      sourceFile,
      classDecl,
      compressionRewriteMap,
      consumedCompressionRewriteKeys,
    )
  }

  for (const rewrite of [...compressionRewrites].reverse()) {
    if (consumedCompressionRewriteKeys.has(rewrite.key)) continue
    magicString.overwrite(rewrite.start, rewrite.end, rewrite.replacementText)
  }

  if (targetClassNames.size > 0) {
    insertCommonStylesHelper(magicString, sourceFile, commonStylesImports)
  }

  const rewrittenCode = magicString.toString()
  if (rewrittenCode === code) return null

  return {
    code: rewrittenCode,
    map: magicString.generateMap({
      source: cleanId,
      includeContent: true,
      hires: true,
    }),
  }
}

async function rewriteModuleWithPageSourceCompression(
  code: string,
  cleanId: string,
  sourceFile: ts.SourceFile,
): Promise<{ code: string, map: ReturnType<MagicString['generateMap']> } | null> {
  const compressionRewrites = await collectLitSourceCompressionRewrites(cleanId, sourceFile)

  if (compressionRewrites.length === 0) return null

  const magicString = new MagicString(code, { filename: cleanId })

  for (const rewrite of [...compressionRewrites].reverse()) {
    magicString.overwrite(rewrite.start, rewrite.end, rewrite.replacementText)
  }

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

async function queueSourceCompressionDependencies(
  context: { resolve: (source: string, importer?: string, options?: { skipSelf?: boolean }) => Promise<{ id: string } | null> },
  targetSet: Set<string>,
  sourceFile: ts.SourceFile,
  importerId: string,
): Promise<void> {
  const moduleSpecifiers = collectLitSourceCompressionDependencySpecifiers(sourceFile)

  for (const moduleSpecifier of moduleSpecifiers) {
    if (!shouldQueueSourceCompressionDependency(moduleSpecifier)) continue

    const resolved = await context.resolve(moduleSpecifier, importerId, { skipSelf: true })
    const resolvedId = resolved?.id ? normalizeFileId(resolved.id) : null
    if (!resolvedId || resolvedId === importerId || !shouldHandleModule(resolvedId)) continue

    targetSet.add(resolvedId)
  }
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
  const litDedupePackages = [
    'lit',
    'lit-html',
    'lit-element',
    '@lit/reactive-element',
  ]

  let state: PluginState

  if (options.mode === 'single-component') {
      state = {
        kind: 'single-component',
        resolved: resolveSingleComponentOptions(options),
        resolvedConfig: null,
        entryModuleId: null,
        commonStyles: options.commonStyles ?? [],
        sourceCompressionTargets: new Set(),
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
        sourceCompressionTargets: new Set(),
        transformTargets: new Map(),
      }
    }

  const plugin: PluginWithState = {
    name: PLUGIN_NAME,
    enforce: 'pre',

    config(_userConfig: UserConfig) {
      return {
        build: {
          manifest: true,
        },
        resolve: {
          dedupe: litDedupePackages,
        },
        esbuild: {
          tsconfigRaw: {
            compilerOptions: {
              experimentalDecorators: true,
            },
          },
        },
      }
    },

    configResolved(config) {
      state.resolvedConfig = config
      state.sourceCompressionTargets.clear()
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
          input: {
            'lit-ssg-single': VIRTUAL_SINGLE_CLIENT_ID,
            'lit-ssg-single-island-runtime': VIRTUAL_SINGLE_ISLAND_RUNTIME_ID,
          },
        }
      }

      const { scanPages } = await import('../scanner/pages')
      const { buildPageInputs } = await import('../runner/build')
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
        const { scanPages } = await import('../scanner/pages')
        const root = state.resolvedConfig?.root ?? process.cwd()
        state.pages = await scanPages(root, state.scanOptions)
        syncPageTargets(state)
      }
    },

    async writeBundle() {
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
        const { runSingleSSRRender } = await import('../runner/ssr-render')
        await runSingleSSRRender(state.resolved, projectRoot, base, outDir, ctx)
        console.log('[vite-lit-ssg] Done!')
        return
      }

      if (state.kind === 'page') {
        const { buildPageInputs } = await import('../runner/build')
        const { runSSRRender } = await import('../runner/ssr-render')
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

          const base = normalizeServeBase(server.config.base)
          const isRootBase = base === '/'
          const normalizedBase = base.endsWith('/') ? base : base + '/'
          const isRoot = isRootBase
            ? pathname === '/'
            : pathname === base.replace(/\/$/, '') || pathname === normalizedBase
          if (!isRoot) return next()

          const hydrateScriptSrc = `${normalizedBase}@id/__x00__${VIRTUAL_SINGLE_CLIENT_ID}`
          const islandRuntimeSrc = `${normalizedBase}@id/__x00__${VIRTUAL_SINGLE_ISLAND_RUNTIME_ID}`
          const viteClientSrc = `${normalizedBase}@vite/client`
          const wrapperTag = typeof resolved.wrapperTag === 'function' ? resolved.wrapperTag() : resolved.wrapperTag

          try {
            const { renderDevSingleComponent } = await import('../runner/dev-ssr')
            const fragment = await renderDevSingleComponent(
                server,
                wrapperTag,
                hydrateScriptSrc,
                islandRuntimeSrc,
                resolved.injectPolyfill,
                resolved.dsdPendingStyle,
              )
            const htmlShell = `<!DOCTYPE html>\n<html>\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <script type="module" src="${viteClientSrc}"></script>\n    <title>Dev</title>\n  </head>\n  <body>\n${fragment}\n  </body>\n</html>`
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.statusCode = 200
            res.end(htmlShell)
          } catch (e) {
            const errMsg = e instanceof Error ? e.message : String(e)
            server.config.logger.error(
              `[vite-plugin-lit-ssg] SSR dev render failed, serving error page: ${errMsg}`,
            )
            const safeMsg = errMsg.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            const errHtml = `<!DOCTYPE html>\n<html>\n  <head><meta charset="UTF-8"><title>SSR Error</title></head>\n  <body><h1>[vite-plugin-lit-ssg] SSR render failed</h1><pre>${safeMsg}</pre></body>\n</html>`
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.statusCode = 500
            res.end(errHtml)
          }
        })
        return
      }

      const root = server.config.root ?? process.cwd()
      const absolutePagesDir = resolve(root, state.pagesDir)

      const seedPages = async () => {
        if (state.kind === 'page' && state.pages.length === 0) {
          const { scanPages } = await import('../scanner/pages')
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
        const { scanPages } = await import('../scanner/pages')
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
          const { scanPages } = await import('../scanner/pages')
          const resolvedRoot = state.resolvedConfig?.root ?? process.cwd()
          state.pages = await scanPages(resolvedRoot, state.scanOptions)
          syncPageTargets(state)
        }

        const base = normalizeServeBase(state.resolvedConfig?.base)
        const normalizedBase = base.endsWith('/') ? base : base + '/'
        let routePath: string
        if (base === '/') {
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

          const homeHref = base === '/' ? '/' : base

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
          const { renderDevPage } = await import('../runner/dev-ssr')
          const ssrHtml = await renderDevPage(server, matchedPage.route, hydrateScriptSrc, injectPolyfill)
          const transformed = await server.transformIndexHtml(rawUrl, ssrHtml)
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.statusCode = 200
          res.end(transformed)
        } catch (e) {
            const errMsg = e instanceof Error ? e.message : String(e)
            server.config.logger.error(
              `[vite-plugin-lit-ssg] SSR dev render failed for ${matchedPage.route}: ${errMsg}`,
            )
            const safeMsg = errMsg.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            const errHtml = `<!DOCTYPE html>\n<html>\n  <head><meta charset="UTF-8"><title>SSR Error</title></head>\n  <body><h1>[vite-plugin-lit-ssg] SSR render failed for ${matchedPage.route}</h1><pre>${safeMsg}</pre></body>\n</html>`
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.statusCode = 500
            res.end(errHtml)
          }
      })
    },

    async transform(code, id, options) {
      const cleanId = normalizeFileId(id)
      if (!shouldHandleModule(cleanId)) return null
      if (id.includes('?inline')) return null

      const root = state.resolvedConfig?.root ?? process.cwd()
      const commonStyleImports = resolveCommonStylesImports(root, state.commonStyles)
      const isSingleComponentSsrRequest = state.kind === 'single-component' && id.includes('?lit-ssg-ssr')
      const queuedTargets = state.transformTargets.get(cleanId) ?? []
      const isPageModule = state.kind === 'page' && state.pageModuleIds.has(cleanId)
      const isSingleEntry = state.kind === 'single-component' && state.entryModuleId === cleanId
      const isSourceCompressionTarget = state.kind === 'single-component'
        && state.sourceCompressionTargets.has(cleanId)

      const shouldApplyCommonStyles = commonStyleImports.length > 0
        && !code.includes(`const ${COMMON_STYLES_IDENTIFIER} =`)
        && (isPageModule || isSingleEntry || queuedTargets.length > 0)
      const shouldApplySourceCompression = !isSingleComponentSsrRequest && (state.kind === 'page'
        || isSingleEntry
        || isSourceCompressionTarget
        || queuedTargets.length > 0)

      if (!shouldApplyCommonStyles && !shouldApplySourceCompression) {
        return null
      }

      let transformedCode = code
      let commonStylesResult: ReturnType<typeof rewriteModuleWithCommonStyles> | null = null
      let compressionRewrites: LitSourceCompressionRewrite[] = []
      const sourceFile = createSourceFile(cleanId, transformedCode)

      if (state.kind === 'single-component' && (isSingleEntry || isSourceCompressionTarget)) {
        await queueSourceCompressionDependencies(this, state.sourceCompressionTargets, sourceFile, cleanId)
      }

      if (shouldApplyCommonStyles) {
        const localTargets = new Set<string>()

        if (shouldApplySourceCompression) {
          compressionRewrites = await collectLitSourceCompressionRewrites(cleanId, sourceFile)
        }

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

        commonStylesResult = rewriteModuleWithCommonStyles(
          transformedCode,
          sourceFile,
          cleanId,
          commonStyleImports,
          localTargets,
          compressionRewrites,
        )

        if (commonStylesResult) {
          transformedCode = commonStylesResult.code
        }
      }

      if (!shouldApplySourceCompression) {
        return commonStylesResult
      }

      const compressionSourceFile = createLitSourceCompressionSourceFile(cleanId, transformedCode)
      const compressionResult = await rewriteModuleWithPageSourceCompression(
        transformedCode,
        cleanId,
        compressionSourceFile,
      )

      if (compressionResult) return compressionResult

      return commonStylesResult
    },

    resolveId(id, importer) {
      if (id === 'lit-element/private-ssr-support.js') {
        if (state.resolvedConfig?.command === 'serve') {
          const consumerPluginPackageJsonPath = resolveConsumerPluginPackageJsonPath(state.resolvedConfig.root)
          return resolveConsumerModulePath(
            'lit-element/development/private-ssr-support.js',
            importer,
            state.resolvedConfig.root,
          ) ?? resolveConsumerModulePath(
            'lit-element/development/private-ssr-support.js',
            consumerPluginPackageJsonPath,
            state.resolvedConfig.root,
          ) ?? resolvePackageFilePath('lit-element/development/private-ssr-support.js')
        }

        return resolvePackageFilePath(id)
      }

      if (state.resolvedConfig?.command === 'build') {
        const resolvedHydrationDependency = resolveHydrationDependency(id, importer)
        if (resolvedHydrationDependency) return resolvedHydrationDependency
      }

      if (state.kind === 'single-component') {
        if (id === VIRTUAL_SINGLE_CLIENT_ID) return RESOLVED_VIRTUAL_SINGLE_CLIENT_ID
        if (id === VIRTUAL_SINGLE_ISLAND_RUNTIME_ID) return RESOLVED_VIRTUAL_SINGLE_ISLAND_RUNTIME_ID
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
      const consumerPluginPackageJsonPath = resolveConsumerPluginPackageJsonPath(state.resolvedConfig?.root)
      const browserHydratePath = resolvePackageInternalModulePath(
        'src/runtime/hydrate-support-proxy.ts',
        'dist/runtime/hydrate-support-proxy.js',
      )
      const browserSingleIslandRuntimePath = resolvePackageInternalModulePath(
        'src/runtime/single-island-runtime.ts',
        'dist/runtime/single-island-runtime.js',
      )
      const consumerBrowserHydratePath = resolveConsumerPluginInternalModulePath(
        state.resolvedConfig?.root,
        'src/runtime/hydrate-support-proxy.ts',
        'dist/runtime/hydrate-support-proxy.js',
      )
      const consumerBrowserSingleIslandRuntimePath = resolveConsumerPluginInternalModulePath(
        state.resolvedConfig?.root,
        'src/runtime/single-island-runtime.ts',
        'dist/runtime/single-island-runtime.js',
      )
      const consumerSsrIndexUrl = resolveConsumerModuleUrl(
        '@lit-labs/ssr',
        consumerPluginPackageJsonPath,
        state.resolvedConfig?.root,
      )
      const consumerSsrRenderResultUrl = resolveConsumerModuleUrl(
        '@lit-labs/ssr/lib/render-result.js',
        consumerPluginPackageJsonPath,
        state.resolvedConfig?.root,
      )

      if (id === RESOLVED_VIRTUAL_SINGLE_CLIENT_ID) {
        if (state.kind !== 'single-component') return undefined
        const { generateSingleClientEntry } = await import('../virtual/single-client-entry')
        return state.resolvedConfig?.command === 'serve'
          ? generateSingleClientEntry(state.resolved, consumerBrowserHydratePath ?? browserHydratePath)
          : generateSingleClientEntry(state.resolved, browserHydratePath)
      }
      if (id === RESOLVED_VIRTUAL_SINGLE_ISLAND_RUNTIME_ID) {
        if (state.kind !== 'single-component') return undefined
        const singleIslandRuntimePath = state.resolvedConfig?.command === 'serve'
          ? (consumerBrowserSingleIslandRuntimePath ?? browserSingleIslandRuntimePath)
          : browserSingleIslandRuntimePath
        return `import ${JSON.stringify(singleIslandRuntimePath)}\n`
      }
        if (id === RESOLVED_VIRTUAL_SINGLE_SERVER_ID) {
          if (state.kind !== 'single-component') return undefined
          if (state.resolvedConfig?.command === 'serve') {
            const { generateDevSingleServerEntry } = await import('../virtual/single-server-entry')
            return generateDevSingleServerEntry(
              state.resolved,
              consumerSsrIndexUrl ?? pathToFileURL(resolvePackageFilePath('@lit-labs/ssr')).href,
              consumerSsrRenderResultUrl ?? pathToFileURL(resolvePackageFilePath('@lit-labs/ssr/lib/render-result.js')).href,
            )
          }
          const { generateSingleServerEntry } = await import('../virtual/single-server-entry')
          return generateSingleServerEntry(state.resolved)
        }
      if (id === RESOLVED_VIRTUAL_SINGLE_DEV_ID) {
        if (state.kind !== 'single-component') return undefined
        const { generateSingleDevEntry } = await import('../virtual/single-client-entry')
        return state.resolvedConfig?.command === 'serve'
          ? generateSingleDevEntry(state.resolved, consumerBrowserHydratePath ?? browserHydratePath)
          : generateSingleDevEntry(state.resolved, browserHydratePath)
      }
      if (id === RESOLVED_VIRTUAL_SHARED_ID) {
        const { generateSharedEntry } = await import('../virtual/client-entry')
        return state.resolvedConfig?.command === 'serve'
          ? generateSharedEntry(consumerBrowserHydratePath ?? browserHydratePath)
          : generateSharedEntry(browserHydratePath)
      }
        if (id === RESOLVED_VIRTUAL_SERVER_ID) {
          if (state.kind !== 'page') return undefined
          if (state.resolvedConfig?.command === 'serve') {
            const { generateDevServerEntry } = await import('../virtual/server-entry')
            return generateDevServerEntry(
              state.pages,
              consumerSsrIndexUrl ?? pathToFileURL(resolvePackageFilePath('@lit-labs/ssr')).href,
              consumerSsrRenderResultUrl ?? pathToFileURL(resolvePackageFilePath('@lit-labs/ssr/lib/render-result.js')).href,
            )
          }
        const { generateServerEntry } = await import('../virtual/server-entry')
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
        const { generatePageEntry } = await import('../virtual/client-entry')
        return state.resolvedConfig?.command === 'serve'
          ? generatePageEntry(page, consumerBrowserHydratePath ?? browserHydratePath)
          : generatePageEntry(page, browserHydratePath)
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
        const hydrateSupportPath = state.resolvedConfig?.command === 'serve'
          ? (consumerBrowserHydratePath ?? browserHydratePath)
          : browserHydratePath
        return `import ${JSON.stringify(hydrateSupportPath)}
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

  Object.defineProperty(plugin, PLUGIN_STATE_KEY, {
    value: state,
    enumerable: false,
  })

  return plugin
}

export function getSSGOptions(plugin: object): ScanPagesOptions | undefined {
  const state = getStoredPluginState(plugin)
  if (!state || state.kind !== 'page') return undefined
  return state.scanOptions
}

export function getPageInjectPolyfill(plugin: object): boolean {
  const state = getStoredPluginState(plugin)
  if (!state || state.kind !== 'page') return true
  return state.injectPolyfill
}

export function getSingleComponentOptions(plugin: object): ResolvedSingleComponentOptions | undefined {
  const state = getStoredPluginState(plugin)
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
