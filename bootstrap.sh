#!/bin/sh

# Relative to our build
pushd "$(dirname $0)"

# Compile our "ts-loader" loader
./node_modules/.bin/esbuild \
	--platform=node \
	--format=esm \
	--target=node16 \
	--outfile=./extra/ts-loader.mjs \
	--sourcemap=linked \
	--sources-content=false \
		./extra/ts-loader.mts || {
			echo "Error compiling loader"
			exit 1
		}


# Bootstrap with our loader
node \
	--experimental-loader=./extra/ts-loader.mjs \
	--no-warnings \
		./src/cli.ts "${@}"
exit $?
