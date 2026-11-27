declare const __APP_VERSION__: string;

/** Versão do app (vem do package.json na hora de gerar o site). */
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
