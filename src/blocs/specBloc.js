import {
  extendSectionsForProjectType,
  extendSectionsForFramework,
  updateFrameworkOptions,
  advanceSectionIfComplete,
  processAnswer as processSpecAnswer,
  collectAnswers as collectSpecAnswers,
  buildSpecPayload as buildSpecPayloadHelper
} from '../composables/specBuilder.js';

import { generateSpec as generateSpecApi } from '../services/apiClient.js';

function createSpecBloc() {
  return {
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
    updateSpecExportFormat(format) {
      this.specExportFormat = format;
    },
    processAnswer(question) {
      processSpecAnswer.call(this, question);
    },
    collectAnswers() {
      return collectSpecAnswers.call(this);
    },
    buildSpecPayload() {
      return buildSpecPayloadHelper.call(this);
    },
    async generateSpec() {
      const spec = this.buildSpecPayload();
      this.latestSpecPayload = spec;
      this.generatedSpec = JSON.stringify(spec, null, 2);
      try {
        const format = this.specExportFormat === 'github' ? 'github-spec-kit' : this.specExportFormat;
        const payload = await generateSpecApi({ spec, format });
        if (payload.success) {
          this.latestSpecMeta = payload;
          this.addTask('Spec Builder', `Spec saved as ${payload.filename}`, 'complete');
          await this.fetchExports();
          if (typeof this.queueRoadmapRefresh === 'function') {
            this.queueRoadmapRefresh({ delay: 600 });
          }
        }
      } catch (error) {
        console.error('Generate spec failed', error);
      }
    }
  };
}

export { createSpecBloc };
export default createSpecBloc;
