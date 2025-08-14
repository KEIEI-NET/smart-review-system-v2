# Smart Review - APIリファレンス

## モジュールインターフェース

### プライマリエクスポート

```javascript
module.exports = {
  name: string,
  description: string,
  options: OptionDefinition[],
  execute: ExecuteFunction
}
```

## 型定義

### コア型

```typescript
type Priority = 'critical' | 'high' | 'medium' | 'low';
type Scope = 'changes' | 'all';
type Category = 'security' | 'bug' | 'quality' | 'documentation';
type Level = 'error' | 'warning' | 'info' | 'suggestion';
type Model = 'sonnet' | 'opus';

interface OptionDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'choice';
  description: string;
  default?: any;
  choices?: string[];
}

interface ExecuteFunction {
  (context: ExecutionContext, args: Arguments): Promise<ReviewResult>;
}
```

### 実行コンテキスト

```typescript
interface ExecutionContext {
  files: FileSystem;
  output: OutputInterface;
  terminal: Terminal;
}

interface FileSystem {
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
}

interface OutputInterface {
  info(message: string): void;
  warning(message: string): void;
  error(message: string): void;
  success(message: string): void;
  debug(message: string): void;
}

interface Terminal {
  run(command: string): Promise<TerminalResult>;
}

interface TerminalResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}
```

### 引数

```typescript
interface Arguments {
  scope: Scope;
  target: string;
  'todo-file': string;
  'max-iterations': number;
  'output-dir': string;
  'skip-comment': boolean;
  'priority-threshold': Priority;
}
```

### レビュー結果

```typescript
interface ReviewResult {
  success: boolean;
  context?: FullExecutionContext;
  reportPath?: string;
  outputDir?: string;
  error?: string;
  message?: string;
}

interface FullExecutionContext {
  scope: Scope;
  target: string;
  startTime: string;
  changedFiles: string[];
  allIssues: Issue[];
  todoList: TodoItem[];
  iterations: Iteration[];
  finalCommentResult: CommentResult | null;
  metrics: Metrics;
}
```

### エージェント定義

```typescript
interface Agent {
  id: string;
  name: string;
  model: Model;
  path: string;
  role: string;
  category: Category;
  errorTypes: string[];
  canAutoFix: boolean;
  priority: Priority;
}

interface AgentResult {
  agentId: string;
  agentName: string;
  issues: Issue[];
  rawOutput: string;
  executionTime: number;
  error?: string;
}
```

### 問題定義

```typescript
interface Issue {
  level: Level;
  type: string;
  file?: string;
  line?: number;
  message: string;
  suggestion?: string;
  category: Category;
  priority: Priority;
  agentId: string;
  autoFixAvailable: boolean;
}
```

### TODO項目

```typescript
interface TodoItem {
  priority: Priority;
  type: string;
  title: string;
  description: string;
  effort: string;
  category: Category;
  files: string[];
  autoFixAvailable: boolean;
}
```

### 反復結果

```typescript
interface Iteration {
  number: number;
  timestamp: string;
  changedFiles: string[];
  issuesFixed: number;
  newIssues: Issue[];
  remainingIssues: Issue[];
}
```

### コメント結果

```typescript
interface CommentResult {
  success: boolean;
  filesCommented: number;
  executionTime: number;
  error?: string;
}
```

### メトリクス

```typescript
interface Metrics {
  totalExecutionTime: number;
  filesAnalyzed: number;
  issuesFound: number;
  issuesFixed: number;
  iterationsPerformed: number;
  agentsExecuted: number;
  criticalIssues: number;
  highPriorityIssues: number;
  mediumPriorityIssues: number;
  lowPriorityIssues: number;
}
```

## API メソッド

### execute(context, args)

メインの実行関数。

**パラメータ:**
- `context`: ExecutionContext - 実行環境
- `args`: Arguments - コマンドライン引数

**戻り値:**
- `Promise<ReviewResult>` - レビュー結果

**例:**
```javascript
const result = await execute(context, {
  scope: 'changes',
  target: './src',
  'todo-file': './TODO.md',
  'max-iterations': 5,
  'output-dir': './review-results',
  'skip-comment': false,
  'priority-threshold': 'medium'
});
```

### 内部関数

#### getChangedFiles(terminal, todoFile, output)

変更ファイルを検出します。

**パラメータ:**
- `terminal`: Terminal - ターミナルインターフェース
- `todoFile`: string - TODOファイルパス
- `output`: OutputInterface - 出力インターフェース

**戻り値:**
- `Promise<string[]>` - 変更ファイルのパス配列

#### runAgent(agent, files, terminal, output)

単一エージェントを実行します。

**パラメータ:**
- `agent`: Agent - エージェント定義
- `files`: string[] - 対象ファイル
- `terminal`: Terminal - ターミナルインターフェース
- `output`: OutputInterface - 出力インターフェース

**戻り値:**
- `Promise<AgentResult>` - エージェント実行結果

#### parseAgentOutput(rawOutput, agentId, category, priority)

エージェント出力を解析します。

**パラメータ:**
- `rawOutput`: string - 生の出力テキスト
- `agentId`: string - エージェントID
- `category`: Category - 問題カテゴリ
- `priority`: Priority - デフォルト優先度

**戻り値:**
- `Issue[]` - 解析された問題の配列

#### generateTodoContent(issues, priorityThreshold, previousTodo)

TODO内容を生成します。

**パラメータ:**
- `issues`: Issue[] - 問題の配列
- `priorityThreshold`: Priority - 優先度しきい値
- `previousTodo`: string - 前回のTODO内容

**戻り値:**
- `{ content: string, todoList: TodoItem[] }` - TODO内容とリスト

#### generateReport(context, outputDir, files)

レポートを生成します。

**パラメータ:**
- `context`: FullExecutionContext - 実行コンテキスト
- `outputDir`: string - 出力ディレクトリ
- `files`: FileSystem - ファイルシステム

**戻り値:**
- `Promise<string>` - レポートファイルパス

## 設定オプション

### scope

**型:** `'changes' | 'all'`  
**デフォルト:** `'changes'`  
**説明:** レビュー範囲を指定します。
- `'changes'`: 変更ファイルのみ分析（反復修正あり）
- `'all'`: プロジェクト全体を分析（反復修正なし）

### target

**型:** `string`  
**デフォルト:** `'.'`  
**説明:** 分析対象のディレクトリパス。

### todo-file

**型:** `string`  
**デフォルト:** `'./TODO.md'`  
**説明:** 既存TODOファイルのパス（変更検出用）。

### max-iterations

**型:** `number`  
**デフォルト:** `5`  
**説明:** changesモードでの最大反復回数。

### output-dir

**型:** `string`  
**デフォルト:** `'./smart-review-results'`  
**説明:** 結果ファイルの出力ディレクトリ。

### skip-comment

**型:** `boolean`  
**デフォルト:** `false`  
**説明:** 日本語コメント注釈をスキップするかどうか。

### priority-threshold

**型:** `'critical' | 'high' | 'medium' | 'low'`  
**デフォルト:** `'medium'`  
**説明:** TODOリストに含める最小優先度レベル。

## エラーコード

| コード | 説明 | 解決方法 |
|-------|------|---------|
| `SR001` | エージェント実行失敗 | エージェントのインストールを確認 |
| `SR002` | ファイルシステムエラー | ファイル権限を確認 |
| `SR003` | Git操作失敗 | Gitリポジトリを確認 |
| `SR004` | 無効な設定 | オプション構文を確認 |
| `SR005` | タイムアウト超過 | タイムアウトを増やすかスコープを減らす |

## 使用例

### 基本的な使用

```javascript
const smartReview = require('./smart-review');

async function runReview() {
  const result = await smartReview.execute(context, {
    scope: 'changes',
    target: './src',
    'priority-threshold': 'high'
  });
  
  if (result.success) {
    console.log('レビュー完了:', result.reportPath);
    console.log('発見された問題:', result.context.metrics.issuesFound);
    console.log('修正された問題:', result.context.metrics.issuesFixed);
  }
}
```

### カスタムエージェント設定

```javascript
// エージェント設定をカスタマイズ
const customAgents = [
  {
    id: 'custom-security',
    name: 'カスタムセキュリティスキャナー',
    model: 'opus',
    path: '/path/to/custom-agent',
    role: 'カスタムセキュリティチェック',
    category: 'security',
    errorTypes: ['custom-vuln'],
    canAutoFix: false,
    priority: 'critical'
  }
];

// 注: 実装にはモジュールの修正が必要
```

### CI/CD統合

```javascript
async function cicdPipeline() {
  const result = await smartReview.execute(context, {
    scope: 'changes',
    'max-iterations': 3,
    'priority-threshold': 'critical',
    'skip-comment': true
  });
  
  // 重大な問題がある場合はビルドを失敗させる
  if (result.context.metrics.criticalIssues > 0) {
    console.error('重大な問題が発見されました');
    process.exit(1);
  }
  
  return result;
}
```

### プログラマティックアクセス

```javascript
const smartReview = require('./smart-review');

class CodeQualityChecker {
  async checkProject(projectPath) {
    const result = await smartReview.execute(this.context, {
      scope: 'all',
      target: projectPath,
      'output-dir': `${projectPath}/quality-reports`
    });
    
    return {
      passed: result.success && result.context.metrics.criticalIssues === 0,
      metrics: result.context.metrics,
      report: result.reportPath
    };
  }
  
  async checkChanges(since) {
    // カスタム変更検出ロジック
    const result = await smartReview.execute(this.context, {
      scope: 'changes',
      'todo-file': `./TODO-${since}.md`
    });
    
    return result.context.todoList;
  }
}
```

---

*最終更新: 2025-08-13*  
*バージョン: 1.0.0*