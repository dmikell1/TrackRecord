#!/usr/bin/env bash

if [ ! -f .env ]; then
	echo "❌ ERROR: .env file not found!"
	exit 1
fi

PACKAGE_NAME='concurrently'

if [[ "$(npm list -g $PACKAGE_NAME)" =~ "empty" ]]; then
	echo "⚡️ Installing $PACKAGE_NAME ..."

	npm install -g $PACKAGE_NAME
fi

build() {
	printf "\n🔨 Building...\n"

	npm run build
}

start() {
	printf "🚀 Starting...\n\n"

	concurrently -k -n "core,grpc,wrks" -c "green,magenta,cyan," \
		"npm run start:api-core"
}

source .env
build
start
