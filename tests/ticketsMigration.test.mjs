import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DATA_DIR,
  readData
} from '../server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataFile = path.join(DATA_DIR, 'tickets.json');
const legacyPath = path.join(__dirname, '..', 'tickets.json');
const legacyImportDir = path.join(DATA_DIR, 'legacy-imports');

async function ensureDirectory(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function readFileIfExists(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function removeIfExists(filePath) {
  try {
    await fs.rm(filePath, { recursive: true, force: true });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

(async () => {
  await ensureDirectory(DATA_DIR);
  const originalData = await readFileIfExists(dataFile);
  const originalLegacy = await readFileIfExists(legacyPath);

  const beforeArchiveFiles = new Set();
  try {
    await ensureDirectory(legacyImportDir);
    const existingArchive = await fs.readdir(legacyImportDir).catch(() => []);
    existingArchive.forEach(name => beforeArchiveFiles.add(name));

    // Baseline data in modern format.
    const baselineData = {
      tickets: [
        { id: 1, title: 'Existing Ticket', description: 'baseline', priority: 'medium', status: 'reported', created: new Date().toISOString(), tags: [] }
      ],
      nextId: 2
    };
    await fs.writeFile(dataFile, JSON.stringify(baselineData, null, 2));

    // Legacy payload (array form) dropped at repo root.
    const legacyTickets = [
      { id: 10, title: 'Legacy Imported', description: 'from legacy root', priority: 'high', status: 'reported', created: '2024-01-01T00:00:00.000Z', tags: ['LEGACY'] }
    ];
    await fs.writeFile(legacyPath, JSON.stringify(legacyTickets, null, 2));
    const future = new Date(Date.now() + 2000);
    await fs.utimes(legacyPath, future, future);

    const imported = await readData();

    assert(imported.tickets.some(ticket => ticket.title === 'Legacy Imported'), 'legacy tickets should be imported');
    const importedTicket = imported.tickets.find(ticket => ticket.title === 'Legacy Imported');
    assert.equal(importedTicket.id, 10, 'legacy ticket id should be preserved');
    assert.equal(imported.nextId, 11, 'nextId should advance beyond highest legacy id');

    await assert.rejects(fs.access(legacyPath), /ENOENT/, 'legacy file should be archived after import');

    // verify archived file created
    const archiveFiles = await fs.readdir(legacyImportDir);
    const newArchives = archiveFiles.filter(name => !beforeArchiveFiles.has(name));
    assert(newArchives.length > 0, 'import should archive legacy file');

    // Second scenario: legacy file older than data should not override
    const archiveToRemove = newArchives.map(name => path.join(legacyImportDir, name));
    await Promise.all(archiveToRemove.map(file => removeIfExists(file)));

    const modernPayload = {
      tickets: [
        { id: 1, title: 'Modern Ticket', description: 'modern data', priority: 'medium', status: 'reported', created: new Date().toISOString(), tags: [] }
      ],
      nextId: 2
    };
    await fs.writeFile(dataFile, JSON.stringify(modernPayload, null, 2));

    const legacyOlder = [
      { id: 2, title: 'Older Legacy', description: 'should not override', priority: 'low', status: 'reported', created: '2023-01-01T00:00:00.000Z', tags: [] }
    ];
    await fs.writeFile(legacyPath, JSON.stringify(legacyOlder, null, 2));
    const past = new Date(Date.now() - 10_000);
    await fs.utimes(legacyPath, past, past);

    const modernData = await readData();
    assert(modernData.tickets.some(ticket => ticket.title === 'Modern Ticket'), 'modern data should remain when legacy file is older');
    assert(!modernData.tickets.some(ticket => ticket.title === 'Older Legacy'), 'older legacy file should not replace modern data');

    // Third scenario: user drops bare array payload directly into data/tickets.json
    const bareArrayPayload = [
      { id: '3', title: 'Array Ticket', description: 'dropped directly into data folder', priority: 'low', status: 'reported', created: '2024-02-02T00:00:00.000Z', tags: ['ARRAY'] }
    ];
    await fs.writeFile(dataFile, JSON.stringify(bareArrayPayload, null, 2));

    const normalisedFromArray = await readData();
    assert(Array.isArray(normalisedFromArray.tickets), 'tickets should be an array after normalising bare payload');
    const arrayTicket = normalisedFromArray.tickets.find(ticket => ticket.title === 'Array Ticket');
    assert(arrayTicket, 'array payload ticket should be present after normalisation');
    assert.equal(arrayTicket.id, 3, 'string ids are coerced to numbers for bare payloads');
    assert.equal(normalisedFromArray.nextId, 4, 'nextId should advance beyond highest coerced id');

    const persistedNormalised = JSON.parse(await fs.readFile(dataFile, 'utf8'));
    assert(!Array.isArray(persistedNormalised), 'persisted data file should not remain a bare array');
    assert(Array.isArray(persistedNormalised.tickets), 'persisted data file should include tickets array');
  } finally {
    if (originalData !== null) {
      await fs.writeFile(dataFile, originalData);
    } else {
      await removeIfExists(dataFile);
    }

    await removeIfExists(legacyPath);
    if (originalLegacy !== null) {
      await fs.writeFile(legacyPath, originalLegacy);
    }
  }

  console.log('tickets migration tests passed');
process.exit(0);
})();
