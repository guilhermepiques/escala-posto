import { useState } from 'react';
import type { Issue } from '../domain/types';

const STYLE: Record<Issue['severity'], { box: string; badge: string; label: string; plural: string }> = {
  erro: { box: 'border-red-200 bg-red-50', badge: 'bg-red-600 text-white', label: 'Erro', plural: 'Erros' },
  atencao: { box: 'border-orange-200 bg-orange-50', badge: 'bg-orange-500 text-white', label: 'Atenção', plural: 'Atenções' },
  aviso: { box: 'border-sky-200 bg-sky-50', badge: 'bg-sky-600 text-white', label: 'Aviso', plural: 'Avisos' },
};

export function SeverityBadge({ s, n }: { s: Issue['severity']; n?: number }) {
  const text = n === undefined ? STYLE[s].label : `${n} ${n === 1 ? STYLE[s].label : STYLE[s].plural}`;
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-bold ${STYLE[s].badge}`}>
      {text}
    </span>
  );
}

export function IssueList({
  issues,
  limit = 50,
  onSelect,
}: {
  issues: Issue[];
  limit?: number;
  onSelect?: (i: Issue) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const list = showAll ? issues : issues.slice(0, limit);
  if (issues.length === 0)
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
        ✓ Nenhum problema encontrado. A escala está dentro de todas as regras.
      </div>
    );
  return (
    <div className="space-y-2">
      {list.map((i, k) => (
        <div
          key={k}
          className={`rounded-xl border p-3 text-sm ${STYLE[i.severity].box} ${onSelect ? 'cursor-pointer hover:brightness-95' : ''}`}
          onClick={() => onSelect?.(i)}
        >
          <div className="flex items-start gap-2">
            <SeverityBadge s={i.severity} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-slate-900">{i.title}</div>
              <div className="mt-0.5 text-slate-700">{i.detail}</div>
              {i.suggestion && <div className="mt-1 text-slate-700">👉 {i.suggestion}</div>}
              {i.basis && <div className="mt-1 text-xs text-slate-500">Base: {i.basis}</div>}
            </div>
          </div>
        </div>
      ))}
      {issues.length > list.length && (
        <button className="btn btn-sm" onClick={() => setShowAll(true)}>
          Mostrar mais {issues.length - list.length}
        </button>
      )}
    </div>
  );
}
