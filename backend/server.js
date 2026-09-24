import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { Config } from './src/config/Config.js';
import { createContainer } from './src/container.js';
import { createApp } from './src/app.js';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const config = new Config();
const container = createContainer({ config });
const app = createApp(container, { projectRoot });
const server = createServer(app);

server.listen(config.port, () => {
  container.logger.info('server_started', { port: config.port, authMode: config.authMode, nodeEnv: config.nodeEnv, activePolicy: container.policyService.activeVersion() });
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
process.on('unhandledRejection', (reason) => {
  container.logger.error('unhandled_rejection', { reason: reason instanceof Error ? reason.message : String(reason) });
});
process.on('uncaughtException', (error) => {
  container.logger.error('uncaught_exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

export { app, server, container };
