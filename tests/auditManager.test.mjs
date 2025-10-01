import { runInitialAudit } from '../server.js';

(async () => {
  try {
    const result = await runInitialAudit();

    if (!result || typeof result !== 'object') {
      throw new Error('runInitialAudit did not return an object');
    }

    const requiredKeys = ['project', 'ticketStats', 'moduleSummary', 'techStack', 'exports'];
    for (const key of requiredKeys) {
      if (!(key in result)) {
        throw new Error(`runInitialAudit result missing ${key}`);
      }
    }

    if (!Array.isArray(result.exports) || result.exports.length === 0) {
      throw new Error('runInitialAudit returned no exports');
    }

    console.log('✓ runInitialAudit returned expected structure');
  } catch (error) {
    console.error('✗ runInitialAudit smoke test failed:', error);
    process.exit(1);
  }
})();
