#!/bin/sh
# HuBMAP Human Reference Atlas 3D referans organ kütüphanesinden (CC BY 4.0) yalnızca
# kullanılan dosyaları sabit bir sürümden indirir.
set -eu
REPO=https://github.com/hubmapconsortium/ccf-3d-reference-object-library
COMMIT=f1a3a63f110e27ff0736047d52d04dba5d3087f9
DEST=${1:-.cache/hra}
mkdir -p "$DEST"
cd "$DEST"
if [ ! -d .git ]; then
  git init -q
  git remote add origin "$REPO"
fi
git -c gc.auto=0 fetch -q --depth 1 --filter=blob:none origin "$COMMIT"
git -c gc.auto=0 checkout -q FETCH_HEAD -- LICENSE \
  VH_Male/v1.2/VH_M_Skin.glb VH_Male/v1.2/VH_M_Vertebrae.glb VH_Male/v1.2/VH_M_Pelvis.glb \
  VH_Male/v1.2/VH_M_Heart.glb VH_Male/v1.4/3d-vh-m-blood-vasculature.glb \
  VH_Male/v1.4/3d-vh-m-lung.glb VH_Male/v1.4/3d-vh-m-trachea.glb \
  VH_Male/v1.2/VH_M_Liver.glb VH_Male/v1.2/VH_M_Gallbladder.glb VH_Male/v1.2/VH_M_Pancreas.glb \
  VH_Male/v1.2/VH_M_Small_Intestine.glb VH_Male/v1.2/SBU_M_Intestine_Large.glb \
  VH_Male/v1.2/VH_M_Kidney_L.glb VH_Male/v1.2/VH_M_Kidney_R.glb VH_Male/v1.2/VH_M_Ureter_L.glb \
  VH_Male/v1.2/VH_M_Ureter_R.glb VH_Male/v1.2/VH_M_Urinary_Bladder.glb VH_Male/v1.2/VH_M_Prostate.glb \
  VH_Male/v1.2/Allen_M_Brain.glb VH_Male/v1.2/VH_M_Spinal_Cord.glb \
  VH_Male/v1.2/VH_M_Spleen.glb VH_Male/v1.2/VH_M_Thymus.glb \
  VH_Male/v1.2/VH_M_Eye_L.glb VH_Male/v1.2/VH_M_Eye_R.glb VH_Male/v1.4/3d-vh-m-larynx.glb
echo "HRA kaynakları: $DEST"
