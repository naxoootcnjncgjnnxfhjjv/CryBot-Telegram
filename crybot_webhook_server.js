/*
 * CryBot Webhook Server
 *
 * This Express server implements a Telegram webhook endpoint with the
 * following features:
 *
 *  - Verifies the `X-Telegram-Bot-Api-Secret-Token` header against a
 *    secret defined in your environment (SECRET_TOKEN).
 *  - Responds with HTTP 200 immediately, so Telegram does not retry
 *    because of a slow handler. All processing happens after the
 *    response has been sent.
 *  - Provides a simple healthcheck endpoint at `/webhook/test` that
 *    returns a JSON payload with `status` and a timestamp.
 *  - Demonstrates basic handling of `message` and `callback_query`
 *    updates using the Telegram Bot API via axios.
 *
 * To run this server locally:
 *
 *   1. Create a `.env` file in the same directory with the following
 *      variables (replace with your actual values):
 *
 *         BOT_TOKEN=123456789:ABCDEF1234567890abcdefghijklmnopqrstuv
 *         SECRET_TOKEN=your-strong-secret-token
 *         PORT=8080
 *
 *   2. Install dependencies:
 *
 *         npm install express axios dotenv
 *
 *   3. Start the server:
 *
 *         node crybot_webhook_server.js
 *
 *   4. Expose your local server using a reverse proxy (e.g. ngrok) and
 *      register the webhook with Telegram:
 *
 *         curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
 *              -d "url=https://<your-public-domain>/webhook" \
 *              -d "secret_token=${SECRET_TOKEN}" \
 *              -d 'allowed_updates=["message","callback_query"]' \
 *              -d "max_connections=40" \
 *              -d "drop_pending_updates=true"
 *
 * This file is self-contained and can be used as a starting point
 * for more sophisticated bots. For production, you should add
 * additional error handling, logging, and security measures (e.g.
 * rate limiting, CSRF protection, etc.).
 */

require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();

// Load required environment variables
const BOT_TOKEN = process.env.BOT_TOKEN;
const SECRET_TOKEN = process.env.SECRET_TOKEN;
const PORT = process.env.PORT || 8080;

if (!BOT_TOKEN) {
  console.error('Error: BOT_TOKEN is not defined. Please set BOT_TOKEN in your environment or .env file.');
  process.exit(1);
}
if (!SECRET_TOKEN) {
  console.error('Error: SECRET_TOKEN is not defined. Please set SECRET_TOKEN in your environment or .env file.');
  process.exit(1);
}

const TELEGRAM_API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Middleware to parse JSON bodies
app.use(express.json());

/**
 * Healthcheck route
 *
 * Telegram does not use this endpoint; it's purely for you or a load balancer
 * to check that your server is running. It returns a JSON object with a
 * simple status and current timestamp. The route responds with HTTP 200.
 */
app.get('/webhook/test', (req, res) => {
  return res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Telegram webhook endpoint
 *
 * Telegram sends updates via POST requests to this route. We must return
 * a 200 status code within 10 seconds, otherwise Telegram will retry.
 * To achieve this, we respond immediately and then handle the update
 * asynchronously. We also verify the secret token header.
 */
app.post('/webhook', async (req, res) => {
  // Respond quickly to Telegram regardless of the result of processing.
  res.status(200).end();

  // Validate the secret token header
  const headerSecret = req.get('X-Telegram-Bot-Api-Secret-Token');
  if (!headerSecret || headerSecret !== SECRET_TOKEN) {
    console.warn('Discarding update due to invalid or missing secret token');
    return;
  }

  const update = req.body;
  try {
    await handleUpdate(update);
  } catch (err) {
    console.error('Unexpected error while processing update:', err);
  }
});

/**
 * Main update handler
 *
 * Inspect the update object to determine what type of event it contains
 * (e.g. message, callback query, etc.) and call the appropriate
 * handler. This is a simple demonstration; in a real bot you may have
 * more complex logic or route updates to separate functions.
 *
 * @param {Object} update - The raw update object from Telegram.
 */
async function handleUpdate(update) {
  if (!update) return;
  // Handle incoming messages
  if (update.message) {
    await handleMessage(update.message);
  }
  // Handle callback queries from inline keyboard buttons
  else if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
  }
  // You can add more handlers here for inline queries, chat members, etc.
}

/**
 * Handle incoming messages
 *
 * @param {Object} message - The `message` object from Telegram update
 */
async function handleMessage(message) {
  const chatId = message.chat?.id;
  const text = message.text || '';
  if (!chatId) return;

  try {
    if (text.startsWith('/start')) {
      await sendMessage(chatId, '¡Bienvenido a CryBot!');
    } else {
      // Echo the message back to the user
      await sendMessage(chatId, `Has enviado: ${text}`);
    }
  } catch (err) {
    console.error('Error handling message:', err);
  }
}

/**
 * Handle callback queries
 *
 * @param {Object} callbackQuery - The callback query object from Telegram update
 */
async function handleCallbackQuery(callbackQuery) {
  const callbackQueryId = callbackQuery.id;
  const data = callbackQuery.data || '';
  const chatId = callbackQuery.message?.chat?.id;

  try {
    // Acknowledge the callback query. Without answering, Telegram will
    // display a loading spinner to the user until it times out.
    await answerCallbackQuery(callbackQueryId, 'Acción recibida.');

    // Example: respond to different callback data values
    if (data === 'ping') {
      if (chatId) {
        await sendMessage(chatId, 'pong');
      }
    } else {
      if (chatId) {
        await sendMessage(chatId, `Recibido callback: ${data}`);
      }
    }
  } catch (err) {
    console.error('Error handling callback query:', err);
  }
}

/**
 * Send a text message to a Telegram chat
 *
 * @param {number|string} chatId - The chat ID to send the message to
 * @param {string} text - The message text
 */
async function sendMessage(chatId, text) {
  try {
    await axios.post(`${TELEGRAM_API_URL}/sendMessage`, {
      chat_id: chatId,
      text,
    });
  } catch (err) {
    console.error('Error sending message:', err.response?.data || err.message);
  }
}

/**
 * Answer a callback query
 *
 * @param {string} callbackQueryId - The ID of the callback query to answer
 * @param {string} text - Text to display in a popup notification to the user
 */
async function answerCallbackQuery(callbackQueryId, text) {
  try {
    await axios.post(`${TELEGRAM_API_URL}/answerCallbackQuery`, {
      callback_query_id: callbackQueryId,
      text,
    });
  } catch (err) {
    console.error('Error answering callback query:', err.response?.data || err.message);
  }
}

// Start the Express server
app.listen(PORT, () => {
  console.log(`CryBot webhook server listening on port ${PORT}`);
});
