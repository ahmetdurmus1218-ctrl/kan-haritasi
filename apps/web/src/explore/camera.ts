import { Box3, MathUtils, type PerspectiveCamera, Sphere, Vector3 } from 'three';
import type { CameraControlsImpl } from '@react-three/drei';

/**
 * Sinematik kamera sistemi. camera-controls yumuşak (kritik sönümlü) geçişler yapar ve her yeni
 * hedef öncekini keser; böylece hızlı seçimlerde kamera takılmaz, kullanıcı her an kontrolü alabilir.
 */

export interface Shot {
  position: [number, number, number];
  target: [number, number, number];
}

/** Vücudun genel görünümü (gövde + baş); dar/dikey ekranlarda kadraj en-boy oranına göre hesaplanır. */
export const OVERVIEW: Shot = { position: [0, 0.48, 1.95], target: [0, 0.43, 0] };
const TORSO = new Box3(new Vector3(-0.2, -0.04, -0.14), new Vector3(0.2, 0.92, 0.14));
export function overviewShot(camera: PerspectiveCamera): Shot {
  if (camera.aspect >= 1) return OVERVIEW;
  return frameBox(TORSO, [0, 4], camera, 0.98);
}
/** Açılış: uzaktan, hafif aşağıdan. */
export const INTRO_START: Shot = { position: [0.35, 0.1, 4.6], target: [0, 0.35, 0] };

export const PRESETS: Record<'front' | 'back' | 'left' | 'right' | 'top', [number, number]> = {
  front: [0, 4],
  back: [180, 4],
  left: [90, 4],
  right: [-90, 4],
  top: [0, 70],
};

export function direction(azimuthDeg: number, elevationDeg: number): Vector3 {
  const az = MathUtils.degToRad(azimuthDeg);
  const el = MathUtils.degToRad(elevationDeg);
  return new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
}

/** Kutuyu verilen açıdan kadraja sığdıran çekim. */
export function frameBox(box: Box3, view: [number, number], camera: PerspectiveCamera, margin = 1.25, minRadius = 0.03): Shot {
  const sphere = box.getBoundingSphere(new Sphere());
  const r = Math.max(sphere.radius, minRadius);
  const vfov = MathUtils.degToRad(camera.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
  const dist = (r / Math.sin(Math.min(vfov, hfov) / 2)) * margin;
  const pos = sphere.center.clone().addScaledVector(direction(view[0], view[1]), dist);
  return { position: pos.toArray() as Shot['position'], target: sphere.center.toArray() as Shot['target'] };
}

export function shotDistance(shot: Shot): number {
  return new Vector3(...shot.position).distanceTo(new Vector3(...shot.target));
}

export function applyShot(controls: CameraControlsImpl, shot: Shot, animate: boolean): Promise<void> {
  return controls.setLookAt(...shot.position, ...shot.target, animate);
}

/** Mevcut açıyı koruyarak hedefe yaklaş (kısa, doğal bir hareket). */
export function approach(controls: CameraControlsImpl, box: Box3, camera: PerspectiveCamera, animate: boolean, margin = 1.3): Promise<void> {
  const cur = controls.getPosition(new Vector3());
  const tgt = controls.getTarget(new Vector3());
  const dir = cur.sub(tgt).normalize();
  const az = MathUtils.radToDeg(Math.atan2(dir.x, dir.z));
  const el = MathUtils.radToDeg(Math.asin(MathUtils.clamp(dir.y, -1, 1)));
  return applyShot(controls, frameBox(box, [az, el], camera, margin), animate);
}

/**
 * Bilgi paneli sahnenin bir kısmını kapatınca nesneyi görünür alana kaydır.
 * right: sağdan kapanan piksel; bottom: alttan kapanan piksel.
 */
export function panelOffset(
  controls: CameraControlsImpl,
  camera: PerspectiveCamera,
  viewport: { width: number; height: number },
  cover: { right: number; bottom: number },
  animate: boolean,
  distance?: number,
) {
  const dist = distance ?? controls.distance;
  const vfov = MathUtils.degToRad(camera.fov);
  const visibleH = 2 * dist * Math.tan(vfov / 2);
  const visibleW = visibleH * camera.aspect;
  const ox = viewport.width > 0 ? (visibleW * cover.right) / viewport.width / 2 : 0;
  // camera-controls odak kaydırmasında y ekseni ters: pozitif değer kamerayı aşağı indirir, nesne yukarı çıkar.
  const oy = viewport.height > 0 ? (visibleH * cover.bottom) / viewport.height / 2 : 0;
  return controls.setFocalOffset(ox, oy, 0, animate);
}
