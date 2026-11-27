import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useConfirm } from '../components/Dialog';
import { GenerateDialog } from '../components/GenerateDialog';
import { HistoryDialog } from '../components/HistoryDialog';
import { IssueList, SeverityBadge } from '../components/IssueList';
import { ScheduleGrid } from '../components/ScheduleGrid';
import { addMonths, currentMonth, formatMonth, formatTimestamp } from '../domain/dates';
import type { SolveOutcome } from '../domain/solver';
import type { SolveRequest } from '../domain/solver.worker';
import type { ISODate, Issue, Rules, Schedule } from '../domain/types';
import { summarize } from '../domain/validator';
import { useMonthSchedule } from '../hooks/useMonthSchedule';
import type { HistoryEntry, Store } from '../data/store';
import { useApp } from '../state';

export default function SchedulePage() {
  const [params, setParams] = useSearchParams();
  const month = params.get('mes') ?? defaultMonth();
  const setMonth = (m: string) => setParams({ mes: m });
  const { config, employees, saveConfig, canEdit, store } = useApp();
  const [showGenerate, setShowGenerate] = useState(false);
  const [confirmDialog, ask] = useConfirm();
  const { schedule, meta, previous, loading, saveState, update, markReviewed, restore, ctx, issues } = useMonthSchedule(month);
  const [showHistory, setShowHistory] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [highlight, setHighlight] = useState<{ empId?: string; date?: ISODate } | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const counts = summarize(issues);
  const activeEmps = employees.filter((e) => e.active);
  const hasAny = schedule && Object.values(schedule.assignments).some((m) => Object.keys(m).length > 0);

  const generate = (patch: Partial<Rules>) => {
    if (!schedule) return;
    setShowGenerate(false);
    const cfg = { ...config, rules: { ...config.rules, ...patch } };
    // Guarda a escolha para os próximos meses.
    saveConfig(cfg).catch(() => undefined);
    setGenerating(true);
    setGenMsg(null);
    workerRef.current?.terminate();
    const w = new Worker(new URL('../domain/solver.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = w;
    w.onmessage = (ev: MessageEvent<SolveOutcome>) => {
      const out = ev.data;
      setGenerating(false);
      w.terminate();
      if (!out.ok) {
        setGenMsg(out.message ?? 'Não foi possível gerar a escala.');
        return;
      }
      update((s) => ({ ...s, assignments: out.assignments, generatedAt: Date.now() }), { snapshot: 'Antes de gerar de novo' });
      setGenMsg(`Escala gerada em ${out.seconds.toFixed(1)} segundos.`);
    };
    w.onerror = (e) => {
      setGenerating(false);
      setGenMsg(`Erro no gerador: ${e.message}`);
    };
    // No mês atual, os dias que já passaram ficam como estão (são tratados como travados).
    const today = todayISO();
    const locked: Schedule['locked'] = JSON.parse(JSON.stringify(schedule.locked ?? {}));
    if (today.startsWith(month)) {
      for (const e of activeEmps) {
        for (const d of ctx.days) if (d < today) (locked![e.id] ??= {})[d] = true;
      }
    }
    const req: SolveRequest = { month, employees: activeEmps, config: cfg, previous, schedule: { ...schedule, locked } };
    w.postMessage(req);
  };

  const setCell = (empId: string, date: ISODate, shiftId: string | null) =>
    update((s) => {
      const assignments = { ...s.assignments, [empId]: { ...(s.assignments[empId] ?? {}) } };
      if (shiftId) assignments[empId][date] = shiftId;
      else delete assignments[empId][date];
      const locked = { ...(s.locked ?? {}), [empId]: { ...(s.locked?.[empId] ?? {}), [date]: true } };
      return { ...s, assignments, locked };
    });

  const toggleLock = (empId: string, date: ISODate) =>
    update((s) => {
      const locked = { ...(s.locked ?? {}), [empId]: { ...(s.locked?.[empId] ?? {}) } };
      if (locked[empId][date]) delete locked[empId][date];
      else locked[empId][date] = true;
      return { ...s, locked };
    });

  const unlockAll = () => update((s) => ({ ...s, locked: {} }));
  const clearAll = async () => {
    const ok = await ask({
      title: 'Apagar a escala deste mês?',
      message: 'Todas as células serão apagadas, inclusive as travadas (🔒).',
      confirmLabel: 'Apagar',
      danger: true,
    });
    if (ok) update((s) => ({ ...s, assignments: {}, locked: {} }), { snapshot: 'Antes de limpar o mês' });
  };

  const lockedCount = schedule ? Object.values(schedule.locked ?? {}).reduce((n, m) => n + Object.keys(m).length, 0) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <button className="btn btn-sm border-0 shadow-none" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mês anterior">
            ◀
          </button>
          <h1 className="min-w-48 text-center text-lg font-bold">{formatMonth(month)}</h1>
          <button className="btn btn-sm border-0 shadow-none" onClick={() => setMonth(addMonths(month, 1))} aria-label="Próximo mês">
            ▶
          </button>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => setShowGenerate(true)} disabled={generating || loading || activeEmps.length === 0}>
            {generating ? 'Calculando…' : hasAny ? '↻ Gerar de novo' : '⚡ Gerar escala automática'}
          </button>
        )}
        <button className="btn" onClick={() => setShowExport(true)} disabled={!hasAny}>
          ✓ Revisar e exportar
        </button>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {canEdit && lockedCount > 0 && (
            <button className="btn btn-sm" onClick={unlockAll}>
              🔓 Destravar tudo ({lockedCount})
            </button>
          )}
          {canEdit && hasAny && (
            <button className="btn btn-sm" onClick={clearAll}>
              Limpar mês
            </button>
          )}
          <button className="btn btn-sm" onClick={() => setShowHistory(true)} title="Versões anteriores desta escala">
            🕘 Histórico
          </button>
          <span>
            {saveState === 'saving'
              ? 'Salvando…'
              : saveState === 'error'
                ? '⚠ Erro ao salvar'
                : meta?.updatedAt
                  ? `${saveState === 'saved' ? '✓ Salvo · ' : ''}Última alteração: ${meta.updatedByName ?? meta.updatedBy ?? ''}${meta.updatedByName || meta.updatedBy ? ', ' : ''}${formatTimestamp(meta.updatedAt)}`
                  : saveState === 'saved'
                    ? '✓ Salvo'
                    : ''}
          </span>
        </div>
      </div>

      {activeEmps.length === 0 && (
        <div className="card text-slate-700">
          Ainda não há funcionários cadastrados. <Link className="font-semibold text-brand-700 underline" to="/funcionarios">Cadastre os funcionários</Link> para gerar a escala.
        </div>
      )}

      {generating && (
        <div className="rounded-xl border border-brand-100 bg-brand-50 p-3 text-sm text-brand-800">
          Calculando a melhor escala respeitando todas as regras… isso pode levar até 30 segundos.
        </div>
      )}
      {genMsg && !generating && <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">{genMsg}</div>}
      {!previous && hasAny && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          O mês anterior ({formatMonth(addMonths(month, -1))}) não está no sistema. Por isso o revisor não consegue conferir a virada do mês
          (folgas da semana, dias seguidos e domingos). Confira os primeiros dias com atenção.
        </div>
      )}

      {loading || !schedule ? (
        <div className="card">Carregando…</div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
          <div className="min-w-0">
            <ScheduleGrid
              ctx={ctx}
              schedule={schedule}
              issues={issues}
              onSet={setCell}
              onToggleLock={toggleLock}
              highlight={highlight}
              readOnly={!canEdit}
            />
            <Legend />
          </div>
          <aside className="space-y-3">
            <div className="card">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-bold">Revisor</h2>
                <div className="flex gap-1">
                  {counts.erro > 0 && <SeverityBadge s="erro" n={counts.erro} />}
                  {counts.atencao > 0 && <SeverityBadge s="atencao" n={counts.atencao} />}
                  {counts.aviso > 0 && <SeverityBadge s="aviso" n={counts.aviso} />}
                </div>
              </div>
              <p className="mb-3 text-xs text-slate-500">Confere a escala a cada mudança. Clique num item para destacar na grade.</p>
              {hasAny ? (
                <div className="max-h-[60vh] overflow-y-auto pr-1">
                  <IssueList issues={issues} onSelect={(i: Issue) => setHighlight({ empId: i.employeeId, date: i.date })} />
                </div>
              ) : (
                <p className="text-sm text-slate-600">Gere a escala para ver a revisão.</p>
              )}
            </div>
          </aside>
        </div>
      )}

      {showGenerate && (
        <GenerateDialog
          rules={config.rules}
          hasExisting={!!hasAny}
          isCurrentMonth={todayISO().startsWith(month)}
          onCancel={() => setShowGenerate(false)}
          onGenerate={generate}
        />
      )}
      {confirmDialog}

      {showHistory && (
        <HistoryDialog<Schedule>
          title={`Histórico — ${formatMonth(month)}`}
          intro="Antes de gerar de novo, limpar ou restaurar, a versão anterior fica guardada aqui. Edições à mão guardam uma versão a cada 30 minutos. Ficam as últimas 30."
          load={historyLoader(store, month)}
          describe={(s) => `${countShifts(s)} turnos marcados`}
          canRestore={canEdit}
          onRestore={restore}
          onClose={() => setShowHistory(false)}
        />
      )}

      {showExport && schedule && (
        <ExportDialog
          month={month}
          schedule={schedule}
          issues={issues}
          onClose={() => setShowExport(false)}
          onReviewed={markReviewed}
        />
      )}
    </div>
  );
}

const loaders = new WeakMap<object, Map<string, () => Promise<HistoryEntry<Schedule>[]>>>();
/** Função estável por mês (a janela de histórico recarrega quando ela muda). */
function historyLoader(store: Store, month: string) {
  let m = loaders.get(store);
  if (!m) loaders.set(store, (m = new Map()));
  let f = m.get(month);
  if (!f) m.set(month, (f = () => store.listHistory<Schedule>('schedule', month)));
  return f;
}

const countShifts = (s: Schedule) => Object.values(s.assignments ?? {}).reduce((n, m) => n + Object.keys(m).length, 0);

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** A escala costuma ser feita para o mês seguinte a partir do dia 15. */
function defaultMonth() {
  const m = currentMonth();
  return new Date().getDate() >= 15 ? addMonths(m, 1) : m;
}

function Legend() {
  const { config } = useApp();
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
      {config.shifts.map((s) => (
        <span key={s.id} className="flex items-center gap-1">
          <span className="inline-flex h-5 w-6 items-center justify-center rounded text-[11px] font-bold text-white" style={{ background: s.color }}>
            {s.code}
          </span>
          {s.name} {s.start}–{s.end}
        </span>
      ))}
      <span className="flex items-center gap-1">
        <span className="inline-flex h-5 w-6 items-center justify-center rounded border border-slate-200 text-[11px] font-bold text-slate-300">F</span>
        Folga
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-flex h-5 w-8 items-center justify-center rounded bg-slate-200 text-[10px] font-bold text-slate-600">FÉR</span>
        Férias / AT atestado / AF afastamento / LM licença-maternidade
      </span>
      <span>🔒 travado</span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded bg-rose-100" /> domingo
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded bg-amber-200" /> feriado
      </span>
    </div>
  );
}

function ExportDialog({
  month,
  schedule,
  issues,
  onClose,
  onReviewed,
}: {
  month: string;
  schedule: Schedule;
  issues: Issue[];
  onClose: () => void;
  onReviewed: (ok: boolean) => Promise<void>;
}) {
  const c = summarize(issues);
  const blocked = c.erro > 0;
  const [ack, setAck] = useState(c.atencao === 0);
  const errors = issues.filter((i) => i.severity === 'erro');
  const others = issues.filter((i) => i.severity !== 'erro');

  const open = async () => {
    await onReviewed(true);
    window.open(`/imprimir/${month}`, '_blank');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-1 text-xl font-bold">Revisão final — {formatMonth(month)}</h2>
        <p className="mb-4 text-sm text-slate-600">
          O revisor conferiu a escala inteira, inclusive as mudanças feitas à mão, contra as regras do 5x2, da CLT e da convenção coletiva.
        </p>
        {blocked ? (
          <>
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
              ✗ A escala tem {c.erro} erro(s) legal(is). Corrija antes de exportar — assim o posto fica protegido.
            </div>
            <IssueList issues={errors} />
          </>
        ) : (
          <>
            <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
              ✓ Nenhum erro legal. A escala está dentro das regras do 5x2.
            </div>
            {others.length > 0 && (
              <>
                <p className="mb-2 text-sm text-slate-700">Pontos para conferir (não impedem a exportação):</p>
                <div className="mb-3 max-h-72 overflow-y-auto pr-1">
                  <IssueList issues={others} />
                </div>
              </>
            )}
            {c.atencao > 0 && (
              <label className="mb-3 flex items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" className="mt-1" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                Estou ciente dos itens de atenção (ex.: turno abaixo do mínimo) e quero exportar mesmo assim.
              </label>
            )}
          </>
        )}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button className="btn" onClick={onClose}>
            Voltar
          </button>
          {!blocked && (
            <button className="btn btn-primary" disabled={!ack} onClick={open}>
              Abrir para imprimir / WhatsApp
            </button>
          )}
        </div>
        {schedule.reviewedAt && (
          <p className="mt-3 text-right text-xs text-slate-500">Última revisão aprovada: {formatTimestamp(schedule.reviewedAt)}</p>
        )}
      </div>
    </div>
  );
}
