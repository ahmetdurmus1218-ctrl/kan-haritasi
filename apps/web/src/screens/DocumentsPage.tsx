import { useEffect, useState } from 'react';
import { sanitizeFileName, splitExtension } from '@kh/ingest';
import { type FileInfo, MAX_DISPLAY_NAME, type Vault } from '@kh/vault';
import { useUnlockedVault, useVault } from '../state/VaultContext';
import { type Route } from '../state/router';
import { CATEGORY_SHORT, isImaging, regionByKey } from '../lib/imaging';
import { type DocGroup, groupDocuments } from '../lib/documents';
import { formatBytes, formatDate, KIND_LABEL } from '../lib/format';
import { userMessage } from '../lib/messages';
import { deleteDocument } from '../lib/reports';
import { platform } from '../platform';

import { Banner, Dialog } from '../components/ui';
import { Uploader } from '../components/Uploader';
import { DataTabs } from '../components/DataTabs';
import {
  DownloadIcon,
  EyeIcon,
  FileTextIcon,
  ImageIcon,
  PencilIcon,
  ScanIcon,
  RefreshIcon,
  SpinnerIcon,
  TrashIcon,
  XIcon,
} from '../components/icons';

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
  const [renaming, setRenaming] = useState<DocGroup | null>(null);
  const [deleting, setDeleting] = useState<DocGroup | null>(null);
  const [filter, setFilter] = useState<'all' | 'lab' | 'imaging'>('all');
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  const groups = files ? groupDocuments(files) : null;
  const imagingCount = groups?.filter((g) => isImaging(g.head.category)).length ?? 0;
  const shown = groups?.filter((g) => filter === 'all' || (filter === 'imaging') === isImaging(g.head.category));

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-10">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">Belgelerim</h1>
        <p className="mt-1 text-sm text-fg-muted">
          {files && files.length > 0 ? `${groups!.length} belge · ${formatBytes(files.reduce((n, f) => n + f.size, 0))} · ` : ''}yalnızca bu cihazda, şifreli
        </p>
      </div>
      <DataTabs active="documents" />

      <Uploader navigate={navigate} />

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
          bump();
        }}
      />
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
