const levels = ["debug", "info", "warn", "error"];

function createLogger(level = "info") {
  const min = Math.max(levels.indexOf(level), 0);

  function write(lvl, event, fields = {}) {
    if (levels.indexOf(lvl) < min) return;
    const payload = { timestamp: new Date().toISOString(), level: lvl, event, ...fields };

    if (fields?.err instanceof Error) {
      payload.err = { name: fields.err.name, message: fields.err.message, stack: fields.err.stack };
    }

    process.stdout.write(JSON.stringify(payload) + "\n");
  }

  return {
    debug: (e, f) => write("debug", e, f),
    info: (e, f) => write("info", e, f),
    warn: (e, f) => write("warn", e, f),
    error: (e, f) => write("error", e, f),
  };
}

module.exports = { createLogger };
