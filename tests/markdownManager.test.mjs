import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  markdownCreateRoute,
  markdownListRoute,
  markdownReadRoute,
  markdownUpdateRoute
} from '../server.js';

function invokeRoute(handler, { method = 'GET', body = {}, params = {}, query = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = {
      method: method.toUpperCase(),
      body,
      params,
      query,
      headers: {},
      get(name) {
        return this.headers[String(name).toLowerCase()] || undefined;
      }
    };

    const res = {
      statusCode: 200,
      headers: {},
      status(code) {
        this.statusCode = code;
        return this;
      },
      set(field, value) {
        this.headers[field.toLowerCase()] = value;
        return this;
      },
      type() {
        return this;
      },
      json(payload) {
        resolve({ statusCode: this.statusCode || 200, payload });
      },
      send(payload) {
        resolve({ statusCode: this.statusCode || 200, payload });
      }
    };

    Promise.resolve(handler(req, res)).catch(reject);
  });
}

(async () => {
  const __filename = fileURLToPath(import.meta.url);
  const ROOT = path.join(path.dirname(__filename), '..');
  const testFolder = path.join(ROOT, 'docs', '.test-markdown');
  const relativeDir = '.test-markdown';
  const fileName = `suite-${Date.now()}.md`;
  const relativePath = `${relativeDir}/${fileName}`;
  const fullPath = path.join(testFolder, fileName);

  try {
    await fs.mkdir(testFolder, { recursive: true });

    const createResult = await invokeRoute(markdownCreateRoute, {
      method: 'post',
      body: {
        rootId: 'docs',
        relativePath,
        content: '# Markdown Manager Test\n\nInitial content.'
      }
    });

    assert.equal(createResult.statusCode, 201, 'create should return 201');
    assert.ok(createResult.payload?.file, 'create should return file metadata');
    assert.equal(createResult.payload.file.relativePath, relativePath, 'metadata should echo relative path');

    const readResult = await invokeRoute(markdownReadRoute, {
      method: 'get',
      params: { rootId: 'docs', relativePath }
    });
    assert.equal(readResult.statusCode, 200, 'read should return 200');
    assert.match(readResult.payload, /Initial content/, 'read should return file content');

    const updateResult = await invokeRoute(markdownUpdateRoute, {
      method: 'put',
      params: { rootId: 'docs', relativePath },
      body: { content: '# Markdown Manager Test\n\nUpdated content.' }
    });
    assert.equal(updateResult.statusCode, 200, 'update should return 200');
    assert.match(updateResult.payload.file?.modified || '', /T/, 'update should return metadata with timestamp');

    const listResult = await invokeRoute(markdownListRoute, { method: 'get' });
    assert.equal(listResult.statusCode, 200, 'list should return 200');
    const files = Array.isArray(listResult.payload?.files) ? listResult.payload.files : [];
    assert(files.some(entry => entry.relativePath === relativePath), 'list should include created markdown file');

    const persisted = await fs.readFile(fullPath, 'utf8');
    assert.match(persisted, /Updated content/, 'file should contain updated markdown');
  } finally {
    await fs.rm(testFolder, { recursive: true, force: true }).catch(() => {});
  }

  console.log('markdown manager tests passed');
})();
