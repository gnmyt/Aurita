#!/bin/sh
set -e
if [ -n "${JELLYFIN_SERVER:-}" ]; then
  sed -i -E "s|serverUrl: '[^']*'|serverUrl: '${JELLYFIN_SERVER}'|" /usr/share/nginx/html/tv/index.html
  echo "Aurita: pinned to Jellyfin server ${JELLYFIN_SERVER}"
else
  echo "Aurita: no pinned server — users configure their own in the app"
fi
