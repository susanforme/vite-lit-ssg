import { describe, expect, it } from 'vitest'

import {
  LIT_SOURCE_COMPRESSION_MINIFIER_OPTIONS,
  LIT_SOURCE_COMPRESSION_RAW_TEXT_SKIP_TAGS,
  LIT_SOURCE_COMPRESSION_SKIP_MATRIX,
  LIT_SOURCE_COMPRESSION_SUPPORT_MATRIX,
  classifyLitSourceCompressionTargets,
  createLitSourceCompressionSourceFile,
  minifyLitSourceCompressionTarget,
  rewriteLitSourceCompressionCssFields,
  rewriteLitSourceCompressionCssGetters,
  rewriteLitSourceCompressionDynamicHtmlRenders,
  rewriteLitSourceCompressionStaticHtmlRenders,
} from '../../vite-plugin-lit-ssg/src/plugin/lit-source-compression.js'

function getRangeText(source: string, start: number, end: number): string {
  return source.slice(start, end)
}

describe('lit source compression policy module', () => {
  it('defines the v1 support and skip matrices for every target kind', () => {
    expect(LIT_SOURCE_COMPRESSION_MINIFIER_OPTIONS).toEqual({
      generateSourceMap: false,
    })

    expect(LIT_SOURCE_COMPRESSION_RAW_TEXT_SKIP_TAGS).toEqual([
      'pre',
      'textarea',
      'script',
      'style',
      'title',
      'svg',
    ])

    expect(LIT_SOURCE_COMPRESSION_SUPPORT_MATRIX).toEqual({
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
    })

    expect(LIT_SOURCE_COMPRESSION_SKIP_MATRIX).toEqual({
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
    })
  })

  it('minifies supported static css targets', async () => {
    const fieldResult = await minifyLitSourceCompressionTarget({
      fileName: 'demo-widget.ts',
      kind: 'css-field',
      tagName: 'css',
      text: `
  .card {
    color: rgb(255, 0, 0);
  }
`,
    })
    const getterResult = await minifyLitSourceCompressionTarget({
      fileName: 'demo-widget.ts',
      kind: 'css-getter',
      tagName: 'css',
      text: `
  :host {
    display: block;
  }

  p {
    color: rgb(255, 0, 0);
  }
`,
    })

    expect(fieldResult).toEqual({ changed: true, text: '.card{color:red}' })
    expect(getterResult).toEqual({ changed: true, text: ':host{display:block}p{color:red}' })
  })

  it('compresses only simple static get styles css returns', async () => {
    const source = [
      "import { LitElement, css } from 'lit'",
      '',
      'export class DemoWidget extends LitElement {',
      '  static get styles() {',
      '    return css`p { color: rebeccapurple; }`',
      '  }',
      '}',
      '',
    ].join('\n')

    const result = await rewriteLitSourceCompressionCssGetters(source, 'demo-widget.ts')

    expect(result?.code).toBe([
      "import { LitElement, css } from 'lit'",
      '',
      'export class DemoWidget extends LitElement {',
      '  static get styles() {',
      '    return css`p{color:rebeccapurple}`',
      '  }',
      '}',
      '',
    ].join('\n'))
  })

  it('leaves unsupported css getters unchanged through the production rewrite helper', async () => {
    const source = [
      "import { LitElement, css } from 'lit'",
      '',
      'const buildStyles = () => "helper-styles"',
      '',
      'export class ConditionalGetter extends LitElement {',
      '  static get styles() {',
      '    return tone === "warm" ? css`p { color: red; }` : css`p { color: blue; }`',
      '  }',
      '}',
      '',
      'export class MultipleReturnGetter extends LitElement {',
      '  static get styles() {',
      '    if (tone === "warm") {',
      '      return css`p { color: red; }`',
      '    }',
      '',
      '    return css`p { color: blue; }`',
      '  }',
      '}',
      '',
      'export class ArrayGetter extends LitElement {',
      '  static get styles() {',
      '    return [css`p { color: green; }`]',
      '  }',
      '}',
      '',
      'export class HelperGetter extends LitElement {',
      '  static get styles() {',
      '    return buildStyles()',
      '  }',
      '}',
      '',
      'export class LiteralGetter extends LitElement {',
      '  static get styles() {',
      '    return "p { color: orange; }"',
      '  }',
      '}',
      '',
    ].join('\n')

    const result = await rewriteLitSourceCompressionCssGetters(source, 'unsupported-getters.ts')

    expect(result?.code ?? source).toBe(source)
  })

  it('minifies supported html render targets with and without expressions', async () => {
    const staticResult = await minifyLitSourceCompressionTarget({
      fileName: 'demo-widget.ts',
      kind: 'html-render-static',
      tagName: 'html',
      text: `
  <div class="card">
    <span>Ready</span>
  </div>
`,
    })
    const dynamicResult = await minifyLitSourceCompressionTarget({
      fileName: 'demo-widget.ts',
      kind: 'html-render-dynamic',
      tagName: 'html',
      text: `
  <div class="card" data-state=${'${state}'}>
    <span>${'${label}'}</span>
  </div>
`,
    })
    const dynamicBindingResult = await minifyLitSourceCompressionTarget({
      fileName: 'demo-widget.ts',
      kind: 'html-render-dynamic',
      tagName: 'html',
      text: `
  <button @click=${'${this.handleClick}'} > ${'${label}'} </button>
  <input .value=${'${value}'} ?disabled=${'${disabled}'} >
`,
    })

    expect(staticResult).toEqual({
      changed: true,
      text: '<div class="card"><span>Ready</span></div>',
    })
    expect(dynamicResult).toEqual({
      changed: true,
      text: '<div class="card" data-state=${state}><span>${label}</span></div>',
    })
    expect(dynamicBindingResult).toEqual({
      changed: true,
      text: '<button @click=${this.handleClick}>${label}</button><input .value=${value} ?disabled=${disabled}>',
    })
  })

  it('skips aliased tags, css interpolation, and raw-text html tags unchanged', async () => {
    const aliasedCssResult = await minifyLitSourceCompressionTarget({
      fileName: 'demo-widget.ts',
      kind: 'css-field',
      tagName: 'localCss',
      text: '.card { color: red; }',
    })
    const interpolatedCssResult = await minifyLitSourceCompressionTarget({
      fileName: 'demo-widget.ts',
      kind: 'css-getter',
      tagName: 'css',
      text: '.card { color: ${tone}; }',
    })
    const preResult = await minifyLitSourceCompressionTarget({
      fileName: 'demo-widget.ts',
      kind: 'html-render-static',
      tagName: 'html',
      text: '<pre>  keep   spacing  </pre>',
    })
    const svgResult = await minifyLitSourceCompressionTarget({
      fileName: 'demo-widget.ts',
      kind: 'html-render-dynamic',
      tagName: 'html',
      text: '<svg viewBox="0 0 10 10"><text>${label}</text></svg>',
    })

    expect(aliasedCssResult).toEqual({
      changed: false,
      reason: 'unsupported-non-direct-lit-tag',
    })
    expect(interpolatedCssResult).toEqual({
      changed: false,
      reason: 'unsupported-css-interpolation',
    })
    expect(preResult).toEqual({
      changed: false,
      reason: 'raw-text-or-whitespace-sensitive-tag:pre',
    })
    expect(svgResult).toEqual({
      changed: false,
      reason: 'raw-text-or-whitespace-sensitive-tag:svg',
    })
  })

  it('rewrites css field template bodies in place', async () => {
    const source = [
      "import { LitElement, css } from 'lit'",
      '',
      'const commonStyles = css`',
      '  p { color: green; }',
      '`',
      '',
      'function buildStyles() {',
      '  return css`',
      '    p { color: orange; }',
      '  `',
      '}',
      '',
      'export class DemoWidget extends LitElement {',
      '  static styles = css`p { color: red; }`',
      '}',
      '',
      'export class InterpolatedWidget extends LitElement {',
      '  static styles = css`',
      '    p { color: ${tone}; }',
      '  `',
      '}',
      '',
      'export class IdentifierWidget extends LitElement {',
      '  static styles = commonStyles',
      '}',
      '',
      'export class ArrayWidget extends LitElement {',
      '  static styles = [css`p { color: blue; }`]',
      '}',
      '',
      'export class HelperWidget extends LitElement {',
      '  static styles = buildStyles()',
      '}',
      '',
    ].join('\n')

    const result = await rewriteLitSourceCompressionCssFields(source, 'demo-widget.ts')

    expect(result?.code).toBe([
      "import { LitElement, css } from 'lit'",
      '',
      'const commonStyles = css`',
      '  p { color: green; }',
      '`',
      '',
      'function buildStyles() {',
      '  return css`',
      '    p { color: orange; }',
      '  `',
      '}',
      '',
      'export class DemoWidget extends LitElement {',
      '  static styles = css`p{color:red}`',
      '}',
      '',
      'export class InterpolatedWidget extends LitElement {',
      '  static styles = css`',
      '    p { color: ${tone}; }',
      '  `',
      '}',
      '',
      'export class IdentifierWidget extends LitElement {',
      '  static styles = commonStyles',
      '}',
      '',
      'export class ArrayWidget extends LitElement {',
      '  static styles = [css`p { color: blue; }`]',
      '}',
      '',
      'export class HelperWidget extends LitElement {',
      '  static styles = buildStyles()',
      '}',
      '',
    ].join('\n'))
  })

  it('leaves interpolated css fields unchanged', async () => {
    const source = [
      "import { LitElement, css } from 'lit'",
      '',
      'export class DemoWidget extends LitElement {',
      '  static styles = css`',
      '    p { color: ${tone}; }',
      '  `',
      '}',
      '',
    ].join('\n')

    const result = await rewriteLitSourceCompressionCssFields(source, 'demo-widget.ts')

    expect(result?.code ?? source).toBe(source)
  })

  it('leaves unsupported css field aliases and composed styles unchanged exactly', async () => {
    const source = [
      "import { LitElement, css, css as localCss } from 'lit'",
      '',
      'const sharedStyles = css`',
      '  :host { display: block; }',
      '`',
      '',
      'export class AliasedFieldWidget extends LitElement {',
      '  static styles = localCss`',
      '    p { color: red; }',
      '  `',
      '}',
      '',
      'export class ComposedFieldWidget extends LitElement {',
      '  static styles = [sharedStyles, css`',
      '    p { color: blue; }',
      '  `]',
      '}',
      '',
      'export class IdentifierFieldWidget extends LitElement {',
      '  static styles = sharedStyles',
      '}',
      '',
    ].join('\n')

    const result = await rewriteLitSourceCompressionCssFields(source, 'unsupported-css-fields.ts')

    expect(result?.code ?? source).toBe(source)
  })

  it('rewrites html static render template bodies in place', async () => {
    const source = [
      "import { LitElement, html } from 'lit'",
      '',
      'export class StaticWidget extends LitElement {',
      '  render() {',
      '    return html`<div class="a"> x </div>`',
      '  }',
      '}',
      '',
      'export class DynamicWidget extends LitElement {',
      '  render() {',
      '    return html`<div>${this.label}</div>`',
      '  }',
      '}',
      '',
    ].join('\n')

    const result = await rewriteLitSourceCompressionStaticHtmlRenders(source, 'demo-widget.ts')

    expect(result?.code).toBe([
      "import { LitElement, html } from 'lit'",
      '',
      'export class StaticWidget extends LitElement {',
      '  render() {',
      '    return html`<div class="a">x</div>`',
      '  }',
      '}',
      '',
      'export class DynamicWidget extends LitElement {',
      '  render() {',
      '    return html`<div>${this.label}</div>`',
      '  }',
      '}',
      '',
    ].join('\n'))
  })

  it('leaves html static render skip-list tags unchanged', async () => {
    const source = [
      "import { LitElement, html } from 'lit'",
      '',
      'export class PreWidget extends LitElement {',
      '  render() {',
      '    return html`<pre>  keep   spacing  </pre>`',
      '  }',
      '}',
      '',
      'export class TitleWidget extends LitElement {',
      '  render() {',
      '    return html`<title>  keep   spacing  </title>`',
      '  }',
      '}',
      '',
    ].join('\n')

    const result = await rewriteLitSourceCompressionStaticHtmlRenders(source, 'demo-widget.ts')

    expect(result?.code ?? source).toBe(source)
  })

  it('rewrites html dynamic render text bindings in place', async () => {
    const source = [
      "import { LitElement, html } from 'lit'",
      '',
      'export class DynamicTextWidget extends LitElement {',
      '  render() {',
      '    return html`<div class="card"> ${this.label} </div>`',
      '  }',
      '}',
      '',
    ].join('\n')

    const result = await rewriteLitSourceCompressionDynamicHtmlRenders(source, 'dynamic-text-widget.ts')

    expect(result?.code).toBe([
      "import { LitElement, html } from 'lit'",
      '',
      'export class DynamicTextWidget extends LitElement {',
      '  render() {',
      '    return html`<div class="card">${this.label}</div>`',
      '  }',
      '}',
      '',
    ].join('\n'))
  })

  it('rewrites html dynamic render event and lit binding sigils in place', async () => {
    const source = [
      "import { LitElement, html } from 'lit'",
      '',
      'export class DynamicButtonWidget extends LitElement {',
      '  render() {',
      '    return html`<button @click=${this.handleClick} > ${this.label} </button>`',
      '  }',
      '}',
      '',
      'export class DynamicInputWidget extends LitElement {',
      '  render() {',
      '    return html`<input .value=${this.value} ?disabled=${this.disabled} >`',
      '  }',
      '}',
      '',
    ].join('\n')

    const result = await rewriteLitSourceCompressionDynamicHtmlRenders(source, 'dynamic-bindings-widget.ts')

    expect(result?.code).toBe([
      "import { LitElement, html } from 'lit'",
      '',
      'export class DynamicButtonWidget extends LitElement {',
      '  render() {',
      '    return html`<button @click=${this.handleClick}>${this.label}</button>`',
      '  }',
      '}',
      '',
      'export class DynamicInputWidget extends LitElement {',
      '  render() {',
      '    return html`<input .value=${this.value} ?disabled=${this.disabled}>`',
      '  }',
      '}',
      '',
    ].join('\n'))
  })

  it('leaves html dynamic render skip-list and dynamic-tag fallbacks unchanged', async () => {
    const source = [
      "import { LitElement, html } from 'lit'",
      '',
      'export class DynamicSvgWidget extends LitElement {',
      '  render() {',
      '    return html`<svg viewBox="0 0 10 10"><text>${this.label}</text></svg>`',
      '  }',
      '}',
      '',
      'export class DynamicTagWidget extends LitElement {',
      '  render() {',
      '    return html`<${this.tagName}> ${this.label} </${this.tagName}>`',
      '  }',
      '}',
      '',
    ].join('\n')

    const result = await rewriteLitSourceCompressionDynamicHtmlRenders(source, 'dynamic-fallback-widget.ts')

    expect(result?.code ?? source).toBe(source)
  })

  it('skips unsupported non-lit tags and unsafeHTML dynamic renders unchanged exactly', async () => {
    const source = [
      "import { LitElement, html } from 'lit'",
      "import { unsafeHTML } from 'lit/directives/unsafe-html.js'",
      '',
      'const localHtml = (strings: TemplateStringsArray, ...values: unknown[]) => String.raw({ raw: strings }, ...values)',
      '',
      'export class NonLitTagWidget extends LitElement {',
      '  render() {',
      '    return localHtml`<div> ${this.label} </div>`',
      '  }',
      '}',
      '',
      'export class UnsafeHtmlWidget extends LitElement {',
      '  render() {',
      '    return html`<section> ${unsafeHTML(this.markup)} </section>`',
      '  }',
      '}',
      '',
    ].join('\n')

    const staticResult = await rewriteLitSourceCompressionStaticHtmlRenders(source, 'unsupported-html-static.ts')
    const dynamicResult = await rewriteLitSourceCompressionDynamicHtmlRenders(source, 'unsupported-html-dynamic.ts')

    expect(staticResult?.code ?? source).toBe(source)
    expect(dynamicResult?.code ?? source).toBe(source)
  })

  it('no crash: leaves supported templates unchanged when the minifier throws', async () => {
    const source = [
      "import { LitElement, html } from 'lit'",
      '',
      'export class DemoWidget extends LitElement {',
      '  render() {',
      '    return html`<!--`',
      '  }',
      '}',
      '',
    ].join('\n')

    const result = await rewriteLitSourceCompressionStaticHtmlRenders(source, 'demo-widget.ts')

    expect(result?.code ?? source).toBe(source)
  })

  it('classifies supported target classifier shapes in stable source order', () => {
    const source = [
      "import { LitElement, css, html } from 'lit'",
      '',
      'class BaseCard extends LitElement {',
      '  static styles = css`',
      '    :host { display: block; }',
      '  `',
      '}',
      '',
      'export class DemoWidget extends BaseCard {',
      '  static get styles() {',
      '    return css`',
      '      .card { color: red; }',
      '    `',
      '  }',
      '',
      '  render() {',
      '    return html`',
      '      <div class="card">${this.label}</div>',
      '    `',
      '  }',
      '}',
      '',
      'export class StaticWidget extends LitElement {',
      '  render() {',
      '    return html`',
      '      <p>Ready</p>',
      '    `',
      '  }',
      '}',
      '',
    ].join('\n')

    const sourceFile = createLitSourceCompressionSourceFile('demo-widget.ts', source)
    const result = classifyLitSourceCompressionTargets(sourceFile)

    expect(result.unchangedTargets).toEqual([])
    expect(result.replacementTargets.map((target) => ({
      className: target.className,
      kind: target.kind,
      memberKind: target.memberKind,
      memberName: target.memberName,
      tagName: target.tagName,
      expression: getRangeText(source, target.expressionRange.start, target.expressionRange.end),
      tag: getRangeText(source, target.tagRange.start, target.tagRange.end),
      text: target.text,
      template: getRangeText(source, target.templateRange.start, target.templateRange.end),
    }))).toEqual([
      {
        className: 'BaseCard',
        kind: 'css-field',
        memberKind: 'property',
        memberName: 'styles',
        tagName: 'css',
        expression: 'css`\n    :host { display: block; }\n  `',
        tag: 'css',
        text: '\n    :host { display: block; }\n  ',
        template: '\n    :host { display: block; }\n  ',
      },
      {
        className: 'DemoWidget',
        kind: 'css-getter',
        memberKind: 'getter',
        memberName: 'styles',
        tagName: 'css',
        expression: 'css`\n      .card { color: red; }\n    `',
        tag: 'css',
        text: '\n      .card { color: red; }\n    ',
        template: '\n      .card { color: red; }\n    ',
      },
      {
        className: 'DemoWidget',
        kind: 'html-render-dynamic',
        memberKind: 'method',
        memberName: 'render',
        tagName: 'html',
        expression: 'html`\n      <div class="card">${this.label}</div>\n    `',
        tag: 'html',
        text: '\n      <div class="card">${this.label}</div>\n    ',
        template: '\n      <div class="card">${this.label}</div>\n    ',
      },
      {
        className: 'StaticWidget',
        kind: 'html-render-static',
        memberKind: 'method',
        memberName: 'render',
        tagName: 'html',
        expression: 'html`\n      <p>Ready</p>\n    `',
        tag: 'html',
        text: '\n      <p>Ready</p>\n    ',
        template: '\n      <p>Ready</p>\n    ',
      },
    ])

    for (let index = 1; index < result.replacementTargets.length; index += 1) {
      const previous = result.replacementTargets[index - 1]!
      const current = result.replacementTargets[index]!
      expect(previous.expressionRange.end).toBeLessThanOrEqual(current.expressionRange.start)
    }
  })

  it('classifies unsupported target classifier shapes as unchanged', () => {
    const source = [
      "import { LitElement, css, html, svg, css as localCss } from 'lit'",
      '',
      'const sharedStyles = css`',
      '  :host { display: block; }',
      '`',
      '',
      'const strayTemplate = html`<p>Outside</p>`',
      '',
      'export class UnsupportedArray extends LitElement {',
      '  static styles = [css`.card { color: red; }`]',
      '}',
      '',
      'export class UnsupportedIdentifier extends LitElement {',
      '  static styles = sharedStyles',
      '}',
      '',
      'export class UnsupportedAliased extends LitElement {',
      '  static get styles() {',
      '    return localCss`.card { color: blue; }`',
      '  }',
      '}',
      '',
      'export class UnsupportedHelper extends LitElement {',
      '  renderPartial() {',
      '    return html`<section>Helper</section>`',
      '  }',
      '',
      '  render() {',
      '    return this.renderPartial()',
      '  }',
      '}',
      '',
      'export class UnsupportedSvg extends LitElement {',
      '  render() {',
      '    return svg`<svg viewBox="0 0 10 10"><text>${this.label}</text></svg>`',
      '  }',
      '}',
      '',
      'class PlainHelper {',
      '  render() {',
      '    return html`<p>Not a LitElement render</p>`',
      '  }',
      '}',
      '',
    ].join('\n')

    const sourceFile = createLitSourceCompressionSourceFile('unsupported.ts', source)
    const result = classifyLitSourceCompressionTargets(sourceFile)

    expect(result.replacementTargets).toEqual([])
    expect(result.unchangedTargets.map((target) => ({
      className: target.className,
      memberKind: target.memberKind,
      memberName: target.memberName,
      reason: target.reason,
      tagName: target.tagName,
      expression: getRangeText(source, target.expressionRange.start, target.expressionRange.end),
    }))).toEqual([
      {
        className: undefined,
        memberKind: undefined,
        memberName: undefined,
        reason: 'unsupported-non-component-tagged-template',
        tagName: 'css',
        expression: 'css`\n  :host { display: block; }\n`',
      },
      {
        className: undefined,
        memberKind: undefined,
        memberName: undefined,
        reason: 'unsupported-non-component-tagged-template',
        tagName: 'html',
        expression: 'html`<p>Outside</p>`',
      },
      {
        className: 'UnsupportedArray',
        memberKind: 'property',
        memberName: 'styles',
        reason: 'unsupported-array-styles',
        tagName: undefined,
        expression: '[css`.card { color: red; }`]',
      },
      {
        className: 'UnsupportedIdentifier',
        memberKind: 'property',
        memberName: 'styles',
        reason: 'unsupported-identifier-indirection',
        tagName: undefined,
        expression: 'sharedStyles',
      },
      {
        className: 'UnsupportedAliased',
        memberKind: 'getter',
        memberName: 'styles',
        reason: 'unsupported-aliased-lit-tag',
        tagName: 'localCss',
        expression: 'localCss`.card { color: blue; }`',
      },
      {
        className: 'UnsupportedHelper',
        memberKind: 'method',
        memberName: 'renderPartial',
        reason: 'unsupported-helper-returned-template',
        tagName: 'html',
        expression: 'html`<section>Helper</section>`',
      },
      {
        className: 'UnsupportedHelper',
        memberKind: 'method',
        memberName: 'render',
        reason: 'unsupported-helper-returned-template',
        tagName: undefined,
        expression: 'this.renderPartial()',
      },
      {
        className: 'UnsupportedSvg',
        memberKind: 'method',
        memberName: 'render',
        reason: 'unsupported-svg-template',
        tagName: 'svg',
        expression: 'svg`<svg viewBox="0 0 10 10"><text>${this.label}</text></svg>`',
      },
      {
        className: 'PlainHelper',
        memberKind: 'method',
        memberName: 'render',
        reason: 'unsupported-non-component-tagged-template',
        tagName: 'html',
        expression: 'html`<p>Not a LitElement render</p>`',
      },
    ])
  })

  it('leaves unsupported complex css getters unchanged', async () => {
    const source = [
      "import { LitElement, css } from 'lit'",
      '',
      'const buildStyles = () => "helper-styles"',
      '',
      'export class ConditionalGetter extends LitElement {',
      '  static get styles() {',
      '    return tone === "warm" ? css`p { color: red; }` : css`p { color: blue; }`',
      '  }',
      '}',
      '',
      'export class MultipleReturnGetter extends LitElement {',
      '  static get styles() {',
      '    if (tone === "warm") {',
      '      return css`p { color: red; }`',
      '    }',
      '',
      '    return css`p { color: blue; }`',
      '  }',
      '}',
      '',
      'export class ArrayGetter extends LitElement {',
      '  static get styles() {',
      '    return [css`p { color: green; }`]',
      '  }',
      '}',
      '',
      'export class HelperGetter extends LitElement {',
      '  static get styles() {',
      '    return buildStyles()',
      '  }',
      '}',
      '',
      'export class LiteralGetter extends LitElement {',
      '  static get styles() {',
      '    return "p { color: orange; }"',
      '  }',
      '}',
      '',
    ].join('\n')

    const sourceFile = createLitSourceCompressionSourceFile('unsupported-getters.ts', source)
    const result = classifyLitSourceCompressionTargets(sourceFile)

    expect(result.replacementTargets).toEqual([])
    expect(result.unchangedTargets.map((target) => ({
      className: target.className,
      memberKind: target.memberKind,
      memberName: target.memberName,
      reason: target.reason,
      expression: getRangeText(source, target.expressionRange.start, target.expressionRange.end),
    }))).toEqual([
      {
        className: 'ConditionalGetter',
        memberKind: 'getter',
        memberName: 'styles',
        reason: 'unsupported-complex-getter',
        expression: 'tone === "warm" ? css`p { color: red; }` : css`p { color: blue; }`',
      },
      {
        className: 'MultipleReturnGetter',
        memberKind: 'getter',
        memberName: 'styles',
        reason: 'unsupported-complex-getter',
        expression: [
          '{',
          '    if (tone === "warm") {',
          '      return css`p { color: red; }`',
          '    }',
          '',
          '    return css`p { color: blue; }`',
          '  }',
        ].join('\n'),
      },
      {
        className: 'ArrayGetter',
        memberKind: 'getter',
        memberName: 'styles',
        reason: 'unsupported-array-styles',
        expression: '[css`p { color: green; }`]',
      },
      {
        className: 'HelperGetter',
        memberKind: 'getter',
        memberName: 'styles',
        reason: 'unsupported-helper-returned-template',
        expression: 'buildStyles()',
      },
      {
        className: 'LiteralGetter',
        memberKind: 'getter',
        memberName: 'styles',
        reason: 'unsupported-complex-getter',
        expression: '"p { color: orange; }"',
      },
    ])

    const rewriteResult = await rewriteLitSourceCompressionCssGetters(source, 'unsupported-getters.ts')

    expect(rewriteResult).toBeNull()
  })
})
