# 🤖 Smart Review 必要エージェント

Smart Review システムを完全に動作させるために、以下のClaude Codeエージェントが必要です。

## 📋 必要エージェント一覧

### 🛡️ セキュリティエージェント

#### 1. `security-error-xss-analyzer`
- **機能**: セキュリティ脆弱性検出、XSS分析、エラーハンドリング検証
- **優先度**: 🔴 **必須**
- **用途**: 
  - SQLインジェクション検出
  - XSS脆弱性分析
  - CSRF対策検証
  - 認証・認可チェック

#### 2. `super-debugger-perfectionist`
- **機能**: バグ検出、パフォーマンス最適化、ロジックエラー分析
- **優先度**: 🟠 **高**
- **用途**:
  - メモリリーク検出
  - レースコンディション分析
  - パフォーマンスボトルネック特定

#### 3. `deep-code-reviewer`
- **機能**: アーキテクチャ評価、コード品質分析、デザインパターン検証
- **優先度**: 🟡 **中**
- **用途**:
  - アーキテクチャレビュー
  - コードスメル検出
  - 複雑度分析
  - 重複コード検出

#### 4. `project-documentation-updater`
- **機能**: ドキュメント整合性チェック、不足ドキュメント検出
- **優先度**: 🟢 **低**
- **用途**:
  - ドキュメント不整合検出
  - APIドキュメント更新
  - README品質チェック

#### 5. `code-comment-annotator-ja`
- **機能**: 日本語コメント自動追加
- **優先度**: 🔵 **オプション**
- **用途**:
  - コードの日本語コメント化
  - 理解しやすいコード作成

## 🔧 エージェントのセットアップ

### 自動確認

Smart Review システムには、エージェントの存在をチェックする機能があります：

```bash
# システムテストでエージェント確認
claude-code smart-review --test
```

### 手動確認

```bash
# エージェントディレクトリの確認
ls ~/.claude/agents/

# 必要なエージェントファイルの確認
ls ~/.claude/agents/ | grep -E "(security-error-xss-analyzer|super-debugger-perfectionist|deep-code-reviewer|project-documentation-updater|code-comment-annotator-ja)"
```

## ⚙️ 設定による無効化

不要なエージェントは環境変数で無効化できます：

```bash
# .env ファイルで設定
SMART_REVIEW_DISABLED_AGENTS=project-documentation-updater,code-comment-annotator-ja
```

## 📊 エージェント別機能マトリックス

| エージェント | セキュリティ | パフォーマンス | 品質 | ドキュメント |
|-------------|-------------|---------------|------|-------------|
| security-error-xss-analyzer | ✅ 主機能 | ⚠️ 部分 | ⚠️ 部分 | - |
| super-debugger-perfectionist | ⚠️ 部分 | ✅ 主機能 | ✅ 主機能 | - |
| deep-code-reviewer | ⚠️ 部分 | ⚠️ 部分 | ✅ 主機能 | ⚠️ 部分 |
| project-documentation-updater | - | - | ⚠️ 部分 | ✅ 主機能 |
| code-comment-annotator-ja | - | - | ⚠️ 部分 | ⚠️ 部分 |

## 🚨 エージェント不足時の動作

### 部分動作モード

必要エージェントが不足している場合：

1. **警告表示**: 不足しているエージェントを通知
2. **部分実行**: 利用可能なエージェントのみで実行
3. **機能制限**: 該当する分析機能が無効化

### 最小構成

最低限の動作には以下が必要：

- ✅ `security-error-xss-analyzer` (セキュリティ分析)
- ✅ `super-debugger-perfectionist` (バグ分析)

## 💡 エージェント取得方法

Claude Code エージェントの取得方法：

1. **公式リポジトリ**: Claude Code 公式ドキュメント参照
2. **コミュニティ**: Claude Code コミュニティでの共有
3. **カスタム作成**: 独自エージェントの作成

## 🔗 関連ドキュメント

- [Claude Code エージェント作成ガイド](https://docs.anthropic.com/claude-code)
- [Smart Review 設定ガイド](./Smart-Review-SystemGuide.md)
- [カスタムエージェント設定](./smart-review-config.js)

---

**注意**: このリポジトリにはエージェントファイル自体は含まれていません。Smart Review はシステムにインストール済みのClaude Code エージェントを参照します。