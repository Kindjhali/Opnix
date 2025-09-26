# index.html Decomposition Plan

## Objective
Refactor the 3,424-line `public/index.html` into manageable partials and asset bundles while keeping the current CDN-based deployment functional.

---

## Proposed File Structure
```
public/
  css/
    base.css           # global resets, typography, theme variables
    header.css         # header + theme toggle styling
    tabs/
      canvas.css
      questions.css
      bugs.css
      features.css
      modules.css
      specs.css
      diagrams.css
      api.css
      docs.css
      markdown.css
      roadmap.css
      tech-stack.css
    terminal.css       # persistent terminal styles
    modals.css         # shared modal layout styles
  templates/
    header.html        # site header + theme toggle
    tabs/
      canvas.html
      questions.html
      ...
      tech-stack.html
    modals/
      ticket-modal.html
      feature-modal.html
      module-modal.html
      markdown-modal.html
  index.html           # slim bootstrap wrapper
```

---

## Migration Phases

| Phase | Work Item | Deliverable | Validation |
| --- | --- | --- | --- |
| 1 | Extract `<style>` block → `css/base.css` + module-specific CSS files. Update `<head>` to link stylesheets (ensure order: base → feature → terminal). | Linked CSS files; inline style removed. | Visual smoke test across tabs. |
| 2 | Move header markup to `templates/header.html`. Fetch + inject via JS (or server-side include). Expose `initHeader(app)` helper that wires theme toggle refs. | `index.html` references `<div data-partial="header"></div>`. | Theme toggle works, header renders once. |
| 3 | Break tab content into template files under `templates/tabs/`. Introduce dynamic loader within Vue (fetch on demand or preload). | For each tab, replace inline HTML with `<component>` that requests template. | Navigate across tabs; ensure content + bindings working. |
| 4 | Extract modal markup into `templates/modals/`; load into `document.body` on mount. | Modal HTML removed from index; JS injects into DOM. | Open/close each modal; ensure focus traps unaffected. |
| 5 | Externalise SVG/icon assets (if any) into dedicated directory; ensure they still inline where needed. | Icons accessible | Visual audit. |
| 6 | Update Express static middleware to serve `public/templates/` and `public/css/`. Add cache headers if needed. | Express config change | `npm start`, verify templates load (no 404). |
| 7 | Clean up `index.html`: leave root container, script tags, and minimal markup (header placeholder, tab container, persistent terminal container). | `index.html` < 300 LOC goal | Lint & diff review. |
| 8 | Write documentation updates (`README.md`, `docs/frontend-refactor-plan.md`) describing new asset layout and how to add templates. | Docs updated | Reviewed by team. |

---

## Implementation Notes
- **Loading Strategy**: use `fetch()` + `innerHTML` for partial injection or minimal templating function. For high-frequency tabs, preload templates on startup to avoid flicker.
- **Accessibility**: ensure ARIA attributes remain on injected content. Consider using `aria-live="polite"` while loading templates.
- **Caching**: apply `const templateCache = new Map()` in the loader to avoid repeated fetches.
- **Testing**: after each phase, run `pnpm lint:js` and `npm run test:modules`; manually check modals/tabs/terminal.
- **Backwards Compatibility**: keep existing IDs/refs so `src/App.vue + src/appOptions.js` continues to find elements until module refactor updates selectors.

---

## Progress Tracker
| Task | Status | Notes |
| --- | --- | --- |
| Extract base styles (`css/base.css`) | ☐ | |
| Create per-tab CSS files (including tech-stack) | ☐ | |
| Move header into `templates/header.html` | ☐ | |
| Move tab markup into `templates/tabs/*.html` (incl. tech-stack) | ☐ | |
| Move modals into `templates/modals/*.html` | ☐ | |
| Update Express static config for new directories | ☐ | |
| Implement template loader in Vue bootstrap | ☐ | |
| Update documentation | ☐ | |

---

Prepared 2025-09-25 — update this doc as partials land.
