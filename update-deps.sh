#!/bin/bash -e

# Check for updates, and exit script on error / no updates found
npx '@juit/check-updates' --bump || exit $(( $? == 255 ? 0 : $? ))

# If still here, reinstall dependencies
rm -rf node_modules package-lock.json
npm install --workspaces --include-workspace-root

# Build our package
npm run build
