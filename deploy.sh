#!/usr/bin/env bash
# Build the site with build.py and publish dist/ to the gh-pages branch (GitHub Pages serves that branch).
set -euo pipefail
cd "$(dirname "$0")"
python3 build.py
REMOTE=$(git remote get-url origin)
cd dist
rm -rf .git
git init -q -b gh-pages
git add -A
git -c user.name="Vivek Rajpara" -c user.email="rajparavivek1234@gmail.com" commit -qm "deploy: $(date -u +%Y-%m-%dT%H:%MZ)"
git -c credential.helper= -c "credential.helper=$(git -C .. config --local --get-all credential.helper | tail -1)" push -q -f "$REMOTE" gh-pages
rm -rf .git
echo "deployed -> https://rajparavivek1234.github.io/portfolio/"
