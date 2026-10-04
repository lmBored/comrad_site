// Requires Playwright and Chrome. Run against the site served on localhost:
// SITE_URL=http://127.0.0.1:8765 node --test tools/test_responsive.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

test('responsive layout contains content and keeps both hero marines visible', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const width of [320, 375, 390, 520, 720, 768, 860, 960, 980, 981, 1280, 1440]) {
      const page = await browser.newPage({
        viewport: { width, height: 900 }, isMobile: width <= 980, hasTouch: width <= 980,
      });
      try {
        await page.goto(process.env.SITE_URL || 'http://127.0.0.1:8765');
        await page.evaluate(() => document.fonts.ready);
        const layout = await page.evaluate(() => {
          const rect = e => {
            const { left, right, top, bottom, width, height } = e.getBoundingClientRect();
            return { left, right, top, bottom, width, height };
          };
          const wrapper = document.querySelector('.cmp-wrap');
          return {
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
            cta: rect(document.querySelector('.cta')),
            buddies: [...document.querySelectorAll('.hero-head .buddy')].map(e => ({
              ...rect(e), image: rect(e.querySelector('img')),
              loaded: e.querySelector('img').naturalWidth > 0,
            })),
            comparison: rect(wrapper),
            tableWidth: wrapper.scrollWidth,
            // Wide tables and scenario choices scroll inside their own containers.
            overflow: [...document.querySelectorAll('body *')].filter(e => {
              if (e.closest('.cmp-wrap, .board-wrap, .lvl-list, pre')) return false;
              const r = rect(e);
              return r.width && (r.left < -1 || r.right > document.documentElement.clientWidth + 1);
            }).map(e => `${e.tagName}.${e.className}`),
          };
        });
        assert.ok(layout.scrollWidth <= width, `${width}px: document width ${layout.scrollWidth}`);
        assert.deepEqual(layout.overflow, [], `${width}px: uncontained content`);
        assert.equal(layout.buddies.length, 2);
        for (const buddy of layout.buddies) {
          assert.ok(buddy.loaded && buddy.image.height > 0, `${width}px: marine visible`);
          assert.ok(buddy.left >= 0 && buddy.right <= width, `${width}px: marine in viewport`);
          if (width <= 980) assert.ok(buddy.top >= layout.cta.bottom, `${width}px: marine clears buttons`);
        }
        assert.ok(layout.comparison.right <= width, `${width}px: comparison fits`);
        if (width <= 520) assert.ok(layout.tableWidth > layout.comparison.width, 'table scrolls locally');
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
});
