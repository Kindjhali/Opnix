/**
 * Opnix Detailed Diagnostics E2E Test
 *
 * This test performs comprehensive diagnostics including:
 * - Console error detection
 * - Network request monitoring
 * - CSS/JS file loading verification
 * - Styling validation
 * - Performance metrics
 */

import { test, expect } from '@playwright/test';
import fs from 'fs';

test.describe('Opnix Detailed Diagnostics', () => {
  let consoleMessages = [];
  let networkRequests = [];
  let failedRequests = [];

  test('Comprehensive diagnostics - console, network, and styling', async ({ page }) => {
    // Set up console message listener
    page.on('console', msg => {
      const entry = {
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      };
      consoleMessages.push(entry);

      if (msg.type() === 'error') {
        console.log(`❌ Console Error: ${msg.text()}`);
      }
    });

    // Set up network request listener
    page.on('request', request => {
      networkRequests.push({
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType()
      });
    });

    // Set up failed request listener
    page.on('requestfailed', request => {
      const failure = {
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        failure: request.failure()
      };
      failedRequests.push(failure);
      console.log(`❌ Failed Request: ${request.url()} - ${request.failure()?.errorText || 'Unknown error'}`);
    });

    // Navigate to the application
    console.log('\n=== Starting Opnix Diagnostics ===\n');
    await page.goto('/', { waitUntil: 'networkidle' });

    // Wait for app to be fully loaded
    await page.waitForTimeout(2000);

    // Take initial screenshot
    await page.screenshot({
      path: 'test-results/screenshots/diagnostic-01-initial.png',
      fullPage: true
    });

    // === CSS VERIFICATION ===
    console.log('\n=== CSS Verification ===');

    // Check if CSS is applied by examining computed styles
    const bodyStyles = await page.evaluate(() => {
      const body = document.body;
      const computed = window.getComputedStyle(body);
      return {
        backgroundColor: computed.backgroundColor,
        color: computed.color,
        fontFamily: computed.fontFamily,
        margin: computed.margin,
        padding: computed.padding
      };
    });

    console.log('Body Computed Styles:', JSON.stringify(bodyStyles, null, 2));

    // Check header styles
    const headerStyles = await page.evaluate(() => {
      const header = document.querySelector('.app-header, header');
      if (!header) return null;
      const computed = window.getComputedStyle(header);
      return {
        display: computed.display,
        backgroundColor: computed.backgroundColor,
        padding: computed.padding,
        height: computed.height
      };
    });

    console.log('Header Computed Styles:', JSON.stringify(headerStyles, null, 2));

    // Check if any CSS/JS files loaded
    const loadedResources = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource');
      return {
        css: resources.filter(r => r.name.endsWith('.css')).map(r => ({
          name: r.name,
          size: r.transferSize,
          duration: r.duration
        })),
        js: resources.filter(r => r.name.endsWith('.js')).map(r => ({
          name: r.name,
          size: r.transferSize,
          duration: r.duration
        }))
      };
    });

    console.log('\n=== Loaded Resources ===');
    console.log('CSS Files:', loadedResources.css.length);
    loadedResources.css.forEach(css => {
      console.log(`  ✓ ${css.name.split('/').pop()} (${css.size} bytes)`);
    });
    console.log('JS Files:', loadedResources.js.length);
    loadedResources.js.forEach(js => {
      console.log(`  ✓ ${js.name.split('/').pop()} (${js.size} bytes)`);
    });

    // === VISUAL ELEMENT VERIFICATION ===
    console.log('\n=== Visual Element Verification ===');

    const elementsCheck = await page.evaluate(() => {
      const results = {};

      // Check theme buttons
      const themeButtons = document.querySelectorAll('button');
      results.themeButtons = Array.from(themeButtons).map(btn => ({
        text: btn.textContent.trim(),
        visible: btn.offsetHeight > 0
      }));

      // Check tabs
      const tabs = document.querySelectorAll('[class*="tab"]');
      results.tabs = tabs.length;

      // Check workbench
      const workbench = document.querySelector('.workbench-strip, [class*="workbench"]');
      results.hasWorkbench = !!workbench;

      // Check terminal
      const terminal = document.querySelector('.terminal-panel, .x-terminal, [class*="terminal"]');
      results.hasTerminal = !!terminal;

      return results;
    });

    console.log('Elements Found:', JSON.stringify(elementsCheck, null, 2));

    // === THEME VERIFICATION ===
    console.log('\n=== Theme Verification ===');

    const themeInfo = await page.evaluate(() => {
      return {
        currentTheme: document.body.getAttribute('data-theme'),
        themeClass: document.body.className,
        htmlDataset: document.documentElement.dataset
      };
    });

    console.log('Theme Info:', JSON.stringify(themeInfo, null, 2));

    // === ACCESSIBILITY CHECKS ===
    console.log('\n=== Accessibility Checks ===');

    const a11yInfo = await page.evaluate(() => {
      return {
        title: document.title,
        lang: document.documentElement.lang,
        hasMainLandmark: !!document.querySelector('main, [role="main"]'),
        hasNavLandmark: !!document.querySelector('nav, [role="navigation"]'),
        headingStructure: Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => ({
          level: h.tagName,
          text: h.textContent.trim().slice(0, 50)
        }))
      };
    });

    console.log('Accessibility Info:', JSON.stringify(a11yInfo, null, 2));

    // === PERFORMANCE METRICS ===
    console.log('\n=== Performance Metrics ===');

    const perfMetrics = await page.evaluate(() => {
      const perf = performance.timing;
      return {
        domContentLoaded: perf.domContentLoadedEventEnd - perf.navigationStart,
        pageLoad: perf.loadEventEnd - perf.navigationStart,
        domInteractive: perf.domInteractive - perf.navigationStart
      };
    });

    console.log('Performance:', JSON.stringify(perfMetrics, null, 2));

    // === GENERATE DIAGNOSTIC REPORT ===
    const diagnosticReport = {
      timestamp: new Date().toISOString(),
      url: page.url(),
      title: await page.title(),
      viewport: page.viewportSize(),
      bodyStyles,
      headerStyles,
      loadedResources,
      elementsCheck,
      themeInfo,
      a11yInfo,
      perfMetrics,
      consoleErrors: consoleMessages.filter(m => m.type === 'error'),
      consoleWarnings: consoleMessages.filter(m => m.type === 'warning'),
      allConsoleMessages: consoleMessages,
      networkRequests: {
        total: networkRequests.length,
        byType: networkRequests.reduce((acc, req) => {
          acc[req.resourceType] = (acc[req.resourceType] || 0) + 1;
          return acc;
        }, {}),
        failed: failedRequests
      },
      failedRequests
    };

    // Write report to file
    const reportPath = '/home/aaron/opnix/test-results/diagnostic-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(diagnosticReport, null, 2));
    console.log(`\n✓ Diagnostic report saved to: ${reportPath}`);

    // === SUMMARY ===
    console.log('\n=== DIAGNOSTIC SUMMARY ===');
    console.log(`✓ Page loaded: ${page.url()}`);
    console.log(`✓ Title: ${await page.title()}`);
    console.log(`✓ CSS files loaded: ${loadedResources.css.length}`);
    console.log(`✓ JS files loaded: ${loadedResources.js.length}`);
    console.log(`✓ Console errors: ${diagnosticReport.consoleErrors.length}`);
    console.log(`✓ Console warnings: ${diagnosticReport.consoleWarnings.length}`);
    console.log(`✓ Failed requests: ${failedRequests.length}`);
    console.log(`✓ Current theme: ${themeInfo.currentTheme}`);
    console.log(`✓ Performance - DOM Interactive: ${perfMetrics.domInteractive}ms`);
    console.log(`✓ Performance - Page Load: ${perfMetrics.pageLoad}ms`);

    // Assertions
    expect(await page.title()).toContain('Opnix');
    expect(loadedResources.css.length + loadedResources.js.length).toBeGreaterThan(0);
    expect(failedRequests.length).toBe(0);

    console.log('\n=== Diagnostics Complete ===\n');
  });

});
