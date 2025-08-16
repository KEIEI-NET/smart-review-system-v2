#!/usr/bin/env node
/**
 * integration.test.js
 * 統合テスト
 * 
 * バージョン: v1.0.0
 * 最終更新: 2025年08月16日 17:20 JST
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { spawn } = require('child_process');

// テスト用の一時ディレクトリ
const TEST_DIR = path.join(os.tmpdir(), 'smart-review-test-' + process.pid);
const TEST_HOME = path.join(TEST_DIR, 'home');
const TEST_PROJECT = path.join(TEST_DIR, 'project');

/**
 * テスト環境のセットアップ
 */
async function setupTestEnvironment() {
  // テストディレクトリの作成
  await fs.mkdir(TEST_DIR, { recursive: true });
  await fs.mkdir(TEST_HOME, { recursive: true });
  await fs.mkdir(TEST_PROJECT, { recursive: true });
  
  // テスト用のプロジェクトファイルをコピー
  const projectRoot = path.join(__dirname, '..');
  
  // 必要なファイルのコピー
  const filesToCopy = [
    'package.json',
    'smart-review-v2.js',
    'smart-review-config.js',
    'register-slash-command-v2.js',
    'install-agents.js',
    'smart-updater.js',
    'version-manifest.json'
  ];
  
  for (const file of filesToCopy) {
    try {
      await fs.copyFile(
        path.join(projectRoot, file),
        path.join(TEST_PROJECT, file)
      );
    } catch (error) {
      console.warn(`ファイルコピーをスキップ: ${file}`);
    }
  }
  
  // libディレクトリのコピー
  await fs.mkdir(path.join(TEST_PROJECT, 'lib'), { recursive: true });
  try {
    await fs.copyFile(
      path.join(projectRoot, 'lib', 'common-utils.js'),
      path.join(TEST_PROJECT, 'lib', 'common-utils.js')
    );
  } catch (error) {
    console.warn('libディレクトリのコピーをスキップ');
  }
  
  // agentsディレクトリの作成（ダミーファイル）
  await fs.mkdir(path.join(TEST_PROJECT, 'agents'), { recursive: true });
  const dummyAgents = [
    'security-error-xss-analyzer.md',
    'super-debugger-perfectionist.md',
    'deep-code-reviewer.md',
    'project-documentation-updater.md',
    'code-comment-annotator-ja.md'
  ];
  
  for (const agent of dummyAgents) {
    await fs.writeFile(
      path.join(TEST_PROJECT, 'agents', agent),
      `# ${agent}\n\nDummy agent for testing.`
    );
  }
}

/**
 * テスト環境のクリーンアップ
 */
async function cleanupTestEnvironment() {
  try {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  } catch (error) {
    console.warn('テスト環境のクリーンアップに失敗:', error.message);
  }
}

/**
 * コマンド実行ヘルパー
 */
function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: TEST_PROJECT,
      env: {
        ...process.env,
        HOME: TEST_HOME,
        USERPROFILE: TEST_HOME
      },
      ...options
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });
    
    child.on('error', (error) => {
      reject(error);
    });
  });
}

describe('統合テスト', () => {
  before(async () => {
    await setupTestEnvironment();
  });
  
  after(async () => {
    await cleanupTestEnvironment();
  });
  
  describe('環境チェック', () => {
    it('Node.jsバージョンが要件を満たしている', () => {
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
      assert.ok(majorVersion >= 14, 'Node.js 14以上が必要');
    });
    
    it('必要なファイルが存在する', async () => {
      const requiredFiles = [
        'package.json',
        'smart-review-v2.js',
        'register-slash-command-v2.js',
        'lib/common-utils.js'
      ];
      
      for (const file of requiredFiles) {
        const filePath = path.join(TEST_PROJECT, file);
        const exists = await fs.access(filePath).then(() => true).catch(() => false);
        assert.ok(exists, `ファイルが存在しない: ${file}`);
      }
    });
  });
  
  describe('スラッシュコマンド登録', () => {
    it('ステータスチェックが実行できる', async () => {
      try {
        const result = await runCommand('node', ['register-slash-command-v2.js', 'status']);
        assert.ok(result.stdout.includes('インストール状況'));
      } catch (error) {
        // Claude Code CLIがインストールされていない環境では警告のみ
        console.warn('ステータスチェックをスキップ:', error.message);
      }
    });
    
    it('ヘルプ表示ができる', async () => {
      const result = await runCommand('node', ['register-slash-command-v2.js', 'help']);
      assert.ok(result.stdout.includes('Claude Code スラッシュコマンド登録ツール'));
      assert.ok(result.stdout.includes('使用方法'));
    });
  });
  
  describe('エージェント管理', () => {
    it('エージェント一覧を表示できる', async () => {
      const result = await runCommand('node', ['install-agents.js', 'list']);
      assert.ok(result.stdout.includes('利用可能なエージェント'));
    });
    
    it('ヘルプ表示ができる', async () => {
      const result = await runCommand('node', ['install-agents.js', '--help']);
      assert.ok(result.stdout.includes('Smart Review エージェントインストーラー'));
      assert.ok(result.stdout.includes('コマンド'));
    });
  });
  
  describe('更新管理', () => {
    it('更新ステータスを確認できる', async () => {
      try {
        const result = await runCommand('node', ['smart-updater.js', 'status']);
        assert.ok(result.stdout.includes('インストール状況') || result.stdout.includes('インストール情報が見つかりません'));
      } catch (error) {
        // 初回実行時はエラーが出る可能性がある
        assert.ok(error.message.includes('インストール情報が見つかりません'));
      }
    });
    
    it('ヘルプ表示ができる', async () => {
      const result = await runCommand('node', ['smart-updater.js', 'help']);
      assert.ok(result.stdout.includes('Smart Review 更新管理ツール'));
      assert.ok(result.stdout.includes('コマンド'));
    });
  });
  
  describe('共通ユーティリティ', () => {
    it('共通モジュールがロードできる', async () => {
      const commonUtils = require('../lib/common-utils');
      assert.ok(commonUtils.SecurityUtils);
      assert.ok(commonUtils.FileOperations);
      assert.ok(commonUtils.VersionUtils);
      assert.ok(commonUtils.SystemUtils);
      assert.ok(commonUtils.ErrorHandler);
      assert.ok(commonUtils.ConfigUtils);
    });
    
    it('セキュリティ機能が動作する', () => {
      const { SecurityUtils } = require('../lib/common-utils');
      
      // パストラバーサル検出
      assert.throws(
        () => SecurityUtils.validatePath('/home', '../etc/passwd'),
        /Path traversal detected/
      );
      
      // エラーサニタイズ
      const error = new Error('Error with /home/user/secret');
      const sanitized = SecurityUtils.sanitizeError(error);
      assert.ok(!sanitized.includes('/home/user'));
    });
  });
  
  describe('設定ファイル', () => {
    it('version-manifest.jsonが有効なJSON', async () => {
      const manifestPath = path.join(TEST_PROJECT, 'version-manifest.json');
      const content = await fs.readFile(manifestPath, 'utf8');
      
      assert.doesNotThrow(() => {
        const manifest = JSON.parse(content);
        assert.ok(manifest.version);
        assert.ok(manifest.components);
      });
    });
    
    it('package.jsonが有効', async () => {
      const packagePath = path.join(TEST_PROJECT, 'package.json');
      const content = await fs.readFile(packagePath, 'utf8');
      
      assert.doesNotThrow(() => {
        const pkg = JSON.parse(content);
        assert.ok(pkg.name);
        assert.ok(pkg.version);
        assert.ok(pkg.scripts);
      });
    });
  });
  
  describe('エラーハンドリング', () => {
    it('不正なコマンドでエラーメッセージを表示', async () => {
      try {
        await runCommand('node', ['register-slash-command-v2.js', 'invalid-command']);
        assert.fail('エラーが発生するはずだった');
      } catch (error) {
        assert.ok(error.message.includes('不明なコマンド'));
      }
    });
    
    it('ファイルが見つからない場合のエラー処理', async () => {
      // 存在しないファイルでテスト
      const { SecurityUtils } = require('../lib/common-utils');
      
      await assert.rejects(
        SecurityUtils.calculateFileHash('/nonexistent/file.txt'),
        /ENOENT/
      );
    });
  });
});

describe('パフォーマンステスト', () => {
  it('ファイルハッシュ計算が高速', async () => {
    const { SecurityUtils } = require('../lib/common-utils');
    const testFile = path.join(TEST_DIR, 'perf-test.txt');
    
    // 1MBのファイルを作成
    const content = Buffer.alloc(1024 * 1024, 'a');
    await fs.writeFile(testFile, content);
    
    const startTime = Date.now();
    await SecurityUtils.calculateFileHash(testFile);
    const endTime = Date.now();
    
    const duration = endTime - startTime;
    assert.ok(duration < 1000, `ハッシュ計算が遅い: ${duration}ms`);
    
    await fs.unlink(testFile);
  });
  
  it('バージョン比較が高速', () => {
    const { VersionUtils } = require('../lib/common-utils');
    
    const startTime = Date.now();
    for (let i = 0; i < 10000; i++) {
      VersionUtils.compareVersions('1.2.3', '1.2.4');
    }
    const endTime = Date.now();
    
    const duration = endTime - startTime;
    assert.ok(duration < 100, `バージョン比較が遅い: ${duration}ms`);
  });
});

// テスト実行のサマリー
process.on('exit', (code) => {
  if (code === 0) {
    console.log('\n✅ 統合テストが成功しました');
  } else {
    console.log('\n❌ 統合テストが失敗しました');
  }
});

// 最終更新: 2025年08月16日 17:20 JST
// バージョン: v1.0.0