#!/bin/sh
# BodyParts3D 3.0 (DBCLS, CC BY-SA 2.1 JP) kopyasından yalnızca kullanılan dosyaları sabit bir
# sürümden indirir: hiyerarşi/ad tabloları + bp3d-parts.txt'teki STL dosyaları.
set -eu
REPO=https://github.com/Kevin-Mattheus-Moerman/BodyParts3D
COMMIT=f0eeb6e843380cfe6b83797cf8c3e1af74de5e61
HERE=$(cd "$(dirname "$0")" && pwd)
DEST=${1:-.cache/bp3d}
mkdir -p "$DEST"
cd "$DEST"
if [ ! -d .git ]; then
  git init -q
  git remote add origin "$REPO"
fi
git -c gc.auto=0 fetch -q --depth 1 --filter=blob:none origin "$COMMIT"
D=assets/BodyParts3D_data
git -c gc.auto=0 checkout -q FETCH_HEAD -- "$D/LICENSE_content" "$D/parts_list_e.txt" "$D/conventional_part_of.txt"
grep -v '^#' "$HERE/bp3d-parts.txt" | sed "s#^#$D/stl/#; s#\$#.stl#" | xargs git -c gc.auto=0 checkout -q FETCH_HEAD --
echo "BodyParts3D kaynakları: $DEST"
