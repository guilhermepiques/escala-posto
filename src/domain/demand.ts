import type { AppConfig, Demand, Employee, Movement, Team } from './types';

/** Peso de cada nível de movimento na hora de distribuir as pessoas pelos dias. */
export const MOVEMENT_WEIGHT: Record<Movement, number> = { alto: 1.2, normal: 1, baixo: 0.8 };

export const MOVEMENT_LABEL: Record<Movement, string> = {
  alto: 'Mais movimento',
  normal: 'Normal',
  baixo: 'Menos movimento',
};

/**
 * Pessoas por turno que a escala vai buscar.
 * - manual: a tabela definida pelo gerente;
 * - auto: distribui os turnos que a equipe consegue fazer na semana (pessoas × dias de trabalho)
 *   pelos dias e turnos, dando mais gente aos dias de mais movimento, sem ficar abaixo do mínimo.
 */
export function effectiveDemand(config: AppConfig, employees: Employee[]): Demand {
  if (config.demandMode !== 'auto') return config.demand;
  const workDays = 7 - config.rules.restDaysPerWeek;
  const res: Demand = {};
  for (let wd = 0; wd < 7; wd++) res[wd] = {};

  for (const team of ['dia', 'noite'] as Team[]) {
    const shifts = config.shifts.filter((s) => s.team === team);
    if (shifts.length === 0) continue;
    const people = employees.filter((e) => e.active && e.team === team).length;
    const capacity = people * workDays;
    const slots: Array<{ wd: number; sid: string; w: number; m: number; ideal: number }> = [];
    for (let wd = 0; wd < 7; wd++) {
      for (const s of shifts) {
        const m = people === 0 ? 0 : Math.max(0, config.minPerShift?.[s.id] ?? 2);
        slots.push({ wd, sid: s.id, w: MOVEMENT_WEIGHT[config.movement?.[wd] ?? 'normal'], m, ideal: m });
      }
    }
    const sumMin = slots.reduce((a, x) => a + x.m, 0);
    const sumW = slots.reduce((a, x) => a + x.w, 0);
    let rest = capacity - sumMin;
    if (rest > 0 && sumW > 0) {
      // quanto cada vaga "gostaria" a mais que o mínimo, proporcional ao movimento
      const extra = slots.map((x) => Math.max(0, (capacity * x.w) / sumW - x.m));
      const sumExtra = extra.reduce((a, x) => a + x, 0) || 1;
      const share = extra.map((e) => (rest * e) / sumExtra);
      slots.forEach((x, i) => {
        const f = Math.floor(share[i] + 1e-9);
        x.ideal += f;
        rest -= f;
      });
      // sobras: maior resto primeiro; empate -> dia de mais movimento
      const order = slots
        .map((x, i) => ({ i, r: share[i] - Math.floor(share[i] + 1e-9), w: x.w }))
        .sort((p, q) => q.r - p.r || q.w - p.w || p.i - q.i);
      for (let k = 0; rest > 0 && k < order.length; k++, rest--) slots[order[k].i].ideal += 1;
    }
    for (const x of slots) res[x.wd][x.sid] = { ideal: x.ideal, min: x.m };
  }
  return res;
}
