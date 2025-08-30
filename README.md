# Smart Review System V2 - Claude Code スラッシュコマンド & インテリジェントコードレビュー自動化システム

*バージョン: v2.2.0*
*最終更新: 2025年08月16日 17:50 JST*

## 概要

Smart Review V2は、Claude Code CLIのスラッシュコマンドとして動作する、複数の専門AIエージェントを統合した高度なコードレビュー自動化ツールです。包括的なコード分析、セキュリティ監査、バグ検出、ドキュメントレビューを実行し、プロジェクト全体のスキャンと変更箇所のインクリメンタルレビューの両方をサポートします。自動修正機能も備えています。

🆕 **他のPCでも簡単に使える**: スラッシュコマンドとエージェントを自動登録する機能により、どのマシンでも同じ環境を簡単に構築できます。

## 🎯 V2の改善点

### 🏗️ アーキテクチャ改善
- **共通ユーティリティモジュール**: DRY原則に基づく再利用可能なコード
- **モジュラー設計**: 各機能が独立して動作し、テスト可能
- **エラーハンドリング強化**: 統一的なエラー処理とリカバリー機構

### 🧪 品質保証
- **包括的テストスイート**: 35個以上の自動テストケース
- **CI/CDパイプライン**: GitHub Actionsによる自動ビルド・テスト・デプロイ
- **コードカバレッジ測定**: テストカバレッジの可視化

### 🔐 セキュリティ強化
- **自動セキュリティスキャン**: 依存関係の脆弱性チェック
- **SAST実装**: 静的アプリケーションセキュリティテスト
- **シークレットスキャニング**: GitLeaks、detect-secretsによる機密情報検出
- **ライセンスコンプライアンス**: 自動ライセンスチェック

### 📚 ドキュメント充実
- **エラーリカバリーガイド**: 詳細なトラブルシューティング手順
- **統合テストドキュメント**: マルチプラットフォーム対応
- **APIドキュメント**: JSDoc対応

## 目次

- [機能](#機能)
- [インストール](#インストール)
- [クイックスタート](#クイックスタート)
- [APIドキュメント](#apiドキュメント)
- [使用例](#使用例)
- [アーキテクチャ](#アーキテクチャ)
- [設定ガイド](#設定ガイド)
- [トラブルシューティング](#トラブルシューティング)
- [セキュリティに関する考慮事項](#セキュリティに関する考慮事項)

## 機能

- **対話式インターフェース**: 🆕 初心者にも使いやすい対話式メニューシステム
- **マルチエージェントレビューシステム**: 4つの専門AIエージェントによる包括的な分析
- **デュアルレビューモード**: プロジェクト全体スキャンと変更差分検出の両方をサポート
- **自動問題修正**: 重要度が高い問題の自動修正機能
- **優先度ベースのフィルタリング**: 設定可能な問題優先度しきい値
- **TODOリスト生成**: 工数見積もり付きの自動タスクリスト作成
- **反復的改善**: 問題が解決されるまでの複数回レビュー反復
- **日本語コメント注釈**: オプションでコードに日本語ドキュメントを追加
- **詳細レポート**: メトリクス付きの包括的なHTMLおよびMarkdownレポート
- **ヘルプシステム**: 🆕 包括的なコマンドラインヘルプ（`--help`オプション）

## インストール

### 前提条件

- Node.js 14.0以上
- Git（変更検出機能用）
- Claude Code CLIがインストールおよび設定済み

### クイックセットアップ（推奨）

```bash
# リポジトリをクローン
git clone https://github.com/KEIEI-NET/smart-review-system.git
cd smart-review-system

# スラッシュコマンドとエージェントを自動登録
npm run register

# 動作確認
claude /smart-review --help
```

これだけで完了です！🎉

### 詳細セットアップ

#### 1. 初期化（全自動）
```bash
npm run init
```

#### 2. スラッシュコマンド登録
```bash
# コマンドを登録
npm run register

# 登録状況を確認
npm run register:status

# アンインストール
npm run unregister
```

#### 3. エージェント管理
```bash
# エージェントをインストール
npm run install-agents

# エージェント一覧
npm run list-agents

# エージェントをアンインストール
npm run uninstall-agents
```


## クイックスタート

### 🆕 スラッシュコマンドの使い方

Smart Reviewは Claude Code のスラッシュコマンドとして使用できます：

```bash
# 対話式メニューの起動
claude /smart-review

# エイリアスも使用可能
claude /review
claude /sr
```

### 対話式メニューの使い方（推奨）

最も簡単な使用方法は、オプションを指定せずにコマンドを実行することです：

```bash
claude /smart-review
```

これにより、以下の対話式メニューが表示されます：

```
🔍 Smart Review v2.0 - 対話式メニュー

実行したい操作を選択してください:

1. 🔄 変更点のクイックレビュー
2. 🔍 プロジェクト全体のスキャン
3. 🛡️ セキュリティ監査
4. ⚡ 高優先度問題のみ
5. 🎯 カスタム設定
6. 📖 ヘルプ表示
```

#### メニューオプションの詳細

1. **🔄 変更点のクイックレビュー**
   - 前回チェック以降の変更点を素早くレビュー
   - 設定: `scope=changes`, `priority-threshold=medium`, `max-iterations=3`
   - 用途: 日常的な開発中のチェック

2. **🔍 プロジェクト全体のスキャン**
   - プロジェクト全体を包括的にスキャン
   - 設定: `scope=all`, `priority-threshold=medium`, `max-iterations=1`
   - 用途: 初回実行時や大規模リファクタリング後

3. **🛡️ セキュリティ監査**
   - セキュリティ脆弱性に特化した監査
   - 設定: `scope=all`, `priority-threshold=critical`, `max-iterations=2`
   - 用途: リリース前のセキュリティチェック

4. **⚡ 高優先度問題のみ**
   - critical/high優先度の問題のみをチェック
   - 設定: `scope=changes`, `priority-threshold=high`, `max-iterations=5`
   - 用途: 重要な問題のみに集中したい場合

5. **🎯 カスタム設定**
   - 詳細なオプション設定でレビュー実行
   - 以下の項目を順次設定可能（詳細は後述）

6. **📖 ヘルプ表示**
   - 詳細なヘルプとオプション一覧を表示

#### カスタム設定モードの詳細手順

「🎯 カスタム設定」を選択すると、以下の項目を順番に設定できます：

**ステップ1: チェック範囲の選択**
```
チェック範囲:
1. 変更点のみ (changes)
2. プロジェクト全体 (all)
```

**ステップ2: 対象ディレクトリの入力**
```
対象ディレクトリ: [デフォルト: .]
> ./src
```
- 相対パスまたは絶対パスを入力
- Enterでデフォルト値を選択

**ステップ3: 優先度しきい値の選択**
```
優先度しきい値:
1. 重大な問題のみ (critical)
2. 高優先度以上 (high)
3. 中優先度以上 (medium)
4. すべての問題 (low)
```

**ステップ4: 最大繰り返し回数の入力**（changesモードのみ）
```
最大繰り返し回数: [デフォルト: 5]
> 3
```
- 1〜10の範囲で入力
- 自動修正の繰り返し回数を指定

**ステップ5: コメント注釈のスキップ確認**
```
コメント注釈をスキップしますか? (y/N)
> n
```
- y: 日本語コメント注釈をスキップ（CI環境推奨）
- n: コメント注釈を実行（デフォルト）

**ステップ6: 出力ディレクトリの入力**
```
出力ディレクトリ: [デフォルト: ./smart-review-results]
> ./reports
```
- レポートの保存先を指定

### コマンドラインでの使い方

従来通り、コマンドラインオプションでの実行も可能です：

```bash
# ヘルプの表示
claude smart-review --help

# 前回のチェック以降のすべての変更をレビュー
claude smart-review --scope changes

# プロジェクト全体のスキャン
claude smart-review --scope all

# 特定ディレクトリのレビュー
claude smart-review --target ./src

# カスタム優先度しきい値でレビュー
claude smart-review --priority-threshold high

# 複数オプションの組み合わせ
claude smart-review --scope all --target ./src --priority-threshold critical
```

## 🤖 エージェント管理

### エージェントのインストール

```bash
# すべてのエージェントをインストール
npm run install-agents

# または直接実行
node install-agents.js
```

### エージェントの管理

```bash
# インストール済みエージェントの一覧表示
npm run list-agents

# エージェントのアンインストール
npm run uninstall-agents

# エージェント状態の確認
claude smart-review --test
```

### 個別エージェントの制御

```bash
# 特定エージェントを無効化（環境変数で設定）
export SMART_REVIEW_DISABLED_AGENTS="project-documentation-updater,code-comment-annotator-ja"

# または .env ファイルで設定
echo "SMART_REVIEW_DISABLED_AGENTS=project-documentation-updater,code-comment-annotator-ja" >> .env
```

## APIドキュメント

### モジュールエクスポート

```javascript
module.exports = {
  name: 'smart-review',
  description: '変更点または全体をチェックし、修正またはTODOリストを生成',
  options: [...],
  execute: async (context, args) => {...}
}
```

### オプションリファレンス

| オプション | 型 | デフォルト | 説明 |
|-----------|-----|-----------|------|
| `scope` | `'changes' \| 'all'` | `'changes'` | レビュー範囲 - 変更差分または全プロジェクト |
| `target` | `string` | `'.'` | レビュー対象のディレクトリパス |
| `todo-file` | `string` | `'./TODO.md'` | 変更追跡用の既存TODOファイルへのパス |
| `max-iterations` | `number` | `5` | changesモードの最大反復回数 |
| `output-dir` | `string` | `'./smart-review-results'` | 結果の出力ディレクトリ |
| `skip-comment` | `boolean` | `false` | 日本語コメント注釈をスキップ |
| `priority-threshold` | `'critical' \| 'high' \| 'medium' \| 'low'` | `'medium'` | TODO項目に含める最小優先度レベル |
| `help` | `boolean` | `false` | 🆕 ヘルプメッセージを表示 |

### 戻り値

```typescript
interface ReviewResult {
  success: boolean;
  context?: ExecutionContext;
  reportPath?: string;
  outputDir?: string;
  error?: string;
  message?: string;
}

interface ExecutionContext {
  scope: 'changes' | 'all';
  target: string;
  startTime: string;
  changedFiles: string[];
  allIssues: Issue[];
  todoList: TodoItem[];
  iterations: IterationResult[];
  finalCommentResult: CommentResult | null;
  metrics: {
    totalExecutionTime: number;
    filesAnalyzed: number;
    issuesFound: number;
    issuesFixed: number;
  };
}
```

### エラー条件

- **Gitリポジトリが見つからない**: 警告を返し、フルスキャンをデフォルトとする
- **エージェント実行失敗**: エラーをログに記録し、残りのエージェントで続行
- **変更ファイルが検出されない**: "変更なし"メッセージで成功を返す
- **ファイルシステムエラー**: 説明的なエラーメッセージでスロー

## 使用例

### 例1: 基本的な変更レビュー

```javascript
// デフォルト設定で変更をレビュー
const result = await execute(context, {
  scope: 'changes',
  target: '.',
  'todo-file': './TODO.md',
  'max-iterations': 5,
  'output-dir': './smart-review-results',
  'skip-comment': false,
  'priority-threshold': 'medium'
});

if (result.success) {
  console.log(`レポート生成完了: ${result.reportPath}`);
}
```

### 例2: プロジェクト全体のセキュリティ監査

```javascript
// セキュリティに焦点を当てた包括的レビュー
const result = await execute(context, {
  scope: 'all',
  target: './src',
  'priority-threshold': 'critical',
  'output-dir': './security-audit'
});

// セキュリティ問題へのアクセス
const securityIssues = result.context.allIssues
  .filter(issue => issue.category === 'security');
```

### 例3: CI/CD統合の自動化

```javascript
// 自動修正付きのCIパイプライン統合
const result = await execute(context, {
  scope: 'changes',
  'max-iterations': 3,
  'priority-threshold': 'high',
  'skip-comment': true  // CIではコメントをスキップ
});

// 重大な問題のチェック
const hasCritical = result.context.todoList
  .some(item => item.priority === 'critical');

if (hasCritical) {
  process.exit(1);  // CIビルドを失敗させる
}
```

### 例4: カスタムエージェント設定

```javascript
// エージェント設定のオーバーライド
const customAgents = [
  {
    id: 'custom-security-agent',
    name: 'カスタムセキュリティスキャナー',
    model: 'opus',
    path: '/path/to/agent',
    role: 'カスタムセキュリティチェック',
    category: 'security',
    errorTypes: ['custom-vuln'],
    canAutoFix: false,
    priority: 'critical'
  }
];

// 注: カスタムエージェントにはモジュールの修正が必要
```

## アーキテクチャ

### システムアーキテクチャ概要

```
┌─────────────────────────────────────────────────────────┐
│                   Smart Reviewシステム                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐     ┌──────────────┐                 │
│  │ 変更検出      │     │ フルプロジェクト│                 │
│  │              │     │ スキャナー    │                 │
│  └──────┬───────┘     └──────┬───────┘                 │
│         │                     │                         │
│         └──────────┬──────────┘                         │
│                    ▼                                    │
│         ┌──────────────────┐                           │
│         │ エージェント        │                           │
│         │ オーケストレーター  │                           │
│         └──────────────────┘                           │
│                    │                                    │
│      ┌─────────────┼─────────────┐                     │
│      ▼             ▼             ▼                     │
│ ┌─────────┐  ┌─────────┐  ┌─────────┐                │
│ │セキュリティ│  │ デバッグ │  │ 品質    │                │
│ │ エージェント│  │ エージェント│  │ エージェント│                │
│ └─────────┘  └─────────┘  └─────────┘                │
│                    │                                    │
│         ┌──────────┴──────────┐                        │
│         ▼                     ▼                        │
│   ┌──────────┐          ┌──────────┐                  │
│   │ 問題      │          │ TODO     │                  │
│   │ プロセッサー│          │ ジェネレーター│                  │
│   └──────────┘          └──────────┘                  │
│         │                     │                        │
│         └──────────┬──────────┘                        │
│                    ▼                                    │
│         ┌──────────────────┐                           │
│         │ レポートジェネレーター │                           │
│         └──────────────────┘                           │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### エージェントアーキテクチャ

システムは4つの専門AIエージェントを使用し、それぞれ異なる責任を持っています：

#### 1. セキュリティ&XSSアナライザー
- **モデル**: Sonnet
- **優先度**: Critical
- **機能**: XSS、SQLインジェクション、CSRF、認証バイパス、データ露出の検出
- **自動修正**: 有効

#### 2. スーパーデバッガー（完璧主義者）
- **モデル**: Sonnet
- **優先度**: High
- **機能**: バグ検出、ロジックエラー、メモリリーク、パフォーマンス問題、レースコンディション
- **自動修正**: 有効

#### 3. ディープコードレビュアー
- **モデル**: Opus
- **優先度**: Medium
- **機能**: アーキテクチャ分析、デザインパターン、コードスメル、複雑性、重複
- **自動修正**: 無効

#### 4. プロジェクトドキュメントアップデーター
- **モデル**: Opus
- **優先度**: Low
- **機能**: 不足ドキュメント、古いドキュメント、矛盾したドキュメント、不明瞭なドキュメント
- **自動修正**: 有効

### データフロー

1. **入力フェーズ**: コマンド引数の解析と実行コンテキストの初期化
2. **検出フェーズ**: 
   - 変更モード: Git差分分析による修正ファイルの識別
   - 全体モード: 完全なディレクトリトラバーサル
3. **分析フェーズ**: 問題収集を伴う順次エージェント実行
4. **処理フェーズ**: 
   - 優先度フィルタリング
   - 問題の分類
   - 工数見積もり
5. **修正フェーズ**（変更モードのみ）:
   - 反復的な自動修正試行
   - 修正後の再検証
6. **出力フェーズ**: 
   - TODOリスト生成
   - レポートのコンパイル
   - ファイルシステムへの永続化

## 設定ガイド

### 環境設定

#### 設定管理モジュールの使用

Smart Review v2.0では、`smart-review-config.js`モジュールによる一元的な設定管理を提供します：

```javascript
const { configManager } = require('./smart-review-config');

// 設定の読み込み
const agents = await configManager.getAgents();
const security = await configManager.getSecuritySettings();
const performance = await configManager.getPerformanceSettings();

// プロジェクト固有の設定ファイル作成
await configManager.createProjectConfig();
```

#### 設定ファイルの優先順位

1. 環境変数 `SMART_REVIEW_CONFIG` で指定されたパス
2. プロジェクトディレクトリの `.smart-review.json`
3. ホームディレクトリの `~/.claude/smart-review.json`
4. ホームディレクトリの `~/.config/smart-review.json`
5. デフォルト設定

#### 環境変数による設定

```bash
# エージェントパスの指定
export CLAUDE_AGENTS_PATH="~/.claude/agents"

# 特定エージェントの無効化
export SMART_REVIEW_DISABLED_AGENTS="documentation-updater,deep-code-reviewer"

# パフォーマンス設定
export SMART_REVIEW_MAX_CONCURRENCY=2
export SMART_REVIEW_CACHE=false
```

### 優先度設定

優先度システムは4つのレベルを使用：

```javascript
const priorityLevels = {
  critical: 0,  // 即座の対応が必要
  high: 1,      // 緊急の修正が必要
  medium: 2,    // 計画的な改善
  low: 3        // あると良い
};
```

### 工数見積もり設定

```javascript
const effortMatrix = {
  critical: {
    security: '2h',
    bug: '1h',
    quality: '3h',
    documentation: '30m'
  },
  high: {
    security: '1h',
    bug: '30m',
    quality: '2h',
    documentation: '20m'
  },
  medium: {
    security: '30m',
    bug: '20m',
    quality: '1h',
    documentation: '15m'
  },
  low: {
    security: '15m',
    bug: '10m',
    quality: '30m',
    documentation: '10m'
  }
};
```

### カスタム問題パターン設定

```javascript
const issuePatterns = {
  error: /(?:ERROR|エラー|🔴):\s*(.+?)(?:\n|$)/gi,
  warning: /(?:WARNING|警告|🟡):\s*(.+?)(?:\n|$)/gi,
  info: /(?:INFO|情報|🔵):\s*(.+?)(?:\n|$)/gi,
  suggestion: /(?:SUGGESTION|提案|💡):\s*(.+?)(?:\n|$)/gi
};
```

## トラブルシューティング

### よくある問題と解決策

#### 1. エージェントが見つからないエラー

**問題**: `Error: Agent 'security-error-xss-analyzer' not found`

**解決策**:
```bash
# エージェントのインストールを確認
claude agent list

# 不足しているエージェントをインストール
claude agent install security-error-xss-analyzer

# smart-review.jsのエージェントパスを更新
```

#### 2. Gitリポジトリ検出の失敗

**問題**: `Warning: Git差分の取得に失敗しました`

**解決策**:
```bash
# Gitリポジトリを初期化
git init

# 初期コミットを作成
git add .
git commit -m "Initial commit"

# smart-reviewを再試行
claude smart-review --scope changes
```

#### 3. メモリ/パフォーマンスの問題

**問題**: フルスキャン中にシステムが応答しなくなる

**解決策**:
```javascript
// スコープを減らす
--target ./src/specific-module

// 優先度しきい値を下げる
--priority-threshold high

// バッチ処理（修正が必要）
```

#### 4. 自動修正の失敗

**問題**: 自動修正の試行が繰り返し失敗する

**解決策**:
```bash
# 最大反復回数を減らす
--max-iterations 2

# デバッグのために自動修正をスキップ
--scope all  # フルスキャンモードを使用

# TODOリストに基づいて手動修正
```

### デバッグモード

トラブルシューティング用の詳細ログを有効化：

```javascript
// execute関数に追加
const DEBUG = process.env.SMART_REVIEW_DEBUG === 'true';

if (DEBUG) {
  console.log('実行コンテキスト:', executionContext);
  console.log('エージェント出力:', result.rawOutput);
}
```

### エラーメッセージリファレンス

| エラーコード | メッセージ | 原因 | 解決策 |
|-------------|-----------|------|--------|
| `SR001` | エージェント実行失敗 | エージェントバイナリが見つからない | エージェントを再インストール |
| `SR002` | ファイルシステムエラー | アクセス拒否 | ファイル権限を確認 |
| `SR003` | Git操作失敗 | Gitリポジトリではない | Gitを初期化 |
| `SR004` | 無効な設定 | 不正なオプション | オプション構文を確認 |
| `SR005` | タイムアウト超過 | 長時間の分析 | タイムアウトを増やすかスコープを減らす |

## セキュリティに関する考慮事項

### 既知の脆弱性

セキュリティ分析に基づいて、以下の脆弱性が特定されています：

#### 1. コマンドインジェクションリスク（重大）

**脆弱性**: ユーザー制御入力がシェルコマンドに直接渡される

**場所**: 172、196、245、669行目

**例**:
```javascript
const gitCommand = `git diff --name-only --since="${lastCheckTime.toISOString()}"`;
// lastCheckTimeにシェルメタ文字が含まれている場合、脆弱
```

**軽減策**:
```javascript
// パラメータ化コマンドを使用するか、シェル引数をエスケープ
const { execFile } = require('child_process');
execFile('git', ['diff', '--name-only', '--since', lastCheckTime.toISOString()], 
  (error, stdout) => { /* ... */ });
```

#### 2. パストラバーサルリスク（高）

**脆弱性**: ユーザー入力の未検証ファイルパス

**場所**: 22-24、559、687行目

**例**:
```javascript
const target = args.target;  // '../../../etc/passwd'の可能性
```

**軽減策**:
```javascript
const sanitizedPath = path.resolve(process.cwd(), target);
if (!sanitizedPath.startsWith(process.cwd())) {
  throw new Error('無効なターゲットパス');
}
```

#### 3. 任意ファイル書き込み（高）

**脆弱性**: ユーザー入力に基づく制御されていないファイル書き込み

**場所**: 559、687行目

**軽減策**:
```javascript
// 出力ディレクトリを検証
const outputDir = path.resolve(args['output-dir']);
const allowedDir = path.resolve('./smart-review-results');
if (!outputDir.startsWith(allowedDir)) {
  throw new Error('出力ディレクトリは許可されたパス内でなければなりません');
}
```

#### 4. 情報漏洩（中）

**脆弱性**: エラーメッセージとログに機密情報

**場所**: エラー処理全体

**軽減策**:
```javascript
// エラーメッセージをサニタイズ
catch (error) {
  const sanitizedError = error.message.replace(/C:\\Users\\[^\\]+/g, '<user-dir>');
  output.error(`エラー: ${sanitizedError}`);
}
```

### セキュリティベストプラクティス

1. **入力検証**
   - ユーザー入力を常に検証およびサニタイズ
   - ファイルパスとコマンドにホワイトリストを使用
   - パストラバーサル防止を実装

2. **コマンド実行**
   - 文字列連結の代わりにパラメータ化コマンドを使用
   - 可能な限りシェル解釈を避ける
   - コマンドタイムアウトメカニズムを実装

3. **ファイル操作**
   - ファイル操作をプロジェクトディレクトリに制限
   - ファイル拡張子とサイズを検証
   - 書き込み権限チェックを実装

4. **エージェントセキュリティ**
   - 最小権限でエージェントを実行
   - エージェント実行環境を分離
   - 処理前にエージェント出力を検証

5. **ログと監視**
   - ログ内の機密情報をサニタイズ
   - セキュリティイベントの監査ログを実装
   - 疑わしいパターンを監視

### 推奨セキュリティ強化

```javascript
// 1. 入力サニタイズユーティリティ
function sanitizeInput(input, type = 'path') {
  if (type === 'path') {
    // 危険な文字を削除
    return input.replace(/[;&|`$]/g, '');
  }
  if (type === 'command') {
    // シェルメタ文字をエスケープ
    return input.replace(/(['"\s;&|`$])/g, '\\$1');
  }
  return input;
}

// 2. セキュアコマンド実行
async function executeSecure(command, args = []) {
  const { execFile } = require('child_process');
  const { promisify } = require('util');
  const exec = promisify(execFile);
  
  return await exec(command, args, {
    timeout: 60000,  // 1分のタイムアウト
    maxBuffer: 10 * 1024 * 1024,  // 最大10MBの出力
    shell: false  // シェル解釈を無効化
  });
}

// 3. パス検証
function validatePath(userPath, baseDir) {
  const resolved = path.resolve(baseDir, userPath);
  if (!resolved.startsWith(path.resolve(baseDir))) {
    throw new Error('パストラバーサルが検出されました');
  }
  return resolved;
}
```

## パフォーマンス最適化

### 最適化のヒント

1. **スコープの削減**
   - `--target`を使用して特定ディレクトリに焦点を当てる
   - `--priority-threshold`を増やして問題数を減らす
   - CI/CDパイプラインでは`--skip-comment`を使用

2. **キャッシュ戦略**
   - 反復間でエージェント結果をキャッシュ
   - 変更されていないファイルをスキップするためにファイルハッシュを保存
   - インクリメンタル分析を実装

3. **並列処理**
   - 独立したエージェントを同時実行
   - 複数ファイルを並列処理
   - 重い計算にはワーカースレッドを使用

4. **リソース管理**
   - エージェントのメモリ制限を実装
   - 大きなファイル処理にストリーミングを使用
   - 各反復後に一時ファイルをクリーンアップ

## 貢献

貢献を歓迎します！以下のガイドラインに従ってください：

1. リポジトリをフォーク
2. フィーチャーブランチを作成
3. 新機能のテストを追加
4. ドキュメントを更新
5. プルリクエストを送信

## ライセンス

このプロジェクトは独自ソフトウェアです。全権利留保。

## サポート

問題、質問、サポートについて：

### 🐛 バグ報告・機能要求
- **GitHub Issues**: https://github.com/KEIEI-NET/smart-review-system/issues
- **セキュリティ報告**: [SECURITY.md](./SECURITY.md) を参照

### 📚 ドキュメント
- **メインガイド**: [README.md](./README.md)
- **エージェント設定**: [AGENTS.md](./AGENTS.md)  
- **システム運用**: [Smart-Review-SystemGuide.md](./Smart-Review-SystemGuide.md)
- **貢献ガイド**: [CONTRIBUTING.md](./CONTRIBUTING.md)

### 🤝 貢献・コミュニティ
- **プルリクエスト**: https://github.com/KEIEI-NET/smart-review-system/pulls
- **ディスカッション**: https://github.com/KEIEI-NET/smart-review-system/discussions
- **Wiki**: https://github.com/KEIEI-NET/smart-review-system/wiki

### ⚡ クイックヘルプ
```bash
# システムテストでトラブルシューティング
claude smart-review --test

# 対話式メニューでガイド付き実行
claude smart-review

# 詳細ヘルプ表示
claude smart-review --help
```

---

*最終更新: 2025年08月16日 10:30 JST*
*バージョン: v2.1.0*

**更新履歴:**
- v2.1.0 (2025年08月16日): Claude Code スラッシュコマンド登録機能追加、他PCでの環境構築を簡易化
- v2.0.2 (2025年08月14日): ドキュメントバージョン管理システムを導入、JST統一
- v2.0.1 (2025年08月14日): エージェント自動インストール機能追加
- v2.0.0 (2025年08月13日): Smart Review v2.0 対話式メニューシステム実装