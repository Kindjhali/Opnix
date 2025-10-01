<template>
  <div class="xterm-container">
    <div class="xterm-header">
      <h3>Terminal</h3>
      <div class="xterm-controls">
        <button @click="reconnect" :disabled="connecting" class="btn secondary">
          {{ connecting ? 'Connecting...' : 'Reconnect' }}
        </button>
        <button @click="clear" class="btn secondary">Clear</button>
      </div>
    </div>
    <div ref="terminalRef" class="xterm-wrapper"></div>
    <div v-if="error" class="xterm-error">{{ error }}</div>
  </div>
</template>

<script>
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

export default {
  name: 'XTerminal',
  data() {
    return {
      terminal: null,
      fitAddon: null,
      socket: null,
      connecting: false,
      error: ''
    };
  },
  mounted() {
    this.initTerminal();
    window.addEventListener('resize', this.handleResize);
  },
  beforeUnmount() {
    this.cleanup();
    window.removeEventListener('resize', this.handleResize);
  },
  methods: {
    initTerminal() {
      const computedStyle = window.getComputedStyle(document.documentElement);
      const bgDarkest = computedStyle.getPropertyValue('--bg-darkest').trim();
      const textPrimary = computedStyle.getPropertyValue('--text-primary').trim();
      const accent1 = computedStyle.getPropertyValue('--accent-1').trim();
      const accent2 = computedStyle.getPropertyValue('--accent-2').trim();
      const textMuted = computedStyle.getPropertyValue('--text-muted').trim();
      const danger = computedStyle.getPropertyValue('--danger').trim();
      const success = computedStyle.getPropertyValue('--success').trim();
      const warning = computedStyle.getPropertyValue('--warning').trim();

      this.terminal = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: '"JetBrains Mono", "Courier New", monospace',
        theme: {
          background: bgDarkest,
          foreground: textPrimary,
          cursor: accent1,
          cursorAccent: bgDarkest,
          selection: accent1,
          selectionInactiveBackground: accent2,
          black: bgDarkest,
          red: danger,
          green: success,
          yellow: warning,
          blue: accent2,
          magenta: accent1,
          cyan: accent2,
          white: textPrimary,
          brightBlack: textMuted,
          brightRed: danger,
          brightGreen: success,
          brightYellow: warning,
          brightBlue: accent2,
          brightMagenta: accent1,
          brightCyan: accent2,
          brightWhite: textPrimary
        },
        scrollback: 10000,
        allowProposedApi: true
      });

      this.fitAddon = new FitAddon();
      this.terminal.loadAddon(this.fitAddon);
      this.terminal.loadAddon(new WebLinksAddon());

      this.terminal.open(this.$refs.terminalRef);
      this.fitAddon.fit();

      this.connectWebSocket();
    },

    connectWebSocket() {
      this.connecting = true;
      this.error = '';

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/api/terminal`;

      this.socket = new window.WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.connecting = false;
        this.terminal.writeln('\x1b[32m✓ Terminal connected\x1b[0m');

        this.terminal.onData(data => {
          if (this.socket && this.socket.readyState === window.WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type: 'input', data }));
          }
        });

        this.terminal.onResize(({ cols, rows }) => {
          if (this.socket && this.socket.readyState === window.WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type: 'resize', cols, rows }));
          }
        });
      };

      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'output' && message.data) {
            this.terminal.write(message.data);
          }
        } catch {
          this.terminal.write(event.data);
        }
      };

      this.socket.onerror = () => {
        console.error('WebSocket error occurred');
        this.error = 'Connection error';
        this.connecting = false;
      };

      this.socket.onclose = () => {
        this.connecting = false;
        this.terminal.writeln('\n\x1b[31m✗ Terminal disconnected\x1b[0m');
        this.error = 'Connection closed';
      };
    },

    handleResize() {
      if (this.fitAddon) {
        this.fitAddon.fit();
      }
    },

    reconnect() {
      if (this.socket) {
        this.socket.close();
      }
      this.connectWebSocket();
    },

    clear() {
      if (this.terminal) {
        this.terminal.clear();
      }
    },

    cleanup() {
      if (this.socket) {
        this.socket.close();
      }
      if (this.terminal) {
        this.terminal.dispose();
      }
    }
  }
};
</script>

