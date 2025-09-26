#!/usr/bin/env node
/**
 * Opnix Storybook Story Generator
 * Scans runtime data sources (detector exports, interview questionnaire, archives)
 * and produces Storybook stories backed by real workspace data.
 */

const path = require('path');
const fs = require('fs').promises;

const moduleDetector = require('../services/moduleDetector');
const interviewLoader = require('../services/interviewLoader');
const server = require('../server');
const runtimeBundler = require('../services/runtimeBundler');

const ROOT_DIR = path.join(__dirname, '..');
const STORIES_ROOT = path.join(ROOT_DIR, 'src', 'stories');
const AUTO_ROOT = path.join(STORIES_ROOT, 'auto');

const SPEC_CATEGORY_LABELS = {
  blueprints: 'Blueprints',
  docs: 'Documentation',
  revision: 'Revision Drafts',
  audits: 'Audit Logs',
  canvas: 'Canvas Snapshots',
  diagrams: 'Diagrams',
  misc: 'Other'
};

function formatIsoTimestamp(value) {
  if (!value) return new Date().toISOString();
  return new Date(value).toISOString();
}

async function ensureDirectory(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

function buildComponentImportPath(subDirectories, componentSegments) {
  const storyDir = path.join(AUTO_ROOT, ...subDirectories);
  const componentPath = path.join(ROOT_DIR, 'src', 'components', ...componentSegments);
  let relative = path.relative(storyDir, componentPath);
  if (!relative.startsWith('.')) {
    relative = `./${relative}`;
  }
  return relative.split(path.sep).join('/');
}

function groupExportFiles(files) {
  const groups = new Map();
  files.forEach(file => {
    if (!file || !file.name) return;
    const key = file.category || 'misc';
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: SPEC_CATEGORY_LABELS[key] || key,
        items: []
      });
    }
    const group = groups.get(key);
    group.items.push({
      name: file.name,
      relativePath: file.relativePath || file.path,
      size: file.size || 0,
      modified: formatIsoTimestamp(file.modified)
    });
  });
  const sorted = Array.from(groups.values())
    .map(group => ({
      ...group,
      items: group.items.sort((a, b) => new Date(b.modified) - new Date(a.modified))
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return sorted;
}

// Hook: add more data loaders here to expose new args/controls in Storybook automation.
async function gatherContext() {
  await server.initDataFile();
  await server.ensureExportStructure();

  const [modulesResult, ticketData, features, questionnaire, exportFiles, setupState] = await Promise.all([
    moduleDetector.detectModules(ROOT_DIR),
    server.readData().catch(() => ({ tickets: [], nextId: 1 })),
    server.readFeaturesFile().catch(() => []),
    interviewLoader.getNewProjectQuestionnaire().catch(() => []),
    server.listExportFiles(server.EXPORTS_DIR).catch(() => []),
    server.readSetupState().catch(() => ({}))
  ]);

  const tickets = Array.isArray(ticketData?.tickets) ? ticketData.tickets : [];
  const modules = Array.isArray(modulesResult?.modules) ? modulesResult.modules : [];
  const edges = Array.isArray(modulesResult?.edges) ? modulesResult.edges : [];
  const frameworks = Array.from(new Set(modules.flatMap(module => module.frameworks || []))).sort((a, b) => a.localeCompare(b));
  const moduleSummary = modulesResult?.summary || { moduleCount: modules.length, dependencyCount: 0, externalDependencyCount: 0, totalLines: 0 };
  const archiveGroups = groupExportFiles(exportFiles || []);

  const interviewSections = Array.isArray(questionnaire)
    ? questionnaire.map(section => ({
      id: section.sectionId,
      title: section.title,
      firstQuestion: (section.questions && section.questions[0] && section.questions[0].prompt) || ''
    }))
    : [];

  const interviewHighlights = interviewSections.slice(0, 3).map(section => section.title);
  const firstPrompt = interviewSections.length > 0 ? interviewSections[0].firstQuestion : '';

  const history = Array.isArray(setupState?.history) ? setupState.history : [];

  return {
    tickets,
    modules,
    edges,
    frameworks,
    moduleSummary,
    archiveGroups,
    interviewSections,
    interviewHighlights,
    firstPrompt,
    history,
    features: Array.isArray(features) ? features : []
  };
}

function buildTicketListStory(context) {
  const ticketListImport = buildComponentImportPath([], ['TicketList.vue']);
  return {
    relativePath: 'TicketList.generated.stories.ts',
    content: `import type { Meta, StoryObj } from '@storybook/vue3';
import TicketList from '${ticketListImport}';
import ticketsSource from '../../../data/tickets.json';

const allTickets = Array.isArray((ticketsSource as any)?.tickets)
  ? (ticketsSource as any).tickets
  : Array.isArray(ticketsSource)
    ? ticketsSource as any
    : [];

const highPriorityTickets = allTickets.filter(ticket => ticket.priority === 'high');
const recentTickets = allTickets.slice().sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()).slice(0, 5);

const meta: Meta<typeof TicketList> = {
  title: 'Auto/Bugs/TicketList',
  component: TicketList,
  tags: ['autogenerated'],
  parameters: {
    docs: {
      description: {
        component: 'Tickets are sourced directly from data/tickets.json. Detector summary: ${context.moduleSummary.moduleCount} modules, ${context.moduleSummary.dependencyCount} internal dependencies, ${context.moduleSummary.externalDependencyCount} external packages.'
      }
    }
  }
};

export default meta;

type Story = StoryObj<typeof TicketList>;

export const Backlog: Story = {
  args: {
    tickets: allTickets
  }
};

export const HighPriority: Story = {
  args: {
    tickets: highPriorityTickets
  },
  parameters: {
    docs: {
      description: {
        story: 'Filters the backlog to only high priority issues detected by the audit.'
      }
    }
  }
};

export const RecentActivity: Story = {
  args: {
    tickets: recentTickets
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows the five most recently created tickets using actual timestamps.'
      }
    }
  }
};

export const EmptyState: Story = {
  args: {
    tickets: []
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates the empty backlog state with real component styling.'
      }
    }
  }
};
`
  };
}

function buildClaudeConsoleStory(context) {
  const consoleImport = buildComponentImportPath(['Console'], ['Console', 'ClaudeConsole.vue']);
  const modulesDetected = context.modules.length;
  const dependencyCount = context.moduleSummary.dependencyCount || 0;
  const frameworksList = context.frameworks.length ? context.frameworks.join(', ') : 'None detected';
  const interviewList = context.interviewHighlights.length ? context.interviewHighlights.join(' → ') : 'Interview blueprint pending';
  const historyLine = context.history.length ? `${context.history[0].mode} @ ${context.history[0].timestamp}` : 'No previous runs recorded';
  const recommendedCommand = modulesDetected > 0 ? 'audit modules --refresh --persist' : 'spec new --start interview';
  const placeholder = context.firstPrompt
    ? `${context.firstPrompt.slice(0, 80)}...`
    : 'setup audit | analyze modules | extend spec | regenerate docs';

  const lastResponse = `Detected ${modulesDetected} modules with ${dependencyCount} dependencies. Frameworks: ${frameworksList}. Next interview sections: ${interviewList}. Last run: ${historyLine}.`;

  return {
    relativePath: path.join('Console', 'ClaudeConsole.generated.stories.ts'),
    content: `import type { Meta, StoryObj } from '@storybook/vue3';
import ClaudeConsole from '${consoleImport}';

const modulesDetected = ${modulesDetected};
const dependencyCount = ${dependencyCount};
const frameworksDetected = ${JSON.stringify(context.frameworks)};
const interviewSequence = ${JSON.stringify(context.interviewHighlights)};
const lastRunHistory = ${JSON.stringify(context.history)};

const defaultLastResponse = ${JSON.stringify(lastResponse)};
const defaultPlaceholder = ${JSON.stringify(placeholder)};
const recommendedCommand = ${JSON.stringify(recommendedCommand)};

const meta: Meta<typeof ClaudeConsole> = {
  title: 'Auto/Console/ClaudeConsole',
  component: ClaudeConsole,
  tags: ['autogenerated'],
  parameters: {
    docs: {
      description: {
        component: 'Summarises the latest audit context: ' + defaultLastResponse
      }
    }
  }
};

export default meta;

type Story = StoryObj<typeof ClaudeConsole>;

export const AuditSummary: Story = {
  args: {
    modelValue: '',
    lastResponse: defaultLastResponse,
    placeholder: defaultPlaceholder,
    theme: 'mole'
  }
};

export const RecommendedCommand: Story = {
  args: {
    modelValue: recommendedCommand,
    lastResponse: defaultLastResponse,
    placeholder: defaultPlaceholder,
    theme: 'mole'
  },
  parameters: {
    docs: {
      description: {
        story: 'Prefills the console with the recommended command derived from detector results.'
      }
    }
  }
};

export const CanyonTheme: Story = {
  args: {
    modelValue: recommendedCommand,
    lastResponse: defaultLastResponse,
    placeholder: defaultPlaceholder,
    theme: 'canyon'
  }
};
`
  };
}

function buildSpecArchiveStory(context) {
  const specArchiveImport = buildComponentImportPath(['Sidebar'], ['Sidebar', 'SpecArchive.vue']);
  return {
    relativePath: path.join('Sidebar', 'SpecArchive.generated.stories.ts'),
    content: `import type { Meta, StoryObj } from '@storybook/vue3';
import SpecArchive from '${specArchiveImport}';

const archiveGroups = ${JSON.stringify(context.archiveGroups, null, 2)};

const meta: Meta<typeof SpecArchive> = {
  title: 'Auto/Sidebar/SpecArchive',
  component: SpecArchive,
  tags: ['autogenerated'],
  args: {
    archive: archiveGroups,
    loading: false,
    theme: 'mole'
  },
  parameters: {
    docs: {
      description: {
        component: archiveGroups.length
          ? 'Lists real spec artefacts discovered under the spec/ directory.'
          : 'No spec artefacts detected yet; run the auditor to populate spec/ before re-running storybook:generate.'
      }
    }
  }
};

export default meta;

type Story = StoryObj<typeof SpecArchive>;

export const Default: Story = {};

export const LoadingState: Story = {
  args: {
    loading: true
  }
};

export const CanyonTheme: Story = {
  args: {
    archive: archiveGroups,
    loading: false,
    theme: 'canyon'
  }
};
`
  };
}

async function generateStories() {
  const context = await gatherContext();

  await fs.rm(AUTO_ROOT, { recursive: true, force: true });
  await ensureDirectory(AUTO_ROOT);

  const generators = [
    buildTicketListStory,
    buildClaudeConsoleStory,
    buildSpecArchiveStory
  ];

  const outputs = [];

  for (const build of generators) {
    const { relativePath, content } = build(context);
    const outPath = path.join(AUTO_ROOT, relativePath);
    await ensureDirectory(path.dirname(outPath));
    await fs.writeFile(outPath, `${content}\n`, 'utf8');
    outputs.push(path.relative(ROOT_DIR, outPath));
  }

  console.log('✓ Generated Storybook stories:');
  outputs.forEach(file => console.log(`  - ${file}`));

  try {
    const absolutePaths = outputs.map(file => path.join(ROOT_DIR, file));
    const mirrored = await runtimeBundler.syncStoryFiles(absolutePaths);
    if (mirrored.length > 0) {
      console.log('✓ Mirrored stories into .opnix/runtime/stories');
    }
  } catch (error) {
    console.error('⚠️ Failed to mirror stories into runtime bundle:', error);
  }
}

generateStories().catch(error => {
  console.error('Story generation failed:', error);
  process.exitCode = 1;
});
