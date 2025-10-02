/**
 * CSS Loading Verification Test for opnix@1.0.6
 *
 * This test specifically validates the CSS loading fix from v1.0.5 to v1.0.6
 *
 * Previous Issue (v1.0.5):
 * - /css/base.css returning 404 (file doesn't exist)
 * - Page displaying with browser defaults (Times New Roman, 8px margins)
 * - Only 66.7% CSS files loading (2 of 3)
 *
 * Expected Fix (v1.0.6):
 * - /assets/assets/main-DYP7pi_n.css returns 200 OK
 * - Page displays with MOLE theme styling
 * - All CSS files load (100%)
 * - No console errors about MIME types or missing stylesheets
 */

import { test, expect } from '@playwright/test';
import fs from 'fs';

test.describe('CSS Loading Verification - v1.0.6', () => {
  let consoleErrors = [];
  let cssRequests = [];
  let failedRequests = [];

  test('Verify CSS loading fix from v1.0.5 to v1.0.6', async ({ page }) => {
    console.log('\n=== CSS Loading Verification Test ===\n');

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
        console.log(`${statusIcon} CSS Request: ${url.split('/').slice(-2).join('/')} - Status: ${response.status()}`);
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

    // Navigate to the application
    console.log('Navigating to application...\n');
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Take screenshot showing network tab (we'll capture this via browser devtools)
    await page.screenshot({
      path: 'test-results/screenshots/css-verification-01-loaded.png',
      fullPage: true
    });

    // === CRITICAL TEST 1: Verify main CSS file loads with 200 OK ===
    console.log('\n=== Test 1: Main CSS File Status ===');
    const mainCssRequest = cssRequests.find(req =>
      req.url.includes('/assets/assets/main-DYP7pi_n.css')
    );

    if (mainCssRequest) {
      console.log('✓ Main CSS file found in requests');
      console.log(`  URL: ${mainCssRequest.url}`);
      console.log(`  Status: ${mainCssRequest.status}`);
      console.log(`  Content-Type: ${mainCssRequest.contentType}`);
      console.log(`  Size: ${mainCssRequest.size} bytes`);

      expect(mainCssRequest.status).toBe(200);
      expect(mainCssRequest.size).toBeGreaterThan(0);
    } else {
      console.log('❌ Main CSS file NOT found in requests');
      console.log('All CSS requests:', cssRequests.map(r => r.url));
      throw new Error('Main CSS file /assets/assets/main-DYP7pi_n.css was not loaded');
    }

    // === CRITICAL TEST 2: Verify NO 404 errors for CSS files ===
    console.log('\n=== Test 2: CSS 404 Check ===');
    const css404s = cssRequests.filter(req => req.status === 404);

    if (css404s.length > 0) {
      console.log(`❌ Found ${css404s.length} CSS 404 errors:`);
      css404s.forEach(req => console.log(`  - ${req.url}`));
    } else {
      console.log('✓ No CSS 404 errors found');
    }

    expect(css404s.length).toBe(0);

    // === CRITICAL TEST 3: Verify 100% CSS files loaded ===
    console.log('\n=== Test 3: CSS Load Percentage ===');
    const totalCssRequests = cssRequests.length;
    const successfulCssRequests = cssRequests.filter(req => req.status === 200).length;
    const loadPercentage = (successfulCssRequests / totalCssRequests) * 100;

    console.log(`Total CSS requests: ${totalCssRequests}`);
    console.log(`Successful CSS loads: ${successfulCssRequests}`);
    console.log(`Load percentage: ${loadPercentage.toFixed(1)}%`);

    if (loadPercentage === 100) {
      console.log('✓ 100% CSS files loaded successfully');
    } else {
      console.log(`❌ Only ${loadPercentage.toFixed(1)}% CSS files loaded`);
    }

    expect(loadPercentage).toBe(100);

    // === CRITICAL TEST 4: Verify MOLE theme styling applied ===
    console.log('\n=== Test 4: MOLE Theme Styling ===');

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

    console.log('Body computed styles:', JSON.stringify(bodyStyles, null, 2));

    // Check if we have custom styling (not browser defaults)
    const hasCustomFont = !bodyStyles.fontFamily.toLowerCase().includes('times new roman');
    const hasCustomBackground = bodyStyles.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
                                 bodyStyles.backgroundColor !== 'rgb(255, 255, 255)';

    console.log(`✓ Custom font: ${hasCustomFont} (not Times New Roman)`);
    console.log(`✓ Custom background: ${hasCustomBackground} (not default)`);

    expect(hasCustomFont).toBe(true);

    // === CRITICAL TEST 5: Verify NO console errors about MIME types or stylesheets ===
    console.log('\n=== Test 5: Console Errors Check ===');

    const cssRelatedErrors = consoleErrors.filter(err =>
      err.toLowerCase().includes('css') ||
      err.toLowerCase().includes('mime') ||
      err.toLowerCase().includes('stylesheet')
    );

    if (cssRelatedErrors.length > 0) {
      console.log(`❌ Found ${cssRelatedErrors.length} CSS-related console errors:`);
      cssRelatedErrors.forEach(err => console.log(`  - ${err}`));
    } else {
      console.log('✓ No CSS-related console errors found');
    }

    expect(cssRelatedErrors.length).toBe(0);

    // === CRITICAL TEST 6: Verify theme CSS loaded ===
    console.log('\n=== Test 6: Theme CSS File ===');

    const themeCssRequest = cssRequests.find(req =>
      req.url.includes('theme-mole.css')
    );

    if (themeCssRequest) {
      console.log('✓ Theme CSS file found');
      console.log(`  URL: ${themeCssRequest.url}`);
      console.log(`  Status: ${themeCssRequest.status}`);
      expect(themeCssRequest.status).toBe(200);
    } else {
      console.log('⚠ Theme CSS file not found in requests');
    }

    // === CRITICAL TEST 7: Verify styling on header element ===
    console.log('\n=== Test 7: Header Element Styling ===');

    const headerStyles = await page.evaluate(() => {
      const header = document.querySelector('.app-header, header');
      if (!header) return null;
      const computed = window.getComputedStyle(header);
      return {
        display: computed.display,
        backgroundColor: computed.backgroundColor,
        padding: computed.padding,
        height: computed.height,
        fontSize: computed.fontSize
      };
    });

    if (headerStyles) {
      console.log('Header computed styles:', JSON.stringify(headerStyles, null, 2));

      // Check if header has custom styling
      const hasCustomHeaderStyling = headerStyles.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
                                     headerStyles.padding !== '0px';

      console.log(`✓ Header has custom styling: ${hasCustomHeaderStyling}`);
      expect(hasCustomHeaderStyling).toBe(true);
    } else {
      console.log('⚠ Header element not found');
    }

    // Take final screenshot with styling applied
    await page.screenshot({
      path: 'test-results/screenshots/css-verification-02-styled.png',
      fullPage: true
    });

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
      headerStyles: headerStyles,
      comparison: {
        v1_0_5_issues: {
          cssBaseFile404: true,
          browserDefaultStyling: true,
          loadPercentage: 66.7
        },
        v1_0_6_fixes: {
          mainCssFile200: mainCssRequest?.status === 200,
          customStyling: hasCustomFont,
          loadPercentage: loadPercentage
        }
      }
    };

    // Write report to file
    const reportPath = '/home/aaron/opnix/test-results/css-loading-verification-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n✓ CSS verification report saved to: ${reportPath}`);

    // === FINAL SUMMARY ===
    console.log('\n=== CSS LOADING VERIFICATION SUMMARY ===');
    console.log(`✓ Main CSS file (/assets/assets/main-DYP7pi_n.css): ${mainCssRequest?.status === 200 ? 'PASS' : 'FAIL'}`);
    console.log(`✓ No CSS 404 errors: ${css404s.length === 0 ? 'PASS' : 'FAIL'}`);
    console.log(`✓ CSS load percentage: ${loadPercentage.toFixed(1)}% (Expected: 100%)`);
    console.log(`✓ Custom styling applied: ${hasCustomFont ? 'PASS' : 'FAIL'}`);
    console.log(`✓ No console errors: ${cssRelatedErrors.length === 0 ? 'PASS' : 'FAIL'}`);
    console.log(`✓ Theme CSS loaded: ${themeCssRequest?.status === 200 ? 'PASS' : 'FAIL'}`);
    console.log('\n=== Comparison with v1.0.5 ===');
    console.log(`v1.0.5: 66.7% CSS loaded with /css/base.css 404`);
    console.log(`v1.0.6: ${loadPercentage.toFixed(1)}% CSS loaded with /assets/assets/main-DYP7pi_n.css ${mainCssRequest?.status || 'N/A'}`);
    console.log('\n✓ CSS Loading Fix Verified Successfully!\n');
  });
});
