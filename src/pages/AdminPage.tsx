import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { editorsOf, getBusinessName, savePlatform } from '../data/firebase';
import { SCHEMA_VERSION } from '../data/store';
import { formatTimestamp } from '../domain/dates';
import { useApp } from '../state';
import { APP_VERSION } from '../version';

/** Painel do administrador da plataforma: versão mínima do app e lista de todos os postos. */
export default function AdminPage() {
  const { isAdmin, postos, posto, switchPosto, platform } = useApp();
  const navigate = useNavigate();
  const [names, setNames] = useState<Record<string, string | undefined>>({});
  const [minVer, setMinVer] = useState(platform.minSchemaVersion);
  const [message, setMessage] = useState(platform.message ?? '');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const ids = postos.map((p) => p.id).join(',');
  useEffect(() => {
    if (!isAdmin) return;
    for (const p of postos) getBusinessName(p.id).then((n) => setNames((prev) => ({ ...prev, [p.id]: n })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, ids]);

  useEffect(() => {
    setMinVer(platform.minSchemaVersion);
    setMessage(platform.message ?? '');
  }, [platform.minSchemaVersion, platform.message]);

  if (!isAdmin) return <Navigate to="/escala" replace />;

  const tooHigh = minVer > SCHEMA_VERSION;
  const changed = minVer !== platform.minSchemaVersion || message.trim() !== (platform.message ?? '');

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await savePlatform({ minSchemaVersion: minVer, ...(message.trim() ? { message: message.trim() } : {}) });
      setMsg({ ok: true, text: 'Salvo. Vale na hora para todos os aparelhos abertos.' });
    } catch (e) {
      setMsg({ ok: false, text: `Não foi possível salvar: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Administração da plataforma</h1>

      <section className="card">
        <h2 className="mb-1 text-lg font-bold">Versão mínima do app</h2>
        <p className="mb-3 text-sm text-slate-600">
          Este app é a versão <b>{APP_VERSION}</b> e grava os dados no formato <b>{SCHEMA_VERSION}</b>. Quando sair uma versão que muda o
          formato, publique-a e depois suba este número: os apps antigos (ex.: um .exe que não atualizou) passam a só ver, e o banco recusa
          gravações deles. Até lá, deixe em 0.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Bloquear apps com formato abaixo de</label>
            <input
              type="number"
              min={0}
              className="input w-32"
              value={minVer}
              onChange={(e) => setMinVer(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            />
          </div>
          <div className="min-w-64 flex-1">
            <label className="label">Aviso para todos (opcional)</label>
            <input
              className="input"
              placeholder="Ex.: Nova versão disponível, feche e abra o app."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" disabled={busy || tooHigh || !changed} onClick={save}>
            Salvar
          </button>
        </div>
        {tooHigh && (
          <p className="mt-2 text-sm text-red-700">
            Não dá para passar de {SCHEMA_VERSION}: isso bloquearia também esta versão, que é a mais nova.
          </p>
        )}
        {msg && <p className={`mt-2 text-sm ${msg.ok ? 'text-emerald-700' : 'text-red-700'}`}>{msg.text}</p>}
        {platform.updatedAt && <p className="mt-2 text-xs text-slate-500">Última mudança: {formatTimestamp(platform.updatedAt)}</p>}
      </section>

      <section className="card">
        <h2 className="mb-1 text-lg font-bold">Postos ({postos.length})</h2>
        <p className="mb-3 text-sm text-slate-600">
          Você vê todos os postos para dar suporte. Nos postos de outras pessoas você entra só para ver; para editar, o dono precisa liberar o
          seu e-mail com “Pode editar”.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-600">
                <th className="py-2 pr-3">Posto</th>
                <th className="py-2 pr-3">Dono</th>
                <th className="py-2 pr-3">Acesso</th>
                <th className="py-2 pr-3">Criado em</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {postos.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="py-2 pr-3 font-semibold">{names[p.id] ?? '—'}</td>
                  <td className="py-2 pr-3 break-all">{p.ownerEmail}</td>
                  <td className="py-2 pr-3">
                    {p.members.length} pessoa(s), {editorsOf(p).length} edita(m)
                  </td>
                  <td className="py-2 pr-3">{p.createdAt ? formatTimestamp(p.createdAt) : '—'}</td>
                  <td className="py-2 text-right">
                    {p.id === posto?.id ? (
                      <span className="text-xs text-slate-500">aberto agora</span>
                    ) : (
                      <button
                        className="btn btn-sm"
                        onClick={() => {
                          switchPosto(p.id);
                          navigate('/escala');
                        }}
                      >
                        Abrir
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
