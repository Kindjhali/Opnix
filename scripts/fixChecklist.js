const fs = require('fs');
const path = require('path');

// Read the current file
const filePath = path.join(__dirname, '../docs/todo/todo-complete-checklist.md');
const content = fs.readFileSync(filePath, 'utf8');

// Replace all [x] with [ ] first to reset
let fixedContent = content.replace(/- \[x\]/g, '- [ ]');

// Now only mark the NAMING & STYLE tasks as complete
// These are tasks 7, 8, 9 under MEDIUM PRIORITY - NAMING & STYLE

// Find the NAMING & STYLE section and mark those specific tasks complete
fixedContent = fixedContent.replace(
  /### 7\. Enforce camelCase across frontend\/backend code\n((?:- \[ \].*\n)*)/g,
  (match, tasks) => {
    const completedTasks = tasks.replace(/- \[ \]/g, '- [x]');
    return `### 7. Enforce camelCase across frontend/backend code ✅\n${completedTasks}`;
  }
);

fixedContent = fixedContent.replace(
  /### 8\. Update lint\/config rules to fail CI when camelCase violations detected\n((?:- \[ \].*\n)*)/g,
  (match, tasks) => {
    const completedTasks = tasks.replace(/- \[ \]/g, '- [x]');
    return `### 8. Update lint/config rules to fail CI when camelCase violations detected ✅\n${completedTasks}`;
  }
);

fixedContent = fixedContent.replace(
  /### 9\. Provide migration notes in docs for any renamed APIs\/fields\n((?:- \[ \].*\n)*)/g,
  (match, tasks) => {
    const completedTasks = tasks.replace(/- \[ \]/g, '- [x]');
    return `### 9. Provide migration notes in docs for any renamed APIs/fields ✅\n${completedTasks}`;
  }
);

// Also mark the RUNBOOK GENERATOR task as complete
fixedContent = fixedContent.replace(
  /### 24\. RUNBOOK GENERATOR: Add automated tests for runbook generation\n((?:- \[ \].*\n)*)/g,
  (match, tasks) => {
    const completedTasks = tasks.replace(/- \[ \]/g, '- [x]');
    return `### 24. RUNBOOK GENERATOR: Add automated tests for runbook generation ✅\n${completedTasks}`;
  }
);

// Mark HOT-RELOAD QUESTIONS as complete (tasks 10-14)
const hotReloadSections = [
  '### 10. Add file watcher for interview-sections.json changes',
  '### 11. Implement cache invalidation in interviewLoader.js', 
  '### 12. Add /api/interviews/reload endpoint',
  '### 13. Update Questions tab UI with Reload Questions button',
  '### 14. Ensure active sessions handle question updates gracefully'
];

hotReloadSections.forEach(section => {
  const sectionTitle = section.replace('### ', '### ').trim();
  const regex = new RegExp(`${sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n((?:- \\[ \\].*\\n)*)`, 'g');
  fixedContent = fixedContent.replace(regex, (match, tasks) => {
    const completedTasks = tasks.replace(/- \[ \]/g, '- [x]');
    return `${sectionTitle} ✅\n${completedTasks}`;
  });
});

// Also need to restore the items that were already marked complete before
// Based on the TODO.md and git changes, these sections had some items already marked:
const alreadyCompleteItems = [
  // From roadmap section 1
  { section: 'Backend state management', items: [
    'Create `services/roadmapState.js` file',
    'Define state schema with version, milestones, history, lastUpdated fields',
    'Implement file read/write with atomic operations',
    'Add file locking mechanism using',
    'Create backup rotation system',
    'Implement gzip compression for backups',
    'Add state validation method',
    'Create default state initializer',
    'Add debounced save mechanism',
    'Add rollback functionality'
  ]},
  // From roadmap section 3  
  { section: 'Connect roadmap to', items: [
    'Create `services/roadmapEventAggregator.js`',
    'Add event queue for batching',
    'Create event deduplication logic',
    'Implement consolidated update emission'
  ]},
  // From section 5
  { section: 'Enhanced status management', items: [
    'Define status color palette',
    'Add status colors to MOLE theme',
    'Add status colors to CANYON theme',
    'Implement status color gradients'
  ]}
];

// Restore already completed items
alreadyCompleteItems.forEach(({ items }) => {
  items.forEach(item => {
    // Find and mark specific items as complete
    const itemRegex = new RegExp(`- \\[ \\] ${item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
    fixedContent = fixedContent.replace(itemRegex, `- [x] ${item}`);
  });
});

// Write the fixed content
fs.writeFileSync(filePath, fixedContent);

console.log('Checklist restored with only actually completed tasks marked');