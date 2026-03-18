#!/usr/bin/env bash

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: scripts/eas-local-build.sh <ios|android> [profile]" >&2
  exit 1
fi

PLATFORM="$1"
PROFILE="${2:-production}"
TMP_DIR="$(mktemp -d)"
SANITIZED_ENV="$TMP_DIR/.env.local-build"

if [ ! -f ".env" ]; then
  echo "Missing .env in project root. Local EAS builds need it loaded before app.config.js runs." >&2
  exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required to run local EAS builds." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node is required to run local EAS builds." >&2
  exit 1
fi

tr -d '\r' < ./.env > "$SANITIZED_ENV"

set -a
. "$SANITIZED_ENV"
set +a

export NODE_ENV="${NODE_ENV:-production}"
export EAS_LOCAL_BUILD_PROFILE="$PROFILE"

ORIGINAL_EAS_JSON="$TMP_DIR/eas.json.original"
cp ./eas.json "$ORIGINAL_EAS_JSON"

restore_eas_json() {
  if [ -f "$ORIGINAL_EAS_JSON" ]; then
    cp "$ORIGINAL_EAS_JSON" ./eas.json
  fi
  rm -rf "$TMP_DIR"
}

trap restore_eas_json EXIT

node <<'EOF'
const fs = require('fs');

const requiredVars = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'DAILY_API_KEY',
  'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY',
  'EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY',
];

for (const key of requiredVars) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable in local shell: ${key}`);
    process.exit(1);
  }
}

const profile = process.env.EAS_LOCAL_BUILD_PROFILE;
const eas = JSON.parse(fs.readFileSync('./eas.json', 'utf8'));
const buildProfile = eas.build?.[profile];

if (!buildProfile) {
  console.error(`Unknown EAS build profile: ${profile}`);
  process.exit(1);
}

buildProfile.env = {
  ...(buildProfile.env ?? {}),
  NODE_ENV: process.env.NODE_ENV || 'production',
};

for (const key of requiredVars) {
  buildProfile.env[key] = process.env[key];
}

fs.writeFileSync('./eas.json', `${JSON.stringify(eas, null, 2)}\n`);
EOF

npx eas build --local --platform "$PLATFORM" --profile "$PROFILE"
