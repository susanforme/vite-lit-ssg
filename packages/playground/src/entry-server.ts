import { html } from 'lit'
import './pages/home-page.js'
import './pages/about-page.js'
import type { PageRenderResult, RenderContext } from 'vite-plugin-lit-ssg'

export async function render(url: string, _ctx: RenderContext): Promise<PageRenderResult> {
  switch (url) {
    case '/':
      return {
        template: html`<home-page></home-page>`,
        title: 'Home | vite-plugin-lit-ssg',
        meta: [{ name: 'description', content: 'Lit SSG home page' }],
      }

    case '/about':
      return {
        template: html`<about-page></about-page>`,
        title: 'About | vite-plugin-lit-ssg',
        meta: [{ name: 'description', content: 'About vite-plugin-lit-ssg' }],
      }

    default:
      return null
  }
}
