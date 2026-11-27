import { absenceOn, allowedShifts, type PlanContext, restWeeks, weeklyLimitHours, weeksOfMonth } from './context';
import { addDays, diffDays, weekday } from './dates';
import { restBetween, requiredRest } from './hours';
import type { Assignments, ISODate, Schedule } from './types';

/**
 * Gerador automático da escala.
 * Monta um modelo de otimização (programação inteira) com todas as regras como restrições
 * obrigatórias, e a cobertura dos turnos como objetivo. Resolvido pelo HiGHS (WebAssembly),
 * direto no navegador — sem servidor e sem inteligência artificial.
 */

export const WEIGHTS = {
  belowMin: 1000, // cada pessoa faltando abaixo do mínimo
  belowIdeal: 100, // cada pessoa faltando abaixo do ideal
  surplus: 1, // cada pessoa acima do ideal
  work: -3, // incentivo a usar as horas contratadas
  overtimeHour: 40, // cada hora extra semanal
  pairedRest: -0.5, // folgas emendadas (dois dias seguidos)
  shiftChange: 3, // cada troca manhã <-> tarde (evita troca todo dia; prefere blocos)
  balance: 0.3, // diferença entre nº de manhãs e tardes da pessoa no mês (rodízio justo)
};

class Lin {
  terms = new Map<string, number>();
  c = 0;
  add(v: string, coef = 1) {
    this.terms.set(v, (this.terms.get(v) ?? 0) + coef);
    return this;
  }
  addLin(o: Lin, k = 1) {
    o.terms.forEach((coef, v) => this.add(v, coef * k));
    this.c += o.c * k;
    return this;
  }
  get empty() {
    return [...this.terms.values()].every((x) => x === 0);
  }
}

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
}

function linToString(l: Lin): string {
  const parts: string[] = [];
  l.terms.forEach((coef, v) => {
    if (coef === 0) return;
    const sign = coef < 0 ? '-' : '+';
    parts.push(`${sign} ${fmtNum(Math.abs(coef))} ${v}`);
  });
  if (parts.length === 0) return '0 dummy';
  // Quebra em linhas para não criar linhas gigantes no formato LP.
  const lines: string[] = [];
  for (let i = 0; i < parts.length; i += 12) lines.push(parts.slice(i, i + 12).join(' '));
  return lines.join('\n   ');
}

export interface BuiltModel {
  lp: string;
  xVars: Map<string, { empId: string; date: ISODate; shiftId: string }>;
}

export function buildModel(ctx: PlanContext, schedule?: Schedule): BuiltModel {
  const r = ctx.config.rules;
  const H = ctx.histDays.length;
  // Planeja até o domingo da última semana (dias do mês seguinte só servem de "olhar adiante").
  const look = lookaheadDays(ctx);
  const plan = [...ctx.days, ...look];
  const all = [...ctx.histDays, ...plan];
  const n = plan.length;
  const locked = schedule?.locked ?? {};
  const current = schedule?.assignments ?? {};

  const xVars: BuiltModel['xVars'] = new Map();
  const binaries: string[] = [];
  const constraints: string[] = [];
  const obj = new Lin();
  let rowId = 0;
  const addRow = (l: Lin, op: '<=' | '>=' | '=', rhs: number) => {
    if (l.empty) return; // restrição só com constantes: ignorada (já conferida no histórico)
    let right = rhs - l.c;
    // Se o mês anterior já estourou a regra (ex.: escala antiga), o melhor possível é zerar o que falta:
    // evita que o modelo fique impossível por causa do histórico.
    if (op === '<=' && right < 0 && [...l.terms.values()].every((c) => c >= 0)) right = 0;
    constraints.push(` r${rowId++}: ${linToString(l)} ${op} ${fmtNum(right)}`);
  };

  // x[e][g][shiftId] -> nome da variável (g = índice em allDays; só para dias do mês)
  const X: Array<Array<Map<string, string>>> = ctx.employees.map(() => all.map(() => new Map()));

  // Rodízio semanal: cada pessoa da equipe do dia alterna de turno a cada semana (seg–dom).
  const weekly = r.rotation === 'livre' ? new Map<string, Map<ISODate, string>>() : rotationPlan(ctx, plan);

  ctx.employees.forEach((emp, ei) => {
    const allowed = allowedShifts(ctx, emp);
    const myWeeks = weekly.get(emp.id);
    plan.forEach((d, di) => {
      const g = H + di;
      const isLocked = !!locked[emp.id]?.[d];
      let options = allowed;
      if (myWeeks) {
        const sid = myWeeks.get(d);
        options = allowed.filter((s) => s.id === sid);
      }
      if (isLocked) {
        const sid = current[emp.id]?.[d];
        options = sid && ctx.shiftById.has(sid) ? [ctx.shiftById.get(sid)!] : [];
      } else if (absenceOn(emp, d)) {
        options = [];
      }
      options.forEach((s) => {
        const si = ctx.shifts.indexOf(s);
        const name = `x_${ei}_${di}_${si}`;
        X[ei][g].set(s.id, name);
        xVars.set(name, { empId: emp.id, date: d, shiftId: s.id });
        binaries.push(name);
        obj.add(name, WEIGHTS.work);
      });
      if (isLocked && options.length === 1) {
        addRow(new Lin().add(X[ei][g].get(options[0].id)!), '=', 1);
      }
    });
  });

  /** Variável (ou constante do histórico) "turno s no dia g". */
  const xs = (ei: number, g: number, sid: string): Lin => {
    const l = new Lin();
    if (g < H) {
      const emp = ctx.employees[ei];
      if (ctx.history[emp.id]?.[all[g]] === sid) l.c = 1;
      return l;
    }
    const v = X[ei][g].get(sid);
    if (v) l.add(v);
    return l;
  };
  /** "trabalha no dia g" (0/1). */
  const work = (ei: number, g: number): Lin => {
    const l = new Lin();
    for (const s of ctx.shifts) l.addLin(xs(ei, g, s.id));
    return l;
  };

  ctx.employees.forEach((emp, ei) => {
    // 1) No máximo um turno por dia
    for (let di = 0; di < n; di++) addRow(work(ei, H + di), '<=', 1);

    // 2) Descanso entre jornadas e folga completa
    for (let j = H; j < H + n; j++) {
      for (let k = 1; k <= r.restDaysPerWeek + 1; k++) {
        const i = j - k;
        if (i < 0) continue;
        for (const a of ctx.shifts) {
          for (const b of ctx.shifts) {
            const rest = restBetween(a, i, b, j);
            if (rest + 1e-9 >= requiredRest(r.minRestHours, k - 1, r.restAfterDayOff, r.restDaysPerWeek)) continue;
            const l = new Lin().addLin(xs(ei, i, a.id)).addLin(xs(ei, j, b.id));
            for (let m = i + 1; m < j; m++) l.addLin(work(ei, m), -1);
            addRow(l, '<=', 1);
          }
        }
      }
    }

    // 3) Máximo de dias seguidos
    const win = r.maxConsecutiveDays + 1;
    for (let end = H; end < H + n; end++) {
      const start = end - win + 1;
      if (start < 0) continue;
      const l = new Lin();
      for (let g = start; g <= end; g++) l.addLin(work(ei, g));
      addRow(l, '<=', r.maxConsecutiveDays);
    }

    // 4) Folgas por semana (segunda a domingo e, se ligado, domingo a sábado)
    for (const wk of restWeeks(ctx)) {
      const idx = Array.from({ length: 7 }, (_, k) => all.indexOf(addDays(wk.start, k))).filter((g) => g >= 0);
      const lDays = new Lin();
      idx.forEach((g) => lDays.addLin(work(ei, g)));
      addRow(lDays, '<=', 7 - r.restDaysPerWeek);
    }

    // 5) Horas semanais (semana legal: segunda a domingo)
    for (const monday of weeksOfMonth(ctx)) {
      const days = Array.from({ length: 7 }, (_, k) => addDays(monday, k));
      const idx = days.map((d) => all.indexOf(d)).filter((g) => g >= 0);

      const lHours = new Lin();
      idx.forEach((g) => {
        for (const s of ctx.shifts) lHours.addLin(xs(ei, g, s.id), ctx.hoursById.get(s.id)!.countedMinutes / 60);
      });
      if (!lHours.empty) {
        const ot = `ot_${ei}_${monday.replace(/-/g, '')}`;
        lHours.add(ot, -1);
        obj.add(ot, WEIGHTS.overtimeHour);
        addRow(lHours, '<=', weeklyLimitHours(ctx, monday));
      }
    }

    // 6) Domingo de folga a cada N semanas
    const W = emp.female ? r.sundayEveryWeeksWomen : r.sundayEveryWeeks;
    const sundays = all.map((d, g) => ({ d, g })).filter(({ d }) => weekday(d) === 0);
    for (let k = W - 1; k < sundays.length; k++) {
      const w = sundays.slice(k - W + 1, k + 1);
      if (w[w.length - 1].g < H) continue;
      const l = new Lin();
      w.forEach(({ g }) => l.addLin(work(ei, g)));
      addRow(l, '<=', W - 1);
    }

    // Rodízio: poucas trocas de turno (em blocos) e equilíbrio entre os turnos no mês
    const rot = allowedShifts(ctx, emp);
    if (rot.length > 1 && r.rotation === 'livre') {
      for (let j = H + 1; j < H + n; j++) {
        for (let k = 1; k <= 3; k++) {
          const i = j - k;
          if (i < H) continue;
          const sw = `sw_${ei}_${j - H}_${k}`;
          let used = false;
          for (const a of rot) {
            for (const b of rot) {
              if (a.id === b.id) continue;
              const l = new Lin().addLin(xs(ei, i, a.id)).addLin(xs(ei, j, b.id)).add(sw, -1);
              for (let m = i + 1; m < j; m++) l.addLin(work(ei, m), -1);
              addRow(l, '<=', 1);
              used = true;
            }
          }
          if (used) obj.add(sw, WEIGHTS.shiftChange);
        }
      }
    }
    // Rodízio justo: no mês, número parecido de turnos em cada um dos dois turnos
    if (rot.length === 2) {
      const [a, b] = rot;
      const diff = new Lin();
      for (let g = H; g < H + ctx.days.length; g++) diff.addLin(xs(ei, g, a.id)).addLin(xs(ei, g, b.id), -1);
      const dev = `dev_${ei}`;
      obj.add(dev, WEIGHTS.balance);
      addRow(new Lin().addLin(diff).add(dev, -1), '<=', 0);
      addRow(new Lin().addLin(diff, -1).add(dev, -1), '<=', 0);
    }

    // Preferência: folgas emendadas
    for (let di = 0; di + 1 < n; di++) {
      const g = H + di;
      if (absenceOn(emp, plan[di]) || absenceOn(emp, plan[di + 1])) continue;
      const y = `y_${ei}_${di}`;
      obj.add(y, WEIGHTS.pairedRest);
      // y <= 1 - work(g)  e  y <= 1 - work(g+1)
      addRow(new Lin().add(y).addLin(work(ei, g)), '<=', 1);
      addRow(new Lin().add(y).addLin(work(ei, g + 1)), '<=', 1);
    }
  });

  // Cobertura dos turnos
  plan.forEach((d, di) => {
    const g = H + di;
    const wd = weekday(d);
    for (const s of ctx.shifts) {
      const dem = ctx.config.demand[wd]?.[s.id];
      if (!dem) continue;
      const cov = new Lin();
      ctx.employees.forEach((_, ei) => cov.addLin(xs(ei, g, s.id)));
      const si = ctx.shifts.indexOf(s);
      const sMin = `smin_${di}_${si}`;
      const sId = `sid_${di}_${si}`;
      const sur = `sur_${di}_${si}`;
      obj.add(sMin, WEIGHTS.belowMin).add(sId, WEIGHTS.belowIdeal).add(sur, WEIGHTS.surplus);
      addRow(new Lin().addLin(cov).add(sMin), '>=', dem.min);
      addRow(new Lin().addLin(cov).add(sId), '>=', dem.ideal);
      addRow(new Lin().addLin(cov).add(sur, -1), '<=', dem.ideal);
    }
  });

  const lp = [
    'Minimize',
    ` obj: ${linToString(obj)}`,
    'Subject To',
    ...constraints,
    'Bounds',
    ...[...obj.terms.keys()].filter((v) => v.startsWith('y_')).map((v) => ` 0 <= ${v} <= 1`),
    'Binary',
    ...chunk(binaries, 20).map((c) => ' ' + c.join(' ')),
    'End',
  ].join('\n');

  return { lp, xVars };
}

/** Início do bloco de rodízio que contém `d` (blocos começam no dia da semana `startWd`). */
export function rotationBlockStart(d: ISODate, startWd: number): ISODate {
  return addDays(d, -((weekday(d) - startWd + 7) % 7));
}

const EPOCH = '2024-01-01';

/** Turno do último dia trabalhado no histórico (entre os turnos dados). */
function lastHistoryShift(ctx: PlanContext, empId: string, ids: string[]): { date: ISODate; shiftId: string } | null {
  for (let i = ctx.histDays.length - 1; i >= 0; i--) {
    const sid = ctx.history[empId]?.[ctx.histDays[i]];
    if (sid && ids.includes(sid)) return { date: ctx.histDays[i], shiftId: sid };
  }
  return null;
}

/**
 * Define o turno de cada dia para quem pode fazer dois turnos (equipe do dia):
 * - 'semanal': alterna em blocos de N semanas, continuando a alternância do mês anterior;
 * - 'fixo': cada um fica sempre no mesmo turno (o do mês anterior; sem histórico, divide a equipe).
 * Retorna: funcionário -> dia -> turno.
 */
export function rotationPlan(ctx: PlanContext, plan: ISODate[]): Map<string, Map<ISODate, string>> {
  const r = ctx.config.rules;
  const res = new Map<string, Map<ISODate, string>>();
  const rotating = ctx.employees.filter((e) => allowedShifts(ctx, e).length === 2);
  if (rotating.length === 0) return res;
  const [a, b] = allowedShifts(ctx, rotating[0]);

  if (r.rotation === 'fixo') {
    // Quantos devem ficar em cada turno, proporcional à demanda semanal.
    const demandOf = (sid: string) => Object.values(ctx.config.demand).reduce((acc, d) => acc + (d[sid]?.ideal ?? 0), 0);
    const fixedA = ctx.employees.filter((e) => e.fixedShiftId === a.id && allowedShifts(ctx, e).length === 1).length;
    const fixedB = ctx.employees.filter((e) => e.fixedShiftId === b.id && allowedShifts(ctx, e).length === 1).length;
    const total = rotating.length + fixedA + fixedB;
    const targetA = Math.max(0, Math.round((total * demandOf(a.id)) / Math.max(1, demandOf(a.id) + demandOf(b.id))) - fixedA);
    const chosen = new Map<string, string>();
    // Primeiro quem já estava num turno no mês anterior continua nele (se couber).
    let countA = 0;
    const pending: typeof rotating = [];
    for (const e of rotating) {
      const last = lastHistoryShift(ctx, e.id, [a.id, b.id]);
      if (last?.shiftId === a.id && countA < targetA) {
        chosen.set(e.id, a.id);
        countA++;
      } else if (last?.shiftId === b.id && rotating.length - targetA > chosen.size - countA) {
        chosen.set(e.id, b.id);
      } else pending.push(e);
    }
    for (const e of pending) {
      if (countA < targetA) {
        chosen.set(e.id, a.id);
        countA++;
      } else chosen.set(e.id, b.id);
    }
    for (const e of rotating) res.set(e.id, new Map(plan.map((d) => [d, chosen.get(e.id)!])));
    return res;
  }

  // Semanal: blocos de N semanas começando no dia configurado.
  const startWd = r.rotationStartWeekday ?? 1;
  const len = Math.max(1, r.rotationEveryWeeks ?? 1);
  const blockIndex = (d: ISODate) => Math.floor(diffDays(rotationBlockStart(EPOCH, startWd), rotationBlockStart(d, startWd)) / 7 / len);
  let k = 0;
  for (const emp of rotating) {
    let anchorIdx = blockIndex(plan[0]);
    let anchorShift = k % 2 === 0 ? a.id : b.id;
    k++;
    const last = lastHistoryShift(ctx, emp.id, [a.id, b.id]);
    if (last) {
      anchorIdx = blockIndex(last.date);
      anchorShift = last.shiftId;
    }
    const other = anchorShift === a.id ? b.id : a.id;
    res.set(emp.id, new Map(plan.map((d) => [d, (blockIndex(d) - anchorIdx) % 2 === 0 ? anchorShift : other])));
  }
  return res;
}

/** Dias do mês seguinte que completam a última semana (até domingo). */
export function lookaheadDays(ctx: PlanContext): ISODate[] {
  const last = ctx.days[ctx.days.length - 1];
  const res: ISODate[] = [];
  let d = last;
  while (weekday(d) !== 0) {
    d = addDays(d, 1);
    res.push(d);
  }
  return res;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
  return res;
}

export interface SolveOutcome {
  ok: boolean;
  status: string;
  assignments: Assignments;
  message?: string;
  seconds: number;
}

type HighsLike = { solve: (lp: string, opts?: Record<string, unknown>) => any };

export function solveWith(highs: HighsLike, ctx: PlanContext, schedule?: Schedule, timeLimit = 20): SolveOutcome {
  const t0 = performance.now();
  const { lp, xVars } = buildModel(ctx, schedule);
  const res = highs.solve(lp, {
    output_flag: false,
    time_limit: timeLimit,
    mip_rel_gap: 0.03,
    random_seed: 7,
  });
  const seconds = (performance.now() - t0) / 1000;
  const status: string = res.Status;
  const hasSolution =
    status === 'Optimal' ||
    ((status === 'Time limit reached' || status === 'Interrupted by user') && res.Columns && Object.keys(res.Columns).length > 0);
  if (!hasSolution) {
    return {
      ok: false,
      status,
      assignments: {},
      seconds,
      message:
        status === 'Infeasible'
          ? 'Não existe escala possível com as células travadas. Destrave algumas células e tente de novo.'
          : `O gerador não encontrou solução (${status}).`,
    };
  }
  const assignments: Assignments = {};
  const monthEnd = ctx.days[ctx.days.length - 1];
  xVars.forEach((info, name) => {
    if (info.date > monthEnd) return; // dia do mês seguinte (só olhar adiante)
    const col = res.Columns[name];
    if (col && col.Primal > 0.5) {
      (assignments[info.empId] ??= {})[info.date] = info.shiftId;
    }
  });
  return { ok: true, status, assignments, seconds };
}
