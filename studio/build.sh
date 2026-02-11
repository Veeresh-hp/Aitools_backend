#!/usr/bin/env bash
# exit on error
set -o errexit

npm install

pip install --upgrade pip

pip install -r requirements.txt

# Install Chrome for undetected-chromedriver
STORAGE_DIR=/opt/render/project/.render

if [[ ! -d "$STORAGE_DIR/chrome" ]]; then
  echo "...Downloading Chrome"
  mkdir -p "$STORAGE_DIR/chrome"
  cd "$STORAGE_DIR/chrome"
  wget -P ./ https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
  dpkg -x ./google-chrome-stable_current_amd64.deb "$STORAGE_DIR/chrome"
  rm ./google-chrome-stable_current_amd64.deb
  cd "$STORAGE_DIR/chrome/opt/google/chrome"
  rm chrome-sandbox
  chmod +x chrome
else
  echo "...Using Chrome from cache"
fi

# Add Chrome to PATH
export PATH="${PATH}:$STORAGE_DIR/chrome/opt/google/chrome"

