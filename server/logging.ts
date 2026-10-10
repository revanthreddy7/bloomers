import 'server-only';
import { createLogger } from './logging-core';

export const logger = createLogger((entry) =>
  console.info(JSON.stringify(entry)),
);
