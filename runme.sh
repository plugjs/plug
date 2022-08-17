#!/bin/sh

# Exit on error
set -e

# Relative to our build
pushd "$(dirname $0)" > /dev/null

# Compile our "ts-loader" loader and CLI
./bootstrap.sh

# Initialize and wipe our coverage directory
export NODE_V8_COVERAGE="${PWD}/.coverage-data"
rm -rf "${NODE_V8_COVERAGE}"

# Run build twice to generate full coverage
node ./extra/cli.mjs --force-esm default
node ./extra/cli.mjs --force-esm coverage
