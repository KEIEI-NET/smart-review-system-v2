# 貢献ガイドライン

Smart Review システムへの貢献を歓迎します！このドキュメントでは、プロジェクトに貢献する際の手順とガイドラインを説明します。

## 🚀 開発環境のセットアップ

### 必要な環境
- Node.js 14.0.0 以上（推奨: 18.17.0）
- Git
- Claude Code CLI

### セットアップ手順

1. **リポジトリのフォーク**
   ```bash
   # GitHubでリポジトリをフォーク後
   git clone https://github.com/your-username/smart-review-system.git
   cd smart-review-system
   ```

2. **依存関係のインストール**
   ```bash
   npm install
   ```

3. **環境設定**
   ```bash
   cp .env.example .env
   # .env ファイルを適切に設定
   ```

4. **初期化**
   ```bash
   npm run init
   ```

## 📝 開発ワークフロー

### ブランチ戦略

- `main`: 安定版のリリースブランチ
- `develop`: 開発用のメインブランチ
- `feature/*`: 新機能開発用
- `bugfix/*`: バグ修正用
- `security/*`: セキュリティ修正用（優先度高）

### 開発手順

1. **イシューの確認**
   - 既存のイシューを確認
   - 新機能の場合は事前にイシューを作成して議論

2. **ブランチの作成**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

3. **開発**
   ```bash
   # コード変更
   
   # リント確認
   npm run lint
   
   # セキュリティチェック
   npm run security-audit
   
   # 設定検証
   npm run validate-config
   ```

4. **コミット**
   ```bash
   # 事前チェック
   npm run pre-commit
   
   # コミット（コミットメッセージ規約に従う）
   git commit -m "feat: 新機能の説明"
   ```

### コミットメッセージ規約

以下の形式を使用してください：

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Type:**
- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメントの変更
- `style`: コードフォーマット
- `refactor`: リファクタリング
- `test`: テスト追加・修正
- `chore`: その他の変更
- `security`: セキュリティ修正

**例:**
```
feat(config): 設定ファイルの環境変数サポートを追加

- .env ファイルからの設定読み込み機能を実装
- デフォルト値のフォールバック処理を改善
- 設定検証機能を強化

Closes #123
```

## 🔒 セキュリティに関する貢献

### セキュリティ脆弱性の報告

- **軽微な脆弱性**: GitHubのIssueを使用
- **深刻な脆弱性**: Security Advisoriesまたは直接連絡

### セキュリティを考慮した開発

1. **入力検証**: 全ての外部入力を検証
2. **出力エスケープ**: HTMLやシェルコマンドでの出力を適切にエスケープ
3. **権限最小化**: 最小限の権限で動作するよう実装
4. **機密情報**: ハードコードせず、環境変数を使用

### セキュリティテスト

```bash
# セキュリティリント
npm run lint

# 依存関係監査
npm run security-audit

# 設定ファイル検証
npm run validate-config
```

## 🧪 テスト

### テストの実行

```bash
# 全てのテスト
npm test

# 特定のテスト
npm test -- --grep "設定管理"
```

### テストの作成

- 新機能には必ずテストを追加
- セキュリティ関連の機能は特に重点的にテスト
- エッジケースも考慮

## 📚 ドキュメント

### ドキュメントの更新

- コードの変更に伴うドキュメントの更新
- API変更時は必ずAPI_DOCUMENTATION.mdを更新
- セキュリティに関する変更はSECURITY.mdも確認

### 日本語ドキュメント

- メインドキュメントは日本語で作成
- コメントも日本語推奨
- エラーメッセージは日本語で統一

## 🎯 プルリクエスト

### プルリクエストの作成

1. **テンプレートの使用**
   - プルリクエストテンプレートに従って記載

2. **レビュー前チェック**
   ```bash
   npm run pre-commit
   ```

3. **適切なラベルの設定**
   - `feature`, `bugfix`, `security` など

### レビュープロセス

- 最低1名のレビューが必要
- セキュリティ関連は2名のレビューが必要
- CI/CDの全チェックが通過していること

## 🤝 行動規範

### コミュニティ基準

- 他の貢献者への敬意
- 建設的なフィードバック
- 多様性の尊重

### 報告手順

不適切な行動を発見した場合は、プロジェクトメンテナーに報告してください。

## 📞 質問・サポート

- **一般的な質問**: GitHubのDiscussionsを使用
- **バグ報告**: GitHubのIssuesを使用
- **セキュリティ**: Security Advisoriesまたは直接連絡

## 🙏 謝辞

Smart Review システムへの貢献に感謝します！あなたの貢献により、より安全で使いやすいツールになります。