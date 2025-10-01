const path = require('path');
const fs = require('fs').promises;
const EventEmitter = require('events');

class InterviewLoader extends EventEmitter {
    constructor() {
        super();
        this.cache = new Map();
        this.cacheVersion = 0;
        this.blueprintPath = path.join(__dirname, '..', 'public', 'data', 'interview-sections.json');
    }

    /**
     * Invalidate all cached data
     */
    invalidateCache() {
        this.cacheVersion++;
        this.cache.clear();
        console.log(`Interview cache invalidated (version: ${this.cacheVersion})`);
        
        // Notify listeners about cache invalidation
        this.emit('cache-invalidated', { version: this.cacheVersion });
    }

    /**
     * Load interview blueprint with caching support
     */
    async loadInterviewBlueprint(useCache = true) {
        const cacheKey = `blueprint-v${this.cacheVersion}`;
        
        if (useCache && this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const raw = await fs.readFile(this.blueprintPath, 'utf8');
            const blueprint = JSON.parse(raw);
            
            // Store in cache
            this.cache.set(cacheKey, blueprint);
            
            return blueprint;
        } catch (error) {
            console.error('Failed to load interview blueprint:', error);
            throw error;
        }
    }

    /**
     * Get question count
     */
    getQuestionCount() {
        const cacheKey = `blueprint-v${this.cacheVersion}`;
        const blueprint = this.cache.get(cacheKey);
        
        if (!blueprint) return 0;
        
        if (blueprint.sections) {
            const sections = Object.values(blueprint.sections);
            return sections.reduce((total, section) => {
                return total + (section.questions?.length || 0);
            }, 0);
        }
        
        return 0;
    }

    async getSectionsByContext(requestedContext, { includeQuestions = true } = {}) {
        const blueprint = await this.loadInterviewBlueprint();
        const sections = blueprint.sections || {};
        const sectionContexts = blueprint.sectionContexts || {};
        const order = Array.isArray(blueprint.baseOrder) ? blueprint.baseOrder : Object.keys(sections);

        const seen = new Set();
        const orderedIds = [];

        order.forEach(sectionId => {
            if (sections[sectionId] && !seen.has(sectionId)) {
                orderedIds.push(sectionId);
                seen.add(sectionId);
            }
        });

        Object.keys(sections).forEach(sectionId => {
            if (!seen.has(sectionId)) {
                orderedIds.push(sectionId);
                seen.add(sectionId);
            }
        });

        const targetContext = requestedContext ? String(requestedContext).toLowerCase() : null;
        const result = [];

        orderedIds.forEach(sectionId => {
            const section = sections[sectionId];
            if (!section || !Array.isArray(section.questions)) return;

            const context = (section.context || sectionContexts[sectionId] || 'project').toLowerCase();
            if (targetContext && context != targetContext) {
                return;
            }

            const entry = {
                sectionId,
                title: section.title,
                description: section.description || '',
                context
            };

            if (includeQuestions) {
                entry.questions = section.questions.map(question => ({
                    ...question,
                    context: question.context || context
                }));
            }

            result.push(entry);
        });

        return result;
    }

    async getQuestionsByContext(requestedContext) {
        const sections = await this.getSectionsByContext(requestedContext, { includeQuestions: true });
        const questions = [];

        sections.forEach(section => {
            (section.questions || []).forEach(question => {
                questions.push({
                    ...question,
                    sectionId: section.sectionId,
                    sectionTitle: section.title,
                    context: question.context || section.context
                });
            });
        });

        return questions;
    }
}

// Create singleton instance
const interviewLoader = new InterviewLoader();

// Maintain backward compatibility
async function loadInterviewBlueprint() {
    return interviewLoader.loadInterviewBlueprint();
}

async function getNewProjectQuestionnaire() {
    return interviewLoader.getSectionsByContext('project');
}

module.exports = {
    loadInterviewBlueprint,
    getNewProjectQuestionnaire,
    getSectionsByContext: (...args) => interviewLoader.getSectionsByContext(...args),
    getQuestionsByContext: (...args) => interviewLoader.getQuestionsByContext(...args),
    interviewLoader
};
