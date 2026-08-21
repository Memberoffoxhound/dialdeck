#!/usr/bin/env bash
# Install Decky plugin with sudo, then restore ownership.
# If pnpm is missing, build the QAM UI in a Node container.

if ! declare -f log >/dev/null; then
  log() { printf "\n\033[1;32m==>\033[0m %s\n" "$*"; }
  warn() { printf "\033[1;33m!!\033[0m %s\n" "$*"; }
  need_cmd() { command -v "$1" >/dev/null 2>&1; }
fi

build_decky_ui() {
  local dest="$1"
  if [[ -f "$dest/dist/index.js" ]]; then
    log "QAM bundle already present"
    return 0
  fi

  if need_cmd pnpm; then
    (cd "$dest" && pnpm i && pnpm build) && return 0
  fi

  local runner=""
  if need_cmd podman; then runner=podman
  elif need_cmd docker; then runner=docker
  fi
  if [[ -z "$runner" ]]; then
    warn "No pnpm/node and no container engine — QAM UI skipped. PWA still works."
    return 1
  fi

  log "Building QAM UI with $runner node:22-alpine (no host pnpm needed)"
  sudo chmod -R u+w "$dest" 2>/dev/null || true
  "$runner" run --rm \
    -v "$dest:/app:z" \
    -w /app \
    docker.io/library/node:22-alpine \
    sh -c "npm install --no-audit --no-fund && npm run build"
}

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

  build_decky_ui "$dest" || true

  if [[ -n "$owner" ]]; then
    log "Restoring Decky ownership ${owner} on $dest"
    sudo chown -R "$owner" "$dest"
    sudo chown "$owner" "$plug" 2>/dev/null || true
  fi

  log "Plugin files in $dest"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  set +e
  INSTALL_DIR="${DIALDECK_HOME:-$HOME/.local/share/dialdeck}"
  install_decky_plugin
fi
