import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`[Nivasa API] Running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  console.log(`[Nivasa API] Health endpoint at http://localhost:${env.PORT}/api/v1/health`);
});

