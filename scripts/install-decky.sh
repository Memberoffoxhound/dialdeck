#!/usr/bin/env bash
# Install Decky plugin with sudo, then put ownership back how Decky left it.

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
  local owner=""

  if [[ ! -e "$hb" && ! -e "$plug" ]]; then
    return 0
  fi

  log "Decky Loader detected at $hb"

  if [[ -d "$plug" ]]; then
    owner=$(stat -c '%u:%g' "$plug" 2>/dev/null || stat -f '%u:%g' "$plug")
  elif [[ -d "$hb" ]]; then
    owner=$(stat -c '%u:%g' "$hb" 2>/dev/null || stat -f '%u:%g' "$hb")
  fi

  if [[ ! -d "$plug" ]]; then
    mkdir -p "$plug" 2>/dev/null || sudo mkdir -p "$plug"
  fi

  log "Installing plugin (sudo may ask for your password)"
  sudo mkdir -p "$dest"
  sudo cp -a "$src/." "$dest/"

  if [[ -n "$owner" ]]; then
    log "Restoring Decky ownership ${owner} on $plug"
    sudo chown -R "$owner" "$dest"
    sudo chown "$owner" "$plug" 2>/dev/null || true
  fi

  log "Plugin files in $dest (owner restored to ${owner:-unchanged})"

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
