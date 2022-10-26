'use strict'

module.exports = {
  root: true,
  extends: [
    'plugin:@plugjs/typescript',
  ],
  parserOptions: {
    project: [
      './tsconfig.json',
      // './test/tsconfig.json',
      // './test-d/tsconfig.json',
    ],
  },
  plugins: [ 'import' ],
  settings: {
    'import/extensions': [ '.ts' ],
    'import/external-module-folders': [ 'node_modules', 'node_modules/@types' ],
    'import/parsers': {
      '@typescript-eslint/parser': [ '.ts' ],
    },
    'import/resolver': {
      'node': {
        'extensions': [ '.ts' ],
      },
    },
  },

  rules: {
    'import/no-cycle': 'error',
    'import/no-duplicates': 'error',
  },
}
