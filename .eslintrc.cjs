'use strict'

module.exports = {
  root: true,
  extends: [
    'plugin:@plugjs/typescript',
  ],
  parserOptions: {
    project: [
      './tsconfig.json',
      './workspaces/cov8/tsconfig.json',
      './workspaces/cov8/test/tsconfig.json',
      './workspaces/eslint/tsconfig.json',
      './workspaces/eslint/test/tsconfig.json',
      './workspaces/expect5/tsconfig.json',
      './workspaces/expect5/test/tsconfig.json',
      './workspaces/jasmine/tsconfig.json',
      './workspaces/jasmine/test/tsconfig.json',
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
  overrides: [ {
    files: [ 'workspaces/*/test/**', 'workspaces/plug/extra/**' ],
    rules: {
      'import/no-extraneous-dependencies': 'off',
    },
  } ],
}
