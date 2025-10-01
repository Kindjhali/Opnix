export function formatCliSessionStatus(session) {
  if (!session) return 'Unknown';
  return session.completed ? 'Completed' : 'In Progress';
}

export function findCliQuestionPrompt(session, questionId) {
  if (!session || !Array.isArray(session.questions)) return questionId;
  const match = session.questions.find(entry => entry && entry.id === questionId);
  return (match && (match.prompt || match.title)) || questionId;
}

export function formatGateTimestamp(timestamp) {
  if (!timestamp) return 'unknown';
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? timestamp : date.toLocaleString();
}

export function formatGateContext(gate) {
  const diagnostics = gate && gate.diagnostics;
  if (!diagnostics) return 'n/a';
  const used = diagnostics.contextUsed;
  const limit = diagnostics.contextLimit;
  if (typeof used !== 'number' || typeof limit !== 'number' || limit <= 0) {
    return 'n/a';
  }
  return `${Math.round((used / limit) * 100)}%`;
}

export function formatCliTimestamp(timestamp) {
  if (!timestamp) return 'unknown';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return date.toLocaleString();
}
