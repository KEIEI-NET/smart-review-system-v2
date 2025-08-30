// smart-review-config.js
// スマートレビューシステムの設定管理モジュール

const path = require('path');
const fs = require('fs').promises;
const os = require('os');

/**
 * 設定管理クラス
 * 環境変数、設定ファイル、デフォルト値の優先順位で設定を管理
 */
class SmartReviewConfig {
  constructor() {
    this.configCache = null;
    this.configPaths = [
      path.join(process.cwd(), '.smart-review.json'),
      path.join(os.homedir(), '.claude', 'smart-review.json'),
      path.join(os.homedir(), '.config', 'smart-review.json')
    ];
  }

  /**
   * エージェント設定の取得
   */
  async getAgents() {
    const config = await this.loadConfig();
    const baseAgentPath = process.env.CLAUDE_AGENTS_PATH || 
                          path.join(os.homedir(), '.claude', 'agents');
    
    return config.agents.map(agent => ({
      ...agent,
      path: agent.path || path.join(baseAgentPath, agent.id),
      model: agent.model || 'sonnet',
      timeout: agent.timeout || 120000, // デフォルト2分
      allowedCommands: agent.allowedCommands || ['git']
    }));
  }

  /**
   * セキュリティ設定の取得
   */
  async getSecuritySettings() {
    const config = await this.loadConfig();
    return {
      ...Config.DEFAULT_SECURITY,
      ...config.security,
      allowedPaths: this.resolveAllowedPaths(config.security?.allowedPaths),
      blockedPatterns: this.compilePatterns(config.security?.blockedPatterns)
    };
  }

  /**
   * パフォーマンス設定の取得
   */
  async getPerformanceSettings() {
    const config = await this.loadConfig();
    return {
      maxConcurrency: config.performance?.maxConcurrency || 4,
      cacheEnabled: config.performance?.cacheEnabled !== false,
      cacheTTL: config.performance?.cacheTTL || 15 * 60 * 1000,
      maxCacheSize: config.performance?.maxCacheSize || 100,
      batchSize: config.performance?.batchSize || 10
    };
  }

  /**
   * 設定ファイルの読み込み
   */
  async loadConfig() {
    if (this.configCache) {
      return this.configCache;
    }

    // 環境変数から設定パスを追加
    if (process.env.SMART_REVIEW_CONFIG) {
      this.configPaths.unshift(process.env.SMART_REVIEW_CONFIG);
    }

    // 設定ファイルを順番に探索
    for (const configPath of this.configPaths) {
      try {
        const configData = await fs.readFile(configPath, 'utf8');
        const config = JSON.parse(configData);
        
        // 設定の検証
        this.validateConfig(config);
        
        // 環境変数でオーバーライド
        const mergedConfig = this.mergeWithEnv(config);
        
        this.configCache = mergedConfig;
        return mergedConfig;
      } catch (error) {
        // デバッグモードでエラーログを出力
        if (process.env.SMART_REVIEW_DEBUG) {
          console.error(`設定ファイル読み込みエラー (${configPath}):`, error.message);
        }
        
        // JSON解析エラーの場合は詳細を記録
        if (error instanceof SyntaxError) {
          console.warn(`⚠️ 設定ファイルの形式が不正です: ${configPath}`);
        }
        
        // ファイルが見つからない場合は次を試す
        continue;
      }
    }

    // デフォルト設定を返す
    return this.getDefaultConfig();
  }

  /**
   * デフォルト設定
   */
  getDefaultConfig() {
    return {
      agents: [
        {
          id: 'security-error-xss-analyzer',
          name: 'セキュリティ・XSSアナライザー',
          model: 'sonnet',
          role: 'セキュリティ脆弱性の検出',
          category: 'security',
          errorTypes: ['xss', 'sql-injection', 'csrf', 'auth-bypass', 'data-exposure'],
          canAutoFix: true,
          priority: 'critical',
          enabled: true
        },
        {
          id: 'super-debugger-perfectionist',
          name: 'スーパーデバッガー（完璧主義者）',
          model: 'sonnet',
          role: 'バグと最適化ポイントの検出',
          category: 'bug',
          errorTypes: ['bug', 'logic-error', 'memory-leak', 'performance', 'race-condition'],
          canAutoFix: true,
          priority: 'high',
          enabled: true
        },
        {
          id: 'deep-code-reviewer',
          name: 'ディープコードレビュアー',
          model: 'opus',
          role: 'アーキテクチャとコード品質の評価',
          category: 'quality',
          errorTypes: ['architecture', 'design-pattern', 'code-smell', 'complexity', 'duplication'],
          canAutoFix: false,
          priority: 'medium',
          enabled: true
        },
        {
          id: 'project-documentation-updater',
          name: 'プロジェクトドキュメント更新者',
          model: 'opus',
          role: 'ドキュメントの不足と不整合の検出',
          category: 'documentation',
          errorTypes: ['missing-docs', 'outdated-docs', 'inconsistent-docs', 'unclear-docs'],
          canAutoFix: true,
          priority: 'low',
          enabled: true
        }
      ],
      security: {
        allowedPaths: ['./'],
        blockedPatterns: [
          'node_modules',
          '.git',
          'dist',
          'build',
          '*.min.js'
        ],
        maxFileSize: 10 * 1024 * 1024,
        sanitizeOutput: true,
        preventPathTraversal: true
      },
      performance: {
        maxConcurrency: 4,
        cacheEnabled: true,
        cacheTTL: 900000,
        maxCacheSize: 100,
        batchSize: 10
      },
      output: {
        format: 'both', // 'markdown', 'html', 'both'
        includeMetrics: true,
        includeRawOutput: false,
        timestampFormat: 'ISO'
      },
      notifications: {
        enabled: false,
        channels: [],
        criticalOnly: true
      }
    };
  }

  /**
   * 設定の検証
   */
  validateConfig(config) {
    if (!config.agents || !Array.isArray(config.agents)) {
      throw new Error('設定エラー: agentsは配列である必要があります');
    }

    config.agents.forEach((agent, index) => {
      if (!agent.id) {
        throw new Error(`設定エラー: agents[${index}]にidが必要です`);
      }
      if (!agent.name) {
        throw new Error(`設定エラー: agents[${index}]にnameが必要です`);
      }
      if (agent.priority && !['critical', 'high', 'medium', 'low'].includes(agent.priority)) {
        throw new Error(`設定エラー: agents[${index}]の優先度が無効です`);
      }
    });

    if (config.security) {
      if (config.security.maxFileSize && typeof config.security.maxFileSize !== 'number') {
        throw new Error('設定エラー: security.maxFileSizeは数値である必要があります');
      }
    }

    if (config.performance) {
      if (config.performance.maxConcurrency && 
          (config.performance.maxConcurrency < 1 || config.performance.maxConcurrency > 10)) {
        throw new Error('設定エラー: performance.maxConcurrencyは1-10の範囲である必要があります');
      }
    }
  }

  /**
   * 環境変数とのマージ
   */
  mergeWithEnv(config) {
    const merged = { ...config };

    // 環境変数でエージェントの有効/無効を制御
    if (process.env.SMART_REVIEW_DISABLED_AGENTS) {
      const disabled = process.env.SMART_REVIEW_DISABLED_AGENTS.split(',');
      merged.agents = merged.agents.map(agent => ({
        ...agent,
        enabled: !disabled.includes(agent.id)
      }));
    }

    // パフォーマンス設定のオーバーライド
    if (process.env.SMART_REVIEW_MAX_CONCURRENCY) {
      merged.performance = merged.performance || {};
      merged.performance.maxConcurrency = parseInt(process.env.SMART_REVIEW_MAX_CONCURRENCY);
    }

    // キャッシュの有効/無効
    if (process.env.SMART_REVIEW_CACHE === 'false') {
      merged.performance = merged.performance || {};
      merged.performance.cacheEnabled = false;
    }

    return merged;
  }

  /**
   * 許可パスの解決
   */
  resolveAllowedPaths(paths) {
    if (!paths || !Array.isArray(paths)) {
      return [process.cwd()];
    }

    return paths.map(p => path.resolve(p));
  }

  /**
   * パターンのコンパイル
   */
  compilePatterns(patterns) {
    if (!patterns || !Array.isArray(patterns)) {
      return [];
    }

    return patterns.map(pattern => {
      // glob パターンを正規表現に変換
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
      
      return new RegExp(regexPattern);
    });
  }

  /**
   * 設定の保存
   */
  async saveConfig(config, targetPath = null) {
    const savePath = targetPath || this.configPaths[0];
    
    // 設定の検証
    this.validateConfig(config);
    
    // ディレクトリの作成
    const dir = path.dirname(savePath);
    await fs.mkdir(dir, { recursive: true });
    
    // 設定の保存
    const configJson = JSON.stringify(config, null, 2);
    await fs.writeFile(savePath, configJson, 'utf8');
    
    // キャッシュのクリア
    this.configCache = null;
    
    return savePath;
  }

  /**
   * プロジェクト固有の設定を作成
   */
  async createProjectConfig(projectPath = process.cwd()) {
    const defaultConfig = this.getDefaultConfig();
    
    // プロジェクト用にカスタマイズ
    const projectConfig = {
      ...defaultConfig,
      project: {
        name: path.basename(projectPath),
        path: projectPath,
        created: new Date().toISOString()
      },
      agents: defaultConfig.agents.map(agent => ({
        ...agent,
        // プロジェクト固有の設定を追加可能
        projectSpecific: {}
      }))
    };
    
    const configPath = path.join(projectPath, '.smart-review.json');
    await this.saveConfig(projectConfig, configPath);
    
    return configPath;
  }

  /**
   * 設定のエクスポート
   */
  async exportConfig(format = 'json') {
    const config = await this.loadConfig();
    
    switch (format) {
      case 'json':
        return JSON.stringify(config, null, 2);
      
      case 'env':
        return this.configToEnv(config);
      
      case 'yaml':
        // YAML形式への変換（yaml パッケージが必要）
        const yaml = require('yaml');
        return yaml.stringify(config);
      
      default:
        throw new Error(`未対応のフォーマット: ${format}`);
    }
  }

  /**
   * 環境変数形式への変換
   */
  configToEnv(config) {
    const envVars = [];
    
    // エージェントの設定
    const enabledAgents = config.agents
      .filter(a => a.enabled)
      .map(a => a.id)
      .join(',');
    envVars.push(`SMART_REVIEW_ENABLED_AGENTS="${enabledAgents}"`);
    
    // パフォーマンス設定
    if (config.performance) {
      envVars.push(`SMART_REVIEW_MAX_CONCURRENCY=${config.performance.maxConcurrency}`);
      envVars.push(`SMART_REVIEW_CACHE=${config.performance.cacheEnabled}`);
    }
    
    // セキュリティ設定
    if (config.security) {
      envVars.push(`SMART_REVIEW_MAX_FILE_SIZE=${config.security.maxFileSize}`);
    }
    
    return envVars.join('\n');
  }
}

// Config定数クラス（互換性のため）
class Config {
  static get ALLOWED_COMMANDS() {
    return ['git', 'mkdir', 'claude-code', 'claude'];
  }
  
  static get ALLOWED_OUTPUT_BASE() {
    return './smart-review-results';
  }
  
  static get MAX_ITERATIONS_RANGE() {
    return { min: 1, max: 10 };
  }
  
  static get COMMAND_TIMEOUT() {
    return 60000; // 1分
  }
  
  static get MAX_BUFFER() {
    return 10 * 1024 * 1024; // 10MB
  }
  
  static get AGENT_TIMEOUT() {
    return 120000; // 2分
  }
  
  static get COMMENT_TIMEOUT() {
    return 180000; // 3分
  }
  
  static get DEFAULT_SECURITY() {
    return {
      preventPathTraversal: true,
      sanitizeOutput: true,
      maxFileSize: 10 * 1024 * 1024,
      allowedPaths: [process.cwd()],
      blockedPatterns: []
    };
  }
}

// シングルトンインスタンス
const configManager = new SmartReviewConfig();

module.exports = {
  Config,
  SmartReviewConfig,
  configManager
};