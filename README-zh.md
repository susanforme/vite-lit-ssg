# vite-plugin-lit-ssg

[English](./README.md) | **简体中文**

> [!WARNING]
> 当前版本为 **alpha**（`0.0.1-alpha.1`），API 和输出格式在正式发布前仍可能变化。不建议在生产环境中使用。

专为 [Lit](https://lit.dev) Web Components 设计的构建时静态站点生成器。把 `LitElement` 页面文件放进 `src/pages/`，执行一条命令，就能得到可部署到任意静态托管平台的完整预渲染静态站点——无需服务器。

## 为什么选择 vite-plugin-lit-ssg

- **零配置** —— 路由自动从 `src/pages/` 发现，无需维护路由清单。
- **真正的 SSR 预渲染** —— 页面在构建时通过 [Lit SSR](https://lit.dev/docs/ssr/overview/) 渲染为真实 HTML，用户不必等待 JS 即可看到内容。
- **完整 Lit 兼容** —— Shadow DOM、`@customElement`、装饰器、`LitElement` 生命周期均按预期工作，无需额外包装层。
- **单条命令** —— `vite-lit-ssg build` 取代普通的 `vite build`，一步完成客户端构建、SSR 渲染和 HTML 写出。
- **部署到任意平台** —— `dist/` 里是纯静态 HTML 文件，Netlify、GitHub Pages、S3、Vercel 等任意静态托管均可直接部署。

## 安装

```bash
npm install vite-plugin-lit-ssg lit vite
```

`vite` 和 `lit` 是 peer dependencies。`@lit-labs/ssr` 会自动拉取。

## 快速开始

### 1. 添加插件

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { litSSG } from 'vite-plugin-lit-ssg'

export default defineConfig({
  plugins: [litSSG()],
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

### 3. 创建页面

```ts
// src/pages/index.ts
import { LitElement, html } from 'lit'
import { customElement } from 'lit/decorators.js'
import { defineLitRoute } from 'vite-plugin-lit-ssg/browser'

@customElement('home-page')
export class HomePage extends LitElement {
  render() {
    return html`<h1>Hello, world</h1>`
  }
}

export default defineLitRoute({
  component: HomePage,
  title: 'Home',
})
```

### 4. 构建

```bash
npm run build
```

`dist/` 中的输出可直接部署：

```
dist/
  index.html
  about/
    index.html
  assets/
    [hash].js
```

## 页面路由

`src/pages/` 中的文件直接映射为路由：

| 文件 | 路由 |
|---|---|
| `src/pages/index.ts` | `/` |
| `src/pages/about.ts` | `/about` |
| `src/pages/blog/index.ts` | `/blog` |
| `src/pages/blog/post.ts` | `/blog/post` |

支持的扩展名：`.ts`、`.tsx`、`.js`、`.jsx`。

使用 `ignore` 选项可以跳过 `src/pages/` 内的非路由目录（如 `components/`、`layouts/`）。

## 页面元数据

每个页面导出一个 `defineLitRoute()` 调用来设置 HTML 元数据：

```ts
import { defineLitRoute } from 'vite-plugin-lit-ssg/browser'

export default defineLitRoute({
  component: MyPage,
  title: 'My Page',
  lang: 'zh',
  meta: [{ name: 'description', content: '页面描述' }],
  head: ['<link rel="canonical" href="https://example.com/">'],
  htmlAttrs: { 'data-theme': 'light' },
  bodyAttrs: { class: 'page-home' },
})
```

## 插件选项

### Page Mode（默认）

```ts
litSSG({
  pagesDir?: string                                        // 默认：'src/pages'
  ignore?: string | string[] | ((relPath: string) => boolean)
  commonStyles?: Array<{ file: string }>                   // 每个组件将共享 CSS 预先合并
  injectPolyfill?: boolean                                 // 默认：true
})
```

### Single-Component Mode

不生成完整站点，而是输出单个可嵌入的 SSR 片段——适合将预渲染的 Lit 组件嵌入到现有页面或 CMS 中。

```ts
litSSG({
  mode: 'single-component',
  entry: 'src/my-widget.ts',
  exportName?: string,                   // 默认：'default'
  wrapperTag?: string | (() => string),  // 默认：'lit-ssg-root'
  preload?: 'inherit' | 'none' | 'entry-only',
  commonStyles?: Array<{ file: string }>,
  injectPolyfill?: boolean,              // 默认：false
  dsdPendingStyle?: boolean,
})
```

输出为可嵌入的 HTML 片段（不带 `<!doctype>`、不带 `<html>` shell），写入 `dist/index.html`。

## 不包含的能力

- 不是在线 SSR 服务——输出的是纯静态文件
- 不是 partial hydration / islands 框架
- 暂无动态路由——不支持 `[slug].ts` 参数化路由
- 暂无嵌套布局系统——不支持 `layout.ts` 约定

## License

MIT
