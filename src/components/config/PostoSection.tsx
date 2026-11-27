import { useState } from 'react';
import { editorsOf, firebaseEnabled, normEmail } from '../../data/firebase';
import type { AppConfig } from '../../domain/types';
import { useApp } from '../../state';

type Role = 'editar' | 'ver';

/** Nome do posto e quem tem acesso (e-mails), com o que cada um pode fazer. */
export function PostoSection({
  draft,
  setDraft,
  disabled,
}: {
  draft: AppConfig;
  setDraft: (fn: (d: AppConfig) => AppConfig) => void;
  disabled?: boolean;
}) {
  const { posto, user, isOwner, updateAccess } = useApp();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('ver');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const editors = posto ? editorsOf(posto) : [];

  const change = async (members: string[], nextEditors: string[], ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await updateAccess(members, nextEditors);
      setMsg(ok);
    } catch (e) {
      setMsg(`Não foi possível salvar: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card">
      <h2 className="mb-3 text-lg font-bold">Posto e acesso</h2>
      <div className="mb-5 max-w-md">
        <label className="label">Nome do posto</label>
        <input
          className="input"
          value={draft.businessName ?? ''}
          placeholder="Ex.: Posto Central"
          disabled={disabled}
          onChange={(e) => setDraft((d) => ({ ...d, businessName: e.target.value }))}
        />
        <p className="mt-1 text-xs text-slate-500">Aparece no topo do site e na escala impressa.</p>
      </div>

      <h3 className="mb-1 text-sm font-semibold">Quem pode acessar</h3>
      {!firebaseEnabled || !posto ? (
        <p className="text-sm text-slate-600">
          No modo local os dados ficam só neste navegador. Quando a conta na nuvem estiver ligada, aqui dá para liberar o acesso para outros
          e-mails (ex.: gerente e dono).
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-600">
            Essas contas do Google entram e veem a mesma escala. <b>Pode editar</b>: monta a escala, cadastra funcionários e muda as
            configurações. <b>Só ver</b>: vê a escala e imprime, mas não muda nada (bom para a diretoria acompanhar pelo celular).{' '}
            {isOwner ? 'Só você (dono) pode mudar esta lista.' : 'Só o dono da conta pode mudar esta lista.'}
          </p>
          <ul className="mb-3 space-y-1">
            {posto.members.map((m) => {
              const isOwnerRow = m === posto.ownerEmail;
              const canEditRow = editors.includes(m);
              return (
                <li key={m} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 break-all">
                    {m}
                    {isOwnerRow && <span className="ml-2 rounded bg-brand-100 px-1.5 text-xs text-brand-800">dono</span>}
                    {m === normEmail(user?.email ?? '') && <span className="ml-2 text-xs text-slate-500">(você)</span>}
                  </span>
                  {isOwner && !isOwnerRow ? (
                    <>
                      <select
                        className="rounded border border-slate-300 bg-white px-1 py-0.5 text-xs"
                        value={canEditRow ? 'editar' : 'ver'}
                        disabled={busy}
                        onChange={(e) => {
                          const next = e.target.value === 'editar' ? [...editors, m] : editors.filter((x) => x !== m);
                          change(posto.members, next, e.target.value === 'editar' ? `${m} agora pode editar.` : `${m} agora só pode ver.`);
                        }}
                      >
                        <option value="editar">Pode editar</option>
                        <option value="ver">Só ver</option>
                      </select>
                      <button
                        className="text-xs text-red-600 hover:underline"
                        disabled={busy}
                        onClick={() =>
                          change(
                            posto.members.filter((x) => x !== m),
                            editors.filter((x) => x !== m),
                            `${m} não tem mais acesso.`,
                          )
                        }
                      >
                        remover
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-slate-600">{canEditRow ? 'Pode editar' : 'Só ver'}</span>
                  )}
                </li>
              );
            })}
          </ul>
          {isOwner && (
            <div className="flex max-w-xl flex-wrap gap-2">
              <input
                className="input min-w-56 flex-1"
                type="email"
                placeholder="email@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <select className="input w-auto" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="ver">Só ver</option>
                <option value="editar">Pode editar</option>
              </select>
              <button
                className="btn"
                disabled={!validEmail || busy}
                onClick={() => {
                  const m = normEmail(email);
                  const members = [...posto.members.filter((x) => x !== m), m];
                  const next = role === 'editar' ? [...editors.filter((x) => x !== m), m] : editors.filter((x) => x !== m);
                  change(members, next, `${m} já pode entrar com a conta do Google (${role === 'editar' ? 'pode editar' : 'só ver'}).`);
                  setEmail('');
                }}
              >
                Liberar acesso
              </button>
            </div>
          )}
          {msg && <p className="mt-2 text-sm text-slate-700">{msg}</p>}
          <p className="mt-2 text-xs text-slate-500">O acesso é salvo na hora (não precisa clicar em “Salvar alterações”).</p>
        </>
      )}
    </section>
  );
}
