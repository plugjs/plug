#!/bin/bash

ESBUILD="../../../../../node_modules/.bin/esbuild"
ESBUILD_OPTS="--platform=node --sourcemap=inline --sources-content=false"

${ESBUILD} $ESBUILD_OPTS --format=cjs ./sourcemap.ts > sourcemap.cjs
${ESBUILD} $ESBUILD_OPTS --format=esm ./sourcemap.ts > sourcemap.mjs
