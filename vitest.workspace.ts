import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'vitest.config.ts',
  'libs/service/nestjs/vitest.config.ts',
  'libs/user/interface/vitest.config.ts',
]);
