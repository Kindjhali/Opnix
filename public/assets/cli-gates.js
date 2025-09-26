const GATE_CONTAINER_ID = 'cli-gate-log-panel';
const GATE_REFRESH_INTERVAL = 60000;

const state = {
  panel: null,
  gates: [],
  error: '',
  lastFetch: 0,
};

function formatPercentage(contextUsed, contextLimit) {
  if (typeof contextUsed !== 'number' || typeof contextLimit !== 'number' || contextLimit <= 0) {
    return 'n/a';
  }
  return `${Math.round((contextUsed / contextLimit) * 100)}%`;
}

function renderGates() {
  if (!state.panel) return;
  let container = state.panel.querySelector(`#${GATE_CONTAINER_ID}`);
  if (!container) {
    container = document.createElement('div');
    container.id = GATE_CONTAINER_ID;
    container.className = 'cli-gate-log';
    state.panel.appendChild(container);
  }

  if (state.error) {
    container.innerHTML = `<div class="alert alert-error">${state.error}</div>`;
    return;
  }

  if (!state.gates.length) {
    container.innerHTML = '<div class="empty-state">No alignment gates recorded yet.</div>';
    return;
  }

  const items = state.gates
    .map((gate) => {
      const reasons = Array.isArray(gate.reasons) && gate.reasons.length
        ? gate.reasons.map((reason) => `<span>${reason}</span>`).join('')
        : '<span>No specific reasons recorded.</span>';
      const diagnostics = gate.diagnostics || {};
      const daicState = diagnostics.daicState || 'unknown';
      const ultraThinkMode = diagnostics.ultraThinkMode || 'unknown';
      const contextPct = formatPercentage(diagnostics.contextUsed, diagnostics.contextLimit);

      return `
        <li>
          <div class="gate-meta">
            <strong>${gate.timestamp || 'unknown time'}</strong> — <code>${gate.command || 'unknown command'}</code>
          </div>
          <div class="gate-reasons">${reasons}</div>
          <div class="gate-diagnostics">DAIC: ${daicState} · UltraThink: ${ultraThinkMode} · Context: ${contextPct}</div>
        </li>
      `;
    })
    .join('');

  container.innerHTML = `
    <h4>Recent Alignment Gates</h4>
    <ul class="gate-list">${items}</ul>
  `;
}

async function fetchGates() {
  if (!state.panel) return;
  try {
    state.error = '';
    const response = await fetch('/api/cli/sessions');
    if (!response.ok) {
      throw new Error('Failed to fetch CLI sessions');
    }
    const payload = await response.json();
    state.gates = Array.isArray(payload.gates) ? payload.gates.slice(-10) : [];
    state.lastFetch = Date.now();
    renderGates();
  } catch (err) {
    console.error('[Opnix] CLI gate fetch failed', err);
    state.error = err?.message || 'Unable to load alignment gate history.';
    renderGates();
  }
}

function ensurePanel() {
  const panel = document.querySelector('.cli-sessions-panel');
  if (!panel) return null;
  state.panel = panel;
  renderGates();
  fetchGates();

  const refreshButton = panel.querySelector('button.btn.secondary');
  if (refreshButton && !refreshButton.__opnixGateHook) {
    refreshButton.addEventListener('click', () => {
      fetchGates();
    });
    refreshButton.__opnixGateHook = true;
  }

  const observer = new MutationObserver(() => renderGates());
  observer.observe(panel, { childList: true, subtree: true });

  window.setInterval(() => {
    if (!state.panel) return;
    const elapsed = Date.now() - state.lastFetch;
    if (elapsed > GATE_REFRESH_INTERVAL) {
      fetchGates();
    }
  }, GATE_REFRESH_INTERVAL);

  return panel;
}

function init() {
  if (ensurePanel()) return;
  const observer = new MutationObserver(() => {
    if (ensurePanel()) {
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
