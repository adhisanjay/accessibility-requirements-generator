import { defineConfig } from 'vitest/config';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = path.join(tmpdir(), `a11y-audit-api-tests-${process.pid}`);

export default defineConfig({
  test: { environment: 'node', pool: 'forks', singleThread: true, fileParallelism: false },
});
