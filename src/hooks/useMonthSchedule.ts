import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildContext, type PlanContext } from '../domain/context';
import { addMonths } from '../domain/dates';
import type { Assignments, MonthKey, Schedule } from '../domain/types';
import { review } from '../domain/validator';
import { useApp } from '../state';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/** Carrega a escala do mês (e o mês anterior como histórico), salva automaticamente e roda o revisor. */
export function useMonthSchedule(month: MonthKey) {
  const { store, config, employees } = useApp();
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [previous, setPrevious] = useState<Assignments | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([store.getSchedule(month), store.getSchedule(addMonths(month, -1))]).then(([cur, prev]) => {
      if (!alive) return;
      setSchedule(cur ?? { month, assignments: {}, locked: {} });
      setPrevious(prev?.assignments);
      setLoading(false);
      setSaveState('idle');
    });
    return () => {
      alive = false;
    };
  }, [store, month]);

  const persist = useCallback(
    (s: Schedule) => {
      if (timer.current) clearTimeout(timer.current);
      setSaveState('saving');
      timer.current = setTimeout(() => {
        store
          .saveSchedule(s)
          .then(() => setSaveState('saved'))
          .catch(() => setSaveState('error'));
      }, 600);
    },
    [store],
  );

  const update = useCallback(
    (fn: (s: Schedule) => Schedule) => {
      setSchedule((prev) => {
        if (!prev) return prev;
        const next = { ...fn(prev), updatedAt: Date.now() };
        // Qualquer mudança invalida a revisão anterior.
        delete next.reviewedAt;
        delete next.reviewOk;
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const markReviewed = useCallback(
    async (ok: boolean) => {
      if (!schedule) return;
      const next = { ...schedule, reviewedAt: Date.now(), reviewOk: ok };
      setSchedule(next);
      await store.saveSchedule(next);
    },
    [schedule, store],
  );

  const ctx: PlanContext = useMemo(
    () => buildContext(month, employees, config, previous),
    [month, employees, config, previous],
  );

  const issues = useMemo(() => (schedule ? review(ctx, schedule.assignments) : []), [ctx, schedule]);

  return { schedule, previous, loading, saveState, update, markReviewed, ctx, issues };
}
