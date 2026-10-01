// Test-only headless driver for tools/m5/fairness.html. Starts the fixed sequence and waits for its final status.
// usage: node tools/m5/fairness-driver.mjs WS_A WS_B [LIMIT]
import { chromium } from 'playwright';

const [wsA, wsB, limit = '300'] = process.argv.slice(2);
if (!wsA || !wsB) throw new Error('usage: fairness-driver WS_A WS_B [LIMIT]');
// Uncapped compositor frames so the page's own 60/120/144 Hz draw schedule is not clamped to a virtual 60 Hz display.
const browser = await chromium.launch({ args: ['--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') console.log(`[page ${message.type()}] ${message.text()}`); });
page.on('pageerror', error => console.log(`[page exception] ${error.message}`));
const query = new URLSearchParams({ wsA, wsB, limit });
await page.goto(`http://127.0.0.1:5173/tools/m5/fairness.html?${query}`);
await page.click('#start');
const status = () => page.textContent('#status');
let text = await status(), last = '';
while (!/^(Sequence captured|Blocked)/.test(text ?? '')) {
  if (text !== last) { console.log(text); last = text ?? ''; }
  await page.waitForTimeout(15000);
  text = await status();
}
console.log(text);
await browser.close();
process.exitCode = text?.startsWith('Sequence captured') ? 0 : 1;
