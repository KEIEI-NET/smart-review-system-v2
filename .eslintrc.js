module.exports = {
  env: {
    node: true,
    es2021: true,
    commonjs: true
  },
  extends: [
    'standard',
    'plugin:security/recommended'
  ],
  plugins: [
    'security'
  ],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'script'
  },
  rules: {
    // セキュリティ関連ルール（厳格）
    'security/detect-object-injection': 'error',
    'security/detect-non-literal-fs-filename': 'warn',
    'security/detect-child-process': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-buffer-noassert': 'error',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-pseudoRandomBytes': 'error',
    'security/detect-possible-timing-attacks': 'warn',
    'security/detect-unsafe-regex': 'error',
    'security/detect-bidi-characters': 'error',
    
    // コード品質ルール
    'no-console': 'off', // CLI ツールなのでconsoleは許可
    'no-process-exit': 'off', // CLI ツールなので process.exit は許可
    'no-sync': 'off', // 一部の同期処理は必要
    
    // セキュリティ強化ルール
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    
    // 潜在的なセキュリティホール
    'no-buffer-constructor': 'error',
    'no-path-concat': 'error',
    
    // コード品質
    'complexity': ['warn', 15],
    'max-depth': ['warn', 4],
    'max-nested-callbacks': ['warn', 4],
    'max-params': ['warn', 5],
    
    // ES2021 features
    'prefer-const': 'error',
    'no-var': 'error',
    'prefer-arrow-callback': 'warn'
  },
  overrides: [
    {
      files: ['test/**/*.js', '**/*.test.js'],
      env: {
        mocha: true,
        jest: true
      },
      rules: {
        // テストファイルでは一部のルールを緩和
        'security/detect-non-literal-fs-filename': 'off',
        'no-unused-expressions': 'off'
      }
    },
    {
      files: ['*.config.js', '*.conf.js'],
      rules: {
        // 設定ファイルでは一部のルールを緩和
        'security/detect-object-injection': 'warn'
      }
    }
  ],
  globals: {
    // グローバル変数がある場合はここに定義
  }
}