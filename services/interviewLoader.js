const path = require('path');
const fs = require('fs').promises;

let blueprintCache = null;

async function loadInterviewBlueprint() {
    if (blueprintCache) return blueprintCache;
    const blueprintPath = path.join(__dirname, '..', 'public', 'data', 'interview-sections.json');
    const raw = await fs.readFile(blueprintPath, 'utf8');
    blueprintCache = JSON.parse(raw);
    return blueprintCache;
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
    getNewProjectQuestionnaire
};
