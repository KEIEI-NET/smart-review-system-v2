# Developer Guide - Smart Review Command

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                    Smart Review Command                   │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Command    │  │   Execution  │  │    Output    │  │
│  │   Parser     │→ │    Engine    │→ │   Generator  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│         ↓                  ↓                  ↓          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Validation  │  │    Agent     │  │     File     │  │
│  │    Layer     │  │  Orchestrator│  │    System    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                           ↓                              │
│                    ┌──────────────┐                     │
│                    │   Agent Pool │                     │
│                    └──────────────┘                     │
│                           ↓                              │
│     ┌────────────────────────────────────────┐         │
│     │ Security │ Bug │ Quality │ Documentation│         │
│     └────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────┘
```

### Core Design Patterns

#### 1. Command Pattern
The main command structure follows the Command pattern for encapsulation:

```javascript
class SmartReviewCommand {
  constructor(context, args) {
    this.context = context;
    this.args = args;
    this.executionContext = this.initializeContext();
  }
  
  async execute() {
    this.validate();
    const result = await this.performReview();
    return this.formatResult(result);
  }
  
  validate() {
    // Input validation logic
  }
  
  async performReview() {
    // Main execution logic
  }
  
  formatResult(result) {
    // Output formatting
  }
}
```

#### 2. Strategy Pattern
Agent execution uses the Strategy pattern for flexibility:

```javascript
class AgentStrategy {
  async execute(target, options) {
    throw new Error('Must implement execute method');
  }
}

class SecurityAgentStrategy extends AgentStrategy {
  async execute(target, options) {
    // Security-specific analysis
  }
}

class BugAgentStrategy extends AgentStrategy {
  async execute(target, options) {
    // Bug detection logic
  }
}
```

#### 3. Observer Pattern
Progress tracking using the Observer pattern:

```javascript
class ProgressObserver {
  constructor() {
    this.listeners = [];
  }
  
  subscribe(listener) {
    this.listeners.push(listener);
  }
  
  notify(event) {
    this.listeners.forEach(listener => listener(event));
  }
}

// Usage
const progress = new ProgressObserver();
progress.subscribe(event => output.info(event.message));
```

## Extension Points

### Adding New Agents

#### Step 1: Define Agent Configuration

Create agent configuration in `agents/config/`:

```javascript
// agents/config/new-agent.json
{
  "id": "custom-analyzer",
  "name": "Custom Code Analyzer",
  "model": "sonnet",
  "category": "custom",
  "errorTypes": ["custom-error-1", "custom-error-2"],
  "canAutoFix": false,
  "priority": "medium",
  "patterns": {
    "error": "CUSTOM_ERROR:\\s*(.+)",
    "warning": "CUSTOM_WARNING:\\s*(.+)"
  }
}
```

#### Step 2: Implement Agent Logic

Create agent implementation:

```javascript
// agents/implementations/custom-analyzer.js
class CustomAnalyzer {
  constructor(config) {
    this.config = config;
  }
  
  async analyze(files, options) {
    const issues = [];
    
    for (const file of files) {
      const content = await this.readFile(file);
      const fileIssues = this.detectIssues(content);
      issues.push(...fileIssues);
    }
    
    return issues;
  }
  
  detectIssues(content) {
    const issues = [];
    
    // Custom detection logic
    if (content.includes('dangerous_pattern')) {
      issues.push({
        type: 'custom-error-1',
        severity: 'high',
        message: 'Dangerous pattern detected',
        line: this.findLineNumber(content, 'dangerous_pattern')
      });
    }
    
    return issues;
  }
  
  findLineNumber(content, pattern) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(pattern)) {
        return i + 1;
      }
    }
    return null;
  }
}

module.exports = CustomAnalyzer;
```

#### Step 3: Register Agent

Add to agent registry:

```javascript
// agents/registry.js
const agents = new Map();

function registerAgent(config, implementation) {
  agents.set(config.id, {
    config,
    implementation
  });
}

// Register custom agent
const CustomAnalyzer = require('./implementations/custom-analyzer');
const customConfig = require('./config/custom-analyzer.json');
registerAgent(customConfig, CustomAnalyzer);
```

### Adding New Output Formats

#### Implement Format Handler

```javascript
// formatters/json-formatter.js
class JsonFormatter {
  format(todoList, context) {
    return JSON.stringify({
      metadata: {
        generated: new Date().toISOString(),
        scope: context.scope,
        target: context.target,
        issueCount: todoList.length
      },
      issues: todoList.map(item => ({
        id: item.id,
        category: item.category,
        priority: item.priority,
        description: item.task,
        location: {
          file: item.file,
          line: item.line
        },
        effort: item.estimatedEffort,
        autoFixable: item.fixable
      }))
    }, null, 2);
  }
}

// formatters/html-formatter.js
class HtmlFormatter {
  format(todoList, context) {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Smart Review Report</title>
  <style>
    .critical { color: red; }
    .high { color: orange; }
    .medium { color: blue; }
    .low { color: gray; }
  </style>
</head>
<body>
  <h1>Smart Review Report</h1>
  <div class="summary">
    <p>Generated: ${new Date().toISOString()}</p>
    <p>Total Issues: ${todoList.length}</p>
  </div>
  <div class="issues">
    ${todoList.map(item => `
      <div class="issue ${item.priority}">
        <h3>${item.task}</h3>
        <p>Priority: ${item.priority}</p>
        <p>Category: ${item.category}</p>
        ${item.file ? `<p>File: ${item.file}:${item.line || 'N/A'}</p>` : ''}
      </div>
    `).join('')}
  </div>
</body>
</html>
    `;
  }
}
```

## Testing Recommendations

### Unit Testing Structure

```javascript
// test/unit/agent-executor.test.js
const assert = require('assert');
const sinon = require('sinon');
const { executeAgent } = require('../lib/agent-executor');

describe('Agent Executor', () => {
  let mockTerminal;
  let mockOutput;
  
  beforeEach(() => {
    mockTerminal = {
      run: sinon.stub()
    };
    mockOutput = {
      info: sinon.spy(),
      error: sinon.spy()
    };
  });
  
  describe('executeAgent', () => {
    it('should execute agent and parse results', async () => {
      // Arrange
      const agent = {
        id: 'test-agent',
        name: 'Test Agent',
        model: 'sonnet',
        errorTypes: ['test-error']
      };
      
      mockTerminal.run.resolves({
        stdout: 'ERROR: Test error detected',
        stderr: '',
        exitCode: 0
      });
      
      // Act
      const result = await executeAgent(
        agent,
        ['file1.js'],
        1,
        { terminal: mockTerminal, output: mockOutput }
      );
      
      // Assert
      assert.equal(result.agent, 'Test Agent');
      assert.equal(result.issues.length, 1);
      assert.equal(result.issues[0].description, 'Test error detected');
    });
    
    it('should handle agent execution failure', async () => {
      // Test failure scenarios
    });
  });
});
```

### Integration Testing

```javascript
// test/integration/full-review.test.js
const { createTestEnvironment } = require('./test-helpers');

describe('Full Review Integration', () => {
  let testEnv;
  
  beforeEach(async () => {
    testEnv = await createTestEnvironment();
  });
  
  afterEach(async () => {
    await testEnv.cleanup();
  });
  
  it('should complete full project review', async () => {
    // Create test files
    await testEnv.createFile('src/vulnerable.js', `
      function unsafe(userInput) {
        eval(userInput); // Security issue
      }
    `);
    
    // Run review
    const result = await testEnv.runSmartReview({
      scope: 'all',
      target: testEnv.projectDir
    });
    
    // Verify results
    assert(result.success);
    assert(result.context.todoList.some(item => 
      item.category === 'security' &&
      item.description.includes('eval')
    ));
  });
});
```

### Performance Testing

```javascript
// test/performance/benchmark.js
const { performance } = require('perf_hooks');

async function benchmarkReview(fileCount) {
  const start = performance.now();
  
  // Generate test files
  const files = generateTestFiles(fileCount);
  
  // Run review
  await runSmartReview({
    scope: 'all',
    target: './benchmark-test'
  });
  
  const duration = performance.now() - start;
  
  console.log(`Review of ${fileCount} files: ${duration}ms`);
  console.log(`Average per file: ${duration / fileCount}ms`);
  
  return duration;
}

// Run benchmarks
(async () => {
  const results = [];
  for (const count of [10, 50, 100, 500]) {
    results.push(await benchmarkReview(count));
  }
  
  // Verify linear scaling
  const scalingFactor = results[3] / results[0];
  assert(scalingFactor < 60, 'Performance does not scale linearly');
})();
```

## Contribution Guidelines

### Code Style

#### JavaScript Standards
- Use ES6+ features appropriately
- Async/await over callbacks
- Const over let, never var
- Descriptive variable names

```javascript
// Good
const analyzedFiles = await analyzeProjectFiles(projectPath);

// Bad
var x = analyzeProjectFiles(p).then(r => r);
```

#### Error Handling
Always use proper error handling:

```javascript
// Good
try {
  const result = await riskyOperation();
  return processResult(result);
} catch (error) {
  logger.error('Operation failed', { error, context });
  throw new OperationError('Failed to complete operation', { cause: error });
}

// Bad
const result = await riskyOperation(); // No error handling
```

#### Comments and Documentation
Use JSDoc for all public functions:

```javascript
/**
 * Executes an agent analysis on specified files
 * @param {Object} agent - Agent configuration object
 * @param {string[]} targetFiles - Array of file paths to analyze
 * @param {number} iteration - Current iteration number
 * @returns {Promise<AgentResult>} Analysis results
 * @throws {AgentExecutionError} If agent fails to execute
 */
async function executeAgent(agent, targetFiles, iteration) {
  // Implementation
}
```

### Pull Request Process

#### 1. Pre-submission Checklist
- [ ] Code follows style guidelines
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Security review completed
- [ ] Performance impact assessed

#### 2. PR Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Security patch
- [ ] Performance improvement
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Security Considerations
- [ ] Input validation added
- [ ] No hardcoded secrets
- [ ] Path traversal protected
- [ ] Command injection prevented

## Performance Impact
- [ ] Benchmarks run
- [ ] No regression detected
```

### Development Workflow

#### 1. Setup Development Environment

```bash
# Clone repository
git clone [repository-url]
cd smart-review

# Install dependencies
npm install

# Setup pre-commit hooks
npm run setup-hooks

# Run tests
npm test

# Start development
npm run dev
```

#### 2. Create Feature Branch

```bash
# Create branch from main
git checkout -b feature/your-feature-name

# Make changes
# Add tests
# Update documentation

# Commit with conventional commits
git commit -m "feat: add new analysis capability"
```

#### 3. Submit PR

```bash
# Push branch
git push origin feature/your-feature-name

# Create PR via GitHub/GitLab
# Request review
# Address feedback
```

## Debugging Guide

### Enable Debug Mode

```javascript
// Set environment variable
process.env.DEBUG = 'smart-review:*';

// Or in code
const debug = require('debug')('smart-review:agent');
debug('Executing agent %s', agent.name);
```

### Common Issues

#### 1. Agent Not Found
```javascript
// Debug agent loading
console.log('Available agents:', Array.from(agentRegistry.keys()));
console.log('Requested agent:', agentId);
console.log('Agent path:', path.resolve(agentPath));
```

#### 2. Memory Issues
```javascript
// Monitor memory usage
const used = process.memoryUsage();
console.log('Memory usage:');
console.log(`  RSS: ${Math.round(used.rss / 1024 / 1024)}MB`);
console.log(`  Heap Used: ${Math.round(used.heapUsed / 1024 / 1024)}MB`);
console.log(`  Heap Total: ${Math.round(used.heapTotal / 1024 / 1024)}MB`);
```

#### 3. Performance Profiling
```javascript
// Use built-in profiler
const { performance, PerformanceObserver } = require('perf_hooks');

const obs = new PerformanceObserver((list) => {
  const entries = list.getEntries();
  entries.forEach((entry) => {
    console.log(`${entry.name}: ${entry.duration}ms`);
  });
});
obs.observe({ entryTypes: ['measure'] });

// Measure operations
performance.mark('agent-start');
await executeAgent(agent, files);
performance.mark('agent-end');
performance.measure('agent-execution', 'agent-start', 'agent-end');
```

## API Reference

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for complete API reference.

## Security Guidelines

See [SECURITY_ADVISORY.md](./SECURITY_ADVISORY.md) for security best practices.

## Resources

### Documentation
- [README.md](./README.md) - General overview
- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - API reference
- [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - Migration instructions
- [SECURITY_ADVISORY.md](./SECURITY_ADVISORY.md) - Security information

### External Resources
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [OWASP Security Guidelines](https://owasp.org)
- [JavaScript Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

---

**Document Version**: 1.0.0  
**Last Updated**: 2025-08-13  
**Maintainers**: Development Team