#!/usr/bin/env bash
set -e

echo "=== ModelDock macOS Installer ==="

# Check Apple Silicon / macOS
if [[ "$(uname)" != "Darwin" ]]; then
  echo "Error: ModelDock requires macOS."
  exit 1
fi

# Check for Homebrew
if ! command -v brew &>/dev/null; then
  echo "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# Check for llama.cpp
if ! command -v llama-server &>/dev/null; then
  echo "Installing llama.cpp with Apple Metal support via brew..."
  brew install llama.cpp
fi

# Install python and pipx if needed
if ! command -v pipx &>/dev/null; then
  brew install pipx
  pipx ensurepath
fi

echo "Installing ModelDock CLI via pipx..."
pipx install git+https://github.com/modeldock/modeldock.git

echo ""
echo "=== ModelDock installed successfully! ==="
echo "Run: 'modeldock --help'"
echo "Configure R2: 'modeldock configure'"
