import { addDays, monthDays, weekday } from './dates';
import { legalWeeklyLimit } from './defaults';
import { effectiveDemand } from './demand';
import { holidaysForMonth } from './holidays';
import { shiftHours, type ShiftHours } from './hours';
import type { Absence, AppConfig, Assignments, Employee, ISODate, MonthKey, Shift } from './types';

/** Quantos dias do mês anterior são levados em conta (folgas, dias seguidos, domingos). */
export const HISTORY_DAYS = 21;

export interface PlanContext {
  month: MonthKey;
  /** Dias do mês planejado. */
  days: ISODate[];
  /** Dias anteriores ao mês (histórico, já trabalhados). */
  histDays: ISODate[];
  /** Histórico + mês, em ordem. */
  allDays: ISODate[];
  employees: Employee[];
  shifts: Shift[];
  shiftById: Map<string, Shift>;
  hoursById: Map<string, ShiftHours>;
  config: AppConfig;
  holidays: Map<ISODate, string>;
  /** Atribuições do histórico (mês anterior). */
  history: Assignments;
}

export function buildContext(
  month: MonthKey,
  employees: Employee[],
  config: AppConfig,
  previous: Assignments | undefined,
): PlanContext {
  const days = monthDays(month);
  const histDays = Array.from({ length: HISTORY_DAYS }, (_, i) => addDays(days[0], i - HISTORY_DAYS));
  const shiftById = new Map(config.shifts.map((s) => [s.id, s]));
  const hoursById = new Map(config.shifts.map((s) => [s.id, shiftHours(s)]));
  const holidays = holidaysForMonth(month, config.customHolidays);
  const active = employees.filter((e) => e.active);
  return {
    month,
    days,
    histDays,
    allDays: [...histDays, ...days],
    employees: active,
    shifts: config.shifts,
    shiftById,
    hoursById,
    config: { ...config, demand: effectiveDemand(config, active) },
    holidays,
    history: previous ?? {},
  };
}

export function absenceOn(emp: Employee, date: ISODate): Absence | undefined {
  return emp.absences.find((a) => date >= a.start && date <= a.end);
}

/** Turnos que o funcionário pode receber. */
export function allowedShifts(ctx: PlanContext, emp: Employee): Shift[] {
  if (emp.fixedShiftId && ctx.shiftById.has(emp.fixedShiftId)) return [ctx.shiftById.get(emp.fixedShiftId)!];
  if (!ctx.config.rules.forbidDayNightMix) return ctx.shifts;
  return ctx.shifts.filter((s) => s.team === emp.team);
}

/** Limite semanal efetivo (o menor entre a configuração e a lei vigente no domingo da semana). */
export function weeklyLimitHours(ctx: PlanContext, monday: ISODate): number {
  return Math.min(ctx.config.rules.weeklyHoursLimit, legalWeeklyLimit(addDays(monday, 6)));
}

/** Segundas-feiras das semanas que tocam o mês. */
export function weeksOfMonth(ctx: PlanContext): ISODate[] {
  return weekStartsTouching(ctx, 1);
}

/** Inícios das semanas (começando no dia `startWd`: 1 = segunda, 0 = domingo) que tocam o mês. */
export function weekStartsTouching(ctx: PlanContext, startWd: number): ISODate[] {
  const d0 = ctx.days[0];
  const first = addDays(d0, -((weekday(d0) - startWd + 7) % 7));
  const last = ctx.days[ctx.days.length - 1];
  const res: ISODate[] = [];
  for (let m = first; m <= last; m = addDays(m, 7)) res.push(m);
  return res;
}

/** Semanas usadas para contar as 2 folgas: segunda a domingo e, se ligado, domingo a sábado. */
export function restWeeks(ctx: PlanContext): Array<{ start: ISODate; label: string }> {
  const res = weekStartsTouching(ctx, 1).map((start) => ({ start, label: 'segunda a domingo' }));
  if (ctx.config.rules.alsoSundayWeeks) {
    res.push(...weekStartsTouching(ctx, 0).map((start) => ({ start, label: 'domingo a sábado' })));
  }
  return res;
}

/** Turno atribuído (histórico ou mês). */
export function assignedShift(
  ctx: PlanContext,
  assignments: Assignments,
  empId: string,
  date: ISODate,
): string | undefined {
  if (date < ctx.days[0]) return ctx.history[empId]?.[date];
  return assignments[empId]?.[date];
}
