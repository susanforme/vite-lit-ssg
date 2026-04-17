这个项目现在已经有了 Lit 页面扫描、SSG 输出、元信息注入、single-component 模式、dev watcher 这些基础能力，但还明显停在“能用的核心版”。下一步最值得做的，不是再堆小功能，而是把它做成一个更完整的 Lit 静态站点方案。
先说结论：最值得做的功能
1. 动态路由：支持 [slug]、[...all] 这类参数路由。README 里明确还不支持，RenderContext.params 也已经有类型了，但现在始终是空对象。
2. 布局系统：支持 layout.ts / _layout.ts。现在各页面导航都在重复写，说明已经到了该抽象 layout 的时候。
3. Markdown / 内容源支持：让 src/content/*.md 或 content collections 能直接生成页面，不然这个插件很难承接博客、文档、内容站场景。
4. SEO 自动化：自动生成 sitemap.xml、robots.txt、canonical、OG 基础字段。现在 head/meta 只是手动能力，还不是产品能力。
5. RSS / Feed：如果要做内容站，这基本是标配。
6. i18n 路由能力：你现在已经有 lang 和 dir 类型支持了，再往前一步就是多语言目录和 hreflang。
7. 静态 404 / redirect 支持：dev 里有 404 页面，但构建产物层面还不完整。
8. 构建性能优化：并行渲染、增量构建、缓存 manifest / server build。
9. 插件生命周期钩子：比如 onPagesScanned、onRoutesResolved、onBuildFinished，方便生态扩展。
10. 工程化补齐：CI、ESLint、coverage、release 流程。这个仓库现在是 v0.1.0，但还没有 GitHub Actions，也没看到完整 ESLint 配置，这会限制后续迭代速度。
---
我建议的分阶段计划
Phase 1：先补“产品骨架”
这阶段优先做：
- 动态路由 [slug]
- layout 约定
- 静态 404
- sitemap / robots / canonical 自动生成
这四项做完，项目会从“Lit SSG 原型插件”变成“可正式拿来搭站的插件”。
Phase 2：补“内容站能力”
接着做：
- Markdown / frontmatter 支持
- 标签、分类、分页、归档
- RSS / Atom / JSON Feed
- 文章列表页、详情页生成
这一步做完，你这个项目就能覆盖博客、文档、个人站的主流需求。
Phase 3：补“高级体验”
然后做：
- i18n 多语言路由
- 搜索索引支持（推荐 Pagefind 方向）
- OG 图生成
- redirects / aliases
- build hooks / plugin hooks
这阶段重点是把项目做成“可扩展平台”，不是只提供一条固定路径。
Phase 4：补“工程化和生态”
最后做：
- GitHub Actions：test + typecheck + build
- ESLint / Prettier / coverage
- changesets / 发布流程
- playground 示例升级
- 更完整文档和模板项目
这会直接影响别人敢不敢用、能不能持续维护。
---
如果只选 5 个，我建议按这个顺序做
1. 动态路由
2. 布局系统
3. sitemap / robots / canonical
4. Markdown + frontmatter
5. CI + release 流程
---
为什么我这么排
因为从仓库现状看：
- scanner/pages.ts、build.ts、plugin/index.ts 已经把“文件路由型 SSG”基础打好了；
- README 里明确写了 不支持 dynamic routes / layout，这正是最自然的下一步；
- define-route.ts 已经有 meta/head/lang/htmlAttrs/bodyAttrs，说明 SEO 能力已经有雏形，只差自动化；
- 测试有不少，但 CI 和发布链路还没补齐，这会让后面每加一个功能都更危险。

我判断这是“基于现有实现评估 single-component 模式下一步演进方向”的请求——你要的是路线，不是泛泛建议。我直接按当前仓库结构给你排优先级。
现在这个模式的核心在这些文件里：
- packages/vite-plugin-lit-ssg/src/types.ts
- packages/vite-plugin-lit-ssg/src/plugin/index.ts
- packages/vite-plugin-lit-ssg/src/runner/build-single.ts
- packages/vite-plugin-lit-ssg/src/runtime/render-component.ts
- packages/vite-plugin-lit-ssg/src/virtual/single-client-entry.ts
- packages/vite-plugin-lit-ssg/src/virtual/single-server-entry.ts
当前能力已经有：
- entry
- exportName
- wrapperTag
- preload: inherit | none | entry-only
- 单入口构建
- SSR + hydrate
但也很明显还停在“单组件静态片段输出”的第一阶段。继续增强，我建议分 4 个方向。
---
1. 最值得先做：让 single-component 真正可嵌入
方向 A：支持 SSR props / attributes 注入
现在只能渲染“固定组件”，不能给组件传服务端数据。
可以加：
- props
- attrs
- slots
比如：
litSSG({
  mode: 'single-component',
  entry: 'src/widget.ts',
  props: { title: 'Hello', count: 3 },
  attrs: { 'data-theme': 'dark' },
})
价值最大，因为它会把模式从“演示用”变成“可集成到外部系统”。
主要会动：
- src/types.ts
- src/virtual/single-server-entry.ts
- src/virtual/single-client-entry.ts
- src/runtime/render-component.ts
---
2. 第二优先级：支持多组件/多产物输出
现在 build-single.ts 明显是硬编码单一入口，只产出一个 dist/index.html。
方向 B：支持 entries[]
例如：
litSSG({
  mode: 'single-component',
  entries: [
    { entry: 'src/hero.ts', outFile: 'hero.html' },
    { entry: 'src/pricing.ts', outFile: 'pricing.html' },
  ],
})
这样它就能服务：
- CMS 区块输出
- 设计系统组件快照
- 多 widget 发布
这是 single-component 模式最自然的扩展。
---
3. 第三优先级：增强嵌入场景控制力
方向 C：输出策略可配置
现在 render-component.ts 是“wrapper 内塞 SSR + asset tags”。
可以继续拆成：
- assetPlacement: 'inside-wrapper' | 'after-wrapper' | 'head-snippet'
- output: 'fragment' | 'document'
这样用户可选：
- 纯 fragment
- 带完整 HTML shell 的独立页面
- 只输出 SSR markup，不带 script
- 分离 html / assets / manifest
这会让它更适合被：
- 传统后端模板
- CMS
- 多页系统
- 微前端宿主
接入。
---
4. 第四优先级：补齐生产级能力
方向 D：面向发布和调试的配套能力
这类不炫，但很重要：
1. 静态 props 序列化
   - 把服务端传的初始数据安全注入到客户端，避免 hydrate 不一致
2. hydrate 策略
   - hydrate: eager | visible | idle | none
   - 对嵌入型 widget 很有价值
3. 自定义容器行为
   - 允许不需要 wrapperTag
   - 或输出真实组件本身作为根节点
4. 构建产物 manifest
   - 生成 component-manifest.json
   - 让外部系统知道 html/js/css 各是什么
5. dev 体验
   - 现在 dev 基本只服务 /
   - 可以补 props mock、fixture、热更新日志、更清晰错误页
---
我最推荐的路线
第一批就做这 3 个
1. SSR props / attrs / slots
2. 多 entries 输出
3. output / assetPlacement 策略
因为这三项做完，single-component 模式会从：
> “只能导出一个静态 Lit 片段”
升级成：
> “可以给任何宿主系统消费的组件构建器”
---
## 如果按文件拆任务，大概是这样
### P1
- `src/types.ts`：扩展配置类型
- `src/virtual/single-server-entry.ts`：把 props/attrs 带进 SSR 模板
- `src/virtual/single-client-entry.ts`：hydrate 时对齐初始数据
- `src/runtime/render-component.ts`：支持 slot/asset 输出策略
### P2
- `src/runner/build-single.ts`：从单入口改成 entries 循环
- `src/output/write-route.ts`：支持自定义输出文件名
- tests 补 `multi-entry` 集成测试
### P3
- `src/plugin/index.ts`：增强 dev 模式
- CLI 支持更丰富 single-component 参数
- 生成 manifest 文件
---
一句话建议
如果你想让 single-component 模式继续长成项目亮点，最佳方向不是继续补小选项，而是往这条线走：
“从单个 SSR 片段输出器，进化成可嵌入任意宿主的组件发布模式。”
如果你要，我下一步可以直接给你出一版 single-component 增强 roadmap，按“短期 / 中期 / 长期 + 影响文件 + 实现难度”展开。