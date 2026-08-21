#!/usr/bin/env bash
# Copy the QAM plugin. Uses sudo when ~/homebrew/plugins is root-owned.

install_decky_plugin() {
  local hb="$HOME/homebrew"
  local plug="$hb/plugins"
  local dest="$plug/dialdeck"
  local src="${INSTALL_DIR:-$HOME/.local/share/dialdeck}/apps/decky"

  if [[ ! -d "$hb" && ! -d "$plug" ]]; then
    return 0
  fi

  log "Decky Loader detected at $hb"

  if [[ ! -d "$plug" ]]; then
    if ! mkdir -p "$plug" 2>/dev/null; then
      if confirm "Create $plug with sudo?"; then
        sudo mkdir -p "$plug"
      else
        return 1
      fi
    fi
  fi

  if [[ ! -w "$plug" ]]; then
    log "$plug is not writable (often root after a sudo Decky install)"
    if confirm "sudo chown $USER:$USER $plug so Dialdeck can install the plugin?"; then
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
    warn "pnpm not found — QAM stats: cd $dest && pnpm i && pnpm build"
  fi
}
