import { useState } from 'react';
import { firebaseEnabled, normEmail } from '../../data/firebase';
import type { AppConfig } from '../../domain/types';
import { useApp } from '../../state';

/** Nome do posto e quem tem acesso (e-mails). */
export function PostoSection({ draft, setDraft }: { draft: AppConfig; setDraft: (fn: (d: AppConfig) => AppConfig) => void }) {
  const { posto, user, updateMembers } = useApp();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const isOwner = !!posto && posto.ownerUid === user?.uid;
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const change = async (members: string[], ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await updateMembers(members);
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
            Essas contas do Google entram e veem a mesma escala.{' '}
            {isOwner ? 'Só você (dono) pode adicionar ou remover.' : 'Só o dono da conta pode adicionar ou remover.'}
          </p>
          <ul className="mb-3 space-y-1">
            {posto.members.map((m) => (
              <li key={m} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-sm">
                <span>
                  {m}
                  {m === posto.ownerEmail && <span className="ml-2 rounded bg-brand-100 px-1.5 text-xs text-brand-800">dono</span>}
                  {m === normEmail(user?.email ?? '') && <span className="ml-2 text-xs text-slate-500">(você)</span>}
                </span>
                {isOwner && m !== posto.ownerEmail && (
                  <button
                    className="text-xs text-red-600 hover:underline"
                    disabled={busy}
                    onClick={() => change(posto.members.filter((x) => x !== m), `${m} não tem mais acesso.`)}
                  >
                    remover
                  </button>
                )}
              </li>
            ))}
          </ul>
          {isOwner && (
            <div className="flex max-w-md gap-2">
              <input
                className="input"
                type="email"
                placeholder="email@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button
                className="btn"
                disabled={!validEmail || busy}
                onClick={() => {
                  const m = normEmail(email);
                  change([...posto.members, m], `${m} já pode entrar com a conta do Google.`);
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
