const fs = require("fs/promises");
const path = require("path");

async function readJson(filePath, fallback = {}) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw err;
  }
}

async function writeJsonAtomic(filePath, value) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2) + "\n", "utf8");
  await fs.rename(tmp, filePath);
}

class StateStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.state = { items: {}, meta: {} };
  }
  async load() {
    this.state = await readJson(this.filePath, { items: {}, meta: {} });
    return this.state;
  }
  get(key) { return this.state.items[key]; }
  set(key, value) { this.state.items[key] = value; }
  async save() { await writeJsonAtomic(this.filePath, this.state); }
}

module.exports = { readJson, writeJsonAtomic, StateStore };
