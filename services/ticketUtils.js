const deepClone = value => JSON.parse(JSON.stringify(value));

function createTicketUtils({
  statusReported,
  statusInProgress,
  statusFinished,
  validTicketStatuses,
  ticketStatusTransitions
}) {
  function normaliseStatusHook(hook) {
    if (hook === null || hook === undefined) return null;
    const trimmed = String(hook).trim();
    if (!trimmed) return null;
    if (trimmed.includes('-') || trimmed.includes('_')) {
      const lower = trimmed.toLowerCase();
      return lower.replace(/[-_]+(\w)/g, (_, char) => char.toUpperCase());
    }
    return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
  }

  function normaliseTicketStatus(status, { fallback } = {}) {
    if (status === null || status === undefined) return fallback ?? null;
    const trimmed = String(status).trim();
    if (!trimmed) return fallback ?? null;
    const condensed = trimmed.replace(/[\s_-]/g, '').toLowerCase();
    if (condensed === 'reported' || condensed === 'open') return statusReported;
    if (condensed === 'inprogress') return statusInProgress;
    if (condensed === 'finished' || condensed === 'resolved' || condensed === 'complete') return statusFinished;
    return fallback ?? trimmed;
  }

  function getExpectedStatusHook(currentStatus, nextStatus) {
    const normalisedCurrent = normaliseTicketStatus(currentStatus);
    const normalisedNext = normaliseTicketStatus(nextStatus);
    if (!normalisedCurrent || !normalisedNext) return null;
    const table = ticketStatusTransitions[normalisedCurrent] || {};
    return table[normalisedNext] || null;
  }

  function validateTicketStatusChange(currentStatus, nextStatus, providedHook) {
    const normalisedCurrent = normaliseTicketStatus(currentStatus);
    const normalisedNext = normaliseTicketStatus(nextStatus);
    if (!normalisedNext || normalisedCurrent === normalisedNext) {
      return true;
    }
    if (!validTicketStatuses.includes(normalisedCurrent) || !validTicketStatuses.includes(normalisedNext)) {
      return false;
    }
    const expected = getExpectedStatusHook(normalisedCurrent, normalisedNext);
    if (!expected) {
      return false;
    }
    const provided = normaliseStatusHook(providedHook);
    return provided === expected;
  }

  function normaliseTicketsPayload(payload) {
    if (!payload || (typeof payload !== 'object' && !Array.isArray(payload))) {
      return { tickets: [], nextId: 1 };
    }

    const extras = (!Array.isArray(payload) && payload && typeof payload === 'object')
      ? Object.fromEntries(Object.entries(payload).filter(([key]) => key !== 'tickets' && key !== 'nextId'))
      : {};

    let tickets;
    let nextId = null;

    if (Array.isArray(payload)) {
      tickets = payload;
    } else {
      tickets = Array.isArray(payload.tickets) ? payload.tickets : [];
      nextId = payload.nextId;
    }

    if (typeof nextId !== 'number') {
      const coerced = Number(nextId);
      nextId = Number.isFinite(coerced) ? coerced : null;
    }

    const normalisedTickets = tickets.map((ticket, index) => {
      if (!ticket || typeof ticket !== 'object') return null;
      const clone = deepClone(ticket);
      const numericId = Number(clone.id);
      clone.id = Number.isFinite(numericId) ? numericId : index + 1;
      clone.created = clone.created || new Date().toISOString();
      clone.priority = clone.priority || 'medium';
      clone.status = normaliseTicketStatus(clone.status, { fallback: statusReported }) || statusReported;
      clone.tags = Array.isArray(clone.tags) ? clone.tags : [];
      return clone;
    }).filter(Boolean);

    const maxId = normalisedTickets.reduce((max, ticket) => {
      return Number.isFinite(ticket.id) ? Math.max(max, ticket.id) : max;
    }, 0);

    const computedNextId = maxId + 1;
    const resolvedNextId = typeof nextId === 'number' && nextId > maxId ? nextId : computedNextId || 1;

    return {
      ...extras,
      tickets: normalisedTickets,
      nextId: resolvedNextId
    };
  }

  return {
    normaliseStatusHook,
    normaliseTicketStatus,
    getExpectedStatusHook,
    validateTicketStatusChange,
    normaliseTicketsPayload
  };
}

module.exports = {
  createTicketUtils
};
