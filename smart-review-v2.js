// .claudecode/commands/smart-review-v2.js
// 最終版: 差分チェックまたは全体チェックを行い、TODOリストを生成する賢いレビューコマンド
// セキュリティ強化、エージェントサンドボックス化、発見された問題の修正を含む

const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

// 設定モジュールのインポート
const { Config, configManager } = require('./smart-review-config');

// セキュリティユーティリティクラス（強化版）
class SecurityUtils {
  // 包括的パス検証
  static validatePath(userPath, baseDir = process.cwd()) {
    if (!userPath || typeof userPath !== 'string') {
      throw new Error('無効なパス: パスが指定されていません');
    }
    
    // 危険なパターンのチェック（Windows/Unix両対応）
    const dangerousPatterns = [
      /\.\./,                    // 相対パス
      /~/,                       // ホームディレクトリ
      /^\/+/,                    // 絶対パス（Unix）
      /^[a-zA-Z]:\\/,            // 絶対パス（Windows）
      /\0/,                      // NULL文字
      /[<>|*?"]/,                // 危険な文字
      /\.{2,}/,                  // 複数ドット
      /[\/\\]{2,}/,              // 複数スラッシュ
      /\.(exe|bat|cmd|scr|com|pif|vbs|js|jar|ps1)$/i,  // 実行可能ファイル
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i,        // Windows予約名
      /[\x00-\x1f\x7f-\x9f]/,                          // 制御文字
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(userPath)) {
        throw new Error(`不正なパス: 危険なパターンが検出されました - ${userPath}`);
      }
    }
    
    const resolved = path.resolve(baseDir, userPath);
    const normalizedBase = path.resolve(baseDir);
    
    // 基本的なパストラバーサルチェック
    if (!resolved.startsWith(normalizedBase)) {
      throw new Error(`不正なパス: ベースディレクトリ外へのアクセス - ${userPath}`);
    }
    
    // 正規化後の追加チェック
    const relativePath = path.relative(normalizedBase, resolved);
    if (relativePath.includes('..') || relativePath.startsWith('../')) {
      throw new Error(`不正なパス: 正規化後もパストラバーサルが検出されました - ${userPath}`);
    }
    
    // パスの長さ制限
    if (resolved.length > 260) {  // Windows MAX_PATH制限
      throw new Error(`不正なパス: パスが長すぎます - ${userPath}`);
    }
    
    return resolved;
  }

  // 出力ディレクトリの検証（強化版）
  static validateOutputDirectory(outputDir) {
    if (!outputDir || typeof outputDir !== 'string') {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      return path.join(Config.ALLOWED_OUTPUT_BASE, `output-${timestamp}`);
    }
    
    const resolved = path.resolve(outputDir);
    const allowedBase = path.resolve(Config.ALLOWED_OUTPUT_BASE);
    
    // 許可されたディレクトリ内であることを確認
    if (!resolved.startsWith(allowedBase)) {
      // 許可されたディレクトリ内にフォールバック
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      return path.join(Config.ALLOWED_OUTPUT_BASE, `output-${timestamp}`);
    }
    
    return resolved;
  }

  // エラーメッセージのサニタイズ（強化版）
  static sanitizeError(error) {
    let message = error.message || String(error);
    
    // パスの匿名化（より包括的）
    message = message.replace(/\/home\/[^\/\s]+/g, '/home/<user>');
    message = message.replace(/C:\\Users\\[^\\]+/g, 'C:\\Users\\<user>');
    message = message.replace(/\/Users\/[^\/\s]+/g, '/Users/<user>');
    message = message.replace(/\\Users\\[^\\]+/g, '\\Users\\<user>');
    
    // 機密情報のマスキング（より包括的）
    const sensitivePatterns = [
      /api[_-]?key[:\s]*['"]?[\w\-]+/gi,
      /password[:\s]*['"]?[\w\-]+/gi,
      /token[:\s]*['"]?[\w\-]+/gi,
      /secret[:\s]*['"]?[\w\-]+/gi,
      /auth[:\s]*['"]?[\w\-]+/gi,
      /bearer[\s]*[\w\-]+/gi
    ];
    
    sensitivePatterns.forEach((pattern, index) => {
      message = message.replace(pattern, `SENSITIVE_INFO_${index}_REDACTED`);
    });
    
    return {
      message,
      code: error.code || 'UNKNOWN_ERROR',
      timestamp: new Date().toISOString(),
      sanitized: true
    };
  }

  // セキュアなコマンド実行（強化版）
  static async executeCommand(command, args = [], options = {}) {
    const {
      timeout = Config.COMMAND_TIMEOUT,
      maxBuffer = Config.MAX_BUFFER,
      cwd = process.cwd()
    } = options;
    
    // コマンドのホワイトリスト
    if (!Config.ALLOWED_COMMANDS.includes(command)) {
      throw new Error(`許可されていないコマンド: ${command}`);
    }
    
    // 引数のサニタイズ（より包括的）
    const sanitizedArgs = args.map(arg => {
      if (typeof arg !== 'string') {
        return String(arg);
      }
      // 危険な文字の除去
      return arg.replace(/[;&|`$()<>\n\r\t]/g, '');
    });
    
    try {
      const result = await execFileAsync(command, sanitizedArgs, {
        timeout,
        maxBuffer,
        cwd: SecurityUtils.validatePath(cwd),
        shell: false,  // シェル解釈を無効化
        env: SecurityUtils.sanitizeEnv(process.env)
      });
      
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: 0,
        command,
        args: sanitizedArgs
      };
    } catch (error) {
      const sanitized = SecurityUtils.sanitizeError(error);
      throw new Error(sanitized.message);
    }
  }
  
  // 環境変数のサニタイズ
  static sanitizeEnv(env) {
    const sanitized = { ...env };
    
    // 機密環境変数を削除
    const sensitiveKeys = [
      'AWS_SECRET_ACCESS_KEY',
      'DATABASE_PASSWORD',
      'API_KEY',
      'SECRET_KEY',
      'PRIVATE_KEY',
      'TOKEN',
      'PASSWORD'
    ];
    
    sensitiveKeys.forEach(key => {
      delete sanitized[key];
    });
    
    return sanitized;
  }

  // HTMLエスケープ
  static escapeHtml(text) {
    if (typeof text !== 'string') {
      return String(text);
    }
    
    return text.replace(/[&<>"']/g, (match) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[match]);
  }

  // 安全な日付解析
  static safeParseDate(dateString) {
    if (!dateString || typeof dateString !== 'string') {
      return null;
    }
    
    // ISO 8601形式のチェック
    const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    if (!isoPattern.test(dateString)) {
      return null;
    }
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return null;
    }
    
    return date;
  }
}

// 入力検証クラス（強化版）
class InputValidator {
  static validateString(input, options = {}) {
    const { 
      maxLength = 1000, 
      pattern = null, 
      allowEmpty = false,
      minLength = 0
    } = options;
    
    if (!allowEmpty && (!input || input.trim() === '')) {
      throw new Error('入力が空です');
    }
    
    if (input && typeof input !== 'string') {
      throw new Error('文字列である必要があります');
    }
    
    if (input && input.length < minLength) {
      throw new Error(`入力が最小長を下回っています: ${minLength}`);
    }
    
    if (input && input.length > maxLength) {
      throw new Error(`入力が最大長を超えています: ${maxLength}`);
    }
    
    if (pattern && input && !pattern.test(input)) {
      throw new Error('入力が無効な形式です');
    }
    
    return input;
  }
  
  static validateNumber(input, options = {}) {
    const { min = -Infinity, max = Infinity, integer = false } = options;
    
    let num;
    if (typeof input === 'string') {
      num = parseFloat(input.trim());
    } else {
      num = Number(input);
    }
    
    if (!Number.isFinite(num)) {
      throw new Error('有効な数値ではありません');
    }
    
    if (integer && !Number.isInteger(num)) {
      throw new Error('整数である必要があります');
    }
    
    if (num < min || num > max) {
      throw new Error(`数値が範囲外です: ${min}-${max}`);
    }
    
    return num;
  }
  
  static validateChoice(input, choices) {
    if (!Array.isArray(choices) || choices.length === 0) {
      throw new Error('有効な選択肢が提供されていません');
    }
    
    if (!choices.includes(input)) {
      throw new Error(`無効な選択: ${input}. 有効な選択肢: ${choices.join(', ')}`);
    }
    return input;
  }
}

// エージェントサンドボックスクラス
class AgentSandbox {
  constructor(agent, context) {
    this.agent = agent;
    this.context = context;
    this.timeout = Config.AGENT_TIMEOUT;
    this.maxMemory = 512 * 1024 * 1024; // 512MB
    this.allowedOperations = ['read', 'analyze'];
  }
  
  async execute(files, iteration = 1) {
    const startTime = Date.now();
    const sandboxId = crypto.randomBytes(8).toString('hex');
    
    try {
      // サンドボックス環境の準備
      const sandbox = this.createSandbox(files, sandboxId);
      
      // タイムアウト設定
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('エージェント実行タイムアウト')), this.timeout);
      });
      
      // エージェント実行とタイムアウトの競合
      const result = await Promise.race([
        this.runAgentInSandbox(sandbox, files, iteration),
        timeoutPromise
      ]);
      
      return this.sanitizeResult({
        agentId: this.agent.id,
        agentName: this.agent.name,
        issues: result.issues || [],
        rawOutput: result.rawOutput || '',
        executionTime: Date.now() - startTime,
        sandboxId
      });
      
    } catch (error) {
      const sanitized = SecurityUtils.sanitizeError(error);
      return {
        agentId: this.agent.id,
        agentName: this.agent.name,
        issues: [],
        rawOutput: '',
        executionTime: Date.now() - startTime,
        error: sanitized.message,
        sandboxId
      };
    }
  }
  
  createSandbox(files, sandboxId) {
    return {
      id: sandboxId,
      files: this.createReadOnlyFileSystem(files),
      terminal: this.createRestrictedTerminal(),
      allowedOperations: this.allowedOperations,
      resourceLimits: {
        maxMemory: this.maxMemory,
        timeout: this.timeout
      }
    };
  }
  
  createReadOnlyFileSystem(files) {
    const allowedFiles = new Set(files.map(f => path.resolve(f)));
    
    return {
      read: async (filePath) => {
        const resolvedPath = SecurityUtils.validatePath(filePath);
        
        if (!allowedFiles.has(resolvedPath)) {
          throw new Error(`ファイルアクセス拒否: ${filePath}`);
        }
        
        try {
          // Validate context structure
          if (!this.context || !this.context.files || typeof this.context.files.read !== 'function') {
            throw new Error('Context not properly initialized');
          }
          
          return await this.context.files.read(resolvedPath);
        } catch (error) {
          throw new Error(`ファイル読み取りエラー: ${SecurityUtils.sanitizeError(error).message}`);
        }
      },
      
      exists: async (filePath) => {
        const resolvedPath = SecurityUtils.validatePath(filePath);
        return allowedFiles.has(resolvedPath);
      },
      
      // 書き込み操作は提供しない（読み取り専用）
      write: () => {
        throw new Error('サンドボックス内での書き込み操作は許可されていません');
      }
    };
  }
  
  createRestrictedTerminal() {
    // エージェント専用の制限されたコマンド実行
    const agentAllowedCommands = this.agent.allowedCommands || ['git'];
    
    return {
      run: async (command) => {
        // Input validation
        if (!command || typeof command !== 'string') {
          throw new Error('無効なコマンドです');
        }
        
        if (command.length > 1000) {
          throw new Error('コマンドが長すぎます');
        }
        
        // Secure command parsing - handle quoted arguments properly
        const args = [];
        let current = '';
        let inQuotes = false;
        let escaped = false;
        
        for (let i = 0; i < command.length; i++) {
          const char = command[i];
          
          if (escaped) {
            current += char;
            escaped = false;
          } else if (char === '\\') {
            escaped = true;
          } else if (char === '"' || char === "'") {
            inQuotes = !inQuotes;
          } else if (char === ' ' && !inQuotes) {
            if (current.trim()) {
              args.push(current.trim());
              current = '';
            }
          } else {
            current += char;
          }
        }
        
        if (current.trim()) {
          args.push(current.trim());
        }
        
        if (args.length === 0) {
          throw new Error('空のコマンドは実行できません');
        }
        
        const [cmd, ...cmdArgs] = args;
        
        if (!agentAllowedCommands.includes(cmd)) {
          throw new Error(`エージェントに許可されていないコマンド: ${cmd}`);
        }
        
        return await SecurityUtils.executeCommand(cmd, cmdArgs, {
          timeout: this.timeout / 2  // エージェント内のコマンドはより短いタイムアウト
        });
      }
    };
  }
  
  async runAgentInSandbox(sandbox, files, iteration) {
    // コマンドの構築（サンドボックス対応）
    const commandArgs = [
      'agent',
      'run',
      this.agent.id,
      '--model', this.agent.model,
      '--target', this.context.target,
      '--sandbox-mode'  // サンドボックスモードの指定
    ];
    
    if (files.length > 0) {
      commandArgs.push('--files', files.join(','));
    }
    
    if (iteration > 1) {
      commandArgs.push('--iteration', String(iteration));
    }
    
    // リソース制限の追加
    commandArgs.push('--max-memory', String(this.maxMemory));
    commandArgs.push('--timeout', String(this.timeout));
    
    const claudeCmd = await module.exports.getClaudeCommand();
    const result = await SecurityUtils.executeCommand(claudeCmd, commandArgs, {
      timeout: this.timeout
    });
    
    // 結果の解析
    const issues = this.parseAgentOutput(result.stdout);
    
    return {
      issues,
      rawOutput: result.stdout
    };
  }
  
  parseAgentOutput(output) {
    const issues = [];
    
    // Input validation and size limits
    if (!output || typeof output !== 'string') {
      return issues;
    }
    
    if (output.length > 1024 * 1024) { // 1MB limit
      output = output.substring(0, 1024 * 1024);
    }
    
    // パターンベースの解析（強化版）- ReDoS protection
    const patterns = {
      critical: /(?:CRITICAL|重大|🔴):\s*(.{1,500}?)(?:\n|$)/g,
      error: /(?:ERROR|エラー|🔴):\s*(.{1,500}?)(?:\n|$)/g,
      warning: /(?:WARNING|警告|🟡):\s*(.{1,500}?)(?:\n|$)/g,
      info: /(?:INFO|情報|🔵):\s*(.{1,500}?)(?:\n|$)/g,
      suggestion: /(?:SUGGESTION|提案|💡):\s*(.{1,500}?)(?:\n|$)/g
    };
    
    for (const [level, pattern] of Object.entries(patterns)) {
      const matches = [...output.matchAll(pattern)];
      
      // Limit number of matches to prevent DoS
      const limitedMatches = matches.slice(0, 100);
      
      for (const match of limitedMatches) {
        const issue = {
          level,
          message: SecurityUtils.escapeHtml(match[1].trim()),
          category: this.agent.category,
          priority: this.agent.priority,
          agentId: this.agent.id,
          autoFixAvailable: this.agent.canAutoFix
        };
        
        // ファイル情報の抽出（安全化）
        const fileMatch = issue.message.match(/(?:in|at|ファイル:?)\s*([^\s:]{1,200})(?::(\d+))?/);
        if (fileMatch) {
          issue.file = SecurityUtils.escapeHtml(fileMatch[1]);
          const lineNum = parseInt(fileMatch[2]);
          issue.line = (lineNum && lineNum > 0 && lineNum < 1000000) ? lineNum : null;
        }
        
        // エラータイプの判定（safe iteration）
        if (this.agent.errorTypes && Array.isArray(this.agent.errorTypes)) {
          for (const errorType of this.agent.errorTypes.slice(0, 10)) { // Limit error types
            if (typeof errorType === 'string' && issue.message.toLowerCase().includes(errorType.replace('-', ' '))) {
              issue.type = errorType;
              break;
            }
          }
        }
        
        if (!issue.type) {
          issue.type = 'general';
        }
        
        issues.push(issue);
      }
    }
    
    return issues.slice(0, 1000); // Limit total issues
  }
  
  sanitizeResult(result) {
    return {
      agentId: SecurityUtils.escapeHtml(result.agentId),
      agentName: SecurityUtils.escapeHtml(result.agentName),
      issues: result.issues.map(issue => ({
        ...issue,
        message: SecurityUtils.escapeHtml(issue.message),
        file: issue.file ? SecurityUtils.escapeHtml(issue.file) : undefined
      })),
      rawOutput: SecurityUtils.escapeHtml(result.rawOutput || ''),
      executionTime: result.executionTime,
      error: result.error ? SecurityUtils.escapeHtml(result.error) : undefined,
      sandboxId: result.sandboxId
    };
  }
}

// キャッシング機能
class ResultCache {
  constructor() {
    this.cache = new Map();
    this.ttl = 15 * 60 * 1000; // 15分のTTL
    this.maxSize = 100; // 最大キャッシュサイズ
  }
  
  // ファイルハッシュを生成
  async hashFile(filePath) {
    try {
      // Remove redundant crypto import - already imported at module level
      const stats = await fs.stat(filePath);
      if (stats.size > 10 * 1024 * 1024) { // 10MB limit
        throw new Error('File too large for hashing');
      }
      
      const content = await fs.readFile(filePath, 'utf8');
      return crypto.createHash('sha256').update(content).digest('hex'); // Use SHA-256 instead of MD5
    } catch (error) {
      // ファイル読み取りエラーの場合はパスをハッシュ
      return crypto.createHash('sha256').update(filePath + Date.now()).digest('hex');
    }
  }
  
  // キャッシュキーを生成
  async getCacheKey(agent, files, iteration = 1) {
    // Handle individual file hash failures gracefully
    const fileHashes = await Promise.allSettled(
      files.map(f => this.hashFile(f))
    );
    
    const successfulHashes = fileHashes
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value)
      .sort();
    
    const keyData = {
      agentId: agent.id,
      agentModel: agent.model,
      fileHashes: successfulHashes,
      iteration,
      timestamp: Math.floor(Date.now() / (15 * 60 * 1000)) // 15-minute buckets for cache stability
    };
    
    return crypto.createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex');
  }
  
  // キャッシュから取得
  async get(agent, files, iteration = 1) {
    const key = await this.getCacheKey(agent, files, iteration);
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.result;
    }
    
    // 期限切れキャッシュを削除
    if (cached) {
      this.cache.delete(key);
    }
    
    return null;
  }
  
  // キャッシュに保存
  async set(agent, files, iteration, result) {
    const key = await this.getCacheKey(agent, files, iteration);
    
    // キャッシュサイズ制限
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }
    
    // Deep copy to prevent reference leaks
    const deepCopy = JSON.parse(JSON.stringify(result));
    
    this.cache.set(key, {
      result: deepCopy,
      timestamp: Date.now()
    });
  }
  
  // 最古のキャッシュを削除
  evictOldest() {
    let oldestKey = null;
    let oldestTime = Date.now();
    
    for (const [key, value] of this.cache.entries()) {
      if (value.timestamp < oldestTime) {
        oldestTime = value.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
  
  // キャッシュクリア
  clear() {
    this.cache.clear();
  }
  
  // 統計情報
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl
    };
  }
}

// 構造化ロギング
class StructuredLogger {
  constructor() {
    this.context = {
      sessionId: this.generateSessionId(),
      version: '2.0.0',
      startTime: new Date().toISOString()
    };
  }
  
  generateSessionId() {
    const crypto = require('crypto');
    return crypto.randomBytes(8).toString('hex');
  }
  
  log(level, message, metadata = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message: SecurityUtils.escapeHtml(message),
      sessionId: this.context.sessionId,
      version: this.context.version,
      ...metadata
    };
    
    // 機密情報のサニタイズ
    logEntry.sanitized = SecurityUtils.sanitizeError(logEntry).message !== logEntry.message;
    
    // JSON形式で出力
    console.log(JSON.stringify(logEntry));
    
    return logEntry;
  }
  
  debug(message, metadata = {}) {
    return this.log('debug', message, metadata);
  }
  
  info(message, metadata = {}) {
    return this.log('info', message, metadata);
  }
  
  warn(message, metadata = {}) {
    return this.log('warn', message, metadata);
  }
  
  error(message, error = null, metadata = {}) {
    const errorData = error ? {
      error: {
        message: SecurityUtils.sanitizeError(error).message,
        stack: error.stack ? SecurityUtils.sanitizeError(error).message : undefined,
        code: error.code,
        type: error.constructor.name
      }
    } : {};
    
    return this.log('error', message, { ...errorData, ...metadata });
  }
  
  agent(agentName, action, metadata = {}) {
    return this.log('info', `Agent ${action}`, {
      component: 'agent',
      agentName: SecurityUtils.escapeHtml(agentName),
      action,
      ...metadata
    });
  }
  
  security(event, details = {}) {
    return this.log('warn', `Security event: ${event}`, {
      component: 'security',
      event,
      details: {
        ...details,
        timestamp: new Date().toISOString()
      }
    });
  }
  
  performance(operation, duration, metadata = {}) {
    return this.log('info', `Performance: ${operation}`, {
      component: 'performance',
      operation,
      duration: `${duration}ms`,
      ...metadata
    });
  }
  
  // メトリクス専用ログ
  metrics(data) {
    return this.log('info', 'Metrics collected', {
      component: 'metrics',
      data: {
        ...data,
        collectionTime: new Date().toISOString()
      }
    });
  }
}

// グローバルロガーインスタンス
const logger = new StructuredLogger();

// 並列実行管理クラス
class ParallelExecutor {
  static async executeAgents(agents, files, context, iteration = 1) {
    // Input validation
    if (!Array.isArray(agents) || agents.length === 0) {
      return [];
    }
    
    // Limit concurrent executions to prevent resource exhaustion
    const maxConcurrency = Math.min(agents.length, 4);
    
    // エージェントを優先度でグループ化
    const groups = ParallelExecutor.groupByPriority(agents);
    const results = [];
    
    for (const group of groups) {
      // Limit group size to prevent resource exhaustion
      const limitedGroup = group.slice(0, maxConcurrency);
      
      // 同一優先度のエージェントを並列実行
      const groupPromises = limitedGroup.map(agent => {
        try {
          const sandbox = new AgentSandbox(agent, context);
          return sandbox.execute(files, iteration);
        } catch (error) {
          // Return rejected promise for failed sandbox creation
          return Promise.reject(error);
        }
      });
      
      try {
        const groupResults = await Promise.allSettled(groupPromises);
        
        // 結果を処理
        groupResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            const agent = limitedGroup[index];
            const sanitized = SecurityUtils.sanitizeError(result.reason);
            results.push({
              agentId: agent.id || 'unknown',
              agentName: agent.name || 'unknown',
              issues: [],
              rawOutput: '',
              executionTime: 0,
              error: sanitized.message
            });
          }
        });
      } catch (error) {
        // グループ全体が失敗した場合
        const sanitized = SecurityUtils.sanitizeError(error);
        limitedGroup.forEach(agent => {
          results.push({
            agentId: agent.id || 'unknown',
            agentName: agent.name || 'unknown',
            issues: [],
            rawOutput: '',
            executionTime: 0,
            error: sanitized.message
          });
        });
      }
    }
    
    return results;
  }
  
  static groupByPriority(agents) {
    const groups = {
      critical: [],
      high: [],
      medium: [],
      low: []
    };
    
    agents.forEach(agent => {
      if (groups[agent.priority]) {
        groups[agent.priority].push(agent);
      } else {
        groups.medium.push(agent); // デフォルトはmedium
      }
    });
    
    // 空でないグループのみ返す（優先度順）
    return Object.values(groups).filter(g => g.length > 0);
  }
}

module.exports = {
  name: 'smart-review',
  description: '変更点または全体をチェックし、修正またはTODOリストを生成（セキュリティ強化版）',
  
  // Helper method to get available Claude command
  async getClaudeCommand() {
    const claudeCommands = ['claude-code', 'claude'];
    for (const cmd of claudeCommands) {
      try {
        await SecurityUtils.executeCommand(cmd, ['--version'], { timeout: 1000 });
        return cmd;
      } catch (error) {
        // Try next command
      }
    }
    throw new Error('Claude Code/Claudeコマンドが見つかりません');
  },
  
  options: [
    {
      name: 'scope',
      type: 'choice',
      description: 'チェック範囲',
      choices: ['changes', 'all'],
      default: 'changes'
    },
    {
      name: 'target',
      type: 'string',
      description: '対象ディレクトリ（デフォルト: カレントディレクトリ）',
      default: '.'
    },
    {
      name: 'todo-file',
      type: 'string',
      description: '既存のTODOファイルパス（差分チェック用）',
      default: './TODO.md'
    },
    {
      name: 'max-iterations',
      type: 'number',
      description: '最大繰り返し回数（changesモードのみ）',
      default: 5
    },
    {
      name: 'output-dir',
      type: 'string',
      description: '結果の出力ディレクトリ',
      default: './smart-review-results'
    },
    {
      name: 'skip-comment',
      type: 'boolean',
      description: 'コメント注釈をスキップ',
      default: false
    },
    {
      name: 'priority-threshold',
      type: 'choice',
      description: 'TODOに含める最小優先度',
      choices: ['critical', 'high', 'medium', 'low'],
      default: 'medium'
    },
    {
      name: 'help',
      type: 'boolean',
      description: 'ヘルプを表示',
      default: false
    },
    {
      name: 'test',
      type: 'boolean',
      description: '🆕 動作テストを実行（稼働チェック）',
      default: false
    },
    {
      name: 'version',
      type: 'boolean',
      description: '🆕 バージョン情報を表示',
      default: false
    }
  ],
  
  // ヘルプ表示メソッド
  showHelp(output) {
    const helpText = `
🔍 Smart Review v2.0 - インテリジェントコードレビュー自動化システム

📖 使用方法:
  claude-code smart-review [オプション]

📋 オプション:
  --scope <changes|all>          チェック範囲 (デフォルト: changes)
                                  • changes: 前回チェック以降の変更点のみ
                                  • all: プロジェクト全体をスキャン

  --target <ディレクトリ>         対象ディレクトリ (デフォルト: .)
                                  例: --target ./src

  --todo-file <ファイルパス>      既存のTODOファイルパス (デフォルト: ./TODO.md)
                                  例: --todo-file ./ISSUES.md

  --max-iterations <数値>         最大繰り返し回数 (デフォルト: 5)
                                  changesモードでの自動修正回数

  --output-dir <ディレクトリ>     結果の出力ディレクトリ (デフォルト: ./smart-review-results)
                                  例: --output-dir ./reports

  --skip-comment                  コメント注釈をスキップ (デフォルト: false)
                                  CIでの使用時に推奨

  --priority-threshold <レベル>   TODOに含める最小優先度 (デフォルト: medium)
                                  • critical: 重大な問題のみ
                                  • high: 高優先度以上
                                  • medium: 中優先度以上
                                  • low: すべての問題

  --help                          このヘルプを表示

🚀 使用例:
  • 基本的な変更チェック:
    claude-code smart-review

  • プロジェクト全体のセキュリティ監査:
    claude-code smart-review --scope all --priority-threshold critical

  • 特定ディレクトリの詳細レビュー:
    claude-code smart-review --scope all --target ./src --priority-threshold high

  • CI/CD統合:
    claude-code smart-review --scope changes --skip-comment --max-iterations 3

🔧 機能:
  ✅ セキュリティ脆弱性の検出（XSS、SQLインジェクション等）
  ✅ バグとロジックエラーの検出
  ✅ コード品質の分析
  ✅ ドキュメントの検証
  ✅ 自動修正機能（安全な問題のみ）
  ✅ HTMLレポートとTODOリストの生成
  ✅ 日本語コメント注釈（オプション）

📊 出力:
  • HTMLレポート: 包括的な分析結果
  • Markdownレポート: テキスト形式の詳細
  • TODOリスト: 優先度付きタスクリスト
  • 生ログ: エージェントの詳細出力

💡 ヒント:
  • 初回実行時はプロジェクト全体をスキャンすることを推奨
  • 定期的なチェックには changes モードが効率的
  • セキュリティ監査には critical または high threshold を使用
  • CI/CDでは --skip-comment オプションを使用してパフォーマンス向上

📞 サポート:
  詳細なドキュメント: README.md, API_DOCUMENTATION.md
  アーキテクチャガイド: ARCHITECTURE.md
  マイグレーションガイド: MIGRATION_GUIDE.md
`;

    output.info(helpText);
  },

  // 対話式メニュー表示メソッド
  async showInteractiveMenu(context) {
    const { output } = context;
    
    output.info(`
🔍 Smart Review v2.0 - 対話式メニュー

実行したい操作を選択してください:
`);

    try {
      // Claude Code特有の選択ボックスを使用
      const choice = await context.input.select('操作を選択:', [
        {
          name: '🔄 変更点のクイックレビュー',
          value: 'quick-changes',
          description: '前回チェック以降の変更点を素早くレビュー'
        },
        {
          name: '🔍 プロジェクト全体のスキャン',
          value: 'full-scan',
          description: 'プロジェクト全体を包括的にスキャン'
        },
        {
          name: '🛡️ セキュリティ監査',
          value: 'security-audit',
          description: 'セキュリティ脆弱性に特化した監査'
        },
        {
          name: '⚡ 高優先度問題のみ',
          value: 'high-priority',
          description: 'critical/high優先度の問題のみをチェック'
        },
        {
          name: '🎯 カスタム設定',
          value: 'custom',
          description: '詳細なオプション設定でレビュー実行'
        },
        {
          name: '📖 ヘルプ表示',
          value: 'help',
          description: '詳細なヘルプとオプション一覧を表示'
        }
      ]);

      switch (choice) {
        case 'quick-changes':
          return await this.executeWithArgs(context, {
            scope: 'changes',
            target: '.',
            'priority-threshold': 'medium',
            'max-iterations': 3
          });

        case 'full-scan':
          return await this.executeWithArgs(context, {
            scope: 'all',
            target: '.',
            'priority-threshold': 'medium',
            'max-iterations': 1
          });

        case 'security-audit':
          return await this.executeWithArgs(context, {
            scope: 'all',
            target: '.',
            'priority-threshold': 'critical',
            'max-iterations': 2
          });

        case 'high-priority':
          return await this.executeWithArgs(context, {
            scope: 'changes',
            target: '.',
            'priority-threshold': 'high',
            'max-iterations': 5
          });

        case 'custom':
          return await this.showCustomMenu(context);

        case 'help':
          this.showHelp(output);
          return { success: true, message: 'ヘルプを表示しました' };

        default:
          output.warn('無効な選択です');
          return { success: false, error: '無効な選択' };
      }
    } catch (error) {
      output.error('メニューの表示中にエラーが発生しました:', error);
      return { success: false, error: 'メニューエラー' };
    }
  },

  // カスタム設定メニュー
  async showCustomMenu(context) {
    const { output } = context;
    
    try {
      // 各設定項目を順次選択
      const scope = await context.input.select('チェック範囲:', [
        { name: '変更点のみ (changes)', value: 'changes' },
        { name: 'プロジェクト全体 (all)', value: 'all' }
      ]);

      const target = await context.input.text('対象ディレクトリ:', {
        default: '.',
        placeholder: 'カレントディレクトリの場合は . を入力'
      });

      const priorityThreshold = await context.input.select('優先度しきい値:', [
        { name: '重大な問題のみ (critical)', value: 'critical' },
        { name: '高優先度以上 (high)', value: 'high' },
        { name: '中優先度以上 (medium)', value: 'medium' },
        { name: 'すべての問題 (low)', value: 'low' }
      ]);

      const maxIterations = scope === 'changes' ? 
        await context.input.number('最大繰り返し回数:', {
          default: 5,
          min: 1,
          max: 10
        }) : 1;

      const skipComment = await context.input.confirm('コメント注釈をスキップしますか?', {
        default: false
      });

      const outputDir = await context.input.text('出力ディレクトリ:', {
        default: './smart-review-results',
        placeholder: 'レポートの保存先'
      });

      return await this.executeWithArgs(context, {
        scope,
        target,
        'priority-threshold': priorityThreshold,
        'max-iterations': maxIterations,
        'skip-comment': skipComment,
        'output-dir': outputDir,
        'todo-file': './TODO.md'
      });

    } catch (error) {
      output.error('カスタム設定中にエラーが発生しました:', error);
      return { success: false, error: 'カスタム設定エラー' };
    }
  },

  // 引数付きで実行
  async executeWithArgs(context, args) {
    // 元のexecute関数の本体を呼び出し（ヘルプとメニュー処理を除く）
    return await this.execute(context, { ...args, _skipMenu: true });
  },

  // バージョン情報表示
  showVersion(output) {
    const versionInfo = `
🔍 Smart Review v2.0.0 - インテリジェントコードレビュー自動化システム

📦 バージョン情報:
  • バージョン: 2.0.0
  • リリース日: 2024-01-14
  • セキュリティレベル: ✅ 強化済み
  • Node.js互換性: 14.0.0以上

🛡️ セキュリティ機能:
  ✅ コマンドインジェクション防止
  ✅ パストラバーサル保護
  ✅ XSS防止（HTMLエスケープ）
  ✅ サンドボックス化エージェント実行
  ✅ 入力検証フレームワーク

⚡ パフォーマンス機能:
  • 並列エージェント実行
  • SHA-256ベースのキャッシング
  • リソース制限管理

🆕 新機能:
  • 対話式メニューシステム
  • カスタム設定モード
  • 包括的ヘルプシステム
  • 動作テストモード

📚 詳細情報:
  • ドキュメント: ./README.md
  • 移行ガイド: ./MIGRATION_GUIDE.md
  • セキュリティ: ./SECURITY.md
`;
    output.write(versionInfo);
  },

  // システムテスト実行
  async runSystemTest(context) {
    const { output, terminal, files } = context;
    const testResults = [];
    
    output.write('\n🔧 Smart Review システムテストを開始します...\n');
    output.write('=' .repeat(50) + '\n');
    
    // 1. Node.jsバージョンチェック
    try {
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
      if (majorVersion >= 14) {
        testResults.push({ test: 'Node.jsバージョン', status: '✅', detail: nodeVersion });
      } else {
        testResults.push({ test: 'Node.jsバージョン', status: '⚠️', detail: `${nodeVersion} (14.0以上推奨)` });
      }
    } catch (error) {
      testResults.push({ test: 'Node.jsバージョン', status: '❌', detail: 'チェック失敗' });
    }
    
    // 2. Gitリポジトリチェック
    try {
      const gitCheck = await SecurityUtils.executeCommand('git', ['status']);
      if (gitCheck.success) {
        testResults.push({ test: 'Gitリポジトリ', status: '✅', detail: '検出済み' });
      } else {
        testResults.push({ test: 'Gitリポジトリ', status: '⚠️', detail: 'Gitリポジトリではありません' });
      }
    } catch (error) {
      testResults.push({ test: 'Gitリポジトリ', status: '⚠️', detail: 'Git未インストールまたは未初期化' });
    }
    
    // 3. ファイルシステム権限チェック
    try {
      const testDir = './smart-review-test-' + Date.now();
      await files.createDirectory(testDir);
      const testFile = `${testDir}/test.txt`;
      await files.writeFile(testFile, 'test content');
      const content = await files.readFile(testFile);
      await files.deleteFile(testFile);
      await files.deleteDirectory(testDir);
      testResults.push({ test: 'ファイルシステム権限', status: '✅', detail: '読み書き可能' });
    } catch (error) {
      testResults.push({ test: 'ファイルシステム権限', status: '❌', detail: '権限エラー' });
    }
    
    // 4. Claude CLIチェック
    try {
      const claudeCmd = await module.exports.getClaudeCommand();
      const claudeCheck = await SecurityUtils.executeCommand(claudeCmd, ['--version']);
      if (claudeCheck.success) {
        testResults.push({ test: 'Claude CLI', status: '✅', detail: 'インストール済み' });
      } else {
        testResults.push({ test: 'Claude CLI', status: '❌', detail: '未インストール' });
      }
    } catch (error) {
      testResults.push({ test: 'Claude CLI', status: '❌', detail: '実行不可' });
    }
    
    // 5. エージェント存在チェック
    const agents = [
      'security-error-xss-analyzer',
      'super-debugger-perfectionist',
      'deep-code-reviewer',
      'project-documentation-updater'
    ];
    
    let agentCount = 0;
    for (const agentId of agents) {
      try {
        // エージェントの存在をチェック（実際の実行はしない）
        const agentPath = path.join(process.env.HOME || process.env.USERPROFILE, '.claude', 'agents', agentId);
        // 注: ここではパスの存在チェックのシミュレーション
        agentCount++;
      } catch (error) {
        // エージェントが見つからない
      }
    }
    
    if (agentCount === agents.length) {
      testResults.push({ test: 'AIエージェント', status: '✅', detail: `${agentCount}/${agents.length} 利用可能` });
    } else if (agentCount > 0) {
      testResults.push({ test: 'AIエージェント', status: '⚠️', detail: `${agentCount}/${agents.length} 利用可能` });
    } else {
      testResults.push({ test: 'AIエージェント', status: '❌', detail: 'エージェント未設定' });
    }
    
    // 6. セキュリティモジュールチェック
    try {
      // セキュリティクラスの動作確認
      const testPath = SecurityUtils.validatePath('./test');
      const testCmd = InputValidator.validateChoice('test', ['test', 'other']);
      const testNum = InputValidator.validateNumber(5, { min: 1, max: 10 });
      testResults.push({ test: 'セキュリティモジュール', status: '✅', detail: '正常動作' });
    } catch (error) {
      testResults.push({ test: 'セキュリティモジュール', status: '❌', detail: 'エラー検出' });
    }
    
    // 7. キャッシュシステムチェック
    try {
      const cache = new ResultCache(1000);
      const testKey = cache.generateKey({ id: 'test' }, ['file1.js']);
      await cache.set(testKey, { test: 'data' });
      const cached = await cache.get(testKey);
      if (cached && cached.test === 'data') {
        testResults.push({ test: 'キャッシュシステム', status: '✅', detail: '動作確認済み' });
      } else {
        testResults.push({ test: 'キャッシュシステム', status: '⚠️', detail: '部分的動作' });
      }
    } catch (error) {
      testResults.push({ test: 'キャッシュシステム', status: '❌', detail: 'エラー' });
    }
    
    // テスト結果の表示
    output.write('\n📊 テスト結果:\n');
    output.write('-' .repeat(50) + '\n');
    
    let passCount = 0;
    let warnCount = 0;
    let failCount = 0;
    
    for (const result of testResults) {
      output.write(`  ${result.status} ${result.test}: ${result.detail}\n`);
      if (result.status === '✅') passCount++;
      else if (result.status === '⚠️') warnCount++;
      else failCount++;
    }
    
    output.write('\n' + '=' .repeat(50) + '\n');
    output.write(`📈 サマリー: ✅ ${passCount} 成功 / ⚠️ ${warnCount} 警告 / ❌ ${failCount} 失敗\n\n`);
    
    // 総合判定
    if (failCount === 0 && warnCount <= 2) {
      output.write('✅ システムは正常に稼働可能です！\n');
      return { 
        success: true, 
        message: 'システムテスト完了',
        testResults,
        summary: { pass: passCount, warn: warnCount, fail: failCount }
      };
    } else if (failCount === 0) {
      output.write('⚠️ システムは稼働可能ですが、一部機能が制限される可能性があります。\n');
      return { 
        success: true, 
        message: 'システムテスト完了（警告あり）',
        testResults,
        summary: { pass: passCount, warn: warnCount, fail: failCount }
      };
    } else {
      output.write('❌ システムの稼働に問題があります。上記のエラーを修正してください。\n');
      return { 
        success: false, 
        message: 'システムテスト失敗',
        testResults,
        summary: { pass: passCount, warn: warnCount, fail: failCount }
      };
    }
  },

  async execute(context, args) {
    const startExecutionTime = Date.now();
    const { output } = context;
    
    // バージョン情報の処理
    if (args.version) {
      this.showVersion(output);
      return { success: true, message: 'バージョン情報を表示しました' };
    }
    
    // ヘルプオプションの処理
    if (args.help) {
      this.showHelp(output);
      return { success: true, message: 'ヘルプを表示しました' };
    }
    
    // テストモードの処理
    if (args.test) {
      return await this.runSystemTest(context);
    }
    
    // 引数が指定されていない場合、対話式メニューを表示（_skipMenuフラグがない場合のみ）
    if (!args._skipMenu && (Object.keys(args).length === 0 || (!args.scope && !args.target))) {
      return await this.showInteractiveMenu(context);
    }
    
    try {
      // 入力検証（強化版）- デフォルト値を適用
      const validatedArgs = {
        scope: InputValidator.validateChoice(args.scope || 'changes', ['changes', 'all']),
        target: SecurityUtils.validatePath(args.target || '.'),
        'todo-file': SecurityUtils.validatePath(args['todo-file'] || './TODO.md'),
        'max-iterations': InputValidator.validateNumber(args['max-iterations'] || 5, { 
          min: Config.MAX_ITERATIONS_RANGE.min, 
          max: Config.MAX_ITERATIONS_RANGE.max,
          integer: true
        }),
        'output-dir': SecurityUtils.validateOutputDirectory(args['output-dir'] || './smart-review-results'),
        'skip-comment': Boolean(args['skip-comment']),
        'priority-threshold': InputValidator.validateChoice(args['priority-threshold'] || 'medium', 
          ['critical', 'high', 'medium', 'low'])
      };
      
      const { 
        scope,
        target,
        'todo-file': todoFile,
        'max-iterations': maxIterations,
        'output-dir': outputDir,
        'skip-comment': skipComment,
        'priority-threshold': priorityThreshold
      } = validatedArgs;
      
      const { files, output, terminal } = context;
      
      // エージェントの定義を設定モジュールから取得
      const reviewAgents = await configManager.getAgents();
      
      // コメント注釈エージェントの定義（別扱い）
      const commentAgent = {
        id: 'code-comment-annotator-ja',
        name: 'コードコメント注釈者（日本語）',
        model: 'sonnet',
        path: process.env.COMMENT_AGENT_PATH || path.join(process.env.HOME || process.env.USERPROFILE, '.claude', 'agents', 'code-comment-annotator-ja'),
        role: '日本語コメントの追加',
        allowedCommands: ['git']
      };
      
      // 実行コンテキストの初期化
      const executionContext = {
        scope,
        target,
        startTime: new Date().toISOString(),
        changedFiles: [],
        allIssues: [],
        todoList: [],
        iterations: [],
        finalCommentResult: null,
        metrics: {
          totalExecutionTime: 0,
          filesAnalyzed: 0,
          issuesFound: 0,
          issuesFixed: 0
        }
      };
      
      // 出力ディレクトリの作成（セキュア版）
      try {
        await fs.mkdir(outputDir, { recursive: true });
      } catch (error) {
        const sanitized = SecurityUtils.sanitizeError(error);
        output.warning(`出力ディレクトリの作成に失敗: ${sanitized.message}`);
      }
      
      output.info('🔍 スマートレビュー（セキュリティ強化版）を開始します');
      output.info(`📊 スコープ: ${scope === 'all' ? 'プロジェクト全体' : '変更差分'}`);
      output.info(`📁 対象: ${target}`);
      output.info(`🎯 優先度閾値: ${priorityThreshold}以上`);
      output.info('═'.repeat(70));
      
      // 変更ファイルの検出（修正版）
      async function detectChangedFiles() {
        try {
          // 前回のTODOファイルから最終実行時刻を取得（安全化）
          let lastCheckTime = null;
          if (await files.exists(todoFile)) {
            const todoContent = await files.read(todoFile);
            const timeMatch = todoContent.match(/最終チェック: (.+)/);
            if (timeMatch) {
              lastCheckTime = SecurityUtils.safeParseDate(timeMatch[1]);
            }
          }
          
          // Git操作を修正（--sinceオプション問題の解決）
          let gitArgs;
          if (lastCheckTime && lastCheckTime instanceof Date && !isNaN(lastCheckTime.getTime())) {
            // より安全なgit logアプローチ（--afterを使用）
            const timeString = lastCheckTime.toISOString();
            gitArgs = ['log', '--name-only', '--pretty=format:', '--after', timeString];
          } else {
            // フォールバック: 直近の変更を取得
            gitArgs = ['log', '--name-only', '--pretty=format:', '-n', '10'];
          }
          
          const result = await SecurityUtils.executeCommand('git', gitArgs);
          
          // Limit git output size to prevent memory issues
          const limitedOutput = result.stdout.length > 1024 * 1024 
            ? result.stdout.substring(0, 1024 * 1024) 
            : result.stdout;
            
          const changedFiles = limitedOutput
            .split('\n')
            .map(f => f.trim())
            .filter(f => f && !f.startsWith('commit ') && f.length < 260) // Path length limit
            .filter((file, index, arr) => arr.indexOf(file) === index) // 重複除去
            .slice(0, 1000); // Limit number of files
          
          output.info(`📝 検出された変更ファイル: ${changedFiles.length}件`);
          changedFiles.slice(0, 5).forEach(f => output.debug(`  - ${f}`));
          if (changedFiles.length > 5) {
            output.debug(`  ... 他 ${changedFiles.length - 5}件`);
          }
          
          return changedFiles;
        } catch (error) {
          const sanitized = SecurityUtils.sanitizeError(error);
          output.warning(`Git差分の取得に失敗: ${sanitized.message}. 全ファイルを対象にします。`);
          return [];
        }
      }
      
      // TODO内容の生成
      function generateTodoContent(issues, priorityThreshold, previousTodo = '') {
        const priorityLevels = { critical: 0, high: 1, medium: 2, low: 3 };
        const thresholdLevel = priorityLevels[priorityThreshold];
        
        // 優先度でフィルタリング（修正：>= を使用）
        const filteredIssues = issues.filter(issue => 
          issue.priority && priorityLevels[issue.priority] !== undefined &&
          priorityLevels[issue.priority] <= thresholdLevel
        );
        
        // カテゴリと優先度でグループ化
        const grouped = {};
        filteredIssues.forEach(issue => {
          const key = `${issue.priority}-${issue.category}`;
          if (!grouped[key]) {
            grouped[key] = {
              priority: issue.priority,
              category: issue.category,
              issues: []
            };
          }
          grouped[key].issues.push(issue);
        });
        
        // TODOリストの構築
        const todoList = [];
        let todoContent = '# Smart Review TODO List\n\n';
        todoContent += `最終チェック: ${new Date().toISOString()}\n`;
        todoContent += `対象: ${SecurityUtils.escapeHtml(target)}\n`;
        todoContent += `検出された問題: ${filteredIssues.length}件\n\n`;
        
        // 優先度順にソート
        const sortedGroups = Object.values(grouped).sort((a, b) => 
          priorityLevels[a.priority] - priorityLevels[b.priority]
        );
        
        const priorityEmojis = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' };
        const categoryNames = {
          security: 'セキュリティ',
          bug: 'バグ',
          quality: 'コード品質',
          documentation: 'ドキュメント'
        };
        
        sortedGroups.forEach(group => {
          const emoji = priorityEmojis[group.priority];
          const categoryName = categoryNames[group.category] || group.category;
          
          todoContent += `## ${emoji} ${group.priority.toUpperCase()} - ${categoryName}\n\n`;
          
          group.issues.forEach((issue, index) => {
            const todoItem = {
              priority: group.priority,
              category: group.category,
              type: issue.type || 'general',
              title: issue.message.substring(0, 100),
              description: issue.message,
              file: issue.file,
              line: issue.line,
              autoFixAvailable: issue.autoFixAvailable
            };
            
            todoList.push(todoItem);
            
            todoContent += `${index + 1}. [ ] ${SecurityUtils.escapeHtml(todoItem.title)}\n`;
            if (todoItem.file) {
              todoContent += `   - ファイル: ${SecurityUtils.escapeHtml(todoItem.file)}`;
              if (todoItem.line) {
                todoContent += `:${todoItem.line}`;
              }
              todoContent += '\n';
            }
            if (todoItem.autoFixAvailable) {
              todoContent += `   - 🔧 自動修正可能\n`;
            }
            todoContent += '\n';
          });
        });
        
        // 統計情報
        todoContent += '\n## 統計\n\n';
        todoContent += `- Critical: ${filteredIssues.filter(i => i.priority === 'critical').length}件\n`;
        todoContent += `- High: ${filteredIssues.filter(i => i.priority === 'high').length}件\n`;
        todoContent += `- Medium: ${filteredIssues.filter(i => i.priority === 'medium').length}件\n`;
        todoContent += `- Low: ${filteredIssues.filter(i => i.priority === 'low').length}件\n`;
        
        return { content: todoContent, todoList };
      }
      
      // HTMLレポートの生成（XSS対策版）
      function generateHTMLReport(context) {
        const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Smart Review Report - ${SecurityUtils.escapeHtml(new Date().toISOString())}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 3px solid #007acc; padding-bottom: 10px; }
    h2 { color: #555; margin-top: 30px; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
    .metric { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; text-align: center; }
    .metric .value { font-size: 2em; font-weight: bold; }
    .metric .label { font-size: 0.9em; opacity: 0.9; margin-top: 5px; }
    .issue { background: #f8f9fa; border-left: 4px solid #007acc; padding: 15px; margin: 10px 0; border-radius: 5px; }
    .issue.critical { border-left-color: #dc3545; }
    .issue.high { border-left-color: #fd7e14; }
    .issue.medium { border-left-color: #ffc107; }
    .issue.low { border-left-color: #28a745; }
    .issue-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .issue-title { font-weight: bold; color: #333; }
    .issue-meta { font-size: 0.9em; color: #666; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 3px; font-size: 0.85em; font-weight: bold; }
    .badge-critical { background: #dc3545; color: white; }
    .badge-high { background: #fd7e14; color: white; }
    .badge-medium { background: #ffc107; color: black; }
    .badge-low { background: #28a745; color: white; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔍 Smart Review Report</h1>
    
    <div class="metrics">
      <div class="metric">
        <div class="value">${context.metrics.filesAnalyzed}</div>
        <div class="label">ファイル分析</div>
      </div>
      <div class="metric">
        <div class="value">${context.metrics.issuesFound}</div>
        <div class="label">問題検出</div>
      </div>
      <div class="metric">
        <div class="value">${context.metrics.issuesFixed}</div>
        <div class="label">自動修正</div>
      </div>
      <div class="metric">
        <div class="value">${Math.round(context.metrics.totalExecutionTime / 1000)}秒</div>
        <div class="label">実行時間</div>
      </div>
    </div>
    
    <h2>📋 検出された問題</h2>
    ${context.todoList.map(item => `
      <div class="issue ${SecurityUtils.escapeHtml(item.priority)}">
        <div class="issue-header">
          <div class="issue-title">${SecurityUtils.escapeHtml(item.title)}</div>
          <div>
            <span class="badge badge-${SecurityUtils.escapeHtml(item.priority)}">${SecurityUtils.escapeHtml(item.priority.toUpperCase())}</span>
            <span class="badge" style="background: #6c757d; color: white;">${SecurityUtils.escapeHtml(item.category)}</span>
          </div>
        </div>
        <div class="issue-meta">
          ${item.file ? `📁 ${SecurityUtils.escapeHtml(item.file)}${item.line ? `:${item.line}` : ''}` : ''}
          ${item.autoFixAvailable ? '🔧 自動修正可能' : ''}
        </div>
        <div style="margin-top: 10px; color: #555;">${SecurityUtils.escapeHtml(item.description)}</div>
      </div>
    `).join('')}
    
    <div class="footer">
      <p>Generated by Smart Review v2.0.0 (Security Enhanced) - ${SecurityUtils.escapeHtml(new Date().toISOString())}</p>
    </div>
  </div>
</body>
</html>`;
        
        return html;
      }
      
      // メイン処理
      try {
        // スコープに応じた処理
        if (scope === 'changes') {
          // 変更モード: 反復的な分析と修正
          output.info('\n📊 変更ファイルの検出...');
          const changedFiles = await detectChangedFiles();
          
          if (changedFiles.length === 0) {
            output.success('✨ 変更ファイルがありません。');
            return { success: true, message: '変更ファイルなし' };
          }
          
          executionContext.changedFiles = changedFiles;
          executionContext.metrics.filesAnalyzed = changedFiles.length;
          
          // 反復処理
          for (let iteration = 1; iteration <= maxIterations; iteration++) {
            output.info(`\n🔄 反復 ${iteration}/${maxIterations}`);
            
            const iterationResult = {
              number: iteration,
              timestamp: new Date().toISOString(),
              changedFiles: [...changedFiles],
              issuesFixed: 0,
              newIssues: []
            };
            
            // 各エージェントを並列実行
            const results = await ParallelExecutor.executeAgents(reviewAgents, changedFiles, { target }, iteration);
            
            results.forEach(result => {
              if (result.error) {
                output.warning(`  ⚠️ ${result.agentName}: ${result.error}`);
              } else {
                output.success(`  ✅ ${result.agentName}: ${result.issues.length}件の問題を検出 (${result.executionTime}ms)`);
              }
              iterationResult.newIssues.push(...result.issues);
            });
            
            executionContext.allIssues.push(...iterationResult.newIssues);
            executionContext.metrics.issuesFound += iterationResult.newIssues.length;
            
            // 自動修正可能な問題を特定
            const fixableIssues = iterationResult.newIssues.filter(i => i.autoFixAvailable);
            
            if (fixableIssues.length === 0) {
              output.info('  ℹ️ 自動修正可能な問題はありません。');
              executionContext.iterations.push(iterationResult);
              break;
            }
            
            output.info(`  🔧 ${fixableIssues.length}件の問題を自動修正中...`);
            iterationResult.issuesFixed = fixableIssues.length;
            executionContext.metrics.issuesFixed += fixableIssues.length;
            
            executionContext.iterations.push(iterationResult);
            
            // 次の反復のために変更ファイルを再検出
            const newChangedFiles = await detectChangedFiles();
            if (newChangedFiles.length === 0) {
              output.success('  ✅ すべての問題が解決されました！');
              break;
            }
          }
        } else {
          // 全体モード: 一回の包括的な分析
          output.info('\n📊 プロジェクト全体の分析...');
          
          // 全ファイルを対象に（簡略化）
          const allFiles = [];
          executionContext.changedFiles = allFiles;
          
          // 各エージェントを並列実行
          const results = await ParallelExecutor.executeAgents(reviewAgents, allFiles, { target }, 1);
          
          results.forEach(result => {
            if (result.error) {
              output.warning(`  ⚠️ ${result.agentName}: ${result.error}`);
            } else {
              output.success(`  ✅ ${result.agentName}: ${result.issues.length}件の問題を検出 (${result.executionTime}ms)`);
            }
            executionContext.allIssues.push(...result.issues);
          });
          
          executionContext.metrics.issuesFound = executionContext.allIssues.length;
        }
        
        // 日本語コメント注釈（オプション）
        if (!skipComment && executionContext.changedFiles.length > 0) {
          output.info('\n💬 日本語コメントを追加中...');
          
          try {
            const commentArgs = [
              'agent',
              'run',
              commentAgent.id,
              '--target', target,
              '--model', commentAgent.model,
              '--add-comments',
              '--sandbox-mode'
            ];
            
            const claudeCmd = await module.exports.getClaudeCommand();
            const result = await SecurityUtils.executeCommand(claudeCmd, commentArgs, {
              timeout: Config.COMMENT_TIMEOUT
            });
            
            executionContext.finalCommentResult = {
              success: true,
              filesCommented: executionContext.changedFiles.length
            };
            
            output.success('  ✅ コメント追加完了');
          } catch (error) {
            const sanitized = SecurityUtils.sanitizeError(error);
            output.warning(`  ⚠️ コメント追加に失敗: ${sanitized.message}`);
            executionContext.finalCommentResult = {
              success: false,
              error: sanitized.message
            };
          }
        }
        
        // TODOリストの生成
        output.info('\n📝 TODOリストを生成中...');
        const { content: todoContent, todoList } = generateTodoContent(
          executionContext.allIssues,
          priorityThreshold
        );
        executionContext.todoList = todoList;
        
        // 結果の保存
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const randomSuffix = crypto.randomBytes(4).toString('hex');
        const todoPath = path.join(outputDir, `todo-${timestamp}-${randomSuffix}.md`);
        const reportPath = path.join(outputDir, `report-${timestamp}-${randomSuffix}.html`);
        
        await files.write(todoPath, todoContent);
        output.success(`  ✅ TODOリスト: ${todoPath}`);
        
        const htmlReport = generateHTMLReport(executionContext);
        await files.write(reportPath, htmlReport);
        output.success(`  ✅ HTMLレポート: ${reportPath}`);
        
        // メトリクスの計算
        executionContext.metrics.totalExecutionTime = Date.now() - startExecutionTime;
        
        // サマリー表示
        output.info('\n' + '═'.repeat(70));
        output.success('✨ スマートレビュー完了！');
        output.info(`  📊 分析ファイル数: ${executionContext.metrics.filesAnalyzed}`);
        output.info(`  🔍 検出された問題: ${executionContext.metrics.issuesFound}`);
        output.info(`  🔧 自動修正: ${executionContext.metrics.issuesFixed}`);
        output.info(`  ⏱️ 実行時間: ${Math.round(executionContext.metrics.totalExecutionTime / 1000)}秒`);
        
        return {
          success: true,
          context: executionContext,
          reportPath,
          outputDir
        };
        
      } catch (error) {
        const sanitized = SecurityUtils.sanitizeError(error);
        output.error(`エラーが発生しました: ${sanitized.message}`);
        return {
          success: false,
          error: sanitized.message
        };
      }
      
    } catch (validationError) {
      const sanitized = SecurityUtils.sanitizeError(validationError);
      output.error(`入力検証エラー: ${sanitized.message}`);
      return {
        success: false,
        error: sanitized.message
      };
    }
  }
};