'use strict'

module.exports = {
  root: true,
  extends: [
    'plugin:@plugjs/typescript',
  ],
  rules: {
    'import/no-extraneous-dependencies': [ 'error', {
      'devDependencies': [ 'extra/**', 'test/**', 'build.ts' ],
      'peerDependencies': true,
      'optionalDependencies': true,
      'bundledDependencies': false,
    } ],
  },
}
