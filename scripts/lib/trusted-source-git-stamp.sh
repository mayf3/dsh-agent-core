#!/bin/bash
# Read one Git source stamp without making root trust a user-owned checkout.
# Output is the historical wire shape: <40-hex HEAD><decimal dirty-file count>.
set -euo pipefail

fail() {
  echo "trusted-source-git-stamp: $*" >&2
  exit 2
}

[ "$#" = 1 ] || fail 'usage: trusted-source-git-stamp.sh SOURCE_DIR'
[ -d "$1" ] || fail "source directory unavailable: $1"

SOURCE_DIR="$(cd "$1" && pwd -P)" || fail "cannot resolve source directory: $1"
SOURCE_UID="$(/usr/bin/stat -f '%u' "$SOURCE_DIR")" \
  || fail "cannot determine source owner: $SOURCE_DIR"
CALLER_UID="$(/usr/bin/id -u)"

git_read() {
  if [ "$SOURCE_UID" = "$CALLER_UID" ]; then
    /usr/bin/env -i HOME=/var/empty PATH=/usr/bin:/bin GIT_CONFIG_NOSYSTEM=1 \
      /usr/bin/git -c core.fsmonitor=false -C "$SOURCE_DIR" "$@"
    return
  fi
  if [ "$CALLER_UID" != 0 ]; then
    fail "caller uid $CALLER_UID cannot inspect source owned by uid $SOURCE_UID"
  fi
  # Root delegates the read to the filesystem owner. Git therefore applies its
  # normal ownership check; root never adds a safe.directory exception and any
  # repository-local Git behavior remains confined to the unprivileged owner.
  /usr/bin/sudo -u "#$SOURCE_UID" /usr/bin/env -i \
    HOME=/var/empty PATH=/usr/bin:/bin GIT_CONFIG_NOSYSTEM=1 \
    /usr/bin/git -c core.fsmonitor=false -C "$SOURCE_DIR" "$@"
}

HEAD_SHA="$(git_read rev-parse --verify HEAD)" \
  || fail "cannot resolve Git HEAD as source owner uid $SOURCE_UID: $SOURCE_DIR"
DIRTY_COUNT="$(git_read status --porcelain=v1 | /usr/bin/wc -l | /usr/bin/tr -d ' ')" \
  || fail "cannot read Git status as source owner uid $SOURCE_UID: $SOURCE_DIR"

case "$HEAD_SHA" in
  *[!0-9a-f]*|'') fail "Git HEAD is not a lowercase hex object id: $SOURCE_DIR" ;;
esac
[ "${#HEAD_SHA}" = 40 ] || fail "Git HEAD is not 40 hex characters: $SOURCE_DIR"
case "$DIRTY_COUNT" in
  *[!0-9]*|'') fail "Git dirty count is invalid: $SOURCE_DIR" ;;
esac

printf '%s%s' "$HEAD_SHA" "$DIRTY_COUNT"
