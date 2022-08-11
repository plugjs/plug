#!/bin/sh

node \
	--require=./extra/ts-loader.cjs \
	--experimental-loader=./extra/ts-loader.mjs \
	--no-warnings \
		./src/cli.ts
