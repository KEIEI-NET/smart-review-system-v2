#!/usr/bin/env node
/**
 * common-utils.js
 * 共通ユーティリティモジュール
 * 
 * バージョン: v1.0.0
 * 最終更新: 2025年08月16日 16:45 JST
 */

const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

/**
 * セキュリティユーティリティクラス
 * パス検証、サニタイズ、ハッシュ計算などのセキュリティ関連機能を提供
 */
class SecurityUtils {
  /**
   * パスの検証とサニタイズ
   * @param {string} basePath - ベースパス
   * @param {string} targetPath - ターゲットパス（オプション）
   * @returns {string} 検証済みの正規化されたパス
   * @throws {Error} パストラバーサルや不正な文字が検出された場合
   */
  static validatePath(basePath, targetPath = '') {
    if (!basePath || typeof basePath !== 'string') {
      throw new Error('Invalid base path provided');
    }

    const resolved = path.resolve(basePath, targetPath);
    const normalized = path.normalize(resolved);
    const base = path.resolve(basePath);

    // パストラバーサル攻撃の検出
    if (!normalized.startsWith(base)) {
      throw new Error(`Path traversal detected: ${targetPath}`);
    }

    // 危険な文字のチェック
    if (/[<>"|?*\0]/.test(targetPath)) {
      throw new Error(`Invalid characters in path: ${targetPath}`);
    }

    // Windowsの予約名チェック
    const basename = path.basename(normalized);
    const reservedNames = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;
    if (reservedNames.test(basename)) {
      throw new Error(`Reserved name detected: ${basename}`);
    }

    return normalized;
  }

  /**
   * エラーメッセージのサニタイズ
   * @param {Error} error - エラーオブジェクト
   * @returns {string} サニタイズされたエラーメッセージ
   */
  static sanitizeError(error) {
    let message = error.message || String(error);
    
    // パス情報の匿名化
    message = message.replace(/\/home\/[^\/\s]+/g, '/home/<user>');
    message = message.replace(/C:\\Users\\[^\\]+/g, 'C:\\Users\\<user>');
    message = message.replace(/\/Users\/[^\/\s]+/g, '/Users/<user>');
    
    // 機密情報のマスキング
    message = message.replace(/api[_-]?key[:\s]*['"]?[\w\-]+/gi, 'api_key=<masked>');
    message = message.replace(/password[:\s]*['"]?[\w\-]+/gi, 'password=<masked>');
    message = message.replace(/token[:\s]*['"]?[\w\-]+/gi, 'token=<masked>');
    message = message.replace(/github_pat_[\w]+/gi, 'github_pat_<masked>');
    
    return message;
  }

  /**
   * ファイルのSHA-256ハッシュを計算
   * @param {string} filePath - ファイルパス
   * @returns {Promise<string>} SHA-256ハッシュ値（16進数）
   */
  static async calculateFileHash(filePath) {
    const content = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * セキュアなコマンド実行
   * @param {string} command - 実行するコマンド
   * @param {Array} args - コマンド引数
   * @param {Object} options - 実行オプション
   * @returns {Promise<Object>} 実行結果
   */
  static async executeCommand(command, args = [], options = {}) {
    // コマンドインジェクション対策
    if (typeof command !== 'string' || command.includes(';') || command.includes('&&') || command.includes('|')) {
      throw new Error('Invalid command');
    }

    // 引数の検証
    if (!Array.isArray(args)) {
      throw new Error('Arguments must be an array');
    }

    for (const arg of args) {
      if (typeof arg !== 'string') {
        throw new Error('All arguments must be strings');
      }
    }

    try {
      const result = await execFileAsync(command, args, options);
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        success: true
      };
    } catch (error) {
      return {
        stdout: '',
        stderr: error.stderr || error.message,
        success: false,
        error: this.sanitizeError(error)
      };
    }
  }
}

/**
 * ファイル操作ユーティリティクラス
 * アトミックな操作、バックアップ、整合性チェックなどを提供
 */
class FileOperations {
  /**
   * アトミックなファイルコピー
   * @param {string} source - ソースファイルパス
   * @param {string} target - ターゲットファイルパス
   * @returns {Promise<Object>} 操作結果とハッシュ値
   */
  static async atomicCopy(source, target) {
    const tempFile = `${target}.tmp.${process.pid}.${Date.now()}`;
    
    try {
      // ソースファイルの検証
      const stats = await fs.stat(source);
      if (!stats.isFile()) {
        throw new Error('Source is not a file');
      }
      if (stats.size === 0) {
        throw new Error('Source file is empty');
      }
      if (stats.size > 10 * 1024 * 1024) { // 10MB制限
        throw new Error(`File too large: ${stats.size} bytes`);
      }

      // コピー実行
      await fs.copyFile(source, tempFile);
      
      // 整合性チェック
      const sourceHash = await SecurityUtils.calculateFileHash(source);
      const tempHash = await SecurityUtils.calculateFileHash(tempFile);
      
      if (sourceHash !== tempHash) {
        throw new Error('File integrity check failed');
      }

      // アトミックな置き換え
      await fs.rename(tempFile, target);
      
      return { success: true, hash: sourceHash, size: stats.size };
      
    } catch (error) {
      // クリーンアップ
      try {
        await fs.unlink(tempFile);
      } catch {}
      throw error;
    }
  }

  /**
   * バックアップ付きファイルコピー
   * @param {string} source - ソースファイルパス
   * @param {string} target - ターゲットファイルパス
   * @param {Object} options - オプション
   * @returns {Promise<Object>} 操作結果
   */
  static async copyWithBackup(source, target, options = {}) {
    const backupPath = options.backupPath || `${target}.backup.${Date.now()}`;
    
    try {
      // 既存ファイルのバックアップ
      await fs.access(target);
      await fs.copyFile(target, backupPath);
      
      const result = await this.atomicCopy(source, target);
      result.backup = backupPath;
      return result;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // ファイルが存在しない場合は新規作成
        return this.atomicCopy(source, target);
      }
      throw error;
    }
  }

  /**
   * ディレクトリの安全な作成
   * @param {string} dirPath - ディレクトリパス
   * @param {Object} options - オプション
   * @returns {Promise<boolean>} 作成成功フラグ
   */
  static async createDirectorySafe(dirPath, options = {}) {
    const mode = options.mode || 0o755;
    
    try {
      await fs.mkdir(dirPath, { recursive: true, mode });
      
      // 権限の確認
      await fs.access(dirPath, fs.constants.W_OK | fs.constants.R_OK);
      
      return true;
    } catch (error) {
      if (error.code === 'EACCES') {
        throw new Error(`Permission denied: ${dirPath}`);
      }
      throw error;
    }
  }

  /**
   * ファイルの安全な書き込み（アトミック）
   * @param {string} filePath - ファイルパス
   * @param {string} content - ファイル内容
   * @param {Object} options - オプション
   * @returns {Promise<Object>} 書き込み結果
   */
  static async writeFileSafe(filePath, content, options = {}) {
    const tempFile = `${filePath}.tmp.${process.pid}.${Date.now()}`;
    const encoding = options.encoding || 'utf8';
    const mode = options.mode || 0o644;
    
    try {
      // 一時ファイルに書き込み
      await fs.writeFile(tempFile, content, { encoding, mode });
      
      // 検証（オプション）
      if (options.validate) {
        const written = await fs.readFile(tempFile, encoding);
        if (written !== content) {
          throw new Error('Content validation failed');
        }
      }
      
      // アトミックな置き換え
      await fs.rename(tempFile, filePath);
      
      // ハッシュ計算（オプション）
      let hash = null;
      if (options.calculateHash) {
        hash = await SecurityUtils.calculateFileHash(filePath);
      }
      
      return {
        success: true,
        path: filePath,
        size: Buffer.byteLength(content, encoding),
        hash
      };
      
    } catch (error) {
      // クリーンアップ
      try {
        await fs.unlink(tempFile);
      } catch {}
      throw error;
    }
  }

  /**
   * ファイルの比較
   * @param {string} file1 - ファイル1のパス
   * @param {string} file2 - ファイル2のパス
   * @returns {Promise<boolean>} 同一ファイルかどうか
   */
  static async compareFiles(file1, file2) {
    try {
      const [hash1, hash2] = await Promise.all([
        SecurityUtils.calculateFileHash(file1),
        SecurityUtils.calculateFileHash(file2)
      ]);
      return hash1 === hash2;
    } catch (error) {
      return false;
    }
  }
}

/**
 * バージョン管理ユーティリティクラス
 */
class VersionUtils {
  /**
   * セマンティックバージョンの比較
   * @param {string} v1 - バージョン1
   * @param {string} v2 - バージョン2
   * @returns {number} 1: v1が新しい, -1: v2が新しい, 0: 同じ
   */
  static compareVersions(v1, v2) {
    const parts1 = v1.replace(/^v/, '').split('.').map(Number);
    const parts2 = v2.replace(/^v/, '').split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    
    return 0;
  }

  /**
   * バージョンのインクリメント
   * @param {string} version - 現在のバージョン
   * @param {string} type - インクリメントタイプ (major, minor, patch)
   * @returns {string} 新しいバージョン
   */
  static incrementVersion(version, type = 'patch') {
    const parts = version.replace(/^v/, '').split('.').map(Number);
    
    switch (type) {
      case 'major':
        parts[0]++;
        parts[1] = 0;
        parts[2] = 0;
        break;
      case 'minor':
        parts[1]++;
        parts[2] = 0;
        break;
      case 'patch':
      default:
        parts[2]++;
        break;
    }
    
    return `v${parts.join('.')}`;
  }

  /**
   * バージョンが有効かチェック
   * @param {string} version - バージョン文字列
   * @returns {boolean} 有効なセマンティックバージョンかどうか
   */
  static isValidVersion(version) {
    const pattern = /^v?\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/;
    return pattern.test(version);
  }
}

/**
 * システムユーティリティクラス
 */
class SystemUtils {
  /**
   * ホームディレクトリの取得（セキュア）
   * @returns {string} ホームディレクトリのパス
   */
  static getHomeDir() {
    return os.homedir();
  }

  /**
   * プラットフォーム情報の取得
   * @returns {Object} プラットフォーム情報
   */
  static getPlatformInfo() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      nodeVersion: process.version,
      isWindows: os.platform() === 'win32',
      isMac: os.platform() === 'darwin',
      isLinux: os.platform() === 'linux'
    };
  }

  /**
   * 環境変数の安全な取得
   * @param {string} name - 環境変数名
   * @param {string} defaultValue - デフォルト値
   * @returns {string} 環境変数の値
   */
  static getEnvVar(name, defaultValue = '') {
    const value = process.env[name];
    if (value === undefined || value === '') {
      return defaultValue;
    }
    // 潜在的な危険な文字を除去
    return value.replace(/[;&|`$]/g, '');
  }

  /**
   * ファイルサイズのフォーマット
   * @param {number} bytes - バイト数
   * @returns {string} フォーマットされたサイズ
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
  }

  /**
   * タイムスタンプの生成（JST）
   * @param {Date} date - 日付オブジェクト（省略時は現在時刻）
   * @returns {string} JSTフォーマットのタイムスタンプ
   */
  static getJSTTimestamp(date = new Date()) {
    const jstOffset = 9 * 60; // JST: UTC+9
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    const jstDate = new Date(utc + (jstOffset * 60000));
    
    const year = jstDate.getFullYear();
    const month = String(jstDate.getMonth() + 1).padStart(2, '0');
    const day = String(jstDate.getDate()).padStart(2, '0');
    const hours = String(jstDate.getHours()).padStart(2, '0');
    const minutes = String(jstDate.getMinutes()).padStart(2, '0');
    
    return `${year}年${month}月${day}日 ${hours}:${minutes} JST`;
  }
}

/**
 * エラーハンドラークラス
 */
class ErrorHandler {
  /**
   * エラーのハンドリングとログ出力
   * @param {Error} error - エラーオブジェクト
   * @param {string} context - エラーコンテキスト
   * @param {Object} options - オプション
   */
  static handle(error, context = '', options = {}) {
    const sanitized = SecurityUtils.sanitizeError(error);
    const logger = options.logger || console;
    
    logger.error(`\n❌ エラーが発生しました: ${sanitized}`);
    
    // エラーコードに応じたヒント表示
    const hints = {
      'EACCES': '管理者権限で実行してください',
      'ENOENT': '必要なファイルが見つかりません',
      'ENOSPC': 'ディスク容量が不足しています',
      'EBUSY': 'ファイルが使用中です。しばらく待ってから再試行してください',
      'EEXIST': 'ファイルまたはディレクトリが既に存在します',
      'EPERM': '操作が許可されていません',
      'ETIMEDOUT': 'タイムアウトしました。ネットワーク接続を確認してください'
    };
    
    if (error.code && hints[error.code]) {
      logger.error(`💡 ヒント: ${hints[error.code]}`);
    }
    
    if (context) {
      logger.error(`📍 コンテキスト: ${context}`);
    }
    
    // デバッグモードの場合はスタックトレースを表示
    if (process.env.DEBUG || options.debug) {
      logger.error('\n[Debug Stack Trace]');
      logger.error(error.stack);
    }
    
    // エラーログをファイルに記録（オプション）
    if (options.logFile) {
      this.logToFile(error, context, options.logFile);
    }
  }
  
  /**
   * エラーログをファイルに記録
   * @param {Error} error - エラーオブジェクト
   * @param {string} context - エラーコンテキスト
   * @param {string} logFile - ログファイルパス
   */
  static async logToFile(error, context, logFile) {
    try {
      const timestamp = new Date().toISOString();
      const sanitized = SecurityUtils.sanitizeError(error);
      const logEntry = `[${timestamp}] ${context}: ${sanitized}\n`;
      
      await fs.appendFile(logFile, logEntry);
    } catch (writeError) {
      console.error('ログファイルへの書き込みに失敗:', writeError.message);
    }
  }
}

/**
 * 設定管理ユーティリティクラス
 */
class ConfigUtils {
  /**
   * 設定ファイルの読み込み（複数パスから優先順位付き）
   * @param {Array<string>} paths - 設定ファイルパスの配列（優先順位順）
   * @returns {Promise<Object>} マージされた設定オブジェクト
   */
  static async loadConfig(paths) {
    let config = {};
    
    for (const configPath of paths) {
      try {
        const content = await fs.readFile(configPath, 'utf8');
        const parsed = JSON.parse(content);
        // 深いマージ
        config = this.deepMerge(config, parsed);
      } catch (error) {
        // ファイルが存在しない場合は無視
        if (error.code !== 'ENOENT') {
          console.warn(`設定ファイル読み込みエラー (${configPath}):`, error.message);
        }
      }
    }
    
    return config;
  }

  /**
   * オブジェクトの深いマージ
   * @param {Object} target - マージ先オブジェクト
   * @param {Object} source - マージ元オブジェクト
   * @returns {Object} マージされたオブジェクト
   */
  static deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          result[key] = this.deepMerge(result[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }
    
    return result;
  }

  /**
   * 設定の検証
   * @param {Object} config - 設定オブジェクト
   * @param {Object} schema - 検証スキーマ
   * @returns {Object} 検証結果
   */
  static validateConfig(config, schema) {
    const errors = [];
    const warnings = [];
    
    // 必須フィールドのチェック
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in config)) {
          errors.push(`必須フィールドが不足: ${field}`);
        }
      }
    }
    
    // 型チェック
    if (schema.properties) {
      for (const [key, prop] of Object.entries(schema.properties)) {
        if (key in config) {
          const value = config[key];
          const expectedType = prop.type;
          const actualType = Array.isArray(value) ? 'array' : typeof value;
          
          if (expectedType && actualType !== expectedType) {
            errors.push(`型が不正: ${key} (期待: ${expectedType}, 実際: ${actualType})`);
          }
          
          // 範囲チェック
          if (prop.min !== undefined && value < prop.min) {
            errors.push(`値が最小値未満: ${key} (最小: ${prop.min}, 実際: ${value})`);
          }
          if (prop.max !== undefined && value > prop.max) {
            errors.push(`値が最大値超過: ${key} (最大: ${prop.max}, 実際: ${value})`);
          }
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

// エクスポート
module.exports = {
  SecurityUtils,
  FileOperations,
  VersionUtils,
  SystemUtils,
  ErrorHandler,
  ConfigUtils
};

// 最終更新: 2025年08月16日 16:45 JST
// バージョン: v1.0.0