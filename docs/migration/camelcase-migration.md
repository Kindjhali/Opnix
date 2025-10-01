# camelCase Migration Guide

This document outlines the camelCase naming convention migration for the Opnix project. All snake_case identifiers have been migrated to camelCase to maintain consistency across the codebase.

## Overview

As of January 2025, Opnix enforces strict camelCase naming conventions for all JavaScript variables, functions, object properties, and API endpoints. This migration improves code consistency and aligns with JavaScript best practices.

## ESLint Configuration

The project now enforces camelCase through ESLint rules:

```javascript
'camelcase': ['error', {
  'properties': 'always',
  'ignoreDestructuring': false,
  'ignoreImports': false,
  'ignoreGlobals': false,
  'allow': ['__dirname', '__filename', 'child_process', 'process_exit']
}]
```

## Renamed Items

### Functions

| Old Name | New Name | File |
|----------|----------|------|
| `opnix_status_bar()` | `opnixStatusBar()` | scripts/terminalStatusBar.js |
| `claude_with_status()` | `claudeWithStatus()` | scripts/terminalStatusBar.js |
| `codex_with_status()` | `codexWithStatus()` | scripts/terminalStatusBar.js |
| `anthropic_with_status()` | `anthropicWithStatus()` | scripts/terminalStatusBar.js |

### Shell Aliases

The terminal status bar shell functions have been renamed:

```bash
# Old
alias claude='claude_with_status'
alias codex='codex_with_status'
alias anthropic='anthropic_with_status'

# New
alias claude='claudeWithStatus'
alias codex='codexWithStatus'
alias anthropic='anthropicWithStatus'
```

### Diagram Labels

In Mermaid diagrams, the relationship label has been updated:

```javascript
// Old
`${source} ||--o{ ${target} : depends_on`

// New
`${source} ||--o{ ${target} : "depends on"`
```

## API Endpoints

All REST API endpoints use kebab-case conventions (recommended for URLs) and were **not affected** by this migration:

### Core API Routes

- **Health & Status**: `/api/health`, `/api/tickets`, `/api/stats`
- **Modules**: `/api/modules`, `/api/modules/detect`, `/api/modules/graph`, `/api/modules/links`
- **Features**: `/api/features`
- **Specs & Documentation**: `/api/api-spec/generate`, `/api/docs/browse`, `/api/docs/read`
- **Exports**: `/api/export/markdown`, `/api/exports`, `/api/exports/:filename`
- **CLI Integration**: `/api/terminal/history`, `/api/terminal/execute`, `/api/cli/sessions`

### Advanced Features

- **Progressive Analysis**: `/api/progressive/status`, `/api/progressive/initialize`
- **Canvas & Roadmap**: `/api/canvas/export`, `/api/roadmap/generate-from-tickets`
- **Interview System**: `/api/interviews/reload`, `/api/interviews/status`
- **Agent Integration**: `/api/claude/next`, `/api/agents`

All endpoints maintain backward compatibility and follow RESTful conventions.

## Database Fields

No database field names were changed. Fields like `created_at`, `updated_at` remain unchanged as they are part of external data contracts.

## Migration Process

1. **Audit**: Run `pnpm lint:js` to identify all camelCase violations
2. **Fix**: Apply automatic fixes with `pnpm lint:js --fix` where possible
3. **Manual**: Review and fix remaining violations that require manual intervention
4. **Test**: Run the full test suite to ensure no functionality was broken

## CI/CD Integration

The project includes GitHub Actions workflow that enforces camelCase:

- ESLint runs with `--max-warnings 0` to fail on any violations
- Additional grep-based check for common snake_case patterns
- Pre-commit hooks via lint-staged (when configured)

## Exceptions

The following patterns are allowed and excluded from the camelCase rule:

- Node.js built-ins: `__dirname`, `__filename`, `child_process`
- Shell configuration files: `.bash_profile`, `.bashrc`
- Package names: `node_modules`, `ansi_up`
- Database fields: `created_at`, `updated_at`, `user_id`

## Running Lint Checks

To check for naming violations:

```bash
# Check all JavaScript files
pnpm lint:js

# Auto-fix where possible
pnpm lint:js --fix

# Run with zero tolerance (CI mode)
pnpm lint:js --max-warnings 0
```

## Troubleshooting

### Error: Identifier 'snake_case_name' is not in camel case

**Solution**: Rename the identifier to camelCase:
```javascript
// Before
const user_name = 'John';

// After
const userName = 'John';
```

### Error: Object property 'api_key' is not in camel case

**Solution**: Rename the property or add to exceptions if it's an external API:
```javascript
// Before
const config = { api_key: '123' };

// After
const config = { apiKey: '123' };

// Or if it's an external API requirement, destructure and rename:
const { api_key: apiKey } = externalResponse;
```

## Deprecation Timeline

**Phase 1 (Completed)**: ESLint enforcement and pre-commit hooks
- ✅ All snake_case identifiers migrated to camelCase
- ✅ ESLint camelcase rule enabled with zero tolerance
- ✅ Pre-commit hooks configured to prevent violations

**Phase 2**: No breaking changes planned
- API endpoints remain stable (kebab-case)
- Database schema unchanged (snake_case preserved for external compatibility)

## Testing the Migration

You can test camelCase enforcement using curl:

```bash
# Test API endpoints (should work normally)
curl http://localhost:7337/api/health
curl http://localhost:7337/api/modules/detect -X POST

# Test pre-commit hook
echo "const bad_variable = 1;" > test.js
git add test.js
git commit -m "test"  # Should fail with camelcase error
```

## Rollback Instructions

If you need to temporarily disable camelCase enforcement:

```bash
# Disable pre-commit hook
chmod -x .husky/pre-commit

# Or bypass for urgent commits
git commit --no-verify -m "urgent fix"

# Re-enable
chmod +x .husky/pre-commit
```

## Future Considerations

- All new code must follow camelCase conventions
- External API integrations may require mapping between snake_case and camelCase
- Consider using transformation utilities for external data sources

## References

- [ESLint camelcase rule](https://eslint.org/docs/rules/camelcase)
- [JavaScript Naming Conventions](https://www.robinwieruch.de/javascript-naming-conventions/)
- [Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html#naming)