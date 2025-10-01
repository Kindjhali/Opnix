<template>
  <section v-if="active" class="tech-stack-tab">
    <header class="tech-stack-header">
      <div class="tech-stack-header__info">
        <h2>Tech Stack Snapshot</h2>
        <p v-if="summary" class="tech-stack-header__meta">
          Generated <span>{{ formatTimestamp(summary.generatedAt) }}</span>
          <template v-if="summaryAgeLabel">· Age: <span>{{ summaryAgeLabel }}</span></template>
          · CLI sessions analysed: <span>{{ summary.cliInsights.sessionsAnalyzed }}</span>
        </p>
        <p v-else class="tech-stack-header__meta">Gathering project insights…</p>
      </div>
      <div class="tech-stack-actions">
        <button
          type="button"
          class="tech-stack-button"
          :disabled="loading || exporting"
          @click="$emit('refresh')"
        >
          <span aria-hidden="true">🔄</span>
          Refresh
        </button>
        <button
          type="button"
          class="tech-stack-button tech-stack-button--accent"
          :disabled="exporting || loading"
          @click="$emit('export')"
        >
          <span v-if="!exporting" aria-hidden="true">⬇️</span>
          <span v-else class="tech-stack-spinner" aria-hidden="true"></span>
          Export Markdown
        </button>
      </div>
    </header>

    <div v-if="error" class="tech-stack-banner tech-stack-banner--error" role="alert">
      {{ error }}
    </div>

    <div
      v-if="exportError"
      class="tech-stack-banner tech-stack-banner--warning"
      role="alert"
    >
      {{ exportError }}
    </div>

    <div
      v-if="exportResult"
      class="tech-stack-banner tech-stack-banner--success"
      role="status"
    >
      Tech stack export saved as <code>{{ exportResult.relativePath || exportResult.path }}</code>
    </div>

    <div
      v-if="summaryIsStale"
      class="tech-stack-banner tech-stack-banner--warning"
      role="status"
    >
      Tech stack snapshot is older than the recommended window. Consider refreshing to capture recent changes.
    </div>

    <div v-if="loading" class="tech-stack-loading" role="status" aria-live="polite">
      <span class="tech-stack-spinner" aria-hidden="true"></span>
      <p>Refreshing tech stack summary…</p>
    </div>

    <template v-else>
      <div v-if="summary" class="tech-stack-cards">
        <article class="tech-stack-card">
          <h3>Package</h3>
          <ul>
            <li><strong>Name:</strong> {{ summary.package.name }}</li>
            <li><strong>Version:</strong> {{ summary.package.version }}</li>
            <li><strong>Manager:</strong> {{ summary.package.packageManager }}</li>
          </ul>
        </article>

        <article class="tech-stack-card">
          <h3>Dependencies</h3>
          <p>Total runtime packages: <strong>{{ summary.dependencies.total }}</strong></p>
          <ul class="tech-stack-list">
            <li v-for="dep in runtimePreview" :key="dep.name">
              <code>{{ dep.name }}</code>
              <span class="tech-stack-version">{{ dep.version }}</span>
            </li>
          </ul>
          <p v-if="runtimeRemainder" class="tech-stack-remainder">+ {{ runtimeRemainder }} more</p>
        </article>

        <article class="tech-stack-card">
          <h3>Dev Dependencies</h3>
          <p>Total tooling packages: <strong>{{ summary.devDependencies.total }}</strong></p>
          <ul class="tech-stack-list">
            <li v-for="dep in devPreview" :key="`dev-${dep.name}`">
              <code>{{ dep.name }}</code>
              <span class="tech-stack-version">{{ dep.version }}</span>
            </li>
          </ul>
          <p v-if="devRemainder" class="tech-stack-remainder">+ {{ devRemainder }} more</p>
        </article>

        <article class="tech-stack-card">
          <h3>Frameworks</h3>
          <p v-if="!frameworks.length">No frameworks detected yet.</p>
          <ul v-else class="tech-stack-chips">
            <li v-for="item in frameworks" :key="item">{{ item }}</li>
          </ul>
        </article>

        <article v-if="categoryBuckets.length" class="tech-stack-card tech-stack-card--categories">
          <h3>Dependency Categories</h3>
          <div class="tech-stack-category-grid">
            <article
              v-for="bucket in categoryBuckets"
              :key="bucket.key"
              class="tech-stack-category"
            >
              <header class="tech-stack-category__header">
                <span class="tech-stack-category__label">{{ bucket.label }}</span>
                <span class="tech-stack-category__count">{{ bucket.count }}</span>
              </header>
              <ul class="tech-stack-category__list">
                <li v-for="item in bucket.preview" :key="bucket.key + '-' + item.name + (item.source || '')">
                  {{ formatCategoryItem(item) }}
                </li>
              </ul>
              <p v-if="bucket.remaining" class="tech-stack-remainder">+ {{ bucket.remaining }} more</p>
            </article>
          </div>
        </article>

        <article class="tech-stack-card">
          <h3>Modules</h3>
          <ul>
            <li><strong>Total:</strong> {{ summary.moduleSummary.total }}</li>
            <li><strong>Detected:</strong> {{ summary.moduleSummary.detectedCount }}</li>
            <li><strong>Manual:</strong> {{ summary.moduleSummary.manualCount }}</li>
            <li><strong>External deps:</strong> {{ summary.moduleSummary.externalDependencyCount }}</li>
          </ul>
          <dl class="tech-stack-breakdown">
            <template v-for="item in moduleTypeBreakdown" :key="item.type">
              <dt>{{ item.type }}</dt>
              <dd>{{ item.count }}</dd>
            </template>
          </dl>
        </article>
      </div>

      <section v-if="summary && summary.moduleSummary.details.length" class="tech-stack-table-section">
        <header>
          <h3>Module Catalogue</h3>
          <p>Source, dependencies, and frameworks for every module.</p>
        </header>
        <div class="tech-stack-table-wrapper">
          <table class="tech-stack-table">
            <thead>
              <tr>
                <th scope="col">Module</th>
                <th scope="col">Type</th>
                <th scope="col">Source</th>
                <th scope="col">Health</th>
                <th scope="col">Coverage</th>
                <th scope="col">Frameworks</th>
                <th scope="col">Dependencies</th>
                <th scope="col">External</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="module in summary.moduleSummary.details" :key="module.id">
                <th scope="row">{{ module.name || module.id }}</th>
                <td>{{ module.type }}</td>
                <td>{{ module.manual ? 'manual' : module.source }}</td>
                <td>{{ formatPercent(module.health) }}</td>
                <td>{{ formatPercent(module.coverage) }}</td>
                <td>{{ formatList(module.frameworks) }}</td>
                <td>{{ formatList(module.dependencies) }}</td>
                <td>{{ formatList(module.externalDependencies) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="summary" class="tech-stack-cli-section">
        <header>
          <h3>CLI Insights</h3>
          <p>Latest answers collected from interactive interviews.</p>
        </header>
        <div class="tech-stack-cli-grid">
          <article class="tech-stack-cli-card">
            <h4>Project Context</h4>
            <p v-if="!summary.cliInsights.project.length" class="tech-stack-empty">No project-level responses yet.</p>
            <ul v-else>
              <li v-for="entry in summary.cliInsights.project" :key="`project-${entry.questionId}`">
                <p class="tech-stack-cli-question">{{ entry.prompt }}</p>
                <p class="tech-stack-cli-answer">{{ entry.answer }}</p>
                <p class="tech-stack-cli-meta">{{ formatTimestamp(entry.recordedAt) }}</p>
              </li>
            </ul>
          </article>
          <article class="tech-stack-cli-card">
            <h4>Module Context</h4>
            <p v-if="!summary.cliInsights.module.length" class="tech-stack-empty">No module-level responses yet.</p>
            <ul v-else>
              <li v-for="entry in summary.cliInsights.module" :key="`module-${entry.questionId}`">
                <p class="tech-stack-cli-question">{{ entry.prompt }}</p>
                <p class="tech-stack-cli-answer">{{ entry.answer }}</p>
                <p class="tech-stack-cli-meta">{{ formatTimestamp(entry.recordedAt) }}</p>
              </li>
            </ul>
          </article>
        </div>
      </section>

      <p v-if="!summary" class="tech-stack-empty">No tech stack data available yet. Run module detection or CLI interviews to populate insights.</p>
    </template>
  </section>
</template>

<script>
export default {
  name: 'TechStackTab',
  props: {
    active: {
      type: Boolean,
      default: false
    },
    summary: {
      type: Object,
      default: null
    },
    loading: {
      type: Boolean,
      default: false
    },
    error: {
      type: String,
      default: ''
    },
    exporting: {
      type: Boolean,
      default: false
    },
    exportError: {
      type: String,
      default: ''
    },
    exportResult: {
      type: Object,
      default: null
    }
  },
  emits: ['refresh', 'export'],
  computed: {
    runtimePreview() {
      const list = this.summary?.dependencies?.items || [];
      return list.slice(0, 8);
    },
    runtimeRemainder() {
      const total = this.summary?.dependencies?.total || 0;
      const shown = this.runtimePreview.length;
      return total > shown ? total - shown : 0;
    },
    devPreview() {
      const list = this.summary?.devDependencies?.items || [];
      return list.slice(0, 8);
    },
    devRemainder() {
      const total = this.summary?.devDependencies?.total || 0;
      const shown = this.devPreview.length;
      return total > shown ? total - shown : 0;
    },
    frameworks() {
      return this.summary?.frameworks || [];
    },
    moduleTypeBreakdown() {
      const breakdown = this.summary?.moduleSummary?.byType || {};
      return Object.keys(breakdown)
        .sort()
        .map(type => ({ type, count: breakdown[type] }));
    },
    summaryAgeSeconds() {
      return this.summary?.cacheInfo?.ageSeconds ?? null;
    },
    summaryAgeLabel() {
      if (this.summaryAgeSeconds === null || this.summaryAgeSeconds === undefined) {
        return null;
      }
      return this.formatRelativeAge(this.summaryAgeSeconds);
    },
    summaryIsStale() {
      return Boolean(this.summary?.cacheInfo?.isStale);
    },
    categoryBuckets() {
      if (!this.summary || !this.summary.dependencyCategories) {
        return [];
      }
      const entries = Object.entries(this.summary.dependencyCategories)
        .map(([key, bucket]) => {
          const items = Array.isArray(bucket?.items) ? bucket.items : [];
          return {
            key,
            label: bucket?.label || key,
            count: items.length,
            preview: items.slice(0, 5),
            remaining: items.length > 5 ? items.length - 5 : 0
          };
        })
        .filter(bucket => bucket.count > 0);
      return entries.sort((a, b) => a.label.localeCompare(b.label));
    }
  },
  methods: {
    formatPercent(value) {
      if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return '—';
      }
      const numeric = Math.max(0, Math.min(100, Number(value)));
      return `${numeric}%`;
    },
    formatList(list) {
      if (!Array.isArray(list) || list.length === 0) {
        return '—';
      }
      return list.join(', ');
    },
    formatCategoryItem(item) {
      if (!item) {
        return '';
      }
      const version = item.version ? `@ ${item.version}` : '';
      const source = item.source && !item.source.startsWith('module:')
        ? ` (${item.source})`
        : item.source && item.source.startsWith('module:')
          ? ` (${item.source.replace('module:', 'module ')})`
          : '' ;
      return `${item.name}${version}${source}`.trim();
    },
    formatTimestamp(value) {
      if (!value) {
        return 'unknown';
      }
      try {
        return new Intl.DateTimeFormat(undefined, {
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }).format(new Date(value));
      } catch (error) {
        if (error) {
          // no-op: retain fallback formatting without logging
        }
        return value;
      }
    }
  }
};
</script>
