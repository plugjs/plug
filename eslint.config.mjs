import configurations from '@plugjs/eslint-plugin'

export default [
  ...configurations,

  // ===== ALL OUR TSCONFIG.JSON FILES FOR ALL WORKSPACES ======================
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
  },

  // ===== MAKE SURE WE DECLARE OUR DEPENDENCIES IN WORKSPACES =================
  {
    files: [ 'workspaces/*/src/**' ],
    rules: {
      'import-x/no-extraneous-dependencies': [ 'error', {
        'devDependencies': true,
        'peerDependencies': true,
        'optionalDependencies': true,
        'bundledDependencies': false,
      } ],
    },
  },
]
