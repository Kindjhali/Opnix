# Opnix Development TODO

## ⚠️ DEVELOPMENT RULES - STRICTLY ENFORCED

**FORBIDDEN:**
- ❌ NO placeholders or mock data
- ❌ NO empty functions or half-implementations
- ❌ NO console.log fake functionality
- ❌ NO "TODO" comments in code
- ❌ NO partial implementations

**REQUIRED:**
- ✅ ONLY real, working, and valid code
- ✅ Complete functional implementations
- ✅ Actual file system operations
- ✅ Real API integrations
- ✅ Full end-to-end functionality

**IF YOU CANNOT COMPLETE A FEATURE FULLY:**
- Stop and document what needs to be completed by the next agent
- Do not commit broken or half-working code
- Provide clear handoff instructions

## DOCUMENTATION UPKEEP

- [x] Refresh docs/spec.md with current mission context

## VISUAL ENABLEMENT SPRINT

- [x] Draft Mermaid + Storybook scope (see docs/visual-enablement-scope.md)
- [ ] Implement Mermaid diagram engine per scope
- [ ] Stand up Storybook integration and CI scripts
- [ ] Automate Storybook story generation from detector exports + interview questionnaire

## CRITICAL FIXES REQUIRED

### 1. RETAIN: Backward Compatibility
- [ ] Keep old tickets.json system working
- [ ] Ensure user can drop in existing tickets.json files
- [ ] Test with real tickets.json data
- [ ] Document migration path if needed

### 2. MODULE DETECTION SYSTEM
- [ ] **DOCUMENT**: How system detects modules
  - Scans package.json for dependencies
  - Checks directory structure (src/, lib/, components/, etc.)
  - Reads import/require statements
  - Identifies framework patterns (React, Vue, etc.)
- [ ] **IMPLEMENT**: Real module detection algorithm
- [ ] **TEST**: Module detection on actual projects

### 3. CANVAS LINKING SYSTEM
- [ ] **DOCUMENT**: How canvas creates links between modules
  - Dependency relationships from package.json
  - Import/export relationships in code
  - File structure relationships
  - Visual representation rules
- [ ] **IMPLEMENT**: Canvas dependency visualization
- [ ] **IMPLEMENT**: Interactive node linking
- [ ] **IMPLEMENT**: Drag-and-drop dependency creation

### 4. FRONTEND-BACKEND INTEGRATION
- [ ] Fix API calls instead of localStorage fallbacks
- [ ] Connect agent system to real /agents folder
- [ ] Connect module detection to backend scanning
- [ ] Fix file operations to use server filesystem

### 5. INSTALLER SYSTEM
- [x] Add interactive setup decision tree (`scripts/setupWizard.js`)
- [x] Ship neon installer CLI (`npm run setup:install`)
- [ ] Update install.sh to create complete Opnix system
- [ ] Include all necessary files and directories
- [ ] Test fresh installation process

### 6. DOCUMENT QUESTIONS SYSTEM
- [ ] Implement truly progressive questioning
- [ ] Questions adapt based on previous answers
- [ ] Pattern detection (API → endpoints, etc.)
- [ ] GitHub spec-kit format export

### 7. FILE OPERATIONS
- [ ] Canvas export writes to server /exports directory
- [ ] Spec generation creates real files
- [ ] All exports accessible via API endpoints

### 8. VALIDATION TESTS
- [ ] Complete user flow: install → detect modules → create canvas → export
- [ ] Drop in old tickets.json and verify works
- [ ] Test all API endpoints return real data
- [ ] Verify file system operations work

## ARCHITECTURE DOCUMENTATION NEEDED

### Module Detection Flow
```
1. User clicks "Detect Modules"
2. Backend scans project directory
3. Reads package.json dependencies
4. Scans src/ directories for imports
5. Creates module objects with dependencies
6. Returns to frontend for canvas display
```

### Canvas Linking Flow
```
1. Frontend receives module data from backend
2. Creates Cytoscape nodes for each module
3. Creates edges based on dependency relationships
4. Applies health-based coloring
5. Enables interactive editing of links
```

### File Export Flow
```
1. User clicks export
2. Frontend sends data to backend API
3. Backend writes real files to /exports directory
4. Returns file path/download link
5. User can access exported files
```

## CURRENT SYSTEM STATE
- ❌ Frontend uses localStorage instead of APIs
- ❌ Agent system is hardcoded not reading /agents folder
- ❌ Module detection exists but not properly integrated
- ❌ Canvas creates fake data not real project structure
- ❌ Document questions are static not progressive
- ❌ File operations download to browser not server
- ❌ Installer creates wrong/old system

### 9. ROADMAP GENERATOR SYSTEM
- [ ] **RESEARCH**: Web investigation of roadmap visualization tools
  - Gantt chart libraries (D3.js gantt, Frappe Gantt, etc.)
  - Timeline visualization components
  - Project management visual patterns
  - Integration with Mermaid for roadmaps
- [ ] **DESIGN**: Roadmap visual requirements
  - Project timeline tracker on same canvas as modules
  - Integration with existing Cytoscape canvas
  - Milestone tracking and dependencies
  - Progress visualization
- [ ] **IMPLEMENT**: Roadmap generator
  - Can be part of docs system or Mermaid integration
  - Visual timeline on canvas alongside modules
  - Export roadmap as separate view or overlay
- [ ] **INTEGRATE**: Roadmap with existing systems
  - Link roadmap milestones to modules
  - Connect tickets/features to timeline
  - Progress tracking based on module health

### Roadmap Visualization Flow
```
1. User generates project roadmap from specs/features
2. System creates timeline visualization
3. Roadmap displays on same canvas as modules
4. Milestones linked to specific modules/features
5. Progress tracked and visualized
6. Export roadmap as Gantt/timeline format
```

## SUCCESS CRITERIA
1. User can drop in tickets.json and system works
2. Module detection scans real project structure
3. Canvas shows actual dependency relationships
4. All file operations write to server filesystem
5. Fresh install via install.sh works completely
6. Progressive questioning works properly
7. Complete user flow works end-to-end
8. Roadmap generator creates visual project timelines on canvas
