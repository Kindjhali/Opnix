import http from 'node:http';
import assert from 'node:assert/strict';
import {
  app,
  ensureDataDirectory,
  ensureExportStructure,
  listExportFiles
} from '../server.js';
import { invokeRoute } from './helpers/invokeRoute.mjs';
import { stopRoadmapSyncWatchers } from '../services/roadmapSyncWatcher.js';
import questionFileWatcher from '../services/questionFileWatcher.js';

(async () => {
  await ensureDataDirectory();
  await ensureExportStructure();

  const health = await invokeRoute(app, { method: 'GET', path: '/api/health' });
  assert.equal(health.statusCode, 200, 'health endpoint should respond with 200');
  assert.equal(health.body.status, 'operational', 'health status should be operational');
  assert.equal(typeof health.body.tickets, 'number', 'health payload should include ticket count');

  const tickets = await invokeRoute(app, { method: 'GET', path: '/api/tickets' });
  assert(Array.isArray(tickets.body), 'tickets endpoint should return an array');
  if (tickets.body.length > 0) {
    const ticketId = String(tickets.body[0].id);
    const ticketResponse = await invokeRoute(app, {
      method: 'GET',
      path: '/api/tickets/:id',
      params: { id: ticketId }
    });
    assert.equal(ticketResponse.statusCode, 200, 'ticket detail should respond with 200');
    assert.equal(String(ticketResponse.body.id), ticketId, 'ticket detail payload should match requested id');
  }

  const modulesGraph = await invokeRoute(app, { method: 'GET', path: '/api/modules/graph' });
  assert(Array.isArray(modulesGraph.body.modules), 'modules graph should include module array');
  assert(modulesGraph.body.modules.length > 0, 'modules graph should discover modules');

  const detectModules = await invokeRoute(app, { method: 'POST', path: '/api/modules/detect', body: {} });
  assert(Array.isArray(detectModules.body.modules), 'module detection should return module array');

  const roadmapState = await invokeRoute(app, { method: 'GET', path: '/api/roadmap/state' });
  assert.equal(roadmapState.statusCode, 200, 'roadmap state should respond with 200');
  assert.equal(roadmapState.body.success, true, 'roadmap state payload should include success flag');
  assert(Array.isArray(roadmapState.body.state?.milestones), 'roadmap state should include milestones array');

  if ((roadmapState.body.state?.milestones || []).length) {
    const target = roadmapState.body.state.milestones[0];
    const patchBody = { field: 'notes', value: 'Smoke test inline update' };
    const updateResponse = await invokeRoute(app, {
      method: 'PATCH',
      path: '/api/roadmap/milestones/:id',
      params: { id: String(target.id ?? target.name ?? 1) },
      body: patchBody
    });
    assert.equal(updateResponse.statusCode, 200, 'roadmap milestone update should respond with 200');
    assert.equal(updateResponse.body.success, true, 'roadmap milestone update should include success flag');
    const updatedList = updateResponse.body.state?.milestones || [];
    const updated = updatedList.find(item => String(item.id ?? item.name) === String(target.id ?? target.name));
    assert(updated, 'roadmap milestone update should return updated milestone');
    if (updated) {
      assert.equal(updated.notes, patchBody.value, 'roadmap milestone should contain updated notes');
    }
  }

  const roadmapVersions = await invokeRoute(app, { method: 'GET', path: '/api/roadmap/versions' });
  assert.equal(roadmapVersions.statusCode, 200, 'roadmap versions should respond with 200');
  assert(Array.isArray(roadmapVersions.body.versions), 'roadmap versions should be an array');

  const markdownArchive = await invokeRoute(app, { method: 'GET', path: '/api/archive/markdown' });
  assert(Array.isArray(markdownArchive.body.files), 'markdown archive should list files');

  const docsGenerate = await invokeRoute(app, { method: 'POST', path: '/api/docs/generate', body: {} });
  assert.equal(docsGenerate.statusCode, 200, 'docs generate should respond with 200');
  assert.equal(docsGenerate.body.success, true, 'docs generate should indicate success');
  assert(docsGenerate.body.doc && docsGenerate.body.doc.filename, 'docs generate should return doc metadata');

  const apiSpecDraft = await invokeRoute(app, { method: 'POST', path: '/api/api-spec/generate', body: { format: 'openapi' } });
  assert.equal(apiSpecDraft.statusCode, 200, 'api spec draft should respond with 200');
  assert.equal(apiSpecDraft.body.success, true, 'api spec draft should indicate success');
  assert(apiSpecDraft.body.spec, 'api spec draft should include spec payload');

  const apiSpecExport = await invokeRoute(app, { method: 'POST', path: '/api/api-spec/export', body: { spec: apiSpecDraft.body.spec, format: 'openapi' } });
  assert.equal(apiSpecExport.statusCode, 200, 'api spec export should respond with 200');
  assert.equal(apiSpecExport.body.success, true, 'api spec export should indicate success');
  assert(apiSpecExport.body.filename, 'api spec export should include filename');

  const apiSpecTest = await invokeRoute(app, { method: 'POST', path: '/api/api-spec/test', body: { spec: apiSpecDraft.body.spec, format: 'openapi' } });
  assert.equal(apiSpecTest.statusCode, 200, 'api spec test should respond with 200');
  assert(Array.isArray(apiSpecTest.body.results), 'api spec test should return results array');

  const scopedSpec = await invokeRoute(app, {
    method: 'POST',
    path: '/api/specs/export/scoped',
    body: { includeSections: ['modules'], format: 'json' }
  });
  assert.equal(scopedSpec.statusCode, 200, 'scoped spec export should respond with 200');
  assert.equal(scopedSpec.body.success, true, 'scoped spec export should indicate success');
  assert(scopedSpec.body.artifact && scopedSpec.body.artifact.filename, 'scoped spec export should include artifact metadata');

  const constitutionDigest = await invokeRoute(app, {
    method: 'POST',
    path: '/api/runbooks/constitution',
    body: { docs: ['agents', 'claude'], excerptLines: 5 }
  });
  if (constitutionDigest.statusCode === 200) {
    assert.equal(constitutionDigest.body.success, true, 'constitution digest should indicate success when documents exist');
    assert(constitutionDigest.body.artifact && constitutionDigest.body.artifact.filename, 'constitution digest should include artifact metadata');
    assert(Array.isArray(constitutionDigest.body.includedDocs), 'constitution digest should list included docs');
  } else {
    assert.equal(constitutionDigest.statusCode, 404, 'constitution digest should return 404 only when documents are missing');
  }

  const exportsListing = await invokeRoute(app, { method: 'GET', path: '/api/exports' });
  assert(Array.isArray(exportsListing.body.files), 'exports endpoint should return file array');

  const serverInstance = http.createServer(app);
  await new Promise(resolve => serverInstance.listen(0, '127.0.0.1', resolve));
  const { port } = serverInstance.address();
  const cssResponse = await fetch(`http://127.0.0.1:${port}/css/base.css`);
  assert.equal(cssResponse.status, 200, 'css asset should respond with 200');
  const contentType = cssResponse.headers.get('content-type') || '';
  assert(contentType.includes('text/css'), 'css asset should return text/css content-type');
  const cssBody = await cssResponse.text();
  assert(cssBody && cssBody.length > 0, 'css asset should include content');
  await new Promise(resolve => serverInstance.close(resolve));

  const snapshot = await listExportFiles();
  assert(Array.isArray(snapshot), 'listExportFiles helper should return array');

  // Cleanup watchers to allow process to exit
  try {
    await stopRoadmapSyncWatchers();
    questionFileWatcher.stop();
  } catch (error) {
    console.warn('Warning: Failed to cleanup watchers:', error.message);
  }

  console.log('apiSmoke tests passed');
  process.exit(0);
})();
