import { createServer } from 'node:http';
import 'dotenv/config';
import { Config } from './config/Config.js';
import { Logger } from './logging/Logger.js';
import { createContainer } from './container.js';
import { createApp } from './app.js';
import { connectMongoRepositories } from './db/mongoRepositories.js';

const config = new Config();
// A logger built ahead of the container, so a Mongo connection failure below still logs structured JSON.
const bootLogger = new Logger({ name: 'parcelflow-server' });

let mongo = null;
if (config.persistenceEnabled) {
  try {
    mongo = await connectMongoRepositories({ config, logger: bootLogger });
    bootLogger.info('mongo_connected', { database: config.mongoDbName, ...mongo.counts });
  } catch (error) {
    // Fail closed to in-memory rather than crash the boot: the app still runs, it just won't
    // persist across a restart until MONGODB_URI is reachable (see docs/decisions/ADR-010).
    bootLogger.error('mongo_connect_failed', { error: error.message });
  }
}

const container = createContainer({ config, repositories: mongo || {} });
const app = createApp(container);
const server = createServer(app);

server.listen(config.port, () => {
  container.logger.info('server_started', {
    port: config.port,
    nodeEnv: config.nodeEnv,
    oauthEnabled: config.oauthEnabled,
    aiEnabled: config.aiEnabled,
    persistenceEnabled: Boolean(mongo),
    activePolicy: container.policyService.activeVersion(),
    clientOrigin: config.clientOrigin
  });
  if (!config.oauthEnabled) {
    container.logger.warn('oauth_not_configured', { message: 'GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET are not set; falling back to POST /api/auth/dev-login for local sign-in.' });
  }
  if (!config.aiEnabled) {
    container.logger.warn('ai_not_configured', { message: 'GEMINI_API_KEY is not set; the Operations Assistant and Risk narrator are using the deterministic heuristic only.' });
  }
  if (!mongo) {
    container.logger.warn('persistence_not_configured', { message: 'MONGODB_URI is not set (or could not be reached); data is in-memory only and is lost on restart.' });
  }
});

function shutdown(signal) {
  container.logger.info('shutdown_initiated', { signal });
  server.close(async () => {
    if (mongo) await mongo.close().catch(() => {});
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
