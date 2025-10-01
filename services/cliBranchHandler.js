const path = require('path');
const fs = require('fs');
const util = require('util');

const execAsyncDefault = util.promisify(require('child_process').exec);

const { deriveBranchName, slugify, isValidBranchName, VALID_BRANCH_PREFIXES } = require('./branchNaming');

function createCliBranchHandler({
  rootDir,
  workspaceRoot = path.join(rootDir, '.opnix', 'workspaces'),
  execAsync = execAsyncDefault,
  fsImpl = fs.promises,
  logger = console,
  approvalGatesManager = null
} = {}) {
  if (!rootDir) {
    throw new Error('cliBranchHandler requires rootDir');
  }

  const manifestPath = path.join(workspaceRoot, 'manifest.json');

  async function pathExists(targetPath) {
    try {
      await fsImpl.access(targetPath);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  async function readManifest() {
    if (!(await pathExists(manifestPath))) {
      return { generatedAt: null, workspaces: [] };
    }

    const raw = await fsImpl.readFile(manifestPath, 'utf8');
    try {
      const parsed = JSON.parse(raw);
      const workspaces = Array.isArray(parsed.workspaces) ? parsed.workspaces : [];
      return {
        generatedAt: parsed.generatedAt || null,
        workspaces
      };
    } catch (error) {
      if (typeof logger?.warn === 'function') {
        logger.warn(`cliBranchHandler: failed to parse manifest: ${error.message}`);
      }
      return { generatedAt: null, workspaces: [] };
    }
  }

  async function writeManifest(manifest, { removeBranchName } = {}) {
    const payload = {
      generatedAt: new Date().toISOString(),
      workspaces: Array.isArray(manifest.workspaces) ? manifest.workspaces : []
    };

    if (removeBranchName) {
      payload.workspaces = payload.workspaces.filter(entry => entry.branchName !== removeBranchName);
    }

    await fsImpl.mkdir(path.dirname(manifestPath), { recursive: true });
    await fsImpl.writeFile(manifestPath, JSON.stringify(payload, null, 2), 'utf8');
    return payload;
  }

  async function ensureGitRepository() {
    try {
      await execAsync('git rev-parse --is-inside-work-tree', { cwd: rootDir });
      return true;
    } catch (error) {
      return false;
    }
  }

  async function getCurrentBranch() {
    try {
      const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: rootDir });
      return stdout.trim();
    } catch (error) {
      return null;
    }
  }

  async function branchExists(branchName) {
    try {
      await execAsync(`git rev-parse --verify ${branchName}`, { cwd: rootDir });
      return true;
    } catch (error) {
      return false;
    }
  }

  async function inferBaseBranch() {
    const candidates = ['main', 'master', 'develop'];
    for (const candidate of candidates) {
      if (await branchExists(candidate)) {
        return candidate;
      }
      try {
        await execAsync(`git rev-parse --verify origin/${candidate}`, { cwd: rootDir });
        return candidate;
      } catch (error) {
        continue;
      }
    }
    return 'main';
  }

  async function checkoutBranch(branchName) {
    const { stdout } = await execAsync(`git checkout ${branchName}`, { cwd: rootDir });
    return stdout;
  }

  async function createBranch(branchName, baseBranch) {
    await execAsync(`git checkout ${baseBranch}`, { cwd: rootDir });
    try {
      await execAsync(`git pull --ff-only origin ${baseBranch}`, { cwd: rootDir });
    } catch (error) {
      if (!/could not read from remote repository/i.test(error.stderr || '') && !/No configured push destination/i.test(error.stderr || '')) {
        if (typeof logger?.warn === 'function') {
          logger.warn(`cliBranchHandler: pull ${baseBranch} failed: ${error.message}`);
        }
      }
    }
    const { stdout } = await execAsync(`git checkout -b ${branchName} ${baseBranch}`, { cwd: rootDir });
    return stdout;
  }

  function parseBranchCommand(command) {
    const tokens = command.trim().split(/\s+/);
    const result = {
      query: null,
      base: null,
      title: null,
      list: false,
      cleanup: false,
      force: false,
      help: false
    };

    // Drop the command itself
    tokens.shift();

    const extraTitleParts = [];

    while (tokens.length) {
      const token = tokens.shift();
      if (!token) continue;

      switch (token) {
        case '--help':
        case '-h':
          result.help = true;
          continue;
        case '--list':
          result.list = true;
          continue;
        case '--cleanup':
          result.cleanup = true;
          continue;
        case '--force':
        case '-f':
          result.force = true;
          continue;
        case '--base':
          result.base = tokens.shift() || null;
          continue;
        case '--title':
          result.title = tokens.shift() || null;
          continue;
        default:
          if (!result.query) {
            result.query = token;
          } else {
            extraTitleParts.push(token);
          }
      }
    }

    if (!result.title && extraTitleParts.length) {
      result.title = extraTitleParts.join(' ');
    }

    return result;
  }

  function normalise(value) {
    return value ? String(value).trim().toLowerCase() : '';
  }

  function findWorkspace(manifest, query) {
    if (!query) return null;
    const target = normalise(query);
    if (!target) return null;

    const matches = manifest.workspaces.filter(entry => {
      const byTicket = entry.ticketId !== undefined && normalise(entry.ticketId) === target;
      const byBranch = entry.branchName && normalise(entry.branchName) === target;
      const byPath = entry.relativePath && normalise(entry.relativePath) === target;
      const byTitle = entry.title && normalise(slugify(entry.title)) === normalise(slugify(target));
      return byTicket || byBranch || byPath || byTitle;
    });

    if (matches.length === 1) {
      return matches[0];
    }

    return matches.length ? matches : null;
  }

  function buildHelp() {
    return [
      'Usage: /branch <ticketId|branchName> [--title "Custom title"] [--base main] [--cleanup] [--force] [--list]',
      '',
      'Examples:',
      '  /branch 101                # create or switch using workspace manifest for ticket 101',
      '  /branch feature/101-dark-mode  # switch to existing branch',
      '  /branch 102 --title "Improve API resilience"',
      '  /branch --list             # list available workspaces',
      '  /branch 101 --cleanup      # delete branch and remove workspace entry'
    ];
  }

  function formatWorkspaceLine(entry) {
    const id = entry.ticketId ? `ticket ${entry.ticketId}` : 'unassigned';
    const label = entry.title ? entry.title : entry.branchName;
    const pathRel = entry.relativePath ? entry.relativePath : path.relative(rootDir, entry.workspacePath || '');
    const branch = entry.branchName || 'unknown';
    const status = entry.branchStatus || 'pending';
    return `${id} → ${branch} (${label}) [${pathRel}] status=${status}`;
  }

  async function listWorkspaces(manifest) {
    if (!manifest.workspaces.length) {
      return ['No workspaces recorded. Run /spec to generate plan tasks first.'];
    }
    return manifest.workspaces
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .map(formatWorkspaceLine);
  }

  async function ensureBranchGate() {
    if (!approvalGatesManager || typeof approvalGatesManager.checkTool !== 'function') {
      return { passed: true, missing: [] };
    }
    try {
      const status = await approvalGatesManager.checkTool('git-branch-create');
      return status;
    } catch (error) {
      logger?.warn?.(`cliBranchHandler: gate evaluation failed: ${error.message}`);
      return { passed: true, missing: [] };
    }
  }

  function buildGateMessages(missing = []) {
    if (!missing.length) {
      return [];
    }
    const lines = ['Approval gate(s) pending before branch creation:'];
    missing.forEach(entry => {
      const detail = entry.description ? `${entry.label} — ${entry.description}` : entry.label;
      lines.push(`• ${detail}`);
    });
    if (missing.some(entry => entry.id === 'pre-implementation-discussion')) {
      lines.push('Capture discussion outcomes via /api/pre-implementation-discussions before approving this gate.');
    }
    lines.push('Use POST /api/approvals/<gateId>/approve to record review sign-off.');
    return lines;
  }

  async function handleCreateOrSwitch({
    manifest,
    workspaceEntry,
    query,
    title,
    base,
    cleanup,
    force
  }) {
    if (!(await ensureGitRepository())) {
      return {
        result: 'Git repository not detected',
        error: 'Not a git repository',
        messages: ['Initialise git before running /branch.']
      };
    }

    const existingBranch = workspaceEntry && workspaceEntry.branchName ? workspaceEntry.branchName : null;
    const derivedBranch = existingBranch
      || deriveBranchName({
        id: query,
        title: title || (Array.isArray(workspaceEntry?.title) ? workspaceEntry.title.join(' ') : workspaceEntry?.title),
        type: 'feature'
      });

    const targetBranch = derivedBranch;
    const baseBranch = base || await inferBaseBranch();
    const currentBranch = await getCurrentBranch();

    if (cleanup) {
      const messages = [];
      const branchPresent = await branchExists(targetBranch);
      if (branchPresent) {
        if (currentBranch === targetBranch) {
          await execAsync(`git checkout ${baseBranch}`, { cwd: rootDir });
        }
        const deleteFlag = force ? '-D' : '-d';
        await execAsync(`git branch ${deleteFlag} ${targetBranch}`, { cwd: rootDir });
        messages.push(`Deleted branch ${targetBranch}.`);
      } else {
        messages.push(`Branch ${targetBranch} not found locally.`);
      }

      if (workspaceEntry && workspaceEntry.workspacePath) {
        await fsImpl.rm(workspaceEntry.workspacePath, { recursive: true, force: true });
        messages.push(`Removed workspace directory ${path.relative(rootDir, workspaceEntry.workspacePath)}.`);
      }

      const updatedManifest = await writeManifest(manifest, { removeBranchName: targetBranch });
      return {
        result: `Cleanup ${targetBranch}`,
        cleanup: true,
        branchName: targetBranch,
        messages,
        manifest: updatedManifest
      };
    }

    const gateStatus = await ensureBranchGate();
    if (!gateStatus.passed) {
        return {
            result: 'Approval gate required',
            error: 'approval-gate',
            messages: buildGateMessages(gateStatus.missing)
        };
    }

    const messages = [];
    const branchAlreadyExists = await branchExists(targetBranch);

    if (!isValidBranchName(targetBranch)) {
      const prefixes = VALID_BRANCH_PREFIXES.join(', ');
      return {
        result: 'Invalid branch naming',
        error: 'invalid-branch-name',
        messages: [
          `Branch "${targetBranch}" does not match the required pattern <type>/<id>-<slug>. Allowed prefixes: ${prefixes}.`
        ]
      };
    }
    let created = false;

    try {
      if (branchAlreadyExists) {
        await checkoutBranch(targetBranch);
        messages.push(`Checked out existing branch ${targetBranch}.`);
      } else {
        await createBranch(targetBranch, baseBranch);
        created = true;
        messages.push(`Created branch ${targetBranch} from ${baseBranch}.`);
      }
    } catch (error) {
      if (currentBranch && (await branchExists(currentBranch))) {
        try {
          await checkoutBranch(currentBranch);
        } catch (checkoutError) {
          if (typeof logger?.warn === 'function') {
            logger.warn(`cliBranchHandler: rollback checkout failed: ${checkoutError.message}`);
          }
        }
      }
      return {
        result: 'Branch operation failed',
        error: error.message,
        messages: [`Failed to prepare branch ${targetBranch}: ${error.message}`]
      };
    }

    const workspaceMessages = [];
    let entry = workspaceEntry;
    if (!entry) {
      entry = {
        branchName: targetBranch,
        ticketId: query || null,
        title: title || null,
        workspacePath: path.join(workspaceRoot, targetBranch.replace(/\//g, path.sep)),
        relativePath: path.relative(rootDir, path.join(workspaceRoot, targetBranch.replace(/\//g, path.sep))),
        branchScript: null,
        planTasks: null,
        planArtifact: null,
        createdAt: new Date().toISOString()
      };
      manifest.workspaces.push(entry);
    }

    entry.branchStatus = created ? 'created' : 'active';
    entry.branchCreatedAt = entry.branchCreatedAt || (created ? new Date().toISOString() : null);
    entry.lastCheckoutAt = new Date().toISOString();

    if (entry.workspacePath) {
      workspaceMessages.push(`Workspace: ${path.relative(rootDir, entry.workspacePath)}`);
    }
    if (entry.branchScript) {
      workspaceMessages.push(`Helper script: ${entry.branchScript}`);
    }

    await writeManifest(manifest);

    return {
      result: created ? `Branch ${targetBranch} created` : `Branch ${targetBranch} ready`,
      branchName: targetBranch,
      previousBranch: currentBranch,
      created,
      messages: [...messages, ...workspaceMessages]
    };
  }

  async function handleCommand(rawCommand) {
    const parsed = parseBranchCommand(rawCommand);
    if (parsed.help) {
      return {
        result: 'Branch help',
        messages: buildHelp()
      };
    }

    const manifest = await readManifest();

    if (parsed.list) {
      const messages = await listWorkspaces(manifest);
      return {
        result: 'Workspace listing',
        messages,
        workspaces: manifest.workspaces
      };
    }

    if (!parsed.query && !parsed.cleanup) {
      return {
        result: 'Branch usage',
        error: 'Branch target required',
        messages: ['Provide a ticket ID or branch name. Use /branch --help for usage.']
      };
    }

    const workspaceResult = findWorkspace(manifest, parsed.query);
    if (Array.isArray(workspaceResult)) {
      return {
        result: 'Multiple workspace matches',
        error: 'Ambiguous workspace selection',
        matches: workspaceResult,
        messages: [
          'Multiple workspaces match that identifier:',
          ...workspaceResult.map(formatWorkspaceLine),
          'Use a more specific identifier (branch name, ticket ID, or workspace path).'
        ]
      };
    }

    const workspaceEntry = workspaceResult || null;

    if (!workspaceEntry && !parsed.title && !parsed.cleanup) {
      return {
        result: 'Workspace not found',
        error: 'No matching workspace',
        messages: [
          `No workspace entry found for "${parsed.query}". Provide --title to derive a branch name or run /spec to generate tasks.`
        ]
      };
    }

    return handleCreateOrSwitch({
      manifest,
      workspaceEntry,
      query: parsed.query,
      title: parsed.title,
      base: parsed.base,
      cleanup: parsed.cleanup,
      force: parsed.force
    });
  }

  return {
    handleCommand
  };
}

module.exports = {
  createCliBranchHandler
};
