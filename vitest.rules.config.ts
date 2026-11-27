import { defineConfig } from 'vitest/config';

// Testes das regras do banco: rodam contra o emulador do Firestore (npm run test:rules).
export default defineConfig({
  test: {
    include: ['rules/**/*.spec.ts'],
    environment: 'node',
    testTimeout: 20000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
});
