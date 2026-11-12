#!/bin/sh
# Z-Anatomy (CC BY-SA 4.0; BodyParts3D türevi + ek modeller) FBX dosyalarını sabit bir sürümden indirir
# (~230 MB). Yalnızca envanter/aday incelemesi içindir; uygulamaya henüz hiçbir parça alınmadı.
# Lisans notu: iç kulak (Dundee, CC BY-NC-SA 4.0) ve böbrek (lissiecowley, CC BY-NC 4.0) ticari
# olmayan lisanslıdır; bu parçalar uygulamaya alınmaz. Ayrıntı: docs/ANATOMY_INVENTORY.md
set -eu
REPO=https://github.com/LluisV/Z-Anatomy
COMMIT=6c7f9016bd5899ac8edafd31b9900c151df42ed6 # PC-Version
DEST=${1:-.cache/zanatomy}
mkdir -p "$DEST"
cd "$DEST"
if [ ! -d .git ]; then
  git init -q
  git remote add origin "$REPO"
fi
git -c gc.auto=0 fetch -q --depth 1 --filter=blob:none origin "$COMMIT"
git -c gc.auto=0 checkout -q FETCH_HEAD -- LICENSE Resources/Models/License.txt Resources/Models/FBX
echo "Z-Anatomy kaynakları: $DEST"
