function createChecklistUtils({
  checklistPending,
  checklistInProgress,
  checklistComplete,
  validChecklistStatuses,
  checklistStatusTransitions,
  normaliseStatusHook
}) {
  function normaliseChecklistStatus(status, { fallback } = {}) {
    if (status === null || status === undefined) return fallback ?? null;
    const trimmed = String(status).trim();
    if (!trimmed) return fallback ?? null;
    const condensed = trimmed.replace(/[\s_-]/g, '').toLowerCase();
    if (condensed === 'pending') return checklistPending;
    if (condensed === 'inprogress') return checklistInProgress;
    if (condensed === 'complete' || condensed === 'completed') return checklistComplete;
    return fallback ?? trimmed;
  }

  function normaliseChecklist(record) {
    if (!record || typeof record !== 'object') return null;
    const baseStatus = normaliseChecklistStatus(record.status, { fallback: checklistPending }) || checklistPending;
    const items = Array.isArray(record.items)
      ? record.items.map(item => ({
          ...item,
          status: normaliseChecklistStatus(item?.status, { fallback: checklistPending }) || checklistPending
        }))
      : [];
    const statusHistory = Array.isArray(record.statusHistory)
      ? record.statusHistory.map(entry => ({
          ...entry,
          from: normaliseChecklistStatus(entry?.from, { fallback: checklistPending }) || checklistPending,
          to: normaliseChecklistStatus(entry?.to, { fallback: checklistPending }) || checklistPending,
          hook: entry?.hook ? normaliseStatusHook(entry.hook) : entry?.hook || null
        }))
      : [];

    return {
      ...record,
      status: baseStatus,
      items,
      statusHistory
    };
  }

  function getChecklistHook(currentStatus, nextStatus) {
    const normalisedCurrent = normaliseChecklistStatus(currentStatus);
    const normalisedNext = normaliseChecklistStatus(nextStatus);
    if (!normalisedCurrent || !normalisedNext) return null;
    const table = checklistStatusTransitions[normalisedCurrent] || {};
    return table[normalisedNext] || null;
  }

  function validateChecklistStatusChange(currentStatus, nextStatus, providedHook) {
    const normalisedCurrent = normaliseChecklistStatus(currentStatus);
    const normalisedNext = normaliseChecklistStatus(nextStatus);
    if (!normalisedNext || normalisedCurrent === normalisedNext) {
      return { ok: true };
    }
    if (!validChecklistStatuses.includes(normalisedNext)) {
      return { ok: false, message: `Unsupported checklist status: ${normalisedNext}` };
    }
    if (!validChecklistStatuses.includes(normalisedCurrent)) {
      return { ok: false, message: `Unsupported existing checklist status: ${normalisedCurrent}` };
    }
    const expected = getChecklistHook(normalisedCurrent, normalisedNext);
    const provided = normaliseStatusHook(providedHook);
    if (!expected || expected !== provided) {
      return { ok: false, message: 'Invalid checklist status hook' };
    }
    return { ok: true };
  }

  return {
    normaliseChecklistStatus,
    normaliseChecklist,
    validateChecklistStatusChange
  };
}

module.exports = {
  createChecklistUtils
};
