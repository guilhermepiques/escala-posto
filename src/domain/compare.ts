import type { AppConfig } from './types';

/** JSON com as chaves em ordem (o Firestore devolve os campos em outra ordem). */
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

/** Mesmas configurações? (ignora a data da última gravação) */
export function sameConfig(a: AppConfig, b: AppConfig): boolean {
  return stableStringify({ ...a, updatedAt: 0 }) === stableStringify({ ...b, updatedAt: 0 });
}
