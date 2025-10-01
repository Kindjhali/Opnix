import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Import the module we're testing
import { generateRunbook } from '../services/runbookGenerator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testExportsDir = path.join(__dirname, 'test-exports-runbook');

// Clean up test directory before and after tests
async function cleanup() {
  try {
    await rm(testExportsDir, { recursive: true, force: true });
  } catch {
    // Directory doesn't exist, that's fine
  }
}

// Test helper to create mock data
function createMockSession() {
  return {
    sessionId: 'test-session-123',
    command: 'test runbook generation',
    category: 'runbook',
    responses: [
      { questionId: 'primary-language', answer: 'JavaScript' },
      { questionId: 'preferred-framework', answer: 'Express' },
      { questionId: 'authentication-model', answer: 'JWT' },
      { questionId: 'scaling-strategy', answer: 'Horizontal scaling' },
      { questionId: 'monitoring-procedures', answer: 'Prometheus + Grafana' }
    ]
  };
}

function createMockModulesResult() {
  return {
    modules: [
      {
        name: 'auth-module',
        type: 'api',
        health: 85,
        coverage: 72,
        dependencies: ['database-module'],
        externalDependencies: ['jsonwebtoken', 'bcrypt'],
        pathHints: ['src/auth']
      },
      {
        name: 'database-module',
        type: 'backend',
        health: 90,
        coverage: 80,
        dependencies: [],
        externalDependencies: ['mongoose'],
        pathHints: ['src/db']
      }
    ],
    edges: [
      { source: 'auth-module', target: 'database-module' }
    ],
    summary: {
      totalModules: 2,
      healthAverage: 87.5
    }
  };
}

function createMockTechStack() {
  return {
    dependencies: ['express', 'mongoose', 'jsonwebtoken', 'bcrypt', 'cors'],
    devDependencies: ['jest', 'eslint', 'prettier', 'nodemon'],
    frameworks: ['Express', 'Node.js']
  };
}

function createMockTickets() {
  return [
    { id: 1, title: 'Fix authentication bug', status: 'inProgress', priority: 'high' },
    { id: 2, title: 'Add rate limiting', status: 'reported', priority: 'high' },
    { id: 3, title: 'Update documentation', status: 'reported', priority: 'low' }
  ];
}

// Test 1: Basic runbook generation
async function testBasicRunbookGeneration() {
  console.log('TEST: Basic runbook generation');
  
  await cleanup();
  
  const result = await generateRunbook({
    projectName: 'Test Project',
    session: createMockSession(),
    responses: {},
    modulesResult: createMockModulesResult(),
    tickets: createMockTickets(),
    techStack: createMockTechStack(),
    exportsDir: testExportsDir
  });

  // Verify result structure
  assert.equal(result.type, 'runbook');
  assert(result.filename.startsWith('runbook-'));
  assert(result.filename.endsWith('.md'));
  assert.equal(result.format, 'markdown');
  assert(result.path.includes(testExportsDir));

  // Verify file was created
  const content = await readFile(result.path, 'utf8');
  assert(content.includes('# Test Project Operational Runbook'));
  assert(content.includes('## Runtime Decisions'));
  assert(content.includes('Primary Language:** JavaScript'));
  assert(content.includes('Preferred Framework:** Express'));
  assert(content.includes('Operational Readiness Checklist'));
  assert(content.includes('## Session Context History'));
  assert(content.includes('No context snapshots recorded'));
  
  console.log('✓ Basic runbook generation passed');
}

// Test 2: Incident response sections
async function testIncidentResponseGeneration() {
  console.log('TEST: Incident response generation');
  
  const session = createMockSession();
  session.responses.push(
    { questionId: 'incident-response', answer: '24/7 on-call rotation' },
    { questionId: 'troubleshooting-playbook', answer: 'Step-by-step debug guide' }
  );

  const result = await generateRunbook({
    projectName: 'Incident Test',
    session,
    responses: {},
    modulesResult: createMockModulesResult(),
    tickets: [],
    techStack: createMockTechStack(),
    exportsDir: testExportsDir
  });

  const content = await readFile(result.path, 'utf8');
  assert(content.includes('Incident Response:** 24/7 on-call rotation'));
  assert(content.includes('Troubleshooting Playbook:** Step-by-step debug guide'));
  
  console.log('✓ Incident response sections passed');
}

// Test 3: Deployment runbook sections
async function testDeploymentRunbookGeneration() {
  console.log('TEST: Deployment runbook generation');
  
  const session = createMockSession();
  session.responses.push(
    { questionId: 'environment-promotion', answer: 'Dev → Stage → Prod' },
    { questionId: 'release-cadence', answer: 'Weekly releases' },
    { questionId: 'rollback-plan', answer: 'Blue-green deployment with instant rollback' }
  );

  const result = await generateRunbook({
    projectName: 'Deployment Test',
    session,
    responses: {},
    modulesResult: createMockModulesResult(),
    tickets: [],
    techStack: createMockTechStack(),
    exportsDir: testExportsDir
  });

  const content = await readFile(result.path, 'utf8');
  assert(content.includes('## Deployment & Release'));
  assert(content.includes('Environment Promotion:** Dev → Stage → Prod'));
  assert(content.includes('Release Cadence:** Weekly releases'));
  assert(content.includes('Rollback Plan:** Blue-green deployment'));
  
  console.log('✓ Deployment sections passed');
}

// Test 4: Security & monitoring runbooks
async function testSecurityMonitoringRunbooks() {
  console.log('TEST: Security and monitoring runbooks');
  
  const session = createMockSession();
  session.responses.push(
    { questionId: 'security-monitoring', answer: 'SIEM integration with alerts' },
    { questionId: 'compliance-standards', answer: 'SOC2, GDPR' },
    { questionId: 'observability-tooling', answer: 'ELK stack' }
  );

  const result = await generateRunbook({
    projectName: 'Security Test',
    session,
    responses: {},
    modulesResult: createMockModulesResult(),
    tickets: [],
    techStack: createMockTechStack(),
    exportsDir: testExportsDir
  });

  const content = await readFile(result.path, 'utf8');
  assert(content.includes('Security Monitoring:** SIEM integration'));
  assert(content.includes('Compliance Standards:** SOC2, GDPR'));
  assert(content.includes('Observability Tooling:** ELK stack'));
  
  console.log('✓ Security and monitoring sections passed');
}

// Test 5: AI safeguards and rollback runbooks
async function testAISafeguardsRunbooks() {
  console.log('TEST: AI safeguards runbooks');
  
  const session = createMockSession();
  session.responses.push(
    { questionId: 'ai-regression-history', answer: 'Quarterly model validation' },
    { questionId: 'ai-guardrails', answer: 'Output validation, confidence thresholds' },
    { questionId: 'manual-validation-points', answer: 'Human review for critical decisions' }
  );

  const result = await generateRunbook({
    projectName: 'AI Safety Test',
    session,
    responses: {},
    modulesResult: createMockModulesResult(),
    tickets: [],
    techStack: createMockTechStack(),
    exportsDir: testExportsDir
  });

  const content = await readFile(result.path, 'utf8');
  assert(content.includes('## AI Safeguards'));
  assert(content.includes('Regression History:** Quarterly model validation'));
  assert(content.includes('Guardrails:** Output validation'));
  assert(content.includes('Manual Validation Points:** Human review'));
  
  console.log('✓ AI safeguards sections passed');
}

// Test 6: Template substitution
async function testTemplateSubstitution() {
  console.log('TEST: Template substitution');
  
  const contextHistory = [{
    sessionId: 'test-session-123',
    sessionType: 'runbook',
    timestamp: '2025-01-01T00:00:00Z',
    forms: ['spec-form'],
    selectedItems: ['module-a'],
    filters: { status: 'draft' }
  }];

  const result = await generateRunbook({
    projectName: 'Template {{Test}} Project',
    session: createMockSession(),
    responses: {
      'project-purpose': 'Testing template {{substitution}}'
    },
    modulesResult: createMockModulesResult(),
    tickets: [],
    techStack: createMockTechStack(),
    exportsDir: testExportsDir,
    templates: ['incident-response'],
    contextHistory
  });

  const content = await readFile(result.path, 'utf8');
  // Should handle special characters in project name
  assert(content.includes('Template {{Test}} Project'));
  assert(content.includes('Incident Response Playbook'));
  assert(content.includes('Detection'));
  assert(!content.includes('Operational Readiness Checklist')); // default template overridden
  assert(content.includes('forms → spec-form'));
  assert(content.includes('selected → module-a'));
  
  console.log('✓ Template substitution passed');
}

// Test 7: Module summary formatting
async function testModuleSummaryFormatting() {
  console.log('TEST: Module summary formatting');
  
  const modulesResult = createMockModulesResult();
  modulesResult.modules.push({
    name: 'payment-module',
    health: null, // Test null handling
    coverage: undefined, // Test undefined handling
    dependencies: [], // Empty array
    externalDependencies: null, // Null externals
    pathHints: [] // Empty paths
  });

  const result = await generateRunbook({
    projectName: 'Module Test',
    session: createMockSession(),
    responses: {},
    modulesResult,
    tickets: [],
    techStack: createMockTechStack(),
    exportsDir: testExportsDir
  });

  const content = await readFile(result.path, 'utf8');
  assert(content.includes('## Module Summary'));
  assert(content.includes('auth-module'));
  assert(content.includes('Health 85%'));
  assert(content.includes('payment-module'));
  assert(content.includes('Health n/a%')); // null becomes n/a
  assert(content.includes('Coverage 0%')); // undefined becomes 0
  assert(content.includes('External: None')); // null becomes None
  
  console.log('✓ Module summary formatting passed');
}

// Test 8: High priority tickets formatting
async function testTicketSummaryFormatting() {
  console.log('TEST: Ticket summary formatting');
  
  const tickets = [
    ...createMockTickets(),
    { id: 4, title: 'Critical security patch', status: 'reported', priority: 'high' },
    { id: 5, title: 'Performance optimization', status: 'reported', priority: 'medium' }
  ];

  const result = await generateRunbook({
    projectName: 'Ticket Test',
    session: createMockSession(),
    responses: {},
    modulesResult: createMockModulesResult(),
    tickets,
    techStack: createMockTechStack(),
    exportsDir: testExportsDir
  });

  const content = await readFile(result.path, 'utf8');
  assert(content.includes('## High Priority Tickets'));
  assert(content.includes('[HIGH] #2 — Add rate limiting'));
  assert(content.includes('[HIGH] #4 — Critical security patch'));
  // Should not include medium or low priority in the High Priority Tickets section
  const ticketSection = content.split('## Tech Stack Snapshot')[0].split('## High Priority Tickets')[1];
  assert(!ticketSection.includes('Performance optimization'));
  assert(!ticketSection.includes('Update documentation'));
  
  console.log('✓ Ticket summary formatting passed');
}

// Test 9: Empty/missing data handling
async function testEmptyDataHandling() {
  console.log('TEST: Empty data handling');
  
  const result = await generateRunbook({
    projectName: '',
    session: null,
    responses: {},
    modulesResult: null,
    tickets: null,
    techStack: null,
    exportsDir: testExportsDir
  });

  const content = await readFile(result.path, 'utf8');
  assert(content.includes('# Operational Runbook')); // Default title
  assert(content.includes('Session: manual-runbook')); // Default session
  assert(content.includes('No modules detected'));
  assert(content.includes('No open tickets'));
  assert(content.includes('No dependency data available'));
  assert(content.includes('[Pending input]')); // For sections with no data
  
  console.log('✓ Empty data handling passed');
}

// Test 10: Markdown formatting validation
async function testMarkdownFormatting() {
  console.log('TEST: Markdown formatting');
  
  const session = createMockSession();
  session.responses.push(
    { questionId: 'supporting-libraries', answer: 'Library with **bold** and _italic_' }
  );

  const result = await generateRunbook({
    projectName: 'Markdown Test',
    session,
    responses: {},
    modulesResult: createMockModulesResult(),
    tickets: createMockTickets(),
    techStack: createMockTechStack(),
    exportsDir: testExportsDir
  });

  const content = await readFile(result.path, 'utf8');
  
  // Check basic markdown structure
  assert(content.match(/^# /m)); // H1 header
  assert(content.match(/^## /gm).length > 5); // Multiple H2 headers
  assert(content.match(/^- /gm).length > 10); // List items
  assert(content.includes('**')); // Bold markers preserved
  assert(content.includes('_')); // Italic markers preserved
  
  // Check proper line spacing - headers should generally have blank lines before them
  const lines = content.split('\n');
  let headerCount = 0;
  let headersWithoutBlankLineBefore = 0;
  
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].startsWith('##')) {
      headerCount++;
      if (i > 0 && lines[i-1] !== '' && !lines[i-1].startsWith('#')) {
        headersWithoutBlankLineBefore++;
      }
    }
  }
  
  // Allow some headers without blank lines (like the first one after metadata)
  assert(headersWithoutBlankLineBefore < headerCount / 3, 
    `Too many headers without blank lines: ${headersWithoutBlankLineBefore} of ${headerCount}`);
  
  console.log('✓ Markdown formatting passed');
}

// Test 11: Project type detection
async function testProjectTypeDetection() {
  console.log('TEST: Project type detection');
  
  // Test different project types
  const testCases = [
    {
      modules: [{ type: 'mobile' }],
      techStack: { frameworks: [] },
      expected: 'Mobile App'
    },
    {
      modules: [{ type: 'desktop' }],
      techStack: { frameworks: [] },
      expected: 'Desktop Software'
    },
    {
      modules: [{ type: 'frontend' }],
      techStack: { frameworks: ['React'] },
      expected: 'Web Application'
    },
    {
      modules: [{ type: 'api' }],
      techStack: { frameworks: ['Express'] },
      expected: 'API Service'
    },
    {
      modules: [{ type: 'data-pipeline' }],
      techStack: { frameworks: [] },
      expected: 'Data Platform'
    },
    {
      modules: [],
      techStack: { frameworks: [] },
      expected: 'Operational Toolkit'
    }
  ];

  for (const testCase of testCases) {
    const result = await generateRunbook({
      projectName: `${testCase.expected} Test`,
      session: createMockSession(),
      responses: {},
      modulesResult: { modules: testCase.modules },
      tickets: [],
      techStack: testCase.techStack,
      exportsDir: testExportsDir
    });

    const content = await readFile(result.path, 'utf8');
    // The project type is used in the spec snapshot
    assert(content.includes(testCase.expected));
  }
  
  console.log('✓ Project type detection passed');
}

// Test 12: Recommendations generation
async function testRecommendationsGeneration() {
  console.log('TEST: Recommendations generation');
  
  const result = await generateRunbook({
    projectName: 'Recommendations Test',
    session: createMockSession(),
    responses: {},
    modulesResult: createMockModulesResult(),
    tickets: createMockTickets(),
    techStack: createMockTechStack(),
    exportsDir: testExportsDir
  });

  const content = await readFile(result.path, 'utf8');
  assert(content.includes('## Recommendations'));
  // Should have some recommendations based on the data
  
  console.log('✓ Recommendations generation passed');
}

// Test 13: Testing quick wins
async function testQuickWinsGeneration() {
  console.log('TEST: Testing quick wins generation');
  
  const result = await generateRunbook({
    projectName: 'Quick Wins Test',
    session: createMockSession(),
    responses: {},
    modulesResult: createMockModulesResult(),
    tickets: [],
    techStack: createMockTechStack(),
    exportsDir: testExportsDir
  });

  const content = await readFile(result.path, 'utf8');
  assert(content.includes('## Testing Quick Wins'));
  
  console.log('✓ Quick wins generation passed');
}

// Test 14: File path and naming
async function testFilePathNaming() {
  console.log('TEST: File path and naming');
  
  const result = await generateRunbook({
    projectName: 'Path Test',
    session: createMockSession(),
    responses: {},
    modulesResult: createMockModulesResult(),
    tickets: [],
    techStack: createMockTechStack(),
    exportsDir: testExportsDir
  });

  // Check filename format
  const datePattern = /^runbook-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.md$/;
  assert(datePattern.test(result.filename));
  
  // Check paths
  assert(result.path.startsWith(testExportsDir));
  assert(result.relativePath === result.filename);
  
  console.log('✓ File path and naming passed');
}

// Test 15: Edge cases
async function testEdgeCases() {
  console.log('TEST: Edge cases');
  
  // Test with very long project name
  const longName = 'A'.repeat(500);
  const result1 = await generateRunbook({
    projectName: longName,
    session: createMockSession(),
    responses: {},
    modulesResult: createMockModulesResult(),
    tickets: [],
    techStack: createMockTechStack(),
    exportsDir: testExportsDir
  });
  
  const content1 = await readFile(result1.path, 'utf8');
  assert(content1.includes(longName));
  
  // Test with special characters in responses
  const session = createMockSession();
  session.responses.push({
    questionId: 'rollback-plan',
    answer: 'Use <script>alert("xss")</script> & special chars: ${}[]|'
  });
  
  const result2 = await generateRunbook({
    projectName: 'XSS Test',
    session,
    responses: {},
    modulesResult: createMockModulesResult(),
    tickets: [],
    techStack: createMockTechStack(),
    exportsDir: testExportsDir
  });
  
  const content2 = await readFile(result2.path, 'utf8');
  // Should preserve special characters without escaping
  assert(content2.includes('<script>alert("xss")</script>'));
  
  console.log('✓ Edge cases passed');
}

// Run all tests
(async () => {
  console.log('Starting runbook generator tests...\n');
  
  try {
    await testBasicRunbookGeneration();
    await testIncidentResponseGeneration();
    await testDeploymentRunbookGeneration();
    await testSecurityMonitoringRunbooks();
    await testAISafeguardsRunbooks();
    await testTemplateSubstitution();
    await testModuleSummaryFormatting();
    await testTicketSummaryFormatting();
    await testEmptyDataHandling();
    await testMarkdownFormatting();
    await testProjectTypeDetection();
    await testRecommendationsGeneration();
    await testQuickWinsGeneration();
    await testFilePathNaming();
    await testEdgeCases();
    
    await cleanup();
    
    console.log('\n✅ All runbook generator tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    await cleanup();
    process.exit(1);
  }
})();
