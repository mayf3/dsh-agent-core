#!/bin/bash
# gpg ARM smoke: isolated GNUPGHOME, gen key + clearsign + verify roundtrip.
set -e
GH="$(mktemp -d /tmp/armnorm-gnupg-XXXXXX)"
chmod 700 "$GH"
export GNUPGHOME="$GH"
gpg --batch --pinentry-mode loopback --passphrase '' --quick-gen-key armnorm@test.invalid default default never 2>/dev/null
echo "armnorm gpg smoke $(date)" | gpg --batch --yes --pinentry-mode loopback --passphrase '' \
  --clearsign --local-user armnorm@test.invalid > "$GH/msg.asc" 2>/dev/null
gpg --verify "$GH/msg.asc" > /dev/null 2>&1
rm -rf "$GH"
echo "gpg roundtrip: keygen+sign+verify OK"
