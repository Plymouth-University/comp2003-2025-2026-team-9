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
export EAS_LOCAL_BUILD_PLATFORM="$PLATFORM"

if [ "$PLATFORM" = "ios" ]; then
  export EAS_LOCAL_BUILD_SKIP_CLEANUP="${EAS_LOCAL_BUILD_SKIP_CLEANUP:-1}"
  export EAS_VERBOSE="${EAS_VERBOSE:-1}"
fi

if [ "$PLATFORM" = "android" ]; then
  resolve_android_sdk_dir() {
    if [ -n "${ANDROID_HOME:-}" ] && [ -d "${ANDROID_HOME}" ]; then
      printf '%s\n' "$ANDROID_HOME"
      return 0
    fi

    if [ -n "${ANDROID_SDK_ROOT:-}" ] && [ -d "${ANDROID_SDK_ROOT}" ]; then
      printf '%s\n' "$ANDROID_SDK_ROOT"
      return 0
    fi

    if [ -f "./android/local.properties" ]; then
      local sdk_dir
      sdk_dir="$(sed -n 's/^sdk\.dir=//p' ./android/local.properties | tail -n 1)"
      sdk_dir="${sdk_dir//\\:/:}"
      sdk_dir="${sdk_dir//\\\\/\\}"
      if [ -n "$sdk_dir" ] && [ -d "$sdk_dir" ]; then
        printf '%s\n' "$sdk_dir"
        return 0
      fi
    fi

    local default_sdk="$HOME/Library/Android/sdk"
    if [ -d "$default_sdk" ]; then
      printf '%s\n' "$default_sdk"
      return 0
    fi

    return 1
  }

  if ! ANDROID_SDK_DIR="$(resolve_android_sdk_dir)"; then
    echo "Android SDK not found. Set ANDROID_HOME or ANDROID_SDK_ROOT, or update ./android/local.properties with a valid sdk.dir." >&2
    exit 1
  fi

  export ANDROID_HOME="$ANDROID_SDK_DIR"
  export ANDROID_SDK_ROOT="$ANDROID_SDK_DIR"
fi

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
const platform = process.env.EAS_LOCAL_BUILD_PLATFORM;
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

if (platform === 'android') {
  const androidSdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (!androidSdk) {
    console.error('Missing Android SDK path for local Android build.');
    process.exit(1);
  }

  buildProfile.env.ANDROID_HOME = androidSdk;
  buildProfile.env.ANDROID_SDK_ROOT = androidSdk;
}

fs.writeFileSync('./eas.json', `${JSON.stringify(eas, null, 2)}\n`);
EOF

if [ "${EAS_LOCAL_BUILD_SKIP_CLEANUP:-0}" = "1" ]; then
  echo "EAS local build cleanup disabled. The temporary build workspace will be printed by EAS if the build fails."
fi

if [ "${EAS_VERBOSE:-0}" = "1" ]; then
  echo "EAS verbose logging enabled."
fi

echo "Running local EAS build for platform=$PLATFORM profile=$PROFILE"

npx eas build --local --platform "$PLATFORM" --profile "$PROFILE"
