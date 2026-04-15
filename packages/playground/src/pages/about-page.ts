import { LitElement, html, css } from 'lit'
import { customElement } from 'lit/decorators.js'

@customElement('about-page')
export class AboutPage extends LitElement {
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
      <nav>
        <a href="/">Home</a>
        <a href="/about">About</a>
      </nav>
      <h1>About</h1>
      <p>vite-plugin-lit-ssg is a Vite plugin for generating static sites with Lit.</p>
      <ul>
        <li>Build-time prerendering with Lit SSR</li>
        <li>Automatic JS/CSS asset injection</li>
        <li>Support for page-level title and meta tags</li>
        <li>Deploy anywhere as static files</li>
      </ul>
    `
  }
}
