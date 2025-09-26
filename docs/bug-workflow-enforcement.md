# Bug Workflow Enforcement Strategies

## Overview

This document explores various approaches to enforce a structured bug workflow:
1. Open ticket → 2. Mark as in progress → 3. Fix issue → 4a. If fixed: mark complete + summary + commit OR 4b. If not complete: summarize + leave in progress

## Approach 1: CLI Command Integration

### Implementation
- Add workflow commands to the CLI interface
- Commands like `opnix bug start <ticket-id>`, `opnix bug complete <ticket-id>`, `opnix bug pause <ticket-id>`
- Integrate with existing ticket management system

### Pros
- Natural integration with existing CLI
- Can enforce sequential steps
- Easy to track state transitions

### Cons
- Requires developer discipline to use commands
- Manual enforcement only

### Example Commands
```bash
opnix bug open "Fix authentication timeout" --priority high
opnix bug start BUG-123
opnix bug complete BUG-123 --summary "Fixed timeout by increasing session duration"
opnix bug pause BUG-123 --reason "Waiting for API documentation"
```

## Approach 2: Git Hooks Integration

### Implementation
- Pre-commit hooks that check for bug workflow compliance
- Prevent commits unless bug ticket is properly tracked
- Auto-generate commit messages with bug references

### Pros
- Automatic enforcement at commit time
- Integrates with existing git workflow
- Hard to bypass accidentally

### Cons
- Can be circumvented with `--no-verify`
- May slow down quick fixes
- Requires careful configuration

### Example Hook Logic
```bash
# pre-commit hook
if [[ $COMMIT_MSG =~ BUG-[0-9]+ ]]; then
  # Check if bug is marked as in-progress
  # Validate bug status before allowing commit
fi
```

## Approach 3: Interactive Workflow Prompts

### Implementation
- Prompt-based system that guides developers through workflow
- Integrates with terminal/IDE
- Provides contextual help and validation

### Pros
- User-friendly and educational
- Can adapt to different scenarios
- Reduces chance of missed steps

### Cons
- Can interrupt flow state
- May become repetitive for experienced users
- Requires good UX design

### Example Flow
```
? What type of work are you starting?
  > Bug fix
    Feature development
    Refactoring

? Enter bug description: Authentication timeout after 5 minutes
✓ Created ticket BUG-124
? Ready to start working? (Y/n) Y
✓ Marked BUG-124 as in-progress
[Developer works on fix]
? Have you completed the bug fix? (Y/n) Y
? Enter completion summary: Fixed by increasing session timeout to 30 minutes
✓ Bug marked as complete
? Ready to commit changes? (Y/n) Y
✓ Changes committed with reference to BUG-124
```

## Approach 4: State File Tracking

### Implementation
- Maintain workflow state in JSON/YAML files
- Track current bug status, timestamps, developer assignments
- Integrate with existing data structures

### Pros
- Persistent state tracking
- Easy to query and report on
- Can integrate with existing data files

### Cons
- Risk of state file corruption
- Merge conflicts in team environments
- Manual state management

### Example State Structure
```json
{
  "bugs": {
    "BUG-123": {
      "title": "Authentication timeout",
      "status": "in-progress",
      "assignee": "developer-name",
      "started": "2025-09-26T10:00:00Z",
      "description": "Users experiencing timeout after 5 minutes",
      "commits": [],
      "summary": null
    }
  }
}
```

## Approach 5: Automated Detection & Validation

### Implementation
- Scan commit messages and code changes for bug patterns
- Automatically detect when bugs are being worked on
- Validate that proper workflow is followed

### Pros
- Minimal developer overhead
- Can work retroactively
- Smart detection capabilities

### Cons
- Complex to implement reliably
- May miss context or intent
- False positives/negatives

### Detection Patterns
- Commit messages with "fix", "bug", "issue" keywords
- Changes to error handling code
- Test files being modified for specific scenarios

## Approach 6: Integration with External Tools

### Implementation
- Integrate with GitHub Issues, Jira, Linear, etc.
- Sync workflow state with external ticketing systems
- Leverage existing project management tools

### Pros
- Uses established tools
- Team visibility and collaboration
- Rich reporting and analytics

### Cons
- Dependency on external services
- API rate limits and reliability
- May not fit local-first workflow

## Approach 7: Hybrid Enforcement System

### Implementation
Combine multiple approaches:
- CLI commands for primary workflow
- Git hooks for safety net
- State tracking for persistence
- Automated detection for validation

### Pros
- Multiple layers of enforcement
- Flexibility for different scenarios
- Gradual adoption possible

### Cons
- Complex to implement and maintain
- Potential for conflicting enforcement
- Higher learning curve

## Recommended Implementation Strategy

### Phase 1: Basic CLI Integration
1. Add bug workflow commands to existing CLI
2. Simple state tracking in JSON files
3. Basic validation and prompts

### Phase 2: Git Integration
1. Add pre-commit hooks for validation
2. Auto-generate compliant commit messages
3. Integrate with branch naming conventions

### Phase 3: Advanced Features
1. Automated detection and suggestions
2. Reporting and analytics
3. Integration with external tools

### Configuration Options
```json
{
  "bugWorkflow": {
    "enforceStrictMode": true,
    "requireSummaryMinLength": 10,
    "autoCommit": false,
    "gitHooksEnabled": true,
    "ticketPrefix": "BUG-",
    "statePath": "./data/bug-workflow-state.json"
  }
}
```

## Implementation Considerations

### User Experience
- Minimize interruption to developer flow
- Provide clear feedback and guidance
- Allow escape hatches for exceptional cases

### Data Management
- Consistent state management
- Backup and recovery strategies
- Migration paths for workflow changes

### Team Coordination
- Shared state visibility
- Conflict resolution strategies
- Handoff procedures

### Integration Points
- Existing CLI commands
- Current ticket/data structures
- Git workflow and conventions
- Development environment setup

## Success Metrics

- Bug resolution time tracking
- Workflow compliance rates
- Developer satisfaction scores
- Reduced context switching
- Improved bug documentation quality

## Next Steps

1. Review and validate approach with development team
2. Prototype basic CLI commands
3. Test with sample bug scenarios
4. Iterate based on user feedback
5. Implement gradual rollout strategy