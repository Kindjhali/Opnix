import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function compileVueComponent(relativePath) {
  const filename = path.join(__dirname, '..', relativePath);
  const source = await readFile(filename, 'utf8');
  const { descriptor } = parse(source, { filename });
  const id = `ui-smoke-${Math.random().toString(36).slice(2)}`;

  if (descriptor.script || descriptor.scriptSetup) {
    compileScript(descriptor, { id });
  }

  if (descriptor.template && descriptor.template.content) {
    const result = compileTemplate({ id, filename, source: descriptor.template.content });
    assert.equal(result.errors.length, 0, `${relativePath} template should compile without errors`);
  }
}

const componentPaths = [
  'src/components/StatusDashboard.vue',
  'src/components/SessionResumeDashboard.vue',
  'src/components/QuickActionsPanel.vue',
  'src/components/RecentSessions.vue',
  'src/components/ContextSummaryContainer.vue',
  'src/components/ContextSummaryCard.vue',
  'src/components/CollapsibleSection.vue',
  'src/components/DensityControls.vue',
  'src/components/ProgressIndicator.vue',
  'src/components/BulkOperationsToolbar.vue',
  'src/components/TechStackTab.vue'
];

await test('modular UI components compile', async (t) => {
  for (const componentPath of componentPaths) {
    await t.test(`${componentPath} compiles`, async () => {
      await compileVueComponent(componentPath);
    });
  }
});
