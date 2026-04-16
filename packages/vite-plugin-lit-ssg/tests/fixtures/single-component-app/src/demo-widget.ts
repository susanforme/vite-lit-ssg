import { LitElement, html } from 'lit'
import { customElement } from 'lit/decorators.js'

@customElement('demo-widget')
export class DemoWidget extends LitElement {
  render() {
    return html`<p>Hello from single-component mode</p>`
  }
}

export { DemoWidget as NamedWidget }
export default DemoWidget
