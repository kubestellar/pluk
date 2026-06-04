#!/bin/bash
# One-liner install: curl -fsSL https://raw.githubusercontent.com/kubestellar/pub-sub-tmux/main/install-remote.sh | bash
set -euo pipefail

PREFIX="${1:-/usr/local}"
REPO="https://github.com/kubestellar/pub-sub-tmux.git"
TMPDIR="$(mktemp -d)"

trap "rm -rf $TMPDIR" EXIT

echo "Installing pub-sub-tmux to ${PREFIX}..."
git clone --depth 1 "$REPO" "$TMPDIR/pub-sub-tmux" 2>/dev/null
bash "$TMPDIR/pub-sub-tmux/install.sh" "$PREFIX"
