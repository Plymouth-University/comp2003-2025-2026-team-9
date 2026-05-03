#!/usr/bin/env bash

set -euo pipefail

if [ ! -d "./android" ]; then
  exit 0
fi

resolve_android_sdk_dir() {
  if [ -n "${ANDROID_HOME:-}" ] && [ -d "${ANDROID_HOME}" ]; then
    printf '%s\n' "$ANDROID_HOME"
    return 0
  fi

  if [ -n "${ANDROID_SDK_ROOT:-}" ] && [ -d "${ANDROID_SDK_ROOT}" ]; then
    printf '%s\n' "$ANDROID_SDK_ROOT"
    return 0
  fi

  local default_sdk="$HOME/Library/Android/sdk"
  if [ -d "$default_sdk" ]; then
    printf '%s\n' "$default_sdk"
    return 0
  fi

  return 1
}

if ! ANDROID_SDK_DIR="$(resolve_android_sdk_dir)"; then
  echo "Skipping android/local.properties generation because no Android SDK directory was found."
  exit 0
fi

printf 'sdk.dir=%s\n' "$ANDROID_SDK_DIR" > ./android/local.properties
echo "Wrote android/local.properties for EAS build."
