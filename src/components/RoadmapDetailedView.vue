<template>
  <div class="roadmap-detailed" ref="scrollContainer" @scroll="handleScroll">
    <div class="virtual-spacer" ref="virtualSpacer"></div>
    <div class="virtual-window" ref="virtualWindow">
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
            <div class="progress-bar"><span :class="['progress-fill', progressWidthClass(milestone.progress)]"></span></div>
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
    const virtualSpacer = ref(null);
    const virtualWindow = ref(null);
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

    watch(virtualHeight, value => {
      if (virtualSpacer.value) {
        virtualSpacer.value.style.height = `${value}px`;
      }
    }, { immediate: true });

    watch(translateY, value => {
      if (virtualWindow.value) {
        virtualWindow.value.style.transform = `translateY(${value}px)`;
      }
    }, { immediate: true });

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

    const progressWidthClass = progress => {
      const numeric = Number(progress);

      if (!Number.isFinite(numeric)) {
        return 'progress-width-0';
      }

      const clamped = Math.max(0, Math.min(100, Math.round(numeric)));
      return `progress-width-${clamped}`;
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
      virtualSpacer,
      virtualWindow,
      visibleMilestones,
      virtualHeight,
      translateY,
      handleScroll,
      updateField,
      blurEditable,
      cancelEdit,
      formatStatus,
      progressWidthClass,
      isDisabled
    };
  }
};
</script>

