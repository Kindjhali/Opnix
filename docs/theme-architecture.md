# Theme Architecture

Opnix ships with two fully themed experiences (MOLE and CANYON). The theme system is modular so that any surface can be restyled without touching the monolithic legacy stylesheet.

## Directory Layout

_Status tokens + gradients_: `--status-pending`, `--status-active`, `--status-completed`, `--status-blocked` (and corresponding `*-bg`) now live in the theme stylesheets so components can draw consistent palette cues.

_Surface & overlay tokens_: `--surface-primary`, `--surface-elevated`, `--surface-card`, `--glass-overlay-strong`, `--glass-overlay-soft`, `--glass-overlay-subtle`, `--shadow-medium`, `--shadow-elevated`, `--text-on-accent`, and `--status-border-muted` now give roadmap components consistent backgrounds and elevation without hard-coded RGBA values.


```
public/css/
├── base.css                 # Root imports + global tokens
├── base/utilities.css       # Resets, typography, animation helpers
├── tabs/*.css               # Tab-specific bundles (Docs, Roadmap, Terminal, Canvas, Modules, Specs)
├── components/*.css         # Component-scoped bundles (header, workbench, command centre, terminal panel…)
├── theme-mole.css           # MOLE theme variables + palette hooks
└── theme-canyon.css         # CANYON theme variables + palette hooks
```

Key principles:

- `base.css` only wires shared utilities and imports the tab/component bundles.
- Tab bundles target layouts such as `DocsTab`, `RoadmapTab`, or `TerminalPanel` containers.
- Component bundles mirror Vue components (e.g., `public/css/components/terminal-panel.css`).
- Theme variables live exclusively in `theme-*.css` so the runtime can swap palettes without rewriting selectors.

## Runtime Flow

1. **Bootstrap** – The HTML shell (`public/index.html`) links `base.css` and a single managed theme stylesheet via `<link id="opnix-theme-link">`.
2. **State** – The app store exposes `currentTheme`, `themeLoading`, and `themeError` so the UI can react to theme swaps (`src/composables/appStore.js`).
3. **Loader** – `setThemeFlow` in `src/composables/themeManager.js`:
   - Resolves the desired theme URL.
   - Lazily creates/updates the managed `<link>` element.
   - Waits for the stylesheet load event and persists the theme to `localStorage`.
   - Applies `data-theme` attributes for component hooks and reconfigures Mermaid + Cytoscape if present.
4. **Persistence** – The selected theme is stored under `opnixTheme` so reloads honour the last choice.
5. **CLI/Tests** – `tests/themeManager.test.mjs` stubs the DOM to validate theme swaps, persistence, and error handling under stylelint + Node.

## Adding a Theme

1. Create a new stylesheet under `public/css/theme-<name>.css` defining the required CSS variables (mirroring the existing files).
2. Register the theme in `THEME_STYLESHEETS` within `src/composables/themeManager.js`.
3. Add any theme-specific Mermaid palette overrides to `configureMermaidTheme` if necessary.
4. Run `pnpm lint:css` and `pnpm test:modules` to ensure the loader and automated suite remain green.

## Maintenance Checklist

- Keep `TODO.md` → "Theme Architecture Enhancement" updated when migrating bundles or adding new themes.
- When touching shared selectors, confirm both themes still render correctly (manual smoke across key tabs).
- Prefer adding new rules to the relevant component or tab bundle instead of `base.css`.
- Time-to-first-paint stays low because only the active theme is linked; avoid introducing blocking imports outside of `base.css`.

## Related Documents

- `docs/css-modularisation-plan.md` – phased breakdown of the ongoing CSS split.
- `README.md` – contains a high-level summary of the theme switcher for onboarding.
- `docs/internal-delivery-tracker.md` – tracks the broader frontend modularisation milestone.


## Manual Verification
- Automated tests ensure theme swaps succeed quickly and persist choices.
- Pending: full MOLE/CANYON visual sweep across tabs + devtools inspection to confirm no regressions.

