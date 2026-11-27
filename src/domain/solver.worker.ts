/// <reference lib="webworker" />
// Roda o gerador fora da tela principal, para a página não travar enquanto calcula.
import loadHighs from 'highs';
import wasmUrl from 'highs/runtime?url';
import { buildContext } from './context';
import { solveWith } from './solver';
import type { AppConfig, Assignments, Employee, MonthKey, Schedule } from './types';

export interface SolveRequest {
  month: MonthKey;
  employees: Employee[];
  config: AppConfig;
  previous?: Assignments;
  schedule?: Schedule;
}

let highsPromise: ReturnType<typeof loadHighs> | null = null;

self.onmessage = async (ev: MessageEvent<SolveRequest>) => {
  try {
    highsPromise ??= loadHighs({ locateFile: () => wasmUrl });
    const highs = await highsPromise;
    const { month, employees, config, previous, schedule } = ev.data;
    const ctx = buildContext(month, employees, config, previous);
    const out = solveWith(highs, ctx, schedule);
    (self as unknown as Worker).postMessage(out);
  } catch (err) {
    (self as unknown as Worker).postMessage({
      ok: false,
      status: 'error',
      assignments: {},
      seconds: 0,
      message: `Erro no gerador: ${(err as Error).message}`,
    });
  }
};
