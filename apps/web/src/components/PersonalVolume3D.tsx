/**
 * KİŞİSEL 3B: yerel modelin bu seride bölütlediği yapıların ve bulguların GERÇEK maskelerinden çıkarılan
 * yüzeyler, hastanın kendi koordinatlarında (RAS, mm). Şablon/genel model değildir: ne bölütlendiyse o.
 *
 *  - döndür / yakınlaştır / kaydır (fare, dokunma), yapı grubu göster/gizle, saydamlık, tek yapıyı izole et
 *  - 3B → 2B: bir yapıya dokun → "Kesitte göster" ilgili kesiti görüntüleyicide açar
 *  - 2B → 3B: görüntüleyicide açık kesit 3B'de yarı saydam düzlem olarak görünür; görüntüde seçilen yapı burada vurgulanır
 */
import { useEffect, useMemo, useState } from 'react';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { GRAPH, type SurfaceMesh, findingClass, labelSurface, surfaceStep } from '@kh/analysis';
import type { StoredVolume } from '../lib/imagingRecords';
import { labelColor, setSeriesOverlay, useSeriesOverlay } from '../lib/seriesOverlay';
import { storedLabels, structureGroup } from '../lib/volumeResults';
import { insideRoute } from '../lib/anatomyNav';
import { go } from '../state/router';

interface Item {
  key: string;
  volume: StoredVolume;
  labelId: number;
  name: string;
  finding: boolean;
  group: string;
  color: string;
  mesh: SurfaceMesh;
  geometry: THREE.BufferGeometry;
}

const GROUPS = ['Bulgular', 'Organlar', 'Damarlar', 'Kemikler', 'Kaslar'] as const;
const hex = (rgb: [number, number, number]) => `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;

function buildItems(volumes: StoredVolume[], onProgress: (done: number, total: number) => void): Promise<Item[]> {
  const todo = volumes.flatMap((v) => v.structures.filter((s) => s.kind === 'anatomy' || findingClass(s) !== 'below').map((s) => ({ v, s })));
  const out: Item[] = [];
  return new Promise((resolve) => {
    let i = 0;
    const step = () => {
      const t0 = performance.now();
      while (i < todo.length && performance.now() - t0 < 30) {
        const { v, s } = todo[i++]!;
        const mesh = labelSurface(storedLabels(v), v.grid, s.labelId, surfaceStep(s.voxels));
        if (mesh && mesh.indices.length) {
          const g = new THREE.BufferGeometry();
          g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
          g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
          g.computeVertexNormals();
          const finding = s.kind === 'finding';
          out.push({ key: `${v.model.id}:${s.labelId}`, volume: v, labelId: s.labelId, name: s.name, finding, group: finding ? 'Bulgular' : structureGroup(s.structure), color: hex(labelColor(v, s.labelId)), mesh, geometry: g });
        }
      }
      onProgress(i, todo.length);
      if (i < todo.length) setTimeout(step, 0);
      else resolve(out);
    };
    step();
  });
}

/** Görüntüleyicide açık kesitin düzlemi (hasta koordinatı LPS → RAS). */
function slicePlane(v: StoredVolume, k: number): THREE.BufferGeometry {
  const g = v.geometry;
  const corner = (i: number, j: number) => {
    const p = [0, 1, 2].map((d) => g.origin[d]! + i * g.iVec[d]! + j * g.jVec[d]! + k * g.kVec[d]!);
    return [-p[0]!, -p[1]!, p[2]!];
  };
  const pts = [corner(0, 0), corner(g.cols - 1, 0), corner(g.cols - 1, g.rows - 1), corner(0, g.rows - 1)];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(pts.flat()), 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  return geo;
}

export default function PersonalVolume3D({ volumes, headId }: { volumes: StoredVolume[]; headId: string }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [progress, setProgress] = useState<[number, number]>([0, 1]);
  const [shown, setShown] = useState<Set<string>>(() => new Set(['Bulgular', 'Organlar']));
  const [opacity, setOpacity] = useState(0.55);
  const [selected, setSelected] = useState<string | null>(null);
  const [isolate, setIsolate] = useState(false);
  const overlay = useSeriesOverlay(headId);

  useEffect(() => {
    let alive = true;
    setItems(null);
    void buildItems(volumes, (d, t) => alive && setProgress([d, t])).then((r) => alive && setItems(r));
    return () => {
      alive = false;
    };
  }, [volumes]);
  useEffect(() => () => items?.forEach((it) => it.geometry.dispose()), [items]);

  // 2B'de seçilen (vurgulanan) yapı 3B'de de seçilir
  useEffect(() => {
    if (overlay?.highlight != null) setSelected(`${overlay.volume.model.id}:${overlay.highlight}`);
  }, [overlay?.highlight, overlay?.volume]);

  const visible = useMemo(() => (items ?? []).filter((it) => (isolate && selected ? it.key === selected : shown.has(it.group) || it.key === selected)), [items, shown, isolate, selected]);
  const bounds = useMemo(() => {
    const box = new THREE.Box3();
    for (const it of visible.length ? visible : (items ?? [])) box.union(new THREE.Box3(new THREE.Vector3(...it.mesh.min), new THREE.Vector3(...it.mesh.max)));
    return box;
  }, [visible, items]);
  const center = bounds.isEmpty() ? new THREE.Vector3() : bounds.getCenter(new THREE.Vector3());
  const radius = bounds.isEmpty() ? 200 : bounds.getSize(new THREE.Vector3()).length() / 2;
  const sliceK = overlay?.slice;
  const plane = useMemo(() => (sliceK != null && volumes[0] ? slicePlane(volumes[0], sliceK) : null), [sliceK, volumes]);
  const sel = items?.find((it) => it.key === selected);
  const selStruct = sel?.volume.structures.find((s) => s.labelId === sel.labelId);
  const node = selStruct?.node && GRAPH.node(selStruct.node) ? selStruct.node : undefined;

  if (!items)
    return (
      <p className="text-sm text-fg-muted" data-testid="personal-3d-loading">
        Kişisel 3B yüzeyler maskeden çıkarılıyor… {progress[0]}/{progress[1]}
      </p>
    );

  return (
    <div className="space-y-2" data-testid="personal-3d">
      <p className="text-xs text-fg-muted">
        Senin görüntünden: yerel modelin bu seride bölütlediği {items.length} yapının gerçek maske yüzeyi (hasta koordinatı, mm). Şablon değildir; bölütlenmeyen yapı gösterilmez.
      </p>
      <div className="flex flex-wrap items-center gap-1.5 text-xs" role="group" aria-label="Görünen gruplar">
        {GROUPS.filter((g) => items.some((it) => it.group === g)).map((g) => (
          <button key={g} type="button" aria-pressed={shown.has(g)} className={`rounded-full border px-2.5 py-1 ${shown.has(g) ? 'border-accent text-fg' : 'border-ink-600 text-fg-muted'}`} onClick={() => setShown((s) => (s.has(g) ? new Set([...s].filter((x) => x !== g)) : new Set([...s, g])))}>
            {shown.has(g) ? '✓ ' : ''}
            {g} · {items.filter((it) => it.group === g).length}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1.5 text-fg-muted">
          Saydamlık
          <input type="range" min={0.15} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} aria-label="Anatomi saydamlığı" />
        </label>
      </div>
      <div className="h-[360px] overflow-hidden rounded-xl border border-ink-600/60 bg-ink-950 md:h-[440px]">
        <Canvas camera={{ position: [center.x + radius * 0.2, center.y - radius * 2.2, center.z + radius * 0.4], up: [0, 0, 1], near: 1, far: radius * 20, fov: 40 }} key={`${Math.round(center.x)}:${Math.round(radius)}`} data-testid="personal-3d-canvas">
          <ambientLight intensity={0.55} />
          <directionalLight position={[center.x + radius, center.y - radius * 2, center.z + radius * 2]} intensity={1.1} />
          <directionalLight position={[center.x - radius, center.y + radius * 2, center.z - radius]} intensity={0.4} />
          {visible.map((it) => (
            <mesh
              key={it.key}
              geometry={it.geometry}
              renderOrder={it.finding ? 2 : 1}
              onClick={(e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation();
                setSelected(it.key);
              }}
            >
              <meshStandardMaterial
                color={it.color}
                transparent={!it.finding && it.key !== selected}
                opacity={it.finding || it.key === selected ? 1 : opacity}
                depthWrite={it.finding || it.key === selected || opacity > 0.9}
                emissive={it.key === selected ? '#ffffff' : '#000000'}
                emissiveIntensity={it.key === selected ? 0.25 : 0}
                side={THREE.DoubleSide}
              />
            </mesh>
          ))}
          {plane && (
            <mesh geometry={plane} renderOrder={3}>
              <meshBasicMaterial color="#5eead4" transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
          )}
          <OrbitControls target={center} makeDefault enableDamping />
        </Canvas>
      </div>
      <p className="text-[11px] text-fg-faint">
        {plane ? `Turkuaz düzlem: görüntüleyicide açık kesit (${(sliceK ?? 0) + 1}). ` : ''}Sürükle: döndür · tekerlek/iki parmak: yakınlaştır · sağ tık/üç parmak: kaydır. Bir yapıya dokun: seç.
      </p>
      {sel && selStruct && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-600/60 px-3 py-2 text-sm" data-testid="personal-3d-selected">
          <span className="h-3 w-3 rounded-sm" style={{ background: sel.color }} aria-hidden="true" />
          <span className="font-medium text-fg">
            {sel.finding ? '◆ ' : ''}
            {sel.name}
          </span>
          <span className="text-xs text-fg-muted">
            {selStruct.volumeMl.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} mL · kesit {selStruct.sliceRange[0] + 1}–{selStruct.sliceRange[1] + 1} · {sel.volume.model.name}
          </span>
          <span className="ml-auto flex flex-wrap gap-3">
            <button
              type="button"
              className="text-xs text-accent underline"
              data-testid="personal-3d-to-slice"
              onClick={() => {
                const fileId = sel.volume.fileIds[selStruct.centroidSlice];
                if (fileId) setSeriesOverlay({ headId, volume: sel.volume, visible: true, highlight: sel.labelId, goto: { fileId, nonce: Date.now() }, slice: selStruct.centroidSlice });
              }}
            >
              Kesitte göster (2B)
            </button>
            <button type="button" className="text-xs text-accent underline" onClick={() => setIsolate((x) => !x)} aria-pressed={isolate}>
              {isolate ? 'Hepsini göster' : 'Yalnız bunu göster'}
            </button>
            {node && (
              <button type="button" className="text-xs text-accent underline" onClick={() => go(insideRoute(node))}>
                İçine gir
              </button>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
