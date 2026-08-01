#!/usr/bin/env bash
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

TARGET="${1:-apk}"
case "$TARGET" in
  apk|aab|both) ;;
  *) echo "Usage: $0 [apk|aab|both]" >&2; exit 1 ;;
esac

: "${JAVA_HOME:=/usr/lib/jvm/java-17-openjdk-amd64}"
export JAVA_HOME

VERSION_NAME="${VERSION_NAME:-1.0.0}"
if [ -z "${VERSION_CODE:-}" ]; then
  IFS='.' read -r MAJOR MINOR PATCH <<< "${VERSION_NAME%%-*}"
  VERSION_CODE=$(( MAJOR * 10000 + MINOR * 100 + PATCH ))
  [ "$VERSION_CODE" -gt 0 ] || VERSION_CODE=1
fi
export VERSION_NAME VERSION_CODE

log() { printf '\033[36m==>\033[0m %s\n' "$*"; }

log "Building web app (VITE_BASE=/)"
VITE_BASE=/ npm run build

log "Bundling web build into APK assets"
rm -rf android/app/src/main/assets/www
mkdir -p android/app/src/main/assets/www
cp -r dist/* android/app/src/main/assets/www/
if [ -n "${JELLYFIN_SERVER:-}" ]; then
  sed -i -E "s|serverUrl: '[^']*'|serverUrl: '${JELLYFIN_SERVER}'|" \
    android/app/src/main/assets/www/index.html
  log "Pinned to Jellyfin server ${JELLYFIN_SERVER}"
fi

TASKS=()
if [ "$TARGET" != "aab" ]; then TASKS+=(":app:assembleRelease"); fi
if [ "$TARGET" != "apk" ]; then TASKS+=(":app:bundleRelease"); fi

log "Building ${TASKS[*]} (versionCode=${VERSION_CODE}, versionName=${VERSION_NAME})"
(cd android && ./gradlew "${TASKS[@]}" --no-daemon)

if [ "$TARGET" != "aab" ]; then
  cp android/app/build/outputs/apk/release/app-release.apk "$REPO/aurita-tv.apk"
  log "APK: $REPO/aurita-tv.apk — sideload onto a TV to install."
fi
if [ "$TARGET" != "apk" ]; then
  cp android/app/build/outputs/bundle/release/app-release.aab "$REPO/aurita-tv.aab"
  log "AAB: $REPO/aurita-tv.aab — upload to the Play Console."
fi
