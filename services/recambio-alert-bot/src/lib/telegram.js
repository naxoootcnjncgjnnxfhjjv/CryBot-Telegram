const TELEGRAM_URL = "https://api.telegram.org";

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

class TelegramClient {
  constructor({ token, chatId, logger }) {
    this.token = token;
    this.chatId = chatId;
    this.logger = logger;
    this.offset = 0;
  }

  async api(method, body = undefined, timeoutMs = 30000) {
    const url = `${TELEGRAM_URL}/bot${this.token}/${method}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: body ? "POST" : "GET",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const err = new Error(`Telegram API error ${res.status}: ${JSON.stringify(data)}`);
        err.response = data;
        throw err;
      }
      return data.result;
    } finally {
      clearTimeout(timer);
    }
  }

  async sendMessage(text, extra = {}) {
    const waits = [0, 1000, 2500, 5000];
    let last;
    for (const w of waits) {
      if (w) await sleep(w);
      try {
        return await this.api("sendMessage", {
          chat_id: this.chatId,
          text,
          disable_web_page_preview: true,
          ...extra
        }, 15000);
      } catch (err) {
        last = err;
        this.logger.warn("telegram_send_retry", { err, waitMs: w });
      }
    }
    throw last;
  }

  async getUpdates() {
    return this.api("getUpdates", {
      offset: this.offset,
      timeout: 25,
      allowed_updates: ["message"]
    }, 35000);
  }

  consumeUpdate(update) {
    this.offset = Math.max(this.offset, update.update_id + 1);
  }
}

module.exports = { TelegramClient, sleep };
