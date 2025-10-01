import {
  extendSectionsForProjectType,
  extendSectionsForFramework,
  updateFrameworkOptions,
  advanceSectionIfComplete
} from '../composables/specBuilder.js';

import { fetchInterviewBlueprint as fetchInterviewBlueprintApi } from '../services/apiClient.js';

function createInterviewBloc() {
  return {
    async loadInterviewBlueprint() {
      if (this.interviewBlueprint) return;
      try {
        const blueprint = await fetchInterviewBlueprintApi();
        this.interviewBlueprint = blueprint.sections || {};
        this.baseSectionOrder = blueprint.baseOrder || Object.keys(this.interviewBlueprint);
        this.typeSectionMap = blueprint.typeOrder || {};
        this.frameworkSectionMap = blueprint.frameworkSectionMap || {};
        this.languageFrameworks = blueprint.languageFrameworks || {};
      } catch (error) {
        console.error('Interview blueprint load error', error);
        this.interviewBlueprint = {};
        this.baseSectionOrder = [];
        this.typeSectionMap = {};
        this.frameworkSectionMap = {};
        this.languageFrameworks = {};
      }
    },
    initializeInterview() {
      if (!this.interviewBlueprint || this.baseSectionOrder.length === 0) {
        this.currentQuestions = [];
        this.currentSectionOrder = [];
        this.currentPhase = 'initial';
        return;
      }
      this.questionAnswers = {};
      this.completedSections = [];
      this.currentSectionOrder = [...this.baseSectionOrder];
      this.activeSectionIndex = 0;
      this.currentQuestions = [];
      const firstSectionId = this.currentSectionOrder[0];
      if (firstSectionId) {
        this.enqueueSection(firstSectionId);
        this.currentPhase = this.getSectionTitle(firstSectionId);
      }
    },
    getSection(sectionId) {
      if (!sectionId || !this.interviewBlueprint) return null;
      return this.interviewBlueprint[sectionId] || null;
    },
    getSectionTitle(sectionId) {
      const section = this.getSection(sectionId);
      return section ? section.title : 'Interview';
    },
    cloneSectionQuestions(sectionId) {
      const section = this.getSection(sectionId);
      if (!section || !Array.isArray(section.questions)) return [];
      return section.questions.map((question, index) => ({
        ...question,
        answer: this.questionAnswers[question.id] || '',
        sectionId,
        sectionTitle: section.title,
        sectionDescription: section.description || '',
        isSectionFirst: index === 0
      }));
    },
    enqueueSection(sectionId) {
      if (!sectionId) return;
      if (this.currentQuestions.some(q => q.sectionId === sectionId)) return;
      const clones = this.cloneSectionQuestions(sectionId);
      if (clones.length) {
        this.currentQuestions.push(...clones);
      }
    },
    extendSectionsForProjectType(projectType) {
      extendSectionsForProjectType.call(this, projectType);
    },
    extendSectionsForFramework(framework) {
      extendSectionsForFramework.call(this, framework);
    },
    updateFrameworkOptions(language) {
      updateFrameworkOptions.call(this, language);
    },
    advanceSectionIfComplete(sectionId) {
      advanceSectionIfComplete.call(this, sectionId);
    },
    async reloadInterviewQuestions() {
      // Force reload of interview blueprint
      this.interviewBlueprint = null;
      await this.loadInterviewBlueprint();
      
      // Re-initialize with new questions
      if (this.currentQuestions.length > 0) {
        // Save current answers
        const savedAnswers = { ...this.questionAnswers };
        
        // Re-initialize interview
        this.initializeInterview();
        
        // Restore answers for questions that still exist
        this.questionAnswers = savedAnswers;
        
        // Update current questions with saved answers
        this.currentQuestions = this.currentQuestions.map(q => ({
          ...q,
          answer: savedAnswers[q.id] || q.answer || ''
        }));
      }
      
      console.log('Interview questions reloaded');
    }
  };
}

export { createInterviewBloc };
export default createInterviewBloc;
