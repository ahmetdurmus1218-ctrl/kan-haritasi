/**
 * Tek veri ekleme akışı: dosyayı seç / fotoğraf çek / sürükle → sistem türünü kendisi algılar
 * (DICOM başlığı, dosya adı, görüntünün kendisi) → kasaya şifreli kaydedilir → "Aç ve oku".
 * Ana sayfa (boş durum), "+ Veri ekle" ve Verilerim aynı bileşeni kullanır.
 */
import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { ACCEPT_ATTRIBUTE, DEFAULT_LIMITS, type ZipItem, isDicom, isZip, openZip, sanitizeFileName } from '@kh/ingest';
import { DOC_CATEGORIES, type DocCategory, type FileInfo } from '@kh/vault';
import { useUnlockedVault, useVault } from '../state/VaultContext';
import { type Route } from '../state/router';
import { processUpload, type UploadPhase } from '../lib/upload';
import { CATEGORY_LABEL, CATEGORY_UPLOAD_TITLE, isImaging } from '../lib/imaging';
import { platform } from '../platform';
import { AlertIcon, CameraIcon, CheckIcon, FileTextIcon, FolderIcon, ScanIcon, SpinnerIcon, UploadIcon, XIcon } from './icons';

const uploadDeps = {
  countPdfPages: async (bytes: Uint8Array) => (await import('../lib/pdf')).countPdfPages(bytes),
};

interface BatchProgress {
  total: number;
  done: number;
  added: number;
  duplicates: number;
  failed: number;
  /** Klasörden seçilip DICOM olmadığı için atlanan dosyalar. */
  skipped: number;
}

interface QueueItem {
  key: string;
  name: string;
  phase: UploadPhase;
  message?: string;
  notes: string[];
  file?: FileInfo;
  batch?: BatchProgress;
}

interface UploadJob {
  item: QueueItem;
  /** ZIP girdileri sırası gelince açılır; arşivin tamamı belleğe alınmaz. */
  files: Array<File | ZipItem>;
  category: UploadCategory;
}

/** Yüklemede seçilen tür: 'auto' dosyadan (DICOM başlığı, dosya adı) tahmin edilir. */
type UploadCategory = DocCategory | 'auto';

/** Bu sayıdan fazla dosya tek satırda, toplu ilerlemeyle gösterilir (ör. bir MR serisinin yüzlerce kesiti). */
const BATCH_THRESHOLD = 6;
const MAX_FOLDER_FILES = 3000;

/** Klasör seçiminde yalnızca DICOM imzalı dosyalar alınır (CD'deki görüntüleyici programları, DICOMDIR vb. atlanır). */
async function pickDicomFiles(list: File[]): Promise<{ files: File[]; skipped: number }> {
  const files: File[] = [];
  let skipped = Math.max(0, list.length - MAX_FOLDER_FILES);
  for (const f of list.slice(0, MAX_FOLDER_FILES)) {
    const ok = f.size >= 132 && f.name.toUpperCase() !== 'DICOMDIR' && isDicom(new Uint8Array(await f.slice(0, 132).arrayBuffer()));
    if (ok) files.push(f);
    else skipped++;
  }
  return { files, skipped };
}

const looksLikeZip = async (f: File) =>
  /\.zip$/i.test(f.name) || /zip/.test(f.type) ? true : f.size >= 4 && isZip(new Uint8Array(await f.slice(0, 4).arrayBuffer()));

/** ZIP girdisini açar; DICOM değilse (görüntüleyici programı, DICOMDIR…) null. */
async function zipEntryFile(e: ZipItem): Promise<File | null> {
  if (e.size < 132 || e.name.toUpperCase() === 'DICOMDIR') return null;
  const bytes = await e.open();
  return isDicom(bytes) ? new File([bytes], e.name) : null;
}



/** Yükleme alanı + yükleme kuyruğu. `onOpen`: yüklenen belgeyi açar. */
export function Uploader({ navigate, title }: { navigate: (r: Route) => void; title?: string }) {
  const vault = useUnlockedVault();
  const { bump } = useVault();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const uploading = useRef(false);

  const pending = useRef<UploadJob[]>([]);

  const enqueue = useCallback(
    async (list: File[], category: UploadCategory, folder = false) => {
      if (!list.length) return;
      const key = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      // ZIP arşivleri (ör. hastanenin verdiği görüntü arşivi): her biri ayrı toplu iş olur.
      const zips: File[] = [];
      const plain: File[] = [];
      for (const f of list) (!folder && (await looksLikeZip(f)) ? zips : plain).push(f);
      for (const z of zips) {
        const item: QueueItem = { key: key(), name: `ZIP · ${sanitizeFileName(z.name)}`, phase: 'checking', notes: [] };
        try {
          const { entries, skipped } = await openZip(z, { maxEntries: MAX_FOLDER_FILES, maxEntryBytes: DEFAULT_LIMITS.maxDicomBytes });
          item.batch = { total: entries.length, done: 0, added: 0, duplicates: 0, failed: 0, skipped };
          if (!entries.length) Object.assign(item, { phase: 'error', message: 'ZIP arşivinde açılabilecek dosya bulunamadı.' });
          setQueue((q) => [item, ...q]);
          if (entries.length) pending.current.push({ item, files: entries, category });
        } catch {
          setQueue((q) => [{ ...item, phase: 'error', message: 'ZIP arşivi açılamadı: bozuk, eksik ya da desteklenmeyen bir arşiv.' }, ...q]);
        }
      }
      list = plain;
      let chosen = list;
      let skipped = 0;
      if (folder) ({ files: chosen, skipped } = await pickDicomFiles(list));
      let jobs: UploadJob[] = [];
      if (!list.length) {
        // yalnızca ZIP seçildi
      } else if (chosen.length > BATCH_THRESHOLD || folder) {
        const item: QueueItem = {
          key: key(),
          name: folder ? `Klasör · ${chosen.length} DICOM dosyası` : `${chosen.length} dosya`,
          phase: chosen.length ? 'checking' : 'error',
          message: chosen.length ? undefined : 'Klasörde DICOM (MR, BT, röntgen) görüntü dosyası bulunamadı.',
          notes: [],
          batch: { total: chosen.length, done: 0, added: 0, duplicates: 0, failed: 0, skipped },
        };
        jobs = chosen.length ? [{ item, files: chosen, category }] : [];
        setQueue((q) => [item, ...q]);
      } else {
        jobs = chosen.map((f) => ({ item: { key: key(), name: sanitizeFileName(f.name), phase: 'checking', notes: [] }, files: [f], category }));
        setQueue((q) => [...jobs.map((j) => j.item), ...q]);
      }
      pending.current.push(...jobs);
      if (uploading.current) return; // çalışan döngü yeni öğeleri de alır
      uploading.current = true;
      try {
        // Dosyalar sırayla işlenir: aynı anda tek dosya belleğe açılır.
        for (let job = pending.current.shift(); job; job = pending.current.shift()) {
          const { item } = job;
          const update = (patch: Partial<QueueItem>) => setQueue((q) => q.map((x) => (x.key === item.key ? { ...x, ...patch } : x)));
          // Kasadaki liste iş başına bir kez çözülür; çift kayıt denetimi bellekteki tablodan yapılır.
          const known = new Map<string, FileInfo>();
          let listed = false;
          try {
            for (const f of (await vault.listFiles()).files) known.set(f.sha256, f);
            listed = true;
          } catch {
            // Liste çözülemezse processUpload kasaya kendisi sorar.
          }
          const deps = listed ? { ...uploadDeps, findExisting: async (sha: string) => known.get(sha) } : uploadDeps;
          if (!item.batch) {
            const outcome = await processUpload(vault, job.files[0] as File, deps, (phase) => update({ phase }), { category: job.category });
            update({ phase: outcome.phase, message: outcome.message, notes: outcome.notes, file: outcome.file });
            if (outcome.phase === 'done') {
              known.set(outcome.file!.sha256, outcome.file!);
              bump();
            }
            continue;
          }
          const b = { ...item.batch };
          let first: FileInfo | undefined;
          const errors = new Set<string>();
          const notes = new Set<string>();
          for (const source of job.files) {
            let file: File | null;
            try {
              file = source instanceof File ? source : await zipEntryFile(source);
            } catch {
              b.done++;
              b.failed++;
              errors.add('ZIP içindeki dosya açılamadı.');
              update({ batch: { ...b } });
              continue;
            }
            if (!file) {
              b.done++;
              b.skipped++;
              update({ batch: { ...b } });
              continue;
            }
            const outcome = await processUpload(vault, file, deps, undefined, { category: job.category });
            b.done++;
            if (outcome.phase === 'done') {
              b.added++;
              known.set(outcome.file!.sha256, outcome.file!);
              // "Aç" serinin ilk kesitini açsın.
              if (!first || (outcome.file!.sliceIndex ?? Infinity) < (first.sliceIndex ?? Infinity)) first = outcome.file;
              if (b.added % 50 === 0) bump();
            } else if (outcome.phase === 'duplicate') {
              b.duplicates++;
              first ??= outcome.file;
            } else {
              b.failed++;
              if (outcome.message) errors.add(outcome.message);
            }
            for (const n of outcome.notes) notes.add(n);
            update({ batch: { ...b } });
          }
          update({
            phase: b.added + b.duplicates > 0 ? (b.added > 0 ? 'done' : 'duplicate') : 'error',
            message: b.added + b.duplicates > 0 ? undefined : ([...errors][0] ?? (b.skipped >= b.total ? 'Arşivde DICOM görüntü dosyası bulunamadı.' : 'Dosyalar yüklenemedi.')),
            notes: [...notes, ...[...errors].map((e) => `Okunamayan dosya: ${e}`)].slice(0, 4),
            file: first,
            batch: { ...b },
          });
          bump();
        }
      } finally {
        uploading.current = false;
      }
    },
    [vault, bump],
  );

  const doneCount = queue.filter((q) => q.phase === 'done').length;
  return (
    <div>
      <DropZone onFiles={enqueue} title={title} />
      {queue.length > 0 && (
        <section className="mt-4 space-y-2" aria-label="Yüklemeler" aria-live="polite">
          <div className="flex items-center justify-between">
            <p className="label-caps">Yüklemeler{doneCount ? ` · ${doneCount} tamam` : ''}</p>
            <button type="button" className="text-xs text-fg-muted hover:text-fg" onClick={() => setQueue((q) => q.filter((x) => x.phase === 'checking' || x.phase === 'encrypting'))}>
              Temizle
            </button>
          </div>
          {queue.map((item) => (
            <UploadRow
              key={item.key}
              item={item}
              onOpen={(id) => navigate({ name: 'document', id })}
              onDismiss={() => setQueue((q) => q.filter((x) => x.key !== item.key))}
            />
          ))}
        </section>
      )}
    </div>
  );
}

/** Sık kullanılan türler düğme olarak; diğerleri açılır listede. */
const MAIN_TYPES: DocCategory[] = ['lab', 'mr', 'ct', 'xray', 'us'];
const MORE_TYPES = DOC_CATEGORIES.filter((c) => !MAIN_TYPES.includes(c));

function DropZone({ onFiles, title }: { onFiles: (files: File[], category: UploadCategory, folder?: boolean) => void; title?: string }) {
  const [over, setOver] = useState(false);
  const [category, setCategory] = useState<UploadCategory>('auto');
  /** Tür seçimi isteğe bağlıdır ve varsayılan olarak kapalıdır: sistem türü kendisi algılar. */
  const [choose, setChoose] = useState(false);
  const pickRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const auto = category === 'auto';
  // Otomatik kipte DICOM ve klasör de kabul edilir; tür dosyanın kendisinden anlaşılır.
  const imaging = auto || isImaging(category);
  const more = category !== 'auto' && MORE_TYPES.includes(category);
  // Klasör seçimi masaüstü tarayıcılarda çalışır; Android uygulaması ve dokunmatik cihazlarda çoklu dosya seçimi kullanılır.
  const [folderPick] = useState(() => platform.platform === 'web' && typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches);

  // Klasör seçimi (CD/USB'deki DICOM klasörü). React bu özniteliği tanımadığı için elle eklenir.
  useEffect(() => {
    folderRef.current?.setAttribute('webkitdirectory', '');
  }, [imaging]);

  const take = (list: FileList | null, folder = false) => {
    if (list?.length) onFiles([...list], category, folder);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    take(e.dataTransfer.files);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={`relative overflow-hidden rounded-2xl border border-dashed px-4 py-7 text-center transition sm:px-6 ${
        over ? 'border-accent bg-accent/8' : 'border-ink-500 bg-ink-850/50'
      }`}
    >
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/25 bg-accent/10 text-accent">
        {imaging ? <ScanIcon size={22} /> : <UploadIcon size={22} />}
      </div>
      <h2 className="text-base font-semibold">{auto ? (title ?? 'Tahlil, Rapor veya Görüntü Yükle') : CATEGORY_UPLOAD_TITLE[category]}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-fg-muted">
        {auto ? (
          <>Kan tahlili, rapor, MR·BT·röntgen·ultrason görüntüsü, EKG… Ne olduğunu sistem kendisi anlar.</>
        ) : imaging ? (
          <>Raporun PDF'i veya fotoğrafı, filmin fotoğrafı ya da CD/USB'deki DICOM görüntü dosyaları</>
        ) : (
          <>
            <span className="hidden md:inline">PDF veya fotoğraf sürükleyip bırak</span>
            <span className="md:hidden">PDF seç veya raporun fotoğrafını çek</span>
          </>
        )}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button type="button" className="btn-primary" onClick={() => pickRef.current?.click()}>
          <FileTextIcon size={16} /> Dosya seç
        </button>
        {imaging && folderPick && (
          <button type="button" className="btn-ghost" onClick={() => folderRef.current?.click()}>
            <FolderIcon size={16} /> DICOM klasörü seç
          </button>
        )}
        <button type="button" className="btn-ghost md:hidden" onClick={() => cameraRef.current?.click()}>
          <CameraIcon size={16} /> Fotoğraf çek
        </button>
      </div>
      <p className="mt-4 text-xs text-fg-faint">{imaging ? 'PDF, fotoğraf, DICOM ya da ZIP · dosya bu cihazdan çıkmaz' : 'PDF ya da fotoğraf · dosya bu cihazdan çıkmaz'}</p>
      <div className="mt-4">
        <button type="button" className="min-h-[44px] text-xs text-fg-muted underline decoration-ink-500 underline-offset-4 hover:text-fg" aria-expanded={choose} onClick={() => setChoose((v) => !v)}>
          {auto ? 'Türünü kendim seçeyim (isteğe bağlı)' : `Tür: ${CATEGORY_LABEL[category as DocCategory]} · değiştir`}
        </button>
        {choose && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5" role="radiogroup" aria-label="Belge türü">
            {(['auto', ...MAIN_TYPES] as UploadCategory[]).map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={category === c}
                onClick={() => setCategory(c)}
                className={`min-h-[36px] rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  category === c ? 'border-accent/50 bg-accent/12 text-fg' : 'border-ink-600 text-fg-muted hover:border-ink-500 hover:text-fg'
                }`}
              >
                {c === 'auto' ? 'Otomatik algıla' : CATEGORY_LABEL[c]}
              </button>
            ))}
            <select
              aria-label="Diğer belge türleri"
              value={more ? category : ''}
              onChange={(e) => e.target.value && setCategory(e.target.value as DocCategory)}
              className={`h-[36px] rounded-full border bg-transparent px-3 text-xs font-medium ${more ? 'border-accent/50 bg-accent/12 text-fg' : 'border-ink-600 text-fg-muted'}`}
            >
              <option value="">Diğer türler…</option>
              {MORE_TYPES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {imaging && !auto && (
        <p className="mt-1 text-xs text-fg-faint">
          MR ve tomografi CD'lerinde görüntüler genellikle DICOM klasöründedir.{' '}
          {folderPick ? 'Klasörü seçersen' : 'Dosyaları birlikte seçersen'} aynı seriye ait kesitler tek görüntüleyicide bir arada gösterilir.
        </p>
      )}
      <input
        ref={pickRef}
        type="file"
        className="sr-only"
        // CD'lerdeki DICOM dosyalarının çoğu uzantısızdır; tür filtresi onları gizlerdi. İçerik yüklemede imzasıyla doğrulanır.
        accept={imaging ? undefined : ACCEPT_ATTRIBUTE}
        multiple
        tabIndex={-1}
        onChange={(e) => {
          take(e.target.files);
          e.target.value = '';
        }}
      />
      {imaging && folderPick && (
        <input
          ref={folderRef}
          type="file"
          className="sr-only"
          tabIndex={-1}
          aria-label="DICOM klasörü"
          onChange={(e) => {
            take(e.target.files, true);
            e.target.value = '';
          }}
        />
      )}
      <input
        ref={cameraRef}
        type="file"
        className="sr-only"
        accept="image/jpeg,image/png"
        capture="environment"
        tabIndex={-1}
        onChange={(e) => {
          take(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function UploadRow({ item, onOpen, onDismiss }: { item: QueueItem; onOpen: (id: string) => void; onDismiss: () => void }) {
  const working = item.phase === 'checking' || item.phase === 'encrypting';
  const b = item.batch;
  const label = b
    ? working
      ? `İşleniyor ${b.done}/${b.total}…`
      : item.phase === 'error'
        ? (item.message ?? '')
        : [
            b.added ? `${b.added} dosya şifrelendi ve kaydedildi` : '',
            b.duplicates ? `${b.duplicates} zaten yüklü` : '',
            b.failed ? `${b.failed} okunamadı` : '',
          ]
            .filter(Boolean)
            .join(' · ')
    : {
        checking: 'Doğrulanıyor…',
        encrypting: 'Şifreleniyor…',
        done: 'Şifrelendi ve kaydedildi',
        duplicate: 'Bu dosya zaten yüklü',
        error: item.message ?? '',
      }[item.phase];
  const tone = item.phase === 'error' ? 'text-danger' : item.phase === 'duplicate' ? 'text-high' : item.phase === 'done' ? 'text-accent' : 'text-fg-muted';

  return (
    <div className="flex items-start gap-3 rounded-xl border border-ink-600/60 bg-ink-850/70 px-3.5 py-3">
      <span className={`mt-0.5 ${tone}`}>
        {working ? <SpinnerIcon size={16} /> : item.phase === 'error' ? <AlertIcon size={16} /> : <CheckIcon size={16} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.name}</p>
        <p className={`mt-0.5 text-xs ${tone}`}>{label}</p>
        {b && working && (
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ink-700">
            <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${b.total ? Math.round((b.done / b.total) * 100) : 0}%` }} />
          </div>
        )}
        {b && b.skipped > 0 && <p className="mt-0.5 text-xs text-fg-muted">DICOM olmayan ya da açılamayan {b.skipped} dosya (ör. DICOMDIR, görüntüleyici programı) atlandı.</p>}
        {item.notes.map((n) => (
          <p key={n} className="mt-0.5 text-xs text-fg-muted">
            {n}
          </p>
        ))}
      </div>
      {item.file && (item.phase === 'done' || item.phase === 'duplicate') && (
        <button type="button" className="btn-primary px-3 py-1.5 text-xs" onClick={() => onOpen(item.file!.id)}>
          {item.phase === 'done' && !b ? 'Aç ve oku' : 'Aç'}
        </button>
      )}
      {!working && (
        <button type="button" className="icon-btn h-7 w-7" onClick={onDismiss} aria-label="Kaldır">
          <XIcon size={14} />
        </button>
      )}
    </div>
  );
}
