import { useState } from 'react';
import { weekdayShort } from '../../domain/dates';
import { newId } from '../../domain/defaults';
import type { AppConfig, Restriction, RestrictionType } from '../../domain/types';
import { useApp } from '../../state';

const TYPES: Array<{ id: RestrictionType; title: string; desc: string; example: string }> = [
  {
    id: 'naoJuntos',
    title: 'Não trabalham no mesmo turno',
    desc: 'Escolha 2 ou mais pessoas que nunca devem ficar juntas no mesmo turno.',
    example: 'Ex.: dois funcionários novos, ou pessoas que não se dão bem.',
  },
  {
    id: 'diaDeFolga',
    title: 'Não trabalha em certos dias da semana',
    desc: 'A pessoa nunca é escalada nos dias marcados.',
    example: 'Ex.: estuda às terças, ou tem compromisso fixo aos domingos.',
  },
  {
    id: 'peloMenosUm',
    title: 'Pelo menos um deles em cada turno',
    desc: 'Em cada turno, o gerador tenta ter pelo menos 1 pessoa deste grupo.',
    example: 'Ex.: quem sabe fechar o caixa, ou os mais experientes.',
  },
];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function RestrictionsSection({ draft, setDraft }: { draft: AppConfig; setDraft: (fn: (d: AppConfig) => AppConfig) => void }) {
  const { employees } = useApp();
  const active = employees.filter((e) => e.active);
  const byId = new Map(employees.map((e) => [e.id, e]));
  const [type, setType] = useState<RestrictionType>('naoJuntos');
  const [selected, setSelected] = useState<string[]>([]);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [note, setNote] = useState('');

  const valid =
    type === 'naoJuntos' ? selected.length >= 2 : type === 'diaDeFolga' ? selected.length >= 1 && weekdays.length >= 1 : selected.length >= 1;

  const add = () => {
    const r: Restriction = { id: newId(), type, employeeIds: selected, note: note.trim() || undefined };
    if (type === 'diaDeFolga') r.weekdays = weekdays;
    setDraft((d) => ({ ...d, restrictions: [...(d.restrictions ?? []), r] }));
    setSelected([]);
    setWeekdays([]);
    setNote('');
  };

  const describe = (r: Restriction) => {
    const names = r.employeeIds.map((id) => byId.get(id)?.name ?? '(removido)').join(', ');
    if (r.type === 'naoJuntos') return `${names} não trabalham no mesmo turno`;
    if (r.type === 'diaDeFolga') return `${names} não trabalha: ${(r.weekdays ?? []).map((w) => weekdayShort(w)).join(', ')}`;
    return `Pelo menos um de ${names} em cada turno`;
  };

  return (
    <section className="card">
      <h2 className="mb-1 text-lg font-bold">Restrições entre funcionários</h2>
      <p className="mb-4 text-sm text-slate-600">
        Regras específicas do seu posto. O gerador respeita e o revisor confere. Para alguém que só pode trabalhar de manhã ou só à tarde, use o
        cadastro do funcionário (campo “Turnos”).
      </p>

      {(draft.restrictions ?? []).length > 0 ? (
        <ul className="mb-5 space-y-1.5">
          {draft.restrictions.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span>
                {describe(r)}
                {r.note && <span className="text-slate-500"> — {r.note}</span>}
              </span>
              <button
                className="shrink-0 text-xs text-red-600 hover:underline"
                onClick={() => setDraft((d) => ({ ...d, restrictions: d.restrictions.filter((x) => x.id !== r.id) }))}
              >
                remover
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-5 text-sm text-slate-500">Nenhuma restrição cadastrada.</p>
      )}

      <div className="rounded-xl border border-slate-200 p-4">
        <h3 className="mb-2 text-sm font-semibold">Nova restrição</h3>
        <div className="mb-3 grid gap-2 md:grid-cols-3">
          {TYPES.map((t) => (
            <label
              key={t.id}
              className={`cursor-pointer rounded-lg border p-2.5 text-sm ${type === t.id ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-100' : 'border-slate-200'}`}
            >
              <input type="radio" className="mr-1" checked={type === t.id} onChange={() => setType(t.id)} />
              <b>{t.title}</b>
              <div className="mt-1 text-xs text-slate-600">{t.desc}</div>
              <div className="text-xs text-slate-500 italic">{t.example}</div>
            </label>
          ))}
        </div>

        <div className="mb-3">
          <span className="label">Funcionários</span>
          {active.length === 0 ? (
            <p className="text-sm text-slate-500">Cadastre os funcionários primeiro.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {active.map((e) => {
                const on = selected.includes(e.id);
                return (
                  <button
                    key={e.id}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${on ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                    onClick={() => setSelected((s) => (on ? s.filter((x) => x !== e.id) : [...s, e.id]))}
                  >
                    {e.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {type === 'diaDeFolga' && (
          <div className="mb-3">
            <span className="label">Dias em que não trabalha</span>
            <div className="flex flex-wrap gap-1.5">
              {WEEK_ORDER.map((wd) => {
                const on = weekdays.includes(wd);
                return (
                  <button
                    key={wd}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${on ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                    onClick={() => setWeekdays((s) => (on ? s.filter((x) => x !== wd) : [...s, wd]))}
                  >
                    {weekdayShort(wd)}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Lembre: a pessoa ainda precisa das outras folgas da semana. Bloquear muitos dias deixa a escala mais difícil de fechar.
            </p>
          </div>
        )}

        <div className="mb-3">
          <span className="label">Motivo (opcional)</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: estuda à noite" />
        </div>

        <button className="btn" disabled={!valid} onClick={add}>
          + Adicionar restrição
        </button>
        <span className="ml-2 text-xs text-slate-500">Depois clique em “Salvar alterações” no topo.</span>
      </div>
    </section>
  );
}
