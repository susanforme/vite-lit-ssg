import { LitElement, css, html } from 'lit'
import { customElement } from 'lit/decorators.js'
import './demo-button'

@customElement('demo-widget')
export class DemoWidget extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: sans-serif;
    }
    p { color: blue; }
  `

  render() {
    return html`<div>
      <p>Hello from single-component mode</p>
      <demo-button message="Hello from parent"></demo-button>
    </div>`
  }
}

export { DemoWidget as NamedWidget }
export default DemoWidget
