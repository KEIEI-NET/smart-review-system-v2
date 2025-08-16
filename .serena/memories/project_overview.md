# Smart Review System - プロジェクト概要

## プロジェクトの目的
Smart Review Systemは、Claude Codeエージェントを活用したインテリジェントコードレビュー自動化システムです。
セキュリティ脆弱性の検出、バグ発見、コード品質向上を目的とした多層防御アプローチを採用しています。

## 技術スタック
- **ランタイム**: Node.js 14.0.0以上
- **言語**: JavaScript (ES2021)
- **リンター**: ESLint with security plugins
- **セキュリティ**: eslint-plugin-security
- **パッケージ管理**: npm
- **テスト**: Node.js native test runner

## アーキテクチャ
- **マルチエージェント**: 5つの専門エージェントによるオーケストレーション
- **設定階層**: 環境変数 → プロジェクト → ホーム → デフォルト
- **セキュリティファースト**: パストラバーサル防止、コマンドインジェクション対策
- **サンドボックス実行**: エージェント隔離実行環境

## 主要コンポーネント
1. `smart-review-v2.js` - メインインターフェース
2. `init-smart-review.js` - プロジェクト初期化
3. `install-agents.js` - エージェント管理
4. `register-slash-command-v2.js` - スラッシュコマンド登録
5. `smart-updater.js` - 自動更新システム
6. `smart-review-config.js` - 設定管理

## セキュリティ重点項目
- 入力検証とサニタイゼーション
- パストラバーサル攻撃防止
- コマンドインジェクション対策
- エージェント実行サンドボックス
- 監査ログとコンプライアンス