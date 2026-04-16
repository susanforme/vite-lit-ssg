import { LitElement, html, css } from 'lit'
import { customElement } from 'lit/decorators.js'
import { defineLitRoute } from 'vite-plugin-lit-ssg'

@customElement('test-page')
export class TestPage extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
    }

    h1 {
      color: #333;
    }

    nav a {
      margin-right: 1rem;
      color: #0066cc;
      text-decoration: none;
    }

    nav a:hover {
      text-decoration: underline;
    }

    ul {
      line-height: 1.8;
    }
  `

  render() {
    return html`
      <div>test</div>
    `
  }
}

export default defineLitRoute({
  component: TestPage,
  title: 'Test | vite-plugin-lit-ssg',
  meta: [{ name: 'description', content: 'Test vite-plugin-lit-ssg' }],
})
