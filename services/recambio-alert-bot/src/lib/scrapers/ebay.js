const { chromium } = require("playwright");

function normalizeRef(ref) {
  return String(ref || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function parseEur(value) {
  if (!value) return null;
  const cleaned = value
    .replace(/EUR|€/gi, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .match(/\d+(?:\.\d+)?/);
  return cleaned ? Number(cleaned[0]) : null;
}

function oemScore(text) {
  const lower = (text || "").toLowerCase();
  let score = 0;
  if (/(genuine|original|oem)/.test(lower)) score += 2;
  if (/(toyota|lexus)/.test(lower)) score += 1;
  return score;
}

function shouldKeep(item, part, strictOEM) {
  const text = `${item.title || ""} ${item.subtitle || ""}`.toLowerCase();
  if (/patrocinad|sponsored/.test(text) || /ver precios/.test(text)) return false;
  if (!item.link || !item.title || !item.priceText) return false;

  const refNorm = normalizeRef(part.ref);
  const txtNorm = normalizeRef(text);
  const hasRef = txtNorm.includes(refNorm);
  const hasWords = /(genuine|original|oem|toyota|lexus)/.test(text);

  if (strictOEM) return hasRef && hasWords;
  return hasRef;
}

function normalizeItem(item) {
  const price = parseEur(item.priceText);
  const shipping = parseEur(item.shippingText) || 0;
  const total = price !== null ? price + shipping : null;
  return { ...item, price, shipping, total, score: oemScore(item.title) };
}

async function scrapeEbay(part, config, logger) {
  const query = `${part.ref} ${(part.keywords || []).join(" ")}`.trim();
  const url = `https://${config.ebayDomain}/sch/i.html?_nkw=${encodeURIComponent(query)}&_sop=15&LH_BIN=1`;

  const browser = await chromium.launch({
    headless: config.headless,
    proxy: config.proxyUrl ? { server: config.proxyUrl } : undefined
  });

  try {
    const context = await browser.newContext({
      userAgent: config.userAgent,
      viewport: { width: 1366, height: 900 },
      locale: "es-ES"
    });

    const page = await context.newPage();
    page.setDefaultTimeout(45000);

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(500 + Math.floor(Math.random() * 1200));
    await page.waitForSelector("li.s-item", { timeout: 15000 });

    const rawItems = await page.$$eval("li.s-item", (nodes) => {
      return nodes.map((n) => {
        const title = n.querySelector(".s-item__title")?.textContent?.trim() || "";
        const subtitle = n.querySelector(".s-item__subtitle")?.textContent?.trim() || "";
        const link = n.querySelector("a.s-item__link")?.href || "";
        const priceText = n.querySelector(".s-item__price")?.textContent?.trim() || "";
        const shippingText = n.querySelector(".s-item__shipping, .s-item__logisticsCost")?.textContent?.trim() || "";
        return { title, subtitle, link, priceText, shippingText };
      });
    });

    const offers = rawItems
      .map(normalizeItem)
      .filter((it) => shouldKeep(it, part, config.strictOEM))
      .filter((it) => it.total !== null)
      .sort((a, b) => a.total - b.total || b.score - a.score)
      .slice(0, config.maxResults);

    logger.info("ebay_scrape_done", { ref: part.ref, source: "ebay", found: offers.length, url });
    return { source: "ebay", url, offers, best: offers[0] || null };
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeEbay, parseEur, normalizeRef };
