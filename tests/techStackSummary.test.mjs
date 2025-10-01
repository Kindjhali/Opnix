import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


test('Tech Stack Summary Tests', async (t) => {
  await t.test('tech stack manager module structure', async () => {
    const techStackManager = await import('../services/techStackManager.js');

    // Verify main functions are exported
    assert.ok(typeof techStackManager.getTechStackSummary === 'function');
    assert.ok(typeof techStackManager.refreshTechStackSummary === 'function');
    assert.ok(typeof techStackManager.exportTechStackMarkdown === 'function');
    assert.ok(typeof techStackManager.recordCliSessionImpact === 'function');
  });

  await t.test('tech stack summary generation', async () => {
    const techStackManager = await import('../services/techStackManager.js');

    // Test basic summary generation
    const summary = await techStackManager.getTechStackSummary({ refresh: true });

    assert.ok(summary);
    assert.ok(summary.generatedAt);
    assert.ok(summary.package);
    assert.ok(summary.dependencies);
    assert.ok(summary.devDependencies);
    assert.ok(Array.isArray(summary.frameworks));
    assert.ok(summary.moduleSummary);
    assert.ok(summary.cliInsights);
    assert.ok(summary.dependencyCategories);
    const categoryKeys = Object.keys(summary.dependencyCategories);
    assert.ok(categoryKeys.includes('frontend'));
    assert.ok(Array.isArray(summary.dependencyCategories.frontend.items));

    // Verify package info structure
    assert.ok(summary.package.name);
    assert.ok(summary.package.version);
    assert.ok(summary.package.packageManager);

    // Verify dependencies structure
    assert.ok(typeof summary.dependencies.total === 'number');
    assert.ok(Array.isArray(summary.dependencies.items));

    // Verify dev dependencies structure
    assert.ok(typeof summary.devDependencies.total === 'number');
    assert.ok(Array.isArray(summary.devDependencies.items));

    // Verify module summary structure
    assert.ok(typeof summary.moduleSummary.total === 'number');
    assert.ok(typeof summary.moduleSummary.detectedCount === 'number');
    assert.ok(typeof summary.moduleSummary.manualCount === 'number');
    assert.ok(Array.isArray(summary.moduleSummary.details));
  });

  await t.test('tech stack caching behavior', async () => {
    const techStackManager = await import('../services/techStackManager.js');

    // Generate fresh summary
    const freshSummary = await techStackManager.getTechStackSummary({ refresh: true });

    // Get cached summary
    const cachedSummary = await techStackManager.getTechStackSummary({ refresh: false });

    // Should have same generated timestamp (from cache)
    assert.strictEqual(freshSummary.generatedAt, cachedSummary.generatedAt);

    // Should have same package name
    assert.strictEqual(freshSummary.package.name, cachedSummary.package.name);
  });

  await t.test('dependency list processing', async () => {
    const techStackManager = await import('../services/techStackManager.js');

    const summary = await techStackManager.getTechStackSummary({ refresh: true });

    // Verify dependencies have correct structure
    summary.dependencies.items.forEach(dep => {
      assert.ok(dep.name);
      assert.ok(dep.version);
      assert.strictEqual(typeof dep.name, 'string');
      assert.strictEqual(typeof dep.version, 'string');
    });

    // Verify dev dependencies have correct structure
    summary.devDependencies.items.forEach(dep => {
      assert.ok(dep.name);
      assert.ok(dep.version);
      assert.strictEqual(typeof dep.name, 'string');
      assert.strictEqual(typeof dep.version, 'string');
    });

    // Dependencies should be sorted alphabetically
    const depNames = summary.dependencies.items.map(dep => dep.name);
    const sortedDepNames = [...depNames].sort();
    assert.deepStrictEqual(depNames, sortedDepNames);
  });

  await t.test('module detection integration', async () => {
    const techStackManager = await import('../services/techStackManager.js');

    const summary = await techStackManager.getTechStackSummary({ refresh: true });

    // Should have detected some modules for this project
    assert.ok(summary.moduleSummary.total > 0);

    // Verify module details structure
    summary.moduleSummary.details.forEach(module => {
      assert.ok(module.id);
      assert.ok(module.name);
      assert.ok(module.type);
      assert.ok(['auto', 'manual'].includes(module.source) || module.source);
      assert.strictEqual(typeof module.manual, 'boolean');
      assert.ok(Array.isArray(module.dependencies));
      assert.ok(Array.isArray(module.externalDependencies));
      assert.ok(Array.isArray(module.frameworks));
    });
  });

  await t.test('CLI insights processing', async () => {
    const techStackManager = await import('../services/techStackManager.js');

    const summary = await techStackManager.getTechStackSummary({ refresh: true });

    // Verify CLI insights structure
    assert.ok(summary.cliInsights);
    assert.ok(Array.isArray(summary.cliInsights.project));
    assert.ok(Array.isArray(summary.cliInsights.module));
    assert.ok(typeof summary.cliInsights.sessionsAnalyzed === 'number');

    // CLI insights should be sorted by recordedAt (newest first)
    if (summary.cliInsights.project.length > 1) {
      for (let i = 1; i < summary.cliInsights.project.length; i++) {
        const prev = summary.cliInsights.project[i - 1];
        const curr = summary.cliInsights.project[i];
        assert.ok(prev.recordedAt >= curr.recordedAt);
      }
    }
  });

  await t.test('CLI session completion triggers tech stack refresh', async () => {
    const techStackManager = await import('../services/techStackManager.js');
    const cliInterviewManagerModule = await import('../services/cliInterviewManager.js');
    const { startSession, submitAnswer, CLI_SESSIONS_DIR } = cliInterviewManagerModule;

    const originalRecord = techStackManager.recordCliSessionImpact;
    let invoked = 0;
    techStackManager.recordCliSessionImpact = async () => {
      invoked += 1;
    };

    const { session, question } = await startSession({ category: 'spec', command: '/spec --integration' });
    const sessionPath = path.join(CLI_SESSIONS_DIR, `${session.sessionId}.json`);
    const stored = JSON.parse(await fs.readFile(sessionPath, 'utf8'));
    if (Array.isArray(stored.questions) && stored.questions.length > 1) {
      stored.questions = [stored.questions[0]];
      await fs.writeFile(sessionPath, JSON.stringify(stored, null, 2));
    }

    try {
      const submission = await submitAnswer({
        sessionId: session.sessionId,
        questionId: question.id,
        answer: 'Tech stack refresh verification'
      });

      assert.ok(submission.completed, 'Session should complete after final answer override');
      assert.ok(invoked > 0, 'Tech stack refresh should be triggered by CLI session completion');

      if (Array.isArray(submission.artifacts)) {
        await Promise.all(submission.artifacts.map(async artifact => {
          if (artifact && artifact.path) {
            await fs.unlink(artifact.path).catch(() => {});
          }
        }));
      }
    } finally {
      techStackManager.recordCliSessionImpact = originalRecord;
      await fs.unlink(sessionPath).catch(() => {});
    }
  });
});

test('Tech Stack Markdown Export Tests', async (t) => {
  await t.test('markdown export functionality', async () => {
    const techStackManager = await import('../services/techStackManager.js');

    const exportResult = await techStackManager.exportTechStackMarkdown();

    assert.ok(exportResult.success);
    assert.ok(exportResult.export);
    assert.ok(exportResult.export.filename);
    assert.ok(exportResult.export.path);
    assert.ok(exportResult.export.relativePath);

    // Verify file was actually created
    const fileExists = await fs.access(exportResult.export.path).then(() => true).catch(() => false);
    assert.ok(fileExists);

    // Verify file content structure
    const content = await fs.readFile(exportResult.export.path, 'utf8');
    assert.ok(content.includes('# Tech Stack Summary'));
    assert.ok(content.includes('## Package'));
    assert.ok(content.includes('## Frameworks'));
    assert.ok(content.includes('## Dependencies'));
    assert.ok(content.includes('## Dev Dependencies'));
    assert.ok(content.includes('## Modules'));
    assert.ok(content.includes('## Categorised Dependencies'));
    assert.ok(content.includes('## CLI Insights'));
  });

  await t.test('markdown format validation', async () => {
    const techStackManager = await import('../services/techStackManager.js');

    const exportResult = await techStackManager.exportTechStackMarkdown();
    const content = await fs.readFile(exportResult.export.path, 'utf8');

    // Check for proper markdown headers
    const headerPattern = /^#{1,3} .+$/gm;
    const headers = content.match(headerPattern);
    assert.ok(headers);
    assert.ok(headers.length > 5); // Should have multiple headers

    // Check for proper list formatting
    const listPattern = /^- .+$/gm;
    const listItems = content.match(listPattern);
    assert.ok(listItems);
    assert.ok(listItems.length > 0);

    // Verify timestamp format
    assert.ok(content.includes('Generated at:'));
    const timestampPattern = /Generated at: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/;
    assert.ok(timestampPattern.test(content));
  });

  await t.test('export file naming convention', async () => {
    const techStackManager = await import('../services/techStackManager.js');

    const exportResult = await techStackManager.exportTechStackMarkdown();

    // Verify filename follows expected pattern: tech-stack-YYYY-MM-DDTHH-mm-ss-sssZ.md
    const filenamePattern = /^tech-stack-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.md$/;
    assert.ok(filenamePattern.test(exportResult.export.filename));

    // Verify relative path starts with docs/
    assert.ok(exportResult.export.relativePath.startsWith('docs/'));
  });
});

test('Tech Stack API Routes Tests', async (t) => {
  await t.test('GET /api/tech-stack endpoint', async () => {
    const techStackManager = await import('../services/techStackManager.js');
    const { createTechStackRoutes } = await import('../routes/techStack.js');

    const routes = createTechStackRoutes({ techStackManager });

    // Find the GET route handler
    const getRoute = routes.stack.find(layer =>
      layer.route && layer.route.path === '/api/tech-stack' && layer.route.methods.get
    );

    assert.ok(getRoute, 'GET /api/tech-stack route should exist');
  });

  await t.test('POST /api/tech-stack/export endpoint', async () => {
    const techStackManager = await import('../services/techStackManager.js');
    const { createTechStackRoutes } = await import('../routes/techStack.js');

    const routes = createTechStackRoutes({ techStackManager });

    // Find the POST route handler
    const postRoute = routes.stack.find(layer =>
      layer.route && layer.route.path === '/api/tech-stack/export' && layer.route.methods.post
    );

    assert.ok(postRoute, 'POST /api/tech-stack/export route should exist');
  });

  await t.test('tech stack routes error handling', async () => {
    // Create mock tech stack manager that throws errors
    const mockTechStackManager = {
      getTechStackSummary: async () => { throw new Error('Test error'); },
      exportTechStackMarkdown: async () => { throw new Error('Export error'); }
    };

    const { createTechStackRoutes } = await import('../routes/techStack.js');

    // Should not throw when creating routes with mock
    assert.doesNotThrow(() => {
      createTechStackRoutes({ techStackManager: mockTechStackManager });
    });
  });

  await t.test('tech stack routes dependency validation', async () => {
    const { createTechStackRoutes } = await import('../routes/techStack.js');

    // Should throw when tech stack manager is missing
    assert.throws(() => {
      createTechStackRoutes({});
    }, /Tech stack manager dependency is required/);

    assert.throws(() => {
      createTechStackRoutes({ techStackManager: null });
    }, /Tech stack manager dependency is required/);
  });
});

test('Tech Stack Data Persistence Tests', async (t) => {
  await t.test('tech stack summary file persistence', async () => {
    const techStackManager = await import('../services/techStackManager.js');

    // Generate a fresh summary
    await techStackManager.refreshTechStackSummary();

    // Verify summary file exists
    const dataDir = path.join(__dirname, '..', 'data');
    const techStackFile = path.join(dataDir, 'tech-stack.json');

    const fileExists = await fs.access(techStackFile).then(() => true).catch(() => false);
    assert.ok(fileExists, 'tech-stack.json file should exist after generation');

    if (fileExists) {
      const content = await fs.readFile(techStackFile, 'utf8');
      const summary = JSON.parse(content);

      assert.ok(summary.generatedAt);
      assert.ok(summary.package);
      assert.ok(summary.dependencies);
      assert.ok(summary.moduleSummary);
    }
  });

  await t.test('CLI session impact recording', async () => {
    const techStackManager = await import('../services/techStackManager.js');

    // Should not throw when recording CLI session impact
    assert.doesNotReject(async () => {
      await techStackManager.recordCliSessionImpact();
    });
  });
});

test('Tech Stack Data Validation Tests', async (t) => {
  await t.test('framework list generation', async () => {
    const techStackManager = await import('../services/techStackManager.js');

    const summary = await techStackManager.getTechStackSummary({ refresh: true });

    // Frameworks should be lowercase and sorted
    assert.ok(Array.isArray(summary.frameworks));

    if (summary.frameworks.length > 1) {
      for (let i = 1; i < summary.frameworks.length; i++) {
        const prev = summary.frameworks[i - 1];
        const curr = summary.frameworks[i];
        assert.ok(prev <= curr, 'Frameworks should be sorted alphabetically');
        assert.strictEqual(curr, curr.toLowerCase(), 'Frameworks should be lowercase');
      }
    }
  });

  await t.test('module summary calculations', async () => {
    const techStackManager = await import('../services/techStackManager.js');

    const summary = await techStackManager.getTechStackSummary({ refresh: true });
    const moduleSummary = summary.moduleSummary;

    // Verify calculated totals match actual counts
    assert.strictEqual(
      moduleSummary.total,
      moduleSummary.detectedCount + moduleSummary.manualCount
    );

    assert.strictEqual(
      moduleSummary.total,
      moduleSummary.details.length
    );

    // Verify type counts add up to total
    const typeTotal = Object.values(moduleSummary.byType).reduce((sum, count) => sum + count, 0);
    assert.strictEqual(typeTotal, moduleSummary.total);

    // Verify external dependency count
    const actualExternalDeps = moduleSummary.details.reduce(
      (sum, module) => sum + module.externalDependencies.length,
      0
    );
    assert.strictEqual(moduleSummary.externalDependencyCount, actualExternalDeps);
  });

  await t.test('dependency list sorting and structure', async () => {
    const techStackManager = await import('../services/techStackManager.js');

    const summary = await techStackManager.getTechStackSummary({ refresh: true });

    // All dependencies should have name and version
    [...summary.dependencies.items, ...summary.devDependencies.items].forEach(dep => {
      assert.ok(dep.name, 'Dependency should have name');
      assert.ok(dep.version, 'Dependency should have version');
      assert.strictEqual(typeof dep.name, 'string');
      assert.strictEqual(typeof dep.version, 'string');
      assert.ok(dep.name.length > 0);
      assert.ok(dep.version.length > 0);
    });
  });
});