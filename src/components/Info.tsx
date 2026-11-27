import type { ReactNode } from 'react';

export function InfoPage({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <article className="prose-info mx-auto max-w-4xl">
      <h1 className="mb-2 text-3xl font-bold text-slate-900">{title}</h1>
      {intro && <p className="text-lg text-slate-600">{intro}</p>}
      {children}
    </article>
  );
}

const TONE = {
  info: 'border-sky-200 bg-sky-50 text-sky-950',
  warn: 'border-amber-200 bg-amber-50 text-amber-950',
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  danger: 'border-red-200 bg-red-50 text-red-950',
  night: 'border-indigo-200 bg-indigo-50 text-indigo-950',
};

export function Callout({ tone = 'info', title, children }: { tone?: keyof typeof TONE; title?: string; children: ReactNode }) {
  return (
    <div className={`my-4 rounded-xl border p-4 ${TONE[tone]} [&_p]:text-inherit [&_li]:text-inherit [&_ul]:text-inherit`}>
      {title && <div className="mb-1 font-bold">{title}</div>}
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}

export function Sources({ items }: { items: Array<[string, string]> }) {
  return (
    <section className="mt-10 border-t border-slate-200 pt-4">
      <h2 className="!mt-0 !text-base">Fontes</h2>
      <ul className="text-sm">
        {items.map(([label, url]) => (
          <li key={url}>
            <a href={url} target="_blank" rel="noreferrer">
              {label}
            </a>
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-500">Pesquisa feita em novembro de 2026. As regras podem mudar com decisões do STF ou novas portarias.</p>
    </section>
  );
}

export function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm open:shadow">
      <summary className="cursor-pointer list-none text-base font-semibold text-slate-900">
        <span className="mr-2 inline-block text-brand-700 transition group-open:rotate-90">▸</span>
        {q}
      </summary>
      <div className="mt-3 text-sm leading-relaxed text-slate-700 [&_p]:mb-2 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5">{children}</div>
    </details>
  );
}
