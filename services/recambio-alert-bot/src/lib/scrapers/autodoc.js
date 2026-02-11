const { chromium } = require("playwright");
const { parseEur } = require("./ebay");

async function scrapeAutodoc(part, config, logger) {
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
    page.setDefaultTimeout(30000);

    const url = `https://www.autodoc.es/search?keyword=${encodeURIComponent(part.ref)}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(700 + Math.floor(Math.random() * 900));

    const items = await page.$$eval("article, .product-card", (nodes) => {
      return nodes.slice(0, 25).map((n) => {
        const title = n.querySelector("a, h3")?.textContent?.trim() || "";
        const link = n.querySelector("a")?.href || "";
        const priceText = n.querySelector("[class*='price'], .price")?.textContent?.trim() || "";
        return { title, link, priceText };
      });
    });

    const offers = items
      .map((it) => ({ ...it, price: parseEur(it.priceText) }))
      .filter((it) => it.title && it.link && it.price !== null)
      .map((it) => ({ ...it, shipping: 0, total: it.price }))
      .sort((a, b) => a.total - b.total)
      .slice(0, config.maxResults);

    logger.info("autodoc_scrape_done", { source: "autodoc", ref: part.ref, found: offers.length });
    return { source: "autodoc", url, offers, best: offers[0] || null };
  } catch (err) {
    logger.warn("autodoc_scrape_failed", { source: "autodoc", ref: part.ref, err });
    return { source: "autodoc", offers: [], best: null, error: err.message };
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeAutodoc };
