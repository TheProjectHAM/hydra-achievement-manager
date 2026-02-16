#!/bin/bash

# Build script for Project HAM (Windows Target)
# This script uses cargo-xwin to cross-compile from Linux to Windows

set -e

echo "🚀 Starting Windows build process for Project HAM..."

# 1. Check for dependencies
if ! command -v cargo-xwin &> /dev/null; then
    echo "❌ cargo-xwin not found. Installing..."
    cargo install cargo-xwin
fi

if ! rustup target list --installed | grep -q "x86_64-pc-windows-msvc"; then
    echo "❌ Windows target not found. Adding..."
    rustup target add x86_64-pc-windows-msvc
fi

# 2. Build Frontend
echo "📦 Building frontend with yarn..."
yarn build

# 3. Sync app icons used by Tauri bundle/installer
echo "🖼️ Syncing installer/app icons from assets..."
if [ -f "assets/icon.ico" ]; then
    cp assets/icon.ico src-tauri/icons/icon.ico
else
    echo "⚠️ assets/icon.ico not found; keeping existing src-tauri/icons/icon.ico"
fi

if [ -f "assets/icon.png" ]; then
    cp assets/icon.png src-tauri/icons/icon.png
else
    echo "⚠️ assets/icon.png not found; keeping existing src-tauri/icons/icon.png"
fi

# 4. Build Tauri App for Windows (with bundle/installer)
echo "🔨 Compiling Tauri app for Windows (x86_64)..."
# Use cargo-xwin as tauri build runner so the Rust build actually runs through xwin
yarn tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc

echo "✅ Build complete!"

WIN_RELEASE_DIR="src-tauri/target/x86_64-pc-windows-msvc/release"
WIN_EXE_PATH="$WIN_RELEASE_DIR/project-ham.exe"
WIN_DLL_PATH="$WIN_RELEASE_DIR/steam_api64.dll"
NSIS_OUT_DIR="$WIN_RELEASE_DIR/bundle/nsis"
NSIS_SCRIPT="installer/windows/project-ham.nsi"
ICON_PATH="$(pwd)/assets/icon.ico"

# Resolve the Steam API DLL that matches the steamworks crate used at build-time.
# This avoids runtime entry-point errors caused by packaging an incompatible DLL.
STEAM_DLL_SOURCE=""
if [ -n "$STEAMWORKS_DLL_PATH" ] && [ -f "$STEAMWORKS_DLL_PATH" ]; then
    STEAM_DLL_SOURCE="$STEAMWORKS_DLL_PATH"
else
    STEAM_DLL_SOURCE="$(ls -d "$HOME"/.cargo/registry/src/*/steamworks-sys-*/lib/steam/redistributable_bin/win64/steam_api64.dll 2>/dev/null | sort -V | tail -n 1)"
fi

# Always overwrite with the resolved DLL when available.
if [ -n "$STEAM_DLL_SOURCE" ] && [ -f "$STEAM_DLL_SOURCE" ]; then
    cp -f "$STEAM_DLL_SOURCE" "$WIN_DLL_PATH"
    echo "✅ Using Steam DLL from: $STEAM_DLL_SOURCE"
fi

if [ ! -f "$WIN_EXE_PATH" ]; then
    echo "❌ Windows executable not found: $WIN_EXE_PATH"
    exit 1
fi

if [ ! -f "$WIN_DLL_PATH" ]; then
    echo "❌ steam_api64.dll not found in release output."
    echo "   Set STEAMWORKS_DLL_PATH to a valid redistributable steam_api64.dll, or ensure steamworks-sys is available in Cargo registry cache."
    exit 1
fi

mkdir -p "$NSIS_OUT_DIR"
APP_VERSION=$(grep -oE '"version"[[:space:]]*:[[:space:]]*"[^"]+"' src-tauri/tauri.conf.json | head -n1 | sed -E 's/.*"([^"]+)"$/\1/')
if [ -z "$APP_VERSION" ]; then
    APP_VERSION="0.0.0"
fi
INSTALLER_PATH="$(pwd)/$NSIS_OUT_DIR/ProjectHAM_${APP_VERSION}_windows_x64_setup.exe"

if command -v makensis &> /dev/null; then
    echo "📦 Generating NSIS installer..."
    makensis \
      -DAPP_NAME="Project HAM" \
      -DAPP_EXE="project-ham.exe" \
      -DAPP_VERSION="$APP_VERSION" \
      -DSOURCE_DIR="$(pwd)/$WIN_RELEASE_DIR" \
      -DOUT_FILE="$INSTALLER_PATH" \
      -DICON_FILE="$ICON_PATH" \
      "$NSIS_SCRIPT"
    echo "✅ NSIS installer created:"
    echo "   $NSIS_OUT_DIR/ProjectHAM_${APP_VERSION}_windows_x64_setup.exe"
else
    echo "ℹ️ 'makensis' is not installed, so the installer was not generated."
    echo "   Install NSIS locally (example on Ubuntu/Debian: sudo apt install nsis)"
    echo "   Then rerun this script to generate:"
    echo "   $NSIS_OUT_DIR/ProjectHAM_${APP_VERSION}_windows_x64_setup.exe"
fi

# 5. Copy build artifacts to installer/builds
ARTIFACTS_DIR="installer/builds"
mkdir -p "$ARTIFACTS_DIR"

echo "📁 Copying build artifacts to $ARTIFACTS_DIR ..."
cp -f "$WIN_EXE_PATH" "$ARTIFACTS_DIR/project-ham_windows_x64.exe"
cp -f "$WIN_DLL_PATH" "$ARTIFACTS_DIR/steam_api64.dll"

if [ -f "$INSTALLER_PATH" ]; then
    cp -f "$INSTALLER_PATH" "$ARTIFACTS_DIR/ProjectHAM_${APP_VERSION}_windows_x64_setup.exe"
fi

echo "✅ Artifacts copied to:"
echo "   $ARTIFACTS_DIR"
