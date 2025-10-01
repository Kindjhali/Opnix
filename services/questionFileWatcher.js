const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * File watcher for interview-sections.json that enables hot-reloading
 * of questions without server restart
 */
class QuestionFileWatcher extends EventEmitter {
  constructor() {
    super();
    this.watcher = null;
    this.debounceTimer = null;
    this.debounceDelay = 500; // ms
    this.questionsPath = path.join(__dirname, '../public/data/interview-sections.json');
    this.lastHash = null;
    this.isWatching = false;
    this.activeSessions = new Map();
    this.lastSnapshot = null;
    this.lastDiff = { sections: [], questions: [] };
  }

  /**
   * Start watching the questions file for changes
   */
  async start() {
    if (this.isWatching) {
      console.log('Question file watcher already running');
      return;
    }

    try {
      // Check if chokidar is available, fallback to fs.watch if not
      let chokidar;
      try {
        chokidar = require('chokidar');
      } catch {
        console.log('Chokidar not installed, using native fs.watch');
        return this.startNativeWatcher();
      }

      // Use chokidar for more reliable watching
      this.watcher = chokidar.watch(this.questionsPath, {
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 300,
          pollInterval: 100
        }
      });

      this.watcher
        .on('change', this.handleChange.bind(this))
        .on('error', error => {
          console.error('Watcher error:', error);
          this.emit('error', error);
        });

      this.isWatching = true;
      console.log('Question file watcher started (chokidar)');
      
    } catch (error) {
      console.error('Failed to start file watcher:', error);
      throw error;
    }
  }

  /**
   * Fallback to native fs.watch if chokidar not available
   */
  async startNativeWatcher() {
    try {
      const fsWatch = require('fs');
      
      this.watcher = fsWatch.watch(this.questionsPath, (eventType) => {
        if (eventType === 'change') {
          this.handleChange(this.questionsPath);
        }
      });

      this.watcher.on('error', error => {
        console.error('Native watcher error:', error);
        this.emit('error', error);
      });

      this.isWatching = true;
      console.log('Question file watcher started (native fs.watch)');
      
    } catch (error) {
      console.error('Failed to start native file watcher:', error);
      throw error;
    }
  }

  /**
   * Handle file change events with debouncing
   */
  async handleChange() {
    clearTimeout(this.debounceTimer);

    this.debounceTimer = setTimeout(() => {
      this.processFileChange().catch(error => {
        console.error('Error processing question file change:', error);
        this.emit('error', error);
      });
    }, this.debounceDelay);
  }

  async processFileChange() {
    const content = await fs.readFile(this.questionsPath, 'utf8');

    const hash = crypto
      .createHash('md5')
      .update(content)
      .digest('hex');

    if (hash === this.lastHash) {
      console.log('File touched but content unchanged');
      return null;
    }

    this.lastHash = hash;

    let newQuestions;
    try {
      newQuestions = JSON.parse(content);
      this.validateQuestions(newQuestions);
    } catch (parseError) {
      console.error('Invalid JSON in questions file:', parseError);
      this.emit('error', parseError);
      return null;
    }

    const snapshot = this.buildQuestionsSnapshot(newQuestions);
    const diff = this.diffSnapshots(this.lastSnapshot, snapshot);
    this.lastSnapshot = snapshot;
    this.lastDiff = diff;

    const timestamp = Date.now();
    const changeData = {
      timestamp,
      hash,
      questionCount: this.countQuestions(newQuestions),
      questions: newQuestions,
      diff
    };

    console.log(`Questions updated: ${changeData.questionCount} questions loaded`);

    await this.handleActiveSessionsUpdate(newQuestions, diff);

    this.emit('questions-changed', changeData);

    if (diff.sections.length || diff.questions.length) {
      const deltaPayload = { timestamp, diff };
      this.emit('questions-delta', deltaPayload);
      this.emit('questions:sections', diff.sections);
      diff.sections.forEach(sectionChange => {
        this.emit(`questions:section:${sectionChange.id}`, sectionChange);
      });
      this.emit('questions:questions', diff.questions);
      diff.questions.forEach(questionChange => {
        const eventId = `${questionChange.sectionId}:${questionChange.id}`;
        this.emit(`questions:question:${eventId}`, questionChange);
      });
    }

    return changeData;
  }

  buildQuestionsSnapshot(questions) {
    const snapshot = {
      sections: new Map(),
      questionIndex: new Map()
    };

    let sectionsArray = [];
    if (Array.isArray(questions.sections)) {
      sectionsArray = questions.sections;
    } else if (Array.isArray(questions.questions)) {
      sectionsArray = [{
        id: 'default',
        title: 'Default',
        questions: questions.questions
      }];
    }

    sectionsArray.forEach((section, sectionIdx) => {
      const sectionId = section.id || `section-${sectionIdx}`;
      const title = section.title || section.name || '';
      const questionMap = new Map();

      (section.questions || []).forEach((question, questionIdx) => {
        const questionId = question.id || `question-${questionIdx}`;
        const hash = crypto
          .createHash('md5')
          .update(JSON.stringify(question))
          .digest('hex');
        const key = `${sectionId}:${questionId}`;
        const entry = {
          sectionId,
          questionId,
          question,
          hash,
          index: questionIdx,
          sectionTitle: title
        };
        questionMap.set(questionId, entry);
        snapshot.questionIndex.set(key, entry);
      });

      snapshot.sections.set(sectionId, {
        id: sectionId,
        title,
        questions: questionMap
      });
    });

    return snapshot;
  }

  diffSnapshots(previousSnapshot, nextSnapshot) {
    const prevSections = previousSnapshot ? previousSnapshot.sections : new Map();
    const nextSections = nextSnapshot.sections;

    const sectionDiffs = [];
    const questionDiffs = [];

    const recordQuestion = (change) => {
      questionDiffs.push({
        type: change.type,
        id: change.questionId,
        sectionId: change.sectionId,
        question: change.question,
        previousQuestion: change.previousQuestion || null,
        hash: change.hash,
        previousHash: change.previousHash || null
      });
    };

    const processSectionChanges = (sectionId, nextSection, prevSection) => {
      const added = [];
      const removed = [];
      const updated = [];

      nextSection.questions.forEach((entry, questionId) => {
        const prevEntry = prevSection?.questions.get(questionId);
        if (!prevEntry) {
          added.push(questionId);
          recordQuestion({ type: 'added', questionId, sectionId, question: entry.question, hash: entry.hash });
        } else if (prevEntry.hash !== entry.hash) {
          updated.push(questionId);
          recordQuestion({
            type: 'updated',
            questionId,
            sectionId,
            question: entry.question,
            previousQuestion: prevEntry.question,
            hash: entry.hash,
            previousHash: prevEntry.hash
          });
        }
      });

      if (prevSection) {
        prevSection.questions.forEach((entry, questionId) => {
          if (!nextSection.questions.has(questionId)) {
            removed.push(questionId);
            recordQuestion({ type: 'removed', questionId, sectionId, question: entry.question, hash: entry.hash });
          }
        });
      }

      if (!prevSection) {
        if (added.length || nextSection.questions.size === 0) {
          sectionDiffs.push({
            type: 'added',
            id: sectionId,
            title: nextSection.title,
            questionCount: nextSection.questions.size,
            changes: { added, removed: [], updated: [] }
          });
        }
        return;
      }

      if (added.length || removed.length || updated.length) {
        sectionDiffs.push({
          type: 'updated',
          id: sectionId,
          title: nextSection.title || prevSection.title,
          questionCount: nextSection.questions.size,
          changes: { added, removed, updated }
        });
      }
    };

    nextSections.forEach((nextSection, sectionId) => {
      const prevSection = prevSections.get(sectionId);
      processSectionChanges(sectionId, nextSection, prevSection);
    });

    prevSections.forEach((prevSection, sectionId) => {
      if (!nextSections.has(sectionId)) {
        const removed = [];
        prevSection.questions.forEach(entry => {
          removed.push(entry.questionId);
          recordQuestion({ type: 'removed', questionId: entry.questionId, sectionId, question: entry.question, hash: entry.hash });
        });
        sectionDiffs.push({
          type: 'removed',
          id: sectionId,
          title: prevSection.title,
          questionCount: 0,
          changes: { added: [], removed, updated: [] }
        });
      }
    });

    return {
      sections: sectionDiffs,
      questions: questionDiffs
    };
  }

  /**
   * Validate question structure
   */
  validateQuestions(questions) {
    if (!questions || typeof questions !== 'object') {
      throw new Error('Questions must be an object');
    }

    // Check for sections array (common structure)
    if (questions.sections) {
      if (!Array.isArray(questions.sections)) {
        throw new Error('sections must be an array');
      }
      
      questions.sections.forEach((section, idx) => {
        if (!section.id) {
          throw new Error(`Section at index ${idx} missing required 'id' field`);
        }
        if (!section.questions || !Array.isArray(section.questions)) {
          throw new Error(`Section '${section.id}' missing questions array`);
        }
        
        // Validate each question
        section.questions.forEach((q, qIdx) => {
          if (!q.id) {
            throw new Error(`Question at index ${qIdx} in section '${section.id}' missing 'id'`);
          }
          if (!q.text && !q.question) {
            throw new Error(`Question '${q.id}' missing text/question field`);
          }
        });
      });
    }
    
    // Also support flat question arrays
    else if (questions.questions && Array.isArray(questions.questions)) {
      questions.questions.forEach((q, idx) => {
        if (!q.id) {
          throw new Error(`Question at index ${idx} missing 'id'`);
        }
        if (!q.text && !q.question) {
          throw new Error(`Question '${q.id}' missing text/question field`);
        }
      });
    }
    
    else {
      throw new Error('Questions must have either sections or questions array');
    }
  }

  /**
   * Count total questions
   */
  countQuestions(questions) {
    if (questions.sections) {
      return questions.sections.reduce((total, section) => {
        return total + (section.questions?.length || 0);
      }, 0);
    } else if (questions.questions) {
      return questions.questions.length;
    }
    return 0;
  }

  /**
   * Force reload questions manually
   */
  async forceReload() {
    console.log('Force reloading questions...');
    this.lastHash = null; // Clear hash to force reload
    return this.processFileChange();
  }

  /**
   * Stop watching
   */
  stop() {
    clearTimeout(this.debounceTimer);
    
    if (this.watcher) {
      if (typeof this.watcher.close === 'function') {
        this.watcher.close();
      } else {
        // Native watcher
        this.watcher.close();
      }
      this.watcher = null;
    }
    
    this.isWatching = false;
    console.log('Question file watcher stopped');
  }

  /**
   * Check if watcher is running
   */
  isRunning() {
    return this.isWatching;
  }

  /**
   * Register an active session
   */
  registerSession(sessionId, session) {
    this.activeSessions.set(sessionId, session);
    console.log(`Session registered: ${sessionId}`);
  }

  /**
   * Unregister a session
   */
  unregisterSession(sessionId) {
    this.activeSessions.delete(sessionId);
    console.log(`Session unregistered: ${sessionId}`);
  }

  /**
   * Handle updates for active sessions
   */
  async handleActiveSessionsUpdate(newQuestions, diff = { sections: [], questions: [] }) {
    for (const [sessionId, session] of this.activeSessions) {
      try {
        // Check if session is in the middle of answering a question
        if (session.status === 'active' && session.currentQuestionId) {
          // Queue update for after current question
          const pendingUpdate = {
            questions: newQuestions,
            diff,
            timestamp: Date.now(),
            message: 'Questions updated. Changes will apply after current question.'
          };
          session.pendingUpdate = pendingUpdate;
          
          if (session.notifyPendingUpdate) {
            session.notifyPendingUpdate(pendingUpdate);
          }
        } else {
          if (session.updateQuestions) {
            await session.updateQuestions(newQuestions, diff);
          }
          
          if (session.emit) {
            session.emit('questions-updated', {
              timestamp: Date.now(),
              questionCount: this.countQuestions(newQuestions),
              diff
            });
          }
        }
      } catch (error) {
        console.error(`Failed to update session ${sessionId}:`, error);
      }
    }
  }
}

// Export singleton instance
module.exports = new QuestionFileWatcher();