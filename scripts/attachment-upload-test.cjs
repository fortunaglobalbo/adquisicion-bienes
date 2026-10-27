// Isolated upload fixtures. No storage, database, provider calls, or real credentials.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true},
}).outputText, file);

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const calls = {db: 0, signs: [], downloads: [], deleted: [], bucket: []};
let company = 'ende', exists = true, bucketPublic = false, missingBucket = false, byteResponse = null;
let signing = 0, maxSigning = 0;
let stalledRemoval = false;
const db = {
  from(table) {
    assert.equal(table, 'adquisiciones');
    return {select() { return {eq(column, value) {
      assert.equal(column, 'id'); assert.equal(value, id);
      return {async maybeSingle() { return {data: exists ? {id, empresa_id: company} : null, error: null}; }};
    }}; }};
  },
  storage: {
    async getBucket(bucket) {
      assert.equal(bucket, 'purchase-inputs');
      return missingBucket ? {data: null, error: {message: 'Bucket not found', statusCode: '404'}} : {data: {public: bucketPublic, file_size_limit: 50 * 1024 * 1024}, error: null};
    },
    async createBucket(bucket, options) {
      calls.bucket.push({bucket, options}); missingBucket = false;
      assert.equal(options.public, false); assert.equal(options.fileSizeLimit, 50 * 1024 * 1024);
      return {data: {}, error: null};
    },
    async updateBucket() { throw Error('Unexpected bucket update'); },
    from(bucket) {
      assert.equal(bucket, 'purchase-inputs');
      return {
        async createSignedUploadUrl(filePath, options) {
          assert.equal(options.upsert, false); calls.signs.push(filePath);
          signing++; maxSigning = Math.max(maxSigning, signing);
          await Promise.resolve(); signing--;
          return {data: {signedUrl: `https://storage.invalid/object/upload/sign/purchase-inputs/${filePath}?token=fixture`}, error: null};
        },
        async createSignedUrl(filePath) {
          calls.downloads.push(filePath);
          return {data: {signedUrl: `https://storage.invalid/object/sign/purchase-inputs/${filePath}?token=fixture`}, error: null};
        },
        async remove(paths) { calls.deleted.push(...paths); if (stalledRemoval) return new Promise(() => {}); return {data: [], error: null}; },
      };
    },
  },
};

const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === './database' && parent.filename.endsWith(`${path.sep}attachmentUploads.ts`)) {
    return {database() { calls.db++; return db; }};
  }
  if (request.startsWith('@/')) return originalLoad.call(this, path.resolve('src', request.slice(2)), parent, isMain);
  return originalLoad.apply(this, arguments);
};
const originalFetch = global.fetch;
global.fetch = async (url, options) => {
  assert.match(String(url), /^https:\/\/storage\.invalid\/object\/sign\/purchase-inputs\//);
  assert.equal(options.cache, 'no-store'); options.signal.throwIfAborted();
  assert.ok(byteResponse, 'Download response fixture required');
  return byteResponse();
};
const savedService = process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.SUPABASE_SERVICE_ROLE_KEY = 'private-upload-test-fixture-only';

const policy = require('../src/lib/uploads/attachmentPolicy.ts');
const helpers = require('../src/lib/server/attachmentUploads.ts');
const {POST, DELETE} = require('../src/app/api/attachments/route.ts');
const {NextRequest} = require('next/server');
const fileSpec = (name = 'cotización.png', size = 5) => ({name, size, type: policy.attachmentContentType(name)});
const refsForm = refs => { const form = new FormData(); form.set('attachmentRefs', JSON.stringify(refs)); return form; };
const collect = async (form, acquisitionId = id, signal) => {
  const files = []; for await (const file of helpers.readPurchaseAttachments(form, acquisitionId, signal)) files.push(file); return files;
};
const sign = async files => (await helpers.createPurchaseAttachmentUploads(id, files)).map(upload => upload.ref);
const rejectBeforeDownload = async (refs, pattern) => {
  const before = calls.downloads.length;
  await assert.rejects(() => collect(refsForm(refs)), pattern);
  assert.equal(calls.downloads.length, before, 'Invalid manifests must fail before any stored file is read');
};

(async () => {
  assert.equal(policy.MAX_ATTACHMENT_FILES, 20); assert.equal(policy.MAX_VISION_IMAGES, 24);
  assert.equal(policy.validateAttachmentSelection([fileSpec('grande.pdf', 50 * 1024 * 1024)]), undefined);
  assert.equal(policy.validateAttachmentSelection(Array.from({length:20}, (_, i) => fileSpec(`${i}.jpg`, 50 * 1024 * 1024))), undefined, 'No aggregate 3 MB cap');
  assert.match(policy.validateAttachmentSelection(Array.from({length:21}, () => fileSpec())), /20 archivos/);
  assert.match(policy.validateAttachmentSelection([fileSpec('grande.pdf', 50 * 1024 * 1024 + 1)]), /50 MB/);
  assert.match(policy.validateAttachmentSelection([fileSpec('script.html')]), /compatible/);
  assert.match(policy.validateAttachmentSelection([fileSpec('../foto.png')]), /nombre inválido/);
  assert.match(policy.validateAttachmentSelection([fileSpec('vacío.txt', 0)]), /vacío/);

  const inline = new FormData(); inline.append('attachments', new File(['hello'], 'nota.txt'));
  const noDatabase = calls.db;
  assert.equal((await collect(inline, 'legacy-test-id'))[0].name, 'nota.txt');
  assert.equal(calls.db, noDatabase, 'Legacy inline input needs no new database access');

  missingBucket = true;
  const uploads = await helpers.createPurchaseAttachmentUploads(id, [fileSpec(), fileSpec('segunda.webp')]);
  assert.equal(calls.bucket.length, 1); assert.equal(uploads.length, 2);
  assert.match(uploads[0].signedUrl, /^https:\/\/storage\.invalid\/object\/upload\/sign\/purchase-inputs\//);
  assert.match(uploads[0].ref.path, new RegExp(`^${id}/[a-f0-9-]{36}/cotizacio_n\\.png$`));
  assert.deepEqual(Object.keys(uploads[0].ref).sort(), ['path','name','size','type','expiresAt','proof'].sort());
  assert.equal(uploads[0].ref.type, 'image/png'); assert.equal(uploads[0].ref.proof.length, 43);
  assert.ok(Math.abs(uploads[0].ref.expiresAt - Date.now() - 2 * 60 * 60 * 1000) < 5000);
  assert.ok(!JSON.stringify(uploads).includes(process.env.SUPABASE_SERVICE_ROLE_KEY), 'Never expose the storage secret');
  const refs = uploads.map(upload => upload.ref);
  const fullSelection = Array.from({length:20}, (_, i) => fileSpec(`${i}.jpg`, policy.MAX_ATTACHMENT_FILE_BYTES));
  const fullRefs = await sign(fullSelection);
  assert.deepEqual(fullRefs.map(ref => ref.name), fullSelection.map(file => file.name), 'Concurrent signing preserves the selected order');
  assert.equal(maxSigning, 4, 'Sign four permissions at a time');
  const realNow = Date.now;
  let expired;
  try {
    Date.now = () => realNow() - 2 * 60 * 60 * 1000 - 1000;
    expired = (await sign([fileSpec('vencida.pdf')]))[0];
  } finally { Date.now = realNow; }
  await rejectBeforeDownload([expired], /venció/);

  for (const change of [
    {name: 'alterada.png'}, {size: 4}, {type: 'image/png'}, {path: refs[1].path.replace(id, otherId)},
    {path: `${id}/../secret.png`}, {path: `https://evil.invalid/x.png`}, {proof: 'a'.repeat(43)},
    {expiresAt: refs[1].expiresAt + 1},
  ]) {
    try { await rejectBeforeDownload([refs[0], {...refs[1], ...change}], /referencia|autorización/); }
    catch (error) { throw Error(`Tampered ${JSON.stringify(change)}: ${error.message}`); }
  }
  await rejectBeforeDownload([refs[0], refs[0]], /referencia/);
  await rejectBeforeDownload(Array.from({length:21}, () => refs[0]), /20 archivos/);
  const combined = refsForm(refs);
  for (let i = 0; i < 19; i++) combined.append('attachments', new File(['x'], `${i}.txt`));
  await assert.rejects(() => collect(combined), /20 archivos/);
  const malformed = new FormData(); malformed.set('attachmentRefs', 'oops');
  await assert.rejects(() => collect(malformed), /referencia/);

  byteResponse = () => new Response(new Uint8Array([1,2,3,4,5]), {headers: {'content-length': '5'}});
  const before = calls.downloads.length;
  const generator = helpers.readPurchaseAttachments(refsForm(refs), id);
  const first = await generator.next();
  assert.equal(first.value.name, 'cotización.png'); assert.equal(first.value.size, 5); assert.equal(first.value.type, 'image/png');
  assert.equal(calls.downloads.length, before + 1, 'Download one file per consumer step');
  const second = await generator.next(); assert.equal(second.value.name, 'segunda.webp');
  assert.equal(calls.downloads.length, before + 2); assert.equal((await generator.next()).done, true);

  byteResponse = () => new Response(new Uint8Array(6), {headers: {'content-length': '6'}});
  await assert.rejects(() => collect(refsForm([refs[0]])), /tamaño/);
  byteResponse = () => new Response(new Uint8Array(6));
  await assert.rejects(() => collect(refsForm([refs[0]])), /tamaño/);
  byteResponse = () => new Response(new Uint8Array(4));
  await assert.rejects(() => collect(refsForm([refs[0]])), /incompleta/);
  const large = (await sign([fileSpec('limite.pdf', policy.MAX_ATTACHMENT_FILE_BYTES)]))[0];
  byteResponse = () => new Response(new Uint8Array(1), {headers: {'content-length': String(policy.MAX_ATTACHMENT_FILE_BYTES + 1)}});
  await assert.rejects(() => collect(refsForm([large])), /tamaño/);
  const cancelled = new AbortController(); cancelled.abort();
  await assert.rejects(() => collect(refsForm(refs), id, cancelled.signal), /abort/i);

  await helpers.cleanupPurchaseAttachments(refsForm(refs), id);
  assert.deepEqual(calls.deleted, refs.map(ref => ref.path));
  const removed = calls.deleted.length;
  await helpers.cleanupPurchaseAttachments(refsForm([{...refs[0], path: 'expedientes-docs/private.docx'}]), id);
  await helpers.cleanupPurchaseAttachments(refsForm(refs), otherId);
  assert.equal(calls.deleted.length, removed, 'Invalid or unrelated storage references must never delete objects');
  await helpers.cleanupPurchaseAttachments(refsForm([expired]), id);
  assert.equal(calls.deleted.at(-1), expired.path, 'A valid expired proof can still clean its own temporary object');
  stalledRemoval = true;
  const cleanupStarted = Date.now();
  await helpers.cleanupPurchaseAttachments(refsForm([refs[0]]), id);
  assert.ok(Date.now() - cleanupStarted < 4000, 'Best-effort cleanup must leave time for the document response');
  stalledRemoval = false;

  company = 'otra'; await assert.rejects(() => sign([fileSpec()]), /empresa/); company = 'ende';
  exists = false; await assert.rejects(() => sign([fileSpec()]), /no encontrado/); exists = true;
  bucketPublic = true; await assert.rejects(() => sign([fileSpec()]), /privado/); bucketPublic = false;
  await assert.rejects(() => sign([{...fileSpec(), type: 'text/html'}]), /tipo/);
  const credential = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = `x.${Buffer.from(JSON.stringify({role:'anon'})).toString('base64url')}.fixture`;
  await assert.rejects(() => sign([fileSpec()]), /privada de servicio/);
  process.env.SUPABASE_SERVICE_ROLE_KEY = credential;

  const beforeRoute = calls.signs.length;
  const hostile = await POST(new NextRequest('https://purchases.invalid/api/attachments', {method:'POST', headers:{origin:'https://evil.invalid'}, body: JSON.stringify({acquisitionId:id, files:[fileSpec()]})}));
  assert.equal(hostile.status, 403); assert.equal(calls.signs.length, beforeRoute);
  const invalid = await POST(new NextRequest('https://purchases.invalid/api/attachments', {method:'POST', body:'{'}));
  assert.equal(invalid.status, 400);
  const tooMuchJson = await POST(new NextRequest('https://purchases.invalid/api/attachments', {method:'POST', body:JSON.stringify({padding:'x'.repeat(65 * 1024)})}));
  assert.equal(tooMuchJson.status, 400); assert.match((await tooMuchJson.json()).error, /demasiado grande/);
  const okay = await POST(new NextRequest('https://purchases.invalid/api/attachments', {method:'POST', headers:{origin:'https://purchases.invalid'}, body:JSON.stringify({acquisitionId:id, files:[fileSpec('foto.jpg', 8 * 1024 * 1024)]})}));
  assert.equal(okay.status, 200); assert.equal((await okay.json()).uploads.length, 1);
  assert.equal(okay.headers.get('cache-control'), 'private, no-store');
  const countDeleted = calls.deleted.length;
  const forbiddenDelete = await DELETE(new NextRequest('https://purchases.invalid/api/attachments', {method:'DELETE', headers:{origin:'https://evil.invalid'}, body:JSON.stringify({acquisitionId:id, refs})}));
  assert.equal(forbiddenDelete.status, 403); assert.equal(calls.deleted.length, countDeleted);
  const tamperedDelete = await DELETE(new NextRequest('https://purchases.invalid/api/attachments', {method:'DELETE', body:JSON.stringify({acquisitionId:id, refs:[refs[0], {...refs[1], size:1}]})}));
  assert.equal(tamperedDelete.status, 400); assert.equal(calls.deleted.length, countDeleted);
  const cleanup = await DELETE(new NextRequest('https://purchases.invalid/api/attachments', {method:'DELETE', headers:{origin:'https://purchases.invalid'}, body:JSON.stringify({acquisitionId:id, refs})}));
  assert.equal(cleanup.status, 200); assert.equal((await cleanup.json()).success, true);
  assert.deepEqual(calls.deleted.slice(countDeleted), refs.map(ref => ref.path));
  console.log('PASS temporary private uploads: 20 files / 50 MB each, signed references, scope and expiry, sequential bounded reads, metadata integrity, cleanup, origin and legacy inline compatibility');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  global.fetch = originalFetch; Module._load = originalLoad;
  if (savedService === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = savedService;
});
