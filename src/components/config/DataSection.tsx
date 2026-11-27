import { useCallback, useRef, useState } from 'react';
import { backupFileName, makeBackup, parseBackup, type BackupFile } from '../../data/backup';
import type { TrashedEmployee } from '../../data/store';
import { formatTimestamp } from '../../domain/dates';
import type { AppConfig } from '../../domain/types';
import { useApp } from '../../state';
import { APP_VERSION } from '../../version';
import { useConfirm } from '../Dialog';
import { HistoryDialog } from '../HistoryDialog';

const DAY = 24 * 60 * 60 * 1000;

/** Backup em arquivo, funcionários excluídos e versões anteriores das configurações. */
export function DataSection() {
  const { store, config, employees, posto, canEdit, saveConfig } = useApp();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [trash, setTrash] = useState<TrashedEmployee[] | null>(null);
  const [showConfigHistory, setShowConfigHistory] = useState(false);
  const [confirmDialog, ask] = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const lastKey = `escala:ultimoBackup:${posto?.id ?? 'local'}`;
  const [lastBackup, setLastBackup] = useState<number | null>(() => {
    try {
      const v = localStorage.getItem(lastKey);
      return v ? Number(v) : null;
    } catch {
      return null;
    }
  });

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setMsg(null);
    try {
      setMsg({ ok: true, text: await fn() });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const download = () =>
    run(async () => {
      const schedules = await store.listSchedules();
      const b = makeBackup({ config, employees, schedules }, APP_VERSION);
      const url = URL.createObjectURL(new Blob([JSON.stringify(b, null, 1)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = backupFileName(b);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      const now = Date.now();
      try {
        localStorage.setItem(lastKey, String(now));
      } catch {
        /* ignora */
      }
      setLastBackup(now);
      return `Backup baixado (${a.download}): ${employees.length} funcionários e ${schedules.length} mês(es) de escala. Guarde o arquivo num lugar seguro (pendrive, Google Drive ou e-mail).`;
    });

  const restoreFile = async (file: File) => {
    let b: BackupFile;
    try {
      b = parseBackup(await file.text());
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
      return;
    }
    const ok = await ask({
      title: 'Restaurar este backup?',
      message: (
        <>
          <p className="mb-2">
            Backup {b.businessName ? `de “${b.businessName}” ` : ''}feito em {formatTimestamp(b.exportedAt)}: {b.employees.length} funcionários e{' '}
            {b.schedules.length} mês(es) de escala.
          </p>
          <p>
            As configurações e a lista de funcionários voltam a ser as do arquivo, e as escalas dos meses que estão no arquivo são
            substituídas. Nada se perde de vez: a versão de agora fica no histórico e quem não estiver no arquivo vai para os funcionários
            excluídos.
          </p>
        </>
      ),
      confirmLabel: 'Restaurar backup',
      danger: true,
    });
    if (!ok) return;
    run(async () => {
      await store.importAll(b);
      return 'Backup restaurado.';
    });
  };

  const loadTrash = () =>
    run(async () => {
      const t = await store.listTrash();
      setTrash(t);
      return t.length ? `${t.length} funcionário(s) excluído(s).` : 'Nenhum funcionário excluído.';
    });

  const loadConfigHistory = useCallback(() => store.listHistory<AppConfig>('config', 'config'), [store]);

  const stale = !lastBackup || Date.now() - lastBackup > 30 * DAY;

  return (
    <section className="card">
      <h2 className="mb-1 text-lg font-bold">Segurança dos dados</h2>
      <p className="mb-4 text-sm text-slate-600">
        Os dados ficam guardados na nuvem e o app também guarda versões anteriores das escalas (botão “🕘 Histórico” na escala do mês). Mesmo
        assim, baixe um backup de vez em quando: é uma cópia completa num arquivo, fora da internet.
      </p>

      <h3 className="mb-2 text-sm font-semibold">Backup em arquivo</h3>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button className="btn btn-primary" disabled={busy} onClick={download}>
          ⬇ Baixar backup
        </button>
        {canEdit && (
          <>
            <button className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>
              ⬆ Restaurar de um arquivo
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) restoreFile(f);
              }}
            />
          </>
        )}
      </div>
      <p className={`mb-5 text-xs ${stale ? 'text-amber-700' : 'text-slate-500'}`}>
        {lastBackup ? `Último backup baixado neste aparelho: ${formatTimestamp(lastBackup)}.` : 'Nenhum backup baixado neste aparelho ainda.'}
        {stale && ' Recomendado: um por mês, depois de fechar a escala.'}
      </p>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <h3 className="mb-1 text-sm font-semibold">Funcionários excluídos</h3>
          <p className="mb-2 text-xs text-slate-500">Quem foi excluído fica guardado aqui e pode voltar.</p>
          {trash === null ? (
            <button className="btn btn-sm" disabled={busy} onClick={loadTrash}>
              Ver excluídos
            </button>
          ) : trash.length === 0 ? (
            <p className="text-sm text-slate-600">Nenhum funcionário excluído.</p>
          ) : (
            <ul className="space-y-1">
              {trash.map((t) => (
                <li key={t.employee.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <b>{t.employee.name}</b>
                    <span className="text-xs text-slate-500">
                      {' '}
                      · excluído em {formatTimestamp(t.deletedAt)}
                      {(t.byName || t.by) && ` por ${t.byName ?? t.by}`}
                    </span>
                  </span>
                  {canEdit && (
                    <button
                      className="btn btn-sm"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await store.restoreEmployee(t.employee.id);
                          setTrash((prev) => (prev ?? []).filter((x) => x.employee.id !== t.employee.id));
                          return `${t.employee.name} voltou para a lista de funcionários.`;
                        })
                      }
                    >
                      Restaurar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="mb-1 text-sm font-semibold">Versões anteriores das configurações</h3>
          <p className="mb-2 text-xs text-slate-500">Cada vez que as configurações são salvas, a versão anterior fica guardada.</p>
          <button className="btn btn-sm" onClick={() => setShowConfigHistory(true)}>
            🕘 Ver versões
          </button>
        </div>
      </div>

      {msg && <p className={`mt-4 text-sm ${msg.ok ? 'text-emerald-700' : 'text-red-700'}`}>{msg.text}</p>}

      {showConfigHistory && (
        <HistoryDialog<AppConfig>
          title="Versões anteriores das configurações"
          load={loadConfigHistory}
          canRestore={canEdit}
          onRestore={async (h) => {
            await store.addHistory('config', 'config', 'Antes de restaurar uma versão', config);
            await saveConfig(h.data);
          }}
          onClose={() => setShowConfigHistory(false)}
        />
      )}
      {confirmDialog}
    </section>
  );
}
