import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useConfirm } from '../components/Dialog';
import { addDays, diffDays, formatDate } from '../domain/dates';
import { newId, sampleEmployees } from '../domain/defaults';
import { effectiveDemand } from '../domain/demand';
import type { Absence, Employee, Team } from '../domain/types';
import { labelAbsence } from '../domain/validator';
import { useApp } from '../state';

/** Licença-maternidade: 120 dias (CF art. 7º, XVIII; CLT art. 392). */
const MATERNITY_DAYS = 120;

const TEAMS: Array<{ id: Team; title: string; desc: string }> = [
  { id: 'dia', title: 'Equipe do dia', desc: 'Faz rodízio entre manhã e tarde' },
  { id: 'noite', title: 'Equipe da madrugada', desc: 'Faz só a madrugada' },
];

export default function EmployeesPage() {
  const { employees, config, saveEmployee, deleteEmployee, canEdit } = useApp();
  const [editing, setEditing] = useState<Employee | null>(null);
  const workDays = 7 - config.rules.restDaysPerWeek;

  const teamCard = (team: Team) => {
    const n = employees.filter((e) => e.active && e.team === team).length;
    const shifts = config.shifts.filter((s) => s.team === team);
    const dem = Object.values(effectiveDemand(config, employees)).reduce((acc, day) => acc + shifts.reduce((a, s) => a + (day[s.id]?.ideal ?? 0), 0), 0);
    return { n, cap: n * workDays, dem, shifts };
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Funcionários</h1>
        <span className="text-sm text-slate-600">{employees.filter((e) => e.active).length} ativos</span>
        {canEdit && (
          <button
            className="btn btn-primary ml-auto"
            onClick={() => setEditing({ id: newId(), name: '', female: false, team: 'dia', active: true, absences: [] })}
          >
            + Adicionar funcionário
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {TEAMS.map((t) => {
          const { n, cap, dem, shifts } = teamCard(t.id);
          return (
            <div key={t.id} className="card">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                {shifts.map((s) => (
                  <span key={s.id} className="inline-block h-3 w-3 rounded-full" style={{ background: s.color }} />
                ))}
                {t.title} — {shifts.map((s) => `${s.name} ${s.start}–${s.end}`).join(' / ')}
              </div>
              <div className="mt-1 text-2xl font-bold">{n} pessoas</div>
              <div className={`mt-1 text-sm ${cap < dem ? 'text-orange-700' : 'text-slate-600'}`}>
                Fazem {cap} turnos por semana ({n} × {workDays}) · o ideal pede {dem}
                {cap < dem && ` — faltam ${dem - cap}`}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
        <b>Como funciona o rodízio:</b> a equipe do dia alterna entre manhã e tarde. Metade fica de manhã enquanto a outra metade fica à
        tarde, e elas trocam a cada 2 semanas. Na hora de gerar a escala dá para escolher outro jeito, inclusive turno fixo. A lei não deixa sair da tarde (22h) e entrar de manhã (06h) no dia seguinte. Também não deixa fazer isso
        com só 1 folga no meio. Por isso a volta para a manhã sempre acontece depois de 2 folgas. A madrugada tem equipe própria, porque
        misturar dia e madrugada pode limitar a jornada a 6h. Se alguém só pode trabalhar num turno (por exemplo, estuda), marque isso no
        cadastro. <Link className="underline" to="/duvidas">Saiba mais</Link>
      </div>

      {employees.length === 0 && canEdit && (
        <div className="card text-center">
          <p className="mb-3 text-slate-700">Nenhum funcionário cadastrado ainda.</p>
          <button
            className="btn"
            onClick={async () => {
              for (const e of sampleEmployees()) await saveEmployee(e);
            }}
          >
            Criar funcionários de exemplo (10 no dia e 3 na madrugada) para testar
          </button>
        </div>
      )}

      {TEAMS.map((t) => {
        const list = employees.filter((e) => e.team === t.id);
        if (list.length === 0) return null;
        return (
          <section key={t.id}>
            <h2 className="mb-2 text-sm font-bold tracking-wide text-slate-600 uppercase">
              {t.title} <span className="font-normal normal-case">· {t.desc}</span>
            </h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((e) => (
                <button
                  key={e.id}
                  className={`card text-left transition ${canEdit ? 'hover:border-brand-600' : 'cursor-default'}`}
                  onClick={() => canEdit && setEditing(e)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`font-semibold ${e.active ? '' : 'text-slate-400 line-through'}`}>{e.name}</span>
                    {e.female && <span className="rounded bg-pink-100 px-1.5 text-xs text-pink-700">mulher</span>}
                    {e.fixedShiftId && (
                      <span className="rounded bg-slate-100 px-1.5 text-xs text-slate-700">
                        só {config.shifts.find((s) => s.id === e.fixedShiftId)?.name.toLowerCase()}
                      </span>
                    )}
                    {!e.active && <span className="rounded bg-slate-100 px-1.5 text-xs text-slate-600">inativo</span>}
                  </div>
                  {e.absences.length > 0 && (
                    <div className="mt-1 text-xs text-slate-600">
                      {e.absences
                        .slice()
                        .sort((a, b) => a.start.localeCompare(b.start))
                        .map((a) => `${labelAbsence(a.type)} ${formatDate(a.start)}–${formatDate(a.end)}`)
                        .join(' · ')}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>
        );
      })}

      {editing && (
        <EmployeeDialog
          initial={editing}
          isNew={!employees.some((e) => e.id === editing.id)}
          onClose={() => setEditing(null)}
          onSave={async (e) => {
            await saveEmployee(e);
            setEditing(null);
          }}
          onDelete={async (emp) => {
            await deleteEmployee(emp);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function EmployeeDialog({
  initial,
  isNew,
  onClose,
  onSave,
  onDelete,
}: {
  initial: Employee;
  isNew: boolean;
  onClose: () => void;
  onSave: (e: Employee) => void;
  onDelete: (e: Employee) => void;
}) {
  const { config } = useApp();
  const [e, setE] = useState<Employee>({ ...initial, absences: [...initial.absences] });
  const [abs, setAbs] = useState<Absence>({ id: newId(), type: 'ferias', start: '', end: '' });
  const [confirmDialog, ask] = useConfirm();
  const set = <K extends keyof Employee>(k: K, v: Employee[K]) => setE((p) => ({ ...p, [k]: v }));
  const teamShifts = config.shifts.filter((s) => s.team === e.team);
  const absDays = abs.start && abs.end ? diffDays(abs.start, abs.end) + 1 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(ev) => ev.stopPropagation()}>
        {confirmDialog}
        <h2 className="mb-4 text-xl font-bold">{isNew ? 'Novo funcionário' : 'Editar funcionário'}</h2>
        <div className="space-y-4">
          <div>
            <label className="label">Nome</label>
            <input className="input" value={e.name} onChange={(ev) => set('name', ev.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Equipe</label>
            <div className="grid grid-cols-2 gap-2">
              {TEAMS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`rounded-lg border p-2 text-left text-sm ${e.team === t.id ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-100' : 'border-slate-300'}`}
                  onClick={() => setE((p) => ({ ...p, team: t.id, fixedShiftId: undefined }))}
                >
                  <div className="font-semibold">{t.title}</div>
                  <div className="text-xs text-slate-600">{t.desc}</div>
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Para cobrir férias da madrugada, dá para passar alguém do dia para a madrugada durante um mês. Troque aqui antes de gerar a escala
              e volte depois.
            </p>
          </div>
          {teamShifts.length > 1 && (
            <div>
              <label className="label">Turnos</label>
              <select className="input" value={e.fixedShiftId ?? ''} onChange={(ev) => set('fixedShiftId', ev.target.value || undefined)}>
                <option value="">Rodízio entre {teamShifts.map((s) => s.name.toLowerCase()).join(' e ')} (recomendado)</option>
                {teamShifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    Só {s.name.toLowerCase()} ({s.start}–{s.end})
                  </option>
                ))}
              </select>
            </div>
          )}
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={e.female} onChange={(ev) => set('female', ev.target.checked)} />
            <span>
              <b>Mulher</b>: tem direito a folga no domingo a cada 2 semanas (CLT art. 386 e convenção cl. 6.2.1). Os homens, a cada 3. Também
              libera o tipo <b>Licença-maternidade</b> (120 dias) nas ausências abaixo.
            </span>
          </label>

          <div className="rounded-xl border border-slate-200 p-3">
            <div className="mb-1 flex items-center justify-between">
              <label className="label !mb-0">Férias, atestados e afastamentos</label>
              <Link to="/ferias" className="text-xs text-brand-700 underline" onClick={onClose}>
                Como funcionam as férias?
              </Link>
            </div>
            <p className="mb-2 text-xs text-slate-500">
              Nesses dias a pessoa não entra na escala. Cadastre antes de gerar o mês. Férias: até 3 períodos, nenhum menor que 5 dias e um
              com pelo menos 14.
            </p>
            {e.absences.length === 0 && <p className="mb-2 text-sm text-slate-500">Nenhum período cadastrado.</p>}
            <ul className="mb-2 space-y-1">
              {e.absences
                .slice()
                .sort((x, y) => x.start.localeCompare(y.start))
                .map((a) => (
                  <li key={a.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-sm">
                    <span>
                      <b className="capitalize">{labelAbsence(a.type)}</b>: {formatDate(a.start)} a {formatDate(a.end)} ({diffDays(a.start, a.end) + 1}{' '}
                      dias)
                    </span>
                    <button className="text-xs text-red-600 hover:underline" onClick={() => set('absences', e.absences.filter((x) => x.id !== a.id))}>
                      remover
                    </button>
                  </li>
                ))}
            </ul>
            <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <div>
                <span className="text-xs text-slate-600">Tipo</span>
                <select
                  className="input"
                  value={abs.type}
                  onChange={(ev) => {
                    const type = ev.target.value as Absence['type'];
                    setAbs({ ...abs, type, end: type === 'maternidade' && abs.start ? addDays(abs.start, MATERNITY_DAYS - 1) : abs.end });
                  }}
                >
                  <option value="ferias">Férias</option>
                  <option value="atestado">Atestado</option>
                  <option value="afastamento">Afastamento</option>
                  {e.female && <option value="maternidade">Licença-maternidade</option>}
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div>
                <span className="text-xs text-slate-600">Primeiro dia</span>
                <input
                  type="date"
                  className="input"
                  value={abs.start}
                  onChange={(ev) => {
                    const start = ev.target.value;
                    setAbs({ ...abs, start, end: abs.type === 'maternidade' && start ? addDays(start, MATERNITY_DAYS - 1) : abs.end });
                  }}
                />
              </div>
              <div>
                <span className="text-xs text-slate-600">Último dia</span>
                <input type="date" className="input" value={abs.end} onChange={(ev) => setAbs({ ...abs, end: ev.target.value })} />
              </div>
              <button
                className="btn"
                disabled={!abs.start || !abs.end || abs.end < abs.start}
                onClick={() => {
                  set('absences', [...e.absences, abs]);
                  setAbs({ id: newId(), type: 'ferias', start: '', end: '' });
                }}
              >
                Adicionar
              </button>
            </div>
            {absDays > 0 && (
              <p className={`mt-1 text-xs ${abs.type === 'ferias' && absDays < 5 ? 'text-red-700' : 'text-slate-500'}`}>
                {absDays} dias{abs.type === 'ferias' && absDays < 5 ? ': férias não podem ter menos de 5 dias.' : ''}
                {abs.type === 'maternidade' &&
                  ' · licença-maternidade: 120 dias (CF art. 7º, XVIII; CLT art. 392). Empresa Cidadã: 180 dias — ajuste o último dia.'}
              </p>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={e.active} onChange={(ev) => set('active', ev.target.checked)} />
            Ativo (desmarque se a pessoa saiu da empresa)
          </label>
          <div>
            <label className="label">Observações</label>
            <textarea className="input" rows={2} value={e.notes ?? ''} onChange={(ev) => set('notes', ev.target.value)} />
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {!isNew && (
            <button
              className="btn text-red-700"
              onClick={async () => {
                if (
                  await ask({
                    title: `Excluir ${e.name}?`,
                    message:
                      'Para quem saiu da empresa, prefira desmarcar “Ativo”, assim as escalas antigas continuam com o nome. Se excluir por engano, dá para restaurar em Configurações → Segurança dos dados.',
                    confirmLabel: 'Excluir',
                    danger: true,
                  })
                )
                  onDelete(initial);
              }}
            >
              Excluir
            </button>
          )}
          <button className="btn ml-auto" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            disabled={!e.name.trim()}
            onClick={() => {
              // Se a pessoa preencheu um período e esqueceu de clicar em "Adicionar", inclui assim mesmo.
              const pending = abs.start && abs.end && abs.end >= abs.start ? [abs] : [];
              onSave({ ...e, name: e.name.trim(), absences: [...e.absences, ...pending] });
            }}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
