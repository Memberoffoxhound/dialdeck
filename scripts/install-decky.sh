#!/usr/bin/env bash
# Install Decky plugin. sudo is used automatically when the dir is not writable.
# Password prompt from sudo is the permission ask.

if ! declare -f log >/dev/null; then
  log() { printf "\n\033[1;32m==>\033[0m %s\n" "$*"; }
  warn() { printf "\033[1;33m!!\033[0m %s\n" "$*"; }
  need_cmd() { command -v "$1" >/dev/null 2>&1; }
fi

install_decky_plugin() {
  local hb="$HOME/homebrew"
  local plug="$hb/plugins"
  local dest="$plug/dialdeck"
  local src="${INSTALL_DIR:-$HOME/.local/share/dialdeck}/apps/decky"

  if [[ ! -e "$hb" && ! -e "$plug" ]]; then
    return 0
  fi

  log "Decky Loader detected at $hb"

  if [[ ! -d "$plug" ]]; then
    mkdir -p "$plug" 2>/dev/null || sudo mkdir -p "$plug"
  fi

  if [[ ! -w "$plug" ]]; then
    log "Fixing ownership of $plug (sudo will ask for your password)"
    sudo chown -R "$USER:$USER" "$plug" || sudo chown -R "$USER:$USER" "$hb"
  fi

  if [[ ! -w "$plug" ]]; then
    log "Still not writable — copying with sudo"
    sudo mkdir -p "$dest"
    sudo cp -a "$src/." "$dest/"
    sudo chown -R "$USER:$USER" "$dest" || true
  else
    mkdir -p "$dest"
    cp -a "$src/." "$dest/"
  fi

  log "Plugin files in $dest"

  if need_cmd pnpm && [[ -w "$dest" ]]; then
    (cd "$dest" && pnpm i && pnpm build) || warn "plugin build failed"
  elif ! need_cmd pnpm; then
    warn "pnpm not found — QAM UI later: cd $dest && pnpm i && pnpm build"
  fi
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  set +e
  INSTALL_DIR="${DIALDECK_HOME:-$HOME/.local/share/dialdeck}"
  install_decky_plugin
fi
