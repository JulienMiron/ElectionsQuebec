#!/usr/bin/env bash
# Télécharge les deux jeux de données sources dans ./sources (ignoré par Git).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p sources && cd sources
[ -d atlas-canada-elections ] || git clone --depth 1 https://github.com/zacktayloruwo/atlas-canada-elections.git
[ -d donnees-bleues-elections-qc ] || git clone --depth 1 https://github.com/AurelienNicosiaULaval/donnees-bleues-elections-qc.git
