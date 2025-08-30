#!/usr/bin/env node
// register-slash-command-v2.js
// Claude Code CLIスラッシュコマンドの登録スクリプト（セキュリティ強化版）

const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

// 共通ユーティリティモジュールをインポート
const {
  SecurityUtils,
  FileOperations,
  ErrorHandler,
  SystemUtils
} = require('./lib/common-utils');

// SecurityUtilsクラスは共通モジュールから使用

// FileOperationsクラスは共通モジュールから使用

// ErrorHandlerクラスは共通モジュールから使用

/**
 * Claude Code スラッシュコマンド登録ツール（改良版）
 */
class SlashCommandRegistrar {
  constructor(options = {}) {
    // 依存性注入（テスト可能性向上）
    this.fs = options.fs || fs;
    this.execFile = options.execFile || execFileAsync;
    this.logger = options.logger || console;
    
    // セキュアなパス設定
    try {
      this.projectPath = SecurityUtils.validatePath(process.cwd());
      this.homeDir = SystemUtils.getHomeDir(); // 共通モジュールから取得
      
      // Claude Codeのコマンドディレクトリ
      this.globalCommandsPath = SecurityUtils.validatePath(
        this.homeDir, 
        path.join('.claude', 'commands')
      );
      
      // プロジェクトのコマンドディレクトリ
      this.localCommandsPath = SecurityUtils.validatePath(
        this.projectPath,
        path.join('.claudecode', 'commands')
      );
      
      // エージェントパス
      this.agentsSourcePath = SecurityUtils.validatePath(this.projectPath, 'agents');
      this.agentsTargetPath = SecurityUtils.validatePath(
        this.homeDir,
        path.join('.claude', 'agents')
      );
    } catch (error) {
      ErrorHandler.handle(error, 'Path initialization');
      process.exit(1);
    }
    
    // 設定
    this.commands = [
      {
        name: 'smart-review',
        source: 'smart-review-v2.js',
        description: 'インテリジェントコードレビュー自動化システム',
        aliases: ['review', 'sr']
      }
    ];
    
    this.requiredAgents = [
      'security-error-xss-analyzer.md',
      'super-debugger-perfectionist.md',
      'deep-code-reviewer.md',
      'project-documentation-updater.md',
      'code-comment-annotator-ja.md'
    ];
    
    // 統計情報
    this.stats = {
      commandsInstalled: 0,
      commandsUpdated: 0,
      commandsFailed: 0,
      agentsInstalled: 0,
      agentsUpdated: 0,
      agentsFailed: 0
    };
  }

  /**
   * メイン処理
   */
  async run() {
    try {
      console.log('🚀 Claude Code スラッシュコマンド登録ツール v2.0');
      console.log('═'.repeat(60));
      console.log();

      const args = process.argv.slice(2);
      const command = args[0];

      switch (command) {
        case 'install':
        case undefined:
          await this.install();
          break;
        case 'uninstall':
          await this.uninstall();
          break;
        case 'status':
          await this.checkStatus();
          break;
        case 'verify':
          await this.verifyIntegrity();
          break;
        case 'help':
        case '--help':
        case '-h':
          this.showHelp();
          break;
        default:
          console.error(`❌ 不明なコマンド: ${command}`);
          this.showHelp();
          process.exit(1);
      }
    } catch (error) {
      ErrorHandler.handle(error, 'Main execution');
      process.exit(1);
    }
  }

  /**
   * インストール処理
   */
  async install() {
    console.log('📦 スラッシュコマンドをインストールしています...\n');

    try {
      // 1. 環境チェック
      await this.checkEnvironment();

      // 2. 更新チェック（SmartUpdaterを使用）
      const SmartUpdater = require('./smart-updater');
      const updater = new SmartUpdater();
      
      console.log('🔄 更新をチェック中...\n');
      const sourceManifest = await updater.loadManifest(updater.manifestPath);
      const installedManifest = await updater.loadInstalledManifest();
      const updates = await updater.compareVersions(sourceManifest, installedManifest);
      
      if (updates.length > 0) {
        console.log(`📊 ${updates.length}個のコンポーネントに更新があります:\n`);
        updater.displayUpdateList(updates);
        console.log();
      } else {
        console.log('✅ すべてのコンポーネントは最新です\n');
      }

      // 3. 並列処理で高速化
      const [dirsCreated, configCreated] = await Promise.all([
        this.createDirectories(),
        this.prepareConfig()
      ]);

      // 4. 差分更新またはフルインストール
      if (updates.length > 0) {
        // 差分更新を実行
        console.log('📦 差分更新を実行中...\n');
        await updater.applyUpdates(updates);
        
        // 更新統計を反映
        this.stats.commandsUpdated = updates.filter(u => u.category === 'commands').length;
        this.stats.agentsUpdated = updates.filter(u => u.category === 'agents').length;
        this.stats.commandsInstalled = updates.filter(u => u.category === 'commands' && u.type === 'new').length;
        this.stats.agentsInstalled = updates.filter(u => u.category === 'agents' && u.type === 'new').length;
        
        // 更新後のマニフェスト保存
        await updater.saveInstalledManifest(sourceManifest);
        
        // 更新ログ記録
        await updater.logUpdate(updates);
      } else {
        // 通常のインストール処理
        const [commandResults, agentResults] = await Promise.all([
          this.installCommands(),
          this.installAgents()
        ]);
      }

      // 5. 検証
      await this.verifyInstallation();

      // 6. 結果表示
      this.showResults();
      
    } catch (error) {
      ErrorHandler.handle(error, 'Installation');
      process.exit(1);
    }
  }

  /**
   * 環境チェック
   */
  async checkEnvironment() {
    console.log('🔍 環境をチェック中...');

    // Node.jsバージョンチェック
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    const MIN_NODE_VERSION = 14;
    
    if (majorVersion < MIN_NODE_VERSION) {
      throw new Error(`Node.js ${MIN_NODE_VERSION}以上が必要です（現在: ${nodeVersion}）`);
    }
    console.log(`  ✅ Node.js: ${nodeVersion}`);

    // Claude Codeのチェック (複数のコマンド名をサポート)
    const claudeCommands = ['claude-code', 'claude'];
    let claudeFound = false;
    
    for (const cmd of claudeCommands) {
      try {
        const result = await this.execFile(cmd, ['--version']);
        console.log(`  ✅ Claude Code (${cmd}): インストール済み`);
        claudeFound = true;
        break;
      } catch (error) {
        // 次のコマンドを試す
      }
    }
    
    if (!claudeFound) {
      console.warn('  ⚠️  Claude Code が見つかりません');
      console.log('     インストール: npm install -g @anthropic/claude-code');
      console.log('     または: https://claude.ai/code からダウンロード');
    }

    // プロジェクトファイルの確認
    for (const cmd of this.commands) {
      const sourcePath = SecurityUtils.validatePath(this.projectPath, cmd.source);
      try {
        const stats = await this.fs.stat(sourcePath);
        if (!stats.isFile() || stats.size === 0) {
          throw new Error(`Invalid source file: ${cmd.source}`);
        }
        console.log(`  ✅ ${cmd.source}: 確認済み (${stats.size} bytes)`);
      } catch (error) {
        throw new Error(`必要なファイルが見つかりません: ${cmd.source}`);
      }
    }

    console.log();
  }

  /**
   * ディレクトリ作成
   */
  async createDirectories() {
    console.log('📁 必要なディレクトリを作成中...');

    const directories = [
      { path: this.globalCommandsPath, label: 'グローバルコマンド' },
      { path: this.localCommandsPath, label: 'ローカルコマンド' },
      { path: this.agentsTargetPath, label: 'エージェント' }
    ];

    const results = await Promise.allSettled(
      directories.map(async dir => {
        await FileOperations.createDirectorySafe(dir.path);
        console.log(`  ✅ ${dir.label}: ${dir.path}`);
        return dir;
      })
    );

    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
      throw new Error(`ディレクトリ作成に失敗: ${failed.length}件`);
    }

    console.log();
    return true;
  }

  /**
   * コマンドインストール
   */
  async installCommands() {
    console.log('📋 スラッシュコマンドを登録中...');

    const results = await Promise.allSettled(
      this.commands.map(cmd => this.installCommand(cmd))
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const cmd = this.commands[index];
        console.log(`  ✅ /${cmd.name}: ${result.value.status}`);
        if (result.value.status === 'installed') {
          this.stats.commandsInstalled++;
        } else if (result.value.status === 'updated') {
          this.stats.commandsUpdated++;
        }
      } else {
        this.stats.commandsFailed++;
        console.error(`  ❌ エラー: ${result.reason}`);
      }
    });

    console.log();
    return results;
  }

  /**
   * 個別コマンドインストール
   */
  async installCommand(cmd) {
    const sourcePath = SecurityUtils.validatePath(this.projectPath, cmd.source);
    const globalTarget = SecurityUtils.validatePath(this.globalCommandsPath, cmd.source);
    const localTarget = SecurityUtils.validatePath(this.localCommandsPath, cmd.source);

    // 既存ファイルチェック
    let status = 'installed';
    try {
      const existingHash = await SecurityUtils.calculateFileHash(globalTarget);
      const newHash = await SecurityUtils.calculateFileHash(sourcePath);
      if (existingHash === newHash) {
        return { status: 'skipped', message: '最新版がインストール済み' };
      }
      status = 'updated';
    } catch {
      // ファイルが存在しない
    }

    // グローバルインストール
    await FileOperations.copyWithBackup(sourcePath, globalTarget);
    
    // ローカルバックアップ
    await FileOperations.atomicCopy(sourcePath, localTarget);

    // エイリアス作成
    if (cmd.aliases && cmd.aliases.length > 0) {
      await this.createAliases(cmd);
    }

    return { status, command: cmd.name };
  }

  /**
   * エイリアス作成（セキュア版）
   */
  async createAliases(cmd) {
    for (const alias of cmd.aliases) {
      const aliasPath = SecurityUtils.validatePath(
        this.globalCommandsPath,
        `${alias}.js`
      );
      
      // セキュアなエイリアス内容
      const aliasContent = `// Alias for ${cmd.name}
// Auto-generated by register-slash-command-v2.js
const path = require('path');
module.exports = require(path.join(__dirname, ${JSON.stringify(cmd.source)}));
`;
      
      try {
        await this.fs.writeFile(aliasPath, aliasContent, { mode: 0o644 });
        console.log(`    🔗 エイリアス /${alias} を作成`);
      } catch (error) {
        console.warn(`    ⚠️  エイリアス /${alias} の作成に失敗`);
      }
    }
  }

  /**
   * エージェントインストール
   */
  async installAgents() {
    console.log('🤖 必要なエージェントをインストール中...');

    try {
      await this.fs.access(this.agentsSourcePath);
    } catch {
      console.log('  ⚠️  エージェントディレクトリが見つかりません');
      console.log('     別途 install-agents.js を実行してください');
      return [];
    }

    const results = await Promise.allSettled(
      this.requiredAgents.map(agent => this.installAgent(agent))
    );

    results.forEach((result, index) => {
      const agentName = this.requiredAgents[index].replace('.md', '');
      if (result.status === 'fulfilled') {
        console.log(`  ✅ ${agentName}: ${result.value.status}`);
        if (result.value.status === 'installed') {
          this.stats.agentsInstalled++;
        } else if (result.value.status === 'updated') {
          this.stats.agentsUpdated++;
        }
      } else {
        this.stats.agentsFailed++;
        console.log(`  ❌ ${agentName}: インストール失敗`);
      }
    });

    console.log();
    return results;
  }

  /**
   * 個別エージェントインストール
   */
  async installAgent(agentFile) {
    const sourcePath = SecurityUtils.validatePath(this.agentsSourcePath, agentFile);
    const targetPath = SecurityUtils.validatePath(this.agentsTargetPath, agentFile);

    // 既存ファイルチェック
    try {
      const existingHash = await SecurityUtils.calculateFileHash(targetPath);
      const newHash = await SecurityUtils.calculateFileHash(sourcePath);
      if (existingHash === newHash) {
        return { status: 'skipped' };
      }
      await FileOperations.copyWithBackup(sourcePath, targetPath);
      return { status: 'updated' };
    } catch {
      // 新規インストール
      await FileOperations.atomicCopy(sourcePath, targetPath);
      return { status: 'installed' };
    }
  }

  /**
   * 設定ファイル準備
   */
  async prepareConfig() {
    const configPath = SecurityUtils.validatePath(this.projectPath, '.smart-review.json');
    
    try {
      await this.fs.access(configPath);
      return { status: 'exists' };
    } catch {
      const config = {
        version: '2.1.0',
        timestamp: new Date().toISOString(),
        agents: this.requiredAgents.map(agent => ({
          id: agent.replace('.md', ''),
          enabled: true,
          priority: agent.includes('security') ? 'critical' : 'high'
        })),
        commands: this.commands.map(cmd => ({
          name: cmd.name,
          source: cmd.source,
          enabled: true,
          aliases: cmd.aliases || []
        })),
        settings: {
          autoInstall: true,
          checkUpdates: true,
          globalRegistration: true,
          securityMode: 'strict'
        }
      };

      await this.fs.writeFile(configPath, JSON.stringify(config, null, 2));
      console.log('  ✅ 設定ファイルを作成しました');
      return { status: 'created' };
    }
  }

  /**
   * インストール検証
   */
  async verifyInstallation() {
    console.log('🔍 インストールを検証中...');

    const verifications = [];

    // コマンド検証
    for (const cmd of this.commands) {
      const globalPath = SecurityUtils.validatePath(this.globalCommandsPath, cmd.source);
      try {
        const stats = await this.fs.stat(globalPath);
        if (stats.isFile() && stats.size > 0) {
          verifications.push({ type: 'command', name: cmd.name, status: 'ok' });
        } else {
          verifications.push({ type: 'command', name: cmd.name, status: 'invalid' });
        }
      } catch {
        verifications.push({ type: 'command', name: cmd.name, status: 'missing' });
      }
    }

    // エージェント検証
    for (const agent of this.requiredAgents) {
      const targetPath = SecurityUtils.validatePath(this.agentsTargetPath, agent);
      try {
        const stats = await this.fs.stat(targetPath);
        if (stats.isFile() && stats.size > 0) {
          verifications.push({ type: 'agent', name: agent, status: 'ok' });
        } else {
          verifications.push({ type: 'agent', name: agent, status: 'invalid' });
        }
      } catch {
        verifications.push({ type: 'agent', name: agent, status: 'missing' });
      }
    }

    const failed = verifications.filter(v => v.status !== 'ok');
    if (failed.length > 0) {
      console.log('  ⚠️  一部のコンポーネントの検証に失敗しました:');
      failed.forEach(f => {
        console.log(`    - ${f.type} ${f.name}: ${f.status}`);
      });
    } else {
      console.log('  ✅ すべてのコンポーネントが正常にインストールされました');
    }

    console.log();
    return verifications;
  }

  /**
   * 整合性チェック
   */
  async verifyIntegrity() {
    console.log('🔐 整合性チェックを実行中...\n');

    const checksums = {};

    // ソースファイルのチェックサム計算
    for (const cmd of this.commands) {
      const sourcePath = SecurityUtils.validatePath(this.projectPath, cmd.source);
      const globalPath = SecurityUtils.validatePath(this.globalCommandsPath, cmd.source);
      
      try {
        const sourceHash = await SecurityUtils.calculateFileHash(sourcePath);
        const globalHash = await SecurityUtils.calculateFileHash(globalPath);
        
        checksums[cmd.name] = {
          source: sourceHash.slice(0, 8),
          global: globalHash.slice(0, 8),
          match: sourceHash === globalHash
        };
      } catch (error) {
        checksums[cmd.name] = { error: error.message };
      }
    }

    // 結果表示
    console.log('📊 チェックサム検証結果:\n');
    for (const [name, info] of Object.entries(checksums)) {
      if (info.error) {
        console.log(`  ❌ ${name}: ${info.error}`);
      } else if (info.match) {
        console.log(`  ✅ ${name}: 整合性OK (${info.source})`);
      } else {
        console.log(`  ⚠️  ${name}: 不一致`);
        console.log(`     ソース: ${info.source}`);
        console.log(`     インストール済み: ${info.global}`);
      }
    }
  }

  /**
   * アンインストール
   */
  async uninstall() {
    console.log('🗑️  スラッシュコマンドをアンインストール中...\n');

    const removed = {
      commands: 0,
      aliases: 0,
      agents: 0
    };

    // コマンドの削除
    for (const cmd of this.commands) {
      const globalPath = SecurityUtils.validatePath(this.globalCommandsPath, cmd.source);
      try {
        await this.fs.unlink(globalPath);
        console.log(`  ✅ /${cmd.name}: 削除完了`);
        removed.commands++;

        // エイリアスの削除
        if (cmd.aliases) {
          for (const alias of cmd.aliases) {
            const aliasPath = SecurityUtils.validatePath(
              this.globalCommandsPath,
              `${alias}.js`
            );
            try {
              await this.fs.unlink(aliasPath);
              console.log(`    🔗 エイリアス /${alias} を削除`);
              removed.aliases++;
            } catch {
              // エイリアス削除失敗は無視
            }
          }
        }
      } catch {
        console.log(`  ⏭️  /${cmd.name}: 既に削除済み`);
      }
    }

    console.log();
    console.log(`📊 削除結果:`);
    console.log(`  コマンド: ${removed.commands}個`);
    console.log(`  エイリアス: ${removed.aliases}個`);
  }

  /**
   * ステータス確認
   */
  async checkStatus() {
    console.log('📊 インストール状況\n');

    console.log('🔍 スラッシュコマンド:');
    for (const cmd of this.commands) {
      const globalPath = SecurityUtils.validatePath(this.globalCommandsPath, cmd.source);
      const localPath = SecurityUtils.validatePath(this.localCommandsPath, cmd.source);

      let status = '❌ 未インストール';
      let size = '';
      
      try {
        const stats = await this.fs.stat(globalPath);
        status = '✅ グローバル登録済み';
        size = ` (${stats.size} bytes)`;
      } catch {
        try {
          await this.fs.stat(localPath);
          status = '⚠️  ローカルのみ';
        } catch {
          // 未インストール
        }
      }

      console.log(`  /${cmd.name}: ${status}${size}`);
      if (cmd.aliases && cmd.aliases.length > 0) {
        console.log(`     エイリアス: ${cmd.aliases.map(a => `/${a}`).join(', ')}`);
      }
    }

    console.log();
    console.log('🤖 エージェント:');
    let agentCount = 0;
    for (const agent of this.requiredAgents) {
      const agentPath = SecurityUtils.validatePath(this.agentsTargetPath, agent);
      try {
        const stats = await this.fs.stat(agentPath);
        console.log(`  ✅ ${agent.replace('.md', '')} (${stats.size} bytes)`);
        agentCount++;
      } catch {
        console.log(`  ❌ ${agent.replace('.md', '')}`);
      }
    }

    console.log();
    console.log(`📁 パス情報:`);
    console.log(`  グローバル: ${this.globalCommandsPath}`);
    console.log(`  ローカル: ${this.localCommandsPath}`);
    console.log(`  エージェント: ${this.agentsTargetPath}`);
    
    console.log();
    console.log(`📈 統計:`);
    console.log(`  コマンド: ${this.commands.length}個中${agentCount}個インストール済み`);
    console.log(`  エージェント: ${this.requiredAgents.length}個中${agentCount}個インストール済み`);
  }

  /**
   * 結果表示
   */
  showResults() {
    console.log('═'.repeat(60));
    console.log('🎉 インストールが完了しました！\n');
    
    console.log('📊 インストール統計:');
    console.log(`  コマンド:`);
    console.log(`    新規: ${this.stats.commandsInstalled}`);
    console.log(`    更新: ${this.stats.commandsUpdated}`);
    console.log(`    失敗: ${this.stats.commandsFailed}`);
    console.log(`  エージェント:`);
    console.log(`    新規: ${this.stats.agentsInstalled}`);
    console.log(`    更新: ${this.stats.agentsUpdated}`);
    console.log(`    失敗: ${this.stats.agentsFailed}`);
    
    console.log();
    console.log('🚀 使い方:');
    console.log('  claude-code /smart-review          # 対話式メニュー');
    console.log('  claude-code /smart-review --help   # ヘルプ表示');
    console.log('  claude-code /review                # エイリアス');
    
    console.log();
    console.log('💡 次のステップ:');
    console.log('  1. インストール確認: npm run register:status');
    console.log('  2. 整合性チェック: node register-slash-command-v2.js verify');
    console.log('  3. アンインストール: npm run unregister');
    
    console.log('═'.repeat(60));
  }

  /**
   * ヘルプ表示
   */
  showHelp() {
    console.log(`
Claude Code スラッシュコマンド登録ツール v2.0

使用方法:
  node register-slash-command-v2.js [コマンド]

コマンド:
  install    スラッシュコマンドをインストール（デフォルト）
  uninstall  スラッシュコマンドをアンインストール
  status     インストール状況を確認
  verify     整合性チェックを実行
  help       このヘルプを表示

例:
  node register-slash-command-v2.js           # インストール
  node register-slash-command-v2.js status    # 状況確認
  node register-slash-command-v2.js verify    # 整合性チェック
  node register-slash-command-v2.js uninstall # アンインストール

環境変数:
  DEBUG=1    デバッグ情報を表示

セキュリティ機能:
  • パストラバーサル攻撃の防止
  • ファイル整合性チェック（SHA-256）
  • アトミックなファイル操作
  • エラーメッセージのサニタイズ

詳細情報:
  README.md を参照してください
`);
  }
}

// メイン処理の実行
if (require.main === module) {
  const registrar = new SlashCommandRegistrar();
  registrar.run().catch(error => {
    ErrorHandler.handle(error, 'Unhandled error');
    process.exit(1);
  });
}

module.exports = SlashCommandRegistrar;