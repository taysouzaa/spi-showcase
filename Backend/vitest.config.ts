import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    // Variaveis exigidas por modulos que validam configuracao no construtor
    // (ex.: S3Service lanca se AWS_S3_BUCKET estiver ausente). Valores fake:
    // nenhum teste faz chamada real a AWS.
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-key-for-unit-tests',
      JWT_REFRESH_SECRET: 'test-refresh-secret-for-unit-tests',
      AWS_S3_BUCKET: 'test-bucket',
      AWS_REGION: 'us-east-1',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/__tests__/**', 'src/server.ts', 'src/bootstrap.ts'],
    },
  },
});
