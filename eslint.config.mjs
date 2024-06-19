import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import stylistic from '@stylistic/eslint-plugin'
import unicorn from 'eslint-plugin-unicorn'
import importx from 'eslint-plugin-import-x'

export default [
  js.configs.recommended,

  // ======================================================================== //
  // BASICS, COMMON BETWEEN JAVASCRIPT AND TYPESCRIPT                         //
  // ======================================================================== //

  {
    name: 'plugjs-base',

    languageOptions: {
      globals: globals.es2024,
    },

    rules: {

      // ===== ORIGINALLY FROM GOOGLE'S STYLE GUIDE ========================= //

      'no-tabs': 'error',
      'no-new-object': 'error',

      'camelcase': [ 'error', {
        properties: 'never',

      } ],
      'curly': [ 'error', 'multi-line' ],
      'new-cap': 'error',
      'no-caller': 'error',
      'no-cond-assign': 'off', // overrides eslint recommended
      'no-console': 'warn',
      'no-debugger': 'warn',
      'no-extend-native': 'error',
      'no-extra-bind': 'error',
      'no-multi-str': 'error',
      'no-new-native-nonconstructor': 'error',
      'no-new-wrappers': 'error',
      'no-object-constructor': 'error',
      'no-template-curly-in-string': 'error',
      'no-throw-literal': 'error',
      'no-useless-concat': 'error',
      'no-var': 'error',
      'no-warning-comments': 'warn',
      'one-var': [ 'error', 'never' ],
      'prefer-const': [ 'error', {
        destructuring: 'all',
      } ],
      'prefer-promise-reject-errors': 'error',
      'prefer-rest-params': 'error',
      'prefer-spread': 'error',
    },
  },

  // ======================================================================== //
  // BASICS, COMMON BETWEEN JAVASCRIPT AND TYPESCRIPT                         //
  // ======================================================================== //

  {
    name: 'plugjs-stylistic',

    plugins: {
      '@stylistic': stylistic,
    },

    rules: {
      '@stylistic/array-bracket-newline': 'off',
      '@stylistic/array-bracket-spacing': [ 'error', 'always' ],
      '@stylistic/arrow-parens': [ 'error', 'always' ],
      '@stylistic/block-spacing': [ 'error', 'always' ],
      '@stylistic/brace-style': 'error',
      '@stylistic/comma-dangle': [ 'error', 'always-multiline' ],
      '@stylistic/comma-spacing': 'error',
      '@stylistic/comma-style': 'error',
      '@stylistic/computed-property-spacing': 'error',
      '@stylistic/eol-last': [ 'error', 'always' ],
      '@stylistic/func-call-spacing': 'error',
      '@stylistic/generator-star-spacing': [ 'error', 'after' ],
      '@stylistic/indent': [ 'error', 2, {
        CallExpression: {
          'arguments': 2,
        },
        FunctionDeclaration: {
          'body': 1,
          'parameters': 2,
        },
        FunctionExpression: {
          'body': 1,
          'parameters': 2,
        },
        MemberExpression: 2,
        ObjectExpression: 1,
        SwitchCase: 1,
        ignoredNodes: [
          'ConditionalExpression',
        ],
      } ],
      '@stylistic/key-spacing': 'error',
      '@stylistic/keyword-spacing': 'error',
      '@stylistic/linebreak-style': 'error',
      '@stylistic/no-mixed-spaces-and-tabs': 'error',
      '@stylistic/no-multi-spaces': 'error',
      '@stylistic/no-multiple-empty-lines': [ 'error', { 'max': 2, 'maxBOF': 0, 'maxEOF': 1 } ],
      '@stylistic/no-tabs': 'error',
      '@stylistic/no-trailing-spaces': 'error',
      '@stylistic/object-curly-spacing': [ 'error', 'always' ],
      '@stylistic/operator-linebreak': [ 'error', 'after' ],
      '@stylistic/padded-blocks': [ 'error', 'never' ],
      '@stylistic/quote-props': [ 'error', 'consistent' ],
      '@stylistic/quotes': [ 'error', 'single', { 'allowTemplateLiterals': false } ],
      '@stylistic/semi': [ 'error', 'never' ],
      '@stylistic/semi-spacing': 'error',
      '@stylistic/space-before-blocks': 'error',
      '@stylistic/space-before-function-paren': [ 'error', {
        asyncArrow: 'always',
        anonymous: 'never',
        named: 'never',
      } ],
      '@stylistic/spaced-comment': [ 'error', 'always', { 'markers': [ '/ <reference' ] } ],
      '@stylistic/switch-colon-spacing': 'error',
      '@stylistic/rest-spread-spacing': 'error',
      '@stylistic/yield-star-spacing': [ 'error', 'after' ],
    },
  },

  // ======================================================================== //
  // UNICORN FOR EXTRA NICETIES                                               //
  // ======================================================================== //

  {
    name: 'plugjs-unicorn',

    plugins: {
      'unicorn': unicorn,
    },

    rules: {
      'unicorn/empty-brace-spaces': 'error',
      'unicorn/no-instanceof-array': 'error',
      'unicorn/prefer-node-protocol': 'error',
    },
  },

  // ======================================================================== //
  // IMPORTS                                                                  //
  // ======================================================================== //

  {
    name: 'plugjs-imports',

    plugins: {
      'import-x': importx,
    },

    settings: {
      'import-x/extensions': [ '.ts', '.cts', '.mts', '.js', '.cjs', '.mjs' ],
      'import-x/external-module-folders': [ 'node_modules', 'node_modules/@types' ],
      'import-x/parsers': {
        '@typescript-eslint/parser': [ '.ts', '.cts', '.mts' ],
        'espree': [ '.js', '.mjs', '.cjs' ],
      },
      'import-x/resolver': {
        'typescript': true,
        'node': true,
      },
    },

    rules: {
      'import-x/consistent-type-specifier-style': [ 'error', 'prefer-top-level' ],
      'import-x/no-cycle': [ 'error' ],
      'import-x/no-duplicates': [ 'error' ],
      'import-x/no-extraneous-dependencies': [ 'off' ],
      'import-x/order': [ 'error', {
        'groups': [ 'builtin', 'external', 'internal', [ 'parent', 'sibling' ], 'index', 'object', 'type' ],
        'newlines-between': 'always',
        'warnOnUnassignedImports': true,
      } ],
    },
  },

  // ======================================================================== //
  // JAVASCRIPT SPECIFIC                                                      //
  // ======================================================================== //

  {
    name: 'plugjs-javascript',

    files: [ '*.js', '*.cjs', '*.mjs' ],

    rules: {
      'guard-for-in': 'error',
      'no-array-constructor': 'error',
      'no-invalid-this': 'error',
      'no-unused-expressions': 'error',
      'no-unused-vars': [ 'error', {
        args: 'after-used',
        argsIgnorePattern: '^_',
      } ],
      'strict': [ 'error', 'global' ],
    },
  },

  {
    name: 'plugjs-javascript-cjs',

    files: [ '*.cjs' ],

    languageOptions: {
      sourceType: 'commonjs',
    },
  },

  {
    name: 'plugjs-javascript-esm',

    files: [ '*.mjs' ],

    languageOptions: {
      sourceType: 'module',
    },
  },

  // ======================================================================== //
  // TYPESCRIPT SPECIFIC                                                      //
  // ======================================================================== //

  // Add the typescript plugin and parser
  {
    files: [ '**/*.ts', '**/*.cts', '**/*.mts' ],
    ...tseslint.configs.base,
  },

  // Disable conflicting rules with ESLint
  {
    files: [ '**/*.ts', '**/*.cts', '**/*.mts' ],
    ...tseslint.configs.eslintRecommended,
  },

  // Clone of "typescript-eslint/recommended", but only for typescript
  {
    name: '@typescript-eslint/recommended',

    files: [ '**/*.ts', '**/*.cts', '**/*.mts' ],

    rules: {
      '@typescript-eslint/ban-ts-comment': 'error',
      '@typescript-eslint/ban-types': 'error',
      '@typescript-eslint/no-array-constructor': 'error',
      '@typescript-eslint/no-duplicate-enum-values': 'error',
      '@typescript-eslint/no-empty-object-type': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-extra-non-null-assertion': 'error',
      '@typescript-eslint/no-misused-new': 'error',
      '@typescript-eslint/no-namespace': 'error',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'error',
      '@typescript-eslint/no-require-imports': 'error',
      '@typescript-eslint/no-this-alias': 'error',
      '@typescript-eslint/no-unnecessary-type-constraint': 'error',
      '@typescript-eslint/no-unsafe-declaration-merging': 'error',
      '@typescript-eslint/no-unused-expressions': 'error',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/prefer-as-const': 'error',
      '@typescript-eslint/prefer-namespace-keyword': 'error',
      '@typescript-eslint/triple-slash-reference': 'error',
    },
  },

  // Our own rules overriding "typescript-eslint/recommended"
  {
    name: 'plugjs-typescript',

    files: [ '**/*.ts', '**/*.cts', '**/*.mts' ],

    rules: {
      'no-unused-vars': 'off', // overrides ESLint Recommended for TypeScript
      'no-dupe-class-members': 'off', // overrides ESLint Recommended for TypeScript

      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/explicit-function-return-type': [ 'error', {
        allowExpressions: true,
        allowDirectConstAssertionInArrowFunctions: true,
        allowConciseArrowFunctionExpressionsStartingWithVoid: true,
      } ],
      '@typescript-eslint/no-dupe-class-members': 'error',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-invalid-this': 'error',
      '@typescript-eslint/no-unused-vars': [ 'error', {
        args: 'after-used',
        argsIgnorePattern: '^_',
      } ],

    },
  },

  // ======================================================================== //
  // PLUGJS GENERIC PROJECT                                                   //
  // ======================================================================== //

  {
    name: 'plugjs-project',

    files: [ '**/*.ts', '**/*.cts', '**/*.mts' ],

    languageOptions: {
      parserOptions: {
        createDefaultProgram: false,
        project: [
          './tsconfig.json',
          './test/tsconfig.json',
        ],
      },
    },
  },

  {
    name: 'plugjs-project-src',

    files: [ 'src/**' ],

    rules: {
      // Turn _ON_ dependencies checks only for sources
      'import-x/no-extraneous-dependencies': [ 'error', {
        'devDependencies': true,
        'peerDependencies': true,
        'optionalDependencies': true,
        'bundledDependencies': false,
      } ],
    },
  },

  // ======================================================================== //
  // LOCAL TO THE PROJECT                                                     //
  // ======================================================================== //

  {
    languageOptions: {
      parserOptions: {
        project: [
          './tsconfig.json',
          './test-d/tsconfig.json',
          './workspaces/cov8/tsconfig.json',
          './workspaces/cov8/test/tsconfig.json',
          './workspaces/eslint/tsconfig.json',
          './workspaces/eslint/test/tsconfig.json',
          './workspaces/expect5/tsconfig.json',
          './workspaces/expect5/test/tsconfig.json',
          './workspaces/plug/tsconfig.json',
          './workspaces/plug/test/tsconfig.json',
          './workspaces/tsd/tsconfig.json',
          './workspaces/tsd/test/tsconfig.json',
          './workspaces/typescript/tsconfig.json',
          './workspaces/typescript/test/tsconfig.json',
          './workspaces/zip/tsconfig.json',
          './workspaces/zip/test/tsconfig.json',
        ],
      },
    },
    rules: {
      '@typescript-eslint/triple-slash-reference': 'off',
    },
  },

  {
    name: 'plugjs-project-src',

    files: [ 'workspaces/*/src/**' ],

    rules: {
      // Turn _ON_ dependencies checks only for sources
      'import-x/no-extraneous-dependencies': [ 'error', {
        'devDependencies': true,
        'peerDependencies': true,
        'optionalDependencies': true,
        'bundledDependencies': false,
      } ],
    },
  },
]
