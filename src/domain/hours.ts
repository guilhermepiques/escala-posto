import { hmToMin } from './dates';
import type { Shift } from './types';

/** Fator da hora noturna reduzida: 60 min de relógio contam como 60/52,5 (CLT art. 73 §1º). */
export const NIGHT_FACTOR = 60 / 52.5;

const NIGHT_START = 22 * 60; // 22:00
const NIGHT_END = 29 * 60; // 05:00 do dia seguinte (em minutos a partir do dia de início)

export interface ShiftTiming {
  /** minutos desde 00:00 do dia de início */
  start: number;
  /** pode passar de 1440 quando termina no dia seguinte */
  end: number;
  breakStart: number;
  breakEnd: number;
}

export function shiftTiming(shift: Shift): ShiftTiming {
  const start = hmToMin(shift.start);
  let end = hmToMin(shift.end);
  if (end <= start) end += 24 * 60;
  const duration = end - start;
  const brk = Math.max(0, Math.min(shift.breakMinutes || 0, duration));
  let breakStart: number;
  if (shift.breakStart) {
    breakStart = hmToMin(shift.breakStart);
    if (breakStart < start) breakStart += 24 * 60;
    if (breakStart + brk > end) breakStart = end - brk;
  } else {
    breakStart = start + Math.floor((duration - brk) / 2);
  }
  return { start, end, breakStart, breakEnd: breakStart + brk };
}

function overlap(a1: number, a2: number, b1: number, b2: number): number {
  return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
}

export interface ShiftHours {
  /** Minutos de relógio efetivamente trabalhados (sem intervalo). */
  clockMinutes: number;
  /** Minutos de relógio em horário noturno (22h–5h, e prorrogação após 5h — Súmula 60, II, TST). */
  nightClockMinutes: number;
  /** Minutos que contam para a jornada (hora noturna reduzida aplicada). */
  countedMinutes: number;
  /** Duração total do turno no relógio (incluindo intervalo). */
  spanMinutes: number;
}

export function shiftHours(shift: Shift): ShiftHours {
  const t = shiftTiming(shift);
  const work: Array<[number, number]> = [
    [t.start, t.breakStart],
    [t.breakEnd, t.end],
  ].filter(([a, b]) => b > a) as Array<[number, number]>;

  // Janelas noturnas relativas ao dia de início: 00:00–05:00 e 22:00–05:00 (+1).
  const nightWindows: Array<[number, number]> = [
    [0, 5 * 60],
    [NIGHT_START, NIGHT_END],
  ];
  // Súmula 60, II: se cumpre integralmente o período noturno e prorroga, a prorrogação também é noturna.
  const coversWholeNight = t.start <= NIGHT_START && t.end >= NIGHT_END;
  if (coversWholeNight) nightWindows[1] = [NIGHT_START, t.end];

  let clock = 0;
  let night = 0;
  for (const [a, b] of work) {
    clock += b - a;
    for (const [n1, n2] of nightWindows) night += overlap(a, b, n1, n2);
  }
  const counted = clock - night + night * NIGHT_FACTOR;
  return {
    clockMinutes: clock,
    nightClockMinutes: night,
    countedMinutes: Math.round(counted * 100) / 100,
    spanMinutes: t.end - t.start,
  };
}

/** Início e fim absolutos (em minutos) de um turno trabalhado no dia de índice `dayIndex`. */
export function absoluteSpan(shift: Shift, dayIndex: number): { start: number; end: number } {
  const t = shiftTiming(shift);
  return { start: dayIndex * 1440 + t.start, end: dayIndex * 1440 + t.end };
}

/** Descanso (em horas) entre um turno no dia i e outro no dia j (j > i). */
export function restBetween(a: Shift, dayA: number, b: Shift, dayB: number): number {
  const x = absoluteSpan(a, dayA);
  const y = absoluteSpan(b, dayB);
  return (y.start - x.end) / 60;
}

/**
 * Descanso mínimo exigido entre dois turnos com `daysOffBetween` dias de folga no meio.
 * - sem folga: 11h (CLT art. 66)
 * - "sumula110": 24h do repouso + 11h = 35h (Súmula 110 do TST)
 * - "estrito": 24h por folga (até `restDaysPerWeek`) + 11h
 */
export function requiredRest(
  minRestHours: number,
  daysOffBetween: number,
  mode: 'sumula110' | 'estrito' = 'sumula110',
  restDaysPerWeek = 2,
): number {
  if (daysOffBetween <= 0) return minRestHours;
  if (mode === 'sumula110') return minRestHours + 24;
  return minRestHours + 24 * Math.min(daysOffBetween, restDaysPerWeek);
}
