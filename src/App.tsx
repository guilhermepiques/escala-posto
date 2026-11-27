import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { firebaseEnabled } from './data/firebase';
import AdminPage from './pages/AdminPage';
import ConfigPage from './pages/ConfigPage';
import DuvidasPage from './pages/DuvidasPage';
import EmployeesPage from './pages/EmployeesPage';
import FeriasPage from './pages/FeriasPage';
import PrintPage from './pages/PrintPage';
import Regras5x2Page from './pages/Regras5x2Page';
import SchedulePage from './pages/SchedulePage';
import Viabilidade24hPage from './pages/Viabilidade24hPage';
import { useApp } from './state';
import { APP_VERSION } from './version';

const WORK_TABS = [
  { to: '/escala', label: 'Escala do mês' },
  { to: '/funcionarios', label: 'Funcionários' },
  { to: '/configuracoes', label: 'Configurações' },
];
const INFO_TABS = [
  { to: '/regras-5x2', label: 'Regras do 5x2' },
  { to: '/como-manter-24h', label: 'Como manter 24h' },
  { to: '/ferias', label: 'Férias' },
  { to: '/duvidas', label: 'Dúvidas' },
];

export default function App() {
  const loc = useLocation();
  if (loc.pathname.startsWith('/imprimir/')) {
    return (
      <Routes>
        <Route path="/imprimir/:month" element={<PrintPage />} />
      </Routes>
    );
  }
  return (
    <div className="min-h-screen">
      <Header />
      <Banners />
      <main className="mx-auto max-w-[1500px] px-4 py-6">
        <Routes>
          <Route path="/" element={<Navigate to="/escala" replace />} />
          <Route path="/escala" element={<SchedulePage />} />
          <Route path="/funcionarios" element={<EmployeesPage />} />
          <Route path="/configuracoes" element={<ConfigPage />} />
          <Route path="/regras-5x2" element={<Regras5x2Page />} />
          <Route path="/como-manter-24h" element={<Viabilidade24hPage />} />
          <Route path="/24h-com-13" element={<Navigate to="/como-manter-24h" replace />} />
          <Route path="/ferias" element={<FeriasPage />} />
          <Route path="/duvidas" element={<DuvidasPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/escala" replace />} />
        </Routes>
      </main>
      <footer className="no-print mx-auto max-w-[1500px] px-4 pb-8 text-xs text-slate-500">
        As regras seguem a EC 141/2026, o Decreto 13.173/2026, a Portaria MTE 2.041/2026 e a Convenção Coletiva
        2026-2028 dos frentistas de SP (Sincopetro × Fepospetro). Em caso de dúvida, confirme com o contador.
        <span className="ml-2 text-slate-400">EscalApp {APP_VERSION}</span>
      </footer>
    </div>
  );
}

function Header() {
  const { store, user, logOut, config, postos, posto, switchPosto, isAdmin, canEdit } = useApp();
  const tab = (t: { to: string; label: string }) => (
    <NavLink
      key={t.to}
      to={t.to}
      className={({ isActive }) =>
        `shrink-0 rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap transition ${
          isActive ? 'bg-white text-brand-800 shadow-sm' : 'text-brand-50 hover:bg-brand-600'
        }`
      }
    >
      {t.label}
    </NavLink>
  );
  return (
    <header className="no-print bg-brand-700 text-white">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <img src="/favicon.svg" alt="" className="h-8 w-8 rounded-lg ring-2 ring-white/30" />
          <div className="leading-tight">
            <div className="text-lg font-bold">EscalApp</div>
            {config.businessName && <div className="text-xs text-brand-100">{config.businessName}</div>}
          </div>
        </div>
        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {WORK_TABS.map(tab)}
          {isAdmin && tab({ to: '/admin', label: 'Admin' })}
          <span className="mx-2 h-6 w-px shrink-0 bg-white/30" />
          {INFO_TABS.map(tab)}
        </nav>
        <div className="flex items-center gap-2 text-xs text-brand-100">
          {store.kind === 'local' ? (
            <span className="rounded bg-amber-400/90 px-2 py-1 font-semibold text-amber-950" title="Os dados ficam só neste navegador">
              {firebaseEnabled ? '' : 'Modo local (sem Firebase)'}
            </span>
          ) : (
            <>
              {postos.length > 1 && (
                <select
                  className="rounded border border-white/40 bg-brand-800 px-1 py-1 text-white"
                  value={posto?.id}
                  onChange={(e) => switchPosto(e.target.value)}
                  title="Trocar de posto"
                >
                  {postos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.ownerUid === user?.uid ? 'Meu posto' : `Posto de ${p.ownerEmail}`}
                    </option>
                  ))}
                </select>
              )}
              {!canEdit && (
                <span className="rounded bg-white/20 px-2 py-1 font-semibold text-white" title="Esta conta pode ver, mas não mudar">
                  Só visualização
                </span>
              )}
              <span className="hidden sm:inline">{user?.displayName ?? user?.email}</span>
              <button className="rounded border border-white/40 px-2 py-1 hover:bg-white/10" onClick={() => logOut()}>
                Sair
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/** Avisos no topo: app desatualizado, modo só ver e recado do administrador. */
function Banners() {
  const { readOnlyReason, platform, isAdmin, posto, user } = useApp();
  const adminVisiting = isAdmin && !!posto && !posto.members.includes((user?.email ?? '').toLowerCase());
  return (
    <div className="no-print">
      {readOnlyReason === 'outdated' && (
        <div className="bg-amber-100 text-amber-950">
          <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3 px-4 py-2 text-sm">
            <span>
              <b>Esta versão do EscalApp está desatualizada.</b> Dá para ver a escala, mas não salvar mudanças. Recarregue a página (no
              aplicativo do computador: feche e abra de novo para atualizar).
            </span>
            <button className="btn btn-sm ml-auto" onClick={() => window.location.reload()}>
              Recarregar
            </button>
          </div>
        </div>
      )}
      {readOnlyReason === 'viewer' && (
        <div className="bg-sky-50 text-sky-900">
          <div className="mx-auto max-w-[1500px] px-4 py-2 text-sm">
            {adminVisiting
              ? 'Você está vendo o posto de outra pessoa como administrador (só visualização).'
              : 'Você está no modo só ver: dá para ver e imprimir a escala, mas não mudar. Para mudar algo, fale com o dono do posto.'}
          </div>
        </div>
      )}
      {platform.message && (
        <div className="bg-brand-50 text-brand-900">
          <div className="mx-auto max-w-[1500px] px-4 py-2 text-sm">{platform.message}</div>
        </div>
      )}
    </div>
  );
}
