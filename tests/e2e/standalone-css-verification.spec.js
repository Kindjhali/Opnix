/**
 * Standalone CSS Loading Verification Test for opnix@1.0.6
 *
 * This test assumes the server is already running on port 7337
 */

import { test, expect, chromium } from '@playwright/test';
import fs from 'fs';

test.describe.configure({ mode: 'serial' });

test.describe('CSS Loading Verification - v1.0.6 (Standalone)', () => {
  test('Verify CSS loading fix from v1.0.5 to v1.0.6', async () => {
    console.log('\n=== CSS Loading Verification Test (Standalone) ===\n');

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();

    const consoleErrors = [];
    const cssRequests = [];
    const failedRequests = [];

    // Set up console error listener
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const errorText = msg.text();
        consoleErrors.push(errorText);
        console.log(`❌ Console Error: ${errorText}`);
      }
    });

    // Set up network request listener specifically for CSS files
    page.on('response', async response => {
      const url = response.url();
      if (url.endsWith('.css')) {
        const request = {
          url: url,
          status: response.status(),
          statusText: response.statusText(),
          contentType: response.headers()['content-type'],
          size: (await response.body().catch(() => Buffer.from(''))).length
        };
        cssRequests.push(request);

        const statusIcon = response.status() === 200 ? '✓' : '❌';
        const fileName = url.split('/').slice(-2).join('/');
        console.log(`${statusIcon} CSS Request: ${fileName} - Status: ${response.status()} - Size: ${request.size} bytes`);
      }
    });

    // Set up failed request listener
    page.on('requestfailed', request => {
      if (request.url().endsWith('.css')) {
        const failure = {
          url: request.url(),
          failure: request.failure()?.errorText || 'Unknown error'
        };
        failedRequests.push(failure);
        console.log(`❌ Failed CSS Request: ${request.url()} - ${failure.failure}`);
      }
    });

    try {
      // Navigate to the application
      console.log('Navigating to http://localhost:7337...\n');
      await page.goto('http://localhost:7337/', { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Create screenshots directory if it doesn't exist
      const screenshotsDir = '/home/aaron/opnix/test-results/screenshots';
      if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir, { recursive: true });
      }

      // Take screenshot showing initial load
      await page.screenshot({
        path: `${screenshotsDir}/css-verification-standalone-01-loaded.png`,
        fullPage: true
      });

      console.log('\n=== Test Results ===\n');

      // === CRITICAL TEST 1: Verify main CSS file loads with 200 OK ===
      console.log('TEST 1: Main CSS File Status');
      const mainCssRequest = cssRequests.find(req =>
        req.url.includes('/assets/assets/main-DYP7pi_n.css') ||
        req.url.includes('/assets/main-') ||
        req.url.includes('main-') && req.url.includes('.css')
      );

      if (mainCssRequest) {
        console.log('  ✓ Main CSS file found in requests');
        console.log(`    URL: ${mainCssRequest.url}`);
        console.log(`    Status: ${mainCssRequest.status}`);
        console.log(`    Content-Type: ${mainCssRequest.contentType}`);
        console.log(`    Size: ${mainCssRequest.size} bytes`);

        expect(mainCssRequest.status).toBe(200);
        expect(mainCssRequest.size).toBeGreaterThan(0);
        console.log('  ✓ PASS: Main CSS file loaded with 200 OK\n');
      } else {
        console.log('  ❌ FAIL: Main CSS file NOT found in requests');
        console.log('  All CSS requests:', cssRequests.map(r => r.url));
        throw new Error('Main CSS file was not loaded');
      }

      // === CRITICAL TEST 2: Verify NO 404 errors for CSS files ===
      console.log('TEST 2: CSS 404 Check');
      const css404s = cssRequests.filter(req => req.status === 404);

      if (css404s.length > 0) {
        console.log(`  ❌ FAIL: Found ${css404s.length} CSS 404 errors:`);
        css404s.forEach(req => console.log(`    - ${req.url}`));
      } else {
        console.log('  ✓ PASS: No CSS 404 errors found\n');
      }

      expect(css404s.length).toBe(0);

      // === CRITICAL TEST 3: Verify 100% CSS files loaded ===
      console.log('TEST 3: CSS Load Percentage');
      const totalCssRequests = cssRequests.length;
      const successfulCssRequests = cssRequests.filter(req => req.status === 200).length;
      const loadPercentage = (successfulCssRequests / totalCssRequests) * 100;

      console.log(`  Total CSS requests: ${totalCssRequests}`);
      console.log(`  Successful CSS loads: ${successfulCssRequests}`);
      console.log(`  Load percentage: ${loadPercentage.toFixed(1)}%`);

      if (loadPercentage === 100) {
        console.log('  ✓ PASS: 100% CSS files loaded successfully\n');
      } else {
        console.log(`  ❌ FAIL: Only ${loadPercentage.toFixed(1)}% CSS files loaded\n`);
      }

      expect(loadPercentage).toBe(100);

      // === CRITICAL TEST 4: Verify MOLE theme styling applied ===
      console.log('TEST 4: MOLE Theme Styling');

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

      console.log('  Body computed styles:', JSON.stringify(bodyStyles, null, 2));

      // Check if we have custom styling (not browser defaults)
      const hasCustomFont = !bodyStyles.fontFamily.toLowerCase().includes('times new roman');
      const hasCustomBackground = bodyStyles.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
                                   bodyStyles.backgroundColor !== 'rgb(255, 255, 255)';

      console.log(`  Custom font applied: ${hasCustomFont} (not Times New Roman)`);
      console.log(`  Custom background applied: ${hasCustomBackground} (not default)`);

      if (hasCustomFont) {
        console.log('  ✓ PASS: Custom styling applied (not browser defaults)\n');
      } else {
        console.log('  ❌ FAIL: Still using browser default styling\n');
      }

      expect(hasCustomFont).toBe(true);

      // === CRITICAL TEST 5: Verify NO console errors about CSS ===
      console.log('TEST 5: Console Errors Check');

      const cssRelatedErrors = consoleErrors.filter(err =>
        err.toLowerCase().includes('css') ||
        err.toLowerCase().includes('mime') ||
        err.toLowerCase().includes('stylesheet')
      );

      if (cssRelatedErrors.length > 0) {
        console.log(`  ❌ FAIL: Found ${cssRelatedErrors.length} CSS-related console errors:`);
        cssRelatedErrors.forEach(err => console.log(`    - ${err}`));
      } else {
        console.log('  ✓ PASS: No CSS-related console errors found\n');
      }

      expect(cssRelatedErrors.length).toBe(0);

      // === CRITICAL TEST 6: Verify theme CSS loaded ===
      console.log('TEST 6: Theme CSS File');

      const themeCssRequest = cssRequests.find(req =>
        req.url.includes('theme-mole.css') || req.url.includes('theme-')
      );

      if (themeCssRequest) {
        console.log('  ✓ Theme CSS file found');
        console.log(`    URL: ${themeCssRequest.url}`);
        console.log(`    Status: ${themeCssRequest.status}`);
        expect(themeCssRequest.status).toBe(200);
        console.log('  ✓ PASS: Theme CSS loaded\n');
      } else {
        console.log('  ⚠ WARNING: Theme CSS file not found in requests\n');
      }

      // Take final screenshot with styling applied
      await page.screenshot({
        path: `${screenshotsDir}/css-verification-standalone-02-styled.png`,
        fullPage: true
      });

      // Take screenshot of network tab (via devtools)
      await page.goto('http://localhost:7337/', { waitUntil: 'networkidle' });

      // === Generate comprehensive report ===
      const report = {
        version: '1.0.6',
        timestamp: new Date().toISOString(),
        testResults: {
          mainCssLoaded: !!mainCssRequest && mainCssRequest.status === 200,
          no404Errors: css404s.length === 0,
          loadPercentage: loadPercentage,
          allCssLoaded: loadPercentage === 100,
          customStylingApplied: hasCustomFont,
          noConsoleErrors: cssRelatedErrors.length === 0,
          themeCssLoaded: !!themeCssRequest && themeCssRequest.status === 200
        },
        cssRequests: cssRequests,
        failedRequests: failedRequests,
        consoleErrors: consoleErrors,
        bodyStyles: bodyStyles,
        comparison: {
          v1_0_5_issues: {
            description: 'Previous version had /css/base.css returning 404',
            cssBaseFile404: true,
            browserDefaultStyling: true,
            loadPercentage: 66.7
          },
          v1_0_6_fixes: {
            description: 'Fixed version loads /assets/assets/main-DYP7pi_n.css successfully',
            mainCssFile200: mainCssRequest?.status === 200,
            customStyling: hasCustomFont,
            loadPercentage: loadPercentage
          },
          improvement: {
            cssFileFixed: mainCssRequest?.status === 200 ? 'Fixed' : 'Not Fixed',
            loadPercentageImprovement: `${66.7}% → ${loadPercentage.toFixed(1)}%`,
            stylingFixed: hasCustomFont ? 'Fixed' : 'Not Fixed'
          }
        }
      };

      // Write report to file
      const reportDir = '/home/aaron/opnix/test-results';
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }
      const reportPath = `${reportDir}/css-loading-verification-standalone-report.json`;
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`✓ CSS verification report saved to: ${reportPath}\n`);

      // === FINAL SUMMARY ===
      console.log('=== CSS LOADING VERIFICATION SUMMARY ===\n');
      console.log(`✓ Main CSS file (/assets/assets/main-DYP7pi_n.css): ${mainCssRequest?.status === 200 ? 'PASS ✓' : 'FAIL ❌'}`);
      console.log(`✓ No CSS 404 errors: ${css404s.length === 0 ? 'PASS ✓' : 'FAIL ❌'}`);
      console.log(`✓ CSS load percentage: ${loadPercentage.toFixed(1)}% ${loadPercentage === 100 ? 'PASS ✓' : 'FAIL ❌'}`);
      console.log(`✓ Custom styling applied: ${hasCustomFont ? 'PASS ✓' : 'FAIL ❌'}`);
      console.log(`✓ No console errors: ${cssRelatedErrors.length === 0 ? 'PASS ✓' : 'FAIL ❌'}`);
      console.log(`✓ Theme CSS loaded: ${themeCssRequest?.status === 200 ? 'PASS ✓' : 'WARNING ⚠'}`);
      console.log('\n=== Comparison with v1.0.5 ===');
      console.log(`v1.0.5: 66.7% CSS loaded with /css/base.css returning 404`);
      console.log(`v1.0.6: ${loadPercentage.toFixed(1)}% CSS loaded with /assets/assets/main-DYP7pi_n.css returning ${mainCssRequest?.status || 'N/A'}`);
      console.log('\n✓ CSS LOADING FIX VERIFIED SUCCESSFULLY!\n');
      console.log(`Screenshots saved to: ${screenshotsDir}/`);
      console.log(`Report saved to: ${reportPath}\n`);

    } finally {
      await browser.close();
    }
  });
});
