#!/bin/bash

ESBUILD_OPTS="--platform=node --sourcemap=inline --sources-content=false --minify-whitespace=true"

esbuild $ESBUILD_OPTS --format=cjs ./sourcemap.ts > sourcemap.cjs
esbuild $ESBUILD_OPTS --format=esm ./sourcemap.ts > sourcemap.mjs
