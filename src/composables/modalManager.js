import { useAppStore } from './appStore.js';

function resolveStore(context, scope) {
  return context || scope || useAppStore();
}

export function openBugModalFlow(context) {
  const store = resolveStore(context, this);
  store.showBugModal = true;
}

export function closeBugModalFlow(context) {
  const store = resolveStore(context, this);
  store.showBugModal = false;
}

export function updateBugDraftFlow(value, context) {
  const store = resolveStore(context, this);
  store.newBug = value;
}

export function openFeatureModalFlow(context) {
  const store = resolveStore(context, this);
  store.showFeatureModal = true;
}

export function closeFeatureModalFlow(context) {
  const store = resolveStore(context, this);
  store.showFeatureModal = false;
}

export function updateFeatureDraftFlow(value, context) {
  const store = resolveStore(context, this);
  store.newFeature = value;
}

export function openAddModuleModalFlow(context) {
  const store = resolveStore(context, this);
  store.showAddModuleModal = true;
}

export function closeAddModuleModalFlow(context) {
  const store = resolveStore(context, this);
  store.showAddModuleModal = false;
}

export function updateModuleDraftFlow(value, context) {
  const store = resolveStore(context, this);
  store.newModule = value;
}

export function updateTicketCompletionSummaryFlow(value, context) {
  const store = resolveStore(context, this);
  store.ticketCompletionSummary = value;
}

export function updateRunbookDraftFlow(value, context) {
  const store = resolveStore(context, this);
  store.runbookDraftAnswer = value;
}
