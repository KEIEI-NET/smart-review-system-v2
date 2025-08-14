# Smart Review - アーキテクチャドキュメント

*バージョン: v1.1.0*
*最終更新: 2025年08月14日 16:15 JST*

## システム設計概要

Smart Reviewは、包括的なコード分析のための洗練されたマルチエージェント統合パターンを実装しています。システムは、検出、分析、修正、レポートの各フェーズ間で関心事を分離するモジュラーアーキテクチャを活用しています。

## コアコンポーネント

### 1. 実行コンテキストマネージャー

実行コンテキストは、レビュープロセス全体を通じて完全な状態を維持します：

```javascript
const executionContext = {
  scope: 'changes' | 'all',          // レビューモード
  target: string,                     // ターゲットディレクトリ
  startTime: ISO8601,                 // 実行タイムスタンプ
  changedFiles: string[],             // 検出された変更
  allIssues: Issue[],                 // 収集された問題
  todoList: TodoItem[],               // 生成されたタスク
  iterations: IterationResult[],      // 反復履歴
  finalCommentResult: Object | null,  // コメント結果
  metrics: {
    totalExecutionTime: number,
    filesAnalyzed: number,
    issuesFound: number,
    issuesFixed: number
  }
}
```

### 2. エージェントオーケストレーター

オーケストレーターは複数のAIエージェントのライフサイクルを管理します：

#### エージェント定義構造
```javascript
interface Agent {
  id: string;                 // 一意の識別子
  name: string;               // 表示名
  model: 'sonnet' | 'opus';   // AIモデルタイプ
  path: string;               // システムパス
  role: string;               // 主要な責任
  category: string;           // 問題カテゴリ
  errorTypes: string[];       // 検出可能なエラータイプ
  canAutoFix: boolean;        // 自動修正機能
  priority: Priority;         // デフォルト優先度レベル
}
```

#### エージェント実行フロー

```
[開始] → [エージェント選択] → [順次実行] → [結果収集] → [終了]
           ↓                    ↓              ↓
      優先度順ソート      各エージェント実行   問題の集約
```

### 3. 変更検出システム

#### Gitベースの変更検出

```javascript
async function detectChanges() {
  // 1. 前回のチェックタイムスタンプを取得
  const lastCheckTime = await getLastCheckTime(todoFile);
  
  // 2. Git差分を実行
  const changedFiles = await git.diff('--name-only', '--since', lastCheckTime);
  
  // 3. ファイルをフィルタリング
  return filterValidFiles(changedFiles);
}
```

#### フォールバック戦略

Gitリポジトリが利用できない場合：
1. 警告を表示
2. `scope: 'all'`モードに自動切り替え
3. プロジェクト全体のスキャンを実行

### 4. 問題分析エンジン

#### 問題構造

```typescript
interface Issue {
  level: 'error' | 'warning' | 'info' | 'suggestion';
  type: string;           // エラータイプ識別子
  file?: string;          // 影響を受けるファイル
  line?: number;          // 行番号
  message: string;        // 問題の説明
  suggestion?: string;    // 修正提案
  category: Category;     // 問題カテゴリ
  priority: Priority;     // 優先度レベル
  agentId: string;        // 発見したエージェント
  autoFixAvailable: boolean; // 自動修正可能
}
```

#### 問題解析パターン

システムは複数のパターンを使用して問題を識別します：

```javascript
const patterns = {
  error: /(?:ERROR|エラー|🔴):\s*(.+?)(?:\n|$)/gi,
  warning: /(?:WARNING|警告|🟡):\s*(.+?)(?:\n|$)/gi,
  info: /(?:INFO|情報|🔵):\s*(.+?)(?:\n|$)/gi,
  suggestion: /(?:SUGGESTION|提案|💡):\s*(.+?)(?:\n|$)/gi
};
```

### 5. 反復修正システム（Changesモードのみ）

#### 反復フロー

```
[初期分析] → [問題検出] → [自動修正試行] → [再検証]
    ↑                                          ↓
    └──────────[問題が残っている場合]←──────────┘
```

#### 反復制御ロジック

```javascript
for (let iteration = 1; iteration <= maxIterations; iteration++) {
  // 1. 変更ファイルを再検出
  const currentChangedFiles = await detectChanges();
  
  // 2. エージェントを実行
  const newIssues = await runAgents(currentChangedFiles);
  
  // 3. 修正可能な問題を特定
  const fixableIssues = filterAutoFixable(newIssues);
  
  // 4. 改善がない場合は終了
  if (fixableIssues.length === 0) break;
  
  // 5. 自動修正を適用
  await applyAutoFixes(fixableIssues);
}
```

### 6. TODO生成エンジン

#### TODO生成アルゴリズム

```javascript
function generateTodoList(issues, priorityThreshold) {
  return issues
    .filter(issue => getPriorityValue(issue.priority) <= getPriorityValue(priorityThreshold))
    .reduce((todos, issue) => {
      const existingTodo = todos.find(t => 
        t.type === issue.type && 
        t.priority === issue.priority
      );
      
      if (existingTodo) {
        existingTodo.files.push(issue.file);
        existingTodo.count++;
      } else {
        todos.push(createTodoItem(issue));
      }
      
      return todos;
    }, [])
    .sort((a, b) => getPriorityValue(a.priority) - getPriorityValue(b.priority));
}
```

#### 工数見積もりマトリクス

```javascript
const effortEstimation = {
  critical: {
    security: '2時間',
    bug: '1時間',
    quality: '3時間',
    documentation: '30分'
  },
  high: {
    security: '1時間',
    bug: '30分',
    quality: '2時間',
    documentation: '20分'
  },
  // ... その他の優先度レベル
};
```

### 7. レポート生成システム

#### レポート構造

```
smart-review-results/
├── report-[timestamp].html     # HTMLレポート
├── report-[timestamp].md       # Markdownレポート
├── todo-[timestamp].md         # TODOリスト
├── metrics.json               # メトリクスデータ
└── raw-output/                # 生のエージェント出力
    ├── security-analyzer.txt
    ├── bug-detector.txt
    ├── code-reviewer.txt
    └── doc-updater.txt
```

#### HTMLレポート生成

```javascript
function generateHTMLReport(context) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Smart Review Report</title>
      <style>${getStyles()}</style>
    </head>
    <body>
      ${generateSummarySection(context.metrics)}
      ${generateIssuesSection(context.allIssues)}
      ${generateTodoSection(context.todoList)}
      ${generateIterationsSection(context.iterations)}
      ${generateMetricsCharts(context.metrics)}
    </body>
    </html>
  `;
}
```

## データフローアーキテクチャ

### 全体的なデータフロー

```
[入力引数] → [検証] → [初期化] → [検出] → [分析] → [処理] → [出力]
    ↓          ↓         ↓         ↓        ↓        ↓        ↓
 オプション  スキーマ  コンテキスト  Git/FS  エージェント  修正    レポート
```

### フェーズ別データ変換

#### 1. 初期化フェーズ
```
引数 → 検証済み設定 → 実行コンテキスト
```

#### 2. 検出フェーズ
```
Gitリポジトリ → 差分 → 変更ファイルリスト
TODOファイル → タイムスタンプ → 時間範囲
```

#### 3. 分析フェーズ
```
ファイルリスト → エージェント入力 → 生の出力 → 解析済み問題
```

#### 4. 処理フェーズ
```
問題リスト → フィルタリング → 優先度付け → TODOリスト
```

#### 5. 出力フェーズ
```
実行コンテキスト → レポート生成 → ファイルシステム書き込み
```

## セキュリティアーキテクチャ

### 脅威モデル

#### 1. 入力検証層

```javascript
class InputValidator {
  validatePath(userPath) {
    // パストラバーサル防止
    const resolved = path.resolve(userPath);
    if (!resolved.startsWith(process.cwd())) {
      throw new SecurityError('Path traversal detected');
    }
    return resolved;
  }
  
  validateCommand(command) {
    // コマンドインジェクション防止
    return command.replace(/[;&|`$]/g, '');
  }
}
```

#### 2. エージェント隔離

```javascript
class AgentSandbox {
  async execute(agent, files) {
    // 制限された環境での実行
    const sandbox = {
      timeout: 60000,
      maxBuffer: 10 * 1024 * 1024,
      env: this.getSanitizedEnv()
    };
    
    return await runInSandbox(agent, files, sandbox);
  }
}
```

#### 3. 出力サニタイゼーション

```javascript
class OutputSanitizer {
  sanitize(output) {
    // 機密情報の削除
    return output
      .replace(/api[_-]?key[:\s]*['"]?[\w\-]+/gi, 'API_KEY_REDACTED')
      .replace(/password[:\s]*['"]?[\w\-]+/gi, 'PASSWORD_REDACTED')
      .replace(/C:\\Users\\[^\\]+/g, '<USER_DIR>');
  }
}
```

## パフォーマンス最適化

### 1. 並列処理戦略

```javascript
class ParallelExecutor {
  async executeAgents(agents, files) {
    // 独立したエージェントの並列実行
    const independentAgents = agents.filter(a => !a.dependencies);
    const dependentAgents = agents.filter(a => a.dependencies);
    
    // 独立エージェントを並列実行
    const independentResults = await Promise.all(
      independentAgents.map(agent => this.runAgent(agent, files))
    );
    
    // 依存エージェントを順次実行
    const dependentResults = [];
    for (const agent of dependentAgents) {
      dependentResults.push(await this.runAgent(agent, files));
    }
    
    return [...independentResults, ...dependentResults];
  }
}
```

### 2. キャッシング戦略

```javascript
class ResultCache {
  constructor() {
    this.cache = new Map();
    this.ttl = 15 * 60 * 1000; // 15分
  }
  
  getCacheKey(agent, files) {
    const fileHashes = files.map(f => this.hashFile(f));
    return `${agent.id}:${fileHashes.join(':')}`;
  }
  
  async get(agent, files) {
    const key = this.getCacheKey(agent, files);
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.result;
    }
    
    return null;
  }
}
```

### 3. インクリメンタル分析

```javascript
class IncrementalAnalyzer {
  async analyze(files, previousResults) {
    // 変更されていないファイルの結果を再利用
    const unchangedFiles = files.filter(f => 
      !this.hasChanged(f, previousResults)
    );
    
    const changedFiles = files.filter(f => 
      this.hasChanged(f, previousResults)
    );
    
    // 変更ファイルのみ分析
    const newResults = await this.analyzeFiles(changedFiles);
    
    // 結果をマージ
    return this.mergeResults(
      previousResults.filter(r => unchangedFiles.includes(r.file)),
      newResults
    );
  }
}
```

## 拡張性設計

### 1. プラグインアーキテクチャ

```javascript
class PluginManager {
  constructor() {
    this.plugins = new Map();
  }
  
  register(plugin) {
    // プラグインの検証
    this.validatePlugin(plugin);
    
    // フックの登録
    plugin.hooks.forEach(hook => {
      this.registerHook(hook.name, hook.handler);
    });
    
    this.plugins.set(plugin.id, plugin);
  }
  
  async executeHook(hookName, context) {
    const handlers = this.getHookHandlers(hookName);
    
    for (const handler of handlers) {
      context = await handler(context);
    }
    
    return context;
  }
}
```

### 2. カスタムエージェント統合

```javascript
abstract class BaseAgent {
  abstract async execute(files: string[]): Promise<AgentResult>;
  abstract parseOutput(rawOutput: string): Issue[];
  
  // 共通機能
  protected async runCommand(command: string): Promise<string> {
    // 実装
  }
  
  protected generateIssue(data: Partial<Issue>): Issue {
    // 実装
  }
}

class CustomAgent extends BaseAgent {
  async execute(files) {
    // カスタム実装
  }
  
  parseOutput(rawOutput) {
    // カスタム解析ロジック
  }
}
```

### 3. レポートテンプレートシステム

```javascript
class TemplateEngine {
  constructor() {
    this.templates = new Map();
  }
  
  registerTemplate(name, template) {
    this.templates.set(name, template);
  }
  
  render(templateName, data) {
    const template = this.templates.get(templateName);
    
    if (!template) {
      throw new Error(`Template ${templateName} not found`);
    }
    
    return template(data);
  }
}

// 使用例
templateEngine.registerTemplate('custom-report', (data) => `
  # カスタムレポート
  
  ## サマリー
  - 問題数: ${data.issueCount}
  - 修正数: ${data.fixCount}
  
  ## 詳細
  ${data.details}
`);
```

## 監視とロギング

### 1. 構造化ロギング

```javascript
class StructuredLogger {
  log(level, message, metadata = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...metadata,
      context: this.getExecutionContext()
    };
    
    this.output(JSON.stringify(logEntry));
  }
  
  error(message, error) {
    this.log('ERROR', message, {
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code
      }
    });
  }
}
```

### 2. メトリクス収集

```javascript
class MetricsCollector {
  constructor() {
    this.metrics = {
      executionTime: {},
      issueCount: {},
      fixCount: {},
      fileCount: 0
    };
  }
  
  startTimer(name) {
    this.metrics.executionTime[name] = {
      start: Date.now()
    };
  }
  
  endTimer(name) {
    if (this.metrics.executionTime[name]) {
      this.metrics.executionTime[name].duration = 
        Date.now() - this.metrics.executionTime[name].start;
    }
  }
  
  increment(metric, value = 1) {
    if (!this.metrics[metric]) {
      this.metrics[metric] = 0;
    }
    this.metrics[metric] += value;
  }
}
```

### 3. イベントシステム

```javascript
class EventBus extends EventEmitter {
  constructor() {
    super();
    this.middleware = [];
  }
  
  use(middleware) {
    this.middleware.push(middleware);
  }
  
  async emit(event, data) {
    // ミドルウェアチェーンを実行
    let processedData = data;
    
    for (const mw of this.middleware) {
      processedData = await mw(event, processedData);
    }
    
    super.emit(event, processedData);
  }
}

// 使用例
eventBus.on('agent:complete', (result) => {
  logger.info(`Agent ${result.agentName} completed`, {
    issueCount: result.issues.length,
    executionTime: result.executionTime
  });
});
```

## デプロイメントアーキテクチャ

### 1. 環境設定

```javascript
class ConfigManager {
  constructor() {
    this.config = this.loadConfig();
  }
  
  loadConfig() {
    return {
      development: {
        agentPath: './agents',
        maxIterations: 10,
        debug: true
      },
      production: {
        agentPath: '/usr/local/lib/smart-review/agents',
        maxIterations: 5,
        debug: false
      },
      test: {
        agentPath: './test/mock-agents',
        maxIterations: 1,
        debug: true
      }
    }[process.env.NODE_ENV || 'development'];
  }
}
```

### 2. 依存関係管理

```json
{
  "dependencies": {
    "core": ["fs", "path", "child_process"],
    "agents": ["security-analyzer", "bug-detector", "code-reviewer", "doc-updater"],
    "optional": ["comment-annotator-ja"]
  }
}
```

### 3. エラーリカバリー

```javascript
class ErrorRecovery {
  async executeWithRecovery(operation, fallback) {
    try {
      return await operation();
    } catch (error) {
      logger.error('Operation failed, attempting recovery', error);
      
      // リトライロジック
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await this.delay(attempt * 1000);
          return await operation();
        } catch (retryError) {
          logger.warn(`Retry ${attempt} failed`, retryError);
        }
      }
      
      // フォールバック実行
      if (fallback) {
        return await fallback(error);
      }
      
      throw error;
    }
  }
}
```

---

*最終更新: 2025年08月14日 16:15 JST*
*バージョン: v1.1.0*

**更新履歴:**
- v1.1.0 (2025年08月14日): バージョン管理システム導入、JST統一
- v1.0.0 (2025年08月13日): 初期アーキテクチャドキュメント作成