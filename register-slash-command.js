#!/usr/bin/env node
// register-slash-command.js
// Claude Code CLIスラッシュコマンドの登録スクリプト

const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

/**
 * Claude Code スラッシュコマンド登録ツール
 */
class SlashCommandRegistrar {
  constructor() {
    this.projectPath = process.cwd();
    this.homeDir = process.env.HOME || process.env.USERPROFILE;
    
    // Claude Codeのコマンドディレクトリ（グローバル）
    this.globalCommandsPath = path.join(this.homeDir, '.claude', 'commands');
    
    // プロジェクトのコマンドディレクトリ
    this.localCommandsPath = path.join(this.projectPath, '.claudecode', 'commands');
    
    // 登録するコマンドリスト
    this.commands = [
      {
        name: 'smart-review',
        source: 'smart-review-v2.js',
        description: 'インテリジェントコードレビュー自動化システム',
        aliases: ['review', 'sr']
      }
    ];
    
    // 必要なエージェント
    this.requiredAgents = [
      'security-error-xss-analyzer.md',
      'super-debugger-perfectionist.md',
      'deep-code-reviewer.md',
      'project-documentation-updater.md',
      'code-comment-annotator-ja.md'
    ];
  }

  /**
   * メイン処理
   */
  async run() {
    try {
      console.log('🚀 Claude Code スラッシュコマンド登録ツール');
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
      console.error('❌ エラーが発生しました:', error.message);
      process.exit(1);
    }
  }

  /**
   * スラッシュコマンドのインストール
   */
  async install() {
    console.log('📦 スラッシュコマンドをインストールしています...\n');

    // 1. 環境チェック
    await this.checkEnvironment();

    // 2. コマンドディレクトリの作成
    await this.createDirectories();

    // 3. コマンドファイルのコピー
    await this.copyCommands();

    // 4. エージェントのインストール
    await this.installAgents();

    // 5. 設定ファイルの作成
    await this.createConfig();

    // 6. インストール確認
    await this.verifyInstallation();

    // 7. 完了メッセージ
    this.showCompletionMessage();
  }

  /**
   * 環境チェック
   */
  async checkEnvironment() {
    console.log('🔍 環境をチェック中...');

    // Node.jsバージョンチェック
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (majorVersion < 14) {
      throw new Error(`Node.js 14以上が必要です（現在: ${nodeVersion}）`);
    }
    console.log(`  ✅ Node.js: ${nodeVersion}`);

    // Claude Codeのチェック
    try {
      await execFileAsync('claude-code', ['--version']);
      console.log('  ✅ Claude Code: インストール済み');
    } catch {
      console.warn('  ⚠️  Claude Code が見つかりません');
      console.log('     インストール: npm install -g @anthropic/claude-code');
    }

    // プロジェクトファイルの確認
    for (const cmd of this.commands) {
      const sourcePath = path.join(this.projectPath, cmd.source);
      try {
        await fs.access(sourcePath);
        console.log(`  ✅ ${cmd.source}: 存在確認`);
      } catch {
        throw new Error(`必要なファイルが見つかりません: ${cmd.source}`);
      }
    }

    console.log();
  }

  /**
   * ディレクトリの作成
   */
  async createDirectories() {
    console.log('📁 必要なディレクトリを作成中...');

    // グローバルコマンドディレクトリ
    await fs.mkdir(this.globalCommandsPath, { recursive: true });
    console.log(`  ✅ グローバル: ${this.globalCommandsPath}`);

    // ローカルコマンドディレクトリ
    await fs.mkdir(this.localCommandsPath, { recursive: true });
    console.log(`  ✅ ローカル: ${this.localCommandsPath}`);

    console.log();
  }

  /**
   * コマンドファイルのコピー
   */
  async copyCommands() {
    console.log('📋 スラッシュコマンドを登録中...');

    for (const cmd of this.commands) {
      const sourcePath = path.join(this.projectPath, cmd.source);
      const globalTarget = path.join(this.globalCommandsPath, cmd.source);
      const localTarget = path.join(this.localCommandsPath, cmd.source);

      try {
        // グローバルディレクトリにコピー（推奨）
        await fs.copyFile(sourcePath, globalTarget);
        console.log(`  ✅ /${cmd.name}: グローバル登録完了`);

        // ローカルディレクトリにもコピー
        await fs.copyFile(sourcePath, localTarget);
        console.log(`     📁 ローカルバックアップ作成`);

        // エイリアスの設定（必要に応じて）
        if (cmd.aliases && cmd.aliases.length > 0) {
          for (const alias of cmd.aliases) {
            const aliasPath = path.join(this.globalCommandsPath, `${alias}.js`);
            try {
              // エイリアスファイルの作成（元ファイルをrequire）
              const aliasContent = `// Alias for ${cmd.name}
module.exports = require('./${cmd.source}');`;
              await fs.writeFile(aliasPath, aliasContent);
              console.log(`     🔗 エイリアス /${alias} を作成`);
            } catch {
              // エイリアス作成失敗は警告のみ
            }
          }
        }
      } catch (error) {
        console.error(`  ❌ ${cmd.name}: 登録失敗 - ${error.message}`);
        throw error;
      }
    }

    console.log();
  }

  /**
   * エージェントのインストール
   */
  async installAgents() {
    console.log('🤖 必要なエージェントをインストール中...');

    const agentsSourcePath = path.join(this.projectPath, 'agents');
    const agentsTargetPath = path.join(this.homeDir, '.claude', 'agents');

    try {
      // エージェントディレクトリの確認
      await fs.access(agentsSourcePath);
      
      // ターゲットディレクトリの作成
      await fs.mkdir(agentsTargetPath, { recursive: true });

      let installedCount = 0;
      for (const agent of this.requiredAgents) {
        const sourcePath = path.join(agentsSourcePath, agent);
        const targetPath = path.join(agentsTargetPath, agent);

        try {
          await fs.copyFile(sourcePath, targetPath);
          console.log(`  ✅ ${agent.replace('.md', '')}`);
          installedCount++;
        } catch {
          console.log(`  ⏭️  ${agent.replace('.md', '')}: スキップ`);
        }
      }

      console.log(`  📊 ${installedCount}/${this.requiredAgents.length} エージェントをインストール`);
    } catch {
      console.log('  ⚠️  エージェントディレクトリが見つかりません');
      console.log('     別途 install-agents.js を実行してください');
    }

    console.log();
  }

  /**
   * 設定ファイルの作成
   */
  async createConfig() {
    console.log('⚙️  設定ファイルを作成中...');

    const configPath = path.join(this.projectPath, '.smart-review.json');

    try {
      await fs.access(configPath);
      console.log('  ⏭️  設定ファイルは既に存在します');
    } catch {
      const config = {
        version: '2.0.0',
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
          globalRegistration: true
        }
      };

      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
      console.log('  ✅ .smart-review.json 作成完了');
    }

    console.log();
  }

  /**
   * インストール確認
   */
  async verifyInstallation() {
    console.log('🔍 インストールを確認中...');

    let successCount = 0;
    let totalCount = 0;

    // コマンドの確認
    for (const cmd of this.commands) {
      totalCount++;
      const globalPath = path.join(this.globalCommandsPath, cmd.source);
      try {
        await fs.access(globalPath);
        console.log(`  ✅ /${cmd.name} コマンド: 利用可能`);
        successCount++;
      } catch {
        console.log(`  ❌ /${cmd.name} コマンド: 見つかりません`);
      }
    }

    if (successCount === totalCount) {
      console.log(`  🎉 すべてのコマンドが正常に登録されました`);
    } else {
      console.warn(`  ⚠️  一部のコマンドの登録に失敗しました`);
    }

    console.log();
  }

  /**
   * アンインストール
   */
  async uninstall() {
    console.log('🗑️  スラッシュコマンドをアンインストール中...\n');

    let removedCount = 0;

    // グローバルコマンドの削除
    for (const cmd of this.commands) {
      const globalPath = path.join(this.globalCommandsPath, cmd.source);
      try {
        await fs.unlink(globalPath);
        console.log(`  ✅ /${cmd.name}: 削除完了`);
        removedCount++;

        // エイリアスの削除
        if (cmd.aliases) {
          for (const alias of cmd.aliases) {
            const aliasPath = path.join(this.globalCommandsPath, `${alias}.js`);
            try {
              await fs.unlink(aliasPath);
              console.log(`     🔗 エイリアス /${alias} を削除`);
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
    console.log(`📊 ${removedCount}個のコマンドを削除しました`);
  }

  /**
   * ステータス確認
   */
  async checkStatus() {
    console.log('📊 インストール状況\n');

    console.log('🔍 スラッシュコマンド:');
    for (const cmd of this.commands) {
      const globalPath = path.join(this.globalCommandsPath, cmd.source);
      const localPath = path.join(this.localCommandsPath, cmd.source);

      let status = '❌ 未インストール';
      try {
        await fs.access(globalPath);
        status = '✅ グローバル登録済み';
      } catch {
        try {
          await fs.access(localPath);
          status = '⚠️  ローカルのみ';
        } catch {
          // 未インストール
        }
      }

      console.log(`  /${cmd.name}: ${status}`);
      if (cmd.aliases && cmd.aliases.length > 0) {
        console.log(`     エイリアス: ${cmd.aliases.map(a => `/${a}`).join(', ')}`);
      }
    }

    console.log();
    console.log('🤖 エージェント:');
    const agentsPath = path.join(this.homeDir, '.claude', 'agents');
    let agentCount = 0;
    for (const agent of this.requiredAgents) {
      const agentPath = path.join(agentsPath, agent);
      try {
        await fs.access(agentPath);
        console.log(`  ✅ ${agent.replace('.md', '')}`);
        agentCount++;
      } catch {
        console.log(`  ❌ ${agent.replace('.md', '')}`);
      }
    }

    console.log();
    console.log(`📁 パス情報:`);
    console.log(`  グローバル: ${this.globalCommandsPath}`);
    console.log(`  ローカル: ${this.localCommandsPath}`);
    console.log(`  エージェント: ${agentsPath}`);
  }

  /**
   * 完了メッセージ
   */
  showCompletionMessage() {
    console.log('═'.repeat(60));
    console.log('🎉 スラッシュコマンドの登録が完了しました！\n');
    
    console.log('📋 利用可能なコマンド:');
    for (const cmd of this.commands) {
      console.log(`  • claude-code /${cmd.name}`);
      if (cmd.aliases && cmd.aliases.length > 0) {
        console.log(`    エイリアス: ${cmd.aliases.map(a => `/${a}`).join(', ')}`);
      }
    }
    
    console.log();
    console.log('🚀 使い方:');
    console.log('  1. 対話式メニュー:');
    console.log('     claude-code /smart-review');
    console.log();
    console.log('  2. クイックレビュー:');
    console.log('     claude-code /smart-review --scope changes');
    console.log();
    console.log('  3. セキュリティ監査:');
    console.log('     claude-code /smart-review --scope all --priority-threshold critical');
    console.log();
    console.log('  4. ヘルプ表示:');
    console.log('     claude-code /smart-review --help');
    
    console.log();
    console.log('💡 ヒント:');
    console.log('  • このコマンドは任意のディレクトリから実行可能です');
    console.log('  • 設定は .smart-review.json で カスタマイズできます');
    console.log('  • エージェントは自動的にインストールされます');
    
    console.log();
    console.log('📚 詳細情報:');
    console.log('  • README.md - 使用方法の詳細');
    console.log('  • CLAUDE.md - Claude Code向けの指示');
    console.log('  • AGENTS.md - エージェントの説明');
    
    console.log('═'.repeat(60));
  }

  /**
   * ヘルプ表示
   */
  showHelp() {
    console.log(`
Claude Code スラッシュコマンド登録ツール

使用方法:
  node register-slash-command.js [コマンド]

コマンド:
  install    スラッシュコマンドをインストール（デフォルト）
  uninstall  スラッシュコマンドをアンインストール
  status     インストール状況を確認
  help       このヘルプを表示

例:
  node register-slash-command.js           # インストール
  node register-slash-command.js status    # 状況確認
  node register-slash-command.js uninstall # アンインストール

このツールは以下を行います:
  1. smart-review コマンドをClaude Codeに登録
  2. 必要なエージェントをインストール
  3. 設定ファイルを作成
  4. グローバルとローカル両方に登録

登録後の使用方法:
  claude-code /smart-review [オプション]
  claude-code /review       # エイリアス
  claude-code /sr          # 短縮エイリアス
`);
  }
}

// メイン処理の実行
if (require.main === module) {
  const registrar = new SlashCommandRegistrar();
  registrar.run();
}

module.exports = SlashCommandRegistrar;