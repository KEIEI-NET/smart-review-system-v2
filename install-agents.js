#!/usr/bin/env node
// install-agents.js
// Smart Review エージェントのインストールスクリプト

const path = require('path');
const fs = require('fs').promises;
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

// 共通ユーティリティモジュールをインポート
const {
  SecurityUtils,
  SystemUtils,
  FileOperations
} = require('./lib/common-utils');

/**
 * エージェントインストーラークラス
 */
class AgentInstaller {
  constructor() {
    this.projectPath = process.cwd();
    this.agentsPath = path.join(this.projectPath, 'agents');
    this.targetPath = path.join(SystemUtils.getHomeDir(), '.claude', 'agents');
  }

  /**
   * メインインストール処理
   */
  async install() {
    console.log('🤖 Smart Review エージェントのインストールを開始します...\n');
    
    try {
      // 1. 環境チェック
      await this.checkEnvironment();
      
      // 2. ターゲットディレクトリの作成
      await this.createTargetDirectory();
      
      // 3. エージェントファイルのコピー
      await this.copyAgents();
      
      // 4. インストール確認
      await this.verifyInstallation();
      
      // 5. 完了メッセージ
      this.showCompletionMessage();
      
    } catch (error) {
      console.error('❌ インストール中にエラーが発生しました:', error.message);
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
    if (majorVersion < 14) {
      throw new Error(`Node.js 14以上が必要です（現在: ${nodeVersion}）`);
    }
    console.log(`  ✅ Node.js: ${nodeVersion}`);
    
    // プロジェクトのエージェントディレクトリ確認
    try {
      await fs.access(this.agentsPath);
      console.log(`  ✅ エージェントディレクトリ: ${this.agentsPath}`);
    } catch {
      throw new Error(`エージェントディレクトリが見つかりません: ${this.agentsPath}`);
    }
    
    // エージェントファイルの確認
    const requiredAgents = [
      'security-error-xss-analyzer.md',
      'super-debugger-perfectionist.md',
      'deep-code-reviewer.md',
      'project-documentation-updater.md',
      'code-comment-annotator-ja.md'
    ];
    
    for (const agent of requiredAgents) {
      const agentPath = path.join(this.agentsPath, agent);
      try {
        await fs.access(agentPath);
        console.log(`  ✅ ${agent.replace('.md', '')}`);
      } catch {
        throw new Error(`必要なエージェントファイルが見つかりません: ${agent}`);
      }
    }
    
    console.log();
  }

  /**
   * ターゲットディレクトリの作成
   */
  async createTargetDirectory() {
    console.log('📁 インストール先ディレクトリを準備中...');
    
    try {
      await fs.mkdir(this.targetPath, { recursive: true });
      console.log(`  ✅ ディレクトリ作成: ${this.targetPath}`);
    } catch (error) {
      throw new Error(`ディレクトリの作成に失敗: ${error.message}`);
    }
    
    // 権限確認
    try {
      const testFile = path.join(this.targetPath, '.write-test');
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
      console.log('  ✅ 書き込み権限確認完了');
    } catch (error) {
      throw new Error(`書き込み権限がありません: ${this.targetPath}`);
    }
    
    console.log();
  }

  /**
   * エージェントファイルのコピー
   */
  async copyAgents() {
    console.log('📋 エージェントファイルをインストール中...');
    
    const agentFiles = await fs.readdir(this.agentsPath);
    const mdFiles = agentFiles.filter(file => file.endsWith('.md'));
    
    let installedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const file of mdFiles) {
      const sourcePath = path.join(this.agentsPath, file);
      const targetFilePath = path.join(this.targetPath, file);
      const agentName = file.replace('.md', '');
      
      try {
        // 既存ファイルの確認
        let needsInstall = false;
        let isUpdate = false;
        
        try {
          const existingContent = await fs.readFile(targetFilePath, 'utf8');
          const newContent = await fs.readFile(sourcePath, 'utf8');
          
          if (existingContent !== newContent) {
            needsInstall = true;
            isUpdate = true;
          } else {
            console.log(`  ⚪ ${agentName}: 既に最新版がインストール済み`);
            skippedCount++;
            continue;
          }
        } catch {
          // ファイルが存在しない場合
          needsInstall = true;
        }
        
        if (needsInstall) {
          // バックアップの作成（更新の場合）
          if (isUpdate) {
            const backupPath = `${targetFilePath}.backup-${Date.now()}`;
            try {
              await fs.copyFile(targetFilePath, backupPath);
              console.log(`  📦 ${agentName}: バックアップ作成`);
            } catch {
              // バックアップ失敗は警告のみ
              console.warn(`  ⚠️ ${agentName}: バックアップの作成に失敗`);
            }
          }
          
          // エージェントファイルのコピー
          await fs.copyFile(sourcePath, targetFilePath);
          
          if (isUpdate) {
            console.log(`  🔄 ${agentName}: 更新完了`);
            updatedCount++;
          } else {
            console.log(`  ✅ ${agentName}: インストール完了`);
            installedCount++;
          }
        }
        
      } catch (error) {
        console.error(`  ❌ ${agentName}: インストール失敗 - ${error.message}`);
        throw new Error(`エージェントのインストールに失敗: ${agentName}`);
      }
    }
    
    console.log(`\n📊 インストール結果:`);
    console.log(`  • 新規インストール: ${installedCount}件`);
    console.log(`  • 更新: ${updatedCount}件`);
    console.log(`  • スキップ: ${skippedCount}件`);
    console.log();
  }

  /**
   * インストール確認
   */
  async verifyInstallation() {
    console.log('🔍 インストールを確認中...');
    
    const requiredAgents = [
      'security-error-xss-analyzer.md',
      'super-debugger-perfectionist.md',
      'deep-code-reviewer.md',
      'project-documentation-updater.md',
      'code-comment-annotator-ja.md'
    ];
    
    let verifiedCount = 0;
    
    for (const agent of requiredAgents) {
      const targetFilePath = path.join(this.targetPath, agent);
      const agentName = agent.replace('.md', '');
      
      try {
        const stats = await fs.stat(targetFilePath);
        if (stats.isFile() && stats.size > 0) {
          console.log(`  ✅ ${agentName}: 確認済み (${stats.size} bytes)`);
          verifiedCount++;
        } else {
          console.error(`  ❌ ${agentName}: ファイルが不正です`);
        }
      } catch {
        console.error(`  ❌ ${agentName}: ファイルが見つかりません`);
      }
    }
    
    if (verifiedCount === requiredAgents.length) {
      console.log(`  🎉 全${verifiedCount}個のエージェントが正常にインストールされました`);
    } else {
      throw new Error(`インストール確認に失敗: ${verifiedCount}/${requiredAgents.length}`);
    }
    
    console.log();
  }

  /**
   * 完了メッセージ
   */
  showCompletionMessage() {
    console.log('🎉 Smart Review エージェントのインストールが完了しました！\n');
    
    console.log('📋 次のステップ:');
    console.log('  1. Smart Review の動作テスト:');
    console.log('     claude-code smart-review --test');
    console.log('');
    console.log('  2. インタラクティブメニューの起動:');
    console.log('     claude-code smart-review');
    console.log('');
    console.log('  3. ヘルプの表示:');
    console.log('     claude-code smart-review --help');
    console.log('');
    
    console.log('📁 インストール先:');
    console.log(`     ${this.targetPath}`);
    console.log('');
    
    console.log('📚 詳細情報:');
    console.log('  • README.md - 使用方法とセットアップガイド');
    console.log('  • AGENTS.md - エージェントの詳細説明');
    console.log('  • Smart-Review-SystemGuide.md - システム運用ガイド');
    console.log('');
    
    console.log('🤝 問題が発生した場合:');
    console.log('  • GitHub Issues: https://github.com/KEIEI-NET/smart-review-system/issues');
    console.log('  • SECURITY.md - セキュリティ関連の報告');
    console.log('');
    
    console.log('✨ Smart Review システムをお楽しみください！');
  }

  /**
   * エージェント一覧表示
   */
  async listAgents() {
    console.log('📋 利用可能なエージェント:\n');
    
    try {
      const agentFiles = await fs.readdir(this.agentsPath);
      const mdFiles = agentFiles.filter(file => file.endsWith('.md'));
      
      for (const file of mdFiles) {
        const agentPath = path.join(this.agentsPath, file);
        const content = await fs.readFile(agentPath, 'utf8');
        
        // メタデータを抽出
        const nameMatch = content.match(/name:\s*(.+)/);
        const descMatch = content.match(/description:\s*(.+?)(?=\n)/s);
        
        const name = nameMatch ? nameMatch[1].trim() : file.replace('.md', '');
        const description = descMatch ? descMatch[1].trim().substring(0, 100) + '...' : '説明なし';
        
        console.log(`🤖 ${name}`);
        console.log(`   ${description.replace(/\n/g, ' ')}`);
        console.log();
      }
    } catch (error) {
      console.error('エージェント一覧の取得に失敗:', error.message);
    }
  }

  /**
   * アンインストール
   */
  async uninstall() {
    console.log('🗑️ Smart Review エージェントをアンインストールします...\n');
    
    try {
      const requiredAgents = [
        'security-error-xss-analyzer.md',
        'super-debugger-perfectionist.md',
        'deep-code-reviewer.md',
        'project-documentation-updater.md',
        'code-comment-annotator-ja.md'
      ];
      
      let removedCount = 0;
      
      for (const agent of requiredAgents) {
        const targetFilePath = path.join(this.targetPath, agent);
        const agentName = agent.replace('.md', '');
        
        try {
          await fs.unlink(targetFilePath);
          console.log(`  ✅ ${agentName}: 削除完了`);
          removedCount++;
        } catch {
          console.log(`  ⚪ ${agentName}: 既に削除済み`);
        }
      }
      
      console.log(`\n🗑️ ${removedCount}個のエージェントを削除しました`);
      
    } catch (error) {
      console.error('アンインストール中にエラーが発生:', error.message);
      process.exit(1);
    }
  }
}

// メイン処理
async function main() {
  const installer = new AgentInstaller();
  const command = process.argv[2];
  
  switch (command) {
    case 'install':
    case undefined:
      await installer.install();
      break;
      
    case 'list':
      await installer.listAgents();
      break;
      
    case 'uninstall':
      await installer.uninstall();
      break;
      
    case '--help':
    case '-h':
      console.log(`
🤖 Smart Review エージェントインストーラー

使用方法:
  node install-agents.js [command]

コマンド:
  install     エージェントをインストール (デフォルト)
  list        利用可能なエージェント一覧を表示
  uninstall   インストール済みエージェントを削除
  --help, -h  このヘルプを表示

例:
  node install-agents.js
  node install-agents.js install
  node install-agents.js list
  node install-agents.js uninstall
`);
      break;
      
    default:
      console.error(`不明なコマンド: ${command}`);
      console.log('ヘルプを表示するには: node install-agents.js --help');
      process.exit(1);
  }
}

// エラーハンドリング
process.on('uncaughtException', (error) => {
  console.error('予期しないエラーが発生しました:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未処理のPromise拒否:', reason);
  process.exit(1);
});

// 実行
if (require.main === module) {
  main().catch(error => {
    console.error('実行エラー:', error.message);
    process.exit(1);
  });
}

module.exports = AgentInstaller;