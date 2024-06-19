import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import stylistic from '@stylistic/eslint-plugin'

export default [
  js.configs.recommended,

  // ======================================================================== //
  // BASIC STYLE, COMMON BETWEEN JAVASCRIPT AND TYPESCRIPT                    //
  // ======================================================================== //

  {
    plugins: {
      '@stylistic': stylistic,
    },
    languageOptions: {
      globals: {
        ...globals.node,
        // Expect5 test globals
        describe: false,
        fdescribe: false,
        xdescribe: false,
        it: false,
        fit: false,
        xit: false,
        afterAll: false,
        afterEach: false,
        beforeAll: false,
        beforeEach: false,
        xafterAll: false,
        xafterEach: false,
        xbeforeAll: false,
        xbeforeEach: false,
        skip: false,
        expect: false,
        log: false,
        dirnameFromUrl: false,
        filenameFromUrl: false,

      },
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

      // ===== STYLISTIC  =================================================== //

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
  // JAVASCRIPT SPECIFIC                                                      //
  // ======================================================================== //

  {
    files: [ '*.js', '*.cjs', '*.mjs' ],
    rules: {
      'guard-for-in': 'error',
      'no-array-constructor': 'error',
      'no-invalid-this': 'error',
      'no-unused-expressions': 'error',
      'no-unused-vars': [ 'error', {
        args: 'none',
      } ],
      'strict': [ 'error', 'global' ],
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
    },
  },

  // ======================================================================== //
  // LOCAL TO THE PROJECT                                                     //
  // ======================================================================== //

  {
    languageOptions: {
      parserOptions: {
        createDefaultProgram: false,
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
]
