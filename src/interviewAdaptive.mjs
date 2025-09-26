const KEYWORD_SECTIONS = [
  {
    keywords: ['gdpr', 'soc2', 'hipaa', 'pci', 'compliance'],
    section: 'compliance-verification'
  },
  {
    keywords: ['mobile', 'offline', 'field'],
    section: 'mobile-resilience'
  }
];

export function deriveAdaptiveSections({ questionId, answer, answers }) {
  const sections = new Set();
  const primaryText = String(answer || '').toLowerCase();
  const ambientText = [answer, ...(answers ? Object.values(answers) : [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (questionId === 'project-type' && primaryText.includes('api service')) {
    sections.add('api-endpoints');
    sections.add('integration-contracts');
  }

  if (questionId === 'business-constraints' || ambientText) {
    KEYWORD_SECTIONS.forEach(({ keywords, section }) => {
      if (keywords.some(keyword => ambientText.includes(keyword))) {
        sections.add(section);
      }
    });
  }

  return Array.from(sections);
}

export function deriveAnswerInsights(answers = {}) {
  const patterns = [];
  const recommendedSections = new Set();

  const purpose = String(answers['project-purpose'] || '').toLowerCase();
  const constraints = String(answers['business-constraints'] || '').toLowerCase();

  if (/mobile|offline/.test(purpose)) {
    patterns.push({ id: 'mobile-offline', label: 'Mobile and offline capture focus' });
    recommendedSections.add('mobile-resilience');
  }

  const complianceHit = /hipaa|gdpr|soc2|pci/.test(purpose) || /hipaa|gdpr|soc2|pci/.test(constraints);
  if (complianceHit) {
    patterns.push({ id: 'regulated-delivery', label: 'Regulated delivery requirements detected' });
    recommendedSections.add('compliance-verification');
  }

  return {
    patterns,
    recommendedSections: Array.from(recommendedSections)
  };
}

const DYNAMIC_SECTIONS = {
  'api-endpoints': {
    id: 'api-endpoints',
    title: 'API Endpoints',
    questions: [
      { id: 'api-consumers', prompt: 'Who consumes the API and what authentication do they require?', type: 'textarea' },
      { id: 'api-rate-limits', prompt: 'Define desired rate limits and throttling strategies.', type: 'textarea' },
      { id: 'api-versioning', prompt: 'How do we version and deprecate endpoints?', type: 'textarea' }
    ]
  },
  'integration-contracts': {
    id: 'integration-contracts',
    title: 'Integration Contracts',
    questions: [
      { id: 'provider-slas', prompt: 'List external provider SLAs we must respect.', type: 'textarea' },
      { id: 'fallback-strategy', prompt: 'Describe fallback strategies when providers fail.', type: 'textarea' },
      { id: 'mock-environments', prompt: 'Do providers supply sandbox environments for integration testing?', type: 'textarea' }
    ]
  },
  'mobile-resilience': {
    id: 'mobile-resilience',
    title: 'Mobile Resilience',
    questions: [
      { id: 'offline-capabilities', prompt: 'Which flows must function fully offline?', type: 'textarea' },
      { id: 'sync-strategy', prompt: 'How do we reconcile data when devices reconnect?', type: 'textarea' },
      { id: 'device-support', prompt: 'Enumerate supported devices and operating systems.', type: 'textarea' }
    ]
  },
  'compliance-verification': {
    id: 'compliance-verification',
    title: 'Compliance Verification',
    questions: [
      { id: 'audit-controls', prompt: 'List audit controls we must evidence.', type: 'textarea' },
      { id: 'data-handling', prompt: 'Describe data handling requirements (encryption, retention, residency).', type: 'textarea' },
      { id: 'incident-response', prompt: 'Outline incident response expectations for regulators.', type: 'textarea' }
    ]
  }
};

export function getDynamicSection(sectionId) {
  return DYNAMIC_SECTIONS[sectionId] || null;
}

export default {
  deriveAdaptiveSections,
  deriveAnswerInsights,
  getDynamicSection
};
