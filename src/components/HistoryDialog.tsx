import { useEffect, useState, type ReactNode } from 'react';
import type { HistoryEntry } from '../data/store';
import { formatTimestamp } from '../domain/dates';
import { Modal, useConfirm } from './Dialog';

/** Lista as versões anteriores guardadas e deixa restaurar uma delas. */
export function HistoryDialog<T>({
  title,
  intro,
  load,
  describe,
  canRestore,
  onRestore,
  onClose,
}: {
  title: string;
  intro?: ReactNode;
  load: () => Promise<HistoryEntry<T>[]>;
  describe?: (data: T) => string;
  canRestore: boolean;
  onRestore: (e: HistoryEntry<T>) => Promise<void> | void;
  onClose: () => void;
}) {
  const [list, setList] = useState<HistoryEntry<T>[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDialog, ask] = useConfirm();

  useEffect(() => {
    load()
      .then(setList)
      .catch((e) => setErr(`Não foi possível carregar o histórico: ${(e as Error).message}`));
  }, [load]);

  return (
    <Modal onClose={onClose} wide>
      <h2 className="mb-1 text-xl font-bold">{title}</h2>
      {intro && <div className="mb-4 text-sm text-slate-600">{intro}</div>}
      {err && <p className="mb-3 text-sm text-red-700">{err}</p>}
      {!list && !err && <p className="text-sm text-slate-600">Carregando…</p>}
      {list && list.length === 0 && <p className="text-sm text-slate-600">Ainda não há versões anteriores guardadas.</p>}
      {list && list.length > 0 && (
        <ul className="space-y-2">
          {list.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{formatTimestamp(h.at)}</div>
                <div className="text-xs text-slate-600">
                  {h.reason}
                  {(h.byName || h.by) && ` · por ${h.byName ?? h.by}`}
                  {describe && ` · ${describe(h.data)}`}
                </div>
              </div>
              {canRestore && (
                <button
                  className="btn btn-sm"
                  disabled={busy}
                  onClick={async () => {
                    const ok = await ask({
                      title: 'Restaurar esta versão?',
                      message: `Volta para a versão de ${formatTimestamp(h.at)}. A versão de agora também fica guardada aqui no histórico, então dá para desfazer.`,
                      confirmLabel: 'Restaurar',
                    });
                    if (!ok) return;
                    setBusy(true);
                    try {
                      await onRestore(h);
                      onClose();
                    } catch (e) {
                      setErr(`Não foi possível restaurar: ${(e as Error).message}`);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Restaurar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-5 flex justify-end">
        <button className="btn" onClick={onClose}>
          Fechar
        </button>
      </div>
      {confirmDialog}
    </Modal>
  );
}
