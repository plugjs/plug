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
      './workspaces/jasmine/tsconfig.json',
      './workspaces/jasmine/test/tsconfig.json',
      './workspaces/mocha/tsconfig.json',
      './workspaces/mocha/test/tsconfig.json',
      './workspaces/plug/tsconfig.json',
      './workspaces/plug/test/tsconfig.json',
      './workspaces/typescript/tsconfig.json',
      './workspaces/typescript/test/tsconfig.json',
    ],
  },
  overrides: [ {
    files: [ 'workspaces/*/test/**', 'workspaces/plug/test/extra' ],
    rules: {
      'import/no-extraneous-dependencies': 'off',
    },
  } ],
}
