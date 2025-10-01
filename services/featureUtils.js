function createFeatureUtils({
  validFeatureStatuses,
  featureStatusOrder,
  statusRequiresCriteria
}) {
  function normaliseFeatureStatus(status, { fallback } = {}) {
    if (status === null || status === undefined) return fallback ?? null;
    const trimmed = String(status).trim();
    if (!trimmed) return fallback ?? null;
    const condensed = trimmed.replace(/[\s_-]/g, '').toLowerCase();
    if (condensed === 'proposed') return 'proposed';
    if (condensed === 'approved') return 'approved';
    if (condensed === 'indevelopment') return 'inDevelopment';
    if (condensed === 'testing') return 'testing';
    if (condensed === 'deployed') return 'deployed';
    return fallback ?? trimmed;
  }

  function normaliseFeatureRecord(record) {
    if (!record || typeof record !== 'object') return null;
    const status = normaliseFeatureStatus(record.status, { fallback: 'proposed' }) || 'proposed';
    return {
      ...record,
      status
    };
  }

  function normaliseFeatureCollection(collection) {
    if (!Array.isArray(collection)) return [];
    return collection.map(normaliseFeatureRecord).filter(Boolean);
  }

  function normaliseAcceptanceCriteria(rawCriteria) {
    if (!Array.isArray(rawCriteria)) return [];
    return rawCriteria
      .map(item => {
        if (typeof item === 'string') {
          return item.trim();
        }
        if (item && typeof item.text === 'string') {
          return item.text.trim();
        }
        return '';
      })
      .map(text => text.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  }

  function acceptanceCriteriaSatisfied(criteria) {
    if (!Array.isArray(criteria) || criteria.length === 0) return false;
    return criteria.every(entry => entry && !/\[NEEDS CLARIFICATION\]/i.test(entry));
  }

  function validateFeatureStatusChange(currentStatus, nextStatus, acceptanceCriteria) {
    const normalisedCurrent = normaliseFeatureStatus(currentStatus);
    const normalisedNext = normaliseFeatureStatus(nextStatus);

    if (!normalisedNext || normalisedCurrent === normalisedNext) {
      return { ok: true };
    }

    if (!validFeatureStatuses.includes(normalisedNext)) {
      return { ok: false, message: `Unsupported feature status: ${normalisedNext}` };
    }

    if (!validFeatureStatuses.includes(normalisedCurrent)) {
      return { ok: false, message: `Unsupported existing feature status: ${normalisedCurrent}` };
    }

    const nextIndex = featureStatusOrder.get(normalisedNext);
    const currentIndex = featureStatusOrder.get(normalisedCurrent);

    if (nextIndex < currentIndex) {
      if (statusRequiresCriteria.has(normalisedNext) && !acceptanceCriteriaSatisfied(acceptanceCriteria)) {
        return { ok: false, message: 'Acceptance criteria must be defined before reverting to this status.' };
      }
      return { ok: true };
    }

    if (statusRequiresCriteria.has(normalisedNext) && !acceptanceCriteriaSatisfied(acceptanceCriteria)) {
      return { ok: false, message: 'Define acceptance criteria before advancing the feature status.' };
    }

    return { ok: true };
  }

  return {
    normaliseFeatureStatus,
    normaliseFeatureRecord,
    normaliseFeatureCollection,
    normaliseAcceptanceCriteria,
    validateFeatureStatusChange
  };
}

module.exports = {
  createFeatureUtils
};
