import { toPng } from 'html-to-image';
import { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { absenceOn } from '../domain/context';
import { formatMonth, formatTimestamp, minToHM, weekday, weekdayShort } from '../domain/dates';
import { summarize } from '../domain/validator';
import { useMonthSchedule } from '../hooks/useMonthSchedule';

const ABS: Record<string, string> = { ferias: 'FÉR', atestado: 'AT', afastamento: 'AF', outro: 'AUS' };

/** Folha da escala pronta para imprimir, salvar em PDF ou baixar como imagem (WhatsApp). */
export default function PrintPage() {
  const { month = '' } = useParams();
  const { schedule, loading, ctx, issues } = useMonthSchedule(month);
  const businessName = ctx.config.businessName?.trim();
  const sheet = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  if (loading || !schedule) return <div className="p-8">Carregando…</div>;
  const c = summarize(issues);
  if (c.erro > 0) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <div className="card border-red-200 bg-red-50 text-red-800">
          <h1 className="mb-2 text-lg font-bold">A escala tem {c.erro} erro(s) legal(is)</h1>
          <p>Volte para a tela da escala, corrija os erros apontados pelo revisor e exporte de novo.</p>
        </div>
      </div>
    );
  }

  const a = schedule.assignments;
  const downloadImage = async () => {
    if (!sheet.current) return;
    setBusy(true);
    try {
      const url = await toPng(sheet.current, { pixelRatio: 2, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = `escala-${month}.png`;
      link.href = url;
      link.click();
    } finally {
      setBusy(false);
    }
  };

  const emps = ctx.employees.filter((e) => e.team === 'dia');
  const others = ctx.employees.filter((e) => e.team !== 'dia');

  return (
    <div className="min-h-screen bg-slate-100 py-4 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[1400px] flex-wrap items-center gap-2 px-4">
        <button className="btn btn-primary" onClick={() => window.print()}>
          🖨 Imprimir / Salvar PDF
        </button>
        <button className="btn" onClick={downloadImage} disabled={busy}>
          {busy ? 'Gerando…' : '🖼 Baixar imagem (para WhatsApp)'}
        </button>
        <span className="text-sm text-slate-600">Para PDF: clique em Imprimir e escolha “Salvar como PDF”.</span>
      </div>

      <div ref={sheet} className="mx-auto max-w-[1400px] bg-white p-6 print:max-w-none print:p-0">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              Escala de trabalho — {formatMonth(month)}
              {businessName ? ` · ${businessName}` : ''}
            </h1>
            <p className="text-sm text-slate-600">Regime 5x2 · duas folgas por semana</p>
          </div>
          <div className="text-right text-xs text-slate-600">
            {ctx.shifts.map((s) => {
              const h = ctx.hoursById.get(s.id)!;
              return (
                <div key={s.id}>
                  <b style={{ color: s.color }}>{s.code}</b> {s.name}: {s.start}–{s.end} · intervalo {s.breakMinutes} min · conta {minToHM(h.countedMinutes)}
                </div>
              );
            })}
          </div>
        </div>

        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr>
              <th className="border border-slate-300 bg-slate-100 px-2 py-1 text-left">Funcionário</th>
              {ctx.days.map((d) => {
                const hol = ctx.holidays.get(d);
                const wd = weekday(d);
                return (
                  <th
                    key={d}
                    className={`border border-slate-300 px-0.5 py-0.5 text-center ${hol ? 'bg-amber-100' : wd === 0 ? 'bg-rose-100' : 'bg-slate-100'}`}
                  >
                    <div className="text-[9px] font-normal">{weekdayShort(wd).slice(0, 3)}</div>
                    {Number(d.slice(8))}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {[...emps, ...others].map((e) => (
              <tr key={e.id}>
                <td className="border border-slate-300 px-2 py-1 font-medium whitespace-nowrap">{e.name}</td>
                {ctx.days.map((d) => {
                  const sid = a[e.id]?.[d];
                  const s = sid ? ctx.shiftById.get(sid) : undefined;
                  const abs = absenceOn(e, d);
                  return (
                    <td
                      key={d}
                      className="border border-slate-300 text-center font-bold"
                      style={s ? { background: s.color, color: 'white' } : abs ? { background: '#e2e8f0', color: '#475569' } : { color: '#94a3b8' }}
                    >
                      {s ? s.code : abs ? ABS[abs.type] : 'F'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-2 flex flex-wrap justify-between gap-2 text-[11px] text-slate-600">
          <span>F = folga · FÉR = férias · AT = atestado · AF = afastamento · colunas rosa = domingo · amarelas = feriado (pago em dobro)</span>
          <span className="font-semibold text-emerald-700">
            ✓ Revisada{schedule.reviewedAt ? ` em ${formatTimestamp(schedule.reviewedAt)}` : ''} — dentro das regras do 5x2 (EC 141/2026, CLT e CCT 2026-2028)
          </span>
        </div>
      </div>
    </div>
  );
}
