"""TotalSegmentator sınıf anahtarı → Türkçe ad, 3B yapı (structure), 3B bölüm (part), bilgi grafiği düğümü (node).

Yalnızca uygulamada gerçekten bulunan yapı/bölüm/düğüm kimlikleri kullanılır; eşleşme yoksa daha genel yapıya bağlanır.
"""

FIXED = {
    "spleen": ("Dalak", "spleen", None, None),
    "kidney_right": ("Sağ böbrek", "kidneys", None, "kidneys"),
    "kidney_left": ("Sol böbrek", "kidneys", None, "kidneys"),
    "gallbladder": ("Safra kesesi", "gallbladder", "gallbladder", None),
    "liver": ("Karaciğer", "liver", None, "liver"),
    "stomach": ("Mide", "stomach", None, "stomach"),
    "pancreas": ("Pankreas", "pancreas", None, "pancreas"),
    "adrenal_gland_right": ("Sağ böbreküstü bezi", "adrenals", "right", None),
    "adrenal_gland_left": ("Sol böbreküstü bezi", "adrenals", "left", None),
    "lung_upper_lobe_left": ("Sol akciğer üst lobu", "lungs", "left-upper", "lungs"),
    "lung_lower_lobe_left": ("Sol akciğer alt lobu", "lungs", "left-lower", "lungs"),
    "lung_upper_lobe_right": ("Sağ akciğer üst lobu", "lungs", "right-upper", "lungs"),
    "lung_middle_lobe_right": ("Sağ akciğer orta lobu", "lungs", "right-middle", "lungs"),
    "lung_lower_lobe_right": ("Sağ akciğer alt lobu", "lungs", "right-lower", "lungs"),
    "lung_left": ("Sol akciğer", "lungs", None, "lungs"),
    "lung_right": ("Sağ akciğer", "lungs", None, "lungs"),
    "esophagus": ("Yemek borusu", "esophagus", None, None),
    "trachea": ("Nefes borusu (trakea)", "airways", None, None),
    "thyroid_gland": ("Tiroid bezi", "thyroid", None, "thyroid"),
    "small_bowel": ("İnce bağırsak", "small-intestine", None, "small-intestine"),
    "duodenum": ("On iki parmak bağırsağı (duodenum)", "small-intestine", "duodenum", "small-intestine.duodenum"),
    "colon": ("Kalın bağırsak (kolon)", "large-intestine", None, "large-intestine"),
    "urinary_bladder": ("Mesane", "urinary-tract", "bladder", None),
    "prostate": ("Prostat", "prostate", None, None),
    "kidney_cyst_left": ("Sol böbrek kisti (model)", "kidneys", None, "kidneys"),
    "kidney_cyst_right": ("Sağ böbrek kisti (model)", "kidneys", None, "kidneys"),
    "sacrum": ("Sakrum", "bones", "pelvis", "bones"),
    "vertebrae": ("Omurlar", "bones", "spine", "bones"),
    "intervertebral_discs": ("Omurlar arası diskler", "bones", "spine", "bones"),
    "heart": ("Kalp", "heart", None, "heart"),
    "aorta": ("Aort", "aorta", None, None),
    "pulmonary_vein": ("Akciğer toplardamarları", "pulmonary-vessels", None, None),
    "brachiocephalic_trunk": ("Brakiyosefalik arter", "carotid-arteries", None, None),
    "subclavian_artery_right": ("Sağ köprücükaltı arter", "carotid-arteries", None, None),
    "subclavian_artery_left": ("Sol köprücükaltı arter", "carotid-arteries", None, None),
    "common_carotid_artery_right": ("Sağ ortak şah damarı", "carotid-arteries", None, None),
    "common_carotid_artery_left": ("Sol ortak şah damarı", "carotid-arteries", None, None),
    "brachiocephalic_vein_left": ("Sol brakiyosefalik ven", "veins", None, None),
    "brachiocephalic_vein_right": ("Sağ brakiyosefalik ven", "veins", None, None),
    "atrial_appendage_left": ("Sol kulakçık eki", "heart", "left-atrium", "heart"),
    "superior_vena_cava": ("Üst ana toplardamar", "veins", None, None),
    "inferior_vena_cava": ("Alt ana toplardamar", "veins", None, None),
    "portal_vein_and_splenic_vein": ("Kapı ve dalak toplardamarı", "abdominal-vessels", None, None),
    "iliac_artery_left": ("Sol iliak arter", "abdominal-vessels", None, None),
    "iliac_artery_right": ("Sağ iliak arter", "abdominal-vessels", None, None),
    "iliac_vena_left": ("Sol iliak ven", "abdominal-vessels", None, None),
    "iliac_vena_right": ("Sağ iliak ven", "abdominal-vessels", None, None),
    "humerus_left": ("Sol üst kol kemiği", "bones", "humerus-l", "bones"),
    "humerus_right": ("Sağ üst kol kemiği", "bones", "humerus-r", "bones"),
    "scapula_left": ("Sol kürek kemiği", "bones", "shoulder-l", "bones"),
    "scapula_right": ("Sağ kürek kemiği", "bones", "shoulder-r", "bones"),
    "clavicula_left": ("Sol köprücük kemiği", "bones", "shoulder-l", "bones"),
    "clavicula_right": ("Sağ köprücük kemiği", "bones", "shoulder-r", "bones"),
    "femur_left": ("Sol uyluk kemiği", "bones", "femur-l", "bones"),
    "femur_right": ("Sağ uyluk kemiği", "bones", "femur-r", "bones"),
    "hip_left": ("Sol kalça kemiği", "bones", "pelvis", "bones"),
    "hip_right": ("Sağ kalça kemiği", "bones", "pelvis", "bones"),
    "spinal_cord": ("Omurilik", "spinal-cord", None, None),
    "gluteus_maximus_left": ("Sol büyük kalça kası", "skeletal-muscle", "hip-l", None),
    "gluteus_maximus_right": ("Sağ büyük kalça kası", "skeletal-muscle", "hip-r", None),
    "gluteus_medius_left": ("Sol orta kalça kası", "skeletal-muscle", "hip-l", None),
    "gluteus_medius_right": ("Sağ orta kalça kası", "skeletal-muscle", "hip-r", None),
    "gluteus_minimus_left": ("Sol küçük kalça kası", "skeletal-muscle", "hip-l", None),
    "gluteus_minimus_right": ("Sağ küçük kalça kası", "skeletal-muscle", "hip-r", None),
    "autochthon_left": ("Sol sırt (otokton) kasları", "skeletal-muscle", "back", None),
    "autochthon_right": ("Sağ sırt (otokton) kasları", "skeletal-muscle", "back", None),
    "iliopsoas_left": ("Sol iliopsoas kası", "skeletal-muscle", "hip-l", None),
    "iliopsoas_right": ("Sağ iliopsoas kası", "skeletal-muscle", "hip-r", None),
    "brain": ("Beyin", "brain", None, "brain"),
    "skull": ("Kafatası", "bones", "skull", "bones"),
    "sternum": ("Göğüs kemiği (sternum)", "bones", "ribcage", "bones"),
    "costal_cartilages": ("Kaburga kıkırdakları", "bones", "ribcage", "bones"),
}


def label_info(key: str) -> dict:
    if key in FIXED:
        tr, structure, part, node = FIXED[key]
    elif key.startswith("vertebrae_"):
        lvl = key.split("_", 1)[1]
        tr, structure, part, node = (f"{lvl} omuru", "bones", "spine", "bones")
    elif key.startswith("rib_"):
        side, n = key.split("_")[1:3]
        tr, structure, part, node = (f"{'Sol' if side == 'left' else 'Sağ'} {n}. kaburga", "bones", "ribcage", "bones")
    else:
        raise KeyError(f"Eşlenmemiş sınıf: {key}")
    d = {"key": key, "finding": tr, "structure": structure}
    if part:
        d["part"] = part
    if node:
        d["node"] = node
    return d
