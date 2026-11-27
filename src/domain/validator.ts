import {
  absenceOn,
  allowedShifts,
  assignedShift,
  type PlanContext,
  restWeeks,
  weeklyLimitHours,
  weeksOfMonth,
} from './context';
import { addDays, diffDays, formatDateShort, minToHM, monthOf, weekday, weekdayShort } from './dates';
import { holidaysForMonth } from './holidays';
import { restBetween, requiredRest } from './hours';
import type { Assignments, Issue, ISODate } from './types';

/**
 * Revisor: confere a escala (inclusive alterações manuais) contra as regras.
 * - erro: quebra regra legal/convenção -> bloqueia a exportação
 * - atencao: problema operacional sério (ex.: abaixo do mínimo de pessoas)
 * - aviso: informação importante (hora extra prevista, feriado em dobro...)
 */
export function review(ctx: PlanContext, assignments: Assignments): Issue[] {
  const issues: Issue[] = [];
  const r = ctx.config.rules;
  const monthStart = ctx.days[0];
  const monthEnd = ctx.days[ctx.days.length - 1];
  const dayIndex = new Map(ctx.allDays.map((d, i) => [d, i]));

  // ---------- Regras sobre os turnos em si ----------
  for (const s of ctx.shifts) {
    const h = ctx.hoursById.get(s.id)!;
    if (h.countedMinutes > r.dailyHoursHardLimit * 60) {
      issues.push({
        severity: 'erro',
        code: 'TURNO_LONGO_DEMAIS',
        shiftId: s.id,
        title: `Turno ${s.name} conta ${minToHM(h.countedMinutes)} por dia`,
        detail: `O máximo permitido, já contando hora extra, é ${r.dailyHoursHardLimit}h por dia.`,
        basis: 'CLT art. 59 (máximo de 2 horas extras por dia)',
        suggestion: 'Diminua o turno ou aumente o intervalo nas Configurações.',
      });
    } else if (h.countedMinutes > r.dailyHoursLimit * 60 + 0.5) {
      issues.push({
        severity: 'aviso',
        code: 'TURNO_COM_EXTRA',
        shiftId: s.id,
        title: `Turno ${s.name} conta ${minToHM(h.countedMinutes)} por dia (acima de ${r.dailyHoursLimit}h)`,
        detail:
          h.nightClockMinutes > 0
            ? 'Por causa da hora noturna reduzida (52min30s), esse turno passa de 8h. O excedente é hora extra (50%) e precisa ser pago.'
            : 'O excedente é hora extra (50%) e precisa ser pago.',
        basis: 'CF art. 7º, XIII; CLT art. 73 §1º',
        suggestion: s.team === 'noite' ? 'Com 1h de intervalo a madrugada fica em 8h exatas.' : undefined,
      });
    }
  }

  // ---------- Regras por funcionário ----------
  for (const emp of ctx.employees) {
    const seq = ctx.allDays.map((d) => assignedShift(ctx, assignments, emp.id, d));
    const worked = (i: number) => seq[i] !== undefined && ctx.shiftById.has(seq[i]!);
    const allowed = new Set(allowedShifts(ctx, emp).map((s) => s.id));
    const name = emp.name;

    // Turnos durante ausência / turno não permitido
    for (const d of ctx.days) {
      const sid = assignments[emp.id]?.[d];
      if (!sid) continue;
      const abs = absenceOn(emp, d);
      if (abs) {
        issues.push({
          severity: 'erro',
          code: 'TRABALHO_EM_AUSENCIA',
          employeeId: emp.id,
          date: d,
          title: `${name} está escalado(a) em ${formatDateShort(d)}, mas está de ${labelAbsence(abs.type)}`,
          detail: 'Funcionário de férias, atestado ou afastado não pode ser escalado.',
          suggestion: 'Remova o turno deste dia ou corrija o período de ausência.',
        });
      }
      if (!allowed.has(sid)) {
        const sh = ctx.shiftById.get(sid);
        issues.push({
          severity: 'atencao',
          code: 'TURNO_NAO_PERMITIDO',
          employeeId: emp.id,
          date: d,
          title: `${name} foi colocado(a) no turno ${sh?.name ?? sid} em ${formatDateShort(d)}`,
          detail: emp.fixedShiftId
            ? `${name} está cadastrado(a) para trabalhar só no turno ${ctx.shiftById.get(emp.fixedShiftId)?.name ?? ''}.`
            : `Esse turno não é da equipe de ${name} (${emp.team === 'noite' ? 'madrugada' : 'dia'}).`,
        });
      }
    }

    // Mistura dia/noite no mês (risco de turno ininterrupto de revezamento)
    if (r.forbidDayNightMix) {
      const teams = new Set<string>();
      for (const d of ctx.days) {
        const sid = assignments[emp.id]?.[d];
        if (sid && ctx.shiftById.has(sid)) teams.add(ctx.shiftById.get(sid)!.team);
      }
      if (teams.size > 1) {
        issues.push({
          severity: 'erro',
          code: 'MISTURA_DIA_NOITE',
          employeeId: emp.id,
          title: `${name} trabalha de dia e de madrugada no mesmo mês`,
          detail:
            'Alternar entre turnos de dia e de madrugada pode ser considerado "turno ininterrupto de revezamento", ' +
            'e aí o limite cai para 6h por dia. A convenção coletiva não autoriza 8h nesse regime.',
          basis: 'CF art. 7º, XIV; OJ 360 SDI-1 do TST',
          suggestion: 'Deixe cada pessoa só na equipe do dia ou só na da madrugada durante o mês.',
        });
      }
    }

    // Descanso entre jornadas (11h) e folga completa (24h + 11h por folga)
    let prev = -1;
    for (let i = 0; i < seq.length; i++) {
      if (!worked(i)) continue;
      if (prev >= 0) {
        const a = ctx.shiftById.get(seq[prev]!)!;
        const b = ctx.shiftById.get(seq[i]!)!;
        const off = i - prev - 1;
        const rest = restBetween(a, prev, b, i);
        const need = requiredRest(r.minRestHours, off, r.restAfterDayOff, r.restDaysPerWeek);
        const d = ctx.allDays[i];
        if (rest + 1e-9 < need && d >= monthStart) {
          issues.push({
            severity: 'erro',
            code: off === 0 ? 'DESCANSO_ENTRE_JORNADAS' : 'FOLGA_INCOMPLETA',
            employeeId: emp.id,
            date: d,
            title:
              off === 0
                ? `${name}: só ${fmtH(rest)} de descanso antes do turno de ${formatDateShort(d)}`
                : `${name}: a folga antes de ${formatDateShort(d)} ficou curta (${fmtH(rest)})`,
            detail:
              off === 0
                ? `Entre o fim de um turno (${a.name}) e o começo do próximo (${b.name}) é preciso pelo menos ${r.minRestHours}h de descanso.`
                : `Depois de folga, o descanso precisa ser de pelo menos ${need}h (${r.restAfterDayOff === 'sumula110' ? '24h da folga' : '24h por folga'} + ${r.minRestHours}h entre jornadas). Se ficar assim, as horas que faltam viram hora extra.`,
            basis: off === 0 ? 'CLT art. 66' : 'CLT arts. 66 e 67; Súmula 110 do TST',
            suggestion:
              off === 0
                ? 'Depois da tarde, não coloque a pessoa de manhã no dia seguinte (o mesmo vale de madrugada para tarde).'
                : 'Para voltar da tarde para a manhã, a pessoa precisa de 2 folgas no meio (com 1 folga só dá 32h de descanso).',
          });
        }
      }
      prev = i;
    }

    // Dias seguidos de trabalho
    let run = 0;
    for (let i = 0; i < seq.length; i++) {
      run = worked(i) ? run + 1 : 0;
      const d = ctx.allDays[i];
      if (run === r.maxConsecutiveDays + 1 && d >= monthStart) {
        issues.push({
          severity: 'erro',
          code: 'DIAS_SEGUIDOS',
          employeeId: emp.id,
          date: d,
          title: `${name}: ${run} dias seguidos de trabalho até ${formatDateShort(d)}`,
          detail: `O máximo é ${r.maxConsecutiveDays} dias seguidos; a folga não pode passar do 7º dia.`,
          basis: 'CLT art. 67; OJ 410 SDI-1 do TST; Portaria MTE 2.041/2026',
          suggestion: 'Coloque uma folga antes desse dia.',
        });
      }
    }

    // Duas folgas por semana (segunda a domingo e, se ligado, domingo a sábado)
    const maxWork = 7 - r.restDaysPerWeek;
    for (const wk of restWeeks(ctx)) {
      const weekDays = Array.from({ length: 7 }, (_, k) => addDays(wk.start, k));
      const known = weekDays.filter((d) => dayIndex.has(d) && d <= monthEnd);
      if (!known.some((d) => d >= monthStart)) continue;
      const workedDays = known.filter((d) => worked(dayIndex.get(d)!));
      if (workedDays.length > maxWork) {
        issues.push({
          severity: 'erro',
          code: 'FOLGAS_SEMANA',
          employeeId: emp.id,
          date: wk.start < monthStart ? monthStart : wk.start,
          title: `${name}: ${workedDays.length} dias de trabalho de ${weekdayShort(weekday(wk.start)).toLowerCase()} ${formatDateShort(wk.start)} a ${weekdayShort(weekday(weekDays[6])).toLowerCase()} ${formatDateShort(weekDays[6])}`,
          detail: `No 5x2 são ${r.restDaysPerWeek} folgas em cada semana (${wk.label}), no máximo ${maxWork} dias de trabalho.`,
          basis: 'EC 141/2026; Portaria MTE 2.041/2026',
          suggestion: 'Troque um dos dias de trabalho por folga.',
        });
      }
    }

    // Horas semanais (semana de segunda a domingo)
    for (const monday of weeksOfMonth(ctx)) {
      const weekDays = Array.from({ length: 7 }, (_, k) => addDays(monday, k));
      const known = weekDays.filter((d) => dayIndex.has(d) && d <= monthEnd);
      const workedDays = known.filter((d) => worked(dayIndex.get(d)!));
      const partial = weekDays[6] > monthEnd;
      const minutes = workedDays.reduce((acc, d) => acc + ctx.hoursById.get(seq[dayIndex.get(d)!]!)!.countedMinutes, 0);
      const limit = weeklyLimitHours(ctx, monday) * 60;
      if (minutes > limit + 0.5) {
        issues.push({
          severity: 'aviso',
          code: 'HORA_EXTRA_SEMANA',
          employeeId: emp.id,
          date: monday < monthStart ? monthStart : monday,
          title: `${name}: ${minToHM(minutes)} na semana de ${formatDateShort(monday)} (limite ${limit / 60}h)`,
          detail: `Serão ${minToHM(minutes - limit)} de hora extra nessa semana, que precisam ser pagas com adicional de 50%.${partial ? ' (semana continua no mês seguinte)' : ''}`,
          basis: 'EC 141/2026; CCT 2026-2028 cl. 7.1',
        });
      }
    }

    // Domingo de folga a cada N semanas (mulheres: a cada 2)
    const W = emp.female ? r.sundayEveryWeeksWomen : r.sundayEveryWeeks;
    const sundays = ctx.allDays.map((d, i) => ({ d, i })).filter(({ d }) => weekday(d) === 0);
    for (let k = W - 1; k < sundays.length; k++) {
      const win = sundays.slice(k - W + 1, k + 1);
      const last = win[win.length - 1].d;
      if (last < monthStart) continue;
      if (win.every(({ i }) => worked(i))) {
        issues.push({
          severity: 'erro',
          code: 'DOMINGO',
          employeeId: emp.id,
          date: last,
          title: `${name}: ${W} domingos seguidos trabalhados (até ${formatDateShort(last)})`,
          detail: emp.female
            ? 'Para mulheres, a folga precisa cair no domingo a cada 2 semanas (revezamento quinzenal).'
            : `A folga precisa cair num domingo pelo menos a cada ${W} semanas: depois de 2 domingos trabalhados, o próximo é de folga.`,
          basis: emp.female ? 'CLT art. 386; CCT 2026-2028 cl. 6.2.1 (STF, RE 1403904)' : 'Lei 10.101/2000 art. 6º; CCT 2026-2028 cl. 6.2',
          suggestion: `Dê folga para ${name} no domingo ${formatDateShort(last)}.`,
        });
      }
    }
  }

  // ---------- Férias ----------
  issues.push(...reviewVacations(ctx));

  // ---------- Cobertura dos turnos ----------
  for (const d of ctx.days) {
    const wd = weekday(d);
    for (const s of ctx.shifts) {
      const dem = ctx.config.demand[wd]?.[s.id];
      if (!dem) continue;
      const count = ctx.employees.filter((e) => assignments[e.id]?.[d] === s.id).length;
      if (count < dem.min) {
        issues.push({
          severity: 'atencao',
          code: 'ABAIXO_DO_MINIMO',
          date: d,
          shiftId: s.id,
          title: `${formatDateShort(d)} ${s.name}: ${count} pessoa(s), mínimo ${dem.min}`,
          detail:
            s.team === 'noite'
              ? 'A madrugada nunca deve ficar com menos de 2 pessoas, por segurança.'
              : 'O turno está abaixo do mínimo definido nas Configurações.',
          suggestion: 'Use "Gerar escala" novamente ou mova alguém de folga para esse turno (respeitando as regras).',
        });
      } else if (count < dem.ideal) {
        issues.push({
          severity: 'aviso',
          code: 'ABAIXO_DO_IDEAL',
          date: d,
          shiftId: s.id,
          title: `${formatDateShort(d)} ${s.name}: ${count} de ${dem.ideal} pessoas`,
          detail: 'Turno abaixo do ideal (mas acima do mínimo).',
        });
      }
    }
    const hol = ctx.holidays.get(d);
    if (hol) {
      const n = ctx.employees.filter((e) => assignments[e.id]?.[d] && ctx.shiftById.has(assignments[e.id][d])).length;
      if (n > 0) {
        issues.push({
          severity: 'aviso',
          code: 'FERIADO',
          date: d,
          title: `Feriado ${formatDateShort(d)} (${hol}): ${n} pessoa(s) trabalhando`,
          detail: 'Feriado trabalhado é pago em dobro e não pode ser compensado com folga.',
          basis: 'CCT 2026-2028 cl. 6.4 e 7.2',
        });
      }
    }
  }

  return issues.sort((a, b) => sevOrder(a.severity) - sevOrder(b.severity));
}

/** Regras de férias que dá para conferir pela escala. */
export function reviewVacations(ctx: PlanContext): Issue[] {
  const out: Issue[] = [];
  const monthStart = ctx.days[0];
  const monthEnd = ctx.days[ctx.days.length - 1];
  const nextHolidays = holidaysForMonth(monthOf(addDays(monthEnd, 1)), ctx.config.customHolidays);
  const isHoliday = (d: ISODate) => ctx.holidays.get(d) ?? nextHolidays.get(d);

  for (const emp of ctx.employees) {
    for (const a of emp.absences) {
      if (a.type !== 'ferias' || a.start < monthStart || a.start > monthEnd) continue;
      // CLT art. 134 §3º: férias não podem começar nos 2 dias antes de feriado ou repouso semanal.
      for (const k of [1, 2]) {
        const h = isHoliday(addDays(a.start, k));
        if (h) {
          out.push({
            severity: 'erro',
            code: 'FERIAS_INICIO',
            employeeId: emp.id,
            date: a.start,
            title: `Férias de ${emp.name} começam em ${formatDateShort(a.start)}, ${k} dia(s) antes do feriado (${h})`,
            detail: 'As férias não podem começar nos 2 dias que antecedem um feriado ou a folga semanal.',
            basis: 'CLT art. 134 §3º',
            suggestion: 'Mude o início das férias para depois do feriado (ou para logo depois de uma folga da pessoa).',
          });
          break;
        }
      }
      const days = diffDays(a.start, a.end) + 1;
      if (days < 5) {
        out.push({
          severity: 'erro',
          code: 'FERIAS_CURTAS',
          employeeId: emp.id,
          date: a.start,
          title: `Férias de ${emp.name} com só ${days} dia(s)`,
          detail: 'Quando as férias são divididas, nenhum período pode ter menos de 5 dias corridos (e um deles precisa ter pelo menos 14).',
          basis: 'CLT art. 134 §1º',
        });
      }
    }
  }

  // Madrugada: quantas pessoas precisam estar disponíveis para cobrir todas as noites
  const workDays = 7 - ctx.config.rules.restDaysPerWeek;
  const nightShifts = ctx.shifts.filter((s) => s.team === 'noite');
  const maxNight = Math.max(0, ...Object.values(ctx.config.demand).map((d) => nightShifts.reduce((acc, s) => acc + (d[s.id]?.ideal ?? 0), 0)));
  const needNight = Math.ceil((maxNight * 7) / workDays);
  const night = ctx.employees.filter((e) => e.team === 'noite');
  const shortNight = ctx.days.filter((d) => night.filter((e) => !absenceOn(e, d)).length < needNight);
  if (needNight > 0 && shortNight.length > 0) {
    const out2 = night.filter((e) => shortNight.some((d) => absenceOn(e, d))).map((e) => e.name);
    out.push({
      severity: 'atencao',
      code: 'FERIAS_MADRUGADA',
      date: shortNight[0],
      title: `Madrugada sem gente suficiente de ${formatDateShort(shortNight[0])} a ${formatDateShort(shortNight[shortNight.length - 1])}`,
      detail: `Para ter ${maxNight} pessoas toda noite são precisos ${needNight} na equipe da madrugada${out2.length ? `, mas ${out2.join(', ')} está(ão) de férias/afastado(s)` : ''}.`,
      suggestion: 'Em Funcionários, passe alguém da equipe do dia para a madrugada neste mês e gere de novo. Veja a aba Férias.',
    });
  }

  // Duas ou mais pessoas da equipe do dia de férias ao mesmo tempo
  const onVacation = (e: (typeof ctx.employees)[number], d: ISODate) => e.absences.some((a) => a.type === 'ferias' && d >= a.start && d <= a.end);
  const dayTeam = ctx.employees.filter((e) => e.team === 'dia');
  const overlap = ctx.days.filter((d) => dayTeam.filter((e) => onVacation(e, d)).length > 1);
  if (overlap.length > 0) {
    const names = dayTeam.filter((e) => overlap.some((d) => onVacation(e, d))).map((e) => e.name);
    out.push({
      severity: 'aviso',
      code: 'FERIAS_JUNTAS',
      date: overlap[0],
      title: `${names.length} pessoas da equipe do dia de férias ao mesmo tempo`,
      detail: `${names.join(', ')} estão de férias em dias iguais (a partir de ${formatDateShort(overlap[0])}). Os turnos do dia vão ficar mais vazios.`,
      suggestion: 'Se der, separe as férias em meses diferentes. Veja a aba Férias.',
    });
  }
  return out;
}

function sevOrder(s: Issue['severity']): number {
  return s === 'erro' ? 0 : s === 'atencao' ? 1 : 2;
}

function fmtH(hours: number): string {
  return minToHM(hours * 60);
}

export function labelAbsence(t: string): string {
  return t === 'ferias' ? 'férias' : t === 'atestado' ? 'atestado' : t === 'afastamento' ? 'afastamento' : 'ausência';
}

export function summarize(issues: Issue[]) {
  return {
    erro: issues.filter((i) => i.severity === 'erro').length,
    atencao: issues.filter((i) => i.severity === 'atencao').length,
    aviso: issues.filter((i) => i.severity === 'aviso').length,
  };
}

/** Horas contadas por funcionário em cada semana do mês (para a tela). */
export function weeklyMinutes(ctx: PlanContext, assignments: Assignments, empId: string, monday: ISODate): number {
  let total = 0;
  for (let k = 0; k < 7; k++) {
    const d = addDays(monday, k);
    if (d > ctx.days[ctx.days.length - 1]) break;
    const sid = assignedShift(ctx, assignments, empId, d);
    if (sid && ctx.hoursById.has(sid)) total += ctx.hoursById.get(sid)!.countedMinutes;
  }
  return total;
}
