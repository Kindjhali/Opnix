# AGENTS.md - Multi-Agent Coordination Guidelines

## Project Context

**Project**: opnix
**Mode**: new project setup
**Architecture**: Frontend-focused application
**Modules**: 15 detected
**Generated**: 2025-09-28T11:02:07.380Z

## Agent Roles & Responsibilities

### Primary Development Agent
- **Focus**: Core feature implementation and bug fixes
- **Scope**: Module development, API endpoints, frontend components
- **Tools**: Full access to codebase, Opnix management interface

### Documentation Agent
- **Focus**: Documentation maintenance and generation
- **Scope**: README updates, API docs, architectural documentation
- **Tools**: Docs tab, markdown generation, template system

### Testing Agent
- **Focus**: Test coverage and quality assurance
- **Scope**: Unit tests, integration tests, end-to-end validation
- **Tools**: Test runners, coverage tools, validation scripts

### Architecture Agent
- **Focus**: System design and module coordination
- **Scope**: Module relationships, dependency management, scaffolding
- **Tools**: Canvas visualization, module detector, dependency analysis

## Coordination Protocols

### Handoff Requirements
1. **Clear State Documentation**: Document current implementation status
2. **Dependency Mapping**: Note which modules/files are affected
3. **Test Status**: Report test coverage and any failing tests
4. **Next Steps**: Provide actionable next steps for the receiving agent

### Communication Format
```
Agent: [ROLE]
Status: [COMPLETE|IN_PROGRESS|BLOCKED]
Changes: [List of modified files/modules]
Dependencies: [List of affected systems]
Next: [Specific actions for next agent]
Notes: [Any important context or blockers]
```

## Technology Context

### Stack Overview
- Vue.js
- Express
- Vite

### Code Conventions
- ESLint for code quality
- camelCase naming convention enforced

### Opnix Integration Points
- Module detection and management
- Ticket lifecycle tracking
- Canvas dependency visualization
- Progressive documentation system
- CLI interview workflows

## Quality Gates

### Before Handoff
- [ ] Code follows project conventions
- [ ] Tests pass for modified functionality
- [ ] Documentation updated for changes
- [ ] Opnix state reflects current project status
- [ ] No broken dependencies or circular references

### Implementation Standards
- Real, working code only (no placeholders)
- Complete end-to-end functionality
- Proper error handling
- Integration with existing Opnix systems

## Agent-Specific Notes

### Development Agent
- Use Opnix APIs for state management
- Respect module boundaries and dependencies
- Follow camelCase naming throughout
- Test changes with existing workflows

### Documentation Agent
- Use Docs tab for markdown management
- Generate specs via progressive system
- Maintain consistency with existing docs
- Link documentation to relevant modules

### Testing Agent
- Cover new functionality with appropriate tests
- Validate Opnix integration points
- Test module detection and canvas rendering
- Ensure CLI workflows remain functional

### Architecture Agent
- Use canvas for dependency visualization
- Validate module health and relationships
- Ensure scaffolding remains consistent
- Monitor for architectural debt
