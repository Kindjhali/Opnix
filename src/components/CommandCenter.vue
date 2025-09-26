<template>
  <div class="container">
    <!-- Claude CLI Command Bar -->
    <div class="claude-cli-bar">
      <div class="claude-command">
        <span style="color: var(--accent-cyan);">claude$</span>
        <input
          type="text"
          v-model="app.claudeCommand"
          @keyup.enter="app.executeClaudeCommand"
          placeholder="setup audit | analyze modules | detect dependencies | fix issue #123 | generate docs (auto --ultrathink)"
        >
        <button class="btn" type="button" @click="app.executeClaudeCommand">EXECUTE</button>
      </div>
    </div>

    <!-- Agents Bar -->
    <div class="agents-bar">
      <h3 style="color: var(--text-bright); margin-bottom: 1rem;">🤖 Active Agents</h3>
      <div class="agents-grid">
        <div
          v-for="agent in app.agents"
          :key="agent.id"
          :class="['agent-card', { active: agent.status === 'active' }]"
          @click="app.activateAgent(agent)"
        >
          <div class="agent-icon">{{ agent.icon }}</div>
          <div class="agent-name">{{ agent.name }}</div>
          <div class="agent-status">{{ agent.status }}</div>
          <div style="margin-top: 0.5rem; font-size: 0.7rem;">
            Tasks: {{ agent.taskCount }}
          </div>
        </div>
      </div>

      <!-- Task Queue -->
      <div class="task-queue" v-if="app.taskQueue.length > 0">
        <h4 style="color: var(--accent-orange); margin-bottom: 0.5rem;">Task Queue</h4>
        <div v-for="task in app.taskQueue" :key="task.id" class="task-item">
          <span>{{ task.agent }} → {{ task.description }}</span>
          <span :class="['task-status', task.status]">{{ task.status }}</span>
        </div>
      </div>
    </div>

    <!-- Status Overview -->
    <div class="status-overview" v-if="app.stats">
      <div class="card status-card">
        <div class="status-header">
          <div>
            <h3 style="color: var(--accent-cyan);">Ticket Pulse</h3>
            <p style="color: var(--text-muted); font-size: 0.8rem;">Live view of open vs closed work</p>
          </div>
          <div class="status-counts">
            <div class="status-metric">
              <div class="status-value">{{ app.ticketProgress.open }}</div>
              <div class="status-label">Open</div>
            </div>
            <div class="status-metric">
              <div class="status-value">{{ app.ticketProgress.closed }}</div>
              <div class="status-label">Closed</div>
            </div>
            <div class="status-metric">
              <div class="status-value">{{ app.ticketProgress.total }}</div>
              <div class="status-label">Total</div>
            </div>
          </div>
        </div>
        <div class="status-bar" aria-label="Open vs closed work balance">
          <div class="status-bar-open" :style="{ width: app.ticketProgress.openPct + '%' }"></div>
          <div class="status-bar-closed" :style="{ width: app.ticketProgress.closedPct + '%' }"></div>
        </div>
        <div class="status-legend">
          <span class="status-chip open">Open {{ app.ticketProgress.openPct }}%</span>
          <span class="status-chip closed">Closed {{ app.ticketProgress.closedPct }}%</span>
          <span class="status-chip reported">Reported {{ app.ticketProgress.reported }}</span>
          <span class="status-chip progress">In Progress {{ app.ticketProgress.inProgress }}</span>
          <span class="status-chip finished">Finished {{ app.ticketProgress.finished }}</span>
        </div>
        <div class="status-footnote" v-if="app.latestAudit">
          {{ app.latestAudit.message }}
          <ul class="status-followups" v-if="app.latestAudit.followUps && app.latestAudit.followUps.length">
            <li v-for="(item, idx) in app.latestAudit.followUps.slice(0, 3)" :key="idx">{{ item }}</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'CommandCenter',
  props: {
    app: {
      type: Object,
      required: true
    }
  }
};
</script>
