import assert from 'node:assert/strict';
import {
  deriveAdaptiveSections,
  deriveAnswerInsights,
  getDynamicSection
} from '../src/interviewAdaptive.mjs';

(function testApiAdaptiveRule() {
  const answers = { 'project-type': 'API Service' };
  const sections = deriveAdaptiveSections({
    questionId: 'project-type',
    answer: 'API Service',
    answers
  });
  assert(sections.includes('api-endpoints'), 'api service projects should trigger api-endpoints section');
  assert(sections.includes('integration-contracts'), 'api service projects should trigger integration-contracts section');
})();

(function testComplianceAdaptiveRule() {
  const answers = { 'business-constraints': 'Must satisfy GDPR and SOC2 controls' };
  const sections = deriveAdaptiveSections({
    questionId: 'business-constraints',
    answer: 'Must satisfy GDPR and SOC2 controls',
    answers
  });
  assert(sections.includes('compliance-verification'), 'compliance keywords should trigger compliance verification follow-up');
})();

(function testInsightsDerivation() {
  const answers = {
    'project-purpose': 'Mobile field app with offline capture and AI assisted checks',
    'business-constraints': 'HIPAA compliance is mandatory'
  };
  const insights = deriveAnswerInsights(answers);
  const patternIds = insights.patterns.map(pattern => pattern.id);
  assert(patternIds.includes('mobile-offline'), 'mobile cues should register mobile-offline focus area');
  assert(patternIds.includes('regulated-delivery'), 'compliance cues should register regulated-delivery focus area');
  assert(insights.recommendedSections.includes('mobile-resilience'), 'mobile focus area should recommend mobile-resilience section');
  assert(insights.recommendedSections.includes('compliance-verification'), 'regulated delivery should recommend compliance verification section');
})();

(function testDynamicSectionLibrary() {
  const apiSection = getDynamicSection('api-endpoints');
  assert(apiSection, 'api-endpoints section definition should exist');
  assert(Array.isArray(apiSection.questions) && apiSection.questions.length >= 3, 'api-endpoints section should provide a rich question set');
})();

console.log('interviewAdaptive tests passed');
