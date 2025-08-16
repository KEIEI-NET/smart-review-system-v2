# エラーリカバリーガイド

*バージョン: v1.0.0*
*最終更新: 2025年08月16日 17:00 JST*

このドキュメントでは、Smart Review システムおよびスラッシュコマンド登録で発生する可能性のあるエラーと、その回復手順を説明します。

## 目次

1. [インストールエラー](#インストールエラー)
2. [実行時エラー](#実行時エラー)
3. [更新エラー](#更新エラー)
4. [権限エラー](#権限エラー)
5. [ネットワークエラー](#ネットワークエラー)
6. [データ破損エラー](#データ破損エラー)
7. [緊急リカバリー手順](#緊急リカバリー手順)

---

## インストールエラー

### 症状: `ENOENT: no such file or directory`

**原因:** 必要なファイルが見つからない

**解決手順:**
```bash
# 1. プロジェクトディレクトリに移動
cd /path/to/smart-review-system

# 2. ファイルの存在確認
ls -la

# 3. 必要に応じて再クローン
git clone https://github.com/KEIEI-NET/smart-review-system.git
cd smart-review-system

# 4. 再インストール
npm run init
```

### 症状: `EACCES: permission denied`

**原因:** ファイルアクセス権限不足

**解決手順:**

**Windows:**
```bash
# 管理者権限でコマンドプロンプトを開く
# Windowsキー + X → Windows PowerShell (管理者)

# インストール再実行
npm run register
```

**Mac/Linux:**
```bash
# sudo権限で実行
sudo npm run register

# または権限を修正
chmod -R 755 ~/.claude
```

### 症状: `npm ERR! code EINTEGRITY`

**原因:** パッケージの整合性チェック失敗

**解決手順:**
```bash
# 1. キャッシュクリア
npm cache clean --force

# 2. node_modules削除
rm -rf node_modules
rm package-lock.json

# 3. 再インストール
npm install
```

---

## 実行時エラー

### 症状: `command not found: claude-code`

**原因:** Claude Code CLIがインストールされていない

**解決手順:**
```bash
# Claude Code CLIのインストール
npm install -g @anthropic/claude-code

# または公式サイトからダウンロード
# https://claude.ai/code
```

### 症状: `Error: Cannot find module './lib/common-utils'`

**原因:** 共通モジュールが見つからない

**解決手順:**
```bash
# 1. libディレクトリの作成確認
mkdir -p lib

# 2. 最新版を取得
git pull origin main

# 3. インストール再実行
npm run init
```

### 症状: `Error: Path traversal detected`

**原因:** セキュリティ保護による不正なパス検出

**解決手順:**
```bash
# 1. 現在のディレクトリを確認
pwd

# 2. プロジェクトルートから実行
cd /path/to/smart-review-system
npm run register
```

---

## 更新エラー

### 症状: `File integrity check failed`

**原因:** ファイルのハッシュ値不一致

**解決手順:**
```bash
# 1. 破損ファイルの削除
rm ~/.claude/commands/smart-review-v2.js

# 2. バックアップから復元（存在する場合）
cp ~/.claude/commands/smart-review-v2.js.backup.* ~/.claude/commands/smart-review-v2.js

# 3. または再インストール
npm run register
```

### 症状: 更新後に動作しない

**原因:** 不完全な更新または互換性の問題

**解決手順:**
```bash
# 1. バージョン確認
node register-slash-command-v2.js status

# 2. ロールバック（バックアップがある場合）
cd ~/.claude/.smart-review-backup/
ls -la  # 最新のバックアップを確認
cp -r [latest-backup-dir]/* ~/.claude/

# 3. クリーンインストール
npm run unregister
npm run register
```

---

## 権限エラー

### 症状: ファイル書き込みエラー

**原因:** ディレクトリの書き込み権限不足

**解決手順:**

**Windows:**
```powershell
# PowerShell（管理者）で実行
icacls "%USERPROFILE%\.claude" /grant "%USERNAME%":F /T
```

**Mac/Linux:**
```bash
# 権限の修正
chmod -R u+rw ~/.claude
chown -R $(whoami) ~/.claude
```

---

## ネットワークエラー

### 症状: GitHub接続エラー

**原因:** ネットワーク接続またはプロキシの問題

**解決手順:**
```bash
# 1. ネットワーク接続確認
ping github.com

# 2. プロキシ設定（必要な場合）
git config --global http.proxy http://proxy.example.com:8080
npm config set proxy http://proxy.example.com:8080

# 3. SSL検証を一時的に無効化（開発環境のみ）
git config --global http.sslVerify false
npm config set strict-ssl false
```

---

## データ破損エラー

### 症状: 設定ファイルの破損

**原因:** 不正なJSON形式や書き込みエラー

**解決手順:**
```bash
# 1. 破損ファイルのバックアップ
cp ~/.claude/.smart-review-manifest.json ~/.claude/.smart-review-manifest.json.corrupted

# 2. 破損ファイルの削除
rm ~/.claude/.smart-review-manifest.json

# 3. 再初期化
npm run register
```

### 症状: エージェントファイルの破損

**解決手順:**
```bash
# 1. 破損エージェントの特定
ls -la ~/.claude/agents/

# 2. 破損ファイルの削除
rm ~/.claude/agents/[corrupted-agent].md

# 3. エージェント再インストール
npm run install-agents
```

---

## 緊急リカバリー手順

### 完全リセット（最終手段）

すべての設定とファイルをリセットして、クリーンな状態から再開します。

```bash
# 警告: この操作はすべての設定を削除します

# 1. バックアップ作成
cp -r ~/.claude ~/.claude.backup.$(date +%Y%m%d_%H%M%S)

# 2. 設定ディレクトリの削除
rm -rf ~/.claude/commands
rm -rf ~/.claude/agents
rm ~/.claude/.smart-review-*

# 3. プロジェクトの再クローン
cd /tmp
git clone https://github.com/KEIEI-NET/smart-review-system.git
cd smart-review-system

# 4. クリーンインストール
npm install
npm run init
npm run register
npm run install-agents

# 5. 動作確認
claude-code /smart-review --test
```

### バックアップからの復元

```bash
# 1. 利用可能なバックアップを確認
ls -la ~/.claude/.smart-review-backup/

# 2. 最新のバックアップディレクトリを特定
BACKUP_DIR=$(ls -t ~/.claude/.smart-review-backup/ | head -1)

# 3. 現在の設定をバックアップ
mv ~/.claude ~/.claude.current

# 4. バックアップから復元
mkdir -p ~/.claude
cp -r ~/.claude/.smart-review-backup/$BACKUP_DIR/* ~/.claude/

# 5. 動作確認
claude-code /smart-review --help
```

---

## トラブルシューティングチェックリスト

問題が発生した場合、以下の順番で確認してください：

### 1. 環境確認
- [ ] Node.js v14以上がインストールされているか
- [ ] Claude Code CLIがインストールされているか
- [ ] 必要な権限があるか

### 2. ファイル確認
- [ ] プロジェクトファイルが存在するか
- [ ] ~/.claude ディレクトリが存在するか
- [ ] 設定ファイルが正しいJSON形式か

### 3. ログ確認
```bash
# 更新ログの確認
cat ~/.claude/.smart-review-update.log

# Node.jsエラーログ
npm run register 2> error.log
cat error.log
```

### 4. デバッグモード実行
```bash
# 詳細なエラー情報を表示
DEBUG=1 npm run register
```

---

## サポート

問題が解決しない場合：

1. **GitHub Issues**: https://github.com/KEIEI-NET/smart-review-system/issues
2. **ドキュメント**: README.md, INSTALL.md を参照
3. **セキュリティ問題**: SECURITY.md を参照

### エラー報告時に含める情報

```bash
# システム情報を収集
echo "=== System Info ===" > debug-info.txt
node --version >> debug-info.txt
npm --version >> debug-info.txt
claude-code --version >> debug-info.txt 2>&1
echo "=== Directory Structure ===" >> debug-info.txt
ls -la ~/.claude/ >> debug-info.txt 2>&1
echo "=== Error Log ===" >> debug-info.txt
cat error.log >> debug-info.txt 2>&1
```

---

*最終更新: 2025年08月16日 17:00 JST*
*バージョン: v1.0.0*

**更新履歴:**
- v1.0.0 (2025年08月16日): 初期バージョン作成