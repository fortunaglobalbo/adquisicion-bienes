// In-memory requests only. Never uploads files or calls a real service.
const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, file);
const { appendPurchaseAttachments, cleanupPurchaseAttachmentUploads } = require('../src/lib/uploads/attachmentClient.ts');
const { MAX_ATTACHMENT_FILES, MAX_ATTACHMENT_FILE_BYTES, validateAttachmentSelection } = require('../src/lib/uploads/attachmentPolicy.ts');
const originalFetch = global.fetch;
const image = (index, bytes = 1024 * 1024, type = 'image/png') => new File([Buffer.alloc(bytes)], `foto-${index}.png`, { type });
const signed = files => files.map((file, index) => ({
  ref: { path: `purchase-attachments/test/${index}.png`, name: file.name, size: file.size, type: file.type || 'image/png', expiresAt: Date.now() + 3600000, proof: `proof-${index}` },
  signedUrl: `https://storage.invalid/upload/${index}?token=private-token`,
}));
const ok = () => new Response('{}', { status: 200 });
async function main() {
  let calls = [];
  global.fetch = async (...args) => { calls.push(args); throw Error('Unexpected request; real network disabled.'); };
  const small = [image(0, 10), image(1, 20)], inline = new FormData();
  await appendPurchaseAttachments(inline, small, 'purchase-test');
  assert.deepEqual(inline.getAll('attachments').map(file => file.name), small.map(file => file.name));
  assert.equal(inline.has('attachmentRefs'), false); assert.equal(calls.length, 0);

  const twenty = Array.from({ length: 20 }, (_, index) => image(index, 10));
  assert.equal(MAX_ATTACHMENT_FILES, 20); assert.equal(MAX_ATTACHMENT_FILE_BYTES, 50 * 1024 * 1024);
  assert.equal(validateAttachmentSelection(twenty), undefined);
  await appendPurchaseAttachments(new FormData(), twenty, 'purchase-test');
  await assert.rejects(() => appendPurchaseAttachments(new FormData(), [...twenty, image(21, 1)], 'purchase-test'), /20/);
  const exactSize = { name: 'large.pdf', type: 'application/pdf', size: MAX_ATTACHMENT_FILE_BYTES };
  assert.equal(validateAttachmentSelection([exactSize]), undefined);
  await assert.rejects(() => appendPurchaseAttachments(new FormData(), [{ ...exactSize, size: MAX_ATTACHMENT_FILE_BYTES + 1 }], 'purchase-test'), /50/);
  assert.equal(calls.length, 0, 'Invalid selections cannot start a network request');

  const photos = Array.from({ length: 4 }, (_, index) => image(index));
  assert.ok(photos.reduce((sum, file) => sum + file.size, 0) > 3 * 1024 * 1024);
  assert.equal(validateAttachmentSelection(photos), undefined, 'Four photos over 3 MB are supported');
  const uploads = signed(photos), progress = [], largeForm = new FormData(), controller = new AbortController();
  global.fetch = async (url, options) => {
    calls.push([url, options]);
    assert.equal(options.signal, controller.signal);
    if (url === '/api/attachments') {
      assert.equal(options.method, 'POST'); assert.equal(options.headers['Content-Type'], 'application/json');
      assert.deepEqual(JSON.parse(options.body), { acquisitionId: 'purchase-test', files: photos.map(({ name, size, type }) => ({ name, size, type })) });
      assert.ok(options.body.length < 1000, 'Signing request contains metadata only');
      return Response.json({ uploads });
    }
    const index = uploads.findIndex(upload => upload.signedUrl === url); assert.ok(index >= 0);
    assert.equal(options.method, 'PUT'); assert.equal(options.body, photos[index]);
    assert.deepEqual(options.headers, { 'Content-Type': 'image/png', 'cache-control': 'max-age=0', 'x-upsert': 'false' });
    assert.equal(options.credentials, 'omit'); return ok();
  };
  await appendPurchaseAttachments(largeForm, photos, 'purchase-test', { signal: controller.signal, onProgress: value => progress.push(value) });
  assert.equal(calls.length, 5); assert.equal(largeForm.has('attachments'), false);
  assert.deepEqual(JSON.parse(largeForm.get('attachmentRefs')), uploads.map(upload => upload.ref));
  assert.equal(progress[0].completed, 0); assert.equal(progress.at(-1).completed, 4);
  let cleanupRequests = [];
  global.fetch = async (url, options) => {
    assert.equal(url, '/api/attachments'); assert.equal(options.method, 'DELETE'); assert.equal(options.keepalive, true);
    assert.notEqual(options.signal, controller.signal); assert.equal(options.signal.aborted, false);
    cleanupRequests.push(JSON.parse(options.body)); return ok();
  };
  await cleanupPurchaseAttachmentUploads(largeForm, 'purchase-test');
  assert.deepEqual(cleanupRequests, [{ acquisitionId: 'purchase-test', refs: uploads.map(upload => upload.ref) }]);
  await cleanupPurchaseAttachmentUploads(inline, 'purchase-test');
  assert.equal(cleanupRequests.length, 1, 'Inline files need no storage cleanup');

  // Browsers sometimes provide no MIME. Storage receives the canonical signed MIME.
  const noMime = [image('blank-mime', 3 * 1024 * 1024, '')], noMimeUploads = signed(noMime);
  global.fetch = async (url, options) => {
    if (url === '/api/attachments') return Response.json({ uploads: noMimeUploads });
    assert.equal(options.headers['Content-Type'], 'image/png'); return ok();
  };
  await appendPurchaseAttachments(new FormData(), noMime, 'purchase-test');

  const failedForm = new FormData(); let failedPuts = 0;
  cleanupRequests = [];
  global.fetch = async (url, options) => {
    if (options.method === 'DELETE') { cleanupRequests.push(JSON.parse(options.body)); assert.equal(options.keepalive, true); return ok(); }
    if (url === '/api/attachments') return Response.json({ uploads });
    return ++failedPuts === 1 ? ok() : new Response('secret signed token', { status: 500 });
  };
  await assert.rejects(() => appendPurchaseAttachments(failedForm, photos, 'purchase-test'), error => {
    assert.match(error.message, /archivo 2 de 4/); assert.doesNotMatch(error.message, /token|https|storage/i); return true;
  });
  assert.equal(failedPuts, 2); assert.equal(failedForm.has('attachmentRefs'), false, 'No partial references reach the analysis endpoint');
  assert.deepEqual(cleanupRequests, [{ acquisitionId: 'purchase-test', refs: uploads.map(upload => upload.ref) }], 'All signed paths are cleaned after a partially completed upload');
  global.fetch = async () => new Response('https://storage.invalid/?secret=private-token', { status: 503 });
  await assert.rejects(() => appendPurchaseAttachments(new FormData(), photos, 'purchase-test'), error => {
    assert.match(error.message, /iniciar la subida/); assert.doesNotMatch(error.message, /token|https|storage/i); return true;
  });
  global.fetch = async () => Response.json({ uploads: uploads.slice(1) });
  await assert.rejects(() => appendPurchaseAttachments(new FormData(), photos, 'purchase-test'), /iniciar la subida/);

  const cancelled = new AbortController(); cancelled.abort();
  global.fetch = async () => { throw Error('Cancelled selection must not request uploads.'); };
  await assert.rejects(() => appendPurchaseAttachments(new FormData(), small, 'purchase-test', { signal: cancelled.signal }), { name: 'AbortError' });
  const duringUpload = new AbortController(), cancelledForm = new FormData(); let puts = 0; cleanupRequests = [];
  global.fetch = async (url, options) => {
    if (options.method === 'DELETE') { assert.notEqual(options.signal, duringUpload.signal); assert.equal(options.signal.aborted, false); cleanupRequests.push(JSON.parse(options.body)); throw Error('Cleanup failure is harmless to cancellation.'); }
    if (url === '/api/attachments') return Response.json({ uploads });
    puts++; assert.equal(options.signal, duringUpload.signal); duringUpload.abort('user');
    throw new DOMException('Signed token must never appear in error messages.', 'AbortError');
  };
  await assert.rejects(() => appendPurchaseAttachments(cancelledForm, photos, 'purchase-test', { signal: duringUpload.signal }), { name: 'AbortError' });
  assert.equal(puts, 1); assert.equal(cancelledForm.has('attachmentRefs'), false);
  assert.equal(cleanupRequests.length, 1, 'Cancelled uploads still attempt cleanup with an independent signal');
  console.log('PASS attachment client: 20 files, 50 MiB each, four photos over 3 MB, direct PUT + refs, small inline, progress, MIME fallback, failures, cancellation and best-effort cleanup; no real services.');
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; }).finally(() => { global.fetch = originalFetch; });
