#!/bin/sh

# Relative to our build
pushd "$(dirname $0)" > /dev/null

# Compile our "ts-loader" loader and CLI
exec ./node_modules/.bin/esbuild \
	--platform=node \
	--format=esm \
	--target=node16 \
	--outdir=./extra \
	--sourcemap=inline \
	--sources-content=false \
	--out-extension:.js=.mjs \
		./extra/*.mts
