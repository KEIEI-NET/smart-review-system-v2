# Smart Review System - 推奨コマンド

## 開発時に使用するコマンド

### 初期化とセットアップ
```bash
npm run init                    # プロジェクト初期化とエージェントインストール
npm run install-agents          # 全エージェントのインストール
npm run list-agents            # 利用可能エージェントの一覧表示
```

### 開発ワークフロー
```bash
npm run lint                   # ESLintによるセキュリティ込みのコード検査
npm run security-audit         # セキュリティ脆弱性スキャン
npm run validate-config        # 設定ファイルの検証
npm run pre-commit            # コミット前チェック（lint + audit + config）
```

### テストと検証
```bash
npm run test                   # Node.js ネイティブテスト実行
npm run check-deps            # 依存関係チェック
claude-code smart-review --test # システム統合テスト
```

### 更新とコマンド登録
```bash
npm run update                 # システム自動更新
npm run update:check          # 更新チェックのみ
npm run register              # スラッシュコマンド登録
npm run register:status       # 登録状況確認
npm run unregister           # スラッシュコマンド削除
```

### エージェント管理
```bash
npm run uninstall-agents      # 全エージェントの削除
```

### Windows固有のユーティリティコマンド
```cmd
dir                           # ディレクトリ一覧（Windowsネイティブ）
type <filename>              # ファイル内容表示
findstr "pattern" *.js       # ファイル内検索
where <command>              # コマンドのパス検索
```

## タスク完了時のチェックリスト
1. `npm run lint` - コード品質チェック
2. `npm run security-audit` - セキュリティ監査
3. `npm run validate-config` - 設定ファイル検証
4. `npm run test` - テスト実行
5. Git commit前に `npm run pre-commit` 実行