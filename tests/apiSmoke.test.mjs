import assert from 'node:assert/strict';
import {
  app,
  ensureDataDirectory,
  ensureExportStructure,
  listExportFiles
} from '../server.js';
import { invokeRoute } from './helpers/invokeRoute.mjs';

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

  const markdownArchive = await invokeRoute(app, { method: 'GET', path: '/api/archive/markdown' });
  assert(Array.isArray(markdownArchive.body.files), 'markdown archive should list files');

  const exportsListing = await invokeRoute(app, { method: 'GET', path: '/api/exports' });
  assert(Array.isArray(exportsListing.body.files), 'exports endpoint should return file array');

  const snapshot = await listExportFiles();
  assert(Array.isArray(snapshot), 'listExportFiles helper should return array');

  console.log('apiSmoke tests passed');
})();
