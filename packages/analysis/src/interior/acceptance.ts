/**
 * Kabul listesi: "İçine gir" her birinde organın kendi iç dünyasını açmalı (duvar / doku / hücre / molekül DEĞİL).
 * Birim testleri ve uçtan uca testler bu listeyi kullanır; listeden organ çıkarılmaz.
 */
export const INTERIOR_ACCEPTANCE: Record<string, readonly string[]> = {
  sindirim: ['ic.mouth', 'ic.tongue', 'ic.pharynx', 'esophagus', 'stomach', 'small-intestine', 'small-intestine.duodenum', 'small-intestine.jejunum', 'small-intestine.ileum', 'large-intestine', 'large-intestine.rectum', 'ic.anal-canal', 'liver', 'gallbladder.bile-ducts', 'gallbladder', 'pancreas', 'ic.pancreatic-ducts'],
  dolasim: ['heart', 'ic.atrium', 'ic.ventricle', 'heart.valves', 'vessel.aorta', 'ic.artery', 'ic.arteriole', 'ic.capillary', 'ic.venule', 'ic.vein', 'ic.pulmonary-vessels'],
  solunum: ['ic.nose', 'ic.nasal-cavity', 'ic.pharynx', 'ic.larynx', 'airways.trachea', 'airways.main-bronchi', 'airways.bronchioles', 'tissue.alveolus', 'lungs', 'diaphragm'],
  uriner: ['kidneys', 'urinary-tract.renal-pelvis', 'urinary-tract.ureter', 'urinary-tract.bladder', 'urinary-tract.urethra', 'tissue.nephron'],
  sinir: ['brain', 'ic.cerebral-cortex', 'brain.white-matter', 'brain.brainstem', 'brain.cerebellum', 'spinal-cord', 'nerves', 'sub.synapse'],
  beyin: [
    'brain.cerebrum',
    'brain.frontal',
    'brain.parietal',
    'brain.temporal',
    'brain.occipital',
    'brain.insula',
    'brain.limbic',
    'brain.hippocampus',
    'brain.amygdala',
    'brain.thalamus',
    'brain.basal-nuclei',
    'brain.ventricles',
    'brain.corpus-callosum',
    'brain.meninges',
    'brain.midbrain',
    'brain.pons',
    'brain.medulla',
    'vessel.circle-of-willis',
  ],
  endokrin: ['ic.hypothalamus', 'pituitary', 'ic.pineal', 'thyroid', 'ic.parathyroid', 'adrenals', 'pancreas.endocrine', 'ic.gonads', 'adipose'],
  ureme: ['uterus', 'tissue.endometrium', 'tissue.myometrium', 'ovaries', 'fallopian-tubes', 'uterus.cervix', 'vagina', 'testes', 'ic.epididymis', 'ic.vas-deferens', 'prostate', 'ic.breast'],
  duyu: ['eyes', 'eyes.retina', 'ear', 'ear.canal', 'ear.eardrum', 'ear.middle', 'ear.cochlea', 'ear.vestibule'],
  kasIskelet: ['ic.bone', 'ic.bone-marrow', 'ic.joint', 'ic.cartilage', 'ic.tendon', 'ic.ligament', 'skeletal-muscle', 'cell.skeletal-myocyte'],
  deri: ['skin', 'ic.epidermis', 'ic.dermis', 'ic.hypodermis', 'ic.hair-follicle', 'ic.sweat-gland', 'ic.sebaceous-gland'],
  bagisiklik: ['spleen', 'ic.thymus', 'ic.tonsil', 'ic.lymph-node'],
};
