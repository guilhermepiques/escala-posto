import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DocMeta, HistoryEntry } from '../data/store';
import { buildContext, type PlanContext } from '../domain/context';
import { addMonths } from '../domain/dates';
import type { Assignments, MonthKey, Schedule } from '../domain/types';
import { review } from '../domain/validator';
import { useApp } from '../state';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/** Edições à mão: guarda a versão anterior no histórico no máximo a cada 30 minutos. */
const MANUAL_SNAPSHOT_MS = 30 * 60 * 1000;

const hasContent = (s: Schedule) => Object.values(s.assignments ?? {}).some((m) => Object.keys(m).length > 0);

/**
 * Carrega a escala do mês (e o mês anterior, para conferir a virada) em tempo real, salva automaticamente,
 * guarda versões anteriores no histórico e roda o revisor.
 */
export function useMonthSchedule(month: MonthKey) {
  const { store, config, employees, canEdit } = useApp();
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [meta, setMeta] = useState<DocMeta | null>(null);
  const [previous, setPrevious] = useState<Assignments | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const current = useRef<Schedule | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Escala editada aqui que ainda não foi enviada (o salvamento espera 600 ms). */
  const pending = useRef<Schedule | null>(null);
  const lastSnap = useRef<Record<string, number>>({});
  const canEditRef = useRef(canEdit);
  canEditRef.current = canEdit;

  const save = useCallback(
    (s: Schedule) => {
      store
        .saveSchedule(s)
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'));
    },
    [store],
  );

  /** Envia agora o que estiver esperando. */
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const s = pending.current;
    pending.current = null;
    if (s) save(s);
  }, [save]);

  useEffect(() => {
    setLoading(true);
    setSchedule(null);
    setMeta(null);
    setPrevious(undefined);
    current.current = null;
    setSaveState('idle');
    const unsubCur = store.watchSchedule(
      month,
      (s, m) => {
        // Enquanto há uma edição local esperando para salvar, ela vale mais que a cópia do servidor.
        if (pending.current?.month === month) return;
        const next = s ?? { month, assignments: {}, locked: {} };
        current.current = next;
        setSchedule(next);
        setMeta(m);
        setLoading(false);
      },
      () => {
        const empty = { month, assignments: {}, locked: {} };
        current.current = empty;
        setSchedule(empty);
        setLoading(false);
      },
    );
    const unsubPrev = store.watchSchedule(
      addMonths(month, -1),
      (s) => setPrevious(s?.assignments),
      () => setPrevious(undefined),
    );
    return () => {
      unsubCur();
      unsubPrev();
      // Trocou de mês com algo por salvar: salva já.
      flush();
    };
  }, [store, month, flush]);

  const persist = useCallback(
    (s: Schedule) => {
      if (timer.current) clearTimeout(timer.current);
      pending.current = s;
      setSaveState('saving');
      timer.current = setTimeout(flush, 600);
    },
    [flush],
  );

  /**
   * Muda a escala. `snapshot` = motivo para guardar a versão atual no histórico antes da mudança
   * (ex.: antes de gerar de novo). Sem motivo, edições à mão guardam uma versão a cada 30 minutos.
   */
  const update = useCallback(
    (fn: (s: Schedule) => Schedule, opts?: { snapshot?: string }) => {
      const prev = current.current;
      if (!prev || !canEditRef.current) return;
      const next: Schedule = { ...fn(prev), month: prev.month, updatedAt: Date.now() };
      // Qualquer mudança invalida a revisão anterior.
      delete next.reviewedAt;
      delete next.reviewOk;
      const now = Date.now();
      const reason =
        opts?.snapshot ?? (now - (lastSnap.current[prev.month] ?? 0) > MANUAL_SNAPSHOT_MS ? 'Antes de editar à mão' : null);
      if (reason && hasContent(prev)) {
        store.addHistory('schedule', prev.month, reason, prev).catch(() => undefined);
      }
      // Depois de gerar/limpar/restaurar, a próxima edição à mão guarda a versão nova no histórico.
      if (reason) lastSnap.current[prev.month] = opts?.snapshot ? 0 : now;
      current.current = next;
      setSchedule(next);
      persist(next);
    },
    [store, persist],
  );

  const markReviewed = useCallback(
    async (ok: boolean) => {
      const prev = current.current;
      if (!prev || !canEditRef.current) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      pending.current = null;
      const next = { ...prev, reviewedAt: Date.now(), reviewOk: ok };
      current.current = next;
      setSchedule(next);
      await store.saveSchedule(next);
    },
    [store],
  );

  const restore = useCallback(
    (entry: HistoryEntry<Schedule>) => update(() => ({ ...entry.data, month }), { snapshot: 'Antes de restaurar uma versão' }),
    [update, month],
  );

  const ctx: PlanContext = useMemo(
    () => buildContext(month, employees, config, previous),
    [month, employees, config, previous],
  );

  const issues = useMemo(() => (schedule ? review(ctx, schedule.assignments) : []), [ctx, schedule]);

  return { schedule, meta, previous, loading, saveState, update, markReviewed, restore, ctx, issues };
}
