#!/bin/bash

ESBUILD_OPTS="--platform=node --sourcemap=inline --sources-content=false"

esbuild $ESBUILD_OPTS --banner:js='/* eslint-disable */' --format=cjs ./sourcemap.ts > sourcemap.cjs
esbuild $ESBUILD_OPTS --banner:js='/* eslint-disable */' --format=esm ./sourcemap.ts > sourcemap.mjs
