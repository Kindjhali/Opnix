# E2E Testing Guide

## Overview

Opnix includes comprehensive end-to-end (E2E) tests using Playwright to verify the complete user experience. The test suite captures screenshots at every interaction point to document the user journey.

## Test Coverage

The E2E test suite covers:

### Navigation & Layout
- ✅ Application loading and initialization
- ✅ App header and branding visibility
- ✅ Tab navigation (Canvas, Modules, Roadmap, Bugs, Features, Specs, Docs, API, Diagrams, Storybook)
- ✅ Workbench strip (terminal, statusline)
- ✅ Responsive layout (desktop, mobile portrait/landscape)

### Theme System
- ✅ Theme switcher functionality
- ✅ MOLE theme rendering
- ✅ CANYON theme rendering
- ✅ Theme persistence across navigation

### Interactive Features
- ✅ Command Center (open/close)
- ✅ Module detection
- ✅ Create new ticket/bug modal
- ✅ Create new feature modal
- ✅ Roadmap view toggle (minimal/detailed)
- ✅ Canvas zoom and pan controls
- ✅ Docs file browser navigation
- ✅ Export functionality

### Keyboard Shortcuts
- ✅ Ctrl+K (Command Center)
- ✅ ESC (Close modals)

### Viewport Testing
- ✅ Desktop (1920x1080)
- ✅ Mobile portrait (375x667)
- ✅ Mobile landscape (667x375)

## Running Tests

### Run all E2E tests
```bash
pnpm test:e2e
```

### Run with UI mode (interactive)
```bash
pnpm test:e2e:ui
```

### Run in headed mode (see browser)
```bash
pnpm test:e2e:headed
```

### Debug mode
```bash
pnpm test:e2e:debug
```

### View test report
```bash
pnpm test:e2e:report
```

## Test Structure

The main test file is located at: `tests/e2e/full-user-journey.spec.js`

The test is organized into 26 sequential test cases that follow a complete user journey:

1. **Initial Load** - App loads correctly
2. **Header** - Branding visible
3. **Themes** - Theme switching works
4-13. **Navigation** - All tabs accessible
14. **Command Center** - Opens and closes
15-16. **Status Panels** - Statusline and terminal visible
17. **Module Detection** - Scan functionality works
18-19. **Modals** - Create ticket/feature modals work
20. **Roadmap Views** - View toggle works
21. **Canvas Controls** - Zoom/pan work
22. **Docs Browser** - File navigation works
23. **Export** - Download functionality works
24. **Keyboard** - Shortcuts work
25. **Responsive** - Mobile layouts work
26. **Final Overview** - Complete application state

## Screenshots

Screenshots are automatically captured at each test step and saved to:
```
test-results/screenshots/
```

Screenshot naming convention:
- `01-app-loaded.png` - Initial app load
- `02-app-header.png` - Header verification
- `03a-theme-mole.png` - MOLE theme
- `03b-theme-canyon.png` - CANYON theme
- `04-tab-canvas.png` through `13-tab-storybook.png` - Tab navigation
- `14-command-center-open.png` - Command center
- ... and so on

## Configuration

Playwright configuration is in `playwright.config.js`:

- **Browser**: Chromium (Desktop Chrome)
- **Viewport**: 1920x1080 default
- **Timeout**: 60 seconds per test
- **Workers**: 1 (sequential execution)
- **Screenshots**: Captured on every test
- **Video**: Retained on failure
- **Trace**: Retained on failure

## Test Server

The test suite automatically starts the Opnix server before running tests:
- **URL**: http://localhost:3000
- **Command**: `npm start`
- **Reuses server**: Yes (if already running)

## Best Practices

### Writing New E2E Tests

1. **Use data attributes** for reliable selectors:
   ```javascript
   await page.locator('[data-testid="my-element"]')
   ```

2. **Wait for stability** before interacting:
   ```javascript
   await page.waitForLoadState('networkidle');
   await page.waitForTimeout(1000); // Allow animations
   ```

3. **Capture screenshots** at key moments:
   ```javascript
   await page.screenshot({
     path: 'test-results/screenshots/my-test.png',
     fullPage: true
   });
   ```

4. **Use descriptive test names**:
   ```javascript
   test('07 - Tab navigation - Tickets/Bugs tab', async ({ page }) => {
     // Test code
   });
   ```

5. **Gracefully handle missing elements**:
   ```javascript
   if (await element.isVisible()) {
     // Test the element
   } else {
     console.log('⚠ Element not found, skipping');
   }
   ```

### Debugging Failed Tests

1. **View test report**:
   ```bash
   pnpm test:e2e:report
   ```

2. **Run in headed mode** to see what's happening:
   ```bash
   pnpm test:e2e:headed
   ```

3. **Use debug mode** to step through tests:
   ```bash
   pnpm test:e2e:debug
   ```

4. **Check screenshots** in `test-results/screenshots/`

5. **Check trace files** in `test-results/` (if test failed)

## CI/CD Integration

The E2E tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Install dependencies
  run: pnpm install

- name: Install Playwright browsers
  run: npx playwright install --with-deps chromium

- name: Run E2E tests
  run: pnpm test:e2e

- name: Upload screenshots
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-screenshots
    path: test-results/screenshots/

- name: Upload test report
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: test-results/playwright-report/
```

## Maintenance

### Updating Tests

When adding new features:

1. Add test case to `tests/e2e/full-user-journey.spec.js`
2. Follow the existing numbering convention
3. Capture screenshots at key interaction points
4. Update this documentation

### Screenshot Management

Screenshots can grow large over time. Consider:

- Gitignoring `test-results/` directory
- Archiving old screenshots
- Using CI artifacts for screenshot storage

## Troubleshooting

### Test hangs or times out
- Increase timeout in `playwright.config.js`
- Check if server is running correctly
- Look for missing `waitForLoadState` calls

### Screenshots are blank
- Ensure element is visible before screenshot
- Add `waitForTimeout` after navigation
- Use `fullPage: true` for complete captures

### Elements not found
- Check if feature is behind feature flag
- Verify element exists in current UI
- Use more flexible selectors (`:has-text`, `first()`)

### Server won't start
- Check if port 3000 is available
- Verify `npm start` works manually
- Check server logs in test output

## Related Documentation

- [Playwright Documentation](https://playwright.dev)
- [Testing Strategy](./testing-todo.md)
- [Frontend Architecture](./frontend-refactor-plan.md)
- [Theme Architecture](./theme-architecture.md)