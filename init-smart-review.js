#!/usr/bin/env node
// init-smart-review.js
// スマートレビューシステムのプロジェクト初期化スクリプト

const path = require('path');
const fs = require('fs').promises;
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

/**
 * プロジェクト初期化クラス
 */
class SmartReviewInitializer {
  constructor() {
    this.projectPath = process.cwd();
    this.claudeCodePath = path.join(this.projectPath, '.claudecode');
    this.commandsPath = path.join(this.claudeCodePath, 'commands');
    this.globalCommandsPath = path.join(process.env.HOME || process.env.USERPROFILE, '.claude', 'commands');
  }

  /**
   * Windows管理者権限チェック
   */
  async checkWindowsAdmin() {
    if (process.platform !== 'win32') {
      return true;
    }
    
    try {
      // Windows管理者権限のチェック
      const { stdout } = await execFileAsync('net', ['session'], { 
        timeout: 5000,
        windowsHide: true 
      });
      return true; // 管理者権限あり
    } catch (error) {
      return false; // 管理者権限なし
    }
  }

  /**
   * 初期化プロセスのメイン実行
   */
  async initialize() {
    console.log('🚀 Smart Review システムの初期化を開始します...\n');
    
    try {
      // Windows環境での管理者権限チェック
      if (process.platform === 'win32') {
        const isAdmin = await this.checkWindowsAdmin();
        if (!isAdmin) {
          console.log('⚠️  警告: 管理者権限がありません');
          console.log('  一部の機能が制限される可能性があります');
          console.log('  シンボリックリンクの代わりにファイルをコピーします\n');
        }
      }
      
      // 1. 環境チェック
      await this.checkEnvironment();
      
      // 2. ディレクトリ構造の作成
      await this.createDirectories();
      
      // 3. グローバルコマンドのリンク作成
      await this.linkGlobalCommands();
      
      // 4. プロジェクト設定ファイルの作成
      await this.createProjectConfig();
      
      // 5. .gitignoreの更新
      await this.updateGitignore();
      
      // 6. package.jsonへのスクリプト追加
      await this.updatePackageJson();
      
      // 7. エージェントのインストール
      await this.installAgents();
      
      // 8. 初期TODOファイルの作成
      await this.createInitialTodo();
      
      // 9. セットアップ完了メッセージ
      this.showCompletionMessage();
      
    } catch (error) {
      console.error('❌ 初期化中にエラーが発生しました:', error.message);
      process.exit(1);
    }
  }

  /**
   * 環境チェック
   */
  async checkEnvironment() {
    console.log('📋 環境をチェック中...');
    
    // Claude Codeの存在確認
    try {
      await execFileAsync('claude-code', ['--version']);
      console.log('  ✅ Claude Code が検出されました');
    } catch {
      console.error('  ❌ Claude Code が見つかりません。インストールしてください。');
      process.exit(1);
    }
    
    // Gitの存在確認
    try {
      await execFileAsync('git', ['--version']);
      console.log('  ✅ Git が検出されました');
    } catch {
      console.log('  ⚠️  Git が見つかりません。一部機能が制限されます。');
    }
    
    // Node.jsバージョンチェック
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
    if (majorVersion < 14) {
      console.error('  ❌ Node.js 14以上が必要です。現在のバージョン:', nodeVersion);
      process.exit(1);
    }
    console.log('  ✅ Node.js バージョン:', nodeVersion);
    
    console.log();
  }

  /**
   * ディレクトリ構造の作成
   */
  async createDirectories() {
    console.log('📁 ディレクトリ構造を作成中...');
    
    const directories = [
      this.claudeCodePath,
      this.commandsPath,
      path.join(this.projectPath, 'smart-review-results'),
      path.join(this.projectPath, '.smart-review-cache')
    ];
    
    for (const dir of directories) {
      await fs.mkdir(dir, { recursive: true });
      console.log(`  ✅ ${path.relative(this.projectPath, dir)}`);
    }
    
    console.log();
  }

  /**
   * グローバルコマンドのリンク作成
   */
  async linkGlobalCommands() {
    console.log('🔗 グローバルコマンドをリンク中...');
    
    const commands = [
      'smart-review-v2.js',  // 最新版（対話式メニュー付き）
      'smart-review.js',     // 標準版
      'smart-review-config.js'  // 設定管理モジュール
    ];
    
    for (const command of commands) {
      const sourcePath = path.join(this.globalCommandsPath, command);
      const targetPath = path.join(this.commandsPath, command);
      
      try {
        // 既存ファイルの確認
        await fs.access(sourcePath);
        
        // シンボリックリンクまたはコピー
        if (process.platform === 'win32') {
          // Windowsの場合は管理者権限をチェック
          const isAdmin = await this.checkWindowsAdmin();
          if (isAdmin) {
            // 管理者権限があればシンボリックリンクを試行
            try {
              await fs.symlink(sourcePath, targetPath, 'file');
              console.log(`  ✅ ${command} (リンク済み)`);
            } catch {
              // 失敗したらコピー
              await fs.copyFile(sourcePath, targetPath);
              console.log(`  ✅ ${command} (コピー済み)`);
            }
          } else {
            // 管理者権限なしの場合はコピー
            await fs.copyFile(sourcePath, targetPath);
            console.log(`  ✅ ${command} (コピー済み)`);
          }
        } else {
          // Unix系の場合はシンボリックリンク
          try {
            await fs.symlink(sourcePath, targetPath);
            console.log(`  ✅ ${command} (リンク済み)`);
          } catch {
            // リンク作成失敗時はコピー
            await fs.copyFile(sourcePath, targetPath);
            console.log(`  ✅ ${command} (コピー済み)`);
          }
        }
      } catch (error) {
        console.log(`  ⚠️  ${command} が見つかりません`);
      }
    }
    
    console.log();
  }

  /**
   * プロジェクト設定ファイルの作成
   */
  async createProjectConfig() {
    console.log('⚙️  プロジェクト設定を作成中...');
    
    const configPath = path.join(this.projectPath, '.smart-review.json');
    
    // 既存設定の確認
    try {
      await fs.access(configPath);
      console.log('  ℹ️  既存の設定ファイルが見つかりました');
      
      // バックアップ作成
      const backupPath = `${configPath}.backup-${Date.now()}`;
      await fs.copyFile(configPath, backupPath);
      console.log(`  ✅ バックアップ作成: ${path.basename(backupPath)}`);
    } catch {
      // 新規作成
      const projectConfig = {
        project: {
          name: path.basename(this.projectPath),
          path: this.projectPath,
          created: new Date().toISOString(),
          version: '2.0.0'
        },
        agents: [
          {
            id: 'security-error-xss-analyzer',
            enabled: true,
            priority: 'critical'
          },
          {
            id: 'super-debugger-perfectionist',
            enabled: true,
            priority: 'high'
          },
          {
            id: 'deep-code-reviewer',
            enabled: true,
            priority: 'medium'
          },
          {
            id: 'project-documentation-updater',
            enabled: true,
            priority: 'low'
          }
        ],
        performance: {
          maxConcurrency: 4,
          cacheEnabled: true,
          cacheTTL: 900000
        },
        security: {
          preventPathTraversal: true,
          sanitizeOutput: true,
          maxFileSize: 10485760
        },
        output: {
          format: 'both',
          includeMetrics: true,
          timestampFormat: 'ISO'
        }
      };
      
      await fs.writeFile(configPath, JSON.stringify(projectConfig, null, 2));
      console.log('  ✅ .smart-review.json 作成完了');
    }
    
    console.log();
  }

  /**
   * .gitignoreの更新
   */
  async updateGitignore() {
    console.log('📝 .gitignore を更新中...');
    
    const gitignorePath = path.join(this.projectPath, '.gitignore');
    const smartReviewIgnores = [
      '',
      '# Smart Review',
      'smart-review-results/',
      '.smart-review-cache/',
      '*.smart-review.backup-*',
      'TODO-*.md',
      'report-*.html',
      ''
    ].join('\n');
    
    try {
      let content = await fs.readFile(gitignorePath, 'utf8');
      
      if (!content.includes('# Smart Review')) {
        content += smartReviewIgnores;
        await fs.writeFile(gitignorePath, content);
        console.log('  ✅ .gitignore 更新完了');
      } else {
        console.log('  ℹ️  .gitignore は既に設定済みです');
      }
    } catch {
      // .gitignoreが存在しない場合は作成
      await fs.writeFile(gitignorePath, smartReviewIgnores);
      console.log('  ✅ .gitignore 作成完了');
    }
    
    console.log();
  }

  /**
   * package.jsonへのスクリプト追加
   */
  async updatePackageJson() {
    console.log('📦 package.json を更新中...');
    
    const packageJsonPath = path.join(this.projectPath, 'package.json');
    
    try {
      const content = await fs.readFile(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(content);
      
      // スクリプトセクションの確認と追加
      if (!packageJson.scripts) {
        packageJson.scripts = {};
      }
      
      const scripts = {
        'review': 'claude-code smart-review',  // 対話式メニュー起動
        'review:fix': 'claude-code smart-review --scope changes',
        'review:quick': 'claude-code smart-review --scope all --priority-threshold high',
        'review:security': 'claude-code smart-review --scope all --priority-threshold critical',
        'review:test': 'claude-code smart-review --test',  // システムテスト
        'review:help': 'claude-code smart-review --help'   // ヘルプ表示
      };
      
      let updated = false;
      for (const [name, command] of Object.entries(scripts)) {
        if (!packageJson.scripts[name]) {
          packageJson.scripts[name] = command;
          updated = true;
          console.log(`  ✅ スクリプト追加: ${name}`);
        }
      }
      
      if (updated) {
        await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
      } else {
        console.log('  ℹ️  スクリプトは既に設定済みです');
      }
    } catch {
      console.log('  ⚠️  package.json が見つかりません');
    }
    
    console.log();
  }

  /**
   * 初期TODOファイルの作成
   */
  async createInitialTodo() {
    console.log('📋 初期TODOファイルを作成中...');
    
    const todoPath = path.join(this.projectPath, 'TODO.md');
    
    try {
      await fs.access(todoPath);
      console.log('  ℹ️  TODO.md は既に存在します');
    } catch {
      const initialTodo = `# プロジェクト TODO リスト

## 概要
- **プロジェクト名**: ${path.basename(this.projectPath)}
- **作成日**: ${new Date().toISOString()}
- **最終チェック**: 未実行

## Smart Review セットアップ完了 ✅

### 次のステップ

1. [ ] 初回レビューの実行
   \`\`\`bash
   npm run review
   \`\`\`

2. [ ] セキュリティチェックの実行
   \`\`\`bash
   npm run review:security
   \`\`\`

3. [ ] 変更差分の自動修正
   \`\`\`bash
   npm run review:fix
   \`\`\`

## 使用可能なコマンド

- \`npm run review\` - プロジェクト全体の分析
- \`npm run review:fix\` - 変更差分の自動修正
- \`npm run review:quick\` - 高優先度問題のみチェック
- \`npm run review:security\` - セキュリティ問題のみチェック

## カスタマイズ

設定ファイル \`.smart-review.json\` を編集してカスタマイズできます。

---
*このファイルは Smart Review によって自動生成されました*
`;
      
      await fs.writeFile(todoPath, initialTodo);
      console.log('  ✅ TODO.md 作成完了');
    }
    
    console.log();
  }

  /**
   * エージェントのインストール
   */
  async installAgents() {
    console.log('🤖 Smart Review エージェントをインストール中...');
    
    const agentsPath = path.join(this.projectPath, 'agents');
    const targetPath = path.join(process.env.HOME || process.env.USERPROFILE, '.claude', 'agents');
    
    try {
      // プロジェクトのagentsディレクトリが存在するか確認
      await fs.access(agentsPath);
    } catch {
      console.log('  ⚠️ プロジェクトにエージェントディレクトリが見つかりません');
      console.log('  💡 GitHub版を使用している場合は、agents/ ディレクトリを確認してください');
      return;
    }
    
    try {
      // ターゲットディレクトリの作成
      await fs.mkdir(targetPath, { recursive: true });
      
      // エージェントファイルの取得
      const agentFiles = await fs.readdir(agentsPath);
      const mdFiles = agentFiles.filter(file => file.endsWith('.md'));
      
      if (mdFiles.length === 0) {
        console.log('  ⚠️ エージェントファイルが見つかりません');
        return;
      }
      
      let installedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      
      for (const file of mdFiles) {
        const sourcePath = path.join(agentsPath, file);
        const targetFilePath = path.join(targetPath, file);
        const agentName = file.replace('.md', '');
        
        try {
          // 既存ファイルのチェック
          let needsInstall = false;
          let isUpdate = false;
          
          try {
            const existingContent = await fs.readFile(targetFilePath, 'utf8');
            const newContent = await fs.readFile(sourcePath, 'utf8');
            
            if (existingContent !== newContent) {
              needsInstall = true;
              isUpdate = true;
            } else {
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
              } catch {
                // バックアップ失敗は警告のみ
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
          console.log(`  ❌ ${agentName}: インストール失敗 - ${error.message}`);
        }
      }
      
      console.log(`  📊 結果: 新規${installedCount}件、更新${updatedCount}件、スキップ${skippedCount}件`);
      
      // インストール先の表示
      console.log(`  📁 インストール先: ${targetPath}`);
      
    } catch (error) {
      console.error('  ❌ エージェントのインストールに失敗:', error.message);
      console.log('  💡 手動でエージェントをインストールしてください:');
      console.log('     node install-agents.js');
    }
    
    console.log();
  }

  /**
   * 完了メッセージの表示
   */
  showCompletionMessage() {
    console.log('═'.repeat(70));
    console.log('🎉 Smart Review システムの初期化が完了しました！\n');
    console.log('📚 使用方法:\n');
    console.log('  1. プロジェクト全体の分析:');
    console.log('     npm run review\n');
    console.log('  2. 変更差分の自動修正:');
    console.log('     npm run review:fix\n');
    console.log('  3. セキュリティチェック:');
    console.log('     npm run review:security\n');
    console.log('  4. 高速チェック（高優先度のみ）:');
    console.log('     npm run review:quick\n');
    console.log('📁 生成されたファイル:\n');
    console.log('  - .smart-review.json (設定ファイル)');
    console.log('  - TODO.md (初期TODOリスト)');
    console.log('  - .claudecode/commands/ (コマンドディレクトリ)\n');
    console.log('💡 ヒント: .smart-review.json を編集してカスタマイズできます');
    console.log('═'.repeat(70));
  }
}

// CLIとして実行された場合
if (require.main === module) {
  const initializer = new SmartReviewInitializer();
  initializer.initialize().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = SmartReviewInitializer;