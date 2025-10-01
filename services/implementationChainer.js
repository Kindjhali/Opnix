const path = require('path');
const fs = require('fs');

const { deriveBranchName, slugify, isValidBranchName } = require('./branchNaming');

function createImplementationChainer({
  rootDir,
  workspaceRoot,
  fsImpl = fs.promises,
  logger = console,
  approvalGatesManager = null
} = {}) {
  if (!rootDir) {
    throw new Error('implementationChainer requires rootDir');
  }

  const resolvedWorkspaceRoot = workspaceRoot || path.join(rootDir, '.opnix', 'workspaces');
  const manifestPath = path.join(resolvedWorkspaceRoot, 'manifest.json');
  const nativeFs = fs.promises;

  async function ensureDirectory(dirPath) {
    try {
      await fsImpl.access(dirPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fsImpl.mkdir(dirPath, { recursive: true });
      } else {
        throw error;
      }
    }
  }

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
    try {
      const raw = await fsImpl.readFile(manifestPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return { generatedAt: null, workspaces: [] };
      }
      const workspaces = Array.isArray(parsed.workspaces) ? parsed.workspaces : [];
      return { generatedAt: parsed.generatedAt || null, workspaces };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { generatedAt: null, workspaces: [] };
      }
      throw error;
    }
  }

  async function writeManifest(manifest) {
    const payload = {
      generatedAt: new Date().toISOString(),
      workspaces: manifest.workspaces || []
    };
    await fsImpl.writeFile(manifestPath, JSON.stringify(payload, null, 2), 'utf8');
  }

  function branchToWorkspacePath(branchName) {
    return branchName.replace(/\//g, path.sep);
  }

  function buildWorkspaceReadme({
    ticketId,
    title,
    branchName,
    workspaceRelativePath,
    planArtifactRelativePath,
    planArtifactWorkspaceRelative,
    planTasksRelativePath,
    sessionId,
    branchScriptRelative
  }) {
    const lines = [];

    lines.push(`# Workspace: ${title || 'Task'}`, '');
    lines.push('- **Ticket ID**: ' + (ticketId ?? 'N/A'));
    lines.push('- **Recommended Branch**: `' + branchName + '`');
    lines.push('- **Workspace Directory**: `' + workspaceRelativePath + '`');
    if (sessionId) {
      lines.push('- **Origin Session**: ' + sessionId);
    }
    if (planArtifactRelativePath) {
      const displayPath = planArtifactWorkspaceRelative || planArtifactRelativePath;
      lines.push('- **Plan Artifact**: `' + displayPath + '`');
    }
    if (planTasksRelativePath) {
      lines.push('- **Task Queue**: `' + planTasksRelativePath + '`');
    }
    if (branchScriptRelative) {
      lines.push('- **Branch Helper**: `' + branchScriptRelative + '`');
    }

    lines.push('', '## Next Steps');
    lines.push('1. Review `task.json` for context and acceptance notes.');
    lines.push('2. Run `/branch ' + (ticketId ?? branchName) + '` in the CLI (or execute `create-branch.sh`) to create the working branch.');
    lines.push('3. Apply changes inside the workspace directory and commit against the recommended branch.');
    lines.push('4. Reference the plan artifact and task queue files before implementation.');
    lines.push('', '_Workspaces are tracked in `.opnix/workspaces/manifest.json`._');

    return lines.join('\n');
  }

  function buildDevNotes({ task, branchName, planArtifactWorkspaceRelative, planTasksWorkspaceRelative }) {
    const lines = [];
    lines.push('# Development Notes', '');
    lines.push('- Branch: `' + branchName + '`');
    if (task.ticketId != null) {
      lines.push('- Ticket: ' + task.ticketId);
    }
    if (task.priority) {
      lines.push('- Priority: ' + task.priority);
    }
    if (Array.isArray(task.modules) && task.modules.length) {
      lines.push('- Modules: ' + task.modules.join(', '));
    }
    if (planArtifactWorkspaceRelative) {
      lines.push('- Plan Artifact: ' + planArtifactWorkspaceRelative);
    }
    if (planTasksWorkspaceRelative) {
      lines.push('- Plan Tasks: ' + planTasksWorkspaceRelative);
    }

    lines.push('', '## Summary');
    if (task.description) {
      lines.push(task.description.trim(), '');
    } else {
      lines.push('No detailed description captured in the plan chain. Review linked plan artifacts.', '');
    }

    lines.push('## Key Considerations');
    lines.push('- Confirm dependencies with module owners if new integrations are introduced.');
    lines.push('- Align implementation with Opnix CLI generated plan notes.');
    lines.push('- Keep workspace manifest metadata in sync after significant changes.');

    if (Array.isArray(task.followUps) && task.followUps.length) {
      lines.push('', '## Follow-up Items');
      task.followUps.forEach(item => {
        lines.push('- ' + item);
      });
    }

    return lines.join('\n');
  }

  function buildAcceptanceChecklist(task) {
    const lines = [];
    lines.push('# Acceptance Checklist', '');
    const criteria = Array.isArray(task.acceptanceCriteria) ? task.acceptanceCriteria.filter(Boolean) : [];
    if (criteria.length) {
      criteria.forEach(item => {
        lines.push('- [ ] ' + item);
      });
    } else {
      lines.push('- [ ] Confirm success criteria with stakeholders (no acceptance criteria captured).');
    }

    lines.push('', '## Definition of Done');
    lines.push('- [ ] Tests cover the updated behaviour.');
    lines.push('- [ ] Documentation updated (README, runbook entries, or API docs).');
    lines.push('- [ ] Status dashboard reflects branch progress.');

    return lines.join('\n');
  }

  function buildWorkspaceTodo(task) {
    const items = [];
    if (Array.isArray(task.modules) && task.modules.length) {
      items.push('Audit impacted modules: ' + task.modules.join(', '));
    }
    items.push('Review plan tasks JSON for generated subtasks.');
    items.push('Update `.opnix/workspaces/manifest.json` after major milestones.');
    items.push('Record branch progress via `/branch` or task logger.');
    if (Array.isArray(task.followUps) && task.followUps.length) {
      task.followUps.forEach(item => items.push('Follow-up: ' + item));
    }

    const lines = ['# Workspace TODOs', ''];
    items.forEach(entry => {
      lines.push('- [ ] ' + entry);
    });
    return lines.join('\n');
  }

  function buildRollbackBlueprint({ workspaceRelativePath, branchName }) {
    return {
      version: 1,
      createdAt: new Date().toISOString(),
      steps: [
        {
          action: 'delete-branch',
          branch: branchName,
          description: 'Delete the feature branch if git checkout or creation fails downstream.'
        },
        {
          action: 'remove-workspace',
          path: workspaceRelativePath,
          description: 'Remove workspace directory to revert partial scaffolding.'
        },
        {
          action: 'prune-manifest-entry',
          branch: branchName,
          description: 'Prune workspace entry from manifest to avoid stale references.'
        }
      ]
    };
  }

  async function copyFileIfExists(sourcePath, targetPath) {
    try {
      const data = await nativeFs.readFile(sourcePath);
      await fsImpl.writeFile(targetPath, data);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false;
      }
      if (typeof logger?.warn === 'function') {
        logger.warn(`implementationChainer: failed to copy ${sourcePath} -> ${targetPath}: ${error.message}`);
      }
      return false;
    }
  }

  async function createBranchScript(workspaceDir, branchName, { fsImplInstance = fsImpl } = {}) {
    const scriptPath = path.join(workspaceDir, 'create-branch.sh');
    const lines = [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      '',
      'BRANCH="' + branchName + '"',
      'BASE_BRANCH="' + 'main' + '"',
      '',
      'if git rev-parse --abbrev-ref HEAD >/dev/null 2>&1; then',
      '  echo "Checking out ${BRANCH} from ${BASE_BRANCH}"',
      '  git checkout "$BASE_BRANCH"',
      '  git pull --ff-only origin "$BASE_BRANCH" || true',
      '  git checkout -b "$BRANCH"',
      'else',
      '  echo "Git repository not detected. Please create the branch manually."',
      '  exit 1',
      'fi',
      ''
    ].join('\n');

    await fsImplInstance.writeFile(scriptPath, lines, { mode: 0o755 });
    if (typeof fsImplInstance.chmod === 'function') {
      try {
        await fsImplInstance.chmod(scriptPath, 0o755);
      } catch (error) {
        if (typeof logger?.warn === 'function') {
          logger.warn(`implementationChainer: unable to chmod ${scriptPath}: ${error.message}`);
        }
      }
    }
    return scriptPath;
  }

  async function ensureGates() {
    if (!approvalGatesManager || typeof approvalGatesManager.requireToolAccess !== 'function') {
      return;
    }
    try {
      await approvalGatesManager.requireToolAccess('implementation-chain');
    } catch (error) {
      const message = error && error.message ? error.message : 'Approval gate check failed';
      throw new Error(`Implementation gated: ${message}`);
    }
  }

  async function chainTasksToImplementation({
    tasks = [],
    sessionId = null,
    planArtifactRelativePath = null,
    planTasksScaffold = null
  } = {}) {
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return { workspaces: [], manifestPath: path.relative(rootDir, manifestPath) };
    }

    await ensureGates();

    await ensureDirectory(resolvedWorkspaceRoot);

    const manifest = await readManifest();
    const cleanupTargets = [];
    const createdWorkspaces = [];
    const newEntries = [];

    try {
      for (const task of tasks) {
        const branchNameBase = deriveBranchName({
          id: task.ticketId ?? task.id ?? slugify(task.title),
          title: task.title,
          type: 'feature'
        });
        let suffix = 1;
        let candidateBranch = branchNameBase;

        if (!isValidBranchName(candidateBranch)) {
          throw new Error(`Derived branch name "${candidateBranch}" is invalid. Ensure tickets include numeric identifiers.`);
        }
        let workspaceDir = path.join(resolvedWorkspaceRoot, branchToWorkspacePath(candidateBranch));
        while (await pathExists(workspaceDir)) {
          suffix += 1;
          candidateBranch = `${branchNameBase}-${suffix - 1}`;
          workspaceDir = path.join(resolvedWorkspaceRoot, branchToWorkspacePath(candidateBranch));
        }
        if (!isValidBranchName(candidateBranch)) {
          throw new Error(`Derived branch name "${candidateBranch}" is invalid after suffixing. Verify ticket metadata.`);
        }

        await fsImpl.mkdir(workspaceDir, { recursive: true });
        cleanupTargets.push(workspaceDir);

        const workspaceRelativePath = path.relative(rootDir, workspaceDir);
        const now = new Date().toISOString();

        const taskPayload = {
          ...task,
          branchName: candidateBranch,
          workspace: workspaceRelativePath,
          createdAt: now,
          sessionId,
          planArtifact: planArtifactRelativePath,
          planTasks: planTasksScaffold
        };
        const taskFilePath = path.join(workspaceDir, 'task.json');
        await fsImpl.writeFile(taskFilePath, JSON.stringify(taskPayload, null, 2), 'utf8');
        const taskFileRelativePath = path.relative(rootDir, taskFilePath);

        let planTasksWorkspaceRelative = null;
        if (planTasksScaffold) {
          const planTasksAbsolute = path.isAbsolute(planTasksScaffold)
            ? planTasksScaffold
            : path.join(rootDir, planTasksScaffold);
          if (await copyFileIfExists(planTasksAbsolute, path.join(workspaceDir, 'plan-tasks.json'))) {
            planTasksWorkspaceRelative = path.join(workspaceRelativePath, 'plan-tasks.json');
          }
        }

        let planArtifactWorkspaceRelative = null;
        if (planArtifactRelativePath) {
          const planArtifactAbsolute = path.isAbsolute(planArtifactRelativePath)
            ? planArtifactRelativePath
            : path.join(rootDir, planArtifactRelativePath);
          const artifactTarget = path.join(workspaceDir, path.basename(planArtifactAbsolute));
          if (await copyFileIfExists(planArtifactAbsolute, artifactTarget)) {
            planArtifactWorkspaceRelative = path.relative(rootDir, artifactTarget);
          }
        }

        const branchScriptPath = await createBranchScript(workspaceDir, candidateBranch);
        const branchScriptRelative = path.relative(rootDir, branchScriptPath);

        const readmeContent = buildWorkspaceReadme({
          ticketId: task.ticketId ?? task.id ?? null,
          title: task.title,
          branchName: candidateBranch,
          workspaceRelativePath,
          planArtifactRelativePath,
          planArtifactWorkspaceRelative,
          planTasksRelativePath: planTasksWorkspaceRelative,
          sessionId,
          branchScriptRelative
        });
        await fsImpl.writeFile(path.join(workspaceDir, 'README.md'), readmeContent, 'utf8');

        const devNotesPath = path.join(workspaceDir, 'DEV_NOTES.md');
        await fsImpl.writeFile(
          devNotesPath,
          buildDevNotes({
            task,
            branchName: candidateBranch,
            planArtifactWorkspaceRelative,
            planTasksWorkspaceRelative
          }),
          'utf8'
        );
        const devNotesRelative = path.relative(rootDir, devNotesPath);

        const acceptancePath = path.join(workspaceDir, 'ACCEPTANCE.md');
        await fsImpl.writeFile(acceptancePath, buildAcceptanceChecklist(task), 'utf8');
        const acceptanceRelative = path.relative(rootDir, acceptancePath);

        const todoPath = path.join(workspaceDir, 'TODO.md');
        await fsImpl.writeFile(todoPath, buildWorkspaceTodo(task), 'utf8');
        const todoRelative = path.relative(rootDir, todoPath);

        const rollbackBlueprint = buildRollbackBlueprint({
          workspaceRelativePath,
          branchName: candidateBranch
        });
        const rollbackPath = path.join(workspaceDir, 'rollback.json');
        await fsImpl.writeFile(rollbackPath, JSON.stringify(rollbackBlueprint, null, 2), 'utf8');
        const rollbackRelative = path.relative(rootDir, rollbackPath);

        const manifestEntry = {
          branchName: candidateBranch,
          ticketId: task.ticketId ?? task.id ?? null,
          title: task.title || null,
          workspacePath: workspaceDir,
          relativePath: workspaceRelativePath,
          taskFile: taskFileRelativePath,
          branchScript: branchScriptRelative,
          planTasks: planTasksWorkspaceRelative,
          planArtifact: planArtifactWorkspaceRelative,
          scaffoldFiles: [
            path.join(workspaceRelativePath, 'README.md'),
            taskFileRelativePath,
            devNotesRelative,
            acceptanceRelative,
            todoRelative,
            rollbackRelative
          ].concat(planTasksWorkspaceRelative ? [planTasksWorkspaceRelative] : [])
            .concat(planArtifactWorkspaceRelative ? [planArtifactWorkspaceRelative] : []),
          branchStatus: 'pending',
          branchCreatedAt: null,
          lastCheckoutAt: null,
          rollbackPlan: rollbackBlueprint,
          sessionId,
          createdAt: now
        };

        newEntries.push(manifestEntry);
        createdWorkspaces.push({
          ...manifestEntry,
          rollbackPath: rollbackRelative
        });
      }

      const existingByPath = new Map(manifest.workspaces.map(entry => [entry.workspacePath, entry]));
      newEntries.forEach(entry => {
        existingByPath.set(entry.workspacePath, entry);
      });
      manifest.workspaces = Array.from(existingByPath.values())
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      await writeManifest(manifest);

      return {
        workspaces: createdWorkspaces,
        manifestPath: path.relative(rootDir, manifestPath)
      };
    } catch (error) {
      if (typeof logger?.error === 'function') {
        logger.error('implementationChainer: failed to create workspaces', error);
      }
      await Promise.allSettled(cleanupTargets.reverse().map(async target => {
        try {
          await fsImpl.rm(target, { recursive: true, force: true });
          const parentDir = path.dirname(target);
          if (parentDir.startsWith(resolvedWorkspaceRoot) && parentDir !== resolvedWorkspaceRoot) {
            try {
              const contents = await fsImpl.readdir(parentDir);
              if (!contents.length) {
                await fsImpl.rmdir(parentDir);
              }
            } catch (parentError) {
              if (parentError.code !== 'ENOENT' && parentError.code !== 'ENOTEMPTY') {
                if (typeof logger?.warn === 'function') {
                  logger.warn(`implementationChainer: parent cleanup warning for ${parentDir}: ${parentError.message}`);
                }
              }
            }
          }
        } catch (cleanupError) {
          if (typeof logger?.warn === 'function') {
            logger.warn(`implementationChainer: cleanup failed for ${target}: ${cleanupError.message}`);
          }
        }
      }));
      throw error;
    }
  }

  return {
    chainTasksToImplementation
  };
}

module.exports = {
  createImplementationChainer
};
