import { marked } from 'marked';

import {
  fetchRunbookInterviewStart as fetchRunbookInterviewStartApi,
  submitRunbookAnswer as submitRunbookAnswerApi,
  generateRunbook as generateRunbookApi
} from '../services/apiClient.js';

marked.setOptions({ mangle: false, headerIds: false });

export function resetRunbookState() {
  this.runbookSessionId = null;
  this.runbookCurrentQuestion = null;
  this.runbookDraftAnswer = '';
  this.runbookResponses = [];
  this.runbookHistory = [];
  this.runbookMessages = [];
  this.runbookInterviewError = '';
  this.runbookInterviewLoading = false;
  this.runbookInterviewSubmitting = false;
}

export async function startRunbookInterviewFlow() {
  if (this.runbookGenerating) return;
  this.runbookModalOpen = true;
  this.runbookGenerationError = '';
  resetRunbookState.call(this);
  this.runbookInterviewLoading = true;
  try {
    const payload = await fetchRunbookInterviewStartApi();
    if (!payload || !payload.sessionId) {
      throw new Error((payload && payload.error) || 'Failed to start runbook interview');
    }
    this.runbookSessionId = payload.sessionId;
    this.runbookCurrentQuestion = payload.question || null;
    this.runbookResponses = Array.isArray(payload.responses) ? payload.responses : [];
    this.runbookHistory = [];
  } catch (error) {
    console.error('Runbook interview start failed', error);
    this.runbookInterviewError = error.message || 'Failed to start runbook interview';
  } finally {
    this.runbookInterviewLoading = false;
  }
}

export async function submitRunbookAnswerFlow() {
  if (this.runbookInterviewSubmitting || !this.runbookSessionId || !this.runbookCurrentQuestion) {
    return;
  }
  const currentQuestion = this.runbookCurrentQuestion;
  const answer = (this.runbookDraftAnswer || '').trim();
  if (!answer) {
    this.runbookInterviewError = 'Please provide an answer before continuing.';
    return;
  }
  this.runbookInterviewSubmitting = true;
  this.runbookInterviewError = '';
  try {
    const payload = await submitRunbookAnswerApi({
      sessionId: this.runbookSessionId,
      questionId: this.runbookCurrentQuestion.id,
      answer
    });
    if (payload.error) {
      throw new Error(payload.error || 'Failed to submit answer');
    }
    if (currentQuestion) {
      this.runbookHistory = [
        ...(this.runbookHistory || []),
        {
          questionId: currentQuestion.id,
          prompt: currentQuestion.prompt,
          answer
        }
      ];
    }
    this.runbookResponses = Array.isArray(payload.responses) ? payload.responses : this.runbookResponses;
    this.runbookMessages = Array.isArray(payload.messages) ? payload.messages : [];
    this.runbookDraftAnswer = '';
    if (payload.completed) {
      this.runbookCurrentQuestion = null;
      await generateRunbookFlow.call(this, {
        sessionId: payload.sessionId || this.runbookSessionId,
        responses: payload.responses
      });
    } else {
      this.runbookCurrentQuestion = payload.nextQuestion || null;
    }
  } catch (error) {
    console.error('Runbook answer submit failed', error);
    this.runbookInterviewError = error.message || 'Failed to submit answer';
  } finally {
    this.runbookInterviewSubmitting = false;
  }
}

export async function skipRunbookInterviewFlow() {
  await generateRunbookFlow.call(this, { sessionId: this.runbookSessionId, responses: this.runbookResponses });
}

export function closeRunbookModalFlow() {
  this.runbookModalOpen = false;
  resetRunbookState.call(this);
}

export async function generateRunbookFlow(options = {}) {
  if (this.runbookGenerating) return;
  this.runbookGenerating = true;
  this.runbookGenerationError = '';
  try {
    const payload = {};
    const sessionId = options.sessionId || this.runbookSessionId;
    if (sessionId) {
      payload.sessionId = sessionId;
    }
    if (options.responses && Array.isArray(options.responses)) {
      payload.responses = options.responses;
    }
    const result = await generateRunbookApi(payload);
    if (!result.success) {
      throw new Error(result.error || 'Failed to generate runbook');
    }
    this.latestRunbook = result.runbook;
    this.latestRunbookContent = result.runbook.content;
    this.latestRunbookHtml = result.runbook.content ? marked.parse(result.runbook.content) : '';
    this.runbookMessages = Array.isArray(this.runbookMessages) ? this.runbookMessages : [];
    this.addTask('Runbook Generator', `Runbook saved as ${result.runbook.filename}`, 'complete');
    await this.fetchExports();
    this.runbookModalOpen = false;
    resetRunbookState.call(this);
    this.runbookSessionId = result.runbook.sessionId || null;
  } catch (error) {
    console.error('Runbook generation failed', error);
    const message = error.message || 'Failed to generate runbook';
    if (this.runbookModalOpen) {
      this.runbookInterviewError = message;
    } else {
      this.runbookGenerationError = message;
    }
  } finally {
    this.runbookGenerating = false;
  }
}

export async function quickGenerateRunbookFlow() {
  this.runbookMessages = [];
  this.runbookHistory = [];
  this.runbookInterviewError = '';
  await generateRunbookFlow.call(this, {});
}
