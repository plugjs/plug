#!/bin/bash

set -e

npx '@juit/check-updates@latest' \
	package.json workspaces/*/package.json \
	|| exit $(( $? == 255 ? 0 : $? ))

# If still here, bump the version and reinstall dependencies
npm version patch --no-git-tag
rm -rf node_modules/ package-lock.json
npm install --workspaces --include-workspace-root

# Bump all packages versions
npm run build exports
