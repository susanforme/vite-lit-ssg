import { LitElement, html } from 'lit'
import { customElement } from 'lit/decorators.js'
import { defineLitRoute } from '../../../../../vite-plugin-lit-ssg/src/index.js'

@customElement('home-page')
export class HomePage extends LitElement {
  render() {
    return html`<h1>Hello from SSR</h1>`
  }
}

export default defineLitRoute({
  component: HomePage,
  title: 'Home | Fixture',
  lang: 'en',
})
