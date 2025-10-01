<template>
  <div class="status-overview" v-if="stats">
    <div class="card status-card">
      <div class="status-header">
        <div>
          <h3 class="status-header-title">Ticket Pulse</h3>
          <p class="status-header-subtitle">Live view of open vs closed work</p>
        </div>
        <div class="status-counts">
          <div class="status-metric">
            <div class="status-value">{{ ticketProgress.open }}</div>
            <div class="status-label">Open</div>
          </div>
          <div class="status-metric">
            <div class="status-value">{{ ticketProgress.closed }}</div>
            <div class="status-label">Closed</div>
          </div>
          <div class="status-metric">
            <div class="status-value">{{ ticketProgress.total }}</div>
            <div class="status-label">Total</div>
          </div>
        </div>
      </div>
      <div class="status-bar" aria-label="Open vs closed work balance">
        <div class="status-bar-open" :class="statusBarOpenClass"></div>
        <div class="status-bar-closed" :class="statusBarClosedClass"></div>
      </div>
      <div class="status-legend">
        <span class="status-chip open">Open {{ ticketProgress.openPct }}%</span>
        <span class="status-chip closed">Closed {{ ticketProgress.closedPct }}%</span>
        <span class="status-chip reported">Reported {{ ticketProgress.reported }}</span>
        <span class="status-chip progress">In Progress {{ ticketProgress.inProgress }}</span>
        <span class="status-chip finished">Finished {{ ticketProgress.finished }}</span>
      </div>
      <div class="status-footnote" v-if="latestAudit">
        {{ latestAudit.message }}
        <ul class="status-followups" v-if="latestAudit.followUps && latestAudit.followUps.length">
          <li v-for="(item, idx) in latestAudit.followUps.slice(0, 3)" :key="idx">{{ item }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'StatuslinePanel',
  props: {
    stats: {
      type: Object,
      default: null
    },
    ticketProgress: {
      type: Object,
      default: () => ({
        open: 0,
        closed: 0,
        total: 0,
        openPct: 0,
        closedPct: 0,
        reported: 0,
        inProgress: 0,
        finished: 0
      })
    },
    latestAudit: {
      type: Object,
      default: null
    }
  },
  computed: {
    statusBarOpenClass() {
      return this.buildStatusWidthClass('status-bar-open', this.ticketProgress.openPct);
    },
    statusBarClosedClass() {
      return this.buildStatusWidthClass('status-bar-closed', this.ticketProgress.closedPct);
    }
  },
  methods: {
    buildStatusWidthClass(prefix, value) {
      const numeric = Number(value);

      if (!Number.isFinite(numeric)) {
        return `${prefix}--pct-0`;
      }

      const clamped = Math.max(0, Math.min(100, Math.round(numeric)));
      return `${prefix}--pct-${clamped}`;
    }
  }
};
</script>
