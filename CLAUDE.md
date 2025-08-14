# CLAUDE.md

*バージョン: v1.0.0*
*最終更新: 2025年08月14日 15:30 JST*

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development Tasks
```bash
# Initialize project and install agents
npm run init

# Install/manage Claude Code agents
npm run install-agents        # Install all agents
npm run list-agents          # List available agents
npm run uninstall-agents     # Remove installed agents

# Development workflow
npm run lint                 # ESLint with security plugins
npm run security-audit       # Security vulnerability scan
npm run validate-config      # Validate configuration files
npm run pre-commit          # Combined pre-commit checks

# Testing and system validation
npm run test                # Node.js native tests
claude-code smart-review --test  # System integration test
```

### Agent Management
The system requires 5 specific Claude Code agents located in `agents/`:
- `security-error-xss-analyzer.md` - Security vulnerability detection
- `super-debugger-perfectionist.md` - Bug detection and performance analysis
- `deep-code-reviewer.md` - Code quality and architecture review
- `project-documentation-updater.md` - Documentation consistency
- `code-comment-annotator-ja.md` - Japanese comment annotation

## Architecture Overview

### Core System Components

**Smart Review v2.0** implements a multi-agent orchestration pattern with these key architectural elements:

1. **Entry Points**: Three main executables
   - `smart-review-v2.js` - Interactive menu system and primary interface
   - `init-smart-review.js` - Project initialization and setup
   - `install-agents.js` - Agent lifecycle management

2. **Configuration System** (`smart-review-config.js`)
   - Centralized configuration management through `SmartReviewConfig` class
   - Hierarchical config loading: env vars → project → home directory → defaults
   - Agent configuration with validation and security settings

3. **Security Architecture** (SecurityUtils class in smart-review-v2.js)
   - Command injection prevention using `execFile` instead of `exec`
   - Path traversal protection with `validatePath()` method
   - Input sanitization for file paths, environment variables, and error messages
   - HTML escaping for output safety

4. **Agent Orchestration Pattern**
   ```javascript
   // Agent execution flow
   for (const agent of sortedAgents) {
     const result = await AgentSandbox.execute(agent, context);
     allIssues.push(...result.issues);
   }
   ```

5. **Execution Context Management**
   - Persistent context throughout review lifecycle
   - Dual-mode operation: `changes` (Git diff) vs `all` (full scan)
   - Iterative improvement with auto-fix capabilities

### Key Classes and Their Responsibilities

- **`SecurityUtils`**: Core security utilities including path validation, command sanitization, and HTML escaping
- **`AgentSandbox`**: Isolated execution environment for Claude Code agents
- **`InputValidator`**: Input validation framework with configurable rules
- **`ParallelExecutor`**: Manages concurrent agent execution with priority-based scheduling
- **`ResultCache`**: SHA-256 based caching system with TTL for performance optimization
- **`StructuredLogger`**: Security-aware logging with automatic PII sanitization

### Data Flow Pattern

```
Git Changes/Full Scan → Agent Orchestration → Issue Collection → 
Priority Filtering → Auto-fix Iterations → Report Generation
```

### Interactive Menu System

The system provides a sophisticated interactive interface through `showInteractiveMenu()`:
- Quick review options (changes, full scan, security audit)
- Custom configuration builder with step-by-step guidance
- Real-time validation and help system

## Configuration Management

### Configuration Hierarchy
1. Environment variable `SMART_REVIEW_CONFIG`
2. Project `.smart-review.json`
3. User home `~/.claude/smart-review.json`
4. User config `~/.config/smart-review.json`
5. Built-in defaults

### Security Configuration
The system implements defense-in-depth with configurable security policies:
- Path traversal prevention
- Command injection protection
- Output sanitization
- Agent execution sandboxing
- File size limits and timeout controls

### Agent Configuration
Agents are configured with priority levels, execution timeouts, and capability flags:
```javascript
{
  "agents": [{
    "id": "security-error-xss-analyzer",
    "priority": "critical",
    "timeout": 120000,
    "canAutoFix": true
  }]
}
```

## Development Patterns

### Security-First Development
- All file operations use validated paths through `SecurityUtils.validatePath()`
- External command execution exclusively through `SecurityUtils.executeCommand()`
- User input sanitization before processing
- Error messages sanitized to prevent information leakage

### Agent Integration
When adding new agents, follow the established pattern:
1. Place agent definition in `agents/` directory
2. Update configuration in `smart-review-config.js`
3. Implement agent-specific issue parsing logic
4. Add auto-fix capability if applicable

### Error Handling Strategy
The system uses structured error handling with security-aware sanitization:
- Sensitive path information masked in error messages
- Structured logging for security audit trails
- Graceful degradation when agents are unavailable

## Testing Strategy

### System Testing
The `--test` flag provides comprehensive system validation:
- Agent availability verification
- Configuration validation
- File system permissions check
- Security policy enforcement testing

### Manual Testing
Key test scenarios:
- Interactive menu navigation
- Agent installation/removal cycles
- Configuration validation across different environments
- Security boundary testing (path traversal, command injection)

## Security Considerations

This codebase implements enterprise-grade security measures:
- **Input Validation**: All user inputs validated against configurable policies
- **Path Security**: Comprehensive path traversal prevention
- **Command Security**: No shell interpolation, parameterized command execution
- **Agent Isolation**: Sandboxed execution environment for Claude Code agents
- **Audit Logging**: Security events logged for compliance and monitoring

When modifying security-related code, always:
1. Test against the security test suite
2. Validate input sanitization
3. Check path traversal prevention
4. Verify command injection protection
5. Update security documentation if needed

## Documentation Update Requirements

When updating any documentation in this repository (including this CLAUDE.md file):

### Version and Timestamp Management
- **MANDATORY**: Update version information using semantic versioning
- **MANDATORY**: Include Japanese Tokyo time (JST) timestamps in format: "最終更新: YYYY年MM月DD日 HH:mm JST"
- Place version and timestamp at BOTH beginning and end of documents
- Document header format:
  ```markdown
  *バージョン: vX.Y.Z*
  *最終更新: YYYY年MM月DD日 HH:mm JST*
  ```
- Document footer format:
  ```markdown
  ---
  
  *最終更新: YYYY年MM月DD日 HH:mm JST*
  *バージョン: vX.Y.Z*
  
  **更新履歴:**
  - vX.Y.Z (YYYY年MM月DD日): [Brief description of changes]
  ```

### Version Increment Rules
- Major changes (architectural updates): increment major version (1.0.0 → 2.0.0)
- Minor updates (new sections/features): increment minor version (1.0.0 → 1.1.0)
- Documentation fixes/clarifications: increment patch version (1.0.0 → 1.0.1)

---

*最終更新: 2025年08月14日 15:30 JST*
*バージョン: v1.0.0*

**更新履歴:**
- v1.0.0 (2025年08月14日): 初期バージョン作成、バージョン管理とタイムスタンプ要件を追加