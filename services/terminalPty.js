let pty = null;
try {
  // node-pty requires native bindings; swallow load errors so tests can run without it.
  pty = require('node-pty');
} catch (error) {
  console.warn('[terminalPty] node-pty unavailable:', error.message);
}
const path = require('path');
const os = require('os');

class TerminalManager {
  constructor() {
    this.terminals = new Map();
  }

  createTerminal(id, socket, options = {}) {
    const shell = os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash';
    const cwd = options.cwd || process.env.HOME || process.cwd();

    const cols = options.cols || 80;
    const rows = options.rows || 24;

    if (!pty || typeof pty.spawn !== 'function') {
      throw new Error('node-pty is not installed; terminal sessions are disabled in this environment.');
    }

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor'
      }
    });

    ptyProcess.onData(data => {
      try {
        if (socket.readyState === 1) {
          socket.send(JSON.stringify({ type: 'output', data }));
        }
      } catch (error) {
        console.error('Error sending terminal data:', error);
      }
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      console.log(`Terminal ${id} exited with code ${exitCode}, signal ${signal}`);
      try {
        if (socket.readyState === 1) {
          socket.send(JSON.stringify({
            type: 'exit',
            exitCode,
            signal
          }));
        }
      } catch (error) {
        console.error('Error sending exit notification:', error);
      }
      this.terminals.delete(id);
    });

    this.terminals.set(id, {
      id,
      ptyProcess,
      socket,
      createdAt: new Date()
    });

    return ptyProcess;
  }

  writeToTerminal(id, data) {
    const terminal = this.terminals.get(id);
    if (terminal && terminal.ptyProcess) {
      terminal.ptyProcess.write(data);
      return true;
    }
    return false;
  }

  resizeTerminal(id, cols, rows) {
    const terminal = this.terminals.get(id);
    if (terminal && terminal.ptyProcess) {
      try {
        terminal.ptyProcess.resize(cols, rows);
        return true;
      } catch (error) {
        console.error(`Error resizing terminal ${id}:`, error);
        return false;
      }
    }
    return false;
  }

  killTerminal(id) {
    const terminal = this.terminals.get(id);
    if (terminal && terminal.ptyProcess) {
      try {
        terminal.ptyProcess.kill();
        this.terminals.delete(id);
        return true;
      } catch (error) {
        console.error(`Error killing terminal ${id}:`, error);
        return false;
      }
    }
    return false;
  }

  getTerminal(id) {
    return this.terminals.get(id);
  }

  getAllTerminals() {
    return Array.from(this.terminals.values()).map(t => ({
      id: t.id,
      createdAt: t.createdAt
    }));
  }

  cleanup() {
    for (const [id, terminal] of this.terminals) {
      try {
        if (terminal.ptyProcess) {
          terminal.ptyProcess.kill();
        }
      } catch (error) {
        console.error(`Error cleaning up terminal ${id}:`, error);
      }
    }
    this.terminals.clear();
  }
}

module.exports = new TerminalManager();
