import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { detectModules } from '../services/moduleDetector.js';
import { generateSpecFile } from '../services/specGenerator.js';
import {
  ensureExportStructure,
  ensureDataDirectory,
  listExportFiles,
  EXPORT_SUBDIRS,
  EXPORTS_DIR
} from '../server.js';

(async () => {
  await ensureDataDirectory();
  await ensureExportStructure();

  const createdArtifacts = [];

  try {
    const detection = await detectModules(process.cwd());
    assert(Array.isArray(detection.modules), 'Module detector should return a module array');
    assert(detection.modules.length > 0, 'Module detector should discover at least one module');

    const sampleNodes = detection.modules.slice(0, 2).map(module => ({
      data: {
        id: module.id,
        label: module.name
      }
    }));

    const canvasExport = {
      format: 'json',
      generatedAt: new Date().toISOString(),
      elements: {
        nodes: sampleNodes,
        edges: []
      }
    };

    const canvasFilename = `integration-canvas-${Date.now()}.json`;
    const canvasPath = path.join(EXPORT_SUBDIRS.canvas, canvasFilename);
    await fs.writeFile(canvasPath, JSON.stringify(canvasExport, null, 2));
    await fs.access(canvasPath, fs.constants.F_OK);
    createdArtifacts.push(canvasPath);

    const specPayload = {
      generatedAt: new Date().toISOString(),
      questionAnswers: { 'project-type': 'API Service' },
      insights: { patterns: [], recommendedSections: [] },
      project: {
        name: 'Integration Flow Validation',
        type: 'API Service',
        goal: 'Validate the end-to-end Opnix flow without UI'
      },
      technical: {
        language: 'JavaScript',
        framework: 'Express',
        architecture: {
          current: 'Monolith',
          target: 'Service-focused',
          dataStores: 'Existing dataset',
          integrations: 'Internal services',
          testingStrategy: 'API smoke tests',
          observability: 'Centralised logging'
        }
      },
      modules: detection.modules.slice(0, 2),
      canvas: {
        edges: detection.edges || [],
        summary: detection.summary || {}
      },
      features: [],
      tickets: []
    };

    const specResult = await generateSpecFile({
      spec: specPayload,
      format: 'json',
      exportsDir: EXPORTS_DIR
    });

    await fs.access(specResult.path, fs.constants.F_OK);
    createdArtifacts.push(specResult.path);

    const exportsListing = await listExportFiles(EXPORTS_DIR);
    const canvasRel = path.relative(EXPORTS_DIR, canvasPath);
    const specRel = path.relative(EXPORTS_DIR, specResult.path);
    assert(exportsListing.some(file => file.relativePath === canvasRel), 'Exports listing should include canvas artifact');
    assert(exportsListing.some(file => file.relativePath === specRel), 'Exports listing should include generated spec');

    console.log('integrationFlow tests passed');
    process.exit(0);
  } finally {
    await Promise.all(createdArtifacts.map(async artifactPath => {
      try {
        await fs.unlink(artifactPath);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.warn('Failed to clean up artifact', artifactPath, error);
        }
      }
    }));
  }
})();
