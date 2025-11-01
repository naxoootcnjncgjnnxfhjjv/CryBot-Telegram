// storage.js
// Persistencia de eventos de ventas y ofertas.
// Guarda información en un archivo JSON para evitar procesar ofertas duplicadas.

const fs = require('fs');
const path = require('path');

const storageDir = path.join(__dirname, 'storage');
const salesFile = path.join(storageDir, 'sales.json');

function ensureDir() {
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }
  if (!fs.existsSync(salesFile)) {
    fs.writeFileSync(salesFile, JSON.stringify({}, null, 2));
  }
}

function loadDB() {
  ensureDir();
  try {
    const raw = fs.readFileSync(salesFile, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return {};
  }
}

function saveDB(db) {
  ensureDir();
  fs.writeFileSync(salesFile, JSON.stringify(db, null, 2));
}

function isProcessed(offerId) {
  const db = loadDB();
  return Boolean(db[offerId]);
}

function recordOffer(offerId, data) {
  const db = loadDB();
  db[offerId] = data;
  saveDB(db);
}

function updateStatus(offerId, status) {
  const db = loadDB();
  if (!db[offerId]) return;
  db[offerId].status = status;
  db[offerId].updated_at = Date.now();
  saveDB(db);
}

function getOffer(offerId) {
  const db = loadDB();
  return db[offerId] || null;
}

module.exports = {
  isProcessed,
  recordOffer,
  updateStatus,
  getOffer,
};