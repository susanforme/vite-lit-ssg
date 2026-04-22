import { LitElement, css, html } from 'lit'
import { customElement } from 'lit/decorators.js'

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
    return html`<p>Hello from single-component mode</p>`
  }
}

export { DemoWidget as NamedWidget }
export default DemoWidget
