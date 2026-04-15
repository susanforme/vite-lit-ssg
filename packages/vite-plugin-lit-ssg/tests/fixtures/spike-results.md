# Spike results

## 1. `customElements.getName()` availability

- **Availability:** YES
- **Why:** In the Lit SSR Node.js environment, `@lit-labs/ssr/lib/dom-shim.js` installs a `CustomElementRegistry` shim that implements `getName()`. After `@customElement('test-el')` registration, `customElements.getName(TestEl)` returns `test-el`.

Observed output:

```txt
dom-shim loaded
customElements.getName(TestEl): test-el
typeof customElements.getName: function
customElements.get("test-el") === TestEl: true
TestEl.tagName: undefined
TestEl.__litTagName: undefined
TestEl.__localName: test-el
TestEl[Symbol.for("litTagName")]: undefined
```

Fallback observations:

- `component.tagName` did **not** work on the class.
- `component.__litTagName` did **not** work.
- `component.__localName` **did** contain `test-el`, because the SSR custom elements registry shim stores the defined tag name on the constructor.

## 2. `manifest.json` `isEntry: true` format

The spike build produced `Object.entries(manifest).filter(([, entry]) => entry.isEntry)` output in this shape:

```json
[
  [
    "src/entry-client.ts",
    {
      "file": "assets/entry-client-BcUAflNl.js",
      "name": "entry-client",
      "src": "src/entry-client.ts",
      "isEntry": true
    }
  ]
]
```

Format notes:

- The manifest key is the source path (`src/entry-client.ts`).
- The value is a manifest entry object containing at least `file`, `name`, `src`, and `isEntry`.
- Scanning by `entry.isEntry === true` works without relying on a configured `entryClient` key.

## 3. Recommendation for T4 virtual module code generation

- Generated server entry code can safely use `customElements.getName(component)` in the Lit SSR environment.
- If a defensive fallback is still desired, prefer `component.__localName` based on the SSR shim result from this spike; `component.tagName` and `component.__litTagName` were `undefined` in the class-based test.
- For manifest lookup work (T5/T6), consume `Object.entries(manifest)` and select entries where `entry.isEntry` is `true` instead of depending on the old `entryClient` path key.
