# vite-plugin-lit-ssg

[English](./README.md) | **简体中文**

一个用于 [Lit](https://lit.dev) 静态站点生成的 Vite 插件。它会在构建时使用 [Lit SSR](https://lit.dev/docs/ssr/overview/) 将路由渲染为静态 HTML，然后把 Vite 构建出的客户端 JS/CSS 注入到每个页面中。

约定优于配置：把页面文件放进 `src/pages/`，然后执行一条命令即可。

当前仓库已经演进为一个 **pnpm monorepo**，其中包含发布包本体、测试套件，以及分别用于 page mode 和 single-component mode 的两个 playground 应用。

## 功能特性

- 基于 Lit SSR（`@lit-labs/ssr`）的构建时预渲染
- **零必填配置** —— 自动从 `src/pages/` 发现路由
- 通过 `defineLitRoute()` 定义页面级元信息 —— 标题、语言、meta 标签等
- 基于约定的页面扫描，支持 `.ts`、`.tsx`、`.js`、`.jsx`
- 通过 `commonStyles` 注入共享组件样式，并合并进组件 `static styles`
- 支持使用 `ignore` 跳过 `src/pages/` 中的非路由文件
- 自动从 Vite manifest 注入 JS/CSS 资源
- 支持带 Shadow DOM 的 `LitElement`（输出 Declarative Shadow DOM）
- 可选 single-component mode，用于输出可嵌入的 SSR 片段
- 可配置 Declarative Shadow DOM polyfill 注入
- 输出纯静态文件，可部署到任意静态托管平台
- 单条命令（`vite-lit-ssg build`）完成整体构建

## 安装

```bash
npm install vite-plugin-lit-ssg lit vite
```

> `vite` 和 `lit` 是 peer dependencies。`@lit-labs/ssr` 会作为 `vite-plugin-lit-ssg` 的传递依赖一并安装。

## 快速开始

### 1. 配置 Vite

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { litSSG } from 'vite-plugin-lit-ssg'

export default defineConfig({
  plugins: [litSSG()], // 零配置即可开始
})
```

### 2. 添加构建脚本

```json
{
  "scripts": {
    "build": "vite-lit-ssg build"
  }
}
```

### 3. 创建页面文件

```ts
// src/pages/index.ts
import { LitElement, html } from 'lit'
import { customElement } from 'lit/decorators.js'
import { defineLitRoute } from 'vite-plugin-lit-ssg/browser'

@customElement('home-page')
export class HomePage extends LitElement {
  render() {
    return html`<h1>Welcome</h1>`
  }
}

export default defineLitRoute({
  component: HomePage,
  title: 'Home | My Site',
  meta: [{ name: 'description', content: 'My home page' }],
})
```

```ts
// src/pages/about.ts
import { LitElement, html } from 'lit'
import { customElement } from 'lit/decorators.js'
import { defineLitRoute } from 'vite-plugin-lit-ssg/browser'

@customElement('about-page')
export class AboutPage extends LitElement {
  render() {
    return html`<h1>About</h1>`
  }
}

export default defineLitRoute({
  component: AboutPage,
  title: 'About | My Site',
})
```

### 4. 构建

```bash
npm run build
```

会生成一个可直接部署的 `dist/` 目录：

```text
dist/
  index.html          ← 来自 src/pages/index.ts
  about/
    index.html        ← 来自 src/pages/about.ts
  assets/
    [hash].js
```

如果你想指定非默认的 Vite 配置文件或构建 mode，可以这样执行：

```bash
vite-lit-ssg build --config vite.config.ts --mode production
```

## 页面文件约定

将页面模块放在 `src/pages/` 下。支持子目录，目录结构会直接映射为路由层级：

| 文件 | 路由 |
|---|---|
| `src/pages/index.ts` | `/` |
| `src/pages/about.ts` | `/about` |
| `src/pages/blog/index.ts` | `/blog` |
| `src/pages/blog/post.ts` | `/blog/post` |

- 支持的扩展名：`.ts`、`.tsx`、`.js`、`.jsx`
- 文件名和目录名保持原样使用（不会自动做大小写转换）
- 任意目录层级中的 `index.ts` 都会解析为父级路由（例如 `blog/index.ts` → `/blog`）
- 如果两个文件会解析成同一路由（例如 `about.ts` 和 `about/index.ts`），启动时会直接报错
- 如果 `src/pages/` 中同时放了 `components/`、`layouts/` 等辅助目录，建议配合 `ignore` 选项使用

## `defineLitRoute()` API

每个页面文件都必须默认导出一个 `defineLitRoute()` 调用：

```ts
import { defineLitRoute } from 'vite-plugin-lit-ssg/browser'

export default defineLitRoute({
  component: MyComponent,   // 必填：你的 LitElement 类
  title?: string,           // <title> 标签
  lang?: string,            // <html lang="...">（默认值：'en'）
  meta?: Array<Record<string, string>>,  // <meta> 标签
  head?: string[],          // 直接追加到 <head> 的原始 HTML 字符串
  htmlAttrs?: Record<string, string>,    // 额外的 <html> 属性
  bodyAttrs?: Record<string, string>,    // 额外的 <body> 属性
})
```

组件类必须使用 `@customElement` 装饰器 —— 标签名会通过 `customElements.getName()` 自动解析。

## 插件选项

`litSSG()` 不传参数时默认启用 **page mode**。如果你需要输出单个可嵌入组件，也可以切换到 `single-component` mode。

### Page Mode（默认）

```ts
litSSG({
  pagesDir?: string
  ignore?: string | string[] | ((relPath: string) => boolean)
  commonStyles?: Array<{ file: string }>
  injectPolyfill?: boolean
})
```

| 选项 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `pagesDir` | `string` | `'src/pages'` | 页面扫描目录 |
| `ignore` | `string \| string[] \| ((relPath: string) => boolean)` | — | 跳过 `pagesDir` 中的文件或目录，适合页面目录中混放辅助文件的场景 |
| `commonStyles` | `Array<{ file: string }>` | — | 相对于项目根目录解析的共享样式文件，会被预先合并到每个目标组件的 `static styles` 中 |
| `injectPolyfill` | `boolean` | `true` | 注入 Declarative Shadow DOM polyfill 脚本。如果只面向原生支持 DSD 的环境，可设为 `false` |

**示例：**

```ts
litSSG({
  pagesDir: 'src/pages',
  ignore: ['components', 'layouts'],
  commonStyles: [{ file: 'src/styles/common.css' }],
})
```

`commonStyles` 会直接合并到组件样式中，而不是生成顶层的 `<link rel="stylesheet">`，这样 Shadow DOM 的输出会更自包含。

### Single-Component Mode

```ts
litSSG({
  mode: 'single-component',
  entry: string,
  commonStyles?: Array<{ file: string }>,
  exportName?: string,
  wrapperTag?: string | (() => string),
  preload?: 'inherit' | 'none' | 'entry-only',
  injectPolyfill?: boolean,
  dsdPendingStyle?: boolean,
})
```

| 选项 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `mode` | `'single-component'` | — | 启用单组件构建模式 |
| `entry` | `string` | — | 组件模块路径（例如 `src/my-element.ts`） |
| `commonStyles` | `Array<{ file: string }>` | — | 预先合并进渲染组件样式的共享样式文件 |
| `exportName` | `string` | `'default'` | 要使用的组件导出名 |
| `wrapperTag` | `string \| (() => string)` | `'lit-ssg-root'` | 包裹 SSR 输出的自定义元素标签 |
| `preload` | `string` | `'inherit'` | 控制 `<link rel="modulepreload">` 的注入方式：`inherit` = 保留全部预加载，`none` = 移除 modulepreload（保留 CSS），`entry-only` = 仅保留入口脚本（不输出 CSS / preload） |
| `injectPolyfill` | `boolean` | `false` | 在片段输出中注入 Declarative Shadow DOM polyfill 脚本，适合嵌入到不一定支持原生 DSD 的页面中 |
| `dsdPendingStyle` | `boolean` | `true`（当 `injectPolyfill` 为 `true` 时） | 注入 `<style>wrapper-tag[dsd-pending]{display:none}</style>` 并给 wrapper 增加 `dsd-pending` 属性，以避免 FOUC，仅在 `injectPolyfill` 开启时生效 |

**示例：**

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { litSSG } from 'vite-plugin-lit-ssg'

export default defineConfig({
  plugins: [litSSG({
    mode: 'single-component',
    entry: 'src/my-widget.ts',
    commonStyles: [{ file: 'src/common.css' }],
    exportName: 'default',    // 也可以是类似 'MyWidget' 这样的具名导出
    wrapperTag: 'my-app',
    preload: 'entry-only',
  })],
})
```

**输出形式** —— 生成单个 `dist/index.html`（只包含 SSR 片段和客户端 hydration 脚本，不带 HTML shell）：

```html
<my-app>
  <my-widget>
    <template shadowrootmode="open"><!-- SSR content --></template>
  </my-widget>
</my-app>
<script type="module" src="/assets/my-widget-abc123.js"></script>
```

输出中不会包含 `<!doctype>`、`<html>`、`<body>` —— 只有 SSR 片段以及后置的客户端模块脚本。你可以把它直接嵌入到已有页面中。

`preload` 选项决定 wrapper 后面附加哪些资源标签：
- `inherit`（默认）—— CSS `<link>` + `<link rel="modulepreload">` + `<script type="module">`
- `none` —— CSS `<link>` + `<script type="module">`（不输出 modulepreload）
- `entry-only` —— 仅 `<script type="module">`（不输出 CSS，也不输出 modulepreload）

当你使用 `commonStyles` 时，配置的样式会同时注入到构建产物和 hydration bundle 对应的组件样式中。为了确保样式注入可靠，组件导出应保持静态可分析，例如命名类、命名导入或命名导出绑定。

**注意：** single-component mode **不支持** 页面级 API（`title`、`meta`、`lang`、`head`、`htmlAttrs`、`bodyAttrs`）。如果你需要页面元信息，请使用 page mode。

不传参数的 `litSSG()` 始终表示 **page mode**，并保持向后兼容。

## 工作原理

### Page mode

1. **扫描页面** —— 递归发现 `src/pages/**/*.{ts,tsx,js,jsx}` 并映射为路由
2. **收集共享样式** —— 可选的 `commonStyles` 会内联到目标 Lit 组件中
3. **客户端构建** —— Vite 使用虚拟入口收集所有页面并生成客户端 JS/CSS
4. **服务端构建** —— Vite 生成一个包含 `render()` 分发逻辑的 Node.js SSR bundle
5. **渲染路由** —— 每个路由通过 Lit SSR 的 `render()` + `collectResult()` 渲染
6. **注入资源** —— 从 Vite manifest 中解析 JS/CSS 并注入到 `<head>`
7. **写出 HTML** —— 每个路由输出到 `dist/<route>/index.html`
8. **清理临时文件** —— 删除中间服务端构建产物

### Single-component mode

1. **客户端构建** —— 从组件入口生成客户端 bundle（包含 Lit hydration 支持）
2. **收集共享样式** —— 可选的 `commonStyles` 会预先合并到导出组件的样式中
3. **服务端构建** —— 为该组件生成 Node.js SSR bundle
4. **渲染组件** —— 使用 Lit SSR 的 `render()` + `collectResult()` 渲染组件，并包裹在 `wrapperTag` 中
5. **注入资源** —— 根据 `preload` 选项，把 JS/CSS/modulepreload 标签追加在 wrapper 之后
6. **写出 HTML** —— 输出到 `dist/index.html`，作为可嵌入片段
7. **清理临时文件** —— 删除中间服务端构建产物

## 本地开发

本仓库使用 **pnpm workspaces**：

```text
.
├─ packages/
│  ├─ vite-plugin-lit-ssg
│  └─ vite-plugin-lit-ssg-tests
└─ playground/
   ├─ page-mode
   └─ single-component-app
```

先在仓库根目录安装依赖：

```bash
pnpm install
```

常用根目录命令：

```bash
pnpm build              # 构建发布包
pnpm dev                # 使用 tsc watch 监听包源码
pnpm typecheck          # 对包执行类型检查
pnpm test               # 运行 Vitest 测试套件
pnpm playground:build   # 构建 page-mode playground
pnpm playground:preview # 预览 page-mode playground 构建结果
```

Playground 相关目录：

- `playground/page-mode` —— 基于约定的 page-mode 示例
- `playground/single-component-app` —— 带 `inherit`、`none`、`entry-only` 三种 preload 变体的 single-component 示例

示例：

```bash
pnpm --filter playground build
pnpm --filter single-component-fixture build:entry-only
```

## 不包含的能力

- 不是在线 SSR 服务 —— 输出的是纯静态文件
- 不是 partial hydration / islands 框架
- 不是动态路由系统 —— 不支持 `[slug].ts` 这类参数化路由
- 不是嵌套路由布局系统 —— 不支持 `layout.ts` 约定

## License

MIT
