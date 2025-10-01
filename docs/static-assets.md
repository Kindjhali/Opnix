# Static Asset Delivery

The Express server mounts two static routers via `createStaticRoutes`:

- `/` serves everything under `public/` for the SPA shell and bundler output (JS modules, fonts, images).
- `/css` serves the theme styles in `public/css/` (`base.css`, `theme-mole.css`, `theme-canyon.css`) with a 1 hour cache.

The routing is configured in `server.js` around the middleware bootstrap:

```js
app.use(createStaticRoutes({ rootDir: ROOT_DIR, maxAge: '1h' }));
app.use(createStaticRoutes({
  rootDir: ROOT_DIR,
  sourceDir: 'public/css',
  mountPath: '/css',
  maxAge: '1h'
}));
```

Automated coverage:

- `tests/apiSmoke.test.mjs` requests `/css/base.css` to ensure the dedicated CSS mount point responds with `text/css`.
- The Vite bundle (`public/assets/main.js`) is delivered by the root static router, confirmed by the same smoke test suite.

When adding new assets, drop them under `public/` (or a subdirectory) and the existing routers will expose them without extra configuration.
