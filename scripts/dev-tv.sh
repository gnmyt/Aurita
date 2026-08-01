#!/usr/bin/env bash
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

AVD_NAME="${AVD_NAME:-aurita-tv}"
ANDROID_API="${ANDROID_API:-34}"
PORT="${PORT:-5173}"
CMDLINE_TOOLS_VERSION="13114758"

SDK="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$HOME/Android/Sdk}}"
export ANDROID_SDK_ROOT="$SDK"
export ANDROID_HOME="$SDK"

log() { printf '\033[36m==>\033[0m %s\n' "$*"; }
die() { printf '\033[31mError:\033[0m %s\n' "$*" >&2; exit 1; }

ensure_java() {
  if [ -z "${JAVA_HOME:-}" ]; then
    for candidate in /usr/lib/jvm/java-17-openjdk-amd64 /usr/lib/jvm/java-17-openjdk; do
      [ -d "$candidate" ] && export JAVA_HOME="$candidate" && break
    done
  fi
  command -v java >/dev/null 2>&1 || [ -x "${JAVA_HOME:-}/bin/java" ] \
    || die "no JDK found — install OpenJDK 17 or set JAVA_HOME"
}

ensure_cmdline_tools() {
  SDKMANAGER="$SDK/cmdline-tools/latest/bin/sdkmanager"
  [ -x "$SDKMANAGER" ] && return

  log "Installing Android command-line tools into $SDK"
  command -v curl >/dev/null || die "curl is required to bootstrap the Android SDK"
  command -v unzip >/dev/null || die "unzip is required to bootstrap the Android SDK"

  local tmp
  tmp="$(mktemp -d)"
  curl -fsSL -o "$tmp/tools.zip" \
    "https://dl.google.com/android/repository/commandlinetools-linux-${CMDLINE_TOOLS_VERSION}_latest.zip"
  mkdir -p "$SDK/cmdline-tools"
  unzip -q "$tmp/tools.zip" -d "$tmp"
  rm -rf "$SDK/cmdline-tools/latest"
  mv "$tmp/cmdline-tools" "$SDK/cmdline-tools/latest"
  rm -rf "$tmp"
  [ -x "$SDKMANAGER" ] || die "command-line tools install failed"
}

resolve_system_image() {
  if [ -n "${ANDROID_ABI:-}" ]; then
    SYSTEM_IMAGE="system-images;android-${ANDROID_API};android-tv;${ANDROID_ABI}"
    return
  fi

  local candidates
  case "$(uname -m)" in
    aarch64|arm64) candidates="arm64-v8a" ;;
    *)             candidates="x86_64 x86" ;;
  esac

  local available
  available="$("$SDKMANAGER" --list 2>/dev/null || true)"
  for abi in $candidates; do
    if grep -q "system-images;android-${ANDROID_API};android-tv;${abi}\b" <<< "$available"; then
      SYSTEM_IMAGE="system-images;android-${ANDROID_API};android-tv;${abi}"
      log "Using system image ${SYSTEM_IMAGE}"
      return
    fi
  done
  die "no Android TV system image for API ${ANDROID_API} on $(uname -m) — set ANDROID_API or ANDROID_ABI"
}

ensure_packages() {
  log "Ensuring SDK packages (API ${ANDROID_API})"
  yes | "$SDKMANAGER" --licenses >/dev/null 2>&1 || true
  "$SDKMANAGER" --install \
    "platform-tools" \
    "emulator" \
    "platforms;android-${ANDROID_API}" \
    "build-tools;${ANDROID_API}.0.0" \
    "$SYSTEM_IMAGE" >/dev/null

  ADB="$SDK/platform-tools/adb"
  EMULATOR="$SDK/emulator/emulator"
  AVDMANAGER="$SDK/cmdline-tools/latest/bin/avdmanager"
}

ensure_avd() {
  if "$AVDMANAGER" list avd 2>/dev/null | grep -q "Name: ${AVD_NAME}$"; then
    return
  fi
  log "Creating AVD '${AVD_NAME}'"
  echo no | "$AVDMANAGER" create avd \
    --name "$AVD_NAME" \
    --package "$SYSTEM_IMAGE" \
    --device "tv_1080p" >/dev/null
}

booted_device() {
  "$ADB" devices | awk '$2 == "device" { print $1; exit }'
}

ensure_emulator() {
  DEVICE="$(booted_device || true)"
  if [ -n "${DEVICE:-}" ]; then
    log "Using already-connected device ${DEVICE}"
    return
  fi

  log "Starting emulator '${AVD_NAME}'"
  "$EMULATOR" -avd "$AVD_NAME" -netdelay none -netspeed full -gpu auto \
    >/tmp/aurita-emulator.log 2>&1 &
  EMULATOR_PID=$!

  "$ADB" wait-for-device
  log "Waiting for boot to complete"
  local waited=0
  until [ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do
    kill -0 "$EMULATOR_PID" 2>/dev/null || die "emulator died — see /tmp/aurita-emulator.log"
    sleep 2
    waited=$((waited + 2))
    [ "$waited" -lt 300 ] || die "emulator did not boot within 5 minutes"
  done
  DEVICE="$(booted_device)"
}

cleanup() {
  [ -n "${VITE_PID:-}" ] && kill "$VITE_PID" 2>/dev/null || true
  [ -n "${LOGCAT_PID:-}" ] && kill "$LOGCAT_PID" 2>/dev/null || true
}

ensure_java
ensure_cmdline_tools
resolve_system_image
ensure_packages
ensure_avd
ensure_emulator

trap cleanup EXIT INT TERM

log "Starting Vite dev server on port ${PORT}"
npm run dev -- --host 0.0.0.0 --port "$PORT" --strictPort &
VITE_PID=$!

if [[ "$DEVICE" == emulator-* ]]; then
  DEV_SERVER_URL="http://10.0.2.2:${PORT}"
else
  "$ADB" -s "$DEVICE" reverse "tcp:${PORT}" "tcp:${PORT}" >/dev/null
  DEV_SERVER_URL="http://localhost:${PORT}"
fi
export DEV_SERVER_URL

for _ in $(seq 1 30); do
  curl -fsS "http://localhost:${PORT}" >/dev/null 2>&1 && break
  kill -0 "$VITE_PID" 2>/dev/null || die "vite exited"
  sleep 1
done

log "Installing debug build pointed at ${DEV_SERVER_URL}"
(cd android && ./gradlew :app:installDebug --no-daemon -q)

"$ADB" -s "$DEVICE" shell am start -n dev.gnm.aurita/.MainActivity >/dev/null

log "Running. Edit files in src/ and the TV reloads. Ctrl-C to stop."
"$ADB" -s "$DEVICE" logcat -s AuritaWeb:I &
LOGCAT_PID=$!

wait "$VITE_PID"
