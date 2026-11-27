import { useEffect, useRef, useState } from 'react';
import { DataSection } from '../components/config/DataSection';
import { MovementSection } from '../components/config/MovementSection';
import { PostoSection } from '../components/config/PostoSection';
import { RestrictionsSection } from '../components/config/RestrictionsSection';
import { useConfirm } from '../components/Dialog';
import { formatDate, minToHM, weekdayLong } from '../domain/dates';
import { defaultConfig, legalWeeklyLimit } from '../domain/defaults';
import { builtInHolidays } from '../domain/holidays';
import { shiftHours } from '../domain/hours';
import type { AppConfig, Rules, Shift } from '../domain/types';
import { sameConfig } from '../domain/compare';
import { useApp } from '../state';

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function ConfigPage() {
  const { config, saveConfig, canEdit, store } = useApp();
  const [draft, setDraft] = useState<AppConfig>(config);
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [confirmDialog, ask] = useConfirm();
  const dirty = !sameConfig(draft, config);

  // Se outra pessoa mudar as configurações e aqui não há nada sendo editado, mostra a versão nova.
  const lastConfig = useRef(config);
  useEffect(() => {
    const prev = lastConfig.current;
    lastConfig.current = config;
    if (prev === config) return;
    setDraft((d) => (sameConfig(d, prev) ? config : d));
  }, [config]);

  const setShift = (id: string, patch: Partial<Shift>) =>
    setDraft((d) => ({ ...d, shifts: d.shifts.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  const setRule = <K extends keyof Rules>(k: K, v: Rules[K]) => setDraft((d) => ({ ...d, rules: { ...d.rules, [k]: v } }));

  const save = async () => {
    setSaveErr(null);
    try {
      // A versão de antes fica no histórico (Segurança dos dados → Versões anteriores).
      await store.addHistory('config', 'config', 'Antes de salvar alterações', config).catch(() => undefined);
      await saveConfig(draft);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setSaveErr(`Não foi possível salvar: ${(e as Error).message}`);
    }
  };

  const year = new Date().getFullYear();
  const [hol, setHol] = useState({ date: '', name: '' });
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-3 bg-slate-50/95 px-4 py-2 backdrop-blur">
        <h1 className="text-2xl font-bold">Configurações</h1>
        <div className="ml-auto flex items-center gap-2">
          {saved && <span className="text-sm text-emerald-700">✓ Salvo</span>}
          {saveErr && <span className="text-sm text-red-700">{saveErr}</span>}
          {!canEdit && <span className="text-sm text-slate-600">Você só pode ver as configurações.</span>}
          {canEdit && (
          <>
          <button
            className="btn"
            onClick={async () => {
              if (await ask({ title: 'Restaurar o padrão?', message: 'Todas as configurações voltam para o padrão sugerido (nome do posto, restrições e feriados municipais são mantidos). Depois clique em Salvar.', confirmLabel: 'Restaurar' }))
                setDraft({ ...defaultConfig(), businessName: draft.businessName, restrictions: draft.restrictions, customHolidays: draft.customHolidays });
            }}
          >
            Restaurar padrão
          </button>
          <button className="btn" disabled={!dirty} onClick={() => setDraft(config)}>
            Descartar
          </button>
          <button className="btn btn-primary" disabled={!dirty} onClick={save}>
            Salvar alterações
          </button>
          </>
          )}
        </div>
      </div>

      {confirmDialog}
      <PostoSection draft={draft} setDraft={setDraft} disabled={!canEdit} />

      <fieldset disabled={!canEdit} className="m-0 min-w-0 space-y-6 border-0 p-0">

      {/* TURNOS */}
      <section className="card">
        <h2 className="mb-1 text-lg font-bold">Turnos e intervalos</h2>
        <p className="mb-4 text-sm text-slate-600">
          O intervalo não conta como trabalho. A convenção permite reduzir o intervalo para no mínimo 30 minutos (cl. 6.4.1).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-600">
                <th className="py-2 pr-2">Turno</th>
                <th className="py-2 pr-2">Início</th>
                <th className="py-2 pr-2">Fim</th>
                <th className="py-2 pr-2">Intervalo</th>
                <th className="py-2 pr-2">Início do intervalo</th>
                <th className="py-2 pr-2">Conta por dia</th>
                <th className="py-2 pr-2">5 turnos na semana</th>
              </tr>
            </thead>
            <tbody>
              {draft.shifts.map((s) => {
                const h = shiftHours(s);
                const week = h.countedMinutes * 5;
                const over = week > draft.rules.weeklyHoursLimit * 60 + 0.5;
                return (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-2">
                        <input type="color" value={s.color} onChange={(e) => setShift(s.id, { color: e.target.value })} className="h-7 w-7 rounded" />
                        <input className="input w-32" value={s.name} onChange={(e) => setShift(s.id, { name: e.target.value })} />
                      </div>
                    </td>
                    <td className="py-2 pr-2">
                      <input type="time" className="input w-28" value={s.start} onChange={(e) => setShift(s.id, { start: e.target.value })} />
                    </td>
                    <td className="py-2 pr-2">
                      <input type="time" className="input w-28" value={s.end} onChange={(e) => setShift(s.id, { end: e.target.value })} />
                    </td>
                    <td className="py-2 pr-2">
                      <select className="input w-28" value={s.breakMinutes} onChange={(e) => setShift(s.id, { breakMinutes: Number(e.target.value) })}>
                        {[30, 45, 60, 75, 90, 120].map((m) => (
                          <option key={m} value={m}>
                            {m} min
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="time"
                        className="input w-28"
                        value={s.breakStart ?? ''}
                        placeholder="meio do turno"
                        onChange={(e) => setShift(s.id, { breakStart: e.target.value || undefined })}
                      />
                    </td>
                    <td className="py-2 pr-2 font-semibold">
                      {minToHM(h.countedMinutes)}
                      {h.nightClockMinutes > 0 && <div className="text-xs font-normal text-slate-500">inclui hora noturna</div>}
                    </td>
                    <td className={`py-2 pr-2 font-semibold ${over ? 'text-orange-700' : 'text-emerald-700'}`}>
                      {minToHM(week)} {over ? `(passa de ${draft.rules.weeklyHoursLimit}h)` : '✓'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
          <b>Por que a madrugada tem 1h de intervalo?</b> Na madrugada vale a “hora noturna reduzida”: cada hora entre 22h e 5h conta como
          52min30s (CLT art. 73). Como o turno vai sempre das 22h às 06h, quanto <i>menor</i> o intervalo, mais horas contam: com 30 minutos,
          a noite conta 8h34 e 5 noites dão 42h51 — passa do limite de 42h e gera hora extra. Com 1h, conta 8h00 e a semana fica em 40h.
          Se quiserem 30 minutos mesmo assim, é só mudar aqui; o revisor vai avisar a hora extra prevista.
        </div>
      </section>

      <MovementSection draft={draft} setDraft={setDraft} />

      {/* REGRAS */}
      <section className="card">
        <h2 className="mb-1 text-lg font-bold">Regras</h2>
        <p className="mb-4 text-sm text-slate-600">Já vêm preenchidas conforme a lei e a convenção coletiva. Só mude se o contador orientar.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <RuleInput
            label="Limite de horas por semana"
            hint={`Pela lei hoje: ${legalWeeklyLimit(today)}h. A partir de 16/12/2026: 42h. A partir de 16/12/2027: 40h (o sistema troca sozinho).`}
            value={draft.rules.weeklyHoursLimit}
            onChange={(v) => setRule('weeklyHoursLimit', v)}
          />
          <RuleInput label="Folgas por semana (segunda a domingo)" hint="5x2 = 2 folgas." value={draft.rules.restDaysPerWeek} onChange={(v) => setRule('restDaysPerWeek', v)} />
          <RuleInput label="Descanso mínimo entre turnos (horas)" hint="CLT art. 66: 11 horas." value={draft.rules.minRestHours} onChange={(v) => setRule('minRestHours', v)} />
          <RuleInput
            label="Máximo de dias seguidos trabalhando"
            hint="A lei permite até 6 (a folga não pode passar do 7º dia). O padrão do app é 5, que é o 5x2 “de verdade”."
            value={draft.rules.maxConsecutiveDays}
            onChange={(v) => setRule('maxConsecutiveDays', v)}
          />
          <RuleInput
            label="Domingo de folga a cada (semanas) — homens"
            hint="Convenção cl. 6.2: depois de 2 domingos trabalhados, o 3º é folga."
            value={draft.rules.sundayEveryWeeks}
            onChange={(v) => setRule('sundayEveryWeeks', v)}
          />
          <RuleInput
            label="Domingo de folga a cada (semanas) — mulheres"
            hint="CLT art. 386 e convenção cl. 6.2.1: a cada 2 semanas."
            value={draft.rules.sundayEveryWeeksWomen}
            onChange={(v) => setRule('sundayEveryWeeksWomen', v)}
          />
          <div className="rounded-xl border border-slate-200 p-4 md:col-span-2">
            <label className="label">Rodízio da equipe do dia (manhã ↔ tarde)</label>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <select
                className="input w-auto"
                value={draft.rules.rotation === 'semanal' ? String(draft.rules.rotationEveryWeeks) : draft.rules.rotation}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === 'livre' || v === 'fixo') setRule('rotation', v);
                  else {
                    setDraft((d) => ({ ...d, rules: { ...d.rules, rotation: 'semanal', rotationEveryWeeks: Number(v) } }));
                  }
                }}
              >
                <option value="1">Troca de turno toda semana</option>
                <option value="2">Troca de turno a cada 2 semanas (recomendado)</option>
                <option value="fixo">Turno fixo: cada um sempre no mesmo turno</option>
                <option value="livre">Livre: o gerador escolhe (mais lento)</option>
              </select>
              {draft.rules.rotation === 'semanal' && (
                <>
                  <span>começando na</span>
                  <select
                    className="input w-auto"
                    value={draft.rules.rotationStartWeekday}
                    onChange={(e) => setRule('rotationStartWeekday', Number(e.target.value))}
                  >
                    {WEEK_ORDER.map((wd) => (
                      <option key={wd} value={wd}>
                        {weekdayLong(wd)}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Metade da equipe do dia fica de manhã enquanto a outra metade fica à tarde, e depois trocam. Quem passa da tarde para a manhã
              precisa de 2 folgas na troca, por isso é melhor a troca cair perto dos dias de menos movimento (o padrão é quinta-feira, logo
              depois de terça e quarta). Trocar a cada 2 semanas deixa a escala mais cheia do que trocar toda semana.
            </p>
          </div>
          <label className="flex items-start gap-2 text-sm md:col-span-2">
            <input type="checkbox" className="mt-1" checked={draft.rules.alsoSundayWeeks} onChange={(e) => setRule('alsoSundayWeeks', e.target.checked)} />
            <span>
              <b>2 folgas também contando a semana de domingo a sábado.</b> Pela Portaria, a semana do 5x2 vai de segunda a domingo. Com esta opção
              ligada, o app também garante 2 folgas de domingo a sábado, então ninguém fica com 1 folga só, seja qual for o jeito de contar a semana.
            </span>
          </label>
          <div className="md:col-span-2">
            <label className="label">Descanso depois da folga</label>
            <select
              className="input max-w-xl"
              value={draft.rules.restAfterDayOff}
              onChange={(e) => setRule('restAfterDayOff', e.target.value as Rules['restAfterDayOff'])}
            >
              <option value="sumula110">24h da folga + 11h = 35h (Súmula 110 do TST, entendimento majoritário)</option>
              <option value="estrito">24h por folga + 11h (2 folgas = 59h, mais rígido, quase impede o rodízio)</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Com 35h, quem sai da tarde (22h) pode voltar de manhã (06h) depois de 2 folgas (56h de descanso), mas não depois de 1 folga só (32h).
            </p>
          </div>
          <label className="flex items-start gap-2 text-sm md:col-span-2">
            <input type="checkbox" className="mt-1" checked={draft.rules.forbidDayNightMix} onChange={(e) => setRule('forbidDayNightMix', e.target.checked)} />
            <span>
              <b>Não misturar dia e madrugada</b> para a mesma pessoa no mês (evita o risco de “turno ininterrupto de revezamento”, que limitaria a
              jornada a 6h por dia).
            </span>
          </label>
        </div>
      </section>

      <RestrictionsSection draft={draft} setDraft={setDraft} />

      {/* FERIADOS */}
      <section className="card">
        <h2 className="mb-1 text-lg font-bold">Feriados</h2>
        <p className="mb-3 text-sm text-slate-600">
          Feriado trabalhado é pago em dobro e não pode ser compensado com folga (convenção cl. 6.4). Os feriados nacionais e o de SP (9 de
          julho) já estão incluídos. <b>Cadastre aqui os feriados municipais da sua cidade</b> (confira no site da prefeitura).
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Automáticos ({year})</h3>
            <ul className="space-y-0.5 text-sm text-slate-700">
              {builtInHolidays(year).map((h) => (
                <li key={h.date}>
                  {formatDate(h.date)} — {h.name}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Municipais e outros</h3>
            <ul className="mb-2 space-y-1 text-sm">
              {draft.customHolidays.length === 0 && <li className="text-slate-500">Nenhum cadastrado.</li>}
              {draft.customHolidays
                .slice()
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((h) => (
                  <li key={h.date + h.name} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1">
                    <span>
                      {formatDate(h.date)} — {h.name}
                    </span>
                    <button
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => setDraft((d) => ({ ...d, customHolidays: d.customHolidays.filter((x) => x !== h) }))}
                    >
                      remover
                    </button>
                  </li>
                ))}
            </ul>
            <div className="flex gap-2">
              <input type="date" className="input w-40" value={hol.date} onChange={(e) => setHol({ ...hol, date: e.target.value })} />
              <input className="input" placeholder="Nome do feriado" value={hol.name} onChange={(e) => setHol({ ...hol, name: e.target.value })} />
              <button
                className="btn"
                disabled={!hol.date || !hol.name}
                onClick={() => {
                  setDraft((d) => ({ ...d, customHolidays: [...d.customHolidays, hol] }));
                  setHol({ date: '', name: '' });
                }}
              >
                +
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">Lembre de clicar em “Salvar alterações” no topo.</p>
          </div>
        </div>
      </section>
      </fieldset>

      <DataSection />
    </div>
  );
}

function RuleInput({ label, hint, value, onChange }: { label: string; hint: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input type="number" min={0} className="input w-28" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}
