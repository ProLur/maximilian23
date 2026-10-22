const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

function fixture(status = 'published') {
  const docs = new Map([['citePosts/example', { name: 'projects/cronica-escolar-maximilian23/databases/(default)/documents/citePosts/example', fields: { status: { stringValue: status } }, updateTime: 'v1' }]]);
  let version = 1, commits = 0, requests = 0, failCommit = false;
  const mockFetch = async (url, options = {}) => {
    requests++;
    assert.match(url, /^https:\/\/firestore.googleapis.com\/v1\/projects\/cronica-escolar-maximilian23\/databases\/\(default\)\/documents/);
    if (url.endsWith(':commit')) {
      const { writes } = JSON.parse(options.body);
      if (failCommit) return Response.json({ error: { status: 'PERMISSION_DENIED' } }, { status: 403 });
      assert.equal(writes.length, 2);
      assert.deepEqual(writes[0].transform.fieldTransforms, [{ fieldPath: 'views', increment: { integerValue: '1' } }]);
      for (const w of writes) {
        const name = w.transform?.document || w.update.name, key = name.split('/documents/')[1], doc = docs.get(key);
        const p = w.currentDocument;
        if ((p.exists === false && doc) || (p.updateTime && p.updateTime !== doc?.updateTime)) return Response.json({ error: { status: 'FAILED_PRECONDITION' } }, { status: 400 });
      }
      for (const w of writes) {
        const name = w.transform?.document || w.update.name, key = name.split('/documents/')[1];
        const doc = w.update || docs.get(key);
        if (w.transform) doc.fields.views = { integerValue: String(Number(doc.fields.views?.integerValue || 0) + 1) };
        docs.set(key, { ...doc, updateTime: 'v' + (++version) });
      }
      commits++;
      return Response.json({});
    }
    const key = new URL(url).pathname.split('/documents/')[1], doc = docs.get(key);
    return doc ? Response.json(doc) : Response.json({}, { status: 404 });
  };
  const context = vm.createContext({ crypto: webcrypto, fetch: mockFetch, Response, Request, URL, AbortSignal, TextEncoder, TextDecoder, Uint8Array, console, atob, btoa });
  const source = fs.readFileSync('aula/worker.js', 'utf8').replace('export default', 'const worker =');
  vm.runInContext(source + '\n cachedToken={token:"test-only",exp:9999999999}; globalThis.worker=worker;', context);
  const env = { FIREBASE_SA_KEY: JSON.stringify({ project_id: 'different-existing-project', private_key: 'test-only-key' }) };
  const call = (body = {}, origin = 'https://maximilian23.com') => context.worker.fetch(new Request('https://example.com/blog-views', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ blog: 'cite', id: 'example', visitorId: '17f8c072-b3df-43a5-ae2b-492d9ab84e9b', ...body }) }), env);
  return { call, docs, stats: () => ({ commits, requests }), fail: () => { failCommit = true; } };
}

test('persists a missing counter and deduplicates concurrent visits atomically', async () => {
  const f = fixture();
  const results = await Promise.all(Array.from({ length: 6 }, () => f.call().then(r => r.json())));
  assert.equal(results.filter(r => r.counted).length, 1);
  assert.equal(f.docs.get('citePosts/example').fields.views.integerValue, '1');
  assert.equal(f.stats().commits, 1);
  assert.equal((await (await f.call()).json()).counted, false);
});
test('a new browser and an expired receipt count again', async () => {
  const f = fixture(); await f.call();
  assert.equal((await (await f.call({ visitorId: '27f8c072-b3df-43a5-ae2b-492d9ab84e9b' })).json()).counted, true);
  for (const [key, doc] of f.docs) if (key.startsWith('_blogViewReceipts/')) doc.fields.countedAt.timestampValue = '2020-01-01T00:00:00Z';
  assert.equal((await (await f.call()).json()).counted, true);
  assert.equal(f.docs.get('citePosts/example').fields.views.integerValue, '3');
});
test('rejects unknown collections, path injection, extra fields and unapproved origins before database access', async () => {
  const f = fixture();
  for (const body of [{ blog: 'articles' }, { blog: '__proto__' }, { id: '../private/doc' }, { views: 500 }, { visitorId: 'fake' }]) assert.equal((await f.call(body)).status, 400);
  assert.equal((await f.call({}, 'https://evil.example')).status, 403);
  assert.equal(f.stats().requests, 0);
});
test('never creates posts, counts drafts or marks a failed commit as counted', async () => {
  const draft = fixture('draft'); assert.equal((await draft.call()).status, 404); assert.equal(draft.stats().commits, 0);
  const missing = fixture(); assert.equal((await missing.call({ id: 'missing' })).status, 404);
  const failed = fixture(); failed.fail(); assert.equal((await failed.call()).status, 503);
  assert.equal(failed.docs.size, 1); assert.equal(failed.docs.get('citePosts/example').fields.views, undefined);
});
