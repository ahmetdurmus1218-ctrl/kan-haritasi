import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { ACCEPT_ATTRIBUTE, DEFAULT_LIMITS, type ZipItem, isDicom, isZip, openZip, sanitizeFileName, splitExtension } from '@kh/ingest';
import { DOC_CATEGORIES, type DocCategory, type FileInfo, MAX_DISPLAY_NAME, type Vault } from '@kh/vault';
import { useUnlockedVault, useVault } from '../state/VaultContext';
import { type Route } from '../state/router';
import { processUpload, type UploadPhase } from '../lib/upload';
import { CATEGORY_LABEL, CATEGORY_SHORT, CATEGORY_UPLOAD_TITLE, isImaging, regionByKey } from '../lib/imaging';
import { type DocGroup, groupDocuments } from '../lib/documents';
import { formatBytes, formatDate, KIND_LABEL } from '../lib/format';
import { userMessage } from '../lib/messages';
import { deleteDocument } from '../lib/reports';
import { platform } from '../platform';

const uploadDeps = {
  countPdfPages: async (bytes: Uint8Array) => (await import('../lib/pdf')).countPdfPages(bytes),
};
import { Banner, Dialog } from '../components/ui';
import {
  CameraIcon,
  CheckIcon,
  DownloadIcon,
  EyeIcon,
  FileTextIcon,
  FolderIcon,
  ImageIcon,
  PencilIcon,
  ScanIcon,
  RefreshIcon,
  SpinnerIcon,
  TrashIcon,
  UploadIcon,
  XIcon,
  AlertIcon,
} from '../components/icons';

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

export async function downloadOriginal(vault: Vault, id: string): Promise<boolean> {
  const { info, bytes } = await vault.readFile(id);
  const { ext } = splitExtension(info.originalFileName);
  const name = sanitizeFileName(ext ? `${info.displayName}.${ext}` : info.displayName);
  return platform.files.save(name, bytes, info.mimeType);
}

export function DocumentsPage({ navigate }: { navigate: (r: Route) => void }) {
  const vault = useUnlockedVault();
  const { revision, bump } = useVault();
  const [files, setFiles] = useState<FileInfo[] | null>(null);
  const [corrupt, setCorrupt] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [renaming, setRenaming] = useState<DocGroup | null>(null);
  const [deleting, setDeleting] = useState<DocGroup | null>(null);
  const [filter, setFilter] = useState<'all' | 'lab' | 'imaging'>('all');
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const uploading = useRef(false);

  useEffect(() => {
    let cancelled = false;
    vault
      .listFiles()
      .then(({ files: list, corruptIds }) => {
        if (cancelled) return;
        setFiles(list);
        setCorrupt(corruptIds.length);
        setLoadError(null);
      })
      .catch((e) => !cancelled && setLoadError(userMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [vault, revision]);

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

  async function onDownload(f: FileInfo) {
    setBusyId(f.id);
    try {
      await downloadOriginal(vault, f.id);
    } catch (e) {
      setNotice(userMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  const doneCount = queue.filter((q) => q.phase === 'done').length;
  const groups = files ? groupDocuments(files) : null;
  const imagingCount = groups?.filter((g) => isImaging(g.head.category)).length ?? 0;
  const shown = groups?.filter((g) => filter === 'all' || (filter === 'imaging') === isImaging(g.head.category));

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-caps mb-1.5">Belgelerim</p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">Tahlil ve görüntüleme belgelerin</h1>
          <p className="mt-1.5 text-sm text-fg-muted">Tahliller; MR, tomografi, röntgen, ultrason; patoloji, endoskopi, EKG ve diğer raporlar. Yalnızca bu cihazda, dosya başına ayrı anahtarla şifreli.</p>
        </div>
        {files && files.length > 0 && (
          <p className="text-sm text-fg-muted">
            {groups!.length} belge · {formatBytes(files.reduce((n, f) => n + f.size, 0))}
          </p>
        )}
      </div>

      <DropZone onFiles={enqueue} />

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

      <div className="mt-8 space-y-3">
        {notice && (
          <Banner tone="info">
            <div className="flex items-start justify-between gap-3">
              <span>{notice}</span>
              <button type="button" className="text-fg-muted hover:text-fg" onClick={() => setNotice(null)} aria-label="Kapat">
                <XIcon size={14} />
              </button>
            </div>
          </Banner>
        )}
        {corrupt > 0 && (
          <Banner tone="warn">
            {corrupt} kayıt doğrulanamadı ve listede gösterilmiyor. Depolama bozulmuş veya dışarıdan değiştirilmiş olabilir.
          </Banner>
        )}
        {loadError && <Banner tone="error">{loadError}</Banner>}
      </div>

      {imagingCount > 0 && groups && (
        <div className="mt-3 flex gap-1.5" role="radiogroup" aria-label="Belge filtresi">
          {(
            [
              ['all', `Tümü · ${groups.length}`],
              ['lab', `Tahliller · ${groups.length - imagingCount}`],
              ['imaging', `Görüntüleme · ${imagingCount}`],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={filter === k}
              className={`rounded-full border px-3 py-1 text-xs transition ${filter === k ? 'border-accent/40 bg-accent/10 text-fg' : 'border-ink-600 text-fg-muted hover:text-fg'}`}
              onClick={() => setFilter(k)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <section className="mt-3" aria-label="Belgeler">
        {files === null && !loadError ? (
          <div className="flex items-center gap-2 py-10 text-sm text-fg-muted">
            <SpinnerIcon size={16} /> Belgeler çözülüyor…
          </div>
        ) : files && files.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink-600 px-6 py-12 text-center">
            <p className="font-medium">Henüz belge yok</p>
            <p className="mt-1 text-sm text-fg-muted">İlk tahlil raporunu ya da MR, tomografi, röntgen belgeni yukarıdan yükle; PDF, fotoğraf veya CD'deki DICOM dosyaları olabilir.</p>
          </div>
        ) : (
          <ul className="divide-y divide-ink-700 overflow-hidden rounded-2xl border border-ink-600/60 bg-ink-850/60">
            {shown?.map((g) => (
              <DocumentRow
                key={g.key}
                file={g.head}
                count={g.files.length}
                size={g.files.reduce((n, f) => n + f.size, 0)}
                busy={busyId === g.head.id}
                onOpen={() => navigate({ name: 'document', id: g.head.id })}
                onDownload={() => onDownload(g.head)}
                onRename={() => setRenaming(g)}
                onDelete={() => setDeleting(g)}
              />
            ))}
          </ul>
        )}
      </section>

      <RenameDialog
        group={renaming}
        onClose={() => setRenaming(null)}
        onSaved={() => {
          setRenaming(null);
          bump();
        }}
      />
      <DeleteDialog
        group={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => {
          const ids = new Set(deleting?.files.map((f) => f.id));
          setDeleting(null);
          setNotice(ids.size > 1 ? `${ids.size} kesit ve anahtarları kalıcı olarak silindi.` : 'Belge ve anahtarı kalıcı olarak silindi.');
          setQueue((q) => q.filter((x) => !x.file || !ids.has(x.file.id)));
          bump();
        }}
      />
    </div>
  );
}

/** Sık kullanılan türler düğme olarak; diğerleri açılır listede. */
const MAIN_TYPES: DocCategory[] = ['lab', 'mr', 'ct', 'xray', 'us'];
const MORE_TYPES = DOC_CATEGORIES.filter((c) => !MAIN_TYPES.includes(c));

function DropZone({ onFiles }: { onFiles: (files: File[], category: UploadCategory, folder?: boolean) => void }) {
  const [over, setOver] = useState(false);
  const [category, setCategory] = useState<UploadCategory>('auto');
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
      <div className="mb-5 flex flex-wrap items-center justify-center gap-1.5" role="radiogroup" aria-label="Belge türü">
        {(['auto', ...MAIN_TYPES] as UploadCategory[]).map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={category === c}
            onClick={() => setCategory(c)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
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
          className={`h-[30px] rounded-full border bg-transparent px-3 text-xs font-medium ${more ? 'border-accent/50 bg-accent/12 text-fg' : 'border-ink-600 text-fg-muted'}`}
        >
          <option value="">Diğer türler…</option>
          {MORE_TYPES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </div>
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/25 bg-accent/10 text-accent">
        {imaging ? <ScanIcon size={22} /> : <UploadIcon size={22} />}
      </div>
      <h2 className="text-base font-semibold">{auto ? 'Tahlil, Rapor veya Görüntü Yükle' : CATEGORY_UPLOAD_TITLE[category]}</h2>
      <p className="mt-1 text-sm text-fg-muted">
        {auto ? (
          <>Kan/idrar tahlili, MR·BT·röntgen·ultrason raporu ya da görüntüsü, patoloji, endoskopi, EKG… Türü dosyadan anlaşılır; emin olunamazsa okuduktan sonra sorulur.</>
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
      <p className="mt-4 text-xs text-fg-faint">
        {imaging
          ? 'PDF, JPG, PNG, DICOM (.dcm veya uzantısız), DICOM içeren ZIP · DICOM için en fazla 60 MB · dosya bu cihazdan çıkmaz'
          : 'PDF, JPG, PNG · en fazla 20 MB · dosya bu cihazdan çıkmaz'}
      </p>
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

export function DocumentRow({
  file,
  count = 1,
  size,
  busy,
  onOpen,
  onDownload,
  onRename,
  onDelete,
}: {
  file: FileInfo;
  /** DICOM serisindeki kesit sayısı. */
  count?: number;
  /** Serinin toplam boyutu. */
  size?: number;
  busy: boolean;
  onOpen: () => void;
  onDownload: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const isPdf = file.kind === 'pdf';
  const imaging = isImaging(file.category);
  const region = file.region ? regionByKey.get(file.region)?.label : undefined;
  return (
    <li className="group flex items-center gap-3 px-3 py-3 transition hover:bg-ink-800/60 md:px-4">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`${file.displayName} belgesini görüntüle`}>
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
            imaging ? 'border-high/25 bg-high/8 text-high' : isPdf ? 'border-accent/25 bg-accent/8 text-accent' : 'border-low/25 bg-low/8 text-low'
          }`}
        >
          {imaging ? <ScanIcon size={19} /> : isPdf ? <FileTextIcon size={19} /> : <ImageIcon size={19} />}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            {imaging && (
              <span className="shrink-0 rounded-md border border-high/30 bg-high/10 px-1.5 py-px text-[10px] font-semibold tracking-wide text-high">{CATEGORY_SHORT[file.category]}</span>
            )}
            <span className="block truncate text-[15px] font-medium">{file.displayName}</span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-fg-muted">
            {formatDate(file.studyDate ?? file.createdAt)}
            {region ? ` · ${region}` : ''} · {KIND_LABEL[file.kind]}
            {count > 1 ? ` · ${count} kesit` : ''} · {formatBytes(size ?? file.size)}
          </span>
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-0.5">
        <button type="button" className="icon-btn hidden sm:inline-flex" onClick={onOpen} aria-label="Görüntüle" title="Görüntüle">
          <EyeIcon />
        </button>
        <button type="button" className="icon-btn" onClick={onDownload} disabled={busy} aria-label="Orijinal dosyayı indir" title="Orijinal dosyayı indir">
          {busy ? <SpinnerIcon /> : <DownloadIcon />}
        </button>
        <button type="button" className="icon-btn" onClick={onRename} aria-label="Yeniden adlandır" title="Yeniden adlandır">
          <PencilIcon />
        </button>
        {!imaging && (
          <button type="button" className="icon-btn hidden sm:inline-flex" onClick={onOpen} aria-label="Sonuçları gör veya yeniden oku" title="Sonuçları gör veya yeniden oku">
            <RefreshIcon />
          </button>
        )}
        <button type="button" className="icon-btn hover:text-danger" onClick={onDelete} aria-label="Sil" title="Sil">
          <TrashIcon />
        </button>
      </div>
    </li>
  );
}

function RenameDialog({ group, onClose, onSaved }: { group: DocGroup | null; onClose: () => void; onSaved: () => void }) {
  const file = group?.head ?? null;
  const vault = useUnlockedVault();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(file?.displayName ?? '');
    setError(null);
  }, [file]);

  const trimmed = name.trim();
  const valid = trimmed.length > 0 && trimmed.length <= MAX_DISPLAY_NAME;

  async function save() {
    if (!file || !valid) return;
    setBusy(true);
    try {
      for (const f of group?.files ?? [file]) await vault.renameFile(f.id, trimmed);
      onSaved();
    } catch (e) {
      setError(userMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={file !== null}
      onClose={onClose}
      title="Yeniden adlandır"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Vazgeç
          </button>
          <button type="button" className="btn-primary" onClick={save} disabled={!valid || busy}>
            Kaydet
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label htmlFor="rename" className="mb-1.5 block">
          Görünen ad
        </label>
        <input id="rename" className="field" value={name} maxLength={MAX_DISPLAY_NAME} onChange={(e) => setName(e.target.value)} autoFocus autoComplete="off" />
        <p className="mt-2 text-xs text-fg-faint">
          Yalnızca görünen ad değişir; orijinal dosya aynen kalır.{group && group.files.length > 1 ? ` Serideki ${group.files.length} kesitin hepsine uygulanır.` : ''}
        </p>
        {error && (
          <div className="mt-3">
            <Banner tone="error">{error}</Banner>
          </div>
        )}
      </form>
    </Dialog>
  );
}

function DeleteDialog({ group, onClose, onDeleted }: { group: DocGroup | null; onClose: () => void; onDeleted: () => void }) {
  const file = group?.head ?? null;
  const many = (group?.files.length ?? 0) > 1;
  const vault = useUnlockedVault();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setError(null), [file]);

  async function remove() {
    if (!file) return;
    setBusy(true);
    try {
      for (const f of group?.files ?? [file]) await deleteDocument(vault, f.id);
      onDeleted();
    } catch (e) {
      setError(userMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={file !== null}
      onClose={onClose}
      title="Belgeyi sil"
      tone="danger"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Vazgeç
          </button>
          <button type="button" className="btn-danger" onClick={remove} disabled={busy}>
            {busy ? <SpinnerIcon size={16} /> : <TrashIcon size={16} />} Kalıcı olarak sil
          </button>
        </>
      }
    >
      <p>
        <strong className="text-fg">{file?.displayName}</strong>
        {many ? ` serisinin ${group!.files.length} kesiti` : ''}, şifreleme {many ? 'anahtarları' : 'anahtarı'} ve bu belgeden çıkarılan tüm sonuçlar ve notlar bu cihazdan silinecek. Bu işlem geri alınamaz.
      </p>
      {error && (
        <div className="mt-3">
          <Banner tone="error">{error}</Banner>
        </div>
      )}
    </Dialog>
  );
}
