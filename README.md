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

When hosting, set `WEBHOOK_URL` to your public URL and deploy the project. The webhook endpoint is `/webhook`.

### Deployment tips

- **Railway**: create a new Node.js project and provide your `.env` variables in the dashboard.
- **Vercel**: deploy as a Node.js server. Ensure your `WEBHOOK_URL` points to the deployed URL.

The `.env` file is excluded by `.gitignore` so your token won't be committed.
