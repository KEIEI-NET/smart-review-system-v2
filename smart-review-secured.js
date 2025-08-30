// .claudecode/commands/smart-review-secured.js
// セキュリティ強化版: 差分チェックまたは全体チェックを行い、TODOリストを生成する賢いレビューコマンド

const path = require('path');
const fs = require('fs').promises;
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

// セキュリティユーティリティクラス
class SecurityUtils {
  // パスの検証
  static validatePath(userPath, baseDir = process.cwd()) {
    const resolved = path.resolve(baseDir, userPath);
    const normalizedBase = path.resolve(baseDir);
    
    if (!resolved.startsWith(normalizedBase)) {
      throw new Error(`不正なパス: パストラバーサルが検出されました - ${userPath}`);
    }
    
    // 追加の検証
    if (userPath.includes('..') || userPath.includes('~')) {
      throw new Error(`不正なパス: 相対パス参照が含まれています - ${userPath}`);
    }
    
    return resolved;
  }

  // 出力ディレクトリの検証
  static validateOutputDirectory(outputDir) {
    const ALLOWED_OUTPUT_BASE = './smart-review-results';
    const resolved = path.resolve(outputDir);
    const allowedBase = path.resolve(ALLOWED_OUTPUT_BASE);
    
    // 許可されたディレクトリ内であることを確認
    if (!resolved.startsWith(allowedBase)) {
      // 許可されたディレクトリ内にフォールバック
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      return path.join(allowedBase, `output-${timestamp}`);
    }
    
    return resolved;
  }

  // エラーメッセージのサニタイズ
  static sanitizeError(error) {
    let message = error.message || String(error);
    
    // パスの匿名化
    message = message.replace(/\/home\/[^\/]+/g, '/home/<user>');
    message = message.replace(/C:\\Users\\[^\\]+/g, 'C:\\Users\\<user>');
    message = message.replace(/\/Users\/[^\/]+/g, '/Users/<user>');
    
    // 機密情報のマスキング
    message = message.replace(/api[_-]?key[:\s]*['"]?[\w\-]+/gi, 'API_KEY_REDACTED');
    message = message.replace(/password[:\s]*['"]?[\w\-]+/gi, 'PASSWORD_REDACTED');
    message = message.replace(/token[:\s]*['"]?[\w\-]+/gi, 'TOKEN_REDACTED');
    
    return {
      message,
      code: error.code || 'UNKNOWN_ERROR',
      timestamp: new Date().toISOString()
    };
  }

  // セキュアなコマンド実行
  static async executeCommand(command, args = [], options = {}) {
    const {
      timeout = 60000,
      maxBuffer = 10 * 1024 * 1024,
      cwd = process.cwd()
    } = options;
    
    // コマンドのホワイトリスト
    const allowedCommands = ['git', 'mkdir', 'claude-code', 'claude'];
    if (!allowedCommands.includes(command)) {
      throw new Error(`許可されていないコマンド: ${command}`);
    }
    
    // 引数のサニタイズ
    const sanitizedArgs = args.map(arg => {
      if (typeof arg !== 'string') {
        return String(arg);
      }
      // シェルメタ文字を削除（エスケープではなく削除）
      return arg.replace(/[;&|`$()<>]/g, '');
    });
    
    try {
      const result = await execFileAsync(command, sanitizedArgs, {
        timeout,
        maxBuffer,
        cwd: SecurityUtils.validatePath(cwd),
        shell: false  // シェル解釈を無効化
      });
      
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: 0
      };
    } catch (error) {
      const sanitized = SecurityUtils.sanitizeError(error);
      throw new Error(sanitized.message);
    }
  }
}

// 入力検証クラス
// Helper function to get available Claude command
async function getClaudeCommand() {
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
}

class InputValidator {
  static validateString(input, options = {}) {
    const { 
      maxLength = 1000, 
      pattern = null, 
      allowEmpty = false 
    } = options;
    
    if (!allowEmpty && !input) {
      throw new Error('入力が空です');
    }
    
    if (input && input.length > maxLength) {
      throw new Error(`入力が最大長を超えています: ${maxLength}`);
    }
    
    if (pattern && !pattern.test(input)) {
      throw new Error('入力が無効な形式です');
    }
    
    return input;
  }
  
  static validateNumber(input, options = {}) {
    const { min = 0, max = Infinity } = options;
    const num = Number(input);
    
    if (isNaN(num)) {
      throw new Error('有効な数値ではありません');
    }
    
    if (num < min || num > max) {
      throw new Error(`数値が範囲外です: ${min}-${max}`);
    }
    
    return num;
  }
  
  static validateChoice(input, choices) {
    if (!choices.includes(input)) {
      throw new Error(`無効な選択: ${input}. 有効な選択肢: ${choices.join(', ')}`);
    }
    return input;
  }
}

module.exports = {
  name: 'smart-review',
  description: '変更点または全体をチェックし、修正またはTODOリストを生成',
  
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
    }
  ],
  
  async execute(context, args) {
    const startExecutionTime = Date.now();
    
    try {
      // 入力検証
      const validatedArgs = {
        scope: InputValidator.validateChoice(args.scope, ['changes', 'all']),
        target: SecurityUtils.validatePath(args.target),
        'todo-file': SecurityUtils.validatePath(args['todo-file']),
        'max-iterations': InputValidator.validateNumber(args['max-iterations'], { min: 1, max: 10 }),
        'output-dir': SecurityUtils.validateOutputDirectory(args['output-dir']),
        'skip-comment': Boolean(args['skip-comment']),
        'priority-threshold': InputValidator.validateChoice(args['priority-threshold'], 
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
      
      // エージェントの定義（実行順序順）
      const reviewAgents = [
        {
          id: 'security-error-xss-analyzer',
          name: 'セキュリティ・XSSアナライザー',
          model: 'sonnet',
          path: 'C:\\Users\\kenji\\.claude\\agents\\security-error-xss-analyzer',
          role: 'セキュリティ脆弱性の検出',
          category: 'security',
          errorTypes: ['xss', 'sql-injection', 'csrf', 'auth-bypass', 'data-exposure'],
          canAutoFix: true,
          priority: 'critical'
        },
        {
          id: 'super-debugger-perfectionist',
          name: 'スーパーデバッガー（完璧主義者）',
          model: 'sonnet',
          path: 'C:\\Users\\kenji\\.claude\\agents\\super-debugger-perfectionist',
          role: 'バグと最適化ポイントの検出',
          category: 'bug',
          errorTypes: ['bug', 'logic-error', 'memory-leak', 'performance', 'race-condition'],
          canAutoFix: true,
          priority: 'high'
        },
        {
          id: 'deep-code-reviewer',
          name: 'ディープコードレビュアー',
          model: 'opus',
          path: 'C:\\Users\\kenji\\.claude\\agents\\deep-code-reviewer',
          role: 'アーキテクチャとコード品質の評価',
          category: 'quality',
          errorTypes: ['architecture', 'design-pattern', 'code-smell', 'complexity', 'duplication'],
          canAutoFix: false,
          priority: 'medium'
        },
        {
          id: 'project-documentation-updater',
          name: 'プロジェクトドキュメント更新者',
          model: 'opus',
          path: 'C:\\Users\\kenji\\.claude\\agents\\project-documentation-updater',
          role: 'ドキュメントの不足と不整合の検出',
          category: 'documentation',
          errorTypes: ['missing-docs', 'outdated-docs', 'inconsistent-docs', 'unclear-docs'],
          canAutoFix: true,
          priority: 'low'
        }
      ];
      
      const commentAgent = {
        id: 'code-comment-annotator-ja',
        name: 'コードコメント注釈者（日本語）',
        model: 'sonnet',
        path: 'C:\\Users\\kenji\\.claude\\agents\\code-comment-annotator-ja',
        role: '日本語コメントの追加'
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
        output.warning(`出力ディレクトリの作成に失敗: ${SecurityUtils.sanitizeError(error).message}`);
      }
      
      output.info('🔍 スマートレビューを開始します');
      output.info(`📊 スコープ: ${scope === 'all' ? 'プロジェクト全体' : '変更差分'}`);
      output.info(`📁 対象: ${target}`);
      output.info(`🎯 優先度閾値: ${priorityThreshold}以上`);
      output.info('═'.repeat(70));
      
      // 変更ファイルの検出（セキュア版）
      async function detectChangedFiles() {
        try {
          // 前回のTODOファイルから最終実行時刻を取得
          let lastCheckTime = null;
          if (await files.exists(todoFile)) {
            const todoContent = await files.read(todoFile);
            const timeMatch = todoContent.match(/最終チェック: (.+)/);
            if (timeMatch) {
              lastCheckTime = new Date(timeMatch[1]);
            }
          }
          
          // Git差分を使用して変更ファイルを検出（セキュア版）
          let gitArgs;
          if (lastCheckTime) {
            gitArgs = ['diff', '--name-only', '--since', lastCheckTime.toISOString()];
          } else {
            gitArgs = ['diff', '--name-only', 'HEAD~1'];
          }
          
          const result = await SecurityUtils.executeCommand('git', gitArgs);
          const changedFiles = result.stdout.split('\n').filter(f => f.trim());
          
          output.info(`📝 検出された変更ファイル: ${changedFiles.length}件`);
          changedFiles.slice(0, 5).forEach(f => output.debug(`  - ${f}`));
          if (changedFiles.length > 5) {
            output.debug(`  ... 他 ${changedFiles.length - 5}件`);
          }
          
          return changedFiles;
        } catch (error) {
          output.warning('Git差分の取得に失敗しました。全ファイルを対象にします。');
          return [];
        }
      }
      
      // エージェント実行（セキュア版）
      async function executeAgent(agent, targetFiles, iteration = 1) {
        const startTime = Date.now();
        output.info(`  🤖 ${agent.name} を実行中...`);
        
        try {
          // コマンドの構築（セキュア版）
          const commandArgs = [
            'agent',
            'run',
            agent.id,
            '--model', agent.model,
            '--target', target
          ];
          
          if (scope === 'changes' && targetFiles.length > 0) {
            commandArgs.push('--files', targetFiles.join(','));
          }
          
          if (iteration > 1) {
            commandArgs.push('--iteration', String(iteration));
          }
          
          // Claude コマンド名を動的に検出
          const claudeCmd = await getClaudeCommand();
          const result = await SecurityUtils.executeCommand(claudeCmd, commandArgs, { 
            timeout: 120000  // 2分のタイムアウト
          });
          
          // 結果の解析
          const issues = parseAgentOutput(result.stdout, agent);
          
          const executionTime = Date.now() - startTime;
          output.success(`    ✅ 完了 (${executionTime}ms) - ${issues.length}件の問題を検出`);
          
          return {
            agentId: agent.id,
            agentName: agent.name,
            issues,
            rawOutput: result.stdout,
            executionTime
          };
        } catch (error) {
          const sanitized = SecurityUtils.sanitizeError(error);
          output.error(`    ❌ エラー: ${sanitized.message}`);
          return {
            agentId: agent.id,
            agentName: agent.name,
            issues: [],
            rawOutput: '',
            executionTime: Date.now() - startTime,
            error: sanitized.message
          };
        }
      }
      
      // エージェント出力の解析
      function parseAgentOutput(output, agent) {
        const issues = [];
        
        // パターンベースの解析
        const patterns = {
          error: /(?:ERROR|エラー|🔴):\s*(.+?)(?:\n|$)/gi,
          warning: /(?:WARNING|警告|🟡):\s*(.+?)(?:\n|$)/gi,
          info: /(?:INFO|情報|🔵):\s*(.+?)(?:\n|$)/gi,
          suggestion: /(?:SUGGESTION|提案|💡):\s*(.+?)(?:\n|$)/gi
        };
        
        for (const [level, pattern] of Object.entries(patterns)) {
          let match;
          while ((match = pattern.exec(output)) !== null) {
            const issue = {
              level,
              message: match[1].trim(),
              category: agent.category,
              priority: agent.priority,
              agentId: agent.id,
              autoFixAvailable: agent.canAutoFix
            };
            
            // ファイル情報の抽出
            const fileMatch = issue.message.match(/(?:in|at|ファイル:?)\s*([^\s:]+)(?::(\d+))?/);
            if (fileMatch) {
              issue.file = fileMatch[1];
              issue.line = fileMatch[2] ? parseInt(fileMatch[2]) : null;
            }
            
            // エラータイプの判定
            for (const errorType of agent.errorTypes) {
              if (issue.message.toLowerCase().includes(errorType.replace('-', ' '))) {
                issue.type = errorType;
                break;
              }
            }
            
            issues.push(issue);
          }
        }
        
        return issues;
      }
      
      // TODO内容の生成
      function generateTodoContent(issues, priorityThreshold, previousTodo = '') {
        const priorityLevels = { critical: 0, high: 1, medium: 2, low: 3 };
        const thresholdLevel = priorityLevels[priorityThreshold];
        
        // 優先度でフィルタリング
        const filteredIssues = issues.filter(issue => 
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
        todoContent += `対象: ${target}\n`;
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
            
            todoContent += `${index + 1}. [ ] ${todoItem.title}\n`;
            if (todoItem.file) {
              todoContent += `   - ファイル: ${todoItem.file}`;
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
      
      // HTMLレポートの生成
      function generateHTMLReport(context) {
        const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Smart Review Report - ${new Date().toISOString()}</title>
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
      <div class="issue ${item.priority}">
        <div class="issue-header">
          <div class="issue-title">${item.title}</div>
          <div>
            <span class="badge badge-${item.priority}">${item.priority.toUpperCase()}</span>
            <span class="badge" style="background: #6c757d; color: white;">${item.category}</span>
          </div>
        </div>
        <div class="issue-meta">
          ${item.file ? `📁 ${item.file}${item.line ? `:${item.line}` : ''}` : ''}
          ${item.autoFixAvailable ? '🔧 自動修正可能' : ''}
        </div>
        <div style="margin-top: 10px; color: #555;">${item.description}</div>
      </div>
    `).join('')}
    
    <div class="footer">
      <p>Generated by Smart Review v1.0.0 - ${new Date().toISOString()}</p>
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
            
            // 各エージェントを実行
            for (const agent of reviewAgents) {
              const result = await executeAgent(agent, changedFiles, iteration);
              iterationResult.newIssues.push(...result.issues);
              executionContext.allIssues.push(...result.issues);
            }
            
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
          
          // 全ファイルを対象に
          const allFiles = [];  // ここでは簡略化
          executionContext.changedFiles = allFiles;
          
          // 各エージェントを実行
          for (const agent of reviewAgents) {
            const result = await executeAgent(agent, allFiles, 1);
            executionContext.allIssues.push(...result.issues);
          }
          
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
              '--add-comments'
            ];
            
            // Claude コマンド名を動的に検出
            const claudeCmd = await getClaudeCommand();
            const result = await SecurityUtils.executeCommand(claudeCmd, commentArgs, {
              timeout: 180000  // 3分のタイムアウト
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
        const todoPath = path.join(outputDir, `todo-${timestamp}.md`);
        const reportPath = path.join(outputDir, `report-${timestamp}.html`);
        
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