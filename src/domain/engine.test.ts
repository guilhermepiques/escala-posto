import loadHighs from 'highs';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildContext } from './context';
import { addDays } from './dates';
import { defaultConfig, sampleEmployees } from './defaults';
import { shiftHours } from './hours';
import { solveWith } from './solver';
import { review, summarize } from './validator';
import type { Assignments, Employee } from './types';

let highs: Awaited<ReturnType<typeof loadHighs>>;
beforeAll(async () => {
  highs = await loadHighs();
});

describe('horas', () => {
  it('madrugada 22h-06h com 1h de intervalo conta exatamente 8h', () => {
    const cfg = defaultConfig();
    const n = cfg.shifts.find((s) => s.id === 'N')!;
    expect(shiftHours(n).countedMinutes).toBeCloseTo(480, 1);
  });
  it('madrugada com 30 min de intervalo conta 8h34', () => {
    const cfg = defaultConfig();
    const n = { ...cfg.shifts.find((s) => s.id === 'N')!, breakMinutes: 30 };
    expect(Math.round(shiftHours(n).countedMinutes)).toBe(514);
  });
  it('manhã com 30 min de intervalo conta 7h30', () => {
    const cfg = defaultConfig();
    expect(shiftHours(cfg.shifts[0]).countedMinutes).toBe(450);
  });
});

function run(month: string, emps: Employee[], prev?: Assignments) {
  const cfg = defaultConfig();
  const ctx = buildContext(month, emps, cfg, prev);
  const out = solveWith(highs, ctx);
  const issues = review(ctx, out.assignments);
  return { ctx, out, issues };
}

describe('gerador + revisor', () => {
  it('gera dezembro/2026 para 13 funcionários sem erros legais', () => {
    const emps = sampleEmployees();
    const { out, issues } = run('2026-12', emps);
    expect(out.ok).toBe(true);
    const s = summarize(issues);
    console.log('dez/2026', out.status, out.seconds.toFixed(1) + 's', s);
    console.log(issues.filter((i) => i.severity !== 'aviso').map((i) => i.title).join('\n'));
    expect(s.erro).toBe(0);
    expect(s.atencao).toBe(0);
  }, 60000);

  it('encadeia meses (janeiro usa dezembro como histórico) e respeita mulheres e férias', () => {
    const emps = sampleEmployees();
    emps[0].female = true;
    emps[6].female = true;
    emps[2].absences = [{ id: 'f', type: 'ferias', start: '2027-01-11', end: '2027-01-30' }];
    const dec = run('2026-12', emps);
    const jan = run('2027-01', emps, dec.out.assignments);
    expect(jan.out.ok).toBe(true);
    const s = summarize(jan.issues);
    console.log('jan/2027', jan.out.status, jan.out.seconds.toFixed(1) + 's', s);
    console.log(jan.issues.filter((i) => i.severity !== 'aviso').map((i) => i.title).join('\n'));
    expect(s.erro).toBe(0);
    // ninguém trabalha nas férias
    for (const d of Object.keys(jan.out.assignments[emps[2].id] ?? {})) {
      expect(d < '2027-01-11' || d > '2027-01-30').toBe(true);
    }
  }, 120000);

  it('a equipe do dia faz rodízio entre manhã e tarde', () => {
    const emps = sampleEmployees();
    const { out } = run('2026-12', emps);
    const rotating = emps.filter((e) => e.team === 'dia').filter((e) => {
      const shifts = new Set(Object.values(out.assignments[e.id] ?? {}));
      return shifts.has('M') && shifts.has('T');
    });
    expect(rotating.length).toBeGreaterThanOrEqual(5);
  }, 60000);

  it('tarde -> 2 folgas -> manhã é permitido; tarde -> 1 folga -> manhã não', () => {
    const emps = sampleEmployees();
    const { ctx, out } = run('2026-12', emps);
    const a: Assignments = JSON.parse(JSON.stringify(out.assignments));
    const id = emps[0].id;
    a[id] = { '2026-12-07': 'T', '2026-12-08': 'T', '2026-12-11': 'M', '2026-12-12': 'M' };
    expect(review(ctx, a).some((i) => i.employeeId === id && i.code === 'FOLGA_INCOMPLETA')).toBe(false);
    a[id] = { '2026-12-07': 'T', '2026-12-08': 'T', '2026-12-10': 'M' };
    expect(review(ctx, a).some((i) => i.employeeId === id && i.code === 'FOLGA_INCOMPLETA')).toBe(true);
  }, 60000);

  it('o revisor pega erros feitos à mão', () => {
    const emps = sampleEmployees();
    const { ctx, out } = run('2026-12', emps);
    const a: Assignments = JSON.parse(JSON.stringify(out.assignments));
    const id = emps[5].id; // equipe da tarde
    // coloca a pessoa 7 dias seguidos, um deles de manhã logo após a tarde
    for (let d = 1; d <= 7; d++) a[id][`2026-12-0${d}`] = 'T';
    a[id]['2026-12-08'] = 'M';
    a[id]['2026-12-09'] = 'N';
    const codes = new Set(review(ctx, a).map((i) => i.code));
    expect(codes.has('DIAS_SEGUIDOS')).toBe(true);
    expect(codes.has('FOLGAS_SEMANA')).toBe(true);
    expect(codes.has('DESCANSO_ENTRE_JORNADAS')).toBe(true);
    expect(codes.has('MISTURA_DIA_NOITE')).toBe(true);
  }, 60000);
});

describe('modos e semanas', () => {
  it('2 folgas também de domingo a sábado e no máximo 5 dias seguidos', () => {
    const emps = sampleEmployees();
    const { ctx, out } = run('2026-12', emps);
    for (const e of emps) {
      let run5 = 0;
      for (const d of ctx.days) {
        run5 = out.assignments[e.id]?.[d] ? run5 + 1 : 0;
        expect(run5).toBeLessThanOrEqual(5);
      }
      // semanas de domingo a sábado inteiras dentro do mês
      for (const sun of ['2026-12-06', '2026-12-13', '2026-12-20']) {
        const n = ctx.days.filter((d) => d >= sun && d <= addDays(sun, 6) && out.assignments[e.id]?.[d]).length;
        expect(n).toBeLessThanOrEqual(5);
      }
    }
  }, 60000);

  it('modo turno fixo: cada pessoa do dia fica num turno só', () => {
    const emps = sampleEmployees();
    const cfg = defaultConfig();
    cfg.rules.rotation = 'fixo';
    const ctx = buildContext('2026-12', emps, cfg, undefined);
    const out = solveWith(highs, ctx);
    expect(out.ok).toBe(true);
    const s = summarize(review(ctx, out.assignments));
    expect(s.erro).toBe(0);
    for (const e of emps.filter((x) => x.team === 'dia')) {
      expect(new Set(Object.values(out.assignments[e.id] ?? {})).size).toBeLessThanOrEqual(1);
    }
  }, 60000);
});

describe('férias no revisor', () => {
  it('aponta férias começando antes de feriado, férias curtas e madrugada descoberta', () => {
    const emps = sampleEmployees();
    emps[1].absences = [{ id: 'a', type: 'ferias', start: '2026-12-24', end: '2027-01-22' }]; // véspera do Natal
    emps[2].absences = [{ id: 'b', type: 'ferias', start: '2026-12-01', end: '2026-12-03' }]; // 3 dias
    emps[11].absences = [{ id: 'c', type: 'ferias', start: '2026-12-01', end: '2026-12-30' }]; // madrugada
    const ctx = buildContext('2026-12', emps, defaultConfig(), undefined);
    const codes = new Set(review(ctx, {}).map((i) => i.code));
    expect(codes.has('FERIAS_INICIO')).toBe(true);
    expect(codes.has('FERIAS_CURTAS')).toBe(true);
    expect(codes.has('FERIAS_MADRUGADA')).toBe(true);
  });
});
