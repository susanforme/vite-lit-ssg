import { minifyHTMLLiterals } from '@literals/html-css-minifier'
import MagicString from 'magic-string'
import * as ts from 'typescript'

export const LIT_SOURCE_COMPRESSION_RAW_TEXT_SKIP_TAGS = [
  'pre',
  'textarea',
  'script',
  'style',
  'title',
  'svg',
] as const

export type LitSourceCompressionRawTextSkipTag = typeof LIT_SOURCE_COMPRESSION_RAW_TEXT_SKIP_TAGS[number]

export type LitSourceCompressionTargetKind =
  | 'css-field'
  | 'css-getter'
  | 'html-render-static'
  | 'html-render-dynamic'

export type LitSourceCompressionSkipCategory =
  | 'unsupported-non-direct-lit-tag'
  | 'unsupported-css-interpolation'
  | 'raw-text-or-whitespace-sensitive-tag'
  | 'minifier-no-change'

export type LitSourceCompressionSkipReason =
  | 'unsupported-non-direct-lit-tag'
  | 'unsupported-css-interpolation'
  | 'minifier-no-change'
  | `raw-text-or-whitespace-sensitive-tag:${LitSourceCompressionRawTextSkipTag}`

export type LitSourceCompressionClassifierUnsupportedReason =
  | 'unsupported-aliased-lit-tag'
  | 'unsupported-array-styles'
  | 'unsupported-complex-getter'
  | 'unsupported-helper-returned-template'
  | 'unsupported-identifier-indirection'
  | 'unsupported-non-component-tagged-template'
  | 'unsupported-non-direct-lit-tag'
  | 'unsupported-svg-template'

export interface LitSourceCompressionRange {
  start: number
  end: number
}

export interface LitSourceCompressionReplacementTarget {
  className: string
  expressionRange: LitSourceCompressionRange
  kind: LitSourceCompressionTargetKind
  memberKind: 'getter' | 'method' | 'property'
  memberName: 'render' | 'styles'
  tagName: 'css' | 'html'
  tagRange: LitSourceCompressionRange
  templateRange: LitSourceCompressionRange
  text: string
}

export interface LitSourceCompressionUnchangedTarget {
  className?: string
  expressionRange: LitSourceCompressionRange
  memberKind?: 'getter' | 'method' | 'property'
  memberName?: string
  reason: LitSourceCompressionClassifierUnsupportedReason
  tagName?: string
  tagRange?: LitSourceCompressionRange
  templateRange?: LitSourceCompressionRange
}

export interface LitSourceCompressionClassification {
  replacementTargets: LitSourceCompressionReplacementTarget[]
  unchangedTargets: LitSourceCompressionUnchangedTarget[]
}

export function collectLitSourceCompressionDependencySpecifiers(sourceFile: ts.SourceFile): string[] {
  const specifiers = new Set<string>()

  for (const statement of sourceFile.statements) {
    if ((ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement))
      && statement.moduleSpecifier
      && ts.isStringLiteral(statement.moduleSpecifier)) {
      specifiers.add(statement.moduleSpecifier.text)
    }
  }

  return [...specifiers]
}

interface LitSourceCompressionReplacementContext {
  className: string
  memberKind: 'getter' | 'method' | 'property'
  memberName: 'render' | 'styles'
}

interface LitSourceCompressionPolicy {
  expectedTagName: 'css' | 'html'
  supportsExpressions: boolean
  syntheticPrefix: string
  syntheticSuffix: string
}

export const LIT_SOURCE_COMPRESSION_SUPPORT_MATRIX = {
  'css-field': {
    expectedTagName: 'css',
    supportsExpressions: false,
    syntheticPrefix: 'class __LitSourceCompressionTarget extends HTMLElement { static styles = ',
    syntheticSuffix: ' }',
  },
  'css-getter': {
    expectedTagName: 'css',
    supportsExpressions: false,
    syntheticPrefix: 'class __LitSourceCompressionTarget extends HTMLElement { static get styles() { return ',
    syntheticSuffix: ' } }',
  },
  'html-render-static': {
    expectedTagName: 'html',
    supportsExpressions: false,
    syntheticPrefix: 'class __LitSourceCompressionTarget extends HTMLElement { render() { return ',
    syntheticSuffix: ' } }',
  },
  'html-render-dynamic': {
    expectedTagName: 'html',
    supportsExpressions: true,
    syntheticPrefix: 'class __LitSourceCompressionTarget extends HTMLElement { render() { return ',
    syntheticSuffix: ' } }',
  },
} as const satisfies Record<LitSourceCompressionTargetKind, LitSourceCompressionPolicy>

export const LIT_SOURCE_COMPRESSION_SKIP_MATRIX = {
  'css-field': [
    'unsupported-non-direct-lit-tag',
    'unsupported-css-interpolation',
    'minifier-no-change',
  ],
  'css-getter': [
    'unsupported-non-direct-lit-tag',
    'unsupported-css-interpolation',
    'minifier-no-change',
  ],
  'html-render-static': [
    'unsupported-non-direct-lit-tag',
    'raw-text-or-whitespace-sensitive-tag',
    'minifier-no-change',
  ],
  'html-render-dynamic': [
    'unsupported-non-direct-lit-tag',
    'raw-text-or-whitespace-sensitive-tag',
    'minifier-no-change',
  ],
} as const satisfies Record<LitSourceCompressionTargetKind, readonly LitSourceCompressionSkipCategory[]>

export interface LitSourceCompressionRequest {
  fileName: string
  kind: LitSourceCompressionTargetKind
  tagName: string
  text: string
}

export type LitSourceCompressionResult =
  | { changed: true, text: string }
  | { changed: false, reason: LitSourceCompressionSkipReason }

export interface LitSourceCompressionRewriteResult {
  code: string
  map: ReturnType<MagicString['generateMap']>
}

export const LIT_SOURCE_COMPRESSION_MINIFIER_OPTIONS = {
  generateSourceMap: false,
} as const

const RAW_TEXT_SKIP_TAG_PATTERN = new RegExp(
  `<\\s*(${LIT_SOURCE_COMPRESSION_RAW_TEXT_SKIP_TAGS.join('|')})(?=[\\s>/])`,
  'i',
)
const SYNTHETIC_TEMPLATE_START = '/*__litSsgCompressionStart__*/'
const SYNTHETIC_TEMPLATE_END = '/*__litSsgCompressionEnd__*/'
const HTML_COMMENT_START_PATTERN = /<!--/
const HTML_COMMENT_END_PATTERN = /-->/
const DYNAMIC_HTML_TAG_EXPRESSION_PATTERN = /<\/?\s*\$\{/
const DYNAMIC_HTML_ATTRIBUTE_BINDING_SUFFIX_PATTERN = /([@.?]?[A-Za-z_][\w.:-]*)\s*=\s*$/
const DYNAMIC_HTML_UNSAFE_HTML_EXPRESSION_PATTERN = /\bunsafeHTML\s*\(/

interface LitTemplateImportInfo {
  aliasedTagNames: Set<string>
  directTagNames: Set<string>
  svgTagNames: Set<string>
  litElementNames: Set<string>
}

interface LitSourceCompressionDynamicTemplateParts {
  expressions: string[]
  staticSegments: string[]
}

interface LitSourceCompressionDynamicTemplatePlaceholder {
  replacement: string
  token: string
}

interface LitSourceCompressionProtectedDynamicHtmlTemplate {
  placeholders: LitSourceCompressionDynamicTemplatePlaceholder[]
  text: string
}

function createRange(start: number, end: number): LitSourceCompressionRange {
  return { start, end }
}

function getNodeRange(node: ts.Node, sourceFile: ts.SourceFile): LitSourceCompressionRange {
  return createRange(node.getStart(sourceFile), node.getEnd())
}

function getTemplateRange(template: ts.NoSubstitutionTemplateLiteral | ts.TemplateExpression, sourceFile: ts.SourceFile): LitSourceCompressionRange {
  return createRange(template.getStart(sourceFile) + 1, template.getEnd() - 1)
}

function getTemplateText(template: ts.NoSubstitutionTemplateLiteral | ts.TemplateExpression, sourceFile: ts.SourceFile): string {
  const range = getTemplateRange(template, sourceFile)
  return sourceFile.text.slice(range.start, range.end)
}

function getTaggedTemplateTagName(expression: ts.TaggedTemplateExpression): string | undefined {
  return ts.isIdentifier(expression.tag) ? expression.tag.text : undefined
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

function isRenderMethod(member: ts.ClassElement): member is ts.MethodDeclaration {
  if (!ts.isMethodDeclaration(member)) return false
  if (!ts.isIdentifier(member.name) || member.name.text !== 'render') return false
  return !hasModifier(member, ts.SyntaxKind.StaticKeyword)
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

function collectLitTemplateImportInfo(sourceFile: ts.SourceFile): LitTemplateImportInfo {
  const aliasedTagNames = new Set<string>()
  const directTagNames = new Set<string>()
  const litElementNames = new Set<string>()
  const svgTagNames = new Set<string>()

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    if (!ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== 'lit') continue

    const namedBindings = statement.importClause?.namedBindings
    if (!namedBindings || !ts.isNamedImports(namedBindings)) continue

    for (const element of namedBindings.elements) {
      const importedName = element.propertyName?.text ?? element.name.text
      const localName = element.name.text

      if (importedName === 'LitElement') {
        litElementNames.add(localName)
        continue
      }

      if (importedName === 'svg') {
        svgTagNames.add(localName)
        continue
      }

      if (importedName !== 'html' && importedName !== 'css') continue

      if (localName === importedName) {
        directTagNames.add(localName)
        continue
      }

      aliasedTagNames.add(localName)
    }
  }

  return {
    aliasedTagNames,
    directTagNames,
    litElementNames,
    svgTagNames,
  }
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

function getSingleReturnExpression(body: ts.Block | undefined): ts.Expression | undefined {
  const statement = body?.statements.length === 1 ? body.statements[0] : undefined
  if (!statement || !ts.isReturnStatement(statement)) return undefined
  return statement.expression ?? undefined
}

function getStylesExpression(member: ts.PropertyDeclaration | ts.GetAccessorDeclaration): ts.Expression | undefined {
  if (ts.isPropertyDeclaration(member)) return member.initializer ?? undefined
  return getSingleReturnExpression(member.body)
}

function getStylesGetterFallbackRange(member: ts.GetAccessorDeclaration, sourceFile: ts.SourceFile): LitSourceCompressionRange {
  return member.body ? getNodeRange(member.body, sourceFile) : getNodeRange(member, sourceFile)
}

function getMemberKind(member: ts.ClassElement): 'getter' | 'method' | 'property' | undefined {
  if (ts.isGetAccessorDeclaration(member)) return 'getter'
  if (ts.isMethodDeclaration(member)) return 'method'
  if (ts.isPropertyDeclaration(member)) return 'property'
  return undefined
}

function getMemberName(member: ts.ClassElement): string | undefined {
  return ('name' in member && member.name && ts.isIdentifier(member.name)) ? member.name.text : undefined
}

function getMemberMetadata(classDecl: ts.ClassDeclaration, member: ts.ClassElement): Pick<LitSourceCompressionUnchangedTarget, 'className' | 'memberKind' | 'memberName'> | undefined {
  if (!classDecl.name) return undefined

  const memberKind = getMemberKind(member)
  if (!memberKind) return undefined

  const metadata: Pick<LitSourceCompressionUnchangedTarget, 'className' | 'memberKind' | 'memberName'> = {
    className: classDecl.name.text,
    memberKind,
  }

  const memberName = getMemberName(member)
  if (memberName) {
    metadata.memberName = memberName
  }

  return metadata
}

function createUnchangedTarget(
  expressionRange: LitSourceCompressionRange,
  reason: LitSourceCompressionClassifierUnsupportedReason,
  metadata: Omit<LitSourceCompressionUnchangedTarget, 'expressionRange' | 'reason'> = {},
): LitSourceCompressionUnchangedTarget {
  return {
    expressionRange,
    reason,
    ...metadata,
  }
}

function overlapsRange(candidate: LitSourceCompressionRange, existing: LitSourceCompressionRange): boolean {
  return candidate.start < existing.end && candidate.end > existing.start
}

export function createLitSourceCompressionSourceFile(fileName: string, source: string): ts.SourceFile {
  return createSourceFile(fileName, source)
}

export function classifyLitSourceCompressionTargets(sourceFile: ts.SourceFile): LitSourceCompressionClassification {
  const classes = collectClassDeclarations(sourceFile)
  const importInfo = collectLitTemplateImportInfo(sourceFile)
  const replacementTargets: LitSourceCompressionReplacementTarget[] = []
  const unchangedTargets: LitSourceCompressionUnchangedTarget[] = []
  const occupiedRanges: LitSourceCompressionRange[] = []
  const componentCache = new Map<string, boolean>()

  const isComponentClass = (classDecl: ts.ClassDeclaration): boolean => {
    if (!classDecl.name) return false

    const cached = componentCache.get(classDecl.name.text)
    if (cached != null) return cached

    const result = isLitElementSubclass(classDecl, classes, importInfo.litElementNames)
    componentCache.set(classDecl.name.text, result)
    return result
  }

  const pushReplacementTarget = (target: LitSourceCompressionReplacementTarget) => {
    if (occupiedRanges.some((range) => overlapsRange(target.expressionRange, range))) return
    occupiedRanges.push(target.expressionRange)
    replacementTargets.push(target)
  }

  const pushUnchangedTarget = (target: LitSourceCompressionUnchangedTarget) => {
    if (occupiedRanges.some((range) => overlapsRange(target.expressionRange, range))) return
    occupiedRanges.push(target.expressionRange)
    unchangedTargets.push(target)
  }

  const classifyMemberExpression = (
    classDecl: ts.ClassDeclaration,
    member: ts.ClassElement,
    expression: ts.Expression,
    expectedTagName: 'css' | 'html',
  ) => {
    if (!classDecl.name) return

    const memberKind = getMemberKind(member)
    if (!memberKind) return

    const memberName = expectedTagName === 'css' ? 'styles' : 'render'
    const context: LitSourceCompressionReplacementContext = {
      className: classDecl.name.text,
      memberKind,
      memberName,
    }

    const expressionRange = getNodeRange(expression, sourceFile)

    if (expectedTagName === 'css' && ts.isArrayLiteralExpression(expression)) {
      pushUnchangedTarget(createUnchangedTarget(expressionRange, 'unsupported-array-styles', context))
      return
    }

    if (ts.isIdentifier(expression)) {
      pushUnchangedTarget(createUnchangedTarget(expressionRange, 'unsupported-identifier-indirection', context))
      return
    }

    if (ts.isCallExpression(expression)) {
      pushUnchangedTarget(createUnchangedTarget(expressionRange, 'unsupported-helper-returned-template', context))
      return
    }

    if (!ts.isTaggedTemplateExpression(expression)) {
      if (expectedTagName === 'css' && context.memberKind === 'getter') {
        pushUnchangedTarget(createUnchangedTarget(expressionRange, 'unsupported-complex-getter', context))
      }
      return
    }

    const tagName = getTaggedTemplateTagName(expression)
    const tagRange = getNodeRange(expression.tag, sourceFile)
    const templateRange = getTemplateRange(expression.template, sourceFile)
    const metadata: Omit<LitSourceCompressionUnchangedTarget, 'expressionRange' | 'reason'> = {
      ...context,
      tagRange,
      templateRange,
    }
    if (tagName) {
      metadata.tagName = tagName
    }

    if (!tagName) {
      pushUnchangedTarget(createUnchangedTarget(expressionRange, 'unsupported-non-direct-lit-tag', metadata))
      return
    }

    if (importInfo.svgTagNames.has(tagName)) {
      pushUnchangedTarget(createUnchangedTarget(expressionRange, 'unsupported-svg-template', metadata))
      return
    }

    if (importInfo.aliasedTagNames.has(tagName)) {
      pushUnchangedTarget(createUnchangedTarget(expressionRange, 'unsupported-aliased-lit-tag', metadata))
      return
    }

    if (!importInfo.directTagNames.has(tagName) || tagName !== expectedTagName) {
      pushUnchangedTarget(createUnchangedTarget(expressionRange, 'unsupported-non-direct-lit-tag', metadata))
      return
    }

    pushReplacementTarget({
      ...context,
      expressionRange,
      kind: expectedTagName === 'css'
        ? (context.memberKind === 'property' ? 'css-field' : 'css-getter')
        : (ts.isNoSubstitutionTemplateLiteral(expression.template) ? 'html-render-static' : 'html-render-dynamic'),
      tagName,
      tagRange,
      templateRange,
      text: getTemplateText(expression.template, sourceFile),
    })
  }

  const visitClasses = (node: ts.Node) => {
    if (ts.isClassDeclaration(node) && node.name && isComponentClass(node)) {
      for (const member of node.members) {
        if (isStaticStylesMember(member)) {
          if (ts.isGetAccessorDeclaration(member)) {
            const expression = getSingleReturnExpression(member.body)
            if (!expression) {
              pushUnchangedTarget(createUnchangedTarget(
                getStylesGetterFallbackRange(member, sourceFile),
                'unsupported-complex-getter',
                {
                  className: node.name.text,
                  memberKind: 'getter',
                  memberName: 'styles',
                },
              ))
              continue
            }

            classifyMemberExpression(node, member, expression, 'css')
            continue
          }

          const expression = getStylesExpression(member)
          if (expression) classifyMemberExpression(node, member, expression, 'css')
          continue
        }

        if (isRenderMethod(member)) {
          const expression = getSingleReturnExpression(member.body)
          if (expression) classifyMemberExpression(node, member, expression, 'html')
        }
      }
    }

    ts.forEachChild(node, visitClasses)
  }

  const visitTaggedTemplates = (node: ts.Node) => {
    if (ts.isTaggedTemplateExpression(node)) {
      const expressionRange = getNodeRange(node, sourceFile)
      if (occupiedRanges.some((range) => overlapsRange(expressionRange, range))) return

      const tagName = getTaggedTemplateTagName(node)
      if (!tagName) return

      const isTrackedTag = importInfo.directTagNames.has(tagName)
        || importInfo.aliasedTagNames.has(tagName)
        || importInfo.svgTagNames.has(tagName)
      if (!isTrackedTag) return

      let enclosingClass: ts.ClassDeclaration | undefined
      let enclosingMember: ts.ClassElement | undefined

      for (let parent = node.parent; parent != null; parent = parent.parent) {
        if (!enclosingMember && ts.isClassElement(parent)) enclosingMember = parent
        if (ts.isClassDeclaration(parent)) {
          enclosingClass = parent
          break
        }
      }

      const context = enclosingClass && enclosingClass.name && enclosingMember
        ? getMemberMetadata(enclosingClass, enclosingMember)
        : undefined

      const metadata: Omit<LitSourceCompressionUnchangedTarget, 'expressionRange' | 'reason'> = {
        ...context,
        tagRange: getNodeRange(node.tag, sourceFile),
        templateRange: getTemplateRange(node.template, sourceFile),
      }
      if (tagName) {
        metadata.tagName = tagName
      }

      if (importInfo.svgTagNames.has(tagName)) {
        pushUnchangedTarget(createUnchangedTarget(expressionRange, 'unsupported-svg-template', metadata))
        return
      }

      if (importInfo.aliasedTagNames.has(tagName)) {
        pushUnchangedTarget(createUnchangedTarget(expressionRange, 'unsupported-aliased-lit-tag', metadata))
        return
      }

      if (enclosingClass && isComponentClass(enclosingClass)) {
        const memberName = context?.memberName
        const isHandledMember = (memberName === 'styles' && context?.memberKind !== 'method') || memberName === 'render'
        if (!isHandledMember) {
          pushUnchangedTarget(createUnchangedTarget(expressionRange, 'unsupported-helper-returned-template', metadata))
          return
        }
      }

      pushUnchangedTarget(createUnchangedTarget(expressionRange, 'unsupported-non-component-tagged-template', metadata))
      return
    }

    ts.forEachChild(node, visitTaggedTemplates)
  }

  visitClasses(sourceFile)
  visitTaggedTemplates(sourceFile)

  replacementTargets.sort((left, right) => left.expressionRange.start - right.expressionRange.start)
  unchangedTargets.sort((left, right) => left.expressionRange.start - right.expressionRange.start)

  return {
    replacementTargets,
    unchangedTargets,
  }
}

function hasTemplateExpressions(text: string): boolean {
  return /(^|[^\\])\$\{/.test(text)
}

function detectRawTextSkipTag(text: string): LitSourceCompressionRawTextSkipTag | undefined {
  const match = RAW_TEXT_SKIP_TAG_PATTERN.exec(text)
  if (!match?.[1]) return undefined
  return match[1].toLowerCase() as LitSourceCompressionRawTextSkipTag
}

function hasUnterminatedHtmlComment(text: string): boolean {
  return HTML_COMMENT_START_PATTERN.test(text) && !HTML_COMMENT_END_PATTERN.test(text)
}

function buildDynamicHtmlSyntheticSource(text: string): string {
  return `const __litSourceCompressionTemplate = html\`${text}\``
}

function getDynamicHtmlExpressionToken(index: number): string {
  return `__LIT_SSG_EXPR_${index}__`
}

function getDynamicHtmlBindingToken(index: number): string {
  return `data-lit-ssg-bind-${index}="${getDynamicHtmlExpressionToken(index)}"`
}

function collectDynamicHtmlTemplateParts(text: string): LitSourceCompressionDynamicTemplateParts | null {
  const sourceFile = createSourceFile('__lit-source-compression-dynamic-html.ts', buildDynamicHtmlSyntheticSource(text))
  const statement = sourceFile.statements[0]
  if (!statement || !ts.isVariableStatement(statement)) return null

  const declaration = statement.declarationList.declarations[0]
  const initializer = declaration?.initializer
  if (!initializer || !ts.isTaggedTemplateExpression(initializer)) return null
  if (!ts.isTemplateExpression(initializer.template)) return null

  const staticSegments: string[] = []
  const expressions: string[] = []
  let cursor = initializer.template.getStart(sourceFile) + 1

  for (const span of initializer.template.templateSpans) {
    const expressionStart = span.expression.getStart(sourceFile)
    staticSegments.push(sourceFile.text.slice(cursor, expressionStart - 2))
    expressions.push(sourceFile.text.slice(expressionStart, span.expression.getEnd()))
    cursor = span.expression.getEnd() + 1
  }

  staticSegments.push(sourceFile.text.slice(cursor, initializer.template.getEnd() - 1))

  return {
    expressions,
    staticSegments,
  }
}

function protectDynamicHtmlTemplate(text: string): LitSourceCompressionProtectedDynamicHtmlTemplate | null {
  if (DYNAMIC_HTML_TAG_EXPRESSION_PATTERN.test(text)) return null

  const parts = collectDynamicHtmlTemplateParts(text)
  if (!parts || parts.expressions.length === 0) return null
  if (parts.expressions.some((expression) => DYNAMIC_HTML_UNSAFE_HTML_EXPRESSION_PATTERN.test(expression))) return null

  const placeholders: LitSourceCompressionDynamicTemplatePlaceholder[] = []
  let protectedText = parts.staticSegments[0] ?? ''

  for (const [index, expression] of parts.expressions.entries()) {
    const placeholderExpression = `\${${expression}}`
    const attributeBindingMatch = protectedText.match(DYNAMIC_HTML_ATTRIBUTE_BINDING_SUFFIX_PATTERN)

    if (attributeBindingMatch?.[0]) {
      const originalBinding = `${attributeBindingMatch[0]}${placeholderExpression}`
      protectedText = protectedText.slice(0, -attributeBindingMatch[0].length)

      const token = getDynamicHtmlBindingToken(index)
      protectedText += token
      placeholders.push({ token, replacement: originalBinding })
    }
    else {
      const token = getDynamicHtmlExpressionToken(index)
      protectedText += token
      placeholders.push({ token, replacement: placeholderExpression })
    }

    protectedText += parts.staticSegments[index + 1] ?? ''
  }

  return {
    placeholders,
    text: protectedText,
  }
}

function restoreProtectedDynamicHtmlTemplate(
  text: string,
  placeholders: LitSourceCompressionDynamicTemplatePlaceholder[],
): string | null {
  let restoredText = text

  for (const placeholder of placeholders) {
    if (!restoredText.includes(placeholder.token)) return null
    restoredText = restoredText.replaceAll(placeholder.token, placeholder.replacement)
  }

  return restoredText
}

function buildSyntheticSource(policy: LitSourceCompressionPolicy, text: string): string {
  return `${policy.syntheticPrefix}${SYNTHETIC_TEMPLATE_START}${policy.expectedTagName}\`${text}\`${SYNTHETIC_TEMPLATE_END}${policy.syntheticSuffix}`
}

function extractTemplateText(code: string, expectedTagName: 'css' | 'html'): string {
  const markerStart = code.indexOf(SYNTHETIC_TEMPLATE_START)
  const markerEnd = code.indexOf(SYNTHETIC_TEMPLATE_END)

  if (markerStart < 0 || markerEnd < 0 || markerEnd <= markerStart) {
    throw new Error('[vite-plugin-lit-ssg] Lit source compression could not recover the synthetic template markers.')
  }

  const expression = code
    .slice(markerStart + SYNTHETIC_TEMPLATE_START.length, markerEnd)
    .trim()
  const templatePrefix = `${expectedTagName}\``

  if (!expression.startsWith(templatePrefix) || !expression.endsWith('`')) {
    throw new Error(
      `[vite-plugin-lit-ssg] Lit source compression could not recover the minified ${expectedTagName} template.`,
    )
  }

  return expression.slice(templatePrefix.length, -1)
}

export async function minifyLitSourceCompressionTarget(
  request: LitSourceCompressionRequest,
): Promise<LitSourceCompressionResult> {
  try {
    const policy = LIT_SOURCE_COMPRESSION_SUPPORT_MATRIX[request.kind]

    if (request.tagName !== policy.expectedTagName) {
      return { changed: false, reason: 'unsupported-non-direct-lit-tag' }
    }

    if (policy.expectedTagName === 'css' && hasTemplateExpressions(request.text)) {
      return { changed: false, reason: 'unsupported-css-interpolation' }
    }

    if (policy.expectedTagName === 'html') {
      const skipTag = detectRawTextSkipTag(request.text)
      if (skipTag) {
        return {
          changed: false,
          reason: `raw-text-or-whitespace-sensitive-tag:${skipTag}`,
        }
      }

      if (hasUnterminatedHtmlComment(request.text)) {
        return { changed: false, reason: 'minifier-no-change' }
      }
    }

    let textToMinify = request.text
    let restoreDynamicTemplateText: ((text: string) => string | null) | undefined

    if (request.kind === 'html-render-dynamic') {
      const protectedTemplate = protectDynamicHtmlTemplate(request.text)
      if (!protectedTemplate) {
        return { changed: false, reason: 'minifier-no-change' }
      }

      textToMinify = protectedTemplate.text
      restoreDynamicTemplateText = (text) => restoreProtectedDynamicHtmlTemplate(text, protectedTemplate.placeholders)
    }

    const result = await minifyHTMLLiterals(
      buildSyntheticSource(policy, textToMinify),
      {
        fileName: request.fileName,
        ...LIT_SOURCE_COMPRESSION_MINIFIER_OPTIONS,
      },
    )

    if (!result) {
      return { changed: false, reason: 'minifier-no-change' }
    }

    const minifiedText = extractTemplateText(result.code, policy.expectedTagName)
    const text = restoreDynamicTemplateText ? restoreDynamicTemplateText(minifiedText) : minifiedText

    if (text == null) {
      return { changed: false, reason: 'minifier-no-change' }
    }

    if (text === request.text) {
      return { changed: false, reason: 'minifier-no-change' }
    }

    return { changed: true, text }
  }
  catch {
    return { changed: false, reason: 'minifier-no-change' }
  }
}

export async function rewriteLitSourceCompressionCssFields(
  code: string,
  fileName: string,
): Promise<LitSourceCompressionRewriteResult | null> {
  return rewriteLitSourceCompressionTemplateBodies(code, fileName, (target) => target.kind === 'css-field')
}

export async function rewriteLitSourceCompressionCssGetters(
  code: string,
  fileName: string,
): Promise<LitSourceCompressionRewriteResult | null> {
  return rewriteLitSourceCompressionTemplateBodies(code, fileName, (target) => target.kind === 'css-getter')
}

async function rewriteLitSourceCompressionTemplateBodies(
  code: string,
  fileName: string,
  shouldRewrite: (target: LitSourceCompressionReplacementTarget) => boolean,
): Promise<LitSourceCompressionRewriteResult | null> {
  const sourceFile = createLitSourceCompressionSourceFile(fileName, code)
  const classification = classifyLitSourceCompressionTargets(sourceFile)
  const rewriteTargets = classification.replacementTargets.filter(shouldRewrite)

  if (rewriteTargets.length === 0) return null

  const magicString = new MagicString(code, { filename: fileName })
  let hasChanges = false

  for (const target of rewriteTargets) {
    const result = await minifyLitSourceCompressionTarget({
      fileName,
      kind: target.kind,
      tagName: target.tagName,
      text: target.text,
    })

    if (!result.changed) continue

    magicString.overwrite(target.templateRange.start, target.templateRange.end, result.text)
    hasChanges = true
  }

  if (!hasChanges) return null

  return {
    code: magicString.toString(),
    map: magicString.generateMap({
      source: fileName,
      includeContent: true,
      hires: true,
    }),
  }
}

export async function rewriteLitSourceCompressionStaticHtmlRenders(
  code: string,
  fileName: string,
): Promise<LitSourceCompressionRewriteResult | null> {
  return rewriteLitSourceCompressionTemplateBodies(code, fileName, (target) => target.kind === 'html-render-static')
}

export async function rewriteLitSourceCompressionDynamicHtmlRenders(
  code: string,
  fileName: string,
): Promise<LitSourceCompressionRewriteResult | null> {
  return rewriteLitSourceCompressionTemplateBodies(code, fileName, (target) => target.kind === 'html-render-dynamic')
}
