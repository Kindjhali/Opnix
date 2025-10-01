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
}

// Create singleton instance
const interviewLoader = new InterviewLoader();

// Maintain backward compatibility
async function loadInterviewBlueprint() {
    return interviewLoader.loadInterviewBlueprint();
}

async function getNewProjectQuestionnaire() {
    const blueprint = await loadInterviewBlueprint();
    const sections = blueprint.sections || {};
    const order = blueprint.baseOrder || Object.keys(sections);
    const result = [];
    order.forEach(sectionId => {
        const section = sections[sectionId];
        if (!section || !Array.isArray(section.questions)) return;
        result.push({
            sectionId,
            title: section.title,
            description: section.description || '',
            questions: section.questions
        });
    });
    return result;
}

module.exports = {
    loadInterviewBlueprint,
    getNewProjectQuestionnaire,
    interviewLoader
};
