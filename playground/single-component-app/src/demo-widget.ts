import { LitElement, css, html } from 'lit'
import { customElement } from 'lit/decorators.js'

@customElement('demo-widget')
export class DemoWidget extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: sans-serif;
    }

    p {
      color: blue;
    }
  `

  handleClick() {
    alert('Button clicked!')
  }

  render() {
    return html`<div>
      <p>Hello from single-component mode</p>
      <button @click=${this.handleClick}>button</button>
    </div>`
  }
}

export { DemoWidget as NamedWidget }
export default DemoWidget
