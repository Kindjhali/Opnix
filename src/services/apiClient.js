const DEFAULT_HEADERS = { 'Content-Type': 'application/json' };

async function handleResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const body = isJson ? await response.json() : await response.text();
  if (!response.ok) {
    const error = body && body.error ? body.error : response.statusText;
    throw new Error(error || 'Request failed');
  }
  return body;
}

async function getJson(url) {
  const response = await fetch(url, { method: 'GET', headers: DEFAULT_HEADERS });
  return handleResponse(response);
}

async function sendJson(url, method, payload = {}) {
  const response = await fetch(url, {
    method,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(payload)
  });
  return handleResponse(response);
}

async function postJson(url, payload = {}) {
  return sendJson(url, 'POST', payload);
}

async function putJson(url, payload = {}) {
  return sendJson(url, 'PUT', payload);
}

export async function fetchAgents() {
  return getJson('/api/agents');
}

export async function activateAgent(agentId) {
  return postJson('/api/agents/activate', { agentId });
}

export async function fetchTickets() {
  return getJson('/api/tickets');
}

export async function updateTicketStatus(ticketId, status, summary) {
  return postJson(`/api/tickets/${encodeURIComponent(ticketId)}/status`, { status, summary });
}

export async function createTicket(payload) {
  return postJson('/api/tickets', payload);
}

export async function updateTicket(ticketId, payload) {
  return putJson(`/api/tickets/${encodeURIComponent(ticketId)}`, payload);
}

export async function fetchFeatures() {
  return getJson('/api/features');
}

export async function createFeature(payload) {
  return postJson('/api/features', payload);
}

export async function fetchModulesGraph() {
  return getJson('/api/modules/graph');
}

export async function detectModules(payload = {}) {
  return postJson('/api/modules/detect', payload);
}

export async function persistModuleLink(payload) {
  return postJson('/api/modules/links', payload);
}

export async function createModule(payload) {
  return postJson('/api/modules', payload);
}

export async function exportCanvas(payload) {
  return postJson('/api/canvas/export', payload);
}

export async function generateRoadmap(payload = {}) {
  return postJson('/api/roadmap/generate-from-tickets', payload);
}

export async function fetchRoadmapState() {
  return getJson('/api/roadmap/state');
}

export async function fetchRoadmapVersions() {
  return getJson('/api/roadmap/versions');
}

export async function rollbackRoadmap(payload = {}) {
  return postJson('/api/roadmap/rollback', payload);
}

export async function exportRoadmap(payload = {}) {
  return postJson('/api/roadmap/export', payload);
}

export async function updateRoadmapMilestone(id, payload = {}) {
  const safeId = encodeURIComponent(id);
  return sendJson(`/api/roadmap/milestones/${safeId}`, 'PATCH', payload);
}

export async function fetchTerminalHistory() {
  return getJson('/api/terminal/history');
}

export async function executeTerminalCommand(payload) {
  return postJson('/api/terminal/execute', payload);
}

export async function clearTerminalHistory() {
  return sendJson('/api/terminal/history', 'DELETE');
}

export async function fetchTerminalStatus() {
  return getJson('/api/terminal/status');
}

export async function fetchContextStatus() {
  return getJson('/api/context/status');
}

export async function fetchExports() {
  return getJson('/api/exports');
}

export async function fetchStats() {
  return getJson('/api/stats');
}

export async function fetchInterviewBlueprint() {
  const response = await fetch('/data/interview-sections.json', {
    method: 'GET',
    headers: DEFAULT_HEADERS,
    cache: 'no-cache'
  });
  return handleResponse(response);
}

export async function exportMarkdown() {
  return getJson('/api/export/markdown');
}

export async function fetchCliSessions() {
  return getJson('/api/cli/sessions');
}

export async function fetchCliSessionDetails(sessionId) {
  return getJson(`/api/cli/sessions/${encodeURIComponent(sessionId)}`);
}

export async function fetchRunbookInterviewStart() {
  return postJson('/api/runbooks/interview/start');
}

export async function submitRunbookAnswer(payload) {
  return postJson('/api/runbooks/interview/answer', payload);
}

export async function generateRunbook(payload = {}) {
  return postJson('/api/runbooks/generate', payload);
}

export async function generateSpec(payload) {
  return postJson('/api/specs/generate', payload);
}

export async function fetchClaudeCommand(payload) {
  return postJson('/api/claude/execute', payload);
}

export async function generateDocs(payload) {
  return postJson('/api/docs/generate', payload);
}

export async function saveDoc(payload) {
  return postJson('/api/docs/save', payload);
}

export async function fetchDiagram(type, { refresh } = {}) {
  const url = refresh ? `/api/diagrams/${encodeURIComponent(type)}?refresh=1` : `/api/diagrams/${encodeURIComponent(type)}`;
  return getJson(url);
}

export async function generateApiSpec(payload) {
  return postJson('/api/api-spec/generate', payload);
}

export async function fetchHealth() {
  return getJson('/api/health');
}

export async function exportApiSpec(payload) {
  return postJson('/api/api-spec/export', payload);
}

export async function testApiEndpoints(payload = {}) {
  return postJson('/api/api-spec/test', payload);
}

export async function startStorybook() {
  return postJson('/api/storybook/start');
}

export async function fetchTechStackSummary() {
  return getJson('/api/tech-stack');
}

export async function exportTechStackSummary() {
  return postJson('/api/tech-stack/export');
}

export const apiClient = {
  fetchAgents,
  activateAgent,
  fetchTickets,
  updateTicketStatus,
  createTicket,
  fetchFeatures,
  createFeature,
  updateTicket,
  fetchModulesGraph,
  detectModules,
  persistModuleLink,
  createModule,
  exportCanvas,
  generateRoadmap,
  fetchRoadmapState,
  exportRoadmap,
  fetchRoadmapVersions,
  rollbackRoadmap,
  fetchExports,
  fetchStats,
  fetchInterviewBlueprint,
  fetchTerminalHistory,
  executeTerminalCommand,
  clearTerminalHistory,
  fetchTerminalStatus,
  fetchContextStatus,
  fetchCliSessions,
  fetchCliSessionDetails,
  fetchRunbookInterviewStart,
  submitRunbookAnswer,
  generateRunbook,
  generateSpec,
  fetchClaudeCommand,
  generateDocs,
  saveDoc,
  fetchDiagram,
  generateApiSpec,
  exportApiSpec,
  testApiEndpoints,
  startStorybook,
  fetchTechStackSummary,
  exportTechStackSummary
};

export default apiClient;
