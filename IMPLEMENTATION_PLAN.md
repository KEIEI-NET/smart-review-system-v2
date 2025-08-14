# Smart Review - 実装修正計画

## 概要
このドキュメントでは、Smart Reviewシステムの既知の問題に対する修正計画を優先順位付けして記載します。各修正項目には推定工数と実装方針が含まれています。

## 優先度レベル
- **重大 (Critical)**: セキュリティに直接影響する問題 - 即座に対応が必要
- **高 (High)**: セキュリティや安定性に影響する問題 - 早急な対応が必要
- **中 (Medium)**: 機能改善やコード品質向上 - 計画的に対応
- **低 (Low)**: パフォーマンス改善や追加機能 - 余裕があれば対応

---

## 【重大】セキュリティ脆弱性の修正

### 1. コマンドインジェクション脆弱性の修正
**優先度**: 重大  
**推定工数**: 2時間  
**影響範囲**: 172, 196, 245, 669行目

#### 現在の問題
```javascript
// 危険な実装
const gitCommand = `git diff --name-only --since="${lastCheckTime.toISOString()}"`;
const result = execSync(gitCommand);
```

#### 修正方針
```javascript
// セキュアな実装
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

async function executeGitCommand(args) {
  try {
    const { stdout } = await execFileAsync('git', args, {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30000
    });
    return stdout;
  } catch (error) {
    throw new Error(`Git command failed: ${error.message}`);
  }
}

// 使用例
const result = await executeGitCommand([
  'diff', 
  '--name-only', 
  '--since', 
  lastCheckTime.toISOString()
]);
```

### 2. パストラバーサル脆弱性の修正
**優先度**: 重大  
**推定工数**: 1.5時間  
**影響範囲**: 22-24, 559, 687行目

#### 現在の問題
```javascript
// 危険な実装
const target = args.target;  // ../../../etc/passwd の可能性
```

#### 修正方針
```javascript
// セキュアな実装
function validatePath(userPath, baseDir = process.cwd()) {
  const resolved = path.resolve(baseDir, userPath);
  const normalizedBase = path.resolve(baseDir);
  
  if (!resolved.startsWith(normalizedBase)) {
    throw new Error(`不正なパス: パストラバーサルが検出されました`);
  }
  
  // 追加の検証
  if (resolved.includes('..') || resolved.includes('~')) {
    throw new Error(`不正なパス: 相対パス参照が含まれています`);
  }
  
  return resolved;
}

// 実装箇所での使用
const validatedTarget = validatePath(args.target);
const validatedOutputDir = validatePath(args['output-dir']);
```

---

## 【高】セキュリティ関連の改善

### 3. 任意ファイル書き込み脆弱性の修正
**優先度**: 高  
**推定工数**: 1時間  
**影響範囲**: 559, 687行目

#### 修正方針
```javascript
// 出力ディレクトリの制限
const ALLOWED_OUTPUT_BASE = './smart-review-results';

function validateOutputDirectory(outputDir) {
  const resolved = path.resolve(outputDir);
  const allowedBase = path.resolve(ALLOWED_OUTPUT_BASE);
  
  // 許可されたディレクトリ内であることを確認
  if (!resolved.startsWith(allowedBase)) {
    // 許可されたディレクトリ内にフォールバック
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return path.join(allowedBase, `output-${timestamp}`);
  }
  
  return resolved;
}
```

### 4. 情報漏洩対策
**優先度**: 高  
**推定工数**: 1時間  
**影響範囲**: エラーハンドリング全体

#### 修正方針
```javascript
class SecuritySanitizer {
  static sanitizeError(error) {
    let message = error.message;
    
    // パスの匿名化
    message = message.replace(/\/home\/[^\/]+/g, '/home/<user>');
    message = message.replace(/C:\\Users\\[^\\]+/g, 'C:\\Users\\<user>');
    message = message.replace(/\/Users\/[^\/]+/g, '/Users/<user>');
    
    // 機密情報のマスキング
    message = message.replace(/api[_-]?key[:\s]*['"]?[\w\-]+/gi, 'API_KEY_REDACTED');
    message = message.replace(/password[:\s]*['"]?[\w\-]+/gi, 'PASSWORD_REDACTED');
    message = message.replace(/token[:\s]*['"]?[\w\-]+/gi, 'TOKEN_REDACTED');
    
    return {
      message,
      code: error.code || 'UNKNOWN_ERROR',
      timestamp: new Date().toISOString()
    };
  }
}
```

---

## 【中】コード品質改善

### 5. 入力検証ユーティリティの実装
**優先度**: 中  
**推定工数**: 2時間

#### 実装内容
```javascript
class InputValidator {
  static validateString(input, options = {}) {
    const { 
      maxLength = 1000, 
      pattern = null, 
      allowEmpty = false 
    } = options;
    
    if (!allowEmpty && !input) {
      throw new Error('入力が空です');
    }
    
    if (input.length > maxLength) {
      throw new Error(`入力が最大長を超えています: ${maxLength}`);
    }
    
    if (pattern && !pattern.test(input)) {
      throw new Error('入力が無効な形式です');
    }
    
    return input;
  }
  
  static validateNumber(input, options = {}) {
    const { min = 0, max = Infinity } = options;
    const num = Number(input);
    
    if (isNaN(num)) {
      throw new Error('有効な数値ではありません');
    }
    
    if (num < min || num > max) {
      throw new Error(`数値が範囲外です: ${min}-${max}`);
    }
    
    return num;
  }
  
  static validateChoice(input, choices) {
    if (!choices.includes(input)) {
      throw new Error(`無効な選択: ${input}. 有効な選択肢: ${choices.join(', ')}`);
    }
    return input;
  }
}
```

### 6. セキュアコマンド実行関数の実装
**優先度**: 中  
**推定工数**: 1.5時間

#### 実装内容
```javascript
class SecureExecutor {
  static async execute(command, args = [], options = {}) {
    const {
      timeout = 60000,
      maxBuffer = 10 * 1024 * 1024,
      cwd = process.cwd(),
      env = process.env
    } = options;
    
    // コマンドのホワイトリスト
    const allowedCommands = ['git', 'npm', 'node', 'npx'];
    if (!allowedCommands.includes(command)) {
      throw new Error(`許可されていないコマンド: ${command}`);
    }
    
    // 引数のサニタイズ
    const sanitizedArgs = args.map(arg => 
      String(arg).replace(/[;&|`$]/g, '')
    );
    
    const { execFile } = require('child_process');
    const { promisify } = require('util');
    const execFileAsync = promisify(execFile);
    
    try {
      const result = await execFileAsync(command, sanitizedArgs, {
        timeout,
        maxBuffer,
        cwd: validatePath(cwd),
        env: this.sanitizeEnv(env),
        shell: false  // シェル解釈を無効化
      });
      
      return result;
    } catch (error) {
      throw SecuritySanitizer.sanitizeError(error);
    }
  }
  
  static sanitizeEnv(env) {
    const sanitized = { ...env };
    // 機密環境変数を削除
    delete sanitized.AWS_SECRET_ACCESS_KEY;
    delete sanitized.DATABASE_PASSWORD;
    delete sanitized.API_KEY;
    return sanitized;
  }
}
```

### 7. エージェント実行のサンドボックス化
**優先度**: 中  
**推定工数**: 3時間

#### 実装内容
```javascript
class AgentSandbox {
  constructor(agent) {
    this.agent = agent;
    this.timeout = 120000; // 2分
    this.maxMemory = 512 * 1024 * 1024; // 512MB
  }
  
  async execute(files, context) {
    // 実行環境の準備
    const sandbox = {
      files: this.createReadOnlyFileSystem(files),
      output: this.createSafeOutput(context.output),
      terminal: this.createRestrictedTerminal()
    };
    
    // タイムアウト設定
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('エージェント実行タイムアウト')), this.timeout);
    });
    
    try {
      // エージェント実行とタイムアウトの競合
      const result = await Promise.race([
        this.runAgent(sandbox),
        timeoutPromise
      ]);
      
      return this.sanitizeResult(result);
    } catch (error) {
      return {
        success: false,
        error: SecuritySanitizer.sanitizeError(error)
      };
    }
  }
  
  createReadOnlyFileSystem(files) {
    // 読み取り専用のファイルシステムAPI
    return {
      read: async (path) => {
        const validPath = validatePath(path);
        if (!files.includes(validPath)) {
          throw new Error('アクセス拒否');
        }
        return await fs.promises.readFile(validPath, 'utf8');
      },
      exists: async (path) => {
        const validPath = validatePath(path);
        return files.includes(validPath);
      },
      // writeは提供しない
    };
  }
  
  createRestrictedTerminal() {
    // 制限されたコマンド実行
    return {
      run: async (command) => {
        // エージェント専用のコマンドのみ許可
        const allowedCommands = this.agent.allowedCommands || [];
        const [cmd, ...args] = command.split(' ');
        
        if (!allowedCommands.includes(cmd)) {
          throw new Error(`許可されていないコマンド: ${cmd}`);
        }
        
        return await SecureExecutor.execute(cmd, args);
      }
    };
  }
}
```

---

## 【低】パフォーマンス改善

### 8. 並列処理の実装
**優先度**: 低  
**推定工数**: 2時間

#### 実装内容
```javascript
class ParallelAgentExecutor {
  async executeAll(agents, files, context) {
    // エージェントを依存関係でグループ化
    const groups = this.groupByDependency(agents);
    const results = [];
    
    for (const group of groups) {
      // 同一グループ内のエージェントを並列実行
      const groupResults = await Promise.all(
        group.map(agent => this.executeWithErrorHandling(agent, files, context))
      );
      results.push(...groupResults);
    }
    
    return results;
  }
  
  groupByDependency(agents) {
    // 簡易的な実装: 優先度でグループ化
    const groups = {
      critical: [],
      high: [],
      medium: [],
      low: []
    };
    
    agents.forEach(agent => {
      groups[agent.priority].push(agent);
    });
    
    return Object.values(groups).filter(g => g.length > 0);
  }
  
  async executeWithErrorHandling(agent, files, context) {
    try {
      const sandbox = new AgentSandbox(agent);
      return await sandbox.execute(files, context);
    } catch (error) {
      return {
        agentId: agent.id,
        success: false,
        error: error.message
      };
    }
  }
}
```

### 9. キャッシング機能の実装
**優先度**: 低  
**推定工数**: 2時間

#### 実装内容
```javascript
class ResultCache {
  constructor() {
    this.cache = new Map();
    this.ttl = 15 * 60 * 1000; // 15分
    this.maxSize = 100; // 最大100エントリ
  }
  
  generateKey(agent, files) {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    hash.update(agent.id);
    hash.update(files.sort().join(','));
    return hash.digest('hex');
  }
  
  async get(agent, files) {
    const key = this.generateKey(agent, files);
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.result;
  }
  
  set(agent, files, result) {
    const key = this.generateKey(agent, files);
    
    // サイズ制限チェック
    if (this.cache.size >= this.maxSize) {
      // 最も古いエントリを削除
      const oldestKey = this.findOldestEntry();
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(key, {
      result,
      timestamp: Date.now()
    });
  }
  
  findOldestEntry() {
    let oldestKey = null;
    let oldestTime = Infinity;
    
    for (const [key, entry] of this.cache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    
    return oldestKey;
  }
  
  clear() {
    this.cache.clear();
  }
}
```

### 10. 構造化ロギングの実装
**優先度**: 低  
**推定工数**: 1.5時間

#### 実装内容
```javascript
class StructuredLogger {
  constructor(options = {}) {
    this.level = options.level || 'info';
    this.output = options.output || console.log;
    this.context = {};
  }
  
  setContext(context) {
    this.context = { ...this.context, ...context };
  }
  
  log(level, message, metadata = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...metadata
    };
    
    // 開発環境では読みやすい形式
    if (process.env.NODE_ENV === 'development') {
      this.output(`[${logEntry.timestamp}] ${level.toUpperCase()}: ${message}`);
      if (Object.keys(metadata).length > 0) {
        this.output('  Metadata:', metadata);
      }
    } else {
      // 本番環境ではJSON形式
      this.output(JSON.stringify(logEntry));
    }
  }
  
  info(message, metadata) {
    this.log('info', message, metadata);
  }
  
  warn(message, metadata) {
    this.log('warn', message, metadata);
  }
  
  error(message, error, metadata = {}) {
    this.log('error', message, {
      ...metadata,
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code
      }
    });
  }
  
  debug(message, metadata) {
    if (this.level === 'debug') {
      this.log('debug', message, metadata);
    }
  }
}

// グローバルロガーの初期化
const logger = new StructuredLogger({
  level: process.env.LOG_LEVEL || 'info'
});
```

---

## 実装スケジュール

### フェーズ1: 重大なセキュリティ修正（1週目）
- [ ] コマンドインジェクション脆弱性の修正
- [ ] パストラバーサル脆弱性の修正

### フェーズ2: 高優先度の修正（2週目）
- [ ] 任意ファイル書き込み脆弱性の修正
- [ ] 情報漏洩対策の実装

### フェーズ3: コード品質改善（3-4週目）
- [ ] 入力検証ユーティリティの実装
- [ ] セキュアコマンド実行関数の実装
- [ ] エージェント実行のサンドボックス化

### フェーズ4: パフォーマンス改善（5週目以降）
- [ ] 並列処理の実装
- [ ] キャッシング機能の実装
- [ ] 構造化ロギングの実装

---

## テスト計画

### セキュリティテスト
```javascript
describe('Security Tests', () => {
  describe('Path Validation', () => {
    it('should reject path traversal attempts', () => {
      expect(() => validatePath('../../../etc/passwd')).toThrow();
      expect(() => validatePath('/etc/passwd')).toThrow();
      expect(() => validatePath('~/sensitive')).toThrow();
    });
    
    it('should accept valid paths', () => {
      expect(validatePath('./src')).toBeDefined();
      expect(validatePath('src/components')).toBeDefined();
    });
  });
  
  describe('Command Execution', () => {
    it('should reject shell metacharacters', async () => {
      const result = await SecureExecutor.execute('echo', ['test; rm -rf /']);
      expect(result.stdout).not.toContain('rm');
    });
    
    it('should reject unauthorized commands', async () => {
      await expect(SecureExecutor.execute('rm', ['-rf', '/']))
        .rejects.toThrow('許可されていないコマンド');
    });
  });
});
```

### パフォーマンステスト
```javascript
describe('Performance Tests', () => {
  it('should execute agents in parallel', async () => {
    const startTime = Date.now();
    const executor = new ParallelAgentExecutor();
    
    // 5つのエージェント（各1秒かかると仮定）
    const agents = Array(5).fill(null).map((_, i) => ({
      id: `agent-${i}`,
      priority: 'medium'
    }));
    
    await executor.executeAll(agents, [], {});
    const duration = Date.now() - startTime;
    
    // 並列実行なので2秒以内に完了すべき
    expect(duration).toBeLessThan(2000);
  });
  
  it('should use cache for repeated requests', async () => {
    const cache = new ResultCache();
    const agent = { id: 'test-agent' };
    const files = ['file1.js', 'file2.js'];
    
    // 初回実行
    const result1 = { issues: [] };
    cache.set(agent, files, result1);
    
    // キャッシュから取得
    const cached = await cache.get(agent, files);
    expect(cached).toEqual(result1);
  });
});
```

---

## 注意事項

1. **段階的な実装**: セキュリティ修正を最優先とし、段階的に実装を進める
2. **後方互換性**: 既存のAPIインターフェースを維持しながら内部実装を改善
3. **テストカバレッジ**: 各修正に対して包括的なテストを作成
4. **ドキュメント更新**: 実装変更に合わせてドキュメントを更新

---

*最終更新: 2025-08-13*  
*バージョン: 1.0.0*