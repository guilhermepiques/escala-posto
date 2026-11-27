import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { absenceOn, allowedShifts, type PlanContext } from '../domain/context';
import { formatDate, weekday, weekdayShort } from '../domain/dates';
import type { Employee, ISODate, Issue, Schedule } from '../domain/types';

const ABS_LABEL: Record<string, string> = { ferias: 'FÉR', atestado: 'AT', afastamento: 'AF', maternidade: 'LM', outro: 'AUS' };

interface Props {
  ctx: PlanContext;
  schedule: Schedule;
  issues: Issue[];
  onSet: (empId: string, date: ISODate, shiftId: string | null) => void;
  onToggleLock: (empId: string, date: ISODate) => void;
  highlight?: { empId?: string; date?: ISODate } | null;
}

export function ScheduleGrid({ ctx, schedule, issues, onSet, onToggleLock, highlight }: Props) {
  const [menu, setMenu] = useState<{ empId: string; date: ISODate; x: number; y: number } | null>(null);
  const a = schedule.assignments;
  const locked = schedule.locked ?? {};

  // Problemas por célula e por funcionário
  const cellIssues = useMemo(() => {
    const m = new Map<string, Issue['severity']>();
    for (const i of issues) {
      if (!i.employeeId || !i.date) continue;
      const k = `${i.employeeId}|${i.date}`;
      const cur = m.get(k);
      if (!cur || rank(i.severity) < rank(cur)) m.set(k, i.severity);
    }
    return m;
  }, [issues]);
  const empIssues = useMemo(() => {
    const s = new Set<string>();
    for (const i of issues) if (i.employeeId && i.severity === 'erro') s.add(i.employeeId);
    return s;
  }, [issues]);

  // Agrupa funcionários por equipe
  const groups = useMemo(() => {
    const res: Array<{ title: string; colors: string[]; emps: Employee[] }> = [];
    for (const team of ['dia', 'noite'] as const) {
      const emps = ctx.employees.filter((e) => e.team === team);
      const shifts = ctx.shifts.filter((s) => s.team === team);
      if (emps.length)
        res.push({
          title: `${team === 'dia' ? 'Equipe do dia' : 'Madrugada'} (${shifts.map((s) => `${s.name.toLowerCase()} ${s.start}–${s.end}`).join(' / ')})`,
          colors: shifts.map((s) => s.color),
          emps,
        });
    }
    return res;
  }, [ctx]);

  const cols = ctx.days.length;

  return (
    <div className="relative overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full border-collapse text-xs select-none">
        <thead className="sticky top-0 z-10 bg-white">
          <tr>
            <th className="sticky left-0 z-20 min-w-40 border-b border-slate-200 bg-white px-3 py-2 text-left text-sm">
              Funcionário
            </th>
            {ctx.days.map((d) => {
              const wd = weekday(d);
              const hol = ctx.holidays.get(d);
              return (
                <th
                  key={d}
                  title={hol ? `Feriado: ${hol}` : formatDate(d)}
                  className={`min-w-8 border-b border-l border-slate-200 px-0.5 py-1 text-center font-semibold ${
                    hol ? 'bg-amber-100 text-amber-900' : wd === 0 ? 'bg-rose-50 text-rose-800' : 'text-slate-600'
                  }`}
                >
                  <div className="text-[10px] font-medium uppercase">{weekdayShort(wd).slice(0, 3)}</div>
                  <div className="text-sm">{Number(d.slice(8))}</div>
                  {hol && <div className="text-[9px] leading-none">feriado</div>}
                </th>
              );
            })}
            <th className="min-w-16 border-b border-l border-slate-200 px-2 text-center text-[11px] text-slate-600">
              Turnos
              <br />/ Dom. folga
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <Fragment key={g.title}>
              <tr>
                <td
                  colSpan={cols + 2}
                  className="sticky left-0 border-y border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold tracking-wide text-slate-700 uppercase"
                >
                  {g.colors.map((c) => (
                    <span key={c} className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: c }} />
                  ))}
                  <span className="ml-1">{g.title}</span>
                </td>
              </tr>
              {g.emps.map((emp) => {
                const worked = ctx.days.filter((d) => a[emp.id]?.[d]).length;
                const sundaysOff = ctx.days.filter((d) => weekday(d) === 0 && !a[emp.id]?.[d]).length;
                return (
                  <tr key={emp.id} className={highlight?.empId === emp.id ? 'bg-yellow-50' : ''}>
                    <td
                      className={`sticky left-0 z-[5] border-b border-slate-100 bg-white px-3 py-1 text-sm font-medium whitespace-nowrap ${
                        empIssues.has(emp.id) ? 'text-red-700' : 'text-slate-800'
                      }`}
                    >
                      {emp.name}
                      {emp.female && <span className="ml-1 text-[10px] text-pink-600" title="Mulher: domingo de folga a cada 2 semanas">♀</span>}
                    </td>
                    {ctx.days.map((d) => {
                      const sid = a[emp.id]?.[d];
                      const shift = sid ? ctx.shiftById.get(sid) : undefined;
                      const abs = absenceOn(emp, d);
                      const sev = cellIssues.get(`${emp.id}|${d}`);
                      const isLocked = !!locked[emp.id]?.[d];
                      const hl = highlight?.empId === emp.id && highlight?.date === d;
                      const wd = weekday(d);
                      return (
                        <td
                          key={d}
                          className={`relative border-b border-l border-slate-100 p-0.5 text-center ${wd === 0 ? 'bg-rose-50/40' : ''}`}
                        >
                          <button
                            className={`flex h-7 w-full items-center justify-center rounded-md text-[11px] font-bold transition-shadow hover:ring-2 hover:ring-brand-600 ${
                              sev === 'erro'
                                ? 'ring-2 ring-red-600'
                                : sev === 'atencao'
                                  ? 'ring-2 ring-orange-400'
                                  : ''
                            } ${hl ? 'outline-2 outline-offset-1 outline-yellow-400' : ''}`}
                            style={
                              shift
                                ? { background: shift.color, color: 'white' }
                                : abs
                                  ? { background: '#e2e8f0', color: '#475569' }
                                  : { color: '#cbd5e1' }
                            }
                            title={
                              shift
                                ? `${shift.name} ${shift.start}–${shift.end}${isLocked ? ' (travado)' : ''}`
                                : abs
                                  ? 'Ausência'
                                  : `Folga${isLocked ? ' (travada)' : ''}`
                            }
                            onClick={(e) => {
                              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              setMenu({ empId: emp.id, date: d, x: r.left, y: r.bottom });
                            }}
                          >
                            {shift ? shift.code : abs && !sid ? ABS_LABEL[abs.type] : 'F'}
                          </button>
                          {isLocked && (
                            <span className="pointer-events-none absolute top-0 right-0.5 text-[8px]" title="Travado">
                              🔒
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="border-b border-l border-slate-100 px-2 text-center text-[11px] text-slate-600">
                      {worked} / {sundaysOff}
                    </td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td
              colSpan={cols + 2}
              className="sticky left-0 border-t-2 border-slate-300 bg-slate-50 px-3 py-1 text-xs font-bold tracking-wide text-slate-700 uppercase"
            >
              Pessoas por turno (escaladas / ideal)
            </td>
          </tr>
          {ctx.shifts.map((s) => (
            <tr key={s.id}>
              <td className="sticky left-0 z-[5] border-b border-slate-100 bg-white px-3 py-1 text-sm font-medium whitespace-nowrap">
                <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                {s.name}
              </td>
              {ctx.days.map((d) => {
                const dem = ctx.config.demand[weekday(d)]?.[s.id];
                const n = ctx.employees.filter((e) => a[e.id]?.[d] === s.id).length;
                const cls = !dem
                  ? 'text-slate-500'
                  : n < dem.min
                    ? 'bg-red-100 text-red-800'
                    : n < dem.ideal
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-50 text-emerald-800';
                return (
                  <td key={d} className={`border-b border-l border-slate-100 px-0.5 py-1 text-center text-[11px] font-semibold ${cls}`}>
                    {n}
                    {dem && <span className="font-normal opacity-60">/{dem.ideal}</span>}
                  </td>
                );
              })}
              <td className="border-b border-l border-slate-100" />
            </tr>
          ))}
        </tfoot>
      </table>

      {menu && (
        <CellMenu
          ctx={ctx}
          schedule={schedule}
          menu={menu}
          onClose={() => setMenu(null)}
          onSet={(sid) => {
            onSet(menu.empId, menu.date, sid);
            setMenu(null);
          }}
          onToggleLock={() => {
            onToggleLock(menu.empId, menu.date);
            setMenu(null);
          }}
        />
      )}
    </div>
  );
}

function rank(s: Issue['severity']) {
  return s === 'erro' ? 0 : s === 'atencao' ? 1 : 2;
}

function CellMenu({
  ctx,
  schedule,
  menu,
  onClose,
  onSet,
  onToggleLock,
}: {
  ctx: PlanContext;
  schedule: Schedule;
  menu: { empId: string; date: ISODate; x: number; y: number };
  onClose: () => void;
  onSet: (sid: string | null) => void;
  onToggleLock: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    setTimeout(() => document.addEventListener('mousedown', h), 0);
    document.addEventListener('keydown', k);
    return () => {
      document.removeEventListener('mousedown', h);
      document.removeEventListener('keydown', k);
    };
  }, [onClose]);

  const emp = ctx.employees.find((e) => e.id === menu.empId)!;
  const cur = schedule.assignments[menu.empId]?.[menu.date];
  const isLocked = !!schedule.locked?.[menu.empId]?.[menu.date];
  const abs = absenceOn(emp, menu.date);
  const own = allowedShifts(ctx, emp).map((s) => s.id);
  const left = Math.min(menu.x, window.innerWidth - 240);
  const top = Math.min(menu.y + 4, window.innerHeight - 280);

  return (
    <div
      ref={ref}
      className="fixed z-50 w-56 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-xl"
      style={{ left, top }}
    >
      <div className="px-2 pb-2 text-xs text-slate-500">
        <b className="text-slate-800">{emp.name}</b> — {weekdayShort(weekday(menu.date))} {formatDate(menu.date)}
        {abs && <div className="mt-1 text-orange-700">Este dia está marcado como ausência.</div>}
      </div>
      {ctx.shifts.map((s) => (
        <button
          key={s.id}
          className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-100 ${cur === s.id ? 'bg-slate-100 font-semibold' : ''}`}
          onClick={() => onSet(s.id)}
        >
          <span className="inline-flex h-5 w-6 items-center justify-center rounded text-[11px] font-bold text-white" style={{ background: s.color }}>
            {s.code}
          </span>
          {s.name}
          {!own.includes(s.id) && <span className="ml-auto text-[10px] text-orange-600">fora da equipe</span>}
        </button>
      ))}
      <button
        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-100 ${!cur ? 'bg-slate-100 font-semibold' : ''}`}
        onClick={() => onSet(null)}
      >
        <span className="inline-flex h-5 w-6 items-center justify-center rounded border border-slate-300 text-[11px] font-bold text-slate-400">F</span>
        Folga
      </button>
      <div className="my-1 border-t border-slate-100" />
      <button className="w-full rounded-lg px-2 py-1.5 text-left text-slate-700 hover:bg-slate-100" onClick={onToggleLock}>
        {isLocked ? '🔓 Destravar (o gerador pode mudar)' : '🔒 Travar (o gerador não muda)'}
      </button>
      <p className="px-2 pt-1 text-[11px] text-slate-500">Toda mudança feita à mão fica travada automaticamente.</p>
    </div>
  );
}
