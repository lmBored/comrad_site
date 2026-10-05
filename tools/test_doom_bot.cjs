// Static regression checks for the browser bot contract.
// Run with: node --test tools/test_doom_bot.cjs
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const launcher = fs.readFileSync(path.join(root, 'assets/doom_browser.js'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'assets/doom/engine.worker.js'), 'utf8');
const botConfig = path.join(root, 'assets/doom/bots.cfg');

test('browser launcher uses GZDoom native bot startup', () => {
  assert.match(launcher, /"-bots",\s*"Rambo"/);
  assert.match(launcher, /\/home\/web_user\/\.config\/zdoom\/bots\.cfg/);
  assert.doesNotMatch(launcher, /viz_bots_path|bot_start\.cfg|Backquote/);
  assert.doesNotMatch(launcher, /setTimeout\(startLocalBot/);
});

test('worker creates the GZDoom user config directory before MEMFS writes', () => {
  assert.match(worker, /FS\.mkdirTree\('\/home\/web_user\/\.config\/zdoom'\)/);
});

test('Rambo definition is self-hosted', () => {
  assert.ok(fs.existsSync(botConfig));
  assert.match(fs.readFileSync(botConfig, 'utf8'), /name\s+Rambo/);
});
