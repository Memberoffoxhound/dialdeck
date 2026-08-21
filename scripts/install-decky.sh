#!/usr/bin/env bash
# Copy the QAM plugin. Uses sudo when ~/homebrew/plugins is root-owned.

if ! declare -f log >/dev/null; then
  log() { printf "\n\033[1;32m==>\033[0m %s\n" "$*"; }
  warn() { printf "\033[1;33m!!\033[0m %s\n" "$*"; }
  need_cmd() { command -v "$1" >/dev/null 2>&1; }
  TTY="${TTY:-/dev/tty}"
  confirm() {
    local a=
    printf "%s [y/N] " "$1" >"$TTY"
    read -r a <"$TTY" || return 1
    [[ "$a" =~ ^[yY]$ ]]
  }
fi

install_decky_plugin() {
  local hb="$HOME/homebrew"
  local plug="$hb/plugins"
  local dest="$plug/dialdeck"
  local src="${INSTALL_DIR:-$HOME/.local/share/dialdeck}/apps/decky"

  if [[ ! -d "$hb" && ! -d "$plug" ]]; then
    warn "No Decky homebrew dir at $hb"
    return 0
  fi

  log "Decky Loader detected at $hb"

  if [[ ! -d "$plug" ]]; then
    if ! mkdir -p "$plug" 2>/dev/null; then
      log "Create $plug with sudo"
      sudo mkdir -p "$plug"
    fi
  fi

  if [[ ! -w "$plug" ]]; then
    log "$plug is not writable — fixing owner with sudo"
    if confirm "sudo chown $USER:$USER $plug ?"; then
      sudo chown -R "$USER:$USER" "$plug" || sudo chown -R "$USER:$USER" "$hb"
    else
      warn "Skipped Decky plugin. PWA still works on the LAN."
      return 1
    fi
  fi

  mkdir -p "$dest"
  cp -a "$src/." "$dest/"
  log "Plugin files copied to $dest"

  if need_cmd pnpm; then
    (cd "$dest" && pnpm i && pnpm build) || warn "plugin build failed; QAM UI needs dist/"
  else
    warn "pnpm not found — QAM stats later: cd $dest && pnpm i && pnpm build"
  fi
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  INSTALL_DIR="${DIALDECK_HOME:-$HOME/.local/share/dialdeck}"
  install_decky_plugin
fi
