import { weekdayLong } from '../../domain/dates';
import { effectiveDemand, MOVEMENT_LABEL } from '../../domain/demand';
import type { AppConfig, Movement } from '../../domain/types';
import { useApp } from '../../state';

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const LEVELS: Movement[] = ['alto', 'normal', 'baixo'];
const LEVEL_STYLE: Record<Movement, string> = {
  alto: 'bg-rose-600 text-white border-rose-600',
  normal: 'bg-slate-700 text-white border-slate-700',
  baixo: 'bg-sky-600 text-white border-sky-600',
};

export function MovementSection({ draft, setDraft }: { draft: AppConfig; setDraft: (fn: (d: AppConfig) => AppConfig) => void }) {
  const { employees } = useApp();
  const auto = draft.demandMode === 'auto';
  const computed = effectiveDemand(draft, employees);
  const workDays = 7 - draft.rules.restDaysPerWeek;

  const setMovement = (wd: number, m: Movement) => setDraft((d) => ({ ...d, movement: { ...d.movement, [wd]: m } }));
  const setMin = (sid: string, v: number) => setDraft((d) => ({ ...d, minPerShift: { ...d.minPerShift, [sid]: v } }));
  const setManual = (wd: number, sid: string, field: 'ideal' | 'min', v: number) =>
    setDraft((d) => ({
      ...d,
      demand: { ...d.demand, [wd]: { ...d.demand[wd], [sid]: { ...(d.demand[wd]?.[sid] ?? { ideal: 0, min: 0 }), [field]: v } } },
    }));

  const teams = (['dia', 'noite'] as const).map((team) => {
    const shifts = draft.shifts.filter((s) => s.team === team);
    const people = employees.filter((e) => e.active && e.team === team).length;
    const demand = WEEK_ORDER.reduce((acc, wd) => acc + shifts.reduce((a, s) => a + (computed[wd]?.[s.id]?.ideal ?? 0), 0), 0);
    return { team, shifts, people, capacity: people * workDays, demand };
  });

  return (
    <section className="card">
      <h2 className="mb-1 text-lg font-bold">Movimento e pessoas por turno</h2>
      <p className="mb-4 text-sm text-slate-600">
        Marque como é o movimento de cada dia. O app usa todos os turnos que a equipe consegue fazer na semana e coloca mais gente nos dias de
        mais movimento e menos nos de menos movimento.
      </p>

      <div className="mb-4 inline-flex rounded-lg border border-slate-300 p-0.5 text-sm">
        <button
          className={`rounded-md px-3 py-1.5 font-semibold ${auto ? 'bg-brand-700 text-white' : 'text-slate-700'}`}
          onClick={() => setDraft((d) => ({ ...d, demandMode: 'auto' }))}
        >
          Automático pelo movimento (recomendado)
        </button>
        <button
          className={`rounded-md px-3 py-1.5 font-semibold ${!auto ? 'bg-brand-700 text-white' : 'text-slate-700'}`}
          onClick={() => setDraft((d) => ({ ...d, demandMode: 'manual', demand: auto ? computed : d.demand }))}
        >
          Definir manualmente
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-600">
              <th className="py-2 pr-3">Dia</th>
              {auto && <th className="py-2 pr-3">Movimento</th>}
              {draft.shifts.map((s) => (
                <th key={s.id} className="py-2 pr-3">
                  {s.name}
                  {!auto && <span className="font-normal"> (ideal / mínimo)</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WEEK_ORDER.map((wd) => (
              <tr key={wd} className="border-t border-slate-100">
                <td className="py-1.5 pr-3 font-medium">{weekdayLong(wd)}</td>
                {auto && (
                  <td className="py-1.5 pr-3">
                    <div className="inline-flex gap-1">
                      {LEVELS.map((lv) => (
                        <button
                          key={lv}
                          className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                            (draft.movement[wd] ?? 'normal') === lv ? LEVEL_STYLE[lv] : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                          }`}
                          onClick={() => setMovement(wd, lv)}
                        >
                          {MOVEMENT_LABEL[lv]}
                        </button>
                      ))}
                    </div>
                  </td>
                )}
                {draft.shifts.map((s) =>
                  auto ? (
                    <td key={s.id} className="py-1.5 pr-3 text-base font-bold">
                      {computed[wd]?.[s.id]?.ideal ?? 0}
                      <span className="ml-1 text-xs font-normal text-slate-500">pessoas</span>
                    </td>
                  ) : (
                    <td key={s.id} className="py-1.5 pr-3">
                      <div className="flex items-center gap-1">
                        <NumberInput value={draft.demand[wd]?.[s.id]?.ideal ?? 0} onChange={(v) => setManual(wd, s.id, 'ideal', v)} />
                        <span className="text-slate-400">/</span>
                        <NumberInput value={draft.demand[wd]?.[s.id]?.min ?? 0} onChange={(v) => setManual(wd, s.id, 'min', v)} />
                      </div>
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {auto && (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="font-medium">Mínimo de pessoas por turno:</span>
          {draft.shifts.map((s) => (
            <label key={s.id} className="inline-flex items-center gap-1">
              {s.name}
              <NumberInput value={draft.minPerShift[s.id] ?? 2} onChange={(v) => setMin(s.id, v)} />
            </label>
          ))}
          <span className="text-xs text-slate-500">Abaixo do mínimo o revisor dá alerta. Na madrugada, recomendamos nunca menos de 2.</span>
        </div>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {teams
          .filter((t) => t.shifts.length > 0)
          .map((t) => (
            <div
              key={t.team}
              className={`rounded-xl border p-3 text-sm ${t.demand > t.capacity ? 'border-orange-200 bg-orange-50 text-orange-900' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
            >
              <b>{t.team === 'dia' ? 'Equipe do dia' : 'Madrugada'}:</b> {t.people} pessoas × {workDays} dias = <b>{t.capacity} turnos</b> por semana
              · a tabela pede <b>{t.demand}</b>
              {t.demand > t.capacity && ` — faltam ${t.demand - t.capacity}, alguns turnos vão ficar abaixo do ideal`}
            </div>
          ))}
      </div>
    </section>
  );
}

export function NumberInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      min={0}
      max={30}
      className="input w-16 px-2 py-1 text-center"
      value={value}
      onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
    />
  );
}
