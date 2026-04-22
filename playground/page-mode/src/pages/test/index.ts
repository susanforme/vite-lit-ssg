import { LitElement, html, css } from 'lit'
import { customElement } from 'lit/decorators.js'
import { defineLitRoute } from 'vite-plugin-lit-ssg/browser'

@customElement('test-page')
export class TestPage extends LitElement {
  static styles = css`
    div{
      color: red;
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
