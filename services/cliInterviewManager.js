const path = require('path');
const fs = require('fs').promises;
const { loadInterviewBlueprint } = require('./interviewLoader');
const { ProgressiveQuestionEngine } = require('./progressiveQuestionEngine');
const questionFileWatcher = require('./questionFileWatcher');

const CLI_SESSIONS_DIR = path.join(__dirname, '..', 'data', 'cli-sessions');
const CLI_ARTIFACTS_DIR = path.join(__dirname, '..', 'spec', 'cli-sessions');
const ROOT_DIR = path.join(__dirname, '..');

function generateSessionId() {
  const now = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `cli-${now}-${random}`;
}

async function ensureSessionsDirectory() {
  try {
    await fs.access(CLI_SESSIONS_DIR);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.mkdir(CLI_SESSIONS_DIR, { recursive: true });
    } else {
      throw error;
    }
  }
}

async function ensureArtifactsDirectory() {
  try {
    await fs.access(CLI_ARTIFACTS_DIR);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.mkdir(CLI_ARTIFACTS_DIR, { recursive: true });
    } else {
      throw error;
    }
  }
}

function orderQuestionsByBlueprint(sectionsOrder, sectionQuestions) {
  const orderedQuestions = [];
  sectionsOrder.forEach(sectionId => {
    if (!sectionQuestions.has(sectionId)) return;
    const entries = sectionQuestions.get(sectionId);
    entries.forEach(entry => orderedQuestions.push(entry));
  });
  return orderedQuestions;
}

async function createQuestionEngine() {
  const engine = new ProgressiveQuestionEngine(ROOT_DIR);
  await engine.initialize();
  return engine;
}

async function loadCategoryQuestions(category) {
  const blueprint = await loadInterviewBlueprint();
  const sections = blueprint.sections || {};

  const matchingSections = new Set();
  const sectionQuestions = new Map();

  Object.entries(sections).forEach(([sectionId, section]) => {
    if (!section || !Array.isArray(section.questions)) return;
    const sectionCategory = section.category || (blueprint.sectionCategories || {})[sectionId];
    if (sectionCategory !== category) return;

    matchingSections.add(sectionId);
    const questions = section.questions.map(question => ({
      ...question,
      sectionId,
      sectionTitle: section.title || sectionId,
      category: sectionCategory || category
    }));
    sectionQuestions.set(sectionId, questions);
  });

  if (matchingSections.size === 0) {
    return [];
  }

  const baseOrder = Array.isArray(blueprint.baseOrder) ? blueprint.baseOrder : Object.keys(sections);
  const orderedSections = baseOrder.filter(sectionId => matchingSections.has(sectionId));

  return orderQuestionsByBlueprint(orderedSections, sectionQuestions);
}

async function writeSession(session) {
  await ensureSessionsDirectory();
  const filePath = path.join(CLI_SESSIONS_DIR, `${session.sessionId}.json`);
  await fs.writeFile(filePath, JSON.stringify(session, null, 2));
  return session;
}

async function rebuildEngineFromResponses(responses) {
  const engine = await createQuestionEngine();
  const safeResponses = Array.isArray(responses) ? responses : [];

  for (const entry of safeResponses) {
    if (entry && entry.questionId && entry.answer !== undefined) {
      await engine.processResponse(entry.questionId, entry.answer);
    }
  }

  return engine;
}

async function readSession(sessionId) {
  await ensureSessionsDirectory();
  const filePath = path.join(CLI_SESSIONS_DIR, `${sessionId}.json`);
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

function formatQuestionForDisplay(question) {
  if (!question) return null;
  const baseLines = [
    `(${question.id}) ${question.prompt}`
  ];

  if (question.type) {
    baseLines.push(`Type: ${question.type}`);
  }

  if (Array.isArray(question.options) && question.options.length > 0) {
    const options = question.options.map(option => {
      if (typeof option === 'string') return `- ${option}`;
      if (option && typeof option === 'object' && option.label) {
        return `- ${option.value ?? option.id ?? option.label}: ${option.label}`;
      }
      return `- ${String(option)}`;
    });
    baseLines.push('Options:', ...options);
  }

  if (question.placeholder) {
    baseLines.push(`Hint: ${question.placeholder}`);
  }

  if (question.autoSuggestion) {
    baseLines.push(`Suggested answer: ${question.autoSuggestion}`);
  }

  return baseLines.join('\n');
}

function buildSessionSummary(session) {
  const lines = [
    `Session ${session.sessionId} (${session.category}) complete.`
  ];
  if (session.command) {
    lines.push(`Command: ${session.command}`);
  }
  lines.push('Responses:');
  session.responses.forEach(entry => {
    lines.push(`- ${entry.questionId}: ${entry.answer}`);
  });
  return lines.join('\n');
}

async function writeSessionTranscript(session) {
  await ensureArtifactsDirectory();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${session.sessionId}-${timestamp}.md`;
  const filepath = path.join(CLI_ARTIFACTS_DIR, filename);

  const header = `# CLI Interview Transcript — ${session.category.toUpperCase()}\n\n`;
  const meta = [
    `- Session ID: ${session.sessionId}`,
    `- Command: ${session.command || 'n/a'}`,
    `- Created: ${session.createdAt}`,
    `- Completed: ${session.completedAt || new Date().toISOString()}`
  ].join('\n');

  const body = (session.responses || []).map(entry => `## ${entry.questionId}\n${entry.answer}\n`).join('\n');

  const content = `${header}${meta}\n\n${body || '_No responses recorded._'}\n`;
  await fs.writeFile(filepath, content);

  return {
    type: 'transcript',
    path: filepath,
    filename,
    category: session.category
  };
}

async function listSessions() {
  await ensureSessionsDirectory();
  const entries = await fs.readdir(CLI_SESSIONS_DIR);
  const sessions = [];

  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    const fullPath = path.join(CLI_SESSIONS_DIR, entry);
    try {
      const raw = await fs.readFile(fullPath, 'utf8');
      const session = JSON.parse(raw);
      sessions.push({
        sessionId: session.sessionId,
        category: session.category,
        command: session.command,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        completed: Boolean(session.completedAt)
      });
    } catch (error) {
      sessions.push({ sessionId: entry.replace(/\.json$/, ''), error: error.message });
    }
  }

  sessions.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  return sessions;
}

function decorateQuestion(question, engine) {
  if (!question) return null;
  if (!engine) return { ...question };

  const decorated = { ...question };

  if (typeof engine.adaptPromptToPatterns === 'function') {
    decorated.prompt = engine.adaptPromptToPatterns(question.prompt, question.id);
  }

  if (typeof engine.adaptPlaceholderToPatterns === 'function') {
    decorated.placeholder = engine.adaptPlaceholderToPatterns(question.placeholder, question.id);
  }

  if (decorated.id === 'project-name' && typeof engine.generateProjectNameSuggestion === 'function') {
    decorated.autoSuggestion = engine.generateProjectNameSuggestion();
  }

  return decorated;
}

async function startSession({ category, command }) {
  if (!category) {
    throw new Error('Category is required to start a CLI interview session.');
  }

  const engine = await createQuestionEngine();
  const questions = await loadCategoryQuestions(category);
  if (questions.length === 0) {
    throw new Error(`No questions found for category "${category}".`);
  }

  const session = {
    sessionId: generateSessionId(),
    category,
    command,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentIndex: 0,
    questions,
    responses: [],
    engineState: await engine.getSessionState()
  };

  await writeSession(session);

  // Register session with question file watcher for hot-reload support
  const sessionHandler = {
    sessionId: session.sessionId,
    status: 'active',
    currentQuestionId: questions[0]?.id,
    
    // Handle question updates
    updateQuestions: async (newQuestions) => {
      // Update session questions while preserving answers
      const answeredIds = new Set(session.responses.map(r => r.questionId));
      const updatedQuestions = newQuestions.filter(q => !answeredIds.has(q.id));
      
      // Merge with remaining questions
      session.questions = [
        ...session.questions.slice(0, session.currentIndex + 1),
        ...updatedQuestions
      ];
      
      await writeSession(session);
      console.log(`Session ${session.sessionId}: Questions updated`);
    },
    
    // Handle pending updates
    notifyPendingUpdate: (update) => {
      console.log(`Session ${session.sessionId}: ${update.message}`);
    }
  };
  
  questionFileWatcher.registerSession(session.sessionId, sessionHandler);

  const decoratedQuestion = decorateQuestion(questions[0], engine);

  return {
    session,
    question: decoratedQuestion
  };
}

async function submitAnswer({ sessionId, questionId, answer }) {
  if (!sessionId || !questionId) {
    throw new Error('Session ID and question ID are required.');
  }
  const trimmedAnswer = typeof answer === 'string' ? answer.trim() : '';
  if (!trimmedAnswer) {
    throw new Error('Answer cannot be empty.');
  }

  const session = await readSession(sessionId);
  const existingResponses = Array.isArray(session.responses) ? session.responses : [];
  const question = session.questions[session.currentIndex];

  if (!question) {
    throw new Error('Interview session already completed.');
  }
  if (question.id !== questionId) {
    throw new Error(`Expected answer for question "${question.id}", but received "${questionId}".`);
  }
  const engine = await rebuildEngineFromResponses(existingResponses);
  await engine.processResponse(questionId, trimmedAnswer);

  const recordedAt = new Date().toISOString();
  const updatedResponses = [
    ...existingResponses,
    { questionId, answer: trimmedAnswer, recordedAt }
  ];

  session.responses = updatedResponses;
  session.currentIndex += 1;
  session.updatedAt = recordedAt;
  session.engineState = await engine.getSessionState();

  let nextQuestion = null;
  let summary = null;
  let completed = false;
  let artifacts = Array.isArray(session.artifacts) ? [...session.artifacts] : [];

  if (session.currentIndex < session.questions.length) {
    const rawNextQuestion = session.questions[session.currentIndex];
    nextQuestion = decorateQuestion(rawNextQuestion, engine);
    
    // Update session handler status
    const sessionHandler = questionFileWatcher.activeSessions.get(sessionId);
    if (sessionHandler) {
      sessionHandler.currentQuestionId = rawNextQuestion.id;
      sessionHandler.status = 'active';
    }
  } else {
    completed = true;
    session.completedAt = new Date().toISOString();
    summary = buildSessionSummary(session);
    const transcript = await writeSessionTranscript(session);
    artifacts = [...artifacts, transcript];
    session.artifacts = artifacts;
    
    // Unregister completed session from watcher
    questionFileWatcher.unregisterSession(sessionId);
  }

  await writeSession(session);

  return {
    session,
    nextQuestion,
    completed,
    summary,
    artifacts
  };
}

async function getSession(sessionId) {
  return readSession(sessionId);
}

async function appendSessionArtifacts(sessionId, artifacts) {
  if (!Array.isArray(artifacts) || artifacts.length === 0) {
    return null;
  }
  const session = await readSession(sessionId);
  const existing = Array.isArray(session.artifacts) ? session.artifacts : [];
  session.artifacts = [...existing, ...artifacts];
  session.updatedAt = new Date().toISOString();
  await writeSession(session);
  return session;
}

module.exports = {
  CLI_SESSIONS_DIR,
  CLI_ARTIFACTS_DIR,
  startSession,
  submitAnswer,
  formatQuestionForDisplay,
  buildSessionSummary,
  listSessions,
  getSession,
  appendSessionArtifacts
};
