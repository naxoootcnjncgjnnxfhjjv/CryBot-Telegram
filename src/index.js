import express from 'express';
import { Telegraf } from 'telegraf';
import { config, assertRuntimeConfig } from './core/config.js';
import { logger } from './core/logger.js';
import { registerCommands } from './bot/registerCommands.js';

assertRuntimeConfig(config);

const app = express();
const bot = new Telegraf(config.botToken);

registerCommands(bot, config);

app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

app.get('/', (_req, res) => {
  res.status(200).send('CryBot API online');
});

app.post(config.webhookPath, (req, res) => {
  bot.handleUpdate(req.body).catch((error) => {
    logger.error('telegram_update_error', {
      error: error.message
    });
  });

  res.sendStatus(200);
});

app.listen(config.port, async () => {
  logger.info('crybot_boot', {
    port: config.port,
    env: config.nodeEnv
  });

  if (config.baseUrl) {
    try {
      await bot.telegram.setWebhook(`${config.baseUrl}${config.webhookPath}`);

      logger.info('webhook_configured', {
        webhook: `${config.baseUrl}${config.webhookPath}`
      });
    } catch (error) {
      logger.error('webhook_failed', {
        error: error.message
      });
    }
  } else {
    logger.warn('base_url_missing');
  }
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
