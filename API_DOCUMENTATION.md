# Smart Review API ドキュメント v2.0

## 目次

1. [概要](#概要)
2. [対話式インターフェースAPI](#対話式インターフェースapi) 🆕
3. [設定管理API](#設定管理api) 🆕
4. [セキュリティAPI](#セキュリティapi)
5. [コアAPI](#コアapi)
6. [エージェントAPI](#エージェントapi)
7. [キャッシング・パフォーマンス](#キャッシング・パフォーマンス)
8. [ロギング・モニタリング](#ロギング・モニタリング)
9. [ユーティリティAPI](#ユーティリティapi)
10. [データ構造](#データ構造)
11. [イベント](#イベント)
12. [エラーハンドリング](#エラーハンドリング)
13. [使用例](#使用例)
14. [セキュリティベストプラクティス](#セキュリティベストプラクティス)

## 概要

Smart Review API v2.0は、包括的なセキュリティ強化を備えた次世代コードレビュー自動化システムです。このAPIを使用することで、セキュアなカスタムインテグレーション、自動化ワークフロー、およびカスタムレポートの作成が可能になります。

### v2.0の主要機能

- **セキュリティ強化**: 包括的な入力検証、コマンドインジェクション対策、パストラバーサル防止
- **エージェントサンドボックス**: 隔離された実行環境でのエージェント実行
- **キャッシング機能**: インテリジェントな結果キャッシュによる高速化
- **構造化ロギング**: 詳細な監査ログとセキュリティイベント追跡
- **並列実行**: 優先度ベースのエージェント並列実行

### 基本的な使用方法

```javascript
const smartReview = require('./smart-review-v2');

// セキュアな実行コンテキストの作成
const context = {
  files: secureFileSystem,
  output: structuredLogger,
  terminal: sandboxedTerminal
};

// 検証済み引数での実行
const args = {
  scope: 'changes',
  target: './src',
  'priority-threshold': 'medium',
  'output-dir': './smart-review-results',
  'max-iterations': 3
};

// セキュアなレビューの実行
const result = await smartReview.execute(context, args);
if (result.success) {
  console.log(`レポート生成完了: ${result.reportPath}`);
  console.log(`検出された問題: ${result.context.metrics.issuesFound}`);
  console.log(`自動修正: ${result.context.metrics.issuesFixed}`);
}
```

## 対話式インターフェースAPI 🆕

### showHelp(output)

ヘルプメッセージを表示します。

```javascript
showHelp(output)
```

**パラメータ:**
- `output` (Object): Claude Codeの出力API

**実装例:**
```javascript
module.exports = {
  showHelp(output) {
    const helpText = `
🔍 Smart Review v2.0 - インテリジェントコードレビュー自動化システム

📖 使用方法:
  claude smart-review [オプション]
  
📋 オプション:
  --scope <changes|all>          チェック範囲
  --target <ディレクトリ>         対象ディレクトリ
  --help                          このヘルプを表示
  ...
`;
    output.info(helpText);
  }
}
```

### showInteractiveMenu(context)

対話式メニューを表示し、ユーザーの選択に基づいて適切な処理を実行します。

```javascript
async showInteractiveMenu(context)
```

**パラメータ:**
- `context` (Object): 実行コンテキスト
  - `input` (Object): 入力API（select, text, number, confirm）
  - `output` (Object): 出力API
  - `files` (Object): ファイルシステムAPI
  - `terminal` (Object): ターミナルAPI

**戻り値:**
- `Promise<ReviewResult>`: レビュー結果

**メニューオプション:**
```javascript
const menuOptions = [
  {
    name: '🔄 変更点のクイックレビュー',
    value: 'quick-changes',
    description: '前回チェック以降の変更点を素早くレビュー'
  },
  {
    name: '🔍 プロジェクト全体のスキャン',
    value: 'full-scan',
    description: 'プロジェクト全体を包括的にスキャン'
  },
  {
    name: '🛡️ セキュリティ監査',
    value: 'security-audit',
    description: 'セキュリティ脆弱性に特化した監査'
  },
  {
    name: '⚡ 高優先度問題のみ',
    value: 'high-priority',
    description: 'critical/high優先度の問題のみをチェック'
  },
  {
    name: '🎯 カスタム設定',
    value: 'custom',
    description: '詳細なオプション設定でレビュー実行'
  },
  {
    name: '📖 ヘルプ表示',
    value: 'help',
    description: '詳細なヘルプとオプション一覧を表示'
  }
];
```

### showCustomMenu(context)

カスタム設定メニューを表示し、詳細な設定を対話的に収集します。

```javascript
async showCustomMenu(context)
```

**パラメータ:**
- `context` (Object): 実行コンテキスト

**戻り値:**
- `Promise<ReviewResult>`: カスタム設定でのレビュー結果

**収集される設定:**
1. `scope`: チェック範囲（changes/all）
2. `target`: 対象ディレクトリ
3. `priorityThreshold`: 優先度しきい値
4. `maxIterations`: 最大繰り返し回数
5. `skipComment`: コメント注釈のスキップ
6. `outputDir`: 出力ディレクトリ

**実装例:**
```javascript
async showCustomMenu(context) {
  const { input, output } = context;
  
  try {
    // チェック範囲の選択
    const scope = await input.select('チェック範囲:', [
      { name: '変更点のみ (changes)', value: 'changes' },
      { name: 'プロジェクト全体 (all)', value: 'all' }
    ]);
    
    // 対象ディレクトリの入力
    const target = await input.text('対象ディレクトリ:', {
      default: '.',
      placeholder: 'カレントディレクトリの場合は . を入力'
    });
    
    // 優先度しきい値の選択
    const priorityThreshold = await input.select('優先度しきい値:', [
      { name: '重大な問題のみ (critical)', value: 'critical' },
      { name: '高優先度以上 (high)', value: 'high' },
      { name: '中優先度以上 (medium)', value: 'medium' },
      { name: 'すべての問題 (low)', value: 'low' }
    ]);
    
    // カスタム設定で実行
    return await this.executeWithArgs(context, {
      scope,
      target,
      'priority-threshold': priorityThreshold,
      // ... その他の設定
    });
    
  } catch (error) {
    output.error('カスタム設定中にエラーが発生しました:', error);
    return { success: false, error: 'カスタム設定エラー' };
  }
}
```

### executeWithArgs(context, args)

指定された引数でレビューを実行します（メニュー処理をバイパス）。

```javascript
async executeWithArgs(context, args)
```

**パラメータ:**
- `context` (Object): 実行コンテキスト
- `args` (Object): レビュー引数
  - `_skipMenu` (boolean): 内部フラグ（自動設定）

**戻り値:**
- `Promise<ReviewResult>`: レビュー結果

### Claude Code Input API インターフェース

対話式メニューで使用される入力APIメソッド：

#### input.select(prompt, options)

選択肢から1つを選択

```javascript
const choice = await context.input.select('操作を選択:', [
  { name: '表示名', value: '値', description: '説明' }
]);
```

#### input.text(prompt, options)

テキスト入力を取得

```javascript
const text = await context.input.text('ディレクトリ:', {
  default: '.',
  placeholder: 'ヒントテキスト'
});
```

#### input.number(prompt, options)

数値入力を取得

```javascript
const number = await context.input.number('繰り返し回数:', {
  default: 5,
  min: 1,
  max: 10
});
```

#### input.confirm(prompt, options)

Yes/No確認を取得

```javascript
const confirmed = await context.input.confirm('続行しますか?', {
  default: true
});
```

## 設定管理API 🆕

### SmartReviewConfig クラス

**概要**: 環境変数、設定ファイル、デフォルト値の優先順位で設定を一元管理するクラス

#### コンストラクタ

```javascript
new SmartReviewConfig()
```

#### メソッド

##### getAgents()

エージェント設定の取得

```javascript
async getAgents()
```

**戻り値**:
- `Promise<Array>`: エージェント設定の配列

**例**:
```javascript
const configManager = new SmartReviewConfig();
const agents = await configManager.getAgents();
agents.forEach(agent => {
  console.log(`${agent.name}: ${agent.enabled ? '有効' : '無効'}`);
});
```

##### getSecuritySettings()

セキュリティ設定の取得

```javascript
async getSecuritySettings()
```

**戻り値**:
- `Promise<Object>`: セキュリティ設定オブジェクト
  - `allowedPaths` (Array): 許可されたパス
  - `blockedPatterns` (Array): ブロックするパターン
  - `maxFileSize` (Number): 最大ファイルサイズ
  - `preventPathTraversal` (Boolean): パストラバーサル防止
  - `sanitizeOutput` (Boolean): 出力のサニタイズ

##### getPerformanceSettings()

パフォーマンス設定の取得

```javascript
async getPerformanceSettings()
```

**戻り値**:
- `Promise<Object>`: パフォーマンス設定オブジェクト
  - `maxConcurrency` (Number): 最大並列実行数
  - `cacheEnabled` (Boolean): キャッシュ有効/無効
  - `cacheTTL` (Number): キャッシュ有効期限
  - `maxCacheSize` (Number): 最大キャッシュサイズ
  - `batchSize` (Number): バッチサイズ

##### loadConfig()

設定ファイルの読み込み

```javascript
async loadConfig()
```

**優先順位**:
1. 環境変数 `SMART_REVIEW_CONFIG` で指定されたパス
2. プロジェクトディレクトリの `.smart-review.json`
3. ホームディレクトリの `~/.claude/smart-review.json`
4. ホームディレクトリの `~/.config/smart-review.json`
5. デフォルト設定

**戻り値**:
- `Promise<Object>`: マージされた設定オブジェクト

##### createProjectConfig()

プロジェクト固有の設定ファイル作成

```javascript
async createProjectConfig(projectPath = process.cwd())
```

**パラメータ**:
- `projectPath` (String): プロジェクトパス（デフォルト: カレントディレクトリ）

**戻り値**:
- `Promise<String>`: 作成された設定ファイルのパス

**例**:
```javascript
const configPath = await configManager.createProjectConfig();
console.log(`設定ファイルを作成しました: ${configPath}`);
```

##### saveConfig()

設定の保存

```javascript
async saveConfig(config, targetPath = null)
```

**パラメータ**:
- `config` (Object): 保存する設定オブジェクト
- `targetPath` (String): 保存先パス（オプション）

**戻り値**:
- `Promise<String>`: 保存したファイルのパス

##### exportConfig()

設定のエクスポート

```javascript
async exportConfig(format = 'json')
```

**パラメータ**:
- `format` (String): エクスポート形式（'json', 'env', 'yaml'）

**戻り値**:
- `Promise<String>`: フォーマット済み設定文字列

**例**:
```javascript
// JSON形式でエクスポート
const jsonConfig = await configManager.exportConfig('json');

// 環境変数形式でエクスポート
const envConfig = await configManager.exportConfig('env');
console.log(envConfig);
// SMART_REVIEW_ENABLED_AGENTS="security-analyzer,debugger"
// SMART_REVIEW_MAX_CONCURRENCY=4
// SMART_REVIEW_CACHE=true
```

### configManager シングルトンインスタンス

**概要**: グローバルに利用可能な設定管理インスタンス

```javascript
const { configManager } = require('./smart-review-config');

// 設定の取得
const agents = await configManager.getAgents();
const security = await configManager.getSecuritySettings();
const performance = await configManager.getPerformanceSettings();
```

### 環境変数による設定

以下の環境変数で設定をオーバーライドできます：

| 環境変数 | 説明 | 例 |
|---------|------|-----|
| `SMART_REVIEW_CONFIG` | 設定ファイルパス | `/path/to/config.json` |
| `SMART_REVIEW_DISABLED_AGENTS` | 無効化するエージェントID（カンマ区切り） | `documentation-updater,reviewer` |
| `SMART_REVIEW_MAX_CONCURRENCY` | 最大並列実行数 | `2` |
| `SMART_REVIEW_CACHE` | キャッシュ有効/無効 | `false` |
| `CLAUDE_AGENTS_PATH` | エージェントのベースパス | `~/.claude/agents` |

## セキュリティAPI

### Config クラス

**概要**: システム全体のセキュリティ設定を管理する静的設定クラス

#### 静的プロパティ

##### ALLOWED_COMMANDS

実行が許可されたコマンドのホワイトリスト

```javascript
static get ALLOWED_COMMANDS() {
  return ['git', 'mkdir', 'claude'];
}
```

##### ALLOWED_OUTPUT_BASE

出力ファイルのベースディレクトリ

```javascript
static get ALLOWED_OUTPUT_BASE() {
  return './smart-review-results';
}
```

##### MAX_ITERATIONS_RANGE

許可される最大反復回数の範囲

```javascript
static get MAX_ITERATIONS_RANGE() {
  return { min: 1, max: 10 };
}
```

### SecurityUtils クラス

**概要**: 包括的なセキュリティユーティリティを提供する静的クラス

#### メソッド

##### validatePath()

包括的なパス検証を実行します。

```javascript
static validatePath(userPath, baseDir = process.cwd())
```

**パラメータ**:
- `userPath` (String): 検証対象のパス
- `baseDir` (String): ベースディレクトリ（オプション）

**戻り値**:
- `String`: 検証済みの解決済みパス

**例外**:
- パストラバーサル検出時: `Error`
- 不正なパターン検出時: `Error`
- パス長制限超過時: `Error`

**例**:

```javascript
try {
  const safePath = SecurityUtils.validatePath('../data/file.txt');
  console.log('安全なパス:', safePath);
} catch (error) {
  console.error('セキュリティエラー:', error.message);
}
```

##### validateOutputDirectory()

出力ディレクトリの検証と安全な生成

```javascript
static validateOutputDirectory(outputDir)
```

**パラメータ**:
- `outputDir` (String): 出力ディレクトリパス

**戻り値**:
- `String`: 検証済み出力ディレクトリパス

##### sanitizeError()

エラーメッセージのサニタイゼーション

```javascript
static sanitizeError(error)
```

**パラメータ**:
- `error` (Error): サニタイズ対象のエラー

**戻り値**:
- `Object`: サニタイズ済みエラー情報
  - `message` (String): サニタイズ済みメッセージ
  - `code` (String): エラーコード
  - `timestamp` (String): タイムスタンプ
  - `sanitized` (Boolean): サニタイズフラグ

**例**:

```javascript
try {
  // 危険な操作
  await dangerousOperation();
} catch (error) {
  const sanitized = SecurityUtils.sanitizeError(error);
  logger.error('安全なエラーログ', sanitized);
}
```

##### executeCommand()

セキュアなコマンド実行

```javascript
static async executeCommand(command, args = [], options = {})
```

**パラメータ**:
- `command` (String): 実行コマンド（ホワイトリスト内）
- `args` (Array): コマンド引数
- `options` (Object): 実行オプション
  - `timeout` (Number): タイムアウト時間
  - `maxBuffer` (Number): 最大バッファサイズ
  - `cwd` (String): 作業ディレクトリ

**戻り値**:
- `Object`: 実行結果
  - `stdout` (String): 標準出力
  - `stderr` (String): 標準エラー出力
  - `exitCode` (Number): 終了コード
  - `command` (String): 実行されたコマンド
  - `args` (Array): サニタイズ済み引数

**例**:

```javascript
try {
  const result = await SecurityUtils.executeCommand('git', [
    'log',
    '--name-only',
    '--pretty=format:',
    '-n', '10'
  ]);
  
  console.log('Git出力:', result.stdout);
} catch (error) {
  console.error('コマンド実行エラー:', error.message);
}
```

### InputValidator クラス

**概要**: 入力値の検証を行う静的クラス

#### メソッド

##### validateString()

文字列の検証

```javascript
static validateString(input, options = {})
```

**パラメータ**:
- `input` (String): 検証対象の文字列
- `options` (Object): 検証オプション
  - `maxLength` (Number): 最大長（デフォルト: 1000）
  - `pattern` (RegExp): パターンマッチング
  - `allowEmpty` (Boolean): 空文字許可（デフォルト: false）
  - `minLength` (Number): 最小長（デフォルト: 0）

**例**:

```javascript
try {
  const validPath = InputValidator.validateString(userInput, {
    maxLength: 260,
    pattern: /^[a-zA-Z0-9._\/-]+$/,
    allowEmpty: false
  });
  console.log('検証済みパス:', validPath);
} catch (error) {
  console.error('入力検証エラー:', error.message);
}
```

##### validateNumber()

数値の検証

```javascript
static validateNumber(input, options = {})
```

**パラメータ**:
- `input` (String|Number): 検証対象の数値
- `options` (Object): 検証オプション
  - `min` (Number): 最小値
  - `max` (Number): 最大値
  - `integer` (Boolean): 整数限定

**例**:

```javascript
const maxIterations = InputValidator.validateNumber(args.maxIterations, {
  min: 1,
  max: 10,
  integer: true
});
```

##### validateChoice()

選択肢の検証

```javascript
static validateChoice(input, choices)
```

**パラメータ**:
- `input` (String): 検証対象の値
- `choices` (Array): 有効な選択肢

**例**:

```javascript
const scope = InputValidator.validateChoice(args.scope, ['changes', 'all']);
```

### AgentSandbox クラス

**概要**: エージェントを隔離された環境で実行するためのサンドボックスクラス

#### コンストラクタ

```javascript
new AgentSandbox(agent, context)
```

**パラメータ**:
- `agent` (Object): エージェント定義
- `context` (Object): 実行コンテキスト

#### プロパティ

- `timeout` (Number): 実行タイムアウト
- `maxMemory` (Number): 最大メモリ使用量
- `allowedOperations` (Array): 許可された操作

#### メソッド

##### execute()

サンドボックス内でエージェントを実行

```javascript
async execute(files, iteration = 1)
```

**セキュリティ機能**:
- プロセス隔離
- リソース制限
- タイムアウト制御
- 読み取り専用ファイルシステム
- 制限されたコマンド実行

**パラメータ**:
- `files` (Array<String>): 検証済み分析対象ファイル
- `iteration` (Number): 反復番号

**戻り値**:
- `Object`: 実行結果
  - `agentId` (String): エージェントID
  - `agentName` (String): エージェント名
  - `issues` (Array): 検出された問題
  - `rawOutput` (String): 生の出力
  - `executionTime` (Number): 実行時間
  - `sandboxId` (String): サンドボックスID
  - `error` (String): エラーメッセージ（エラー時）

**例**:

```javascript
const sandbox = new AgentSandbox(securityAgent, context);
try {
  const result = await sandbox.execute(['file1.js', 'file2.ts'], 1);
  console.log(`${result.agentName}: ${result.issues.length}個の問題を検出`);
} catch (error) {
  console.error('サンドボックス実行エラー:', error.message);
}
```

## コアAPI

### smart-review-v2 モジュール

メインのセキュアなレビューコマンドモジュールです。

#### モジュール構造

```javascript
module.exports = {
  name: 'smart-review',
  description: '変更点または全体をチェックし、修正またはTODOリストを生成（セキュリティ強化版）',
  options: [...], // コマンドオプション定義
  async execute(context, args) { ... } // メイン実行関数
}
```

#### オプション定義

**利用可能なオプション:**
- `scope` (choice): 'changes' または 'all' - チェック範囲
- `target` (string): 対象ディレクトリ（デフォルト: '.'）
- `todo-file` (string): 既存のTODOファイルパス
- `max-iterations` (number): 最大繰り返し回数（1-10）
- `output-dir` (string): 結果の出力ディレクトリ
- `skip-comment` (boolean): コメント注釈をスキップ
- `priority-threshold` (choice): TODOに含める最小優先度

#### 実行関数

##### execute()

セキュアなレビュープロセスを実行します。

```javascript
async execute(context, args)
```

**パラメータ**:
- `context` (Object): 実行コンテキスト
  - `files` (Object): セキュアファイルシステムAPI
  - `output` (Object): 構造化出力API
  - `terminal` (Object): サンドボックス化ターミナルAPI
- `args` (Object): 検証済みコマンド引数
  - すべての引数は事前に検証・サニタイズ済み

**戻り値**:
- `Promise<ReviewResult>`: セキュアなレビュー結果

**セキュリティ機能**:
- 入力検証とサニタイゼーション
- パストラバーサル防止
- コマンドインジェクション対策
- リソース制限の適用
- 構造化エラーハンドリング

**例**:

```javascript
const result = await smartReviewV2.execute({
  files: secureFileSystem,
  output: structuredLogger,
  terminal: sandboxedTerminal
}, {
  scope: 'changes',
  target: './src',
  'priority-threshold': 'high',
  'max-iterations': 3
});

if (result.success) {
  console.log('セキュアレビュー完了:', result.reportPath);
  console.log('セキュリティメトリクス:', result.context.metrics);
} else {
  console.error('レビューエラー:', result.error);
}
```

##### 内部セキュア関数

**detectChangedFiles()** (内部関数)

セキュアなGit操作による変更ファイル検出

```javascript
async function detectChangedFiles()
```

**セキュリティ機能**:
- セキュアなGitコマンド実行
- 出力サイズ制限
- パス長制限
- 重複除去
- エラー時の安全なフォールバック

**戻り値**:
- `Array<String>`: 検証済み変更ファイルパス配列

**ParallelExecutor.executeAgents()** (内部クラス)

優先度ベースの並列エージェント実行

```javascript
static async executeAgents(agents, files, context, iteration = 1)
```

**セキュリティ機能**:
- 同時実行数制限（リソース枯渇防止）
- 優先度ベースのグループ化
- エージェントグループサイズ制限
- エラー隔離と回復
- リソース枯渇防止

**実行順序**:
1. Critical優先度エージェント（順次実行）
2. High優先度エージェント（並列実行）
3. Medium優先度エージェント（並列実行）
4. Low優先度エージェント（並列実行）

**パラメータ**:
- `agents` (Array): セキュア検証済みエージェント
- `files` (Array): 検証済み分析対象ファイル
- `context` (SecureContext): セキュア実行コンテキスト
- `iteration` (Number): 反復番号

**戻り値**:
- `Array<AgentResult>`: サニタイズ済み実行結果

## キャッシング・パフォーマンス

### ResultCache クラス

**概要**: インテリジェントな結果キャッシングシステム

#### コンストラクタ

```javascript
new ResultCache()
```

#### プロパティ

- `ttl` (Number): キャッシュ有効期限（15分）
- `maxSize` (Number): 最大キャッシュサイズ（100エントリ）

#### メソッド

##### hashFile()

ファイルハッシュの生成

```javascript
async hashFile(filePath)
```

**セキュリティ機能**:
- ファイルサイズ制限（10MB）
- SHA-256ハッシュ使用
- エラー時の安全なフォールバック

**パラメータ**:
- `filePath` (String): ハッシュ対象ファイル

**戻り値**:
- `String`: SHA-256ハッシュ値

##### getCacheKey()

キャッシュキーの生成

```javascript
async getCacheKey(agent, files, iteration = 1)
```

**パラメータ**:
- `agent` (Object): エージェント定義
- `files` (Array): 対象ファイル
- `iteration` (Number): 反復番号

**戻り値**:
- `String`: 一意のキャッシュキー

##### get()

キャッシュからの取得

```javascript
async get(agent, files, iteration = 1)
```

**戻り値**:
- `Object|null`: キャッシュされた結果またはnull

##### set()

キャッシュへの保存

```javascript
async set(agent, files, iteration, result)
```

**セキュリティ機能**:
- ディープコピーによる参照リーク防止
- サイズ制限の適用
- 自動的な古いエントリの削除

**例**:

```javascript
const cache = new ResultCache();

// キャッシュ確認
const cached = await cache.get(agent, files, 1);
if (cached) {
  console.log('キャッシュヒット:', cached.issues.length);
  return cached;
}

// エージェント実行
const result = await executeAgent(agent, files);

// 結果をキャッシュ
await cache.set(agent, files, 1, result);
```

## ロギング・モニタリング

### StructuredLogger クラス

**概要**: セキュリティ対応の構造化ロギングシステム

#### コンストラクタ

```javascript
new StructuredLogger()
```

#### プロパティ

- `context` (Object): セッションコンテキスト
  - `sessionId` (String): 一意のセッション識別子
  - `version` (String): システムバージョン
  - `startTime` (String): 開始時刻

#### メソッド

##### log()

基本ログ出力

```javascript
log(level, message, metadata = {})
```

**セキュリティ機能**:
- 自動的なHTMLエスケープ
- 機密情報のサニタイゼーション
- JSON形式での構造化出力

**パラメータ**:
- `level` (String): ログレベル
- `message` (String): ログメッセージ
- `metadata` (Object): 追加メタデータ

##### error()

エラーログ出力

```javascript
error(message, error = null, metadata = {})
```

**セキュリティ機能**:
- スタックトレースのサニタイゼーション
- エラー詳細の安全な記録

##### security()

セキュリティイベントログ

```javascript
security(event, details = {})
```

**例**:

```javascript
const logger = new StructuredLogger();

// セキュリティイベントの記録
logger.security('COMMAND_INJECTION_ATTEMPT', {
  command: sanitized.command,
  source: 'user-input',
  blocked: true
});

// エージェント実行ログ
logger.agent('SecurityAnalyzer', 'execution_completed', {
  issuesFound: 5,
  executionTime: 1200,
  filesAnalyzed: 15
});

// パフォーマンスメトリクス
logger.performance('agent_execution', 1200, {
  agentType: 'security',
  fileCount: 15
});
```

## エージェントAPI

### Agent 定義構造

v2.0では、セキュリティ強化されたエージェント定義を使用します。

#### セキュアエージェント構造

```javascript
{
  id: String,                    // 一意の識別子
  name: String,                  // 表示名
  model: String,                 // AIモデル（'sonnet' | 'opus'）
  path: String,                  // 検証済みエージェント実行パス
  role: String,                  // エージェントの役割
  category: String,              // カテゴリ（'security' | 'bug' | 'quality' | 'documentation'）
  errorTypes: Array,             // 検出可能なエラータイプ
  canAutoFix: Boolean,           // 自動修正能力
  priority: String,              // デフォルト優先度
  allowedCommands: Array         // 許可されたコマンド（サンドボックス用）
}
```

#### 事前定義されたセキュアエージェント

**セキュリティエージェント**
```javascript
{
  id: 'security-error-xss-analyzer',
  name: 'セキュリティ・XSSアナライザー',
  model: 'sonnet',
  role: 'セキュリティ脆弱性の検出',
  category: 'security',
  errorTypes: ['xss', 'sql-injection', 'csrf', 'auth-bypass', 'data-exposure'],
  canAutoFix: true,
  priority: 'critical',
  allowedCommands: ['git']
}
```

**バグ検出エージェント**
```javascript
{
  id: 'super-debugger-perfectionist',
  name: 'スーパーデバッガー（完璧主義者）',
  model: 'sonnet',
  role: 'バグと最適化ポイントの検出',
  category: 'bug',
  errorTypes: ['bug', 'logic-error', 'memory-leak', 'performance', 'race-condition'],
  canAutoFix: true,
  priority: 'high',
  allowedCommands: ['git']
}
```

**コード品質エージェント**
```javascript
{
  id: 'deep-code-reviewer',
  name: 'ディープコードレビュアー',
  model: 'opus',
  role: 'アーキテクチャとコード品質の評価',
  category: 'quality',
  errorTypes: ['architecture', 'design-pattern', 'code-smell', 'complexity', 'duplication'],
  canAutoFix: false,
  priority: 'medium',
  allowedCommands: ['git']
}
```

#### セキュアエージェント実行

```javascript
// AgentSandboxによる隔離実行
const sandbox = new AgentSandbox(agent, secureContext);
const result = await sandbox.execute(targetFiles, iteration);

// 結果は自動的にサニタイズされます
console.log('安全な結果:', {
  agentId: result.agentId,
  issuesFound: result.issues.length,
  executionTime: result.executionTime,
  sandboxId: result.sandboxId
});
```

#### セキュアエージェント実行メソッド

##### AgentSandbox.execute()

サンドボックス化されたエージェント実行

```javascript
async execute(files, iteration = 1)
```

**セキュリティ機能**:
- プロセス隔離
- リソース制限
- タイムアウト制御
- 読み取り専用ファイルシステム
- 制限されたコマンド実行

**パラメータ**:
- `files` (Array<String>): 検証済み分析対象ファイル
- `iteration` (Number): 反復番号

**戻り値**:
- `Promise<SanitizedAgentResult>`: サニタイズ済みエージェント実行結果

##### AgentSandbox.parseAgentOutput()

セキュアな出力解析

```javascript
parseAgentOutput(output)
```

**セキュリティ機能**:
- 入力サイズ制限（1MB）
- ReDoS攻撃対策
- HTMLエスケープ
- 問題数制限（1000個）
- パターンマッチング制限

**パラメータ**:
- `output` (String): エージェントの生の出力

**戻り値**:
- `Array<SanitizedIssue>`: サニタイズ済み問題配列

### ParallelExecutor クラス

セキュアな並列エージェント実行管理

#### 静的メソッド

##### executeAgents()

優先度ベースの安全な並列実行

```javascript
static async executeAgents(agents, files, context, iteration = 1)
```

**セキュリティ機能**:
- 同時実行数制限（最大4エージェント）
- 優先度ベースのグループ化
- エージェントグループサイズ制限
- エラー隔離と回復
- リソース枯渇防止

**実行順序**:
1. Critical優先度エージェント（順次実行）
2. High優先度エージェント（並列実行）
3. Medium優先度エージェント（並列実行）
4. Low優先度エージェント（並列実行）

**パラメータ**:
- `agents` (Array<SecureAgent>): セキュア検証済みエージェント
- `files` (Array<String>): 検証済み分析対象ファイル
- `context` (SecureContext): セキュア実行コンテキスト
- `iteration` (Number): 反復番号

**戻り値**:
- `Promise<Array<SanitizedAgentResult>>`: サニタイズ済み実行結果

##### groupByPriority()

エージェントの優先度別グループ化

```javascript
static groupByPriority(agents)
```

**パラメータ**:
- `agents` (Array): エージェント配列

**戻り値**:
- `Array<Array>`: 優先度別グループ配列

**例**:

```javascript
// セキュアな並列実行
const results = await ParallelExecutor.executeAgents(
  secureAgents,
  validatedFiles,
  secureContext,
  1
);

// 結果の処理（全て自動的にサニタイズ済み）
results.forEach(result => {
  if (result.error) {
    logger.security('AGENT_EXECUTION_FAILURE', {
      agentId: result.agentId,
      error: result.error
    });
  } else {
    logger.info(`${result.agentName}: ${result.issues.length}問題検出`);
  }
});
```

## ユーティリティAPI

### セキュアファイルシステム（内部実装）

v2.0では、すべてのファイル操作がセキュア化されています。

#### セキュアファイル操作

**createReadOnlyFileSystem()** (AgentSandbox内)

読み取り専用ファイルシステムの作成

```javascript
createReadOnlyFileSystem(files)
```

**セキュリティ機能**:
- ファイルアクセス制限（ホワイトリスト）
- パス検証
- 書き込み操作の完全無効化
- エラーの安全な処理

**提供メソッド**:
- `read(filePath)`: セキュアファイル読み取り
- `exists(filePath)`: ファイル存在確認
- `write()`: 常に例外（読み取り専用）

**例**:

```javascript
// サンドボックス内でのセキュアファイルアクセス
const readOnlyFS = sandbox.createReadOnlyFileSystem(allowedFiles);

try {
  const content = await readOnlyFS.read('/safe/path/file.js');
  console.log('ファイル内容取得成功');
} catch (error) {
  // セキュリティエラーまたはファイルエラー
  logger.security('FILE_ACCESS_DENIED', {
    path: '/safe/path/file.js',
    error: error.message
  });
}

// 書き込み試行は常に失敗
try {
  await readOnlyFS.write('/any/path', 'content');
} catch (error) {
  console.log('期待通り書き込み拒否:', error.message);
}
```

### セキュアGit操作（内部実装）

v2.0では、すべてのGit操作がセキュア化されています。

#### SecurityUtils.executeCommand()を使用したGit操作

**セキュアGitコマンド実行**

```javascript
// セキュアな変更ファイル検出
const gitArgs = ['log', '--name-only', '--pretty=format:', '--after', timeString];
const result = await SecurityUtils.executeCommand('git', gitArgs);
```

**セキュリティ機能**:
- コマンドホワイトリスト（'git'のみ許可）
- 引数のサニタイゼーション
- シェル解釈無効化
- タイムアウト制御
- バッファサイズ制限
- 環境変数のサニタイゼーション

**安全な日付処理**:

```javascript
// SecurityUtils.safeParseDate()による安全な日付解析
const lastCheckTime = SecurityUtils.safeParseDate(timeMatch[1]);

// ISO 8601形式の検証
// 不正な日付形式を自動的に拒否
// nullチェックによる安全な処理
```

**出力サイズ制限**:

```javascript
// Git出力の制限（メモリ攻撃防止）
const limitedOutput = result.stdout.length > 1024 * 1024 
  ? result.stdout.substring(0, 1024 * 1024) 
  : result.stdout;

// ファイルパス長制限
const changedFiles = limitedOutput
  .split('\n')
  .filter(f => f.length < 260) // Windows PATH制限
  .slice(0, 1000); // ファイル数制限
```

### セキュアレポート生成（内部実装）

v2.0では、XSS対策を含む完全にセキュア化されたレポート生成を実装しています。

#### generateHTMLReport() (内部関数)

XSS攻撃対策済みHTMLレポート生成

```javascript
function generateHTMLReport(context)
```

**セキュリティ機能**:
- 全データのHTMLエスケープ
- CSP（Content Security Policy）対応
- インライン CSS/JS無効化
- ユーザー入力の完全サニタイゼーション

**XSS対策例**:

```javascript
// 全ての動的コンテンツをエスケープ
<title>Smart Review Report - ${SecurityUtils.escapeHtml(new Date().toISOString())}</title>

// 問題データのセキュア表示
<div class="issue-title">${SecurityUtils.escapeHtml(item.title)}</div>
<div class="issue-meta">
  ${item.file ? `📁 ${SecurityUtils.escapeHtml(item.file)}${item.line ? `:${item.line}` : ''}` : ''}
</div>
```

#### generateTodoContent() (内部関数)

セキュア化されたTODO生成

```javascript
function generateTodoContent(issues, priorityThreshold, previousTodo = '')
```

**セキュリティ機能**:
- 優先度フィルタリング
- HTMLエスケープ処理
- ファイルパスのサニタイゼーション
- 統計情報の安全な表示

**セキュア統計生成**:

```javascript
// セキュアな統計情報
todoContent += `対象: ${SecurityUtils.escapeHtml(target)}\n`;
todoContent += `検出された問題: ${filteredIssues.length}件\n\n`;

// 各TODO項目のセキュア表示
todoContent += `${index + 1}. [ ] ${SecurityUtils.escapeHtml(todoItem.title)}\n`;
if (todoItem.file) {
  todoContent += `   - ファイル: ${SecurityUtils.escapeHtml(todoItem.file)}`;
}
```

## データ構造

### ReviewResult (v2.0強化版)

```typescript
interface ReviewResult {
  success: boolean;                    // 実行成功フラグ
  context?: SecureExecutionContext;    // セキュア実行コンテキスト
  reportPath?: string;                 // 検証済みレポートパス
  outputDir?: string;                  // セキュア出力ディレクトリ
  error?: string;                      // サニタイズ済みエラーメッセージ
  message?: string;                    // セキュア状態メッセージ
}
```

### SecureExecutionContext (v2.0)

```typescript
interface SecureExecutionContext {
  scope: 'changes' | 'all';                      // 検証済みスコープ
  target: string;                                 // 検証済みターゲットパス
  startTime: string;                              // ISO8601タイムスタンプ
  changedFiles: string[];                         // 検証済みファイルパス配列
  allIssues: SanitizedIssue[];                   // サニタイズ済み問題配列
  todoList: SecureTodoItem[];                     // セキュアTODO項目
  iterations: SecureIterationResult[];           // セキュア反復結果
  finalCommentResult: SecureCommentResult | null; // セキュアコメント結果
  metrics: SecureMetrics;                         // セキュリティメトリクス
}
```

### SanitizedIssue (v2.0)

```typescript
interface SanitizedIssue {
  level: 'error' | 'warning' | 'info' | 'suggestion';  // 検証済みレベル
  message: string;                                      // HTMLエスケープ済みメッセージ
  file?: string;                                        // サニタイズ済みファイルパス
  line?: number;                                        // 検証済み行番号（1-1000000）
  type: string;                                         // 検証済みエラータイプ
  category: 'security' | 'bug' | 'quality' | 'documentation'; // 検証済みカテゴリ
  priority: 'critical' | 'high' | 'medium' | 'low';   // 検証済み優先度
  agentId: string;                                      // エスケープ済みエージェントID
  autoFixAvailable: boolean;                            // 自動修正可能フラグ
}
```

### SecureTodoItem (v2.0)

```typescript
interface SecureTodoItem {
  priority: 'critical' | 'high' | 'medium' | 'low';  // 検証済み優先度
  category: string;                                   // サニタイズ済みカテゴリ
  type: string;                                       // 検証済みタイプ
  title: string;                                      // HTMLエスケープ済みタイトル（100文字制限）
  description: string;                                // エスケープ済み説明
  file?: string;                                      // サニタイズ済みファイルパス
  line?: number;                                      // 検証済み行番号
  autoFixAvailable: boolean;                          // 自動修正可能フラグ
}
```

### SanitizedAgentResult (v2.0)

```typescript
interface SanitizedAgentResult {
  agentId: string;                          // HTMLエスケープ済みID
  agentName: string;                        // エスケープ済み名前
  issues: SanitizedIssue[];                // サニタイズ済み問題配列
  rawOutput: string;                        // エスケープ済み生出力
  executionTime: number;                    // 実行時間（ミリ秒）
  error?: string;                           // エスケープ済みエラーメッセージ
  sandboxId: string;                        // サンドボックス識別子
}
```

### SecureIterationResult (v2.0)

```typescript
interface SecureIterationResult {
  number: number;                           // 反復番号
  timestamp: string;                        // ISO8601タイムスタンプ
  changedFiles: string[];                   // 検証済み変更ファイル
  issuesFixed: number;                      // 修正された問題数
  newIssues: SanitizedIssue[];             // 新規検出問題
}
```

### SecureMetrics (v2.0)

```typescript
interface SecureMetrics {
  totalExecutionTime: number;               // 総実行時間（ミリ秒）
  filesAnalyzed: number;                    // 分析ファイル数
  issuesFound: number;                      // 検出問題数
  issuesFixed: number;                      // 修正問題数
  
  // セキュリティメトリクス
  securityViolations: number;               // セキュリティ違反数
  sanitizationEvents: number;               // サニタイゼーション実行回数
  sandboxExecutions: number;                // サンドボックス実行数
  cacheHits: number;                        // キャッシュヒット数
  cacheMisses: number;                      // キャッシュミス数
}
```

## イベント

v2.0では、セキュリティイベントとパフォーマンスメトリクスを含む包括的なイベントシステムを提供します。

### セキュリティイベント

#### security:violation

セキュリティ違反が検出されたとき

```javascript
logger.security('SECURITY_VIOLATION', {
  type: 'path_traversal_attempt',
  input: sanitizedInput,
  blocked: true,
  timestamp: new Date().toISOString()
});
```

#### security:command_blocked

危険なコマンド実行が阻止されたとき

```javascript
logger.security('COMMAND_BLOCKED', {
  command: attemptedCommand,
  reason: 'not_in_whitelist',
  source: 'user_input'
});
```

### エージェントイベント

#### agent:sandbox_created

エージェントサンドボックスが作成されたとき

```javascript
logger.agent('sandbox_created', {
  agentId: agent.id,
  sandboxId: sandbox.id,
  resourceLimits: sandbox.resourceLimits
});
```

#### agent:execution_completed

エージェント実行が完了したとき

```javascript
logger.agent(agent.name, 'execution_completed', {
  issuesFound: result.issues.length,
  executionTime: result.executionTime,
  sandboxId: result.sandboxId
});
```

### パフォーマンスイベント

#### performance:cache_hit

キャッシュヒットが発生したとき

```javascript
logger.performance('cache_access', cacheAccessTime, {
  result: 'hit',
  agentId: agent.id,
  cacheKey: cacheKey.substring(0, 8)
});
```

#### performance:parallel_execution

並列実行のパフォーマンスメトリクス

```javascript
logger.performance('parallel_execution', totalTime, {
  agentsExecuted: results.length,
  successfulAgents: successfulResults.length,
  failedAgents: failedResults.length
});
```

## エラーハンドリング

### セキュアエラークラス

v2.0では、すべてのエラーが自動的にサニタイズされ、セキュリティログに記録されます。

#### SanitizedError

```javascript
class SanitizedError extends Error {
  constructor(originalError) {
    const sanitized = SecurityUtils.sanitizeError(originalError);
    super(sanitized.message);
    this.code = sanitized.code;
    this.timestamp = sanitized.timestamp;
    this.sanitized = true;
  }
}
```

#### SecurityViolationError

```javascript
class SecurityViolationError extends SanitizedError {
  constructor(violation, details) {
    super(new Error(`Security violation: ${violation}`));
    this.violation = violation;
    this.details = SecurityUtils.sanitizeError(details);
  }
}
```

### エラーハンドリングパターン

#### 包括的エラー処理

```javascript
try {
  const result = await SecurityUtils.executeCommand('git', args);
  return result;
} catch (error) {
  const sanitized = SecurityUtils.sanitizeError(error);
  
  // セキュリティイベントとして記録
  logger.security('COMMAND_EXECUTION_FAILURE', {
    command: 'git',
    error: sanitized.message,
    timestamp: sanitized.timestamp
  });
  
  throw new SanitizedError(error);
}
```

#### エージェントエラー処理

```javascript
// エージェント実行でのエラー処理
try {
  const result = await sandbox.execute(files, iteration);
  return result;
} catch (error) {
  return {
    agentId: agent.id,
    agentName: agent.name,
    issues: [],
    rawOutput: '',
    executionTime: 0,
    error: SecurityUtils.sanitizeError(error).message,
    sandboxId: sandbox.id
  };
}
```

## 使用例

### 例1: セキュアなCI/CDインテグレーション

```javascript
const smartReviewV2 = require('./smart-review-v2');
const { StructuredLogger } = require('./lib/structured-logger');

async function secureCI() {
  const logger = new StructuredLogger();
  
  // セキュアなコンテキスト作成
  const secureContext = {
    files: createSecureFileSystem('./'),
    output: logger,
    terminal: createSandboxedTerminal()
  };
  
  // 検証済み引数
  const args = {
    scope: 'changes',
    'max-iterations': 3,
    'priority-threshold': 'critical',
    'skip-comment': true
  };
  
  try {
    // セキュアレビュー実行
    const result = await smartReviewV2.execute(secureContext, args);
    
    // セキュリティメトリクスのチェック
    const criticalIssues = result.context.allIssues.filter(
      issue => issue.priority === 'critical'
    );
    
    if (criticalIssues.length > 0) {
      logger.security('CRITICAL_ISSUES_DETECTED', {
        count: criticalIssues.length,
        types: [...new Set(criticalIssues.map(i => i.type))]
      });
      
      // CI/CDパイプラインを失敗させる
      process.exit(1);
    }
    
    logger.info('セキュアレビュー完了', {
      issuesFound: result.context.metrics.issuesFound,
      securityViolations: result.context.metrics.securityViolations,
      executionTime: result.context.metrics.totalExecutionTime
    });
    
  } catch (error) {
    const sanitized = SecurityUtils.sanitizeError(error);
    logger.security('REVIEW_EXECUTION_FAILED', sanitized);
    process.exit(1);
  }
}
```

### 例2: カスタムセキュリティ監査

```javascript
const { AgentSandbox, SecurityUtils, ResultCache } = require('./smart-review-v2');

async function customSecurityAudit() {
  const cache = new ResultCache();
  const logger = new StructuredLogger();
  
  // セキュリティ専用エージェント設定
  const securityAgent = {
    id: 'custom-security-auditor',
    name: 'カスタムセキュリティ監査',
    model: 'opus',
    category: 'security',
    priority: 'critical',
    allowedCommands: ['git']
  };
  
  const targetFiles = await SecurityUtils.executeCommand('find', [
    '.', '-name', '*.js', '-type', 'f'
  ]);
  
  // セキュアなファイルリスト処理
  const validatedFiles = targetFiles.stdout
    .split('\n')
    .filter(f => f.trim())
    .map(f => SecurityUtils.validatePath(f))
    .slice(0, 1000); // ファイル数制限
  
  // キャッシュチェック
  const cached = await cache.get(securityAgent, validatedFiles, 1);
  if (cached) {
    logger.performance('cache_hit', 0, {
      agentId: securityAgent.id,
      fileCount: validatedFiles.length
    });
    return cached;
  }
  
  // サンドボックス実行
  const sandbox = new AgentSandbox(securityAgent, secureContext);
  const result = await sandbox.execute(validatedFiles, 1);
  
  // 結果をキャッシュ
  await cache.set(securityAgent, validatedFiles, 1, result);
  
  // セキュリティ重要度別集計
  const securitySummary = {
    critical: result.issues.filter(i => i.priority === 'critical').length,
    high: result.issues.filter(i => i.priority === 'high').length,
    types: [...new Set(result.issues.map(i => i.type))]
  };
  
  logger.security('SECURITY_AUDIT_COMPLETED', {
    filesAudited: validatedFiles.length,
    issuesFound: result.issues.length,
    summary: securitySummary,
    executionTime: result.executionTime
  });
  
  return {
    summary: securitySummary,
    issues: result.issues,
    executionTime: result.executionTime
  };
}
```

### 例3: リアルタイムセキュリティ監視

```javascript
class RealTimeSecurityMonitor {
  constructor() {
    this.logger = new StructuredLogger();
    this.cache = new ResultCache();
    this.alertThresholds = {
      critical: 0,  // Critical問題は即座にアラート
      high: 3,      // High問題が3個以上でアラート
      securityViolations: 5  // セキュリティ違反が5回以上でアラート
    };
  }
  
  async monitorChanges() {
    setInterval(async () => {
      try {
        await this.performSecurityScan();
      } catch (error) {
        const sanitized = SecurityUtils.sanitizeError(error);
        this.logger.security('MONITORING_ERROR', sanitized);
      }
    }, 60000); // 1分間隔
  }
  
  async performSecurityScan() {
    const result = await smartReviewV2.execute(secureContext, {
      scope: 'changes',
      'priority-threshold': 'high',
      'max-iterations': 1
    });
    
    // アラート条件チェック
    const criticalIssues = result.context.allIssues.filter(
      i => i.priority === 'critical'
    );
    const highIssues = result.context.allIssues.filter(
      i => i.priority === 'high'
    );
    
    if (criticalIssues.length > this.alertThresholds.critical) {
      await this.sendSecurityAlert('CRITICAL_SECURITY_ISSUES', {
        count: criticalIssues.length,
        issues: criticalIssues.map(i => ({
          type: i.type,
          file: i.file,
          message: i.message
        }))
      });
    }
    
    if (highIssues.length > this.alertThresholds.high) {
      await this.sendSecurityAlert('HIGH_SECURITY_ISSUES', {
        count: highIssues.length,
        types: [...new Set(highIssues.map(i => i.type))]
      });
    }
    
    this.logger.security('SECURITY_SCAN_COMPLETED', {
      scanTime: result.context.metrics.totalExecutionTime,
      issuesFound: result.context.metrics.issuesFound,
      criticalCount: criticalIssues.length,
      highCount: highIssues.length
    });
  }
  
  async sendSecurityAlert(alertType, details) {
    this.logger.security('SECURITY_ALERT', {
      alertType,
      details,
      timestamp: new Date().toISOString(),
      severity: 'HIGH'
    });
    
    // 外部アラートシステムへの通知
    // await externalAlertSystem.notify(alertType, details);
  }
}

// 使用例
const monitor = new RealTimeSecurityMonitor();
await monitor.monitorChanges();
```

## セキュリティベストプラクティス

### 1. 入力検証の徹底

```javascript
// すべての入力を検証・サニタイズ
const validatedArgs = {
  scope: InputValidator.validateChoice(args.scope, ['changes', 'all']),
  target: SecurityUtils.validatePath(args.target),
  'max-iterations': InputValidator.validateNumber(args['max-iterations'], { 
    min: Config.MAX_ITERATIONS_RANGE.min, 
    max: Config.MAX_ITERATIONS_RANGE.max,
    integer: true
  }),
  'output-dir': SecurityUtils.validateOutputDirectory(args['output-dir']),
  'priority-threshold': InputValidator.validateChoice(args['priority-threshold'], 
    ['critical', 'high', 'medium', 'low'])
};
```

### 2. セキュアコマンド実行

```javascript
// ホワイトリスト方式でのコマンド実行
const result = await SecurityUtils.executeCommand('git', gitArgs, {
  timeout: Config.COMMAND_TIMEOUT,
  maxBuffer: Config.MAX_BUFFER,
  cwd: SecurityUtils.validatePath(cwd),
  shell: false  // シェル解釈を無効化
});
```

### 3. エージェントサンドボックス化

```javascript
// すべてのエージェントをサンドボックス内で実行
const sandbox = new AgentSandbox(agent, secureContext);
const result = await sandbox.execute(validatedFiles, iteration);

// 結果は自動的にサニタイズ済み
logger.info('エージェント完了', {
  agentId: result.agentId,
  issuesFound: result.issues.length,
  sandboxId: result.sandboxId
});
```

### 4. 構造化ログとセキュリティ監視

```javascript
// セキュリティイベントの記録
logger.security('COMMAND_EXECUTION', {
  command: 'git',
  args: sanitizedArgs,
  success: true,
  executionTime: Date.now() - startTime
});

// パフォーマンス監視
logger.performance('agent_execution', executionTime, {
  agentType: agent.category,
  filesAnalyzed: files.length,
  issuesFound: result.issues.length
});
```

### 5. キャッシングセキュリティ

```javascript
// セキュアなキャッシュ使用
const cache = new ResultCache();
const cacheKey = await cache.getCacheKey(agent, validatedFiles, iteration);

// キャッシュからの安全な取得
const cached = await cache.get(agent, validatedFiles, iteration);
if (cached) {
  logger.debug('キャッシュヒット', { 
    agentId: agent.id,
    cacheKey: cacheKey.substring(0, 8) + '...' // 部分表示
  });
  return cached;
}
```

### 6. エラー処理とサニタイゼーション

```javascript
// 包括的なエラー処理
try {
  const result = await SecurityUtils.executeCommand(command, args, options);
  return result;
} catch (error) {
  const sanitized = SecurityUtils.sanitizeError(error);
  
  // セキュリティイベントとして記録
  logger.security('COMMAND_EXECUTION_FAILURE', {
    command,
    error: sanitized.message,
    timestamp: sanitized.timestamp
  });
  
  throw new Error(sanitized.message);
}
```

### 7. リソース制限とDDoS対策

```javascript
// 並列実行制限
const maxConcurrency = Math.min(agents.length, 4);
const results = await ParallelExecutor.executeAgents(
  agents.slice(0, maxConcurrency),
  validatedFiles,
  secureContext,
  iteration
);

// メモリ使用量監視
const memoryUsage = process.memoryUsage();
if (memoryUsage.heapUsed > Config.MAX_MEMORY) {
  logger.security('MEMORY_LIMIT_EXCEEDED', {
    heapUsed: memoryUsage.heapUsed,
    limit: Config.MAX_MEMORY
  });
  throw new Error('Memory limit exceeded');
}
```

---

*最終更新: 2025-08-14*
*バージョン: 2.0.1 - Security Enhanced Edition with Config Management*
*セキュリティレビュー: 完了*
*コンプライアンス: OWASP Top 10 準拠*
*設定管理: smart-review-config.jsモジュール対応*