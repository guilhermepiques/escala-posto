import { useCallback, useRef, useState, type ReactNode } from 'react';

/** Janela própria do site (as janelas nativas do navegador às vezes ficam bloqueadas). */
export function Modal({ children, onClose, wide }: { children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        className={`max-h-[92vh] w-full ${wide ? 'max-w-2xl' : 'max-w-md'} overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}

/** Substitui o `confirm()` do navegador: `const [dialog, ask] = useConfirm(); if (await ask({...})) ...` */
export function useConfirm(): [ReactNode, (o: ConfirmOptions) => Promise<boolean>] {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const ask = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  };

  const dialog = opts ? (
    <Modal onClose={() => close(false)}>
      <h2 className="mb-2 text-lg font-bold">{opts.title}</h2>
      {opts.message && <div className="mb-4 text-sm text-slate-700">{opts.message}</div>}
      <div className="flex justify-end gap-2">
        <button className="btn" onClick={() => close(false)}>
          Cancelar
        </button>
        <button className={`btn ${opts.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)} autoFocus>
          {opts.confirmLabel ?? 'Confirmar'}
        </button>
      </div>
    </Modal>
  ) : null;

  return [dialog, ask];
}
