#!/usr/bin/env node
/**
 * common-utils.test.js
 * 共通ユーティリティモジュールのテスト
 * 
 * バージョン: v1.0.0
 * 最終更新: 2025年08月16日 17:15 JST
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

const {
  SecurityUtils,
  FileOperations,
  VersionUtils,
  SystemUtils,
  ErrorHandler,
  ConfigUtils
} = require('../lib/common-utils');

describe('SecurityUtils', () => {
  describe('validatePath', () => {
    it('正常なパスを検証できる', () => {
      const basePath = '/home/user';
      const targetPath = 'documents/file.txt';
      const result = SecurityUtils.validatePath(basePath, targetPath);
      assert.ok(result.includes('documents'));
    });

    it('パストラバーサル攻撃を検出する', () => {
      const basePath = '/home/user';
      const targetPath = '../../../etc/passwd';
      assert.throws(
        () => SecurityUtils.validatePath(basePath, targetPath),
        /Path traversal detected/
      );
    });

    it('不正な文字を検出する', () => {
      const basePath = '/home/user';
      const targetPath = 'file<>name.txt';
      assert.throws(
        () => SecurityUtils.validatePath(basePath, targetPath),
        /Invalid characters in path/
      );
    });

    it('Windows予約名を検出する', () => {
      const basePath = 'C:\\Users\\test';
      const targetPath = 'con';
      assert.throws(
        () => SecurityUtils.validatePath(basePath, targetPath),
        /Reserved name detected/
      );
    });
  });

  describe('sanitizeError', () => {
    it('パス情報を匿名化する', () => {
      const error = new Error('Failed to access /home/username/secret.txt');
      const sanitized = SecurityUtils.sanitizeError(error);
      assert.ok(!sanitized.includes('username'));
      assert.ok(sanitized.includes('/home/<user>'));
    });

    it('APIキーをマスクする', () => {
      const error = new Error('Invalid api_key: sk-1234567890abcdef');
      const sanitized = SecurityUtils.sanitizeError(error);
      assert.ok(!sanitized.includes('sk-1234567890abcdef'));
      assert.ok(sanitized.includes('api_key=<masked>'));
    });

    it('GitHubトークンをマスクする', () => {
      const error = new Error('Token error: github_pat_11A7GACZA012Zjw4kOxCEz');
      const sanitized = SecurityUtils.sanitizeError(error);
      assert.ok(!sanitized.includes('11A7GACZA012Zjw4kOxCEz'));
      assert.ok(sanitized.includes('github_pat_<masked>'));
    });
  });

  describe('calculateFileHash', async () => {
    it('ファイルのSHA-256ハッシュを計算できる', async () => {
      const testFile = path.join(os.tmpdir(), 'test-hash.txt');
      await fs.writeFile(testFile, 'test content');
      
      const hash = await SecurityUtils.calculateFileHash(testFile);
      assert.strictEqual(typeof hash, 'string');
      assert.strictEqual(hash.length, 64); // SHA-256は64文字の16進数
      
      await fs.unlink(testFile);
    });
  });
});

describe('FileOperations', () => {
  describe('atomicCopy', () => {
    it('ファイルをアトミックにコピーできる', async () => {
      const sourceFile = path.join(os.tmpdir(), 'source.txt');
      const targetFile = path.join(os.tmpdir(), 'target.txt');
      
      await fs.writeFile(sourceFile, 'test content');
      
      const result = await FileOperations.atomicCopy(sourceFile, targetFile);
      assert.ok(result.success);
      assert.ok(result.hash);
      
      const content = await fs.readFile(targetFile, 'utf8');
      assert.strictEqual(content, 'test content');
      
      await fs.unlink(sourceFile);
      await fs.unlink(targetFile);
    });

    it('空ファイルのコピーを拒否する', async () => {
      const sourceFile = path.join(os.tmpdir(), 'empty.txt');
      const targetFile = path.join(os.tmpdir(), 'target.txt');
      
      await fs.writeFile(sourceFile, '');
      
      await assert.rejects(
        FileOperations.atomicCopy(sourceFile, targetFile),
        /Source file is empty/
      );
      
      await fs.unlink(sourceFile);
    });

    it('大きすぎるファイルを拒否する', async () => {
      const sourceFile = path.join(os.tmpdir(), 'large.txt');
      const targetFile = path.join(os.tmpdir(), 'target.txt');
      
      // 11MBのダミーファイル作成
      const largeContent = Buffer.alloc(11 * 1024 * 1024, 'a');
      await fs.writeFile(sourceFile, largeContent);
      
      await assert.rejects(
        FileOperations.atomicCopy(sourceFile, targetFile),
        /File too large/
      );
      
      await fs.unlink(sourceFile);
    });
  });

  describe('createDirectorySafe', () => {
    it('ディレクトリを安全に作成できる', async () => {
      const testDir = path.join(os.tmpdir(), 'test-dir-' + Date.now());
      
      const result = await FileOperations.createDirectorySafe(testDir);
      assert.ok(result);
      
      const stats = await fs.stat(testDir);
      assert.ok(stats.isDirectory());
      
      await fs.rmdir(testDir);
    });

    it('ネストされたディレクトリを作成できる', async () => {
      const testDir = path.join(os.tmpdir(), 'test-' + Date.now(), 'nested', 'dir');
      
      const result = await FileOperations.createDirectorySafe(testDir);
      assert.ok(result);
      
      const stats = await fs.stat(testDir);
      assert.ok(stats.isDirectory());
      
      // クリーンアップ
      await fs.rmdir(testDir);
      await fs.rmdir(path.dirname(testDir));
      await fs.rmdir(path.dirname(path.dirname(testDir)));
    });
  });

  describe('writeFileSafe', () => {
    it('ファイルをアトミックに書き込める', async () => {
      const testFile = path.join(os.tmpdir(), 'write-test.txt');
      const content = 'Hello, World!';
      
      const result = await FileOperations.writeFileSafe(testFile, content);
      assert.ok(result.success);
      assert.strictEqual(result.size, Buffer.byteLength(content));
      
      const readContent = await fs.readFile(testFile, 'utf8');
      assert.strictEqual(readContent, content);
      
      await fs.unlink(testFile);
    });

    it('検証オプション付きで書き込める', async () => {
      const testFile = path.join(os.tmpdir(), 'validate-test.txt');
      const content = 'Validated content';
      
      const result = await FileOperations.writeFileSafe(testFile, content, {
        validate: true,
        calculateHash: true
      });
      
      assert.ok(result.success);
      assert.ok(result.hash);
      assert.strictEqual(result.hash.length, 64);
      
      await fs.unlink(testFile);
    });
  });

  describe('compareFiles', () => {
    it('同一ファイルを検出できる', async () => {
      const file1 = path.join(os.tmpdir(), 'file1.txt');
      const file2 = path.join(os.tmpdir(), 'file2.txt');
      
      await fs.writeFile(file1, 'same content');
      await fs.writeFile(file2, 'same content');
      
      const result = await FileOperations.compareFiles(file1, file2);
      assert.ok(result);
      
      await fs.unlink(file1);
      await fs.unlink(file2);
    });

    it('異なるファイルを検出できる', async () => {
      const file1 = path.join(os.tmpdir(), 'file1.txt');
      const file2 = path.join(os.tmpdir(), 'file2.txt');
      
      await fs.writeFile(file1, 'content 1');
      await fs.writeFile(file2, 'content 2');
      
      const result = await FileOperations.compareFiles(file1, file2);
      assert.ok(!result);
      
      await fs.unlink(file1);
      await fs.unlink(file2);
    });
  });
});

describe('VersionUtils', () => {
  describe('compareVersions', () => {
    it('バージョンを正しく比較できる', () => {
      assert.strictEqual(VersionUtils.compareVersions('1.0.0', '1.0.0'), 0);
      assert.strictEqual(VersionUtils.compareVersions('2.0.0', '1.0.0'), 1);
      assert.strictEqual(VersionUtils.compareVersions('1.0.0', '2.0.0'), -1);
      assert.strictEqual(VersionUtils.compareVersions('1.1.0', '1.0.0'), 1);
      assert.strictEqual(VersionUtils.compareVersions('1.0.1', '1.0.0'), 1);
      assert.strictEqual(VersionUtils.compareVersions('v1.0.0', 'v1.0.0'), 0);
    });
  });

  describe('incrementVersion', () => {
    it('パッチバージョンをインクリメントできる', () => {
      const result = VersionUtils.incrementVersion('1.2.3', 'patch');
      assert.strictEqual(result, 'v1.2.4');
    });

    it('マイナーバージョンをインクリメントできる', () => {
      const result = VersionUtils.incrementVersion('1.2.3', 'minor');
      assert.strictEqual(result, 'v1.3.0');
    });

    it('メジャーバージョンをインクリメントできる', () => {
      const result = VersionUtils.incrementVersion('1.2.3', 'major');
      assert.strictEqual(result, 'v2.0.0');
    });
  });

  describe('isValidVersion', () => {
    it('有効なバージョンを検証できる', () => {
      assert.ok(VersionUtils.isValidVersion('1.0.0'));
      assert.ok(VersionUtils.isValidVersion('v1.0.0'));
      assert.ok(VersionUtils.isValidVersion('1.0.0-alpha'));
      assert.ok(VersionUtils.isValidVersion('1.0.0+build123'));
      assert.ok(VersionUtils.isValidVersion('1.0.0-alpha+build123'));
    });

    it('無効なバージョンを検出できる', () => {
      assert.ok(!VersionUtils.isValidVersion('1.0'));
      assert.ok(!VersionUtils.isValidVersion('1'));
      assert.ok(!VersionUtils.isValidVersion('a.b.c'));
      assert.ok(!VersionUtils.isValidVersion(''));
    });
  });
});

describe('SystemUtils', () => {
  describe('getHomeDir', () => {
    it('ホームディレクトリを取得できる', () => {
      const homeDir = SystemUtils.getHomeDir();
      assert.ok(homeDir);
      assert.strictEqual(typeof homeDir, 'string');
      assert.ok(homeDir.length > 0);
    });
  });

  describe('getPlatformInfo', () => {
    it('プラットフォーム情報を取得できる', () => {
      const info = SystemUtils.getPlatformInfo();
      assert.ok(info.platform);
      assert.ok(info.arch);
      assert.ok(info.nodeVersion);
      assert.strictEqual(typeof info.isWindows, 'boolean');
      assert.strictEqual(typeof info.isMac, 'boolean');
      assert.strictEqual(typeof info.isLinux, 'boolean');
    });
  });

  describe('getEnvVar', () => {
    it('環境変数を安全に取得できる', () => {
      process.env.TEST_VAR = 'test value';
      const value = SystemUtils.getEnvVar('TEST_VAR');
      assert.strictEqual(value, 'test value');
      delete process.env.TEST_VAR;
    });

    it('デフォルト値を返せる', () => {
      const value = SystemUtils.getEnvVar('NONEXISTENT_VAR', 'default');
      assert.strictEqual(value, 'default');
    });

    it('危険な文字を除去する', () => {
      process.env.TEST_VAR = 'value; rm -rf /';
      const value = SystemUtils.getEnvVar('TEST_VAR');
      assert.ok(!value.includes(';'));
      assert.ok(!value.includes('|'));
      delete process.env.TEST_VAR;
    });
  });

  describe('formatFileSize', () => {
    it('ファイルサイズをフォーマットできる', () => {
      assert.strictEqual(SystemUtils.formatFileSize(0), '0 B');
      assert.strictEqual(SystemUtils.formatFileSize(512), '512.00 B');
      assert.strictEqual(SystemUtils.formatFileSize(1024), '1.00 KB');
      assert.strictEqual(SystemUtils.formatFileSize(1048576), '1.00 MB');
      assert.strictEqual(SystemUtils.formatFileSize(1073741824), '1.00 GB');
    });
  });

  describe('getJSTTimestamp', () => {
    it('JST形式のタイムスタンプを生成できる', () => {
      const timestamp = SystemUtils.getJSTTimestamp();
      assert.ok(timestamp);
      assert.ok(timestamp.includes('年'));
      assert.ok(timestamp.includes('月'));
      assert.ok(timestamp.includes('日'));
      assert.ok(timestamp.includes('JST'));
    });

    it('指定した日付でタイムスタンプを生成できる', () => {
      const date = new Date('2025-01-01T00:00:00Z');
      const timestamp = SystemUtils.getJSTTimestamp(date);
      assert.ok(timestamp.includes('2025年01月01日'));
    });
  });
});

describe('ConfigUtils', () => {
  describe('deepMerge', () => {
    it('オブジェクトを深くマージできる', () => {
      const target = {
        a: 1,
        b: { c: 2 },
        d: [1, 2]
      };
      const source = {
        b: { d: 3 },
        e: 4,
        d: [3, 4]
      };
      
      const result = ConfigUtils.deepMerge(target, source);
      assert.strictEqual(result.a, 1);
      assert.strictEqual(result.b.c, 2);
      assert.strictEqual(result.b.d, 3);
      assert.strictEqual(result.e, 4);
      assert.deepStrictEqual(result.d, [3, 4]);
    });
  });

  describe('validateConfig', () => {
    it('必須フィールドを検証できる', () => {
      const config = { name: 'test' };
      const schema = {
        required: ['name', 'version']
      };
      
      const result = ConfigUtils.validateConfig(config, schema);
      assert.ok(!result.valid);
      assert.ok(result.errors.length > 0);
      assert.ok(result.errors[0].includes('version'));
    });

    it('型を検証できる', () => {
      const config = {
        name: 'test',
        count: '5' // 文字列だが数値であるべき
      };
      const schema = {
        properties: {
          name: { type: 'string' },
          count: { type: 'number' }
        }
      };
      
      const result = ConfigUtils.validateConfig(config, schema);
      assert.ok(!result.valid);
      assert.ok(result.errors[0].includes('count'));
    });

    it('範囲を検証できる', () => {
      const config = {
        port: 100
      };
      const schema = {
        properties: {
          port: { type: 'number', min: 1024, max: 65535 }
        }
      };
      
      const result = ConfigUtils.validateConfig(config, schema);
      assert.ok(!result.valid);
      assert.ok(result.errors[0].includes('最小値未満'));
    });
  });
});

// テスト実行のサマリー
process.on('exit', (code) => {
  if (code === 0) {
    console.log('\n✅ すべてのテストが成功しました');
  } else {
    console.log('\n❌ テストが失敗しました');
  }
});

// 最終更新: 2025年08月16日 17:15 JST
// バージョン: v1.0.0