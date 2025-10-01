const fs = require('fs').promises;
const path = require('path');
const statusDashboardManager = require('../services/statusDashboardManager');

// File system watcher for automatic file change tracking
let fileWatcher = null;
const watchedExtensions = ['.js', '.mjs', '.vue', '.css', '.json', '.md', '.html', '.ts', '.tsx'];

function initializeFileWatcher() {
  if (fileWatcher) return;

  try {
    const chokidar = require('chokidar');

    // Watch project files excluding node_modules and .git
    fileWatcher = chokidar.watch('.', {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.next/**',
        '**/coverage/**',
        '**/*.log',
        '**/tmp/**',
        '**/temp/**'
      ],
      ignoreInitial: true,
      persistent: true
    });

    fileWatcher
      .on('add', path => {
        if (shouldTrackFile(path)) {
          statusDashboardManager.trackFileChange(path, 'created');
        }
      })
      .on('change', path => {
        if (shouldTrackFile(path)) {
          statusDashboardManager.trackFileChange(path, 'modified');
        }
      })
      .on('unlink', path => {
        if (shouldTrackFile(path)) {
          statusDashboardManager.trackFileChange(path, 'deleted');
        }
      });

    console.log('📁 File tracking initialized for status dashboard');
  } catch (error) {
    console.warn('⚠️  Could not initialize file watcher (chokidar not available):', error.message);
    // Fallback to basic tracking without real-time monitoring
  }
}

function shouldTrackFile(filePath) {
  const ext = path.extname(filePath);
  return watchedExtensions.includes(ext) && !filePath.includes('node_modules');
}

function stopFileWatcher() {
  if (fileWatcher) {
    fileWatcher.close();
    fileWatcher = null;
    console.log('📁 File tracking stopped');
  }
}

// Middleware to track API token usage
function trackTokenUsage(req, res, next) {
  // Store original res.json to intercept responses
  const originalJson = res.json;

  res.json = function(data) {
    // Look for token usage in response data
    if (data && typeof data === 'object') {
      const tokenData = extractTokenUsage(data, req);
      if (tokenData) {
        statusDashboardManager.trackTokenUsage(
          tokenData.inputTokens,
          tokenData.outputTokens,
          tokenData.provider
        );
      }
    }

    // Call original json method
    return originalJson.call(this, data);
  };

  next();
}

function extractTokenUsage(responseData, request) {
  // Extract token usage from various API response formats

  // OpenAI/Anthropic style responses
  if (responseData.usage) {
    return {
      inputTokens: responseData.usage.prompt_tokens || responseData.usage.input_tokens || 0,
      outputTokens: responseData.usage.completion_tokens || responseData.usage.output_tokens || 0,
      provider: responseData.model ? getProviderFromModel(responseData.model) : 'unknown'
    };
  }

  // Claude API style responses
  if (responseData.tokens_used) {
    return {
      inputTokens: responseData.tokens_used.input || 0,
      outputTokens: responseData.tokens_used.output || 0,
      provider: 'claude'
    };
  }

  // Custom format for our internal APIs
  if (responseData.tokenUsage) {
    return {
      inputTokens: responseData.tokenUsage.input || 0,
      outputTokens: responseData.tokenUsage.output || 0,
      provider: responseData.tokenUsage.provider || 'internal'
    };
  }

  // Estimate token usage for our own API endpoints
  if (request.url && request.url.includes('/api/')) {
    const estimatedTokens = estimateTokenUsage(request, responseData);
    if (estimatedTokens > 0) {
      return {
        inputTokens: Math.floor(estimatedTokens * 0.7), // Estimate 70% input
        outputTokens: Math.floor(estimatedTokens * 0.3), // Estimate 30% output
        provider: 'opnix-internal'
      };
    }
  }

  return null;
}

function getProviderFromModel(modelName) {
  if (modelName.includes('gpt')) return 'openai';
  if (modelName.includes('claude')) return 'anthropic';
  if (modelName.includes('gemini')) return 'google';
  if (modelName.includes('llama')) return 'meta';
  return 'unknown';
}

function estimateTokenUsage(request, responseData) {
  // Rough estimation: 1 token ≈ 4 characters for English text
  const CHARS_PER_TOKEN = 4;

  let totalChars = 0;

  // Count request body size
  if (request.body && typeof request.body === 'object') {
    totalChars += JSON.stringify(request.body).length;
  }

  // Count response size
  if (responseData && typeof responseData === 'object') {
    totalChars += JSON.stringify(responseData).length;
  }

  return Math.ceil(totalChars / CHARS_PER_TOKEN);
}

// Middleware to track request file operations
function trackFileOperations(req, res, next) {
  // Store original filesystem methods to track file operations
  const originalWriteFile = fs.writeFile;
  const originalUnlink = fs.unlink;

  // Track file writes
  req.trackFileWrite = async (filePath, data, options) => {
    const result = await originalWriteFile(filePath, data, options);
    statusDashboardManager.trackFileChange(filePath, 'modified');
    return result;
  };

  // Track file deletions
  req.trackFileDelete = async (filePath) => {
    const result = await originalUnlink(filePath);
    statusDashboardManager.trackFileChange(filePath, 'deleted');
    return result;
  };

  next();
}

// Middleware to add status dashboard context to requests
function addStatusContext(req, res, next) {
  req.statusDashboard = {
    addAlert: (alert) => statusDashboardManager.addAlert(alert),
    addBlocker: (blocker) => statusDashboardManager.addBlocker(blocker),
    trackFile: (filePath, operation) => statusDashboardManager.trackFileChange(filePath, operation),
    trackTokens: (input, output, provider) => statusDashboardManager.trackTokenUsage(input, output, provider)
  };

  next();
}

// Health check middleware to automatically detect issues
function healthCheckMiddleware(req, res, next) {
  // Check for long-running requests (>5 seconds)
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;

    if (duration > 5000) {
      statusDashboardManager.addAlert({
        type: 'performance',
        level: 'warning',
        message: `Slow API response detected: ${req.method} ${req.url}`,
        details: `Request took ${(duration / 1000).toFixed(1)}s to complete`
      });
    }

    // Check for error responses
    if (res.statusCode >= 500) {
      statusDashboardManager.addAlert({
        type: 'error',
        level: 'critical',
        message: `Server error on ${req.method} ${req.url}`,
        details: `HTTP ${res.statusCode} response`
      });
    } else if (res.statusCode >= 400) {
      statusDashboardManager.addAlert({
        type: 'client-error',
        level: 'warning',
        message: `Client error on ${req.method} ${req.url}`,
        details: `HTTP ${res.statusCode} response`
      });
    }
  });

  next();
}

// Initialize status tracking when module is loaded
function initializeStatusTracking() {
  initializeFileWatcher();

  // Set up periodic health checks
  setInterval(async () => {
    try {
      const health = await statusDashboardManager.getProjectHealth();

      // Auto-generate alerts for critical health issues
      if (health.score < 40) {
        statusDashboardManager.addAlert({
          type: 'health',
          level: 'critical',
          message: `Project health critical (${health.score}/100)`,
          details: health.summary
        });
      } else if (health.score < 60) {
        statusDashboardManager.addAlert({
          type: 'health',
          level: 'warning',
          message: `Project health declining (${health.score}/100)`,
          details: health.summary
        });
      }
    } catch (error) {
      console.warn('Health check failed:', error.message);
    }
  }, 60000); // Check every minute

  console.log('📊 Status dashboard tracking initialized');
}

// Cleanup function
function cleanup() {
  stopFileWatcher();
}

// Handle process termination
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

module.exports = {
  initializeStatusTracking,
  initializeFileWatcher,
  stopFileWatcher,
  trackTokenUsage,
  trackFileOperations,
  addStatusContext,
  healthCheckMiddleware,
  cleanup
};