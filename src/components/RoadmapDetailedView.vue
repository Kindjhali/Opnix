<template>
  <div class="roadmap-detailed" ref="scrollContainer" @scroll="handleScroll">
    <div class="virtual-spacer" :style="{ height: virtualHeight + 'px' }"></div>
    <div class="virtual-window" :style="{ transform: `translateY(${translateY}px)` }">
      <article
        v-for="milestone in visibleMilestones"
        :key="milestone.id"
        :class="['detailed-card', `is-${(milestone.status || '').toLowerCase()}` , { disabled: isDisabled }]"
      >
        <header class="detailed-header">
          <div class="detailed-titles">
            <h4
              class="detailed-title"
              :contenteditable="!isDisabled"
              spellcheck="false"
              @blur="updateField(milestone, 'name', $event.target.innerText.trim())"
              @keydown.enter.prevent="blurEditable($event.target)"
              @keydown.esc.prevent="cancelEdit($event.target, milestone.name)"
            >{{ milestone.name }}</h4>
            <p
              v-if="milestone.notes"
              class="detailed-notes"
              :contenteditable="!isDisabled"
              spellcheck="false"
              @blur="updateField(milestone, 'notes', $event.target.innerText.trim())"
              @keydown.enter.prevent="blurEditable($event.target)"
              @keydown.esc.prevent="cancelEdit($event.target, milestone.notes)"
            >{{ milestone.notes }}</p>
          </div>
          <div class="detailed-progress">
            <span class="progress-value">{{ milestone.progress }}%</span>
            <div class="progress-bar"><span :style="{ width: milestone.progress + '%' }"></span></div>
          </div>
        </header>

        <section class="detailed-meta">
          <div class="meta-item" v-if="milestone.start || milestone.startDate">
            <dt>Start</dt>
            <dd>{{ milestone.start || milestone.startDate }}</dd>
          </div>
          <div class="meta-item" v-if="milestone.end || milestone.targetDate">
            <dt>Target</dt>
            <dd>{{ milestone.end || milestone.targetDate }}</dd>
          </div>
          <div class="meta-item" v-if="milestone.status">
            <dt>Status</dt>
            <dd>{{ formatStatus(milestone.status) }}</dd>
          </div>
          <div class="meta-item" v-if="milestone.dependencies && milestone.dependencies.length">
            <dt>Dependencies</dt>
            <dd>
              <span v-for="dep in milestone.dependencies" :key="dep" class="dependency-pill">{{ dep }}</span>
            </dd>
          </div>
        </section>

        <section class="detailed-links">
          <details v-if="milestone.linkedTickets && milestone.linkedTickets.length" open>
            <summary>Tickets ({{ milestone.linkedTickets.length }})</summary>
            <ul>
              <li v-for="ticket in milestone.linkedTickets" :key="ticket">Ticket #{{ ticket }}</li>
            </ul>
          </details>
          <details v-if="milestone.linkedFeatures && milestone.linkedFeatures.length">
            <summary>Features ({{ milestone.linkedFeatures.length }})</summary>
            <ul>
              <li v-for="feature in milestone.linkedFeatures" :key="feature">Feature #{{ feature }}</li>
            </ul>
          </details>
          <details v-if="milestone.linkedModules && milestone.linkedModules.length">
            <summary>Modules ({{ milestone.linkedModules.length }})</summary>
            <ul>
              <li v-for="module in milestone.linkedModules" :key="module">Module {{ module }}</li>
            </ul>
          </details>
        </section>
      </article>
    </div>
  </div>
</template>

<script>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

const ROW_HEIGHT = 260;
const OVERSCAN = 4;

export default {
  name: 'RoadmapDetailedView',
  props: {
    milestones: {
      type: Array,
      default: () => []
    },
    disabled: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update-milestone'],
  setup(props, { emit }) {
    const scrollContainer = ref(null);
    const virtualRange = ref({ start: 0, end: 0 });
    const isDisabled = computed(() => props.disabled);

    const totalRows = computed(() => props.milestones.length);

    const virtualHeight = computed(() => totalRows.value * ROW_HEIGHT);

    const visibleMilestones = computed(() => {
      const items = props.milestones.slice(virtualRange.value.start, virtualRange.value.end);
      return items.map((milestone, index) => ({
        ...milestone,
        _virtualIndex: virtualRange.value.start + index
      }));
    });

    const translateY = computed(() => virtualRange.value.start * ROW_HEIGHT);

    const recalcRange = () => {
      const container = scrollContainer.value;
      if (!container) return;

      const scrollTop = container.scrollTop;
      const viewportHeight = container.clientHeight;

      const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
      const endIndex = Math.min(props.milestones.length, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN);

      virtualRange.value = { start: startIndex, end: endIndex };
    };

    const handleScroll = () => {
      recalcRange();
    };

    const updateField = (milestone, field, value) => {
      if (isDisabled.value) return;
      if (value === undefined || value === null) return;
      if (milestone[field] === value) return;
      emit('update-milestone', { id: milestone.id, field, value });
    };

    const blurEditable = element => {
      element.blur();
    };

    const cancelEdit = (element, original) => {
      element.innerText = original || '';
      element.blur();
    };

    const formatStatus = status => {
      if (!status) return '';
      return status
        .split(/[\s_-]+/)
        .filter(Boolean)
        .map(chunk => chunk.charAt(0).toUpperCase() + chunk.slice(1))
        .join(' ');
    };

    onMounted(() => {
      recalcRange();
    });

    onUnmounted(() => {
      // nothing to clean up yet
    });

    watch(() => props.milestones, () => {
      recalcRange();
    });

    return {
      scrollContainer,
      visibleMilestones,
      virtualHeight,
      translateY,
      handleScroll,
      updateField,
      blurEditable,
      cancelEdit,
      formatStatus,
      isDisabled
    };
  }
};
</script>

<style scoped>
.roadmap-detailed {
  position: relative;
  height: 100%;
  overflow-y: auto;
  padding: 1.25rem 1.5rem;
  background: var(--surface-primary);
}

.virtual-spacer {
  width: 100%;
}

.virtual-window {
  position: absolute;
  left: 0;
  right: 0;
  will-change: transform;
}

.detailed-card {
  position: relative;
  margin-bottom: 1rem;
  padding: 1.2rem 1.4rem;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--surface-elevated);
  box-shadow: var(--shadow-elevated);
  display: grid;
  gap: 1rem;
  transition: background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
}

.detailed-card.disabled {
  opacity: 0.6;
  pointer-events: none;
}

.detailed-card.is-completed {
  border-color: var(--status-completed, var(--success));
}

.detailed-card.is-blocked {
  border-color: var(--status-blocked, var(--danger));
}

.detailed-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.detailed-title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--text-bright);
  outline: none;
}

.detailed-title[contenteditable]:focus,
.detailed-notes[contenteditable]:focus {
  border-bottom: 1px dashed var(--accent-1);
}

.detailed-notes {
  margin: 0.35rem 0 0 0;
  font-size: 0.9rem;
  color: var(--text-muted);
  min-height: 1rem;
  outline: none;
}

.detailed-progress {
  min-width: 160px;
  display: grid;
  gap: 0.35rem;
  justify-items: flex-end;
  transition: color 0.3s ease;
}

.progress-value {
  font-size: 1.45rem;
  font-weight: 700;
  color: var(--accent-1);
  transition: color 0.3s ease;
  transition: color 0.3s ease;
}

.progress-bar {
  width: 100%;
  height: 0.5rem;
  border-radius: 999px;
  background: var(--glass-overlay-soft);
  overflow: hidden;
  transition: background-color 0.3s ease;
}

.progress-bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--accent-1), var(--accent-2));
  transition: background 0.3s ease;
}

.detailed-meta {
  display: grid;
  gap: 0.45rem;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
}

.meta-item dt {
  margin: 0;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.meta-item dd {
  margin: 0.15rem 0 0 0;
  font-size: 0.92rem;
  color: var(--text-primary);
}

.dependency-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: var(--glass-overlay-strong);
  font-size: 0.75rem;
  transition: background-color 0.3s ease, color 0.3s ease;
  margin-right: 0.35rem;
}

.detailed-links details {
  margin-top: 0.4rem;
  background: var(--glass-overlay-soft);
  padding: 0.45rem 0.65rem;
  border-radius: 8px;
  border: 1px solid var(--glass-overlay-strong);
  transition: background-color 0.3s ease, border-color 0.3s ease;
}

.detailed-links summary {
  cursor: pointer;
  color: var(--accent-1);
  transition: color 0.3s ease;
  transition: color 0.3s ease;
  font-weight: 600;
  font-size: 0.9rem;
}

.detailed-links ul {
  list-style: none;
  margin: 0.35rem 0 0 0;
  padding-left: 0.75rem;
  font-size: 0.85rem;
}
</style>
