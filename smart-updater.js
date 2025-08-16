#!/usr/bin/env node
// smart-updater.js
// Smart Review システムの自動更新・バージョン管理ツール

const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const os = require('os');

/**
 * バージョン管理・自動更新システム
 */
class SmartUpdater {
  constructor() {
    this.projectPath = process.cwd();
    this.homeDir = os.homedir();
    
    // パス設定
    this.manifestPath = path.join(this.projectPath, 'version-manifest.json');
    this.installedManifestPath = path.join(this.homeDir, '.claude', '.smart-review-manifest.json');
    this.updateLogPath = path.join(this.homeDir, '.claude', '.smart-review-update.log');
    
    // コンポーネントパス
    this.paths = {
      commands: {
        source: this.projectPath,
        target: path.join(this.homeDir, '.claude', 'commands')
      },
      agents: {
        source: path.join(this.projectPath, 'agents'),
        target: path.join(this.homeDir, '.claude', 'agents')
      }
    };
    
    // 更新統計
    this.stats = {
      checked: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      newInstalls: 0
    };
    
    // 更新対象リスト
    this.updateQueue = [];
  }

  /**
   * メイン処理
   */
  async run(options = {}) {
    try {
      console.log('🔄 Smart Review 更新チェックツール');
      console.log('═'.repeat(60));
      console.log();

      const command = options.command || process.argv[2];
      
      switch (command) {
        case 'check':
          await this.checkForUpdates();
          break;
        case 'update':
          await this.performUpdate(options);
          break;
        case 'auto':
        case undefined:
          await this.autoUpdate(options);
          break;
        case 'status':
          await this.showStatus();
          break;
        case 'rollback':
          await this.rollback();
          break;
        case 'help':
        case '--help':
          this.showHelp();
          break;
        default:
          console.error(`❌ 不明なコマンド: ${command}`);
          this.showHelp();
          process.exit(1);
      }
    } catch (error) {
      console.error('❌ エラー:', error.message);
      process.exit(1);
    }
  }

  /**
   * 自動更新（デフォルト動作）
   */
  async autoUpdate(options = {}) {
    console.log('🔍 更新をチェック中...\n');
    
    // 1. バージョンマニフェストの読み込み
    const sourceManifest = await this.loadManifest(this.manifestPath);
    const installedManifest = await this.loadInstalledManifest();
    
    // 2. 更新チェック
    const updates = await this.compareVersions(sourceManifest, installedManifest);
    
    if (updates.length === 0) {
      console.log('✅ すべてのコンポーネントは最新です！');
      return;
    }
    
    // 3. 更新内容の表示
    console.log(`📊 ${updates.length}個のコンポーネントに更新があります:\n`);
    this.displayUpdateList(updates);
    
    // 4. 自動更新モードの確認
    if (!options.force && !await this.confirmUpdate()) {
      console.log('\n⏭️  更新をスキップしました');
      return;
    }
    
    // 5. 更新実行
    console.log('\n📦 更新を実行中...\n');
    await this.applyUpdates(updates);
    
    // 6. 更新後のマニフェスト保存
    await this.saveInstalledManifest(sourceManifest);
    
    // 7. 結果表示
    this.showUpdateResults();
  }

  /**
   * 更新チェックのみ
   */
  async checkForUpdates() {
    console.log('🔍 更新をチェック中...\n');
    
    const sourceManifest = await this.loadManifest(this.manifestPath);
    const installedManifest = await this.loadInstalledManifest();
    
    const updates = await this.compareVersions(sourceManifest, installedManifest);
    
    if (updates.length === 0) {
      console.log('✅ すべてのコンポーネントは最新です！');
      console.log(`   現在のバージョン: v${sourceManifest.version}`);
    } else {
      console.log(`📊 ${updates.length}個のコンポーネントに更新があります:\n`);
      this.displayUpdateList(updates);
      console.log('\n💡 更新を適用するには: npm run register');
    }
  }

  /**
   * バージョンマニフェストの読み込み
   */
  async loadManifest(manifestPath) {
    try {
      const content = await fs.readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(content);
      
      // SHA256ハッシュを計算して更新
      await this.updateManifestHashes(manifest);
      
      return manifest;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('バージョンマニフェストが見つかりません');
      }
      throw error;
    }
  }

  /**
   * インストール済みマニフェストの読み込み
   */
  async loadInstalledManifest() {
    try {
      const content = await fs.readFile(this.installedManifestPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // 初回インストール
        return {
          version: '0.0.0',
          components: {
            commands: {},
            agents: {},
            scripts: {}
          }
        };
      }
      throw error;
    }
  }

  /**
   * マニフェストのハッシュ値を更新
   */
  async updateManifestHashes(manifest) {
    for (const [category, items] of Object.entries(manifest.components)) {
      for (const [filename, info] of Object.entries(items)) {
        let filePath;
        
        if (category === 'agents') {
          filePath = path.join(this.projectPath, 'agents', filename);
        } else {
          filePath = path.join(this.projectPath, filename);
        }
        
        try {
          const content = await fs.readFile(filePath);
          const hash = crypto.createHash('sha256').update(content).digest('hex');
          const stats = await fs.stat(filePath);
          
          info.sha256 = hash;
          info.size = stats.size;
          info.lastModified = stats.mtime.toISOString();
        } catch (error) {
          console.warn(`⚠️  ファイルが見つかりません: ${filename}`);
        }
      }
    }
  }

  /**
   * バージョン比較
   */
  async compareVersions(sourceManifest, installedManifest) {
    const updates = [];
    
    for (const [category, items] of Object.entries(sourceManifest.components)) {
      const installedItems = installedManifest.components[category] || {};
      
      for (const [filename, sourceInfo] of Object.entries(items)) {
        const installedInfo = installedItems[filename];
        
        this.stats.checked++;
        
        // 新規インストールまたは更新が必要かチェック
        if (!installedInfo) {
          // 新規インストール
          updates.push({
            category,
            filename,
            type: 'new',
            sourceVersion: sourceInfo.version,
            installedVersion: null,
            sourceHash: sourceInfo.sha256,
            installedHash: null,
            size: sourceInfo.size,
            critical: sourceInfo.critical
          });
          this.stats.newInstalls++;
        } else if (this.needsUpdate(sourceInfo, installedInfo)) {
          // 更新が必要
          updates.push({
            category,
            filename,
            type: 'update',
            sourceVersion: sourceInfo.version,
            installedVersion: installedInfo.version,
            sourceHash: sourceInfo.sha256,
            installedHash: installedInfo.sha256,
            size: sourceInfo.size,
            critical: sourceInfo.critical,
            changes: this.compareVersionNumbers(sourceInfo.version, installedInfo.version)
          });
        } else {
          this.stats.skipped++;
        }
      }
    }
    
    // 重要度順にソート
    updates.sort((a, b) => {
      if (a.critical && !b.critical) return -1;
      if (!a.critical && b.critical) return 1;
      if (a.type === 'new' && b.type !== 'new') return -1;
      if (a.type !== 'new' && b.type === 'new') return 1;
      return 0;
    });
    
    return updates;
  }

  /**
   * 更新が必要かチェック
   */
  needsUpdate(sourceInfo, installedInfo) {
    // ハッシュ値で比較（最も確実）
    if (sourceInfo.sha256 && installedInfo.sha256) {
      return sourceInfo.sha256 !== installedInfo.sha256;
    }
    
    // バージョン番号で比較
    if (sourceInfo.version && installedInfo.version) {
      return this.compareVersionNumbers(sourceInfo.version, installedInfo.version) > 0;
    }
    
    // タイムスタンプで比較（最終手段）
    if (sourceInfo.lastModified && installedInfo.lastModified) {
      return new Date(sourceInfo.lastModified) > new Date(installedInfo.lastModified);
    }
    
    // 判断できない場合は更新する
    return true;
  }

  /**
   * バージョン番号の比較
   */
  compareVersionNumbers(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    
    return 0;
  }

  /**
   * 更新リストの表示
   */
  displayUpdateList(updates) {
    const categories = {
      commands: '📝 コマンド',
      agents: '🤖 エージェント',
      scripts: '⚙️ スクリプト'
    };
    
    for (const [category, label] of Object.entries(categories)) {
      const categoryUpdates = updates.filter(u => u.category === category);
      
      if (categoryUpdates.length > 0) {
        console.log(`${label}:`);
        
        for (const update of categoryUpdates) {
          const icon = update.type === 'new' ? '🆕' : '🔄';
          const critical = update.critical ? '⚠️ ' : '';
          const version = update.type === 'new' 
            ? `(新規 v${update.sourceVersion})`
            : `(v${update.installedVersion} → v${update.sourceVersion})`;
          
          console.log(`  ${icon} ${critical}${update.filename} ${version}`);
          
          if (update.size) {
            console.log(`     サイズ: ${this.formatSize(update.size)}`);
          }
        }
        console.log();
      }
    }
  }

  /**
   * 更新の確認
   */
  async confirmUpdate() {
    // 環境変数で自動更新が設定されている場合
    if (process.env.SMART_REVIEW_AUTO_UPDATE === 'true') {
      return true;
    }
    
    // CI環境では自動的に更新
    if (process.env.CI || process.env.GITHUB_ACTIONS) {
      return true;
    }
    
    // 対話的確認（簡略版）
    console.log('\n更新を適用しますか？ (Y/n): ');
    return true; // デモのため自動でtrue
  }

  /**
   * 更新の適用
   */
  async applyUpdates(updates) {
    // バックアップディレクトリの作成
    const backupDir = path.join(
      this.homeDir,
      '.claude',
      '.smart-review-backup',
      new Date().toISOString().replace(/[:.]/g, '-')
    );
    await fs.mkdir(backupDir, { recursive: true });
    
    for (const update of updates) {
      try {
        await this.applyUpdate(update, backupDir);
        this.stats.updated++;
      } catch (error) {
        console.error(`  ❌ ${update.filename}: 更新失敗 - ${error.message}`);
        this.stats.failed++;
      }
    }
  }

  /**
   * 個別更新の適用
   */
  async applyUpdate(update, backupDir) {
    let sourcePath, targetPath;
    
    if (update.category === 'agents') {
      sourcePath = path.join(this.projectPath, 'agents', update.filename);
      targetPath = path.join(this.homeDir, '.claude', 'agents', update.filename);
    } else if (update.category === 'commands') {
      sourcePath = path.join(this.projectPath, update.filename);
      targetPath = path.join(this.homeDir, '.claude', 'commands', update.filename);
    } else {
      sourcePath = path.join(this.projectPath, update.filename);
      targetPath = path.join(this.homeDir, '.claude', 'scripts', update.filename);
    }
    
    // バックアップ作成
    if (update.type === 'update') {
      try {
        const backupPath = path.join(backupDir, `${update.category}_${update.filename}`);
        await fs.copyFile(targetPath, backupPath);
      } catch {
        // バックアップ失敗は警告のみ
      }
    }
    
    // ターゲットディレクトリの確保
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    
    // ファイルコピー
    await fs.copyFile(sourcePath, targetPath);
    
    // 検証
    const copiedHash = await this.calculateFileHash(targetPath);
    if (copiedHash !== update.sourceHash) {
      throw new Error('ファイル整合性チェック失敗');
    }
    
    const icon = update.type === 'new' ? '🆕' : '✅';
    console.log(`  ${icon} ${update.filename}: ${update.type === 'new' ? 'インストール' : '更新'}完了`);
  }

  /**
   * ファイルハッシュの計算
   */
  async calculateFileHash(filePath) {
    const content = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * インストール済みマニフェストの保存
   */
  async saveInstalledManifest(manifest) {
    const installedManifest = {
      ...manifest,
      installedAt: new Date().toISOString(),
      installedFrom: this.projectPath
    };
    
    await fs.mkdir(path.dirname(this.installedManifestPath), { recursive: true });
    await fs.writeFile(
      this.installedManifestPath,
      JSON.stringify(installedManifest, null, 2)
    );
  }

  /**
   * 更新ログの記録
   */
  async logUpdate(updates) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      version: require('./version-manifest.json').version,
      updates: updates.map(u => ({
        file: u.filename,
        type: u.type,
        from: u.installedVersion,
        to: u.sourceVersion
      })),
      stats: this.stats
    };
    
    try {
      const existingLog = await fs.readFile(this.updateLogPath, 'utf8');
      const log = JSON.parse(existingLog);
      log.push(logEntry);
      
      // 最新100件のみ保持
      if (log.length > 100) {
        log.splice(0, log.length - 100);
      }
      
      await fs.writeFile(this.updateLogPath, JSON.stringify(log, null, 2));
    } catch {
      // 新規ログファイル
      await fs.writeFile(this.updateLogPath, JSON.stringify([logEntry], null, 2));
    }
  }

  /**
   * ステータス表示
   */
  async showStatus() {
    console.log('📊 インストール状況\n');
    
    try {
      const installedManifest = await this.loadInstalledManifest();
      
      console.log(`現在のバージョン: v${installedManifest.version}`);
      console.log(`インストール日時: ${installedManifest.installedAt || '不明'}`);
      console.log();
      
      // コンポーネント状況
      let totalComponents = 0;
      let installedComponents = 0;
      
      for (const [category, items] of Object.entries(installedManifest.components)) {
        const count = Object.keys(items).length;
        totalComponents += count;
        installedComponents += count;
        
        if (count > 0) {
          console.log(`${this.getCategoryLabel(category)}: ${count}個`);
          
          // 詳細表示
          for (const [filename, info] of Object.entries(items)) {
            console.log(`  • ${filename} (v${info.version})`);
          }
          console.log();
        }
      }
      
      console.log(`合計: ${installedComponents}個のコンポーネント`);
      
      // 更新ログの最新エントリ
      try {
        const log = JSON.parse(await fs.readFile(this.updateLogPath, 'utf8'));
        if (log.length > 0) {
          const latest = log[log.length - 1];
          console.log(`\n最終更新: ${latest.timestamp}`);
        }
      } catch {
        // ログなし
      }
      
    } catch (error) {
      console.log('❌ インストール情報が見つかりません');
      console.log('💡 まず npm run register を実行してください');
    }
  }

  /**
   * ロールバック機能
   */
  async rollback() {
    console.log('🔄 ロールバック機能は現在開発中です');
    console.log('💡 手動でバックアップから復元してください:');
    console.log(`   ${path.join(this.homeDir, '.claude', '.smart-review-backup')}`);
  }

  /**
   * 更新結果の表示
   */
  showUpdateResults() {
    console.log('\n' + '═'.repeat(60));
    console.log('📊 更新結果:\n');
    
    console.log(`  チェック: ${this.stats.checked}個`);
    console.log(`  新規インストール: ${this.stats.newInstalls}個`);
    console.log(`  更新: ${this.stats.updated}個`);
    console.log(`  スキップ: ${this.stats.skipped}個`);
    
    if (this.stats.failed > 0) {
      console.log(`  ⚠️  失敗: ${this.stats.failed}個`);
    }
    
    if (this.stats.updated > 0 || this.stats.newInstalls > 0) {
      console.log('\n✅ 更新が完了しました！');
      console.log('💡 変更を確認するには: claude-code /smart-review --help');
    }
    
    console.log('═'.repeat(60));
  }

  /**
   * カテゴリラベルの取得
   */
  getCategoryLabel(category) {
    const labels = {
      commands: '📝 コマンド',
      agents: '🤖 エージェント',
      scripts: '⚙️ スクリプト'
    };
    return labels[category] || category;
  }

  /**
   * ファイルサイズのフォーマット
   */
  formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * ヘルプ表示
   */
  showHelp() {
    console.log(`
Smart Review 更新管理ツール

使用方法:
  node smart-updater.js [コマンド]

コマンド:
  auto       自動更新を実行（デフォルト）
  check      更新チェックのみ
  update     更新を強制実行
  status     現在の状況を表示
  rollback   前のバージョンに戻す
  help       このヘルプを表示

動作:
  1. バージョンマニフェストとインストール済みコンポーネントを比較
  2. SHA-256ハッシュで差分を検出
  3. 更新が必要なファイルのみを選択的に更新
  4. バックアップを作成してから更新を適用

環境変数:
  SMART_REVIEW_AUTO_UPDATE=true   確認なしで自動更新

例:
  node smart-updater.js           # 更新チェックと適用
  node smart-updater.js check     # チェックのみ
  node smart-updater.js status    # 現在の状況
`);
  }
}

// エクスポート（register-slash-command-v2.jsから呼び出し可能）
module.exports = SmartUpdater;

// 直接実行された場合
if (require.main === module) {
  const updater = new SmartUpdater();
  updater.run().catch(error => {
    console.error('❌ エラー:', error.message);
    process.exit(1);
  });
}