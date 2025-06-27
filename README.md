# CryBot-Telegram

Simple Telegram bot that responds to `/start` and can be deployed on platforms like Vercel or Railway using a webhook.

## Setup

1. Copy `.env.example` to `.env` and fill in your `BOT_TOKEN` and optional `WEBHOOK_URL`.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the bot locally:
   ```bash
   npm start
   ```

The bot listens for updates sent to `/webhook`. When hosted publicly and `WEBHOOK_URL` is defined, the webhook will be configured automatically.
