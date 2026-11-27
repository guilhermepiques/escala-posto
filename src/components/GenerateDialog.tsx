import { useState } from 'react';
import { weekdayLong } from '../domain/dates';
import type { Rules } from '../domain/types';
import { Modal } from './Dialog';

type Mode = 'rodizio2' | 'rodizio1' | 'fixo' | 'livre';

const OPTIONS: Array<{ id: Mode; title: string; desc: string; tag?: string }> = [
  {
    id: 'rodizio2',
    title: 'Rodízio a cada 2 semanas',
    desc: 'Metade da equipe do dia fica 2 semanas de manhã enquanto a outra metade fica à tarde, e depois trocam. É a opção que deixa os turnos mais cheios.',
    tag: 'Recomendado',
  },
  {
    id: 'rodizio1',
    title: 'Rodízio toda semana',
    desc: 'Troca de turno toda semana. Todo mundo varia mais, mas alguns dias ficam com uma pessoa a menos, porque quem volta da tarde para a manhã precisa de 2 folgas na troca.',
  },
  {
    id: 'fixo',
    title: 'Turno fixo',
    desc: 'Cada pessoa da equipe do dia fica sempre no mesmo turno (só manhã ou só tarde), continuando o que fazia no mês anterior. Rotina mais estável.',
  },
  {
    id: 'livre',
    title: 'Livre',
    desc: 'O gerador decide quando cada um troca de turno, em blocos de alguns dias. Mais flexível, mas demora mais e pode sair menos organizado.',
  },
];

function modeOf(r: Rules): Mode {
  if (r.rotation === 'fixo') return 'fixo';
  if (r.rotation === 'livre') return 'livre';
  return r.rotationEveryWeeks === 1 ? 'rodizio1' : 'rodizio2';
}

export function GenerateDialog({
  rules,
  hasExisting,
  isCurrentMonth,
  onCancel,
  onGenerate,
}: {
  rules: Rules;
  hasExisting: boolean;
  isCurrentMonth: boolean;
  onCancel: () => void;
  onGenerate: (patch: Partial<Rules>) => void;
}) {
  const [mode, setMode] = useState<Mode>(modeOf(rules));
  const [startWd, setStartWd] = useState(rules.rotationStartWeekday ?? 4);

  const submit = () => {
    const patch: Partial<Rules> =
      mode === 'fixo'
        ? { rotation: 'fixo' }
        : mode === 'livre'
          ? { rotation: 'livre' }
          : { rotation: 'semanal', rotationEveryWeeks: mode === 'rodizio1' ? 1 : 2, rotationStartWeekday: startWd };
    onGenerate(patch);
  };

  return (
    <Modal onClose={onCancel} wide>
      <h2 className="mb-1 text-xl font-bold">Gerar escala</h2>
      <p className="mb-4 text-sm text-slate-600">
        Escolha como a <b>equipe do dia</b> se divide entre manhã e tarde. A madrugada tem sempre a sua equipe própria. Todas as opções respeitam
        as regras do 5x2.
      </p>
      <div className="space-y-2">
        {OPTIONS.map((o) => (
          <label
            key={o.id}
            className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${
              mode === o.id ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-100' : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <input type="radio" name="mode" className="mt-1" checked={mode === o.id} onChange={() => setMode(o.id)} />
            <div>
              <div className="flex items-center gap-2 font-semibold">
                {o.title}
                {o.tag && <span className="rounded-full bg-brand-700 px-2 py-0.5 text-[10px] font-bold text-white uppercase">{o.tag}</span>}
              </div>
              <div className="text-sm text-slate-600">{o.desc}</div>
            </div>
          </label>
        ))}
      </div>
      {(mode === 'rodizio1' || mode === 'rodizio2') && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span>A troca de turno acontece na</span>
          <select className="input w-auto" value={startWd} onChange={(e) => setStartWd(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
              <option key={wd} value={wd}>
                {weekdayLong(wd)}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-500">(melhor logo depois dos dias de menos movimento)</span>
        </div>
      )}
      <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
        {hasExisting && <p>• A escala deste mês será refeita. As células travadas (🔒) são mantidas.</p>}
        {isCurrentMonth && <p>• Os dias que já passaram ficam como estão.</p>}
        <p>• Quem só pode trabalhar num turno (marcado no cadastro como “só manhã” ou “só tarde”) fica sempre nele.</p>
        <p>• A escolha fica salva para os próximos meses (dá para mudar em Configurações).</p>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn" onClick={onCancel}>
          Cancelar
        </button>
        <button className="btn btn-primary" onClick={submit}>
          ⚡ Gerar escala
        </button>
      </div>
    </Modal>
  );
}
