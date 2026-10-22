const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

test('client retries failures and suppresses reloads only after server confirmation', async () => {
  const storage = new Map(); let calls = 0;
  const context = vm.createContext({ crypto: webcrypto, AbortSignal, navigator: {}, localStorage: { getItem: k => storage.get(k), setItem: (k,v) => storage.set(k,v) }, console: { warn() {} }, fetch: async () => { calls++; return calls === 1 ? Response.json({}, { status: 503 }) : Response.json({ ok: true, retryAfterMs: 1800000 }); } });
  vm.runInContext(fs.readFileSync('blog/view-counter.js','utf8').replace('export async function', 'async function') + '\nglobalThis.record=recordPostView;', context);
  await context.record('cite','example'); assert.equal(storage.has('m23:view:cite:example'),false);
  await context.record('cite','example'); assert.equal(calls,2);
  await context.record('cite','example'); assert.equal(calls,2);
  await context.record('meteo','example'); assert.equal(calls,3);
});
test('client still records when browser storage is disabled', async () => {
  let calls = 0;
  const context = vm.createContext({ crypto: webcrypto, AbortSignal, navigator: {}, localStorage: { getItem() { throw Error(); }, setItem() { throw Error(); } }, console: { warn() {} }, fetch: async () => { calls++; return Response.json({ ok: true, retryAfterMs: 1800000 }); } });
  vm.runInContext(fs.readFileSync('blog/view-counter.js','utf8').replace('export async function', 'async function') + '\nglobalThis.record=recordPostView;', context);
  await context.record('cite','example'); assert.equal(calls,1);
});
