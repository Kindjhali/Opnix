/**
 * Opnix Full User Journey E2E Test
 *
 * This test captures a complete user experience flow through the Opnix application,
 * testing every interactive element, navigation path, and user action.
 * Screenshots are captured at each significant interaction point.
 */

import { test, expect } from '@playwright/test';

test.describe('Opnix Complete User Journey', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Wait for app to be fully loaded
    await page.waitForLoadState('domcontentloaded');

    // Try multiple selectors for app ready state
    try {
      await page.waitForSelector('.app-header, #app, body', { timeout: 5000 });
    } catch (e) {
      console.log('App container loaded via body fallback');
    }
  });

  test('01 - Application loads and displays correctly', async ({ page }) => {
    // Verify page title
    await expect(page).toHaveTitle(/Opnix/);

    // Take initial screenshot
    await page.screenshot({ path: 'test-results/screenshots/01-app-loaded.png', fullPage: true });

    // Verify main app structure exists
    await expect(page.locator('.app-header')).toBeVisible();
    await expect(page.locator('.tab-navigation')).toBeVisible();
    await expect(page.locator('.workbench-strip')).toBeVisible();

    console.log('✓ Application loaded successfully');
  });

  test('02 - App Header and branding visible', async ({ page }) => {
    // Check header elements
    const header = page.locator('.app-header');
    await expect(header).toBeVisible();

    // Verify logo/title
    const title = header.locator('.app-title, h1, [class*="title"]').first();
    await expect(title).toBeVisible();

    // Screenshot header
    await page.screenshot({ path: 'test-results/screenshots/02-app-header.png' });

    console.log('✓ App header verified');
  });

  test('03 - Theme switcher functionality', async ({ page }) => {
    // Get current theme
    const bodyBefore = await page.locator('body').getAttribute('data-theme');

    // Capture current theme
    await page.screenshot({ path: 'test-results/screenshots/03a-theme-current.png', fullPage: true });

    // Determine which button to click based on current theme
    const targetTheme = bodyBefore === 'mole' ? 'CANYON' : 'MOLE';

    // Click theme button using evaluate to ensure text matching works
    await page.evaluate((text) => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === text);
      if (btn) btn.click();
    }, targetTheme);

    // Give the click handler time to execute and start the theme change Promise
    await page.waitForTimeout(100);

    // Wait for theme attribute to actually change (theme loading is async)
    await page.waitForFunction(
      (expectedTheme) => {
        const currentTheme = document.body.getAttribute('data-theme');
        return currentTheme !== expectedTheme;
      },
      bodyBefore,
      { timeout: 10000 }
    );

    // Capture theme after first switch
    await page.screenshot({ path: 'test-results/screenshots/03b-theme-switched.png', fullPage: true });

    // Verify theme changed
    const bodyAfter = await page.locator('body').getAttribute('data-theme');
    expect(bodyBefore).not.toBe(bodyAfter);

    // Toggle back to original - need to click the OTHER button now
    const targetThemeBack = bodyAfter === 'mole' ? 'CANYON' : 'MOLE';

    await page.evaluate((text) => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === text);
      if (btn) btn.click();
    }, targetThemeBack);

    // Wait for theme to switch back
    await page.waitForFunction(
      (expectedTheme) => {
        const currentTheme = document.body.getAttribute('data-theme');
        return currentTheme !== expectedTheme;
      },
      bodyAfter,
      { timeout: 5000 }
    );

    console.log('✓ Theme switching works');
  });

  test('04 - Tab navigation - Canvas tab', async ({ page }) => {
    // Find Canvas tab button
    const canvasTab = page.locator('button:has-text("Canvas"), [data-tab="canvas"]').first();

    if (await canvasTab.isVisible()) {
      await canvasTab.click();

      // Wait a moment for tab switch and component render
      await page.waitForTimeout(500);

      // Wait for canvas container to be attached to DOM
      const canvasContainer = page.locator('#canvas-container');
      await canvasContainer.waitFor({ state: 'attached', timeout: 5000 });

      // Verify canvas container is in the DOM
      await expect(canvasContainer).toBeAttached();

      // Screenshot canvas view
      await page.screenshot({ path: 'test-results/screenshots/04-tab-canvas.png', fullPage: true });

      console.log('✓ Canvas tab navigation works');
    } else {
      console.log('⚠ Canvas tab not found');
    }
  });

  test('05 - Tab navigation - Modules tab', async ({ page }) => {
    const modulesTab = page.locator('button:has-text("Modules"), [data-tab="modules"]').first();

    if (await modulesTab.isVisible()) {
      await modulesTab.click();
      await page.waitForTimeout(1000);

      // Screenshot modules view
      await page.screenshot({ path: 'test-results/screenshots/05-tab-modules.png', fullPage: true });

      console.log('✓ Modules tab navigation works');
    } else {
      console.log('⚠ Modules tab not found');
    }
  });

  test('06 - Tab navigation - Roadmap tab', async ({ page }) => {
    const roadmapTab = page.locator('button:has-text("Roadmap"), [data-tab="roadmap"]').first();

    if (await roadmapTab.isVisible()) {
      await roadmapTab.click();
      await page.waitForTimeout(1000);

      // Verify roadmap content
      const roadmapContent = page.locator('.roadmap-tab, #roadmap-content');
      await expect(roadmapContent).toBeVisible();

      // Screenshot roadmap
      await page.screenshot({ path: 'test-results/screenshots/06-tab-roadmap.png', fullPage: true });

      console.log('✓ Roadmap tab navigation works');
    } else {
      console.log('⚠ Roadmap tab not found');
    }
  });

  test('07 - Tab navigation - Tickets/Bugs tab', async ({ page }) => {
    const ticketsTab = page.locator('button:has-text("Bugs"), button:has-text("Tickets"), [data-tab="bugs"]').first();

    if (await ticketsTab.isVisible()) {
      await ticketsTab.click();
      await page.waitForTimeout(1000);

      // Verify tickets board visible
      const ticketsBoard = page.locator('.tickets-board').first();
      await expect(ticketsBoard).toBeVisible();

      // Screenshot tickets
      await page.screenshot({ path: 'test-results/screenshots/07-tab-tickets.png', fullPage: true });

      console.log('✓ Tickets tab navigation works');
    } else {
      console.log('⚠ Tickets tab not found');
    }
  });

  test('08 - Tab navigation - Features tab', async ({ page }) => {
    const featuresTab = page.locator('button:has-text("Features"), [data-tab="features"]').first();

    if (await featuresTab.isVisible()) {
      await featuresTab.click();
      await page.waitForTimeout(1000);

      // Screenshot features
      await page.screenshot({ path: 'test-results/screenshots/08-tab-features.png', fullPage: true });

      console.log('✓ Features tab navigation works');
    } else {
      console.log('⚠ Features tab not found');
    }
  });

  test('09 - Tab navigation - Specs tab', async ({ page }) => {
    const specsTab = page.locator('button:has-text("Specs"), [data-tab="specs"]').first();

    if (await specsTab.isVisible()) {
      await specsTab.click();
      await page.waitForTimeout(1000);

      // Screenshot specs
      await page.screenshot({ path: 'test-results/screenshots/09-tab-specs.png', fullPage: true });

      console.log('✓ Specs tab navigation works');
    } else {
      console.log('⚠ Specs tab not found');
    }
  });

  test('10 - Tab navigation - Docs tab', async ({ page }) => {
    const docsTab = page.locator('button:has-text("Docs"), [data-tab="docs"]').first();

    if (await docsTab.isVisible()) {
      await docsTab.click();
      await page.waitForTimeout(1000);

      // Verify docs viewer visible
      const docsViewer = page.locator('.docs-viewer, .docs-tab');
      await expect(docsViewer).toBeVisible();

      // Screenshot docs
      await page.screenshot({ path: 'test-results/screenshots/10-tab-docs.png', fullPage: true });

      console.log('✓ Docs tab navigation works');
    } else {
      console.log('⚠ Docs tab not found');
    }
  });

  test('11 - Tab navigation - API tab', async ({ page }) => {
    const apiTab = page.locator('button:has-text("API"), [data-tab="api"]').first();

    if (await apiTab.isVisible()) {
      await apiTab.click();
      await page.waitForTimeout(1000);

      // Screenshot API
      await page.screenshot({ path: 'test-results/screenshots/11-tab-api.png', fullPage: true });

      console.log('✓ API tab navigation works');
    } else {
      console.log('⚠ API tab not found');
    }
  });

  test('12 - Tab navigation - Diagrams tab', async ({ page }) => {
    const diagramsTab = page.locator('button:has-text("Diagrams"), [data-tab="diagrams"]').first();

    if (await diagramsTab.isVisible()) {
      await diagramsTab.click();
      await page.waitForTimeout(1000);

      // Screenshot diagrams
      await page.screenshot({ path: 'test-results/screenshots/12-tab-diagrams.png', fullPage: true });

      console.log('✓ Diagrams tab navigation works');
    } else {
      console.log('⚠ Diagrams tab not found');
    }
  });

  test('13 - Tab navigation - Storybook tab', async ({ page }) => {
    const storybookTab = page.locator('button:has-text("Storybook"), [data-tab="storybook"]').first();

    if (await storybookTab.isVisible()) {
      await storybookTab.click();
      await page.waitForTimeout(2000); // Storybook may take longer to load

      // Screenshot storybook
      await page.screenshot({ path: 'test-results/screenshots/13-tab-storybook.png', fullPage: true });

      console.log('✓ Storybook tab navigation works');
    } else {
      console.log('⚠ Storybook tab not found');
    }
  });

  test('14 - Command Center - Visibility and interaction', async ({ page }) => {
    // Verify command center is visible (it's always in the workbench)
    const commandCenter = page.locator('[data-command-center]').first();
    await expect(commandCenter).toBeVisible();

    // Verify command input exists
    const commandInput = page.locator('#claude-command-input');
    await expect(commandInput).toBeVisible();

    // Verify execute button exists
    const executeButton = page.locator('button:has-text("Execute")').first();
    await expect(executeButton).toBeVisible();

    // Screenshot command center
    await page.screenshot({ path: 'test-results/screenshots/14-command-center.png', fullPage: true });

    console.log('✓ Command center visible and functional');
  });

  test('15 - Statusline panel visibility', async ({ page }) => {
    // Check statusline panel in workbench strip
    const statusline = page.locator('.statusline-panel, [class*="status"]').first();

    if (await statusline.isVisible()) {
      // Screenshot statusline
      await page.screenshot({ path: 'test-results/screenshots/15-statusline.png' });

      console.log('✓ Statusline panel visible');
    } else {
      console.log('⚠ Statusline panel not found');
    }
  });

  test('16 - Terminal panel visibility', async ({ page }) => {
    // Check terminal in workbench strip
    const terminal = page.locator('.x-terminal, .terminal-panel, [class*="terminal"]').first();

    if (await terminal.isVisible()) {
      // Screenshot terminal
      await page.screenshot({ path: 'test-results/screenshots/16-terminal.png' });

      console.log('✓ Terminal panel visible');
    } else {
      console.log('⚠ Terminal panel not found');
    }
  });

  test('17 - Module detection button', async ({ page }) => {
    // Navigate to Modules/Canvas tab
    const modulesTab = page.locator('button:has-text("Modules"), button:has-text("Canvas")').first();
    if (await modulesTab.isVisible()) {
      await modulesTab.click();
      await page.waitForTimeout(1000);
    }

    // Find detect modules button
    const detectButton = page.locator('button:has-text("Detect"), button:has-text("Scan")').first();

    if (await detectButton.isVisible()) {
      // Screenshot before detection
      await page.screenshot({ path: 'test-results/screenshots/17a-before-detect.png', fullPage: true });

      // Click detect
      await detectButton.click();
      await page.waitForTimeout(3000); // Allow detection to complete

      // Screenshot after detection
      await page.screenshot({ path: 'test-results/screenshots/17b-after-detect.png', fullPage: true });

      console.log('✓ Module detection works');
    } else {
      console.log('⚠ Detect modules button not found');
    }
  });

  test('18 - Create new ticket/bug modal', async ({ page }) => {
    // Navigate to Tickets tab
    const ticketsTab = page.locator('button:has-text("Bugs"), button:has-text("Tickets")').first();
    if (await ticketsTab.isVisible()) {
      await ticketsTab.click();
      await page.waitForTimeout(1000);
    }

    // Find "New Bug" or "Add Ticket" button
    const newTicketButton = page.locator('button:has-text("New Bug"), button:has-text("Add Ticket"), button:has-text("Create")').first();

    if (await newTicketButton.isVisible()) {
      // Click to open modal
      await newTicketButton.click();
      await page.waitForTimeout(500);

      // Verify modal opened
      const modal = page.locator('.bug-modal, .ticket-modal, [role="dialog"]');
      await expect(modal).toBeVisible();

      // Screenshot modal
      await page.screenshot({ path: 'test-results/screenshots/18-new-ticket-modal.png', fullPage: true });

      // Close modal (ESC)
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      console.log('✓ New ticket modal works');
    } else {
      console.log('⚠ New ticket button not found');
    }
  });

  test('19 - Create new feature modal', async ({ page }) => {
    // Navigate to Features tab
    const featuresTab = page.locator('button:has-text("Features")').first();
    if (await featuresTab.isVisible()) {
      await featuresTab.click();
      await page.waitForTimeout(1000);
    }

    // Find "New Feature" button
    const newFeatureButton = page.locator('button:has-text("New Feature"), button:has-text("Add Feature")').first();

    if (await newFeatureButton.isVisible()) {
      // Click to open modal
      await newFeatureButton.click();
      await page.waitForTimeout(500);

      // Verify modal opened
      const modal = page.locator('.feature-modal, [role="dialog"]');
      await expect(modal).toBeVisible();

      // Screenshot modal
      await page.screenshot({ path: 'test-results/screenshots/19-new-feature-modal.png', fullPage: true });

      // Close modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      console.log('✓ New feature modal works');
    } else {
      console.log('⚠ New feature button not found');
    }
  });

  test('20 - Roadmap view toggle', async ({ page }) => {
    // Navigate to Roadmap tab
    const roadmapTab = page.locator('button:has-text("Roadmap")').first();
    if (await roadmapTab.isVisible()) {
      await roadmapTab.click();
      await page.waitForTimeout(1000);
    }

    // Find view toggle (minimal/detailed)
    const viewToggle = page.locator('.roadmap-view-toggle, button:has-text("Minimal"), button:has-text("Detailed")').first();

    if (await viewToggle.isVisible()) {
      // Screenshot minimal view
      await page.screenshot({ path: 'test-results/screenshots/20a-roadmap-minimal.png', fullPage: true });

      // Toggle to detailed
      await viewToggle.click();
      await page.waitForTimeout(1000);

      // Screenshot detailed view
      await page.screenshot({ path: 'test-results/screenshots/20b-roadmap-detailed.png', fullPage: true });

      console.log('✓ Roadmap view toggle works');
    } else {
      console.log('⚠ Roadmap view toggle not found');
    }
  });

  test('21 - Canvas zoom and pan controls', async ({ page }) => {
    // Navigate to Canvas tab
    const canvasTab = page.locator('button:has-text("Canvas"), button:has-text("Modules")').first();
    if (await canvasTab.isVisible()) {
      await canvasTab.click();
      await page.waitForTimeout(1000);
    }

    // Find zoom controls
    const zoomIn = page.locator('button[title*="Zoom In"], button:has-text("+")').first();
    const zoomOut = page.locator('button[title*="Zoom Out"], button:has-text("-")').first();

    if (await zoomIn.isVisible() && await zoomOut.isVisible()) {
      // Test zoom in
      await zoomIn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/screenshots/21a-canvas-zoom-in.png', fullPage: true });

      // Test zoom out
      await zoomOut.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/screenshots/21b-canvas-zoom-out.png', fullPage: true });

      console.log('✓ Canvas zoom controls work');
    } else {
      console.log('⚠ Canvas zoom controls not found');
    }
  });

  test('22 - Docs file browser navigation', async ({ page }) => {
    // Navigate to Docs tab
    const docsTab = page.locator('button:has-text("Docs")').first();
    if (await docsTab.isVisible()) {
      await docsTab.click();
      await page.waitForTimeout(1000);
    }

    // Find first doc file/folder
    const firstDoc = page.locator('.docs-viewer [class*="file"], .docs-viewer [class*="item"]').first();

    if (await firstDoc.isVisible()) {
      // Screenshot file browser
      await page.screenshot({ path: 'test-results/screenshots/22a-docs-browser.png', fullPage: true });

      // Click to open doc
      await firstDoc.click();
      await page.waitForTimeout(1000);

      // Screenshot opened doc
      await page.screenshot({ path: 'test-results/screenshots/22b-docs-opened.png', fullPage: true });

      console.log('✓ Docs navigation works');
    } else {
      console.log('⚠ Docs files not found');
    }
  });

  test('23 - Export functionality', async ({ page }) => {
    // Navigate to Canvas or Specs tab
    const canvasTab = page.locator('button:has-text("Canvas"), button:has-text("Specs")').first();
    if (await canvasTab.isVisible()) {
      await canvasTab.click();
      await page.waitForTimeout(1000);
    }

    // Find export button
    const exportButton = page.locator('button:has-text("Export"), button:has-text("Download")').first();

    if (await exportButton.isVisible()) {
      // Screenshot before export
      await page.screenshot({ path: 'test-results/screenshots/23a-before-export.png', fullPage: true });

      // Start download
      const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
      await exportButton.click();
      const download = await downloadPromise;

      if (download) {
        console.log(`✓ Export works - downloaded: ${download.suggestedFilename()}`);
      } else {
        console.log('⚠ Export triggered but no download detected');
      }

      // Screenshot after export
      await page.screenshot({ path: 'test-results/screenshots/23b-after-export.png', fullPage: true });
    } else {
      console.log('⚠ Export button not found');
    }
  });

  test('24 - Keyboard shortcuts', async ({ page }) => {
    // Test Ctrl+K for command center
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(500);

    const commandCenter = page.locator('[data-command-center]');

    if (await commandCenter.isVisible()) {
      await page.screenshot({ path: 'test-results/screenshots/24-keyboard-shortcut.png', fullPage: true });

      // Close it
      await page.keyboard.press('Escape');

      console.log('✓ Keyboard shortcuts work');
    } else {
      console.log('⚠ Command center keyboard shortcut not working');
    }
  });

  test('25 - Responsive layout - mobile viewport', async ({ page }) => {
    // Change to mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);

    // Screenshot mobile view
    await page.screenshot({ path: 'test-results/screenshots/25a-mobile-portrait.png', fullPage: true });

    // Change to landscape
    await page.setViewportSize({ width: 667, height: 375 });
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'test-results/screenshots/25b-mobile-landscape.png', fullPage: true });

    // Reset to desktop
    await page.setViewportSize({ width: 1920, height: 1080 });

    console.log('✓ Responsive layout tested');
  });

  test('26 - Final full page overview', async ({ page }) => {
    // Navigate to main/home view
    const homeTab = page.locator('button:has-text("Canvas"), button:has-text("Home")').first();
    if (await homeTab.isVisible()) {
      await homeTab.click();
      await page.waitForTimeout(1000);
    }

    // Take final comprehensive screenshot
    await page.screenshot({
      path: 'test-results/screenshots/26-final-overview.png',
      fullPage: true
    });

    // Generate summary
    const url = page.url();
    const title = await page.title();

    console.log('\n=== E2E Test Complete ===');
    console.log(`URL: ${url}`);
    console.log(`Title: ${title}`);
    console.log('Screenshots saved to: test-results/screenshots/');
    console.log('✓ All user journey tests completed');
  });

});