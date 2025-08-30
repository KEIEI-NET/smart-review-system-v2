# Smart Review System インストールガイド

*バージョン: v1.0.0*  
*最終更新: 2025年01月15日 10:45 JST*

## 📋 目次

1. [システム要件](#システム要件)
2. [クイックインストール](#クイックインストール)
3. [詳細インストール手順](#詳細インストール手順)
4. [エージェントのインストール](#エージェントのインストール)
5. [設定ファイルのセットアップ](#設定ファイルのセットアップ)
6. [動作確認](#動作確認)
7. [トラブルシューティング](#トラブルシューティング)
8. [アンインストール](#アンインストール)

## システム要件

### 必須要件

| 項目 | 要件 | 確認コマンド |
|------|------|------------|
| **Node.js** | v14.0.0以上 | `node --version` |
| **npm** | v6.0.0以上 | `npm --version` |
| **Git** | v2.0.0以上 | `git --version` |
| **Claude Code** | 最新版 | `claude --version` |

### 対応OS

- ✅ Windows 10/11
- ✅ macOS 10.15以上
- ✅ Linux (Ubuntu 20.04以上、CentOS 8以上)

### 推奨スペック

- **CPU**: 2コア以上
- **メモリ**: 4GB以上
- **ディスク**: 500MB以上の空き容量

## クイックインストール

最も簡単なインストール方法（全自動セットアップ）:

```bash
# リポジトリのクローン
git clone https://github.com/KEIEI-NET/smart-review-system.git
cd smart-review-system

# 自動インストール実行
node init-smart-review.js
```

これで完了です！🎉

## 詳細インストール手順

### ステップ1: リポジトリのクローン

```bash
# HTTPSでクローン（推奨）
git clone https://github.com/KEIEI-NET/smart-review-system.git

# またはSSHでクローン
git clone git@github.com:KEIEI-NET/smart-review-system.git

# ディレクトリに移動
cd smart-review-system
```

### ステップ2: 依存関係のインストール

```bash
# package.jsonが存在する場合
npm install

# または手動でインストール
npm init -y
```

### ステップ3: 初期セットアップの実行

```bash
# 初期化スクリプトを実行
node init-smart-review.js
```

このスクリプトは以下を自動的に行います：

1. ✅ 環境チェック（Node.js、Git、Claude Code）
2. ✅ 必要なディレクトリの作成
3. ✅ グローバルコマンドのリンク
4. ✅ 設定ファイルの生成
5. ✅ .gitignoreの更新
6. ✅ package.jsonへのスクリプト追加
7. ✅ エージェントのインストール
8. ✅ 初期TODOリストの作成

### ステップ4: Windows管理者権限（Windowsユーザーのみ）

Windowsでシンボリックリンクを作成する場合：

```powershell
# PowerShellを管理者として実行
# スタートメニュー → PowerShell → 右クリック → 管理者として実行

# インストールスクリプトを再実行
node init-smart-review.js
```

## エージェントのインストール

### 自動インストール

初期セットアップで自動的にインストールされますが、個別にインストールする場合：

```bash
# エージェントインストーラーを実行
node install-agents.js

# または個別にインストール
node install-agents.js install
```

### インストールされるエージェント

1. **security-error-xss-analyzer** - セキュリティ脆弱性検出
2. **super-debugger-perfectionist** - 完璧主義デバッガー
3. **deep-code-reviewer** - 深層コードレビュー
4. **project-documentation-updater** - ドキュメント更新
5. **code-comment-annotator-ja** - 日本語コメント追加

### エージェントの確認

```bash
# インストール済みエージェントの一覧表示
node install-agents.js list

# または
ls -la ~/.claude/agents/
```

## 設定ファイルのセットアップ

### 設定ファイルの場所

設定ファイル `.smart-review.json` は以下の優先順位で読み込まれます：

1. `./smart-review.json` (プロジェクトルート)
2. `~/.claude/smart-review.json` (ユーザーホーム)
3. `~/.config/smart-review.json` (設定ディレクトリ)

### 基本設定ファイルの例

```json
{
  "agents": [
    {
      "id": "security-error-xss-analyzer",
      "name": "セキュリティアナライザー",
      "enabled": true,
      "priority": "critical"
    },
    {
      "id": "super-debugger-perfectionist",
      "name": "スーパーデバッガー",
      "enabled": true,
      "priority": "high"
    }
  ],
  "security": {
    "allowedPaths": ["./"],
    "blockedPatterns": ["node_modules", ".git", "dist"]
  },
  "performance": {
    "maxConcurrency": 4,
    "cacheEnabled": true
  }
}
```

### 環境変数の設定

```bash
# エージェントのパス指定
export CLAUDE_AGENTS_PATH="$HOME/.claude/agents"

# 特定エージェントの無効化
export SMART_REVIEW_DISABLED_AGENTS="agent1,agent2"

# 並行実行数の設定
export SMART_REVIEW_MAX_CONCURRENCY=4

# キャッシュの無効化
export SMART_REVIEW_CACHE=false
```

## 動作確認

### インストール確認

```bash
# ヘルプの表示
node smart-review-v2.js --help

# バージョン確認
node smart-review-v2.js --version

# システムテスト
node smart-review-v2.js --test
```

### 基本的な実行テスト

```bash
# 変更ファイルのレビュー
node smart-review-v2.js --scope changes

# 全ファイルのスキャン
node smart-review-v2.js --scope all

# 対話式メニュー
node smart-review-v2.js
```

### npm スクリプトでの実行

```bash
# package.jsonに登録されたスクリプトを使用
npm run review          # 標準レビュー
npm run review:quick    # クイックレビュー
npm run review:security # セキュリティ監査
npm run review:fix      # 自動修正モード
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. Claude Codeが見つからない

```bash
# エラー: claude command not found

# 解決方法:
# Claude Codeをインストール
npm install -g @anthropic/claude-code
```

#### 2. 権限エラー（Windows）

```powershell
# エラー: EPERM: operation not permitted

# 解決方法:
# PowerShellを管理者権限で実行
# またはシンボリックリンク作成をスキップ
```

#### 3. エージェントが見つからない

```bash
# エラー: Agent not found

# 解決方法:
node install-agents.js install
```

#### 4. 設定ファイルエラー

```bash
# エラー: Invalid configuration

# 解決方法:
# 設定ファイルのJSON構文を確認
node smart-review-config.js validate
```

### デバッグモード

```bash
# デバッグ情報を表示
export SMART_REVIEW_DEBUG=true
node smart-review-v2.js --scope all

# Windowsの場合
set SMART_REVIEW_DEBUG=true
node smart-review-v2.js --scope all
```

## アンインストール

### 完全アンインストール

```bash
# エージェントの削除
node install-agents.js uninstall

# 設定ファイルの削除
rm -f .smart-review.json
rm -rf ~/.claude/smart-review.json
rm -rf ~/.config/smart-review.json

# キャッシュの削除
rm -rf .smart-review-cache/

# 結果ディレクトリの削除
rm -rf smart-review-results/

# npmスクリプトの削除（手動で編集）
# package.jsonから review関連のスクリプトを削除
```

### 部分的アンインストール

```bash
# 特定のエージェントのみ削除
rm ~/.claude/agents/agent-name.md

# キャッシュのみクリア
rm -rf .smart-review-cache/*
```

## 次のステップ

インストールが完了したら：

1. 📖 [README.md](README.md) - システムの概要と使い方
2. 📚 [Smart-Review-SystemGuide.md](Smart-Review-SystemGuide.md) - 詳細な使用ガイド
3. 🔒 [SECURITY.md](SECURITY.md) - セキュリティガイドライン
4. 🏗️ [ARCHITECTURE.md](ARCHITECTURE.md) - システムアーキテクチャ
5. 🤖 [AGENTS.md](AGENTS.md) - エージェントの詳細

## サポート

問題が解決しない場合：

- 📧 Issues: [GitHub Issues](https://github.com/KEIEI-NET/smart-review-system/issues)
- 📝 Wiki: [GitHub Wiki](https://github.com/KEIEI-NET/smart-review-system/wiki)
- 💬 Discussions: [GitHub Discussions](https://github.com/KEIEI-NET/smart-review-system/discussions)

---

*最終更新: 2025年01月15日 10:45 JST*  
*バージョン: v1.0.0*

**更新履歴:**
- v1.0.0 (2025年01月15日): 初版作成、詳細なインストール手順を記載