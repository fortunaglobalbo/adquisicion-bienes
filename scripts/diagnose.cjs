const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());
const { createClient } = require('@supabase/supabase-js');
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
  const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);
  for (const table of ['adquisiciones','carpetas','documentos','plantillas','logs_proceso']) {
    const { data, error, count } = await db.from(table).select('*', { count: 'exact' }).limit(1);
    console.log(table, JSON.stringify({count, columns: Object.keys(data?.[0] || {}), error: error?.message}));
  }
  const { data: buckets, error } = await db.storage.listBuckets();
  console.log('storage', JSON.stringify({buckets: buckets?.map(b=>({name:b.name,public:b.public})), error:error?.message}));
  for (const [name, url] of [['engine',process.env.VPS_DOCX_ENGINE_URL],['rag',process.env.ANYTHINGLLM_BASE_URL]]) {
    try { const r=await fetch(url + (name==='engine'?'/openapi.json':'/api/v1/auth'),{signal:AbortSignal.timeout(10000),headers:name==='rag'?{Authorization:'Bearer '+process.env.ANYTHINGLLM_API_KEY}:{}}); console.log(name,r.status); if(name==='engine' && r.ok) console.log('engine paths',Object.keys((await r.json()).paths)); }
    catch { console.log(name,'unreachable'); }
  }
}
main().catch(e=>console.log('diagnostic failed', e.message));
