import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  initDataFile,
  ensureDataDirectory,
  readTerminalHistory,
  writeTerminalHistory,
  clearTerminalHistory,
  TERMINAL_HISTORY_FILE,
  terminalExecuteRoute,
  terminalHistoryRoute
} from '../server.js';

async function invokeHandler(handler, { method = 'GET', body = {}, query = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = {
      method: method.toUpperCase(),
      body,
      query,
      headers: {},
      get(header) {
        return this.headers[String(header).toLowerCase()] || undefined;
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
      },
      json(payload) {
        resolve({ statusCode: this.statusCode, payload });
      }
    };

    Promise.resolve(handler(req, res)).catch(reject);
  });
}

(async () => {
  await initDataFile();
  await ensureDataDirectory();

  const originalHistoryRaw = await fs.readFile(TERMINAL_HISTORY_FILE, 'utf8').catch(() => null);
  await writeTerminalHistory([]);

  try {
    const beforeHistory = await readTerminalHistory();
    assert(Array.isArray(beforeHistory), 'history should be an array');
    assert.equal(beforeHistory.length, 0, 'history should start clean for test');

    const executionResult = await invokeHandler(terminalExecuteRoute, {
      method: 'post',
      body: { command: 'echo "terminal-test"', cwd: '.' }
    });

    assert.equal(executionResult.statusCode || 200, 200, 'execution should return 200 OK');
    const execution = executionResult.payload;
    assert.equal(execution.exitCode, 0, 'echo command should exit cleanly');
    assert.match(execution.stdout, /terminal-test/, 'stdout should include echo output');
    assert.equal(execution.cwd, '.', 'cwd should default to repository root');

    const historyResult = await invokeHandler(terminalHistoryRoute, { method: 'get' });
    const history = historyResult.payload;
    assert(Array.isArray(history), 'history endpoint returns an array');
    assert(history.length >= 1, 'history should include executed command');

    const latest = history[0];
    assert(latest.command.includes('echo'), 'latest history entry should reference the echo command');

    const storedHistory = await readTerminalHistory();
    assert(storedHistory.some(entry => entry.command === execution.command), 'history file should persist command');

    await clearTerminalHistory();
    const cleared = await readTerminalHistory();
    assert.equal(cleared.length, 0, 'clearTerminalHistory should reset the log');
  } finally {
    if (originalHistoryRaw !== null) {
      await fs.writeFile(TERMINAL_HISTORY_FILE, originalHistoryRaw);
    } else {
      await writeTerminalHistory([]);
    }
  }

  console.log('terminal runner tests passed');
})();
