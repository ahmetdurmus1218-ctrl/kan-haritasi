/**
 * Gerçek BT hacminin doğrudan hacim görüntülemesi (WebGL2 ışın yürütme): her piksel için ışın hacim kutusunda
 * ilerler, 8 bit yoğunluk → aktarım tablosu (renk/opaklık), organ etiketi → renk/görünürlük, gradyanla
 * gölgeleme ve önden arkaya birleştirme. "Kalp tomografisi" görünümünün kendisi; yüzey modeli değildir.
 *
 * Koordinatlar: doku uzayı [0,1]³ = (R, A, S). Sahnede hasta önden görülür: x = −R (hastanın sağı
 * izleyicinin solunda), y = S (yukarı), z = A (izleyiciye doğru).
 */
import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import {
  BackSide,
  BoxGeometry,
  ClampToEdgeWrapping,
  Data3DTexture,
  DataTexture,
  GLSL3,
  LinearFilter,
  Matrix4,
  type Mesh,
  NearestFilter,
  RedFormat,
  RGBAFormat,
  ShaderMaterial,
  UnsignedByteType,
  Vector3,
} from 'three';
import type { Atlas } from './atlas';

export interface VolumeLook {
  tf: Uint8Array;
  lab: Uint8Array;
  labelMix: number;
  mode: 'composite' | 'mip';
  /** MIP penceresi (8 bit değer, 0–1). */
  mip: [number, number];
  /** Kesim kutusu (doku koordinatları). */
  clipMin: [number, number, number];
  clipMax: [number, number, number];
  /** Seçim dışı dokunun opaklık çarpanı. */
  ghost: number;
  /** Işın adımı (voksel). Etkileşim sırasında büyütülür. */
  step: number;
}

const VERT = /* glsl */ `
out vec3 vLocal;
void main() {
  vLocal = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
precision highp float;
precision highp sampler3D;
in vec3 vLocal;
layout(location = 0) out vec4 fragColor;
uniform sampler3D uVol;
uniform sampler3D uLab;
uniform sampler2D uTF;
uniform sampler2D uLabLUT;
uniform vec3 uCam;
uniform vec3 uShape;
uniform vec3 uClipMin;
uniform vec3 uClipMax;
uniform float uLabelMix;
uniform float uGhost;
uniform float uStep;
uniform int uMode;
uniform vec2 uMip;

vec2 hitBox(vec3 o, vec3 d, vec3 bmin, vec3 bmax) {
  vec3 inv = 1.0 / d;
  vec3 t0 = (bmin - o) * inv;
  vec3 t1 = (bmax - o) * inv;
  vec3 tn = min(t0, t1);
  vec3 tf = max(t0, t1);
  return vec2(max(max(tn.x, tn.y), tn.z), min(min(tf.x, tf.y), tf.z));
}

void main() {
  vec3 o = uCam + 0.5;
  vec3 d = normalize(vLocal - uCam);
  vec2 t = hitBox(o, d, uClipMin, uClipMax);
  if (t.x > t.y) discard;
  t.x = max(t.x, 0.0);
  vec3 dVox = d * uShape;
  float lenVox = length(dVox);
  float dt = uStep / lenVox;
  float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  float tt = t.x + dt * jitter;
  vec3 L = normalize(-dVox);
  vec3 e = 1.0 / uShape;
  vec4 acc = vec4(0.0);
  float mip = 0.0;
  for (int i = 0; i < 2000; i++) {
    if (tt > t.y || acc.a > 0.97) break;
    vec3 p = o + d * tt;
    float v = texture(uVol, p).r;
    if (uMode == 1) {
      mip = max(mip, v);
      tt += dt;
      continue;
    }
    vec4 tf = texture(uTF, vec2(v, 0.5));
    if (tf.a > 0.002) {
      float lab = floor(texture(uLab, p).r * 255.0 + 0.5);
      vec4 ll = texture(uLabLUT, vec2((lab + 0.5) / 256.0, 0.5));
      float a = tf.a * mix(uGhost, 1.0, ll.a);
      vec3 col = mix(tf.rgb, ll.rgb, uLabelMix * step(0.5, lab));
      vec3 g = vec3(
        texture(uVol, p + vec3(e.x, 0.0, 0.0)).r - texture(uVol, p - vec3(e.x, 0.0, 0.0)).r,
        texture(uVol, p + vec3(0.0, e.y, 0.0)).r - texture(uVol, p - vec3(0.0, e.y, 0.0)).r,
        texture(uVol, p + vec3(0.0, 0.0, e.z)).r - texture(uVol, p - vec3(0.0, 0.0, e.z)).r);
      float gl = length(g);
      if (gl > 0.003) {
        vec3 n = -g / gl;
        float diff = abs(dot(n, L));
        float spec = pow(max(dot(reflect(-L, n), L), 0.0), 20.0);
        col = col * (0.32 + 0.78 * diff) + 0.22 * spec * smoothstep(0.003, 0.03, gl);
      }
      a = 1.0 - pow(1.0 - clamp(a, 0.0, 1.0), uStep);
      acc.rgb += (1.0 - acc.a) * a * col;
      acc.a += (1.0 - acc.a) * a;
    }
    tt += dt;
  }
  if (uMode == 1) {
    float m = clamp((mip - uMip.x) / max(1e-3, uMip.y - uMip.x), 0.0, 1.0);
    if (m < 0.01) discard;
    fragColor = vec4(vec3(m), 1.0);
    return;
  }
  if (acc.a < 0.01) discard;
  fragColor = vec4(acc.rgb / max(acc.a, 1e-3), acc.a);
}`;

/** Doku uzayı (R, A, S) ↔ sahne. Sahne biriminde en uzun kenar `size`. */
export function volumeMatrix(shape: readonly [number, number, number], size: number): Matrix4 {
  const max = Math.max(...shape);
  const [sx, sy, sz] = shape.map((s) => (s / max) * size) as [number, number, number];
  // sütunlar: yerel u (R) → (−sx,0,0), v (A) → (0,0,sy), w (S) → (0,sz,0)
  return new Matrix4().set(-sx, 0, 0, 0, 0, 0, sz, 0, 0, sy, 0, 0, 0, 0, 0, 1);
}

function tex3d(data: Uint8Array, shape: readonly [number, number, number], linear: boolean): Data3DTexture {
  const t = new Data3DTexture(data, shape[0], shape[1], shape[2]);
  t.format = RedFormat;
  t.type = UnsignedByteType;
  t.minFilter = t.magFilter = linear ? LinearFilter : NearestFilter;
  t.wrapS = t.wrapT = t.wrapR = ClampToEdgeWrapping;
  t.unpackAlignment = 1;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

function lut(data: Uint8Array, linear: boolean): DataTexture {
  const t = new DataTexture(data, 256, 1, RGBAFormat, UnsignedByteType);
  t.minFilter = t.magFilter = linear ? LinearFilter : NearestFilter;
  t.needsUpdate = true;
  return t;
}

export function VolumeView({ atlas, look, size = 2, onReady }: { atlas: Atlas; look: VolumeLook; size?: number; onReady?: () => void }) {
  const ref = useRef<Mesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const { shape } = atlas.manifest;
  const textures = useMemo(() => ({ vol: tex3d(atlas.volume, shape, true), lab: tex3d(atlas.labels, shape, false) }), [atlas, shape]);
  const tf = useMemo(() => lut(look.tf, true), [look.tf]);
  const labLut = useMemo(() => lut(look.lab, false), [look.lab]);
  const geometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        glslVersion: GLSL3,
        vertexShader: VERT,
        fragmentShader: FRAG,
        side: BackSide,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uVol: { value: null },
          uLab: { value: null },
          uTF: { value: null },
          uLabLUT: { value: null },
          uCam: { value: new Vector3() },
          uShape: { value: new Vector3(shape[0], shape[1], shape[2]) },
          uClipMin: { value: new Vector3(0, 0, 0) },
          uClipMax: { value: new Vector3(1, 1, 1) },
          uLabelMix: { value: 0 },
          uGhost: { value: 0.05 },
          uStep: { value: 0.8 },
          uMode: { value: 0 },
          uMip: { value: [0, 1] },
        },
      }),
    [shape],
  );
  const matrix = useMemo(() => volumeMatrix(shape, size), [shape, size]);
  useEffect(() => {
    const u = material.uniforms;
    u.uVol!.value = textures.vol;
    u.uLab!.value = textures.lab;
    u.uTF!.value = tf;
    u.uLabLUT!.value = labLut;
    u.uLabelMix!.value = look.labelMix;
    u.uGhost!.value = look.ghost;
    u.uStep!.value = look.step;
    u.uMode!.value = look.mode === 'mip' ? 1 : 0;
    u.uMip!.value = look.mip;
    (u.uClipMin!.value as Vector3).set(...look.clipMin);
    (u.uClipMax!.value as Vector3).set(...look.clipMax);
    invalidate();
  }, [material, textures, tf, labLut, look, invalidate]);
  useEffect(() => () => [textures.vol, textures.lab].forEach((t) => t.dispose()), [textures]);
  useEffect(() => () => tf.dispose(), [tf]);
  useEffect(() => () => labLut.dispose(), [labLut]);
  useEffect(() => () => (material.dispose(), geometry.dispose()), [material, geometry]);
  useEffect(() => onReady?.(), [onReady]);
  // Kamera konumu ÇİZİM ANINDA alınır (onBeforeRender): kamera denetimi aynı karede kamerayı taşısa da
  // ışınlar doğru yerden atılır.
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const inv = new Matrix4();
    m.onBeforeRender = (_r, _s, camera) => {
      m.updateMatrixWorld();
      inv.copy(m.matrixWorld).invert();
      (material.uniforms.uCam!.value as Vector3).setFromMatrixPosition(camera.matrixWorld).applyMatrix4(inv);
    };
    invalidate();
    return () => {
      m.onBeforeRender = () => undefined;
    };
  }, [material, invalidate]);
  return <mesh ref={ref} geometry={geometry} material={material} matrix={matrix} matrixAutoUpdate={false} frustumCulled={false} />;
}

/** Ekrandaki noktadan doku uzayında ışın (seçme için). */
export function rayInVolume(ndc: [number, number], camera: { position: Vector3; matrixWorld: Matrix4; projectionMatrixInverse: Matrix4 }, shape: readonly [number, number, number], size: number): { origin: [number, number, number]; dir: [number, number, number] } {
  const inv = volumeMatrix(shape, size).invert();
  const o = camera.position.clone().applyMatrix4(inv);
  const p = new Vector3(ndc[0], ndc[1], 0.5).applyMatrix4(camera.projectionMatrixInverse).applyMatrix4(camera.matrixWorld).applyMatrix4(inv);
  const d = p.sub(o).normalize();
  return { origin: [o.x + 0.5, o.y + 0.5, o.z + 0.5], dir: [d.x, d.y, d.z] };
}
