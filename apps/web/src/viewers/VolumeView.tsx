/**
 * 3B HACİM GÖRÜNTÜLEME (volume rendering): DICOM serisinin KENDİ vokselleri, GPU'da ışın izleme ile.
 *
 *  - En yüksek yoğunluk izdüşümü (MIP) ve yarı saydam hacim (doğrudan hacim görüntüleme) kipleri
 *  - BT'de Hounsfield pencereleri (kemik, yumuşak doku, akciğer, damar); MR'da otomatik pencere
 *  - Döndür / yakınlaştır (fare, dokunma), kesit al (kesit ekseni boyunca kırpma), saydamlık
 *  - Görüntüleyicide açık olan kesit, hacimde çerçeve olarak görünür (2B ↔ 3B)
 *  - Kutu voksel aralığına göre ölçeklenir (fiziksel oran); WebGL2 yoksa üç eksende CPU izdüşümü gösterilir
 *
 * Bu görünüm bölütleme, bulgu ya da tanı içermez: yalnızca kişinin görüntüsündeki yoğunluk değerleridir.
 * Sağ-sol / ön-arka etiketi gösterilmez (kesit sırasının yönü seriden seriye değişebilir).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { PLANE_LABEL, type Projection, type RenderVolume, VR_CT_PRESETS, type Volume, mipProjection, toRenderVolume, volumeWindow } from '@kh/ingest';

const VERT = /* glsl */ `
out vec3 vOrigin;
out vec3 vDirection;
void main() {
  vOrigin = vec3(inverse(modelMatrix) * vec4(cameraPosition, 1.0));
  vDirection = position - vOrigin;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
precision highp float;
precision highp sampler3D;
in vec3 vOrigin;
in vec3 vDirection;
out vec4 outColor;
uniform sampler3D uData;
uniform int uMode;
uniform float uClip;
uniform float uOpacity;
uniform vec3 uCold;
uniform vec3 uWarm;
const int STEPS = 200;

vec2 hitBox(vec3 o, vec3 d) {
  vec3 inv = 1.0 / d;
  vec3 t0 = (vec3(-0.5) - o) * inv;
  vec3 t1 = (vec3(0.5) - o) * inv;
  vec3 mn = min(t0, t1);
  vec3 mx = max(t0, t1);
  return vec2(max(mn.x, max(mn.y, mn.z)), min(mx.x, min(mx.y, mx.z)));
}

void main() {
  vec3 d = normalize(vDirection);
  vec2 b = hitBox(vOrigin, d);
  if (b.x > b.y) discard;
  b.x = max(b.x, 0.0);
  float dt = (b.y - b.x) / float(STEPS);
  vec3 p = vOrigin + (b.x + 0.5 * dt) * d;
  float best = 0.0;
  vec4 acc = vec4(0.0);
  for (int i = 0; i < STEPS; i++) {
    vec3 q = p + 0.5;
    if (q.z <= uClip) {
      float s = texture(uData, q).r;
      if (uMode == 0) {
        best = max(best, s);
      } else {
        float a = s * s * uOpacity;
        vec3 c = mix(uCold, uWarm, s);
        acc.rgb += (1.0 - acc.a) * a * c;
        acc.a += (1.0 - acc.a) * a;
        if (acc.a > 0.97) break;
      }
    }
    p += d * dt;
  }
  if (uMode == 0) {
    if (best < 0.02) discard;
    float g = pow(best, 0.6);
    outColor = vec4(mix(uCold, uWarm, g) * g, 1.0);
  } else {
    if (acc.a < 0.01) discard;
    outColor = vec4(acc.rgb, acc.a);
  }
}`;

export type VrMode = 'mip' | 'dvr';

function Scene({ rv, mode, clip, opacity, sliceZ }: { rv: RenderVolume; mode: VrMode; clip: number; opacity: number; sliceZ: number | null }) {
  const texture = useMemo(() => {
    const t = new THREE.Data3DTexture(rv.data, rv.nx, rv.ny, rv.nz);
    t.format = THREE.RedFormat;
    t.type = THREE.UnsignedByteType;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.unpackAlignment = 1;
    t.needsUpdate = true;
    return t;
  }, [rv]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: VERT,
        fragmentShader: FRAG,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        uniforms: { uData: { value: null }, uMode: { value: 0 }, uClip: { value: 1 }, uOpacity: { value: 0.08 }, uCold: { value: new THREE.Color('#1b4f8f') }, uWarm: { value: new THREE.Color('#f4fbff') } },
      }),
    [],
  );
  // Bellek: doku ve malzeme sahneden çıkınca serbest bırakılır.
  useEffect(() => () => texture.dispose(), [texture]);
  useEffect(() => () => material.dispose(), [material]);
  material.uniforms.uData!.value = texture;
  material.uniforms.uMode!.value = mode === 'mip' ? 0 : 1;
  material.uniforms.uClip!.value = clip;
  material.uniforms.uOpacity!.value = opacity;
  // Tuval yalnızca gerektiğinde çizilir (pil dostu): ayar değişince bir kare istenir.
  const invalidate = useThree((s) => s.invalidate);
  // Dik (telefon) tuvalde kutu kenarlardan taşmasın: görüş açısı dikeydir, dar tuvalde kamera geri çekilir.
  const camera = useThree((s) => s.camera);
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  useEffect(() => {
    camera.position.setLength(1.85 / Math.min(1, aspect * 0.92));
    invalidate();
  }, [camera, aspect, invalidate]);
  useEffect(() => invalidate(), [invalidate, texture, mode, clip, opacity, sliceZ]);

  const m = Math.max(...rv.sizeMm);
  const scale: [number, number, number] = [rv.sizeMm[0] / m, rv.sizeMm[1] / m, rv.sizeMm[2] / m];
  const frame = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), []);
  const sliceFrame = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    return g;
  }, []);
  useEffect(() => () => (frame.dispose(), sliceFrame.dispose()), [frame, sliceFrame]);
  return (
    <group scale={scale}>
      <mesh material={material}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <lineSegments geometry={frame}>
        <lineBasicMaterial color="#2f4064" transparent opacity={0.9} />
      </lineSegments>
      {sliceZ !== null && (
        <lineLoop geometry={sliceFrame} position={[0, 0, sliceZ - 0.5]} renderOrder={5}>
          <lineBasicMaterial color="#22d3ee" depthTest={false} />
        </lineLoop>
      )}
    </group>
  );
}

function MipCanvas({ p, label }: { p: Projection; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const g = c?.getContext('2d');
    if (!c || !g) return;
    const img = g.createImageData(p.width, p.height);
    for (let i = 0; i < p.data.length; i++) {
      const v = p.data[i]!;
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, [p]);
  return (
    <figure className="min-w-0 flex-1">
      <canvas ref={ref} width={p.width} height={p.height} className="w-full rounded-lg bg-black" style={{ aspectRatio: `${p.width * p.pixelMm[0]} / ${p.height * p.pixelMm[1]}`, imageRendering: 'auto' }} role="img" aria-label={label} />
      <figcaption className="mt-1 text-center text-[11px] text-fg-faint">{label}</figcaption>
    </figure>
  );
}

function webgl2Available(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

export function VolumeView({ volume, isCt, slice, sliceCount, onClose }: { volume: Volume; isCt: boolean; /** Görüntüleyicide açık kesitin hacimdeki sırası (yoksa null). */ slice: number | null; sliceCount: number; onClose(): void }) {
  const [mode, setMode] = useState<VrMode>('mip');
  const [preset, setPreset] = useState(isCt ? 'kemik' : 'oto');
  const [clip, setClip] = useState(1);
  const [opacity, setOpacity] = useState(0.08);
  const [gl] = useState(webgl2Available);
  const auto = useMemo(() => volumeWindow(volume), [volume]);
  const window = useMemo(() => {
    const p = VR_CT_PRESETS.find((x) => x.key === preset);
    return isCt && p ? { lo: p.lo, hi: p.hi } : auto;
  }, [isCt, preset, auto]);
  const rv = useMemo(() => toRenderVolume(volume, window), [volume, window]);
  const g = volume.geometry;
  const depth = g.order.length;
  const sliceZ = slice !== null && depth > 1 ? slice / (depth - 1) : null;
  // Çekim düzlemine göre başlangıç bakışı: eksenel seride kesit ekseni yukarı; diğerlerinde kesit düzlemine karşıdan.
  const camera = g.acquired === 'axial' ? { position: [0.3, -1.75, 0.5] as [number, number, number], up: [0, 0, 1] as [number, number, number] } : { position: [0.25, -0.2, -1.75] as [number, number, number], up: [0, -1, 0] as [number, number, number] };
  const mips = useMemo(() => (gl ? null : ([0, 1, 2] as const).map((a) => mipProjection(rv, a))), [gl, rv]);
  const downsampled = rv.stride.some((s) => s > 1);

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="volume-view" data-mode={mode} data-webgl={gl ? '1' : '0'} data-dims={`${rv.nx}x${rv.ny}x${rv.nz}`} data-size-mm={rv.sizeMm.map((v) => v.toFixed(0)).join('x')} data-preset={preset} data-clip={clip.toFixed(2)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-ink-700 bg-ink-900/80 px-3 py-2 text-[12.5px]">
        <label className="flex items-center gap-1.5 text-fg-muted">
          Kip
          <select className="h-10 rounded-lg border border-ink-600 bg-ink-850 px-2 text-fg" value={mode} onChange={(e) => setMode(e.target.value as VrMode)} aria-label="Görüntüleme kipi" data-testid="vr-mode">
            <option value="mip">En parlak izdüşüm (MIP)</option>
            {gl && <option value="dvr">Yarı saydam hacim</option>}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-fg-muted">
          Pencere
          <select className="h-10 rounded-lg border border-ink-600 bg-ink-850 px-2 text-fg" value={preset} onChange={(e) => setPreset(e.target.value)} aria-label="Yoğunluk penceresi" data-testid="vr-preset">
            <option value="oto">Otomatik</option>
            {isCt && VR_CT_PRESETS.map((p) => <option key={p.key} value={p.key}>{`BT: ${p.label}`}</option>)}
          </select>
        </label>
        {gl && (
          <label className="flex min-w-[150px] flex-1 items-center gap-2 whitespace-nowrap text-fg-muted">
            Kesit al
            <input type="range" className="sim-range" min={0.05} max={1} step={0.01} value={clip} onChange={(e) => setClip(Number(e.target.value))} aria-label="Hacmi kesit ekseni boyunca kırp" data-testid="vr-clip" />
          </label>
        )}
        {gl && mode === 'dvr' && (
          <label className="flex min-w-[150px] flex-1 items-center gap-2 text-fg-muted">
            Yoğunluk
            <input type="range" className="sim-range" min={0.01} max={0.4} step={0.01} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} aria-label="Hacim yoğunluğu (saydamlık)" data-testid="vr-opacity" />
          </label>
        )}
        <button type="button" className="btn-ghost min-h-[40px] px-3 text-[12.5px]" onClick={onClose} data-testid="vr-close">
          Kesitlere dön
        </button>
      </div>
      <p className="border-b border-ink-700 bg-ink-900/80 px-3 py-1.5 text-[11.5px] text-fg-muted" role="note" data-testid="vr-note">
        <b className="font-semibold text-fg">Senin görüntünden</b> · DICOM seri, {sliceCount} kesit · {PLANE_LABEL[g.acquired]} çekim · {rv.sizeMm.map((v) => Math.round(v)).join(' × ')} mm · {rv.nx} × {rv.ny} × {rv.nz} voksel
        {downsampled ? ' (gösterim için indirgenmiş)' : ''}. Yoğunluk değerlerinin 3B gösterimidir; bölütleme, bulgu ya da tanı içermez. Sağ-sol/ön-arka etiketi gösterilmez.
        {isCt ? ` Pencere ${Math.round(window.lo)} – ${Math.round(window.hi)} HU.` : ' MR sinyali mutlak bir birim taşımaz: pencere otomatiktir.'}
      </p>
      {gl ? (
        <div className="relative min-h-[320px] flex-1 touch-none bg-black">
          <Canvas camera={{ position: camera.position, up: camera.up, near: 0.05, far: 20, fov: 34 }} dpr={[1, 1.5]} gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }} frameloop="demand" key={g.acquired}>
            <color attach="background" args={['#02040a']} />
            <Scene rv={rv} mode={mode} clip={clip} opacity={opacity} sliceZ={sliceZ} />
            <OrbitControls makeDefault enablePan={false} minDistance={0.8} maxDistance={6} />
          </Canvas>
          <p className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-white/60">Döndür: sürükle · Yakınlaştır: tekerlek / iki parmak{sliceZ !== null ? ' · Turkuaz çerçeve: açık kesit' : ''}</p>
        </div>
      ) : (
        <div className="space-y-2 overflow-auto p-3" data-testid="vr-fallback">
          <p className="text-[12.5px] text-fg-muted">Bu cihazda WebGL2 yok: döndürülebilir 3B yerine üç eksende en parlak izdüşüm (CPU ile hesaplandı) gösteriliyor.</p>
          <div className="flex flex-wrap gap-3">
            {mips!.map((p, i) => (
              <MipCanvas key={i} p={p} label={i === 0 ? `${PLANE_LABEL[g.byColumn]} izdüşüm` : i === 1 ? `${PLANE_LABEL[g.byRow]} izdüşüm` : `${PLANE_LABEL[g.acquired]} izdüşüm`} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
