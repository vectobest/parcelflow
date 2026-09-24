import { createServer } from 'node:http';
import 'dotenv/config';
import { Config } from './config/Config.js';
import { createContainer } from './container.js';
import { createApp } from './app.js';

const config = new Config();
const container = createContainer({ config });
const app = createApp(container);
const server = createServer(app);

server.listen(config.port, () => {
  container.logger.info('server_started', {
    port: config.port,
    nodeEnv: config.nodeEnv,
    oauthEnabled: config.oauthEnabled,
    activePolicy: container.policyService.activeVersion(),
    clientOrigin: config.clientOrigin
  });
  if (!config.oauthEnabled) {
    container.logger.warn('oauth_not_configured', { message: 'GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET are not set; falling back to POST /api/auth/dev-login for local sign-in.' });
  }
});

function shutdown(signal) {
  container.logger.info('shutdown_initiated', { signal });
  server.close(() => {
    container.logger.info('shutdown_complete');
    process.exit(0);
  });
  setTimeout(() => {
    container.logger.error('shutdown_forced_timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
