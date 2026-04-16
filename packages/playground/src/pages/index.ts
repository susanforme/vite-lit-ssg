import { LitElement, html, css } from 'lit'
import { customElement } from 'lit/decorators.js'
import { defineLitRoute } from 'vite-plugin-lit-ssg'

@customElement('home-page')
export class HomePage extends LitElement {
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
  `
  handleClick() {
    alert('Button clicked!')
  }

  render() {
    return html`
      <nav>
        <a href="/">Home</a>
        <a href="/about">About</a>
      </nav>
      <h1>Welcome to vite-plugin-lit-ssg</h1>
      <p>This page was statically generated using Lit SSR and Vite.</p>
      <p>It supports LitElement with Shadow DOM, server-side rendering, and client-side hydration.</p>
      <button @click=${this.handleClick}>Click me</button>
    `
  }
}

export default defineLitRoute({
  component: HomePage,
  title: 'Home | vite-plugin-lit-ssg',
  meta: [{ name: 'description', content: 'Lit SSG home page' }],
})
