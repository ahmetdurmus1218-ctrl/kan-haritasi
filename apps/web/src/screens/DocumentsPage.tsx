import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { ACCEPT_ATTRIBUTE, sanitizeFileName, splitExtension } from '@kh/ingest';
import { type FileInfo, MAX_DISPLAY_NAME, type Vault } from '@kh/vault';
import { useUnlockedVault, useVault } from '../state/VaultContext';
import { type Route } from '../state/router';
import { processUpload, type UploadPhase } from '../lib/upload';
import { formatBytes, formatDate, KIND_LABEL } from '../lib/format';
import { userMessage } from '../lib/messages';
import { webPlatform } from '../platform-web';

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
  ImageIcon,
  PencilIcon,
  RefreshIcon,
  SpinnerIcon,
  TrashIcon,
  UploadIcon,
  XIcon,
  AlertIcon,
} from '../components/icons';

interface QueueItem {
  key: string;
  name: string;
  phase: UploadPhase;
  message?: string;
  notes: string[];
  file?: FileInfo;
}

export async function downloadOriginal(vault: Vault, id: string): Promise<void> {
  const { info, bytes } = await vault.readFile(id);
  const { ext } = splitExtension(info.originalFileName);
  const name = sanitizeFileName(ext ? `${info.displayName}.${ext}` : info.displayName);
  await webPlatform.files.save(name, bytes, info.mimeType);
}

export function DocumentsPage({ navigate }: { navigate: (r: Route) => void }) {
  const vault = useUnlockedVault();
  const { revision, bump } = useVault();
  const [files, setFiles] = useState<FileInfo[] | null>(null);
  const [corrupt, setCorrupt] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [renaming, setRenaming] = useState<FileInfo | null>(null);
  const [deleting, setDeleting] = useState<FileInfo | null>(null);
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

  const pending = useRef<{ item: QueueItem; file: File }[]>([]);

  const enqueue = useCallback(
    async (list: File[]) => {
      if (!list.length) return;
      const items: QueueItem[] = list.map((f, i) => ({
        key: `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
        name: sanitizeFileName(f.name),
        phase: 'checking',
        notes: [],
      }));
      setQueue((q) => [...items, ...q]);
      pending.current.push(...items.map((item, i) => ({ item, file: list[i]! })));
      if (uploading.current) return; // çalışan döngü yeni öğeleri de alır
      uploading.current = true;
      try {
        // Dosyalar sırayla işlenir: aynı anda tek dosya belleğe açılır.
        for (let next = pending.current.shift(); next; next = pending.current.shift()) {
          const { item, file } = next;
          const update = (patch: Partial<QueueItem>) => setQueue((q) => q.map((x) => (x.key === item.key ? { ...x, ...patch } : x)));
          const outcome = await processUpload(vault, file, uploadDeps, (phase) => update({ phase }));
          update({ phase: outcome.phase, message: outcome.message, notes: outcome.notes, file: outcome.file });
          if (outcome.phase === 'done') bump();
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

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-caps mb-1.5">Belgelerim</p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">Laboratuvar raporların</h1>
          <p className="mt-1.5 text-sm text-fg-muted">Yalnızca bu cihazda, dosya başına ayrı anahtarla şifreli.</p>
        </div>
        {files && files.length > 0 && (
          <p className="text-sm text-fg-muted">
            {files.length} belge · {formatBytes(files.reduce((n, f) => n + f.size, 0))}
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

      <section className="mt-3" aria-label="Belgeler">
        {files === null && !loadError ? (
          <div className="flex items-center gap-2 py-10 text-sm text-fg-muted">
            <SpinnerIcon size={16} /> Belgeler çözülüyor…
          </div>
        ) : files && files.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink-600 px-6 py-12 text-center">
            <p className="font-medium">Henüz belge yok</p>
            <p className="mt-1 text-sm text-fg-muted">İlk tahlil raporunu yukarıdan yükle; PDF veya telefonla çekilmiş fotoğraf olabilir.</p>
          </div>
        ) : (
          <ul className="divide-y divide-ink-700 overflow-hidden rounded-2xl border border-ink-600/60 bg-ink-850/60">
            {files?.map((f) => (
              <DocumentRow
                key={f.id}
                file={f}
                busy={busyId === f.id}
                onOpen={() => navigate({ name: 'document', id: f.id })}
                onDownload={() => onDownload(f)}
                onRename={() => setRenaming(f)}
                onDelete={() => setDeleting(f)}
              />
            ))}
          </ul>
        )}
      </section>

      <RenameDialog
        file={renaming}
        onClose={() => setRenaming(null)}
        onSaved={() => {
          setRenaming(null);
          bump();
        }}
      />
      <DeleteDialog
        file={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => {
          setDeleting(null);
          setNotice('Belge ve anahtarı kalıcı olarak silindi.');
          setQueue((q) => q.filter((x) => x.file?.id !== deleting?.id));
          bump();
        }}
      />
    </div>
  );
}

function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [over, setOver] = useState(false);
  const pickRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const take = (list: FileList | null) => {
    if (list?.length) onFiles([...list]);
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
      className={`relative overflow-hidden rounded-2xl border border-dashed px-6 py-9 text-center transition ${
        over ? 'border-accent bg-accent/8' : 'border-ink-500 bg-ink-850/50'
      }`}
    >
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/25 bg-accent/10 text-accent">
        <UploadIcon size={22} />
      </div>
      <h2 className="text-base font-semibold">Laboratuvar Raporunu Yükle</h2>
      <p className="mt-1 text-sm text-fg-muted">
        <span className="hidden md:inline">PDF veya fotoğraf sürükleyip bırak</span>
        <span className="md:hidden">PDF seç veya raporun fotoğrafını çek</span>
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button type="button" className="btn-primary" onClick={() => pickRef.current?.click()}>
          <FileTextIcon size={16} /> Dosya seç
        </button>
        <button type="button" className="btn-ghost md:hidden" onClick={() => cameraRef.current?.click()}>
          <CameraIcon size={16} /> Fotoğraf çek
        </button>
      </div>
      <p className="mt-4 text-xs text-fg-faint">PDF, JPG, PNG · en fazla 20 MB · dosya bu cihazdan çıkmaz</p>
      <input
        ref={pickRef}
        type="file"
        className="sr-only"
        accept={ACCEPT_ATTRIBUTE}
        multiple
        tabIndex={-1}
        onChange={(e) => {
          take(e.target.files);
          e.target.value = '';
        }}
      />
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
  const label = {
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
        {item.notes.map((n) => (
          <p key={n} className="mt-0.5 text-xs text-fg-muted">
            {n}
          </p>
        ))}
      </div>
      {item.file && (item.phase === 'done' || item.phase === 'duplicate') && (
        <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => onOpen(item.file!.id)}>
          Aç
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
  busy,
  onOpen,
  onDownload,
  onRename,
  onDelete,
}: {
  file: FileInfo;
  busy: boolean;
  onOpen: () => void;
  onDownload: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const isPdf = file.kind === 'pdf';
  return (
    <li className="group flex items-center gap-3 px-3 py-3 transition hover:bg-ink-800/60 md:px-4">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`${file.displayName} belgesini görüntüle`}>
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
            isPdf ? 'border-accent/25 bg-accent/8 text-accent' : 'border-low/25 bg-low/8 text-low'
          }`}
        >
          {isPdf ? <FileTextIcon size={19} /> : <ImageIcon size={19} />}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-medium">{file.displayName}</span>
          <span className="mt-0.5 block text-xs text-fg-muted">
            {formatDate(file.createdAt)} · {KIND_LABEL[file.kind]} · {formatBytes(file.size)}
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
        <button type="button" className="icon-btn hidden sm:inline-flex" disabled aria-label="Yeniden analiz et (Faz 3)" title="Yeniden analiz: okuma hattı Faz 3'te bağlanacak">
          <RefreshIcon />
        </button>
        <button type="button" className="icon-btn hover:text-danger" onClick={onDelete} aria-label="Sil" title="Sil">
          <TrashIcon />
        </button>
      </div>
    </li>
  );
}

function RenameDialog({ file, onClose, onSaved }: { file: FileInfo | null; onClose: () => void; onSaved: () => void }) {
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
      await vault.renameFile(file.id, trimmed);
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
        <p className="mt-2 text-xs text-fg-faint">Yalnızca görünen ad değişir; orijinal dosya aynen kalır.</p>
        {error && (
          <div className="mt-3">
            <Banner tone="error">{error}</Banner>
          </div>
        )}
      </form>
    </Dialog>
  );
}

function DeleteDialog({ file, onClose, onDeleted }: { file: FileInfo | null; onClose: () => void; onDeleted: () => void }) {
  const vault = useUnlockedVault();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setError(null), [file]);

  async function remove() {
    if (!file) return;
    setBusy(true);
    try {
      await vault.deleteFile(file.id);
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
        <strong className="text-fg">{file?.displayName}</strong> ve şifreleme anahtarı bu cihazdan silinecek. Belgeden çıkarılan sonuçlar da (Faz 3) onunla birlikte
        silinir. Bu işlem geri alınamaz.
      </p>
      {error && (
        <div className="mt-3">
          <Banner tone="error">{error}</Banner>
        </div>
      )}
    </Dialog>
  );
}
