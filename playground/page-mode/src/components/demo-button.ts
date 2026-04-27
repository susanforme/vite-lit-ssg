import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'

@customElement('demo-button')
export class DemoButton extends LitElement {
  @property({ type: String }) message = 'Hello from child';

  static styles = css`
 button {
  position: relative;
  display: inline-block;
  padding: 12px 30px;
  font-size: 16px;
  font-weight: bold;
  color: #fff;
  text-transform: uppercase;
  letter-spacing: 1px;
  background: linear-gradient(45deg, #ff6ec4, #7873f5);
  border: none;
  border-radius: 50px;
  cursor: pointer;
  overflow: hidden;
  transition: 0.4s;
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
}

button::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%);
  opacity: 0;
  transition: 0.5s;
  transform: rotate(45deg);
}

button:hover::before {
  opacity: 1;
  top: -25%;
  left: -25%;
}

button:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 20px rgba(0,0,0,0.3);
}
  `

  handleClick() {
    alert(
      `Button clicked! Message: ${this.message}`
    )
  }

  render() {
    return html`
      <button @click=${this.handleClick}>button</button>
   `
  }
}

