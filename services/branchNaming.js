const DEFAULT_BRANCH_TYPE = 'feature';
const VALID_BRANCH_PREFIXES = ['feature', 'bugfix', 'hotfix', 'refactor', 'docs', 'chore', 'release'];
const PRIMARY_BRANCHES = ['main', 'master', 'develop'];
const BRANCH_REGEX = new RegExp(`^(${VALID_BRANCH_PREFIXES.join('|')})/([a-z0-9-]+)-([a-z0-9-]+)$`);

function slugify(value, { maxLength = 32 } = {}) {
  if (!value) {
    return 'task';
  }

  const slug = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

  if (!slug) {
    return 'task';
  }

  const trimmed = slug.length > maxLength ? slug.slice(0, maxLength) : slug;
  return trimmed.replace(/-+/g, '-').replace(/^-|-$/g, '') || 'task';
}

function deriveBranchName({ id, title, type = DEFAULT_BRANCH_TYPE } = {}) {
  const safeType = String(type || DEFAULT_BRANCH_TYPE).toLowerCase();
  const idPart = id !== undefined && id !== null
    ? String(id).toLowerCase().replace(/[^a-z0-9-]/g, '') || 'task'
    : 'task';
  const slug = slugify(title);

  return `${safeType}/${idPart}-${slug}`.replace(/-+/g, '-');
}

function isValidBranchName(name) {
  if (!name || typeof name !== 'string') {
    return false;
  }
  const trimmed = name.trim();
  if (trimmed === 'HEAD') {
    return true;
  }
  if (PRIMARY_BRANCHES.includes(trimmed)) {
    return true;
  }
  const lower = trimmed.toLowerCase();
  if (lower !== trimmed) {
    return false;
  }

  const match = trimmed.match(BRANCH_REGEX);
  if (!match) {
    return false;
  }

  const ticketId = match[2];
  const slug = match[3];

  if (!/[0-9]/.test(ticketId)) {
    return false;
  }

  if (!slug || /[^a-z0-9-]/.test(slug)) {
    return false;
  }

  return true;
}

module.exports = {
  slugify,
  deriveBranchName,
  isValidBranchName,
  VALID_BRANCH_PREFIXES,
  PRIMARY_BRANCHES
};
