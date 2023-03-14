#!/bin/sh

# Relative to our build
cd "$(dirname $0)"

# Remove whatever was bootstrapped
rm -rf ./bootstrap

# Compile our "ts-loader" loader and CLI
exec ./node_modules/.bin/esbuild \
	--platform=node \
	--format=esm \
	--target=node18 \
	--outdir=./bootstrap \
	--sourcemap=inline \
	--sources-content=false \
	--out-extension:.js=.mjs \
	--external:esbuild \
	--bundle \
		./workspaces/plug/extra/*.mts

# We don't need to run the compilation step, as "build.ts" imports from
# "./src" and therefore even the files needed for the compilation of the
# build system itself will be dynamically compiled by our loader...
