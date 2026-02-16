#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

ARTIFACTS_DIR="$ROOT_DIR/installer/builds"

get_app_version() {
  local version
  version="$(grep -oE '"version"[[:space:]]*:[[:space:]]*"[^"]+"' src-tauri/tauri.conf.json | head -n1 | sed -E 's/.*"([^"]+)"$/\1/')"
  if [ -z "$version" ]; then
    version="0.0.0"
  fi
  echo "$version"
}

sync_icons() {
  echo "Syncing app icons from assets..."

  if [ -f "$ROOT_DIR/assets/icon.ico" ]; then
    cp -f "$ROOT_DIR/assets/icon.ico" "$ROOT_DIR/src-tauri/icons/icon.ico"
  else
    echo "Warning: assets/icon.ico not found; keeping existing src-tauri/icons/icon.ico"
  fi

  if [ -f "$ROOT_DIR/assets/icon.png" ]; then
    cp -f "$ROOT_DIR/assets/icon.png" "$ROOT_DIR/src-tauri/icons/icon.png"
    cp -f "$ROOT_DIR/assets/icon.png" "$ROOT_DIR/src-tauri/icons/128x128.png"
    cp -f "$ROOT_DIR/assets/icon.png" "$ROOT_DIR/src-tauri/icons/128x128@2x.png"
    cp -f "$ROOT_DIR/assets/icon.png" "$ROOT_DIR/src-tauri/icons/64x64.png"
    cp -f "$ROOT_DIR/assets/icon.png" "$ROOT_DIR/src-tauri/icons/32x32.png"
  else
    echo "Warning: assets/icon.png not found; keeping existing src-tauri/icons/*"
  fi
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

resolve_steam_linux_so() {
  local so_path

  if [ -n "${STEAMWORKS_SO_PATH:-}" ] && [ -f "${STEAMWORKS_SO_PATH:-}" ]; then
    echo "$STEAMWORKS_SO_PATH"
    return 0
  fi

  so_path="$(ls -d "$ROOT_DIR"/src-tauri/target/release/build/steamworks-sys-*/out/libsteam_api.so 2>/dev/null | sort -V | tail -n1 || true)"
  if [ -n "$so_path" ] && [ -f "$so_path" ]; then
    echo "$so_path"
    return 0
  fi

  so_path="$(ls -d "$HOME"/.cargo/registry/src/*/steamworks-sys-*/lib/steam/redistributable_bin/linux64/libsteam_api.so 2>/dev/null | sort -V | tail -n1 || true)"
  if [ -n "$so_path" ] && [ -f "$so_path" ]; then
    echo "$so_path"
    return 0
  fi

  return 1
}

patch_deb_with_steam_so() {
  local deb_file="$1"
  local steam_so="$2"
  local tmpdir
  local patched_deb

  if ! command -v dpkg-deb >/dev/null 2>&1; then
    echo "Warning: dpkg-deb not found; could not inject libsteam_api.so into .deb package."
    return 0
  fi

  tmpdir="$(mktemp -d)"
  patched_deb="${deb_file%.deb}_with_steam.deb"

  dpkg-deb -R "$deb_file" "$tmpdir"
  install -Dm755 "$steam_so" "$tmpdir/usr/bin/libsteam_api.so"
  dpkg-deb -b "$tmpdir" "$patched_deb" >/dev/null
  mv -f "$patched_deb" "$deb_file"
  rm -rf "$tmpdir"

  echo "Injected libsteam_api.so into .deb package."
}

build_rpm_with_steam_so() {
  local app_version="$1"
  local release_dir="$2"
  local icon_source="$3"
  local rpmbuild_root
  local spec_file
  local rpm_output

  if ! command -v rpmbuild >/dev/null 2>&1; then
    echo "Warning: rpmbuild not found; cannot generate patched RPM with libsteam_api.so." >&2
    return 1
  fi

  if [ ! -f "$release_dir/project-ham" ] || [ ! -f "$release_dir/libsteam_api.so" ]; then
    echo "Warning: required files for RPM patch not found (project-ham/libsteam_api.so)." >&2
    return 1
  fi

  rpmbuild_root="$(mktemp -d)"
  mkdir -p "$rpmbuild_root"/{BUILD,BUILDROOT,RPMS,SOURCES,SPECS,SRPMS}

  install -Dm755 "$release_dir/project-ham" "$rpmbuild_root/SOURCES/project-ham"
  install -Dm755 "$release_dir/libsteam_api.so" "$rpmbuild_root/SOURCES/libsteam_api.so"

  if [ -f "$icon_source" ]; then
    install -Dm644 "$icon_source" "$rpmbuild_root/SOURCES/project-ham.png"
  fi

  cat > "$rpmbuild_root/SOURCES/project-ham.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=Project HAM
Comment=Manage Hydra and Steam achievements
Exec=/usr/bin/project-ham
Icon=project-ham
Terminal=false
Categories=Utility;
EOF

  spec_file="$rpmbuild_root/SPECS/project-ham.spec"
  cat > "$spec_file" <<EOF
Name:           project-ham
Version:        $app_version
Release:        1%{?dist}
Summary:        Project HAM desktop application for Hydra and Steam achievements
License:        GPL-3.0
URL:            https://github.com/TheProjectHAM/hydra-achievement-manager
BuildArch:      x86_64
Source0:        project-ham
Source1:        libsteam_api.so
Source2:        project-ham.desktop
Source3:        project-ham.png

%description
Project HAM desktop application for Hydra and Steam achievements.

%install
install -Dm755 %{SOURCE0} %{buildroot}/usr/bin/project-ham
install -Dm755 %{SOURCE1} %{buildroot}/usr/bin/libsteam_api.so
install -Dm644 %{SOURCE2} %{buildroot}/usr/share/applications/project-ham.desktop
if [ -f %{SOURCE3} ]; then
  install -Dm644 %{SOURCE3} %{buildroot}/usr/share/pixmaps/project-ham.png
fi

%files
/usr/bin/project-ham
/usr/bin/libsteam_api.so
/usr/share/applications/project-ham.desktop
%attr(0644,root,root) /usr/share/pixmaps/project-ham.png

%changelog
* $(LC_ALL=C date +"%a %b %d %Y") Project HAM Build Script <build@projectham.local> - $app_version-1
- Bundle project-ham with libsteam_api.so
EOF

  rpmbuild -bb --define "_topdir $rpmbuild_root" --define "_build_id_links none" "$spec_file" >/dev/null

  rpm_output="$(find "$rpmbuild_root/RPMS" -type f -name "*.rpm" | sort | tail -n1 || true)"
  if [ -z "$rpm_output" ] || [ ! -f "$rpm_output" ]; then
    rm -rf "$rpmbuild_root"
    return 1
  fi

  echo "$rpm_output"
}

run_windows() {
  local app_version
  local win_release_dir
  local win_exe_path
  local win_dll_path
  local nsis_out_dir
  local nsis_script
  local icon_path
  local installer_path
  local steam_dll_source

  echo "Starting Windows build process for Project HAM..."

  if ! command -v cargo-xwin >/dev/null 2>&1; then
    echo "cargo-xwin not found. Installing..."
    cargo install cargo-xwin
  fi

  if ! rustup target list --installed | grep -q "x86_64-pc-windows-msvc"; then
    echo "Windows target not found. Adding..."
    rustup target add x86_64-pc-windows-msvc
  fi

  echo "Building frontend with yarn..."
  yarn build

  sync_icons

  echo "Compiling Tauri app for Windows (x86_64)..."
  yarn tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc

  win_release_dir="$ROOT_DIR/src-tauri/target/x86_64-pc-windows-msvc/release"
  win_exe_path="$win_release_dir/project-ham.exe"
  win_dll_path="$win_release_dir/steam_api64.dll"
  nsis_out_dir="$win_release_dir/bundle/nsis"
  nsis_script="$ROOT_DIR/installer/windows/project-ham.nsi"
  icon_path="$ROOT_DIR/assets/icon.ico"

  steam_dll_source=""
  if [ -n "${STEAMWORKS_DLL_PATH:-}" ] && [ -f "${STEAMWORKS_DLL_PATH:-}" ]; then
    steam_dll_source="$STEAMWORKS_DLL_PATH"
  else
    steam_dll_source="$(ls -d "$HOME"/.cargo/registry/src/*/steamworks-sys-*/lib/steam/redistributable_bin/win64/steam_api64.dll 2>/dev/null | sort -V | tail -n 1 || true)"
  fi

  if [ -n "$steam_dll_source" ] && [ -f "$steam_dll_source" ]; then
    cp -f "$steam_dll_source" "$win_dll_path"
    echo "Using Steam DLL from: $steam_dll_source"
  fi

  if [ ! -f "$win_exe_path" ]; then
    echo "Windows executable not found: $win_exe_path"
    exit 1
  fi

  if [ ! -f "$win_dll_path" ]; then
    echo "steam_api64.dll not found in release output."
    echo "Set STEAMWORKS_DLL_PATH or ensure steamworks-sys exists in cargo registry cache."
    exit 1
  fi

  mkdir -p "$nsis_out_dir"
  app_version="$(get_app_version)"
  installer_path="$nsis_out_dir/ProjectHAM_${app_version}_windows_x64_setup.exe"

  if command -v makensis >/dev/null 2>&1; then
    echo "Generating NSIS installer..."
    makensis \
      -DAPP_NAME="Project HAM" \
      -DAPP_EXE="project-ham.exe" \
      -DAPP_VERSION="$app_version" \
      -DSOURCE_DIR="$win_release_dir" \
      -DOUT_FILE="$installer_path" \
      -DICON_FILE="$icon_path" \
      "$nsis_script"
    echo "NSIS installer created: $installer_path"
  else
    echo "'makensis' not installed; skipping installer generation."
  fi

  mkdir -p "$ARTIFACTS_DIR"
  cp -f "$win_exe_path" "$ARTIFACTS_DIR/project-ham_windows_x64.exe"
  cp -f "$win_dll_path" "$ARTIFACTS_DIR/steam_api64.dll"

  if [ -f "$installer_path" ]; then
    cp -f "$installer_path" "$ARTIFACTS_DIR/ProjectHAM_${app_version}_windows_x64_setup.exe"
  fi

  echo "Windows artifacts copied to: $ARTIFACTS_DIR"
}

run_linux() {
  local app_version
  local bundle_dir
  local release_dir
  local arch_workdir
  local bin_name
  local icon_source
  local deb_file
  local arch_file
  local steam_linux_so
  local patched_rpm

  echo "Starting Linux build process for Project HAM..."

  require_cmd npm
  require_cmd makepkg

  app_version="$(get_app_version)"
  bundle_dir="$ROOT_DIR/src-tauri/target/release/bundle"
  release_dir="$ROOT_DIR/src-tauri/target/release"
  arch_workdir="$ROOT_DIR/installer/linux/arch"
  bin_name="project-ham"

  sync_icons

  echo "Building Debian bundle with Tauri..."
  npm run tauri -- build --bundles deb

  if [ ! -f "$release_dir/$bin_name" ]; then
    echo "Linux binary not found at: $release_dir/$bin_name"
    exit 1
  fi

  steam_linux_so=""
  if steam_linux_so="$(resolve_steam_linux_so)"; then
    cp -f "$steam_linux_so" "$release_dir/libsteam_api.so"
    echo "Using Steam Linux library: $steam_linux_so"
  else
    echo "Warning: libsteam_api.so not found in known locations."
  fi

  echo "Building Arch package with makepkg..."
  rm -rf "$arch_workdir"
  mkdir -p "$arch_workdir"

  cp -f "$release_dir/$bin_name" "$arch_workdir/$bin_name"
  if [ -f "$release_dir/libsteam_api.so" ]; then
    cp -f "$release_dir/libsteam_api.so" "$arch_workdir/libsteam_api.so"
  fi

  icon_source="$ROOT_DIR/assets/icon.png"
  if [ ! -f "$icon_source" ]; then
    icon_source="$ROOT_DIR/src-tauri/icons/128x128.png"
  fi
  cp -f "$icon_source" "$arch_workdir/project-ham.png"

  cat > "$arch_workdir/project-ham.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=Project HAM
Comment=Manage Hydra and Steam achievements
Exec=/usr/bin/project-ham
Icon=project-ham
Terminal=false
Categories=Utility;
EOF

  cat > "$arch_workdir/PKGBUILD" <<EOF
pkgname=project-ham-bin
pkgver=$app_version
pkgrel=1
pkgdesc="Project HAM desktop application for Hydra and Steam achievements"
arch=('x86_64')
url="https://github.com/TheProjectHAM/hydra-achievement-manager"
license=('GPL3')
depends=('glibc' 'gtk3' 'webkit2gtk')
provides=('project-ham')
conflicts=('project-ham')
source=('project-ham' 'project-ham.desktop' 'project-ham.png')
sha256sums=('SKIP' 'SKIP' 'SKIP')

package() {
  install -Dm755 "\$srcdir/project-ham" "\$pkgdir/usr/bin/project-ham"
  if [ -f "\$srcdir/libsteam_api.so" ]; then
    install -Dm755 "\$srcdir/libsteam_api.so" "\$pkgdir/usr/bin/libsteam_api.so"
  fi
  install -Dm644 "\$srcdir/project-ham.desktop" "\$pkgdir/usr/share/applications/project-ham.desktop"
  install -Dm644 "\$srcdir/project-ham.png" "\$pkgdir/usr/share/pixmaps/project-ham.png"
}
EOF

  if [ -f "$arch_workdir/libsteam_api.so" ]; then
    sed -i "s/source=('project-ham' 'project-ham.desktop' 'project-ham.png')/source=('project-ham' 'libsteam_api.so' 'project-ham.desktop' 'project-ham.png')/" "$arch_workdir/PKGBUILD"
    sed -i "s/sha256sums=('SKIP' 'SKIP' 'SKIP')/sha256sums=('SKIP' 'SKIP' 'SKIP' 'SKIP')/" "$arch_workdir/PKGBUILD"
  fi

  (
    cd "$arch_workdir"
    makepkg -f
  )

  mkdir -p "$ARTIFACTS_DIR"

  deb_file="$(find "$bundle_dir/deb" -type f -name "*.deb" 2>/dev/null | sort | tail -n1 || true)"
  arch_file="$(find "$arch_workdir" -maxdepth 1 -type f -name "*.pkg.tar.zst" 2>/dev/null | sort | tail -n1 || true)"

  cp -f "$release_dir/$bin_name" "$ARTIFACTS_DIR/project-ham_linux_x64"

  if [ -n "$deb_file" ] && [ -f "$deb_file" ]; then
    if [ -f "$release_dir/libsteam_api.so" ]; then
      patch_deb_with_steam_so "$deb_file" "$release_dir/libsteam_api.so"
    fi
    cp -f "$deb_file" "$ARTIFACTS_DIR/ProjectHAM_${app_version}_linux_amd64.deb"
  else
    echo "Warning: .deb bundle not found."
  fi

  if patched_rpm="$(build_rpm_with_steam_so "$app_version" "$release_dir" "$icon_source")"; then
    cp -f "$patched_rpm" "$ARTIFACTS_DIR/ProjectHAM_${app_version}_linux_x86_64.rpm"
    echo "RPM built with rpmbuild and libsteam_api.so included."
  else
    echo "Error: failed to build RPM with rpmbuild."
    exit 1
  fi

  if [ -n "$arch_file" ] && [ -f "$arch_file" ]; then
    cp -f "$arch_file" "$ARTIFACTS_DIR/ProjectHAM_${app_version}_linux_x86_64.pkg.tar.zst"
  else
    echo "Warning: Arch package not found."
  fi

  echo "Linux artifacts copied to: $ARTIFACTS_DIR"
}

usage() {
  cat <<'EOF'
Usage:
  ./build.sh [windows|linux|all]

If no argument is provided, an interactive menu is shown.
EOF
}

if [ "${1:-}" != "" ]; then
  case "$1" in
    windows)
      run_windows
      ;;
    linux)
      run_linux
      ;;
    all)
      run_windows
      run_linux
      ;;
    -h|--help|help)
      usage
      ;;
    *)
      echo "Invalid option: $1"
      usage
      exit 1
      ;;
  esac
  exit 0
fi

echo "Select build target:"
echo
echo "=============================================================="
echo " Project HAM Build Menu"
echo "=============================================================="
echo " Choose what you want to build:"
echo
echo "  [1] Windows"
echo "      - Builds: .exe + NSIS installer (if makensis is available)"
echo "      - Copies artifacts to: installer/builds"
echo "      - Requires: cargo-xwin, rustup Windows target"
echo
echo "  [2] Linux"
echo "      - Builds: .deb (Tauri), .rpm (rpmbuild), .pkg.tar.zst (makepkg)"
echo "      - Includes libsteam_api.so in Linux packages"
echo "      - Copies artifacts to: installer/builds"
echo "      - Requires: npm, makepkg, rpmbuild"
echo
echo "  [3] All"
echo "      - Runs Windows build, then Linux build"
echo
echo "  [4] Cancel"
echo
read -r -p "Enter option [1-4]: " opt

case "$opt" in
  1)
    run_windows
    ;;
  2)
    run_linux
    ;;
  3)
    run_windows
    run_linux
    ;;
  4)
    echo "Canceled."
    exit 0
    ;;
  *)
    echo "Invalid option."
    exit 1
    ;;
esac
