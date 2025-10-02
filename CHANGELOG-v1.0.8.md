# Changelog - v1.0.8

**Release Date:** 2025-10-02
**Status:** ✅ Production Ready

## Critical Fixes

### 1. Fixed narrative.md ENOENT Error ✅

**Problem:**
```
Error: ENOENT: no such file or directory, open '/path/to/opnix/docs/narrative.md'
```

**Root Cause:**
- `taskLogger.js` hardcoded paths to `docs/narrative.md` and `data/task-logs/` using `__dirname`
- This pointed to the opnix installation directory (`node_modules/opnix/docs/`)
- The `docs/` directory is excluded from npm package via `.npmignore`
- Result: Error on every startup trying to access non-existent file

**Solution:**
- Made TaskLogger accept `rootDir` parameter in constructor
- Changed all hardcoded paths to use instance properties
- Default to `process.cwd()` (project directory, not opnix directory)
- Creates `docs/` and `data/task-logs/` in the USER'S project, not in opnix installation

**Files Modified:**
- `services/taskLogger.js` - Lines 1-59
  - Added `constructor(rootDir = null)`
  - Changed `TASK_LOGS_DIR` constant to `this.taskLogsDir` instance property
  - Changed `NARRATIVE_FILE` constant to `this.narrativeFile` instance property
  - Replaced all 10 references to use instance properties
  - Added `docs/` directory creation in `ensureNarrativeFile()`

**Impact:**
- ✅ NO MORE ERROR on startup
- ✅ Creates narrative.md in project directory where it belongs
- ✅ Works correctly when installed via npm/npx/global

### 2. Added MOLE Theme Colors to ASCII Art ✅

**Problem:**
- ASCII logo displayed in plain white/terminal default color
- Inconsistent with MOLE branding

**Solution:**
- Added ANSI color codes for MOLE theme palette
- Cyan (#06B6D4) for logo
- Pink (#E94560) for "Operational Toolkit"
- Blue (#1FB6FF) for "Visual Canvas"
- Orange (#FF8C3B) for "Audit Engine"

**Files Modified:**
- `bin/opnix.js` - Lines 8-34
  - Added MOLE color constants
  - Wrapped logo in cyan color
  - Color-coded subtitle text

**Impact:**
- ✅ Beautiful colored ASCII art on startup
- ✅ Consistent with MOLE branding
- ✅ Professional appearance

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v1.0.0 | - | Initial npm publication |
| v1.0.1 | - | Fixed postinstall script for global installations |
| v1.0.2 | - | Moved chokidar and node-pty to dependencies |
| v1.0.3 | - | Fixed theme.neon() → theme.logo() |
| v1.0.4 | - | Changed path.join() to path.resolve() |
| v1.0.5 | - | Workaround for Express 5.x sendFile bug |
| v1.0.6 | - | Fixed CSS loading - use Vite-built CSS file |
| v1.0.7 | - | Fixed taskLogger paths (narrative.md error) |
| v1.0.8 | 2025-10-02 | **Added MOLE colors to ASCII art** |

## Testing

### Manual Testing Performed

```bash
# Clean installation test
rm -rf ~/.npm/_npx
mkdir -p /tmp/test-v108
cd /tmp/test-v108
npx opnix@1.0.8
```

**Results:**
- ✅ NO ENOENT errors
- ✅ Colored ASCII art displays correctly
- ✅ Server starts on http://localhost:7337
- ✅ CSS loads properly
- ✅ All routes functional

### Installation Methods Verified

| Method | Status | Notes |
|--------|--------|-------|
| `npx opnix@1.0.8` | ✅ | Recommended for quick usage |
| `npm install -g opnix` | ✅ | Global installation works |
| `pnpm add opnix` | ✅ | Project dependency |

## Breaking Changes

None - this is a bug fix release.

## Upgrade Instructions

Users on v1.0.6 or v1.0.7 should upgrade to v1.0.8 to resolve the narrative.md error:

```bash
# For npx users (recommended)
rm -rf ~/.npm/_npx  # Clear cache
npx opnix@latest

# For global installation
npm install -g opnix@latest

# For project dependency
pnpm update opnix
```

## Known Issues

None - all critical issues resolved.

## Next Release Plans

v1.0.9 (future):
- Additional branding improvements
- Enhanced error messages
- Performance optimizations

---

**Published By:** opnix Team
**npm Registry:** https://registry.npmjs.org/opnix/1.0.8
**Package Size:** 1.9 MB
**Files:** 267
