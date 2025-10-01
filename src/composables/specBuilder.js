export function extendSectionsForProjectType(projectType) {
  if (!projectType) return;
  const additions = this.typeSectionMap[projectType] || [];
  additions.forEach(sectionId => {
    if (!this.currentSectionOrder.includes(sectionId)) {
      this.currentSectionOrder.push(sectionId);
    }
  });
}

export function extendSectionsForFramework(framework) {
  if (!framework) return;
  const match = Object.keys(this.frameworkSectionMap).find(
    key => key.toLowerCase() === String(framework).toLowerCase()
  );
  if (!match) return;
  const additions = this.frameworkSectionMap[match] || [];
  additions.forEach(sectionId => {
    if (!this.currentSectionOrder.includes(sectionId)) {
      this.currentSectionOrder.push(sectionId);
    }
  });
}

export function updateFrameworkOptions(language) {
  if (!language) return;
  const match = Object.keys(this.languageFrameworks).find(
    key => key.toLowerCase() === String(language).toLowerCase()
  );
  const options = match ? this.languageFrameworks[match] : ['None/Custom'];
  const frameworkQuestion = this.currentQuestions.find(q => q.id === 'preferred-framework');
  if (frameworkQuestion) {
    frameworkQuestion.options = options;
    if (!options.includes(frameworkQuestion.answer)) {
      frameworkQuestion.answer = '';
      this.questionAnswers['preferred-framework'] = '';
    }
  }
}

export function advanceSectionIfComplete(sectionId) {
  if (!sectionId || this.completedSections.includes(sectionId)) return;
  const section = this.getSection(sectionId);
  if (!section) return;
  const isComplete = section.questions.every(question => {
    if (question.required === false) return true;
    const value = this.questionAnswers[question.id];
    if (value === undefined || value === null) return false;
    return String(value).trim().length > 0;
  });
  if (!isComplete) return;
  this.completedSections.push(sectionId);
  if (this.activeSectionIndex < this.currentSectionOrder.length - 1) {
    this.activeSectionIndex += 1;
    const nextSectionId = this.currentSectionOrder[this.activeSectionIndex];
    this.enqueueSection(nextSectionId);
    this.currentPhase = this.getSectionTitle(nextSectionId);
  } else {
    this.currentPhase = 'Complete';
  }
}

export function processAnswer(question) {
  if (!question || !question.id) return;
  this.questionAnswers[question.id] = question.answer;

  if (question.id === 'project-type' && question.answer) {
    this.extendSectionsForProjectType(question.answer);
  }

  if (question.id === 'primary-language' && question.answer) {
    this.updateFrameworkOptions(question.answer);
  }

  if (question.id === 'preferred-framework' && question.answer) {
    this.extendSectionsForFramework(question.answer);
  }

  this.advanceSectionIfComplete(question.sectionId);
}

export function collectAnswers() {
  const answers = {};
  Object.entries(this.questionAnswers).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim().length > 0) {
      answers[key] = value;
    }
  });
  return answers;
}

export function buildSpecPayload() {
  const answers = this.collectAnswers();
  return {
    generatedAt: new Date().toISOString(),
    questionAnswers: answers,
    project: {
      name: answers['project-name'] || 'Untitled Project',
      type: answers['project-type'] || 'Unknown',
      goal: answers['project-purpose'] || answers['value-proposition'] || ''
    },
    technical: {
      language: answers['primary-language'] || null,
      framework: answers['preferred-framework'] || null,
      stack: answers['supporting-libraries'] || null,
      architecture: {
        current: answers['current-architecture'] || null,
        target: answers['target-architecture-vision'] || null,
        dataStores: answers['data-sources'] || null,
        integrations: answers['integration-providers'] || answers['integration-consumers'] || null,
        testingStrategy: answers['testing-strategy'] || null,
        observability: answers['observability-tooling'] || null
      }
    },
    modules: this.modules,
    canvas: {
      edges: this.moduleEdges,
      summary: this.moduleSummary
    },
    features: this.features,
    tickets: this.tickets
  };
}
