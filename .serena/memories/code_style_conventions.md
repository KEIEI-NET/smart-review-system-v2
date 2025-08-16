# Smart Review System - コードスタイルと規約

## ESLint設定
- **Base**: Standard JavaScript style
- **Security**: eslint-plugin-security による追加セキュリティルール
- **Environment**: Node.js ES2021

## セキュリティルール（強制）
- `security/detect-object-injection`: error - オブジェクトインジェクション検出
- `security/detect-non-literal-fs-filename`: warn - 非リテラルファイル名検出
- `security/detect-child-process`: error - 子プロセス実行検出
- `security/detect-eval-with-expression`: error - eval実行検出
- `security/detect-buffer-noassert`: error - バッファnoassert検出
- `security/detect-pseudoRandomBytes`: error - 疑似乱数バイト検出

## セキュリティファースト開発パターン
1. **ファイル操作**: `SecurityUtils.validatePath()`を必須使用
2. **コマンド実行**: `SecurityUtils.executeCommand()`のみ使用
3. **入力処理**: すべての入力をサニタイゼーション
4. **エラーメッセージ**: 機密情報漏洩防止のためサニタイズ

## 命名規則
- **クラス**: PascalCase (例: `SecurityUtils`, `AgentSandbox`)
- **関数/メソッド**: camelCase (例: `validatePath`, `executeCommand`)
- **定数**: UPPER_SNAKE_CASE (例: `MAX_FILE_SIZE`)
- **ファイル**: kebab-case (例: `smart-review-v2.js`)

## ドキュメント規約
- **バージョン管理**: セマンティックバージョニング
- **タイムスタンプ**: 日本時間（JST）形式
- **更新履歴**: すべてのドキュメントに必須

## エラーハンドリング
- **構造化エラー**: セキュリティ対応サニタイゼーション
- **監査ログ**: セキュリティイベントの記録
- **グレースフル劣化**: エージェント利用不可時の対応